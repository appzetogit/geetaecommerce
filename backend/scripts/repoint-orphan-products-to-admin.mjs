// Re-point all products that reference the missing orphan seller
// (698ad58d766e75a17731791c) to the existing Admin store
// (6a17dbdf14bc4291b7c21342).
//
// Safety:
//   * Re-validates the admin seller still exists & passes the customer visibility filter.
//   * Saves each product's current `seller` to `originalSeller` BEFORE rewriting it
//     (only when `originalSeller` is missing, so this script is idempotent).
//   * Supports a --dry-run flag.
//
// Usage:
//   node scripts/repoint-orphan-products-to-admin.mjs --dry-run
//   node scripts/repoint-orphan-products-to-admin.mjs

import mongoose from "mongoose";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envText = readFileSync(resolve(__dirname, "../.env"), "utf8");
const MONGODB_URI = envText
  .split(/\r?\n/)
  .find((l) => l.trim().startsWith("MONGODB_URI="))
  .replace(/^MONGODB_URI=/, "")
  .trim();

const ORPHAN_SELLER_ID = "698ad58d766e75a17731791c";
const ADMIN_SELLER_ID  = "6a17dbdf14bc4291b7c21342";

const dryRun = process.argv.includes("--dry-run");

await mongoose.connect(MONGODB_URI);
const db = mongoose.connection.db;
const Products = db.collection("products");
const Sellers = db.collection("sellers");

const orphanId = new mongoose.Types.ObjectId(ORPHAN_SELLER_ID);
const adminId = new mongoose.Types.ObjectId(ADMIN_SELLER_ID);

// --- Pre-flight checks -------------------------------------------------------

console.log(`Mode: ${dryRun ? "DRY-RUN (no writes)" : "LIVE"}`);
console.log(`Orphan seller: ${ORPHAN_SELLER_ID}`);
console.log(`Admin  seller: ${ADMIN_SELLER_ID}\n`);

const admin = await Sellers.findOne({ _id: adminId });
if (!admin) {
  console.error("ABORT: Admin seller document not found — refusing to point products at a non-existent seller.");
  process.exit(1);
}
const adminPassesVisibility =
  admin.isEnabled === true &&
  (
    /admin/i.test(admin.email || "") ||
    admin.category === "Admin" ||
    /Admin/i.test(admin.storeName || "") ||
    admin.canCreateCategories !== true
  );
if (!adminPassesVisibility) {
  console.error("ABORT: Admin seller does not pass the customer-visibility filter — products would still be hidden.");
  console.error("Admin doc:", JSON.stringify(admin, null, 2));
  process.exit(1);
}
console.log(`Admin seller OK: storeName="${admin.storeName}" isEnabled=${admin.isEnabled} status=${admin.status}`);

const orphan = await Sellers.findOne({ _id: orphanId });
if (orphan) {
  console.error("ABORT: Orphan seller document exists — this script is only for products owned by the MISSING seller.");
  console.error("Found doc:", JSON.stringify(orphan, null, 2));
  process.exit(1);
}
console.log(`Confirmed orphan seller ${ORPHAN_SELLER_ID} has no document.\n`);

const orphanProductCount = await Products.countDocuments({ seller: orphanId });
console.log(`Products currently owned by orphan: ${orphanProductCount}`);
if (orphanProductCount === 0) {
  console.log("Nothing to do.");
  await mongoose.disconnect();
  process.exit(0);
}

// Sanity sample
const sample = await Products
  .find({ seller: orphanId })
  .project({ productName: 1, originalSeller: 1 })
  .limit(3)
  .toArray();
console.log("Sample (3):");
sample.forEach((p) => console.log(`  ${p._id}  "${p.productName}"  originalSeller=${p.originalSeller || "<none>"}`));
console.log();

if (dryRun) {
  console.log(`DRY-RUN: would set originalSeller (where missing) on ${orphanProductCount} products`);
  console.log(`DRY-RUN: would set seller -> ${ADMIN_SELLER_ID} on ${orphanProductCount} products`);
  await mongoose.disconnect();
  process.exit(0);
}

// --- Step 1: preserve originalSeller (only where it isn't already set) ------

const backupRes = await Products.updateMany(
  { seller: orphanId, originalSeller: { $exists: false } },
  [{ $set: { originalSeller: "$seller" } }]
);
console.log(`Backed up originalSeller on ${backupRes.modifiedCount} products (matched ${backupRes.matchedCount}).`);

// --- Step 2: re-point seller ------------------------------------------------

const repointRes = await Products.updateMany(
  { seller: orphanId },
  { $set: { seller: adminId } }
);
console.log(`Re-pointed seller -> Admin on ${repointRes.modifiedCount} products (matched ${repointRes.matchedCount}).`);

// --- Step 3: verify ---------------------------------------------------------

const stillOrphan = await Products.countDocuments({ seller: orphanId });
const nowAdmin    = await Products.countDocuments({ seller: adminId });
const withBackup  = await Products.countDocuments({ originalSeller: orphanId });

console.log("\nPost-update counts:");
console.log(`  products still owned by orphan: ${stillOrphan}  (expected 0)`);
console.log(`  products owned by Admin store:  ${nowAdmin}`);
console.log(`  products with originalSeller=orphan (rollback marker): ${withBackup}`);

if (stillOrphan !== 0) {
  console.error("\nWARNING: some products still reference the orphan seller. Investigate before relying on this fix.");
}

console.log("\nDone.");
await mongoose.disconnect();
