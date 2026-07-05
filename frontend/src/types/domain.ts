export interface Category {
  id: string;
  _id?: string;
  name: string;
  slug?: string;
  icon?: string; // emoji or small label
  imageUrl?: string; // optional imported image path
}

export interface ProductListing {
  minPrice: number;
  maxPrice: number;
  totalStock: number;
  imageUrl: string | null;
  inStock: boolean;
}

export interface ProductVariant {
  _id?: string | { $oid: string };
  id?: string;
  title?: string;
  name?: string;
  value?: string;
  variationType?: string;
  price: number;
  discPrice?: number;
  compareAtPrice?: number;
  mrp?: number;
  stock?: number;
  status?: string;
  mainImage?: string;
  image?: string;
  galleryImages?: string[];
  sku?: string;
  barcode?: string[];
  tieredPrices?: { minQty: number; price: number }[];
}

export interface Product {
  id: string;
  _id: string;
  name: string;
  productName?: string;
  description?: string;
  smallDescription?: string;
  pack: string;
  price?: number;
  mrp?: number;
  discPrice?: number;
  compareAtPrice?: number;
  sku?: string;
  isVariation?: boolean;
  variations?: ProductVariant[];
  variants?: ProductVariant[];
  listing?: ProductListing;
  imageUrl?: string;
  mainImage?: string;
  categoryId: string;
  category?: Category;
  tags?: string[];
  rating?: number;
  reviews?: number;
  deliveryTime?: number;
  stock?: number;
  publish?: boolean;
  status?: string;
  madeIn?: string;
  manufacturer?: string;
  fssaiLicNo?: string;
  isReturnable?: boolean;
  maxReturnDays?: number;
  sellerId?: string;
  isAvailable?: boolean;
  warrantyType?: 'None' | 'Warranty' | 'Guarantee';
  warrantyDuration?: string;
}
