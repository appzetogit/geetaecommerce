import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  getProducts,
  deleteProduct,
  Product,
  ProductVariation,
} from "../../../services/api/productService";
import {
  getCategories,
  Category as apiCategory,
} from "../../../services/api/categoryService";
import { useAuth } from "../../../context/AuthContext";
import QRScannerModal from "../../../components/QRScannerModal";
import ThemedDropdown from "../components/ThemedDropdown";


// ... (interfaces remain same)

export default function SellerProductList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEnabled = user?.isEnabled !== false;
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All Category");
  const [statusFilter, setStatusFilter] = useState("All Products");
  const [stockFilter, setStockFilter] = useState("All Products");
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(
    new Set()
  );
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [totalPages, setTotalPages] = useState(1);
  const [paginationInfo, setPaginationInfo] = useState<{
    page: number;
    limit: number;
    total: number;
    pages: number;
  } | null>(null);
  const [allCategories, setAllCategories] = useState<apiCategory[]>([]);
  const [showScanner, setShowScanner] = useState(false);

  // Fetch categories
  useEffect(() => {
    const fetchCats = async () => {
      try {
        const response = await getCategories();
        if (response.success && response.data) {
          setAllCategories(response.data);
        }
      } catch (err) {
        console.error("Failed to fetch categories:", err);
      }
    };
    fetchCats();
  }, []);

  // Fetch products
  const fetchProducts = async () => {
    setLoading(true);
    setError("");
    try {
      const params: any = {
        page: currentPage,
        limit: rowsPerPage,
        sortBy: sortColumn || "createdAt",
        sortOrder: sortDirection,
      };

      if (searchTerm) {
        params.search = searchTerm;
      }
      if (categoryFilter !== "All Category") {
        params.category = categoryFilter;
      }
      if (statusFilter === "Published") {
        params.status = "published";
      } else if (statusFilter === "Unpublished") {
        params.status = "unpublished";
      }
      if (stockFilter === "In Stock") {
        params.stock = "inStock";
      } else if (stockFilter === "Out of Stock") {
        params.stock = "outOfStock";
      }

      const response = await getProducts(params);
      if (response.success && response.data) {
        setProducts(response.data);
        // Extract pagination info if available
        if (response.pagination) {
          setTotalPages(response.pagination.pages);
          setPaginationInfo(response.pagination);
        } else {
          // Fallback: calculate pages from data length if pagination not available
          setTotalPages(Math.ceil(response.data.length / rowsPerPage));
          setPaginationInfo(null);
        }
      } else {
        setError(response.message || "Failed to fetch products");
      }
    } catch (err: any) {
      setError(
        err.response?.data?.message || err.message || "Failed to fetch products"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [
    currentPage,
    rowsPerPage,
    searchTerm,
    categoryFilter,
    statusFilter,
    stockFilter,
    sortColumn,
    sortDirection,
  ]);

  const handleDelete = async (productId: string) => {
    try {
      const response = await deleteProduct(productId);
      if (
        response.success ||
        response.message === "Product deleted successfully"
      ) {
        fetchProducts();
      } else {
        console.error("Failed to delete product");
      }
    } catch (error) {
      console.error("Error deleting product:", error);
    }
  };

  const handleEdit = (productId: string) => {
    navigate(`/seller/product/edit/${productId}`);
  };

  const handleScan = (decodedText: string) => {
    setSearchTerm(decodedText);
    setShowScanner(false);
  };

  // ... (rest of logic: flatten, filter, sort)

  // Flatten products with variations for display
  // Handle products with no variations by creating a default variation entry
  const allVariations = products.flatMap((product) => {
    // If product has no variations, create a default one
    if (!product.variations || product.variations.length === 0) {
      return [{
        variationId: `${product._id}-default`,
        productName: product.productName,
        sellerName: user?.storeName || "",
        productImage:
          product.mainImage ||
          product.mainImageUrl ||
          "/assets/product-placeholder.jpg",
        brandName: (product.brand as any)?.name || "-",
        category: (product.category as any)?.name || "-",
        subCategory: (product.subcategory as any)?.name || "-",
        price: (product as any).price || 0,
        discPrice: (product as any).discPrice || 0,
        variation: "Default",
        isPopular: product.popular,
        productId: product._id,
      }];
    }
    // If product has variations, map them
    return product.variations.map((variation, index) => ({
      variationId: variation._id || `${product._id}-${index}`,
      productName: product.productName,
      sellerName: user?.storeName || "",
      productImage:
        product.mainImage ||
        product.mainImageUrl ||
        "/assets/product-placeholder.jpg",
      brandName: (product.brand as any)?.name || "-",
      category: (product.category as any)?.name || "-",
      subCategory: (product.subcategory as any)?.name || "-",
      price: variation.price,
      discPrice: variation.discPrice,
      variation:
        variation.title || variation.value || variation.name || "Default",
      isPopular: product.popular,
      productId: product._id,
    }));
  });

  // Filter variations
  let filteredVariations = allVariations.filter((variation) => {
    const matchesSearch =
      variation.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      variation.sellerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      variation.brandName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      categoryFilter === "All Category" ||
      variation.category === categoryFilter;
    const matchesStatus = statusFilter === "All Products";
    const matchesStock = stockFilter === "All Products";
    return matchesSearch && matchesCategory && matchesStatus && matchesStock;
  });

  // Sort variations
  if (sortColumn) {
    filteredVariations.sort((a, b) => {
      let aVal: any = a[sortColumn as keyof typeof a];
      let bVal: any = b[sortColumn as keyof typeof b];
      if (typeof aVal === "string") {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }
      if (sortDirection === "asc") {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
  }

  // When using API pagination, don't do client-side pagination on already-paginated results
  // The API already returns the correct page of products, so we use all filtered variations
  // Only do client-side pagination if we don't have server-side pagination info
  const useServerPagination = totalPages > 1 && paginationInfo !== null;
  const displayTotalPages = useServerPagination
    ? totalPages
    : Math.ceil(filteredVariations.length / rowsPerPage);

  // Calculate start and end indices for display
  const startIndex = useServerPagination
    ? (paginationInfo!.page - 1) * paginationInfo!.limit
    : (currentPage - 1) * rowsPerPage;
  const endIndex = useServerPagination
    ? Math.min(startIndex + paginationInfo!.limit, paginationInfo!.total)
    : Math.min(currentPage * rowsPerPage, filteredVariations.length);

  // Only slice if NOT using server pagination (i.e., all data is loaded)
  const displayedVariations = useServerPagination
    ? filteredVariations
    : filteredVariations.slice(startIndex, endIndex);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const toggleProduct = (productId: string) => {
    setExpandedProducts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  const SortIcon = ({ column }: { column: string }) => (
    <span className="text-neutral-300 text-[10px]">
      {sortColumn === column ? (sortDirection === "asc" ? "↑" : "↓") : "⇅"}
    </span>
  );

  // Get unique categories for filter
  const categories = allCategories.map((cat) => cat.name);

  return (
    <div className="flex flex-col h-full">
      {/* Page Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-neutral-800 tracking-tight">
            Product List
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Manage your product inventory and variations
          </p>
        </div>
        <div className="text-sm font-medium text-teal-600 bg-teal-50 px-3 py-1 rounded-full border border-teal-100">
           Dashboard / Product List
        </div>
      </div>

      {/* Content Card */}
      <div className="bg-white rounded-xl shadow-sm border border-neutral-200 flex-1 flex flex-col overflow-hidden">
        {!isEnabled && (
          <div className="bg-red-50 border-b border-red-200 p-4">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-500 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="text-red-700 font-medium">
                Your account is currently disabled. You can view product details but cannot edit, delete or change prices.
              </span>
            </div>
          </div>
        )}

        {/* Filters and Controls */}
        <div className="p-5 border-b border-neutral-100 bg-white">
          <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-5">

            {/* Filter Group */}
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              <div className="w-full sm:w-48">
                <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">
                  Category
                </label>
                <ThemedDropdown
                  options={[
                    { id: 'all', label: 'All Category', value: 'All Category' },
                    ...allCategories.map(cat => ({
                      id: cat._id,
                      label: cat.name,
                      value: cat._id
                    }))
                  ]}
                  value={categoryFilter}
                  onChange={setCategoryFilter}
                  placeholder="Filter Category"
                />
              </div>
              <div className="w-full sm:w-40">
                <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">
                  Status
                </label>
                <ThemedDropdown
                  options={['All Products', 'Published', 'Unpublished']}
                  value={statusFilter}
                  onChange={setStatusFilter}
                />
              </div>
              <div className="w-full sm:w-40">
                <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">
                  Stock
                </label>
                <ThemedDropdown
                  options={['All Products', 'In Stock', 'Out of Stock']}
                  value={stockFilter}
                  onChange={setStockFilter}
                />
              </div>
            </div>

            {/* Actions Group */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
              <div className="w-24">
                 <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">
                  Show
                </label>
                <ThemedDropdown
                  options={[10, 20, 50, 100]}
                  value={rowsPerPage}
                  onChange={(val) => setRowsPerPage(Number(val))}
                />
              </div>

              <div className="flex-1 sm:w-64">
                 <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">
                  Search
                </label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-4 w-4 text-neutral-400 group-focus-within:text-teal-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    className="block w-full pl-10 pr-10 py-2.5 border border-neutral-300 rounded-lg text-sm placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all shadow-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by Name, SKU..."
                  />
                  <button
                      onClick={() => setShowScanner(true)}
                      className="absolute inset-y-0 right-0 px-3 flex items-center text-teal-600 bg-teal-50 hover:bg-teal-100 hover:text-teal-700 transition-colors border-l border-neutral-200 rounded-r-lg"
                      title="Scan Barcode"
                  >
                       <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 7V5a2 2 0 0 1 2-2h2"></path>
                          <path d="M17 3h2a2 2 0 0 1 2 2v2"></path>
                          <path d="M21 17v2a2 2 0 0 1-2 2h-2"></path>
                          <path d="M7 21H5a2 2 0 0 1-2-2v-2"></path>
                          <line x1="12" y1="3" x2="12" y2="21"></line>
                       </svg>
                  </button>
                </div>
              </div>

              <button
                onClick={() => {
                  const headers = [
                    "Product Id",
                    "Variation Id",
                    "Product Name",
                    "Seller Name",
                    "Brand Name",
                    "Category",
                    "Price",
                    "Disc Price",
                    "Variation",
                  ];
                  const csvContent = [
                    headers.join(","),
                    ...filteredVariations.map((v) =>
                      [
                        v.productId,
                        v.variationId,
                        `"${v.productName}"`,
                        `"${v.sellerName}"`,
                        `"${v.brandName}"`,
                        `"${v.category}"`,
                        v.price,
                        v.discPrice,
                        `"${v.variation}"`,
                      ].join(",")
                    ),
                  ].join("\n");
                  const blob = new Blob([csvContent], {
                    type: "text/csv;charset=utf-8;",
                  });
                  const link = document.createElement("a");
                  const url = URL.createObjectURL(blob);
                  link.setAttribute("href", url);
                  link.setAttribute(
                    "download",
                    `products_${new Date().toISOString().split("T")[0]}.csv`
                  );
                  link.style.visibility = "hidden";
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="h-[42px] px-4 bg-white border border-neutral-300 text-neutral-700 hover:bg-neutral-50 hover:border-neutral-400 rounded-lg text-sm font-medium flex items-center gap-2 transition-all shadow-sm whitespace-nowrap">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                Export CSV
              </button>
            </div>

             {/* Scanner Modal */}
             {showScanner && (
                <QRScannerModal
                  onScanSuccess={handleScan}
                  onClose={() => setShowScanner(false)}
                />
              )}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="p-8 text-center text-neutral-400">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mx-auto mb-2"></div>
            Loading products...
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="p-8 text-center text-red-600">
            <p>{error}</p>
            <button
              onClick={fetchProducts}
              className="mt-4 px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700">
              Retry
            </button>
          </div>
        )}

        {/* Table */}
        {!loading && !error && (
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-neutral-50/50 border-b border-neutral-200 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                <th className="p-4 w-16 whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    ID
                  </div>
                </th>
                <th
                  className="p-4 cursor-pointer hover:bg-neutral-100 transition-colors whitespace-nowrap"
                  onClick={() => handleSort("variationId")}>
                  <div className="flex items-center gap-1">
                    Var. ID <SortIcon column="variationId" />
                  </div>
                </th>
                <th
                  className="p-4 cursor-pointer hover:bg-neutral-100 transition-colors"
                  onClick={() => handleSort("productName")}>
                  <div className="flex items-center gap-1">
                    Product Name <SortIcon column="productName" />
                  </div>
                </th>
                <th
                  className="p-4 cursor-pointer hover:bg-neutral-100 transition-colors whitespace-nowrap"
                  onClick={() => handleSort("sellerName")}>
                  <div className="flex items-center gap-1">
                    Seller <SortIcon column="sellerName" />
                  </div>
                </th>
                <th className="p-4 text-center">
                  Image
                </th>
                <th
                  className="p-4 cursor-pointer hover:bg-neutral-100 transition-colors whitespace-nowrap"
                  onClick={() => handleSort("brandName")}>
                  <div className="flex items-center gap-1">
                    Brand <SortIcon column="brandName" />
                  </div>
                </th>
                <th
                  className="p-4 cursor-pointer hover:bg-neutral-100 transition-colors whitespace-nowrap"
                  onClick={() => handleSort("category")}>
                  <div className="flex items-center gap-1">
                     Category <SortIcon column="category" />
                  </div>
                </th>
                <th
                  className="p-4 cursor-pointer hover:bg-neutral-100 transition-colors whitespace-nowrap"
                  onClick={() => handleSort("subCategory")}>
                  <div className="flex items-center gap-1">
                    SubCategory <SortIcon column="subCategory" />
                  </div>
                </th>
                <th
                  className="p-4 cursor-pointer hover:bg-neutral-100 transition-colors whitespace-nowrap text-right"
                  onClick={() => handleSort("price")}>
                  <div className="flex items-center justify-end gap-1">
                    Price <SortIcon column="price" />
                  </div>
                </th>
                <th
                  className="p-4 cursor-pointer hover:bg-neutral-100 transition-colors whitespace-nowrap text-right"
                  onClick={() => handleSort("discPrice")}>
                  <div className="flex items-center justify-end gap-1">
                    Disc. <SortIcon column="discPrice" />
                  </div>
                </th>
                <th
                  className="p-4 cursor-pointer hover:bg-neutral-100 transition-colors whitespace-nowrap"
                  onClick={() => handleSort("variation")}>
                  <div className="flex items-center gap-1">
                    Attribute <SortIcon column="variation" />
                  </div>
                </th>
                <th className="p-4 text-center whitespace-nowrap">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {displayedVariations.map((variation, index) => {
                const isFirstVariation =
                  index === 0 ||
                  displayedVariations[index - 1].productId !==
                    variation.productId;
                const product = products.find(
                  (p) => p._id === variation.productId
                );
                const hasMultipleVariations =
                  product && product.variations.length > 1;
                const isExpanded = expandedProducts.has(variation.productId);

                return (
                  <tr
                    key={`${variation.productId}-${variation.variationId}`}
                    className="hover:bg-teal-50/30 transition-colors text-sm text-neutral-700 group">
                    <td className="p-4 align-middle font-medium text-neutral-400 text-xs">
                      <div className="flex items-center gap-2">
                        {isFirstVariation && hasMultipleVariations && (
                          <button
                            onClick={() => toggleProduct(variation.productId)}
                            className="text-neutral-500 hover:text-teal-600 transition-colors">
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round">
                              {isExpanded ? (
                                <polyline points="6 9 12 15 18 9"></polyline>
                              ) : (
                                <polyline points="9 18 15 12 9 6"></polyline>
                              )}
                            </svg>
                          </button>
                        )}
                        <span title={variation.productId} className="truncate max-w-[60px] inline-block">
                            {variation.productId.substring(0, 8)}...
                        </span>
                      </div>
                    </td>
                    <td className="p-4 align-middle text-xs text-neutral-500">
                       <span title={variation.variationId} className="truncate max-w-[60px] inline-block">
                           {variation.variationId.substring(0, 8)}...
                       </span>
                    </td>
                    <td className="p-4 align-middle font-medium text-neutral-800">
                      {variation.productName}
                    </td>
                    <td className="p-4 align-middle text-neutral-600">
                      {variation.sellerName}
                    </td>
                    <td className="p-4 align-middle text-center">
                      <div className="w-12 h-12 bg-white border border-neutral-100 rounded-lg p-1 mx-auto shadow-sm flex items-center justify-center">
                        <img
                          src={variation.productImage}
                          alt={variation.productName}
                          className="max-w-full max-h-full object-contain rounded"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              "https://placehold.co/60x40?text=Img";
                          }}
                        />
                      </div>
                    </td>
                    <td className="p-4 align-middle text-neutral-600">
                      {variation.brandName || "-"}
                    </td>
                    <td className="p-4 align-middle text-neutral-600">
                      <span className="inline-flex px-2 py-1 rounded bg-neutral-100 text-neutral-600 text-xs border border-neutral-200">
                         {variation.category}
                      </span>
                    </td>
                    <td className="p-4 align-middle text-neutral-600 text-xs">
                      {variation.subCategory}
                    </td>
                    <td className="p-4 align-middle text-right font-medium text-neutral-800">
                      ₹{variation.price.toFixed(2)}
                    </td>
                    <td className="p-4 align-middle text-right">
                      {variation.discPrice > 0 ? (
                        <span className="text-green-600 font-medium text-xs bg-green-50 px-1.5 py-0.5 rounded">
                            ₹{variation.discPrice.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-neutral-300">-</span>
                      )}
                    </td>
                    <td className="p-4 align-middle">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                         {variation.variation}
                      </span>
                    </td>
                    <td className="p-4 align-middle">
                      <div className="flex items-center justify-center gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => isEnabled && handleEdit(variation.productId)}
                          disabled={!isEnabled}
                          className={`p-2 rounded-md transition-colors ${
                              isEnabled
                              ? "text-teal-600 bg-teal-50 hover:bg-teal-100"
                              : "text-neutral-400 bg-neutral-50 cursor-not-allowed"
                          }`}
                          title={isEnabled ? "Edit Product" : "Account Disabled"}>
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                          </svg>
                        </button>
                        <button
                          onClick={() => isEnabled && handleDelete(variation.productId)}
                          disabled={!isEnabled}
                          className={`p-2 rounded-md transition-colors ${
                              isEnabled
                              ? "text-red-600 bg-red-50 hover:bg-red-100"
                              : "text-neutral-400 bg-neutral-50 cursor-not-allowed"
                          }`}
                          title={isEnabled ? "Delete Product" : "Account Disabled"}>
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {displayedVariations.length === 0 && (
                <tr>
                   <td colSpan={12} className="p-12 text-center">
                    <div className="flex flex-col items-center justify-center text-neutral-400">
                        <svg className="w-12 h-12 mb-3 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                        </svg>
                        <p className="text-base font-medium text-neutral-600">No products found</p>
                        <p className="text-sm mt-1">Try adjusting your cache search or filters</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        )}

        {/* Pagination Footer */}
        {!loading && !error && (
        <div className="px-6 py-4 border-t border-neutral-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-neutral-50/30">
          <div className="text-sm text-neutral-500 font-medium">
            Showing <span className="text-neutral-800 font-semibold">{startIndex + 1}-{endIndex}</span> of <span className="text-neutral-800 font-semibold">{useServerPagination && paginationInfo ? paginationInfo.total : filteredVariations.length}</span> items
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className={`p-2 rounded-lg border transition-all ${
                currentPage === 1
                  ? "border-neutral-200 text-neutral-300 cursor-not-allowed"
                  : "border-neutral-300 text-neutral-600 hover:bg-white hover:border-teal-500 hover:text-teal-600 shadow-sm"
              }`}
              aria-label="Previous page">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18L9 12L15 6" />
              </svg>
            </button>
            <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, displayTotalPages) }, (_, i) => {
                     // Simple pagination logic for display to avoid too many buttons
                     // Shows first 5 or logic could be more complex, keeping it simple as per original but limited
                     // Actually original showed ALL pages. Let's start with all but maybe safeguard if too many.
                     // For now, mapping up to displayTotalPages as before but with max limit if needed.
                     // To keep it safe and functional like before without full re-write of pagination logic:
                     return i + 1;
                }).map((page) => (
                   <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`min-w-[36px] h-[36px] flex items-center justify-center rounded-lg text-sm font-medium transition-all ${
                      currentPage === page
                        ? "bg-teal-600 text-white shadow-md shadow-teal-200"
                        : "text-neutral-600 hover:bg-neutral-100"
                    }`}>
                    {page}
                  </button>
                ))}
                {displayTotalPages > 5 && <span className="text-neutral-400 px-1">...</span>}
            </div>
            <button
              onClick={() =>
                setCurrentPage((prev) => Math.min(displayTotalPages, prev + 1))
              }
              disabled={currentPage === displayTotalPages}
              className={`p-2 rounded-lg border transition-all ${
                currentPage === displayTotalPages
                  ? "border-neutral-200 text-neutral-300 cursor-not-allowed"
                  : "border-neutral-300 text-neutral-600 hover:bg-white hover:border-teal-500 hover:text-teal-600 shadow-sm"
              }`}
              aria-label="Next page">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18L15 12L9 6" />
              </svg>
            </button>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
