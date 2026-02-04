import React, { useState, useEffect } from "react";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface DueSummaryData {
  _id: string;
  orderNo: string;
  date: string;
  customerName: string;
  customerPhone: string;
  total: number;
  paid: number;
  due: number;
  paymentMode: string;
  status: string;
}

type DateFilterType = 'today' | 'tomorrow' | 'last7days' | 'last30days' | 'alltime' | 'custom';

const AdminDueSummary = () => {
  const [data, setData] = useState<DueSummaryData[]>([]);
  const [filteredData, setFilteredData] = useState<DueSummaryData[]>([]);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
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

    const dummyData: DueSummaryData[] = [
      {
        _id: "1",
        orderNo: "ORD001",
        date: today.toISOString().split('T')[0],
        customerName: "Rajesh Kumar",
        customerPhone: "9876543210",
        total: 5000,
        paid: 3000,
        due: 2000,
        paymentMode: "Partial",
        status: "Pending"
      },
      {
        _id: "2",
        orderNo: "ORD002",
        date: yesterday.toISOString().split('T')[0],
        customerName: "Priya Sharma",
        customerPhone: "9876543211",
        total: 8500,
        paid: 5000,
        due: 3500,
        paymentMode: "Partial",
        status: "Pending"
      },
      {
        _id: "3",
        orderNo: "ORD003",
        date: lastWeek.toISOString().split('T')[0],
        customerName: "Amit Patel",
        customerPhone: "9876543212",
        total: 12000,
        paid: 8000,
        due: 4000,
        paymentMode: "Partial",
        status: "Pending"
      }
    ];
    setData(dummyData);
    setFilteredData(dummyData);
  }, []);

  // Filter data based on search and date
  useEffect(() => {
    let filtered = [...data];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.orderNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.customerPhone.includes(searchTerm)
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
  }, [searchTerm, dateFilterType, customDateRange, data]);

  const handleCellEdit = (id: string, field: keyof DueSummaryData, value: any) => {
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
      "Order No": item.orderNo,
      "Date": item.date,
      "Customer Name": item.customerName,
      "Customer Phone": item.customerPhone,
      "Total": item.total,
      "Paid": item.paid,
      "Due": item.due,
      "Payment Mode": item.paymentMode,
      "Status": item.status
    })));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Due Summary");
    XLSX.writeFile(workbook, `Due_Summary_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const downloadPDF = () => {
    const doc = new jsPDF('landscape');

    doc.setFontSize(18);
    doc.text('Due Summary Report', 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);

    const tableData = filteredData.map(item => [
      item.orderNo,
      item.date,
      item.customerName,
      item.customerPhone,
      item.total.toString(),
      item.paid.toString(),
      item.due.toString()
    ]);

    autoTable(doc, {
      head: [['Order No', 'Date', 'Customer', 'Phone', 'Total', 'Paid', 'Due']],
      body: tableData,
      startY: 28,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [255, 45, 148] }
    });

    doc.save(`Due_Summary_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header Section */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Due Summary</h1>
              <p className="text-sm text-gray-500 mt-1">Track pending payments and customer dues</p>
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
              placeholder="Search by order no, customer name, or phone..."
              className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:border-pink-500 focus:ring-2 focus:ring-pink-200 outline-none transition-all"
            />
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
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Order No</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Customer Name</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Total</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Paid</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Due</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={editMode ? 9 : 8} className="px-6 py-12 text-center text-gray-400 text-sm">
                      No due records found
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
                            value={item.orderNo}
                            onChange={(e) => handleCellEdit(item._id, 'orderNo', e.target.value)}
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
                          />
                        ) : (
                          <span className="text-sm font-semibold text-gray-900">{item.orderNo}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editMode ? (
                          <input
                            type="date"
                            value={item.date}
                            onChange={(e) => handleCellEdit(item._id, 'date', e.target.value)}
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
                          />
                        ) : (
                          <span className="text-sm text-gray-600">{item.date}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editMode ? (
                          <input
                            type="text"
                            value={item.customerName}
                            onChange={(e) => handleCellEdit(item._id, 'customerName', e.target.value)}
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
                          />
                        ) : (
                          <span className="text-sm font-medium text-gray-900">{item.customerName}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editMode ? (
                          <input
                            type="text"
                            value={item.customerPhone}
                            onChange={(e) => handleCellEdit(item._id, 'customerPhone', e.target.value)}
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
                          />
                        ) : (
                          <span className="text-sm text-gray-600">{item.customerPhone}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editMode ? (
                          <input
                            type="number"
                            value={item.total}
                            onChange={(e) => handleCellEdit(item._id, 'total', parseFloat(e.target.value))}
                            className="w-24 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
                          />
                        ) : (
                          <span className="text-sm font-semibold text-gray-900">₹{item.total.toLocaleString()}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editMode ? (
                          <input
                            type="number"
                            value={item.paid}
                            onChange={(e) => handleCellEdit(item._id, 'paid', parseFloat(e.target.value))}
                            className="w-24 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
                          />
                        ) : (
                          <span className="text-sm text-green-600 font-semibold">₹{item.paid.toLocaleString()}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editMode ? (
                          <input
                            type="number"
                            value={item.due}
                            onChange={(e) => handleCellEdit(item._id, 'due', parseFloat(e.target.value))}
                            className="w-24 px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
                          />
                        ) : (
                          <span className="text-sm font-bold text-red-600">₹{item.due.toLocaleString()}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editMode ? (
                          <select
                            value={item.status}
                            onChange={(e) => handleCellEdit(item._id, 'status', e.target.value)}
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none">
                            <option value="Pending">Pending</option>
                            <option value="Partial">Partial</option>
                            <option value="Paid">Paid</option>
                          </select>
                        ) : (
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                            item.status === 'Paid' ? 'bg-green-100 text-green-700' :
                            item.status === 'Partial' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {item.status}
                          </span>
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
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Orders</p>
            <p className="text-3xl font-black text-gray-900 mt-2">
              {filteredData.length}
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Amount</p>
            <p className="text-3xl font-black text-blue-600 mt-2">
              ₹{filteredData.reduce((sum, item) => sum + item.total, 0).toLocaleString()}
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Paid</p>
            <p className="text-3xl font-black text-green-600 mt-2">
              ₹{filteredData.reduce((sum, item) => sum + item.paid, 0).toLocaleString()}
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Due</p>
            <p className="text-3xl font-black text-red-600 mt-2">
              ₹{filteredData.reduce((sum, item) => sum + item.due, 0).toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDueSummary;
