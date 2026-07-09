import cosineSimilarity from "compute-cosine-similarity";
import mongoose from "mongoose";
import Product, { buildProductSearchText } from "../models/Product";
import Category from "../models/Category";
import Brand from "../models/Brand";
import Seller from "../models/Seller";
import AppSettings from "../models/AppSettings";
import SearchAnalytics from "../models/SearchAnalytics";
import { generateEmbedding } from "../utils/embedding";
import { findSellersWithinRange } from "../utils/locationHelper";
import { cache } from "../utils/cache";
import { toListItem } from "../modules/product/productReadMapper";
import { getTotalStock, variantsFromProductDoc } from "../modules/product/variantHelpers";

const DEFAULT_CANDIDATE_LIMIT = Number(process.env.SEARCH_CANDIDATE_LIMIT || 1500);
const SEMANTIC_WEIGHT = 0.35;
const KEYWORD_WEIGHT = 0.65;
const LEXICAL_MATCH_THRESHOLD = 0.18;
const SHORT_QUERY_SEMANTIC_THRESHOLD = 0.62;
const LONG_QUERY_SEMANTIC_THRESHOLD = 0.52;
const SEMANTIC_ONLY_FINAL_THRESHOLD = 0.35;
const SEARCH_CACHE_TTL_MS = Number(process.env.SEARCH_CACHE_TTL_MS || 60_000);
const TRENDING_CACHE_TTL_MS = Number(process.env.SEARCH_TRENDING_CACHE_TTL_MS || 120_000);
const SUGGESTIONS_CACHE_TTL_MS = Number(process.env.SEARCH_SUGGESTIONS_CACHE_TTL_MS || 30_000);

export interface SearchOptions {
  query: string;
  page?: number;
  limit?: number;
  latitude?: number;
  longitude?: number;
  sort?: "relevance" | "price_asc" | "price_desc" | "popular";
  minPrice?: number;
  maxPrice?: number;
  category?: string;
  userId?: string;
  userAgent?: string;
  ip?: string;
}

export const sanitizeSearchQuery = (value: unknown, maxLength = 120): string => {
  return String(value || "")
    .replace(/[<>${}\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
};

const normalizeText = (value: unknown): string => {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const getTokens = (value: string): string[] => {
  return normalizeText(value).split(" ").filter((token) => token.length > 1);
};

const escapeRegex = (value: string): string => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const levenshteinDistance = (left: string, right: string): number => {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;

  const row = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let i = 1; i <= left.length; i += 1) {
    let previous = row[0];
    row[0] = i;

    for (let j = 1; j <= right.length; j += 1) {
      const temporary = row[j];
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + cost);
      previous = temporary;
    }
  }

  return row[right.length];
};

const tokenSimilarity = (queryToken: string, fieldToken: string): number => {
  if (!queryToken || !fieldToken) return 0;
  if (queryToken === fieldToken) return 1;
  if (fieldToken.startsWith(queryToken)) return 0.92;
  if (queryToken.length >= 4 && fieldToken.includes(queryToken)) return 0.78;
  if (fieldToken.length >= 4 && queryToken.includes(fieldToken)) return 0.65;

  const maxLength = Math.max(queryToken.length, fieldToken.length);
  if (maxLength < 4) return 0;
  const distance = levenshteinDistance(queryToken, fieldToken);
  const score = 1 - distance / maxLength;
  return score >= 0.66 ? score * 0.72 : 0;
};

const fieldMatchScore = (queryTokens: string[], field: unknown): number => {
  const fieldText = normalizeText(Array.isArray(field) ? field.join(" ") : field);
  if (!fieldText || queryTokens.length === 0) return 0;

  const fieldTokens = getTokens(fieldText);
  const exactPhraseBoost = fieldText.includes(queryTokens.join(" ")) ? 0.12 : 0;
  const tokenScores = queryTokens.map((queryToken) =>
    Math.max(...fieldTokens.map((fieldToken) => tokenSimilarity(queryToken, fieldToken)), 0)
  );

  const average = tokenScores.reduce((sum, score) => sum + score, 0) / queryTokens.length;
  return Math.min(1, average + exactPhraseBoost);
};

const keywordScore = (query: string, product: any): number => {
  const queryTokens = getTokens(query);
  if (!queryTokens.length) return 0;

  const categoryName = product.category?.name || "";
  const brandName = product.brand?.name || "";

  return (
    fieldMatchScore(queryTokens, product.productName) * 0.42 +
    fieldMatchScore(queryTokens, categoryName) * 0.2 +
    fieldMatchScore(queryTokens, product.tags) * 0.16 +
    fieldMatchScore(queryTokens, brandName) * 0.12 +
    fieldMatchScore(queryTokens, `${product.smallDescription || ""} ${product.description || ""}`) * 0.1
  );
};

const lexicalCandidateFields = [
  "productName",
  "smallDescription",
  "description",
  "tags",
  "sku",
  "barcode",
  "variations.name",
  "variations.value",
  "variations.sku",
  "variations.barcode",
  "pack",
];

const buildLexicalCandidateConditions = (query: string) => {
  const phrases = Array.from(new Set([query, ...getTokens(query)]))
    .map((phrase) => phrase.trim())
    .filter((phrase) => phrase.length > 1)
    .slice(0, 8);

  const exactConditions = phrases.flatMap((phrase) => {
    const regex = new RegExp(escapeRegex(phrase), "i");
    return lexicalCandidateFields.map((field) => ({ [field]: regex }));
  });

  const fuzzyPrefixConditions = phrases
    .filter((phrase) => phrase.length >= 4)
    .flatMap((phrase) => {
      const prefixLength = Math.min(4, Math.max(3, phrase.length - 2));
      const regex = new RegExp(`\\b${escapeRegex(phrase.slice(0, prefixLength))}`, "i");
      return lexicalCandidateFields.map((field) => ({ [field]: regex }));
    });

  return [...exactConditions, ...fuzzyPrefixConditions];
};

const mergeProductsById = (...groups: any[][]) => {
  const seen = new Set<string>();
  return groups.flat().filter((product) => {
    const id = String(product._id);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

const toNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

// Customer-side seller visibility is gated solely by `isEnabled`.
// (`canCreateCategories` is an admin/authoring permission whose default is
// `true` — using it here previously hid every normal seller's products.)
const visibleSellerQuery = { isEnabled: true } as const;

const buildVisibleProductQuery = async (options: Partial<SearchOptions>) => {
  const query: Record<string, any> = {
    status: "Active",
    publish: true,
  };

  const activeCategories = await Category.find({ status: "Active" }).select("_id").lean();
  query.category = { $in: activeCategories.map((category) => category._id) };

  const andConditions: any[] = [
    {
      $or: [
        { isShopByStoreOnly: { $ne: true } },
        { isShopByStoreOnly: { $exists: false } },
      ],
    },
  ];

  const settings = await AppSettings.findOne().lean();
  const inventorySection = settings?.productDisplaySettings?.find((section) => section.id === "inventory");
  const negativeStockSoldOut = inventorySection?.fields?.find(
    (field) => field.id === "negative_stock_sold_out"
  )?.isEnabled;
  if (negativeStockSoldOut) {
    // Post-filter in-memory after mapping; root stock field is deprecated
  }

  if (options.minPrice !== undefined || options.maxPrice !== undefined) {
    // Price filters applied after mapping via listing.minPrice/maxPrice
  }

  if (options.category) {
    const categoryValue = String(options.category);
    const category = mongoose.Types.ObjectId.isValid(categoryValue)
      ? await Category.findById(categoryValue).select("_id name").lean()
      : await Category.findOne({
          $or: [
            { slug: normalizeText(categoryValue).replace(/\s+/g, "-") },
            { name: { $regex: new RegExp(`^${categoryValue}$`, "i") } },
          ],
          status: "Active",
        })
          .select("_id name")
          .lean();

    if (category?._id) andConditions.push({ category: category._id });
  }

  if (options.latitude && options.longitude) {
    const nearbySellerIds = await findSellersWithinRange(options.latitude, options.longitude);
    const visibleSellers = await Seller.find({
      _id: { $in: nearbySellerIds },
      ...visibleSellerQuery,
    }).select("_id");
    query.seller = { $in: visibleSellers.map((seller) => seller._id) };
  } else {
    const visibleSellers = await Seller.find(visibleSellerQuery).select("_id");
    query.seller = { $in: visibleSellers.map((seller) => seller._id) };
  }

  if (andConditions.length) query.$and = andConditions;
  return query;
};

const productProjection =
  "+embedding productName smallDescription description category subcategory brand tags price discPrice compareAtPrice stock mainImage galleryImages pack discount rating reviewsCount deliveryTime variations unitPricing searchCount popular dealOfDay createdAt";

const sortResults = (results: any[], sort: SearchOptions["sort"]) => {
  if (sort === "price_asc") return results.sort((a, b) => ((a.listing?.minPrice ?? a.price) || 0) - ((b.listing?.minPrice ?? b.price) || 0));
  if (sort === "price_desc") return results.sort((a, b) => ((b.listing?.minPrice ?? b.price) || 0) - ((a.listing?.minPrice ?? a.price) || 0));
  if (sort === "popular") {
    return results.sort(
      (a, b) =>
        (b.searchCount || 0) + (b.rating || 0) + (b.reviewsCount || 0) -
        ((a.searchCount || 0) + (a.rating || 0) + (a.reviewsCount || 0))
    );
  }
  return results.sort((a, b) => b.searchScore.finalScore - a.searchScore.finalScore);
};

const mapProductForClient = (product: any, searchScore: Record<string, number>) => {
  const mapped = toListItem(product);
  const safeProduct = { ...mapped };
  delete (safeProduct as any).embedding;
  return {
    ...safeProduct,
    id: String(product._id),
    name: product.productName,
    imageUrl: mapped.listing.imageUrl,
    price: mapped.price,
    stock: mapped.listing.totalStock,
    searchScore,
  };
};

const buildSearchCacheKey = (prefix: string, payload: Record<string, unknown>) => {
  const normalized = Object.entries(payload)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .sort(([left], [right]) => left.localeCompare(right));
  return `${prefix}:${JSON.stringify(normalized)}`;
};

export const hybridProductSearch = async (options: SearchOptions) => {
  const startedAt = Date.now();
  const query = sanitizeSearchQuery(options.query);
  const page = Math.max(1, Number(options.page || 1));
  const limit = Math.min(50, Math.max(1, Number(options.limit || 10)));

  if (!query) {
    return {
      results: [],
      pagination: { page, limit, total: 0, pages: 0 },
      meta: { query, latencyMs: Date.now() - startedAt },
    };
  }

  const cacheKey = buildSearchCacheKey("search:hybrid", {
    query: normalizeText(query),
    page,
    limit,
    sort: options.sort || "relevance",
    minPrice: options.minPrice,
    maxPrice: options.maxPrice,
    category: options.category,
    latitude: options.latitude ? Number(options.latitude.toFixed(2)) : undefined,
    longitude: options.longitude ? Number(options.longitude.toFixed(2)) : undefined,
  });

  const cached = cache.get<{
    results: any[];
    pagination: { page: number; limit: number; total: number; pages: number };
    meta: { query: string; weights: { semantic: number; keyword: number } };
  }>(cacheKey);

  let results: any[] = [];
  let total = 0;
  let pages = 0;

  if (cached) {
    results = cached.results;
    total = cached.pagination.total;
    pages = cached.pagination.pages;
  } else {
    const [queryEmbedding, productQuery] = await Promise.all([
      generateEmbedding(query),
      buildVisibleProductQuery(options),
    ]);

    const lexicalConditions = buildLexicalCandidateConditions(query);
    const lexicalCandidateQuery = lexicalConditions.length
      ? { ...productQuery, $or: lexicalConditions }
      : productQuery;

    const [lexicalProducts, semanticProducts] = await Promise.all([
      Product.find(lexicalCandidateQuery)
        .select(productProjection)
        .populate("category", "name image")
        .populate("subcategory", "name")
        .populate("brand", "name")
        .limit(DEFAULT_CANDIDATE_LIMIT)
        .lean(),
      Product.find(productQuery)
        .select(productProjection)
        .populate("category", "name image")
        .populate("subcategory", "name")
        .populate("brand", "name")
        .sort({ searchCount: -1, popular: -1, createdAt: -1 })
        .limit(DEFAULT_CANDIDATE_LIMIT)
        .lean(),
    ]);

    const products = mergeProductsById(lexicalProducts, semanticProducts);
    const queryTokens = getTokens(query);
    const semanticOnlyThreshold =
      queryTokens.length <= 2 ? SHORT_QUERY_SEMANTIC_THRESHOLD : LONG_QUERY_SEMANTIC_THRESHOLD;

    const scored = products
      .map((product: any) => {
        const semanticScore = Array.isArray(product.embedding) && product.embedding.length
          ? Math.max(0, cosineSimilarity(queryEmbedding, product.embedding) || 0)
          : 0;
        const lexicalScore = keywordScore(query, product);
        const popularityBoost = Math.min(0.08, Math.log10((product.searchCount || 0) + 1) * 0.02);
        const stockPenalty = product.stock === 0 ? 0.05 : 0;
        const finalScore = Math.max(
          0,
          semanticScore * SEMANTIC_WEIGHT + lexicalScore * KEYWORD_WEIGHT + popularityBoost - stockPenalty
        );

        return mapProductForClient(product, {
          semanticScore: Number(semanticScore.toFixed(4)),
          keywordScore: Number(lexicalScore.toFixed(4)),
          finalScore: Number(finalScore.toFixed(4)),
        });
      })
      .filter(
        (product) =>
          product.searchScore.keywordScore >= LEXICAL_MATCH_THRESHOLD ||
          (
            product.searchScore.semanticScore >= semanticOnlyThreshold &&
            product.searchScore.finalScore >= SEMANTIC_ONLY_FINAL_THRESHOLD
          )
      );

    const sorted = sortResults(scored, options.sort || "relevance");
    total = sorted.length;
    pages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    results = sorted.slice(start, start + limit);

    cache.set(
      cacheKey,
      {
        results,
        pagination: { page, limit, total, pages },
        meta: {
          query,
          weights: { semantic: SEMANTIC_WEIGHT, keyword: KEYWORD_WEIGHT },
        },
      },
      SEARCH_CACHE_TTL_MS
    );
  }

  if (results.length) {
    await Product.updateMany(
      { _id: { $in: results.map((product) => product._id) } },
      { $inc: { searchCount: 1 } }
    );
  }

  const latencyMs = Date.now() - startedAt;
  await SearchAnalytics.create({
    query,
    normalizedQuery: normalizeText(query),
    resultCount: total,
    user: options.userId && mongoose.Types.ObjectId.isValid(options.userId) ? options.userId : undefined,
    source: "search",
    metadata: {
      page,
      limit,
      latencyMs,
      zeroResults: total === 0,
      userAgent: options.userAgent,
      ip: options.ip,
    },
  });

  return {
    results,
    pagination: {
      page,
      limit,
      total,
      pages,
    },
    meta: {
      query,
      weights: { semantic: SEMANTIC_WEIGHT, keyword: KEYWORD_WEIGHT },
      latencyMs,
    },
  };
};

export const getSimilarProductsForProduct = async (productId: string, limit = 6) => {
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    const error = new Error("Invalid product ID");
    (error as any).statusCode = 400;
    throw error;
  }

  const cacheKey = buildSearchCacheKey("search:similar", { productId, limit });
  const cached = cache.get<any[]>(cacheKey);
  if (cached) return cached;

  const target = await Product.findOne({ _id: productId, status: "Active", publish: true })
    .select(productProjection)
    .populate("category", "name image")
    .populate("subcategory", "name")
    .populate("brand", "name")
    .lean();

  if (!target) {
    const error = new Error("Product not found");
    (error as any).statusCode = 404;
    throw error;
  }

  let targetEmbedding = Array.isArray((target as any).embedding) ? (target as any).embedding : [];
  if (!targetEmbedding.length) {
    targetEmbedding = await generateEmbedding(await buildProductSearchText(target as any));
  }

  const baseQuery = await buildVisibleProductQuery({});
  const candidates = await Product.find({
    ...baseQuery,
    _id: { $ne: target._id },
    embedding: { $exists: true, $ne: [] },
  })
    .select(productProjection)
    .populate("category", "name image")
    .populate("subcategory", "name")
    .populate("brand", "name")
    .limit(DEFAULT_CANDIDATE_LIMIT)
    .lean();

  const similarProducts = candidates
    .map((product: any) => {
      const similarity = Math.max(0, cosineSimilarity(targetEmbedding, product.embedding) || 0);
      const categoryBoost =
        String(product.category?._id || product.category) === String((target as any).category?._id || (target as any).category)
          ? 0.08
          : 0;
      const finalScore = Math.min(1, similarity + categoryBoost);
      return mapProductForClient(product, {
        semanticScore: Number(similarity.toFixed(4)),
        finalScore: Number(finalScore.toFixed(4)),
      });
    })
    .sort((a, b) => b.searchScore.finalScore - a.searchScore.finalScore)
    .slice(0, limit);

  cache.set(cacheKey, similarProducts, SEARCH_CACHE_TTL_MS);
  return similarProducts;
};

export const getSearchSuggestionsForQuery = async (rawQuery: unknown, limit = 10) => {
  const query = sanitizeSearchQuery(rawQuery, 80);
  if (!query || query.length < 2) return [];

  const cacheKey = buildSearchCacheKey("search:suggestions", {
    query: normalizeText(query),
    limit,
  });
  const cached = cache.get<any[]>(cacheKey);
  if (cached) return cached;

  const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const productQuery = await buildVisibleProductQuery({});

  const [products, categories, brands, tags, trending] = await Promise.all([
    Product.find({ ...productQuery, productName: regex })
      .select("productName _id mainImage price compareAtPrice discount category")
      .populate("category", "name")
      .limit(limit)
      .lean(),
    Category.find({ name: regex, status: "Active" }).select("name _id image").limit(5).lean(),
    Brand.find({ name: regex }).select("name _id image").limit(5).lean(),
    Product.distinct("tags", { ...productQuery, tags: regex }),
    SearchAnalytics.aggregate([
      { $match: { normalizedQuery: regex } },
      { $group: { _id: "$normalizedQuery", count: { $sum: 1 }, lastSearchedAt: { $max: "$createdAt" } } },
      { $sort: { count: -1, lastSearchedAt: -1 } },
      { $limit: 5 },
    ]),
  ]);

  const seen = new Set<string>();
  const add = (items: any[]) => {
    const next: any[] = [];
    for (const item of items) {
      const key = `${item.type}:${normalizeText(item.name)}`;
      if (!item.name || seen.has(key)) continue;
      seen.add(key);
      next.push(item);
    }
    return next;
  };

  const suggestions = add([
    { id: "search", name: query, type: "search" },
    ...trending.map((item) => ({ id: item._id, name: item._id, type: "trending", count: item.count })),
    ...products.map((product: any) => ({
      id: product._id,
      name: product.productName,
      type: "product",
      image: product.mainImage,
      categoryName: product.category?.name,
      price: product.price,
      mrp: product.compareAtPrice || product.price,
      discount: product.discount,
    })),
    ...categories.map((category) => ({
      id: category._id,
      name: category.name,
      type: "category",
      image: category.image,
    })),
    ...brands.map((brand: any) => ({
      id: brand._id,
      name: brand.name,
      type: "brand",
      image: brand.image,
    })),
    ...tags.slice(0, 6).map((tag) => ({ id: tag, name: tag, type: "tag" })),
  ]).slice(0, limit);

  cache.set(cacheKey, suggestions, SUGGESTIONS_CACHE_TTL_MS);
  return suggestions;
};

export const getTrendingSearches = async (limit = 10) => {
  const cacheKey = buildSearchCacheKey("search:trending", { limit });
  const cached = cache.get<{
    popular: any[];
    zeroResults: any[];
  }>(cacheKey);
  if (cached) return cached;

  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const [popular, zeroResults] = await Promise.all([
    SearchAnalytics.aggregate([
      { $match: { createdAt: { $gte: since }, normalizedQuery: { $ne: "" } } },
      {
        $group: {
          _id: "$normalizedQuery",
          query: { $last: "$query" },
          count: { $sum: 1 },
          lastSearchedAt: { $max: "$createdAt" },
          averageResults: { $avg: "$resultCount" },
        },
      },
      { $sort: { count: -1, lastSearchedAt: -1 } },
      { $limit: limit },
    ]),
    SearchAnalytics.aggregate([
      { $match: { createdAt: { $gte: since }, resultCount: 0, normalizedQuery: { $ne: "" } } },
      { $group: { _id: "$normalizedQuery", query: { $last: "$query" }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]),
  ]);

  const trending = {
    popular: popular.map((item) => ({
      query: item.query || item._id,
      normalizedQuery: item._id,
      count: item.count,
      lastSearchedAt: item.lastSearchedAt,
      averageResults: Math.round(item.averageResults || 0),
    })),
    zeroResults: zeroResults.map((item) => ({
      query: item.query || item._id,
      normalizedQuery: item._id,
      count: item.count,
    })),
  };
  cache.set(cacheKey, trending, TRENDING_CACHE_TTL_MS);
  return trending;
};

export interface RecommendationOptions {
  userId?: string;
  limit?: number;
  latitude?: number;
  longitude?: number;
}

export const getSmartRecommendations = async (options: RecommendationOptions = {}) => {
  const limit = Math.min(24, Math.max(1, Number(options.limit || 12)));
  const normalizedUserId = options.userId && mongoose.Types.ObjectId.isValid(options.userId) ? options.userId : "anon";
  const cacheKey = buildSearchCacheKey("search:recommendations", {
    userId: normalizedUserId,
    limit,
    latitude: options.latitude ? Number(options.latitude.toFixed(2)) : undefined,
    longitude: options.longitude ? Number(options.longitude.toFixed(2)) : undefined,
  });

  const cached = cache.get<any[]>(cacheKey);
  if (cached) return cached;

  const baseQuery = await buildVisibleProductQuery({
    latitude: options.latitude,
    longitude: options.longitude,
  });

  const recentSignals = options.userId
    ? await SearchAnalytics.find({
        user: options.userId,
        source: { $in: ["search", "recommendation"] },
      })
        .sort({ createdAt: -1 })
        .limit(60)
        .select("query clickedProducts")
        .lean()
    : [];

  const clickedProductIds = Array.from(
    new Set(
      recentSignals.flatMap((signal) =>
        (signal.clickedProducts || []).map((productId) => String(productId))
      )
    )
  );

  const clickedProducts = clickedProductIds.length
    ? await Product.find({ _id: { $in: clickedProductIds } })
        .select("category tags brand")
        .lean()
    : [];

  const preferredCategories = Array.from(
    new Set(clickedProducts.map((product: any) => String(product.category)).filter(Boolean))
  );
  const preferredBrands = Array.from(
    new Set(clickedProducts.map((product: any) => String(product.brand)).filter(Boolean))
  );
  const preferredTags = Array.from(
    new Set(clickedProducts.flatMap((product: any) => product.tags || []).filter(Boolean))
  );

  const personalizationQuery: Record<string, any> = {
    ...baseQuery,
    ...(clickedProductIds.length ? { _id: { $nin: clickedProductIds } } : {}),
  };

  const preferenceOr: any[] = [];
  if (preferredCategories.length) preferenceOr.push({ category: { $in: preferredCategories } });
  if (preferredBrands.length) preferenceOr.push({ brand: { $in: preferredBrands } });
  if (preferredTags.length) preferenceOr.push({ tags: { $in: preferredTags } });
  if (preferenceOr.length) personalizationQuery.$or = preferenceOr;

  const [personalizedProducts, fallbackProducts] = await Promise.all([
    preferenceOr.length
      ? Product.find(personalizationQuery)
          .select(productProjection)
          .populate("category", "name image")
          .populate("subcategory", "name")
          .populate("brand", "name")
          .sort({ searchCount: -1, popular: -1, rating: -1, createdAt: -1 })
          .limit(limit)
          .lean()
      : Promise.resolve([]),
    Product.find(baseQuery)
      .select(productProjection)
      .populate("category", "name image")
      .populate("subcategory", "name")
      .populate("brand", "name")
      .sort({ searchCount: -1, popular: -1, rating: -1, createdAt: -1 })
      .limit(limit * 2)
      .lean(),
  ]);

  const seen = new Set<string>();
  const merged = [...personalizedProducts, ...fallbackProducts].filter((product: any) => {
    const id = String(product._id);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  const recommendations = merged
    .slice(0, limit)
    .map((product: any) =>
      mapProductForClient(product, {
        semanticScore: 0,
        keywordScore: 0,
        finalScore: Number(
          (
            Math.min(1, (product.searchCount || 0) / 100) * 0.45 +
            (product.popular ? 0.25 : 0) +
            Math.min(1, Number(product.rating || 0) / 5) * 0.2 +
            Math.min(0.1, Number(product.discount || 0) / 100)
          ).toFixed(4)
        ),
      })
    );

  cache.set(cacheKey, recommendations, SEARCH_CACHE_TTL_MS);
  return recommendations;
};

export const recordProductSearchClick = async (query: unknown, productId: string, userId?: string) => {
  const normalizedQuery = normalizeText(sanitizeSearchQuery(query));
  if (!normalizedQuery || !mongoose.Types.ObjectId.isValid(productId)) return null;

  return SearchAnalytics.findOneAndUpdate(
    { normalizedQuery },
    {
      $addToSet: { clickedProducts: productId },
      $setOnInsert: {
        query: sanitizeSearchQuery(query),
        resultCount: 0,
        user: userId && mongoose.Types.ObjectId.isValid(userId) ? userId : undefined,
        source: "search",
      },
    },
    { sort: { createdAt: -1 }, new: true, upsert: true }
  );
};

export const parseSearchOptions = (query: Record<string, any>, user?: any): SearchOptions => ({
  query: sanitizeSearchQuery(query.q || query.query || query.search),
  page: toNumber(query.page) || 1,
  limit: toNumber(query.limit) || 10,
  latitude: toNumber(query.latitude),
  longitude: toNumber(query.longitude),
  sort: ["relevance", "price_asc", "price_desc", "popular"].includes(String(query.sort))
    ? (query.sort as SearchOptions["sort"])
    : "relevance",
  minPrice: toNumber(query.minPrice),
  maxPrice: toNumber(query.maxPrice),
  category: query.category ? sanitizeSearchQuery(query.category, 80) : undefined,
  userId: user?.userId || user?.id,
});
