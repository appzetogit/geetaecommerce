// Diagnostic script: explains why fewer products appear under each Header Category
// than the "true" set of products that *should* belong to it.
//
// Run from backend/:  node scripts/diagnose-header-category-products.mjs
//
// Reads MONGODB_URI from .env. Read-only — no writes.

import mongoose from "mongoose";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envText = readFileSync(resolve(__dirname, "../.env"), "utf8");
const envLine = envText
  .split(/\r?\n/)
  .find((l) => l.trim().startsWith("MONGODB_URI="));
if (!envLine) {
  console.error("MONGODB_URI not found in .env");
  process.exit(1);
}
const MONGODB_URI = envLine.replace(/^MONGODB_URI=/, "").trim();

await mongoose.connect(MONGODB_URI);
const db = mongoose.connection.db;

const HeaderCategory = db.collection("headercategories");
const Category = db.collection("categories");
const Product = db.collection("products");
const Seller = db.collection("sellers");

const headers = await HeaderCategory.find({}).project({ name: 1, slug: 1, status: 1 }).toArray();
console.log(`\n== ${headers.length} header categories ==\n`);

// Helper: full descendant tree (no status filter) — mirrors current controller.
async function getHeaderCategoryTreeIdsAll(headerCategoryId) {
  const out = [];
  const seen = new Set();
  let frontier = await Category.find({ headerCategoryId }).project({ _id: 1 }).toArray();
  let ids = frontier.map((c) => c._id);
  while (ids.length) {
    const fresh = ids.filter((id) => !seen.has(String(id)) && seen.add(String(id)));
    if (!fresh.length) break;
    out.push(...fresh);
    const next = await Category.find({ parentId: { $in: fresh } }).project({ _id: 1 }).toArray();
    ids = next.map((c) => c._id);
  }
  return out;
}

// Pre-compute the "visible seller" set used by the customer endpoint.
const visibleSellers = await Seller.find({
  isEnabled: true,
  $or: [
    { email: /admin/i },
    { category: "Admin" },
    { storeName: { $regex: /Admin/i } },
    { canCreateCategories: { $ne: true } },
  ],
}).project({ _id: 1, storeName: 1, isEnabled: 1, canCreateCategories: 1, status: 1 }).toArray();
const visibleSellerIds = visibleSellers.map((s) => s._id);
console.log(`Visible sellers (customer query): ${visibleSellers.length}`);

const activeCategories = await Category.find({ status: "Active" }).project({ _id: 1 }).toArray();
const activeCategoryIds = activeCategories.map((c) => c._id);
const activeCategoryIdSet = new Set(activeCategoryIds.map(String));
console.log(`Active categories: ${activeCategories.length} (of ${await Category.estimatedDocumentCount()} total)\n`);

let totalProducts = await Product.estimatedDocumentCount();
console.log(`Total products in DB: ${totalProducts}\n`);

for (const h of headers) {
  console.log(`\n--- HEADER: "${h.name}" (slug=${h.slug}, status=${h.status}) ---`);

  // (A) All categories in this header's tree (ignoring status).
  const treeIds = await getHeaderCategoryTreeIdsAll(h._id);
  console.log(`Categories in tree (any status): ${treeIds.length}`);

  // (B) "True" candidate products — anything that *should* belong to this header.
  const candidateQuery = {
    $or: [
      { headerCategoryId: h._id },
      { category: { $in: treeIds } },
      { subcategory: { $in: treeIds } },
    ],
  };
  const candidateCount = await Product.countDocuments(candidateQuery);
  console.log(`Candidate products (any status/seller/publish): ${candidateCount}`);

  // (C) Apply outer customer-side filters one-by-one to see where products drop off.
  const stages = [
    { label: "+ status:Active",            extra: { status: "Active" } },
    { label: "+ publish:true",             extra: { publish: true } },
    { label: "+ category in ACTIVE cats",  extra: { category: { $in: activeCategoryIds } } },
    { label: "+ seller in visible set",    extra: { seller: { $in: visibleSellerIds } } },
    { label: "+ NOT shopByStoreOnly",      extra: { $or: [ { isShopByStoreOnly: { $ne: true } }, { isShopByStoreOnly: { $exists: false } } ] } },
  ];
  let accum = { ...candidateQuery };
  for (const s of stages) {
    accum = { $and: [accum, s.extra] };
    const c = await Product.countDocuments(accum);
    console.log(`  ${s.label.padEnd(32)} -> ${c}`);
  }

  // (D) Drill-down: among candidates, how many have headerCategoryId NOT set?
  const missingHeader = await Product.countDocuments({
    ...candidateQuery,
    $or: [{ headerCategoryId: { $exists: false } }, { headerCategoryId: null }],
  });
  console.log(`  Candidates with NO headerCategoryId set: ${missingHeader}`);

  // (E) Candidates whose `category` is INACTIVE (dropped by the outer activeCategoryIds filter).
  const inactiveCatDrop = await Product.countDocuments({
    ...candidateQuery,
    category: { $nin: activeCategoryIds },
  });
  console.log(`  Candidates whose category is INACTIVE: ${inactiveCatDrop}`);

  // (F) Candidates dropped by seller visibility.
  const sellerDrop = await Product.countDocuments({
    ...candidateQuery,
    seller: { $nin: visibleSellerIds },
  });
  console.log(`  Candidates dropped by seller-visibility: ${sellerDrop}`);

  // (G) Candidates dropped by status / publish.
  const statusDrop = await Product.countDocuments({
    ...candidateQuery,
    $or: [{ status: { $ne: "Active" } }, { publish: { $ne: true } }],
  });
  console.log(`  Candidates dropped by status!=Active OR publish!=true: ${statusDrop}`);

  // (H) Candidates that are isShopByStoreOnly:true.
  const sbsDrop = await Product.countDocuments({
    ...candidateQuery,
    isShopByStoreOnly: true,
  });
  console.log(`  Candidates dropped by isShopByStoreOnly:true: ${sbsDrop}`);
}

console.log("\nDone.");
await mongoose.disconnect();
