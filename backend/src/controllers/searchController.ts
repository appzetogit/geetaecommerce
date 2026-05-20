import { Request, Response } from "express";
import {
  getSmartRecommendations,
  getSearchSuggestionsForQuery,
  getSimilarProductsForProduct,
  getTrendingSearches,
  hybridProductSearch,
  parseSearchOptions,
  recordProductSearchClick,
  sanitizeSearchQuery,
} from "../services/searchService";

export const semanticSearch = async (req: Request, res: Response) => {
  try {
    const requestUser = (req as any).user;
    const options = {
      ...parseSearchOptions(req.query as Record<string, any>, requestUser),
      userAgent: req.get("user-agent"),
      ip: req.ip,
    };

    if (!options.query) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    const search = await hybridProductSearch(options);

    return res.status(200).json({
      success: true,
      data: search.results,
      pagination: search.pagination,
      meta: search.meta,
    });
  } catch (error: any) {
    console.error("[Search] semanticSearch failed", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Search failed",
    });
  }
};

export const getSuggestions = async (req: Request, res: Response) => {
  try {
    const query = sanitizeSearchQuery(req.query.q || req.query.query, 80);
    if (!query || query.length < 2) {
      return res.status(200).json({ success: true, data: [] });
    }

    const limit = Math.min(15, Math.max(1, Number(req.query.limit || 10)));
    const suggestions = await getSearchSuggestionsForQuery(query, limit);

    return res.status(200).json({
      success: true,
      data: suggestions,
    });
  } catch (error: any) {
    console.error("[Search] getSuggestions failed", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching search suggestions",
    });
  }
};

export const getTrending = async (req: Request, res: Response) => {
  try {
    const limit = Math.min(20, Math.max(1, Number(req.query.limit || 10)));
    const trending = await getTrendingSearches(limit);

    return res.status(200).json({
      success: true,
      data: trending,
    });
  } catch (error: any) {
    console.error("[Search] getTrending failed", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching trending searches",
    });
  }
};

export const getSimilarProducts = async (req: Request, res: Response) => {
  try {
    const limit = Math.min(12, Math.max(1, Number(req.query.limit || 6)));
    const products = await getSimilarProductsForProduct(req.params.id, limit);

    return res.status(200).json({
      success: true,
      data: products,
    });
  } catch (error: any) {
    console.error("[Search] getSimilarProducts failed", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Error fetching similar products",
    });
  }
};

export const trackSearchClick = async (req: Request, res: Response) => {
  try {
    const query = sanitizeSearchQuery(req.body?.query || req.query.q, 120);
    const productId = String(req.body?.productId || req.query.productId || "");

    if (!query || !productId) {
      return res.status(400).json({
        success: false,
        message: "query and productId are required",
      });
    }

    const requestUser = (req as any).user;
    await recordProductSearchClick(query, productId, requestUser?.userId || requestUser?.id);
    return res.status(204).send();
  } catch (error: any) {
    console.error("[Search] trackSearchClick failed", error);
    return res.status(500).json({
      success: false,
      message: "Error tracking search click",
    });
  }
};

export const getRecommendations = async (req: Request, res: Response) => {
  try {
    const requestUser = (req as any).user;
    const limit = Math.min(24, Math.max(1, Number(req.query.limit || 12)));
    const latitude = req.query.latitude ? Number(req.query.latitude) : undefined;
    const longitude = req.query.longitude ? Number(req.query.longitude) : undefined;

    const recommendations = await getSmartRecommendations({
      userId: requestUser?.userId || requestUser?.id,
      limit,
      latitude,
      longitude,
    });

    return res.status(200).json({
      success: true,
      data: recommendations,
      meta: {
        personalized: Boolean(requestUser?.userId || requestUser?.id),
      },
    });
  } catch (error: any) {
    console.error("[Search] getRecommendations failed", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching recommendations",
    });
  }
};
