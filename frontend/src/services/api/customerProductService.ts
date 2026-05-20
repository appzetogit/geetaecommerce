import api from './config';
import { Product } from './productService'; // Reuse generic product type if compatible or define new one
import { apiCache } from '../../utils/apiCache';

export interface Category {
    _id: string; // MongoDB ID
    id?: string; // Virtual ID
    name: string;
    parent?: string | null;
    image?: string;
    icon?: string;
    description?: string;
    isActive: boolean;
    children?: Category[];
    subcategories?: Category[];
    headerCategoryId?: string | { _id: string; name?: string };
    totalProducts?: number;
}

export interface GetProductsParams {
    search?: string;
    category?: string;
    subcategory?: string;
    brand?: string;
    minPrice?: number;
    maxPrice?: number;
    sort?: 'price_asc' | 'price_desc' | 'popular' | 'discount';
    page?: number;
    limit?: number;
    headerCategorySlug?: string; // Home header tabs (e.g. grocery, beauty)
    latitude?: number; // User location latitude
    longitude?: number; // User location longitude
}

export interface ProductListResponse {
    success: boolean;
    data: Product[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}

export interface ProductDetailResponse {
    success: boolean;
    message?: string;
    data: Product & { similarProducts?: Product[] };
}

export interface CategoryListResponse {
    success: boolean;
    data: Category[];
}

const buildCacheKey = (prefix: string, params?: Record<string, unknown>) => {
    const normalizedEntries = Object.entries(params || {})
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .sort(([left], [right]) => left.localeCompare(right));

    const serialized = normalizedEntries.length > 0
        ? JSON.stringify(normalizedEntries)
        : '[]';

    return `${prefix}:${serialized}`;
};

export const getCachedProducts = (params?: Record<string, unknown>) =>
    apiCache.getSync<ProductListResponse>(buildCacheKey('customer-products', params));

/**
 * Get products with filters (Public)
 * Location (latitude/longitude) is required to filter products by seller's service radius
 */
export const getProducts = async (params?: GetProductsParams): Promise<ProductListResponse> => {
    const cacheKey = buildCacheKey('customer-products', params as Record<string, unknown> | undefined);
    return apiCache.getOrFetch(
        cacheKey,
        async () => {
            const response = await api.get<ProductListResponse>('/customer/products', { params });
            return response.data;
        },
        2 * 60 * 1000
    );
};

/**
 * Get search suggestions (Public)
 */
export const getSearchSuggestions = async (q: string, latitude?: number, longitude?: number): Promise<{ success: boolean; data: any[] }> => {
    const response = await api.get('/search/suggestions', {
        params: { q, latitude, longitude }
    });
    return response.data;
};

/**
 * Get product details by ID (Public)
 * Location (latitude/longitude) is required to verify product availability
 */
export const getProductById = async (id: string, latitude?: number, longitude?: number): Promise<ProductDetailResponse> => {
    const params: any = {};
    if (latitude !== undefined && longitude !== undefined) {
        params.latitude = latitude;
        params.longitude = longitude;
    }
    const cacheKey = buildCacheKey(`customer-product:${id}`, params);
    return apiCache.getOrFetch(
        cacheKey,
        async () => {
            const response = await api.get<ProductDetailResponse>(`/customer/products/${id}`, { params });
            return response.data;
        },
        2 * 60 * 1000
    );
};

/**
 * Get category details by ID or slug (Public)
 */
export const getCategoryById = async (id: string): Promise<any> => {
    const cacheKey = buildCacheKey(`customer-category:${id}`);
    return apiCache.getOrFetch(
        cacheKey,
        async () => {
            const response = await api.get<any>(`/customer/categories/${id}`);
            return response.data;
        },
        5 * 60 * 1000
    );
};

/**
 * Get all categories (Public)
 * Using /tree endpoint to get hierarchy if available, otherwise just /
 * Cached for 10 minutes as categories don't change frequently
 */
export const getCategories = async (tree: boolean = false): Promise<CategoryListResponse> => {
    const cacheKey = `customer-categories-${tree ? 'tree' : 'list'}`;
    return apiCache.getOrFetch(
        cacheKey,
        async () => {
    const url = tree ? '/customer/categories/tree' : '/customer/categories';
    const response = await api.get<CategoryListResponse>(url);
    return response.data;
        },
        10 * 60 * 1000 // 10 minutes cache
    );
};
