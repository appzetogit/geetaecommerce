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
  getSellers,
  approveProductRequest,
  bulkImportProducts,
  bulkUpdateProducts,
  updateProductOrder,
  uploadImage as uploadImageLegacy,
  Product,
} from "../../../services/api/admin/adminProductService";
import { getAttributes } from "../../../services/api/admin/attributeService";
import { ProductVariation, Shop, searchProductImage } from "../../../services/api/productService";
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

import ThemedDropdown from "../components/ThemedDropdown";
import { Html5Qrcode } from "html5-qrcode";

import { getAppSettings } from "../../../services/api/admin/adminSettingsService";

import UnitSelectionModal from "../../../components/UnitSelectionModal";

export default function AdminAddProduct() {
  const navigate = useNavigate();
  const { id } = useParams();

  // Dynamic Field Settings State
  const [fieldVisibility, setFieldVisibility] = useState<Record<string, boolean>>({
    pack: true,
    item_code: true,
    rack_number: true,
    header_category: true,
    category: true,
    subcategory: true,
    sub_subcategory: true,
    brand: true,
    tags: true,
    summary: true,
    description: true,
    video: false,
    manufacturer: true,
    made_in: true,
    fssai: true,
    is_returnable: true,
    total_allowed_quantity: true,
    seo_title: true,
    seo_keywords: true,
    seo_description: true,
    seo_image_alt: true,
    tax: true,
    hsn_code: true,
    purchase_price: true,
    delivery_time: true,
    online_offer_price: false,
    barcode: true,
    shop_by_store_only: true,
    select_store: true,
  });

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
    barcode: "",
    itemCode: "", // sku alias
    rackNumber: "",
    hsnCode: "",
    purchasePrice: "",
    lowStockQuantity: "5",
    deliveryTime: "",
  });

  const [variations, setVariations] = useState<ProductVariation[]>([]);
  const [variationForm, setVariationForm] = useState({
    title: "",
    price: "",
    compareAtPrice: "",
    discPrice: "0",
    stock: "0",
    status: "Available" as "Available" | "Sold out",
    barcode: "",
    offerPrice: "",
    tieredPrices: [] as { minQty: string, price: string }[],
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
  const [scanTarget, setScanTarget] = useState<"product" | "variation">("product");
  const scannerRef = React.useRef<Html5Qrcode | null>(null);
   // Image Search State
   const [imageSearchQuery, setImageSearchQuery] = useState("");
   const [searchedImage, setSearchedImage] = useState("");
   const [isSearchingImage, setIsSearchingImage] = useState(false);
   const [showImageSourceModal, setShowImageSourceModal] = useState(false);
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

  // Color specific state
  const [enableColors, setEnableColors] = useState(false);
  const [selectedColors, setSelectedColors] = useState<{name: string, code: string}[]>([]);
  const [colorInput, setColorInput] = useState({ name: "", code: "#000000" });

  // Unit Pricing Modal State
  const [unitPricingModal, setUnitPricingModal] = useState<{ isOpen: boolean, variationIndex: number | null }>({ isOpen: false, variationIndex: null });
  // Temp state for editing in modal
  const [tempTieredPrices, setTempTieredPrices] = useState<{ minQty: number, price: number }[]>([]);

  useEffect(() => {
    if (enableAttributes) {
        getAttributes().then(res => {
            if(res.success) setAvailableAttributes(res.data);
        }).catch(err => console.error(err));
    }
  }, [enableAttributes]);

  useEffect(() => {
    const fetchSettings = async () => {
        try {
            const response = await getAppSettings();
            if (response.success) {
// ... existing code ...
  const handleRemoveAttributeValue = (attrId: string, value: string) => {
      setSelectedAttributes(prev => prev.map(p => {
          if(p.id === attrId) {
              return { ...p, values: p.values.filter(v => v !== value) };
          }
          return p;
      }));
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

       // Prepare dimensions
       // 1. Colors (if enabled)
       // 2. Attributes
       // 3. Units

       let dimensions: string[][] = [];

       if (enableColors && selectedColors.length > 0) {
           dimensions.push(selectedColors.map(c => c.name));
       }

       selectedAttributes.forEach(attr => {
           if (attr.values.length > 0) {
               dimensions.push(attr.values);
           }
       });

       if (variationUnits.length > 0) {
           dimensions.push(variationUnits);
       }

       // Generate Cartesian Product
       if (dimensions.length === 0) {
           combos = ["Default"]; // Should not happen ideally if triggered correctly
       } else {
           const cartesian = (sets: string[][]): string[] => {
               return sets.reduce<string[]>((acc, set) => {
                   return acc.flatMap(x => set.map(y => `${x} - ${y}`));
               }, sets.shift() || []);
           };

           // We need to clone dimensions because shift() modifies it
           // Actually reduce logic above is slightly wrong for n arrays.
           // Correct reduce for cartesian:
           // ['A', 'B'] x ['1', '2'] = A-1, A-2, B-1, B-2

           const result = dimensions.reduce((acc, curr) => {
               return acc.flatMap(x => curr.map(y => `${x}-${y}`));
           }, [""]);

           // Clean up leading hyphen if exists (due to initial [""])
           combos = result.map(s => s.startsWith("-") ? s.substring(1) : s);

           // If only one dimension, the reduce above with [""] might produce "-A", "-B".
           // Let's retry simple recursive approach for clarity or fix the reduce.
           // Reduce with [""] works: [""] x [A, B] -> [-A, -B].
           // Then [-A, -B] x [1, 2] -> [-A-1, -A-2, ...].
           // So trimming start is correct.
       }

       // Edge case: if dimensions empty but unit empty? Handled.

       const newVariations = combos.map(title => ({
           title: title,
           value: title, // value field
           name: formData.variationType || "Variation",
           price: 0,
           discPrice: 0,
           stock: 0,
           status: "Available" as const,
           barcode: "",
           offerPrice: undefined,
           tieredPrices: []
       }));

       // Merge logic: preserve existing prices/stock if title matches
       const merged = newVariations.map(nv => {
           const existing = variations.find(v => v.title === nv.title);
           return existing ? existing : nv;
       });

       if(merged.length > 0) {
           setVariations(merged);
       } else {
            alert("No variations generated. Please add colors, attributes or units.");
       }
  };
                // Field Visibility Settings
                if (response.data?.productDisplaySettings) {
                    const settings = response.data.productDisplaySettings;
                    const newVisibility: Record<string, boolean> = { ...fieldVisibility };

                    settings.forEach((section: any) => {
                        if (section.fields) {
                            section.fields.forEach((field: any) => {
                                // Map settings IDs to local visibility keys
                                if (Object.keys(newVisibility).includes(field.id)) {
                                    newVisibility[field.id] = field.isEnabled;
                                }
                            });
                        }
                    });
                    setFieldVisibility(newVisibility);
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
                  ${mrp ? `<div class="price-item">MRP:${mrp}</div>` : ''}
                  ${sp ? `<div class="price-item">SP:${sp}</div>` : ''}
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
                (typeof product.category === 'object' ? product.category?._id : product.category) || product.categoryId || "",
              subcategory:
                (typeof product.subcategory === 'object' ? product.subcategory?._id : product.subcategory) ||
                product.subcategoryId ||
                "",
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
              manufacturer: product.manufacturer || "",
              madeIn: product.madeIn || "",
              tax: (product.tax as any)?._id || (product as any).taxId || (product as any).tax || "",
              isReturnable: product.isReturnable ? "Yes" : "No",
              maxReturnDays: product.maxReturnDays?.toString() || "",
              fssaiLicNo: product.fssaiLicNo || "",
              totalAllowedQuantity:
                product.totalAllowedQuantity?.toString() || "10",
              mainImageUrl: product.mainImageUrl || product.mainImage || "",
              galleryImageUrls: product.galleryImageUrls || [],
              isShopByStoreOnly: product.isShopByStoreOnly ? "Yes" : "No",
              shopId: typeof product.shopId === 'object' ? product.shopId?._id : product.shopId || "",
              pack: product.pack || "",
              barcode: product.barcode || "",
              itemCode: product.sku || product.itemCode || "",
              rackNumber: (product as any).rackNumber || "",
              hsnCode: (product as any).hsnCode || "",
              purchasePrice: (product as any).purchasePrice?.toString() || "",
              lowStockQuantity: (product as any).lowStockQuantity?.toString() || "5",
              deliveryTime: (product as any).deliveryTime || "",
            });
            const vars = (product.variations || []).map((v: any) => ({
              ...v,
              price: v.price || 0,
              discPrice: v.discPrice || 0,
              compareAtPrice: v.compareAtPrice || 0,
              stock: v.stock || 0,
              status: (v.status as "Available" | "Sold out" | "In stock") || "Available"
            }));
            setVariations(vars);

            // Populate Top Form with 1st variation if exists (Simulating Simple Product Edit)
            if (vars.length > 0) {
               const v = vars[0];
               setVariationForm(prev => ({
                   ...prev,
                   price: v.price?.toString() || "",
                   compareAtPrice: v.compareAtPrice?.toString() || "",
                   discPrice: v.discPrice?.toString() || "",
                   stock: v.stock?.toString() || "",
                   status: v.status,
                   title: v.title || "",
                   // And others if needed
               }));
            }

            if (product.mainImageUrl || product.mainImage) {
               setMainImagePreview(
                 product.mainImageUrl || product.mainImage || ""
               );
             }
            if (product.galleryImageUrls) {
              setGalleryItems(product.galleryImageUrls.map((url) => ({
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
          if (res.success) setSubSubCategories(res.data);
        } catch (err) {
          console.error("Error fetching sub-subcategories:", err);
        }
      } else {
        setSubSubCategories([]);
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
          setSubSubCategories([]);
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
      discPrice: price, // For legacy support, or if discPrice is meant to be the final selling price
      stock,
      status: variationForm.status,
      barcode: variationForm.barcode,
      offerPrice,
      tieredPrices: variationForm.tieredPrices.map(t => ({
        minQty: parseInt(t.minQty) || 0,
        price: parseFloat(t.price) || 0
      })).filter(t => t.minQty > 1 && t.price > 0)
    };

    setVariations([...variations, newVariation]);
    setVariationForm({
      title: "",
      price: "",
      compareAtPrice: "",
      discPrice: "0",
      stock: "0",
      status: "Available",
      barcode: "",
      offerPrice: "",
      tieredPrices: [],
    });
    setUploadError("");
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
           discPrice: 0,
           stock: 0,
           status: "Available" as const,
           barcode: "",
           offerPrice: undefined,
           tieredPrices: []
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

  const startScanning = (target: "product" | "variation" = "product") => {
    setIsScanning(true);
    setScanTarget(target);
    // Slight delay to ensure DOM element exists
    setTimeout(() => {
        const html5QrCode = new Html5Qrcode("reader");
        scannerRef.current = html5QrCode;
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };

        html5QrCode.start(
            { facingMode: "environment" },
            config,
            (decodedText) => {
                // Success callback
                if (target === "product") {
                    setFormData(prev => ({ ...prev, barcode: decodedText }));
                } else {
                    setVariationForm(prev => ({ ...prev, barcode: decodedText }));
                }
                stopScanning();
                // Optional: Play a beep sound
                const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
                audio.play().catch(e => console.log('Audio play failed', e));
                setSuccessMessage("Barcode Scanned Successfully!");
                setTimeout(() => setSuccessMessage(""), 3000);
            },
            (errorMessage) => {
                // Error callback (scanning...)
                // console.log(errorMessage);
            }
        ).catch(err => {
            console.error("Error starting scanner", err);
            setUploadError("Failed to start camera. Please ensure permissions are granted.");
            setIsScanning(false);
        });
    }, 100);
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
      if (fieldVisibility.category) {
          if (!formData.headerCategory) {
            setUploadError("Please select a header category.");
            return;
          }
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

      // Auto-add current variation if form is filled but list is empty
      let finalVariations = [...variations];

      const price = parseFloat(variationForm.price);
      const compareAtPrice = variationForm.compareAtPrice ? parseFloat(variationForm.compareAtPrice) : 0;
      const stock = parseInt(variationForm.stock || "0");
      const offerPrice = variationForm.offerPrice ? parseFloat(variationForm.offerPrice) : undefined;
      const discPrice = price; // standard behavior for this form

      if (finalVariations.length === 0) {
        if (variationForm.title && variationForm.price) {
          if (compareAtPrice > 0 && price > compareAtPrice) {
             setUploadError("Selling price cannot be greater than Maximum Retail Price (MRP)");
             setUploading(false);
             return;
          }

          finalVariations.push({
             title: variationForm.title,
             price,
             compareAtPrice,
             discPrice,
             stock,
             status: variationForm.status,
             offerPrice
           });
        } else {
          setUploadError("Please add at least one product variation");
          setUploading(false);
          return;
        }
      } else if (finalVariations.length === 1) {
          // If there is exactly one variation (Simple Product mode), update it with the top form values
          // This allows editing key fields without removing/re-adding the variation
           if (compareAtPrice > 0 && price > compareAtPrice) {
             setUploadError("Selling price cannot be greater than Maximum Retail Price (MRP)");
             setUploading(false);
             return;
          }

          finalVariations[0] = {
              ...finalVariations[0],
              price,
              compareAtPrice,
              discPrice,
              stock,
              offerPrice,
              // Update title only if needed? Usually we keep it.
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
        headerCategoryId: formData.headerCategory || undefined, // Schema has headerCategoryId
        category: formData.category || undefined, // Schema has category
        subcategory: formData.subcategory || undefined, // Schema has subcategory
        subSubCategory: formData.subSubCategory || undefined, // Schema has subSubCategory
        brand: formData.brand || undefined, // Schema has brand
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
        price: finalVariations[0]?.price || 0,
        compareAtPrice: finalVariations[0]?.compareAtPrice || 0,
        stock: finalVariations.reduce((acc, curr) => acc + (Number(curr.stock) || 0), 0),
        isShopByStoreOnly: formData.isShopByStoreOnly === "Yes",
        shopId: formData.shopId || undefined,
        pack: (formData as any).pack || undefined,
        barcode: (formData as any).barcode || undefined,
        itemCode: (formData as any).itemCode || undefined, // maps to sku in backend
        sku: (formData as any).itemCode || undefined,
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
              barcode: "",
              itemCode: "",
              rackNumber: "",
              hsnCode: "",
              purchasePrice: "",
              lowStockQuantity: "5",
              deliveryTime: "",
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

  return (
    <div className="flex flex-col h-full">
      {/* Main Content */}
      <div className="flex-1">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Top Image & Name & Price Section (Seller Style) */}
          <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6 space-y-6 mb-6">
              {uploadError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {uploadError}
                </div>
              )}
              {successMessage && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
                  {successMessage}
                </div>
              )}
            {/* 1. Image Upload Section */}
            <div>
                 <div className="flex flex-col gap-6">
                    {/* Main Image */}
                    <div className="flex flex-col items-center">
                        <span className="text-sm font-semibold text-neutral-700 mb-2">Main Image <span className="text-red-500">*</span></span>
                        <div
                         onClick={() => setShowImageSourceModal(true)}
                         className="w-40 h-40 border-2 border-blue-500 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-blue-50 transition-colors relative overflow-hidden bg-white">
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
                                    <svg className="w-10 h-10 text-blue-500 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                                    <span className="text-xs text-blue-600 font-bold">Upload Main</span>
                                </>
                            )}
                            <input ref={mainImageInputRef} type="file" accept="image/*" onChange={handleMainImageChange} className="hidden" disabled={uploading} />
                        </div>
                    </div>

                    {/* Gallery Images */}
                    <div className="flex flex-col items-start w-full">
                        <span className="text-sm font-semibold text-neutral-700 mb-2">Gallery Images (Max 6)</span>
                        <div className="flex flex-wrap gap-3">
                            {galleryItems.map((item, index) => (
                                <div key={item.id} className="w-24 h-24 relative border border-gray-200 rounded-lg overflow-hidden group bg-white">
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
                                <label className="w-24 h-24 border-2 border-gray-300 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors text-gray-400 hover:text-blue-600">
                                    <span className="text-3xl font-light mb-1">+</span>
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
               <label className="block text-sm font-semibold text-neutral-700 mb-2">
                 Name <span className="text-red-500">*</span>
               </label>
               <input
                 type="text"
                 name="productName"
                 value={formData.productName}
                 onChange={handleChange}
                 placeholder="Enter Product Name"
                 className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
               />
            </div>

            {/* 3. Prices (Simulating Variation Form for consistency) */}
            <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-2">
                      Selling Price <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                        <input
                           type="number"
                           value={variationForm.price}
                           onChange={(e) => setVariationForm({ ...variationForm, price: e.target.value })}
                           placeholder="0.00"
                           className="w-full pl-7 pr-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                    </div>
                 </div>
                 <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-2">
                      Maximum Retail Price
                    </label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                        <input
                           type="number"
                           value={variationForm.compareAtPrice}
                           onChange={(e) => setVariationForm({ ...variationForm, compareAtPrice: e.target.value })}
                           placeholder="0.00"
                           className="w-full pl-7 pr-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                    </div>
                 </div>
            </div>

             {/* Purchase Price */}
             {fieldVisibility.purchase_price && (
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
                         className="w-full pl-7 pr-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                       />
                   </div>
                </div>
             )}
          </div>

          {/* Product Section Details */}
          <div className="bg-white rounded-xl shadow-sm border border-neutral-200">
            <div className="p-6 space-y-6 rounded-b-xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

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
                       className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all cursor-pointer bg-white"
                     />
                     <div className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
                     </div>
                   </div>
                </div>

                <div className="md:col-span-1">
                   <label className="block text-sm font-semibold text-neutral-700 mb-2">
                    Item Code (SKU)
                   </label>
                   <input
                     type="text"
                     name="itemCode"
                     value={formData.itemCode}
                     onChange={handleChange}
                     placeholder="Enter Item Code / SKU"
                     className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                   />
                </div>
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
                     className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                   />
                </div>

                {fieldVisibility.category && (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-neutral-700 mb-2">
                        Header Category <span className="text-red-500">*</span>
                      </label>
                      <ThemedDropdown
                        options={headerCategories.map(hc => ({ id: hc._id, label: hc.name, value: hc._id }))}
                        value={formData.headerCategory}
                        onChange={(val) => setFormData(prev => ({ ...prev, headerCategory: val }))}
                        placeholder="Select Header Category"
                      />
                    </div>

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
                        placeholder={formData.headerCategory ? "Select Category" : "Select Header Category First"}
                        disabled={!formData.headerCategory}
                      />
                    </div>

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
                        className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                      />
                    </div>
                  </>
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

                {fieldVisibility.brand && (
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
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                  />
                </div>
              </div>

              {fieldVisibility.summary && (
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
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-none transition-all"
                  />
                </div>
              )}
            </div>
          </div>


          <div className="bg-white rounded-xl shadow-sm border border-neutral-200">
            <div className="bg-teal-600 text-white px-6 py-4 rounded-t-xl">
              <h2 className="text-lg font-semibold tracking-wide">SEO Configuration</h2>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                  />
                </div>
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
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                  />
                </div>
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
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                  />
                </div>
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
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-none transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Add Variation Section */}
          <div className="bg-white rounded-xl shadow-sm border border-neutral-200">
            <div className="bg-teal-600 text-white px-6 py-4 rounded-t-xl flex justify-between items-center">
              <h2 className="text-lg font-semibold tracking-wide">Product Variations</h2>
              <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white/90">Enable Attributes</span>
                  <button
                      type="button"
                      onClick={() => setEnableAttributes(!enableAttributes)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${enableAttributes ? 'bg-teal-200' : 'bg-teal-800'}`}
                  >
                      <span className={`inline-block h-4 w-4 transform rounded-full transition-transform bg-white ${enableAttributes ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
              </div>
            </div>

            <div className="p-6 space-y-6 border-x border-b border-neutral-200 rounded-b-xl">
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  Variation Type
                </label>
                <div className="max-w-xs">
                  <ThemedDropdown
                    options={['Size', 'Weight', 'Color', 'Pack', 'Material']}
                    value={formData.variationType}
                    onChange={(val) => setFormData(prev => ({ ...prev, variationType: val }))}
                    placeholder="Select Variation Type"
                  />
                </div>
              </div>

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
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${enableColors ? 'bg-blue-600' : 'bg-neutral-300'}`}
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
                                         className="px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100 text-sm font-medium"
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
                                  className="flex-1 px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
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
                                 className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700"
                             >
                                 Add
                             </button>
                          </div>
                       </div>

                       {/* Step 2: Attribute Values */}
                       {selectedAttributes.map((attr) => (
                           <div key={attr.id} className="bg-white p-4 rounded-lg border border-neutral-200 shadow-sm relative">
                               <button type="button" onClick={() => handleRemoveAttribute(attr.id)} className="absolute top-2 right-2 text-gray-400 hover:text-red-500 text-lg leading-none">&times;</button>
                               <h4 className="font-semibold text-teal-800 mb-2">{attr.name} Values</h4>
                               <div className="flex flex-col sm:flex-row gap-2 mb-3 max-w-lg">
                                   <input
                                       type="text"
                                       placeholder={`Add ${attr.name} value (e.g. Red, XL)`}
                                       className="flex-1 px-3 py-2 border border-neutral-300 rounded text-sm focus:outline-none focus:border-teal-500"
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
                                        className="px-4 py-2 bg-teal-50 text-teal-700 border border-teal-200 rounded hover:bg-teal-100 text-sm font-medium"
                                    >Add</button>
                               </div>
                               <div className="flex flex-wrap gap-2">
                                   {attr.values.length === 0 && <span className="text-xs text-gray-400 italic">No values added yet</span>}
                                   {attr.values.map(val => (
                                       <span key={val} className="px-3 py-1 bg-teal-50 text-teal-700 border border-teal-200 rounded-full text-xs font-medium flex items-center gap-2">
                                           {val}
                                           <button type="button" onClick={() => handleRemoveAttributeValue(attr.id, val)} className="text-teal-400 hover:text-red-500 font-bold focus:outline-none">&times;</button>
                                       </span>
                                   ))}
                               </div>
                           </div>
                       ))}

                       {/* Unit Values */}
                       <div className="bg-white p-4 rounded-lg border border-neutral-200 shadow-sm">
                           <h4 className="font-semibold text-teal-800 mb-2">Unit Values (Optional)</h4>
                           <div className="flex flex-col sm:flex-row gap-2 mb-3 max-w-lg">
                               <input
                                   type="text"
                                   placeholder="e.g. 1kg, 5kg"
                                   className="flex-1 px-3 py-2 border border-neutral-300 rounded text-sm focus:outline-none focus:border-blue-500"
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
                                   className="px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100 text-sm font-medium"
                               >Add</button>
                           </div>
                           <div className="flex flex-wrap gap-2">
                               {variationUnits.length === 0 && <span className="text-xs text-gray-400 italic">No units added (Will generate single variation per attribute combo)</span>}
                               {variationUnits.map(unit => (
                                   <span key={unit} className="px-3 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-medium flex items-center gap-2">
                                       {unit}
                                       <button type="button" onClick={() => handleRemoveUnit(unit)} className="text-blue-400 hover:text-red-500 font-bold focus:outline-none">&times;</button>
                                   </span>
                               ))}
                           </div>
                       </div>

                       <div className="flex justify-end pt-4 border-t border-neutral-200">
                           <button
                               type="button"
                               onClick={generateVariations}
                               className="px-6 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 shadow-sm font-medium transition-colors"
                           >
                               Generate Variations Table
                           </button>
                       </div>
                  </div>
              ) : (
                /* Variation Form (Old Manual) */
                <div className="bg-neutral-50 rounded-xl p-6 border border-neutral-200">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-start">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">
                        Unit Value
                      </label>
                      <input
                        type="text"
                        value={variationForm.title}
                        onChange={(e) => setVariationForm({ ...variationForm, title: e.target.value })}
                        placeholder="e.g. XL, 1kg"
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">
                        Price *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">₹</span>
                        <input
                          type="number"
                          value={variationForm.price}
                          onChange={(e) => setVariationForm({ ...variationForm, price: e.target.value })}
                          placeholder="0.00"
                          className="w-full pl-7 pr-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">
                        Discount Price
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">₹</span>
                        <input
                          type="number"
                          value={variationForm.discPrice}
                          onChange={(e) => setVariationForm({ ...variationForm, discPrice: e.target.value })}
                          placeholder="0.00"
                          className="w-full pl-7 pr-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">
                        Stock
                      </label>
                      <input
                        type="number"
                        value={variationForm.stock}
                        onChange={(e) => setVariationForm({ ...variationForm, stock: e.target.value })}
                        placeholder="0 = Unlimited"
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                      />
                    </div>
                    {fieldVisibility.online_offer_price && (
                    <div>
                      <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">
                        Offer Price
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">₹</span>
                        <input
                          type="number"
                          value={variationForm.offerPrice}
                          onChange={(e) => setVariationForm({ ...variationForm, offerPrice: e.target.value })}
                          placeholder="Optional"
                          className="w-full pl-7 pr-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                        />
                      </div>
                    </div>
                    )}
                    <div>
                      <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">
                        Secondary Offer (Optional)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">₹</span>
                        <input
                          type="number"
                          value={variationForm.offerPrice}
                          onChange={(e) => setVariationForm({ ...variationForm, offerPrice: e.target.value })}
                          placeholder="Optional"
                          className="w-full pl-7 pr-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                        />
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
                              className="text-xs font-bold text-teal-600 hover:text-teal-700"
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
                              Barcode
                          </label>
                          <div className="flex gap-2">
                               <input
                                  type="text"
                                  value={variationForm.barcode}
                                  onChange={(e) => setVariationForm({ ...variationForm, barcode: e.target.value })}
                                  placeholder="Scan or Enter"
                                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                              />
                              <button
                                  type="button"
                                  onClick={() => startScanning("variation")}
                                  className="px-3 py-2 bg-neutral-100 border border-neutral-300 rounded-lg hover:bg-neutral-200 text-neutral-600 transition-colors"
                                  title="Scan Barcode"
                                  >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path></svg>
                              </button>
                          </div>
                       </div>
                    </div>
                    <div className="flex items-end h-full pt-6 md:col-span-5 justify-end">
                      <button
                        type="button"
                        onClick={addVariation}
                        className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                      >
                        Add Variation +
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
                            <thead className="bg-teal-50 text-teal-900 font-semibold border-b border-teal-100">
                                <tr>
                                    <th className="px-4 py-3 min-w-[150px]">Variation</th>
                                    <th className="px-4 py-3 min-w-[100px]">Price (₹) <span className="text-red-500">*</span></th>
                                    <th className="px-4 py-3 min-w-[100px]">Disc. Price</th>
                                    <th className="px-4 py-3 min-w-[80px]">Stock</th>
                                    <th className="px-4 py-3 min-w-[120px]">SKU/Barcode</th>
                                    <th className="px-4 py-3 min-w-[100px]">Unit Pricing</th>
                                    <th className="px-4 py-3 w-10 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100 bg-white">
                                {variations.map((v, idx) => (
                                    <tr key={idx} className="hover:bg-neutral-50 group">
                                        <td className="px-4 py-2 font-medium text-neutral-800">{v.title}</td>
                                        <td className="px-4 py-2">
                                            <input
                                                type="number"
                                                className="w-full px-2 py-1.5 border border-neutral-300 rounded focus:border-teal-500 focus:outline-none"
                                                value={v.price}
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
                                                className="w-full px-2 py-1.5 border border-neutral-300 rounded focus:border-teal-500 focus:outline-none"
                                                value={v.discPrice}
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    setVariations(prev => {
                                                        const n = [...prev];
                                                        n[idx].discPrice = parseFloat(val) || 0;
                                                        return n;
                                                    });
                                                }}
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <input
                                                type="number"
                                                className="w-full px-2 py-1.5 border border-neutral-300 rounded focus:border-teal-500 focus:outline-none"
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
                                            <input
                                                type="text"
                                                className="w-full px-2 py-1.5 border border-neutral-300 rounded focus:border-teal-500 focus:outline-none"
                                                value={v.barcode}
                                                placeholder="SKU"
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    setVariations(prev => {
                                                        const n = [...prev];
                                                        n[idx].barcode = val;
                                                        return n;
                                                    });
                                                }}
                                            />
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
                                                    ? "bg-teal-100 text-teal-800 border-teal-200 hover:bg-teal-200"
                                                    : "bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200"
                                                }`}
                                            >
                                                {v.tieredPrices && v.tieredPrices.length > 0 ? `${v.tieredPrices.length} Slabs` : "Add +"}
                                            </button>
                                        </td>
                                        <td className="px-4 py-2 text-center">
                                            <button type="button" onClick={() => removeVariation(idx)} className="text-gray-400 hover:text-red-600 transition-colors p-1 rounded-full hover:bg-red-50">
                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                            </button>
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
                             <span className="text-xs text-neutral-400 block">Barcode</span>
                             <span className="text-neutral-700 text-sm">{variation.barcode || "-"}</span>
                          </div>
                          <div>
                            <span className="text-xs text-neutral-400 block">Unit Value</span>
                            <span className="font-medium text-neutral-900">{variation.title}</span>
                          </div>
                          <div>
                            <span className="text-xs text-neutral-400 block">Price</span>
                            <span className="font-medium text-teal-600">₹{variation.price}</span>
                            {variation.discPrice > 0 && (
                               <span className="text-xs text-neutral-400 line-through ml-2">₹{variation.discPrice}</span>
                            )}
                            {variation.tieredPrices && variation.tieredPrices.length > 0 && (
                                <div className="mt-1 flex flex-wrap gap-1">
                                    {variation.tieredPrices.map((t, idx) => (
                                        <span key={idx} className="text-[10px] bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded border border-teal-100">
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
                            <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${variation.status === 'Available' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              {variation.status}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeVariation(index)}
                          className="ml-4 p-2 text-neutral-400 hover:text-red-600 transition-colors"
                          title="Remove variation"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Add Other Details Section */}
          <div className="bg-white rounded-xl shadow-sm border border-neutral-200">
            <div className="bg-teal-600 text-white px-6 py-4 rounded-t-xl">
              <h2 className="text-lg font-semibold tracking-wide">Additional Details</h2>
            </div>
            <div className="p-6 space-y-6 border-x border-b border-neutral-200 rounded-b-xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                  />
                </div>
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
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                  />
                </div>
                {fieldVisibility.tax && (
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
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                  />
                </div>
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
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                  />
                </div>
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
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                  />
                  <p className="text-xs text-neutral-500 mt-1">
                    Max quantity a user can buy at once
                  </p>
                </div>

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
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                  />
                </div>



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
                     className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                   />
                </div>

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
                     className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                   />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">
                    Barcode (EAN/UPC)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      name="barcode"
                      value={(formData as any).barcode}
                      onChange={handleChange}
                      placeholder="Scan or enter barcode manually"
                      className="flex-1 px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                    />
                    <button
                        type="button"
                        onClick={() => startScanning("product")}
                        className="px-4 py-2 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 text-teal-700 flex items-center gap-2 font-medium transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path></svg>
                        Scan Code
                    </button>
                  </div>
                </div>

                {/* Print Barcode Section */}
                <div className="md:col-span-2 border-t border-neutral-100 pt-4 mt-2">
                   <label className="block text-sm font-semibold text-neutral-700 mb-2">
                    Print Barcodes
                   </label>
                   <div className="bg-neutral-50 p-4 rounded-lg border border-neutral-200">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                       <div>
                          <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">Quantity</label>
                          <input
                             type="number"
                             min="1"
                             value={printQuantity}
                             onChange={(e) => setPrintQuantity(e.target.value)}
                             className="w-full px-3 py-2.5 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                             placeholder="How many copies?"
                          />
                       </div>

                       <div>
                         <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">Select Barcode</label>
                         <select
                           className="w-full px-3 py-2.5 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                           value={selectedPrintBarcode}
                             onChange={(e) => {
                             const selectedVal = e.target.value;
                             setSelectedPrintBarcode(selectedVal);

                             if(selectedVal) {
                                let name = formData.productName;
                                let sp: number | undefined;
                                let mrp: number | undefined;

                                // Check if variation
                                const variation = variations.find(v => v.barcode === selectedVal);
                                if (variation) {
                                    name = `${formData.productName} - ${variation.title}`;
                                    // Logic: Price is MRP, DiscPrice is SP (if exists)
                                    mrp = variation.price;
                                    sp = variation.discPrice > 0 ? variation.discPrice : variation.price;
                                } else if (selectedVal === (formData as any).barcode) {
                                    // Main product - try to get price from first variation if possible
                                    if (variations.length > 0) {
                                        mrp = variations[0].price;
                                        sp = variations[0].discPrice > 0 ? variations[0].discPrice : variations[0].price;
                                    } else {
                                        // Fallback logic could be added here if main fields existed
                                    }
                                }

                                handlePrintBarcode(selectedVal, parseInt(printQuantity) || 1, name, sp, mrp);
                             }
                           }}
                         >
                           <option value="">-- Select to Print --</option>
                           {(formData as any).barcode && (
                               <option value={(formData as any).barcode}>{(formData as any).barcode} (Main Product)</option>
                           )}
                           {variations.map((v, idx) => v.barcode ? (
                               <option key={idx} value={v.barcode}>{v.barcode} ({v.title})</option>
                           ) : null)}
                         </select>
                       </div>
                     </div>
                     <p className="text-xs text-neutral-500 mt-2">
                       * Select a barcode to immediately open the print preview.
                     </p>
                   </div>
                </div>
              </div>
            </div>
          </div>

          {/* Add Images Section */}


          {/* Shop by Store Section */}
          {fieldVisibility.shop_by_store_only && (
          <div className="bg-white rounded-xl shadow-sm border border-neutral-200">
            <div className="bg-teal-600 text-white px-6 py-4 rounded-t-xl">
              <h2 className="text-lg font-semibold tracking-wide">Store Visibility</h2>
            </div>
            <div className="p-6 space-y-6 border-x border-b border-neutral-200 rounded-b-xl">
              <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 flex gap-3 items-start">
                 <svg className="w-5 h-5 text-teal-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                 <p className="text-sm text-teal-800">
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
                  {fieldVisibility.select_store && (
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
          </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end pb-6">
            <button
              type="submit"
              disabled={uploading}
              className={`px-8 py-3 rounded-lg font-medium text-lg transition-colors shadow-sm ${
                uploading
                  ? "bg-neutral-400 cursor-not-allowed text-white"
                  : "bg-teal-600 hover:bg-teal-700 text-white"
              }`}>
              {uploading ? "Uploading Images..." : id ? "Update Product" : "Add Product"}
            </button>
          </div>
        </form>
      </div>
      {/* Scanner Modal */}
      {isScanning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative">
            <div className="p-4 bg-teal-600 text-white flex justify-between items-center">
              <h3 className="font-semibold">Scan Barcode</h3>
              <button
                onClick={stopScanning}
                className="p-1 hover:bg-teal-700 rounded-full transition-colors"
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
                    <div className="bg-teal-600 text-white px-6 py-4 flex justify-between items-center shrink-0">
                        <h3 className="text-lg font-semibold">Unit Wise Pricing</h3>
                        <button onClick={() => setUnitPricingModal({...unitPricingModal, isOpen: false})} className="text-white hover:bg-teal-700 p-1 rounded-full">✕</button>
                    </div>

                    <div className="p-6 overflow-y-auto flex-1">
                        <p className="text-sm text-gray-500 mb-4 bg-blue-50 p-3 rounded border border-blue-100">
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
                                            className="w-full px-3 py-2 border border-neutral-300 rounded text-sm focus:border-teal-500 focus:outline-none"
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
                                                className="w-full pl-6 pr-3 py-2 border border-neutral-300 rounded text-sm focus:border-teal-500 focus:outline-none"
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
                            className="mt-4 text-sm font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1"
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
                            className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium"
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
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                        <h3 className="font-bold text-gray-800 text-lg">Choose Image</h3>
                        <button onClick={() => setShowImageSourceModal(false)} className="text-gray-400 hover:text-gray-600 p-1 bg-white rounded-full shadow-sm border border-gray-100">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>

                    <div className="p-5 space-y-6">
                        {/* Live Search Section */}
                        <div>
                             <div className="flex items-center justify-between mb-2">
                                <label className="text-xs font-bold text-purple-600 uppercase tracking-wider flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                    Live Image Search
                                </label>
                                <span className="text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded font-bold">AI</span>
                             </div>
                             <div className="flex gap-2">
                                <input
                                    type="text"
                                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                                    placeholder="e.g. 10 Vala Pen, Dove Soap"
                                    value={imageSearchQuery}
                                    onChange={(e) => setImageSearchQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleImageSearch()}
                                    autoFocus
                                />
                                <button
                                    onClick={handleImageSearch}
                                    disabled={isSearchingImage}
                                    className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-wide hover:bg-purple-700 disabled:opacity-70 transition-colors"
                                >
                                    {isSearchingImage ? '...' : 'GO'}
                                </button>
                             </div>

                             {/* Search Result Preview */}
                             {searchedImage && (
                                <div className="mt-3 p-3 bg-purple-50 rounded-xl border border-purple-100 flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                                    <img src={searchedImage} className="w-14 h-14 object-cover rounded-lg bg-white shadow-sm" alt="Result" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs text-purple-800 font-medium mb-1 truncate">Image Found!</p>
                                        <button
                                            onClick={() => {
                                                applySearchedImage();
                                                setShowImageSourceModal(false);
                                            }}
                                            className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-purple-700 w-full shadow-sm hover:shadow"
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
                                className="flex flex-col items-center justify-center gap-3 p-4 border border-gray-100 rounded-2xl bg-gray-50 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-all group active:scale-[0.98]"
                            >
                                <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-600 group-hover:text-blue-600 group-hover:scale-110 transition-transform">
                                     <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                </div>
                                <span className="font-semibold text-sm text-gray-600 group-hover:text-blue-600">Gallery</span>
                            </button>

                            <button
                                onClick={() => { setShowImageSourceModal(false); setTimeout(() => mainImageInputRef.current?.click(), 200); }}
                                className="flex flex-col items-center justify-center gap-3 p-4 border border-gray-100 rounded-2xl bg-gray-50 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-all group active:scale-[0.98]"
                            >
                                <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-600 group-hover:text-blue-600 group-hover:scale-110 transition-transform">
                                     <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                </div>
                                <span className="font-semibold text-sm text-gray-600 group-hover:text-blue-600">Camera</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
}
