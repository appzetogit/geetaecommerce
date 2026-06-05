// Explain why a specific seller's products are (or aren't) visible to customers.
//
// Runs every stage of the customer-side product query against ONE seller, then
// (optionally) against ONE customer coordinate, and prints which filters
// pass/fail. Use this whenever a seller reports "my store is inside the
// service radius but the customer can't see my products".
//
// Usage:
//   node scripts/diagnose-seller-visibility.mjs --store "New Shop"
//   node scripts/diagnose-seller-visibility.mjs --id 6655...c1
//   node scripts/diagnose-seller-visibility.mjs --email seller@x.com
//   node scripts/diagnose-seller-visibility.mjs --store "New Shop" --customer 22.71,75.85

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
const getArg = (flag) => {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : null;
};

const storeArg = getArg("--store");
const idArg = getArg("--id");
const emailArg = getArg("--email");
const customerArg = getArg("--customer"); // "lat,lng"

if (!storeArg && !idArg && !emailArg) {
  console.error("Provide one of --store, --id, --email");
  process.exit(1);
}

await mongoose.connect(MONGODB_URI);
const db = mongoose.connection.db;
const Sellers = db.collection("sellers");
const Products = db.collection("products");
const Categories = db.collection("categories");

// ---------------------------------------------------------------------------
// 1) Locate the seller
// ---------------------------------------------------------------------------
const sellerQuery = idArg
  ? { _id: new mongoose.Types.ObjectId(idArg) }
  : emailArg
  ? { email: emailArg }
  : { storeName: { $regex: new RegExp(`^${storeArg}$`, "i") } };

const candidates = await Sellers.find(sellerQuery).toArray();
if (candidates.length === 0) {
  console.error("No seller matched", sellerQuery);
  await mongoose.disconnect();
  process.exit(1);
}
if (candidates.length > 1) {
  console.log(`Multiple matches (${candidates.length}); listing all:`);
  candidates.forEach((s) =>
    console.log(`  ${s._id}  storeName="${s.storeName}"  email="${s.email}"`)
  );
}
const seller = candidates[0];

console.log("\n=== Seller ===");
console.log(`_id:                  ${seller._id}`);
console.log(`storeName:            ${seller.storeName}`);
console.log(`email:                ${seller.email}`);
console.log(`category:             ${seller.category}`);
console.log(`status:               ${seller.status}`);
console.log(`isEnabled:            ${seller.isEnabled}`);
console.log(`canCreateCategories:  ${seller.canCreateCategories}`);
console.log(`serviceRadiusKm:      ${seller.serviceRadiusKm}`);
console.log(`location:             ${JSON.stringify(seller.location)}`);
console.log(`latitude/longitude:   ${seller.latitude} / ${seller.longitude}`);

// ---------------------------------------------------------------------------
// 2) Apply each customer-side filter
// ---------------------------------------------------------------------------

const isAdminLike =
  /admin/i.test(seller.email || "") ||
  seller.category === "Admin" ||
  /Admin/i.test(seller.storeName || "");

const passesVisibility =
  seller.isEnabled === true &&
  (isAdminLike || seller.canCreateCategories !== true);

const passesApproved = seller.status === "Approved";

console.log("\n=== Customer-side filters ===");
console.log(`isAdminLike:                            ${isAdminLike}`);
console.log(`passes getVisibleSellersQuery():        ${passesVisibility}`);
console.log(`passes findSellersWithinRange status:   ${passesApproved}`);

if (!passesVisibility) {
  console.log("  REASON: not enabled, or canCreateCategories === true and not an admin store.");
}
if (!passesApproved) {
  console.log("  REASON: seller.status is not 'Approved' (radius lookup skips them).");
}

// ---------------------------------------------------------------------------
// 3) Radius check against an optional customer coordinate
// ---------------------------------------------------------------------------
if (customerArg) {
  const [latStr, lngStr] = customerArg.split(",");
  const userLat = parseFloat(latStr);
  const userLng = parseFloat(lngStr);
  if (!isNaN(userLat) && !isNaN(userLng) && seller.location?.coordinates) {
    const [sellerLng, sellerLat] = seller.location.coordinates;
    const R = 6371;
    const dLat = ((sellerLat - userLat) * Math.PI) / 180;
    const dLon = ((sellerLng - userLng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((userLat * Math.PI) / 180) *
        Math.cos((sellerLat * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const radius = seller.serviceRadiusKm || 10;
    console.log(`\n=== Radius check (customer ${userLat},${userLng}) ===`);
    console.log(`distance:        ${distance.toFixed(3)} km`);
    console.log(`serviceRadius:   ${radius} km`);
    console.log(`inRange:         ${distance <= radius}`);
  } else {
    console.log("\nCustomer coordinate provided but seller.location.coordinates missing.");
  }
}

// ---------------------------------------------------------------------------
// 4) Product counts at each stage for THIS seller
// ---------------------------------------------------------------------------
const sellerId = seller._id;

const totalProducts = await Products.countDocuments({ seller: sellerId });
const statusActive = await Products.countDocuments({
  seller: sellerId,
  status: "Active",
});
const published = await Products.countDocuments({
  seller: sellerId,
  status: "Active",
  publish: true,
});
const notShopOnly = await Products.countDocuments({
  seller: sellerId,
  status: "Active",
  publish: true,
  $or: [
    { isShopByStoreOnly: { $ne: true } },
    { isShopByStoreOnly: { $exists: false } },
  ],
});

const activeCategoryIds = (
  await Categories.find({ status: "Active" }).project({ _id: 1 }).toArray()
).map((c) => c._id);

const inActiveCategory = await Products.countDocuments({
  seller: sellerId,
  status: "Active",
  publish: true,
  $or: [
    { isShopByStoreOnly: { $ne: true } },
    { isShopByStoreOnly: { $exists: false } },
  ],
  category: { $in: activeCategoryIds },
});

console.log("\n=== Products owned by this seller ===");
console.log(`total products:                    ${totalProducts}`);
console.log(`+ status === "Active":             ${statusActive}`);
console.log(`+ publish === true:                ${published}`);
console.log(`+ not isShopByStoreOnly:           ${notShopOnly}`);
console.log(`+ category is currently Active:    ${inActiveCategory}`);

if (passesVisibility) {
  console.log(`\nVerdict: seller PASSES the visibility filter — customer should see ${inActiveCategory} products (subject to range).`);
} else {
  console.log(
    `\nVerdict: seller FAILS the visibility filter — ALL ${inActiveCategory} products are hidden on the customer side regardless of radius.`
  );
  console.log("Fix options:");
  console.log("  1) Toggle 'Can Create Categories' OFF for this seller in Admin Seller settings.");
  console.log("  2) Or change the customer-side filter to stop using canCreateCategories as a visibility gate.");
}

await mongoose.disconnect();
