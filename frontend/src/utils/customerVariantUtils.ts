import { Product } from '../types/domain';
import { calculateCardPrice } from './priceUtils';
import {
  hasRealVariants,
  normalizeCustomerVariations,
  resolveProductGallery,
  resolveRootDisplayPrice,
} from './productLegacyUtils';

export { hasRealVariants, normalizeCustomerVariations };

export type VariantLike = {
  _id?: string | { $oid: string };
  id?: string;
  title?: string;
  name?: string;
  value?: string;
  variationType?: string;
  mainImage?: string;
  image?: string;
  galleryImages?: string[];
  price?: number;
  discPrice?: number;
  compareAtPrice?: number;
  mrp?: number;
  stock?: number;
  status?: string;
  tieredPrices?: { minQty: number; price: number }[];
};

export function getVariants(product: Product | null | undefined): VariantLike[] {
  if (!product) return [];
  return normalizeCustomerVariations(product) as VariantLike[];
}

export function getPrimaryVariant(product: Product | null | undefined): VariantLike | null {
  if (!hasRealVariants(product)) return null;
  const variants = normalizeCustomerVariations(product) as VariantLike[];
  return variants[0] ?? null;
}

export function getVariantId(variant: VariantLike | null | undefined): string | undefined {
  if (!variant) return undefined;
  const raw = variant._id ?? variant.id;
  if (!raw) return undefined;
  if (typeof raw === 'object' && '$oid' in raw) return String(raw.$oid);
  return String(raw);
}

export function getVariantImage(variant: VariantLike | null | undefined): string {
  if (!variant) return '';
  return variant.mainImage || variant.image || '';
}

export function getVariantGallery(variant: VariantLike | null | undefined): string[] {
  if (!variant) return [];
  const images = [
    variant.mainImage,
    variant.image,
    ...(variant.galleryImages ?? []),
  ].filter((url): url is string => Boolean(url));
  return [...new Set(images)];
}

function resolveVariantTypeName(
  variant: VariantLike,
  product?: { variationType?: string; variationName?: string } | null
): string {
  const type =
    variant.variationType?.trim() ||
    product?.variationName?.trim() ||
    product?.variationType?.trim() ||
    '';
  if (!type || type.toLowerCase() === 'standard') return '';
  return type;
}

function resolveVariantValue(variant: VariantLike): string {
  return variant.value?.trim() || variant.title?.trim() || variant.name?.trim() || '';
}

/** Full display label: "Type: Value" (e.g. Size: 1kg). */
export function getVariantDisplayLabel(
  variant: VariantLike | null | undefined,
  product?: { variationType?: string; variationName?: string } | null
): string {
  if (!variant) return '';
  const typeName = resolveVariantTypeName(variant, product);
  const value = resolveVariantValue(variant);
  if (typeName && value) return `${typeName}: ${value}`;
  if (value) return value;
  if (typeName) return typeName;
  return '';
}

export function getVariantLabel(variant: VariantLike | null | undefined): string {
  if (!variant) return '';
  return resolveVariantValue(variant);
}

/** Chip label for PDP variant picker — type + value (no image). */
export function getVariantChipLabel(
  variant: VariantLike | null | undefined,
  product?: { variationType?: string; variationName?: string } | null
): string {
  return getVariantDisplayLabel(variant, product);
}

export function hasMultipleVariants(product: Product | null | undefined): boolean {
  if (!hasRealVariants(product)) return false;
  return normalizeCustomerVariations(product).length > 1;
}

export function getProductCardImage(product: Product | null | undefined): string {
  const primary = getPrimaryVariant(product);
  const variantImage = getVariantImage(primary);
  if (variantImage) return variantImage;

  const rootGallery = resolveProductGallery(product);
  if (rootGallery.length > 0) return rootGallery[0];

  const listing = (product as any)?.listing;
  return listing?.imageUrl || product?.imageUrl || product?.mainImage || '';
}

export function buildProductWithPrimaryVariant(product: Product): Product & {
  selectedVariant?: VariantLike;
  variantId?: string;
  variantTitle?: string;
} {
  const primary = getPrimaryVariant(product);
  const variantId = getVariantId(primary);
  const variantTitle = getVariantDisplayLabel(primary, product) || getVariantLabel(primary) || product.pack;
  const imageUrl = getProductCardImage(product) || product.imageUrl;

  return {
    ...product,
    imageUrl,
    pack: variantTitle || product.pack,
    selectedVariant: primary ?? undefined,
    variantId,
    variantTitle,
  };
}

export function matchesCartVariant(
  itemProduct: any,
  variantId?: string,
  variantTitle?: string
): boolean {
  const itemVariantId =
    itemProduct?.variantId ||
    itemProduct?.selectedVariant?._id ||
    itemProduct?.selectedVariant?.id;
  const itemVariantTitle =
    itemProduct?.variantTitle ||
    itemProduct?.pack ||
    itemProduct?.selectedVariant?.value ||
    itemProduct?.selectedVariant?.title;

  if (variantId && itemVariantId) {
    return String(itemVariantId) === String(variantId);
  }

  if (variantTitle && itemVariantTitle) {
    if (itemVariantTitle === variantTitle) return true;
    const expectedValue = variantTitle.includes(': ')
      ? variantTitle.split(': ').slice(1).join(': ')
      : variantTitle;
    const itemValue =
      itemProduct?.selectedVariant?.value ||
      itemProduct?.selectedVariant?.title ||
      itemVariantTitle;
    return (
      itemValue === expectedValue ||
      itemVariantTitle === expectedValue ||
      itemVariantTitle.endsWith(`: ${expectedValue}`)
    );
  }

  if (variantId) {
    return String(itemVariantId) === String(variantId);
  }

  return !itemVariantId && !itemVariantTitle;
}

export function findCartItemForPrimaryVariant(
  items: Array<{ product?: any; quantity?: number }>,
  product: Product
) {
  const productId = String((product as any).id || product._id);

  if (!hasRealVariants(product)) {
    return items.find((item) => {
      if (!item?.product) return false;
      const itemProductId = String(item.product.id || item.product._id);
      return itemProductId === productId;
    });
  }

  const primary = getPrimaryVariant(product);
  const variantId = getVariantId(primary);
  const variantTitle = getVariantLabel(primary) || product.pack;

  return items.find((item) => {
    if (!item?.product) return false;
    const itemProductId = String(item.product.id || item.product._id);
    if (itemProductId !== productId) return false;
    return matchesCartVariant(item.product, variantId, variantTitle);
  });
}

/** Normalize API product payload for customer card/banner display (first variant). */
export function mapApiProductForCustomerDisplay(data: any): Product {
  const primary = getPrimaryVariant(data);
  const { displayPrice, mrp } = calculateCardPrice(data);
  const imageUrl = getProductCardImage(data);

  return {
    ...data,
    id: data._id || data.id,
    _id: data._id || data.id,
    imageUrl,
    mainImage: imageUrl,
    name:
      (typeof data.productName === 'string' ? data.productName : null) ||
      (typeof data.name === 'string' ? data.name : null) ||
      'Product',
    price: displayPrice,
    mrp,
    pack: getVariantLabel(primary) || data.pack || '',
    categoryId: data.categoryId || data.category?._id || data.category?.id || '',
  };
}
