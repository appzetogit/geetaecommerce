import { useState, useEffect, useCallback } from 'react';
import { flushSync } from 'react-dom';
import {
  SELLER_BILL_SETTINGS_KEY,
  SELLER_BILL_SETTINGS_UPDATED_EVENT,
  readSellerPosBillSettings,
} from '../../../utils/sellerPosBillSettings';

/**
 * Loads seller Bill Settings from localStorage (same source as Seller Bill Settings page)
 * and keeps POS print/PDF in sync after save, focus, or other tabs.
 */
export function useSellerPosBillSettings() {
  const [posBillSettings, setPosBillSettings] = useState<Record<string, any> | null>(null);

  const loadSellerBillSettings = useCallback(() => {
    try {
      const saved = localStorage.getItem(SELLER_BILL_SETTINGS_KEY);
      if (saved) {
        setPosBillSettings(JSON.parse(saved));
      } else {
        setPosBillSettings(null);
      }
    } catch (e) {
      console.error('Failed to load seller bill settings', e);
    }
  }, []);

  useEffect(() => {
    loadSellerBillSettings();
    const onStorage = (e: StorageEvent) => {
      if (e.key === SELLER_BILL_SETTINGS_KEY || e.key === null) {
        loadSellerBillSettings();
      }
    };
    const onUpdated = () => loadSellerBillSettings();
    window.addEventListener('storage', onStorage);
    window.addEventListener(SELLER_BILL_SETTINGS_UPDATED_EVENT, onUpdated);
    window.addEventListener('focus', onUpdated);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(SELLER_BILL_SETTINGS_UPDATED_EVENT, onUpdated);
      window.removeEventListener('focus', onUpdated);
    };
  }, [loadSellerBillSettings]);

  const syncBeforePrint = useCallback(() => {
    try {
      const fresh = readSellerPosBillSettings();
      flushSync(() => {
        setPosBillSettings(fresh as any);
      });
    } catch (e) {
      console.error('Failed to sync bill settings before print', e);
    }
  }, []);

  const billPdf = useCallback(
    () => readSellerPosBillSettings() ?? posBillSettings,
    [posBillSettings]
  );

  return {
    posBillSettings,
    setPosBillSettings,
    loadSellerBillSettings,
    syncBeforePrint,
    billPdf,
    readSellerPosBillSettings,
  };
}
