import api from "./config";
import { ApiResponse } from "./admin/types";
import { detectModuleFromPath } from "../../utils/moduleAuth";

// ==================== Brand Interfaces ====================
export interface Brand {
    _id: string;
    name: string;
    image?: string;
    createdAt?: string;
    updatedAt?: string;
}

// ==================== Brand API Functions ====================

/**
 * Get all brands (Public - Filtered by active products)
 */
export const getPublicBrands = async (): Promise<ApiResponse<Brand[]>> => {
    try {
        const response = await api.get<ApiResponse<Brand[]>>('/customer/products/brands');
        return response.data;
    } catch (error) {
        console.error("Error fetching public brands:", error);
        return { success: false, data: [], message: "Error fetching brands" };
    }
};

/**
 * Get all brands (Context Aware)
 * - Admin: Fetches from /admin/brands (All brands)
 * - Seller: Fetches from /products/brands (All brands allowed for seller)
 * - Customer: Fetches from /customer/products/brands (Only brands with active products)
 */
export const getBrands = async (params?: {
    search?: string;
}): Promise<ApiResponse<Brand[]>> => {
    try {
        const module = detectModuleFromPath();

        if (module === 'admin') {
             // Admin needs ALL brands to manage them or add products
             const response = await api.get<ApiResponse<Brand[]>>('/admin/brands', { params });
             return response.data;
        } else if (module === 'seller') {
             // Seller needs all brands available to them
             const response = await api.get<ApiResponse<Brand[]>>('/products/brands', { params });
             return response.data;
        } else {
             // Customer - use filtered list to show only relevant brands
             return getPublicBrands();
        }

    } catch (error) {
        console.error("Error fetching brands:", error);
        return { success: false, data: [], message: "Error fetching brands" };
    }
};

/**
 * Get brand by ID
 */
export const getBrandById = async (
    id: string
): Promise<ApiResponse<Brand>> => {
    try {
        // Find public brand details (works for everyone as it is public)
        const response = await api.get<ApiResponse<Brand>>(`/customer/products/brands/${id}`);

        if (response.data && response.data.success) {
            return {
                success: true,
                data: response.data.data,
                message: "Brand details fetched successfully"
            };
        }

        return { success: false, data: {} as Brand, message: "Brand not found" };

    } catch (error) {
        console.error("Error fetching brand details:", error);
         return { success: false, data: {} as Brand, message: "Error fetching brand" };
    }
};
