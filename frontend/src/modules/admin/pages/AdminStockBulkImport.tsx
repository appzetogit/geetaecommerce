import React, { useState, useRef } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import {
  Category,
  CreateProductData,
  createProduct,
} from "../../../services/api/admin/adminProductService";
import { useAuth } from "../../../context/AuthContext";

interface AdminStockBulkImportProps {
  categories: Category[];
  onClose: () => void;
  onSuccess: () => void;
}

function normalizeHeaderKey(k: string): string {
  return String(k)
    .replace(/^\uFEFF/, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "_")
    .replace(/_+/g, "_");
}

function normalizeExcelRow(row: Record<string, unknown>): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...row };
  for (const [k, v] of Object.entries(row)) {
    const nk = normalizeHeaderKey(k);
    if (nk && !(nk in merged)) merged[nk] = v;
  }
  return merged;
}

function rowCell(row: Record<string, unknown>, keys: string[]): string | undefined {
  const pick = (v: unknown) => {
    if (v === undefined || v === null) return undefined;
    if (typeof v === "number" && !Number.isNaN(v)) {
      const s = String(v);
      // Avoid Excel/JS scientific notation (e.g. 1.23e+15) for IDs like SKU/Barcode.
      if (/[eE][+-]?\d+/.test(s)) return XLSX.SSF.format("0", v);
      return s;
    }
    const s = String(v).trim();
    return s !== "" ? s : undefined;
  };
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      const got = pick(row[key]);
      if (got !== undefined) return got;
    }
  }
  const normalizedWants = new Set(keys.map((w) => normalizeHeaderKey(w)));
  for (const rk of Object.keys(row)) {
    if (normalizedWants.has(normalizeHeaderKey(rk))) {
      const got = pick(row[rk]);
      if (got !== undefined) return got;
    }
  }
  return undefined;
}

function safeNonNegativeNumber(n: unknown, fallback = 0): number {
  const x = typeof n === "number" ? n : parseFloat(String(n ?? ""));
  if (!Number.isFinite(x) || Number.isNaN(x) || x < 0) return fallback;
  return x;
}

function normalizeImportKeyPart(v: unknown): string {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s || s === "0" || s === "-" || s === "--" || s === "na" || s === "n/a") {
    return "";
  }
  return s;
}

function rowSignature(row: Record<string, unknown>): string {
  const parts = Object.keys(row)
    .sort((a, b) => a.localeCompare(b))
    .map((k) => `${normalizeHeaderKey(k)}=${normalizeImportKeyPart(row[k])}`);
  return parts.join("|");
}

export default function AdminStockBulkImport({
  categories,
  onClose,
  onSuccess,
}: AdminStockBulkImportProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ total: 0, current: 0, success: 0, failed: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadInFlightRef = useRef(false);
  const { user } = useAuth(); // To get seller ID if needed, but admin creates for default admin store usually

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      readExcel(selectedFile);
    }
  };

  const readExcel = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result;
      const workbook = XLSX.read(data, { type: "binary" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      // Initial parse to check header structure
      let json = XLSX.utils.sheet_to_json<any>(sheet);

      // Check if it's the new 2-row header template
      // In the new template, Row 1 (index 0) has "Unit Pricing Rules", Row 2 has "Price (Min Qty 2)"
      // sheet_to_json with default options uses Row 1 as keys.
      // So json[0] would map Row 1 Keys to Row 2 Values.
      // If we see the value "Price (Min Qty 2)" in the column roughly corresponding to Unit Pricing, we know to skip.

      // Let's check if the first row of data looks like headers
      if (json.length > 0) {
        const firstRow = json[0];
        const values = Object.values(firstRow);
        const twoRowMarkers = new Set([
          "Price (Min Qty 2)",
          "Price (Min Qty 4)",
          "26. Unit Price (Min Qty 2)",
          "27. Unit Price (Min Qty 4)",
          "Unit Price (Min Qty 2)",
          "Unit Price (Min Qty 4)",
        ]);
        const hit = values.some((v) => {
          if (v == null) return false;
          return twoRowMarkers.has(String(v).trim());
        });
        if (hit) {
          json = XLSX.utils.sheet_to_json(sheet, { range: 1 });
        }
      }

      setPreviewData(json);
    };
    reader.readAsBinaryString(file);
  };

  const mapRowToProduct = (row: Record<string, unknown>): Partial<CreateProductData> => {
    const findCategory = (name: string) =>
      categories.find((c) => c.name?.toLowerCase() === name?.toLowerCase())?._id || "";

    const variations: { name: string; value: string }[] = [];
    const sizeVal = rowCell(row, ["Size", "11. Size"]);
    const colorVal = rowCell(row, ["Color", "12. Color"]);
    if (sizeVal) variations.push({ name: "Size", value: sizeVal });
    if (colorVal) variations.push({ name: "Color", value: colorVal });

    const rawVars = rowCell(row, ["Variations", "28. Variations"]);
    if (rawVars) {
      String(rawVars)
        .split(";")
        .forEach((v) => {
          const [name, val] = v.split(":").map((s) => s.trim());
          if (name && val) variations.push({ name, value: val });
        });
    }

    let unitPricing: { minQty: number; price: number }[] = [];
    try {
      const priceFor2 = safeNonNegativeNumber(
        rowCell(row, [
          "26. Unit Price (Min Qty 2)",
          "Unit Price (Min Qty 2)",
          "26. Price (Min Qty 2)",
          "27. Price (Min Qty 2)",
          "Price (Min Qty 2)",
        ]),
        0
      );
      const priceFor4 = safeNonNegativeNumber(
        rowCell(row, [
          "27. Unit Price (Min Qty 4)",
          "Unit Price (Min Qty 4)",
          "27. Price (Min Qty 4)",
          "28. Price (Min Qty 4)",
          "Price (Min Qty 4)",
        ]),
        0
      );
      if (priceFor2 > 0) unitPricing.push({ minQty: 2, price: priceFor2 });
      if (priceFor4 > 0) unitPricing.push({ minQty: 4, price: priceFor4 });
    } catch {
      console.warn("Failed to parse unit pricing for row", row);
    }

    const productName = rowCell(row, ["Product Name", "4. Product Name"]) || "";
    const categoryName = rowCell(row, ["Category", "1. Category"]) || "";
    const skuRaw = rowCell(row, ["SKU", "5. SKU"]) || "";
    const sku = skuRaw === "0" ? "" : skuRaw;
    const price = safeNonNegativeNumber(
      rowCell(row, ["Sell Price", "17. Sell Price", "Selling Price", "Price"]),
      0
    );
    const mrp = safeNonNegativeNumber(rowCell(row, ["MRP", "16. MRP"]), 0);
    const stock = Math.floor(
      safeNonNegativeNumber(rowCell(row, ["Stock", "19. Stock"]), 0)
    );
    const barcodeRaw = rowCell(row, ["Barcode", "8. Barcode"]) || "";
    const barcodeStr = String(barcodeRaw).trim();
    const isScientific = /^[+-]?\d+(?:\.\d+)?[eE][+-]?\d+$/.test(barcodeStr);
    const barcodeParts = isScientific ? [barcodeStr] : barcodeStr.split(/[+,;|\n]+/g);
    const barcodes = barcodeParts
      .map((b) => b.trim())
      .filter((b) => {
        if (!b) return false;
        const bl = b.toLowerCase();
        return b !== "-" && b !== "--" && bl !== "na" && bl !== "n/a";
      });
    const uniqueBarcodes = Array.from(new Set(barcodes));

    return {
      category: findCategory(categoryName),
      subcategory: rowCell(row, ["Sub Cat", "2. Sub Cat"]) || "",
      subSubCategory: rowCell(row, ["Sub Sub Cat", "3. Sub Sub Cat"]) || "",
      productName,
      sku: sku || undefined,
      itemCode: sku || undefined,
      rackNumber: rowCell(row, ["Rack", "6. Rack"]) || "",
      description: rowCell(row, ["Desc", "7. Desc"]) || "",
      barcode: uniqueBarcodes,
      hsnCode: rowCell(row, ["HSN", "9. HSN"]) || "",
      pack: rowCell(row, ["Unit", "10. Unit"]) || "",
      variations: variations.length > 0 ? variations : undefined,
      tax: rowCell(row, ["Tax Cat", "13. Tax Cat"]) || "",
      purchasePrice: safeNonNegativeNumber(
        rowCell(row, ["Pur. Price", "15. Pur. Price"]),
        0
      ),
      compareAtPrice: mrp,
      price,
      deliveryTime: rowCell(row, ["Del. Time", "18. Del. Time"]) || "",
      stock,
      discPrice: safeNonNegativeNumber(
        rowCell(row, ["Offer Price", "20. Offer Price"]),
        0
      ),
      wholesalePrice: safeNonNegativeNumber(
        rowCell(row, ["Wholesale Price", "21. Wholesale Price"]),
        0
      ),
      lowStockQuantity: Math.floor(
        safeNonNegativeNumber(rowCell(row, ["Low Stock", "22. Low Stock"]), 5)
      ),
      brand: rowCell(row, ["Brand", "23. Brand"]) || "",
      mfgDate: rowCell(row, ["Mfg Date", "29. Mfg Date"]) || "",
      expiryDate: rowCell(row, ["Expiry Date", "30. Expiry Date"]) || "",
      unitPricing: unitPricing.length > 0 ? unitPricing : undefined,
      // Bulk-imported products should appear active immediately.
      publish: true,
      mainImage: rowCell(row, ["Image", "Img", "Main Image"]) || "",
      galleryImages: [],
    };
  };

  const handleUpload = async () => {
    if (!previewData.length) return;
    if (uploadInFlightRef.current || uploading) return;
    uploadInFlightRef.current = true;
    setUploading(true);
    const total = previewData.length;
    let successCount = 0;
    let failedCount = 0;
    setProgress({ total, current: 0, success: 0, failed: 0 });
    const seenImportKeys = new Set<string>();

    // We can either send all at once or one by one. One by one allows better progress tracking and partial success.
    // Given the requirement "pura data product list me bhi show hona chiaye", ensuring all valid are added is key.

    for (let i = 0; i < total; i++) {
      const row = normalizeExcelRow(
        previewData[i] && typeof previewData[i] === "object"
          ? (previewData[i] as Record<string, unknown>)
          : {}
      );
      try {
        const productData = mapRowToProduct(row);

        // Basic validation
        if (
          !String(productData.productName || "").trim() ||
          !Number.isFinite(Number(productData.price)) ||
          Number(productData.price) <= 0
        ) {
           throw new Error("Missing required fields (Name, Price)");
        }

        const signature = rowSignature(row);
        if (seenImportKeys.has(signature)) {
          throw new Error("Duplicate row in same import skipped");
        }
        seenImportKeys.add(signature);

        // Call create API
        await createProduct(productData as any);
        successCount++;
      } catch (err) {
        const apiMsg =
          axios.isAxiosError(err) &&
          err.response?.data &&
          typeof err.response.data === "object" &&
          err.response.data !== null &&
          "message" in err.response.data
            ? String((err.response.data as { message?: unknown }).message ?? "")
            : "";
        console.error(
          "Failed to import row",
          i + 1,
          row,
          apiMsg || err
        );
        failedCount++;
      }
      setProgress(prev => ({ ...prev, current: i + 1, success: successCount, failed: failedCount }));
    }

    setUploading(false);
    alert(`Import Complete! Success: ${successCount}, Failed: ${failedCount}`);
    if (successCount > 0) {
        onSuccess();
        onClose();
    }
    uploadInFlightRef.current = false;
  };

  const handleDownloadTemplate = () => {
    // 2-Row Header Structure for "Sub-Column" effect

    // Standard Columns (0-25)
    const stdCols = [
        "1. Category", "2. Sub Cat", "3. Sub Sub Cat", "4. Product Name", "5. SKU", "6. Rack", "7. Desc",
        "8. Barcode", "9. HSN", "10. Unit", "11. Size", "12. Color", "13. Tax Cat", "14. GST",
        "15. Pur. Price", "16. MRP", "17. Sell Price", "18. Del. Time", "19. Stock", "20. Offer Price",
        "21. Wholesale Price", "22. Low Stock", "23. Brand", "24. Val (MRP)", "25. Val (Pur)"
    ];

    // Row 1: Standard Cols + "Unit Pricing Rules" (Merged) + "29. Variations" + "Image" + "30. Mfg Date" + "31. Expiry Date" + "32. Weight"
    const row1 = [...stdCols, "Unit Pricing Rules", "", "28. Variations", "Image", "29. Mfg Date", "30. Expiry Date"];

    // Row 2: Standard Cols (Repeated for parsing) + Sub-Headers + "29. Variations" + "Image" + "30. Mfg Date" + "31. Expiry Date" + "32. Weight"
    const row2 = [...stdCols, "Price (Min Qty 2)", "Price (Min Qty 4)", "28. Variations", "Image", "29. Mfg Date", "30. Expiry Date"];

    const ws = XLSX.utils.aoa_to_sheet([row1, row2]);

    // Merges
    const merges = [];

    // Vertical Merges for Standard Columns & Image
    for (let i = 0; i < stdCols.length; i++) {
        merges.push({ s: { r: 0, c: i }, e: { r: 1, c: i } });
    }
    // Variations Column (Index 27)
    merges.push({ s: { r: 0, c: 27 }, e: { r: 1, c: 27 } });

    // Image Column (Index 28)
    merges.push({ s: { r: 0, c: 28 }, e: { r: 1, c: 28 } });

    // Mfg Date Column (Index 29)
    merges.push({ s: { r: 0, c: 29 }, e: { r: 1, c: 29 } });

    // Expiry Date Column (Index 30)
    merges.push({ s: { r: 0, c: 30 }, e: { r: 1, c: 30 } });

    // Horizontal Merge for Unit Pricing (Index 25-26)
    merges.push({ s: { r: 0, c: 25 }, e: { r: 0, c: 26 } });

    ws['!merges'] = merges;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Product Template");
    XLSX.writeFile(wb, "product_import_template.xlsx");
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 bg-[var(--primary-color)] text-white rounded-t-lg">
          <h2 className="text-lg font-semibold">Bulk Import Products</h2>
          <button onClick={onClose} className="text-white hover:bg-[var(--primary-dark)] p-2 rounded">✕</button>
        </div>

        <div className="flex-1 overflow-auto p-6 flex flex-col gap-6">
          {!file ? (
            <div className="border-2 border-dashed border-neutral-300 rounded-lg p-12 flex flex-col items-center justify-center text-center hover:bg-neutral-50 transition-colors">
              <svg className="w-16 h-16 text-neutral-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
              <h3 className="text-lg font-medium text-neutral-900 mb-2">Select Excel File</h3>
              <p className="text-neutral-500 mb-6 max-w-md">Upload an Excel file (.xlsx, .xls) containing your product data. Ensure columns match the Product List structure.</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="bg-[var(--primary-color)] text-white px-6 py-3 rounded-lg hover:bg-[var(--primary-dark)] transition"
              >
                Choose File
              </button>
              <button
                onClick={handleDownloadTemplate}
                 className="mt-2 text-sm text-[var(--primary-color)] hover:underline"
              >
                  Excel Format
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".xlsx, .xls, .csv"
                className="hidden"
              />
              <div className="mt-8 text-left text-sm text-neutral-500 bg-neutral-100 p-4 rounded w-full max-w-lg">
                <p className="font-semibold mb-2">Expected Columns:</p>
                <div className="grid grid-cols-3 gap-2">
                   <span>1. Category</span>
                   <span>2. Sub Cat</span>
                   <span>3. Sub Sub Cat</span>
                   <span>4. Product Name</span>
                   <span>5. SKU</span>
                   <span>6. Rack</span>
                   <span>7. Desc</span>
                   <span>8. Barcode</span>
                   <span>9. HSN</span>
                   <span>10. Unit</span>
                   <span>11. Size</span>
                   <span>12. Color</span>
                   <span>13. Tax Cat</span>
                   <span>14. GST</span>
                   <span>15. Pur. Price</span>
                   <span>16. MRP</span>
                   <span>17. Sell Price</span>
                   <span>18. Del. Time</span>
                   <span>19. Stock</span>
                   <span>20. Offer Price</span>
                   <span>21. Wholesale Price</span>
                   <span>22. Low Stock</span>
                   <span>23. Brand</span>
                   <span>24. Val (MRP)</span>
                   <span>25. Val (Pur)</span>
                   <span>26. Unit Price (Min Qty 2)</span>
                   <span>27. Unit Price (Min Qty 4)</span>
                   <span>28. Variations</span>
                   <span>Image</span>
                   <span>29. Mfg Date</span>
                   <span>30. Expiry Date</span>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-2">
                 <div className="flex items-center gap-3">
                    <span className="font-medium text-neutral-900">{file.name}</span>
                    <span className="text-sm text-neutral-500">({previewData.length} rows found)</span>
                 </div>
                 <button onClick={() => setFile(null)} className="text-red-600 hover:text-red-700 text-sm">Remove File</button>
              </div>

              <div className="flex-1 overflow-auto border border-neutral-200 rounded-lg">
                 <table className="w-full text-left text-sm">
                    <thead className="bg-neutral-50 sticky top-0">
                       <tr>
                          {previewData.length > 0 && Object.keys(previewData[0]).slice(0, 10).map(header => (
                             <th key={header} className="p-2 border-b font-medium text-neutral-700">{header}</th>
                          ))}
                          {previewData.length > 0 && Object.keys(previewData[0]).length > 10 && <th className="p-2 border-b text-neutral-500">...more</th>}
                       </tr>
                    </thead>
                    <tbody>
                       {previewData.slice(0, 10).map((row, i) => ( // Show only first 10 for preview
                          <tr key={i} className="border-b hover:bg-neutral-50">
                             {Object.values(row).slice(0, 10).map((val: any, j) => (
                                <td key={j} className="p-2 truncate max-w-[150px]">{val}</td>
                             ))}
                             {Object.keys(row).length > 10 && <td className="p-2 text-neutral-400">...</td>}
                          </tr>
                       ))}
                    </tbody>
                 </table>
                 {previewData.length > 10 && (
                   <div className="p-2 text-center text-xs text-neutral-500 bg-neutral-50 border-t">
                     ...and {previewData.length - 10} more rows
                   </div>
                 )}
              </div>

              {uploading && (
                  <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                          <span>Importing...</span>
                          <span>{progress.current} / {progress.total}</span>
                      </div>
                      <div className="w-full bg-neutral-200 rounded-full h-2.5">
                          <div className="bg-[var(--primary-color)] h-2.5 rounded-full" style={{ width: `${(progress.current / progress.total) * 100}%` }}></div>
                      </div>
                      <div className="flex gap-4 text-xs">
                          <span className="text-[var(--primary-color)]">Success: {progress.success}</span>
                          <span className="text-red-600">Failed: {progress.failed}</span>
                      </div>
                  </div>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-neutral-200 flex justify-end gap-3 bg-neutral-50 rounded-b-lg">
          <button onClick={onClose} className="px-4 py-2 border rounded hover:bg-neutral-100">Cancel</button>

          <button
             onClick={handleUpload}
             disabled={!file || uploading || previewData.length === 0}
             className={`px-4 py-2 rounded text-white flex items-center gap-2 ${!file || uploading ? "bg-neutral-400 cursor-not-allowed" : "bg-[var(--primary-color)] hover:bg-[var(--primary-dark)]"}`}
          >
             {uploading ? "Importing..." : "Upload & Import"}
          </button>
        </div>
      </div>
    </div>
  );
}
