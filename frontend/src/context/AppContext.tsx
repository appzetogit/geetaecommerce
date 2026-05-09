import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api/config';

export interface PublicConfig {
    appName: string;
    appLogo?: string;
    appFavicon?: string;
    contactPhone?: string;
    contactEmail?: string;
    businessCategory?: string;
    primaryGoal?: string;
    businessName?: string;
    businessType?: string;
    gstin?: string;
    cin?: string;
    fssaiLicense?: string;
    address?: string;
    socialMediaLinks?: {
        facebook?: string;
        youtube?: string;
        instagram?: string;
        [key: string]: string | undefined;
    };
    invoiceSettings?: {
        notes?: {
            text: string;
            enabled: boolean;
        };
        terms?: {
            text: string;
            enabled: boolean;
        };
        gst?: {
            text: string;
            enabled: boolean;
        };
        fssai?: {
            text: string;
            enabled: boolean;
        };
    };
    firstOrderOffer?: {
        enabled: boolean;
        title: string;
        subtitle: string;
        discountAmount: number;
        minOrderAmount: number;
        ctaText: string;
        updatedAt?: string;
    };
}

interface AppContextType {
    config: PublicConfig | null;
    loading: boolean;
    error: string | null;
    refreshConfig: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [config, setConfig] = useState<PublicConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchConfig = useCallback(async () => {
        try {
            setLoading(true);
            const response = await api.get('/customer/config/public');
            if (response.data.success) {
                const newConfig = response.data.data;
                setConfig(newConfig);

                // Update favicon dynamically
                if (newConfig.appFavicon) {
                    const link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
                    if (link) {
                        link.href = newConfig.appFavicon;
                    } else {
                        const newLink = document.createElement('link');
                        newLink.rel = 'icon';
                        newLink.href = newConfig.appFavicon;
                        document.getElementsByTagName('head')[0].appendChild(newLink);
                    }
                }

                // Update title
                if (newConfig.appName && !document.title.includes('|')) {
                    document.title = newConfig.appName;
                }
            }
        } catch (err) {
            console.error('Failed to fetch app configuration:', err);
            setError('Failed to load application settings');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchConfig();
    }, [fetchConfig]);

    return (
        <AppContext.Provider value={{ config, loading, error, refreshConfig: fetchConfig }}>
            {children}
        </AppContext.Provider>
    );
};

export const useAppContext = () => {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useAppContext must be used within an AppProvider');
    }
    return context;
};
