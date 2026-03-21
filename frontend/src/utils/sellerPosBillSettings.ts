/** Seller Bill Settings page — same key as `SellerBillSettings.tsx` localStorage cache. */
export const SELLER_BILL_SETTINGS_KEY = 'seller_bill_settings';

/** Fires on the same window when seller saves bill settings (`storage` only fires in other tabs). */
export const SELLER_BILL_SETTINGS_UPDATED_EVENT = 'seller_bill_settings_updated';

/** Read cached seller bill settings from localStorage (used by Seller POS print/PDF). */
export function readSellerPosBillSettings(): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(SELLER_BILL_SETTINGS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}
