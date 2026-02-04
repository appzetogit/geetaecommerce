import React, { useState, useEffect } from "react";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface StockBalanceData {
  _id: string;
  name: string;
  variantName: string;
  uom: string;
  sellingPrice: number;
  openingStockQty: number;
  quantity: number;
  hsn: string;
  cess: number;
  gst: number;
  totalSellingPrice: number;
  totalPurchasePrice: number;
  supplier: string;
  category: string;
  subCategory: string;
  purchasePrice: number;
}

type DateFilterType = 'today' | 'tomorrow' | 'last7days' | 'last30days' | 'alltime' | 'custom';

const AdminStockBalanceSummary = () => {
  const [data, setData] = useState<StockBalanceData[]>([]);
  const [filteredData, setFilteredData] = useState<StockBalanceData[]>([]);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilterType, setDateFilterType] = useState<DateFilterType>('alltime');
  const [customDateRange, setCustomDateRange] = useState({ start: "", end: "" });
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("");

  // Dummy data for demonstration
  useEffect(() => {
    const dummyData: StockBalanceData[] = [
      {
        _id: "1",
        name: "Umbrella Chatri",
        variantName: "120cm",
        uom: "Piece",
        sellingPrice: 120,
        purchasePrice: 80,
        openingStockQty: 110,
        quantity: 110,
        hsn: "6601",
        cess: 0,
        gst: 18,
        totalSellingPrice: 13200,
        totalPurchasePrice: 8800,
        supplier: "ABC Suppliers",
        category: "Umbrella",
        subCategory: "Chatri"
      },
      {
        _id: "2",
        name: "Bass Kubdi",
        variantName: "70cm",
        uom: "Piece",
        sellingPrice: 70,
        purchasePrice: 45,
        openingStockQty: 60,
        quantity: 60,
        hsn: "9403",
        cess: 0,
        gst: 12,
        totalSellingPrice: 4200,
        totalPurchasePrice: 2700,
        supplier: "XYZ Traders",
        category: "Cleaning Material",
        subCategory: "Cleaning Material"
      },
      {
        _id: "3",
        name: "Dams Neon Rubber",
        variantName: "Standard",
        uom: "Piece",
        sellingPrice: 60,
        purchasePrice: 40,
        openingStockQty: 50,
        quantity: 50,
        hsn: "4016",
        cess: 0,
        gst: 18,
        totalSellingPrice: 3000,
        totalPurchasePrice: 2000,
        supplier: "ABC Suppliers",
        category: "Stationary",
        subCategory: "Stationary"
      },
      {
        _id: "4",
        name: "BIJI BOOK | FTBI",
        variantName: "A4 Size",
        uom: "Piece",
        sellingPrice: 220,
        purchasePrice: 150,
        openingStockQty: 200,
        quantity: 200,
        hsn: "4820",
        cess: 0,
        gst: 12,
        totalSellingPrice: 44000,
        totalPurchasePrice: 30000,
        supplier: "Book Suppliers",
        category: "Toys",
        subCategory: "Toys"
      }
    ];
    setData(dummyData);
    setFilteredData(dummyData);
  }, []);

  // Filter data based on search and category
  useEffect(() => {
    let filtered = [...data];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.variantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.hsn.includes(searchTerm)
      );
    }

    // Category filter
    if (categoryFilter) {
      filtered = filtered.filter(item => item.category === categoryFilter);
    }

    setFilteredData(filtered);
  }, [searchTerm, categoryFilter, data]);

  const handleCellEdit = (id: string, field: keyof StockBalanceData, value: any) => {
    setFilteredData(prev => prev.map(item =>
      item._id === id ? { ...item, [field]: value } : item
    ));
    setData(prev => prev.map(item =>
      item._id === id ? { ...item, [field]: value } : item
    ));
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRows(new Set(filteredData.map(item => item._id)));
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
    if (type === 'custom') {
      setShowCustomDatePicker(true);
    } else {
      setShowCustomDatePicker(false);
    }
  };

  const downloadExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(filteredData.map(item => ({
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

    const tableData = filteredData.map(item => [
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
      headStyles: { fillColor: [255, 45, 148] }
    });

    doc.save(`Stock_Balance_Summary_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const uniqueCategories = Array.from(new Set(data.map(item => item.category)));

  // Calculate totals
  const totalProducts = filteredData.length;
  const totalQuantity = filteredData.reduce((sum, item) => sum + item.quantity, 0);
  const totalRetail = filteredData.reduce((sum, item) => sum + item.totalSellingPrice, 0);
  const totalPurchase = filteredData.reduce((sum, item) => sum + item.totalPurchasePrice, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header Section */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Stock Balance Summary</h1>
              <p className="text-sm text-gray-500 mt-1">Current stock balance and inventory overview</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setEditMode(!editMode)}
                className="inline-flex items-center px-4 py-2 bg-purple-600 text-white text-sm font-semibold rounded-lg hover:bg-purple-700 active:scale-95 transition-all shadow-sm">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                {editMode ? 'Done Editing' : 'Bulk Edit'}
              </button>

              <button
                onClick={downloadExcel}
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 active:scale-95 transition-all shadow-sm">
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
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}>
              Today
            </button>
            <button
              onClick={() => handleDateFilterChange('tomorrow')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                dateFilterType === 'tomorrow'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}>
              Tomorrow
            </button>
            <button
              onClick={() => handleDateFilterChange('last7days')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                dateFilterType === 'last7days'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}>
              Last 7 Days
            </button>
            <button
              onClick={() => handleDateFilterChange('last30days')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                dateFilterType === 'last30days'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}>
              Last 30 Days
            </button>
            <button
              onClick={() => handleDateFilterChange('alltime')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                dateFilterType === 'alltime'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}>
              All Time
            </button>
            <button
              onClick={() => handleDateFilterChange('custom')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                dateFilterType === 'custom'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-teal-600 hover:bg-teal-50'
              }`}>
              Custom
            </button>
            <button className="p-2 text-teal-600 hover:bg-teal-50 rounded-lg transition-all">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            </button>
          </div>

          {/* Custom Date Range Picker */}
          {showCustomDatePicker && (
            <div className="mt-4 p-4 bg-teal-50 rounded-lg border border-teal-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Start Date</label>
                  <input
                    type="date"
                    value={customDateRange.start}
                    onChange={(e) => setCustomDateRange({ ...customDateRange, start: e.target.value })}
                    className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">End Date</label>
                  <input
                    type="date"
                    value={customDateRange.end}
                    onChange={(e) => setCustomDateRange({ ...customDateRange, end: e.target.value })}
                    className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none transition-all"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Search and Category Filters */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Search</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by product name, variant, category, supplier, or HSN..."
                className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:border-pink-500 focus:ring-2 focus:ring-pink-200 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Category Filter</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:border-teal-500 focus:ring-2 focus:ring-teal-200 outline-none transition-all">
                <option value="">All Categories</option>
                {uniqueCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
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
                  {editMode && (
                    <th className="px-3 py-3 text-left sticky left-0 bg-gray-50 z-10">
                      <input
                        type="checkbox"
                        checked={selectedRows.size === filteredData.length && filteredData.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="w-4 h-4 text-pink-600 rounded border-gray-300 focus:ring-pink-500"
                      />
                    </th>
                  )}
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider sticky left-0 bg-gray-50 z-10">Name</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Variant</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">UOM</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Selling Price</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Opening Stock Qty</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider bg-blue-50">Quantity</th>
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
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={editMode ? 16 : 15} className="px-6 py-12 text-center text-gray-400 text-sm">
                      No stock balance data found
                    </td>
                  </tr>
                ) : (
                  filteredData.map((item) => (
                    <tr key={item._id} className="hover:bg-gray-50 transition-colors">
                      {editMode && (
                        <td className="px-3 py-3 sticky left-0 bg-white">
                          <input
                            type="checkbox"
                            checked={selectedRows.has(item._id)}
                            onChange={() => handleSelectRow(item._id)}
                            className="w-4 h-4 text-pink-600 rounded border-gray-300 focus:ring-pink-500"
                          />
                        </td>
                      )}
                      <td className="px-3 py-3 sticky left-0 bg-white">
                        {editMode ? (
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => handleCellEdit(item._id, 'name', e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none font-semibold"
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
                            className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
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
                            className="w-16 px-2 py-1 text-sm border border-gray-200 rounded focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
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
                            className="w-20 px-2 py-1 text-sm border border-gray-200 rounded focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none font-semibold"
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
                            className="w-20 px-2 py-1 text-sm border border-gray-200 rounded focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
                          />
                        ) : (
                          <span className="text-sm text-gray-700">{item.openingStockQty}</span>
                        )}
                      </td>
                      <td className="px-3 py-3 bg-blue-50">
                        {editMode ? (
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleCellEdit(item._id, 'quantity', parseInt(e.target.value))}
                            className="w-20 px-2 py-1 text-sm border border-gray-200 rounded focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none font-bold text-blue-700"
                          />
                        ) : (
                          <span className="text-sm font-bold text-blue-700">{item.quantity}</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {editMode ? (
                          <input
                            type="text"
                            value={item.hsn}
                            onChange={(e) => handleCellEdit(item._id, 'hsn', e.target.value)}
                            className="w-20 px-2 py-1 text-xs font-mono border border-gray-200 rounded focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
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
                            className="w-16 px-2 py-1 text-sm border border-gray-200 rounded focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
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
                            className="w-16 px-2 py-1 text-sm border border-gray-200 rounded focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
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
                            className="w-24 px-2 py-1 text-sm border border-gray-200 rounded focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none font-semibold text-green-600"
                          />
                        ) : (
                          <span className="text-sm font-semibold text-green-600">₹{item.totalSellingPrice.toLocaleString()}</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {editMode ? (
                          <input
                            type="number"
                            value={item.totalPurchasePrice}
                            onChange={(e) => handleCellEdit(item._id, 'totalPurchasePrice', parseFloat(e.target.value))}
                            className="w-24 px-2 py-1 text-sm border border-gray-200 rounded focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
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
                            className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
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
                            className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
                          />
                        ) : (
                          <span className="text-xs px-2 py-1 bg-teal-100 text-teal-700 rounded-full font-medium">{item.category}</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {editMode ? (
                          <input
                            type="text"
                            value={item.subCategory}
                            onChange={(e) => handleCellEdit(item._id, 'subCategory', e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
                          />
                        ) : (
                          <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full font-medium">{item.subCategory}</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminStockBalanceSummary;
