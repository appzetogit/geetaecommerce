import mongoose from "mongoose";

export type VariantStatus = "Available" | "Sold out" | "In stock";

export interface ProductVariant {
  _id?: mongoose.Types.ObjectId | string;
  variationType: string;
  value: string;
  name?: string;
  price: number;
  discPrice?: number;
  compareAtPrice?: number;
  wholesalePrice?: number;
  purchasePrice?: number;
  tieredPrices?: { minQty: number; price: number }[];
  stock: number;
  status?: VariantStatus;
  sku?: string;
  barcode?: string[];
  rackNumber?: string;
  mainImage?: string;
  galleryImages?: string[];
  /** @deprecated use mainImage */
  image?: string;
}

export interface ProductListingComputed {
  minPrice: number;
  maxPrice: number;
  totalStock: number;
  imageUrl: string | null;
  inStock: boolean;
}

export interface ProductWritePolicy {
  role: "admin" | "seller";
  sellerId?: string;
  defaultPublish: boolean;
  allowSellerAssignment: boolean;
  createInventoryRecord: boolean;
}
