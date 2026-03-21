# Seller POS — Bill Settings → Print (manual apply)

## Problem

The screen titled **“Bill Settings”** (seller) saves to `localStorage` key `seller_bill_settings` and API.  
`SellerPOSOrders.tsx` was still using **hardcoded `GEETA`** for thermal print, PDF, and purchase invoice HTML.

Admin POS already reads `admin_pos_bill_settings`; seller POS needed the same pattern for `seller_bill_settings`.

## Already in the repo

- `frontend/src/utils/sellerPosBillSettings.ts` — key, event name, `readSellerPosBillSettings()`
- `SellerBillSettings.tsx` — saves to `SELLER_BILL_SETTINGS_KEY` and dispatches `SELLER_BILL_SETTINGS_UPDATED_EVENT` on save
- `frontend/src/modules/seller/hooks/useSellerPosBillSettings.ts` — optional hook: loads settings, listens for `storage` / custom event / `focus`, `syncBeforePrint()` before `window.print()`

## What you must change in `SellerPOSOrders.tsx`

The file is very large (~5600 lines); if your editor/AI cannot patch it automatically, apply the following with **Find & Replace** (or merge the hook).

### 1) Imports

After the `getAllSuppliers` import, add:

```ts
import { SELLER_BILL_SETTINGS_KEY, SELLER_BILL_SETTINGS_UPDATED_EVENT, readSellerPosBillSettings } from '../../../utils/sellerPosBillSettings';
```

Or use the hook only:

```ts
import { useSellerPosBillSettings } from '../hooks/useSellerPosBillSettings';
```

### 2) State + listeners (if not using the hook)

After `getStaffSession('seller')`:

```ts
const [posBillSettings, setPosBillSettings] = useState(null);
```

Replace `useEffect(() => { refreshConfig(); }, []);` with an effect that:

- calls `refreshConfig()`
- loads from `localStorage.getItem(SELLER_BILL_SETTINGS_KEY)` → `setPosBillSettings(JSON.parse(...))` or `null`
- `window.addEventListener('storage', ...)` when `e.key === SELLER_BILL_SETTINGS_KEY || e.key === null`
- `window.addEventListener(SELLER_BILL_SETTINGS_UPDATED_EVENT, reload)`
- `window.addEventListener('focus', reload)`

**Or** inside the component body:

```ts
const { posBillSettings, syncBeforePrint, readSellerPosBillSettings } = useSellerPosBillSettings();
```

(Adjust hook exports if you use the hook file as-is.)

### 3) `handlePrintBill`

Before `window.print()`:

```ts
try {
  const fresh = readSellerPosBillSettings();
  flushSync(() => setPosBillSettings(fresh));
} catch (e) {
  console.error('Failed to sync bill settings before print', e);
}
window.print();
```

Or `syncBeforePrint()` from the hook, then `window.print()`.

### 4) `downloadPDF`

First line inside the function:

```ts
const billPdf = readSellerPosBillSettings() ?? posBillSettings;
```

- **Quotation PDF header:** use `billPdf?.shopName`, `billPdf?.address` with `doc.splitTextToSize`, `billPdf?.phone`, FSSAI from `billPdf` then `config.invoiceSettings` then fallback — same structure as `AdminPOSOrders.tsx` `downloadPDF`.
- **Retail PDF header:** same as admin: shop name, address block, GST/FSSAI from `billPdf` first, else `config`.
- **Notes / terms at bottom:** `(billPdf?.notes OR config)` and `(billPdf?.terms OR config)`; optional `billPdf?.qrCode` → `doc.addImage`.

### 5) `printPurchaseInvoice` HTML header

After the popup check, build `shopTitle`, `addrHtml`, `phoneLine`, `fssaiBlk` from `readSellerPosBillSettings()` + `esc()` (copy from `AdminPOSOrders.tsx` `printPurchaseInvoice`).  
Replace the hardcoded `<h1>GEETA</h1>` and fixed address `<p>...</p>` with the dynamic template variables.

### 6) Hidden thermal block (`HIDDEN THERMAL RECEIPT`)

Match `AdminPOSOrders.tsx`:

- `posBillSettings?.shopName || 'GEETA'`
- `posBillSettings?.address` with `whitespace-pre-wrap` + default address string
- `posBillSettings?.phone`
- GST/FSSAI: seller settings first, else `config.invoiceSettings`
- Footer notes/terms: seller `posBillSettings` OR `config`
- Optional `posBillSettings?.qrCode` image

### 7) Success modal title

Replace hardcoded `Geeta Store` with:

```tsx
{posBillSettings?.shopName || 'Geeta Store'}
```

## Verify

1. Seller → Bill Settings → set shop name → Save.  
2. Seller → POS → bill → Print.  
3. Header should show saved shop name, address, phone.

## Reference implementation

Copy patterns from `frontend/src/modules/admin/pages/AdminPOSOrders.tsx` (imports `readAdminPosBillSettings`, `posBillSettings`, thermal block, `downloadPDF`, `printPurchaseInvoice`).
