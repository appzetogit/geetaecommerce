import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { uploadImage, uploadImages } from "../../../services/api/uploadService";
import {
  validateImageFile,
  createImagePreview,
} from "../../../utils/imageUpload";
import {
  createProduct,
  updateProduct,
  getProductById,
  getSellers,
  approveProductRequest,
  bulkImportProducts,
  bulkUpdateProducts,
  updateProductOrder,
  uploadImage as uploadImageLegacy,
  Product,
  getProducts as fetchProducts,
  getSubCategories as getSubCategoriesAdmin,
} from "../../../services/api/admin/adminProductService";
import { getAttributes } from "../../../services/api/admin/attributeService";
import { getVariationTypes } from "../../../services/api/admin/adminVariationTypeService";
import { ProductVariation, Shop, searchProductImage } from "../../../services/api/productService";
import {
  getCategories,
  getSubSubCategories,
  Category,
  SubCategory,
  SubSubCategory,
} from "../../../services/api/categoryService";
import { getActiveTaxes, Tax } from "../../../services/api/taxService";
import { getBrands, Brand } from "../../../services/api/brandService";
import {
  getHeaderCategoriesPublic,
  HeaderCategory,
} from "../../../services/api/headerCategoryService";

import ThemedDropdown from "../components/ThemedDropdown";
import QRScannerModal from "../../../components/QRScannerModal";

import { getAppSettings } from "../../../services/api/admin/adminSettingsService";

import UnitSelectionModal from "../../../components/UnitSelectionModal";

export default function AdminAddProduct() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [isProductLoaded, setIsProductLoaded] = useState(false);
  const [showSEO, setShowSEO] = useState(false);
  const [showAdditionalDetails, setShowAdditionalDetails] = useState(false);
  const [showVariations, setShowVariations] = useState(true);
  const [showStoreVisibility, setShowStoreVisibility] = useState(true);

  // Dynamic Product Settings
  const [productDisplaySettings, setProductDisplaySettings] = useState<any[]>([]);

  const shouldShowField = (fieldId: string) => {
    // If settings haven't loaded or are empty, default to Showing Everything (safer)
    if (!productDisplaySettings || productDisplaySettings.length === 0) return true;

    for (const section of productDisplaySettings) {
        if (section.fields) {
            const field = section.fields.find((f: any) => f.id === fieldId);
            if (field) {
                return field.isEnabled;
            }
        }
    }
    // If field is not found in settings configuration (e.g. new field), show it by default
    return true;
  };

  const [formData, setFormData] = useState({
    productName: "",
    headerCategory: "",
    category: "",
    subcategory: "",
    subSubCategory: "",
    publish: "Yes",
    popular: "No",
    dealOfDay: "No",
    brand: "",
    tags: "",
    smallDescription: "",
    seoTitle: "",
    seoKeywords: "",
    seoImageAlt: "",
    seoDescription: "",
    variationType: "",
    variationName: "",
    manufacturer: "",
    madeIn: "",
    tax: "",
    isReturnable: "No",
    maxReturnDays: "",
    fssaiLicNo: "",
    totalAllowedQuantity: "10",
    mainImageUrl: "",
    galleryImageUrls: [] as string[],
    isShopByStoreOnly: "No",
    shopId: "",
    pack: "",
    barcode: [] as string[],
    itemCode: "", // sku alias
    rackNumber: "",
    hsnCode: "",
    purchasePrice: "",
    weight: "",
    mfgDate: "",
    expiryDate: "",
    lowStockQuantity: "5",
    deliveryTime: "",
    price: "",
    compareAtPrice: "",
    discPrice: "0",
    stock: "0",
    offerPrice: "",
    wholesalePrice: "",
  });

  const [variations, setVariations] = useState<ProductVariation[]>([]);
  const [variationForm, setVariationForm] = useState({
    title: "",
    price: "",
    compareAtPrice: "",
    discPrice: "0",
    stock: "0",
    status: "Available" as "Available" | "Sold out",
    barcode: [] as string[],
    offerPrice: "",
    wholesalePrice: "",
    tieredPrices: [] as { minQty: string, price: string }[],
    image: "",
  });

  interface GalleryItem {
    id: string;
    url: string;
    file?: File;
    isExisting: boolean;
  }

  const [mainImageFile, setMainImageFile] = useState<File | null>(null);
  const [mainImagePreview, setMainImagePreview] = useState<string>("");
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [isScanning, setIsScanning] = useState(false);
  const [scanTarget, setScanTarget] = useState<"product" | "variation" | "table-variation" | "sku" | "check-exists">("product");
  const [scanTargetIndex, setScanTargetIndex] = useState<number | null>(null);
  const [foundProduct, setFoundProduct] = useState<any>(null);
  const [editingVariationIndex, setEditingVariationIndex] = useState<number | null>(null);
  const [showProductFoundModal, setShowProductFoundModal] = useState(false);
  const [currentBarcode, setCurrentBarcode] = useState("");
  const [currentVarBarcode, setCurrentVarBarcode] = useState("");
  const [currentTableVarBarcode, setCurrentTableVarBarcode] = useState<Record<number, string>>({});
   // Image Search State
   const [imageSearchQuery, setImageSearchQuery] = useState("");
   const [searchedImage, setSearchedImage] = useState("");
   const [isSearchingImage, setIsSearchingImage] = useState(false);
   const [showImageSourceModal, setShowImageSourceModal] = useState(false);
   const [productSearchQuery, setProductSearchQuery] = useState("");
   const [productSuggestions, setProductSuggestions] = useState<any[]>([]);
   const [isSearchingProducts, setIsSearchingProducts] = useState(false);
   const mainImageInputRef = React.useRef<HTMLInputElement>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<SubCategory[]>([]);
  const [subSubCategories, setSubSubCategories] = useState<SubSubCategory[]>([]);
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [headerCategories, setHeaderCategories] = useState<HeaderCategory[]>(
    []
  );
  const [shops, setShops] = useState<Shop[]>([]);

  // Print Barcode State
  const [printQuantity, setPrintQuantity] = useState("1");
  const [selectedPrintBarcode, setSelectedPrintBarcode] = useState("");
  const [barcodeSettings, setBarcodeSettings] = useState<any>(null);

  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);

  // Attribute Based Variations State
  const [enableAttributes, setEnableAttributes] = useState(false);
  const [availableAttributes, setAvailableAttributes] = useState<any[]>([]);
  const [selectedAttributeId, setSelectedAttributeId] = useState("");
  const [selectedAttributes, setSelectedAttributes] = useState<{id: string, name: string, values: string[]}[]>([]);
  const [variationUnits, setVariationUnits] = useState<string[]>([]); // To store unit values like 1kg, 5kg
  const [currentUnitInput, setCurrentUnitInput] = useState("");
  const [attrInputValues, setAttrInputValues] = useState<Record<string, string>>({});
  const [currentAttrValueInput, setCurrentAttrValueInput] = useState(""); // Deprecated/Backup
  const [availableVariationTypes, setAvailableVariationTypes] = useState<any[]>([]);

  // Color specific state
  const [enableColors, setEnableColors] = useState(false);
  const [selectedColors, setSelectedColors] = useState<{name: string, code: string}[]>([]);
  const [colorInput, setColorInput] = useState({ name: "", code: "#000000" });

  // Unit Pricing Modal State
  const [unitPricingModal, setUnitPricingModal] = useState<{ isOpen: boolean, variationIndex: number | null }>({ isOpen: false, variationIndex: null });
  // Temp state for editing in modal
  const [tempTieredPrices, setTempTieredPrices] = useState<{ minQty: number, price: number }[]>([]);
  const prevHeaderCategoryRef = useRef<string>("");

  useEffect(() => {
    if (enableAttributes) {
        getAttributes().then(res => {
            if(res.success) setAvailableAttributes(res.data);
        }).catch(err => console.error(err));
    }
  }, [enableAttributes]);

  useEffect(() => {
    // Fetch admin variation types on component mount
    getVariationTypes().then(res => {
        if(res.success) setAvailableVariationTypes(res.data);
    }).catch(err => console.error(err));
  }, []);

  useEffect(() => {
    const fetchSettings = async () => {
        try {
            const response = await getAppSettings();
            if (response.success) {
                // Product Display Settings
                if (response.data?.productDisplaySettings) {
                    setProductDisplaySettings(response.data.productDisplaySettings);
                }

                // Barcode Settings
                if (response.data?.barcodeSettings) {
                    setBarcodeSettings(response.data.barcodeSettings);
                }
            }
        } catch (error) {
            console.error("Failed to fetch app settings", error);
        }
    };
    fetchSettings();
  }, []);

  // Reference to track who initiated the last update to prevent infinite loops and race conditions
  const lastSyncInitiatorRef = useRef<"root" | "variation" | null>(null);

  // Consolidated Product-Variation Synchronization
  // This effect ensures that for single-variation products (Simple Products),
  // the top-level pricing/stock fields stay in sync with the variation's fields.
  useEffect(() => {
    if (variations.length !== 1) {
        lastSyncInitiatorRef.current = null;
        return;
    }

    const v = variations[0];
    const isDefaultLikeVariation =
      String(v.title || v.value || "").trim().toLowerCase() === "default";
    const hasExplicitVariationSetup =
      Boolean(formData.variationType?.trim()) ||
      Boolean(formData.variationName?.trim()) ||
      !isDefaultLikeVariation;

    // Only keep root<->variation fields in sync for simple/default products.
    // Real named variations should not overwrite the main product fields.
    if (hasExplicitVariationSetup && !isDefaultLikeVariation) {
        lastSyncInitiatorRef.current = null;
        return;
    }

    const rootPriceNum = parseFloat(formData.price || "0") || 0;
    const rootCompareAtPriceNum = parseFloat(formData.compareAtPrice || "0") || 0;
    const rootStockNum = parseInt(formData.stock || "0") || 0;
    const rootOfferPriceNum = formData.offerPrice ? (parseFloat(formData.offerPrice) || 0) : undefined;
    const rootWholesalePriceNum = parseFloat(formData.wholesalePrice || "0") || 0;

    // Check if Root is different from Variation
    const isDifferent =
      v.price !== rootPriceNum ||
      v.compareAtPrice !== rootCompareAtPriceNum ||
      v.stock !== rootStockNum ||
      v.offerPrice !== rootOfferPriceNum ||
      v.wholesalePrice !== rootWholesalePriceNum;

    if (!isDifferent) {
        lastSyncInitiatorRef.current = null;
        return;
    }

    // Determine target based on what changed (or use initiator if set)
    // If we just added/modified a variation explicitly in the variation form/list,
    // we should trust the variation and update the root.
    // If the user modified the top-level form, we update the variation.

    // Safety check: If variation has a custom title (not Default), and price is 0/empty in top level,
    // definitely sync from variation to root.
    const isCustomVar = v.title && v.title !== "Default";

    if (lastSyncInitiatorRef.current === "variation" || (isCustomVar && rootPriceNum === 0)) {
        // Sync Variation -> Root
        setFormData(prev => ({
            ...prev,
            price: (v.price || 0).toString(),
            compareAtPrice: (v.compareAtPrice || 0).toString(),
            stock: (v.stock || 0).toString(),
            offerPrice: (v.offerPrice || "").toString(),
            wholesalePrice: (v.wholesalePrice || 0).toString()
        }));
        lastSyncInitiatorRef.current = null;
    } else {
        // Default: Sync Root -> Variation (handles top-form edits)
        setVariations(prev => {
          if (prev.length !== 1) return prev;
          return [{
            ...prev[0],
            price: rootPriceNum,
            compareAtPrice: rootCompareAtPriceNum,
            stock: rootStockNum,
            offerPrice: rootOfferPriceNum,
            wholesalePrice: rootWholesalePriceNum,
            discPrice: rootOfferPriceNum || rootPriceNum
          }];
        });
        lastSyncInitiatorRef.current = null;
    }
  }, [
    formData.price,
    formData.compareAtPrice,
    formData.stock,
    formData.offerPrice,
    formData.wholesalePrice,
    formData.variationType,
    formData.variationName,
    variations
  ]);


  const handlePrintBarcode = (barcodeVal: string, qty: number, name?: string, sp?: number, mrp?: number) => {
    if(!barcodeVal) return;

    // Use dynamic settings if available, else fallback to defaults/localStorage
    const savedCustom = localStorage.getItem('barcode_printer_settings');
    const savedSize = localStorage.getItem('barcode_print_size') || 'medium';

    let customSettings = barcodeSettings; // Prefer DB settings
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
    // If barcode is stored like "a, b", print the first clean token.
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
    } else if (savedCustom) {
        try {
            customSettings = JSON.parse(savedCustom);
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
        } catch (e) { console.error(e); }
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
          <title>Print Barcodes</title>
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
                 word-wrap: break-word;
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
                 width: 100%;
             }
             .price-item {
                 display: flex;
                 align-items: center;
                 white-space: nowrap;
             }
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
          ${Array(qty).fill(0).map(() => `
            <div class="barcode-container">
              <div class="product-name">${name || ''}</div>
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
                   ${barcodeSettings?.mrpLabel ? `<div class="price-item">${barcodeSettings.mrpLabel}:${mrp}</div>` : mrp ? `<div class="price-item">MRP:${mrp}</div>` : ''}
                   ${barcodeSettings?.spLabel ? `<div class="price-item">${barcodeSettings.spLabel}:${sp}</div>` : sp ? `<div class="price-item">SP:${sp}</div>` : ''}
               </div>
             </div>
          `).join('')}
          </div>
          <script>
            (function () {
              var svgs = document.querySelectorAll("svg.barcode");
              if (!svgs || !svgs.length || typeof JsBarcode === "undefined") return;

              var value = ${JSON.stringify(cleanedBarcodeVal)};
              var format = ${JSON.stringify(barcodeFormat)};
              var height = ${barcodeHeight};
              var fontSize = ${barcodeTextSize};
              var textMargin = 1;

               // Try a small set of integer widths/margins, picking the first that fits each label.
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

               function render(svg, cfg) {
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

              function getSvgAttrWidth(svg) {
                var w = svg.getAttribute("width");
                var n = w ? parseFloat(w) : NaN;
                return isFinite(n) ? n : 0;
              }

              svgs.forEach(function (svg) {
                var container = svg.closest ? svg.closest(".barcode-container") : null;
                var available = container ? container.getBoundingClientRect().width : 0;
                for (var i = 0; i < tries.length; i++) {
                  render(svg, tries[i]);
                  var rendered = getSvgAttrWidth(svg);
                  if (!available) break;
                  if (rendered > 0 && rendered <= available) break;
                }
              });
            })();
            // Auto print after a short delay
            setTimeout(() => {
                window.print();
            }, 800);
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Use Promise.allSettled to ensure one failing API doesn't break all others
        const results = await Promise.allSettled([
          getCategories(),
          getActiveTaxes(),
          getBrands(),
          getHeaderCategoriesPublic(),
          getSellers(),
        ]);

        // Handle categories
        if (results[0].status === "fulfilled" && results[0].value.success) {
          setCategories(results[0].value.data);
        }

        // Fetch subcategories as global fallback
        try {
          const subRes = await getSubCategoriesAdmin({ limit: 1000 } as any);
          if (subRes.success && subRes.data) {
             setSubcategories((prev: any[]) => {
                const existing = new Map(prev.map(s => [s._id || s.id, s]));
                (subRes.data as any[]).forEach(s => existing.set(s._id || s.id, s));
                return Array.from(existing.values());
             });
          }
        } catch (e) {
          console.warn("Global subcategory fetch failed:", e);
        }

        // Handle taxes
        if (results[1].status === "fulfilled" && results[1].value.success) {
          setTaxes(results[1].value.data);
        }

        // Handle brands
        if (results[2].status === "fulfilled" && results[2].value.success) {
          setBrands(results[2].value.data);
        }

        // Handle header categories
        if (results[3].status === "fulfilled") {
          const headerCatRes = results[3].value;
          if (headerCatRes && Array.isArray(headerCatRes)) {
            // Filter only Published header categories
            const published = headerCatRes.filter(
              (hc: HeaderCategory) => hc.status === "Published"
            );
            setHeaderCategories(published);
          }
        }

        // Handle shops (optional - for Shop By Store feature)
        // For Admin, we use getSellers to populate shops list
        if (results[4].status === "fulfilled" && results[4].value.success) {
          // Map sellers to shops format
          const sellers = results[4].value.data;
          const mappedShops: Shop[] = sellers.map((s: any) => ({
            _id: s._id,
            name: s.storeName || s.sellerName,
            storeId: s._id, // Using _id as storeId for compatibility
          }));
          setShops(mappedShops);
        } else if (results[4].status === "rejected") {
          // Shops API failed - this is non-critical, log and continue
          console.warn("Failed to fetch shops (Shop By Store feature may be unavailable):", results[4].reason?.message || "Unknown error");
        }
      } catch (err) {
        console.error("Error fetching form data:", err);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (id) {
      const fetchProduct = async () => {
        try {
          const response = await getProductById(id);
          if (response.success && response.data) {
            const product = response.data;
            setFormData({
              productName: product.productName,
              headerCategory:
                (typeof product.headerCategoryId === 'object' ? product.headerCategoryId?._id : product.headerCategoryId) || "",
              category:
                String((typeof product.category === 'object' ? product.category?._id : product.category) || product.categoryId || ""),
              subcategory:
                String((typeof product.subcategory === 'object' ? product.subcategory?._id : product.subcategory) ||
                product.subcategoryId ||
                ""),
              subSubCategory:
                product.subSubCategory || "",
              publish: product.publish ? "Yes" : "No",
              popular: product.popular ? "Yes" : "No",
              dealOfDay: product.dealOfDay ? "Yes" : "No",
              brand: (typeof product.brand === 'object' ? product.brand?._id : product.brand) || product.brandId || "",
              tags: product.tags.join(", "),
              smallDescription: product.smallDescription || "",
              seoTitle: product.seoTitle || "",
              seoKeywords: product.seoKeywords || "",
              seoImageAlt: product.seoImageAlt || "",
              seoDescription: product.seoDescription || "",
              variationType: product.variationType || "",
              variationName: product.variationName || "",
              manufacturer: product.manufacturer || "",
              madeIn: product.madeIn || "",
              tax: (product.tax as any)?._id || (product as any).taxId || (product as any).tax || "",
              isReturnable: product.isReturnable ? "Yes" : "No",
              maxReturnDays: product.maxReturnDays?.toString() || "",
              fssaiLicNo: product.fssaiLicNo || "",
              totalAllowedQuantity:
                product.totalAllowedQuantity?.toString() || "10",
              mainImageUrl: product.mainImageUrl || product.mainImage || "",
              galleryImageUrls: product.galleryImageUrls || product.galleryImages || [],
              isShopByStoreOnly: product.isShopByStoreOnly ? "Yes" : "No",
              shopId: typeof product.shopId === 'object' ? product.shopId?._id : product.shopId || "",
              pack: product.pack || "",
              barcode: product.barcode || [],
              itemCode: product.sku || product.itemCode || "",
              rackNumber: (product as any).rackNumber || "",
              hsnCode: (product as any).hsnCode || "",
              purchasePrice: (product as any).purchasePrice?.toString() || "",
              weight: (product as any).weight || "",
              mfgDate: (product as any).mfgDate || "",
              expiryDate: (product as any).expiryDate || "",
              lowStockQuantity: product.lowStockQuantity?.toString() || "5",
              deliveryTime: product.deliveryTime || "",
              price: product.price?.toString() || "",
              compareAtPrice: product.compareAtPrice?.toString() || "",
              discPrice: product.discPrice?.toString() || "0",
              stock: product.stock?.toString() || "0",
              // Ensure offerPrice is correctly populated from discPrice if an discount was active
              offerPrice: (product as any).offerPrice?.toString() ||
                         ((product.discPrice && product.discPrice < product.price) ? product.discPrice.toString() : ""),
              wholesalePrice: product.wholesalePrice?.toString() || "",
            });
            const rawVars = (product.variations || []).map((v: any) => ({
              ...v,
              price: v.price || 0,
              compareAtPrice: v.compareAtPrice || 0,
              // If discPrice is 0 but price is set, discPrice should be price
              discPrice: v.discPrice || v.price || 0,
              offerPrice: v.offerPrice || (v.discPrice < v.price ? v.discPrice : undefined),
              stock: v.stock || 0,
              barcode: v.barcode || [],
              status: (v.status as "Available" | "Sold out" | "In stock") || "Available"
            }));
            const hasExplicitVariationSetup =
              Boolean(product.variationType?.trim()) ||
              Boolean(product.variationName?.trim());
            const vars = !hasExplicitVariationSetup &&
              rawVars.length === 1 &&
              (rawVars[0].title || rawVars[0].value || "").trim().toLowerCase() === "default"
                ? []
                : rawVars;
            setVariations(vars);

            // Populate Top Form with 1st variation if exists (Simulating Simple Product Edit)
            // This block is now removed as top-level fields are directly in formData
            // if (vars.length > 0) {
            //    const v = vars[0];
            //    setVariationForm(prev => ({
            //        ...prev,
            //        price: v.price?.toString() || "",
            //        compareAtPrice: v.compareAtPrice?.toString() || "",
            //        discPrice: v.discPrice?.toString() || "",
            //        stock: v.stock?.toString() || "",
            //        status: v.status,
            //        title: v.title || "",
            //        // And others if needed
            //    }));
            // }

            if (product.mainImageUrl || product.mainImage) {
               setMainImagePreview(
                 product.mainImageUrl || product.mainImage || ""
               );
             }
            const galleryToUse = product.galleryImageUrls || product.galleryImages || [];
            if (galleryToUse.length > 0) {
              setGalleryItems(galleryToUse.map((url: string) => ({
                id: url,
                url: url,
                isExisting: true,
              })));
            }
          }
        } catch (err) {
          console.error("Error fetching product:", err);
          setUploadError("Failed to fetch product details");
        }
      };
      fetchProduct();
    }
  }, [id]);

  useEffect(() => {
    const fetchSubs = async () => {
      if (formData.category && categories.length > 0) {
        let catRef = String(formData.category || "").trim();
        const isId = /^[0-9a-fA-F]{24}$/.test(catRef);

        let targetId = isId ? catRef : "";

        if (isId) {
          const match = categories.find(c => String(c._id).toLowerCase() === catRef.toLowerCase());
          if (match) targetId = match._id;
        } else {
          const match = categories.find(c => String(c.name || (c as any).categoryName || "").trim().toLowerCase() === catRef.toLowerCase());
          if (match) targetId = match._id;
        }

        try {
          const finalId = targetId || catRef;
          const res = await getSubCategoriesAdmin({ category: finalId });
          if (res.success && res.data && res.data.length > 0) {
             setSubcategories((prev: any[]) => {
                const existing = new Map(prev.map(s => [s._id || s.id, s]));
                (res.data as any[]).forEach(s => existing.set(s._id || s.id, s));
                return Array.from(existing.values());
             });
          } else {
             // If specific fetch returns nothing, we try fetching EVERYTHING as a safety measure
             const fallbackRes = await getSubCategoriesAdmin({ limit: 1000 } as any);
             if (fallbackRes.success && fallbackRes.data) {
                setSubcategories((prev: any[]) => {
                  const existing = new Map(prev.map(s => [s._id || s.id, s]));
                  (fallbackRes.data as any[]).forEach(s => existing.set(s._id || s.id, s));
                  return Array.from(existing.values());
                });
             }
          }
        } catch (err) {
          console.error("Error fetching subcategories:", err);
        }
      }
    };
    if (formData.category) {
      fetchSubs();
    }
  }, [formData.category, categories]);

  useEffect(() => {
    const fetchSubSubs = async () => {
      if (formData.subcategory) {
        try {
          const res = await getSubSubCategories(formData.subcategory);
          if (res.success) setSubSubCategories(res.data);
        } catch (err) {
          console.error("Error fetching sub-subcategories:", err);
        }
      }
    };
    if (formData.subcategory) {
      fetchSubSubs();
    }
  }, [formData.subcategory]);

  // Clear category and subcategory when header category changes
  useEffect(() => {
    const prevHeaderCategory = prevHeaderCategoryRef.current;
    prevHeaderCategoryRef.current = formData.headerCategory || "";
    if (formData.headerCategory) {
      // Header category selected - check if current category belongs to it
      const currentCategory = categories.find(
        (cat: any) => (cat._id || cat.id) === formData.category
      );
      if (currentCategory) {
        // Robust comparison for Header Category (ID or Name)
        const catHeaderId = String(currentCategory.headerCategoryId?._id || currentCategory.headerCategoryId || "").trim().toLowerCase();
        const selectedHeaderRef = String(formData.headerCategory || "").trim().toLowerCase();

        const isMatch = (catHeaderId === selectedHeaderRef) || (() => {
            const hMatch = headerCategories.find(hc =>
                String(hc._id).toLowerCase() === selectedHeaderRef ||
                String(hc.name).toLowerCase() === selectedHeaderRef
            );
            return hMatch && (String(hMatch._id).toLowerCase() === catHeaderId || String(hMatch.name).toLowerCase() === catHeaderId);
        })();

        // If current category doesn't belong to selected header category, clear it
        if (selectedHeaderRef && !isMatch) {
          setFormData((prev) => ({
            ...prev,
            category: "",
            subcategory: "",
            subSubCategory: "",
          }));
          setSubcategories([]);
          setSubSubCategories([]);
        }
      }
    } else {
      // Header category cleared by user action - clear dependent selections.
      // Do not clear on initial load/edit mode when headerCategory is empty but category is valid.
      const selectedHeaderRef = String(formData.headerCategory || "").trim().toLowerCase();
      if (prevHeaderCategory && !selectedHeaderRef) {
        setFormData((prev) => ({
          ...prev,
          category: "",
          subcategory: "",
        }));
        setSubcategories([]);
      }
    }
  }, [formData.headerCategory, categories]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleMainImageChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Ensure modal is closed
    setShowImageSourceModal(false);

    const validation = validateImageFile(file);
    if (!validation.valid) {
      setUploadError(validation.error || "Invalid image file");
      return;
    }

    setMainImageFile(file);
    setUploadError("");

    try {
      const preview = await createImagePreview(file);
      setMainImagePreview(preview);
    } catch (error) {
      setUploadError("Failed to create image preview");
    }
  };

  const handleGalleryImagesChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Check limit
    if (galleryItems.length + files.length > 6) {
        setUploadError("You can only upload a maximum of 6 gallery images.");
        return;
    }

    // Validate all files
    const invalidFiles = files.filter((file) => !validateImageFile(file).valid);
    if (invalidFiles.length > 0) {
      setUploadError(
        "Some files are invalid. Please check file types and sizes."
      );
      return;
    }

    setUploadError("");

    try {
      const newItems: GalleryItem[] = await Promise.all(
        files.map(async (file) => ({
          id: URL.createObjectURL(file),
          url: await createImagePreview(file),
          file: file,
          isExisting: false,
        }))
      );
      setGalleryItems((prev) => [...prev, ...newItems]);
    } catch (error) {
      setUploadError("Failed to create image previews");
    }

    // Reset input to allow selecting same files again if needed
    e.target.value = "";
  };

  const removeGalleryImage = (index: number) => {
    setGalleryItems((prev) => prev.filter((_, i) => i !== index));
  };

  const addVariation = () => {
    if (!variationForm.title || !variationForm.price) {
      setUploadError("Please fill in variation title and price");
      return;
    }

    const price = parseFloat(variationForm.price);
    const compareAtPrice = variationForm.compareAtPrice ? parseFloat(variationForm.compareAtPrice) : 0;
    const stock = parseInt(variationForm.stock || "0");
    const offerPrice = variationForm.offerPrice ? parseFloat(variationForm.offerPrice) : undefined;
    const wholesalePrice = variationForm.wholesalePrice ? parseFloat(variationForm.wholesalePrice) : 0;
    const discPrice = offerPrice || price; // Use offerPrice as discPrice if provided

    // Validate: Selling Price (price) should not be greater than MRP (compareAtPrice) if MRP is set
    if (compareAtPrice > 0 && price > compareAtPrice) {
      setUploadError("Selling price cannot be greater than Maximum Retail Price (MRP)");
      return;
    }

    const newVariation: any = {
      title: variationForm.title,
      value: variationForm.title,
      name: formData.variationType || "Variation",
      price,
      compareAtPrice,
      discPrice,
      stock,
      status: variationForm.status,
      barcode: variationForm.barcode,
      offerPrice,
      wholesalePrice,
      tieredPrices: variationForm.tieredPrices.map(t => ({
        minQty: parseInt(t.minQty) || 0,
        price: parseFloat(t.price) || 0
      })).filter(t => t.minQty > 1 && t.price > 0),
      image: variationForm.image
    };

    if (editingVariationIndex !== null) {
        const next = [...variations];
        next[editingVariationIndex] = newVariation;
        setVariations(next);
        setEditingVariationIndex(null);
    } else {
        setVariations([...variations, newVariation]);
    }
    lastSyncInitiatorRef.current = "variation";
    setVariationForm({
      title: "",
      price: "",
      compareAtPrice: "",
      discPrice: "0",
      stock: "0",
      status: "Available",
      barcode: variationForm.barcode,
      offerPrice: "",
      wholesalePrice: "",
      tieredPrices: [],
      image: "",
    });
    setUploadError("");
  };

  const handleEditVariation = (index: number) => {
    const v = variations[index];
    setVariationForm({
      title: v.title || v.name || "",
      price: String(v.price || ""),
      compareAtPrice: String(v.compareAtPrice || ""),
      discPrice: String(v.discPrice || "0"),
      stock: String(v.stock || "0"),
      status: v.status === "Sold out" ? "Sold out" : "Available",
      barcode: v.barcode || [],
      offerPrice: String(v.offerPrice || ""),
      wholesalePrice: String(v.wholesalePrice || ""),
      tieredPrices: (v.tieredPrices || []).map((t: any) => ({ minQty: String(t.minQty), price: String(t.price) })),
      image: v.image || "",
    });
    setEditingVariationIndex(index);
    const el = document.getElementById('variation-form-section');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const cancelVariationEdit = () => {
    setEditingVariationIndex(null);
    setVariationForm({
        title: "",
        price: "",
        compareAtPrice: "",
        discPrice: "0",
        stock: "0",
        status: "Available",
        barcode: [],
        offerPrice: "",
        wholesalePrice: "",
        tieredPrices: [],
        image: "",
    });
  };

  const handleAddTier = () => {
    setVariationForm(prev => ({
        ...prev,
        tieredPrices: [...prev.tieredPrices, { minQty: "", price: "" }]
    }));
  };

  const handleRemoveTier = (index: number) => {
    setVariationForm(prev => ({
        ...prev,
        tieredPrices: prev.tieredPrices.filter((_, i) => i !== index)
    }));
  };

  const handleTierChange = (index: number, field: 'minQty' | 'price', value: string) => {
    setVariationForm(prev => {
        const newTiers = [...prev.tieredPrices];
        newTiers[index] = { ...newTiers[index], [field]: value };
        return { ...prev, tieredPrices: newTiers };
    });
  };

  const removeVariation = (index: number) => {
    setVariations((prev) => prev.filter((_, i) => i !== index));
  };

  // Attribute Variation Helpers
  const handleAddAttribute = () => {
      if(!selectedAttributeId) return;
      const attr = availableAttributes.find(a => (a._id || a.id) === selectedAttributeId);
      if(attr && !selectedAttributes.find(sa => sa.id === selectedAttributeId)) {
          setSelectedAttributes([...selectedAttributes, { id: selectedAttributeId, name: attr.name, values: [] }]);
          setSelectedAttributeId("");
      }
  };

  const handleRemoveAttribute = (id: string) => {
      setSelectedAttributes(prev => prev.filter(p => p.id !== id));
  };

  const handleAddAttributeValue = (attrId: string, value: string) => {
      if(!value.trim()) return;
      setSelectedAttributes(prev => prev.map(p => {
          if(p.id === attrId && !p.values.includes(value.trim())) {
              return { ...p, values: [...p.values, value.trim()] };
          }
          return p;
      }));
  };

  const handleRemoveAttributeValue = (attrId: string, value: string) => {
      setSelectedAttributes(prev => prev.map(p => {
          if(p.id === attrId) {
              return { ...p, values: p.values.filter(v => v !== value) };
          }
          return p;
      }));
  };

  const handleAddUnit = () => {
      if(!currentUnitInput.trim()) return;
      if(!variationUnits.includes(currentUnitInput.trim())) {
          setVariationUnits([...variationUnits, currentUnitInput.trim()]);
          setCurrentUnitInput("");
      }
  };

  const handleRemoveUnit = (unit: string) => {
      setVariationUnits(prev => prev.filter(u => u !== unit));
  };

  const generateVariations = () => {
       let combos: string[] = [];
       const units = variationUnits.length > 0 ? variationUnits : [""];

       // If no attributes selected, just use units
       if(selectedAttributes.length === 0) {
           combos = variationUnits; // If empty, combos is empty
       } else {
           // Helper to generate combinations
           const generate = (index: number, current: string[]) => {
               if(index === selectedAttributes.length) {
                   // Reached end of attributes, now combine with units
                   const attrStr = current.join("-");
                   units.forEach(u => {
                       combos.push(u ? `${attrStr} - ${u}` : attrStr);
                   });
                   return;
               }

               const attr = selectedAttributes[index];
               if(attr.values.length === 0) {
                   // If an attribute has no values, assume it's ignored or stop?
                   // User probably wants to enforce values. Let's skip it or treat as empty?
                   // Treating as empty might break "Choc- -1kg".
                   // Let's assume validation prevents this, or we just skip.
                   // For now, if no values, we continue with empty? No, usually blocked.
                   // But let's just loop over empty array -> no generation.
               }

               attr.values.forEach(val => {
                   generate(index + 1, [...current, val]);
               });
           };
           generate(0, []);
       }

       const newVariations = combos.map(title => ({
           title: title,
           value: title, // value field
           name: formData.variationType || "Variation",
           price: 0,
           compareAtPrice: 0,
           discPrice: 0,
           stock: 0,
           status: "Available" as const,
           barcode: [],
           offerPrice: undefined,
           wholesalePrice: 0,
           tieredPrices: [],
           image: ""
       }));

       // Merge logic: preserve existing prices/stock if title matches
       const merged = newVariations.map(nv => {
           const existing = variations.find(v => v.title === nv.title);
           return existing ? existing : nv;
       });

       if(merged.length > 0) {
           setVariations(merged);
       } else {
           if(selectedAttributes.length > 0 && selectedAttributes.some(s => s.values.length > 0)) {
               alert("No variations generated. Please checks attributes and values.");
           }
       }
  };

  const handleAddColor = () => {
      if(!colorInput.name.trim()) return;
      if(!selectedColors.some(c => c.name === colorInput.name.trim())) {
          setSelectedColors([...selectedColors, { name: colorInput.name.trim(), code: colorInput.code }]);
          setColorInput({ name: "", code: "#000000" });
      }
  };

  const handleRemoveColor = (name: string) => {
      setSelectedColors(prev => prev.filter(c => c.name !== name));
  };

   const handleAutoGenerateBarcode = (target: "product" | "variation" | "sku" | "table-variation" = "product", index: number | null = null) => {
    // Generate 12 digit number
    const newBarcode = Math.floor(100000000000 + Math.random() * 900000000000).toString();
     if (target === "product") {
         setFormData(prev => ({ ...prev, barcode: [...prev.barcode, newBarcode] }));
     } else if (target === "sku") {
         addBarcode('product', null, newBarcode);
     } else if (target === "variation") {
        setVariationForm(prev => ({ ...prev, barcode: [...prev.barcode, newBarcode] }));
    } else if (index !== null) {
        setVariations(prev => {
            const n = [...prev];
            n[index].barcode = [...(n[index].barcode || []), newBarcode];
            return n;
        });
    }
    setSuccessMessage("Barcode Generated!");
    setTimeout(() => setSuccessMessage(""), 2000);
  };

  const handleCheckExists = async (barcode: string) => {
    try {
      setUploading(true);
      const res = await fetchProducts({ search: barcode });
      if (res.success && res.data.length > 0) {
        // Find exact match in barcodes array or standard barcode field
        const exactMatch = res.data.find((p: any) => {
            const barcodes = Array.isArray(p.barcode) ? p.barcode : [p.barcode];
            return barcodes.some((b: any) => String(b).toLowerCase() === barcode.toLowerCase());
        }) || res.data[0];

        setFoundProduct(exactMatch);
        setShowProductFoundModal(true);
      } else {
        // Not found, just set the barcode and name if possible
        setFormData(prev => ({ ...prev, barcode: [barcode] }));
        setSuccessMessage("Product not found. You can add it now.");
        setTimeout(() => setSuccessMessage(""), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const startScanning = (target: "product" | "variation" | "table-variation" | "sku" | "check-exists" = "product", index: number | null = null) => {
    setScanTarget(target);
    setScanTargetIndex(index);
    setIsScanning(true);
  };

  const onScanSuccess = (decodedText: string) => {
      const target = scanTarget;
      const index = scanTargetIndex;

      if (target === "check-exists") {
          handleCheckExists(decodedText);
          setIsScanning(false);
          return;
      }
      if (target === "product") {
          setFormData(prev => ({ ...prev, barcode: [...prev.barcode, decodedText] }));
      } else if (target === "sku") {
          addBarcode('product', null, decodedText);
      } else if (target === "variation") {
          setVariationForm(prev => ({ ...prev, barcode: [...prev.barcode, decodedText] }));
      } else if (target === "table-variation" && index !== null) {
          setVariations(prev => {
              const n = [...prev];
              n[index].barcode = [...(n[index].barcode || []), decodedText];
              return n;
          });
      }
      setIsScanning(false);
      setSuccessMessage("Barcode Scanned Successfully!");
      setTimeout(() => setSuccessMessage(""), 3000);
  };

  const stopScanning = () => {
      setIsScanning(false);
  };
  const addBarcode = (target: 'product' | 'variation' | 'table-variation', index: number | null = null, value: string) => {
    if(!value.trim()) return;
    if(target === 'product') {
        if(!formData.barcode.includes(value.trim())) {
            setFormData(prev => ({ ...prev, barcode: [...prev.barcode, value.trim()] }));
            setCurrentBarcode("");
        }
    } else if(target === 'variation') {
        if(!variationForm.barcode.includes(value.trim())) {
            setVariationForm(prev => ({ ...prev, barcode: [...prev.barcode, value.trim()] }));
            setCurrentVarBarcode("");
        }
    } else if(target === 'table-variation' && index !== null) {
        setVariations(prev => {
            const n = [...prev];
            const currentBarcodes = n[index].barcode || [];
            if(!currentBarcodes.includes(value.trim())) {
                n[index].barcode = [...currentBarcodes, value.trim()];
            }
            return n;
        });
        setCurrentTableVarBarcode(prev => ({ ...prev, [index]: "" }));
    }
  };

  const removeBarcode = (target: 'product' | 'variation' | 'table-variation', barcode: string, index: number | null = null) => {
    if(target === 'product') {
        setFormData(prev => ({ ...prev, barcode: prev.barcode.filter(b => b !== barcode) }));
    } else if(target === 'variation') {
        setVariationForm(prev => ({ ...prev, barcode: prev.barcode.filter(b => b !== barcode) }));
    } else if(target === 'table-variation' && index !== null) {
        setVariations(prev => {
            const n = [...prev];
            n[index].barcode = (n[index].barcode || []).filter(b => b !== barcode);
            return n;
        });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError("");

    // Basic validation
    if (!formData.productName.trim()) {
      setUploadError("Please enter a product name.");
      return;
    }

    // Only validate categories if NOT shop by store only
    if (formData.isShopByStoreOnly !== "Yes") {
      if (shouldShowField('category')) {
          if (!formData.category) {
            setUploadError("Please select a category.");
            return;
          }
      }
    } else {
      // If shop by store only is Yes, then shopId is required
      if (!formData.shopId) {
        setUploadError("Please select a store.");
        setUploading(false);
        return;
      }
    }

    setUploading(true);

    try {
      // Keep local copies so we don't rely on async state updates before submit
      let mainImageUrl = formData.mainImageUrl;

      // Existing gallery images (filter items with isExisting: true)
      let galleryImageUrls = galleryItems
        .filter((item) => item.isExisting)
        .map((item) => item.url);

      // New gallery images to upload
      const newGalleryFiles = galleryItems
        .filter((item) => !item.isExisting && item.file)
        .map((item) => item.file as File);

      // Upload main image if provided
      if (mainImageFile) {
        const mainImageResult = await uploadImage(
          mainImageFile,
          "Geeta Stores/products"
        );
        mainImageUrl = mainImageResult.secureUrl;
        setFormData((prev) => ({
          ...prev,
          mainImageUrl,
        }));
      }

      // Upload new gallery images if provided
      if (newGalleryFiles.length > 0) {
        const galleryResults = await uploadImages(
          newGalleryFiles,
          "Geeta Stores/products/gallery"
        );
        const newUrls = galleryResults.map((result) => result.secureUrl);
        galleryImageUrls = [...galleryImageUrls, ...newUrls];
        setFormData((prev) => ({ ...prev, galleryImageUrls }));
      }

      const finalVariations = [...variations];

      const price = parseFloat(formData.price || "0"); // Selling Price
      const compareAtPrice = parseFloat(formData.compareAtPrice || "0"); // MRP
      const stock = parseInt(formData.stock || "0");
      const offerPrice = formData.offerPrice ? parseFloat(formData.offerPrice) : undefined;
      const wholesalePrice = formData.wholesalePrice ? parseFloat(formData.wholesalePrice) : 0;
      const calculatedDiscPrice = offerPrice || price; // Use offerPrice as discPrice if provided

      if (compareAtPrice > 0 && price > compareAtPrice) {
         setUploadError("Selling price cannot be greater than Maximum Retail Price (MRP)");
         setUploading(false);
         return;
      }

      // Prepare product data for API
      const tagsArray = formData.tags
        ? formData.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)
        : [];

      const hasExplicitVariations = finalVariations.length > 0;
      const hasRootPrice = formData.price !== "";
      const hasRootCompareAtPrice = formData.compareAtPrice !== "";
      const hasRootWholesalePrice = formData.wholesalePrice !== "";
      const hasRootOfferPrice = formData.offerPrice !== "";
      const hasRootStock = formData.stock !== "";
      const variationsWithImages = finalVariations.map((v: any) => ({
        ...v,
        image: v.image || mainImageUrl || "",
        // Ensure discPrice is always synced from offerPrice or price
        discPrice: v.offerPrice || v.price || v.discPrice,
      }));

      const productData = {
        productName: formData.productName,
        headerCategoryId: formData.headerCategory || undefined, // Schema has headerCategoryId
        categoryId: formData.category || undefined, // Schema has categoryId
        subcategoryId: formData.subcategory || undefined, // Schema has subcategoryId
        subSubCategoryId: formData.subSubCategory || undefined, // Schema has subSubCategoryId
        brandId: formData.brand || undefined, // Schema has brandId
        publish: formData.publish === "Yes",
        popular: formData.popular === "Yes",
        dealOfDay: formData.dealOfDay === "Yes",
        seoTitle: formData.seoTitle || undefined,
        seoKeywords: formData.seoKeywords || undefined,
        seoImageAlt: formData.seoImageAlt || undefined,
        seoDescription: formData.seoDescription || undefined,
        smallDescription: formData.smallDescription || undefined,
        tags: tagsArray,
        manufacturer: formData.manufacturer || undefined,
        madeIn: formData.madeIn || undefined,
        taxId: formData.tax || undefined,
        isReturnable: formData.isReturnable === "Yes",
        maxReturnDays: formData.maxReturnDays
          ? parseInt(formData.maxReturnDays)
          : undefined,
        totalAllowedQuantity: parseInt(formData.totalAllowedQuantity || "10"),
        fssaiLicNo: formData.fssaiLicNo || undefined,
        mainImage: mainImageUrl || undefined,
        galleryImages: galleryImageUrls,
        variations: hasExplicitVariations ? variationsWithImages : undefined,
        variationType: hasExplicitVariations ? (formData.variationType || undefined) : undefined,
        variationName: hasExplicitVariations ? (formData.variationName || undefined) : undefined,
        price: hasExplicitVariations
          ? (hasRootPrice ? price : (variationsWithImages[0]?.price || 0))
          : price,
        compareAtPrice: hasExplicitVariations
          ? (hasRootCompareAtPrice ? compareAtPrice : (variationsWithImages[0]?.compareAtPrice || 0))
          : compareAtPrice,
        wholesalePrice: hasExplicitVariations
          ? (hasRootWholesalePrice ? wholesalePrice : (variationsWithImages[0]?.wholesalePrice || 0))
          : wholesalePrice,
        discPrice: hasExplicitVariations
          ? (
              hasRootOfferPrice || hasRootPrice
                ? calculatedDiscPrice
                : (variationsWithImages[0]?.discPrice || 0)
            )
          : calculatedDiscPrice,
        stock: hasExplicitVariations
          ? (
              hasRootStock
                ? stock
                : variationsWithImages.reduce((acc, curr) => acc + (Number(curr.stock) || 0), 0)
            )
          : stock,
        isShopByStoreOnly: formData.isShopByStoreOnly === "Yes",
        shopId: formData.shopId || undefined,
        pack: (formData as any).pack || undefined,
         barcode: (formData as any).barcode || undefined,
         itemCode: (formData as any).itemCode || (formData as any).barcode?.[0] || undefined, // maps to sku in backend
         sku: (formData as any).itemCode || (formData as any).barcode?.[0] || undefined,
         rackNumber: (formData as any).rackNumber || undefined,
        hsnCode: (formData as any).hsnCode || undefined,
        purchasePrice: (formData as any).purchasePrice ? parseFloat((formData as any).purchasePrice) : undefined,
        weight: (formData as any).weight || undefined,
        mfgDate: (formData as any).mfgDate || undefined,
        expiryDate: (formData as any).expiryDate || undefined,
        lowStockQuantity: (formData as any).lowStockQuantity ? parseInt((formData as any).lowStockQuantity) : undefined,
        deliveryTime: (formData as any).deliveryTime || undefined,
      };

      // Create or Update product via API
      let response;
      if (id) {
        response = await updateProduct(id as string, productData);
      } else {
        response = await createProduct(productData);
      }

      if (response.success) {
        setSuccessMessage(
          id ? "Product updated successfully!" : "Product added successfully!"
        );
        setTimeout(() => {
          // Reset form or navigate
          if (!id) {
            setFormData({
              productName: "",
              headerCategory: "",
              category: "",
              subcategory: "",
              subSubCategory: "",
              publish: "No",
              popular: "No",
              dealOfDay: "No",
              brand: "",
              tags: "",
              smallDescription: "",
              seoTitle: "",
              seoKeywords: "",
              seoImageAlt: "",
              seoDescription: "",
              variationType: "",
              variationName: "",
              manufacturer: "",
              madeIn: "",
              tax: "",
              isReturnable: "No",
              maxReturnDays: "",
              fssaiLicNo: "",
              totalAllowedQuantity: "10",
              mainImageUrl: "",
              galleryImageUrls: [],
              isShopByStoreOnly: "No",
              shopId: "",
              pack: "",
              barcode: [],
              itemCode: "",
              rackNumber: "",
              hsnCode: "",
              purchasePrice: "",
              weight: "",
              mfgDate: "",
              expiryDate: "",
              lowStockQuantity: "5",
              deliveryTime: "",
              price: "",
              compareAtPrice: "",
              discPrice: "0",
              stock: "0",
              offerPrice: "",
              wholesalePrice: "",
            });
            setVariations([]);
            setMainImageFile(null);
            setMainImagePreview("");
            setGalleryItems([]);
          }
          setSuccessMessage("");
          // Navigate to product list
          navigate("/admin/product/list");
        }, 1500);
      } else {
        setUploadError(response.message || "Failed to create product");
      }
    } catch (error: any) {
      setUploadError(
        error.response?.data?.message ||
          error.message ||
          "Failed to upload images. Please try again."
      );
    } finally {
      setUploading(false);
    }
  };

  const handleImageSearch = async () => {
    if (!imageSearchQuery.trim()) {
        setUploadError("Please enter a keyword to search");
        return;
    }
    setIsSearchingImage(true);
    setUploadError("");
    try {
        const res = await searchProductImage(imageSearchQuery);
      if (res.success && res.data?.imageUrl) {
          setSearchedImage(res.data.imageUrl);
      } else {
          setUploadError(res.message || "No image found for this keyword");
      }
    } catch (err: any) {
        console.error(err);
        setUploadError("Image search failed. Please try again.");
    } finally {
        setIsSearchingImage(false);
    }
};

const applySearchedImage = () => {
    if (searchedImage) {
        setFormData(prev => ({ ...prev, mainImageUrl: searchedImage }));
        setMainImagePreview(searchedImage);
        setMainImageFile(null); // Clear file since using URL
        setSearchedImage("");
        setSuccessMessage("Image applied successfully!");
        setTimeout(() => setSuccessMessage(""), 2000);
    }
  };

  const handleProductSearch = async (query: string) => {
    setProductSearchQuery(query);
    if (!query.trim() || query.length < 2) {
      setProductSuggestions([]);
      return;
    }

    setIsSearchingProducts(true);
    try {
      const res = await fetchProducts({ search: query, limit: 10 });
      if (res.success) {
        setProductSuggestions(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearchingProducts(false);
    }
  };

  const selectProductFromSearch = (product: any) => {
    setFormData({
      ...formData,
      productName: product.productName,
      price: product.price?.toString() || "",
      compareAtPrice: product.compareAtPrice?.toString() || "",
      stock: product.stock?.toString() || "0",
      mainImageUrl: product.mainImage || product.mainImageUrl || "",
      barcode: Array.isArray(product.barcode) ? product.barcode : [product.barcode || ""],
      discPrice: product.discPrice?.toString() || "0",
      itemCode: product.sku || product.itemCode || "",
      variationName: product.variationName || "",
      mfgDate: (product as any).mfgDate || "",
      expiryDate: (product as any).expiryDate || "",
      weight: (product as any).weight || "",
    });
    if (product.mainImage || product.mainImageUrl) {
      setMainImagePreview(product.mainImage || product.mainImageUrl || "");
    }
    setProductSuggestions([]);
    setProductSearchQuery("");
    setIsProductLoaded(true);
    setSuccessMessage("Product details loaded!");
    setTimeout(() => setSuccessMessage(""), 2000);
  };

  const handleClearProduct = () => {
    setFormData({
      productName: "",
      headerCategory: "",
      category: "",
      subcategory: "",
      subSubCategory: "",
      publish: "Yes",
      popular: "No",
      dealOfDay: "No",
      brand: "",
      tags: "",
      smallDescription: "",
      seoTitle: "",
      seoKeywords: "",
      seoImageAlt: "",
      seoDescription: "",
      variationType: "",
      variationName: "",
      manufacturer: "",
      madeIn: "",
      tax: "",
      isReturnable: "No",
      maxReturnDays: "",
      fssaiLicNo: "",
      totalAllowedQuantity: "10",
      mainImageUrl: "",
      galleryImageUrls: [],
      isShopByStoreOnly: "No",
      shopId: "",
      pack: "",
      barcode: [],
      itemCode: "",
      rackNumber: "",
      hsnCode: "",
      purchasePrice: "",
      weight: "",
      mfgDate: "",
      expiryDate: "",
      lowStockQuantity: "5",
      deliveryTime: "",
      price: "",
      compareAtPrice: "",
      discPrice: "0",
      stock: "0",
      offerPrice: "",
      wholesalePrice: "",
    });
    setMainImagePreview("");
    setMainImageFile(null);
    setIsProductLoaded(false);
    setSuccessMessage("Form cleared!");
    setTimeout(() => setSuccessMessage(""), 2000);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Main Content */}
      <div className="flex-1 pb-24">

        {/* Quick Action Search/Scan - NEW SECTION as per User Request */}
        {!id && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <div
                  onClick={() => startScanning("check-exists")}
                  className="bg-white p-2.5 rounded-lg border border-neutral-200 shadow-sm flex items-center gap-3 cursor-pointer hover:bg-pink-50 transition-all group border-l-4 border-l-[var(--primary-color)]">
                  <div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center text-[var(--primary-color)] group-hover:scale-110 transition-transform">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path d="M3 7V5a2 2 0 0 1 2-2h2m10 0h2a2 2 0 0 1 2 2v2m0 10v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                          <path d="M7 12h10" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                      </svg>
                  </div>
              <div>
                      <h4 className="font-bold text-gray-800">Scan Barcode</h4>
                      <p className="text-xs text-gray-500">Search existing product</p>
                  </div>
              </div>

              {/* Product Search Bar */}
              <div className="bg-white p-2.5 rounded-lg border border-neutral-200 shadow-sm flex flex-col justify-center relative col-span-1 sm:col-span-2 lg:col-span-3">
                  <div className="relative w-full">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                      </div>
                      <input
                          type="text"
                          className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[var(--primary-color)]/50 focus:border-[var(--primary-color)] outline-none text-sm transition-all"
                          placeholder="Search product by name to auto-fill..."
                          value={productSearchQuery}
                          onChange={(e) => handleProductSearch(e.target.value)}
                      />
                      {isSearchingProducts && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                              <div className="w-4 h-4 border-2 border-[var(--primary-color)] border-t-transparent rounded-full animate-spin"></div>
                          </div>
                      )}
                      {!isSearchingProducts && isProductLoaded && (
                          <button
                              onClick={handleClearProduct}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500 hover:text-red-700 p-1"
                              title="Clear selection"
                          >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                          </button>
                      )}
                  </div>

                  {/* Suggestions Dropdown */}
                  {productSuggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-xl shadow-xl z-[70] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                          {productSuggestions.map((product) => (
                              <div
                                  key={product._id}
                                  onClick={() => selectProductFromSearch(product)}
                                  className="flex items-center gap-3 p-3 hover:bg-pink-50 cursor-pointer transition-colors border-b border-gray-50 last:border-0"
                              >
                                  <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden shrink-0 border border-gray-100">
                                      <img
                                          src={product.mainImage || product.mainImageUrl || "https://placehold.co/100x100?text=??"}
                                          className="w-full h-full object-contain"
                                          alt=""
                                      />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                      <p className="text-sm font-bold text-gray-800 truncate uppercase">{product.productName}</p>
                                      <div className="flex items-center gap-2">
                                          <span className="text-xs text-pink-600 font-bold">₹{product.price}</span>
                                          {product.sku && <span className="text-[10px] text-gray-400">SKU: {product.sku}</span>}
                                      </div>
                                  </div>
                              </div>
                          ))}
                      </div>
                  )}
              </div>
          </div>
        )}

        <form id="admin-product-form" onSubmit={handleSubmit} className="space-y-4">
          {/* Top Image & Name & Price Section (Seller Style) */}
          <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-4 space-y-4 mb-4">
              {uploadError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {uploadError}
                </div>
              )}
              {successMessage && (
                <div className="bg-[var(--primary-alpha-10)] border border-green-200 text-[var(--primary-darker)] px-4 py-3 rounded-lg">
                  {successMessage}
                </div>
              )}
            {/* 1. Image Upload Section */}
            <div>
                 <div className="flex flex-col sm:flex-row gap-6 sm:items-start">
                    {/* Main Image */}
                    <div className="flex flex-col items-center shrink-0">
                        <span className="text-sm font-semibold text-neutral-700 mb-1">Main Image <span className="text-red-500">*</span></span>
                        <div
                         onClick={() => setShowImageSourceModal(true)}
                         className="w-32 h-32 border-2 border-[var(--primary-color)] border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-pink-50 transition-colors relative overflow-hidden bg-white">
                            {mainImagePreview ? (
                                <div className="w-full h-full relative group">
                                    <img src={mainImagePreview} className="w-full h-full object-contain" alt="Main" />
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setMainImageFile(null);
                                            setMainImagePreview("");
                                        }}
                                        className="absolute top-1 right-1 bg-red-600/80 hover:bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <svg className="w-10 h-10 text-[var(--primary-color)] mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                                    <span className="text-xs text-[var(--primary-color)] font-bold">Upload Main</span>
                                </>
                            )}
                            <input ref={mainImageInputRef} type="file" accept="image/*" onChange={handleMainImageChange} className="hidden" disabled={uploading} />
                        </div>
                    </div>

                    {/* Gallery Images */}
                    <div className="flex flex-col items-start w-full">
                        <span className="text-sm font-semibold text-neutral-700 mb-1">Gallery Images (Max 6)</span>
                        <div className="flex flex-wrap gap-2">
                            {galleryItems.map((item, index) => (
                                <div key={item.id} className="w-20 h-20 relative border border-gray-200 rounded-lg overflow-hidden group bg-white">
                                    <img src={item.url} className="w-full h-full object-cover" alt={`Gallery ${index}`} />
                                    <button
                                        type="button"
                                        onClick={() => removeGalleryImage(index)}
                                        className="absolute top-1 right-1 bg-red-600/80 hover:bg-red-600 text-white w-6 h-6 flex items-center justify-center rounded-full opacity-100 shadow-sm transition-all text-xs z-10"
                                    >
                                        &times;
                                    </button>
                                </div>
                            ))}
                             {galleryItems.length < 6 && (
                                <label className="w-20 h-20 border-2 border-gray-300 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors text-gray-400 hover:text-[var(--primary-color)]">
                                    <span className="text-2xl font-light mb-0.5">+</span>
                                    <span className="text-[10px] font-medium uppercase">Add</span>
                                    <input type="file" accept="image/*" multiple onChange={handleGalleryImagesChange} className="hidden" disabled={uploading} />
                                </label>
                            )}
                        </div>
                    </div>
                 </div>
            </div>

             {/* 2. Product Name */}
            <div>
               <label className="block text-sm font-semibold text-neutral-700 mb-1">
                 Name <span className="text-red-500">*</span>
               </label>
               <input
                 type="text"
                 name="productName"
                 value={formData.productName}
                 onChange={handleChange}
                 placeholder="Enter Product Name"
                 className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] transition-all"
               />
            </div>

            {/* Brand Selection */}
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-1">
                Brand
              </label>
              <ThemedDropdown
                options={brands.map(b => ({ id: b._id, label: b.name, value: b._id }))}
                value={formData.brand}
                onChange={(val) => setFormData(prev => ({ ...prev, brand: val }))}
                placeholder="Select Brand"
              />
            </div>

            {/* 3. Prices (Simulating Variation Form for consistency) */}
            <div className="grid grid-cols-2 gap-4">
                 <div className="order-2">
                    <label className="block text-sm font-semibold text-neutral-700 mb-1">
                      Selling Price <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                        <input
                           type="number"
                           name="price"
                           value={formData.price}
                           onChange={handleChange}
                           placeholder="0.00"
                           className="w-full pl-7 pr-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)]"
                        />
                    </div>
                 </div>
                  <div className="order-1">
                     <label className="block text-sm font-semibold text-neutral-700 mb-1">
                       Maximum Retail Price
                     </label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                        <input
                           type="number"
                           name="compareAtPrice"
                           value={formData.compareAtPrice}
                           onChange={handleChange}
                           placeholder="0.00"
                           className="w-full pl-7 pr-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)]"
                        />
                    </div>
                 </div>
            </div>

             <div className="grid grid-cols-2 gap-4 mt-4">
                  {shouldShowField('online_offer_price') && (
                  <div>
                     <label className="block text-sm font-semibold text-neutral-700 mb-2">
                        Offer Price (Online)
                      </label>
                     <div className="relative">
                         <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                         <input
                            type="number"
                            name="offerPrice"
                            value={formData.offerPrice}
                            onChange={handleChange}
                            placeholder="0.00"
                            className="w-full pl-7 pr-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)]"
                         />
                     </div>
                  </div>
                  )}
                  <div>
                     <label className="block text-sm font-semibold text-neutral-700 mb-2">
                       Wholesale Price
                     </label>
                     <div className="relative">
                         <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                         <input
                            type="number"
                            name="wholesalePrice"
                            value={formData.wholesalePrice}
                            onChange={handleChange}
                            placeholder="0.00"
                            className="w-full pl-7 pr-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)]"
                         />
                     </div>
                  </div>
             </div>

              {/* Purchase Price */}
             {shouldShowField('purchase_price') && (
                <div>
                   <label className="block text-sm font-semibold text-neutral-700 mb-2">
                    Purchase Price
                   </label>
                   <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                       <input
                         type="number"
                         name="purchasePrice"
                         value={(formData as any).purchasePrice}
                         onChange={handleChange}
                         placeholder="0.00"
                         className="w-full pl-7 pr-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)]"
                       />
                   </div>
                </div>
             )}

             {/* Stock Field */}
             <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                 Stock
                </label>
                <input
                  type="number"
                  name="stock"
                  value={formData.stock}
                  onChange={handleChange}
                  placeholder="0 = Unlimited"
                  className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)]"
                />
             </div>
          </div>

          {/* Product Section Details */}
          <div className="bg-white rounded-xl shadow-sm border border-neutral-200">
            <div className="p-6 space-y-6 rounded-b-xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {shouldShowField('pack') && (
                <div className="md:col-span-2">
                   <label className="block text-sm font-semibold text-neutral-700 mb-2">
                    Pack / Unit Size <span className="text-xs text-neutral-500 font-normal ml-1">(e.g. 1 kg, 500 ml, 1 pc)</span>
                   </label>
                   <div className="relative">
                     <input
                       type="text"
                       name="pack"
                       value={formData.pack}
                       onClick={() => setIsUnitModalOpen(true)}
                       readOnly
                       placeholder="Select Unit Size"
                       className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] transition-all cursor-pointer bg-white"
                     />
                     <div className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
                     </div>
                   </div>
                </div>
                )}

                  {shouldShowField('item_code') && (
                  <div className="md:col-span-1 border-b border-neutral-100 pb-4 mb-2">
                     <label className="block text-sm font-semibold text-neutral-700 mb-2">
                      Item Code (SKU) & Multiple Barcodes
                     </label>
                     <div className="space-y-3">
                         {/* Barcode Fragments/Chips */}
                         <div className="flex flex-wrap gap-2">
                             {formData.barcode && formData.barcode.length > 0 ? (
                                 formData.barcode.map(b => (
                                     <span key={b} className="inline-flex items-center gap-1 px-3 py-1 bg-pink-100 text-[var(--primary-dark)] border border-pink-200 rounded-md text-xs font-semibold shadow-sm">
                                         {b}
                                         <button type="button" onClick={() => removeBarcode('product', b)} className="hover:text-red-500 transition-colors ml-1">
                                             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                         </button>
                                     </span>
                                 ))
                             ) : (
                                 <span className="text-xs text-gray-400 italic">No barcodes added yet</span>
                             )}
                         </div>

                         {/* Input Row */}
                         <div className="flex flex-col md:flex-row gap-2">
                             <div className="flex-1 relative">
                                <input
                                  type="text"
                                  name="itemCode" // Keep itemCode as temporary input but encourage adding to multiple list
                                  value={formData.itemCode}
                                  onChange={handleChange}
                                  onKeyDown={(e) => {
                                     if (e.key === "Enter") {
                                         e.preventDefault();
                                         if(formData.itemCode.trim()) {
                                             addBarcode('product', null, formData.itemCode);
                                             setFormData(prev => ({ ...prev, itemCode: "" }));
                                         }
                                     }
                                  }}
                                  placeholder="Enter Barcode / SKU"
                                  className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] transition-all"
                                />
                             </div>
                             <div className="flex gap-2 shrink-0">
                                 <button
                                     type="button"
                                     onClick={() => {
                                         if(formData.itemCode.trim()) {
                                             addBarcode('product', null, formData.itemCode);
                                             setFormData(prev => ({ ...prev, itemCode: "" }));
                                         }
                                     }}
                                      className="px-4 py-2.5 bg-[var(--primary-color)] text-white rounded-lg text-sm font-bold hover:bg-[var(--primary-dark)] transition-colors shadow-sm"
                                 >
                                     Add
                                 </button>
                                 <button
                                     type="button"
                                     onClick={() => handleAutoGenerateBarcode("sku")}
                                     className="p-2.5 bg-pink-50 border border-pink-200 rounded-lg hover:bg-pink-100 text-[var(--primary-color)] transition-colors"
                                     title="Auto Generate"
                                 >
                                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                                 </button>
                                 <button
                                     type="button"
                                     onClick={() => startScanning("sku")}
                                     className="p-2.5 bg-pink-50 border border-pink-200 rounded-lg hover:bg-pink-100 text-[var(--primary-color)] transition-colors"
                                     title="Scan"
                                 >
                                     <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path></svg>
                                 </button>
                             </div>
                         </div>
                     </div>
                  </div>
                  )}
                {shouldShowField('rack_number') && (
                <div className="md:col-span-1">
                   <label className="block text-sm font-semibold text-neutral-700 mb-2">
                    Rack Number
                   </label>
                   <input
                     type="text"
                     name="rackNumber"
                     value={formData.rackNumber}
                     onChange={handleChange}
                     placeholder="Enter Rack Number"
                     className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] transition-all"
                   />
                </div>
                )}

                {shouldShowField('header_category') && (
                    <div>
                      <label className="block text-sm font-semibold text-neutral-700 mb-2">
                        Header Category
                      </label>
                      <ThemedDropdown
                        options={headerCategories.map(hc => ({ id: hc._id, label: hc.name, value: hc._id }))}
                        value={formData.headerCategory}
                        onChange={(val) => setFormData(prev => ({ ...prev, headerCategory: val }))}
                        placeholder="Select Header Category"
                      />
                    </div>
                )}

                {shouldShowField('category') && (
                    <div>
                      <label className="block text-sm font-semibold text-neutral-700 mb-2">
                        Category
                      </label>
                      <ThemedDropdown
                        options={categories
                          .filter((cat: any) => {
                            if (formData.headerCategory) {
                              const catHeaderId = typeof cat.headerCategoryId === "string"
                                  ? cat.headerCategoryId
                                  : cat.headerCategoryId?._id;
                              return catHeaderId === formData.headerCategory;
                            }
                            return false;
                          })
                          .map((cat: any) => ({ id: cat._id || cat.id, label: cat.name, value: cat._id || cat.id }))
                        }
                        value={formData.category}
                        onChange={(val) => setFormData(prev => ({ ...prev, category: val }))}
                        placeholder={formData.headerCategory ? "Select Category" : "Select Header Category First"}
                        disabled={!formData.headerCategory}
                      />
                    </div>
                )}

                {shouldShowField('subcategory') && (
                    <div>
                      <label className="block text-sm font-semibold text-neutral-700 mb-2">
                        SubCategory
                      </label>
                      <ThemedDropdown
                        options={subcategories.filter((sub: any) => {
                          const subCatProperty = sub.category;
                          const sCatId = String((typeof subCatProperty === 'object' && subCatProperty) ? (subCatProperty as any)._id : (subCatProperty || "")).trim().toLowerCase();
                          const sCatName = String((typeof subCatProperty === 'object' && subCatProperty) ? (subCatProperty as any).name || (subCatProperty as any).categoryName : (subCatProperty || "")).trim().toLowerCase();

                          const tRef = String(formData.category || "").trim().toLowerCase();
                          if (!tRef) return true;

                          // 1. Direct match with ID or Name
                          if (sCatId === tRef || sCatName === tRef) return true;

                          // 2. Cross-resolve through master categories list
                          const targetCat = categories.find(c =>
                            String(c._id).toLowerCase().trim() === tRef ||
                            String(c.name || (c as any).categoryName || "").trim().toLowerCase() === tRef
                          );

                          if (targetCat) {
                            const tId = String(targetCat._id).toLowerCase().trim();
                            const tName = String(targetCat.name || (targetCat as any).categoryName || "").trim().toLowerCase();
                            if (sCatId === tId || sCatName === tName) return true;
                          }

                          // 3. Last resort: Resolve subcategory's category and check name match
                          if (/^[0-9a-fA-F]{24}$/.test(sCatId)) {
                            const subParentCat = categories.find(c => String(c._id).toLowerCase().trim() === sCatId);
                            if (subParentCat) {
                                const spName = String(subParentCat.name || (subParentCat as any).categoryName || "").trim().toLowerCase();
                                if (spName === tRef) return true;
                            }
                          }

                          return false;
                        }).map((sub: any) => ({
                           id: sub._id,
                           label: String(sub.name || sub.subcategoryName || sub.name || "-"),
                           value: sub._id
                        }))}
                        value={formData.subcategory}
                        onChange={(val) => setFormData(prev => ({ ...prev, subcategory: val }))}
                        placeholder={formData.category ? "Select Subcategory" : "Select Category First"}
                        disabled={!formData.category}
                      />
                    </div>
                )}

                {shouldShowField('sub_subcategory') && (
                    <div>
                      <label className="block text-sm font-semibold text-neutral-700 mb-2">
                        Sub-SubCategory
                      </label>
                      <input
                        type="text"
                        name="subSubCategory"
                        value={formData.subSubCategory}
                        onChange={handleChange}
                        placeholder="Enter Sub-SubCategory"
                        className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] transition-all"
                      />
                    </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">
                    Publish Product?
                  </label>
                  <ThemedDropdown
                    options={['Yes', 'No']}
                    value={formData.publish}
                    onChange={(val) => setFormData(prev => ({ ...prev, publish: val }))}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">
                    Make Popular?
                  </label>
                  <ThemedDropdown
                    options={['Yes', 'No']}
                    value={formData.popular}
                    onChange={(val) => setFormData(prev => ({ ...prev, popular: val }))}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">
                    Deal of the Day?
                  </label>
                  <ThemedDropdown
                    options={['Yes', 'No']}
                    value={formData.dealOfDay}
                    onChange={(val) => setFormData(prev => ({ ...prev, dealOfDay: val }))}
                  />
                </div>

                {shouldShowField('tags') && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">
                    Tags <span className="text-xs text-neutral-500 font-normal ml-1">(Separated by comma)</span>
                  </label>
                  <input
                    type="text"
                    name="tags"
                    value={formData.tags}
                    onChange={handleChange}
                    placeholder="Enter tags for search optimization"
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] transition-all"
                  />
                </div>
                )}
              </div>

              {shouldShowField('summary') && (
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-1">
                    Short Description
                  </label>
                  <textarea
                    name="smallDescription"
                    value={formData.smallDescription}
                    onChange={handleChange}
                    placeholder="Enter a brief product description..."
                    rows={3}
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] resize-none transition-all"
                  />
                </div>
              )}
            </div>
          </div>


          {/* Print Barcodes Section */}
          <div className="bg-white rounded-xl shadow-sm border border-neutral-200">
            <div className="bg-[var(--primary-color)] text-white px-4 py-2.5 rounded-t-xl">
              <h2 className="text-base font-semibold tracking-wide">Print Barcodes</h2>
            </div>
            <div className="p-4 border-x border-b border-neutral-200 rounded-b-xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={printQuantity}
                    onChange={(e) => setPrintQuantity(e.target.value)}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)]"
                    placeholder="How many copies?"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Select Barcode</label>
                  <select
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)]"
                    value={selectedPrintBarcode}
                    onChange={(e) => {
                      const selectedVal = e.target.value;
                      setSelectedPrintBarcode(selectedVal);

                      if (selectedVal) {
                        let name = formData.productName;
                        let sp: number | undefined;
                        let mrp: number | undefined;

                        // Check if variation
                        const variation = variations.find(v => (v.barcode || []).includes(selectedVal));
                        if (variation) {
                          name = `${formData.productName} - ${variation.title}`;
                          mrp = variation.price;
                          sp = variation.discPrice > 0 ? variation.discPrice : variation.price;
                        } else if (formData.barcode.includes(selectedVal)) {
                          if (variations.length > 0) {
                            mrp = variations[0].price;
                            sp = variations[0].discPrice > 0 ? variations[0].discPrice : variations[0].price;
                          }
                        }

                        handlePrintBarcode(selectedVal, parseInt(printQuantity) || 1, name, sp, mrp);
                      }
                    }}
                  >
                    <option value="">-- Select to Print --</option>
                    {formData.barcode.map(b => (
                      <option key={b} value={b}>{b} (Main Product)</option>
                    ))}
                    {variations.map((v, idx) => (v.barcode || []).map(b => (
                      <option key={`${idx}-${b}`} value={b}>{b} ({v.title})</option>
                    )))}
                  </select>
                </div>
              </div>
              <p className="text-xs text-neutral-500 mt-2">
                * Select a barcode to immediately open the print preview.
              </p>
            </div>
          </div>


          <div className="bg-white rounded-xl shadow-sm border border-neutral-200">
            <div
              className="bg-[var(--primary-color)] text-white px-6 py-4 rounded-t-xl flex justify-between items-center cursor-pointer"
              onClick={() => setShowSEO(!showSEO)}
            >
              <h2 className="text-lg font-semibold tracking-wide">SEO Configuration</h2>
              <svg
                className={`w-6 h-6 transition-transform duration-300 ${showSEO ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            {showSEO && (
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {shouldShowField('seo_title') && (
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">
                    meta Title
                  </label>
                  <input
                    type="text"
                    name="seoTitle"
                    value={formData.seoTitle}
                    onChange={handleChange}
                    placeholder="Enter meta Title"
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] transition-all"
                  />
                </div>
                )}
                {shouldShowField('seo_keywords') && (
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">
                    meta Keywords
                  </label>
                  <input
                    type="text"
                    name="seoKeywords"
                    value={formData.seoKeywords}
                    onChange={handleChange}
                    placeholder="Enter meta Keywords"
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] transition-all"
                  />
                </div>
                )}
                {shouldShowField('seo_image_alt') && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">
                    Image Alt Attributes
                  </label>
                  <input
                    type="text"
                    name="seoImageAlt"
                    value={formData.seoImageAlt}
                    onChange={handleChange}
                    placeholder="Enter Image Alt Text"
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] transition-all"
                  />
                </div>
                )}
                {shouldShowField('seo_description') && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">
                    meta Description
                  </label>
                  <textarea
                    name="seoDescription"
                    value={formData.seoDescription}
                    onChange={handleChange}
                    placeholder="Enter meta Description"
                    rows={4}
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] resize-none transition-all"
                  />
                </div>
                )}
              </div>
            </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-neutral-200">
            <div
              className="bg-[var(--primary-color)] text-white px-6 py-4 rounded-t-xl flex justify-between items-center cursor-pointer"
              onClick={() => setShowVariations(!showVariations)}
            >
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold tracking-wide">Product Variations</h2>
                <svg
                  className={`w-6 h-6 transition-transform duration-300 ${showVariations ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <span className="text-sm font-medium text-white/90">Enable Attributes</span>
                  <button
                      type="button"
                      onClick={() => setEnableAttributes(!enableAttributes)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${enableAttributes ? 'bg-pink-200' : 'bg-pink-800'}`}
                  >
                      <span className={`inline-block h-4 w-4 transform rounded-full transition-transform bg-white ${enableAttributes ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
              </div>
            </div>

            {showVariations && (
              <>

            <div className="p-6 space-y-6 border-x border-b border-neutral-200 rounded-b-xl">
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  Variation Type
                </label>
                <div className="max-w-xs">
                  <ThemedDropdown
                    options={availableVariationTypes.map(vt => ({ id: vt._id || vt.id, label: vt.name, value: vt.name }))}
                    value={formData.variationType}
                    onChange={(val) => {
                      setFormData(prev => ({ ...prev, variationType: val }));
                      setEnableColors(val.toLowerCase() === 'color');
                    }}
                    placeholder="Select Variation Type"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  Variation Name <span className="text-xs text-neutral-500 font-normal ml-1">(e.g. Scent Name, Material)</span>
                </label>
                <div className="max-w-xs">
                  <input
                    type="text"
                    name="variationName"
                    value={formData.variationName}
                    onChange={handleChange}
                    placeholder="Enter Variation Name"
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)]"
                  />
                </div>
              </div>

              {formData.variationType.toLowerCase() === 'color' && (
                  <div className="bg-white p-4 rounded-lg border border-neutral-200 shadow-sm mb-4">
                     <label className="block text-sm font-semibold text-neutral-700 mb-2">
                        Select Colors
                     </label>
                     <div className="flex flex-col sm:flex-row gap-2 mb-3 max-w-lg items-center">
                         <input
                             type="color"
                             className="w-10 h-10 p-1 border border-neutral-300 rounded cursor-pointer shrink-0"
                             value={colorInput.code}
                             onChange={(e) => setColorInput(prev => ({...prev, code: e.target.value}))}
                         />
                         <input
                             type="text"
                             placeholder="Color Name (e.g. Red, Forest Green)"
                             className="flex-1 px-3 py-2 border border-neutral-300 rounded text-sm focus:outline-none focus:border-[var(--primary-color)]"
                             value={colorInput.name}
                             onChange={(e) => {
                                 const name = e.target.value;
                                 setColorInput(prev => ({...prev, name}));

                                 // Try to auto-detect color code from name
                                 if (name.length > 2) {
                                     const s = new Option().style;
                                     s.color = name;
                                     if (s.color !== '') {
                                         const tempEl = document.createElement("div");
                                         tempEl.style.color = name;
                                         document.body.appendChild(tempEl);
                                         const computedColor = window.getComputedStyle(tempEl).color;
                                         document.body.removeChild(tempEl);

                                         const rgbMatch = computedColor.match(/\d+/g);
                                         if (rgbMatch && rgbMatch.length >= 3) {
                                             const hex = "#" + rgbMatch.slice(0, 3).map(x => {
                                                 const h = parseInt(x).toString(16);
                                                 return h.length === 1 ? "0" + h : h;
                                             }).join("");
                                             setColorInput(prev => ({...prev, code: hex}));
                                         }
                                     }
                                 }
                             }}
                         />
                          <button
                             type="button"
                             onClick={handleAddColor}
                              className="px-4 py-2 bg-[var(--primary-color)]/10 text-[var(--primary-color)] border border-[var(--primary-color)]/20 rounded hover:bg-[var(--primary-color)]/20 text-sm font-medium"
                          >Add</button>
                     </div>
                     <div className="flex flex-wrap gap-2">
                         {selectedColors.length === 0 && <span className="text-xs text-gray-400 italic">No colors added yet</span>}
                         {selectedColors.map(color => (
                             <span key={color.name} className="px-3 py-1 bg-neutral-100 text-neutral-800 border border-neutral-200 rounded-full text-xs font-medium flex items-center gap-2">
                                 <span className="w-3 h-3 rounded-full border border-gray-300 shadow-sm" style={{ backgroundColor: color.code }}></span>
                                 {color.name}
                                 <button type="button" onClick={() => handleRemoveColor(color.name)} className="text-neutral-400 hover:text-red-500 font-bold focus:outline-none">&times;</button>
                             </span>
                         ))}
                     </div>
                  </div>
              )}

              {enableAttributes ? (
                  /* Attribute Selection UI */
                  <div className="space-y-6 bg-neutral-50 p-6 rounded-xl border border-neutral-200">
                     {/* Step 0: Select Colors (Special Case) */}
                     <div>
                         <div className="flex items-center justify-between mb-4">
                            <label className="block text-sm font-semibold text-neutral-700">
                                Select Colors
                            </label>
                             <button
                                type="button"
                                onClick={() => setEnableColors(!enableColors)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${enableColors ? 'bg-[var(--primary-color)]' : 'bg-neutral-300'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full transition-transform bg-white ${enableColors ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                         </div>

                         {enableColors && (
                             <div className="bg-white p-4 rounded-lg border border-neutral-200 shadow-sm mb-4">
                                <div className="flex flex-col sm:flex-row gap-2 mb-3 max-w-lg items-center">
                                    <input
                                        type="color"
                                        className="w-10 h-10 p-1 border border-neutral-300 rounded cursor-pointer shrink-0"
                                        value={colorInput.code}
                                        onChange={(e) => setColorInput(prev => ({...prev, code: e.target.value}))}
                                    />
                                    <input
                                        type="text"
                                        placeholder="Color Name (e.g. Red, Forest Green)"
                                        className="flex-1 px-3 py-2 border border-neutral-300 rounded text-sm focus:outline-none focus:border-[var(--primary-color)]"
                                        value={colorInput.name}
                                        onChange={(e) => {
                                            const name = e.target.value;
                                            setColorInput(prev => ({...prev, name}));

                                            // Try to auto-detect color code from name
                                            if (name.length > 2) {
                                                const s = new Option().style;
                                                s.color = name;
                                                // Check if it's a valid color (browser accepts it)
                                                if (s.color !== '') {
                                                    // This gives us 'red' or 'rgb(...)', need hex for input type=color
                                                    // Helper to convert rgb/name to hex
                                                    const tempEl = document.createElement("div");
                                                    tempEl.style.color = name;
                                                    document.body.appendChild(tempEl);
                                                    const computedColor = window.getComputedStyle(tempEl).color;
                                                    document.body.removeChild(tempEl);

                                                    // Convert rgb(r, g, b) to #hex
                                                    const rgbMatch = computedColor.match(/\d+/g);
                                                    if (rgbMatch && rgbMatch.length >= 3) {
                                                        const hex = "#" + rgbMatch.slice(0, 3).map(x => {
                                                            const h = parseInt(x).toString(16);
                                                            return h.length === 1 ? "0" + h : h;
                                                        }).join("");
                                                        setColorInput(prev => ({...prev, code: hex}));
                                                    }
                                                }
                                            }
                                        }}
                                        onKeyDown={(e) => {
                                           if(e.key === 'Enter') {
                                               e.preventDefault();
                                               handleAddColor();
                                           }
                                        }}
                                    />
                                     <button
                                        type="button"
                                        onClick={handleAddColor}
                                         className="px-4 py-2 bg-pink-50 text-[var(--primary-color)] border border-pink-200 rounded hover:bg-pink-100 text-sm font-medium"
                                     >Add</button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {selectedColors.length === 0 && <span className="text-xs text-gray-400 italic">No colors added yet</span>}
                                    {selectedColors.map(color => (
                                        <span key={color.name} className="px-3 py-1 bg-neutral-100 text-neutral-800 border border-neutral-200 rounded-full text-xs font-medium flex items-center gap-2">
                                            <span className="w-3 h-3 rounded-full border border-gray-300 shadow-sm" style={{ backgroundColor: color.code }}></span>
                                            {color.name}
                                            <button type="button" onClick={() => handleRemoveColor(color.name)} className="text-neutral-400 hover:text-red-500 font-bold focus:outline-none">&times;</button>
                                        </span>
                                    ))}
                                </div>
                             </div>
                         )}
                     </div>

                     {/* Step 1: Select Attributes */}
                       <div>
                          <label className="block text-sm font-semibold text-neutral-700 mb-2">
                              Select Attributes
                          </label>
                          <div className="flex flex-col sm:flex-row gap-2 max-w-md">
                             <select
                                  className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]"
                                  value={selectedAttributeId}
                                  onChange={(e) => setSelectedAttributeId(e.target.value)}
                             >
                                 <option value="">Select an Attribute</option>
                                 {availableAttributes.map(attr => (
                                     <option key={attr._id || attr.id} value={attr._id || attr.id} disabled={selectedAttributes.some(s => s.id === (attr._id || attr.id))}>
                                         {attr.name}
                                     </option>
                                 ))}
                             </select>
                             <button
                                 type="button"
                                 onClick={handleAddAttribute}
                                 className="px-4 py-2 bg-[var(--primary-color)] text-white rounded-lg text-sm font-medium hover:bg-[var(--primary-dark)]"
                             >
                                 Add
                             </button>
                          </div>
                       </div>

                       {/* Step 2: Attribute Values */}
                       {selectedAttributes.map((attr) => (
                           <div key={attr.id} className="bg-white p-4 rounded-lg border border-neutral-200 shadow-sm relative">
                               <button type="button" onClick={() => handleRemoveAttribute(attr.id)} className="absolute top-2 right-2 text-gray-400 hover:text-red-500 text-lg leading-none">&times;</button>
                               <h4 className="font-semibold text-[var(--primary-color)] mb-2">{attr.name} Values</h4>
                               <div className="flex flex-col sm:flex-row gap-2 mb-3 max-w-lg">
                                   <input
                                       type="text"
                                       placeholder={`Add ${attr.name} value (e.g. Red, XL)`}
                                       className="flex-1 px-3 py-2 border border-neutral-300 rounded text-sm focus:outline-none focus:border-[var(--primary-color)]"
                                       value={attrInputValues[attr.id] || ""}
                                       onChange={(e) => setAttrInputValues(prev => ({...prev, [attr.id]: e.target.value}))}
                                       onKeyDown={(e) => {
                                          if(e.key === 'Enter') {
                                              e.preventDefault();
                                              handleAddAttributeValue(attr.id, attrInputValues[attr.id] || "");
                                              setAttrInputValues(prev => ({...prev, [attr.id]: ""}));
                                          }
                                       }}
                                   />
                                    <button
                                       type="button"
                                       onClick={() => {
                                           handleAddAttributeValue(attr.id, attrInputValues[attr.id] || "");
                                           setAttrInputValues(prev => ({...prev, [attr.id]: ""}));
                                       }}
                                         className="px-4 py-2 bg-[var(--primary-color)]/10 text-[var(--primary-color)] border border-[var(--primary-color)]/20 rounded hover:bg-[var(--primary-color)]/20 text-sm font-medium"
                                    >Add</button>
                               </div>
                               <div className="flex flex-wrap gap-2">
                                   {attr.values.length === 0 && <span className="text-xs text-gray-400 italic">No values added yet</span>}
                                   {attr.values.map(val => (
                                       <span key={val} className="px-3 py-1 bg-[var(--primary-color)]/10 text-[var(--primary-color)] border border-[var(--primary-color)]/20 rounded-full text-xs font-medium flex items-center gap-2">
                                           {val}
                                           <button type="button" onClick={() => handleRemoveAttributeValue(attr.id, val)} className="text-[var(--primary-color)]/60 hover:text-red-500 font-bold focus:outline-none">&times;</button>
                                       </span>
                                   ))}
                               </div>
                           </div>
                       ))}

                       {/* Unit Values */}
                       <div className="bg-white p-4 rounded-lg border border-neutral-200 shadow-sm">
                           <h4 className="font-semibold text-[var(--primary-color)] mb-2">Unit Values (Optional)</h4>
                           <div className="flex flex-col sm:flex-row gap-2 mb-3 max-w-lg">
                               <input
                                   type="text"
                                   placeholder="e.g. 1kg, 5kg"
                                   className="flex-1 px-3 py-2 border border-neutral-300 rounded text-sm focus:outline-none focus:border-[var(--primary-color)]"
                                   value={currentUnitInput}
                                   onChange={e => setCurrentUnitInput(e.target.value)}
                                   onKeyDown={(e) => {
                                      if(e.key === 'Enter') {
                                          e.preventDefault();
                                          handleAddUnit();
                                      }
                                   }}
                               />
                               <button
                                   type="button"
                                   onClick={handleAddUnit}
                                   className="px-4 py-2 bg-[var(--primary-color)]/10 text-[var(--primary-color)] border border-[var(--primary-color)]/20 rounded hover:bg-[var(--primary-color)]/20 text-sm font-medium"
                               >Add</button>
                           </div>
                           <div className="flex flex-wrap gap-2">
                               {variationUnits.length === 0 && <span className="text-xs text-gray-400 italic">No units added (Will generate single variation per attribute combo)</span>}
                               {variationUnits.map(unit => (
                                   <span key={unit} className="px-3 py-1 bg-[var(--primary-color)]/10 text-[var(--primary-color)] border border-[var(--primary-color)]/20 rounded-full text-xs font-medium flex items-center gap-2">
                                       {unit}
                                       <button type="button" onClick={() => handleRemoveUnit(unit)} className="text-[var(--primary-color)]/60 hover:text-red-500 font-bold focus:outline-none">&times;</button>
                                   </span>
                               ))}

                           </div>
                       </div>

                       <div className="flex justify-end pt-4 border-t border-neutral-200">
                           <button
                               type="button"
                               onClick={generateVariations}
                               className="px-6 py-2.5 bg-[var(--primary-color)] text-white rounded-lg hover:bg-[var(--primary-dark)] shadow-sm font-medium transition-colors"
                           >
                               Generate Variations Table
                           </button>
                       </div>
                  </div>
              ) : (
                /* Variation Form (Old Manual) */
                <div id="variation-form-section" className={`bg-neutral-50 rounded-xl p-6 border ${editingVariationIndex !== null ? 'border-[var(--primary-color)] ring-1 ring-[var(--primary-color)]' : 'border-neutral-200'}`}>
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-start">
                    {/* Variation Image */}
                    <div className="md:col-span-1">
                        <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">
                            Image
                        </label>
                        <div className="relative w-full aspect-square bg-white border border-neutral-300 rounded-lg flex items-center justify-center overflow-hidden group cursor-pointer hover:border-[var(--primary-color)]">
                            {variationForm.image ? (
                                <>
                                    <img src={variationForm.image} alt="Var" className="w-full h-full object-cover" />
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setVariationForm(prev => ({...prev, image: ""}));
                                        }}
                                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                    </button>
                                </>
                            ) : (
                                <div className="text-center p-2">
                                    <span className="text-xs text-gray-400">Upload</span>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if(!file) return;
                                            // Validate
                                            const validation = validateImageFile(file);
                                            if(!validation.valid) {
                                                setUploadError(validation.error || "Invalid file");
                                                return;
                                            }
                                            try {
                                                const res = await uploadImage(file, "Geeta Stores/products/variations");
                                                if(res && res.secureUrl) {
                                                    setVariationForm(prev => ({...prev, image: res.secureUrl}));
                                                }
                                            } catch(err) {
                                                console.error(err);
                                                setUploadError("Failed to upload image");
                                            }
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="md:col-span-5 grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div className="col-span-1">
                          <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">
                            {formData.variationName || "Unit Value"}
                          </label>
                          <input
                            type="text"
                            value={variationForm.title}
                            onChange={(e) => setVariationForm({ ...variationForm, title: e.target.value })}
                            placeholder="e.g. XL, 1kg"
                            className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)]"
                          />
                        </div>
                        <div className="col-span-1">
                          <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">
                            MRP Price
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">₹</span>
                            <input
                              type="number"
                              value={variationForm.compareAtPrice}
                              onChange={(e) => setVariationForm({ ...variationForm, compareAtPrice: e.target.value })}
                              placeholder="0.00"
                              className="w-full pl-7 pr-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)]"
                            />
                          </div>
                        </div>
                        <div className="col-span-1">
                          <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">
                            Selling Price *
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">₹</span>
                            <input
                              type="number"
                              value={variationForm.price}
                              onChange={(e) => setVariationForm({ ...variationForm, price: e.target.value })}
                              placeholder="0.00"
                              className="w-full pl-7 pr-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)]"
                            />
                          </div>
                        </div>

                        <div className="col-span-1">
                          <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">
                            Stock
                          </label>
                          <input
                            type="number"
                            value={variationForm.stock}
                            onChange={(e) => setVariationForm({ ...variationForm, stock: e.target.value })}
                            placeholder="0 = Unlimited"
                            className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)]"
                          />
                        </div>

                        <div className="col-span-1">
                          <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">
                            Wholesale Price
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">₹</span>
                            <input
                              type="number"
                              value={variationForm.wholesalePrice}
                              onChange={(e) => setVariationForm({ ...variationForm, wholesalePrice: e.target.value })}
                              placeholder="0.00"
                              className="w-full pl-7 pr-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)]"
                            />
                          </div>
                        </div>

                        {shouldShowField('online_offer_price') && (
                        <div className="col-span-1">
                          <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">
                            Offer Price (Online)
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">₹</span>
                            <input
                              type="number"
                              value={variationForm.offerPrice}
                              onChange={(e) => setVariationForm({ ...variationForm, offerPrice: e.target.value })}
                              placeholder="0.00"
                              className="w-full pl-7 pr-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)]"
                            />
                          </div>
                        </div>
                        )}
                    </div>

                    {/* Tiered Pricing Section */}
                    <div className="md:col-span-5 bg-gray-50 p-4 rounded-lg border border-dashed border-gray-300">
                        <div className="flex justify-between items-center mb-3">
                            <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                                Unit Pricing (Buy X get for Y)
                            </label>
                            <button
                              type="button"
                              onClick={handleAddTier}
                              className="text-xs font-bold text-[var(--primary-color)] hover:text-[var(--primary-dark)]"
                            >
                              + Add Tier
                            </button>
                        </div>

                        {variationForm.tieredPrices.length === 0 && (
                            <p className="text-xs text-center text-gray-400 italic py-2">No unit pricing added.</p>
                        )}

                        <div className="space-y-3">
                            {variationForm.tieredPrices.map((tier, idx) => (
                                <div key={idx} className="flex gap-3 items-center">
                                    <div className="flex-1">
                                        <input
                                            type="number"
                                            placeholder="Min Qty (e.g. 2)"
                                            className="w-full px-3 py-2 border border-neutral-300 rounded text-sm"
                                            value={tier.minQty}
                                            onChange={e => handleTierChange(idx, 'minQty', e.target.value)}
                                        />
                                    </div>
                                    <div className="flex-1 relative">
                                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">₹</span>
                                        <input
                                            type="number"
                                            placeholder="Price/Unit"
                                            className="w-full pl-6 pr-3 py-2 border border-neutral-300 rounded text-sm"
                                            value={tier.price}
                                            onChange={e => handleTierChange(idx, 'price', e.target.value)}
                                        />
                                    </div>
                                    <button onClick={() => handleRemoveTier(idx)} className="text-red-500 hover:text-red-700">✕</button>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="md:col-span-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div className="flex-1">
                          <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">
                              Barcodes
                          </label>
                          <div className="space-y-2">
                              <div className="flex flex-wrap gap-2 mb-2">
                                  {variationForm.barcode.map(b => (
                                      <span key={b} className="inline-flex items-center gap-1 px-2 py-1 bg-pink-100 text-[var(--primary-dark)] rounded-md text-xs font-medium">
                                          {b}
                                          <button type="button" onClick={() => removeBarcode('variation', b)} className="hover:text-red-500">
                                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                          </button>
                                      </span>
                                  ))}
                              </div>
                              <div className="flex flex-col md:flex-row gap-2">
                                   <input
                                      type="text"
                                      value={currentVarBarcode}
                                      onChange={(e) => setCurrentVarBarcode(e.target.value)}
                                      onKeyDown={(e) => {
                                          if(e.key === 'Enter') {
                                              e.preventDefault();
                                              addBarcode('variation', null, currentVarBarcode);
                                          }
                                      }}
                                      placeholder="Scan or Enter"
                                      className="w-full md:w-auto md:flex-1 px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)]"
                                  />
                                  <div className="flex gap-2 shrink-0">
                                      <button
                                          type="button"
                                          onClick={() => addBarcode('variation', null, currentVarBarcode)}
                                          className="px-3 py-2 bg-[var(--primary-color)] text-white rounded-lg text-xs font-bold hover:bg-[var(--primary-dark)]"
                                      >Add</button>
                                      <button
                                          type="button"
                                          onClick={() => handleAutoGenerateBarcode("variation")}
                                          className="flex-1 md:flex-none px-3 py-2 bg-pink-50 border border-pink-200 rounded-lg hover:bg-pink-100 text-[var(--primary-color)] transition-colors flex items-center justify-center gap-2"
                                          title="Auto Generate Barcode"
                                          >
                                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                                      </button>
                                      <button
                                          type="button"
                                          onClick={() => startScanning("variation")}
                                          className="flex-1 md:flex-none px-3 py-2 bg-pink-50 border border-pink-200 rounded-lg hover:bg-pink-100 text-[var(--primary-color)] transition-colors flex items-center justify-center gap-2"
                                          title="Scan Barcode"
                                          >
                                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path></svg>
                                      </button>
                                  </div>
                              </div>
                          </div>
                       </div>
                    </div>
                    <div className="flex items-end h-full pt-6 md:col-span-5 justify-end gap-3">
                      {editingVariationIndex !== null && (
                        <button
                          type="button"
                          onClick={cancelVariationEdit}
                          className="px-6 py-2 bg-neutral-200 hover:bg-neutral-300 text-neutral-700 rounded-lg text-sm font-medium transition-colors"
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={addVariation}
                        className="px-6 py-2 bg-[var(--primary-color)] hover:bg-[var(--primary-dark)] text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                      >
                        {editingVariationIndex !== null ? "Update Variation" : "Add Variation +"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Variations List/Table */}
              {variations.length > 0 && (
                enableAttributes ? (
                    <div className="overflow-x-auto border border-neutral-200 rounded-lg">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-pink-50 text-[#880E4F] font-semibold border-b border-pink-100">
                                <tr>
                                    <th className="px-4 py-3 w-[80px]">Image</th>
                                    <th className="px-4 py-3 min-w-[150px]">{formData.variationName || "Variation"}</th>
                                    <th className="px-4 py-3 min-w-[100px]">MRP (₹)</th>
                                    <th className="px-4 py-3 min-w-[100px]">Selling Price (₹) <span className="text-red-500">*</span></th>
                                    <th className="px-4 py-3 min-w-[100px]">Offer Price (Online)</th>
                                    <th className="px-4 py-3 min-w-[100px]">Wholesale</th>
                                    <th className="px-4 py-3 min-w-[80px]">Stock</th>
                                    <th className="px-4 py-3 min-w-[180px]">SKU/Barcode</th>
                                    <th className="px-4 py-3 min-w-[100px]">Unit Pricing</th>
                                    <th className="px-4 py-3 w-10 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100 bg-white">
                                {variations.map((v, idx) => (
                                    <tr key={idx} className="hover:bg-neutral-50 group">
                                        <td className="px-4 py-2">
                                            <div className="relative w-12 h-12 bg-white border border-neutral-300 rounded overflow-hidden flex items-center justify-center cursor-pointer hover:border-[var(--primary-color)]">
                                                {v.image ? (
                                                    <div className="w-full h-full relative group/img">
                                                        <img src={v.image} alt="Var" className="w-full h-full object-cover" />
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setVariations(prev => {
                                                                    const n = [...prev];
                                                                    n[idx].image = "";
                                                                    return n;
                                                                });
                                                            }}
                                                            className="absolute top-0 right-0 bg-red-500 text-white w-4 h-4 flex items-center justify-center text-[10px] opacity-0 group-hover/img:opacity-100"
                                                        >
                                                            &times;
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                                            onChange={async (e) => {
                                                                const file = e.target.files?.[0];
                                                                if(!file) return;
                                                                if(!validateImageFile(file).valid) return;
                                                                try {
                                                                    const res = await uploadImage(file, "Geeta Stores/products/variations");
                                                                    if(res.secureUrl) {
                                                                        setVariations(prev => {
                                                                            const n = [...prev];
                                                                            n[idx].image = res.secureUrl;
                                                                            return n;
                                                                        });
                                                                    }
                                                                } catch(err) { console.error(err); }
                                                            }}
                                                        />
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-2 font-medium text-neutral-800">{v.title}</td>
                                        <td className="px-4 py-2">
                                            <input
                                                type="number"
                                                className="w-full px-2 py-1.5 border border-neutral-300 rounded focus:border-[var(--primary-color)] focus:outline-none"
                                                value={v.compareAtPrice}
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    setVariations(prev => {
                                                        const n = [...prev];
                                                        n[idx].compareAtPrice = parseFloat(val) || 0;
                                                        lastSyncInitiatorRef.current = "variation";
                                                        return n;
                                                    });
                                                }}
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <input
                                                type="number"
                                                className="w-full px-2 py-1.5 border border-neutral-300 rounded focus:border-[var(--primary-color)] focus:outline-none"
                                                value={v.price}
                                                onChange={e => {
                                                    const val = parseFloat(e.target.value) || 0;
                                                    setVariations(prev => {
                                                        const n = [...prev];
                                                        n[idx].price = val;
                                                        // Sync discPrice: use offerPrice if available, else use price
                                                        n[idx].discPrice = n[idx].offerPrice || val;
                                                        lastSyncInitiatorRef.current = "variation";
                                                        return n;
                                                    });
                                                }}
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <input
                                                type="number"
                                                className="w-full px-2 py-1.5 border border-neutral-300 rounded focus:border-[var(--primary-color)] focus:outline-none"
                                                value={v.offerPrice}
                                                onChange={e => {
                                                    const val = parseFloat(e.target.value) || 0;
                                                    setVariations(prev => {
                                                        const n = [...prev];
                                                        n[idx].offerPrice = val;
                                                        // Sync discPrice: use offerPrice if > 0, else use price
                                                        n[idx].discPrice = val || n[idx].price;
                                                        lastSyncInitiatorRef.current = "variation";
                                                        return n;
                                                    });
                                                }}
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <input
                                                type="number"
                                                className="w-full px-2 py-1.5 border border-neutral-300 rounded focus:border-[var(--primary-color)] focus:outline-none"
                                                value={v.wholesalePrice}
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    setVariations(prev => {
                                                        const n = [...prev];
                                                        n[idx].wholesalePrice = parseFloat(val) || 0;
                                                        lastSyncInitiatorRef.current = "variation";
                                                        return n;
                                                    });
                                                }}
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <input
                                                type="number"
                                                className="w-full px-2 py-1.5 border border-neutral-300 rounded focus:border-[var(--primary-color)] focus:outline-none"
                                                value={v.stock}
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    setVariations(prev => {
                                                        const n = [...prev];
                                                        n[idx].stock = parseInt(val) || 0;
                                                        lastSyncInitiatorRef.current = "variation";
                                                        return n;
                                                    });
                                                }}
                                            />
                                        </td>
                                         <td className="px-4 py-2">
                                            <div className="flex flex-col gap-1 min-w-[180px]">
                                                <div className="flex flex-wrap gap-1 mb-1">
                                                    {(v.barcode || []).map(b => (
                                                        <span key={b} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-neutral-100 text-neutral-700 rounded text-[10px] border border-neutral-200">
                                                            {b}
                                                            <button type="button" onClick={() => removeBarcode('table-variation', b, idx)} className="hover:text-red-500">&times;</button>
                                                        </span>
                                                    ))}
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <input
                                                        type="text"
                                                        className="w-full flex-1 px-2 py-1 border border-neutral-300 rounded focus:border-[var(--primary-color)] focus:outline-none text-xs"
                                                        value={currentTableVarBarcode[idx] || ""}
                                                        placeholder="Add barcode"
                                                        onChange={e => setCurrentTableVarBarcode(prev => ({ ...prev, [idx]: e.target.value }))}
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter") {
                                                                e.preventDefault();
                                                                addBarcode('table-variation', idx, currentTableVarBarcode[idx]);
                                                            }
                                                        }}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => addBarcode('table-variation', idx, currentTableVarBarcode[idx])}
                                                        className="p-1 bgColor text-white rounded hover:bg-[var(--primary-dark)]"
                                                    >
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleAutoGenerateBarcode("table-variation", idx)}
                                                        className="p-1 text-neutral-400 hover:text-[var(--primary-color)] transition-colors"
                                                        title="Auto Generate"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => startScanning("table-variation", idx)}
                                                        className="p-1 text-[var(--primary-color)] hover:bg-pink-50 rounded transition-colors"
                                                        title="Scan Barcode"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path></svg>
                                                    </button>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2 text-center">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const existing = v.tieredPrices || [];
                                                    setTempTieredPrices(existing.map(t => ({ minQty: t.minQty, price: t.price })));
                                                    setUnitPricingModal({ isOpen: true, variationIndex: idx });
                                                }}
                                                className={`text-xs px-2 py-1 rounded border font-medium transition-colors ${
                                                    v.tieredPrices && v.tieredPrices.length > 0
                                                    ? "bg-pink-100 text-[var(--primary-dark)] border-pink-200 hover:bg-pink-200"
                                                    : "bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200"
                                                }`}
                                            >
                                                {v.tieredPrices && v.tieredPrices.length > 0 ? `${v.tieredPrices.length} Slabs` : "Add +"}
                                            </button>
                                        </td>
                                        <td className="px-4 py-2 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button 
                                                    type="button" 
                                                    onClick={() => handleEditVariation(idx)} 
                                                    className={`p-1 rounded-full transition-colors ${editingVariationIndex === idx ? 'bg-[var(--primary-color)] text-white' : 'text-gray-400 hover:text-[var(--primary-color)] hover:bg-pink-50'}`}
                                                    title="Edit variation"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                                                </button>
                                                <button type="button" onClick={() => removeVariation(idx)} className="text-gray-400 hover:text-red-600 transition-colors p-1 rounded-full hover:bg-red-50" title="Delete variation">
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                <div className="border border-neutral-200 rounded-lg overflow-hidden">
                  <div className="bg-neutral-50 px-4 py-2 border-b border-neutral-200">
                    <h3 className="text-sm font-semibold text-neutral-700">Added Variations</h3>
                  </div>
                  <div className="divide-y divide-neutral-100">
                    {variations.map((variation, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-4 bg-white hover:bg-neutral-50 transition-colors"
                      >
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 flex-1">
                           <div>
                             <span className="text-xs text-neutral-400 block">Barcodes</span>
                             <div className="flex flex-wrap gap-1">
                                {(variation.barcode || []).map(b => (
                                    <span key={b} className="text-[10px] bg-neutral-100 px-1 rounded border border-neutral-200">{b}</span>
                                ))}
                             </div>
                          </div>
                           <div>
                             <span className="text-xs text-neutral-400 block">Unit Value</span>
                             <div className="flex items-center gap-2">
                               <div className="w-9 h-9 bg-white border border-neutral-200 rounded overflow-hidden flex items-center justify-center shrink-0">
                                 {(variation.image || (variation as any).imageUrl || formData.mainImageUrl) ? (
                                   <img src={variation.image || (variation as any).imageUrl || formData.mainImageUrl} alt="" className="w-full h-full object-cover" />
                                 ) : (
                                   <span className="text-[10px] text-neutral-300 font-bold">IMG</span>
                                 )}
                               </div>
                               <span className="font-medium text-neutral-900">{variation.title}</span>
                             </div>
                           </div>
                          <div>
                            <span className="text-xs text-neutral-400 block">Price</span>
                            <span className="font-medium text-[var(--primary-color)]">₹{variation.price}</span>
                            {variation.discPrice > 0 && (
                               <span className="text-xs text-neutral-400 line-through ml-2">₹{variation.discPrice}</span>
                            )}
                            {variation.tieredPrices && variation.tieredPrices.length > 0 && (
                                <div className="mt-1 flex flex-wrap gap-1">
                                    {variation.tieredPrices.map((t, idx) => (
                                        <span key={idx} className="text-[10px] bg-pink-50 text-[var(--primary-dark)] px-1.5 py-0.5 rounded border border-pink-100">
                                            {t.minQty}+ @ ₹{t.price}
                                        </span>
                                    ))}
                                </div>
                            )}
                          </div>
                          <div>
                            <span className="text-xs text-neutral-400 block">Stock</span>
                            <span className="text-neutral-700">{variation.stock === 0 ? "Unlimited" : variation.stock}</span>
                          </div>
                          <div>
                            <span className="text-xs text-neutral-400 block">Status</span>
                            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${variation.status === 'Available' ? 'bg-[var(--primary-alpha-20)] text-[var(--primary-darker)]' : 'bg-red-100 text-red-800'}`}>
                              {variation.status}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                            <button
                              type="button"
                              onClick={() => handleEditVariation(index)}
                              className={`p-2 rounded-lg transition-colors ${editingVariationIndex === index ? 'bg-pink-100 text-[var(--primary-color)]' : 'text-neutral-400 hover:text-[var(--primary-color)] hover:bg-pink-50'}`}
                              title="Edit variation"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => removeVariation(index)}
                              className="p-2 text-neutral-400 hover:text-red-600 transition-colors"
                              title="Remove variation"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            </>
            )}
          </div>

          {/* Add Other Details Section */}
          <div className="bg-white rounded-xl shadow-sm border border-neutral-200">
            <div
              className="bg-[var(--primary-color)] text-white px-6 py-4 rounded-t-xl flex justify-between items-center cursor-pointer"
              onClick={() => setShowAdditionalDetails(!showAdditionalDetails)}
            >
              <h2 className="text-lg font-semibold tracking-wide">Additional Details</h2>
              <svg
                className={`w-6 h-6 transition-transform duration-300 ${showAdditionalDetails ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            {showAdditionalDetails && (
            <div className="p-6 space-y-6 border-x border-b border-neutral-200 rounded-b-xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {shouldShowField('manufacturer') && (
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">
                    Manufacturer
                  </label>
                  <input
                    type="text"
                    name="manufacturer"
                    value={formData.manufacturer}
                    onChange={handleChange}
                    placeholder="Enter Manufacturer Name"
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] transition-all"
                  />
                </div>
                )}
                {shouldShowField('made_in') && (
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">
                    Made In
                  </label>
                  <input
                    type="text"
                    name="madeIn"
                    value={formData.madeIn}
                    onChange={handleChange}
                    placeholder="Enter Country/Region"
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] transition-all"
                  />
                </div>
                )}
                {shouldShowField('tax') && (
                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-2">
                      Tax Category
                    </label>
                    <ThemedDropdown
                      options={taxes.map(tax => ({ id: tax._id, label: `${tax.name} (${tax.percentage}%)`, value: tax._id }))}
                      value={formData.tax}
                      onChange={(val) => setFormData(prev => ({ ...prev, tax: val }))}
                      placeholder="Select Tax"
                    />
                  </div>
                )}
                {shouldShowField('is_returnable') && (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-neutral-700 mb-2">
                        Returnable?
                      </label>
                      <ThemedDropdown
                        options={['Yes', 'No']}
                        value={formData.isReturnable}
                        onChange={(val) => setFormData(prev => ({ ...prev, isReturnable: val }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-neutral-700 mb-2">
                        Max Return Days
                      </label>
                      <input
                        type="number"
                        name="maxReturnDays"
                        value={formData.maxReturnDays}
                        onChange={handleChange}
                        placeholder="e.g. 7"
                        className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] transition-all"
                      />
                    </div>
                  </>
                )}
                {shouldShowField('fssai') && (
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">
                    FSSAI Lic. No.
                  </label>
                  <input
                    type="text"
                    name="fssaiLicNo"
                    value={formData.fssaiLicNo}
                    onChange={handleChange}
                    placeholder="Enter License Number"
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] transition-all"
                  />
                </div>
                )}
                {shouldShowField('total_allowed_quantity') && (
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">
                    Total Allowed Quantity
                  </label>
                  <input
                    type="number"
                    name="totalAllowedQuantity"
                    value={formData.totalAllowedQuantity}
                    onChange={handleChange}
                    placeholder="e.g. 10"
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] transition-all"
                  />
                  <p className="text-xs text-neutral-500 mt-1">
                    Max quantity a user can buy at once
                  </p>
                </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">
                    Low Stock Quantity
                  </label>
                  <input
                    type="number"
                    name="lowStockQuantity"
                    value={(formData as any).lowStockQuantity}
                    onChange={handleChange}
                    placeholder="Alert when stock below..."
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] transition-all"
                  />
                </div>



                {shouldShowField('hsn_code') && (
                <div>
                   <label className="block text-sm font-semibold text-neutral-700 mb-2">
                    HSN Code
                   </label>
                   <input
                     type="text"
                     name="hsnCode"
                     value={(formData as any).hsnCode}
                     onChange={handleChange}
                      placeholder="Enter HSN Code"
                      className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] transition-all"
                    />
                </div>
                )}

                {shouldShowField('mfg_date') && (
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">
                    Mfg Date
                  </label>
                  <input
                    type="date"
                    name="mfgDate"
                    value={(formData as any).mfgDate}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] transition-all"
                  />
                </div>
                )}

                {shouldShowField('expiry_date') && (
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    name="expiryDate"
                    value={(formData as any).expiryDate}
                    onChange={handleChange}
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] transition-all"
                  />
                </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">
                    Weight
                  </label>
                  <input
                    type="text"
                    name="weight"
                    value={(formData as any).weight}
                    onChange={handleChange}
                    placeholder="e.g. 500 g, 1 kg"
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] transition-all"
                  />
                </div>

                {shouldShowField('delivery_time') && (
                <div>
                   <label className="block text-sm font-semibold text-neutral-700 mb-2">
                    Delivery Time / In
                   </label>
                   <input
                     type="text"
                     name="deliveryTime"
                     value={(formData as any).deliveryTime}
                     onChange={handleChange}
                      placeholder="e.g. 2 Days, 24 Hours"
                      className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] transition-all"
                    />
                </div>
                )}
                 <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">
                    Barcodes (EAN/UPC)
                  </label>
                  <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                          {formData.barcode.map(b => (
                              <span key={b} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--primary-color)]/10 text-[var(--primary-color)] rounded-full text-sm font-semibold border border-[var(--primary-color)]/20">
                                  {b}
                                  <button type="button" onClick={() => removeBarcode('product', b)} className="hover:text-red-600 transition-colors">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                  </button>
                              </span>
                          ))}
                      </div>
                      <div className="flex flex-col md:flex-row gap-2">
                        <input
                          type="text"
                          name="barcode"
                          value={currentBarcode}
                          onChange={(e) => setCurrentBarcode(e.target.value)}
                          onKeyDown={(e) => {
                             if (e.key === "Enter") {
                                 e.preventDefault();
                                 addBarcode('product', null, currentBarcode);
                             }
                          }}
                          placeholder="Scan or enter barcode manually"
                          className="w-full md:w-auto md:flex-1 px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] transition-all"
                        />
                        <div className="flex gap-2 shrink-0">
                            <button
                                type="button"
                                onClick={() => addBarcode('product', null, currentBarcode)}
                                className="px-6 py-2 bg-[var(--primary-color)] text-white rounded-lg font-bold hover:bg-[var(--primary-dark)]"
                            >Add</button>
                            <button
                                type="button"
                                onClick={() => handleAutoGenerateBarcode("product")}
                                className="flex-1 md:flex-none px-4 py-2 bg-pink-50 border border-pink-200 rounded-lg hover:bg-pink-100 text-[var(--primary-color)] flex items-center justify-center gap-2 font-medium transition-colors"
                                title="Auto Generate Barcode"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                            </button>
                            <button
                                type="button"
                                onClick={() => startScanning("product")}
                                className="flex-1 md:flex-none px-4 py-2 bg-pink-50 border border-pink-200 rounded-lg hover:bg-pink-100 text-[var(--primary-color)] flex items-center justify-center gap-2 font-medium transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path></svg>
                            </button>
                        </div>
                      </div>
                  </div>
                </div>
              </div>
            </div>
            )}
          </div>

          {/* Add Images Section */}


          {/* Shop by Store Section */}
          {shouldShowField('shop_by_store_only') && (
          <div className="bg-white rounded-xl shadow-sm border border-neutral-200">
            <div
              className="bg-[var(--primary-color)] text-white px-6 py-4 rounded-t-xl flex justify-between items-center cursor-pointer"
              onClick={() => setShowStoreVisibility(!showStoreVisibility)}
            >
              <h2 className="text-lg font-semibold tracking-wide">Store Visibility</h2>
              <svg
                className={`w-6 h-6 transition-transform duration-300 ${showStoreVisibility ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            {showStoreVisibility && (
              <div className="p-6 space-y-6 border-x border-b border-neutral-200 rounded-b-xl">
              <div className="bg-pink-50 border border-pink-200 rounded-lg p-4 flex gap-3 items-start">
                 <svg className="w-5 h-5 text-[var(--primary-color)] mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                 <p className="text-sm text-[var(--primary-dark)]">
                   <strong>Note:</strong> If you select "Show in Shop by Store only", this product will <strong>only</strong> be visible in the selected store's specific page and will not appear on general category pages or the home page.
                 </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">
                    Show in Shop by Store only?
                  </label>
                  <ThemedDropdown
                    options={['Yes', 'No']}
                    value={formData.isShopByStoreOnly}
                    onChange={(val) => setFormData(prev => ({ ...prev, isShopByStoreOnly: val }))}
                  />
                </div>

                  {shouldShowField('select_store') && (
                  <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-2">
                      Select Store <span className="text-red-500">*</span>
                    </label>
                    <ThemedDropdown
                      options={shops.map(shop => ({ id: shop._id, label: shop.name, value: shop._id }))}
                      value={formData.shopId}
                      onChange={(val) => setFormData(prev => ({ ...prev, shopId: val }))}
                      placeholder="Select Store"
                    />
                    {shops.length === 0 && (
                      <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                        No active stores available. Please contact admin.
                      </p>
                    )}
                  </div>
                  )}
              </div>
            </div>
            )}
          </div>
          )}

        </form>
      </div>
      {isScanning && (
          <QRScannerModal
            onClose={stopScanning}
            onScanSuccess={onScanSuccess}
          />
      )}
        {/* Unit Pricing Modal */}
        {unitPricingModal.isOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                    <div className="bg-[var(--primary-color)] text-white px-6 py-4 flex justify-between items-center shrink-0">
                        <h3 className="text-lg font-semibold">Unit Wise Pricing</h3>
                        <button onClick={() => setUnitPricingModal({...unitPricingModal, isOpen: false})} className="text-white hover:bg-[var(--primary-dark)] p-1 rounded-full">✕</button>
                    </div>

                    <div className="p-6 overflow-y-auto flex-1">
                        <p className="text-sm text-gray-500 mb-4 bg-pink-50 p-3 rounded border border-pink-100">
                           Set discount prices when users buy in bulk. (e.g. Buy 2+ get at ₹95)
                        </p>

                        <div className="space-y-3">
                            {tempTieredPrices.map((tier, idx) => (
                                <div key={idx} className="flex gap-3 items-center">
                                    <div className="flex-1">
                                        <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Min Qty</label>
                                        <input
                                            type="number"
                                            placeholder="e.g. 2"
                                            className="w-full px-3 py-2 border border-neutral-300 rounded text-sm focus:border-[var(--primary-color)] focus:outline-none"
                                            value={tier.minQty}
                                            onChange={e => {
                                                const val = parseInt(e.target.value) || 0;
                                                setTempTieredPrices(prev => {
                                                    const n = [...prev];
                                                    n[idx].minQty = val;
                                                    return n;
                                                });
                                            }}
                                        />
                                    </div>
                                    <div className="flex-1 relative">
                                        <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Unit Price</label>
                                        <div className="relative">
                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">₹</span>
                                            <input
                                                type="number"
                                                placeholder="Price"
                                                className="w-full pl-6 pr-3 py-2 border border-neutral-300 rounded text-sm focus:border-[var(--primary-color)] focus:outline-none"
                                                value={tier.price}
                                                onChange={e => {
                                                    const val = parseFloat(e.target.value) || 0;
                                                    setTempTieredPrices(prev => {
                                                        const n = [...prev];
                                                        n[idx].price = val;
                                                        return n;
                                                    });
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex items-end h-[58px]">
                                        <button
                                            onClick={() => setTempTieredPrices(prev => prev.filter((_, i) => i !== idx))}
                                            className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded mb-0.5"
                                        >✕</button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button
                            type="button"
                            onClick={() => setTempTieredPrices(prev => [...prev, { minQty: 0, price: 0 }])}
                            className="mt-4 text-sm font-bold text-[var(--primary-color)] hover:text-[var(--primary-dark)] flex items-center gap-1"
                        >
                            + Add Price Slab
                        </button>
                    </div>

                    <div className="p-4 border-t border-gray-100 flex justify-end gap-3 shrink-0">
                        <button
                            onClick={() => setUnitPricingModal({...unitPricingModal, isOpen: false})}
                            className="px-4 py-2 text-neutral-600 hover:bg-neutral-100 rounded-lg font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => {
                                if (unitPricingModal.variationIndex !== null) {
                                    const cleanedTiers = tempTieredPrices.filter(t => t.minQty > 1 && t.price > 0);
                                    setVariations(prev => {
                                        const n = [...prev];
                                        n[unitPricingModal.variationIndex!] = {
                                            ...n[unitPricingModal.variationIndex!],
                                            tieredPrices: cleanedTiers
                                        };
                                        return n;
                                    });
                                    setUnitPricingModal({ isOpen: false, variationIndex: null });
                                }
                            }}
                            className="px-6 py-2 bg-[var(--primary-color)] hover:bg-[var(--primary-dark)] text-white rounded-lg font-medium"
                        >
                            Save Prices
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Unit Selection Modal */}
        <UnitSelectionModal
            isOpen={isUnitModalOpen}
            onClose={() => setIsUnitModalOpen(false)}
            onSelect={(unit) => {
                setFormData(prev => ({ ...prev, pack: unit }));
                setIsUnitModalOpen(false);
            }}
            currentValue={formData.pack}
        />

        {/* Image Source Selection Modal */}
        {showImageSourceModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden transform transition-all scale-100">
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-pink-50/30">
                        <h3 className="font-bold text-gray-800 text-lg">Choose Image</h3>
                        <button onClick={() => setShowImageSourceModal(false)} className="text-gray-400 hover:text-gray-600 p-1 bg-white rounded-full shadow-sm border border-gray-100">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>

                    <div className="p-5 space-y-6">
                        {/* Live Search Section */}
                        <div>
                             <div className="flex items-center justify-between mb-2">
                                <label className="text-xs font-bold text-[var(--primary-color)] uppercase tracking-wider flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                    Live Image Search
                                </label>
                                <span className="text-[10px] bg-pink-100 text-[var(--primary-dark)] px-1.5 py-0.5 rounded font-bold">AI</span>
                             </div>
                             <div className="flex gap-2">
                                <input
                                    type="text"
                                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-[var(--primary-color)] focus:border-[var(--primary-color)] outline-none"
                                    placeholder="e.g. 10 Vala Pen, Dove Soap"
                                    value={imageSearchQuery}
                                    onChange={(e) => setImageSearchQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleImageSearch()}
                                    autoFocus
                                />
                                <button
                                    onClick={handleImageSearch}
                                    disabled={isSearchingImage}
                                    className="bg-[var(--primary-color)] text-white px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wide hover:bg-[var(--primary-dark)] disabled:opacity-70 transition-colors"
                                >
                                    {isSearchingImage ? '...' : 'GO'}
                                </button>
                             </div>

                             {/* Search Result Preview */}
                             {searchedImage && (
                                <div className="mt-3 p-3 bg-pink-50 rounded-xl border border-pink-100 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                                    <img src={searchedImage} className="w-14 h-14 object-cover rounded-lg bg-white shadow-sm" alt="Result" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-[var(--primary-dark)] font-medium mb-1 truncate">Image Found!</p>
                                        <button
                                            onClick={() => {
                                                applySearchedImage();
                                                setShowImageSourceModal(false);
                                            }}
                                            className="text-xs bg-[var(--primary-color)] text-white px-3 py-1.5 rounded-lg font-bold hover:bg-[var(--primary-dark)] w-full shadow-sm hover:shadow"
                                        >
                                            Use This Image
                                        </button>
                                    </div>
                                </div>
                             )}
                        </div>

                        <div className="relative flex items-center py-2">
                            <div className="flex-grow border-t border-gray-200"></div>
                            <span className="flex-shrink-0 mx-4 text-gray-300 text-[10px] font-bold uppercase tracking-widest">OR UPLOAD</span>
                            <div className="flex-grow border-t border-gray-200"></div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => { setShowImageSourceModal(false); setTimeout(() => mainImageInputRef.current?.click(), 200); }}
                                className="flex flex-col items-center justify-center gap-3 p-4 border border-gray-100 rounded-2xl bg-gray-50 hover:bg-pink-50 hover:border-pink-200 hover:text-[var(--primary-color)] transition-all group active:scale-[0.98]"
                            >
                                <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-600 group-hover:text-[var(--primary-color)] group-hover:scale-110 transition-transform">
                                     <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                </div>
                                <span className="font-semibold text-sm text-gray-600 group-hover:text-[var(--primary-color)]">Gallery</span>
                            </button>

                            <button
                                onClick={() => { setShowImageSourceModal(false); setTimeout(() => mainImageInputRef.current?.click(), 200); }}
                                className="flex flex-col items-center justify-center gap-3 p-4 border border-gray-100 rounded-2xl bg-gray-50 hover:bg-pink-50 hover:border-pink-200 hover:text-[var(--primary-color)] transition-all group active:scale-[0.98]"
                            >
                                <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-600 group-hover:text-[var(--primary-color)] group-hover:scale-110 transition-transform">
                                     <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                </div>
                                <span className="font-semibold text-sm text-gray-600 group-hover:text-[var(--primary-color)]">Camera</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Product Found Modal - NEW SECTION as per User Request */}
        {showProductFoundModal && foundProduct && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-300">
                <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden transform transition-all animate-in zoom-in-95 duration-300">
                    <div className="p-8 flex flex-col items-center text-center">
                        <div className="w-16 h-16 bg-[var(--primary-alpha-20)] rounded-full flex items-center justify-center text-[var(--primary-dark)] mb-6">
                            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>

                        <h3 className="text-2xl font-bold text-gray-900 mb-2">Product Found!</h3>
                        <p className="text-sm text-gray-500 mb-8 px-4">Is this the product you're looking for?</p>

                        <div className="w-full bg-gray-50 rounded-2xl p-6 mb-8 border border-gray-100 relative group">
                            <div className="w-32 h-32 mx-auto mb-4 bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
                                <img
                                    src={foundProduct.mainImage || foundProduct.mainImageUrl || "https://placehold.co/200x200?text=No+Image"}
                                    alt={foundProduct.productName}
                                    className="w-full h-full object-contain p-2"
                                />
                            </div>
                            <h4 className="font-bold text-gray-800 text-base line-clamp-2 uppercase tracking-tight mb-2">
                                {foundProduct.productName}
                            </h4>
                            <div className="inline-block bg-[var(--primary-color)] text-white px-6 py-1.5 rounded-lg font-bold text-lg shadow-sm">
                                ₹{foundProduct.price}
                            </div>
                        </div>

                        <div className="flex gap-4 w-full">
                            <button
                                onClick={() => setShowProductFoundModal(false)}
                                className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.97]"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                                No
                            </button>
                            <button
                                onClick={() => {
                                    setFormData({
                                        ...formData,
                                        productName: foundProduct.productName,
                                        price: foundProduct.price?.toString() || "",
                                        compareAtPrice: foundProduct.compareAtPrice?.toString() || "",
                                        stock: foundProduct.stock?.toString() || "0",
                                        mainImageUrl: foundProduct.mainImage || foundProduct.mainImageUrl || "",
                                        barcode: Array.isArray(foundProduct.barcode) ? foundProduct.barcode : [foundProduct.barcode || ""],
                                        discPrice: foundProduct.discPrice?.toString() || "0",
                                        itemCode: foundProduct.sku || foundProduct.itemCode || "",
                                        variationName: foundProduct.variationName || "",
                                    });
                                    if (foundProduct.mainImage || foundProduct.mainImageUrl) {
                                        setMainImagePreview(foundProduct.mainImage || foundProduct.mainImageUrl || "");
                                    }
                                    setIsProductLoaded(true);
                                    setShowProductFoundModal(false);
                                    setSuccessMessage("Product details loaded!");
                                    setTimeout(() => setSuccessMessage(""), 2000);
                                }}
                                className="flex-1 py-4 bg-[var(--primary-color)] hover:bg-[var(--primary-dark)] text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-green-200 transition-all active:scale-[0.97]"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                                Yes
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
        {/* Fixed Footer Bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-neutral-200 p-4 flex justify-end shadow-[0_-4px_10px_rgba(0,0,0,0.05)] z-[40]">
          <div className="max-w-[1920px] mx-auto w-full flex justify-end px-4 sm:px-6 md:px-8">
            <button
              form="admin-product-form"
              type="submit"
              disabled={uploading}
              className={`px-10 py-3 rounded-xl font-bold text-lg transition-all shadow-lg active:scale-95 ${
                uploading
                  ? "bg-neutral-400 cursor-not-allowed text-white"
                  : "bg-[var(--primary-color)] hover:bg-[var(--primary-dark)] text-white shadow-[var(--primary-color)]/30"
              }`}>
              {uploading ? "Uploading Images..." : id ? "Update Product" : "Add Product"}
            </button>
          </div>
        </div>
    </div>
  );
}
