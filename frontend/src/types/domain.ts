export interface Category {
  id: string;
  _id?: string;
  name: string;
  slug?: string;
  icon?: string; // emoji or small label
  imageUrl?: string; // optional imported image path
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
  variations?: Array<{
    title?: string;
    name?: string;
    value?: string;
    price: number;
    discPrice?: number;
    stock?: number;
    status?: string;
    _id?: { $oid: string } | string;
    tieredPrices?: { minQty: number; price: number }[];
  }>;
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

