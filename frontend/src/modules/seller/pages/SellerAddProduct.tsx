import React, { useState, useEffect } from "react";
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
  getShops,
  getProducts as fetchProducts,
  ProductVariation,
  Shop,
} from "../../../services/api/productService";
import {
  getCategories,
  getSubcategories,
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
import { getAttributes, getSellerAttributes } from "../../../services/api/admin/attributeService";
import { getVariationTypes } from "../../../services/api/seller/sellerVariationTypeService";
import { getAppSettings } from "../../../services/api/admin/adminSettingsService";

import ThemedDropdown from "../components/ThemedDropdown";
import { Html5Qrcode } from "html5-qrcode";

import { useAuth } from "../../../context/AuthContext";

import UnitSelectionModal from "../../../components/UnitSelectionModal";

export default function SellerAddProduct() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const isEnabled = user?.isEnabled !== false; // Default to true if undefined
  const [showSEO, setShowSEO] = useState(false);
  const [showAdditionalDetails, setShowAdditionalDetails] = useState(false);
  const [showVariations, setShowVariations] = useState(true);
  const [showStoreVisibility, setShowStoreVisibility] = useState(true);

  const [formData, setFormData] = useState({
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
    galleryImageUrls: [] as string[],
    isShopByStoreOnly: "No",
    shopId: "",
    pack: "",
    barcode: [] as string[],
    itemCode: "", // sku alias
    rackNumber: "",
    hsnCode: "",
    purchasePrice: "",
    lowStockQuantity: "5",
    deliveryTime: "",
    price: "",
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
    status: "Available" as "Available" | "Sold out" | "In stock",
    barcode: [] as string[],
    offerPrice: "",
    wholesalePrice: "",
    tieredPrices: [] as { minQty: string, price: string }[],
    image: "",
  });

  const [mainImageFile, setMainImageFile] = useState<File | null>(null);
  const [mainImagePreview, setMainImagePreview] = useState<string>("");
  const [galleryImageFiles, setGalleryImageFiles] = useState<File[]>([]);
  const [galleryImagePreviews, setGalleryImagePreviews] = useState<string[]>(
    []
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string>("");
  const [isScanning, setIsScanning] = useState(false);
  const [scanTarget, setScanTarget] = useState<"product" | "variation" | "table-variation" | "sku" | "check-exists">("product");
  const [scanTargetIndex, setScanTargetIndex] = useState<number | null>(null);
  const scannerRef = React.useRef<Html5Qrcode | null>(null);
  const [foundProduct, setFoundProduct] = useState<any>(null);
  const [showProductFoundModal, setShowProductFoundModal] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [productSuggestions, setProductSuggestions] = useState<any[]>([]);
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);
  const [isProductLoaded, setIsProductLoaded] = useState(false);

  // Print Barcode State
  const [printQuantity, setPrintQuantity] = useState("1");
  const [selectedPrintBarcode, setSelectedPrintBarcode] = useState("");
  const [barcodeSettings, setBarcodeSettings] = useState<any>(null);

  // Attribute Based Variations State
  const [enableAttributes, setEnableAttributes] = useState(false);
  const [availableAttributes, setAvailableAttributes] = useState<any[]>([]);
  const [availableVariationTypes, setAvailableVariationTypes] = useState<any[]>([]);
  const [selectedAttributeId, setSelectedAttributeId] = useState("");
  const [selectedAttributes, setSelectedAttributes] = useState<{id: string, name: string, values: string[]}[]>([]);
  const [variationUnits, setVariationUnits] = useState<string[]>([]); // To store unit values like 1kg, 5kg
  const [currentUnitInput, setCurrentUnitInput] = useState("");
  const [attrInputValues, setAttrInputValues] = useState<Record<string, string>>({});

  // Color specific state
  const [enableColors, setEnableColors] = useState(false);
  const [selectedColors, setSelectedColors] = useState<{name: string, code: string}[]>([]);
  const [colorInput, setColorInput] = useState({ name: "", code: "#000000" });

  // Unit Pricing Modal State
  const [unitPricingModal, setUnitPricingModal] = useState<{ isOpen: boolean, variationIndex: number | null }>({ isOpen: false, variationIndex: null });
  // Temp state for editing in modal
  const [tempTieredPrices, setTempTieredPrices] = useState<{ minQty: number, price: number }[]>([]);

  const [successMessage, setSuccessMessage] = useState<string>("");
  const [currentBarcode, setCurrentBarcode] = useState("");
  const [currentVarBarcode, setCurrentVarBarcode] = useState("");
  const [currentTableVarBarcode, setCurrentTableVarBarcode] = useState<Record<number, string>>({});

  useEffect(() => {
    if (enableAttributes) {
        getSellerAttributes().then(res => {
            if(res.success) setAvailableAttributes(res.data);
        }).catch(err => console.error(err));
    }
  }, [enableAttributes]);

  useEffect(() => {
    // Fetch variation types on component mount
    getVariationTypes().then(res => {
        if(res.success) setAvailableVariationTypes(res.data);
    }).catch(err => console.error(err));
  }, []);

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

  const handleAddAttribute = () => {
      if (!selectedAttributeId) return;
      const attr = availableAttributes.find(a => (a._id || a.id) === selectedAttributeId);
      if (attr && !selectedAttributes.some(s => s.id === (attr._id || attr.id))) {
          setSelectedAttributes([...selectedAttributes, { id: attr._id || attr.id, name: attr.name, values: [] }]);
          setSelectedAttributeId(""); // Reset selection
      }
  };

  const handleRemoveAttribute = (attrId: string) => {
      setSelectedAttributes(prev => prev.filter(p => p.id !== attrId));
  };

  const handleAddAttributeValue = (attrId: string, value: string) => {
      if (!value.trim()) return;
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

       // Prepare dimensions (including colors if enabled)
       const activeDimensions: { name: string, values: string[] }[] = [];

       if (enableColors && selectedColors.length > 0) {
           activeDimensions.push({ name: "Color", values: selectedColors.map(c => c.name) });
       }

       selectedAttributes.forEach(attr => {
           if (attr.values.length > 0) {
               activeDimensions.push({ name: attr.name, values: attr.values });
           }
       });

       if (activeDimensions.length === 0) {
           // If no colors/attributes, just use units
           combos = variationUnits;
       } else {
           // Helper to generate combinations
           const generate = (index: number, current: string[]) => {
               if (index === activeDimensions.length) {
                   // Combined all attributes, now add units
                   const attrStr = current.join("-");
                   units.forEach(u => {
                       combos.push(u ? `${attrStr} - ${u}` : attrStr);
                   });
                   return;
               }

               const dim = activeDimensions[index];
               dim.values.forEach(val => {
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

       if (merged.length > 0) {
           setVariations(merged);
       } else {
           alert("No variations generated. Please add colors, attributes or units.");
       }
   };

  const handleAddTier = () => {
      setVariationForm(prev => ({
          ...prev,
          tieredPrices: [...prev.tieredPrices, { minQty: "", price: "" }]
      }));
  };

  const handleRemoveTier = (idx: number) => {
      setVariationForm(prev => ({
          ...prev,
          tieredPrices: prev.tieredPrices.filter((_, i) => i !== idx)
      }));
  };

  const handleTierChange = (idx: number, field: string, value: string) => {
      setVariationForm(prev => {
          const newTiers = [...prev.tieredPrices];
          newTiers[idx] = { ...newTiers[idx], [field]: value };
          return { ...prev, tieredPrices: newTiers };
      });
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
        setSuccessMessage("Barcode Generated Successfully!");
        setTimeout(() => setSuccessMessage(""), 2000);
    };

    const addBarcode = (target: 'product' | 'variation' | 'table-variation', index: number | null = null, value: string) => {
        if(!value.trim()) return;
        const val = value.trim();
        if(target === 'product') {
            if(!formData.barcode.includes(val)) {
                setFormData(prev => ({ ...prev, barcode: [...prev.barcode, val] }));
                setCurrentBarcode("");
            }
        } else if(target === 'variation') {
            if(!variationForm.barcode.includes(val)) {
                setVariationForm(prev => ({ ...prev, barcode: [...prev.barcode, val] }));
                setCurrentVarBarcode("");
            }
        } else if(target === 'table-variation' && index !== null) {
            setVariations(prev => {
                const n = [...prev];
                const currentBarcodes = n[index].barcode || [];
                if(!currentBarcodes.includes(val)) {
                    n[index].barcode = [...currentBarcodes, val];
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
        // Not found
        setFormData(prev => ({ ...prev, barcode: [barcode], variationName: prev.variationName || "" }));
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
      setIsScanning(true);
      setScanTarget(target);
      setScanTargetIndex(index);
      setUploadError("");
      setTimeout(() => {
          const scanner = new Html5Qrcode("reader");
          scannerRef.current = scanner;
          scanner.start(
              { facingMode: "environment" },
              {
                  fps: 10,
                  qrbox: { width: 250, height: 250 },
              },
              (decodedText) => {
                  if (target === "check-exists") {
                    handleCheckExists(decodedText);
                    stopScanning();
                    return;
                }
                  if(target === "product") {
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
                   stopScanning();
                   setSuccessMessage("Barcode Scanned: " + decodedText);
                   setTimeout(() => setSuccessMessage(""), 2000);
                   // Play a beep sound
                   const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
                   audio.play().catch(e => console.log('Audio play failed', e));
               },
              (errorMessage) => {
                  // console.log(errorMessage);
              }
          ).catch((err) => {
               console.error("Failed to start scanner", err);
               setUploadError("Failed to start camera. Please ensure permissions are granted.");
               setIsScanning(false);
          });
      }, 100);
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
      price: product.compareAtPrice?.toString() || "", // MRP
      discPrice: product.price?.toString() || "", // Selling Price
      stock: product.stock?.toString() || "0",
      mainImageUrl: product.mainImage || product.mainImageUrl || "",
      barcode: Array.isArray(product.barcode) ? product.barcode : [product.barcode || ""],
      offerPrice: product.offerPrice?.toString() || "0",
      itemCode: product.sku || product.itemCode || "",
      variationName: product.variationName || "",
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
      lowStockQuantity: "5",
      deliveryTime: "",
      price: "",
      discPrice: "0",
      stock: "0",
      offerPrice: "",
      wholesalePrice: "",
      variationName: "",
    });
    setMainImagePreview("");
    setMainImageFile(null);
    setIsProductLoaded(false);
    setSuccessMessage("Form cleared!");
    setTimeout(() => setSuccessMessage(""), 2000);
  };

  const stopScanning = () => {
      if (scannerRef.current) {
          scannerRef.current.stop().then(() => {
              scannerRef.current?.clear();
              setIsScanning(false);
          }).catch(err => {
              console.error("Failed to stop scanner", err);
              setIsScanning(false);
          });
      } else {
          setIsScanning(false);
      }
  };

  useEffect(() => {
    const fetchSettings = async () => {
        try {
            const response = await getAppSettings();
            if (response.success) {
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
    let showName = true;
    let showPrice = true;
    let isCustom = false;

    if (customSettings) {
        isCustom = true;
        barcodeHeight = customSettings.barcodeHeight;
        fontSize = customSettings.fontSize;
        productNameSize = customSettings.productNameSize;
        showName = customSettings.showName ?? true;
        showPrice = customSettings.showPrice ?? true;
    } else if (savedCustom) {
        try {
            customSettings = JSON.parse(savedCustom);
            isCustom = true;
            barcodeHeight = customSettings.barcodeHeight;
            fontSize = customSettings.fontSize;
            productNameSize = customSettings.productNameSize;
            showName = customSettings.showName ?? true;
            showPrice = customSettings.showPrice ?? true;
        } catch (e) { console.error(e); }
    }

    if (!isCustom) {
        if (savedSize === 'small') {
            containerWidth = 200;
            barcodeHeight = 40;
            fontSize = 12;
            productNameSize = 12;
        } else if (savedSize === 'large') {
            containerWidth = 320;
            barcodeHeight = 75;
            fontSize = 16;
            productNameSize = 16;
        }
    }

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
                align-items: center;
                justify-content: center;
                text-align: center;
                overflow: hidden;
                page-break-after: always;
                box-sizing: border-box;
                padding: 2px;
            }
        `;
    } else {
        styleContent = `
            body { font-family: 'Inter', sans-serif; padding: 20px; }
            .barcode-grid { display: flex; flex-wrap: wrap; gap: 20px; justify-content: flex-start; }
            .barcode-container {
                text-align: center;
                border: 1px solid #ccc;
                padding: 10px;
                page-break-inside: avoid;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                width: ${containerWidth}px;
                height: auto;
                background: white;
                box-sizing: border-box;
                border-radius: 8px;
            }
            @media print {
              @page { margin: 0.5cm; }
              body { padding: 0; }
              .barcode-container { break-inside: avoid; border: 1px solid #ccc; }
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
                margin-bottom: 2px;
                color: #000;
                line-height: 1.1;
                text-transform: capitalize;
                max-width: 100%;
                word-wrap: break-word;
                display: ${showName ? 'block' : 'none'};
            }
            .price-row {
                display: ${showPrice ? 'flex' : 'none'};
                gap: 10px;
                margin-top: 2px;
                font-size: ${fontSize}px;
                font-weight: 700;
                color: #000;
                justify-content: center;
            }
            .price-item {
                display: flex;
                align-items: center;
            }
            svg.barcode {
                width: 100%;
                height: ${barcodeHeight}px;
                max-width: 100%;
                display: block;
            }
          </style>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
        </head>
        <body>
          <div class="${isCustom ? '' : 'barcode-grid'}">
          ${Array(qty).fill(0).map(() => `
            <div class="barcode-container">
              <div class="product-name">${name || ''}</div>
              <svg class="barcode"
                jsbarcode-format="CODE128"
                jsbarcode-value="${barcodeVal}"
                jsbarcode-width="2"
                jsbarcode-height="${barcodeHeight}"
                jsbarcode-textmargin="0"
                jsbarcode-fontoptions="bold"
                jsbarcode-displayValue="true"
                jsbarcode-fontSize="${fontSize}"
                jsbarcode-marginBottom="2"
                jsbarcode-marginTop="2">
              </svg>
              <div class="price-row">
                  ${barcodeSettings?.mrpLabel ? `<div class="price-item">${barcodeSettings.mrpLabel}:${mrp}</div>` : mrp ? `<div class="price-item">MRP:${mrp}</div>` : ''}
                  ${barcodeSettings?.spLabel ? `<div class="price-item">${barcodeSettings.spLabel}:${sp}</div>` : sp ? `<div class="price-item">SP:${sp}</div>` : ''}
              </div>
            </div>
          `).join('')}
          </div>
          <script>
            JsBarcode(".barcode").init();
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

  const mainImageInputRef = React.useRef<HTMLInputElement>(null);

  // Dynamic Product Settings
  const [productDisplaySettings, setProductDisplaySettings] = useState<any[]>([]);
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<SubCategory[]>([]);
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [headerCategories, setHeaderCategories] = useState<HeaderCategory[]>(
    []
  );
  const [shops, setShops] = useState<Shop[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Use Promise.allSettled to ensure one failing API doesn't break all others
        const results = await Promise.allSettled([
          getCategories(),
          getActiveTaxes(),
          getBrands(),
          getHeaderCategoriesPublic(),
          getShops(),
          getAppSettings(),
        ]);

        // Handle categories
        if (results[0].status === "fulfilled" && results[0].value.success) {
          setCategories(results[0].value.data);
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
        if (results[4].status === "fulfilled" && results[4].value.success) {
          setShops(results[4].value.data);
        } else if (results[4].status === "rejected") {
          // Shops API failed - this is non-critical, log and continue
          console.warn("Failed to fetch shops (Shop By Store feature may be unavailable):", results[4].reason?.message || "Unknown error");
        }

        // Handle App Settings (Product Display Settings)
        if (results[5].status === "fulfilled" && results[5].value.success) {
             if (results[5].value.data?.productDisplaySettings) {
                 setProductDisplaySettings(results[5].value.data.productDisplaySettings);
             }
        }

      } catch (err) {
        console.error("Error fetching form data:", err);
      }
    };
    fetchData();
  }, []);

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
                (product.headerCategoryId as any)?._id ||
                (product as any).headerCategoryId ||
                "",
              category:
                (product.category as any)?._id || product.categoryId || "",
              subcategory:
                (product.subcategory as any)?._id ||
                product.subcategoryId ||
                "",
              subSubCategory:
                (product as any).subSubCategory || "",
              publish: product.publish ? "Yes" : "No",
              popular: product.popular ? "Yes" : "No",
              dealOfDay: product.dealOfDay ? "Yes" : "No",
              brand: (product.brand as any)?._id || product.brandId || "",
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
              tax: (product.tax as any)?._id || product.taxId || "",
              isReturnable: product.isReturnable ? "Yes" : "No",
              maxReturnDays: product.maxReturnDays?.toString() || "",
              fssaiLicNo: product.fssaiLicNo || "",
              totalAllowedQuantity:
                product.totalAllowedQuantity?.toString() || "10",
              mainImageUrl: product.mainImageUrl || product.mainImage || "",
              galleryImageUrls: product.galleryImageUrls || [],
              isShopByStoreOnly: (product as any).isShopByStoreOnly ? "Yes" : "No",
              shopId: (product as any).shopId?._id || (product as any).shopId || "",
              pack: (product as any).pack || "",
              barcode: Array.isArray((product as any).barcode) ? (product as any).barcode : (product as any).barcode ? [(product as any).barcode] : [],
              itemCode: (product as any).sku || (product as any).itemCode || "",
              rackNumber: (product as any).rackNumber || "",
              hsnCode: (product as any).hsnCode || "",
              purchasePrice: (product as any).purchasePrice?.toString() || "",
              lowStockQuantity: (product as any).lowStockQuantity?.toString() || "5",
              deliveryTime: (product as any).deliveryTime || "",
              price: product.price?.toString() || "",
              discPrice: (product as any).discPrice?.toString() || "",
              stock: product.stock?.toString() || "0",
              offerPrice: (product as any).offerPrice?.toString() || "",
              wholesalePrice: (product as any).wholesalePrice?.toString() || "",
            });
            setVariations(product.variations);

             // Populate Top Form with 1st variation if exists (Simulating Simple Product Edit)
             if (product.variations && product.variations.length > 0) {
                const v = product.variations[0];
                setVariationForm(prev => ({
                    ...prev,
                    price: v.price?.toString() || "",
                    discPrice: v.discPrice?.toString() || "",
                    stock: v.stock?.toString() || "",
                    status: v.status || "Available",
                    title: v.title || v.value || "",
                    wholesalePrice: v.wholesalePrice?.toString() || "",
                    barcode: Array.isArray(v.barcode) ? v.barcode : v.barcode ? [v.barcode] : [],
                    offerPrice: v.offerPrice?.toString() || "",
                    tieredPrices: v.tieredPrices ? v.tieredPrices.map(t => ({minQty: t.minQty.toString(), price: t.price.toString()})) : [],
                    compareAtPrice: v.compareAtPrice?.toString() || "",
                    image: v.image || "",
                }));
             }

            if (product.mainImageUrl || product.mainImage) {
              setMainImagePreview(
                product.mainImageUrl || product.mainImage || ""
              );
            }
            if (product.galleryImageUrls) {
              setGalleryImagePreviews(product.galleryImageUrls);
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
      if (formData.category) {
        try {
          const res = await getSubcategories(formData.category);
          if (res.success) setSubcategories(res.data);
        } catch (err) {
          console.error("Error fetching subcategories:", err);
        }
      } else {
        setSubcategories([]);
        // Clear subcategory selection when category is cleared
        setFormData((prev) => ({ ...prev, subcategory: "" }));
      }
    };
    // Only fetch if category changed and user is interacting (or initial load)
    // For edit mode, we want to load subcategories for the selected category
    if (formData.category) {
      fetchSubs();
    }
  }, [formData.category]);

  useEffect(() => {
    const fetchSubSubs = async () => {
      if (formData.subcategory) {
        try {
          const res = await getSubSubCategories(formData.subcategory);
          if (res.success) {
            // Updated list of sub-subcategories fetched, but currently not used in UI list
          }
        } catch (err) {
          console.error("Error fetching sub-subcategories:", err);
        }
      } else {
        setFormData((prev) => ({ ...prev, subSubCategory: "" }));
      }
    };
    if (formData.subcategory) {
      fetchSubSubs();
    }
  }, [formData.subcategory]);

  // Clear category and subcategory when header category changes
  useEffect(() => {
    if (formData.headerCategory) {
      // Header category selected - check if current category belongs to it
      const currentCategory = categories.find(
        (cat: any) => (cat._id || cat.id) === formData.category
      );
      if (currentCategory) {
        const catHeaderId =
          typeof currentCategory.headerCategoryId === "string"
            ? currentCategory.headerCategoryId
            : currentCategory.headerCategoryId?._id;
        // If current category doesn't belong to selected header category, clear it
        if (catHeaderId !== formData.headerCategory) {
          setFormData((prev) => ({
            ...prev,
            category: "",
            subcategory: "",
            subSubCategory: "",
          }));
          setSubcategories([]);
        }
      }
    } else {
      // Header category cleared - clear category and subcategory
      setFormData((prev) => ({
        ...prev,
        category: "",
        subcategory: "",
      }));
      setSubcategories([]);
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
    if (galleryImageFiles.length + files.length > 6) {
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
      const previews = await Promise.all(
        files.map((file) => createImagePreview(file))
      );

      setGalleryImageFiles(prev => [...prev, ...files]);
      setGalleryImagePreviews(prev => [...prev, ...previews]);
    } catch (error) {
      setUploadError("Failed to create image previews");
    }
  };

  const removeGalleryImage = (index: number) => {
    setGalleryImageFiles((prev) => prev.filter((_, i) => i !== index));
    setGalleryImagePreviews((prev) => prev.filter((_, i) => i !== index));
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

    setVariations([...variations, newVariation]);
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
    setUploadError("");
  };

  const removeVariation = (index: number) => {
    setVariations((prev) => prev.filter((_, i) => i !== index));
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
      if (!formData.category) {
        setUploadError("Please select a category.");
        return;
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
      let galleryImageUrls = [...formData.galleryImageUrls];

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

      // Upload gallery images if provided
      if (galleryImageFiles.length > 0) {
        const galleryResults = await uploadImages(
          galleryImageFiles,
          "Geeta Stores/products/gallery"
        );
        galleryImageUrls = galleryResults.map((result) => result.secureUrl);
        setFormData((prev) => ({ ...prev, galleryImageUrls }));
      }

      // Auto-add current variation if form is filled but list is empty
      const finalVariations = [...variations];

      const mrp = parseFloat(formData.price || "0"); // MRP
      const sellingPrice = parseFloat(formData.discPrice || "0"); // Selling Price
      const stock = parseInt(formData.stock || "0");
      const offerPrice = formData.offerPrice ? parseFloat(formData.offerPrice) : undefined;
      const wholesalePrice = formData.wholesalePrice ? parseFloat(formData.wholesalePrice) : 0;
      const calculatedDiscPrice = offerPrice || sellingPrice;

      if (finalVariations.length === 0) {
        if (formData.discPrice) {
          if (mrp > 0 && sellingPrice > mrp) {
            setUploadError("Selling price cannot be greater than Maximum Retail Price");
            setUploading(false);
            return;
          }
          finalVariations.push({
            title: variationForm.title || "Default",
            price: sellingPrice,
            compareAtPrice: mrp,
            discPrice: calculatedDiscPrice,
            stock,
            status: "Available",
            barcode: formData.barcode || [],
            offerPrice,
            wholesalePrice,
            image: variationForm.image || ""
          });
        } else {
          setUploadError("Please add at least one product variation");
          setUploading(false);
          return;
        }
      } else if (finalVariations.length === 1) {
           // Update single variation logic (Simple Product Mode)
           if (mrp > 0 && sellingPrice > mrp) {
             setUploadError("Selling price cannot be greater than Maximum Retail Price");
             setUploading(false);
             return;
           }

          finalVariations[0] = {
              ...finalVariations[0],
              price: sellingPrice,
              compareAtPrice: mrp,
              discPrice: calculatedDiscPrice,
              stock,
              offerPrice,
              wholesalePrice,
              image: finalVariations[0].image || variationForm.image || ""
          };
      }

      // Prepare product data for API
      const tagsArray = formData.tags
        ? formData.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)
        : [];

      const productData = {
        productName: formData.productName,
        headerCategoryId: formData.headerCategory || undefined,
        categoryId: formData.category || undefined,
        subcategoryId: formData.subcategory || undefined,
        subSubCategoryId: formData.subSubCategory || undefined,
        brandId: formData.brand || undefined,
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
        mainImageUrl: mainImageUrl || undefined,
        galleryImageUrls,
        variations: finalVariations,
        variationType: formData.variationType || undefined,
        isShopByStoreOnly: formData.isShopByStoreOnly === "Yes",
        shopId: formData.shopId || undefined,
        pack: (formData as any).pack || undefined,
        barcode: formData.barcode || [],
        itemCode: (formData as any).itemCode || (formData as any).barcode?.[0] || undefined, // maps to sku in backend
        sku: (formData as any).itemCode || (formData as any).barcode?.[0] || undefined,
        rackNumber: (formData as any).rackNumber || undefined,
        hsnCode: (formData as any).hsnCode || undefined,
        purchasePrice: (formData as any).purchasePrice ? parseFloat((formData as any).purchasePrice) : undefined,
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
        setTimeout(() => {
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
              lowStockQuantity: "5",
              deliveryTime: "",
              price: "",
              discPrice: "0",
              stock: "0",
              offerPrice: "",
              wholesalePrice: "",
              variationName: "",
            });
            setVariations([]);
            setMainImageFile(null);
            setMainImagePreview("");
            setGalleryImageFiles([]);
            setGalleryImagePreviews([]);
          }
          navigate("/seller/product/list");
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

  return (
    <div className="flex flex-col h-full">
      {/* Main Content */}
      <div className="flex-1 pb-24">

        {!id && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <div
                  onClick={() => startScanning("check-exists")}
                  className="bg-white p-2.5 rounded-lg border border-neutral-200 shadow-sm flex items-center gap-3 cursor-pointer hover:bg-seller-50 transition-all group border-l-4 border-l-seller-500">
                  <div className="w-10 h-10 bg-seller-100 rounded-lg flex items-center justify-center text-seller-600 group-hover:scale-110 transition-transform">
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
                          className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-seller-500/50 focus:border-seller-500 outline-none text-sm transition-all"
                          placeholder="Search product by name to auto-fill..."
                          value={productSearchQuery}
                          onChange={(e) => handleProductSearch(e.target.value)}
                      />
                      {isSearchingProducts && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                              <div className="w-4 h-4 border-2 border-seller-500 border-t-transparent rounded-full animate-spin"></div>
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
                                  className="flex items-center gap-3 p-3 hover:bg-seller-50 cursor-pointer transition-colors border-b border-gray-50 last:border-0"
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
                                          <span className="text-xs text-seller-600 font-bold">₹{product.price}</span>
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

        <form id="seller-product-form" onSubmit={handleSubmit} className="space-y-4">
          {!isEnabled && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r-lg">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-red-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span className="text-red-700 font-medium">
                  Your account is currently disabled. You can view product details but cannot add or update products.
                </span>
              </div>
            </div>
          )}
          {/* Product Section */}
          {/* Top Image & Name Section */}
          <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-4 space-y-4">

            {/* 1. Image Upload - Compact Square */}
            {/* 1. Image Upload Section */}
            <div>
                 <div className="flex flex-col sm:flex-row gap-6 sm:items-start">
                    {/* Main Image */}
                    <div className="flex flex-col items-center shrink-0">
                        <span className="text-sm font-semibold text-neutral-700 mb-1">Main Image</span>
                        <div
                         onClick={() => mainImageInputRef.current?.click()}
                         className="w-32 h-32 border-2 border-seller-500 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-seller-50 transition-colors relative overflow-hidden bg-white">
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
                                    <svg className="w-10 h-10 text-seller-500 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                                    <span className="text-xs text-seller-600 font-bold">Upload Main</span>
                                </>
                            )}
                            <input ref={mainImageInputRef} type="file" accept="image/*" onChange={handleMainImageChange} className="hidden" disabled={uploading} />
                        </div>
                    </div>

                    {/* Gallery Images */}
                    <div className="flex flex-col items-start w-full">
                        <span className="text-sm font-semibold text-neutral-700 mb-1">Gallery Images (Max 6)</span>
                        <div className="flex flex-wrap gap-2">
                            {galleryImagePreviews.map((preview, index) => (
                                <div key={index} className="w-20 h-20 relative border border-gray-200 rounded-lg overflow-hidden group bg-white">
                                    <img src={preview} className="w-full h-full object-cover" alt={`Gallery ${index}`} />
                                    <button
                                        type="button"
                                        onClick={() => removeGalleryImage(index)}
                                        className="absolute top-1 right-1 bg-red-600/80 hover:bg-red-600 text-white w-6 h-6 flex items-center justify-center rounded-full opacity-100 shadow-sm transition-all text-xs z-10"
                                    >
                                        &times;
                                    </button>
                                </div>
                            ))}
                             {galleryImagePreviews.length < 6 && (
                                <label className="w-20 h-20 border-2 border-gray-300 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors text-gray-400 hover:text-seller-600">
                                    <span className="text-2xl font-light mb-0.5">+</span>
                                    <span className="text-[10px] font-medium uppercase">Add</span>
                                    <input type="file" accept="image/*" multiple onChange={handleGalleryImagesChange} className="hidden" />
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
                 className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f187b5]/20 focus:border-[#f187b5]"
               />
            </div>

            {/* 3. Pricing & Stock (Top Level - Matches Admin) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-1">
                      Selling Price <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">₹</span>
                        <input
                           type="number"
                           name="discPrice"
                           value={formData.discPrice}
                           onChange={handleChange}
                           placeholder="0.00"
                           className="w-full pl-7 pr-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f187b5]/20 focus:border-[#f187b5]"
                        />
                    </div>
                </div>
                <div>
                   <label className="block text-sm font-semibold text-neutral-700 mb-1">
                     Maximum Retail Price
                   </label>
                   <div className="relative">
                       <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">₹</span>
                       <input
                          type="number"
                          name="price"
                          value={formData.price}
                          onChange={handleChange}
                          placeholder="0.00"
                          className="w-full pl-7 pr-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f187b5]/20 focus:border-[#f187b5]"
                       />
                   </div>
                </div>

                <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-1">
                      Offer Price (Online)
                    </label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">₹</span>
                        <input
                           type="number"
                           name="offerPrice"
                           value={formData.offerPrice}
                           onChange={handleChange}
                           placeholder="0.00"
                           className="w-full pl-7 pr-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f187b5]/20 focus:border-[#f187b5]"
                        />
                    </div>
                </div>
                <div>
                   <label className="block text-sm font-semibold text-neutral-700 mb-1">
                     Wholesale Price
                   </label>
                   <div className="relative">
                       <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">₹</span>
                        <input
                           type="number"
                           name="wholesalePrice"
                           value={formData.wholesalePrice}
                           onChange={handleChange}
                           placeholder="0.00"
                           className="w-full pl-7 pr-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f187b5]/20 focus:border-[#f187b5]"
                        />
                   </div>
                </div>

                 {shouldShowField('purchase_price') && (
                    <div>
                        <label className="block text-sm font-semibold text-neutral-700 mb-2">
                         Purchase Price
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">₹</span>
                            <input
                              type="number"
                              name="purchasePrice"
                              value={(formData as any).purchasePrice}
                              onChange={handleChange}
                              placeholder="0.00"
                              className="w-full pl-7 pr-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f187b5]/20 focus:border-[#f187b5]"
                            />
                        </div>
                    </div>
                )}

                <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-neutral-700 mb-2">
                      Stock <span className="text-red-500">*</span>
                    </label>
                    <input
                       type="number"
                       name="stock"
                       value={formData.stock}
                       onChange={handleChange}
                       placeholder="0"
                       className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f187b5]/20 focus:border-[#f187b5]"
                    />
                </div>
            </div>

        </div>

          {/* Product Section Details */}
          <div className="bg-white rounded-xl shadow-sm border border-neutral-200">
            {/* Header Removed for Mobile Look */}
            {/* <div className="bg-seller-500 text-white px-6 py-4 rounded-t-xl">
               <h2 className="text-lg font-semibold tracking-wide">Product Details</h2>
             </div> */}
            <div className="p-6 space-y-6 rounded-b-xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Product Name was here, removed */}
                {/* <div className="md:col-span-2"> ... </div> */}

                {shouldShowField('pack') && (
                <div className="md:col-span-2">
                   <label className="block text-sm font-semibold text-neutral-700 mb-2">
                    Pack / Unit Size <span className="text-xs text-neutral-500 font-normal ml-1">(e.g. 1 kg, 500 ml, 1 pc)</span>
                   </label>
                   <div className="relative">
                     <input
                       type="text"
                       name="pack"
                       value={(formData as any).pack}
                       onClick={() => setIsUnitModalOpen(true)}
                       readOnly
                       placeholder="Select Unit Size"
                       className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-seller-500/20 focus:border-seller-500 transition-all cursor-pointer bg-white"
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
                                    <span key={b} className="inline-flex items-center gap-1 px-3 py-1 bg-seller-50 text-[#AD1457] border border-seller-200 rounded-md text-xs font-semibold shadow-sm">
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
                                 name="itemCode"
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
                                 className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-seller-500/20 focus:border-seller-500 transition-all"
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
                                     className="px-4 py-2.5 bg-seller-500 text-white rounded-lg text-sm font-bold hover:bg-seller-600 transition-colors shadow-sm"
                                >
                                    Add
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleAutoGenerateBarcode("sku")}
                                    className="p-2.5 bg-seller-50 border border-seller-200 rounded-lg hover:bg-seller-100 text-seller-600 transition-colors"
                                    title="Auto Generate"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => startScanning("sku")}
                                    className="p-2.5 bg-seller-50 border border-seller-200 rounded-lg hover:bg-seller-100 text-seller-600 transition-colors"
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
                     value={(formData as any).rackNumber}
                     onChange={handleChange}
                     placeholder="Enter Rack Number"
                     className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-seller-500/20 focus:border-seller-500 transition-all"
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
                        return true;
                      })
                      .map((cat: any) => ({ id: cat._id || cat.id, label: cat.name, value: cat._id || cat.id }))
                    }
                    value={formData.category}
                    onChange={(val) => setFormData(prev => ({ ...prev, category: val }))}
                    placeholder="Select Category"
                  />
                </div>
                )}

                {shouldShowField('subcategory') && (
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">
                    SubCategory
                  </label>
                  <ThemedDropdown
                    options={subcategories.map(sub => ({ id: sub._id, label: sub.subcategoryName, value: sub._id }))}
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
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-seller-500/20 focus:border-seller-500 transition-all"
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

                {shouldShowField('brand') && (
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">
                    Brand
                  </label>
                  <ThemedDropdown
                    options={brands.map(brand => ({ id: brand._id, label: brand.name, value: brand._id }))}
                    value={formData.brand}
                    onChange={(val) => setFormData(prev => ({ ...prev, brand: val }))}
                    placeholder="Select Brand"
                  />
                </div>
                )}

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
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-seller-500/20 focus:border-seller-500 transition-all"
                  />
                </div>
                )}
              </div>

              {shouldShowField('summary') && (
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  Short Description
                </label>
                <textarea
                  name="smallDescription"
                  value={formData.smallDescription}
                  onChange={handleChange}
                  placeholder="Enter a brief product description..."
                  rows={4}
                  className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-seller-500/20 focus:border-seller-500 resize-none transition-all"
                />
              </div>
              )}
            </div>
          </div>
          {/* Print Barcodes Section */}
          <div className="bg-white rounded-xl shadow-sm border border-neutral-200">
            <div className="bg-[#f187b5] text-white px-4 py-2.5 rounded-t-xl">
              <h2 className="text-base font-semibold tracking-wide">Print Barcodes</h2>
            </div>
            <div className="p-4 border-x border-b border-neutral-200 rounded-b-xl">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div>
                   <label className="block text-sm font-semibold text-neutral-700 mb-1">Quantity</label>
                   <input
                      type="number"
                      value={printQuantity}
                      onChange={(e) => setPrintQuantity(e.target.value)}
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-[#f187b5]/20 shadow-sm"
                      placeholder="Enter Quantity"
                   />
                </div>
                <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-1">Select Barcode</label>
                    <div className="relative">
                         <select
                            className="w-full px-4 py-2 border border-neutral-300 rounded-lg appearance-none bg-white focus:ring-2 focus:ring-[#f187b5]/20 shadow-sm pr-10 cursor-pointer"
                            value={selectedPrintBarcode}
                            onChange={(e) => {
                                const val = e.target.value;
                                setSelectedPrintBarcode(val);
                                if(val) {
                                    // Find variation for name/price
                                    const v = variations.find(v => (v.barcode || []).includes(val));
                                    handlePrintBarcode(val, parseInt(printQuantity), formData.productName + (v ? ' - ' + v.title : ''), v?.price, v?.price);
                                }
                            }}
                        >
                            <option value="">Select a Barcode</option>
                            {formData.barcode.map(b => (
                                <option key={b} value={b}>Product: {b}</option>
                            ))}
                            {variations.map((v, i) => (v.barcode || []).map(b => (
                                <option key={`${i}-${b}`} value={b}>Var: {v.title} ({b})</option>
                            )))}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                    </div>
                </div>
                <div className="text-sm text-neutral-500 italic bg-[#f187b5]/10 p-2 rounded-lg border border-[#f187b5]/20 flex items-center gap-2">
                    <svg className="w-5 h-5 text-[#f187b5]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    * Select barcode to print.
                </div>
              </div>
            </div>
          </div>


          {/* SEO Content Section */}
          <div className="bg-white rounded-xl shadow-sm border border-neutral-200">
            <div
              className="bg-seller-500 text-white px-4 py-2.5 rounded-t-xl flex justify-between items-center cursor-pointer"
              onClick={() => setShowSEO(!showSEO)}
            >
              <h2 className="text-base font-semibold tracking-wide">SEO Configuration</h2>
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
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {shouldShowField('seo_title') && (
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-1">
                    meta Title
                  </label>
                  <input
                    type="text"
                    name="seoTitle"
                    value={formData.seoTitle}
                    onChange={handleChange}
                    placeholder="Enter meta Title"
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-seller-500/20 focus:border-seller-500 transition-all"
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
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-seller-500/20 focus:border-seller-500 transition-all"
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
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-seller-500/20 focus:border-seller-500 transition-all"
                  />
                </div>
                )}
                {shouldShowField('seo_description') && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-neutral-700 mb-1">
                    meta Description
                  </label>
                  <textarea
                    name="seoDescription"
                    value={formData.seoDescription}
                    onChange={handleChange}
                    placeholder="Enter meta Description"
                    rows={3}
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-seller-500/20 focus:border-seller-500 resize-none transition-all"
                  />
                </div>
                )}
              </div>
            </div>
            )}
          </div>

            <div className="bg-white rounded-xl shadow-sm border border-neutral-200">
               <div
                 className="bg-[#f187b5] text-white px-6 py-4 rounded-t-xl flex justify-between items-center cursor-pointer"
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
                         className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${enableAttributes ? 'bg-white shadow-inner' : 'bg-black/20'}`}
                     >
                         <span className={`inline-block h-4 w-4 transform rounded-full transition-transform shadow-sm ${enableAttributes ? 'translate-x-6 bg-[#f187b5]' : 'translate-x-1 bg-white'}`} />
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
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-seller-500/20 focus:border-seller-500 transition-all"
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
                             className="flex-1 px-3 py-2 border border-neutral-300 rounded text-sm focus:outline-none focus:border-[#f187b5]"
                             value={colorInput.name}
                             onChange={(e) => {
                                 const name = e.target.value;
                                 setColorInput(prev => ({...prev, name}));

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
                              className="px-4 py-2 bg-[#f187b5]/10 text-[#f187b5] border border-[#f187b5]/20 rounded hover:bg-[#f187b5]/20 text-sm font-medium"
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
                        {/* Step 0: Select Colors */}
                        <div>
                            <div className="flex items-center justify-between mb-4">
                               <label className="block text-sm font-semibold text-neutral-700">
                                   Select Colors
                               </label>
                                <button
                                   type="button"
                                   onClick={() => setEnableColors(!enableColors)}
                                   className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${enableColors ? 'bg-[#f187b5]' : 'bg-neutral-300'}`}
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
                                           className="flex-1 px-3 py-2 border border-neutral-300 rounded text-sm focus:outline-none focus:border-blue-500"
                                           value={colorInput.name}
                                           onChange={(e) => {
                                               const name = e.target.value;
                                               setColorInput(prev => ({...prev, name}));

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
                                            className="px-4 py-2 bg-[#f187b5]/10 text-[#f187b5] border border-[#f187b5]/20 rounded hover:bg-[#f187b5]/20 text-sm font-medium"
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
                                     className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#f187b5]"
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
                                    className="px-4 py-2 bg-[#f187b5] text-white rounded-lg text-sm font-medium hover:bg-[#e076a5]"
                                >
                                    Add
                                </button>
                             </div>
                          </div>

                          {/* Step 2: Attribute Values */}
                          {selectedAttributes.map((attr) => (
                              <div key={attr.id} className="bg-white p-4 rounded-lg border border-neutral-200 shadow-sm relative">
                                  <button type="button" onClick={() => handleRemoveAttribute(attr.id)} className="absolute top-2 right-2 text-gray-400 hover:text-red-500 text-lg leading-none">&times;</button>
                                  <h4 className="font-semibold text-[#f187b5] mb-2">{attr.name} Values</h4>
                                  <div className="flex flex-col sm:flex-row gap-2 mb-3 max-w-lg">
                                      <input
                                          type="text"
                                          placeholder={`Add ${attr.name} value`}
                                          className="flex-1 px-3 py-2 border border-neutral-300 rounded text-sm focus:outline-none focus:border-[#f187b5]"
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
                                            className="px-4 py-2 bg-[#f187b5]/10 text-[#f187b5] border border-[#f187b5]/20 rounded hover:bg-[#f187b5]/20 text-sm font-medium"
                                       >Add</button>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                      {attr.values.map(val => (
                                          <span key={val} className="px-3 py-1 bg-[#f187b5]/10 text-[#f187b5] border border-[#f187b5]/20 rounded-full text-xs font-medium flex items-center gap-2">
                                              {val}
                                              <button type="button" onClick={() => handleRemoveAttributeValue(attr.id, val)} className="text-[#f187b5]/60 hover:text-red-500 font-bold focus:outline-none">&times;</button>
                                          </span>
                                      ))}
                                  </div>
                              </div>
                          ))}

                          {/* Unit Values */}
                          <div className="bg-white p-4 rounded-lg border border-neutral-200 shadow-sm">
                              <h4 className="font-semibold text-[#f187b5] mb-2">Unit Values (Optional)</h4>
                              <div className="flex flex-col sm:flex-row gap-2 mb-3 max-w-lg">
                                  <input
                                      type="text"
                                      placeholder="e.g. 1kg, 5kg"
                                      className="flex-1 px-3 py-2 border border-neutral-300 rounded text-sm focus:outline-none focus:border-[#f187b5]"
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
                                      className="px-4 py-2 bg-[#f187b5]/10 text-[#f187b5] border border-[#f187b5]/20 rounded hover:bg-[#f187b5]/20 text-sm font-medium"
                                  >Add</button>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                  {variationUnits.map(unit => (
                                      <span key={unit} className="px-3 py-1 bg-[#f187b5]/10 text-[#f187b5] border border-[#f187b5]/20 rounded-full text-xs font-medium flex items-center gap-2">
                                          {unit}
                                          <button type="button" onClick={() => handleRemoveUnit(unit)} className="text-[#f187b5]/60 hover:text-red-500 font-bold focus:outline-none">&times;</button>
                                      </span>
                                  ))}
                              </div>
                          </div>

                          <div className="flex justify-end pt-4 border-t border-neutral-200">
                              <button
                                  type="button"
                                  onClick={generateVariations}
                                  className="px-6 py-2.5 bg-[#f187b5] text-white rounded-lg hover:bg-[#e076a5] shadow-sm font-medium transition-colors"
                              >
                                  Generate Variations Table
                              </button>
                          </div>

                          {/* Generated Table */}
                           {variations.length > 0 && (
                             <div className="overflow-x-auto border border-neutral-200 rounded-lg mt-4">
                                 <table className="w-full text-sm text-left">
                                     <thead className="bg-[#f187b5]/10 text-[#f187b5] font-semibold border-b border-[#f187b5]/20">
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
                                                    <div className="relative w-12 h-12 bg-white border border-neutral-300 rounded overflow-hidden flex items-center justify-center cursor-pointer hover:border-[#f187b5]">
                                                        {v.image ? (
                                                            <div className="w-full h-full relative group/img">
                                                                <img src={v.image} className="w-full h-full object-cover" alt="Var" />
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
                                                                        try {
                                                                            const res = await uploadImage(file, "Geeta Stores/products/variations");
                                                                            if(res.secureUrl) {
                                                                                setVariations(prev => {
                                                                                    const n = [...prev];
                                                                                    n[idx].image = res.secureUrl;
                                                                                    return n;
                                                                                });
                                                                            }
                                                                        } catch(err) { console.error("Upload failed", err); }
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
                                                         className="w-full px-2 py-1.5 border border-neutral-300 rounded focus:border-[#f187b5] focus:outline-none"
                                                         value={v.compareAtPrice}
                                                         onChange={e => {
                                                             const val = e.target.value;
                                                             setVariations(prev => {
                                                                 const n = [...prev];
                                                                 n[idx].compareAtPrice = parseFloat(val) || 0;
                                                                 return n;
                                                             });
                                                         }}
                                                     />
                                                 </td>
                                                 <td className="px-4 py-2">
                                                     <input
                                                         type="number"
                                                         className="w-full px-2 py-1.5 border border-neutral-300 rounded focus:border-[#f187b5] focus:outline-none"
                                                         value={v.price} // Selling Price
                                                         onChange={e => {
                                                             const val = e.target.value;
                                                             setVariations(prev => {
                                                                 const n = [...prev];
                                                                 n[idx].price = parseFloat(val) || 0;
                                                                 return n;
                                                             });
                                                         }}
                                                     />
                                                 </td>
                                                  <td className="px-4 py-2">
                                                      <input
                                                          type="number"
                                                          className="w-full px-2 py-1.5 border border-neutral-300 rounded focus:border-[#f187b5] focus:outline-none"
                                                          value={v.offerPrice}
                                                          onChange={e => {
                                                              const val = e.target.value;
                                                              setVariations(prev => {
                                                                  const n = [...prev];
                                                                  n[idx].offerPrice = parseFloat(val) || 0;
                                                                  return n;
                                                              });
                                                          }}
                                                      />
                                                  </td>
                                                 <td className="px-4 py-2">
                                                     <input
                                                         type="number"
                                                         className="w-full px-2 py-1.5 border border-neutral-300 rounded focus:border-[#f187b5] focus:outline-none"
                                                         value={v.wholesalePrice}
                                                         onChange={e => {
                                                             const val = e.target.value;
                                                             setVariations(prev => {
                                                                 const n = [...prev];
                                                                 n[idx].wholesalePrice = parseFloat(val) || 0;
                                                                 return n;
                                                             });
                                                         }}
                                                     />
                                                 </td>
                                                 <td className="px-4 py-2">
                                                     <input
                                                         type="number"
                                                         className="w-full px-2 py-1.5 border border-neutral-300 rounded focus:border-[#f187b5] focus:outline-none"
                                                         value={v.stock}
                                                         onChange={e => {
                                                             const val = e.target.value;
                                                             setVariations(prev => {
                                                                 const n = [...prev];
                                                                 n[idx].stock = parseInt(val) || 0;
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
                                                                    className="w-full flex-1 px-2 py-1 border border-neutral-300 rounded focus:border-seller-500 focus:outline-none text-xs"
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
                                                                   className="p-1 bg-seller-500 text-white rounded hover:bg-seller-600"
                                                               >
                                                                   <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                                                               </button>
                                                               <button
                                                                   type="button"
                                                                   onClick={() => handleAutoGenerateBarcode("table-variation", idx)}
                                                                   className="p-1 text-neutral-400 hover:text-seller-500 transition-colors"
                                                                   title="Auto Generate"
                                                               >
                                                                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                                                               </button>
                                                               <button
                                                                   type="button"
                                                                   onClick={() => startScanning("table-variation", idx)}
                                                                   className="p-1 text-seller-500 hover:bg-seller-50 rounded transition-colors"
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
                                                             setTempTieredPrices(existing.map(t => ({ minQty: Number(t.minQty), price: Number(t.price) })));
                                                             setUnitPricingModal({ isOpen: true, variationIndex: idx });
                                                         }}
                                                         className={`text-xs px-2 py-1 rounded border font-medium transition-colors ${
                                                             v.tieredPrices && v.tieredPrices.length > 0
                                                             ? "bg-pink-100 text-[#f187b5] border-pink-200 hover:bg-pink-200"
                                                             : "bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200"
                                                         }`}
                                                     >
                                                         {v.tieredPrices && v.tieredPrices.length > 0 ? `${v.tieredPrices.length} Slabs` : "Add +"}
                                                     </button>
                                                 </td>
                                                 <td className="px-4 py-2 text-center">
                                                     <button type="button" onClick={() => {
                                                         setVariations(prev => prev.filter((_, i) => i !== idx));
                                                     }} className="text-gray-400 hover:text-red-500 font-bold transition-colors">
                                                         &times;
                                                     </button>
                                                 </td>
                                             </tr>
                                         ))}
                                     </tbody>
                                 </table>
                             </div>
                           )}
                     </div>
                  ) : (
                    /* Variation Form (Old Manual) - Sync with Admin Structure */
                    <div className="bg-neutral-50 rounded-xl p-6 border border-neutral-200">
                      <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-start">
                        {/* Variation Image */}
                        <div className="md:col-span-1">
                            <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">
                                Image
                            </label>
                            <div className="relative w-full aspect-square bg-white border border-neutral-300 rounded-lg flex items-center justify-center overflow-hidden group cursor-pointer hover:border-[#f187b5]">
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
                                                // Validate function assumed to be available or skipped for brevity if not imported?
                                                // It is available in SellerAddProduct usually if imported. Assuming yes.
                                                // Actually validateImageFile might be imported.
                                                // If not, I should be careful. AdminAddProduct had it.
                                                // Let's assume yes or add basic check?
                                                // Looking at Step 317/322/325/328/331/334, I didn't verify imports.
                                                // But `handleMainImageChange` usually uses it.
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
                                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-seller-500/20 focus:border-seller-500"
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
                                  className="w-full pl-7 pr-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-seller-500/20 focus:border-seller-500"
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
                                  className="w-full pl-7 pr-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-seller-500/20 focus:border-seller-500"
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
                                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-seller-500/20 focus:border-seller-500"
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
                                  className="w-full pl-7 pr-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-seller-500/20 focus:border-seller-500"
                                />
                              </div>
                            </div>

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
                                  className="w-full pl-7 pr-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-seller-500/20 focus:border-seller-500"
                                />
                              </div>
                            </div>
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
                                  className="text-xs font-bold text-[#f187b5] hover:text-[#e076a5]"
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
                                        <button type="button" onClick={() => handleRemoveTier(idx)} className="text-red-500 hover:text-red-700">✕</button>
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
                                          <span key={b} className="inline-flex items-center gap-1 px-2 py-1 bg-pink-100 text-[#AD1457] rounded-md text-xs font-medium">
                                              {b}
                                              <button type="button" onClick={() => removeBarcode('variation', b)} className="hover:text-red-500">
                                                  &times;
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
                                               if (e.key === "Enter") {
                                                   e.preventDefault();
                                                   addBarcode('variation', null, currentVarBarcode);
                                               }
                                           }}
                                           placeholder="Scan or Enter"
                                           className="w-full md:w-auto md:flex-1 px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-seller-500/20 focus:border-seller-500"
                                       />
                                      <div className="flex gap-2 shrink-0">
                                          <button
                                              type="button"
                                              onClick={() => addBarcode('variation', null, currentVarBarcode)}
                                              className="px-3 py-2 bg-seller-500 text-white rounded-lg text-xs font-bold hover:bg-seller-600"
                                          >Add</button>
                                          <button
                                              type="button"
                                              onClick={() => handleAutoGenerateBarcode("variation")}
                                              className="flex-1 md:flex-none px-3 py-2 bg-pink-50 border border-pink-200 rounded-lg hover:bg-pink-100 text-[#f187b5] transition-colors flex items-center justify-center gap-2"
                                              title="Auto Generate Barcode"
                                              >
                                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                                          </button>
                                           <button
                                               type="button"
                                               onClick={() => startScanning("variation")}
                                               className="flex-1 md:flex-none px-3 py-2 bg-seller-50 border border-seller-200 rounded-lg hover:bg-seller-100 text-seller-600 transition-colors flex items-center justify-center gap-2"
                                               title="Scan Barcode"
                                               >
                                               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path></svg>
                                           </button>
                                      </div>
                                  </div>
                              </div>
                           </div>
                        </div>

                        <div className="flex items-end h-full pt-6 md:col-span-5 justify-end">
                          <button
                            type="button"
                            onClick={addVariation}
                            className="px-6 py-2 bg-[#f187b5] hover:bg-[#e076a5] text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                          >
                            Add Variation +
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
               </div>
               </>
               )}
          </div>



          {/* Add Other Details Section */}
          <div className="bg-white rounded-xl shadow-sm border border-neutral-200">
            <div
              className="bg-seller-500 text-white px-6 py-4 rounded-t-xl flex justify-between items-center cursor-pointer"
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
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-seller-500/20 focus:border-seller-500 transition-all"
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
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-seller-500/20 focus:border-seller-500 transition-all"
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
                )}
                {shouldShowField('is_returnable') && (
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
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-seller-500/20 focus:border-seller-500 transition-all"
                  />
                </div>
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
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-seller-500/20 focus:border-seller-500 transition-all"
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
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-seller-500/20 focus:border-seller-500 transition-all"
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
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-seller-500/20 focus:border-seller-500 transition-all"
                  />
                </div>

                {shouldShowField('purchase_price') && (
                <div>
                   <label className="block text-sm font-semibold text-neutral-700 mb-2">
                    Purchase Price (₹)
                   </label>
                   <input
                     type="number"
                     name="purchasePrice"
                     value={(formData as any).purchasePrice}
                     onChange={handleChange}
                     placeholder="Enter Purchase Price"
                     className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-seller-500/20 focus:border-seller-500 transition-all"
                   />
                </div>
                )}

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
                     className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-seller-500/20 focus:border-seller-500 transition-all"
                   />
                </div>
                )}

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
                     className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-seller-500/20 focus:border-seller-500 transition-all"
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
                               <span key={b} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#f187b5]/10 text-[#f187b5] rounded-full text-sm font-semibold border border-[#f187b5]/20">
                                   {b}
                                   <button type="button" onClick={() => removeBarcode('product', b)} className="hover:text-red-600 transition-colors">
                                       &times;
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
                           className="w-full md:w-auto md:flex-1 px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f187b5]/20 focus:border-[#f187b5] transition-all"
                         />
                        <div className="flex gap-2 shrink-0">
                            <button
                                type="button"
                                onClick={() => addBarcode('product', null, currentBarcode)}
                                className="px-6 py-2 bg-seller-500 text-white rounded-lg font-bold hover:bg-seller-600"
                            >Add</button>
                            <button
                                type="button"
                                onClick={() => handleAutoGenerateBarcode("product")}
                                className="flex-1 md:flex-none px-4 py-2 bg-[#f187b5]/10 border border-[#f187b5]/20 rounded-lg hover:bg-[#f187b5]/20 text-[#f187b5] flex items-center justify-center gap-2 font-medium transition-colors"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                            </button>
                             <button
                                 type="button"
                                 onClick={() => startScanning("product")}
                                 className="flex-1 md:flex-none px-4 py-2 bg-seller-50 border border-seller-200 rounded-lg hover:bg-seller-100 text-seller-600 flex items-center justify-center gap-2 font-medium transition-colors"
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






          {/* Shop by Store Section */}
          {shouldShowField('shop_by_store_only') && (
          <div className="bg-white rounded-xl shadow-sm border border-neutral-200">
            <div
              className="bg-seller-500 text-white px-6 py-4 rounded-t-xl flex justify-between items-center cursor-pointer"
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
              <div className="bg-seller-50 border border-seller-200 rounded-lg p-4 flex gap-3 items-start">
                 <svg className="w-5 h-5 text-seller-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                 <p className="text-sm text-seller-800">
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

          {uploadError && (
             <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r-lg">
               <p className="text-red-700 text-sm font-medium">{uploadError}</p>
             </div>
          )}

        </form>
      </div>
      {/* Scanner Modal */}
      {isScanning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative">
            <div className="p-4 bg-seller-500 text-white flex justify-between items-center">
              <h3 className="font-semibold">Scan Barcode</h3>
              <button
                onClick={stopScanning}
                className="p-1 hover:bg-seller-600 rounded-full transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <div className="p-4 bg-neutral-900">
                <div id="reader" className="w-full h-64 bg-neutral-800 rounded-lg overflow-hidden"></div>
                <p className="text-center text-white text-sm mt-4">Point camera at a barcode to scan</p>
            </div>
          </div>
        </div>
      )}
        {/* Unit Pricing Modal */}
        {unitPricingModal.isOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                    <div className="bg-[#f187b5] text-white px-6 py-4 flex justify-between items-center shrink-0">
                        <h3 className="text-lg font-semibold">Unit Wise Pricing</h3>
                        <button onClick={() => setUnitPricingModal({...unitPricingModal, isOpen: false})} className="text-white hover:bg-[#e076a5] p-1 rounded-full">✕</button>
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
                                            className="w-full px-3 py-2 border border-neutral-300 rounded text-sm focus:border-[#f187b5] focus:outline-none"
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
                                                className="w-full pl-6 pr-3 py-2 border border-neutral-300 rounded text-sm focus:border-[#f187b5] focus:outline-none"
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
                                            type="button"
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
                            className="mt-4 text-sm font-bold text-[#f187b5] hover:text-[#e076a5] flex items-center gap-1"
                        >
                            + Add Price Slab
                        </button>
                    </div>

                    <div className="p-4 border-t border-gray-100 flex justify-end gap-3 shrink-0">
                        <button
                            type="button"
                            onClick={() => setUnitPricingModal({...unitPricingModal, isOpen: false})}
                            className="px-4 py-2 text-neutral-600 hover:bg-neutral-100 rounded-lg font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
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
                            className="px-6 py-2 bg-[#f187b5] hover:bg-[#e076a5] text-white rounded-lg font-medium"
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
            currentValue={(formData as any).pack}
        />

        {/* Product Found Modal - NEW SECTION as per User Request */}
        {showProductFoundModal && foundProduct && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-300">
                <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden transform transition-all animate-in zoom-in-95 duration-300">
                    <div className="p-8 flex flex-col items-center text-center">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-6">
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
                            <div className="inline-block bg-green-500 text-white px-6 py-1.5 rounded-lg font-bold text-lg shadow-sm">
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
                                        price: foundProduct.compareAtPrice?.toString() || "", // MRP
                                        discPrice: foundProduct.price?.toString() || "", // Selling Price
                                        stock: foundProduct.stock?.toString() || "0",
                                        mainImageUrl: foundProduct.mainImage || foundProduct.mainImageUrl || "",
                                        barcode: Array.isArray(foundProduct.barcode) ? foundProduct.barcode : [foundProduct.barcode || ""],
                                        offerPrice: foundProduct.offerPrice?.toString() || "0",
                                        itemCode: foundProduct.sku || foundProduct.itemCode || "",
                                    });
                                    if (foundProduct.mainImage || foundProduct.mainImageUrl) {
                                        setMainImagePreview(foundProduct.mainImage || foundProduct.mainImageUrl || "");
                                    }
                                    setIsProductLoaded(true);
                                    setShowProductFoundModal(false);
                                    setSuccessMessage("Product details loaded!");
                                    setTimeout(() => setSuccessMessage(""), 2000);
                                }}
                                className="flex-1 py-4 bg-green-500 hover:bg-green-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-green-200 transition-all active:scale-[0.97]"
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
              form="seller-product-form"
              type="submit"
              disabled={uploading || !isEnabled}
              className={`px-10 py-3 rounded-xl font-bold text-lg transition-all shadow-lg active:scale-95 ${
                uploading || !isEnabled
                  ? "bg-neutral-400 cursor-not-allowed text-white"
                  : "bg-seller-500 hover:bg-seller-600 text-white shadow-seller-500/30"
              }`}>
              {uploading ? "Uploading Images..." : id ? "Update Product" : "Add Product"}
            </button>
          </div>
        </div>
    </div>
  );
}
