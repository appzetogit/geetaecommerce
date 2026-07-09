# PhonePe POS Integration

Configure these environment variables in the backend:

```
PHONEPE_MERCHANT_ID=your_merchant_id
PHONEPE_SALT_KEY=your_salt_key
PHONEPE_SALT_INDEX=1
PHONEPE_ENV=UAT
FRONTEND_URL=http://localhost:5173
```

- `PHONEPE_ENV=UAT` uses PhonePe sandbox (`api-preprod.phonepe.com`)
- `PHONEPE_ENV=PRODUCTION` uses live PhonePe (`api.phonepe.com`)

## POS flows using PhonePe

| Flow | Initiate endpoint | Verify / return |
|------|-------------------|-----------------|
| Admin POS online sale | `POST /api/v1/admin/orders/pos/online` | `/admin/pos/success` |
| Seller POS online sale | `POST /api/v1/seller/pos/orders/online` | `/seller/pos/success` |
| Admin credit repayment | `POST /api/v1/admin/pos/credit/payment/initiate` | `/admin/pos/credit/verify` |
| Seller credit repayment | `POST /api/v1/seller/pos/credit/payment/initiate` | `/seller/pos/credit/verify` |

Cash and Credit (Udhaar) checkout do not require PhonePe credentials.
