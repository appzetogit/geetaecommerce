import React, { useState, useEffect } from "react";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getStockBalanceSummary, StockBalanceData } from "../../../services/api/seller/sellerInventoryService";
import { getCategories } from "../../../services/api/seller/sellerProductService";
import { toast } from "react-hot-toast";

type DateFilterType = 'today' | 'tomorrow' | 'last7days' | 'last30days' | 'alltime' | 'custom';

const SellerStockBalanceSummary = () => {
  const [data, setData] = useState<StockBalanceData[]>([]);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [dateFilterType, setDateFilterType] = useState<DateFilterType>('alltime');
  const [customDateRange, setCustomDateRange] = useState({ start: "", end: "" });
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [categories, setCategories] = useState<any[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    pages: 1,
    limit: 20
  });

  // Fetch data with full dynamic parameters
  useEffect(() => {
    fetchData();
  }, [pagination.page, pagination.limit, dateFilterType, customDateRange, categoryFilter, debouncedSearchTerm]);

  // Fetch categories for filter
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await getCategories();
        if (response.success) {
          setCategories(response.data);
        }
      } catch (error) {
        console.error("Error fetching categories:", error);
      }
    };
    fetchCategories();
  }, []);

  // Handle search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setPagination(prev => ({ ...prev, page: 1 }));
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params: any = {
        page: pagination.page,
        limit: pagination.limit,
        category: categoryFilter || undefined,
        search: debouncedSearchTerm || undefined,
      };

      // Handle Date Filters
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

      const response = await getStockBalanceSummary(params);
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
      console.error("Error fetching stock balance summary:", error);
      toast.error("Failed to load inventory data");
    } finally {
      setLoading(false);
    }
  };

  const handleCellEdit = (id: string, field: keyof StockBalanceData, value: any) => {
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

  const handleDeleteSelected = () => {
    if (selectedRows.size === 0) return;
    const ok = window.confirm(`Delete ${selectedRows.size} selected item(s)?`);
    if (!ok) return;

    const idSet = new Set(selectedRows);
    setData((prev) => prev.filter((row) => !idSet.has(row._id)));
    setSelectedRows(new Set());
    toast.success("Selected items deleted");
  };

  const handleDateFilterChange = (type: DateFilterType) => {
    setDateFilterType(type);
    if (type === 'custom') {
      setShowCustomDatePicker(true);
    } else {
      setShowCustomDatePicker(false);
    }
  };

  const downloadExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(data.map(item => ({
      "Name": item.name,
      "Variant": item.variantName,
      "UOM": item.uom,
      "Selling Price": item.sellingPrice,
      "Opening Stock Qty": item.openingStockQty,
      "Quantity": item.quantity,
      "HSN": item.hsn,
      "Cess": item.cess,
      "GST": item.gst,
      "Total Selling Price": item.totalSellingPrice,
      "Total Purchase Price": item.totalPurchasePrice,
      "Supplier": item.supplier,
      "Category": item.category,
      "Sub Category": item.subCategory
    })));

    // Handle empty data case for Excel
    if (data.length === 0) {
        const headers = ["Name", "Variant", "UOM", "Selling Price", "Opening Stock Qty", "Quantity", "HSN", "Cess", "GST", "Total Selling Price", "Total Purchase Price", "Supplier", "Category", "Sub Category"];
        XLSX.utils.sheet_add_aoa(worksheet, [headers], { origin: "A1" });
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Stock Balance");
    XLSX.writeFile(workbook, `Stock_Balance_Summary_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const downloadPDF = () => {
    const doc = new jsPDF('landscape');

    doc.setFontSize(18);
    doc.text('Stock Balance Summary Report', 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);

    const tableData = data.map(item => [
      item.name,
      item.variantName,
      item.quantity.toString(),
      item.sellingPrice.toString(),
      item.totalSellingPrice.toString(),
      item.category
    ]);

    autoTable(doc, {
      head: [['Product', 'Variant', 'Qty', 'SP', 'Total SP', 'Category']],
      body: tableData,
      startY: 28,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [241, 135, 181] } // Seller Pink Theme
    });

    doc.save(`Stock_Balance_Summary_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Calculate totals
  const totalProducts = data.length;
  const totalQuantity = data.reduce((sum, item) => sum + item.quantity, 0);
  const totalRetail = data.reduce((sum, item) => sum + item.totalSellingPrice, 0);
  const totalPurchase = data.reduce((sum, item) => sum + item.totalPurchasePrice, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header Section */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Stock Balance Summary</h1>
              <p className="text-sm text-gray-500 mt-1">Current stock balance and inventory overview</p>
            </div>

            <div className="flex flex-wrap gap-2 text-white">
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

          {/* Date Filter Tabs */}
          <div className="mt-4 flex flex-wrap items-center gap-2 bg-gray-50 p-2 rounded-lg">
            <button
              onClick={() => handleDateFilterChange('today')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                dateFilterType === 'today'
                  ? 'bg-white text-[var(--primary-dark)] shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}>
              Today
            </button>
            <button
              onClick={() => handleDateFilterChange('tomorrow')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                dateFilterType === 'tomorrow'
                  ? 'bg-white text-[var(--primary-dark)] shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}>
              Tomorrow
            </button>
            <button
              onClick={() => handleDateFilterChange('last7days')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                dateFilterType === 'last7days'
                  ? 'bg-white text-[var(--primary-dark)] shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}>
              Last 7 Days
            </button>
            <button
              onClick={() => handleDateFilterChange('last30days')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                dateFilterType === 'last30days'
                  ? 'bg-white text-[var(--primary-dark)] shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}>
              Last 30 Days
            </button>
            <button
              onClick={() => handleDateFilterChange('alltime')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                dateFilterType === 'alltime'
                  ? 'bg-white text-[var(--primary-dark)] shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}>
              All Time
            </button>
            <button
              onClick={() => handleDateFilterChange('custom')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                dateFilterType === 'custom'
                  ? 'bg-[var(--primary-dark)] text-white shadow-sm'
                  : 'text-[var(--primary-dark)] hover:bg-[var(--primary-alpha-10)]'
              }`}>
              Custom
            </button>
            <button className="p-2 text-[var(--primary-dark)] hover:bg-[var(--primary-alpha-10)] rounded-lg transition-all">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            </button>
          </div>

          {/* Custom Date Range Picker */}
          {showCustomDatePicker && (
            <div className="mt-4 p-4 bg-[var(--primary-alpha-10)] rounded-lg border border-[var(--primary-alpha-30)]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Start Date</label>
                  <input
                    type="date"
                    value={customDateRange.start}
                    onChange={(e) => setCustomDateRange({ ...customDateRange, start: e.target.value })}
                    className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:border-[var(--primary-color)] focus:ring-2 focus:ring-[var(--primary-alpha-30)] outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">End Date</label>
                  <input
                    type="date"
                    value={customDateRange.end}
                    onChange={(e) => setCustomDateRange({ ...customDateRange, end: e.target.value })}
                    className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:border-[var(--primary-color)] focus:ring-2 focus:ring-[var(--primary-alpha-30)] outline-none transition-all"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Search, Category, and Limit Filters */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Search</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by product name, variant, category, supplier, or HSN..."
                className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:border-[var(--primary-color)] focus:ring-2 focus:ring-[var(--primary-alpha-30)] outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Category Filter</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:border-[var(--primary-color)] focus:ring-2 focus:ring-[var(--primary-alpha-30)] outline-none transition-all">
                  <option value="">All Categories</option>
                  {categories.map(cat => (
                    <option key={cat._id} value={cat._id}>{cat.name}</option>
                  ))}
                </select>
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

      {/* Summary Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-xl shadow-lg text-white">
            <p className="text-xs font-semibold uppercase tracking-wider opacity-90">Total Products (SKU)</p>
            <p className="text-3xl font-black mt-2">{totalProducts}</p>
          </div>

          <div className="bg-gradient-to-br from-teal-500 to-teal-600 p-6 rounded-xl shadow-lg text-white">
            <p className="text-xs font-semibold uppercase tracking-wider opacity-90">Total Products (All)</p>
            <p className="text-3xl font-black mt-2">{totalProducts}</p>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-xl shadow-lg text-white">
            <p className="text-xs font-semibold uppercase tracking-wider opacity-90">Total Retail (SKU)</p>
            <p className="text-2xl font-black mt-2">₹{totalRetail.toLocaleString()}</p>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-xl shadow-lg text-white">
            <p className="text-xs font-semibold uppercase tracking-wider opacity-90">Total Purchase (SKU)</p>
            <p className="text-2xl font-black mt-2">₹{totalPurchase.toLocaleString()}</p>
          </div>

          <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-6 rounded-xl shadow-lg text-white">
            <p className="text-xs font-semibold uppercase tracking-wider opacity-90">Total Quantity (SKU)</p>
            <p className="text-3xl font-black mt-2">{totalQuantity}</p>
          </div>
        </div>

        {/* Table Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                  <th className="px-3 py-3 text-left sticky left-0 bg-gray-50 z-20 w-10">
                    <input
                      type="checkbox"
                      checked={selectedRows.size === data.length && data.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="w-4 h-4 text-[var(--primary-dark)] rounded border-gray-300 focus:ring-[var(--primary-color)]"
                    />
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider sticky left-10 bg-gray-50 z-10">Name</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Variant</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">UOM</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Selling Price</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Opening Stock Qty</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider bg-[var(--primary-alpha-10)]">Quantity</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">HSN</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Cess</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">GST %</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Total Selling Price</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Total Purchase Price</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Supplier</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Category</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Sub Category</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={16} className="px-6 py-24 text-center">
                      <div className="w-10 h-10 border-4 border-[var(--primary-color)] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                      <p className="text-gray-400 font-black text-[10px] uppercase tracking-[0.2em]">Syncing Inventory...</p>
                    </td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan={16} className="px-6 py-12 text-center text-gray-400 text-sm">
                      No stock balance data found
                    </td>
                  </tr>
                ) : (
                  data.map((item) => (
                    <tr key={item._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-3 sticky left-0 bg-white z-10 w-10" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedRows.has(item._id)}
                          onChange={() => handleSelectRow(item._id)}
                          className="w-4 h-4 text-[var(--primary-dark)] rounded border-gray-300 focus:ring-[var(--primary-color)]"
                        />
                      </td>
                      <td className="px-3 py-3 sticky left-10 bg-white">
                        {editMode ? (
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => handleCellEdit(item._id, 'name', e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:border-[var(--primary-color)] focus:ring-1 focus:ring-[var(--primary-color)] outline-none font-semibold"
                          />
                        ) : (
                          <span className="text-sm font-semibold text-gray-900">{item.name}</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {editMode ? (
                          <input
                            type="text"
                            value={item.variantName}
                            onChange={(e) => handleCellEdit(item._id, 'variantName', e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:border-[var(--primary-color)] focus:ring-1 focus:ring-[var(--primary-color)] outline-none"
                          />
                        ) : (
                          <span className="text-sm text-gray-700">{item.variantName}</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {editMode ? (
                          <input
                            type="text"
                            value={item.uom}
                            onChange={(e) => handleCellEdit(item._id, 'uom', e.target.value)}
                            className="w-16 px-2 py-1 text-sm border border-gray-200 rounded focus:border-[var(--primary-color)] focus:ring-1 focus:ring-[var(--primary-color)] outline-none"
                          />
                        ) : (
                          <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-full font-medium">{item.uom}</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {editMode ? (
                          <input
                            type="number"
                            value={item.sellingPrice}
                            onChange={(e) => handleCellEdit(item._id, 'sellingPrice', parseFloat(e.target.value))}
                            className="w-20 px-2 py-1 text-sm border border-gray-200 rounded focus:border-[var(--primary-color)] focus:ring-1 focus:ring-[var(--primary-color)] outline-none font-semibold"
                          />
                        ) : (
                          <span className="text-sm font-semibold text-gray-900">₹{item.sellingPrice}</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {editMode ? (
                          <input
                            type="number"
                            value={item.openingStockQty}
                            onChange={(e) => handleCellEdit(item._id, 'openingStockQty', parseInt(e.target.value))}
                            className="w-20 px-2 py-1 text-sm border border-gray-200 rounded focus:border-[var(--primary-color)] focus:ring-1 focus:ring-[var(--primary-color)] outline-none"
                          />
                        ) : (
                          <span className="text-sm text-gray-700">{item.openingStockQty}</span>
                        )}
                      </td>
                      <td className="px-3 py-3 bg-[var(--primary-alpha-10)]">
                        {editMode ? (
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleCellEdit(item._id, 'quantity', parseInt(e.target.value))}
                            className="w-20 px-2 py-1 text-sm border border-gray-200 rounded focus:border-[var(--primary-color)] focus:ring-1 focus:ring-[var(--primary-color)] outline-none font-bold text-[var(--primary-darker)]"
                          />
                        ) : (
                          <span className="text-sm font-bold text-[var(--primary-darker)]">{item.quantity}</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {editMode ? (
                          <input
                            type="text"
                            value={item.hsn}
                            onChange={(e) => handleCellEdit(item._id, 'hsn', e.target.value)}
                            className="w-20 px-2 py-1 text-xs font-mono border border-gray-200 rounded focus:border-[var(--primary-color)] focus:ring-1 focus:ring-[var(--primary-color)] outline-none"
                          />
                        ) : (
                          <span className="text-xs font-mono text-gray-600">{item.hsn}</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {editMode ? (
                          <input
                            type="number"
                            value={item.cess}
                            onChange={(e) => handleCellEdit(item._id, 'cess', parseFloat(e.target.value))}
                            className="w-16 px-2 py-1 text-sm border border-gray-200 rounded focus:border-[var(--primary-color)] focus:ring-1 focus:ring-[var(--primary-color)] outline-none"
                          />
                        ) : (
                          <span className="text-sm text-gray-700">{item.cess}%</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {editMode ? (
                          <input
                            type="number"
                            value={item.gst}
                            onChange={(e) => handleCellEdit(item._id, 'gst', parseFloat(e.target.value))}
                            className="w-16 px-2 py-1 text-sm border border-gray-200 rounded focus:border-[var(--primary-color)] focus:ring-1 focus:ring-[var(--primary-color)] outline-none"
                          />
                        ) : (
                          <span className="text-sm text-gray-700">{item.gst}%</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {editMode ? (
                          <input
                            type="number"
                            value={item.totalSellingPrice}
                            onChange={(e) => handleCellEdit(item._id, 'totalSellingPrice', parseFloat(e.target.value))}
                            className="w-24 px-2 py-1 text-sm border border-gray-200 rounded focus:border-[var(--primary-color)] focus:ring-1 focus:ring-[var(--primary-color)] outline-none font-semibold text-[var(--primary-dark)]"
                          />
                        ) : (
                          <span className="text-sm font-semibold text-[var(--primary-dark)]">₹{item.totalSellingPrice.toLocaleString()}</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {editMode ? (
                          <input
                            type="number"
                            value={item.totalPurchasePrice}
                            onChange={(e) => handleCellEdit(item._id, 'totalPurchasePrice', parseFloat(e.target.value))}
                            className="w-24 px-2 py-1 text-sm border border-gray-200 rounded focus:border-[var(--primary-color)] focus:ring-1 focus:ring-[var(--primary-color)] outline-none"
                          />
                        ) : (
                          <span className="text-sm text-gray-700">₹{item.totalPurchasePrice.toLocaleString()}</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {editMode ? (
                          <input
                            type="text"
                            value={item.supplier}
                            onChange={(e) => handleCellEdit(item._id, 'supplier', e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:border-[var(--primary-color)] focus:ring-1 focus:ring-[var(--primary-color)] outline-none"
                          />
                        ) : (
                          <span className="text-sm text-gray-700">{item.supplier}</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {editMode ? (
                          <input
                            type="text"
                            value={item.category}
                            onChange={(e) => handleCellEdit(item._id, 'category', e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:border-[var(--primary-color)] focus:ring-1 focus:ring-[var(--primary-color)] outline-none"
                          />
                        ) : (
                          <span className="text-xs px-2 py-1 bg-[var(--primary-alpha-20)] text-[var(--primary-darker)] rounded-full font-medium">{item.category}</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {editMode ? (
                          <input
                            type="text"
                            value={item.subCategory}
                            onChange={(e) => handleCellEdit(item._id, 'subCategory', e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:border-[var(--primary-color)] focus:ring-1 focus:ring-[var(--primary-color)] outline-none"
                          />
                        ) : (
                          <span className="text-xs px-2 py-1 bg-[var(--primary-alpha-20)] text-[var(--primary-darker)] rounded-full font-medium">{item.subCategory}</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Search status summary info */}
        <div className="mt-4 text-center">
           <p className="text-xs text-gray-400 font-medium">Search is case-insensitive (Matches Name, SKU, Barcode, HSN)</p>
        </div>

        {/* Pagination Controls */}
        {pagination.pages > 1 && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <div className="text-xs font-black text-gray-400 uppercase tracking-widest">
              Showing <span className="text-[var(--primary-dark)]">{data.length}</span> of <span className="text-[var(--primary-dark)]">{pagination.total}</span> Records
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={pagination.page === 1}
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                className="p-2 border border-gray-100 rounded-xl hover:bg-gray-50 disabled:opacity-30 transition-all font-black text-[var(--primary-dark)]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M15 18l-6-6 6-6"/></svg>
              </button>

              <div className="flex items-center gap-1">
                {[...Array(pagination.pages)].map((_, i) => {
                  const p = i + 1;
                  if (pagination.pages > 7) {
                    if (p !== 1 && p !== pagination.pages && Math.abs(p - pagination.page) > 1) {
                      if (p === 2 || p === pagination.pages - 1) return <span key={p} className="px-1 text-gray-300">...</span>;
                      return null;
                    }
                  }
                  return (
                    <button
                      key={p}
                      onClick={() => setPagination(prev => ({ ...prev, page: p }))}
                      className={`w-9 h-9 flex items-center justify-center rounded-xl text-xs font-black transition-all ${pagination.page === p ? 'bg-[var(--primary-dark)] text-white shadow-lg shadow-seller-200' : 'hover:bg-[var(--primary-alpha-10)] text-gray-500'}`}>
                      {p}
                    </button>
                  );
                })}
              </div>

              <button
                disabled={pagination.page === pagination.pages}
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                className="p-2 border border-gray-100 rounded-xl hover:bg-gray-50 disabled:opacity-30 transition-all font-black text-[var(--primary-dark)]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M9 18l6-6-6-6"/></svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SellerStockBalanceSummary;
