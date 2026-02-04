import React, { useState, useEffect } from "react";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PaymentData {
  _id: string;
  paymentId: string;
  orderNumber: string;
  date: string;
  customerName: string;
  amount: number;
  paymentMethod: string;
  status: "Paid" | "Pending" | "Failed" | "Refunded";
  type: "POS" | "Online";
}

type DateFilterType = 'today' | 'tomorrow' | 'last7days' | 'last30days' | 'alltime' | 'custom';

const AdminPaymentReport = () => {
  const [data, setData] = useState<PaymentData[]>([]);
  const [filteredData, setFilteredData] = useState<PaymentData[]>([]);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilterType, setDateFilterType] = useState<DateFilterType>('alltime');
  const [customDateRange, setCustomDateRange] = useState({ start: "", end: "" });
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);

  // Dummy data for demonstration
  useEffect(() => {
    const dummyData: PaymentData[] = [
      {
        _id: "1",
        paymentId: "PAYID-678912345",
        orderNumber: "ORD20260204001",
        date: "2026-02-04",
        customerName: "Rajesh Kumar",
        amount: 2500,
        paymentMethod: "Razorpay (UPI)",
        status: "Paid",
        type: "Online"
      },
      {
        _id: "2",
        paymentId: "TXN-987654321",
        orderNumber: "ORD20260204005",
        date: "2026-02-04",
        customerName: "Priya Sharma",
        amount: 1200,
        paymentMethod: "Cash",
        status: "Paid",
        type: "POS"
      },
      {
        _id: "3",
        paymentId: "PAYID-678912347",
        orderNumber: "ORD20260204010",
        date: "2026-02-03",
        customerName: "Amit Singh",
        amount: 3500,
        paymentMethod: "Card",
        status: "Paid",
        type: "POS"
      },
      {
        _id: "4",
        paymentId: "PAYID-678912348",
        orderNumber: "ORD20260204012",
        date: "2026-02-03",
        customerName: "Sonia Verma",
        amount: 800,
        paymentMethod: "Razorpay (Card)",
        status: "Failed",
        type: "Online"
      },
      {
        _id: "5",
        paymentId: "PAYID-678912349",
        orderNumber: "ORD20260204015",
        date: "2026-02-02",
        customerName: "Vikram Adit",
        amount: 5000,
        paymentMethod: "Net Banking",
        status: "Pending",
        type: "Online"
      },
      {
        _id: "6",
        paymentId: "TXN-112233445",
        orderNumber: "ORD20260204020",
        date: "2026-02-01",
        customerName: "Sneha Reddy",
        amount: 1500,
        paymentMethod: "Cash",
        status: "Paid",
        type: "POS"
      }
    ];
    setData(dummyData);
    setFilteredData(dummyData);
  }, []);

  // Filter data based on search and date criteria
  useEffect(() => {
    let filtered = [...data];

    // Date filter
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    if (dateFilterType === 'today') {
      filtered = filtered.filter(item => item.date === today);
    } else if (dateFilterType === 'last7days') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 7);
      const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];
      filtered = filtered.filter(item => item.date >= sevenDaysAgoStr && item.date <= today);
    } else if (dateFilterType === 'last30days') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(now.getDate() - 30);
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];
      filtered = filtered.filter(item => item.date >= thirtyDaysAgoStr && item.date <= today);
    } else if (dateFilterType === 'custom') {
      if (customDateRange.start && customDateRange.end) {
        filtered = filtered.filter(item =>
          item.date >= customDateRange.start &&
          item.date <= customDateRange.end
        );
      }
    }

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.paymentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.paymentMethod.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredData(filtered);
  }, [searchTerm, data, dateFilterType, customDateRange]);

  const handleCellEdit = (id: string, field: keyof PaymentData, value: any) => {
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
      "Date": item.date,
      "Transaction ID": item.paymentId,
      "Order Number": item.orderNumber,
      "Customer Name": item.customerName,
      "Amount": item.amount,
      "Payment Method": item.paymentMethod,
      "Status": item.status,
      "Type": item.type
    })));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Payment Report");
    XLSX.writeFile(workbook, `Payment_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const downloadPDF = () => {
    const doc = new jsPDF('landscape');

    doc.setFontSize(18);
    doc.text('Payment Transaction Report', 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);

    const tableData = filteredData.map(item => [
      item.date,
      item.paymentId,
      item.orderNumber,
      item.customerName,
      `₹${item.amount}`,
      item.paymentMethod,
      item.status,
      item.type
    ]);

    autoTable(doc, {
      head: [['Date', 'Transaction ID', 'Order No', 'Customer', 'Amount', 'Method', 'Status', 'Type']],
      body: tableData,
      startY: 28,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [79, 70, 229] } // Indigo theme
    });

    doc.save(`Payment_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const totalPayments = filteredData.length;
  const totalAmount = filteredData.reduce((sum, item) => sum + (item.status === 'Paid' ? item.amount : 0), 0);
  const totalOnline = filteredData.filter(item => item.type === 'Online' && item.status === 'Paid').reduce((sum, item) => sum + item.amount, 0);
  const totalPOS = filteredData.filter(item => item.type === 'POS' && item.status === 'Paid').reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header Section */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Payment Report</h1>
              <p className="text-sm text-gray-500 mt-1">Monitor all POS and Online transaction details</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setEditMode(!editMode)}
                className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 active:scale-95 transition-all shadow-sm">
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
            {['today', 'last7days', 'last30days', 'alltime', 'custom'].map((type) => (
              <button
                key={type}
                onClick={() => handleDateFilterChange(type as DateFilterType)}
                className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                  dateFilterType === type
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                }`}>
                {type === 'last7days' ? 'Last 7 Days' : type === 'last30days' ? 'Last 30 Days' : type}
              </button>
            ))}
          </div>

          {/* Custom Date Range Picker */}
          {showCustomDatePicker && (
            <div className="mt-4 p-4 bg-indigo-50 rounded-lg border border-indigo-200 animate-in fade-in slide-in-from-top-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">Start Date</label>
                  <input
                    type="date"
                    value={customDateRange.start}
                    onChange={(e) => setCustomDateRange({ ...customDateRange, start: e.target.value })}
                    className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">End Date</label>
                  <input
                    type="date"
                    value={customDateRange.end}
                    onChange={(e) => setCustomDateRange({ ...customDateRange, end: e.target.value })}
                    className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all shadow-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Search Filter */}
          <div className="mt-4">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by Order ID, Transaction ID, or Customer name..."
                className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all shadow-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Summary Stats Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all group">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Transactions</p>
              <div className="p-2 bg-indigo-50 rounded-lg group-hover:bg-indigo-100 transition-colors">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <p className="text-3xl font-black text-gray-900">{totalPayments}</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all group">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Revenue</p>
              <div className="p-2 bg-green-50 rounded-lg group-hover:bg-green-100 transition-colors">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="text-3xl font-black text-green-600">₹{totalAmount.toLocaleString()}</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all group">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">POS Payments</p>
              <div className="p-2 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
            <p className="text-3xl font-black text-blue-600">₹{totalPOS.toLocaleString()}</p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-all group">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Online Payments</p>
              <div className="p-2 bg-purple-50 rounded-lg group-hover:bg-purple-100 transition-colors">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
              </div>
            </div>
            <p className="text-3xl font-black text-purple-600">₹{totalOnline.toLocaleString()}</p>
          </div>
        </div>

        {/* Table Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm leading-normal">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {editMode && (
                    <th className="px-5 py-4 text-left">
                      <input
                        type="checkbox"
                        checked={selectedRows.size === filteredData.length && filteredData.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                      />
                    </th>
                  )}
                  <th className="px-5 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Date</th>
                  <th className="px-5 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Transaction ID</th>
                  <th className="px-5 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Order No</th>
                  <th className="px-5 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Customer</th>
                  <th className="px-5 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Amount</th>
                  <th className="px-5 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Method</th>
                  <th className="px-5 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-4 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={editMode ? 9 : 8} className="px-6 py-12 text-center text-gray-400">
                      <div className="flex flex-col items-center">
                        <svg className="w-12 h-12 mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                        </svg>
                        <p className="text-sm">No payment transactions found</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredData.map((item) => (
                    <tr key={item._id} className="hover:bg-gray-50 transition-colors">
                      {editMode && (
                        <td className="px-5 py-4">
                          <input
                            type="checkbox"
                            checked={selectedRows.has(item._id)}
                            onChange={() => handleSelectRow(item._id)}
                            className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                          />
                        </td>
                      )}
                      <td className="px-5 py-4 whitespace-nowrap">
                        {editMode ? (
                          <input type="date" value={item.date} onChange={(e) => handleCellEdit(item._id, 'date', e.target.value)} className="w-full px-2 py-1 border rounded" />
                        ) : (
                          <span className="text-gray-900 font-medium">{item.date}</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {editMode ? (
                          <input type="text" value={item.paymentId} onChange={(e) => handleCellEdit(item._id, 'paymentId', e.target.value)} className="w-full px-2 py-1 border rounded" />
                        ) : (
                          <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded">{item.paymentId}</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer">{item.orderNumber}</span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs mr-3">
                            {item.customerName.split(' ').map(n => n[0]).join('')}
                          </div>
                          <span className="text-gray-900 font-medium">{item.customerName}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-sm font-bold text-gray-900">₹{item.amount.toLocaleString()}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-sm text-gray-600">{item.paymentMethod}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          item.status === 'Paid' ? 'bg-green-100 text-green-700' :
                          item.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' :
                          item.status === 'Failed' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${
                          item.type === 'POS' ? 'bg-blue-100 text-blue-700 border border-blue-200' : 'bg-purple-100 text-purple-700 border border-purple-200'
                        }`}>
                          {item.type}
                        </span>
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

export default AdminPaymentReport;
