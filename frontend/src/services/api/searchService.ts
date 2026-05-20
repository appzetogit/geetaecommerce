import api from "./config";
import { Product } from "../../types/domain";

export interface SearchProduct extends Product {
  searchScore?: {
    semanticScore: number;
    keywordScore?: number;
    finalScore: number;
  };
}

export interface SemanticSearchParams {
  q: string;
  page?: number;
  limit?: number;
  sort?: "relevance" | "price_asc" | "price_desc" | "popular";
  minPrice?: number;
  maxPrice?: number;
  category?: string;
  latitude?: number;
  longitude?: number;
}

export interface SemanticSearchResponse {
  success: boolean;
  data: SearchProduct[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  meta?: {
    query: string;
    latencyMs: number;
    weights: {
      semantic: number;
      keyword: number;
    };
  };
}

export interface SearchSuggestion {
  id: string;
  name: string;
  type: "search" | "trending" | "product" | "category" | "brand" | "tag";
  image?: string;
  categoryName?: string;
  price?: number;
  mrp?: number;
  discount?: number;
  count?: number;
}

export interface TrendingSearchResponse {
  success: boolean;
  data: {
    popular: Array<{
      query: string;
      normalizedQuery: string;
      count: number;
      lastSearchedAt: string;
      averageResults: number;
    }>;
    zeroResults: Array<{
      query: string;
      normalizedQuery: string;
      count: number;
    }>;
  };
}

export const semanticSearch = async (
  params: SemanticSearchParams,
  signal?: AbortSignal
): Promise<SemanticSearchResponse> => {
  const response = await api.get<SemanticSearchResponse>("/search", {
    params,
    signal,
  });
  return response.data;
};

export const getSemanticSuggestions = async (
  q: string,
  signal?: AbortSignal
): Promise<{ success: boolean; data: SearchSuggestion[] }> => {
  const response = await api.get<{ success: boolean; data: SearchSuggestion[] }>(
    "/search/suggestions",
    {
      params: { q },
      signal,
    }
  );
  return response.data;
};

export const getTrendingSearches = async (
  limit = 10,
  signal?: AbortSignal
): Promise<TrendingSearchResponse> => {
  const response = await api.get<TrendingSearchResponse>("/search/trending", {
    params: { limit },
    signal,
  });
  return response.data;
};

export const getSimilarProducts = async (
  productId: string,
  signal?: AbortSignal
): Promise<{ success: boolean; data: SearchProduct[] }> => {
  const response = await api.get<{ success: boolean; data: SearchProduct[] }>(
    `/search/similar/${productId}`,
    {
      params: { limit: 6 },
      signal,
    }
  );
  return response.data;
};

export const getSmartRecommendations = async (
  params?: { limit?: number; latitude?: number; longitude?: number },
  signal?: AbortSignal
): Promise<{ success: boolean; data: SearchProduct[]; meta?: { personalized: boolean } }> => {
  const response = await api.get<{ success: boolean; data: SearchProduct[]; meta?: { personalized: boolean } }>(
    "/search/recommendations",
    {
      params,
      signal,
    }
  );
  return response.data;
};

export const trackSearchClick = async (query: string, productId: string) => {
  await api.post("/search/click", { query, productId });
};
