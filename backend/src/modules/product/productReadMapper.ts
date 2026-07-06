import {
  computeListing,
  getMinDisplayPrice,
  getVariantDisplayPrice,
  variantsFromProductDoc,
} from "./variantHelpers";
import { ProductListingComputed, ProductVariant } from "./types";

export interface MappedProductListItem {
  _id: string;
  productName: string;
  smallDescription?: string;
  description?: string;
  category?: unknown;
  subcategory?: unknown;
  subSubCategory?: string;
  headerCategoryId?: unknown;
  brand?: unknown;
  gst?: number;
  tax?: unknown;
  hsnCode?: string;
  publish: boolean;
  popular: boolean;
  dealOfDay: boolean;
  status: string;
  seller?: unknown;
  tags?: string[];
  variations: ProductVariant[];
  variants: ProductVariant[];
  listing: ProductListingComputed;
  /** @deprecated use listing.minPrice */
  price: number;
  /** @deprecated use listing.totalStock */
  stock: number;
  /** @deprecated use listing.imageUrl */
  mainImage: string | null;
  discPrice?: number;
  compareAtPrice?: number;
  discount?: number;
  createdAt?: Date;
  updatedAt?: Date;
  [key: string]: unknown;
}

function computeDiscount(mrp: number, displayPrice: number): number {
  if (!mrp || mrp <= displayPrice) return 0;
  return Math.round(((mrp - displayPrice) / mrp) * 100);
}

function getCompareAtPrice(variants: ProductVariant[]): number {
  const mrps = variants
    .map((v) => Number(v.compareAtPrice) || 0)
    .filter((n) => n > 0);
  if (!mrps.length) return 0;
  return Math.min(...mrps);
}

export function toProductVariants(product: any): ProductVariant[] {
  return variantsFromProductDoc(product);
}

export function toListItem(
  product: any,
  options?: { allowNegativeStock?: boolean }
): MappedProductListItem {
  const plain =
    typeof product.toObject === "function" ? product.toObject() : { ...product };
  const variants = toProductVariants(product);
  const listing = computeListing(variants, options?.allowNegativeStock, plain);
  let minPrice = listing.minPrice;
  if (minPrice <= 0) {
    minPrice = Number(plain.discPrice) || Number(plain.price) || 0;
  }
  const mrp = getCompareAtPrice(variants) || Number(plain.compareAtPrice) || Number(plain.mrp) || minPrice;

  return {
    ...plain,
    variations: variants,
    variants,
    listing,
    price: minPrice,
    stock: listing.totalStock,
    mainImage: listing.imageUrl || plain.mainImage || null,
    discPrice: minPrice,
    compareAtPrice: mrp,
    discount: computeDiscount(mrp, minPrice),
  };
}

export function toListItems(
  products: any[],
  options?: { allowNegativeStock?: boolean }
): MappedProductListItem[] {
  return products.map((p) => toListItem(p, options));
}

export function toDetail(product: any, options?: { allowNegativeStock?: boolean }) {
  return toListItem(product, options);
}

export function toPOSRow(product: any, variant: ProductVariant) {
  const displayPrice = getVariantDisplayPrice(variant);
  const mrp = Number(variant.compareAtPrice) || displayPrice;
  return {
    productId: String(product._id),
    variantId: variant._id ? String(variant._id) : undefined,
    productName: product.productName,
    variationType: variant.variationType,
    value: variant.value,
    label: `${variant.variationType}: ${variant.value}`,
    price: displayPrice,
    discPrice: variant.discPrice ?? displayPrice,
    compareAtPrice: mrp,
    wholesalePrice: variant.wholesalePrice ?? 0,
    purchasePrice: variant.purchasePrice ?? 0,
    stock: Number(variant.stock) || 0,
    sku: variant.sku,
    barcode: variant.barcode ?? [],
    mainImage: variant.mainImage ?? null,
    category: product.category,
    seller: product.seller,
  };
}

export function expandProductToPOSRows(product: any) {
  const variants = toProductVariants(product);
  if (!variants.length) return [];
  return variants.map((v) => toPOSRow(product, v));
}

export function toCartProductView(product: any, variantId?: string) {
  const variants = toProductVariants(product);
  const variant =
    variants.find((v) => String(v._id) === String(variantId)) ??
    (variants.length === 1 ? variants[0] : undefined);
  const listing = computeListing(variants, false, product);
  const displayPrice = variant
    ? getVariantDisplayPrice(variant)
    : getMinDisplayPrice(variants);

  return {
    ...toListItem(product),
    selectedVariant: variant,
    selectedVariantId: variant?._id ? String(variant._id) : undefined,
    unitPrice: displayPrice,
    productImage: variant?.mainImage ?? listing.imageUrl,
    availableStock: variant ? Number(variant.stock) || 0 : listing.totalStock,
  };
}
