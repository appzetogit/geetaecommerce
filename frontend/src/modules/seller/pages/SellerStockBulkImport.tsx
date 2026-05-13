import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import {
  createProduct,
  CreateProductData,
  getProducts,
  getProductById,
  updateStock,
} from "../../../services/api/productService";
import { Category } from "../../../services/api/categoryService";
import { useAuth } from "../../../context/AuthContext";

/** After deploy: pink header ke neeche yeh line dikhni chahiye; `SellerStockBulkImport-*.js` mein bhi search karo. */
export const SELLER_BULK_IMPORT_BUILD_ID = "geeta-bulk-import-2025-03-24";

interface SellerStockBulkImportProps {
  categories: Category[];
  onClose: () => void;
  onSuccess: () => void;
}

/** Strip BOM / zero-width chars; normalize so "PRODUCT NAME", "Product_Name", "﻿PRODUCT_NAME" all match. */
function normalizeHeaderKey(k: string): string {
  return String(k)
    .replace(/^\uFEFF/, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "_")
    .replace(/_+/g, "_");
}

/** Merge normalized header aliases onto the row so template columns always resolve. */
function normalizeExcelRow(row: Record<string, unknown>): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...row };
  for (const [k, v] of Object.entries(row)) {
    const nk = normalizeHeaderKey(k);
    if (nk && !(nk in merged)) merged[nk] = v;
  }
  return merged;
}

/** First matching column by exact key, then normalized header match (Excel BOM/spacing/case). */
function rowCell(row: Record<string, unknown>, keys: string[]): string | undefined {
  const pick = (v: unknown) => {
    if (v === undefined || v === null) return undefined;
    if (typeof v === "number" && !Number.isNaN(v)) return String(v);
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

/** Never send NaN in variations; collect human-readable issues for one console.warn per row. */
function sanitizeImportVariations(
  variations: unknown[],
  fallbackPrice: number,
  fallbackStock: number
): { list: Record<string, unknown>[]; issues: string[] } {
  const fp = Number.isFinite(fallbackPrice) && fallbackPrice > 0 ? fallbackPrice : 1;
  const fs = Math.floor(safeNonNegativeNumber(fallbackStock, 0));
  const issues: string[] = [];

  const list = variations.map((v, idx) => {
    const raw = v != null && typeof v === "object" ? (v as Record<string, unknown>) : {};
    const out: Record<string, unknown> = { ...raw };

    const rawPrice = typeof raw.price === "number" ? raw.price : parseFloat(String(raw.price ?? ""));
    let price = rawPrice;
    if (!Number.isFinite(price) || price < 0) {
      issues.push(`variation[${idx}] price invalid (NaN/empty) → ${fp}`);
      price = fp;
    }
    out.price = price;

    const rawStockParsed =
      typeof raw.stock === "number" ? raw.stock : parseFloat(String(raw.stock ?? ""));
    const hadBadStock =
      raw.stock != null &&
      String(raw.stock).trim() !== "" &&
      (!Number.isFinite(rawStockParsed) || Number.isNaN(rawStockParsed) || rawStockParsed < 0);
    const stockNum = Math.floor(safeNonNegativeNumber(raw.stock, fs));
    if (hadBadStock) {
      issues.push(`variation[${idx}] stock invalid (NaN/empty) → ${stockNum}`);
    }
    out.stock = stockNum;

    let disc = typeof raw.discPrice === "number" ? raw.discPrice : parseFloat(String(raw.discPrice ?? ""));
    if (!Number.isFinite(disc) || disc < 0) disc = 0;
    if (disc > price) disc = 0;
    out.discPrice = disc;

    let mrp = typeof raw.compareAtPrice === "number" ? raw.compareAtPrice : parseFloat(String(raw.compareAtPrice ?? ""));
    if (!Number.isFinite(mrp) || mrp < 0) {
      mrp = price;
    }
    out.compareAtPrice = mrp;

    let wholesale =
      typeof raw.wholesalePrice === "number"
        ? raw.wholesalePrice
        : parseFloat(String(raw.wholesalePrice ?? ""));
    if (!Number.isFinite(wholesale) || wholesale < 0) wholesale = 0;
    out.wholesalePrice = wholesale;

    return out;
  });

  return { list, issues };
}

/** 24-char hex Mongo ObjectId — used so we never send brand/category *names* as IDs. */
function isValidObjectIdString(id: unknown): boolean {
  if (id == null || typeof id !== "string") return false;
  const s = id.trim();
  return /^[a-fA-F0-9]{24}$/.test(s);
}

/** Readable message for API throws (axios) or Error — bulk import UI + console. */
function bulkImportErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const d = err.response?.data;
    if (d && typeof d === "object" && d !== null) {
      const o = d as Record<string, unknown>;
      if (typeof o.message === "string" && o.message.trim()) return o.message.trim();
      if (typeof o.error === "string" && o.error.trim()) return o.error.trim();
      if (Array.isArray(o.errors) && o.errors.length) {
        try {
          return JSON.stringify(o.errors);
        } catch {
          /* fall through */
        }
      }
    }
    if (typeof d === "string" && d.trim()) return d.trim();
    const st = err.response?.status;
    if (st) return `Server error (${st})${err.message ? `: ${err.message}` : ""}`;
  }
  if (err instanceof Error && err.message) return err.message;
  return String(err);
}

/**
 * Stock Management CSV export: `Variation Id`, `Stock`, no product-template price columns.
 * That file must update existing variation stock — not create new products.
 */
function isStockManagementCsv(headersNormalized: string[]): boolean {
  const hasVid = headersNormalized.includes("variation_id");
  const hasStock =
    headersNormalized.includes("stock") || headersNormalized.includes("current_stock");
  if (!hasVid || !hasStock) return false;
  // Do not use broad "mrp" — "16. MRP" / "24. Val (MRP)" would false-match. Rely on sell / retail import columns.
  const hasCreatePriceCols = headersNormalized.some(
    (k) =>
      k.includes("sell_price") ||
      k.includes("product_retail_price") ||
      k.includes("product_selling_price")
  );
  return !hasCreatePriceCols;
}

/** Map variation subdocument _id -> { productId, variationId } for stock CSV rows that only store 24-char variation ids. */
async function buildMongoVariationLookup(): Promise<
  Map<string, { productId: string; variationId: string }>
> {
  const map = new Map<string, { productId: string; variationId: string }>();
  let page = 1;
  const limit = 200;
  for (;;) {
    const res = await getProducts({
      page,
      limit,
      sortBy: "createdAt",
      sortOrder: "desc",
    });
    if (!res.success || !res.data?.length) break;
    for (const p of res.data) {
      const pid = (p as { _id?: string })._id;
      if (!pid) continue;
      for (const v of (p as { variations?: { _id?: string }[] }).variations || []) {
        const vid = v?._id != null ? String(v._id) : "";
        if (vid) map.set(vid, { productId: pid, variationId: vid });
      }
    }
    const pages = (res as { pagination?: { pages?: number } }).pagination?.pages ?? 1;
    if (page >= pages) break;
    page += 1;
  }
  return map;
}

export default function SellerStockBulkImport({
  categories,
  onClose,
  onSuccess,
}: SellerStockBulkImportProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ total: 0, current: 0, success: 0, failed: 0 });
  const [importFailures, setImportFailures] = useState<
    { row: number; label: string; message: string }[]
  >([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadInFlightRef = useRef(false);
  const { user } = useAuth();

  useEffect(() => {
    console.info("[Seller bulk import]", SELLER_BULK_IMPORT_BUILD_ID);
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setImportFailures([]);
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
            const s = String(v).trim();
            return twoRowMarkers.has(s);
          });
          if (hit) {
              // Re-parse skipping the first header row (so the second row becomes the header)
              json = XLSX.utils.sheet_to_json(sheet, { range: 1 });
          }
      }

      setPreviewData(json);
    };
    reader.readAsBinaryString(file);
  };

  const mapRowToProduct = (row: any): Partial<CreateProductData> => {
    // Helper to find category ID by name
    const findCategory = (name: string) => categories.find((c) => c.name?.toLowerCase() === name?.toLowerCase())?._id || "";

    const variations = [];
    const sizeVal = rowCell(row, ["Size", "11. Size", "PRODUCT_SIZE"]);
    const colorVal = rowCell(row, ["Color", "12. Color", "PRODUCT_COLOR"]);
    if (sizeVal) {
       variations.push({ name: "Size", value: sizeVal });
    }
    if (colorVal) {
       variations.push({ name: "Color", value: colorVal });
    }

    // New Generic Variations Column
    const rawVars = rowCell(row, ["Variations", "28. Variations", "PRODUCT_VARIATIONS"]);
    if (rawVars) {
        String(rawVars).split(';').forEach(v => {
            const [name, val] = v.split(':').map(s => s.trim());
            if (name && val) {
                variations.push({ name: name, value: val });
            }
        });
    }

    let unitPricing: { minQty: number; price: number }[] = [];
    try {
        // Check for specific columns first (New Template Format)
        const priceFor2 = parseFloat(
          rowCell(row, [
            "26. Unit Price (Min Qty 2)",
            "Unit Price (Min Qty 2)",
            "26. Price (Min Qty 2)",
            "27. Price (Min Qty 2)",
            "Price (Min Qty 2)",
          ]) || "0"
        );
        const priceFor4 = parseFloat(
          rowCell(row, [
            "27. Unit Price (Min Qty 4)",
            "Unit Price (Min Qty 4)",
            "27. Price (Min Qty 4)",
            "28. Unit Price (Min Qty 4)",
            "28. Price (Min Qty 4)",
            "Price (Min Qty 4)",
          ]) || "0"
        );

        if (priceFor2 > 0) unitPricing.push({ minQty: 2, price: priceFor2 });
        if (priceFor4 > 0) unitPricing.push({ minQty: 4, price: priceFor4 });

        // Fallback or additional rules from single column (Old Format)
        const rawPricing = rowCell(row, [
          "Unit Pricing", "Tiered Pricing", "Pricing Rules",
          "27. Unit Pricing Rules (e.g. 2=100; 5=90)", "27. Unit Pricing Rules",
          "27. Pricing Rules", "Unit Pricing Rules",
        ]);

        if (rawPricing) {
             const pricingStr = String(rawPricing).trim();

             // 1. Try Simple Syntax: "2=100; 5=90"
             if (pricingStr.includes('=') && !pricingStr.startsWith('[')) {
                unitPricing = pricingStr.split(';').map(pair => {
                    const [qty, price] = pair.split('=').map(s => s.trim());
                    return { minQty: parseInt(qty), price: parseFloat(price) };
                }).filter(p => !isNaN(p.minQty) && !isNaN(p.price));
             }
             // 2. Try JSON Syntax
             else if (pricingStr.startsWith('[')) {
                 unitPricing = JSON.parse(pricingStr);
             }
        }
    } catch (e) {
        console.warn("Failed to parse unit pricing for row", row);
    }

    return {
      categoryId: findCategory(rowCell(row, ["Category", "1. Category", "PRODUCT_CATEGORY", "product_category"]) || ""),
      subcategoryId: rowCell(row, ["Sub Cat", "2. Sub Cat", "PRODUCT_SUB_CATEGORY"]) || "",
      subSubCategoryId: rowCell(row, ["Sub Sub Cat", "3. Sub Sub Cat"]) || "",
      productName:
        rowCell(row, [
          "Product Name",
          "4. Product Name",
          "PRODUCT_NAME",
          "product_name",
          "Name",
          "PRODUCT NAME",
        ]) || "",
      itemCode: rowCell(row, ["SKU", "5. SKU", "PRODUCT_SKU", "product_sku"]) || "",
      rackNumber: rowCell(row, ["Rack", "6. Rack"]) || "",
      smallDescription: rowCell(row, ["Desc", "7. Desc", "PRODUCT_DESCRIPTION", "DESCRIPTION"]) || "",
      // barcode: row['Barcode'] || row['8. Barcode'] || "", // CreateProductData does not strictly have barcode? It's mapped in backend usually? Or variations?
      // Looking at productService.ts: CreateProductData has itemCode, rackNumber, hsnCode, etc. It doesn't have 'barcode' at top level.
      // But updateProduct supports it via payload.
      // We will assume backend handles it if passed as 'any' or put it in variations first element if needed.
      // Let's pass it anyway.
      // barcode: row['Barcode'] || ...
      hsnCode: rowCell(row, ["HSN", "9. HSN", "PRODUCT_HSN"]) || "",
      // pack: row['Unit'] || row['10. Unit'] || "", // unit
      variations: variations.length > 0 ? variations : [], // Provide empty array if none
      taxId: rowCell(row, ["Tax Cat", "13. Tax Cat"]) || "",
      purchasePrice: parseFloat(rowCell(row, ["Pur. Price", "15. Pur. Price", "16. Pur. Price", "PRODUCT_PURCHASE_PRICE"]) || "0"),
      // compareAtPrice: parseFloat(row['MRP'] || row['17. MRP'] || "0"), // Product interface has compareAtPrice, CreateProductData has variations which have compareAtPrice.
      // Note: createProduct in productService creates a product structure. Some fields might be top level, others in variations.
      // Let's create a minimal valid structure based on CreateProductData
      deliveryTime:
        rowCell(row, [
          "Del. Time",
          "18. Del. Time",
          "19. Del. Time",
          "PRODUCT_DELIVERY_TIME",
        ]) || "",
      lowStockQuantity: parseInt(
        rowCell(row, ["Low Stock", "22. Low Stock", "21. Low Stock", "PRODUCT_LOW_STOCK"]) || "5",
        10
      ),
      brandId: rowCell(row, ["Brand", "24. Brand", "23. Brand", "PRODUCT_BRAND"]) || "",
      mfgDate: rowCell(row, ["Mfg Date", "29. Mfg Date", "PRODUCT_MFG_DATE"]) || "",
      expiryDate: rowCell(row, ["Expiry Date", "30. Expiry Date", "PRODUCT_EXPIRY_DATE"]) || "",

      publish: (() => {
        const st = (rowCell(row, ["Status", "PRODUCT_STATUS"]) || "").toLowerCase();
        return st === "active" || st === "published";
      })(),
      popular: false,
      dealOfDay: false,
      isReturnable: false,
      totalAllowedQuantity: 10,

      // Main Logic adjustment for createProduct call to match structure
      // We'll put price, stock, mrp into the first variation if no variations exist, or top level if supported.
      // CreateProductData requires variations: ProductVariation[]

      mainImage: rowCell(row, ["Image", "Img", "Main Image", "PRODUCT_IMAGE", "PRODUCT_MAIN_IMAGE"]) || "",

    } as any; // Casting to any to allow flexible mapping, specifically for the variations array construction below
  };

  const handleUpload = async () => {
    if (!previewData.length) return;
    if (uploadInFlightRef.current || uploading) return;
    uploadInFlightRef.current = true;
    const apiBase =
      import.meta.env.VITE_API_BASE_URL ||
      (import.meta.env.DEV ? "/api/v1" : "https://api.geeta.today/api/v1");

    setUploading(true);
    setImportFailures([]);
    const failures: { row: number; label: string; message: string }[] = [];
    const total = previewData.length;
    let successCount = 0;
    let failedCount = 0;
    setProgress({ total, current: 0, success: 0, failed: 0 });

    const firstNorm = normalizeExcelRow(
      previewData[0] && typeof previewData[0] === "object"
        ? (previewData[0] as Record<string, unknown>)
        : {}
    );
    const stockImportMode = isStockManagementCsv(
      Object.keys(firstNorm).map(normalizeHeaderKey)
    );

    console.log("[Seller bulk import] START — user clicked Upload & Import", {
      fileName: file?.name ?? "(unknown)",
      rowCount: total,
      mode: stockImportMode ? "stock CSV (update existing variation stock)" : "product rows (create product per row)",
      api: stockImportMode
        ? `PATCH ${apiBase}/products/{productId}/variations/{variationId}/stock`
        : `POST ${apiBase}/products`,
    });
    let mongoVariationLookup: Map<string, { productId: string; variationId: string }> | null =
      null;
    if (stockImportMode) {
      const needsMongo = previewData.some((raw) => {
        const r = normalizeExcelRow(
          raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}
        );
        const vid = rowCell(r, ["Variation Id", "variation_id"]);
        if (!vid) return false;
        const s = String(vid).trim();
        return /^[a-fA-F0-9]{24}$/.test(s) && !/^([a-fA-F0-9]{24})-\d+$/.test(s);
      });
      if (needsMongo) {
        mongoVariationLookup = await buildMongoVariationLookup();
      }
    }
    const seenImportKeys = new Set<string>();

    for (let i = 0; i < total; i++) {
        const row = normalizeExcelRow(
          previewData[i] && typeof previewData[i] === "object"
            ? (previewData[i] as Record<string, unknown>)
            : {}
        );
        try {
            if (stockImportMode) {
              const vidRaw = rowCell(row, ["Variation Id", "variation_id"]);
              if (!vidRaw) throw new Error("Missing Variation Id");
              const vidStr = String(vidRaw).trim();
              const stockNum = Math.floor(
                safeNonNegativeNumber(rowCell(row, ["Stock", "Current Stock"]), 0)
              );

              const composite = /^([a-fA-F0-9]{24})-(\d+)$/.exec(vidStr);
              if (composite) {
                const productId = composite[1];
                const idx = parseInt(composite[2], 10);
                const pr = await getProductById(productId);
                if (!pr.success || !pr.data) throw new Error("Product not found");
                const vars = pr.data.variations || [];
                const v = vars[idx];
                if (!v?._id) throw new Error("Variation not found at index");
                const res = await updateStock(productId, String(v._id), stockNum);
                if (!res?.success) throw new Error(res?.message || "Stock update failed");
                successCount++;
                continue;
              }

              if (/^[a-fA-F0-9]{24}$/.test(vidStr)) {
                if (!mongoVariationLookup) {
                  mongoVariationLookup = await buildMongoVariationLookup();
                }
                const found = mongoVariationLookup.get(vidStr);
                if (!found) throw new Error("Variation not found");
                const res = await updateStock(found.productId, found.variationId, stockNum);
                if (!res?.success) throw new Error(res?.message || "Stock update failed");
                successCount++;
                continue;
              }

              throw new Error("Invalid Variation Id");
            }

            const rawData = mapRowToProduct(row);

            // Construct proper CreateProductData payload
            // We need to ensure variations array is populated correctly with price/stock/mrp
            let price = safeNonNegativeNumber(
              rowCell(row, [
                "Sell Price",
                "17. Sell Price",
                "18. Sell Price",
                "Selling Price",
                "PRODUCT_RETAIL_PRICE",
                "PRODUCT_SELLING_PRICE",
                "Price",
                "Retail Price",
                "Sale Price",
              ]),
              0
            );
            let mrp = safeNonNegativeNumber(
              rowCell(row, ["MRP", "16. MRP", "17. MRP", "PRODUCT_MRP", "Compare At Price"]),
              0
            );
            const stock = Math.floor(
              safeNonNegativeNumber(
                rowCell(row, [
                  "Stock",
                  "19. Stock",
                  "20. Stock",
                  "PRODUCT_QUANTITY",
                  "PRODUCT_STOCK",
                  "Current Stock",
                ]),
                0
              )
            );
            let discPrice = safeNonNegativeNumber(
              rowCell(row, ["Offer Price", "20. Offer Price", "21. Offer Price", "PRODUCT_OFFER_PRICE"]),
              0
            );
            const wholesalePrice = safeNonNegativeNumber(
              rowCell(row, [
                "Wholesale Price",
                "21. Wholesale Price",
                "22. Wholesale Price",
                "PRODUCT_WHOLESALE_PRICE",
              ]),
              0
            );

            if (price <= 0 && mrp > 0) price = mrp;
            if (price <= 0) {
              const alt = safeNonNegativeNumber(rowCell(row, ["Price", "Retail Price", "Sell Price"]), 0);
              if (alt > 0) price = alt;
            }
            if (price <= 0 && mrp > 0) price = mrp;
            if (mrp <= 0 && price > 0) mrp = price;
            if (price <= 0) price = 1;
            if (mrp <= 0) mrp = price;
            if (discPrice > price) discPrice = 0;

            const safePrice = Number.isFinite(price) && !Number.isNaN(price) ? Math.max(0, price) : 1;
            const safeMrp = Number.isFinite(mrp) && !Number.isNaN(mrp) ? Math.max(0, mrp) : safePrice;

            // mapRowToProduct uses `variations` for Size/Color tags only (no price). Never send those as API variations
            // or the backend drops them and price is missing. Spread `...rawData` must not overwrite this array.
            const excelAttrs = rawData.variations && Array.isArray(rawData.variations) ? rawData.variations : [];
            // Must use .every: if first row is Size/Color (no price) but another row has price: 0, .some() wrongly
            // picked excelAttrs — backend then reads variations[0].price → undefined → 400.
            const hasPricedExcelVariation =
              excelAttrs.length > 0 &&
              excelAttrs.every(
                (v: any) =>
                  v != null &&
                  typeof v.price === "number" &&
                  !Number.isNaN(v.price) &&
                  v.price >= 0
              );

            let varTitle =
              rowCell(row, ["Variation", "Variation Name", "VARIATION", "Variant"]) || "Default";
            if (/^variation\s*:/i.test(varTitle)) {
              varTitle = varTitle.replace(/^variation\s*:\s*/i, "").trim() || "Default";
            }

            const defaultVariation: Record<string, unknown> = {
              price: safePrice,
              discPrice: Number.isFinite(discPrice) && discPrice >= 0 ? discPrice : 0,
              stock,
              status: stock > 0 ? "In stock" : "Sold out",
              compareAtPrice: safeMrp,
              wholesalePrice: Number.isFinite(wholesalePrice) ? wholesalePrice : 0,
              title: varTitle,
            };
            const code = rawData.itemCode != null ? String(rawData.itemCode).trim() : "";
            if (code) defaultVariation.sku = code;

            const variations = hasPricedExcelVariation ? (excelAttrs as any) : [defaultVariation];

            const { variations: _excelVariationAttrs, ...rawWithoutVariations } = rawData as any;

            const variationPayload =
              Array.isArray(variations) && variations.length > 0
                ? variations
                : [
                    {
                      price: safePrice,
                      discPrice: 0,
                      stock,
                      status: stock > 0 ? "In stock" : "Sold out",
                      compareAtPrice: safeMrp,
                      title: varTitle,
                    },
                  ];

            const { list: normalizedVariations, issues: variationIssues } = sanitizeImportVariations(
              variationPayload as unknown[],
              safePrice,
              stock
            );

            const productNameTrimmed = String(rawData.productName ?? "").trim();
            const productNameFinal = productNameTrimmed || "Untitled";

            const importRowIssues: string[] = [...variationIssues];
            if (!productNameTrimmed) {
              importRowIssues.push("productName empty → using Untitled");
            }

            const purchaseRaw =
              typeof rawData.purchasePrice === "number"
                ? rawData.purchasePrice
                : parseFloat(String(rawData.purchasePrice ?? ""));
            const purchasePriceFinal =
              Number.isFinite(purchaseRaw) && !Number.isNaN(purchaseRaw) && purchaseRaw >= 0
                ? purchaseRaw
                : 0;
            if (
              rawData.purchasePrice != null &&
              String(rawData.purchasePrice).trim() !== "" &&
              !Number.isFinite(purchaseRaw)
            ) {
              importRowIssues.push("purchasePrice invalid (NaN) → 0");
            }

            const lowRaw =
              typeof rawData.lowStockQuantity === "number"
                ? rawData.lowStockQuantity
                : parseInt(String(rawData.lowStockQuantity ?? ""), 10);
            const lowStockFinal =
              Number.isFinite(lowRaw) && !Number.isNaN(lowRaw) && lowRaw >= 0
                ? Math.floor(lowRaw)
                : 5;
            if (
              rawData.lowStockQuantity != null &&
              String(rawData.lowStockQuantity).trim() !== "" &&
              (!Number.isFinite(lowRaw) || Number.isNaN(lowRaw))
            ) {
              importRowIssues.push(`lowStockQuantity invalid (NaN) → ${lowStockFinal}`);
            }

            if (importRowIssues.length > 0) {
              console.warn(
                `[Bulk import] Row ${i + 1} (${code || productNameFinal}):`,
                importRowIssues.join(" | ")
              );
            }

            const productPayload: CreateProductData = {
                ...rawWithoutVariations,
                productName: productNameFinal,
                categoryId: isValidObjectIdString(rawData.categoryId) ? rawData.categoryId : undefined,
                subcategoryId: isValidObjectIdString(rawData.subcategoryId)
                  ? rawData.subcategoryId
                  : undefined,
                subSubCategoryId: rawData.subSubCategoryId,
                brandId: isValidObjectIdString(rawData.brandId) ? rawData.brandId : undefined,
                // Bulk-imported products should appear active immediately.
                publish: true,
                popular: false,
                dealOfDay: false,
                isReturnable: false,
                totalAllowedQuantity: 10, // Default
                mainImage: rawData.mainImage,
                variations: normalizedVariations as any,
                itemCode: code || undefined,
                rackNumber: rawData.rackNumber,
                hsnCode: rawData.hsnCode,
                purchasePrice: purchasePriceFinal,
                deliveryTime: rawData.deliveryTime,
                lowStockQuantity: lowStockFinal,
            };

            const signature = rowSignature(row);
            if (seenImportKeys.has(signature)) {
              const label =
                rowCell(row, ["5. SKU", "SKU", "sku", "ITEM_CODE", "PRODUCT_SKU"]) ||
                rowCell(row, ["4. Product Name", "Product Name", "PRODUCT_NAME"]) ||
                "—";
              failures.push({
                row: i + 1,
                label,
                message: "Duplicate row in same import skipped",
              });
              failedCount++;
              setProgress(prev => ({ ...prev, current: i + 1, success: successCount, failed: failedCount }));
              continue;
            }
            seenImportKeys.add(signature);

            const res = await createProduct(productPayload);
            if (!res?.success) {
              throw new Error(res?.message || "Import failed");
            }
            successCount++;
        } catch (err) {
            const message = bulkImportErrorMessage(err);
            const label =
              rowCell(row, ["5. SKU", "SKU", "sku", "ITEM_CODE", "PRODUCT_SKU"]) ||
              rowCell(row, ["4. Product Name", "Product Name", "PRODUCT_NAME"]) ||
              "—";
            failures.push({ row: i + 1, label, message });
            console.error("Failed to import row", i + 1, label, message, row, err);
            failedCount++;
        }
        setProgress(prev => ({ ...prev, current: i + 1, success: successCount, failed: failedCount }));
    }

    setUploading(false);
    setImportFailures(failures);

    const summary =
      failedCount === 0 && successCount > 0
        ? "completed — all rows succeeded"
        : successCount > 0 && failedCount > 0
          ? "completed — partial (some rows failed)"
          : failedCount > 0 && successCount === 0
            ? "completed — all rows failed"
            : "completed — nothing imported";

    console.log("[Seller bulk import] DONE", {
      fileName: file?.name ?? "(unknown)",
      successRows: successCount,
      failedRows: failedCount,
      summary,
    });

    if (failures.length > 0) {
      alert(
        `Import finished.\nSuccess: ${successCount}\nFailed: ${failedCount}\n\nSee the red box below for the exact error on each row.`
      );
      if (successCount > 0) onSuccess();
      uploadInFlightRef.current = false;
      return;
    }

    alert(`Import complete! Success: ${successCount}`);
    if (successCount > 0) {
      onSuccess();
      onClose();
    }
    uploadInFlightRef.current = false;
  };

  useEffect(() => {
    return () => {
      uploadInFlightRef.current = false;
    };
  }, []);

  const handleDownloadTemplate = () => {
    // 2-Row Header Structure for "Sub-Column" effect

    // Standard Columns (0-25)
    const stdCols = [
        "1. Category", "2. Sub Cat", "3. Sub Sub Cat", "4. Product Name", "5. SKU", "6. Rack", "7. Desc",
        "8. Barcode", "9. HSN", "10. Unit", "11. Size", "12. Color", "13. Tax Cat", "14. GST",
        "15. Pur. Price", "16. MRP", "17. Sell Price", "18. Del. Time", "19. Stock", "20. Offer Price",
        "21. Wholesale Price", "22. Low Stock", "23. Brand", "24. Val (MRP)", "25. Val (Pur)"
    ];

    // Row 1: Standard Cols + "Unit Pricing Rules" (Merged) + "28. Variations" + "Image" + "29. Mfg Date" + "30. Expiry Date"
    const row1 = [...stdCols, "Unit Pricing Rules", "", "28. Variations", "Image", "29. Mfg Date", "30. Expiry Date"];

    // Row 2: Standard Cols (Repeated for parsing) + Sub-Headers + "28. Variations" + "Image" + "29. Mfg Date" + "30. Expiry Date"
    const row2 = [
      ...stdCols,
      "26. Unit Price (Min Qty 2)",
      "27. Unit Price (Min Qty 4)",
      "28. Variations",
      "Image",
      "29. Mfg Date",
      "30. Expiry Date",
    ];

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
          <div>
            <h2 className="text-lg font-semibold">Bulk Import Products</h2>
            <p className="text-[10px] text-white/85 font-normal tracking-wide mt-0.5">
              {SELLER_BULK_IMPORT_BUILD_ID}
            </p>
          </div>
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
              <a
                href={`${import.meta.env.BASE_URL}sample_product_import_template_filled.csv`}
                download="sample_product_import_template_filled.csv"
                className="mt-1 text-sm text-[var(--primary-color)] hover:underline block"
              >
                Sample file (demo data)
              </a>
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
                 <button
                   onClick={() => {
                     setFile(null);
                     setImportFailures([]);
                   }}
                   className="text-red-600 hover:text-red-700 text-sm"
                 >
                   Remove File
                 </button>
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

              {!uploading && importFailures.length > 0 && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm">
                  <p className="font-semibold text-red-900 mb-2">
                    Failed rows ({importFailures.length}) — exact error
                  </p>
                  <ul className="max-h-52 overflow-y-auto space-y-2 text-red-900">
                    {importFailures.map((f, idx) => (
                      <li key={idx} className="border-b border-red-100 pb-2 last:border-0">
                        <span className="font-medium">Row {f.row}</span>
                        <span className="text-red-700"> · {f.label}</span>
                        <div className="mt-1 text-red-800 whitespace-pre-wrap break-words font-mono text-xs">
                          {f.message}
                        </div>
                      </li>
                    ))}
                  </ul>
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
