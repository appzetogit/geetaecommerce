// Lists every non-admin seller with the flags that affect customer visibility.
// Helps spot sellers whose products are hidden purely because of the
// `canCreateCategories` / `status` filters.
//
// Usage:
//   node scripts/list-sellers-visibility.mjs

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

const sellers = await Sellers.find(
  {},
  { projection: { storeName: 1, email: 1, category: 1, status: 1, isEnabled: 1, canCreateCategories: 1, serviceRadiusKm: 1, location: 1 } }
).toArray();

const rows = [];
for (const s of sellers) {
  const isAdminLike =
    /admin/i.test(s.email || "") ||
    s.category === "Admin" ||
    /Admin/i.test(s.storeName || "");
  const passesVisibility =
    s.isEnabled === true && (isAdminLike || s.canCreateCategories !== true);
  const productCount = await Products.countDocuments({ seller: s._id });
  rows.push({
    id: String(s._id),
    storeName: s.storeName || "",
    email: s.email || "",
    status: s.status || "",
    isEnabled: s.isEnabled,
    canCreateCategories: s.canCreateCategories,
    radius: s.serviceRadiusKm,
    hasLocation: !!(s.location && s.location.coordinates),
    isAdminLike,
    passesVisibility,
    productCount,
  });
}

rows.sort((a, b) => b.productCount - a.productCount);

console.log(
  `\n${"id".padEnd(26)} ${"storeName".padEnd(28)} status      enabled  canCreate  admin?  passes?  loc?  products`
);
console.log("-".repeat(140));
for (const r of rows) {
  console.log(
    `${r.id.padEnd(26)} ${r.storeName.slice(0, 28).padEnd(28)} ${String(r.status).padEnd(11)} ${String(r.isEnabled).padEnd(7)}  ${String(r.canCreateCategories).padEnd(9)}  ${String(r.isAdminLike).padEnd(6)}  ${String(r.passesVisibility).padEnd(7)}  ${r.hasLocation ? "yes " : "no  "}  ${r.productCount}`
  );
}

const blockedWithProducts = rows.filter((r) => !r.passesVisibility && r.productCount > 0);
console.log(
  `\nSellers BLOCKED by visibility filter that own products: ${blockedWithProducts.length}`
);
const blockedProductTotal = blockedWithProducts.reduce((sum, r) => sum + r.productCount, 0);
console.log(`Total hidden products from these sellers: ${blockedProductTotal}`);

await mongoose.disconnect();
