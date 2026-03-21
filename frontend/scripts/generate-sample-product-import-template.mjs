/**
 * Generates sample_product_import_template_filled.xlsx — same layout as
 * SellerStockBulkImport handleDownloadTemplate (2-row headers + merges) + demo rows.
 * Run from frontend/: node scripts/generate-sample-product-import-template.mjs
 */
import { createRequire } from "module";
import { writeFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const __dirname = dirname(fileURLToPath(import.meta.url));

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
  "26. Unit Price (Min Qty 2)",
  "27. Unit Price (Min Qty 4)",
  "28. Variations",
  "Image",
  "29. Mfg Date",
  "30. Expiry Date",
];

/** One data row — values align with row2 columns (category name must match an existing category in your app, or leave blank for default). */
function sampleRow(values) {
  const base = new Array(row2.length).fill("");
  values.forEach(([colName, val]) => {
    const i = row2.indexOf(colName);
    if (i >= 0) base[i] = val;
  });
  return base;
}

const dataRows = [
  sampleRow([
    ["1. Category", "Groceries"],
    ["4. Product Name", "Sample Atta 5kg"],
    ["5. SKU", "DEMO-ATTA-5"],
    ["7. Desc", "Whole wheat flour"],
    ["15. Pur. Price", 180],
    ["16. MRP", 220],
    ["17. Sell Price", 199],
    ["19. Stock", 50],
    ["20. Offer Price", 0],
    ["21. Wholesale Price", 185],
    ["22. Low Stock", 5],
  ]),
  sampleRow([
    ["1. Category", "Groceries"],
    ["4. Product Name", "Refined Oil 1L"],
    ["5. SKU", "DEMO-OIL-1L"],
    ["9. HSN", "1517"],
    ["15. Pur. Price", 120],
    ["16. MRP", 165],
    ["17. Sell Price", 149],
    ["19. Stock", 120],
    ["21. Wholesale Price", 135],
    ["22. Low Stock", 10],
  ]),
  sampleRow([
    ["1. Category", "Snacks"],
    ["4. Product Name", "Namkeen Mix 200g"],
    ["5. SKU", "DEMO-NAM-200"],
    ["16. MRP", 80],
    ["17. Sell Price", 72],
    ["19. Stock", 200],
    ["22. Low Stock", 15],
    ["28. Variations", "Pack:200g"],
  ]),
];

const aoa = [row1, row2, ...dataRows];
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

const publicDir = join(__dirname, "..", "public");
mkdirSync(publicDir, { recursive: true });
const outPath = join(publicDir, "sample_product_import_template_filled.xlsx");
writeFileSync(outPath, XLSX.write(wb, { bookType: "xlsx", type: "buffer" }));
console.log("Wrote:", outPath);
