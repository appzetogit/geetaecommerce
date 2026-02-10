import { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  getProducts,
  deleteProduct,
  updateProduct,
  type Product,
} from "../../../services/api/productService";
import {
  getCategories,
  type Category,
} from "../../../services/api/categoryService";
import { useAuth } from "../../../context/AuthContext";
import SellerStockBulkEdit from "./SellerStockBulkEdit";
import SellerStockBulkImport from "./SellerStockBulkImport";
import { getAppSettings } from "../../../services/api/admin/adminSettingsService";

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
  // New fields mapping
  subCategory: string; // 2
  subSubCategory: string; // 3
  // name is 4
  sku: string; // 5
  rackNumber: string; // 6
  description: string; // 7
  barcode: string; // 8
  hsnCode: string; // 9
  unit: string; // 10
  sizeName: string; // 11
  colorName: string; // 12
  attributeName: string; // 13
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

export default function SellerProductList() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, token } = useAuth();
  const isEnabled = user?.isEnabled !== false;

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [savingChanges, setSavingChanges] = useState(false);
  const [changedProductIds, setChangedProductIds] = useState<Set<string>>(new Set());
  const [barcodeSettings, setBarcodeSettings] = useState<any>(null);

  const [filterCategory, setFilterCategory] = useState("All Category");
  const [filterStatus, setFilterStatus] = useState("All Products");
  const [filterStock, setFilterStock] = useState("All Products");

  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });

  // Fetch products and categories
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      setHasUnsavedChanges(false);
      setChangedProductIds(new Set());

      // Fetch categories for filter dropdown
      const categoriesResponse = await getCategories();
      if (categoriesResponse.success) {
        setCategories(categoriesResponse.data);
      }

      // Fetch products using Seller API
      // Note: Seller API usually supports pagination. Admin view fetches all (limit 1000).
      // To mimic Admin view exactly (client side sorting/filtering of all products), we fetch heavily.
      // Or we respect server side pagination.
      // The user wants "same to same". Admin view assumes getting all and client filtering.
      // We will try to fetch a large number to support client side operations if consistent.
      // However, for optimization, standard seller list uses pagination.
      // But AdminStockManagement logic heavily relies on client-side flattening of variations from ALL products.
      // If we only fetch page 1, we can't sort across all variations easily if we rely on client logic.
      // We will use a large limit to mimic Admin behavior.
      const params: any = {
        limit: 1000,
      };

      if (searchTerm) params.search = searchTerm;
      if (filterCategory !== "All Category") params.category = filterCategory;
      if (filterStatus !== "All Products") {
         if (filterStatus === "Published") params.status = "published";
         if (filterStatus === "Unpublished") params.status = "unpublished";
      }

      const response = await getProducts(params);
      if (response.success) {
        setProducts(response.data);
         if (response.pagination) setPagination(response.pagination);
      }

      // Fetch barcode settings
      const settingsRes = await getAppSettings();
      if (settingsRes.success && settingsRes.data.barcodeSettings) {
          setBarcodeSettings(settingsRes.data.barcodeSettings);
      }

    } catch (err: any) {
      console.error("Error fetching products:", err);
      setError(
          err.response?.data?.message || err.message || "Failed to load products. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setLoading(false);
      return;
    }
    fetchData();
  }, [
    isAuthenticated,
    token,
    searchTerm,
    filterCategory,
    filterStatus,
    location.key,
  ]);

  const handleDelete = async (productId: string) => {
    if (!isEnabled) return;
    if (window.confirm("Are you sure you want to delete this product?")) {
      try {
        const response = await deleteProduct(productId);
        if (response.success || response.message === "Product deleted successfully") {
          alert("Product deleted successfully");
          fetchData();
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
    if (!isEnabled) return;
    navigate(`/seller/product/edit/${productId}`);
  };

  // Inline edit handler
  const handleInlineChange = (productId: string, field: string, value: any) => {
    if (!isEnabled) return;
    setProducts((prevProducts) => {
        const newProducts = [...prevProducts];
        const productIndex = newProducts.findIndex((p) => p._id === productId);

        if (productIndex !== -1) {
            newProducts[productIndex] = {
                ...newProducts[productIndex],
                [field]: value,
            };
             if (field === 'status') {
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

            const updateData = {
                productName: product.productName,
                category: typeof product.category === 'object' && product.category ? product.category._id : product.category,
                compareAtPrice: product.compareAtPrice,
                price: product.price,
                stock: product.stock,
                publish: product.publish,
                discPrice: (product as any).offerPrice || product.discPrice,
            };

            await updateProduct(productId, updateData);
        });

        await Promise.all(promises);
        setChangedProductIds(new Set());
        setHasUnsavedChanges(false);
        alert("Changes saved successfully!");
        fetchData();
    } catch (error) {
        console.error("Failed to save changes:", error);
        alert("Failed to save some changes. Please try again.");
    } finally {
        setSavingChanges(false);
    }
  };

  const handleToggleStatus = async (productId: string, currentStatus: boolean) => {
      if (!isEnabled) return;
      try {
          const response = await updateProduct(productId, { publish: !currentStatus });
          if (response.success) {
              setProducts(prev => prev.map(p => p._id === productId ? { ...p, publish: !currentStatus } : p));
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
      // Reusing logic from AdminStockManagement
      const qty = 1;
      const savedSize = localStorage.getItem('barcode_print_size') || 'medium';

      const customSettings = barcodeSettings;
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
                  gap: 15px;
                  margin-top: 4px;
                  font-size: ${fontSize}px;
                  font-weight: 800;
                  color: #000;
                  justify-content: center;
                  align-items: center;
                  white-space: nowrap;
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
                    ${customSettings?.mrpLabel ? `<div class="price-item">${customSettings.mrpLabel}:${mrp}</div>` : mrp ? `<div class="price-item">MRP:${mrp}</div>` : ''}
                    ${customSettings?.spLabel ? `<div class="price-item">${customSettings.spLabel}:${sp}</div>` : sp ? `<div class="price-item">SP:${sp}</div>` : ''}
                </div>
              </div>
            </div>
            <script>
              JsBarcode(".barcode").init();
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
         categoryId = product.category; // string
      }

      // SubCategory
      const subCategoryName = typeof p.subcategory === "object" ? p.subcategory?.name || "-" : "-";
      // SubSubCategory
      const subSubCategoryName = p.subSubCategory || "-";
      // Brand
      const brandName = typeof p.brand === "object" ? p.brand?.name || "-" : "-";
      // Tax
      const taxName = typeof p.tax === "object" ? p.tax?.name || "-" : "-";
      const gstVal = typeof p.tax === "object" ? p.tax?.percentage + "%" || "-" : "-";

      const sellerName = typeof product.seller === "object" && product.seller ? (product.seller as any).storeName || (product.seller as any).sellerName : "Me";
      const sellerId = typeof product.seller === "object" ? "" : product.seller || "";

      // Base fields
      const baseVariation = {
        productId: product._id,
        name: product.productName,
        seller: sellerName,
        sellerId: sellerId,
        image: product.mainImage || product.galleryImages[0] || "",
        category: categoryName,
        categoryId: categoryId,
        subCategory: subCategoryName,
        subSubCategory: subSubCategoryName,
        sku: p.itemCode || p.sku || "",
        rackNumber: p.rackNumber || "-",
        description: p.smallDescription || p.description || "-",
        barcode: p.barcode || "-",
        hsnCode: p.hsnCode || "-",
        unit: p.pack || p.totalAllowedQuantity || "-",
        taxCategory: taxName,
        gst: gstVal,
        purchasePrice: Number(p.purchasePrice) || 0,
        compareAtPrice: Number(p.compareAtPrice) || 0,
        price: Number(p.price) || 0,
        deliveryTime: p.deliveryTime || "-",
        wholesalePrice: Number((p as any).wholesalePrice) || 0,
        lowStockQuantity: Number(p.lowStockQuantity) || 5,
        brand: brandName,
        publish: product.publish,
      };

      if (product.variations && product.variations.length > 0) {
        product.variations.forEach((v: any, index: number) => {
          const currentStock = Number(v.stock) || 0;
          const isSize = v.name && v.name.toLowerCase().includes("size");
          const isColor = v.name && v.name.toLowerCase().includes("color");

          variations.push({
            ...baseVariation,
            id: `${product._id}-${index}`,
            variation: `${v.name}: ${v.value}`,
            stock: currentStock,
            price: Number(v.price) || baseVariation.price,
            compareAtPrice: Number(v.compareAtPrice) || baseVariation.compareAtPrice,
            offerPrice: Number(v.discPrice) || Number((p as any).discPrice) || 0,
            status: product.publish ? "Published" : "Unpublished",
            sku: v.sku || baseVariation.sku,
            sizeName: isSize ? v.value : "-",
            colorName: isColor ? v.value : "-",
            attributeName: v.name || "-",
            valueMrp: (Number(v.compareAtPrice) || Number(baseVariation.compareAtPrice) || 0) * currentStock,
            valuePurchase: (Number(baseVariation.purchasePrice) || 0) * currentStock,
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
  }, [products, categories]);

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

  // Filter products
  const filteredProducts = useMemo(() => {
    return productVariations.filter((product) => {
      const matchesCategory =
        filterCategory === "All Category" ||
        product.categoryId === filterCategory;
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
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.sku.toLowerCase().includes(searchTerm.toLowerCase());

      return (
        matchesCategory &&
        matchesStatus &&
        matchesStock &&
        matchesSearch
      );
    });
  }, [
    productVariations,
    filterCategory,
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

      // Handle sort columns
      switch (sortColumn) {
        case "id": aValue = a.id; bValue = b.id; break;
        case "name": aValue = a.name.toLowerCase(); bValue = b.name.toLowerCase(); break;
        case "variation": aValue = a.variation.toLowerCase(); bValue = b.variation.toLowerCase(); break;
        case "stock": aValue = typeof a.stock === "number" ? a.stock : 999999; bValue = typeof b.stock === "number" ? b.stock : 999999; break;
        case "status": aValue = a.status; bValue = b.status; break;
        // Add more sorts as needed
        case "price": aValue = a.price; bValue = b.price; break;
        default: return 0;
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredProducts, sortColumn, sortDirection]);

  // Client Side Pagination implementation matching Admin View
  const totalPages = Math.ceil(sortedProducts.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const displayedProducts = sortedProducts.slice(startIndex, endIndex);

  const handleExport = () => {
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
      "Attr",
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
          escapeCsv(product.attributeName),
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
      `products_export_${new Date().toISOString().split("T")[0]}.csv`
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
          <div className="bg-[#f187b5] text-white px-6 py-4 rounded-t-lg flex justify-between items-center">
            <h2 className="text-lg font-semibold">Product List</h2>
             {hasUnsavedChanges && (
                <button
                    onClick={handleSaveChanges}
                    disabled={savingChanges}
                    className="bg-white text-[#f187b5] px-4 py-1.5 rounded font-bold text-sm hover:bg-neutral-100 transition-colors shadow-sm flex items-center gap-2"
                >
                    {savingChanges ? "Saving..." : "Save Changes"}
                </button>
             )}
          </div>

          {!isEnabled && (
            <div className="bg-red-50 p-4 border-b border-red-100">
               <p className="text-red-700 text-sm font-medium">Your account is disabled. Editing actions are restricted.</p>
            </div>
          )}

          {/* Filters and Controls */}
          <div className="p-4 border-b border-neutral-200">
            {/* Filters Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
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
                  className="w-full px-3 py-2 border border-neutral-300 rounded text-sm focus:ring-1 focus:ring-[#f187b5] focus:outline-none cursor-pointer">
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
                  Filter by Status
                </label>
                <select
                  value={filterStatus}
                  onChange={(e) => {
                    setFilterStatus(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 border border-neutral-300 rounded text-sm focus:ring-1 focus:ring-[#f187b5] focus:outline-none cursor-pointer">
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
                  className="w-full px-3 py-2 border border-neutral-300 rounded text-sm focus:ring-1 focus:ring-[#f187b5] focus:outline-none cursor-pointer">
                  {STOCK_OPTIONS.map((stock) => (
                    <option key={stock} value={stock}>
                      {stock}
                    </option>
                  ))}
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
                      className="bg-white border border-neutral-300 rounded py-1.5 px-3 text-sm focus:ring-1 focus:ring-[#f187b5] focus:outline-none cursor-pointer">
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>

                  <div className="relative w-full sm:w-auto">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-xs">
                      Search:
                    </span>
                    <input
                      type="text"
                      className="pl-14 pr-3 py-2 bg-neutral-100 border-none rounded text-sm focus:ring-1 focus:ring-[#f187b5] w-full sm:w-48"
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setCurrentPage(1);
                      }}
                      placeholder="..."
                    />
                  </div>
              </div>

              {/* Action Buttons: Grid on Mobile, Flex on Desktop */}
              <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex sm:items-center">
                <button
                  onClick={() => navigate("/seller/product/add")}
                  disabled={!isEnabled}
                  className={`px-3 py-2 rounded text-xs font-medium flex items-center justify-center gap-1 transition-colors ${isEnabled ? "bg-[#f187b5] hover:bg-[#e076a5] text-white" : "bg-neutral-200 text-neutral-500 cursor-not-allowed"}`}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  Add
                </button>
                <button
                  onClick={() => setShowBulkEdit(true)}
                  disabled={!isEnabled}
                  className={`px-3 py-2 rounded text-xs font-medium flex items-center justify-center gap-1 transition-colors ${isEnabled ? "bg-[#f187b5] hover:bg-[#e076a5] text-white" : "bg-neutral-200 text-neutral-500 cursor-not-allowed"}`}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                  Bulk Edit
                </button>
                <button
                  onClick={() => setShowBulkImport(true)}
                  disabled={!isEnabled}
                  className={`px-3 py-2 rounded text-xs font-medium flex items-center justify-center gap-1 transition-colors ${isEnabled ? "bg-[#f187b5] hover:bg-[#e076a5] text-white" : "bg-neutral-200 text-neutral-500 cursor-not-allowed"}`}
                >
                   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                  Import
                </button>
                <button
                  onClick={handleExport}
                  className="bg-[#f187b5] hover:bg-[#e076a5] text-white px-3 py-2 rounded text-xs font-medium flex items-center justify-center gap-1 transition-colors">
                  Export
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-neutral-50 text-xs font-bold text-neutral-800 border-b border-neutral-200">
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
                  <th className="p-4 whitespace-nowrap">13. Attr</th>
                  <th className="p-4 whitespace-nowrap">14. Tax Cat</th>
                  <th className="p-4 whitespace-nowrap">15. GST</th>
                  <th className="p-4 whitespace-nowrap">16. Pur. Price</th>
                  <th className="p-4 whitespace-nowrap">17. MRP</th>
                  <th className="p-4 whitespace-nowrap">18. Sell Price</th>
                  <th className="p-4 whitespace-nowrap">19. Del. Time</th>
                  <th className="p-4 whitespace-nowrap">20. Stock</th>
                  <th className="p-4 whitespace-nowrap">21. Offer Price</th>
                  <th className="p-4 whitespace-nowrap">Wholesale Price</th>
                  <th className="p-4 whitespace-nowrap">22. Low Stock</th>
                  <th className="p-4 whitespace-nowrap">23. Brand</th>
                  <th className="p-4 whitespace-nowrap">24. Val (MRP)</th>
                  <th className="p-4 whitespace-nowrap">25. Val (Pur)</th>
                  <th className="p-4 whitespace-nowrap">Status</th>
                  <th className="p-4 whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={29}
                      className="p-8 text-center text-neutral-400">
                      Loading products...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={29} className="p-8 text-center text-red-600">
                      {error}
                    </td>
                  </tr>
                ) : displayedProducts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={29}
                      className="p-8 text-center text-neutral-400">
                      No products found.
                    </td>
                  </tr>
                ) : (
                  displayedProducts.map((product) => (
                    <tr
                      key={product.id}
                      className="hover:bg-neutral-50 transition-colors text-sm text-neutral-700 border-b border-neutral-200">
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
                      <td className="p-4 align-middle text-sm text-neutral-600 max-w-xs truncate" title={product.description}>{product.description}</td>
                      <td className="p-4 align-middle text-sm text-neutral-600">{product.barcode}</td>
                      <td className="p-4 align-middle text-sm text-neutral-600">{product.hsnCode}</td>
                      <td className="p-4 align-middle text-sm text-neutral-600">{product.unit}</td>
                      <td className="p-4 align-middle text-sm text-neutral-600">{product.sizeName}</td>
                      <td className="p-4 align-middle text-sm text-neutral-600">{product.colorName}</td>
                      <td className="p-4 align-middle text-sm text-neutral-600">{product.attributeName}</td>
                      <td className="p-4 align-middle text-sm text-neutral-600">{product.taxCategory}</td>
                      <td className="p-4 align-middle text-sm text-neutral-600">{product.gst}</td>
                      <td className="p-4 align-middle text-sm text-neutral-800 text-right">{product.purchasePrice}</td>
                      <td className="p-4 align-middle text-sm text-neutral-600 text-right">{product.compareAtPrice}</td>
                      <td className="p-4 align-middle text-sm font-medium text-neutral-800 text-right">{product.price}</td>
                      <td className="p-4 align-middle text-sm text-neutral-600">{product.deliveryTime}</td>
                      <td className="p-4 align-middle text-sm font-bold text-neutral-800 text-right">{product.stock}</td>
                      <td className="p-4 align-middle text-sm text-[#f187b5] text-right">{product.offerPrice > 0 ? product.offerPrice : "-"}</td>
                      <td className="p-4 align-middle text-sm text-neutral-800 text-right">{product.wholesalePrice > 0 ? product.wholesalePrice : "-"}</td>
                      <td className="p-4 align-middle text-sm text-neutral-600 text-center">{product.lowStockQuantity}</td>
                      <td className="p-4 align-middle text-sm text-neutral-600">{product.brand}</td>
                      <td className="p-4 align-middle text-sm text-neutral-600 text-right">{product.valueMrp.toLocaleString()}</td>
                      <td className="p-4 align-middle text-sm text-neutral-600 text-right">{product.valuePurchase.toLocaleString()}</td>

                      <td className="p-4 align-middle text-center">
                          <button
                            onClick={() => handleToggleStatus(product.productId, product.publish)}
                            disabled={!isEnabled}
                            title="Click to toggle status"
                            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all hover:scale-105 active:scale-95 ${product.publish ? 'bg-[#f187b5]/10 text-[#f187b5] hover:bg-[#f187b5]/20' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'} ${!isEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                             {product.publish ? 'Active' : 'Inactive'}
                          </button>
                      </td>
                      <td className="p-4 align-middle">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEdit(product.productId)}
                            disabled={!isEnabled}
                            className={`p-1 rounded ${isEnabled ? 'text-[#f187b5] hover:bg-[#f187b5]/20' : 'text-neutral-400'}`}
                            title="Edit Details">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(product.productId)}
                            disabled={!isEnabled}
                            className={`p-1 rounded ${isEnabled ? 'text-red-600 hover:bg-red-50' : 'text-neutral-400'}`}
                            title="Delete">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                              <line x1="10" y1="11" x2="10" y2="17"></line>
                              <line x1="14" y1="11" x2="14" y2="17"></line>
                            </svg>
                          </button>
                          <button
                            onClick={() => handlePrintBarcode(product.barcode, product.name, product.price, product.compareAtPrice)}
                            className="p-1 text-[#f187b5] hover:bg-[#f187b5]/20 rounded"
                            title="Print Barcode">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 7V5a2 2 0 0 1 2-2h2"></path>
                              <path d="M17 3h2a2 2 0 0 1 2 2v2"></path>
                              <path d="M21 17v2a2 2 0 0 1-2 2h-2"></path>
                              <path d="M7 21H5a2 2 0 0 1-2-2v-2"></path>
                              <rect x="7" y="7" width="3" height="10"></rect>
                              <rect x="14" y="7" width="3" height="10"></rect>
                              <line x1="11" y1="7" x2="11" y2="17"></line>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="px-4 sm:px-6 py-3 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0">
            <div className="text-xs sm:text-sm text-neutral-700">
              Showing {startIndex + 1} to{" "}
              {Math.min(endIndex, sortedProducts.length)} of{" "}
              {sortedProducts.length} entries
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className={`p-2 border border-[#f187b5] rounded ${currentPage === 1
                  ? "text-neutral-400 cursor-not-allowed bg-neutral-50 border-neutral-300"
                  : "text-[#f187b5] hover:bg-[#f187b5]/20"
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
              <button className="px-3 py-1.5 border border-[#f187b5] bg-[#f187b5] text-white rounded font-medium text-sm">
                {currentPage}
              </button>
              <button
                onClick={() =>
                  setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                }
                disabled={currentPage === totalPages}
                className={`p-2 border border-[#f187b5] rounded ${currentPage === totalPages
                  ? "text-neutral-400 cursor-not-allowed bg-neutral-50 border-neutral-300"
                  : "text-[#f187b5] hover:bg-[#f187b5]/20"
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

      {showBulkEdit && (
        <SellerStockBulkEdit
          products={products}
          categories={categories}
          onClose={() => setShowBulkEdit(false)}
          onSave={fetchData}
        />
      )}

      {showBulkImport && (
        <SellerStockBulkImport
           categories={categories}
           onClose={() => setShowBulkImport(false)}
           onSuccess={() => {
              fetchData();
           }}
        />
      )}
    </div>
  );
}
