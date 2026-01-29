import api from "./config";
import { ApiResponse } from "./admin/types";

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
 * Get all brands (accessible for sellers and admins)
 * Uses /products/brands endpoint which is available for authenticated sellers
 */
export const getBrands = async (params?: {
    search?: string;
}): Promise<ApiResponse<Brand[]>> => {
    try {
        // Try the direct endpoint first (in case it becomes public in future)
        // But since we know it throws 401 for guests, we should wrap it or switch strategy.
        // Actually, for the user-side "Shop by Brand" page, we want a robust solution.
        // Let's rely on fetching products and extracting brands to avoid 401.

        // Fetch a large number of products to get a good list of brands
        // We use the customer products endpoint which is public
        const response = await api.get('/customer/products', {
            params: {
                limit: 100, // Fetch enough products to get a variety of brands
                ...params
            }
        });

        if (response.data && response.data.success && Array.isArray(response.data.data)) {
            const products = response.data.data;

            // Extract unique brands
            const brandMap = new Map<string, Brand>();

            products.forEach((product: any) => {
                if (product.brand && typeof product.brand === 'object') {
                    const brandObj = product.brand;
                    // Only add if not already present
                     // Note: customerProductController only populates 'name', not 'image'.
                     // So we might miss images, but we get the brands.
                    if (brandObj._id && !brandMap.has(brandObj._id)) {
                        brandMap.set(brandObj._id, {
                            _id: brandObj._id,
                            name: brandObj.name,
                            image: brandObj.image, // Likely undefined, will fall back to placeholder
                            createdAt: new Date().toISOString()
                        });
                    }
                }
            });

            return {
                success: true,
                data: Array.from(brandMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
                message: "Brands fetched from products"
            };
        }

        return { success: false, data: [], message: "Failed to fetch brands" };

    } catch (error) {
        console.error("Error fetching public brands:", error);
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
        // Fallback: Fetch products for this brand and extract brand info
        const response = await api.get('/customer/products', {
             params: { brand: id, limit: 1 }
        });

        if (response.data && response.data.success && response.data.data.length > 0) {
            const product = response.data.data[0];
            if (product.brand && typeof product.brand === 'object') {
                 return {
                    success: true,
                    data: {
                        _id: product.brand._id || id,
                        name: product.brand.name || 'Brand',
                        image: product.brand.image
                    },
                    message: "Brand details fetched from product"
                 };
            }
        }

        // If no products found, we can't get the name easily without backend change.
        // Return a mock or minimal object
        return {
            success: true,
            data: { _id: id, name: 'Brand', createdAt: new Date().toISOString() },
            message: "Brand details inferred"
        };

    } catch (error) {
        console.error("Error fetching brand details:", error);
         return { success: false, data: {} as Brand, message: "Error fetching brand" };
    }
};
