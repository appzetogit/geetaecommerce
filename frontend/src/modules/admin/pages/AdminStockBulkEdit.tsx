import React, { useState, useEffect, useMemo } from "react";
import {
  Product,
  Category,
  updateProduct,
  uploadImage,
  getSubCategories,
  getBrands,
  SubCategory,
  Brand,
} from "../../../services/api/admin/adminProductService";

interface AdminStockBulkEditProps {
  products: Product[];
  categories: Category[];
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
                <button onClick={addSlab} className="mt-3 text-teal-600 font-bold text-sm flex items-center gap-1">
                    <span className="text-lg">+</span> Add Slab
                </button>
                <div className="mt-6 flex justify-end gap-2">
                    <button onClick={onClose} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-sm text-gray-700 font-medium transition-colors">Cancel</button>
                    <button onClick={() => { onSave(localSlabs.filter(s => s.minQty > 0)); onClose(); }} className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded text-sm font-medium transition-colors">Save Rules</button>
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
  barcode: string;
  hsnCode: string;
  pack: string; // Unit
  purchasePrice: number;
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
}

export default function AdminStockBulkEdit({
  products,
  categories,
  onClose,
  onSave,
}: AdminStockBulkEditProps) {
  const [editableProducts, setEditableProducts] = useState<EditableProduct[]>([]);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activePricingModalIndex, setActivePricingModalIndex] = useState<number | null>(null); // For modal

  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);

  useEffect(() => {
    const fetchData = async () => {
        try {
            const [subRes, brandRes] = await Promise.all([
                getSubCategories({ limit: 1000 } as any),
                getBrands()
            ]);
            if(subRes.success && subRes.data) setSubCategories(subRes.data);
            if(brandRes.success && brandRes.data) setBrands(brandRes.data);
        } catch (e) {
            console.error("Failed to load metadata for bulk edit", e);
        }
    };
    fetchData();
  }, []);

  // Initialize editable products
  useEffect(() => {
    const initialized = products.map((p) => {
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
        barcode: (p as any).barcode || "",
        hsnCode: (p as any).hsnCode || "",
        pack: (p as any).pack || "",
        purchasePrice: (p as any).purchasePrice || 0,
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
      };
    });
    setEditableProducts(initialized);
  }, [products]);

  const handleFieldChange = (
    index: number,
    field: keyof EditableProduct,
    value: any
  ) => {
    setEditableProducts((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value, isChanged: true };
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

      return updated;
    });
  };

  const handleSave = async () => {
    const changedProducts = editableProducts.filter((p) => p.isChanged);
    if (changedProducts.length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      const updatePromises = changedProducts.map(async (p) => {
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
          deliveryTime: p.deliveryTime,
          lowStockQuantity: p.lowStockQuantity,
          discPrice: p.offerPrice,
          wholesalePrice: p.wholesalePrice,
          // Conditionally add relations if they exist
          // ...(p.tax ? { tax: p.tax } : {}), // Exclude tax because it causes CastError (text input vs ObjectId)
          ...(p.subCategoryId ? { subcategory: p.subCategoryId } : {}),
          ...(p.subSubCategory ? { subSubCategory: p.subSubCategory } : {}),
          ...(p.brandId ? { brand: p.brandId } : {}),
          // Propagate offer price to all variations to ensure consistency
          variations: p.original.variations?.map((v: any) => ({
             ...v,
             discPrice: p.offerPrice
          })) || [],
          unitPricing: p.unitPricing, // Include unitPricing in payload
        } as any);
      });

      await Promise.all(updatePromises);
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

  // Column Resizing Logic
  const filteredProducts = useMemo(() => {
     return editableProducts.filter(p => {
        const nameMatch = p.productName.toLowerCase().includes(searchTerm.toLowerCase());

        // Resolve category name for filtering
        const catName = categories.find(c => c._id === p.categoryId)?.name || "";
        const catMatch = catName.toLowerCase().includes(categorySearch.toLowerCase());

        return nameMatch && catMatch;
     });
  }, [editableProducts, searchTerm, categorySearch, categories]);

  // Column Resizing Logic

  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const [activeMenuColumn, setActiveMenuColumn] = useState<string | null>(null);
  const [columnOrder, setColumnOrder] = useState<string[]>([
    "index", "image", "productName", "category", "subCategory", "subSubCategory",
    "sku", "rackNumber", "description", "barcode", "hsnCode", "pack",
    "size", "color", "attr", "tax", "gst", "purchasePrice", "compareAtPrice",
    "price", "deliveryTime", "stock", "offerPrice", "wholesalePrice",
    "lowStockQuantity", "brand", "valMrp", "valPur", "unitPrice", "status"
  ]);
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
    attr: "13. Attr",
    tax: "14. Tax Cat",
    gst: "15. GST",
    purchasePrice: "16. Pur. Price",
    compareAtPrice: "17. MRP",
    price: "18. Sell Price",
    deliveryTime: "19. Del. Time",
    stock: "20. Stock",
    offerPrice: "21. Offer Price",
    wholesalePrice: "22. Wholesale Price",
    lowStockQuantity: "23. Low Stock",
    brand: "24. Brand",
    valMrp: "25. Val (MRP)",
    valPur: "26. Val (Pur)",
    unitPrice: "27. Unit Pricing Rules", // Rename
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
            className="w-full text-[11px] px-2 py-1 border border-gray-300 rounded font-normal focus:ring-1 focus:ring-teal-500 focus:outline-none"
            value={categorySearch}
            onChange={(e) => setCategorySearch(e.target.value)}
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
    attr: 80,
    tax: 80,
    gst: 80,
    purchasePrice: 100,
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
    status: 100,
  });

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

  const ResizeHandle = ({ columnKey }: { columnKey: string }) => (
    <div
      className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-teal-500 z-20"
      onMouseDown={(e) => handleResizeStart(e, columnKey)}
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
              <label htmlFor={`file-input-${originalIndex}`} className="w-10 h-10 border border-dashed border-gray-400 rounded flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 text-gray-500 hover:text-teal-600 transition-colors shrink-0" title="Add Images">
                <span className="text-xl leading-none font-light">+</span>
                <input id={`file-input-${originalIndex}`} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { handleImageChange(originalIndex, e.target.files); e.target.value = ""; }} />
              </label>
            </div>
          </td>
        );
      case "productName":
        return <td key={key} className="p-0 border-r border-neutral-200"><input type="text" className="w-full h-full px-3 py-2 bg-transparent border-none focus:ring-2 focus:ring-teal-500 focus:bg-white text-sm" value={product.productName} onChange={(e) => handleFieldChange(originalIndex, "productName", e.target.value)} /></td>;
      case "category":
        return (
          <td key={key} className="p-0 border-r border-neutral-200">
            <select className="w-full h-full px-3 py-2 bg-transparent border-none focus:ring-2 focus:ring-teal-500 focus:bg-white text-sm cursor-pointer" value={product.categoryId} onChange={(e) => handleFieldChange(originalIndex, "categoryId", e.target.value)}>
              <option value="">Category</option>
              {categories.map((cat) => <option key={cat._id} value={cat._id}>{cat.name}</option>)}
            </select>
          </td>
        );
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
        return <td key={key} className="p-0 border-r border-neutral-200"><input type="text" className="w-full h-full px-2 py-2 bg-transparent border-none text-sm" value={product.barcode} onChange={(e) => handleFieldChange(originalIndex, 'barcode', e.target.value)} /></td>;
      case "hsnCode":
        return <td key={key} className="p-0 border-r border-neutral-200"><input type="text" className="w-full h-full px-2 py-2 bg-transparent border-none text-sm" value={product.hsnCode} onChange={(e) => handleFieldChange(originalIndex, 'hsnCode', e.target.value)} /></td>;
      case "pack":
        return <td key={key} className="p-0 border-r border-neutral-200"><input type="text" className="w-full h-full px-2 py-2 bg-transparent border-none text-sm" value={product.pack} onChange={(e) => handleFieldChange(originalIndex, 'pack', e.target.value)} /></td>;
      case "size":
        return <td key={key} className="p-2 border-r border-neutral-200 text-sm text-neutral-600">-</td>;
      case "color":
        return <td key={key} className="p-2 border-r border-neutral-200 text-sm text-neutral-600">-</td>;
      case "attr":
        return <td key={key} className="p-2 border-r border-neutral-200 text-sm text-neutral-600">-</td>;
      case "tax":
        return <td key={key} className="p-0 border-r border-neutral-200"><input type="text" className="w-full h-full px-2 py-2 bg-transparent border-none text-sm" value={product.tax} onChange={(e) => handleFieldChange(originalIndex, 'tax', e.target.value)} /></td>;
      case "gst":
        return <td key={key} className="p-2 border-r border-neutral-200 text-sm text-neutral-600">-</td>;
      case "purchasePrice":
        return <td key={key} className="p-0 border-r border-neutral-200"><input type="number" className="w-full h-full px-2 py-2 bg-transparent border-none text-sm text-right" value={product.purchasePrice} onChange={(e) => handleFieldChange(originalIndex, 'purchasePrice', parseFloat(e.target.value))} /></td>;
      case "compareAtPrice":
        return <td key={key} className="p-0 border-r border-neutral-200"><input type="number" className="w-full h-full px-3 py-2 bg-transparent border-none focus:ring-2 focus:ring-teal-500 focus:bg-white text-sm text-right" value={product.compareAtPrice} onChange={(e) => handleFieldChange(originalIndex, "compareAtPrice", parseFloat(e.target.value) || 0)} /></td>;
      case "price":
        return <td key={key} className="p-0 border-r border-neutral-200"><input type="number" className="w-full h-full px-3 py-2 bg-transparent border-none focus:ring-2 focus:ring-teal-500 focus:bg-white text-sm text-right font-medium" value={product.price} onChange={(e) => handleFieldChange(originalIndex, "price", parseFloat(e.target.value) || 0)} /></td>;
      case "deliveryTime":
        return <td key={key} className="p-0 border-r border-neutral-200"><input type="text" className="w-full h-full px-2 py-2 bg-transparent border-none text-sm" value={product.deliveryTime} onChange={(e) => handleFieldChange(originalIndex, 'deliveryTime', e.target.value)} /></td>;
      case "stock":
        return <td key={key} className="p-0 border-r border-neutral-200"><input type="number" className="w-full h-full px-3 py-2 bg-transparent border-none focus:ring-2 focus:ring-teal-500 focus:bg-white text-sm text-right" value={product.stock} onChange={(e) => handleFieldChange(originalIndex, "stock", parseInt(e.target.value) || 0)} /></td>;
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
                        className="text-teal-600 hover:text-teal-800 p-1 hover:bg-teal-50 rounded shrink-0"
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
              <div className="relative w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-teal-300 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-teal-600"></div>
              <span className="ms-2 text-xs font-medium text-gray-900">{product.publish ? "Active" : "Inactive"}</span>
            </label>
          </td>
        );
      default:
        return <td key={key} className="p-2"></td>;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 bg-teal-600 text-white rounded-t-lg">
          <h2 className="text-lg font-semibold">Bulk Edit Products</h2>
          <div className="flex items-center gap-2">
             <input
                type="text"
                placeholder="Search products..."
                className="px-3 py-1 text-sm text-black rounded border-none focus:ring-2 focus:ring-teal-400"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
             />
            <button
              onClick={onClose}
              className="text-white hover:bg-teal-700 p-2 rounded transition-colors"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>

        {/* Content (Spreadsheet) */}
        <div className="flex-1 overflow-auto p-0">
          <table className="w-full text-left border-collapse table-fixed">
            <thead className="bg-neutral-100 sticky top-0 z-10 shadow-sm">
              <tr>
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
        <div className="px-6 py-4 border-t border-neutral-200 flex justify-end gap-3 bg-neutral-50 rounded-b-lg">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-neutral-300 rounded text-neutral-700 text-sm hover:bg-neutral-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !editableProducts.some((p) => p.isChanged)}
            className={`px-4 py-2 rounded text-white text-sm flex items-center gap-2 ${
              saving || !editableProducts.some((p) => p.isChanged)
                ? "bg-neutral-400 cursor-not-allowed"
                : "bg-teal-600 hover:bg-teal-700"
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

      {/* Pricing Modal */}
      {activePricingModalIndex !== null && (
          <PricingSlabsModal
              slabs={editableProducts[activePricingModalIndex].unitPricing || []}
              onClose={() => setActivePricingModalIndex(null)}
              onSave={(newSlabs) => handleFieldChange(activePricingModalIndex, 'unitPricing', newSlabs)}
          />
      )}
    </div>
  );
}
