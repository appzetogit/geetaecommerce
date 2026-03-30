import React, { useState, useEffect, useMemo, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import {
  Product,
  Category,
  getProducts,
  updateProduct,
  createProduct,
  deleteProduct as deleteAdminProduct,
  uploadImage,
  getSubCategories,
  getBrands,
  SubCategory,
  Brand,
} from "../../../services/api/admin/adminProductService";
import { getAttributes } from "../../../services/api/admin/attributeService";
import AttributeDropdown from "../../../components/AttributeDropdown";
import VariationEditor from "../../../components/VariationEditor";
import VariationDropdown from "../../../components/VariationDropdown";

interface AdminStockBulkEditProps {
  products: Product[];
  categories: Category[];
  initialPage?: number;
  initialLimit?: number;
  onClose: () => void;
  onSave: () => void;
}

interface ProductImage {
  id: string;
  url: string;
  file?: File;
}

// Simple Modal for editing pricing slabs
const PricingSlabsModal = ({ slabs, onClose, onSave }: { slabs: {minQty: number, price: number}[], onClose: () => void, onSave: (newSlabs: any[]) => void }) => {
    const [localSlabs, setSlabs] = useState(slabs.length ? slabs : [{ minQty: 1, price: 0 }]);

    const handleChange = (index: number, field: string, val: string) => {
        const newSlabs = [...localSlabs];
        newSlabs[index] = { ...newSlabs[index], [field]: Number(val) };
        setSlabs(newSlabs);
    };

    const addSlab = () => setSlabs([...localSlabs, { minQty: 0, price: 0 }]);
    const removeSlab = (idx: number) => setSlabs(localSlabs.filter((_, i) => i !== idx));

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
            <div className="bg-white p-6 rounded shadow-lg w-96 z-[70]">
                <h3 className="text-lg font-bold mb-4">Set Unit Pricing</h3>
                <div className="max-h-64 overflow-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-gray-600">
                                <th className="p-1">Min Qty</th>
                                <th className="p-1">Price/Unit</th>
                                <th className="p-1"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {localSlabs.map((slab, i) => (
                                <tr key={i} className="border-b">
                                    <td className="p-1"><input type="number" className="border w-20 p-1 rounded" value={slab.minQty} onChange={e => handleChange(i, 'minQty', e.target.value)} /></td>
                                    <td className="p-1">
                                        <div className="relative">
                                            <span className="absolute left-1 top-1 text-gray-400">₹</span>
                                            <input type="number" className="border w-24 p-1 pl-4 rounded" value={slab.price} onChange={e => handleChange(i, 'price', e.target.value)} />
                                        </div>
                                    </td>
                                    <td className="p-1 text-red-500 cursor-pointer font-bold px-2" onClick={() => removeSlab(i)}>✕</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <button onClick={addSlab} className="mt-3 text-[#f187b5] font-bold text-sm flex items-center gap-1">
                    <span className="text-lg">+</span> Add Slab
                </button>
                <div className="mt-6 flex justify-end gap-2">
                    <button onClick={onClose} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-sm text-gray-700 font-medium transition-colors">Cancel</button>
                    <button onClick={() => { onSave(localSlabs.filter(s => s.minQty > 0)); onClose(); }} className="px-3 py-1.5 bg-[#f187b5] hover:bg-[#e076a5] text-white rounded text-sm font-medium transition-colors">Save Rules</button>
                </div>
            </div>
        </div>
    );
};

interface EditableProduct {
  id: string;
  original: Product;
  productName: string;
  categoryId: string;
  compareAtPrice: number;
  price: number;
  stock: number;
  publish: boolean;
  images: ProductImage[];
  isChanged: boolean;
  // New fields
  itemCode: string; // SKU
  rackNumber: string;
  description: string;
  barcode: string[];
  hsnCode: string;
  pack: string; // Unit
  purchasePrice: number;
  mfgDate: string;
  expiryDate: string;
  weight: string;
  deliveryTime: string;
  lowStockQuantity: number;
  subCategoryId?: string; // Add this
  wholesalePrice: number;
  // Read-only/Display fields (not editable in bulk edit for now or just text)
  subSubCategory: string;
  brand: string; // Display name
  brandId: string; // ID for editing
  tax: string;
  offerPrice: number;
  unitPricing: { minQty: number; price: number }[]; // Add this
  attributes: string[];
  variations: any[];
  variationName: string;
  isNew?: boolean;
}

export default function AdminStockBulkEdit({
  products,
  categories,
  initialPage = 1,
  initialLimit = 10,
  onClose,
  onSave,
}: AdminStockBulkEditProps) {
  const [editableProducts, setEditableProducts] = useState<EditableProduct[]>([]);
  const [page, setPage] = useState(initialPage);
  const [pageLimit, setPageLimit] = useState(initialLimit);
  const [serverPagination, setServerPagination] = useState<
    { page: number; limit: number; total: number; pages: number } | null
  >(null);
  const [pageLoading, setPageLoading] = useState(false);
  const editedCacheRef = useRef<Map<string, EditableProduct>>(new Map());
  const [changesVersion, setChangesVersion] = useState(0);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [productNameSearch, setProductNameSearch] = useState("");
  const [activePricingModalIndex, setActivePricingModalIndex] = useState<number | null>(null); // For modal

  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [availableAttributes, setAvailableAttributes] = useState<{_id: string, name: string}[]>([]);
  const [activeVariationModalIndex, setActiveVariationModalIndex] = useState<number | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanIndex, setScanIndex] = useState<number | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [showSearchScanner, setShowSearchScanner] = useState(false);
  const [searchScannerKey, setSearchScannerKey] = useState(0);
  const searchScannerRef = useRef<Html5Qrcode | null>(null);
  const lastSearchScanRef = useRef<{ code: string; time: number }>({ code: "", time: 0 });

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
    return () => clearTimeout(handle);
  }, [searchTerm]);

  const stopSearchScanning = async () => {
    try {
      if (searchScannerRef.current) {
        const scanner = searchScannerRef.current;
        if (scanner.isScanning) {
          await scanner.stop();
        }
        scanner.clear();
        searchScannerRef.current = null;
      }
    } catch (e) {
      console.warn("Search scanner stop error", e);
    } finally {
      setShowSearchScanner(false);
    }
  };

  const onSearchScanSuccess = (decodedText: string) => {
    const cleaned = (decodedText || "").trim();
    if (!cleaned) return;

    const now = Date.now();
    if (cleaned === lastSearchScanRef.current.code && now - lastSearchScanRef.current.time < 2000) {
      return;
    }
    lastSearchScanRef.current = { code: cleaned, time: now };

    setSearchTerm(cleaned);
    setPage(1);
    void stopSearchScanning();
  };

  useEffect(() => {
    const startScanner = async () => {
      if (!showSearchScanner) return;

      await new Promise((r) => setTimeout(r, 300));
      const readerId = `bulk-search-reader-${searchScannerKey}`;
      const element = document.getElementById(readerId);
      if (!element) return;

      try {
        if (searchScannerRef.current) {
          try {
            if (searchScannerRef.current.isScanning) {
              await searchScannerRef.current.stop();
            }
            searchScannerRef.current.clear();
          } catch (e) {
            console.warn("Search scanner cleanup error", e);
          }
        }

        const scanner = new Html5Qrcode(readerId);
        searchScannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
          onSearchScanSuccess,
          () => {}
        );
      } catch (err) {
        console.error("Search scanner error:", err);
        alert("Failed to start camera. Please check permissions.");
        setShowSearchScanner(false);
      }
    };

    if (showSearchScanner) {
      void startScanner();
    }

    return () => {
      if (searchScannerRef.current) {
        const scanner = searchScannerRef.current;
        if (scanner.isScanning) {
          scanner.stop().then(() => scanner.clear()).catch(console.error);
        }
      }
    };
  }, [showSearchScanner, searchScannerKey]);

  const upsertEditedCache = (p: EditableProduct) => {
    if (!p.id) return;
    if (p.isChanged || p.isNew) {
      editedCacheRef.current.set(p.id, p);
      setChangesVersion((v) => v + 1);
    }
  };

  const fetchPage = async (nextPage: number, nextLimit: number) => {
    setPageLoading(true);
    try {
      const res = await getProducts({
        ...(debouncedSearchTerm ? { search: debouncedSearchTerm } : {}),
        page: nextPage,
        limit: nextLimit,
      } as any);

      if (!res.success) {
        alert((res as any)?.message || "Failed to load products");
        return;
      }

      const pagination = ((res as any)?.pagination as
        | { page?: number; limit?: number; total?: number; pages?: number }
        | undefined) || { page: nextPage, limit: nextLimit, total: 0, pages: 1 };

      setServerPagination({
        page: Number(pagination.page ?? nextPage),
        limit: Number(pagination.limit ?? nextLimit),
        total: Number(pagination.total ?? 0),
        pages: Number(pagination.pages ?? 1),
      });

      setEditableProducts((prev) => {
        const newRows = prev.filter((x) => x.isNew);
        const initialized = (res.data || []).map((p: any) => {
          const cached = editedCacheRef.current.get(p._id);
          if (cached) return { ...cached, original: cached.original || p };
          // Reuse existing initializer by stashing into cache temporarily via same shape.
          return {
            id: p._id,
            original: p,
            productName: p.productName,
            categoryId:
              typeof p.category === "object" && p.category ? p.category._id : p.category || "",
            compareAtPrice: p.compareAtPrice || 0,
            price: p.price,
             stock: p.stock,
             publish: p.publish,
            images: [
              ...(p.mainImage
                ? [{ id: `main-${p._id}`, url: p.mainImage }]
                : []),
              ...((p.galleryImages || []).map((url: string, i: number) => ({
                id: `gal-${p._id}-${i}`,
                url,
              }))),
            ],
             isChanged: false,
            itemCode: (p as any).itemCode || p.sku || "",
            rackNumber: (p as any).rackNumber || "",
            description: p.smallDescription || p.description || "",
            barcode: Array.isArray((p as any).barcode)
              ? (p as any).barcode
              : (p as any).barcode
                ? [(p as any).barcode]
                : [],
            hsnCode: (p as any).hsnCode || "",
            pack: (p as any).pack || "",
            purchasePrice: (p as any).purchasePrice || 0,
            mfgDate: (p as any).mfgDate || "",
            expiryDate: (p as any).expiryDate || "",
            weight: (p as any).weight || "",
            deliveryTime: (p as any).deliveryTime || "",
            lowStockQuantity: (p as any).lowStockQuantity || 5,
            wholesalePrice: (p as any).wholesalePrice || 0,
            subSubCategory: (p as any).subSubCategory || "",
            subCategoryId:
              typeof (p as any).subcategory === "object" && (p as any).subcategory
                ? (p as any).subcategory._id
                : (p as any).subcategory || "",
            brand: typeof p.brand === "object" ? (p.brand as any).name : "-",
            brandId:
              typeof p.brand === "object" && p.brand ? (p.brand as any)._id : p.brand || "",
            tax: p.tax || "",
            offerPrice: p.discPrice || 0,
            unitPricing:
              p.unitPricing && p.unitPricing.length > 0
                ? p.unitPricing
                : [{ minQty: 1, price: 0 }],
            attributes: [],
            variations: p.variations || [],
            variationName: (p as any).variationName || "",
            isNew: false,
          } as EditableProduct;
        });
        return [...newRows, ...initialized];
      });

      setPage(nextPage);
      setPageLimit(nextLimit);
    } catch (e: any) {
      console.error("Bulk edit fetch failed", e);
      alert(e?.response?.data?.message || e?.message || "Failed to load products");
    } finally {
      setPageLoading(false);
    }
  };

  useEffect(() => {
    void fetchPage(page, pageLimit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageLimit, debouncedSearchTerm]);

  const createEmptyProduct = (): EditableProduct => ({
    id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    original: {} as Product,
    productName: "",
    categoryId: "",
    compareAtPrice: 0,
    price: 0,
    stock: 0,
    publish: false,
    images: [],
    isChanged: false,
    itemCode: "",
    rackNumber: "",
    description: "",
    barcode: [],
    hsnCode: "",
    pack: "",
    purchasePrice: 0,
    mfgDate: "",
    expiryDate: "",
    weight: "",
    deliveryTime: "",
    lowStockQuantity: 5,
    subCategoryId: "",
    wholesalePrice: 0,
    subSubCategory: "",
    brand: "-",
    brandId: "",
    tax: "",
    offerPrice: 0,
    unitPricing: [{ minQty: 1, price: 0 }],
    attributes: [],
    variations: [],
    variationName: "",
    isNew: true,
  });

  const startScanning = (index: number) => {
    setIsScanning(true);
    setScanIndex(index);
    setTimeout(() => {
        const scanner = new Html5Qrcode("bulk-barcode-reader");
        scannerRef.current = scanner;
        scanner.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            (decodedText) => {
                if (index !== null) {
                    const currentBarcodes = editableProducts[index].barcode || [];
                    if (!currentBarcodes.includes(decodedText)) {
                        handleFieldChange(index, 'barcode', [...currentBarcodes, decodedText]);
                    }
                }
                stopScanning();
            },
            () => {}
        ).catch(err => {
            console.error(err);
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
            console.error(err);
            setIsScanning(false);
        });
    } else {
        setIsScanning(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
        try {
            const [subRes, brandRes, attrRes] = await Promise.all([
                getSubCategories({ limit: 1000 } as any),
                getBrands(),
                getAttributes()
            ]);
            if(subRes.success && subRes.data) setSubCategories(subRes.data);
            if(brandRes.success && brandRes.data) setBrands(brandRes.data);
            if(attrRes) setAvailableAttributes((attrRes as any).data || attrRes);
        } catch (e) {
            console.error("Failed to load metadata for bulk edit", e);
        }
    };
    fetchData();
  }, []);

  // Initialize editable products
  useEffect(() => {
    if (serverPagination) return;
    const initialized = products.map((p: any) => {
      const cached = editedCacheRef.current.get(p._id);
      if (cached) return { ...cached, original: cached.original || p };
      let categoryId = "";
      if (p.category) {
         if (typeof p.category === "object" && p.category !== null) {
           categoryId = p.category._id || "";
         } else if (typeof p.category === "string") {
          categoryId = p.category;
        }
      }

      let subCategoryId = "";
      if (p.subcategory) {
          if (typeof p.subcategory === 'object' && p.subcategory !== null) {
              subCategoryId = p.subcategory._id;
          } else if (typeof p.subcategory === 'string') {
              subCategoryId = p.subcategory;
          }
      }

      let brandId = "";
      if (p.brand) {
          if (typeof p.brand === 'object' && p.brand !== null) {
              brandId = p.brand._id;
          } else if (typeof p.brand === 'string') {
              brandId = p.brand;
          }
      }

      const images: ProductImage[] = [];
      if (p.mainImage) {
        images.push({ id: `main-${p._id}`, url: p.mainImage });
      }
      if (p.galleryImages && p.galleryImages.length > 0) {
        p.galleryImages.forEach((url, i) => {
           images.push({ id: `gal-${p._id}-${i}`, url });
        });
      }

      return {
        id: p._id,
        original: p,
        productName: p.productName,
        categoryId: categoryId,
        compareAtPrice: p.compareAtPrice || 0,
        price: p.price,
        stock: p.stock,
        publish: p.publish,
        // New fields initialization
        itemCode: (p as any).itemCode || p.sku || "",
        rackNumber: (p as any).rackNumber || "",
        description: p.smallDescription || p.description || "",
        barcode: Array.isArray((p as any).barcode) ? (p as any).barcode : (p as any).barcode ? [(p as any).barcode] : [],
        hsnCode: (p as any).hsnCode || "",
        pack: (p as any).pack || "",
        purchasePrice: (p as any).purchasePrice || 0,
        mfgDate: (p as any).mfgDate || "",
        expiryDate: (p as any).expiryDate || "",
        weight: (p as any).weight || "",
        deliveryTime: (p as any).deliveryTime || "",
        lowStockQuantity: (p as any).lowStockQuantity || 5,
        wholesalePrice: (p as any).wholesalePrice || 0,
        subSubCategory: (p as any).subSubCategory || "",
        subCategoryId: subCategoryId, // Add this
        brand: typeof p.brand === "object" ? (p.brand as any).name : "-",
        brandId: brandId,
        tax: p.tax || "",
        offerPrice: p.discPrice || 0,
        unitPricing: p.unitPricing && p.unitPricing.length > 0 ? p.unitPricing : [{ minQty: 1, price: 0 }], // Initialize
        images: images,
        isChanged: false,
        attributes: [],
        variations: p.variations || [],
        variationName: (p as any).variationName || "",
        isNew: false,
      };
    });
    setEditableProducts((prev) => [...prev.filter((x) => x.isNew), ...initialized]);
  }, [products, serverPagination]);

  const handleFieldChange = (
    index: number,
    field: keyof EditableProduct,
    value: any
  ) => {
    setEditableProducts((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value, isChanged: true };
      upsertEditedCache(updated[index]);
      return updated;
    });
  };

  const handleImageChange = (index: number, files: FileList | null) => {
      if (!files || files.length === 0) return;

      const newImages: ProductImage[] = Array.from(files).map((f) => ({
        id: URL.createObjectURL(f),
        url: URL.createObjectURL(f),
        file: f,
      }));

      setEditableProducts((prev) => {
          const updated = [...prev];
          const currentProduct = updated[index];

          updated[index] = {
              ...currentProduct,
              images: [...currentProduct.images, ...newImages],
              isChanged: true
          };
          upsertEditedCache(updated[index]);

          return updated;
      });
  };

  const handleRemoveImage = (productIndex: number, imageId: string) => {
    setEditableProducts((prev) => {
      const updated = [...prev];
      const currentProduct = updated[productIndex];

      updated[productIndex] = {
        ...currentProduct,
        images: currentProduct.images.filter((img) => img.id !== imageId),
        isChanged: true,
      };
      upsertEditedCache(updated[productIndex]);

      return updated;
    });
  };

  const handleSave = async () => {
    const allEdited = Array.from(editedCacheRef.current.values());
    const changedExisting = allEdited.filter((p) => p.isChanged && !p.isNew);
    const newProducts = allEdited.filter((p) => p.isNew && p.isChanged);

    if (changedExisting.length === 0 && newProducts.length === 0) {
      onClose();
      return;
    }

    const invalidNew = newProducts.filter(
      (p) => !p.productName.trim() || !p.categoryId
    );
    if (invalidNew.length > 0) {
      alert("Please fill Product Name and Category for new rows before saving.");
      return;
    }

    setSaving(true);
    try {
      const updatePromises = changedExisting.map(async (p) => {
        const finalImages: string[] = [];

        // Upload new images and collect all URLs
        for (const img of p.images) {
          if (img.file) {
            try {
              const uploadRes = await uploadImage(img.file);
              if (uploadRes.success) {
                finalImages.push(uploadRes.data.url);
              }
            } catch (err) {
              console.error("Failed to upload image", err);
            }
          } else {
            finalImages.push(img.url);
          }
        }

        const mainImage = finalImages.length > 0 ? finalImages[0] : "";
        const galleryImages = finalImages.length > 1 ? finalImages.slice(1) : [];

        return updateProduct(p.id, {
          productName: p.productName,
          category: p.categoryId,
          compareAtPrice: p.compareAtPrice,
          price: p.price,
          stock: p.stock,
          publish: p.publish,
          mainImage: mainImage,
          galleryImages: galleryImages,
          sku: p.itemCode || null,
          // itemCode: p.itemCode, // Commenting out to avoid duplication issues if backend doesn't expect it
          rackNumber: p.rackNumber,
          smallDescription: p.description,
          description: p.description,
          barcode: p.barcode,
          hsnCode: p.hsnCode,
          pack: p.pack,
          purchasePrice: p.purchasePrice,
          mfgDate: p.mfgDate || undefined,
          expiryDate: p.expiryDate || undefined,
          weight: p.weight || undefined,
          deliveryTime: p.deliveryTime,
          lowStockQuantity: p.lowStockQuantity,
          discPrice: p.offerPrice,
          wholesalePrice: p.wholesalePrice,
          // Conditionally add relations if they exist
          // ...(p.tax ? { tax: p.tax } : {}), // Exclude tax because it causes CastError (text input vs ObjectId)
          ...(p.subCategoryId ? { subcategory: p.subCategoryId } : {}),
          ...(p.subSubCategory ? { subSubCategory: p.subSubCategory } : {}),
          ...(p.brandId ? { brand: p.brandId } : {}),
          ...(p.brandId ? { brand: p.brandId } : {}),
           variations: p.variations.map((v: any) => ({
             ...v,
             discPrice: v.offerPrice || v.discPrice || p.offerPrice
           })),
          unitPricing: p.unitPricing, // Include unitPricing in payload
          variationName: p.variationName,
        } as any);
      });

      const createPromises = newProducts.map(async (p) => {
        const finalImages: string[] = [];

        for (const img of p.images) {
          if (img.file) {
            try {
              const uploadRes = await uploadImage(img.file);
              if (uploadRes.success) {
                finalImages.push(uploadRes.data.url);
              }
            } catch (err) {
              console.error("Failed to upload image", err);
            }
          } else {
            finalImages.push(img.url);
          }
        }

        const mainImage = finalImages.length > 0 ? finalImages[0] : "";
        const galleryImages = finalImages.length > 1 ? finalImages.slice(1) : [];

        return createProduct({
          productName: p.productName || "Untitled",
          category: p.categoryId || undefined,
          subcategory: p.subCategoryId || undefined,
          subSubCategory: p.subSubCategory || undefined,
          brand: p.brandId || undefined,
          publish: p.publish,
          popular: false,
          dealOfDay: false,
          price: p.price,
          compareAtPrice: p.compareAtPrice,
          stock: p.stock,
          discPrice: p.offerPrice,
          wholesalePrice: p.wholesalePrice,
          mainImage: mainImage || undefined,
          galleryImages: galleryImages.length ? galleryImages : undefined,
          sku: p.itemCode || undefined,
          rackNumber: p.rackNumber || undefined,
          smallDescription: p.description || undefined,
          description: p.description || undefined,
          barcode: p.barcode,
          hsnCode: p.hsnCode || undefined,
          pack: p.pack || undefined,
          purchasePrice: p.purchasePrice || undefined,
          deliveryTime: p.deliveryTime || undefined,
          weight: p.weight || undefined,
          mfgDate: p.mfgDate || undefined,
          expiryDate: p.expiryDate || undefined,
          lowStockQuantity: p.lowStockQuantity,
          unitPricing: p.unitPricing,
          ...(p.variationName ? { variationName: p.variationName } : {}),
          ...(p.variations && p.variations.length > 0
            ? {
                variations: p.variations.map((v: any) => ({
                  ...v,
                  discPrice: v.offerPrice || v.discPrice || p.offerPrice,
                })),
              }
            : {}),
        } as any);
      });

      await Promise.all([...updatePromises, ...createPromises]);
      editedCacheRef.current.clear();
      setChangesVersion(0);
      onSave(); // Trigger refresh in parent
      onClose();
    } catch (error: any) {
      console.error("Failed to save bulk edits", error);
      alert(`Failed to save changes: ${error.response?.data?.message || error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const [categorySearch, setCategorySearch] = useState("");
  const [columnSearch, setColumnSearch] = useState<Record<string, string>>({});

  // Column Resizing Logic
  // Column filtering logic
  const filteredProducts = useMemo(() => {
    const getColumnText = (key: string, p: EditableProduct) => {
      switch (key) {
        case "category":
          return categories.find(c => c._id === p.categoryId)?.name || "";
        case "subCategory":
          return subCategories.find(sc => sc._id === (p.subCategoryId || ""))?.name || "";
        case "brand": {
          const brandName =
            brands.find(b => b._id === (p.brandId || ""))?.name ||
            p.brand ||
            "";
          return brandName;
        }
        case "status":
          return p.publish ? "Active" : "Inactive";
        case "barcode":
          return Array.isArray(p.barcode) ? p.barcode.join(",") : String((p as any).barcode || "");
        case "attributes":
          return Array.isArray(p.attributes) ? p.attributes.join(",") : "";
        case "variations":
          return Array.isArray(p.variations) ? String(p.variations.length) : "";
        case "valMrp":
          return String((p.compareAtPrice || 0) * (p.stock || 0));
        case "valPur":
          return String((p.purchasePrice || 0) * (p.stock || 0));
        case "unitPrice":
          return Array.isArray(p.unitPricing) ? p.unitPricing.map(s => `${s.minQty}:${s.price}`).join(",") : "";
        default: {
          const val = (p as any)[key] ?? (p.original as any)?.[key];
          if (val === null || val === undefined) return "";
          if (Array.isArray(val)) return val.join(",");
          if (typeof val === "object") return JSON.stringify(val);
          return String(val);
        }
      }
    };

    const norm = (v: string) => v.toLowerCase();
    const term = norm(searchTerm);
    const productTerm = norm(productNameSearch);
    const catTerm = norm(categorySearch);
    const extraFilters = Object.entries(columnSearch).filter(([, v]) => v.trim() !== "");

    return editableProducts.filter(p => {
      if (p.isNew) return true;

      const barcodeMatch = norm(getColumnText("barcode", p)).includes(term);
      const nameMatch = norm(p.productName).includes(term) || barcodeMatch;
      const colProductNameMatch = norm(p.productName).includes(productTerm);

      // Resolve category name for filtering
      const catName = categories.find(c => c._id === p.categoryId)?.name || "";
      const catMatch = norm(catName).includes(catTerm);

      const extraMatch = extraFilters.every(([key, value]) => {
        if (key === "productName" || key === "category") return true;
        const cell = norm(getColumnText(key, p));
        return cell.includes(norm(value));
      });

      return nameMatch && colProductNameMatch && catMatch && extraMatch;
    });
  }, [editableProducts, searchTerm, productNameSearch, categorySearch, columnSearch, categories, subCategories, brands]);

  // Column Resizing Logic

  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [activeMenuColumn, setActiveMenuColumn] = useState<string | null>(null);

  const DEFAULT_COLUMN_ORDER: string[] = [
    "index",
    "image",
    "productName",
    "category",
    "subCategory",
    "subSubCategory",
    "attributes",
    "variations",
    "variationName",
    "sku",
    "rackNumber",
    "description",
    "barcode",
    "hsnCode",
    "pack",
    "size",
    "color",
    "tax",
    "gst",
    "purchasePrice",
    "mfgDate",
    "expiryDate",
    "weight",
    "compareAtPrice",
    "price",
    "deliveryTime",
    "stock",
    "offerPrice",
    "wholesalePrice",
    "lowStockQuantity",
    "brand",
    "valMrp",
    "valPur",
    "unitPrice",
    "status",
  ];

  const PRIORITY_FIRST_COLUMNS: string[] = [
    "image",
    "productName",
    "compareAtPrice", // MRP
    "price", // SP
    "purchasePrice", // PP
    "stock",
    "barcode",
    "category",
    "subCategory",
    "subSubCategory",
    "pack", // Unit
    "deliveryTime",
    "weight", // Item weight
  ];

  const createInitialColumnOrder = () => {
    const base = DEFAULT_COLUMN_ORDER;
    const seen = new Set<string>();
    const ordered: string[] = [];

    if (base.includes("index")) {
      ordered.push("index");
      seen.add("index");
    }

    for (const key of PRIORITY_FIRST_COLUMNS) {
      if (base.includes(key) && !seen.has(key)) {
        ordered.push(key);
        seen.add(key);
      }
    }

    for (const key of base) {
      if (!seen.has(key)) {
        ordered.push(key);
        seen.add(key);
      }
    }

    return ordered;
  };

  const [columnOrder, setColumnOrder] = useState<string[]>(createInitialColumnOrder);
  const [draggedCol, setDraggedCol] = useState<string | null>(null);

  const COLUMN_LABELS: Record<string, string> = {
    index: "#",
    image: "Image",
    productName: "4. Product Name",
    category: "1. Category",
    subCategory: "2. Sub Cat",
    subSubCategory: "3. Sub Sub Cat",
    sku: "5. SKU",
    rackNumber: "6. Rack",
    description: "7. Desc",
    barcode: "8. Barcode",
    hsnCode: "9. HSN",
    pack: "10. Unit",
    size: "11. Size",
    color: "12. Color",
    tax: "13. Tax Cat",
    gst: "14. GST",
    purchasePrice: "15. Pur. Price",
    mfgDate: "16. Mfg Date",
    expiryDate: "17. Expiry Date",
    weight: "18. Weight",
    compareAtPrice: "19. MRP",
    price: "20. Sell Price",
    deliveryTime: "21. Del. Time",
    stock: "22. Stock",
    offerPrice: "23. Offer Price",
    wholesalePrice: "24. Wholesale Price",
    lowStockQuantity: "25. Low Stock",
    brand: "26. Brand",
    valMrp: "27. Val (MRP)",
    valPur: "28. Val (Pur)",
    unitPrice: "29. Unit Pricing Rules", // Rename
    attributes: "Attributes",
    variations: "Variations",
    variationName: "Variation Name",
    status: "Status"
  };

  const handleHideColumn = (columnKey: string) => {
    setHiddenColumns((prev) => [...prev, columnKey]);
    setActiveMenuColumn(null);
  };

  const handleDragStart = (e: React.DragEvent, key: string) => {
    setDraggedCol(key);
    e.dataTransfer.effectAllowed = "move";
    // Set a transparent drag image if desired, or let browser handle it
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetKey: string) => {
    e.preventDefault();
    if (!draggedCol || draggedCol === targetKey) return;

    const newOrder = [...columnOrder];
    const dragIndex = newOrder.indexOf(draggedCol);
    const dropIndex = newOrder.indexOf(targetKey);

    if (dragIndex > -1 && dropIndex > -1) {
      newOrder.splice(dragIndex, 1);
      newOrder.splice(dropIndex, 0, draggedCol);
      setColumnOrder(newOrder);
    }
    setDraggedCol(null);
  };

  const renderHeader = (key: string) => {
    if (hiddenColumns.includes(key)) return null;

    let content: React.ReactNode = COLUMN_LABELS[key];
    if (key === "category") {
      content = (
        <div className="flex flex-col gap-2 w-full">
          <span>{COLUMN_LABELS[key]}</span>
          <input
            type="text"
            placeholder="Search..."
            className="w-full text-[11px] px-2 py-1 border border-gray-300 rounded font-normal focus:ring-1 focus:ring-[#f187b5] focus:outline-none"
            value={categorySearch}
            onChange={(e) => setCategorySearch(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()} // Prevent focus loss on drag start
          />
        </div>
      );
    }

    if (key === "productName") {
      content = (
        <div className="flex flex-col gap-2 w-full">
          <span>{COLUMN_LABELS[key]}</span>
          <input
            type="text"
            placeholder="Search..."
            className="w-full text-[11px] px-2 py-1 border border-gray-300 rounded font-normal focus:ring-1 focus:ring-[#f187b5] focus:outline-none"
            value={productNameSearch}
            onChange={(e) => setProductNameSearch(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()} // Prevent focus loss on drag start
          />
        </div>
      );
    }

    const searchable = key !== "index" && key !== "image";
    if (searchable && key !== "category" && key !== "productName") {
      content = (
        <div className="flex flex-col gap-2 w-full">
          <span>{COLUMN_LABELS[key]}</span>
          <input
            type="text"
            placeholder="Search..."
            className="w-full text-[11px] px-2 py-1 border border-gray-300 rounded font-normal focus:ring-1 focus:ring-[#f187b5] focus:outline-none"
            value={columnSearch[key] || ""}
            onChange={(e) => setColumnSearch((prev) => ({ ...prev, [key]: e.target.value }))}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()} // Prevent focus loss on drag start
          />
        </div>
      );
    }

    return (
      <th
        key={key}
        draggable
        onDragStart={(e) => handleDragStart(e, key)}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, key)}
        className={`p-3 border-b border-r border-neutral-300 text-xs font-bold text-neutral-700 relative whitespace-nowrap group bg-neutral-100 align-top cursor-move transition-opacity ${draggedCol === key ? "opacity-50" : ""}`}
        style={{ width: columnWidths[key] }}
      >
        <div className="flex items-start justify-between gap-1 w-full h-full">
          <div className="flex-1 overflow-hidden text-center">{content}</div>
          <div className="sm:hidden flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                adjustColumnWidth(key, -60);
              }}
              className="p-1 rounded bg-white/70 border border-neutral-200 text-neutral-600 active:scale-95"
              title="Narrow column"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                adjustColumnWidth(key, 60);
              }}
              className="p-1 rounded bg-white/70 border border-neutral-200 text-neutral-600 active:scale-95"
              title="Widen column"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setActiveMenuColumn(activeMenuColumn === key ? null : key);
            }}
            className="p-1 hover:bg-gray-200 rounded opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
        </div>
        {activeMenuColumn === key && (
          <div className="absolute right-0 top-8 bg-white shadow-lg border border-neutral-200 rounded z-50 w-32 py-1 cursor-default" onMouseDown={e => e.stopPropagation()}>
            <button
              className="w-full text-left px-3 py-2 hover:bg-gray-50 text-xs text-gray-700"
              onClick={() => handleHideColumn(key)}
            >
              Hide column
            </button>
          </div>
        )}
        <ResizeHandle columnKey={key} />
      </th>
    );
  };

  const allFilteredSelected =
    filteredProducts.length > 0 &&
    filteredProducts.every((p) => selectedProductIds.has(p.id));

  const toggleSelectProduct = (productId: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredProducts.forEach((p) => next.delete(p.id));
      } else {
        filteredProducts.forEach((p) => next.add(p.id));
      }
      return next;
    });
  };

  const handleDeleteSelected = async () => {
    const selectedIds = Array.from(selectedProductIds);
    if (selectedIds.length === 0) return;

    const newIds = selectedIds.filter((id) =>
      editableProducts.some((p) => p.id === id && p.isNew)
    );
    const existingIds = selectedIds.filter((id) => !newIds.includes(id));

    if (existingIds.length === 0) {
      setEditableProducts((prev) => prev.filter((p) => !newIds.includes(p.id)));
      setSelectedProductIds((prev) => {
        const next = new Set(prev);
        newIds.forEach((id) => next.delete(id));
        return next;
      });
      return;
    }

    const confirmed = window.confirm(
      `Delete ${existingIds.length} selected product(s)? This cannot be undone.`
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      const results = await Promise.allSettled(
        existingIds.map((id) => deleteAdminProduct(id))
      );

      const failedIds = existingIds.filter((id, idx) => {
        const result = results[idx];
        if (result.status === "rejected") return true;
        return !result.value?.success;
      });

      const deletedIds = existingIds.filter((id) => !failedIds.includes(id));

      if (deletedIds.length > 0) {
        setEditableProducts((prev) => prev.filter((p) => !deletedIds.includes(p.id) && !newIds.includes(p.id)));
        setSelectedProductIds((prev) => {
          const next = new Set(prev);
          deletedIds.forEach((id) => next.delete(id));
          newIds.forEach((id) => next.delete(id));
          return next;
        });
        onSave();
      }

      if (newIds.length > 0 && deletedIds.length === 0) {
        setEditableProducts((prev) => prev.filter((p) => !newIds.includes(p.id)));
        setSelectedProductIds((prev) => {
          const next = new Set(prev);
          newIds.forEach((id) => next.delete(id));
          return next;
        });
      }

      if (failedIds.length > 0) {
        alert(`Failed to delete ${failedIds.length} product(s).`);
      }
    } catch (error: any) {
      alert(`Failed to delete products: ${error?.message || "Unknown error"}`);
    } finally {
      setDeleting(false);
    }
  };

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
    index: 50,
    image: 140,
    productName: 200,
    category: 150,
    subCategory: 130,
    subSubCategory: 130,
    sku: 130,
    rackNumber: 100,
    description: 130,
    barcode: 130,
    hsnCode: 100,
    pack: 100,
    size: 80,
    color: 80,
    tax: 80,
    gst: 80,
    purchasePrice: 100,
    mfgDate: 130,
    expiryDate: 130,
    weight: 110,
    compareAtPrice: 100,
    price: 100,
    deliveryTime: 130,
    stock: 100,
    offerPrice: 100,
    wholesalePrice: 120,
    lowStockQuantity: 100,
    brand: 100,
    valMrp: 100,
    valPur: 100,
    unitPrice: 100,
    attributes: 150,
    variations: 120,
    variationName: 150,
    status: 100,
  });

  const adjustColumnWidth = (key: string, delta: number) => {
    setColumnWidths((prev) => {
      const current = Number(prev[key] ?? 120) || 120;
      return {
        ...prev,
        [key]: Math.max(50, Math.min(520, current + delta)),
      };
    });
  };

  const handleResizeStart = (e: React.MouseEvent, key: string) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent sorting or other events
    const startX = e.pageX;
    const startWidth = columnWidths[key];

    const onMouseMove = (moveEvent: MouseEvent) => {
      const currentX = moveEvent.pageX;
      const diff = currentX - startX;
      setColumnWidths((prev) => ({
        ...prev,
        [key]: Math.max(50, startWidth + diff), // Enforce minimum width of 50px
      }));
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "default";
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    document.body.style.cursor = "col-resize";
  };

  const handleResizeStartTouch = (e: React.TouchEvent<HTMLDivElement>, key: string) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.touches[0]?.pageX ?? 0;
    const startWidth = columnWidths[key];

    const onTouchMove = (moveEvent: TouchEvent) => {
      moveEvent.preventDefault();
      const currentX = moveEvent.touches[0]?.pageX ?? startX;
      const diff = currentX - startX;
      setColumnWidths((prev) => ({
        ...prev,
        [key]: Math.max(50, startWidth + diff),
      }));
    };

    const onTouchEnd = () => {
      document.removeEventListener("touchmove", onTouchMove as any);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchEnd);
    };

    document.addEventListener("touchmove", onTouchMove as any, { passive: false });
    document.addEventListener("touchend", onTouchEnd);
    document.addEventListener("touchcancel", onTouchEnd);
  };

  const ResizeHandle = ({ columnKey }: { columnKey: string }) => (
    <div
      className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#f187b5] z-20"
      onMouseDown={(e) => handleResizeStart(e, columnKey)}
      onTouchStart={(e) => handleResizeStartTouch(e, columnKey)}
      onClick={(e) => e.stopPropagation()}
    />
  );

  const renderBodyCell = (key: string, product: EditableProduct, originalIndex: number, index: number) => {
    if (hiddenColumns.includes(key)) return null;

    switch (key) {
      case "index":
        return <td key={key} className="p-2 border-r border-neutral-200 text-center text-xs text-neutral-500">{index + 1}</td>;
      case "image":
        return (
          <td key={key} className="p-1 border-r border-neutral-200 text-center align-middle">
            <div className="flex flex-wrap justify-center items-center gap-2 p-1 min-w-[140px]">
              {product.images.map((img, i) => (
                <div key={img.id} className="relative group w-12 h-12 border border-gray-200 rounded overflow-hidden bg-white shrink-0">
                  <img src={img.url} alt={`Img-${i}`} className="w-full h-full object-cover" />
                  <button onClick={() => handleRemoveImage(originalIndex, img.id)} className="absolute top-0 right-0 bg-red-600 text-white w-4 h-4 flex items-center justify-center rounded-bl opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700 z-10" title="Remove">
                    <span className="text-[10px] font-bold leading-none">&times;</span>
                  </button>
                  {i === 0 && <span className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[8px] py-[1px]">Main</span>}
                </div>
              ))}
              <label htmlFor={`file-input-${originalIndex}`} className="w-10 h-10 border border-dashed border-gray-400 rounded flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 text-gray-500 hover:text-[#f187b5] transition-colors shrink-0" title="Add Images">
                <span className="text-xl leading-none font-light">+</span>
                <input id={`file-input-${originalIndex}`} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { handleImageChange(originalIndex, e.target.files); e.target.value = ""; }} />
              </label>
            </div>
          </td>
        );
      case "productName":
        return <td key={key} className="p-0 border-r border-neutral-200"><input type="text" className="w-full h-full px-3 py-2 bg-transparent border-none focus:ring-2 focus:ring-[#f187b5] focus:bg-white text-sm" value={product.productName} onChange={(e) => handleFieldChange(originalIndex, "productName", e.target.value)} /></td>;
      case "category":
        return (
          <td key={key} className="p-0 border-r border-neutral-200">
            <select className="w-full h-full px-3 py-2 bg-transparent border-none focus:ring-2 focus:ring-[#f187b5] focus:bg-white text-sm cursor-pointer" value={product.categoryId} onChange={(e) => handleFieldChange(originalIndex, "categoryId", e.target.value)}>
              <option value="">Category</option>
              {categories.map((cat) => <option key={cat._id} value={cat._id}>{cat.name}</option>)}
            </select>
          </td>
        );
      case "attributes":
        return (
            <td key={key} className="p-0 border-r border-neutral-200 bg-white">
                <AttributeDropdown
                    options={availableAttributes}
                    selectedAttributes={product.attributes || []}
                    onChange={(newAttrs) => handleFieldChange(originalIndex, 'attributes', newAttrs)}
                />
            </td>
        );
      case "variations":
        return (
            <td key={key} className="p-0 border-r border-neutral-200 bg-white">
                <VariationDropdown
                    variations={product.variations || []}
                    onEdit={() => setActiveVariationModalIndex(originalIndex)}
                />
            </td>
        );
      case "variationName":
        return <td key={key} className="p-0 border-r border-neutral-200"><input type="text" className="w-full h-full px-2 py-2 bg-transparent border-none text-sm" value={product.variationName} onChange={(e) => handleFieldChange(originalIndex, 'variationName', e.target.value)} /></td>;
      case "subCategory":
        return (
          <td key={key} className="p-0 border-r border-neutral-200">
            <select className="w-full h-full px-2 py-2 bg-transparent border-none text-sm cursor-pointer" value={product.subCategoryId || ""} onChange={(e) => handleFieldChange(originalIndex, 'subCategoryId', e.target.value)}>
              <option value="">-</option>
              {subCategories.filter(sub => { const subCatObj = sub.category; const subCatId = (typeof subCatObj === 'string') ? subCatObj : subCatObj._id; return !product.categoryId || subCatId === product.categoryId; }).map(sub => <option key={sub._id} value={sub._id}>{sub.name}</option>)}
            </select>
          </td>
        );
      case "subSubCategory":
        return <td key={key} className="p-0 border-r border-neutral-200"><input type="text" className="w-full h-full px-2 py-2 bg-transparent border-none text-sm" value={product.subSubCategory} onChange={(e) => handleFieldChange(originalIndex, 'subSubCategory', e.target.value)} /></td>;
      case "sku":
        return <td key={key} className="p-0 border-r border-neutral-200"><input type="text" className="w-full h-full px-2 py-2 bg-transparent border-none text-sm" value={product.itemCode} onChange={(e) => handleFieldChange(originalIndex, 'itemCode', e.target.value)} /></td>;
      case "rackNumber":
        return <td key={key} className="p-0 border-r border-neutral-200"><input type="text" className="w-full h-full px-2 py-2 bg-transparent border-none text-sm" value={product.rackNumber} onChange={(e) => handleFieldChange(originalIndex, 'rackNumber', e.target.value)} /></td>;
      case "description":
        return <td key={key} className="p-0 border-r border-neutral-200"><input type="text" className="w-full h-full px-2 py-2 bg-transparent border-none text-sm" value={product.description} onChange={(e) => handleFieldChange(originalIndex, 'description', e.target.value)} /></td>;
      case "barcode":
        return (
          <td key={key} className="p-1 border-r border-neutral-200 align-top overflow-hidden">
            <div className="flex flex-col gap-1 w-full min-w-0">
                <div className="flex flex-wrap gap-1 px-1 w-full min-w-0">
                    {(product.barcode || []).map(b => (
                        <span key={b} className="bg-pink-50 text-pink-700 px-1.5 py-0.5 rounded text-[10px] border border-pink-100 flex items-center gap-1 group/chip max-w-full break-all">
                            <span className="min-w-0 break-all">{b}</span>
                            <button onClick={() => {
                                const newBarcodes = (product.barcode || []).filter(item => item !== b);
                                handleFieldChange(originalIndex, 'barcode', newBarcodes);
                            }} className="text-pink-400 hover:text-red-500 transition-colors">&times;</button>
                        </span>
                    ))}
                </div>
                <div className="flex gap-1 px-1 mt-1 w-full min-w-0">
                    <input
                        type="text"
                        className="flex-1 min-w-0 w-full px-2 py-1 border border-gray-200 rounded text-[11px] focus:ring-1 focus:ring-[#f187b5] focus:outline-none"
                        placeholder="Add"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                const val = (e.currentTarget as HTMLInputElement).value.trim();
                                if (val && !(product.barcode || []).includes(val)) {
                                    handleFieldChange(originalIndex, 'barcode', [...(product.barcode || []), val]);
                                    (e.currentTarget as HTMLInputElement).value = '';
                                }
                            }
                        }}
                    />
                    <button
                        onClick={() => {
                            const newB = Math.floor(100000000000 + Math.random() * 900000000000).toString();
                            handleFieldChange(originalIndex, 'barcode', [...(product.barcode || []), newB]);
                        }}
                        className="p-1.5 bg-pink-50 border border-pink-200 rounded text-[#f187b5] hover:bg-pink-100 transition-colors"
                        title="Auto Generate"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                    </button>
                    <button
                        onClick={() => startScanning(originalIndex)}
                        className="p-1.5 bg-pink-50 border border-pink-200 rounded text-[#f187b5] hover:bg-pink-100 transition-colors"
                        title="Scan Barcode"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 7V5a2 2 0 012-2h2m10 0h2a2 2 0 012 2v2m0 10v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg>
                    </button>
                </div>
            </div>
          </td>
        );
      case "hsnCode":
        return <td key={key} className="p-0 border-r border-neutral-200"><input type="text" className="w-full h-full px-2 py-2 bg-transparent border-none text-sm" value={product.hsnCode} onChange={(e) => handleFieldChange(originalIndex, 'hsnCode', e.target.value)} /></td>;
      case "pack":
        return <td key={key} className="p-0 border-r border-neutral-200"><input type="text" className="w-full h-full px-2 py-2 bg-transparent border-none text-sm" value={product.pack} onChange={(e) => handleFieldChange(originalIndex, 'pack', e.target.value)} /></td>;
      case "size":
        return <td key={key} className="p-2 border-r border-neutral-200 text-sm text-neutral-600">-</td>;
      case "color":
        return <td key={key} className="p-2 border-r border-neutral-200 text-sm text-neutral-600">-</td>;

      case "tax":
        return <td key={key} className="p-0 border-r border-neutral-200"><input type="text" className="w-full h-full px-2 py-2 bg-transparent border-none text-sm" value={product.tax} onChange={(e) => handleFieldChange(originalIndex, 'tax', e.target.value)} /></td>;
      case "gst":
        return <td key={key} className="p-2 border-r border-neutral-200 text-sm text-neutral-600">-</td>;
      case "purchasePrice":
        return <td key={key} className="p-0 border-r border-neutral-200"><input type="number" className="w-full h-full px-2 py-2 bg-transparent border-none text-sm text-right" value={product.purchasePrice} onChange={(e) => handleFieldChange(originalIndex, 'purchasePrice', parseFloat(e.target.value))} /></td>;
      case "mfgDate":
        return <td key={key} className="p-0 border-r border-neutral-200"><input type="date" className="w-full h-full px-2 py-2 bg-transparent border-none text-sm" value={product.mfgDate || ""} onChange={(e) => handleFieldChange(originalIndex, 'mfgDate', e.target.value)} /></td>;
      case "expiryDate":
        return <td key={key} className="p-0 border-r border-neutral-200"><input type="date" className="w-full h-full px-2 py-2 bg-transparent border-none text-sm" value={product.expiryDate || ""} onChange={(e) => handleFieldChange(originalIndex, 'expiryDate', e.target.value)} /></td>;
      case "weight":
        return <td key={key} className="p-0 border-r border-neutral-200"><input type="text" className="w-full h-full px-2 py-2 bg-transparent border-none text-sm" value={product.weight || ""} onChange={(e) => handleFieldChange(originalIndex, 'weight', e.target.value)} /></td>;
      case "compareAtPrice":
        return <td key={key} className="p-0 border-r border-neutral-200"><input type="number" className="w-full h-full px-3 py-2 bg-transparent border-none focus:ring-2 focus:ring-[#f187b5] focus:bg-white text-sm text-right" value={product.compareAtPrice} onChange={(e) => handleFieldChange(originalIndex, "compareAtPrice", parseFloat(e.target.value) || 0)} /></td>;
      case "price":
        return <td key={key} className="p-0 border-r border-neutral-200"><input type="number" className="w-full h-full px-3 py-2 bg-transparent border-none focus:ring-2 focus:ring-[#f187b5] focus:bg-white text-sm text-right font-medium" value={product.price} onChange={(e) => handleFieldChange(originalIndex, "price", parseFloat(e.target.value) || 0)} /></td>;
      case "deliveryTime":
        return <td key={key} className="p-0 border-r border-neutral-200"><input type="text" className="w-full h-full px-2 py-2 bg-transparent border-none text-sm" value={product.deliveryTime} onChange={(e) => handleFieldChange(originalIndex, 'deliveryTime', e.target.value)} /></td>;
      case "stock":
        return <td key={key} className="p-0 border-r border-neutral-200"><input type="number" className="w-full h-full px-3 py-2 bg-transparent border-none focus:ring-2 focus:ring-[#f187b5] focus:bg-white text-sm text-right" value={product.stock} onChange={(e) => handleFieldChange(originalIndex, "stock", parseInt(e.target.value) || 0)} /></td>;
      case "offerPrice":
        return <td key={key} className="p-0 border-r border-neutral-200"><input type="number" className="w-full h-full px-2 py-2 bg-transparent border-none text-sm text-right" value={product.offerPrice} onChange={(e) => handleFieldChange(originalIndex, 'offerPrice', parseFloat(e.target.value) || 0)} /></td>;
      case "wholesalePrice":
        return <td key={key} className="p-0 border-r border-neutral-200"><input type="number" className="w-full h-full px-2 py-2 bg-transparent border-none text-sm text-right" value={product.wholesalePrice} onChange={(e) => handleFieldChange(originalIndex, 'wholesalePrice', parseFloat(e.target.value) || 0)} /></td>;
      case "lowStockQuantity":
        return <td key={key} className="p-0 border-r border-neutral-200"><input type="number" className="w-full h-full px-2 py-2 bg-transparent border-none text-sm text-right" value={product.lowStockQuantity} onChange={(e) => handleFieldChange(originalIndex, 'lowStockQuantity', parseInt(e.target.value))} /></td>;
      case "brand":
        return (
          <td key={key} className="p-0 border-r border-neutral-200">
            <select className="w-full h-full px-2 py-2 bg-transparent border-none text-sm cursor-pointer" value={product.brandId || ""} onChange={(e) => handleFieldChange(originalIndex, 'brandId', e.target.value)}>
              <option value="">-Select Brand-</option>
              {brands.map(brand => <option key={brand._id} value={brand._id}>{brand.name}</option>)}
            </select>
          </td>
        );
      case "valMrp":
        return <td key={key} className="p-2 border-r border-neutral-200 text-sm text-neutral-600 text-right">{(product.compareAtPrice * product.stock).toLocaleString()}</td>;
      case "valPur":
        return <td key={key} className="p-2 border-r border-neutral-200 text-sm text-neutral-600 text-right">{(product.purchasePrice * product.stock).toLocaleString()}</td>;
      case "unitPrice":
        return (
            <td key={key} className="p-1 border-r border-neutral-200 align-top">
                <div className="flex justify-between items-start h-full gap-1">
                     <div className="flex flex-col gap-0.5 w-full">
                        {product.unitPricing && product.unitPricing.length > 0 ? (
                            product.unitPricing.map((slab, idx) => (
                                <div key={idx} className="text-[10px] text-gray-700 bg-gray-50 px-1 rounded flex justify-between border border-gray-100">
                                    <span>{slab.minQty}+</span>
                                    <span className="font-bold">₹{slab.price}</span>
                                </div>
                            ))
                        ) : (
                            <span className="text-[10px] text-gray-400 italic p-1">No rules</span>
                        )}
                     </div>
                     <button
                        onClick={() => setActivePricingModalIndex(originalIndex)}
                        className="text-[#f187b5] hover:text-[#e076a5] p-1 hover:bg-[#f187b5]/10 rounded shrink-0"
                        title="Edit Pricing Rules"
                     >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                     </button>
                </div>
            </td>
        );
      case "status":
        return (
          <td key={key} className="p-2 text-center">
            <label className="inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={product.publish} onChange={(e) => handleFieldChange(originalIndex, "publish", e.target.checked)} className="sr-only peer" />
              <div className="relative w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#f187b5]/50 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-[#f187b5]"></div>
              <span className="ms-2 text-xs font-medium text-gray-900">{product.publish ? "Active" : "Inactive"}</span>
            </label>
          </td>
        );
      default:
        return <td key={key} className="p-2"></td>;
    }
  };

  const hasAnyChanges = useMemo(
    () => editedCacheRef.current.size > 0,
    [changesVersion]
  );
  const totalEntries = Number(serverPagination?.total ?? 0);
  const startEntry = totalEntries === 0 ? 0 : (page - 1) * pageLimit + 1;
  const endEntry = Math.min(page * pageLimit, totalEntries);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 sm:p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-[98vw] sm:max-w-7xl h-[94vh] sm:h-[90vh] flex flex-col">
          {/* Header */}
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-neutral-200 bg-[#f187b5] text-white rounded-t-lg">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold leading-snug">Bulk Edit Products</h2>
              <button
                onClick={onClose}
                className="text-white hover:bg-[#e076a5] p-2 rounded transition-colors shrink-0"
                aria-label="Close"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                onClick={() => setEditableProducts((prev) => [createEmptyProduct(), ...prev])}
                className="px-3 py-1.5 text-sm bg-white text-[#f187b5] rounded hover:bg-pink-50 transition-colors whitespace-nowrap"
              >
                + Add Row
              </button>
              <div className="relative flex-1 min-w-[160px]">
                <input
                  type="text"
                  placeholder="Search products..."
                  className="w-full px-3 pr-10 py-1.5 text-sm text-black rounded border-none focus:ring-2 focus:ring-[#f187b5]"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1);
                  }}
                />
                <button
                  onClick={() => {
                    if (isScanning) stopScanning();
                    setSearchScannerKey((prev) => prev + 1);
                    setShowSearchScanner(true);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-[#f187b5] transition-colors"
                  title="Scan Barcode"
                  type="button"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 7V5a2 2 0 0 1 2-2h2m10 0h2a2 2 0 0 1 2 2v2m0 10v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M7 12h10" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>

        {/* Content (Spreadsheet) */}
        <div className="flex-1 overflow-auto p-0">
          <table className="w-full text-left border-collapse table-fixed">
            <thead className="bg-neutral-100 sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="w-12 p-2 border-r border-neutral-200 text-center">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleSelectAllFiltered}
                    aria-label="Select all filtered products"
                  />
                </th>
                {columnOrder.map((key) => renderHeader(key))}
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product, index) => {
                const originalIndex = editableProducts.findIndex(p => p.id === product.id);
                return (
                  <tr
                    key={product.id}
                    className={`border-b border-neutral-200 hover:bg-neutral-50 ${product.isChanged ? "bg-yellow-50" : ""}`}
                  >
                    <td className="p-2 border-r border-neutral-200 text-center align-top">
                      <input
                        type="checkbox"
                        checked={selectedProductIds.has(product.id)}
                        onChange={() => toggleSelectProduct(product.id)}
                        aria-label={`Select ${product.productName}`}
                      />
                    </td>
                    {columnOrder.map((key) => renderBodyCell(key, product, originalIndex, index))}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredProducts.length === 0 && (
            <div className="p-8 text-center text-neutral-500">
              No products found.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-neutral-50 rounded-b-lg">
          <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-700 w-full sm:w-auto">
            <div className="flex items-center gap-2">
              <span className="text-sm text-neutral-600">Show</span>
              <select
                value={pageLimit}
                onChange={(e) => {
                  setPageLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-white border border-neutral-300 rounded py-1.5 px-3 text-sm focus:ring-1 focus:ring-[#f187b5] focus:outline-none cursor-pointer"
                disabled={pageLoading}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={500}>500</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pageLoading || page <= 1}
              className={`px-3 py-1.5 border rounded ${
                pageLoading || page <= 1
                  ? "bg-neutral-200 text-neutral-500 cursor-not-allowed border-neutral-200"
                  : "bg-white hover:bg-neutral-100 border-neutral-300"
              }`}
            >
              Prev
            </button>
            <span className="text-xs sm:text-sm">
              Page {page} / {serverPagination?.pages || 1} • Showing {startEntry} to{" "}
              {endEntry} of {totalEntries}
              {pageLoading ? " (Loading...)" : ""}
            </span>
            <button
              type="button"
              onClick={() =>
                setPage((p) => Math.min(serverPagination?.pages || 1, p + 1))
              }
              disabled={pageLoading || page >= (serverPagination?.pages || 1)}
              className={`px-3 py-1.5 border rounded ${
                pageLoading || page >= (serverPagination?.pages || 1)
                  ? "bg-neutral-200 text-neutral-500 cursor-not-allowed border-neutral-200"
                  : "bg-white hover:bg-neutral-100 border-neutral-300"
              }`}
            >
              Next
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 w-full sm:w-auto sm:flex sm:justify-end sm:gap-3">
          <button
            onClick={handleDeleteSelected}
            disabled={deleting || saving || selectedProductIds.size === 0}
            className={`w-full min-w-0 px-2 py-2 rounded text-xs sm:text-sm text-white text-center leading-snug whitespace-normal break-words sm:px-4 ${
              deleting || saving || selectedProductIds.size === 0
                ? "bg-red-300 cursor-not-allowed"
                : "bg-red-500 hover:bg-red-600"
            }`}
          >
            {deleting ? "Deleting..." : `Delete Selected (${selectedProductIds.size})`}
          </button>
          <button
            onClick={onClose}
            className="w-full min-w-0 px-2 py-2 border border-neutral-300 rounded text-neutral-700 text-xs sm:text-sm hover:bg-neutral-100 transition-colors sm:px-4"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !hasAnyChanges}
            className={`w-full min-w-0 px-2 py-2 rounded text-white text-xs sm:text-sm flex items-center justify-center gap-2 sm:px-4 ${
              saving || !hasAnyChanges
                ? "bg-neutral-400 cursor-not-allowed"
                : "bg-[#f187b5] hover:bg-[#e076a5]"
            }`}
          >
            {saving ? (
              <>
                <svg
                  className="animate-spin h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </button>
          </div>
        </div>
      </div>

      {/* Pricing Modal */}
      {activePricingModalIndex !== null && (
          <PricingSlabsModal
              slabs={editableProducts[activePricingModalIndex].unitPricing || []}
              onClose={() => setActivePricingModalIndex(null)}
              onSave={(newSlabs) => handleFieldChange(activePricingModalIndex, 'unitPricing', newSlabs)}
          />
      )}
      {/* Variation Editor Modal */}
      {activeVariationModalIndex !== null && (
          <VariationEditor
            productName={editableProducts[activeVariationModalIndex].productName}
            isOpen={true}
            onClose={() => setActiveVariationModalIndex(null)}
            variations={editableProducts[activeVariationModalIndex].variations || []}
            selectedAttributes={editableProducts[activeVariationModalIndex].attributes || []}
            variationName={editableProducts[activeVariationModalIndex].variationName || ""}
            onVariationNameChange={(name) => handleFieldChange(activeVariationModalIndex, 'variationName', name)}
            onSave={(newVariations) => handleFieldChange(activeVariationModalIndex, 'variations', newVariations)}
          />
      )}
      {isScanning && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80">
              <div className="bg-white rounded-lg overflow-hidden w-full max-w-sm shadow-2xl">
                  <div className="bg-[#f187b5] p-3 text-white flex justify-between items-center">
                      <h3 className="font-bold flex items-center gap-2">
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7V5a2 2 0 0 1 2-2h2m10 0h2a2 2 0 0 1 2 2v2m0 10v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          Scan Barcode
                      </h3>
                      <button onClick={stopScanning} className="hover:bg-white/20 p-1 rounded-full">&times;</button>
                  </div>
                  <div className="aspect-square bg-gray-900 border-y border-gray-700">
                      <div id="bulk-barcode-reader" className="w-full h-full"></div>
                  </div>
                  <div className="p-4 bg-gray-50 text-center">
                      <p className="text-xs text-gray-500 mb-3">Place the barcode inside the frame</p>
                      <button onClick={stopScanning} className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-bold text-xs transition-colors">Cancel</button>
                  </div>
              </div>
          </div>
      )}

      {showSearchScanner && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80">
          <div className="bg-white rounded-lg overflow-hidden w-full max-w-sm shadow-2xl">
            <div className="bg-[#f187b5] p-3 text-white flex justify-between items-center">
              <h3 className="font-bold flex items-center gap-2">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 7V5a2 2 0 0 1 2-2h2m10 0h2a2 2 0 0 1 2 2v2m0 10v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M7 12h10" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Scan Barcode
              </h3>
              <button onClick={() => void stopSearchScanning()} className="hover:bg-white/20 p-1 rounded-full" type="button">&times;</button>
            </div>
            <div className="aspect-square bg-gray-900 border-y border-gray-700">
              <div id={`bulk-search-reader-${searchScannerKey}`} className="w-full h-full"></div>
            </div>
            <div className="p-4 bg-gray-50 text-center">
              <p className="text-xs text-gray-500 mb-3">Place the barcode inside the frame</p>
              <button onClick={() => void stopSearchScanning()} className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-bold text-xs transition-colors" type="button">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
