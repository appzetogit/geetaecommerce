// Why do so few sellers pass the customer-side "visible seller" filter?
// Read-only diagnostic.

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

await mongoose.connect(MONGODB_URI);
const db = mongoose.connection.db;
const Seller = db.collection("sellers");
const Product = db.collection("products");

const total = await Seller.estimatedDocumentCount();
const enabled = await Seller.countDocuments({ isEnabled: true });
const approved = await Seller.countDocuments({ status: "Approved" });
const enabledAndApproved = await Seller.countDocuments({ isEnabled: true, status: "Approved" });
const canCreateTrue = await Seller.countDocuments({ canCreateCategories: true });
const canCreateFalse = await Seller.countDocuments({ canCreateCategories: { $ne: true } });

console.log("== Seller breakdown ==");
console.log("  total:                 ", total);
console.log("  isEnabled:true:        ", enabled);
console.log("  status:Approved:       ", approved);
console.log("  enabled & approved:    ", enabledAndApproved);
console.log("  canCreateCategories T: ", canCreateTrue);
console.log("  canCreateCategories !T:", canCreateFalse);

// The exact filter used by the customer endpoint:
const visibleQuery = {
  isEnabled: true,
  $or: [
    { email: /admin/i },
    { category: "Admin" },
    { storeName: { $regex: /Admin/i } },
    { canCreateCategories: { $ne: true } },
  ],
};
const visibleSellers = await Seller.find(visibleQuery)
  .project({ storeName: 1, email: 1, category: 1, canCreateCategories: 1, isEnabled: 1, status: 1 })
  .toArray();
console.log("\n== Visible sellers (customer-side filter) ==");
visibleSellers.forEach((s) =>
  console.log(`  ${String(s._id)}  storeName="${s.storeName}"  email="${s.email}"  canCreate=${s.canCreateCategories}  enabled=${s.isEnabled}  status=${s.status}`)
);

// Sellers that own products but are HIDDEN by the visibility filter.
const visibleIds = visibleSellers.map((s) => s._id);
const sellersWithProducts = await Product.aggregate([
  { $group: { _id: "$seller", productCount: { $sum: 1 } } },
  { $sort: { productCount: -1 } },
]).toArray();

const hiddenSellersWithProducts = sellersWithProducts.filter(
  (row) => row._id && !visibleIds.some((v) => String(v) === String(row._id))
);

console.log(`\n== Top hidden sellers (would-be product owners filtered out) ==`);
const topHidden = hiddenSellersWithProducts.slice(0, 15);
const hiddenIds = topHidden.map((r) => r._id);
const hiddenDocs = await Seller.find({ _id: { $in: hiddenIds } })
  .project({ storeName: 1, email: 1, category: 1, canCreateCategories: 1, isEnabled: 1, status: 1 })
  .toArray();
const hiddenMap = new Map(hiddenDocs.map((d) => [String(d._id), d]));
for (const row of topHidden) {
  const s = hiddenMap.get(String(row._id));
  if (!s) {
    console.log(`  ${String(row._id)}  products=${row.productCount}  <SELLER DOC MISSING>`);
    continue;
  }
  console.log(
    `  ${String(row._id)}  products=${row.productCount.toString().padStart(5)}  storeName="${s.storeName}"  email="${s.email || ""}"  canCreate=${s.canCreateCategories}  enabled=${s.isEnabled}  status=${s.status}`
  );
}

console.log("\nDone.");
await mongoose.disconnect();
