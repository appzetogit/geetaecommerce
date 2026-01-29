import { useState, useEffect } from 'react';
import { getCustomerFreeGiftRules } from '../services/api/customerFreeGiftService';

// Re-using/defining interface
export interface FreeGiftRule {
  id: string; // or _id
  _id?: string;
  minCartValue: number;
  giftProductId: string;
  giftProduct?: any;
  status: 'Active' | 'Inactive';
}

export const useFreeGiftRules = () => {
  const [rules, setRules] = useState<FreeGiftRule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRules = async () => {
      try {
        const res = await getCustomerFreeGiftRules();
        if (res.success && Array.isArray(res.data)) {
           // Filter active and sort
           const active = res.data
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
