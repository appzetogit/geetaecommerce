import { Product } from './domain';

export interface CartItem {
  product?: Product;
  quantity?: number;
  variantId?: string;
  unitPrice?: number;
  variation?: string;
  variant?: string | number;
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
  warrantyType?: string;
  warrantyDuration?: string;
}

export interface Cart {
  items: CartItem[];
  total: number;
  itemCount: number;
}

