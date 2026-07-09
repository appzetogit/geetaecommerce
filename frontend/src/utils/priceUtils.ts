import { Product } from '../types/domain';
import { hasRealVariants, resolveRootDisplayPrice, resolveRootMrp } from './productLegacyUtils';

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

  if (product.listing && variationSelector === undefined) {
    const listingMin = product.listing.minPrice ?? 0;
    const rootPrice = resolveRootDisplayPrice(product);
    const minPrice = listingMin > 0 ? listingMin : rootPrice;
    const listingMax = product.listing.maxPrice ?? minPrice;
    const rootMrp = resolveRootMrp(product);
    const maxMrp =
      listingMax > minPrice ? listingMax : rootMrp > minPrice ? rootMrp : minPrice;
    const hasDiscount = maxMrp > minPrice;
    return {
      displayPrice: minPrice,
      mrp: maxMrp,
      discount: hasDiscount ? Math.round(((maxMrp - minPrice) / maxMrp) * 100) : 0,
      hasDiscount,
    };
  }

  const variants = product.variations ?? product.variants ?? [];
  let variation;
  if (typeof variationSelector === 'number') {
    variation = variants[variationSelector];
  } else if (typeof variationSelector === 'string') {
    const sel = variationSelector.trim();
    variation = variants.find(
      (v: any) => String(v._id) === sel || String(v.id) === sel
    );
    if (!variation) {
      const label = sel.toLowerCase();
      variation = variants.find((v: any) => {
        const value = String(v.value || v.title || v.name || '').trim().toLowerCase();
        const type = String(v.variationType || '').trim().toLowerCase();
        const composed = type && type !== 'standard' ? `${type}: ${value}` : value;
        return (
          value === label ||
          composed === label ||
          label.endsWith(`: ${value}`) ||
          `${type}: ${value}` === label
        );
      });
    }
  }

  if (!variation && variants.length > 0 && variationSelector === undefined) {
    variation = variants[0];
  }

  const vPrice = parseFloat(variation?.price || 0);
  const vDiscPrice = parseFloat(variation?.discPrice || 0);

  let displayPrice = vDiscPrice > 0 ? vDiscPrice : vPrice;
  let mrp = parseFloat(variation?.compareAtPrice || variation?.mrp || variation?.price || 0);

  if (displayPrice <= 0) {
    displayPrice = resolveRootDisplayPrice(product);
  }
  if (mrp <= 0) {
    mrp = resolveRootMrp(product);
  }

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
/** Card/listing display: first variant when variants exist, else listing min price. */
export const calculateCardPrice = (product: any): CalculatedPrice => {
  if (hasRealVariants(product)) {
    const variantPrice = calculateProductPrice(product, 0);
    if (variantPrice.displayPrice > 0) {
      return variantPrice;
    }
  }

  if (product?.listing) {
    const minPrice = product.listing.minPrice ?? 0;
    const maxMrp = product.listing.maxPrice ?? minPrice;
    const rootPrice = resolveRootDisplayPrice(product);
    const rootMrp = resolveRootMrp(product);
    const displayPrice = minPrice > 0 ? minPrice : rootPrice;
    const mrp = maxMrp > displayPrice ? maxMrp : rootMrp > displayPrice ? rootMrp : displayPrice;
    const hasDiscount = mrp > displayPrice;
    return {
      displayPrice,
      mrp,
      discount: hasDiscount ? Math.round(((mrp - displayPrice) / mrp) * 100) : 0,
      hasDiscount,
    };
  }

  const displayPrice = resolveRootDisplayPrice(product);
  const mrp = resolveRootMrp(product);
  const hasDiscount = mrp > displayPrice;
  return {
    displayPrice,
    mrp,
    discount: hasDiscount ? Math.round(((mrp - displayPrice) / mrp) * 100) : 0,
    hasDiscount,
  };
};

export const getApplicableUnitPrice = (product: any, variationSelector?: number | string | any, quantity: number = 1): number => {
  if (!product) return 0;

  // Resolve variation
  let variation = typeof variationSelector === 'object' ? variationSelector : undefined;
  if (!variation) {
      if (typeof variationSelector === 'number') {
        variation = product.variations?.[variationSelector];
      } else if (typeof variationSelector === 'string') {
        const sel = variationSelector.trim();
        variation = product.variations?.find(
          (v: any) => String(v._id) === sel || String(v.id) === sel
        );
        if (!variation) {
          const label = sel.toLowerCase();
          variation = product.variations?.find((v: any) => {
            const value = String(v.value || v.title || v.name || '').trim().toLowerCase();
            const type = String(v.variationType || '').trim().toLowerCase();
            const composed = type && type !== 'standard' ? `${type}: ${value}` : value;
            return value === label || composed === label || label.endsWith(`: ${value}`);
          });
        }
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
          .filter((t: any) => quantity >= (t.minQty || 0) && parseFloat(t.price) > 0)
          .sort((a: any, b: any) => (b.minQty || 0) - (a.minQty || 0))[0];

        if (applicableTier && parseFloat(applicableTier.price) > 0) {
            finalPrice = parseFloat(applicableTier.price);
        }
  }

  // 2. Check for tiered pricing in variation (Legacy/Specific)
  if (finalPrice <= 0 && variation?.tieredPrices && Array.isArray(variation.tieredPrices) && variation.tieredPrices.length > 0) {
      const applicableTier = variation.tieredPrices
          .filter((t: any) => quantity >= (t.minQty || 0) && parseFloat(t.price) > 0)
          .sort((a: any, b: any) => (b.minQty || 0) - (a.minQty || 0))[0];

      if (applicableTier && parseFloat(applicableTier.price) > 0) {
          finalPrice = parseFloat(applicableTier.price);
      }
  }

  // 3. Check for tiered pricing in main product (Legacy fallbacks)
  if (finalPrice <= 0 && product.tieredPrices && Array.isArray(product.tieredPrices) && product.tieredPrices.length > 0) {
       const applicableTier = product.tieredPrices
          .filter((t: any) => quantity >= (t.minQty || 0) && parseFloat(t.price) > 0)
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

/** Unit price for a cart line — prefers server snapshot, then variant-aware catalog price. */
export const getCartLineUnitPrice = (item: any): number => {
  const snap = Number(item?.unitPrice);
  if (Number.isFinite(snap) && snap > 0) return snap;

  const prod = item?.product;
  if (!prod) return 0;

  const selector =
    item?.variantId ||
    prod?.variantId ||
    prod?.selectedVariantId ||
    item?.variant ||
    item?.variation;

  return getApplicableUnitPrice(prod, selector, item?.quantity || 1);
};

export const getCartItemVariantSelector = (item: any): number | string | undefined =>
  item?.variantId ||
  item?.product?.variantId ||
  item?.product?.selectedVariantId ||
  item?.variant ||
  item?.variation ||
  undefined;

/**
 * Formats a number to remove trailing zeros after the decimal point.
 * Example: 4.00 -> 4, 4.50 -> 4.5
 */
export const formatAmount = (amount: number | string): string => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '0';
  return Number(num.toFixed(2)).toString();
};
