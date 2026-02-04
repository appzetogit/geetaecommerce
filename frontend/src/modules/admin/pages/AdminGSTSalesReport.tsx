import React, { useState, useEffect } from "react";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface GSTSalesData {
  _id: string;
  productName: string;
  hsnCode: string;
  stock: number;
  price: number;
  taxPercentage: number;
  taxAmount: number;
}

type DateFilterType = 'today' | 'tomorrow' | 'last7days' | 'last30days' | 'alltime' | 'custom';

const AdminGSTSalesReport = () => {
  const [data, setData] = useState<GSTSalesData[]>([]);
  const [filteredData, setFilteredData] = useState<GSTSalesData[]>([]);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilterType, setDateFilterType] = useState<DateFilterType>('alltime');
  const [customDateRange, setCustomDateRange] = useState({ start: "", end: "" });
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);

  // Dummy data for demonstration
  useEffect(() => {
    const dummyData: GSTSalesData[] = [
      {
        _id: "1",
        productName: "umbrella chatri 120",
        hsnCode: "6601",
        stock: 28,
        price: 120,
        taxPercentage: 18,
        taxAmount: 21.6
      },
      {
        _id: "2",
        productName: "bass kubdi 70",
        hsnCode: "9503",
        stock: 64,
        price: 70,
        taxPercentage: 12,
        taxAmount: 8.4
      },
      {
        _id: "3",
        productName: "Doms Neon Rubber Tipped Graphite Pencil 10N",
        hsnCode: "9609",
        stock: 44,
        price: 150,
        taxPercentage: 12,
        taxAmount: 18
      },
      {
        _id: "4",
        productName: "purple8 glue gun 220",
        hsnCode: "8205",
        stock: 10,
        price: 220,
        taxPercentage: 18,
        taxAmount: 39.6
      },
      {
        _id: "5",
        productName: "L'OREAL PARIS HYALURON SHAMPOO",
        hsnCode: "3305",
        stock: 15,
        price: 450,
        taxPercentage: 18,
        taxAmount: 81
      },
      {
        _id: "6",
        productName: "acrylic colore dibbi",
        hsnCode: "3213",
        stock: 25,
        price: 85,
        taxPercentage: 12,
        taxAmount: 10.2
      }
    ];
    setData(dummyData);
    setFilteredData(dummyData);
  }, []);

  // Filter data based on search
  useEffect(() => {
    let filtered = [...data];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.hsnCode.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredData(filtered);
  }, [searchTerm, data]);

  const handleCellEdit = (id: string, field: keyof GSTSalesData, value: any) => {
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
      "Product Name": item.productName,
      "HSN Code": item.hsnCode,
      "Stock": item.stock,
      "Price": item.price,
      "Tax %": item.taxPercentage,
      "Tax Amount": item.taxAmount
    })));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "GST Sales");
    XLSX.writeFile(workbook, `GST_Sales_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const downloadPDF = () => {
    const doc = new jsPDF('landscape');

    doc.setFontSize(18);
    doc.text('GST Sales Report', 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);

    const tableData = filteredData.map(item => [
      item.productName,
      item.hsnCode,
      item.stock.toString(),
      `₹${item.price}`,
      `${item.taxPercentage}%`,
      `₹${item.taxAmount}`
    ]);

    autoTable(doc, {
      head: [['Product', 'HSN', 'Stock', 'Price', 'Tax %', 'Tax Amount']],
      body: tableData,
      startY: 28,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [16, 185, 129] }
    });

    doc.save(`GST_Sales_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const totalTaxAmount = filteredData.reduce((sum, item) => sum + item.taxAmount, 0);
  const totalPrice = filteredData.reduce((sum, item) => sum + (item.price * item.stock), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header Section */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">GST Sales Report</h1>
              <p className="text-sm text-gray-500 mt-1">Track GST and tax details on sales</p>
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

          {/* Search Filter */}
          <div className="mt-4">
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Search</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by product name or HSN code..."
              className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:border-pink-500 focus:ring-2 focus:ring-pink-200 outline-none transition-all"
            />
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-green-50 to-emerald-50 border-b-2 border-green-200">
                  {editMode && (
                    <th className="px-3 py-3 text-left sticky left-0 bg-green-50 z-10">
                      <input
                        type="checkbox"
                        checked={selectedRows.size === filteredData.length && filteredData.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="w-4 h-4 text-pink-600 rounded border-gray-300 focus:ring-pink-500"
                      />
                    </th>
                  )}
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider sticky left-0 bg-green-50 z-10">Product Name</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">HSN Code</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Stock</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Price</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider bg-blue-50">Tax %</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider bg-green-100">Tax Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={editMode ? 8 : 7} className="px-6 py-12 text-center text-gray-400 text-sm">
                      No GST sales data found
                    </td>
                  </tr>
                ) : (
                  filteredData.map((item) => (
                    <tr key={item._id} className="hover:bg-green-50/30 transition-colors">
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
                            value={item.productName}
                            onChange={(e) => handleCellEdit(item._id, 'productName', e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none font-semibold"
                          />
                        ) : (
                          <span className="text-sm font-semibold text-gray-900">{item.productName}</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {editMode ? (
                          <input
                            type="text"
                            value={item.hsnCode}
                            onChange={(e) => handleCellEdit(item._id, 'hsnCode', e.target.value)}
                            className="w-20 px-2 py-1 text-sm border border-gray-200 rounded focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
                          />
                        ) : (
                          <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-full font-medium">{item.hsnCode}</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {editMode ? (
                          <input
                            type="number"
                            value={item.stock}
                            onChange={(e) => handleCellEdit(item._id, 'stock', parseInt(e.target.value))}
                            className="w-20 px-2 py-1 text-sm border border-gray-200 rounded focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
                          />
                        ) : (
                          <span className="text-sm text-gray-900">{item.stock}</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {editMode ? (
                          <input
                            type="number"
                            value={item.price}
                            onChange={(e) => handleCellEdit(item._id, 'price', parseFloat(e.target.value))}
                            className="w-20 px-2 py-1 text-sm border border-gray-200 rounded focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none font-semibold"
                          />
                        ) : (
                          <span className="text-sm font-semibold text-gray-900">₹{item.price}</span>
                        )}
                      </td>
                      <td className="px-3 py-3 bg-blue-50">
                        {editMode ? (
                          <input
                            type="number"
                            value={item.taxPercentage}
                            onChange={(e) => handleCellEdit(item._id, 'taxPercentage', parseFloat(e.target.value))}
                            className="w-20 px-2 py-1 text-sm border border-gray-200 rounded focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none font-semibold text-blue-700"
                          />
                        ) : (
                          <span className="text-sm font-semibold text-blue-700">{item.taxPercentage}%</span>
                        )}
                      </td>
                      <td className="px-3 py-3 bg-green-50">
                        {editMode ? (
                          <input
                            type="number"
                            value={item.taxAmount}
                            onChange={(e) => handleCellEdit(item._id, 'taxAmount', parseFloat(e.target.value))}
                            className="w-20 px-2 py-1 text-sm border border-gray-200 rounded focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none font-semibold text-green-700"
                          />
                        ) : (
                          <span className="text-sm font-semibold text-green-700">₹{item.taxAmount.toFixed(2)}</span>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Products</p>
            <p className="text-3xl font-black text-blue-600 mt-2">
              {filteredData.length}
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Sales Value</p>
            <p className="text-3xl font-black text-purple-600 mt-2">
              ₹{totalPrice.toLocaleString()}
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Tax Amount</p>
            <p className="text-3xl font-black text-green-600 mt-2">
              ₹{totalTaxAmount.toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminGSTSalesReport;
