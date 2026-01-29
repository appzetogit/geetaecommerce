import api from './api/config';
import { ApiResponse } from './api/admin/types';

export interface AppConfig {
    deliveryFee: number;
    freeDeliveryThreshold: number;
    platformFee: number;
    taxes: {
        gst: number;
    };
    estimatedDeliveryTime: string;
    deliveryRadius?: number;
    serviceType?: string;
    appName?: string;
    contactPhone?: string;
    contactEmail?: string;
    onlinePaymentDiscount?: {
        enabled: boolean;
        percentage: number;
    };
}

// Default configuration (fallback)
export const defaultConfig: AppConfig = {
    deliveryFee: 40,
    freeDeliveryThreshold: 199,
    platformFee: 2,
    taxes: {
        gst: 18
    },
    estimatedDeliveryTime: '12-15 mins'
};

/**
 * Get application configuration
 * Fetches from /customer/config endpoint
 */
export const getAppConfig = async (): Promise<AppConfig> => {
    try {
        const response = await api.get<ApiResponse<AppConfig>>('/customer/config');
        if (response.data.success && response.data.data) {
            return response.data.data;
        }
        return defaultConfig;
    } catch (error) {
        console.error('Failed to fetch app config:', error);
        return defaultConfig;
    }
};

// Synchronous helper is DEPRECATED but kept for backward compatibility variables
// Components should stick to async getAppConfig()
export const appConfig = defaultConfig;
