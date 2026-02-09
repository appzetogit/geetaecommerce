import api from "../config";
import { ApiResponse } from "./types";

// ==================== Interfaces ====================

export interface Category {
  _id: string;
  name: string;
  image?: string;
  order: number;
  parentId?: string;
  children?: Category[];
}

export interface Product {
    _id: string;
    productName: string;
    sku?: string;
    stock: number;
    pack?: string; // Weight/UOM
    variations?: Array<{
        _id: string;
        name?: string;
        value?: string;
        stock?: number;
    }>;
    category?: { _id: string; name: string } | string;
    // Add other fields as needed
}

export interface GetProductsParams {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    subcategory?: string;
    brand?: string;
    status?: string;
}

// ==================== Category Services ====================

/**
 * Get all categories (Public/Shared Endpoint)
 */
export const getCategories = async (params?: {
  search?: string;
  includeChildren?: boolean;
}): Promise<ApiResponse<Category[]>> => {
  const queryParams: any = { ...params };
  if (params?.includeChildren !== undefined) {
    queryParams.includeChildren = params.includeChildren.toString();
  }

  // Use the public categories endpoint which is accessible to sellers
  const response = await api.get<ApiResponse<Category[]>>("/categories", {
    params: queryParams,
  });
  return response.data;
};

// ==================== Product Services ====================

/**
 * Get seller's products
 */
export const getProducts = async (params?: GetProductsParams): Promise<ApiResponse<Product[]>> => {
  const response = await api.get<ApiResponse<Product[]>>("/products", {
    params,
  });
  return response.data;
};
