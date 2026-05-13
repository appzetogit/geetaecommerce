import React, { useState, useEffect } from "react";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getLossSummary, createLossRecord, deleteLossRecord, LossData } from "../../../services/api/seller/sellerInventoryService";
import { getProducts, Product } from "../../../services/api/seller/sellerProductService";
import { toast } from "react-hot-toast";

type DateFilterType = 'today' | 'tomorrow' | 'last7days' | 'last30days' | 'alltime' | 'custom';

const SellerLossSummary = () => {
  const [data, setData] = useState<LossData[]>([]);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [dateFilterType, setDateFilterType] = useState<DateFilterType>('alltime');
  const [customDateRange, setCustomDateRange] = useState({ start: "", end: "" });
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [showAddLossModal, setShowAddLossModal] = useState(false);

  // Pagination State
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    pages: 1,
    limit: 20
  });

  // Add Loss Form State
  const [newLoss, setNewLoss] = useState<{
    date: string;
    productId: string;
    productName: string;
    weight: string;
    quantity: number;
    reason: string;
    variationId?: string;
  }>({
    date: new Date().toISOString().split('T')[0],
    productId: "",
    productName: "",
    weight: "Piece",
    quantity: 0,
    reason: "Missing",
    variationId: undefined
  });

  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState("");

  // Fetch loss data
  useEffect(() => {
    fetchData();
  }, [pagination.page, pagination.limit, dateFilterType, customDateRange, debouncedSearchTerm]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setPagination(prev => ({ ...prev, page: 1 }));
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch products for the modal
  useEffect(() => {
    if (showAddLossModal) {
      const fetchProductsForPicker = async () => {
        try {
          const res = await getProducts({ limit: 100, search: productSearch });
          if (res.success) {
            setProducts(res.data);
          }
        } catch (error) {
          console.error("Error fetching products:", error);
        }
      };
      const timer = setTimeout(fetchProductsForPicker, 300);
      return () => clearTimeout(timer);
    }
  }, [showAddLossModal, productSearch]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params: any = {
        page: pagination.page,
        limit: pagination.limit,
        search: debouncedSearchTerm || undefined,
      };

      const now = new Date();
      if (dateFilterType === 'today') {
        params.dateFrom = new Date(now.setHours(0, 0, 0, 0)).toISOString();
        params.dateTo = new Date(now.setHours(23, 59, 59, 999)).toISOString();
      } else if (dateFilterType === 'last7days') {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        params.dateFrom = d.toISOString();
      } else if (dateFilterType === 'last30days') {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        params.dateFrom = d.toISOString();
      } else if (dateFilterType === 'custom' && customDateRange.start && customDateRange.end) {
        params.dateFrom = new Date(customDateRange.start).toISOString();
        params.dateTo = new Date(new Date(customDateRange.end).setHours(23, 59, 59, 999)).toISOString();
      }

      const response = await getLossSummary(params);
      if (response.success) {
        setData(response.data);
        if (response.pagination) {
          setPagination(prev => ({
            ...prev,
            total: response.pagination!.total,
            pages: response.pagination!.pages
          }));
        }
      }
    } catch (error) {
      console.error("Error fetching loss summary:", error);
      toast.error("Failed to fetch loss records");
    } finally {
      setLoading(false);
    }
  };

  const handleCellEdit = (id: string, field: keyof LossData, value: any) => {
    setData(prev => prev.map(item =>
      item._id === id ? { ...item, [field]: value } : item
    ));
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRows(new Set(data.map(item => item._id)));
    } else {
      setSelectedRows(new Set());
    }
  };

  const handleSelectRow = (id: string) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedRows(newSelected);
  };

  const handleDateFilterChange = (type: DateFilterType) => {
    setDateFilterType(type);
    setPagination(prev => ({ ...prev, page: 1 }));
    setShowCustomDatePicker(type === 'custom');
  };

  const handleDeleteSelected = async () => {
    if (selectedRows.size === 0) return;
    const ok = window.confirm(`Delete ${selectedRows.size} selected item(s)?`);
    if (!ok) return;

    const ids = Array.from(selectedRows);
    const idSet = new Set(ids);

    try {
      const failed: string[] = [];
      for (const id of ids) {
        try {
          await deleteLossRecord(id);
        } catch (e: any) {
          if (e?.response?.status !== 404) failed.push(id);
        }
      }

      setData((prev) => prev.filter((row) => !idSet.has(row._id)));
      setSelectedRows(new Set());

      if (failed.length > 0) toast.error(`Failed to delete ${failed.length} item(s)`);
      else toast.success("Selected items deleted");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.response?.data?.message || "Failed to delete items");
    }
  };

  const handleAddLoss = async () => {
    try {
      if (!newLoss.productId || newLoss.quantity <= 0) {
        toast.error("Please select a product and valid quantity");
        return;
      }

      setLoading(true);
      const res = await createLossRecord(newLoss);
      if (res.success) {
        toast.success("Loss record added successfully");
        setShowAddLossModal(false);
        fetchData();
        // Reset form
        setNewLoss({
          date: new Date().toISOString().split('T')[0],
          productId: "",
          productName: "",
          weight: "Piece",
          quantity: 0,
          reason: "Missing"
        });
      }
    } catch (error) {
      console.error("Error adding loss:", error);
      toast.error("Failed to add loss record");
    } finally {
      setLoading(false);
    }
  };

  const downloadExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(data.map(item => ({
      "Date": new Date(item.date).toLocaleDateString(),
      "Product Name": item.productName,
      "Weight/UOM": item.weight,
      "Quantity": item.quantity,
      "Reason": item.reason
    })));

    // Handle empty data case for Excel
    if (data.length === 0) {
        const headers = ["Date", "Product Name", "Weight/UOM", "Quantity", "Reason"];
        XLSX.utils.sheet_add_aoa(worksheet, [headers], { origin: "A1" });
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Loss Summary");
    XLSX.writeFile(workbook, `Loss_Summary_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const downloadPDF = () => {
    const doc = new jsPDF('landscape');
    doc.setFontSize(18);
    doc.text('Loss Summary Report', 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);

    const tableData = data.map(item => [
      new Date(item.date).toLocaleDateString(),
      item.productName,
      item.weight,
      item.quantity.toString(),
      item.reason
    ]);

    autoTable(doc, {
      head: [['Date', 'Product Name', 'Weight/UOM', 'Quantity', 'Reason']],
      body: tableData,
      startY: 28,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [241, 135, 181] } // Seller Pink Theme
    });

    doc.save(`Loss_Summary_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header Section */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Loss Summary</h1>
              <p className="text-sm text-gray-500 mt-1">Track and manage inventory losses</p>
            </div>

            <div className="flex flex-wrap gap-2 text-white">
              <button
                onClick={() => setShowAddLossModal(true)}
                className="inline-flex items-center px-4 py-2 bg-[var(--primary-dark)] text-white text-sm font-semibold rounded-lg hover:bg-[var(--primary-darker)] active:scale-95 transition-all shadow-sm">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                Add Loss
              </button>

              <button
                onClick={() => setEditMode(!editMode)}
                className={`inline-flex items-center px-4 py-2 text-white text-sm font-semibold rounded-lg active:scale-95 transition-all shadow-sm ${editMode ? 'bg-[var(--primary-dark)]' : 'bg-[var(--primary-color)] hover:bg-[var(--primary-dark)]'}`}>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                {editMode ? 'Done Editing' : 'Bulk Edit'}
              </button>

              <button
                onClick={handleDeleteSelected}
                disabled={selectedRows.size === 0}
                className="inline-flex items-center px-4 py-2 bg-rose-600 text-white text-sm font-semibold rounded-lg hover:bg-rose-700 active:scale-95 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete{selectedRows.size > 0 ? ` (${selectedRows.size})` : ""}
              </button>

              <button
                onClick={downloadExcel}
                className="inline-flex items-center px-4 py-2 bg-[var(--primary-dark)] text-white text-sm font-semibold rounded-lg hover:bg-[var(--primary-darker)] active:scale-95 transition-all shadow-sm">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Excel
              </button>

              <button
                onClick={downloadPDF}
                className="inline-flex items-center px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 active:scale-95 transition-all shadow-sm">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                PDF
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 bg-gray-50 p-2 rounded-lg">
            {(['today', 'tomorrow', 'last7days', 'last30days', 'alltime'] as DateFilterType[]).map(type => (
              <button
                key={type}
                onClick={() => handleDateFilterChange(type)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  dateFilterType === type
                    ? 'bg-white text-[var(--primary-dark)] shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                }`}>
                {type.charAt(0).toUpperCase() + type.slice(1).replace(/(\d)/, ' $1')}
              </button>
            ))}
            <button
              onClick={() => handleDateFilterChange('custom')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                dateFilterType === 'custom' ? 'bg-[var(--primary-dark)] text-white shadow-sm' : 'text-[var(--primary-dark)] hover:bg-[var(--primary-alpha-10)]'
              }`}>
              Custom
            </button>
          </div>

          {showCustomDatePicker && (
            <div className="mt-4 p-4 bg-[var(--primary-alpha-10)] rounded-lg border border-[var(--primary-alpha-30)]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Start Date</label>
                  <input
                    type="date"
                    value={customDateRange.start}
                    onChange={(e) => setCustomDateRange({ ...customDateRange, start: e.target.value })}
                    className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-alpha-30)] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">End Date</label>
                  <input
                    type="date"
                    value={customDateRange.end}
                    onChange={(e) => setCustomDateRange({ ...customDateRange, end: e.target.value })}
                    className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--primary-alpha-30)] outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Search and Limit Filters */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Search</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by product name, reason, or SKU..."
                className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:border-[var(--primary-color)] focus:ring-2 focus:ring-[var(--primary-alpha-30)] outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 px-1">Show per page</label>
              <select
                value={pagination.limit}
                onChange={(e) => setPagination(prev => ({ ...prev, limit: Number(e.target.value), page: 1 }))}
                className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:border-[var(--primary-color)] focus:ring-2 focus:ring-[var(--primary-alpha-30)] outline-none transition-all"
              >
                {[10, 20, 50, 100, 500].map(val => (
                  <option key={val} value={val}>{val}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                  <th className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedRows.size === data.length && data.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                  </th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-600 uppercase">Date</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-600 uppercase">Product Name</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-600 uppercase">Weight/UOM</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-600 uppercase bg-[var(--primary-alpha-10)]/50">Quantity</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-600 uppercase">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-500">Syncing Loss Records...</td></tr>
                ) : data.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400">No loss records found</td></tr>
                ) : (
                  data.map((item) => (
                    <tr key={item._id} className="hover:bg-gray-50/30 transition-colors">
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedRows.has(item._id)}
                          onChange={() => handleSelectRow(item._id)}
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600">{new Date(item.date).toLocaleDateString()}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">{item.productName}</td>
                      <td className="px-4 py-3"><span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">{item.weight}</span></td>
                      <td className="px-4 py-3 bg-[var(--primary-alpha-20)]/30 text-[var(--primary-darker)] font-bold">{item.quantity}</td>
                      <td className="px-4 py-3"><span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">{item.reason}</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {pagination.pages > 1 && (
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div className="text-sm text-gray-500">
                Showing page <span className="font-semibold">{pagination.page}</span> of <span className="font-semibold">{pagination.pages}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                  disabled={pagination.page === 1}
                  className="px-3 py-1 bg-white border border-gray-300 rounded shadow-sm disabled:opacity-50">
                  Previous
                </button>
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: Math.min(pagination.pages, prev.page + 1) }))}
                  disabled={pagination.page === pagination.pages}
                  className="px-3 py-1 bg-white border border-gray-300 rounded shadow-sm disabled:opacity-50">
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <p className="text-xs font-bold text-gray-400 uppercase">Total Records</p>
            <p className="text-3xl font-black text-[var(--primary-dark)] mt-2">{pagination.total}</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <p className="text-xs font-bold text-gray-400 uppercase">Total Items Lost</p>
            <p className="text-3xl font-black text-orange-600 mt-2">{data.reduce((sum, item) => sum + item.quantity, 0)}</p>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <p className="text-xs font-bold text-gray-400 uppercase">Unique Products Affected</p>
            <p className="text-3xl font-black text-[var(--primary-dark)] mt-2">{new Set(data.map(item => item.productName)).size}</p>
          </div>
        </div>
      </div>

      {showAddLossModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-[var(--primary-color)] to-[var(--primary-dark)] text-white flex items-center justify-between">
              <h2 className="text-xl font-bold">Record Inventory Loss</h2>
              <button onClick={() => setShowAddLossModal(false)} className="hover:rotate-90 transition-transform"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Select Product</label>
                <div className="relative">
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      value={productSearch}
                      onChange={(e) => {
                        setProductSearch(e.target.value);
                        if (!e.target.value) {
                          setNewLoss({ ...newLoss, productId: "", productName: "", weight: "Piece", variationId: undefined });
                        }
                      }}
                      placeholder="Search product..."
                      className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-[var(--primary-alpha-30)]"
                    />
                    {newLoss.productId && (
                      <button
                        onClick={() => {
                          setNewLoss({ ...newLoss, productId: "", productName: "", weight: "Piece", variationId: undefined });
                          setProductSearch("");
                          setProducts([]);
                        }}
                        className="absolute right-3 text-gray-400 hover:text-red-500"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                  {productSearch && !newLoss.productId && products.length > 0 && (
                    <div className="absolute top-full left-0 right-0 max-h-48 overflow-y-auto bg-white border border-gray-200 rounded-lg z-50 shadow-xl mt-1">
                      {products.map(p => (
                        <div
                          key={p._id}
                          onClick={() => {
                            setNewLoss({
                              ...newLoss,
                              productId: p._id,
                              productName: p.productName,
                              weight: p.pack || "Piece"
                            });
                            setProductSearch(p.productName);
                            setProducts([]);
                          }}
                          className="px-4 py-2 hover:bg-[var(--primary-alpha-10)] cursor-pointer text-sm border-b last:border-0 flex justify-between items-center">
                          <span>{p.productName} <span className="text-xs text-gray-400">({p.sku})</span></span>
                          <span className="text-xs font-bold text-[var(--primary-dark)]">Stock: {p.stock}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {newLoss.productId && products.find(p => p._id === newLoss.productId)?.variations &&
               products.find(p => p._id === newLoss.productId)!.variations!.length > 0 && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Select Variation</label>
                  <select
                    value={newLoss.variationId || ""}
                    onChange={(e) => setNewLoss({ ...newLoss, variationId: e.target.value })}
                    className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-[var(--primary-alpha-30)]">
                    <option value="">Choose a variation...</option>
                    {products.find(p => p._id === newLoss.productId)!.variations!.map(v => (
                      <option key={v._id} value={v._id}>
                        {v.name} {v.value} (Stock: {v.stock})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Quantity</label>
                  <input
                    type="number"
                    value={newLoss.quantity || ''}
                    onChange={(e) => setNewLoss({ ...newLoss, quantity: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-[var(--primary-alpha-30)]"
                    min="1"
                  />
                  {newLoss.productId && (
                    <p className="text-[10px] text-gray-500 mt-1">
                      Max available: {
                        newLoss.variationId
                          ? products.find(p => p._id === newLoss.productId)?.variations?.find(v => v._id === newLoss.variationId)?.stock || 0
                          : products.find(p => p._id === newLoss.productId)?.stock || 0
                      }
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Reason</label>
                  <select
                    value={newLoss.reason}
                    onChange={(e) => setNewLoss({ ...newLoss, reason: e.target.value })}
                    className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-[var(--primary-alpha-30)]">
                    {["Missing", "Damaged", "Expired", "Theft", "Broken", "Other"].map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Loss Date</label>
                <input
                  type="date"
                  value={newLoss.date}
                  onChange={(e) => setNewLoss({ ...newLoss, date: e.target.value })}
                  className="w-full px-4 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-[var(--primary-alpha-30)]"
                />
              </div>
            </div>

            <div className="p-6 bg-gray-50 flex gap-3">
              <button onClick={() => setShowAddLossModal(false)} className="flex-1 py-2 text-gray-600 font-bold hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
              <button
                onClick={handleAddLoss}
                disabled={!newLoss.productId || newLoss.quantity <= 0 || loading}
                className="flex-1 py-2 bg-[var(--primary-dark)] text-white font-bold rounded-lg hover:bg-[var(--primary-darker)] transition-colors disabled:opacity-50">
                {loading ? 'Processing...' : 'Add Loss Record'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SellerLossSummary;
