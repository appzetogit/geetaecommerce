import api from './api/config';
import { Banner, BannerPosition } from '../types/banner';

export interface DealsConfig {
  flashDealTargetDate: string;
  flashDealImage?: string;
  isActive?: boolean;
  flashDealProductIds?: string[];
  featuredDealProductId?: string;
  featuredDealProductIds?: string[];
  dealOfTheDayProductId?: string;
  dealOfTheDayProductIds?: string[];
}

export interface BannerResponse {
  success: boolean;
  data: Banner[] | Banner;
  count?: number;
}

export const bannerService = {
  getAllBanners: async (): Promise<Banner[]> => {
    try {
      const res = await api.get<BannerResponse>('/banners');
      if (res.data.success && Array.isArray(res.data.data)) {
        return res.data.data.map((b: any) => ({
            ...b,
            id: b._id || b.id || '',
            image: b.imageUrl,
            categoryName: b.resourceName || (b.resourceType === 'Category' ? 'Category' : 'No Category Selected')
        }));
      }
      return [];
    } catch (e) {
      console.error("Failed to fetch banners", e);
      return [];
    }
  },

  getBannersByPosition: async (position: BannerPosition): Promise<Banner[]> => {
    try {
      const res = await api.get<BannerResponse>(`/banners?position=${encodeURIComponent(position)}`);
      if (res.data.success && Array.isArray(res.data.data)) {
         return res.data.data.map((b: any) => ({
            ...b,
            id: b._id || b.id || '',
            image: b.imageUrl,
            categoryName: b.resourceName || (b.resourceType === 'Category' ? 'Category' : 'No Category Selected')
        }));
      }
      return [];
    } catch (e) {
      console.error("Failed to fetch banners by position", e);
      return [];
    }
  },

  // Kept for backward compatibility if used synchronously elsewhere (though it shouldn't be now)
  // This signature might need to change to async in consuming components
  getActiveBannersForPosition: async (position: string): Promise<Banner[]> => {
     let mappedPos = position;
     if (position === 'HOME_MAIN_SLIDER') mappedPos = 'Main Banner';
     if (position === 'POPUP_ON_FIRST_VISIT') mappedPos = 'Popup Banner';
     // Add other mappings if necessary
     return bannerService.getBannersByPosition(mappedPos as BannerPosition);
  },

  addBanner: async (banner: Omit<Banner, 'id' | 'image'>) => {
    const res = await api.post('/banners', banner);
    return res.data.data;
  },

  deleteBanner: async (id: string) => {
    await api.delete(`/banners/${id}`);
  },

  updateBanner: async (id: string, updates: Partial<Banner>) => {
    const res = await api.put(`/banners/${id}`, updates);
    return res.data.data;
  },

  // Deals - Keeping localStorage for now as I didn't see backend routes for deals config yet,
  // or I can implement them if needed. The user request was specific to "Banner Setup".
  // "Offers & Deals" might be a separate requirement. I will leave deals as is for now
  // but ensure no type errors.
  getDealsConfig: async (): Promise<DealsConfig> => {
    try {
      const res = await api.get<{success: boolean, data: DealsConfig}>('/flash-deals');
      if (res.data.success && res.data.data) {
          return res.data.data;
      }
      return { flashDealTargetDate: new Date(Date.now() + 86400000).toISOString() };
    } catch (e) {
        console.error("Failed to fetch flash deals config", e);
        return { flashDealTargetDate: new Date(Date.now() + 86400000).toISOString() };
    }
  },

  updateDealsConfig: async (updates: Partial<DealsConfig>) => {
    try {
        const res = await api.put<{success: boolean, data: DealsConfig}>('/flash-deals', updates);
        return res.data.data;
    } catch (e) {
        console.error("Failed to update flash deals config", e);
        throw e;
    }
  }
};
