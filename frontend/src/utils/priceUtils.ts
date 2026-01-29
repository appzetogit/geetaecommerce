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

  // Fallback to first variation if no specific one selected/found but variations exist
  // Only if variationSelector was NOT provided (undefined). If it was provided but not found, we probably shouldn't default to 0?
  // Current behavior was: if index undefined, use index 0.
  if (!variation && product.variations?.length > 0 && variationSelector === undefined) {
    variation = product.variations[0];
  }

  const displayPrice = (variation?.discPrice && variation.discPrice > 0)
    ? variation.discPrice
    : (product.discPrice && product.discPrice > 0)
    ? product.discPrice
    : (variation?.price || product.price || 0);

  const mrp = variation?.compareAtPrice || variation?.mrp || product.compareAtPrice || product.mrp || variation?.price || product.price || 0;

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

  // Fallback to first variation if needed (standard logic)
  if (!variation && product.variations?.length > 0 && variationSelector === undefined) {
    variation = product.variations[0];
  }

  // 1. Check for unitPricing in main product (New Standard - Prioritized)
  // This ensures rules set in the new Bulk Import/Edit system take precedence
  if (product.unitPricing && Array.isArray(product.unitPricing) && product.unitPricing.length > 0) {
       const applicableTier = product.unitPricing
          .filter((t: any) => quantity >= (t.minQty || 0))
          .sort((a: any, b: any) => b.minQty - a.minQty)[0];

        if (applicableTier) {
            return parseFloat(applicableTier.price);
        }
  }

  // 2. Check for tiered pricing in variation (Legacy/Specific)
  if (variation?.tieredPrices && Array.isArray(variation.tieredPrices) && variation.tieredPrices.length > 0) {
      // Find the highest tier where quantity >= minQty
      const applicableTier = variation.tieredPrices
          .filter((t: any) => quantity >= (t.minQty || 0))
          .sort((a: any, b: any) => b.minQty - a.minQty)[0];

      if (applicableTier) {
          return parseFloat(applicableTier.price);
      }
  }

  // 3. Check for tiered pricing in main product (Legacy fallbacks)
  if (product.tieredPrices && Array.isArray(product.tieredPrices) && product.tieredPrices.length > 0) {
       const applicableTier = product.tieredPrices
          .filter((t: any) => quantity >= (t.minQty || 0))
          .sort((a: any, b: any) => b.minQty - a.minQty)[0];

        if (applicableTier) {
            return parseFloat(applicableTier.price);
        }
  }

  // 3. Fallback to standard price logic
  // Use calculateProductPrice to get the standard selling price (discounted or regular)
  const { displayPrice } = calculateProductPrice(product, variationSelector);
  return displayPrice;
};
