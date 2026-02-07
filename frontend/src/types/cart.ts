import { Product } from './domain';

export interface CartItem {
  product?: Product;
  quantity?: number;
  variant?: any;
  isFreeGift?: boolean;
  id?: string; // Add id as it's used in context and makes life easier
  source?: string;
  sourceId?: string;
  // POS Flattened fields
  _id?: string;
  productName?: string;
  price?: number;
  qty?: number;
  mainImage?: string;
  originalProductId?: string | null;
  variationId?: string;
  isVariation?: boolean;
  stock?: number;
  compareAtPrice?: number;
  purchasePrice?: number;
  wholesalePrice?: number;
  customPrice?: number;
  sku?: string;
}

export interface Cart {
  items: CartItem[];
  total: number;
  itemCount: number;
}

