import { Product } from '../types/domain';

export interface FreeGiftRule {
  id: string;
  minCartValue: number;
  giftProductId: string; // The ID of the product to trigger as gift
  giftProduct?: Product; // Full product details (saved for convenience or fetched)
  status: 'Active' | 'Inactive';
}

const STORAGE_KEY = 'admin_free_gift_rules';

export const getFreeGiftRules = (): FreeGiftRule[] => {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) : [];
};

export const saveFreeGiftRules = (rules: FreeGiftRule[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
};

export const getActiveFreeGiftRules = (): FreeGiftRule[] => {
  const rules = getFreeGiftRules();
  // Return all active rules sorted by minCartValue asc
  return rules.filter(r => r.status === 'Active').sort((a, b) => a.minCartValue - b.minCartValue);
};

// Legacy support (returns the highest value active rule or first)
export const getActiveFreeGiftRule = (): FreeGiftRule | undefined => {
  const active = getActiveFreeGiftRules();
  return active.length > 0 ? active[active.length - 1] : undefined;
};

export const addFreeGiftRule = (rule: Omit<FreeGiftRule, 'id'>) => {
  const rules = getFreeGiftRules();
  // Ensure only one active rule if the new one is active -> REMOVED to allow multiple
  // if (rule.status === 'Active') {
  //     rules.forEach(r => r.status = 'Inactive');
  // }

  const newRule = { ...rule, id: Date.now().toString() };
  rules.push(newRule);
  saveFreeGiftRules(rules);
  return newRule;
};

export const updateFreeGiftRule = (updatedRule: FreeGiftRule) => {
  const rules = getFreeGiftRules();

  // if (updatedRule.status === 'Active') {
  //     rules.forEach(r => {
  //         if (r.id !== updatedRule.id) r.status = 'Inactive';
  //     });
  // }

  const index = rules.findIndex(r => r.id === updatedRule.id);
  if (index !== -1) {
    rules[index] = updatedRule;
    saveFreeGiftRules(rules);
  }
};

export const deleteFreeGiftRule = (id: string) => {
    const rules = getFreeGiftRules().filter(r => r.id !== id);
    saveFreeGiftRules(rules);
};
