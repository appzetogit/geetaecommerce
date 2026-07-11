import {
  computeListing,
  getVariantDisplayPrice,
  resolveVariantForCart,
  variantsFromProductDoc,
  getTotalStock,
} from "../product/variantHelpers";
import { toListItem } from "../product/productReadMapper";

export function resolveCartLinePricing(
  product: any,
  cartItem: { variantId?: string; variation?: string }
) {
  const variants = variantsFromProductDoc(product);
  const variant = resolveVariantForCart(
    variants,
    cartItem.variantId,
    cartItem.variation
  );
  let unitPrice = variant
    ? getVariantDisplayPrice(variant)
    : variants.length
      ? getVariantDisplayPrice(variants[0])
      : 0;

  // Legacy products may store sell price on the root document while variants stay at 0.
  if (unitPrice <= 0) {
    const listing = computeListing(variants, false, product);
    unitPrice = listing.minPrice;
  }
  const stock = variant
    ? Number(variant.stock) || 0
    : getTotalStock(variants);
  const image =
    variant?.mainImage ??
    variants.find((v) => v.mainImage)?.mainImage ??
    null;

  return {
    variant,
    variantId: variant?._id ? String(variant._id) : undefined,
    unitPrice,
    stock,
    image,
    variationLabel: variant
      ? `${variant.variationType}: ${variant.value}`
      : cartItem.variation,
  };
}

export function enrichCartItemProduct(product: any, cartItem: any) {
  const mapped = toListItem(product);
  const pricing = resolveCartLinePricing(product, cartItem);
  return {
    ...cartItem.toObject?.() ?? cartItem,
    product: {
      ...mapped,
      price: pricing.unitPrice,
      discPrice: pricing.unitPrice,
      stock: pricing.stock,
      mainImage: pricing.image,
      selectedVariantId: pricing.variantId,
    },
    unitPrice: pricing.unitPrice,
    variantId: pricing.variantId ?? cartItem.variantId,
    variation: pricing.variationLabel ?? cartItem.variation,
  };
}

export const CART_PRODUCT_SELECT =
  "productName seller status publish category variations gst hsnCode publish popular dealOfDay price discPrice compareAtPrice unitPricing tieredPrices mainImage";
