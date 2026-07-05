/** Helpers for unmigrated / legacy products (root price, images, placeholder variants). */

export type LegacyVariantLike = {
  variationType?: string;
  title?: string;
  name?: string;
  value?: string;
  price?: number;
  discPrice?: number;
  compareAtPrice?: number;
  mainImage?: string;
  image?: string;
};

export function getRawVariants(product: any): LegacyVariantLike[] {
  if (!product) return [];
  return (product.variations ?? product.variants ?? []) as LegacyVariantLike[];
}

export function isPlaceholderVariant(variant: LegacyVariantLike | null | undefined): boolean {
  if (!variant) return true;
  const value = String(variant.value || variant.title || variant.name || '')
    .trim()
    .toLowerCase();
  const type = String(variant.variationType || variant.name || '')
    .trim()
    .toLowerCase();
  const hasPricing =
    Number(variant.discPrice) > 0 ||
    Number(variant.price) > 0 ||
    Number(variant.compareAtPrice) > 0;
  const hasImage = Boolean(variant.mainImage || variant.image);

  if (hasPricing || hasImage) {
    if (value === 'default' && (!type || type === 'standard')) {
      return !hasPricing && !hasImage;
    }
    return false;
  }

  return value === 'default' || value === '' || (!type || type === 'standard');
}

export function hasRealVariants(product: any): boolean {
  const variants = getRawVariants(product);
  if (variants.length === 0) return false;
  if (variants.length === 1 && isPlaceholderVariant(variants[0])) return false;
  return true;
}

export function resolveRootDisplayPrice(product: any): number {
  const disc = Number(product?.discPrice ?? product?.listing?.minPrice ?? 0);
  const price = Number(product?.price ?? 0);
  if (disc > 0) return disc;
  if (price > 0) return price;
  if (product?.listing?.minPrice > 0) return Number(product.listing.minPrice);
  return 0;
}

export function resolveRootMrp(product: any): number {
  const mrp = Number(
    product?.compareAtPrice ??
      product?.mrp ??
      product?.listing?.maxPrice ??
      product?.price ??
      0
  );
  if (mrp > 0) return mrp;
  return resolveRootDisplayPrice(product);
}

export function resolveProductGallery(product: any): string[] {
  const images = [
    product?.mainImage,
    product?.imageUrl,
    ...(product?.galleryImages ?? product?.galleryImageUrls ?? []),
  ].filter((url): url is string => Boolean(url));
  return [...new Set(images)];
}

/** Strip synthetic single-default variants for legacy products on the customer app. */
export function normalizeCustomerVariations(productData: any): any[] {
  const rawVariations = Array.isArray(productData?.variations) ? productData.variations : [];
  if (rawVariations.length === 0) return [];

  const hasExplicitVariationSetup =
    Boolean(String(productData?.variationType || '').trim()) ||
    Boolean(String(productData?.variationName || '').trim());

  if (
    !hasExplicitVariationSetup &&
    rawVariations.length === 1 &&
    isPlaceholderVariant(rawVariations[0])
  ) {
    return [];
  }

  return rawVariations;
}
