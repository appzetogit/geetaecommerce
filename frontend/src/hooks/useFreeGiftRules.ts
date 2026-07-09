import { useState, useEffect } from 'react';
import { getCustomerFreeGiftRules } from '../services/api/customerFreeGiftService';
import { CartRewardRule, normalizeCartRewardRule } from '../utils/freeGiftRuleUtils';

export type FreeGiftRule = CartRewardRule;

export const useFreeGiftRules = () => {
  const [rules, setRules] = useState<FreeGiftRule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRules = async () => {
      try {
        const res = await getCustomerFreeGiftRules();
        if (res.success && Array.isArray(res.data)) {
           const active = res.data
             .map(normalizeCartRewardRule)
             .filter((r: FreeGiftRule) => r.status === 'Active')
             .sort((a: FreeGiftRule, b: FreeGiftRule) => a.minCartValue - b.minCartValue);
           setRules(active);
        }
      } catch (err) {
        console.error("Failed to fetch free gift rules", err);
      } finally {
        setLoading(false);
      }
    };
    fetchRules();
  }, []);

  return { rules, loading };
};
