export type BannerPosition =
  | 'Main Banner'
  | 'Popup Banner'
  | 'Footer Banner'
  | 'Main Section Banner'
  | 'Deal of the Day'
  | 'Flash Deals'
  | 'HOME_MAIN_SLIDER' // Keep for compatibility if needed
  | 'POPUP_ON_FIRST_VISIT'; // Keep for compatibility if needed

export type RedirectType = 'NONE' | 'URL' | 'CATEGORY' | 'PRODUCT';

export const BANNER_POSITIONS: Record<BannerPosition, string> = {
  'Main Banner': 'Home Main Slider',
  'Popup Banner': 'Home Popup',
  'Footer Banner': 'Footer Banner',
  'Main Section Banner': 'Main Section',
  'Deal of the Day': 'Deal of the Day',
  'Flash Deals': 'Flash Deals',
  'HOME_MAIN_SLIDER': 'Home Main Slider (Legacy)',
  'POPUP_ON_FIRST_VISIT': 'Home Popup (Legacy)'
};

export interface Banner {
  id: string;
  position: BannerPosition;
  resourceType: 'Product' | 'Category' | 'External' | 'None';
  resourceId?: string;
  resourceName?: string;
  imageUrl: string;
  image: string; // Alias for imageUrl
  isActive: boolean;
  categoryName?: string;
  title?: string;
  subtitle?: string;
  startDate?: string;
  endDate?: string;
  priority?: number;
  redirectType?: RedirectType;
  redirectValue?: string;
}
