// Show every product of a given seller along with its category/sub-category
// status, so we can tell which filter is hiding it.
//
// Usage:
//   node scripts/inspect-product-category.mjs --seller 69f0...

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

const argv = process.argv.slice(2);
const sellerId = argv[argv.indexOf("--seller") + 1];
if (!sellerId) {
  console.error("Provide --seller <objectId>");
  process.exit(1);
}

await mongoose.connect(MONGODB_URI);
const db = mongoose.connection.db;
const Products = db.collection("products");
const Categories = db.collection("categories");

const products = await Products.find({
  seller: new mongoose.Types.ObjectId(sellerId),
}).toArray();

console.log(`\nFound ${products.length} products for seller ${sellerId}\n`);

for (const p of products) {
  const cat = p.category
    ? await Categories.findOne({ _id: p.category })
    : null;
  const sub = p.subcategory
    ? await Categories.findOne({ _id: p.subcategory })
    : null;
  console.log(`product: ${p.productName} (${p._id})`);
  console.log(`  status:           ${p.status}`);
  console.log(`  publish:          ${p.publish}`);
  console.log(`  isShopByStoreOnly: ${p.isShopByStoreOnly}`);
  console.log(`  headerCategoryId: ${p.headerCategoryId || "<none>"}`);
  console.log(
    `  category:    ${cat ? `${cat.name} [${cat.status}] (${cat._id})` : "<missing>"}`
  );
  console.log(
    `  subcategory: ${sub ? `${sub.name} [${sub.status}] (${sub._id})` : "<none>"}`
  );
  console.log();
}

await mongoose.disconnect();
