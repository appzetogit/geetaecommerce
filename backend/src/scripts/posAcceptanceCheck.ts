/**
 * POS acceptance checklist — run manually or extend into automated tests.
 * Verifies route wiring and PhonePe service exports after implementation.
 */
import assert from "assert";
import fs from "fs";
import path from "path";

const root = path.resolve(__dirname, "../..");

const requiredFiles = [
  "src/services/phonepeService.ts",
  "src/modules/pos/completePosOnlinePayment.ts",
  "src/modules/pos/initiatePosOnlineOrder.ts",
  "src/routes/sellerPOSRoutes.ts",
  "src/models/StockLedger.ts",
  "src/models/CreditTransaction.ts",
  "src/models/SellerPOSState.ts",
];

for (const file of requiredFiles) {
  const full = path.join(root, file);
  assert.ok(fs.existsSync(full), `Missing required POS file: ${file}`);
}

const sellerRoutes = fs.readFileSync(
  path.join(root, "src/routes/sellerPOSRoutes.ts"),
  "utf8"
);
assert.ok(sellerRoutes.includes('router.post("/orders/online"'));
assert.ok(sellerRoutes.includes('router.post("/orders/verify"'));
assert.ok(sellerRoutes.includes('router.get("/credit/customers"'));

const adminRoutes = fs.readFileSync(
  path.join(root, "src/routes/adminRoutes.ts"),
  "utf8"
);
assert.ok(adminRoutes.includes('router.post("/orders/pos"'));
assert.ok(adminRoutes.includes('router.post("/orders/pos/online"'));
assert.ok(adminRoutes.includes('router.post("/pos/exchange"'));

const phonepe = fs.readFileSync(
  path.join(root, "src/services/phonepeService.ts"),
  "utf8"
);
assert.ok(phonepe.includes("initiatePhonePePayment"));
assert.ok(phonepe.includes("getPhonePePaymentStatus"));

console.log("POS acceptance structure checks passed.");
