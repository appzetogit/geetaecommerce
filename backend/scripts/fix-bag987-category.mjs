// One-off data fix: re-point New Shop's "Bag987" product to a real category.
//
// The product (6a224f884a55da3ad35e9617) currently references category
// 6a224ecf4a55da3ad35e95d3, which has been deleted. The customer-side query
// filters on `category ∈ activeCategoryIds`, so the product is invisible
// until we point it at an existing Active Category.
//
// Strategy:
//   1. Look for an Active "Bag(s)" category (best semantic match for "Bag987").
//   2. Otherwise, look for an Active "Stationary"/"Stationery" category.
//   3. Otherwise, list candidates and exit so we can pick one manually.
//
// Always run with --dry-run first.
//
// Usage:
//   node scripts/fix-bag987-category.mjs --dry-run
//   node scripts/fix-bag987-category.mjs

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

const dryRun = process.argv.includes("--dry-run");

const PRODUCT_ID = "6a224f884a55da3ad35e9617";

await mongoose.connect(MONGODB_URI);
const db = mongoose.connection.db;
const Products = db.collection("products");
const Categories = db.collection("categories");

console.log(`Mode: ${dryRun ? "DRY-RUN" : "LIVE"}\n`);

const product = await Products.findOne({
  _id: new mongoose.Types.ObjectId(PRODUCT_ID),
});
if (!product) {
  console.error(`Product ${PRODUCT_ID} not found.`);
  process.exit(1);
}

console.log(`Product: "${product.productName}" (${product._id})`);
console.log(`  current category ref: ${product.category}`);
const currentCat = product.category
  ? await Categories.findOne({ _id: product.category })
  : null;
console.log(`  current category doc: ${currentCat ? `${currentCat.name} [${currentCat.status}]` : "<missing>"}`);
console.log();

// --- Pick a destination category -------------------------------------------
const bagMatches = await Categories.find({
  status: "Active",
  name: { $regex: /^bag/i },
})
  .project({ name: 1, parentId: 1 })
  .toArray();

const stationaryMatches = await Categories.find({
  status: "Active",
  name: { $regex: /station/i },
})
  .project({ name: 1, parentId: 1 })
  .toArray();

console.log("Bag-matching active categories:");
bagMatches.forEach((c) => console.log(`  ${c._id}  ${c.name}  (parent: ${c.parentId || "<root>"})`));
console.log("\nStationary-matching active categories:");
stationaryMatches.forEach((c) => console.log(`  ${c._id}  ${c.name}  (parent: ${c.parentId || "<root>"})`));
console.log();

// Prefer a Bag category (best literal match for "Bag987"); fall back to a
// Stationary category if no Bag category exists.
let pick = bagMatches[0] || stationaryMatches[0] || null;

if (!pick) {
  console.error(
    "No Bag/Stationary active category found. Aborting — please reassign manually via the seller portal."
  );
  await mongoose.disconnect();
  process.exit(1);
}

console.log(`Chosen destination: ${pick.name} (${pick._id})`);

if (dryRun) {
  console.log("\nDRY-RUN: would set product.category to that destination. No write performed.");
  await mongoose.disconnect();
  process.exit(0);
}

// --- Apply -----------------------------------------------------------------
const res = await Products.updateOne(
  { _id: new mongoose.Types.ObjectId(PRODUCT_ID) },
  {
    $set: {
      category: pick._id,
      // Preserve the previous (broken) reference so we can audit if needed.
      originalCategory: product.category,
    },
  }
);
console.log(`\nUpdated ${res.modifiedCount} product (matched ${res.matchedCount}).`);

// --- Verify ----------------------------------------------------------------
const after = await Products.findOne({
  _id: new mongoose.Types.ObjectId(PRODUCT_ID),
});
const afterCat = await Categories.findOne({ _id: after.category });
console.log(`Post-update category: ${afterCat ? `${afterCat.name} [${afterCat.status}]` : "<missing>"}`);

await mongoose.disconnect();
