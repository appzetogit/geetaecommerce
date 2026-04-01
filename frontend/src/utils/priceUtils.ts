import { Product } from '../types/domain';

export interface CalculatedPrice {
  displayPrice: number;
  mrp: number;
  discount: number;
  hasDiscount: boolean;
}

export const calculateProductPrice = (product: any, variationSelector?: number | string): CalculatedPrice => {
  if (!product) {
    return {
      displayPrice: 0,
      mrp: 0,
      discount: 0,
      hasDiscount: false
    };
  }

  let variation;
  if (typeof variationSelector === 'number') {
    variation = product.variations?.[variationSelector];
  } else if (typeof variationSelector === 'string') {
    variation = product.variations?.find((v: any) => (v._id === variationSelector || v.id === variationSelector));
  }

  // Only fall back to the first variation when the root product has no usable pricing at all.
  if (
    !variation &&
    product.variations?.length > 0 &&
    variationSelector === undefined &&
    !parseFloat(product.discPrice || 0) &&
    !parseFloat(product.price || 0) &&
    !parseFloat(product.compareAtPrice || product.mrp || 0)
  ) {
    variation = product.variations[0];
  }

  const vPrice = parseFloat(variation?.price || 0);
  const vDiscPrice = parseFloat(variation?.discPrice || 0);
  const pPrice = parseFloat(product.price || 0);
  const pDiscPrice = parseFloat(product.discPrice || 0);

  const hasSelectedVariation = Boolean(variation);

  let displayPrice = hasSelectedVariation
    ? (vDiscPrice > 0)
      ? vDiscPrice
      : (vPrice > 0)
      ? vPrice
      : (pDiscPrice > 0)
      ? pDiscPrice
      : (pPrice > 0)
      ? pPrice
      : 0
    : (pDiscPrice > 0)
    ? pDiscPrice
    : (pPrice > 0)
    ? pPrice
    : (vDiscPrice > 0)
    ? vDiscPrice
    : (vPrice > 0)
    ? vPrice
    : 0;

  let mrp = hasSelectedVariation
    ? parseFloat(variation?.compareAtPrice || variation?.mrp || variation?.price || product.compareAtPrice || product.mrp || product.price || 0)
    : parseFloat(product.compareAtPrice || product.mrp || product.price || variation?.compareAtPrice || variation?.mrp || variation?.price || 0);

  // Safety layer: Never show 0 price if MRP exists
  if (displayPrice <= 0 && mrp > 0) {
    displayPrice = mrp;
  }

  const hasDiscount = mrp > displayPrice;
  const discount = hasDiscount ? Math.round(((mrp - displayPrice) / mrp) * 100) : 0;

  return {
    displayPrice,
    mrp,
    discount,
    hasDiscount
  };
};

/**
 * Calculates the applicable unit price based on quantity and tiered pricing.
 * @param product The product object
 * @param variationSelector The selected variation (index, ID, or object)
 * @param quantity The quantity to check against tiers
 * @returns The calculated price per unit
 */
export const getApplicableUnitPrice = (product: any, variationSelector?: number | string | any, quantity: number = 1): number => {
  if (!product) return 0;

  // Resolve variation
  let variation = typeof variationSelector === 'object' ? variationSelector : undefined;
  if (!variation) {
      if (typeof variationSelector === 'number') {
        variation = product.variations?.[variationSelector];
      } else if (typeof variationSelector === 'string') {
        variation = product.variations?.find((v: any) => (v._id === variationSelector || v.id === variationSelector));
      }
  }

  // Only fall back when the root product has no usable pricing.
  if (
    !variation &&
    product.variations?.length > 0 &&
    variationSelector === undefined &&
    !parseFloat(product.discPrice || 0) &&
    !parseFloat(product.price || 0) &&
    !parseFloat(product.compareAtPrice || product.mrp || 0)
  ) {
    variation = product.variations[0];
  }

  const { mrp: baseMrp } = calculateProductPrice(product, variationSelector);
  let finalPrice = 0;

  // 1. Check for unitPricing in main product (New Standard - Prioritized)
  if (product.unitPricing && Array.isArray(product.unitPricing) && product.unitPricing.length > 0) {
       const applicableTier = product.unitPricing
          .filter((t: any) => quantity >= (t.minQty || 0))
          .sort((a: any, b: any) => (b.minQty || 0) - (a.minQty || 0))[0];

        if (applicableTier && parseFloat(applicableTier.price) > 0) {
            finalPrice = parseFloat(applicableTier.price);
        }
  }

  // 2. Check for tiered pricing in variation (Legacy/Specific)
  if (finalPrice <= 0 && variation?.tieredPrices && Array.isArray(variation.tieredPrices) && variation.tieredPrices.length > 0) {
      const applicableTier = variation.tieredPrices
          .filter((t: any) => quantity >= (t.minQty || 0))
          .sort((a: any, b: any) => (b.minQty || 0) - (a.minQty || 0))[0];

      if (applicableTier && parseFloat(applicableTier.price) > 0) {
          finalPrice = parseFloat(applicableTier.price);
      }
  }

  // 3. Check for tiered pricing in main product (Legacy fallbacks)
  if (finalPrice <= 0 && product.tieredPrices && Array.isArray(product.tieredPrices) && product.tieredPrices.length > 0) {
       const applicableTier = product.tieredPrices
          .filter((t: any) => quantity >= (t.minQty || 0))
          .sort((a: any, b: any) => (b.minQty || 0) - (a.minQty || 0))[0];

        if (applicableTier && parseFloat(applicableTier.price) > 0) {
            finalPrice = parseFloat(applicableTier.price);
        }
  }

  // 4. Default to standard price calculation if no tier found or tier price was 0
  if (finalPrice <= 0) {
      const { displayPrice } = calculateProductPrice(product, variationSelector);
      finalPrice = displayPrice;
  }

  // FINAL SAFETY FALLBACK: Never show 0 if MRP exists
  if (finalPrice <= 0 && baseMrp > 0) {
    return baseMrp;
  }

  return finalPrice;
};
