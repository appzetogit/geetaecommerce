import { CreateProductInput } from "./dto/product.dto";
import { normalizeVariant, normalizeVariantArray } from "./variantHelpers";
import { ProductVariant } from "./types";

const OBJECT_ID_RE = /^[a-fA-F0-9]{24}$/;

function isValidObjectId(id: unknown): boolean {
  if (id == null || id === "") return false;
  return OBJECT_ID_RE.test(String(id).trim());
}

function pickObjectId(...candidates: unknown[]): string | undefined {
  for (const c of candidates) {
    if (isValidObjectId(c)) return String(c).trim();
  }
  return undefined;
}

function parseBool(val: unknown, fallback: boolean): boolean {
  if (val === true || val === "true") return true;
  if (val === false || val === "false") return false;
  return fallback;
}

function parseTags(tags: unknown): string[] {
  if (Array.isArray(tags)) return tags.map(String).filter(Boolean);
  if (typeof tags === "string") {
    return tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }
  return [];
}

export interface NormalizedProductPayload {
  productName: string;
  smallDescription?: string;
  description?: string;
  headerCategoryId?: string;
  category?: string;
  subcategory?: string;
  subSubCategory?: string;
  brand?: string;
  gst?: number;
  tax?: string;
  hsnCode?: string;
  publish: boolean;
  popular: boolean;
  dealOfDay: boolean;
  status: "Active" | "Inactive" | "Pending" | "Rejected";
  seoTitle?: string;
  seoKeywords?: string;
  seoDescription?: string;
  seoImageAlt?: string;
  tags: string[];
  manufacturer?: string;
  madeIn?: string;
  marketer?: string;
  shelfLife?: string;
  pack?: string;
  fssaiLicNo?: string;
  isReturnable: boolean;
  maxReturnDays?: number;
  returnPolicyText?: string;
  warrantyType?: "None" | "Warranty" | "Guarantee";
  warrantyDuration?: string;
  totalAllowedQuantity?: number;
  lowStockQuantity?: number;
  deliveryTime?: string;
  commission?: number;
  isShopByStoreOnly: boolean;
  shopId?: string;
  seller?: string;
  variations: ProductVariant[];
}

export function extractVariantsFromBody(body: Record<string, unknown>): ProductVariant[] {
  const raw = body.variants ?? body.variations;
  if (Array.isArray(raw) && raw.length > 0) {
    return normalizeVariantArray(raw);
  }

  // Auto-generate a single default variant from root-level product fields.
  // This covers Bulk Edit creation without manual variants as well as legacy products.
  // Fields like price=0, stock=0, or no images are all acceptable — normalizeVariant
  // handles safe defaults for each field.
  return [
    normalizeVariant({
      variationType: body.variationType || "Standard",
      value: "Default",
      price: body.price ?? 0,
      discPrice: body.discPrice ?? body.offerPrice ?? body.price ?? 0,
      compareAtPrice: body.compareAtPrice ?? body.mrp,
      wholesalePrice: body.wholesalePrice,
      purchasePrice: body.purchasePrice,
      stock: body.stock ?? 0,
      sku: body.sku ?? body.itemCode,
      barcode: body.barcode,
      rackNumber: body.rackNumber,
      mainImage: body.mainImage ?? body.mainImageUrl,
      galleryImages: body.galleryImages ?? body.galleryImageUrls,
      tieredPrices: body.tieredPrices ?? body.unitPricing,
    }),
  ];
}

export function normalizeCreatePayload(
  body: Record<string, unknown>,
  defaults: { publish: boolean }
): NormalizedProductPayload {
  const parsed = body as CreateProductInput & Record<string, unknown>;
  const variations = extractVariantsFromBody(body);

  // variations will always have at least one entry after extractVariantsFromBody.
  // No need to throw here — the Mongoose schema validates the array on save.

  const category = pickObjectId(parsed.categoryId, parsed.category);
  const subcategory = pickObjectId(parsed.subcategoryId, parsed.subcategory);
  const brand = pickObjectId(parsed.brandId, parsed.brand);
  const tax = pickObjectId(parsed.taxId, parsed.tax);
  const headerCategoryId = pickObjectId(parsed.headerCategoryId);
  const shopId = pickObjectId(parsed.shopId);
  const seller = pickObjectId(parsed.sellerId, parsed.seller);

  const subSubCategory =
    parsed.subSubCategoryId != null
      ? String(parsed.subSubCategoryId)
      : parsed.subSubCategory != null
        ? String(parsed.subSubCategory)
        : undefined;

  const isShopByStoreOnly = parseBool(parsed.isShopByStoreOnly, false);

  return {
    productName: String(parsed.productName || "").trim(),
    smallDescription: parsed.smallDescription
      ? String(parsed.smallDescription)
      : undefined,
    description: parsed.description ? String(parsed.description) : undefined,
    headerCategoryId,
    category,
    subcategory,
    subSubCategory,
    brand,
    gst: parsed.gst != null ? Number(parsed.gst) : undefined,
    tax,
    hsnCode: parsed.hsnCode ? String(parsed.hsnCode) : undefined,
    publish: parseBool(parsed.publish, defaults.publish),
    popular: parseBool(parsed.popular, false),
    dealOfDay: parseBool(parsed.dealOfDay, false),
    status: (parsed.status as NormalizedProductPayload["status"]) || "Active",
    seoTitle: parsed.seoTitle ? String(parsed.seoTitle) : undefined,
    seoKeywords: parsed.seoKeywords ? String(parsed.seoKeywords) : undefined,
    seoDescription: parsed.seoDescription
      ? String(parsed.seoDescription)
      : undefined,
    seoImageAlt: parsed.seoImageAlt ? String(parsed.seoImageAlt) : undefined,
    tags: parseTags(parsed.tags),
    manufacturer: parsed.manufacturer ? String(parsed.manufacturer) : undefined,
    madeIn: parsed.madeIn ? String(parsed.madeIn) : undefined,
    marketer: parsed.marketer ? String(parsed.marketer) : undefined,
    shelfLife: parsed.shelfLife ? String(parsed.shelfLife) : undefined,
    pack: parsed.pack ? String(parsed.pack) : undefined,
    fssaiLicNo: parsed.fssaiLicNo ? String(parsed.fssaiLicNo) : undefined,
    isReturnable: parseBool(parsed.isReturnable, false),
    maxReturnDays:
      parsed.maxReturnDays != null ? Number(parsed.maxReturnDays) : undefined,
    returnPolicyText: parsed.returnPolicyText
      ? String(parsed.returnPolicyText)
      : undefined,
    warrantyType: parsed.warrantyType,
    warrantyDuration: parsed.warrantyDuration
      ? String(parsed.warrantyDuration)
      : undefined,
    totalAllowedQuantity:
      parsed.totalAllowedQuantity != null
        ? Number(parsed.totalAllowedQuantity)
        : undefined,
    lowStockQuantity:
      parsed.lowStockQuantity != null
        ? Number(parsed.lowStockQuantity)
        : undefined,
    deliveryTime: parsed.deliveryTime ? String(parsed.deliveryTime) : undefined,
    commission:
      parsed.commission != null ? Number(parsed.commission) : undefined,
    isShopByStoreOnly,
    shopId: isShopByStoreOnly ? shopId : undefined,
    seller,
    variations,
  };
}
