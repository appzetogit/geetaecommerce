export interface FirstOrderOfferConfig {
  enabled?: boolean;
  discountAmount?: number;
  minOrderAmount?: number;
  title?: string;
  subtitle?: string;
  ctaText?: string;
}

export function resolveFirstOrderOfferDiscount(
  offer: FirstOrderOfferConfig | null | undefined,
  isFirstTimeCustomer: boolean,
  orderSubtotal: number
): number {
  if (!offer?.enabled || !isFirstTimeCustomer) return 0;

  const discountAmount = Number(offer.discountAmount) || 0;
  if (discountAmount <= 0) return 0;

  const minOrder = Number(offer.minOrderAmount) || 0;
  if (minOrder > 0 && orderSubtotal < minOrder) return 0;

  return Math.min(discountAmount, Math.max(0, orderSubtotal));
}
