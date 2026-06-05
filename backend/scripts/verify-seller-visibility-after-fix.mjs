// Verifies the customer-side seller visibility AFTER the canCreateCategories
// removal. Lists every seller, whether they're enabled, and counts their
// products that would now reach customers.

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
const Sellers = db.collection("sellers");
const Products = db.collection("products");
const Categories = db.collection("categories");

const sellers = await Sellers.find(
  {},
  { projection: { storeName: 1, email: 1, status: 1, isEnabled: 1, serviceRadiusKm: 1, location: 1 } }
).toArray();

const activeCategoryIds = (
  await Categories.find({ status: "Active" }).project({ _id: 1 }).toArray()
).map((c) => c._id);

let totalVisibleProducts = 0;
let visibleSellerCount = 0;
const rows = [];

for (const s of sellers) {
  const passes = s.isEnabled === true;
  const visibleProducts = passes
    ? await Products.countDocuments({
        seller: s._id,
        status: "Active",
        publish: true,
        category: { $in: activeCategoryIds },
        $or: [
          { isShopByStoreOnly: { $ne: true } },
          { isShopByStoreOnly: { $exists: false } },
        ],
      })
    : 0;
  if (passes) {
    visibleSellerCount += 1;
    totalVisibleProducts += visibleProducts;
  }
  rows.push({
    storeName: s.storeName || "(no name)",
    status: s.status || "",
    isEnabled: s.isEnabled,
    passes,
    visibleProducts,
  });
}

rows.sort((a, b) => b.visibleProducts - a.visibleProducts);

console.log(
  `\n${"storeName".padEnd(32)} status      enabled  passes?  visibleProducts`
);
console.log("-".repeat(85));
for (const r of rows) {
  console.log(
    `${r.storeName.slice(0, 32).padEnd(32)} ${String(r.status).padEnd(11)} ${String(r.isEnabled).padEnd(7)}  ${String(r.passes).padEnd(7)}  ${r.visibleProducts}`
  );
}

console.log(
  `\nSellers now visible to customers: ${visibleSellerCount} / ${sellers.length}`
);
console.log(`Total products now reachable on storefront: ${totalVisibleProducts}`);

await mongoose.disconnect();
