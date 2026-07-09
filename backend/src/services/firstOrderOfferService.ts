export interface FirstOrderOfferSettings {
  enabled?: boolean;
  discountAmount?: number;
  minOrderAmount?: number;
  title?: string;
  subtitle?: string;
  ctaText?: string;
}

export const FIRST_ORDER_OFFER_CODE = "FIRST_ORDER";

/** Flat discount for a customer's first order when admin offer is enabled. */
export function resolveFirstOrderOfferDiscount(
  offer: FirstOrderOfferSettings | null | undefined,
  customer: { totalOrders?: number } | null | undefined,
  orderSubtotal: number
): number {
  if (!offer?.enabled) return 0;

  const discountAmount = Number(offer.discountAmount) || 0;
  if (discountAmount <= 0) return 0;

  if (!customer || Number(customer.totalOrders || 0) > 0) return 0;

  const minOrder = Number(offer.minOrderAmount) || 0;
  if (minOrder > 0 && orderSubtotal < minOrder) return 0;

  return Math.min(discountAmount, Math.max(0, orderSubtotal));
}
