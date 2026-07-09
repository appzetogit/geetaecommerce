export type FreeGiftRuleType = 'free_gift' | 'discount';
export type FreeGiftDiscountType = 'fixed' | 'percentage';

export interface CartRewardRule {
  id?: string;
  _id?: string;
  minCartValue: number;
  ruleType?: FreeGiftRuleType;
  giftProductId?: string;
  giftProduct?: {
    _id?: string;
    productName?: string;
    name?: string;
    mainImage?: string;
    imageUrl?: string;
    price?: number;
    mrp?: number;
    [key: string]: unknown;
  };
  discountType?: FreeGiftDiscountType;
  discountValue?: number;
  status: 'Active' | 'Inactive';
}

export function normalizeCartRewardRule(rule: any): CartRewardRule {
  const populated = rule?.giftProductId;
  const giftProduct =
    rule?.giftProduct ||
    (populated && typeof populated === 'object' && (populated.productName || populated.name)
      ? populated
      : undefined);
  const giftProductId =
    (typeof rule?.giftProductId === 'string' ? rule.giftProductId : giftProduct?._id) ||
    populated?._id ||
    '';

  return {
    ...rule,
    id: rule?.id || rule?._id,
    _id: rule?._id || rule?.id,
    ruleType: rule?.ruleType === 'discount' ? 'discount' : 'free_gift',
    giftProductId: giftProductId ? String(giftProductId) : '',
    giftProduct,
  };
}

export function getActiveCartRewardRules(rules: CartRewardRule[]): CartRewardRule[] {
  return rules
    .map(normalizeCartRewardRule)
    .filter((rule) => rule.status === 'Active')
    .sort((a, b) => a.minCartValue - b.minCartValue);
}

export function getGiftRules(rules: CartRewardRule[]): CartRewardRule[] {
  return getActiveCartRewardRules(rules).filter((rule) => rule.ruleType !== 'discount');
}

export function getDiscountRules(rules: CartRewardRule[]): CartRewardRule[] {
  return getActiveCartRewardRules(rules).filter((rule) => rule.ruleType === 'discount');
}

export function getRuleRewardLabel(rule: CartRewardRule): string {
  if (rule.ruleType === 'discount') {
    if (rule.discountType === 'percentage') {
      return `${rule.discountValue || 0}% OFF`;
    }
    return `₹${rule.discountValue || 0} OFF`;
  }

  return rule.giftProduct?.productName || rule.giftProduct?.name || 'Free Gift';
}

export function calculateCartRuleDiscount(
  rules: CartRewardRule[],
  paidCartTotal: number,
  discountBase: number
): number {
  if (!rules.length || paidCartTotal <= 0 || discountBase <= 0) return 0;

  let totalDiscount = 0;
  for (const rule of getDiscountRules(rules)) {
    if (paidCartTotal < Number(rule.minCartValue || 0)) continue;

    const value = Number(rule.discountValue) || 0;
    if (value <= 0) continue;

    if (rule.discountType === 'percentage') {
      totalDiscount += (discountBase * value) / 100;
    } else {
      totalDiscount += value;
    }
  }

  return Math.min(Math.round(totalDiscount * 100) / 100, discountBase);
}

export function getUnlockedCartRules(rules: CartRewardRule[], paidCartTotal: number) {
  return getActiveCartRewardRules(rules).filter(
    (rule) => paidCartTotal >= Number(rule.minCartValue || 0)
  );
}

export function getNextCartRule(rules: CartRewardRule[], paidCartTotal: number) {
  return getActiveCartRewardRules(rules).find(
    (rule) => Number(rule.minCartValue || 0) > paidCartTotal
  );
}
