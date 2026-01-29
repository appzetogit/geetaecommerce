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
  searchProductImage,
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
    discPrice: "0",
    stock: "0",
    status: "Available" as "Available" | "Sold out",
    barcode: "",
    offerPrice: "",
  });

  const [mainImageFile, setMainImageFile] = useState<File | null>(null);
  const [mainImagePreview, setMainImagePreview] = useState<string>("");
  const [galleryImageFiles, setGalleryImageFiles] = useState<File[]>([]);
  const [galleryImagePreviews, setGalleryImagePreviews] = useState<string[]>(
    []
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [isScanning, setIsScanning] = useState(false);
  const [scanTarget, setScanTarget] = useState<"product" | "variation">("product");
  const scannerRef = React.useRef<Html5Qrcode | null>(null);

  // Print Barcode State
  const [printQuantity, setPrintQuantity] = useState("1");
  const [selectedPrintBarcode, setSelectedPrintBarcode] = useState("");
  const [barcodeSettings, setBarcodeSettings] = useState<any>(null);

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

  // Image Search State
  const [imageSearchQuery, setImageSearchQuery] = useState("");
  const [searchedImage, setSearchedImage] = useState("");
  const [isSearchingImage, setIsSearchingImage] = useState(false);

  // Dynamic Product Settings
  const [productDisplaySettings, setProductDisplaySettings] = useState<any[]>([]);
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<SubCategory[]>([]);
  const [subSubCategories, setSubSubCategories] = useState<SubSubCategory[]>([]);
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
              barcode: (product as any).barcode || "",
              itemCode: (product as any).sku || (product as any).itemCode || "",
              rackNumber: (product as any).rackNumber || "",
              hsnCode: (product as any).hsnCode || "",
              purchasePrice: (product as any).purchasePrice?.toString() || "",
              lowStockQuantity: (product as any).lowStockQuantity?.toString() || "5",
              deliveryTime: (product as any).deliveryTime || "",
            });
            setVariations(product.variations);
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
    const discPrice = parseFloat(variationForm.discPrice || "0");
    const stock = parseInt(variationForm.stock || "0");
    const offerPrice = variationForm.offerPrice ? parseFloat(variationForm.offerPrice) : undefined;

    if (discPrice > price) {
      setUploadError("Discounted price cannot be greater than price");
      return;
    }

    const newVariation: any = {
      title: variationForm.title,
      value: variationForm.title,
      name: formData.variationType || "Variation",
      price,
      discPrice,
      stock,
      status: variationForm.status,
      barcode: variationForm.barcode,
      offerPrice,
    };

    setVariations([...variations, newVariation]);
    setVariationForm({
      title: "",
      price: "",
      discPrice: "0",
      stock: "0",
      status: "Available",
      barcode: "",
      offerPrice: "",
    });
    setUploadError("");
  };

  const removeVariation = (index: number) => {
    setVariations((prev) => prev.filter((_, i) => i !== index));
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
            // Show the detailed error message from the backend (which includes Google/Unsplash errors)
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
      if (!formData.headerCategory) {
        setUploadError("Please select a header category.");
        return;
      }
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
      let finalVariations = [...variations];
      if (finalVariations.length === 0) {
        if (variationForm.title && variationForm.price) {
          const price = parseFloat(variationForm.price);
          const discPrice = parseFloat(variationForm.discPrice || "0");
          const stock = parseInt(variationForm.stock || "0");

          if (discPrice <= price) {
            finalVariations.push({
              title: variationForm.title,
              price,
              discPrice,
              stock,
              status: variationForm.status,
            });
          } else {
            setUploadError("Discounted price cannot be greater than price in variation");
            setUploading(false);
            return;
          }
        } else {
          setUploadError("Please add at least one product variation");
          setUploading(false);
          return;
        }
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
            setGalleryImageFiles([]);
            setGalleryImagePreviews([]);
          }
          setSuccessMessage("");
          // Navigate to product list
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
      <div className="flex-1">
        <form onSubmit={handleSubmit} className="space-y-6">
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
          <div className="bg-white rounded-xl shadow-sm border border-neutral-200 p-6 space-y-6">

            {/* 1. Image Upload - Compact Square */}
            {/* 1. Image Upload Section */}
            <div>
                 <div className="flex flex-col gap-6">
                    {/* Main Image */}
                    <div className="flex flex-col items-center">
                        <span className="text-sm font-semibold text-neutral-700 mb-2">Main Image</span>
                        <label className="w-40 h-40 border-2 border-blue-500 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-blue-50 transition-colors relative overflow-hidden bg-white">
                            {mainImagePreview ? (
                                <img src={mainImagePreview} className="w-full h-full object-contain" alt="Main" />
                            ) : (
                                <>
                                    <svg className="w-10 h-10 text-blue-500 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                                    <span className="text-xs text-blue-600 font-bold">Upload Main</span>
                                </>
                            )}
                            <input type="file" accept="image/*" onChange={handleMainImageChange} className="hidden" />
                        </label>
                    </div>

                    {/* Gallery Images */}
                    <div className="flex flex-col items-start w-full">
                        <span className="text-sm font-semibold text-neutral-700 mb-2">Gallery Images (Max 6)</span>
                        <div className="flex flex-wrap gap-3">
                            {galleryImagePreviews.map((preview, index) => (
                                <div key={index} className="w-24 h-24 relative border border-gray-200 rounded-lg overflow-hidden group bg-white">
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
                                <label className="w-24 h-24 border-2 border-gray-300 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors text-gray-400 hover:text-blue-600">
                                    <span className="text-3xl font-light mb-1">+</span>
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
               <label className="block text-sm font-semibold text-neutral-700 mb-2">
                 Name <span className="text-red-500">*</span>
               </label>
               <input
                 type="text"
                 name="productName"
                 value={formData.productName}
                 onChange={handleChange}
                 className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
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
                           value={variationForm.discPrice}
                           onChange={(e) => setVariationForm({ ...variationForm, discPrice: e.target.value })}
                           className="w-full pl-7 pr-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                    </div>
                 </div>
                 <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-2">
                      Maximum Retail...
                    </label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                        <input
                           type="number"
                           value={variationForm.price}
                           onChange={(e) => setVariationForm({ ...variationForm, price: e.target.value })} // Setup Main Price
                           className="w-full pl-7 pr-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
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
                         className="w-full pl-7 pr-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                       />
                   </div>
                </div>
             )}
          </div>

          {/* Product Section Details */}
          <div className="bg-white rounded-xl shadow-sm border border-neutral-200">
            {/* Header Removed for Mobile Look */}
            {/* <div className="bg-teal-600 text-white px-6 py-4 rounded-t-xl">
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
                       className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all cursor-pointer bg-white"
                     />
                     <div className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
                     </div>
                   </div>
                </div>
                )}

                {shouldShowField('item_code') && (
                <div className="md:col-span-1">
                   <label className="block text-sm font-semibold text-neutral-700 mb-2">
                    Item Code (SKU)
                   </label>
                   <input
                     type="text"
                     name="itemCode"
                     value={(formData as any).itemCode}
                     onChange={handleChange}
                     placeholder="Enter Item Code / SKU"
                     className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                   />
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
                     className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                   />
                </div>
                )}

                {shouldShowField('header_category') && (
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
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
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
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
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
                  className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-none transition-all"
                />
              </div>
              )}
            </div>
          </div>

          {/* SEO Content Section */}
          {/* SEO Content Section */}
          <div className="bg-white rounded-xl shadow-sm border border-neutral-200">
            <div className="bg-teal-600 text-white px-6 py-4 rounded-t-xl">
              <h2 className="text-lg font-semibold tracking-wide">SEO Configuration</h2>
            </div>
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
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
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
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
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
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
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
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-none transition-all"
                  />
                </div>
                )}
              </div>
            </div>
          </div>

          {/* Add Variation Section */}
          <div className="bg-white rounded-xl shadow-sm border border-neutral-200">
            <div className="bg-teal-600 text-white px-6 py-4 rounded-t-xl">
              <h2 className="text-lg font-semibold tracking-wide">Product Variations</h2>
            </div>
            <div className="p-6 space-y-6 border-x border-b border-neutral-200 rounded-b-xl">
              <div>
                <label className="block text-sm font-semibold text-neutral-700 mb-2">
                  Variation Type
                </label>
                <div className="max-w-xs">
                  <ThemedDropdown
                    options={['Size', 'Weight', 'Color', 'Pack']}
                    value={formData.variationType}
                    onChange={(val) => setFormData(prev => ({ ...prev, variationType: val }))}
                    placeholder="Select Variation Type"
                  />
                </div>
              </div>

              {/* Variation Form */}
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
                  {shouldShowField('online_offer_price') && (
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

              {/* Variations List */}
              {variations.length > 0 && (
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
              )}
            </div>
          </div>

          {/* Add Other Details Section */}
          <div className="bg-white rounded-xl shadow-sm border border-neutral-200">
            <div className="bg-teal-600 text-white px-6 py-4 rounded-t-xl">
              <h2 className="text-lg font-semibold tracking-wide">Additional Details</h2>
            </div>
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
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
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
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
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
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
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
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
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
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
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
                    className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
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
                     className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
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
                     className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
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
                     className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                   />
                </div>
                )}
                {shouldShowField('barcode') && (
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
                )}
              </div>
            </div>
          </div>

          {/* Print Barcodes Section */}
          <div className="bg-white rounded-xl shadow-sm border border-neutral-200">
            <div className="bg-teal-600 text-white px-6 py-4 rounded-t-xl">
              <h2 className="text-lg font-semibold tracking-wide">Print Barcodes</h2>
            </div>
            <div className="p-6 border-x border-b border-neutral-200 rounded-b-xl">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                <div>
                   <label className="block text-sm font-semibold text-neutral-700 mb-2">Quantity</label>
                   <input
                      type="number"
                      value={printQuantity}
                      onChange={(e) => setPrintQuantity(e.target.value)}
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-teal-500/20 shadow-sm"
                      placeholder="Enter Quantity"
                   />
                </div>
                <div>
                    <label className="block text-sm font-semibold text-neutral-700 mb-2">Select Barcode</label>
                    <div className="relative">
                        <select
                            className="w-full px-4 py-2 border border-neutral-300 rounded-lg appearance-none bg-white focus:ring-2 focus:ring-teal-500/20 shadow-sm pr-10 cursor-pointer"
                            value={selectedPrintBarcode}
                            onChange={(e) => {
                                const val = e.target.value;
                                setSelectedPrintBarcode(val);
                                if(val) {
                                    // Find variation for name/price
                                    const v = variations.find(v => v.barcode === val);
                                    handlePrintBarcode(val, parseInt(printQuantity), formData.productName + (v ? ' - ' + v.title : ''), v?.price, v?.price);
                                }
                            }}
                        >
                            <option value="">Select a Barcode</option>
                            {(formData as any).barcode && <option value={(formData as any).barcode}>Product: {(formData as any).barcode}</option>}
                            {variations.map((v, i) => v.barcode && (
                                <option key={i} value={v.barcode}>Var: {v.title} ({v.barcode})</option>
                            ))}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-400">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                    </div>
                </div>
                <div className="text-sm text-neutral-500 italic bg-teal-50 p-3 rounded-lg border border-teal-100 flex items-center gap-2">
                    <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    * Select a barcode to immediately open the print preview.
                </div>
              </div>
            </div>
          </div>

          {/* AI Image Search Section (New) - Only for New Products */}
          {!id && (
            <div className="bg-white rounded-lg shadow-sm border border-neutral-200">
                <div className="bg-purple-600 text-white px-4 sm:px-6 py-3 rounded-t-lg flex justify-between items-center">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 00-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
                      Live Image Search
                    </h2>
                    <span className="text-xs bg-white/20 px-2 py-0.5 rounded">AI Powered</span>
                </div>
                <div className="p-4 sm:p-6 space-y-4">
                    <div className="flex gap-2">
                         <input
                            type="text"
                            value={imageSearchQuery}
                            onChange={(e) => setImageSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleImageSearch())}
                            placeholder="e.g. Vaseline 200ml, Dove Soap"
                            className="flex-1 px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                         />
                         <button
                            type="button"
                            onClick={handleImageSearch}
                            disabled={isSearchingImage}
                            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-70 flex items-center gap-2"
                         >
                             {isSearchingImage ? (
                                 <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                             ) : (
                                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                             )}
                             Search
                         </button>
                    </div>

                    {searchedImage && (
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 flex flex-col sm:flex-row gap-4 items-center">
                            <img src={searchedImage} alt="Analysis Result" className="w-24 h-24 object-cover rounded bg-white border border-gray-200" />
                            <div className="flex-1 text-center sm:text-left">
                                <h4 className="font-medium text-gray-800">Image Found</h4>
                                <p className="text-sm text-gray-500">Web Search Result</p>
                            </div>
                            <button
                                type="button"
                                onClick={applySearchedImage}
                                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                                Use this Image
                            </button>
                        </div>
                    )}
                </div>
            </div>
          )}



          {/* Shop by Store Section */}
          {shouldShowField('shop_by_store_only') && (
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
          </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end pb-6">
            <button
              type="submit"
              disabled={uploading || !isEnabled}
              className={`px-8 py-3 rounded-lg font-medium text-lg transition-colors shadow-sm ${
                uploading || !isEnabled
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
    </div>
  );
}
