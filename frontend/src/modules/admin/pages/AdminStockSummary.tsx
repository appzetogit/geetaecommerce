import React, { useState, useEffect } from "react";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface StockSummaryData {
  _id: string;
  name: string;
  variantName: string;
  uom: string;
  purchaseValue: number;
  mrp: number;
  sellingPrice: number;
  openingStock: number;
  quantity: number;
  totalDiscountRs: number;
  totalDiscountPercent: number;
  totalMRP: number;
  totalSP: number;
  totalPurchasePrice: number;
  wholesalePrice: number;
  onlineOfferPrice: number;
  lowStockQty: number;
  supplier: string;
  category: string;
  ean: string;
  gst: number;
  hsn: string;
  cess: number;
  brand: string;
  expiryDate: string;
  imageUrl: string;
}

type DateFilterType = 'today' | 'tomorrow' | 'last7days' | 'last30days' | 'alltime' | 'custom';

const AdminStockSummary = () => {
  const [data, setData] = useState<StockSummaryData[]>([]);
  const [filteredData, setFilteredData] = useState<StockSummaryData[]>([]);
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
    const dummyData: StockSummaryData[] = [
      {
        _id: "1",
        name: "Premium Rice",
        variantName: "5kg Pack",
        uom: "kg",
        purchaseValue: 200,
        mrp: 350,
        sellingPrice: 320,
        openingStock: 100,
        quantity: 85,
        totalDiscountRs: 30,
        totalDiscountPercent: 8.57,
        totalMRP: 29750,
        totalSP: 27200,
        totalPurchasePrice: 17000,
        wholesalePrice: 300,
        onlineOfferPrice: 310,
        lowStockQty: 20,
        supplier: "ABC Suppliers",
        category: "Grocery",
        ean: "1234567890123",
        gst: 5,
        hsn: "1006",
        cess: 0,
        brand: "Premium Brand",
        expiryDate: "2026-12-31",
        imageUrl: "/images/rice.jpg"
      },
      {
        _id: "2",
        name: "Cooking Oil",
        variantName: "1L Bottle",
        uom: "ltr",
        purchaseValue: 120,
        mrp: 180,
        sellingPrice: 165,
        openingStock: 150,
        quantity: 120,
        totalDiscountRs: 15,
        totalDiscountPercent: 8.33,
        totalMRP: 21600,
        totalSP: 19800,
        totalPurchasePrice: 14400,
        wholesalePrice: 155,
        onlineOfferPrice: 160,
        lowStockQty: 30,
        supplier: "XYZ Traders",
        category: "Grocery",
        ean: "9876543210987",
        gst: 12,
        hsn: "1507",
        cess: 0,
        brand: "Gold Oil",
        expiryDate: "2026-06-30",
        imageUrl: "/images/oil.jpg"
      },
      {
        _id: "3",
        name: "Wheat Flour",
        variantName: "10kg Bag",
        uom: "kg",
        purchaseValue: 300,
        mrp: 450,
        sellingPrice: 420,
        openingStock: 80,
        quantity: 65,
        totalDiscountRs: 30,
        totalDiscountPercent: 6.67,
        totalMRP: 29250,
        totalSP: 27300,
        totalPurchasePrice: 19500,
        wholesalePrice: 400,
        onlineOfferPrice: 410,
        lowStockQty: 15,
        supplier: "ABC Suppliers",
        category: "Grocery",
        ean: "5551234567890",
        gst: 5,
        hsn: "1101",
        cess: 0,
        brand: "Fresh Flour",
        expiryDate: "2026-09-30",
        imageUrl: "/images/flour.jpg"
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
        item.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.ean.includes(searchTerm)
      );
    }

    // Category filter
    if (categoryFilter) {
      filtered = filtered.filter(item => item.category === categoryFilter);
    }

    setFilteredData(filtered);
  }, [searchTerm, categoryFilter, data]);

  const handleCellEdit = (id: string, field: keyof StockSummaryData, value: any) => {
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
      "Purchase Value": item.purchaseValue,
      "MRP": item.mrp,
      "Selling Price": item.sellingPrice,
      "Opening Stock": item.openingStock,
      "Quantity": item.quantity,
      "Total Discount ₹": item.totalDiscountRs,
      "Total Discount %": item.totalDiscountPercent,
      "Total MRP": item.totalMRP,
      "Total SP": item.totalSP,
      "Total Purchase Price": item.totalPurchasePrice,
      "Wholesale Price": item.wholesalePrice,
      "Online Offer Price": item.onlineOfferPrice,
      "Low Stock Qty": item.lowStockQty,
      "Supplier": item.supplier,
      "Category": item.category,
      "EAN": item.ean,
      "GST": item.gst,
      "HSN": item.hsn,
      "Cess": item.cess,
      "Brand": item.brand,
      "Expiry Date": item.expiryDate
    })));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Stock Summary");
    XLSX.writeFile(workbook, `Stock_Summary_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const downloadPDF = () => {
    const doc = new jsPDF('landscape');

    doc.setFontSize(18);
    doc.text('Stock Summary Report', 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);

    const tableData = filteredData.map(item => [
      item.name,
      item.variantName,
      item.quantity.toString(),
      item.mrp.toString(),
      item.sellingPrice.toString(),
      item.category,
      item.brand
    ]);

    autoTable(doc, {
      head: [['Product', 'Variant', 'Qty', 'MRP', 'SP', 'Category', 'Brand']],
      body: tableData,
      startY: 28,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [255, 45, 148] }
    });

    doc.save(`Stock_Summary_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const uniqueCategories = Array.from(new Set(data.map(item => item.category)));

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header Section */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Stock Summary</h1>
              <p className="text-sm text-gray-500 mt-1">Complete inventory stock overview</p>
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
                placeholder="Search by product name, variant, category, brand, or EAN..."
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

      {/* Table Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Purchase Value</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">MRP</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Selling Price</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Opening Stock</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider bg-blue-50">Quantity</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Discount ₹</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Discount %</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Total MRP</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Total SP</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Total Purchase</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Wholesale</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Online Offer</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Low Stock</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Supplier</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Category</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">EAN</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">GST %</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">HSN</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Cess</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Brand</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Expiry Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={editMode ? 26 : 25} className="px-6 py-12 text-center text-gray-400 text-sm">
                      No stock data found
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
                            value={item.purchaseValue}
                            onChange={(e) => handleCellEdit(item._id, 'purchaseValue', parseFloat(e.target.value))}
                            className="w-20 px-2 py-1 text-sm border border-gray-200 rounded focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
                          />
                        ) : (
                          <span className="text-sm text-gray-700">₹{item.purchaseValue}</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {editMode ? (
                          <input
                            type="number"
                            value={item.mrp}
                            onChange={(e) => handleCellEdit(item._id, 'mrp', parseFloat(e.target.value))}
                            className="w-20 px-2 py-1 text-sm border border-gray-200 rounded focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none font-semibold"
                          />
                        ) : (
                          <span className="text-sm font-semibold text-gray-900">₹{item.mrp}</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {editMode ? (
                          <input
                            type="number"
                            value={item.sellingPrice}
                            onChange={(e) => handleCellEdit(item._id, 'sellingPrice', parseFloat(e.target.value))}
                            className="w-20 px-2 py-1 text-sm border border-gray-200 rounded focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none font-semibold text-green-600"
                          />
                        ) : (
                          <span className="text-sm font-semibold text-green-600">₹{item.sellingPrice}</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {editMode ? (
                          <input
                            type="number"
                            value={item.openingStock}
                            onChange={(e) => handleCellEdit(item._id, 'openingStock', parseInt(e.target.value))}
                            className="w-20 px-2 py-1 text-sm border border-gray-200 rounded focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
                          />
                        ) : (
                          <span className="text-sm text-gray-700">{item.openingStock}</span>
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
                            type="number"
                            value={item.totalDiscountRs}
                            onChange={(e) => handleCellEdit(item._id, 'totalDiscountRs', parseFloat(e.target.value))}
                            className="w-20 px-2 py-1 text-sm border border-gray-200 rounded focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none text-orange-600"
                          />
                        ) : (
                          <span className="text-sm text-orange-600">₹{item.totalDiscountRs}</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {editMode ? (
                          <input
                            type="number"
                            value={item.totalDiscountPercent}
                            onChange={(e) => handleCellEdit(item._id, 'totalDiscountPercent', parseFloat(e.target.value))}
                            className="w-20 px-2 py-1 text-sm border border-gray-200 rounded focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none text-orange-600"
                          />
                        ) : (
                          <span className="text-sm text-orange-600">{item.totalDiscountPercent.toFixed(2)}%</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {editMode ? (
                          <input
                            type="number"
                            value={item.totalMRP}
                            onChange={(e) => handleCellEdit(item._id, 'totalMRP', parseFloat(e.target.value))}
                            className="w-24 px-2 py-1 text-sm border border-gray-200 rounded focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none font-semibold"
                          />
                        ) : (
                          <span className="text-sm font-semibold text-gray-900">₹{item.totalMRP.toLocaleString()}</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {editMode ? (
                          <input
                            type="number"
                            value={item.totalSP}
                            onChange={(e) => handleCellEdit(item._id, 'totalSP', parseFloat(e.target.value))}
                            className="w-24 px-2 py-1 text-sm border border-gray-200 rounded focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none font-semibold text-green-600"
                          />
                        ) : (
                          <span className="text-sm font-semibold text-green-600">₹{item.totalSP.toLocaleString()}</span>
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
                            type="number"
                            value={item.wholesalePrice}
                            onChange={(e) => handleCellEdit(item._id, 'wholesalePrice', parseFloat(e.target.value))}
                            className="w-20 px-2 py-1 text-sm border border-gray-200 rounded focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
                          />
                        ) : (
                          <span className="text-sm text-gray-700">₹{item.wholesalePrice}</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {editMode ? (
                          <input
                            type="number"
                            value={item.onlineOfferPrice}
                            onChange={(e) => handleCellEdit(item._id, 'onlineOfferPrice', parseFloat(e.target.value))}
                            className="w-20 px-2 py-1 text-sm border border-gray-200 rounded focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none text-purple-600"
                          />
                        ) : (
                          <span className="text-sm text-purple-600">₹{item.onlineOfferPrice}</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {editMode ? (
                          <input
                            type="number"
                            value={item.lowStockQty}
                            onChange={(e) => handleCellEdit(item._id, 'lowStockQty', parseInt(e.target.value))}
                            className="w-20 px-2 py-1 text-sm border border-gray-200 rounded focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
                          />
                        ) : (
                          <span className={`text-sm font-medium ${item.quantity <= item.lowStockQty ? 'text-red-600' : 'text-gray-700'}`}>
                            {item.lowStockQty}
                          </span>
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
                            value={item.ean}
                            onChange={(e) => handleCellEdit(item._id, 'ean', e.target.value)}
                            className="w-full px-2 py-1 text-xs font-mono border border-gray-200 rounded focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
                          />
                        ) : (
                          <span className="text-xs font-mono text-gray-600">{item.ean}</span>
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
                            type="text"
                            value={item.brand}
                            onChange={(e) => handleCellEdit(item._id, 'brand', e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
                          />
                        ) : (
                          <span className="text-sm text-gray-700">{item.brand}</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {editMode ? (
                          <input
                            type="date"
                            value={item.expiryDate}
                            onChange={(e) => handleCellEdit(item._id, 'expiryDate', e.target.value)}
                            className="w-full px-2 py-1 text-xs border border-gray-200 rounded focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
                          />
                        ) : (
                          <span className="text-xs text-gray-600">{item.expiryDate}</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Products</p>
            <p className="text-3xl font-black text-gray-900 mt-2">
              {filteredData.length}
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Stock Quantity</p>
            <p className="text-3xl font-black text-blue-600 mt-2">
              {filteredData.reduce((sum, item) => sum + item.quantity, 0)}
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Stock Value (MRP)</p>
            <p className="text-3xl font-black text-green-600 mt-2">
              ₹{filteredData.reduce((sum, item) => sum + item.totalMRP, 0).toLocaleString()}
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Purchase Value</p>
            <p className="text-3xl font-black text-purple-600 mt-2">
              ₹{filteredData.reduce((sum, item) => sum + item.totalPurchasePrice, 0).toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminStockSummary;
