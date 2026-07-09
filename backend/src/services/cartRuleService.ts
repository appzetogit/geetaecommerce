import FreeGiftRule from '../models/FreeGiftRule';

export function serializeFreeGiftRule(rule: any) {
  const plain = typeof rule?.toObject === 'function' ? rule.toObject() : { ...rule };
  const populated = plain.giftProductId;
  const giftProduct =
    populated && typeof populated === 'object' && (populated.productName || populated.name)
      ? populated
      : plain.giftProduct || null;
  const giftProductId =
    giftProduct?._id?.toString?.() ||
    (typeof plain.giftProductId === 'string'
      ? plain.giftProductId
      : plain.giftProductId?._id?.toString?.()) ||
    '';

  return {
    ...plain,
    _id: plain._id?.toString?.() || plain._id,
    id: plain._id?.toString?.() || plain.id,
    ruleType: plain.ruleType || 'free_gift',
    giftProductId,
    giftProduct,
  };
}

export function calculateCartRuleDiscount(
  rules: any[],
  paidCartTotal: number,
  discountBase: number
): number {
  if (!Array.isArray(rules) || paidCartTotal <= 0 || discountBase <= 0) return 0;

  let totalDiscount = 0;
  for (const rule of rules) {
    if (rule.status !== 'Active') continue;
    if ((rule.ruleType || 'free_gift') !== 'discount') continue;
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

export async function getActiveCartRules() {
  const rules = await FreeGiftRule.find({ status: 'Active' })
    .populate('giftProductId')
    .sort({ minCartValue: 1 })
    .lean();
  return rules.map(serializeFreeGiftRule);
}
