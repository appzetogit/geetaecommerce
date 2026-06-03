// Confirm the missing-seller hypothesis and look at orphan product samples.
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

const orphanId = new mongoose.Types.ObjectId("698ad58d766e75a17731791c");

const sellerExists = await db.collection("sellers").findOne({ _id: orphanId });
console.log("Seller 698ad58d766e75a17731791c exists?:", Boolean(sellerExists));

// Try alternate collection names just in case
const collections = await db.listCollections().toArray();
console.log("\nCollections that contain 'seller' or 'store':");
collections
  .filter((c) => /seller|store/i.test(c.name))
  .forEach((c) => console.log("  -", c.name));

// Maybe in a different collection?
for (const c of collections.filter((c) => /seller|store/i.test(c.name))) {
  const hit = await db.collection(c.name).findOne({ _id: orphanId });
  if (hit) {
    console.log(`  FOUND in '${c.name}':`, JSON.stringify(hit, null, 2).slice(0, 500));
  }
}

// Sample products belonging to the orphan seller.
const sample = await db
  .collection("products")
  .find({ seller: orphanId })
  .project({ productName: 1, status: 1, publish: 1, headerCategoryId: 1, category: 1, createdAt: 1 })
  .sort({ createdAt: 1 })
  .limit(3)
  .toArray();
console.log("\nOldest 3 products owned by orphan seller:");
sample.forEach((p) =>
  console.log(`  ${p._id}  "${p.productName}"  status=${p.status}  publish=${p.publish}  hdrCat=${p.headerCategoryId}  cat=${p.category}  created=${p.createdAt}`)
);

const newest = await db
  .collection("products")
  .find({ seller: orphanId })
  .project({ productName: 1, createdAt: 1 })
  .sort({ createdAt: -1 })
  .limit(3)
  .toArray();
console.log("Newest 3 products owned by orphan seller:");
newest.forEach((p) => console.log(`  ${p._id}  "${p.productName}"  created=${p.createdAt}`));

// All sellers that actually have products
const sellersWithProducts = await db
  .collection("products")
  .aggregate([{ $group: { _id: "$seller", c: { $sum: 1 } } }, { $sort: { c: -1 } }])
  .toArray();
console.log(`\nAll unique seller IDs referenced by products (${sellersWithProducts.length}):`);
sellersWithProducts.forEach((r) => console.log(`  ${r._id}  -> ${r.c} products`));

await mongoose.disconnect();
