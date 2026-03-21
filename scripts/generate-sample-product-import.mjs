/**
 * Generates sample_product_import_filled.xlsx — same layout as Seller → Bulk Import → Excel Format.
 * Run from repo root: node scripts/generate-sample-product-import.mjs
 */
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const XLSX = require(join(__dirname, "../frontend/node_modules/xlsx"));

const stdCols = [
  "1. Category",
  "2. Sub Cat",
  "3. Sub Sub Cat",
  "4. Product Name",
  "5. SKU",
  "6. Rack",
  "7. Desc",
  "8. Barcode",
  "9. HSN",
  "10. Unit",
  "11. Size",
  "12. Color",
  "13. Tax Cat",
  "14. GST",
  "15. Pur. Price",
  "16. MRP",
  "17. Sell Price",
  "18. Del. Time",
  "19. Stock",
  "20. Offer Price",
  "21. Wholesale Price",
  "22. Low Stock",
  "23. Brand",
  "24. Val (MRP)",
  "25. Val (Pur)",
];

const row1 = [
  ...stdCols,
  "Unit Pricing Rules",
  "",
  "28. Variations",
  "Image",
  "29. Mfg Date",
  "30. Expiry Date",
];

const row2 = [
  ...stdCols,
  "Price (Min Qty 2)",
  "Price (Min Qty 4)",
  "28. Variations",
  "Image",
  "29. Mfg Date",
  "30. Expiry Date",
];

/** One data row: 31 columns — category name must exist in your app (change if needed). */
function dataRow(values) {
  const {
    category = "Groceries",
    subCat = "",
    subSub = "",
    productName,
    sku,
    rack = "R1",
    desc,
    barcode = "",
    hsn = "0406",
    unit = "PCS",
    size = "",
    color = "",
    taxCat = "",
    gst = "5",
    purPrice = 70,
    mrp = 100,
    sellPrice = 95,
    delTime = "1 Day",
    stock = 50,
    offerPrice = "",
    wholesale = 85,
    lowStock = 5,
    brand = "",
    valMrp = "",
    valPur = "",
    priceMin2 = "",
    priceMin4 = "",
    variations = "",
    image = "",
    mfg = "",
    expiry = "",
  } = values;

  return [
    category,
    subCat,
    subSub,
    productName,
    sku,
    rack,
    desc,
    barcode,
    hsn,
    unit,
    size,
    color,
    taxCat,
    gst,
    purPrice,
    mrp,
    sellPrice,
    delTime,
    stock,
    offerPrice,
    wholesale,
    lowStock,
    brand,
    valMrp,
    valPur,
    priceMin2,
    priceMin4,
    variations,
    image,
    mfg,
    expiry,
  ];
}

const sampleRows = [
  dataRow({
    productName: "Sample Tomato 1kg",
    sku: "DEMO-TOM-001",
    desc: "Demo import row — tomato",
    mrp: 80,
    sellPrice: 75,
    stock: 42,
    wholesale: 68,
  }),
  dataRow({
    productName: "Sample Potato 500g",
    sku: "DEMO-POT-002",
    desc: "Demo import row — potato",
    mrp: 45,
    sellPrice: 40,
    stock: 100,
    wholesale: 36,
  }),
  dataRow({
    productName: "Sample Cooking Oil 1L",
    sku: "DEMO-OIL-003",
    desc: "Demo import row — oil",
    hsn: "1514",
    mrp: 220,
    sellPrice: 199,
    stock: 30,
    wholesale: 185,
  }),
];

const aoa = [row1, row2, ...sampleRows];

const ws = XLSX.utils.aoa_to_sheet(aoa);

const merges = [];
for (let i = 0; i < stdCols.length; i++) {
  merges.push({ s: { r: 0, c: i }, e: { r: 1, c: i } });
}
merges.push({ s: { r: 0, c: 27 }, e: { r: 1, c: 27 } });
merges.push({ s: { r: 0, c: 28 }, e: { r: 1, c: 28 } });
merges.push({ s: { r: 0, c: 29 }, e: { r: 1, c: 29 } });
merges.push({ s: { r: 0, c: 30 }, e: { r: 1, c: 30 } });
merges.push({ s: { r: 0, c: 25 }, e: { r: 0, c: 26 } });

ws["!merges"] = merges;

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Product Template");

const outPath = join(__dirname, "..", "docs", "sample_product_import_filled.xlsx");
writeFileSync(outPath, XLSX.write(wb, { bookType: "xlsx", type: "buffer" }));

console.log("Wrote:", outPath);
