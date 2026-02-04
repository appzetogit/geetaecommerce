import React, { useState, useEffect } from "react";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ReturnExchangeData {
  _id: string;
  date: string;
  saleReturnNo: string;
  invoiceNo: string;
  customerName: string;
  paymentMode: string;
  noOfItems: number;
  totalMRP: number;
  totalSP: number;
  totalDiscount: number;
  returnAmt: number;
  saleAmt: number;
  billAmt: number;
  paidBy: string;
}

type DateFilterType = 'today' | 'tomorrow' | 'last7days' | 'last30days' | 'alltime' | 'custom';

const AdminReturnExchangeSummary = () => {
  const [data, setData] = useState<ReturnExchangeData[]>([]);
  const [filteredData, setFilteredData] = useState<ReturnExchangeData[]>([]);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilterType, setDateFilterType] = useState<DateFilterType>('alltime');
  const [customDateRange, setCustomDateRange] = useState({ start: "", end: "" });
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);

  // Dummy data for demonstration
  useEffect(() => {
    const dummyData: ReturnExchangeData[] = [
      {
        _id: "1",
        date: "2026-02-03",
        saleReturnNo: "SR001",
        invoiceNo: "25918",
        customerName: "Walk-in Customer",
        paymentMode: "Cash",
        noOfItems: 2,
        totalMRP: 500,
        totalSP: 400,
        totalDiscount: 100,
        returnAmt: 200,
        saleAmt: 200,
        billAmt: 0,
        paidBy: "Cash"
      },
      {
        _id: "2",
        date: "2026-02-02",
        saleReturnNo: "SR002",
        invoiceNo: "25917",
        customerName: "John Doe",
        paymentMode: "Card",
        noOfItems: 1,
        totalMRP: 300,
        totalSP: 250,
        totalDiscount: 50,
        returnAmt: 250,
        saleAmt: 0,
        billAmt: 250,
        paidBy: "Card"
      }
    ];
    setData(dummyData);
    setFilteredData(dummyData);
  }, []);

  // Filter data based on search and date
  useEffect(() => {
    let filtered = [...data];

    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.saleReturnNo.toLowerCase().includes(searchTerm.toLowerCase())
      );
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
          itemDate.setHours(0, 0, 0, 0); // Normalize itemDate to start of day
          return itemDate >= last7Days && itemDate <= today;
        });
        break;
      case 'last30days':
        const last30Days = new Date(today);
        last30Days.setDate(last30Days.getDate() - 30);
        filtered = filtered.filter(item => {
          const itemDate = new Date(item.date);
          itemDate.setHours(0, 0, 0, 0); // Normalize itemDate to start of day
          return itemDate >= last30Days && itemDate <= today;
        });
        break;
      case 'custom':
        if (customDateRange.start && customDateRange.end) {
          filtered = filtered.filter(item => {
            const itemDate = new Date(item.date);
            itemDate.setHours(0, 0, 0, 0); // Normalize itemDate to start of day
            const startDate = new Date(customDateRange.start);
            startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(customDateRange.end);
            endDate.setHours(23, 59, 59, 999); // Set to end of day for inclusive range
            return itemDate >= startDate && itemDate <= endDate;
          });
        }
        break;
      case 'alltime':
      default:
        // No date filtering
        break;
    }

    setFilteredData(filtered);
  }, [searchTerm, dateFilterType, customDateRange, data]);

  const handleCellEdit = (id: string, field: keyof ReturnExchangeData, value: any) => {
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
      setCustomDateRange({ start: "", end: "" }); // Clear custom range when switching off custom
    }
  };

  const downloadExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(filteredData.map(item => ({
      Date: item.date,
      "Sale Return No": item.saleReturnNo,
      "Invoice No": item.invoiceNo,
      "Customer Name": item.customerName,
      "Payment Mode": item.paymentMode,
      "No of Items": item.noOfItems,
      "Total MRP": item.totalMRP,
      "Total SP": item.totalSP,
      "Total Discount": item.totalDiscount,
      "Return Amt": item.returnAmt,
      "Sale Amt": item.saleAmt,
      "Bill Amt": item.billAmt,
      "Paid By": item.paidBy
    })));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Return & Exchange");
    XLSX.writeFile(workbook, `Return_Exchange_Summary_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const downloadPDF = () => {
    const doc = new jsPDF('landscape');

    doc.setFontSize(18);
    doc.text('Return & Exchange Summary Report', 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);

    const tableData = filteredData.map(item => [
      item.date,
      item.saleReturnNo,
      item.invoiceNo,
      item.customerName,
      item.paymentMode,
      item.noOfItems.toString(),
      item.totalMRP.toString(),
      item.totalSP.toString(),
      item.returnAmt.toString()
    ]);

    autoTable(doc, {
      head: [['Date', 'Return No', 'Invoice', 'Customer', 'Payment', 'Items', 'MRP', 'SP', 'Return Amt']],
      body: tableData,
      startY: 28,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [255, 45, 148] }
    });

    doc.save(`Return_Exchange_Summary_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Return & Exchange Summary</h1>
            <p className="text-sm text-gray-500 mt-1">Track all return and exchange transactions</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setEditMode(!editMode)}
              className="px-4 py-2 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 transition-colors flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              {editMode ? 'Done Editing' : 'Bulk Edit'}
            </button>

            <button
              onClick={downloadExcel}
              className="px-4 py-2 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Excel
            </button>

            <button
              onClick={downloadPDF}
              className="px-4 py-2 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            placeholder="Search by invoice, return no, or customer..."
            className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:border-pink-500 focus:ring-2 focus:ring-pink-200 outline-none transition-all"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50">
              <tr>
                {editMode && (
                  <th className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedRows.size === filteredData.length && filteredData.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="w-4 h-4 text-pink-600 rounded border-gray-300 focus:ring-pink-500"
                    />
                  </th>
                )}
                <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Sale Return No</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Invoice No</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Customer Name</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Payment Mode</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">No of Items</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total MRP</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total SP</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Discount</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Return Amt</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Sale Amt</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Bill Amt</th>
                <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Paid By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={editMode ? 15 : 14} className="px-6 py-12 text-center text-gray-400 italic">
                    No return/exchange data found
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
                          type="date"
                          value={item.date}
                          onChange={(e) => handleCellEdit(item._id, 'date', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
                        />
                      ) : (
                        <span className="text-sm text-gray-700">{item.date}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editMode ? (
                        <input
                          type="text"
                          value={item.saleReturnNo}
                          onChange={(e) => handleCellEdit(item._id, 'saleReturnNo', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none font-semibold"
                        />
                      ) : (
                        <span className="text-sm font-semibold text-gray-900">{item.saleReturnNo}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editMode ? (
                        <input
                          type="text"
                          value={item.invoiceNo}
                          onChange={(e) => handleCellEdit(item._id, 'invoiceNo', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
                        />
                      ) : (
                        <span className="text-sm text-gray-700">{item.invoiceNo}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editMode ? (
                        <input
                          type="text"
                          value={item.customerName}
                          onChange={(e) => handleCellEdit(item._id, 'customerName', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
                        />
                      ) : (
                        <span className="text-sm text-gray-700">{item.customerName}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editMode ? (
                        <select
                          value={item.paymentMode}
                          onChange={(e) => handleCellEdit(item._id, 'paymentMode', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none">
                          <option value="Cash">Cash</option>
                          <option value="Card">Card</option>
                          <option value="UPI">UPI</option>
                        </select>
                      ) : (
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                          item.paymentMode === 'Cash' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {item.paymentMode}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editMode ? (
                        <input
                          type="number"
                          value={item.noOfItems}
                          onChange={(e) => handleCellEdit(item._id, 'noOfItems', parseInt(e.target.value))}
                          className="w-16 px-2 py-1 text-sm border border-gray-200 rounded focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
                        />
                      ) : (
                        <span className="text-sm text-gray-700">{item.noOfItems}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editMode ? (
                        <input
                          type="number"
                          value={item.totalMRP}
                          onChange={(e) => handleCellEdit(item._id, 'totalMRP', parseFloat(e.target.value))}
                          className="w-20 px-2 py-1 text-sm border border-gray-200 rounded focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
                        />
                      ) : (
                        <span className="text-sm text-gray-700">₹{item.totalMRP}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editMode ? (
                        <input
                          type="number"
                          value={item.totalSP}
                          onChange={(e) => handleCellEdit(item._id, 'totalSP', parseFloat(e.target.value))}
                          className="w-20 px-2 py-1 text-sm border border-gray-200 rounded focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
                        />
                      ) : (
                        <span className="text-sm text-gray-700">₹{item.totalSP}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editMode ? (
                        <input
                          type="number"
                          value={item.totalDiscount}
                          onChange={(e) => handleCellEdit(item._id, 'totalDiscount', parseFloat(e.target.value))}
                          className="w-20 px-2 py-1 text-sm border border-gray-200 rounded focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
                        />
                      ) : (
                        <span className="text-sm text-gray-700">₹{item.totalDiscount}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editMode ? (
                        <input
                          type="number"
                          value={item.returnAmt}
                          onChange={(e) => handleCellEdit(item._id, 'returnAmt', parseFloat(e.target.value))}
                          className="w-20 px-2 py-1 text-sm border border-gray-200 rounded focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none font-bold text-red-600"
                        />
                      ) : (
                        <span className="text-sm font-bold text-red-600">₹{item.returnAmt}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editMode ? (
                        <input
                          type="number"
                          value={item.saleAmt}
                          onChange={(e) => handleCellEdit(item._id, 'saleAmt', parseFloat(e.target.value))}
                          className="w-20 px-2 py-1 text-sm border border-gray-200 rounded focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
                        />
                      ) : (
                        <span className="text-sm text-gray-700">₹{item.saleAmt}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editMode ? (
                        <input
                          type="number"
                          value={item.billAmt}
                          onChange={(e) => handleCellEdit(item._id, 'billAmt', parseFloat(e.target.value))}
                          className="w-20 px-2 py-1 text-sm border border-gray-200 rounded focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
                        />
                      ) : (
                        <span className="text-sm text-gray-700">₹{item.billAmt}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editMode ? (
                        <input
                          type="text"
                          value={item.paidBy}
                          onChange={(e) => handleCellEdit(item._id, 'paidBy', e.target.value)}
                          className="w-20 px-2 py-1 text-sm border border-gray-200 rounded focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
                        />
                      ) : (
                        <span className="text-sm text-gray-700">{item.paidBy}</span>
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
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Returns</p>
          <p className="text-2xl font-black text-gray-800 mt-2">
            {filteredData.length}
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Return Amount</p>
          <p className="text-2xl font-black text-red-600 mt-2">
            ₹{filteredData.reduce((sum, item) => sum + item.returnAmt, 0).toLocaleString()}
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Sale Amount</p>
          <p className="text-2xl font-black text-green-600 mt-2">
            ₹{filteredData.reduce((sum, item) => sum + item.saleAmt, 0).toLocaleString()}
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Items</p>
          <p className="text-2xl font-black text-purple-600 mt-2">
            {filteredData.reduce((sum, item) => sum + item.noOfItems, 0)}
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminReturnExchangeSummary;
