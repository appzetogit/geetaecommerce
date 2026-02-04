import React, { useState, useEffect } from "react";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface StockSalesData {
  _id: string;
  itemName: string;
  variantName: string;
  uom: string;
  hsn: string;
  cess: string;
  gst: string;
  category: string;
  unitsSold: number;
  purchasePrice: number;
  sellingPrice: number;
  totalSellingPrice: number;
  profit: number;
  salesman: string;
  date: string;
}

type DateFilterType = 'today' | 'tomorrow' | 'last7days' | 'last30days' | 'alltime' | 'custom';

const AdminStockSalesSummary = () => {
  const [data, setData] = useState<StockSalesData[]>([]);
  const [filteredData, setFilteredData] = useState<StockSalesData[]>([]);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [dateFilterType, setDateFilterType] = useState<DateFilterType>('alltime');
  const [customDateRange, setCustomDateRange] = useState({ start: "", end: "" });
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);

  // Dummy data for demonstration
  useEffect(() => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);

    const dummyData: StockSalesData[] = [
      {
        _id: "1",
        itemName: "barten kucha 20",
        variantName: "Piece",
        uom: "-",
        hsn: "-",
        cess: "-",
        gst: "-",
        category: "Home Decor",
        unitsSold: 1,
        purchasePrice: 7,
        sellingPrice: 20,
        totalSellingPrice: 20,
        profit: 13,
        salesman: "9.18E+11",
        date: today.toISOString().split('T')[0]
      },
      {
        _id: "2",
        itemName: "spring 2000mm",
        variantName: "Piece",
        uom: "-",
        hsn: "-",
        cess: "-",
        gst: "-",
        category: "electronic",
        unitsSold: 1,
        purchasePrice: 28,
        sellingPrice: 40,
        totalSellingPrice: 40,
        profit: 12,
        salesman: "9.18E+11",
        date: yesterday.toISOString().split('T')[0]
      },
      {
        _id: "3",
        itemName: "ribba dofluxo m555 20",
        variantName: "Piece",
        uom: "-",
        hsn: "-",
        cess: "-",
        gst: "-",
        category: "Home Decor",
        unitsSold: 1,
        purchasePrice: 35,
        sellingPrice: 80,
        totalSellingPrice: 80,
        profit: 45,
        salesman: "9.18E+11",
        date: lastWeek.toISOString().split('T')[0]
      }
    ];
    setData(dummyData);
    setFilteredData(dummyData);
  }, []);

  // Filter data based on search, category, and date
  useEffect(() => {
    let filtered = [...data];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Category filter
    if (categoryFilter) {
      filtered = filtered.filter(item => item.category === categoryFilter);
    }

    // Date filter
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (dateFilterType) {
      case 'today':
        filtered = filtered.filter(item => {
          const itemDate = new Date(item.date);
          itemDate.setHours(0, 0, 0, 0);
          return itemDate.getTime() === today.getTime();
        });
        break;
      case 'tomorrow':
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        filtered = filtered.filter(item => {
          const itemDate = new Date(item.date);
          itemDate.setHours(0, 0, 0, 0);
          return itemDate.getTime() === tomorrow.getTime();
        });
        break;
      case 'last7days':
        const last7Days = new Date(today);
        last7Days.setDate(last7Days.getDate() - 7);
        filtered = filtered.filter(item => {
          const itemDate = new Date(item.date);
          return itemDate >= last7Days && itemDate <= today;
        });
        break;
      case 'last30days':
        const last30Days = new Date(today);
        last30Days.setDate(last30Days.getDate() - 30);
        filtered = filtered.filter(item => {
          const itemDate = new Date(item.date);
          return itemDate >= last30Days && itemDate <= today;
        });
        break;
      case 'custom':
        if (customDateRange.start && customDateRange.end) {
          filtered = filtered.filter(item => {
            const itemDate = new Date(item.date);
            return itemDate >= new Date(customDateRange.start) && itemDate <= new Date(customDateRange.end);
          });
        }
        break;
      case 'alltime':
      default:
        // No date filtering
        break;
    }

    setFilteredData(filtered);
  }, [searchTerm, categoryFilter, dateFilterType, customDateRange, data]);

  const handleCellEdit = (id: string, field: keyof StockSalesData, value: any) => {
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
      "Item Name": item.itemName,
      "Variant Name": item.variantName,
      "UOM": item.uom,
      "HSN": item.hsn,
      "Cess": item.cess,
      "GST": item.gst,
      "Category": item.category,
      "Units Sold": item.unitsSold,
      "Purchase Price": item.purchasePrice,
      "Selling Price": item.sellingPrice,
      "Total Selling Price": item.totalSellingPrice,
      "Profit": item.profit,
      "Salesman": item.salesman
    })));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Stock Sales Summary");
    XLSX.writeFile(workbook, `Stock_Sales_Summary_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const downloadPDF = () => {
    const doc = new jsPDF('landscape');

    doc.setFontSize(18);
    doc.text('Stock Sales Summary Report', 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);

    const tableData = filteredData.map(item => [
      item.itemName,
      item.variantName,
      item.category,
      item.unitsSold.toString(),
      item.purchasePrice.toString(),
      item.sellingPrice.toString(),
      item.totalSellingPrice.toString(),
      item.profit.toString()
    ]);

    autoTable(doc, {
      head: [['Item', 'Variant', 'Category', 'Units Sold', 'Purchase', 'Selling', 'Total', 'Profit']],
      body: tableData,
      startY: 28,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [255, 45, 148] }
    });

    doc.save(`Stock_Sales_Summary_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const categories = Array.from(new Set(data.map(item => item.category)));

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header Section */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Stock Sales Summary</h1>
              <p className="text-sm text-gray-500 mt-1">Track product-wise sales performance and profitability</p>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Search</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by item name or category..."
                className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:border-pink-500 focus:ring-2 focus:ring-pink-200 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Category Filter</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:border-pink-500 focus:ring-2 focus:ring-pink-200 outline-none transition-all bg-white">
                <option value="">All Categories</option>
                {categories.map(cat => (
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
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {editMode && (
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedRows.size === filteredData.length && filteredData.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="w-4 h-4 text-pink-600 rounded border-gray-300 focus:ring-pink-500"
                      />
                    </th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Item Name</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Variant</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">UOM</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">HSN</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Cess</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">GST</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Units Sold</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Purchase Price</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Selling Price</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Total Selling</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Profit</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Salesman</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={editMode ? 14 : 13} className="px-6 py-12 text-center text-gray-400 text-sm">
                      No stock sales data found
                    </td>
                  </tr>
                ) : (
                  filteredData.map((item) => (
                    <tr key={item._id} className="hover:bg-gray-50 transition-colors">
                      {editMode && (
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedRows.has(item._id)}
                            onChange={() => handleSelectRow(item._id)}
                            className="w-4 h-4 text-pink-600 rounded border-gray-300 focus:ring-pink-500"
                          />
                        </td>
                      )}
                      <td className="px-4 py-3">
                        {editMode ? (
                          <input
                            type="text"
                            value={item.itemName}
                            onChange={(e) => handleCellEdit(item._id, 'itemName', e.target.value)}
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
                          />
                        ) : (
                          <span className="text-sm font-medium text-gray-900">{item.itemName}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editMode ? (
                          <input
                            type="text"
                            value={item.variantName}
                            onChange={(e) => handleCellEdit(item._id, 'variantName', e.target.value)}
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
                          />
                        ) : (
                          <span className="text-sm text-gray-600">{item.variantName}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editMode ? (
                          <input
                            type="text"
                            value={item.uom}
                            onChange={(e) => handleCellEdit(item._id, 'uom', e.target.value)}
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
                          />
                        ) : (
                          <span className="text-sm text-gray-500">{item.uom}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editMode ? (
                          <input
                            type="text"
                            value={item.hsn}
                            onChange={(e) => handleCellEdit(item._id, 'hsn', e.target.value)}
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
                          />
                        ) : (
                          <span className="text-sm text-gray-500">{item.hsn}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editMode ? (
                          <input
                            type="text"
                            value={item.cess}
                            onChange={(e) => handleCellEdit(item._id, 'cess', e.target.value)}
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
                          />
                        ) : (
                          <span className="text-sm text-gray-500">{item.cess}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editMode ? (
                          <input
                            type="text"
                            value={item.gst}
                            onChange={(e) => handleCellEdit(item._id, 'gst', e.target.value)}
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
                          />
                        ) : (
                          <span className="text-sm text-gray-500">{item.gst}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editMode ? (
                          <input
                            type="text"
                            value={item.category}
                            onChange={(e) => handleCellEdit(item._id, 'category', e.target.value)}
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
                          />
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                            {item.category}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editMode ? (
                          <input
                            type="number"
                            value={item.unitsSold}
                            onChange={(e) => handleCellEdit(item._id, 'unitsSold', parseInt(e.target.value))}
                            className="w-20 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
                          />
                        ) : (
                          <span className="text-sm font-semibold text-gray-900">{item.unitsSold}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editMode ? (
                          <input
                            type="number"
                            value={item.purchasePrice}
                            onChange={(e) => handleCellEdit(item._id, 'purchasePrice', parseFloat(e.target.value))}
                            className="w-24 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
                          />
                        ) : (
                          <span className="text-sm text-gray-700">₹{item.purchasePrice}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editMode ? (
                          <input
                            type="number"
                            value={item.sellingPrice}
                            onChange={(e) => handleCellEdit(item._id, 'sellingPrice', parseFloat(e.target.value))}
                            className="w-24 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
                          />
                        ) : (
                          <span className="text-sm text-gray-700">₹{item.sellingPrice}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editMode ? (
                          <input
                            type="number"
                            value={item.totalSellingPrice}
                            onChange={(e) => handleCellEdit(item._id, 'totalSellingPrice', parseFloat(e.target.value))}
                            className="w-24 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
                          />
                        ) : (
                          <span className="text-sm font-semibold text-gray-900">₹{item.totalSellingPrice}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editMode ? (
                          <input
                            type="number"
                            value={item.profit}
                            onChange={(e) => handleCellEdit(item._id, 'profit', parseFloat(e.target.value))}
                            className="w-24 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
                          />
                        ) : (
                          <span className="text-sm font-semibold text-green-600">₹{item.profit}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editMode ? (
                          <input
                            type="text"
                            value={item.salesman}
                            onChange={(e) => handleCellEdit(item._id, 'salesman', e.target.value)}
                            className="w-28 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
                          />
                        ) : (
                          <span className="text-sm text-gray-500">{item.salesman}</span>
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
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Items</p>
            <p className="text-3xl font-black text-gray-900 mt-2">
              {filteredData.length}
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Units Sold</p>
            <p className="text-3xl font-black text-blue-600 mt-2">
              {filteredData.reduce((sum, item) => sum + item.unitsSold, 0)}
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Revenue</p>
            <p className="text-3xl font-black text-purple-600 mt-2">
              ₹{filteredData.reduce((sum, item) => sum + item.totalSellingPrice, 0).toLocaleString()}
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Profit</p>
            <p className="text-3xl font-black text-green-600 mt-2">
              ₹{filteredData.reduce((sum, item) => sum + item.profit, 0).toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminStockSalesSummary;
