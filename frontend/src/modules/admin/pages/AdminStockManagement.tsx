import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import {
  getProducts,
  getCategories,
  getBrands,
  getSubCategories,
  getSellers,
  deleteProduct,
  updateProduct,
  type Product,
  type Category,
  type Brand,
  type Seller,
  type SubCategory,
} from "../../../services/api/admin/adminProductService";
import { useAuth } from "../../../context/AuthContext";
import { useAppContext } from "../../../context/AppContext";
import AdminStockBulkEdit from "./AdminStockBulkEdit";
import AdminStockBulkImport from "./AdminStockBulkImport";
import { getAppSettings } from "../../../services/api/admin/adminSettingsService";
import VariationDropdown from "../../../components/VariationDropdown";
import QRScannerModal from "../../../components/QRScannerModal";
import { openBarcodeScanner } from '../../../utils/scannerPlatform';

function fixLikelyMojibake(input: unknown): string {
  let s = String(input ?? "");
  if (!s) return s;

  // Remove zero-width and non-breaking spaces that can appear from copy/paste.
  s = s.replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\u00A0/g, " ");

  // Best-effort fix for UTF-8 bytes mis-decoded as Latin-1 (common: Ã, Â, â sequences).
  const looksMojibake = /[ÃÂâ]/.test(s);
  const isLatin1Only = [...s].every((ch) => ch.charCodeAt(0) <= 0xff);
  if (looksMojibake && isLatin1Only && typeof TextDecoder !== "undefined") {
    try {
      const bytes = Uint8Array.from([...s].map((ch) => ch.charCodeAt(0)));
      const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
      if (decoded && decoded !== s) s = decoded;
    } catch {
      // ignore
    }
  }

  // Common leftover sequences after bad encodings.
  s = s
    .replace(/Â/g, "")
    .replace(/â€™/g, "'")
    .replace(/â€˜/g, "'")
    .replace(/â€œ/g, '"')
    .replace(/â€ /g, '"')
    .replace(/â€“/g, "-")
    .replace(/â€”/g, "-")
    .replace(/â€¦/g, "...")
    .replace(/â„¢/g, "™");

  return s.trim();
}

interface ProductVariation {
  id: string;
  productId: string;
  name: string;
  seller: string;
  sellerId: string;
  image: string;
  variation: string;
  stock: number | "Unlimited";
  price: number;
  compareAtPrice: number;
  status: "Published" | "Unpublished";
  category: string;
  categoryId: string;
  publish: boolean;
  // New fields mapping to user request 1-25
  subCategory: string; // 2
  subSubCategory: string; // 3
  // name is 4
  sku: string; // 5
  rackNumber: string; // 6
  description: string; // 7
  barcode: string; // 8
  hsnCode: string; // 9
  unit: string; // 10 (Pack)
  sizeName: string; // 11
  colorName: string; // 12
  attributeName: string; // 13
  allVariations?: any[];
  taxCategory: string; // 14
  gst: string; // 15
  purchasePrice: number; // 16
  // compareAtPrice is 17 (MRP)
  // price is 18 (Selling Price)
  deliveryTime: string; // 19
  // stock is 20
  offerPrice: number; // 21 (Online Offer Price)
  wholesalePrice: number; // New Wholesale Price
  lowStockQuantity: number; // 22
  brand: string; // 23
  valueMrp: number; // 24
  valuePurchase: number; // 25
}

const STATUS_OPTIONS = ["All Products", "Published", "Unpublished"];
const STOCK_OPTIONS = ["All Products", "In Stock", "Out of Stock", "Unlimited"];

const PRODUCTS_CACHE_TTL_MS = 5 * 60 * 1000;
const productsCache = new Map<
  string,
  {
    products: Product[];
    pagination?: { page?: number; limit?: number; total?: number; pages?: number };
    savedAt: number;
  }
>();

export default function AdminStockManagement() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, token } = useAuth();
  const lastFetchKeyRef = useRef<string>("");
  const staticDataFetchKeyRef = useRef<string>("");
  const fetchSeqRef = useRef(0);
  const prevQueryRef = useRef<{
    search: string;
    category: string;
    seller: string;
    status: string;
  } | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [serverPagination, setServerPagination] = useState<
    { page: number; limit: number; total: number; pages: number } | null
  >(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [savingChanges, setSavingChanges] = useState(false);
  const [changedProductIds, setChangedProductIds] = useState<Set<string>>(new Set());
  const [barcodeSettings, setBarcodeSettings] = useState<any>(null);

  // Scanner State
  const [showScanner, setShowScanner] = useState(false);

  const lastScanRef = useRef({ code: '', time: 0 });
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  // Barcode Selection Modal State
  const [showBarcodeSelectModal, setShowBarcodeSelectModal] = useState(false);
  const [barcodeSelectData, setBarcodeSelectData] = useState<{barcodes: string[], name: string, sp: number, mrp: number} | null>(null);


  const [filterCategory, setFilterCategory] = useState("All Category");
  const [filterSeller, setFilterSeller] = useState("All Sellers");
  const [filterStatus, setFilterStatus] = useState("All Products");
  const [filterStock, setFilterStock] = useState("All Products");
  const [filterRedundant, setFilterRedundant] = useState("None");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [selectedProductDetails, setSelectedProductDetails] = useState<ProductVariation | null>(null);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [sellersList, setSellersList] = useState<Seller[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [selectedProductIdsForShare, setSelectedProductIdsForShare] = useState<Set<string>>(new Set());

  const LIVE_BASE_URL = "https://geeta.today";
  const buildLiveProductUrl = (productId: string) => `${LIVE_BASE_URL}/product/${productId}`;

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 350);
    return () => clearTimeout(handle);
  }, [searchTerm]);

  const fetchStaticData = async () => {
    try {
      const [categoriesResponse, brandsResponse, sellersResponse, subCategoriesResponse, settingsRes] =
        await Promise.all([
          getCategories(),
          getBrands(),
          getSellers(),
          getSubCategories({ limit: 1000 } as any),
          getAppSettings(),
        ]);

      if (categoriesResponse.success) setCategories(categoriesResponse.data);
      if (brandsResponse.success) setBrands(brandsResponse.data);
      if (sellersResponse.success) setSellersList(sellersResponse.data);
      if (subCategoriesResponse.success) setSubCategories(subCategoriesResponse.data);
      if (settingsRes.success && settingsRes.data.barcodeSettings) {
        setBarcodeSettings(settingsRes.data.barcodeSettings);
      }
    } catch (err) {
      console.error("Error fetching stock management static data:", err);
    }
  };

  // Fetch products and categories
  const fetchData = async (opts?: { force?: boolean; silent?: boolean }) => {
    const force = Boolean(opts?.force);
    const silent = Boolean(opts?.silent);
    const cacheKey = `${token || ""}|${debouncedSearchTerm}|${filterCategory}|${filterSeller}|${filterStatus}|${currentPage}|${rowsPerPage}|${filterRedundant}`;
    const cached = productsCache.get(cacheKey);
    if (
      !force &&
      cached &&
      cached.products.length > 0 &&
      Date.now() - cached.savedAt < PRODUCTS_CACHE_TTL_MS
    ) {
      setError(null);
      setHasUnsavedChanges(false);
      setChangedProductIds(new Set());
      setProducts(cached.products);
      if (cached.pagination?.pages) {
        setServerPagination({
          page: Number(cached.pagination.page ?? currentPage),
          limit: Number(cached.pagination.limit ?? rowsPerPage),
          total: Number(cached.pagination.total ?? 0),
          pages: Number(cached.pagination.pages ?? 1),
        });
      }
      setLoading(false);

      // Stale-while-revalidate: show cached immediately, then refresh in background
      // so updates made on other pages reflect without manual refresh.
      void fetchData({ force: true, silent: true });
      return;
    }

    const seq = (fetchSeqRef.current += 1);
    try {
      if (!silent) setLoading(true);
      setError(null);
      setHasUnsavedChanges(false);
      setChangedProductIds(new Set());

      // Server-side pagination: fetch only the current page
      const params: any = {};

      if (debouncedSearchTerm) {
        params.search = debouncedSearchTerm;
      }

      if (filterCategory !== "All Category") {
        params.category = filterCategory;
      }

      if (filterStatus !== "All Products") {
        params.publish = filterStatus === "Published";
      }

      if (filterSeller !== "All Sellers") {
        params.seller = filterSeller;
      }

      if (filterRedundant !== "None") {
        params.redundant = filterRedundant === "All Redundant" ? "true" : filterRedundant.toLowerCase();
      }

      const response = await getProducts({
        ...params,
        page: currentPage,
        limit: rowsPerPage,
      });

      if (!response.success) {
        if (!silent) {
          setError(
            (response as any)?.message ||
              "Failed to load products. Please try again."
          );
          setProducts([]);
        }
        return;
      }

      const pagination = ((response as any)?.pagination as
        | { page?: number; limit?: number; total?: number; pages?: number }
        | undefined) || { page: currentPage, limit: rowsPerPage, total: 0, pages: 1 };

      if (fetchSeqRef.current === seq) {
        setProducts(response.data || []);
        setServerPagination({
          page: Number(pagination.page ?? currentPage),
          limit: Number(pagination.limit ?? rowsPerPage),
          total: Number(pagination.total ?? 0),
          pages: Number(pagination.pages ?? 1),
        });
        productsCache.set(cacheKey, {
          products: response.data || [],
          pagination,
          savedAt: Date.now(),
        });
      }
    } catch (err) {
      console.error("Error fetching products:", err);
      if (!silent) {
        if (err && typeof err === "object" && "response" in err) {
          const axiosError = err as {
            response?: { data?: { message?: string } };
          };
          setError(
            axiosError.response?.data?.message ||
              "Failed to load products. Please try again."
          );
        } else {
          setError("Failed to load products. Please try again.");
        }
      } else if (!products.length) {
        setError("Failed to load products. Please try again.");
      }
    } finally {
      if (!silent && fetchSeqRef.current === seq) setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setLoading(false);
      return;
    }

    const staticDataKey = `${token}|${location.key}`;
    if (staticDataFetchKeyRef.current !== staticDataKey) {
      staticDataFetchKeyRef.current = staticDataKey;
      fetchStaticData();
    }

    const fetchKey = `${token || ""}|${debouncedSearchTerm}|${filterCategory}|${filterSeller}|${filterStatus}|${currentPage}|${rowsPerPage}|${filterRedundant}|${location.key}`;
    if (lastFetchKeyRef.current === fetchKey) return;
    lastFetchKeyRef.current = fetchKey;

    const nextQuery = {
      search: debouncedSearchTerm,
      category: filterCategory,
      seller: filterSeller,
      status: filterStatus,
    };
    const prevQuery = prevQueryRef.current;
    prevQueryRef.current = nextQuery;

    const onlyPagingChanged = !!(
      prevQuery &&
      prevQuery?.search === nextQuery.search &&
      prevQuery?.category === nextQuery.category &&
      prevQuery?.seller === nextQuery.seller &&
      prevQuery?.status === nextQuery.status &&
      (prevQuery as any)?.redundant === filterRedundant
    );

    // Keep scroll position stable: don't swap table with "Loading..." on page changes.
    fetchData({ silent: onlyPagingChanged && products.length > 0 });
  }, [
    isAuthenticated,
    token,
    debouncedSearchTerm,
    filterCategory,
    filterSeller,
    filterStatus,
    currentPage,
    rowsPerPage,
    filterRedundant,
    location.key,
  ]);

  useEffect(() => {
    if (!isAuthenticated || !token) return;

    const handleFocus = () => {
      void fetchData({ force: true, silent: true });
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [isAuthenticated, token, debouncedSearchTerm, filterCategory, filterSeller, filterStatus, currentPage, rowsPerPage, filterRedundant]);

  const handleDelete = async (productId: string) => {
    if (window.confirm("Are you sure you want to delete this product?")) {
      try {
        const response = await deleteProduct(productId);
        if (response.success || response.message === "Product deleted successfully") {
          alert("Product deleted successfully");
          fetchData({ force: true });
        } else {
          alert("Failed to delete product");
        }
      } catch (error) {
        console.error("Error deleting product:", error);
        alert("An error occurred while deleting the product");
      }
    }
  };

  const handleEdit = (productId: string) => {
    navigate(`/admin/product/edit/${productId}`);
  };

  // Inline edit handler
  const handleInlineChange = (productId: string, field: string, value: any) => {
    setProducts((prevProducts) => {
        const newProducts = [...prevProducts];
        const productIndex = newProducts.findIndex((p) => p._id === productId);

        if (productIndex !== -1) {
            newProducts[productIndex] = {
                ...newProducts[productIndex],
                [field]: value,
            };
            // Special handling for legacy field 'publish' vs 'status' string if needed,
            // but AdminStockBulkEdit uses 'publish'.
             if (field === 'status') {
                 // If the table passes "Published", we map it to publish=true
                newProducts[productIndex].publish = value === 'Published';
             }
        }
        return newProducts;
    });

    setChangedProductIds((prev) => {
        const newSet = new Set(prev);
        newSet.add(productId);
        return newSet;
    });
    setHasUnsavedChanges(true);
  };

  const handleSaveChanges = async () => {
    if (changedProductIds.size === 0) return;

    setSavingChanges(true);
    try {
        const promises = Array.from(changedProductIds).map(async (productId) => {
            const product = products.find((p) => p._id === productId);
            if (!product) return;

             // Prepare update data. AdminStockBulkEdit updates:
             // productName, category, compareAtPrice, price, stock, publish.
            const updateData = {
                productName: product.productName,
                subCategory: typeof product.subcategory === 'object' ? String(product.subcategory?._id || "") : String(product.subcategory || ""),
                category: typeof product.category === 'object' && product.category ? product.category._id : product.category,
                compareAtPrice: product.compareAtPrice,
                price: product.price,
                stock: product.stock,
                publish: product.publish,
                discPrice: (product as any).offerPrice || product.price,
            };

            await updateProduct(productId, updateData);
        });

        await Promise.all(promises);
        setChangedProductIds(new Set());
        setHasUnsavedChanges(false);
        alert("Changes saved successfully!");
        fetchData({ force: true }); // Refresh to ensure sync
    } catch (error) {
        console.error("Failed to save changes:", error);
        alert("Failed to save some changes. Please try again.");
    } finally {
        setSavingChanges(false);
    }
  };

  const handleToggleStatus = async (productId: string, currentStatus: boolean) => {
      try {
          const response = await updateProduct(productId, { publish: !currentStatus });
          if (response.success) {
              setProducts(prev => prev.map(p => p._id === productId ? { ...p, publish: !currentStatus } : p));
              fetchData({ force: true, silent: true });
          } else {
              alert("Failed to update status");
          }
      } catch (error) {
          console.error("Error toggling status:", error);
          alert("Failed to update status");
      }
  };


  const handlePrintBarcode = (barcodeVal: string, name?: string, sp?: number, mrp?: number) => {
      if(!barcodeVal || barcodeVal === "-") {
          alert("No barcode found for this product");
          return;
      }

      // Check for multiple barcodes
      if (barcodeVal.includes(',')) {
          const barcodes = barcodeVal.split(',').map(b => b.trim()).filter(b => b);
          if (barcodes.length > 1) {
              setBarcodeSelectData({
                  barcodes,
                  name: name || '',
                  sp: sp || 0,
                  mrp: mrp || 0
              });
              setShowBarcodeSelectModal(true);
              return;
          }
      }

      executePrintBarcode(barcodeVal, name, sp, mrp);
  };

  const executePrintBarcode = (barcodeVal: string, name?: string, sp?: number, mrp?: number) => {
      const qty = 1; // Default to 1 for quick print from list
      const savedSize = localStorage.getItem('barcode_print_size') || 'medium';

      const customSettings = barcodeSettings;
      let containerWidth = 250;
       let barcodeHeight = 55;
       let fontSize = 14;
       let productNameSize = 14;
       let barcodeTextSize = 12;
       let barcodeModuleWidth = 2;
       let pageWidthMm = 50;
       let pageHeightMm = 30;
       let showName = true;
       let showPrice = true;
       let isCustom = false;

       // Barcode readability on label/thermal printers depends heavily on:
       // - Quiet zone (white margin around bars)
       // - Avoiding fractional bar widths (fractional widths get anti-aliased and scanners often fail)
       // If caller accidentally passes "a, b" or a trailing comma, print the first clean token.
       const cleanedBarcodeVal = (barcodeVal || "").toString().split(",")[0].trim();
       const isNumericBarcode = /^[0-9]+$/.test(cleanedBarcodeVal);
       // Prefer EAN13 for 13-digit numeric codes to reduce density on small labels.
       const barcodeFormat = isNumericBarcode && cleanedBarcodeVal.length === 13 ? "EAN13" : "CODE128";
       const showBarcodeValueInSvg = barcodeFormat !== "EAN13";

       if (customSettings) {
           isCustom = true;
           barcodeHeight = customSettings.barcodeHeight;
           fontSize = customSettings.fontSize;
           productNameSize = customSettings.productNameSize;
           if (typeof customSettings.barcodeWidth === 'number') {
               barcodeModuleWidth = customSettings.barcodeWidth;
           }
           showName = customSettings.showName ?? true;
           showPrice = customSettings.showPrice ?? true;
           pageWidthMm = customSettings.width;
           pageHeightMm = customSettings.height;
       }

         if (!isCustom) {
             if (savedSize === 'small') {
                 containerWidth = 200;
                 pageWidthMm = 45;
                 pageHeightMm = 25;
                 barcodeHeight = 32;
                 fontSize = 10;
                 productNameSize = 10;
                 barcodeModuleWidth = 2;
             } else if (savedSize === 'large') {
                 containerWidth = 320;
                 pageWidthMm = 60;
                 pageHeightMm = 35;
                 barcodeHeight = 42;
                 fontSize = 11;
                 productNameSize = 12;
                 barcodeModuleWidth = 2;
             } else {
                 pageWidthMm = 50;
                 pageHeightMm = 30;
                 barcodeHeight = 36;
                 fontSize = 10;
                 productNameSize = 11;
                 barcodeModuleWidth = 2;
             }
         }

       barcodeTextSize = Math.max(9, Math.min(12, Math.round(fontSize * 1.0)));
       if (isCustom) {
           if (typeof customSettings?.barcodeWidth === 'number') {
               barcodeModuleWidth = customSettings.barcodeWidth;
           } else if (customSettings?.width) {
               barcodeModuleWidth = customSettings.width <= 50 ? 2 : 3;
           }
       }

         // Force integer bar width; we'll auto-fallback thinner in the print window if needed.
         const initialBarWidth = Math.max(1, Math.round(barcodeModuleWidth));
         const hasUserBarcodeWidth = isCustom && typeof (customSettings as any)?.barcodeWidth === 'number';

       const maxNameChars = isCustom ? 40 : (savedSize === 'small' ? 22 : savedSize === 'large' ? 45 : 30);
       const fullName = (name || '').toString().trim();
       const displayName = fullName.length > maxNameChars ? `${fullName.slice(0, maxNameChars)}…` : fullName;

      const printWindow = window.open('', '_blank');
      if(!printWindow) {
          alert("Please allow popups to print barcodes");
          return;
      }

      let styleContent = '';
      if (isCustom && customSettings) {
          styleContent = `
              @page {
                size: ${customSettings.width}mm ${customSettings.height}mm;
                margin: 0;
              }
              body {
                  margin: 0;
                  padding: 0;
                  width: ${customSettings.width}mm;
              }
               .barcode-container {
                   width: ${customSettings.width}mm;
                   height: ${customSettings.height}mm;
                   display: flex;
                   flex-direction: column;
                   align-items: stretch;
                   justify-content: flex-start;
                   text-align: left;
                   overflow: hidden;
                   page-break-after: always;
                   box-sizing: border-box;
                   padding: 2mm;
                   gap: 1px;
               }
          `;
       } else {
           styleContent = `
               @page { size: ${pageWidthMm}mm ${pageHeightMm}mm; margin: 0; }
               body { font-family: 'Inter', sans-serif; margin: 0; padding: 0; width: ${pageWidthMm}mm; }
               .barcode-grid { display: block; }
               .barcode-container {
                   text-align: left;
                   border: 0;
                   padding: 2mm;
                   page-break-inside: avoid;
                   page-break-after: always;
                   display: flex;
                   flex-direction: column;
                   align-items: stretch;
                   justify-content: flex-start;
                   width: ${pageWidthMm}mm;
                   height: ${pageHeightMm}mm;
                   background: white;
                   box-sizing: border-box;
                   border-radius: 0;
                   overflow: hidden;
                   gap: 1px;
               }
           `;
       }

      const htmlContent = `
        <html>
          <head>
            <title>Print Barcode</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
              body { font-family: 'Inter', sans-serif; }
              ${styleContent}
                .product-name {
                    font-size: ${productNameSize}px;
                    font-weight: 600;
                    margin: 0 0 1px 0;
                    color: #000;
                    line-height: 1.05;
                    text-transform: none;
                    max-width: 100%;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    display: ${showName ? 'block' : 'none'};
                }
                .price-row {
                    display: ${showPrice ? 'flex' : 'none'};
                    gap: 6px;
                    margin-top: 1px;
                    font-size: ${fontSize}px;
                   font-weight: 700;
                   color: #000;
                   justify-content: space-between;
                   align-items: baseline;
                   white-space: nowrap;
                   width: 100%;
                }
                 .price-item { white-space: nowrap; }
                 .barcode-text {
                     font-size: ${barcodeTextSize}px;
                     font-weight: 700;
                     color: #000;
                     text-align: center;
                     line-height: 1;
                     margin-top: 1px;
                 }
                 svg.barcode {
                     width: auto;
                     height: ${barcodeHeight}px;
                     max-width: 100%;
                     display: block;
                    align-self: center;
                    margin: 0 auto;
                    shape-rendering: crispEdges;
                }
                svg.barcode * { shape-rendering: crispEdges; }
             </style>
             <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
           </head>
           <body>
               <div class="${isCustom ? '' : 'barcode-grid'}">
                  <div class="barcode-container">
                  <div class="product-name">${displayName}</div>
                   <svg class="barcode"
                     jsbarcode-format="${barcodeFormat}"
                     jsbarcode-value="${cleanedBarcodeVal}"
                     jsbarcode-width="${initialBarWidth}"
                     jsbarcode-height="${barcodeHeight}"
                     jsbarcode-textmargin="1"
                     jsbarcode-fontoptions="bold"
                     jsbarcode-displayValue="true"
                     jsbarcode-fontSize="${barcodeTextSize}"
                     jsbarcode-background="#ffffff"
                     jsbarcode-lineColor="#000000"
                     jsbarcode-margin="8">
                   </svg>
                 ${showBarcodeValueInSvg ? '' : `<div class="barcode-text">${cleanedBarcodeVal}</div>`}
                 <div class="price-row">
                     ${customSettings?.mrpLabel ? `<div class="price-item">${customSettings.mrpLabel}:${mrp}</div>` : mrp ? `<div class="price-item">MRP:${mrp}</div>` : ''}
                     ${customSettings?.spLabel ? `<div class="price-item">${customSettings.spLabel}:${sp}</div>` : sp ? `<div class="price-item">SP:${sp}</div>` : ''}
                 </div>
              </div>
             </div>
             <script>
               (function () {
                 var svg = document.querySelector("svg.barcode");
                 var container = document.querySelector(".barcode-container");
                 if (!svg || !container || typeof JsBarcode === "undefined") return;

                 var value = ${JSON.stringify(cleanedBarcodeVal)};
                 var format = ${JSON.stringify(barcodeFormat)};
                 var height = ${barcodeHeight};
                 var fontSize = ${barcodeTextSize};
                 var textMargin = 1;

                  // Try a small set of integer widths/margins, picking the first that fits the label.
                  // If user explicitly set bar width, keep width fixed and only adjust margins.
                  // This avoids browser scaling (anti-aliased bars) while keeping quiet-zone when possible.
                  var tries;
                  if (${hasUserBarcodeWidth ? 'true' : 'false'}) {
                    tries = [
                      { w: ${initialBarWidth}, m: 8 },
                      { w: ${initialBarWidth}, m: 6 },
                      { w: ${initialBarWidth}, m: 0 }
                    ];
                  } else {
                    tries = [
                      { w: ${initialBarWidth}, m: 8 },
                      { w: ${initialBarWidth}, m: 6 },
                      { w: ${initialBarWidth}, m: 0 },
                      { w: Math.max(1, ${initialBarWidth} - 1), m: 0 },
                      { w: 1, m: 0 }
                    ];
                  }

                  function render(cfg) {
                    JsBarcode(svg, value, {
                      format: format,
                      width: cfg.w,
                      height: height,
                      displayValue: ${showBarcodeValueInSvg ? 'true' : 'false'},
                      fontSize: fontSize,
                      fontOptions: "bold",
                      textMargin: textMargin,
                      background: "#ffffff",
                      lineColor: "#000000",
                     margin: cfg.m
                   });
                 }

                 function getSvgAttrWidth() {
                   var w = svg.getAttribute("width");
                   var n = w ? parseFloat(w) : NaN;
                   return isFinite(n) ? n : 0;
                 }

                 var available = container.getBoundingClientRect().width;
                 for (var i = 0; i < tries.length; i++) {
                   render(tries[i]);
                   // Width attribute is in CSS px; compare to container's CSS px width.
                   var rendered = getSvgAttrWidth();
                   if (rendered > 0 && rendered <= available) break;
                 }
               })();
               setTimeout(() => {
                   window.print();
                   window.close();
               }, 800);
             </script>
           </body>
        </html>
      `;
      printWindow.document.write(htmlContent);
      printWindow.document.close();
  };


  // Flatten products with variations into individual rows
  const productVariations = useMemo(() => {
    const variations: ProductVariation[] = [];

    products.forEach((product) => {
      // Helper to safely get properties
      const p: any = product;

      // Category
      let categoryName = "Unknown";
      let categoryId = "";
      if (typeof product.category === "object" && product.category) {
        categoryName = product.category.name || "Unknown";
        categoryId = product.category._id || "";
      } else if (typeof product.category === "string") {
         const catObj = categories.find((c) => c._id === product.category);
         categoryName = catObj?.name || "Unknown";
         categoryId = product.category;
      }

      // SubCategory
      let subCategoryName = "-";
      if (typeof p.subcategory === "object" && p.subcategory) {
        subCategoryName = p.subcategory.name || (p.subcategory as any).subcategoryName || "-";
      } else if (typeof p.subcategory === "string" && p.subcategory && p.subcategory !== "-") {
         // Attempt lookup in subCategories list
         const subObj = subCategories.find(sc => sc._id === p.subcategory);
         subCategoryName = subObj?.name || (subObj as any)?.subcategoryName || p.subcategory;
      }
      // SubSubCategory
      const subSubCategoryName = p.subSubCategory || "-";
      // Brand
      const brandName = typeof p.brand === "object" ? p.brand?.name || "-" : "-";
      // Tax
      const taxName = typeof p.tax === "object" ? p.tax?.name || "-" : "-";
      const gstVal = typeof p.tax === "object" ? p.tax?.percentage + "%" || "-" : "-";

      const sellerObj: any = (product as any).seller;
      const sellerName =
        typeof sellerObj === "object" && sellerObj
          ? sellerObj.storeName || sellerObj.sellerName || "Unknown"
          : "Unknown";
      const sellerId =
        typeof sellerObj === "object" && sellerObj
          ? String(sellerObj._id || "")
          : String(sellerObj || "");

      // Base fields
      const baseVariation = {
        productId: product._id,
        name: fixLikelyMojibake(product.productName),
        seller: sellerName,
        sellerId: sellerId,
        image: product.mainImage || product.galleryImages?.[0] || "",
        category: categoryName,
        categoryId: categoryId,
        subCategory: subCategoryName,
        subSubCategory: subSubCategoryName,
        sku: p.itemCode || p.sku || "", // Item Code (5) (Note: variation might allow specific SKU)
        rackNumber: p.rackNumber || "-",
        description: p.smallDescription || p.description || "-",
        barcode: Array.isArray(p.barcode) ? p.barcode.join(', ') : (p.barcode || "-"),
        hsnCode: p.hsnCode || "-",
        unit: p.pack || "-", // Unit (10)
        taxCategory: taxName,
        gst: gstVal,
        purchasePrice: Number(p.purchasePrice) || 0,
        compareAtPrice: Number(p.compareAtPrice) || 0, // MRP (17)
        price: Number(p.price) || 0, // Selling Price (18),
        deliveryTime: p.deliveryTime || "-",
        wholesalePrice: Number((p as any).wholesalePrice) || 0,
        lowStockQuantity: Number(p.lowStockQuantity) || 5,
        brand: brandName,
        publish: product.publish,
        allVariations: product.variations || [],
      };

      const variationsList = Array.isArray(product.variations)
        ? product.variations
        : [];

      if (variationsList.length > 0) {
        variationsList.forEach((v: any, index: number) => {
          const variationType = v.variationType || v.name || "Standard";
          const variationValue = v.value || v.title || "Default";
          const currentStock = Number(v.stock) || 0;
          const isSize = String(variationType).toLowerCase().includes("size");
          const isColor = String(variationType).toLowerCase().includes("color");
          const variantBarcodes = Array.isArray(v.barcode)
            ? v.barcode
            : v.barcode
              ? [v.barcode]
              : [];

          variations.push({
            ...baseVariation,
            id: `${product._id}-${v._id || index}`,
            variation: `${variationType}: ${variationValue}`,
            stock: currentStock,
            price: Number(v.price) || baseVariation.price,
            compareAtPrice:
              Number(v.compareAtPrice) || baseVariation.compareAtPrice,
            offerPrice:
              Number(v.discPrice) || Number((p as any).discPrice) || 0,
            status: product.publish ? "Published" : "Unpublished",
            sku: v.sku || baseVariation.sku,
            image: v.mainImage || v.image || baseVariation.image,
            barcode: variantBarcodes.length
              ? variantBarcodes.join(", ")
              : "-",
            sizeName: isSize ? variationValue : "-",
            colorName: isColor ? variationValue : "-",
            attributeName: variationType,
            valueMrp:
              (Number(v.compareAtPrice) ||
                Number(baseVariation.compareAtPrice) ||
                0) * currentStock,
            valuePurchase:
              (Number(baseVariation.purchasePrice) || 0) * currentStock,
          });
        });
      } else {
         const currentStock = Number(product.stock) || 0;
         variations.push({
            ...baseVariation,
             id: product._id,
             variation: "Default",
             stock: currentStock,
             offerPrice: Number(p.discPrice) || 0,
             status: product.publish ? "Published" : "Unpublished",
             sizeName: "-",
             colorName: "-",
             attributeName: "-",
             valueMrp: (Number(baseVariation.compareAtPrice) || 0) * currentStock,
             valuePurchase: (Number(baseVariation.purchasePrice) || 0) * currentStock,
         });
      }
    });

    return variations;
  }, [products, categories, subCategories]);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ column }: { column: string }) => (
    <span className="text-neutral-400 text-xs ml-1">
      {sortColumn === column ? (sortDirection === "asc" ? "↑" : "↓") : "⇅"}
    </span>
  );

  const sellerOptions = useMemo(() => {
    const opts = (sellersList || []).map((s: any) => ({
      value: String(s._id || ""),
      label: String(s.storeName || s.sellerName || s._id || "").trim(),
    }));
    const uniq = new Map<string, { value: string; label: string }>();
    for (const o of opts) {
      if (!o.value) continue;
      if (!uniq.has(o.value)) uniq.set(o.value, o);
    }
    return [{ value: "All Sellers", label: "All Sellers" }, ...Array.from(uniq.values())];
  }, [sellersList]);

  // Filter products
  const filteredProducts = useMemo(() => {
    return productVariations.filter((product) => {
      const matchesCategory =
        filterCategory === "All Category" ||
        product.categoryId === filterCategory;
      const matchesSeller =
        filterSeller === "All Sellers" || product.sellerId === filterSeller;
      const matchesStatus =
        filterStatus === "All Products" || product.status === filterStatus;
      const matchesStock =
        filterStock === "All Products" ||
        (filterStock === "Unlimited" && product.stock === "Unlimited") ||
        (filterStock === "In Stock" &&
          product.stock !== "Unlimited" &&
          typeof product.stock === "number" &&
          product.stock > 0) ||
        (filterStock === "Out of Stock" &&
          product.stock !== "Unlimited" &&
          typeof product.stock === "number" &&
          product.stock === 0);
      const matchesSearch =
        (product.name || "").toLowerCase().includes((searchTerm || "").toLowerCase()) ||
        (product.seller || "").toLowerCase().includes((searchTerm || "").toLowerCase()) ||
        (product.sku || "").toLowerCase().includes((searchTerm || "").toLowerCase()) ||
        (Array.isArray(product.barcode)
          ? product.barcode.some((b: string) => String(b).toLowerCase().includes(searchTerm.toLowerCase()))
          : (product.barcode && String(product.barcode).toLowerCase().includes(searchTerm.toLowerCase())));

      return (
        matchesCategory &&
        matchesSeller &&
        matchesStatus &&
        matchesStock &&
        matchesSearch
      );
    });
  }, [
    productVariations,
    filterCategory,
    filterSeller,
    filterStatus,
    filterStock,
    searchTerm,
  ]);

  // Sort products
  const sortedProducts = useMemo(() => {
    if (!sortColumn) return filteredProducts;

    return [...filteredProducts].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortColumn) {
        case "id":
          aValue = a.id;
          bValue = b.id;
          break;
        case "name":
          aValue = (a.name || "").toLowerCase();
          bValue = (b.name || "").toLowerCase();
          break;
        case "seller":
          aValue = (a.seller || "").toLowerCase();
          bValue = (b.seller || "").toLowerCase();
          break;
        case "variation":
          aValue = (a.variation || "").toLowerCase();
          bValue = (b.variation || "").toLowerCase();
          break;
        case "stock":
          aValue = typeof a.stock === "number" ? a.stock : 999999;
          bValue = typeof b.stock === "number" ? b.stock : 999999;
          break;
        case "status":
          aValue = a.status;
          bValue = b.status;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredProducts, sortColumn, sortDirection]);

  const totalPages = Math.max(
    1,
    Number(serverPagination?.pages || Math.ceil(sortedProducts.length / rowsPerPage) || 1)
  );
  const displayedProducts = sortedProducts;

  const totalCount = Number(serverPagination?.total ?? sortedProducts.length);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + displayedProducts.length;

  const displayedProductIds = useMemo(() => {
    const ids = displayedProducts
      .map((p) => p.productId)
      .filter((id): id is string => Boolean(id));
    return Array.from(new Set(ids));
  }, [displayedProducts]);

  const areAllDisplayedSelected =
    displayedProductIds.length > 0 &&
    displayedProductIds.every((id) => selectedProductIdsForShare.has(id));

  const toggleSelectAllDisplayed = () => {
    setSelectedProductIdsForShare((prev) => {
      const next = new Set(prev);
      if (areAllDisplayedSelected) {
        displayedProductIds.forEach((id) => next.delete(id));
      } else {
        displayedProductIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const toggleSelectOne = (productId: string) => {
    setSelectedProductIdsForShare((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const handleShareProducts = async (productIds: string[]) => {
    const uniqueIds = Array.from(new Set(productIds)).filter(Boolean);
    if (uniqueIds.length === 0) return;

    const lines = uniqueIds.map((id) => {
      const p = sortedProducts.find((sp) => sp.productId === id);
      const url = buildLiveProductUrl(id);
      return p?.name ? `${p.name} - ${url}` : url;
    });

    const text = lines.join("\n");
    const singleUrl = uniqueIds.length === 1 ? buildLiveProductUrl(uniqueIds[0]) : undefined;

    try {
      if (navigator.share) {
        const data: ShareData = {
          title: "Geeta Product",
          text,
          ...(singleUrl ? { url: singleUrl } : {}),
        };
        await navigator.share(data);
        return;
      }
    } catch (e) {
      console.log("Error sharing", e);
    }

    try {
      await navigator.clipboard.writeText(text);
      alert("Product link copied to clipboard!");
    } catch (e) {
      console.log("Clipboard copy failed", e);
      alert(text);
    }
  };

  const handleShareSelected = () => {
    handleShareProducts(Array.from(selectedProductIdsForShare));
  };

  const handleExport = () => {
    // Columns exactly matching visible table headers [1-26] + Status
    const headers = [
      "Variation Id",
      "Category",
      "Sub Cat",
      "Sub Sub Cat",
      "Product Name",
      "SKU",
      "Rack",
      "Desc",
      "Barcode",
      "HSN",
      "Unit",
      "Size",
      "Color",
      "Tax Cat",
      "GST",
      "Pur. Price",
      "MRP",
      "Sell Price",
      "Del. Time",
      "Stock",
      "Offer Price",
      "Wholesale Price",
      "Low Stock",
      "Brand",
      "Val (MRP)",
      "Val (Pur)",
      "Status",
    ];

    const escapeCsv = (val: any) => {
        if (val === null || val === undefined) return '';
        const stringVal = String(val);
        // If value contains comma, double quote or newline, wrap in quotes and escape internal quotes
        if (stringVal.includes(',') || stringVal.includes('"') || stringVal.includes('\n')) {
            return `"${stringVal.replace(/"/g, '""')}"`;
        }
        return stringVal;
    };

    const csvContent = [
      headers.join(","),
      ...sortedProducts.map((product) =>
        [
          escapeCsv(product.id),
          escapeCsv(product.category),
          escapeCsv(product.subCategory),
          escapeCsv(product.subSubCategory),
          escapeCsv(product.name),
          escapeCsv(product.sku),
          escapeCsv(product.rackNumber),
          escapeCsv(product.description),
          escapeCsv(product.barcode),
          escapeCsv(product.hsnCode),
          escapeCsv(product.unit),
          escapeCsv(product.sizeName),
          escapeCsv(product.colorName),
          escapeCsv(product.taxCategory),
          escapeCsv(product.gst),
          escapeCsv(product.purchasePrice),
          escapeCsv(product.compareAtPrice),
          escapeCsv(product.price),
          escapeCsv(product.deliveryTime),
          escapeCsv(product.stock),
          escapeCsv(product.offerPrice),
          escapeCsv(product.wholesalePrice),
          escapeCsv(product.lowStockQuantity),
          escapeCsv(product.brand),
          escapeCsv(product.valueMrp),
          escapeCsv(product.valuePurchase),
          escapeCsv(product.publish ? "Active" : "Inactive"),
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `stock_export_${new Date().toISOString().split("T")[0]}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Page Content */}
      <div className="flex-1 p-6">
        {/* Main Panel */}
        <div className="bg-white rounded-lg shadow-sm border border-neutral-200">
          {/* Header */}
          <div className="bg-[var(--primary-color)] text-white px-6 py-4 rounded-t-lg flex justify-between items-center">
            <h2 className="text-lg font-semibold">View Stock Management</h2>
             {hasUnsavedChanges && (
                <button
                    onClick={handleSaveChanges}
                    disabled={savingChanges}
                    className="bg-white text-[var(--primary-color)] px-4 py-1.5 rounded font-bold text-sm hover:bg-neutral-100 transition-colors shadow-sm flex items-center gap-2"
                >
                    {savingChanges ? "Saving..." : "Save Changes"}
                </button>
             )}
          </div>

          {/* Filters and Controls */}
          <div className="p-4 border-b border-neutral-200">
            {/* Filters Row */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Filter By Category
                </label>
                <select
                  value={filterCategory}
                  onChange={(e) => {
                    setFilterCategory(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 border border-neutral-300 rounded text-sm focus:ring-1 focus:ring-[var(--primary-color)] focus:outline-none cursor-pointer">
                  <option value="All Category">All Category</option>
                  {categories.map((cat) => (
                    <option key={cat._id} value={cat._id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Filter by Sellers
                </label>
                <select
                  value={filterSeller}
                  onChange={(e) => {
                    setFilterSeller(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 border border-neutral-300 rounded text-sm focus:ring-1 focus:ring-[var(--primary-color)] focus:outline-none cursor-pointer">
                  {sellerOptions.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Filter by Status
                </label>
                <select
                  value={filterStatus}
                  onChange={(e) => {
                    setFilterStatus(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 border border-neutral-300 rounded text-sm focus:ring-1 focus:ring-[var(--primary-color)] focus:outline-none cursor-pointer">
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Filter by Stock
                </label>
                <select
                  value={filterStock}
                  onChange={(e) => {
                    setFilterStock(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 border border-neutral-300 rounded text-sm focus:ring-1 focus:ring-[var(--primary-color)] focus:outline-none cursor-pointer">
                  {STOCK_OPTIONS.map((stock) => (
                    <option key={stock} value={stock}>
                      {stock}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Redundancy Filter
                </label>
                <select
                  value={filterRedundant}
                  onChange={(e) => {
                    setFilterRedundant(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 border border-neutral-300 rounded text-sm focus:ring-1 focus:ring-[var(--primary-color)] focus:outline-none cursor-pointer">
                  <option value="None">None</option>
                  <option value="All Redundant">All Redundant</option>
                  <option value="Name">Duplicate Name</option>
                  <option value="Barcode">Duplicate Barcode</option>
                  <option value="SKU">Duplicate SKU</option>
                </select>
              </div>
            </div>

            {/* Table Controls */}
            <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:justify-between sm:items-center gap-4">

              {/* Top Row on Mobile: Search & Show */}
              <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
                 <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span className="text-sm text-neutral-600">Show</span>
                    <select
                      value={rowsPerPage}
                      onChange={(e) => {
                        setRowsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="bg-white border border-neutral-300 rounded py-1.5 px-3 text-sm focus:ring-1 focus:ring-[var(--primary-color)] focus:outline-none cursor-pointer">
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value={500}>500</option>
                    </select>
                  </div>

                  <div className="relative w-full sm:w-auto flex items-center gap-1">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-xs">
                        Search:
                      </span>
                      <input
                        type="text"
                        className="pl-14 pr-10 py-2 bg-neutral-100 border-none rounded text-sm focus:ring-1 focus:ring-[var(--primary-color)] w-full sm:w-48"
                        value={searchTerm}
                        onChange={(e) => {
                          setSearchTerm(e.target.value);
                          setCurrentPage(1);
                        }}
                        placeholder="..."
                      />
                      <button
                        onClick={() => {
                          openBarcodeScanner(() => setShowScanner(true));
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-[var(--primary-color)] transition-colors"
                        title="Scan Barcode"
                      >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 7V5a2 2 0 0 1 2-2h2m10 0h2a2 2 0 0 1 2 2v2m0 10v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M7 12h10" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* View Mode Toggle */}
                  <div className="flex items-center gap-1 bg-neutral-100 p-1 rounded">
                    <button
                      onClick={() => setViewMode("list")}
                      className={`p-1.5 rounded transition-all ${viewMode === "list" ? "bg-white text-[var(--primary-color)] shadow-sm" : "text-neutral-500 hover:text-neutral-700"}`}
                      title="List View"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="8" y1="6" x2="21" y2="6"></line>
                        <line x1="8" y1="12" x2="21" y2="12"></line>
                        <line x1="8" y1="18" x2="21" y2="18"></line>
                        <line x1="3" y1="6" x2="3.01" y2="6"></line>
                        <line x1="3" y1="12" x2="3.01" y2="12"></line>
                        <line x1="3" y1="18" x2="3.01" y2="18"></line>
                      </svg>
                    </button>
                    <button
                      onClick={() => setViewMode("grid")}
                      className={`p-1.5 rounded transition-all ${viewMode === "grid" ? "bg-white text-[var(--primary-color)] shadow-sm" : "text-neutral-500 hover:text-neutral-700"}`}
                      title="Grid View"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="7" height="7"></rect>
                        <rect x="14" y="3" width="7" height="7"></rect>
                        <rect x="14" y="14" width="7" height="7"></rect>
                        <rect x="3" y="14" width="7" height="7"></rect>
                      </svg>
                    </button>
                  </div>
              </div>

              {/* Action Buttons: Grid on Mobile, Flex on Desktop */}
              <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex sm:items-center">
                <button
                  onClick={() => navigate("/admin/product/add")}
                  className="bg-[var(--primary-color)] hover:bg-[var(--primary-dark)] text-white px-3 py-2 rounded text-xs font-medium flex items-center justify-center gap-1 transition-colors">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  Add
                </button>
                <button
                  onClick={() => setShowBulkEdit(true)}
                  className="bg-[var(--primary-color)] hover:bg-[var(--primary-dark)] text-white px-3 py-2 rounded text-xs font-medium flex items-center justify-center gap-1 transition-colors">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                  Bulk Edit
                </button>
                <button
                  onClick={() => setShowBulkImport(true)}
                  className="bg-[var(--primary-color)] hover:bg-[var(--primary-dark)] text-white px-3 py-2 rounded text-xs font-medium flex items-center justify-center gap-1 transition-colors"
                >
                   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                  Import
                </button>
                <button
                  onClick={handleExport}
                  className="bg-[var(--primary-color)] hover:bg-[var(--primary-dark)] text-white px-3 py-2 rounded text-xs font-medium flex items-center justify-center gap-1 transition-colors">
                  Export
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>
                <button
                  onClick={handleShareSelected}
                  disabled={selectedProductIdsForShare.size === 0}
                  className={`px-3 py-2 rounded text-xs font-medium flex items-center justify-center gap-1 transition-colors ${
                    selectedProductIdsForShare.size === 0
                      ? "bg-neutral-200 text-neutral-500 cursor-not-allowed"
                      : "bg-[var(--primary-color)] hover:bg-[var(--primary-dark)] text-white"
                  }`}
                  title="Share selected products"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="18" cy="5" r="3"></circle>
                    <circle cx="6" cy="12" r="3"></circle>
                    <circle cx="18" cy="19" r="3"></circle>
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                  </svg>
                  Share{selectedProductIdsForShare.size > 0 ? ` (${selectedProductIdsForShare.size})` : ""}
                </button>
              </div>
            </div>
          </div>

          {/* Table/Grid Toggle Rendering */}
          {loading ? (
            <div className="p-12 text-center text-neutral-400">Loading products...</div>
          ) : error ? (
            <div className="p-12 text-center text-red-600 font-medium">{error}</div>
          ) : displayedProducts.length === 0 ? (
            <div className="p-12 text-center text-neutral-400">No products found.</div>
          ) : viewMode === "list" ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-neutral-50 text-xs font-bold text-neutral-800 border-b border-neutral-200">
                    <th className="p-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={areAllDisplayedSelected}
                        onChange={toggleSelectAllDisplayed}
                        aria-label="Select all displayed products"
                      />
                    </th>
                    <th className="p-4 whitespace-nowrap">Image</th>
                    <th className="p-4 whitespace-nowrap">1. Category</th>
                    <th className="p-4 whitespace-nowrap">2. Sub Cat</th>
                    <th className="p-4 whitespace-nowrap">3. Sub Sub Cat</th>
                    <th className="p-4 whitespace-nowrap">4. Product Name</th>
                    <th className="p-4 whitespace-nowrap">5. SKU</th>
                    <th className="p-4 whitespace-nowrap">6. Rack</th>
                    <th className="p-4 whitespace-nowrap">7. Desc</th>
                    <th className="p-4 whitespace-nowrap">8. Barcode</th>
                    <th className="p-4 whitespace-nowrap">9. HSN</th>
                    <th className="p-4 whitespace-nowrap">10. Unit</th>
                    <th className="p-4 whitespace-nowrap">11. Size</th>
                    <th className="p-4 whitespace-nowrap">12. Color</th>
                    <th className="p-4 whitespace-nowrap">Variations</th>
                    <th className="p-4 whitespace-nowrap">13. Tax Cat</th>
                    <th className="p-4 whitespace-nowrap">14. GST</th>
                    <th className="p-4 whitespace-nowrap">15. Pur. Price</th>
                    <th className="p-4 whitespace-nowrap">16. MRP</th>
                    <th className="p-4 whitespace-nowrap">17. Sell Price</th>
                    <th className="p-4 whitespace-nowrap">18. Del. Time</th>
                    <th className="p-4 whitespace-nowrap">19. Stock</th>
                    <th className="p-4 whitespace-nowrap">20. Offer Price</th>
                    <th className="p-4 whitespace-nowrap">Wholesale Price</th>
                    <th className="p-4 whitespace-nowrap">21. Low Stock</th>
                    <th className="p-4 whitespace-nowrap">22. Brand</th>
                    <th className="p-4 whitespace-nowrap">23. Val (MRP)</th>
                    <th className="p-4 whitespace-nowrap">24. Val (Pur)</th>
                    <th className="p-4 whitespace-nowrap">Status</th>
                    <th className="p-4 whitespace-nowrap">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedProducts.map((product) => (
                    <tr
                      key={product.id}
                      className="hover:bg-neutral-50 transition-colors text-sm text-neutral-700 border-b border-neutral-200"
                    >
                      <td className="p-4 align-middle">
                        <input
                          type="checkbox"
                          checked={selectedProductIdsForShare.has(product.productId)}
                          onChange={() => toggleSelectOne(product.productId)}
                          aria-label={`Select ${product.name}`}
                        />
                      </td>
                      <td className="p-4 align-middle">
                        {product.image ? (
                          <img
                            src={product.image}
                            alt={product.name}
                            className="w-10 h-10 object-cover rounded border border-neutral-200"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="60" height="80"%3E%3Crect width="60" height="80" fill="%23e5e7eb"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%239ca3af" font-size="10"%3ENo Image%3C/text%3E%3C/svg%3E';
                            }}
                          />
                        ) : (
                          <div className="w-10 h-10 bg-neutral-100 rounded flex items-center justify-center text-xs text-neutral-400">
                            No Img
                          </div>
                        )}
                      </td>
                      <td className="p-4 align-middle text-sm text-neutral-600">{product.category}</td>
                      <td className="p-4 align-middle text-sm text-neutral-600">{product.subCategory}</td>
                      <td className="p-4 align-middle text-sm text-neutral-600">{product.subSubCategory}</td>
                      <td className="p-4 align-middle text-sm font-medium text-neutral-800">{product.name}</td>
                      <td className="p-4 align-middle text-sm text-neutral-600">{product.sku}</td>
                      <td className="p-4 align-middle text-sm text-neutral-600">{product.rackNumber}</td>
                      <td
                        className="p-4 align-middle text-sm text-neutral-600 max-w-xs truncate"
                        title={product.description}
                      >
                        {product.description}
                      </td>
                      <td className="p-4 align-middle text-sm text-neutral-600">
                        <div className="flex flex-wrap gap-1">
                          {Array.isArray(product.barcode) ? (
                            product.barcode.map((b: string) => (
                              <span
                                key={b}
                                className="bg-pink-50 text-[var(--primary-dark)] px-2 py-0.5 rounded border border-pink-100/50 text-[10px] font-medium"
                              >
                                {b}
                              </span>
                            ))
                          ) : product.barcode && product.barcode !== "-" ? (
                            product.barcode.split(", ").map((b: string) => (
                              <span
                                key={b}
                                className="bg-pink-50 text-[var(--primary-dark)] px-2 py-0.5 rounded border border-pink-100/50 text-[10px] font-medium"
                              >
                                {b}
                              </span>
                            ))
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 align-middle text-sm text-neutral-600">{product.hsnCode}</td>
                      <td className="p-4 align-middle text-sm text-neutral-600">{product.unit}</td>
                      <td className="p-4 align-middle text-sm text-neutral-600">{product.sizeName}</td>
                      <td className="p-4 align-middle text-sm text-neutral-600">{product.colorName}</td>
                      <td className="p-4 align-middle text-sm text-neutral-600 min-w-[150px]">
                        {product.allVariations && product.allVariations.length > 0 ? (
                          <VariationDropdown variations={product.allVariations} />
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="p-4 align-middle text-sm text-neutral-600">{product.taxCategory}</td>
                      <td className="p-4 align-middle text-sm text-neutral-600">{product.gst}</td>
                      <td className="p-4 align-middle text-sm text-neutral-800 text-right">{product.purchasePrice}</td>
                      <td className="p-4 align-middle text-sm text-neutral-600 text-right">{product.compareAtPrice}</td>
                      <td className="p-4 align-middle text-sm font-medium text-neutral-800 text-right">
                        {product.price}
                      </td>
                      <td className="p-4 align-middle text-sm text-neutral-600">{product.deliveryTime}</td>
                      <td className="p-4 align-middle text-sm font-bold text-neutral-800 text-right">
                        {product.stock}
                      </td>
                      <td className="p-4 align-middle text-sm text-[var(--primary-color)] text-right">
                        {product.offerPrice > 0 ? product.offerPrice : "-"}
                      </td>
                      <td className="p-4 align-middle text-sm text-neutral-800 text-right">
                        {product.wholesalePrice > 0 ? product.wholesalePrice : "-"}
                      </td>
                      <td className="p-4 align-middle text-sm text-neutral-600 text-center">
                        {product.lowStockQuantity}
                      </td>
                      <td className="p-4 align-middle text-sm text-neutral-600">{product.brand}</td>
                      <td className="p-4 align-middle text-sm text-neutral-600 text-right">
                        {product.valueMrp.toLocaleString()}
                      </td>
                      <td className="p-4 align-middle text-sm text-neutral-600 text-right">
                        {product.valuePurchase.toLocaleString()}
                      </td>

                      <td className="p-4 align-middle text-center">
                        <button
                          onClick={() => handleToggleStatus(product.productId, product.publish)}
                          title="Click to toggle status"
                          className={`px-3 py-1 rounded-full text-xs font-semibold transition-all hover:scale-105 active:scale-95 ${
                            product.publish
                              ? "bg-[var(--primary-color)]/10 text-[var(--primary-color)] hover:bg-[var(--primary-color)]/20"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          }`}
                        >
                          {product.publish ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="p-4 align-middle">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEdit(product.productId)}
                            className="p-1 text-[var(--primary-color)] hover:bg-[var(--primary-color)]/20 rounded"
                            title="Edit Details"
                          >
                            <svg
                              width="18"
                              height="18"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(product.productId)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                            title="Delete"
                          >
                            <svg
                              width="18"
                              height="18"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                              <line x1="10" y1="11" x2="10" y2="17"></line>
                              <line x1="14" y1="11" x2="14" y2="17"></line>
                            </svg>
                          </button>
                          <button
                            onClick={() =>
                              handlePrintBarcode(product.barcode, product.name, product.price, product.compareAtPrice)
                            }
                            className="p-1 text-[var(--primary-color)] hover:bg-[var(--primary-color)]/20 rounded"
                            title="Print Barcode"
                          >
                            <svg
                              width="18"
                              height="18"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M3 7V5a2 2 0 0 1 2-2h2"></path>
                              <path d="M17 3h2a2 2 0 0 1 2 2v2"></path>
                              <path d="M21 17v2a2 2 0 0 1-2 2h-2"></path>
                              <path d="M7 21H5a2 2 0 0 1-2-2v-2"></path>
                              <rect x="7" y="7" width="3" height="10"></rect>
                              <rect x="14" y="7" width="3" height="10"></rect>
                              <line x1="11" y1="7" x2="11" y2="17"></line>
                            </svg>
                          </button>
                          <button
                            onClick={() => handleShareProducts([product.productId])}
                            className="p-1 text-[var(--primary-color)] hover:bg-[var(--primary-color)]/20 rounded"
                            title="Share Product"
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="18" cy="5" r="3"></circle>
                              <circle cx="6" cy="12" r="3"></circle>
                              <circle cx="18" cy="19" r="3"></circle>
                              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-3 bg-neutral-50/50">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {displayedProducts.map((product) => (
                  <div
                    key={product.id}
                    className="bg-white rounded-lg border border-neutral-200 overflow-hidden shadow-sm hover:shadow-md transition-all group flex flex-col relative"
                  >
                    <div className="absolute top-1.5 left-1.5 z-10">
                      <input
                        type="checkbox"
                        checked={selectedProductIdsForShare.has(product.productId)}
                        onChange={() => toggleSelectOne(product.productId)}
                        aria-label={`Select ${product.name}`}
                      />
                    </div>
                    {/* Status Badge */}
                    <div className="absolute top-1.5 right-1.5 z-10">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleStatus(product.productId, product.publish);
                        }}
                        className={`px-1.5 py-0.5 rounded-md text-[8px] font-bold shadow-sm transition-all ${
                          product.publish
                            ? "bg-[var(--primary-color)] text-white"
                            : "bg-white text-gray-500 border border-gray-200"
                        }`}
                      >
                        {product.publish ? "ACTIVE" : "OFF"}
                      </button>
                    </div>

                    {/* Product Image */}
                    <div className="aspect-[4/3] bg-white relative overflow-hidden flex items-center justify-center p-1 border-b border-neutral-100">
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="60" height="80"%3E%3Crect width="60" height="80" fill="%23e5e7eb"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%239ca3af" font-size="10"%3ENo Image%3C/text%3E%3C/svg%3E';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full bg-neutral-50 flex flex-col items-center justify-center text-neutral-300 gap-1">
                           <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                              <circle cx="8.5" cy="8.5" r="1.5"></circle>
                              <polyline points="21 15 16 10 5 21"></polyline>
                           </svg>
                        </div>
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="p-2 flex-1 flex flex-col min-h-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[8px] font-bold text-[var(--primary-color)] uppercase truncate max-w-[70%]">
                          {product.category}
                        </span>
                        <button
                          onClick={() => setSelectedProductDetails(product)}
                          className="text-[9px] font-bold text-[var(--primary-dark)] hover:underline"
                        >
                          Edit
                        </button>
                      </div>

                      <h3 className="text-[11px] font-bold text-neutral-900 line-clamp-1 leading-tight mb-1.5" title={product.name}>
                        {product.name}
                      </h3>

                      <div className="grid grid-cols-2 gap-1 mb-2 bg-neutral-50 px-1.5 py-1 rounded">
                        <div className="flex flex-col">
                          <span className="text-[7px] text-neutral-500 font-bold uppercase leading-none mb-0.5">Sell Price</span>
                          <span className="text-[10px] font-black text-neutral-900 leading-none">₹{product.price}</span>
                        </div>
                        <div className="flex flex-col border-l border-neutral-200 pl-1">
                          <span className="text-[7px] text-neutral-500 font-bold uppercase leading-none mb-0.5">Stock</span>
                          <span className={`${typeof product.stock === 'number' && product.stock <= (product.lowStockQuantity || 5) ? 'text-red-600' : 'text-[var(--primary-dark)]'} text-[10px] font-black leading-none`}>
                            {product.stock}
                          </span>
                        </div>
                      </div>

                      {/* Small Info Tags */}
                      <div className="flex flex-wrap gap-0.5 mb-2 mt-auto">
                         {product.sku && (
                           <span className="bg-neutral-100 text-neutral-600 text-[7px] px-1 rounded font-bold truncate max-w-full">S: {product.sku}</span>
                         )}
                         {product.unit && (
                            <span className="bg-[var(--primary-alpha-10)] text-[var(--primary-dark)] text-[7px] px-1 rounded font-bold">{product.unit}</span>
                         )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center justify-between pt-1.5 border-t border-dashed border-neutral-200">
                        <div className="flex gap-1">
                          <button
                            onClick={() => setSelectedProductDetails(product)}
                            className="w-6 h-6 flex items-center justify-center bg-[var(--primary-color)]/10 text-[var(--primary-color)] rounded hover:bg-[var(--primary-color)] hover:text-white transition-all"
                            title="Edit"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                          </button>
                          <button
                            onClick={() => handlePrintBarcode(product.barcode, product.name, product.price, product.compareAtPrice)}
                            className="w-6 h-6 flex items-center justify-center bg-[var(--primary-alpha-10)] text-[var(--primary-dark)] rounded hover:bg-[var(--primary-dark)] hover:text-white transition-all"
                            title="Barcode"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <rect x="7" y="7" width="3" height="10"></rect>
                              <rect x="14" y="7" width="3" height="10"></rect>
                              <line x1="11" y1="7" x2="11" y2="17"></line>
                            </svg>
                          </button>
                          <button
                            onClick={() => handleShareProducts([product.productId])}
                            className="w-6 h-6 flex items-center justify-center bg-[var(--primary-color)]/10 text-[var(--primary-color)] rounded hover:bg-[var(--primary-color)] hover:text-white transition-all"
                            title="Share"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="18" cy="5" r="3"></circle>
                              <circle cx="6" cy="12" r="3"></circle>
                              <circle cx="18" cy="19" r="3"></circle>
                              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                            </svg>
                          </button>
                        </div>
                        <button
                          onClick={() => handleDelete(product.productId)}
                          className="w-6 h-6 flex items-center justify-center bg-red-50 text-red-600 rounded hover:bg-red-600 hover:text-white transition-all"
                          title="Delete"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

            {/* Pagination Footer */}
            <div className="px-4 sm:px-6 py-3 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0">
             <div className="text-xs sm:text-sm text-neutral-700">
              Showing {totalCount === 0 ? 0 : startIndex + 1} to{" "}
              {Math.min(endIndex, totalCount)} of {totalCount} entries
             </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className={`p-2 border border-[var(--primary-color)] rounded ${currentPage === 1
                  ? "text-neutral-400 cursor-not-allowed bg-neutral-50 border-neutral-300"
                  : "text-[var(--primary-color)] hover:bg-[var(--primary-color)]/20"
                  }`}
                aria-label="Previous page">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M15 18L9 12L15 6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <button className="px-3 py-1.5 border border-[var(--primary-color)] bg-[var(--primary-color)] text-white rounded font-medium text-sm">
                {currentPage}
              </button>
              <button
                onClick={() =>
                  setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                }
                disabled={currentPage === totalPages}
                className={`p-2 border border-[var(--primary-color)] rounded ${currentPage === totalPages
                  ? "text-neutral-400 cursor-not-allowed bg-neutral-50 border-neutral-300"
                  : "text-[var(--primary-color)] hover:bg-[var(--primary-color)]/20"
                  }`}
                aria-label="Next page">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M9 18L15 12L9 6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center py-4 text-sm text-neutral-600 border-t border-neutral-200 bg-white">
        Copyright © 2025. Developed By{" "}
        <a href="#" className="text-[var(--primary-color)] hover:underline">
          Geeta Stores - 10 Minute App
        </a>
      </footer>


      {showBulkEdit && (
        <AdminStockBulkEdit
          products={products}
          categories={categories}
          initialPage={currentPage}
          initialLimit={rowsPerPage}
          onClose={() => setShowBulkEdit(false)}
          onSave={() => fetchData({ force: true })}
        />
      )}

      {showBulkImport && (
        <AdminStockBulkImport
           categories={categories}
           onClose={() => setShowBulkImport(false)}
           onSuccess={() => {
              fetchData({ force: true });
           }}
        />
      )}
      {showScanner && (
        <QRScannerModal
          onClose={() => setShowScanner(false)}
          onScanSuccess={(decodedText) => {
            setSearchTerm(decodedText);
            setShowScanner(false);
            setCurrentPage(1);
          }}
        />
      )}

      {/* Barcode Selection Modal */}
      {showBarcodeSelectModal && barcodeSelectData && (
          <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4 backdrop-blur-[2px]">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm animate-in fade-in zoom-in duration-200 overflow-hidden">
                  <div className="bg-[var(--primary-color)] px-4 py-3 text-white flex justify-between items-center">
                      <h3 className="font-bold text-lg">Select Barcode to Print</h3>
                      <button onClick={() => setShowBarcodeSelectModal(false)} className="hover:bg-white/20 p-1 rounded-full transition-colors">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                      </button>
                  </div>
                  <div className="p-4 max-h-[60vh] overflow-y-auto">
                      <p className="text-sm text-gray-600 mb-3 font-medium">This product has multiple barcodes. Please select one to print:</p>
                      <div className="space-y-2">
                          {barcodeSelectData.barcodes.map((b, idx) => (
                              <button
                                  key={idx}
                                  onClick={() => {
                                      setShowBarcodeSelectModal(false);
                                      executePrintBarcode(b, barcodeSelectData.name, barcodeSelectData.sp, barcodeSelectData.mrp);
                                  }}
                                  className="w-full text-left bg-gray-50 hover:bg-[var(--primary-color)]/10 border border-gray-200 hover:border-[var(--primary-color)] p-3 rounded-lg group transition-all"
                              >
                                  <div className="flex justify-between items-center">
                                      <span className="font-mono text-base font-bold text-gray-800 group-hover:text-[var(--primary-color)]">{b}</span>
                                      <svg className="w-5 h-5 text-gray-400 group-hover:text-[var(--primary-color)] opacity-0 group-hover:opacity-100 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9l-5 5-5-5"></path>
                                      </svg>
                                  </div>
                              </button>
                          ))}
                      </div>
                  </div>
                  <div className="p-3 bg-gray-50 text-center border-t border-gray-100">
                      <button
                          onClick={() => setShowBarcodeSelectModal(false)}
                          className="px-6 py-2 border border-gray-300 rounded-lg text-gray-600 font-medium hover:bg-gray-100 transition-colors text-sm"
                      >
                          Cancel
                      </button>
                  </div>
              </div>
          </div>
      )}
      {/* Product Details Modal (Editable) */}
      {selectedProductDetails && (
        <div className="fixed inset-0 bg-black/60 z-[120] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl animate-in fade-in zoom-in duration-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-[var(--primary-color)] px-6 py-4 text-white flex justify-between items-center sticky top-0 z-10">
              <div>
                <h3 className="font-bold text-xl uppercase tracking-tight leading-none">Edit Product Details</h3>
                <p className="text-[10px] opacity-90 mt-1 font-medium tracking-wide">QUICK EDIT MODE</p>
              </div>
              <button onClick={() => setSelectedProductDetails(null)} className="hover:bg-white/20 p-1.5 rounded-full transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto bg-gray-50 flex-1">
              {/* Top Summary Card */}
              <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm mb-6 flex flex-col md:flex-row gap-6">
                <div className="w-full md:w-32 aspect-square rounded-lg border border-neutral-100 overflow-hidden bg-white flex items-center justify-center relative group">
                  {selectedProductDetails.image ? (
                    <img src={selectedProductDetails.image} alt="" className="w-full h-full object-contain" />
                  ) : (
                    <div className="text-neutral-300"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg></div>
                  )}
                </div>
                <div className="flex-1 flex flex-col gap-3">
                  <div className="flex flex-col">
                    <label className="text-[10px] font-bold text-neutral-500 uppercase mb-1">Product Name</label>
                    <input 
                      type="text"
                      className="text-lg font-black text-neutral-900 border-none p-0 focus:ring-0 w-full bg-transparent placeholder-neutral-300"
                      value={selectedProductDetails.name}
                      onChange={(e) => setSelectedProductDetails({...selectedProductDetails, name: e.target.value})}
                      placeholder="Enter Product Name"
                    />
                  </div>
                  <div className="flex flex-wrap gap-4">
                     <div className="flex flex-col">
                        <label className="text-[10px] font-bold text-neutral-500 uppercase mb-1">Category</label>
                        <select 
                          className="text-xs font-bold text-[var(--primary-color)] border border-neutral-200 rounded px-2 py-1 bg-white focus:ring-1 focus:ring-[var(--primary-color)]"
                          value={selectedProductDetails.categoryId}
                          onChange={(e) => {
                            const cat = categories.find(c => c._id === e.target.value);
                            setSelectedProductDetails({...selectedProductDetails, categoryId: e.target.value, category: cat?.name || ""})
                          }}
                        >
                          {categories.map(cat => <option key={cat._id} value={cat._id}>{cat.name}</option>)}
                        </select>
                     </div>
                     <div className="flex flex-col">
                        <label className="text-[10px] font-bold text-neutral-500 uppercase mb-1">Status</label>
                        <select 
                          className={`text-xs font-bold border rounded px-2 py-1 bg-white focus:ring-1 focus:ring-[var(--primary-color)] ${selectedProductDetails.publish ? 'text-[var(--primary-dark)] border-green-100' : 'text-gray-400 border-gray-100'}`}
                          value={selectedProductDetails.publish ? 'true' : 'false'}
                          onChange={(e) => setSelectedProductDetails({...selectedProductDetails, publish: e.target.value === 'true'})}
                        >
                          <option value="true">ACTIVE</option>
                          <option value="false">INACTIVE</option>
                        </select>
                     </div>
                  </div>
                </div>
              </div>

              {/* Data Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { label: "SKU", value: selectedProductDetails.sku, key: 'sku' },
                  { label: "Unit (Pack)", value: selectedProductDetails.unit, key: 'unit' },
                  { label: "Sub Category", value: String(selectedProductDetails.subCategory || ""), key: 'subCategory', type: 'select', 
                    options: subCategories.filter(sc => {
                      const subCatProp = sc.category; 
                      const subCatId = String((typeof subCatProp === 'object' && subCatProp) ? (subCatProp as any)._id : (subCatProp || "")).trim().toLowerCase();
                      const subCatName = String((typeof subCatProp === 'object' && subCatProp) ? (subCatProp as any).name || (subCatProp as any).categoryName : (subCatProp || "")).trim().toLowerCase();
                      
                      const targetCatRef = String(selectedProductDetails.categoryId || "").trim().toLowerCase();
                      if (!targetCatRef) return true;
                      
                      const isId = /^[0-9a-fA-F]{24}$/.test(targetCatRef);
                      if (isId && subCatId === targetCatRef) return true;
                      if (subCatName === targetCatRef) return true;
                      
                      const matchedCat = categories.find(c => 
                        String(c._id).toLowerCase() === targetCatRef || 
                        String(c.name || (c as any).categoryName || "").trim().toLowerCase() === targetCatRef
                      );
                      if (matchedCat) {
                        if (subCatId === matchedCat._id.toLowerCase()) return true;
                        if (subCatName === String(matchedCat.name || (matchedCat as any).categoryName || "").trim().toLowerCase()) return true;
                      }
                      return false;
                    }).map(s => ({ 
                      id: s._id, 
                      label: String((s as any).name || (s as any).subcategoryName || (s as any).name || "-"), 
                      value: s._id 
                    })) 
                  },
                  { label: "Brand", value: selectedProductDetails.brand, key: 'brand', type: 'select', options: brands.map(b => b.name) },
                  { label: "Rack Number", value: selectedProductDetails.rackNumber, key: 'rackNumber' },
                  { label: "Barcode", value: selectedProductDetails.barcode, key: 'barcode' },
                  { label: "HSN Code", value: selectedProductDetails.hsnCode, key: 'hsnCode' },
                  { label: "Size", value: selectedProductDetails.sizeName, key: 'sizeName' },
                  { label: "Color", value: selectedProductDetails.colorName, key: 'colorName' },
                  { label: "Stock", value: selectedProductDetails.stock, key: 'stock', type: 'number', color: 'text-[var(--primary-dark)]' },
                  { label: "Low Stock Alert", value: selectedProductDetails.lowStockQuantity, key: 'lowStockQuantity', type: 'number' },
                  { label: "MRP", value: selectedProductDetails.compareAtPrice, key: 'compareAtPrice', type: 'number', prefix: '₹' },
                  { label: "Selling Price", value: selectedProductDetails.price, key: 'price', type: 'number', prefix: '₹', color: 'text-[var(--primary-color)]' },
                  { label: "Purchase Price", value: selectedProductDetails.purchasePrice, key: 'purchasePrice', type: 'number', prefix: '₹' },
                  { label: "Wholesale Price", value: selectedProductDetails.wholesalePrice, key: 'wholesalePrice', type: 'number', prefix: '₹' },
                  { label: "Offer Price", value: selectedProductDetails.offerPrice, key: 'offerPrice', type: 'number', prefix: '₹' },
                  { label: "GST %", value: selectedProductDetails.gst, key: 'gst' },
                  { label: "Delivery Time", value: selectedProductDetails.deliveryTime, key: 'deliveryTime' },
                ].map((item, idx) => (
                  <div key={idx} className="bg-white p-3 rounded-lg border border-neutral-100 shadow-sm flex flex-col">
                    <label className="text-[9px] font-bold text-neutral-500 uppercase tracking-tighter mb-1">{item.label}</label>
                    <div className="flex items-center">
                      {item.prefix && <span className="text-sm font-bold text-neutral-400 mr-1">{item.prefix}</span>}
                      {item.type === 'select' ? (
                        <select 
                          className={`w-full text-sm font-medium border-none p-0 focus:ring-0 bg-transparent ${item.color || 'text-neutral-800'}`}
                          value={item.value}
                          onChange={(e) => setSelectedProductDetails({...selectedProductDetails, [item.key!]: e.target.value})}
                        >
                          <option value="-">-</option>
                          {item.options?.map((opt: any) => {
                            const val = typeof opt === 'object' ? opt.value : opt;
                            const label = typeof opt === 'object' ? opt.label : opt;
                            return <option key={val} value={val}>{label}</option>;
                          })}
                        </select>
                      ) : (
                        <input 
                          type={item.type || 'text'}
                          className={`w-full text-sm font-medium border-none p-0 focus:ring-0 bg-transparent ${item.color || 'text-neutral-800'}`}
                          value={item.value === "-" ? "" : item.value}
                          onChange={(e) => setSelectedProductDetails({...selectedProductDetails, [item.key!]: item.type === 'number' ? Number(e.target.value) : e.target.value})}
                          placeholder="-"
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Description */}
              <div className="mt-6 bg-white p-4 rounded-xl border border-neutral-200 shadow-sm">
                <label className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-2 block">Description</label>
                <textarea 
                  className="w-full text-sm text-neutral-700 leading-relaxed italic border-none p-0 focus:ring-0 bg-transparent resize-none min-h-[60px]"
                  value={selectedProductDetails.description === "-" ? "" : selectedProductDetails.description}
                  onChange={(e) => setSelectedProductDetails({...selectedProductDetails, description: e.target.value})}
                  placeholder="Enter product description..."
                />
              </div>

              {/* Inventory Valuation (Read Only) */}
              <div className="mt-6 grid grid-cols-2 gap-4">
                <div className="bg-pink-50/50 p-3 rounded-lg border border-pink-100 flex items-center justify-between opacity-80">
                  <span className="text-xs font-bold text-[var(--primary-color)]">Inventory (MRP Value)</span>
                  <span className="text-sm font-black text-[var(--primary-color)]">₹{(typeof selectedProductDetails.stock === 'number' ? selectedProductDetails.stock * selectedProductDetails.compareAtPrice : 0).toLocaleString()}</span>
                </div>
                <div className="bg-neutral-100 p-3 rounded-lg border border-neutral-200 flex items-center justify-between opacity-80">
                  <span className="text-xs font-bold text-neutral-600">Inventory (Pur Value)</span>
                  <span className="text-sm font-black text-neutral-800">₹{(typeof selectedProductDetails.stock === 'number' ? selectedProductDetails.stock * selectedProductDetails.purchasePrice : 0).toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-white border-t border-neutral-100 flex justify-end gap-3">
              <button
                onClick={() => setSelectedProductDetails(null)}
                className="px-6 py-2 border border-neutral-300 rounded-lg text-neutral-600 font-bold hover:bg-neutral-50 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleEdit(selectedProductDetails.productId);
                  setSelectedProductDetails(null);
                }}
                className="px-6 py-2 border border-[var(--primary-color)] text-[var(--primary-color)] rounded-lg font-bold hover:bg-[var(--primary-color)]/5 transition-colors text-sm"
              >
                Full Edit
              </button>
              <button
                disabled={isSavingProduct}
                onClick={async () => {
                   setIsSavingProduct(true);
                   try {
                     const product = products.find(p => p._id === selectedProductDetails.productId);
                     if (!product) return;
                     
                     const variations = Array.isArray(product.variations) ? [...product.variations] : [];
                     
                     const updateData: any = {
                        productName: selectedProductDetails.name,
                        price: Number(selectedProductDetails.price),
                        compareAtPrice: Number(selectedProductDetails.compareAtPrice),
                        stock: Number(selectedProductDetails.stock) || 0,
                        publish: selectedProductDetails.publish,
                        category: selectedProductDetails.categoryId,
                        subcategory: subCategories.find(s => s.name === selectedProductDetails.subCategory)?._id || undefined,
                        brand: brands.find(b => b.name === selectedProductDetails.brand)?._id || undefined,
                        sku: selectedProductDetails.sku,
                        rackNumber: selectedProductDetails.rackNumber,
                        hsnCode: selectedProductDetails.hsnCode,
                        pack: selectedProductDetails.unit,
                        purchasePrice: Number(selectedProductDetails.purchasePrice),
                        deliveryTime: selectedProductDetails.deliveryTime,
                        lowStockQuantity: Number(selectedProductDetails.lowStockQuantity),
                        smallDescription: selectedProductDetails.description,
                        description: selectedProductDetails.description,
                        wholesalePrice: Number(selectedProductDetails.wholesalePrice),
                        discPrice: Number(selectedProductDetails.offerPrice) || Number(selectedProductDetails.price),
                        barcode: typeof selectedProductDetails.barcode === 'string' ? selectedProductDetails.barcode.split(',').map(b => b.trim()).filter(b => b) : selectedProductDetails.barcode,
                        variations: variations.length > 0 ? variations : undefined,
                     };

                     // Handle variation updates if needed
                     if (product.variations && product.variations.length > 0 && selectedProductDetails.id.includes('-')) {
                        const vIndex = parseInt(selectedProductDetails.id.split('-')[1]);
                        if (!isNaN(vIndex)) {
                           const newVariations = [...product.variations];
                           newVariations[vIndex] = {
                              ...newVariations[vIndex],
                              price: Number(selectedProductDetails.price),
                              stock: typeof selectedProductDetails.stock === 'number' ? selectedProductDetails.stock : (newVariations[vIndex] as any).stock,
                              compareAtPrice: Number(selectedProductDetails.compareAtPrice),
                              sku: selectedProductDetails.sku,
                              discPrice: Number(selectedProductDetails.offerPrice),
                           };
                           updateData.variations = newVariations;
                        }
                     }

                      const res = await updateProduct(selectedProductDetails.productId, updateData);
                      if (res.success) {
                         alert("Product updated successfully!");
                         fetchData({ force: true });
                         setSelectedProductDetails(null);
                      } else {
                         alert("Failed to update product");
                      }
                   } catch (err) {
                     console.error(err);
                     alert("An error occurred");
                   } finally {
                     setIsSavingProduct(false);
                   }
                }}
                className="px-6 py-2 bg-[var(--primary-color)] text-white rounded-lg font-bold hover:bg-[var(--primary-dark)] transition-colors text-sm flex items-center gap-2"
              >
                {isSavingProduct ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </>
                ) : "Save Product"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
