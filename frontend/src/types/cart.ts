import { Product } from './domain';

export interface CartItem {
  product: Product;
  quantity: number;
  variant?: any;
  isFreeGift?: boolean;
  id?: string; // Add id as it's used in context and makes life easier
  source?: string;
  sourceId?: string;
}

export interface Cart {
  items: CartItem[];
  total: number;
  itemCount: number;
}

