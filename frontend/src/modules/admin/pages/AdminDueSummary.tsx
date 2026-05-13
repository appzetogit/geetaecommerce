import React, { useState, useEffect, useCallback } from "react";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getDueSummaryReport, DueSummaryData } from "../../../services/api/admin/adminInventoryService";
import { toast } from "react-hot-toast";

type DateFilterType = 'today' | 'tomorrow' | 'last7days' | 'last30days' | 'alltime' | 'custom';

const AdminDueSummary = () => {
  const [data, setData] = useState<DueSummaryData[]>([]);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [dateFilterType, setDateFilterType] = useState<DateFilterType>('alltime');
  const [customDateRange, setCustomDateRange] = useState({ start: "", end: "" });
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 1
  });

  const fetchData = useCallback(async () => {
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
      } else if (dateFilterType === 'tomorrow') {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        params.dateFrom = new Date(tomorrow.setHours(0, 0, 0, 0)).toISOString();
        params.dateTo = new Date(tomorrow.setHours(23, 59, 59, 999)).toISOString();
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

      const response = await getDueSummaryReport(params);
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
      console.error("Error fetching due summary:", error);
      toast.error("Failed to fetch due summary data");
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, debouncedSearchTerm, dateFilterType, customDateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setPagination(prev => ({ ...prev, page: 1 }));
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleCellEdit = (id: string, field: keyof DueSummaryData, value: any) => {
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
    setPagination(prev => ({ ...prev, page: 1 }));
    setShowCustomDatePicker(type === 'custom');
  };

  const downloadExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(data.map(item => ({
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

    const tableData = data.map(item => [
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

  // Stats for the current page/summary
  // Note: For accurate total stats across ALL pages, backend should return aggregated totals.
  // For now, calculating based on current page or filtered data is common if backend doesn't provide global sums separately.
  // Ideally, backend should return these stats. The dummy version calculated on the fly.
  const totalAmount = data.reduce((sum, item) => sum + item.total, 0);
  const totalPaid = data.reduce((sum, item) => sum + item.paid, 0);
  const totalDue = data.reduce((sum, item) => sum + item.due, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 sm:p-6">
      {/* Header Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Due Summary</h1>
            <p className="text-sm text-gray-500 mt-1">Track pending payments and customer dues</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setEditMode(!editMode)}
              className="px-4 py-2 bg-[var(--primary-dark)] text-white rounded-xl font-semibold hover:bg-[var(--primary-darker)] transition-colors flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              {editMode ? 'Done Editing' : 'Bulk Edit'}
            </button>

            <button
              onClick={handleDeleteSelected}
              disabled={selectedRows.size === 0}
              className="px-4 py-2 bg-rose-600 text-white rounded-xl font-semibold hover:bg-rose-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
          {(['today', 'tomorrow', 'last7days', 'last30days', 'alltime'] as DateFilterType[]).map((type) => (
            <button
              key={type}
              onClick={() => handleDateFilterChange(type)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                dateFilterType === type
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
              }`}>
              {type === 'last7days' ? 'Last 7 Days' : type === 'last30days' ? 'Last 30 Days' : type === 'alltime' ? 'All Time' : type}
            </button>
          ))}
          <button
            onClick={() => handleDateFilterChange('custom')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              dateFilterType === 'custom'
                ? 'bg-[var(--primary-dark)] text-white shadow-sm'
                : 'text-[var(--primary-dark)] hover:bg-[var(--primary-alpha-10)]'
            }`}>
            Custom
          </button>
        </div>

        {/* Custom Date Range Picker */}
        {showCustomDatePicker && (
          <div className="mt-4 p-4 bg-[var(--primary-alpha-10)] rounded-lg border border-teal-200 animate-in fade-in slide-in-from-top-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">Start Date</label>
                <input
                  type="date"
                  value={customDateRange.start}
                  onChange={(e) => setCustomDateRange({ ...customDateRange, start: e.target.value })}
                  className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:border-[var(--primary-color)] focus:ring-2 focus:ring-teal-200 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">End Date</label>
                <input
                  type="date"
                  value={customDateRange.end}
                  onChange={(e) => setCustomDateRange({ ...customDateRange, end: e.target.value })}
                  className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:border-[var(--primary-color)] focus:ring-2 focus:ring-teal-200 outline-none transition-all"
                />
              </div>
            </div>
          </div>
        )}

        {/* Search and Limit Filters */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 px-1">Search</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by order no, customer name, or phone..."
              className="w-full px-4 py-2.5 text-sm bg-white border border-gray-300 rounded-lg focus:border-pink-500 focus:ring-2 focus:ring-pink-200 outline-none transition-all shadow-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 px-1">Show per page</label>
            <select
              value={pagination.limit}
              onChange={(e) => setPagination(prev => ({ ...prev, limit: Number(e.target.value), page: 1 }))}
              className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:border-pink-500 focus:ring-2 focus:ring-pink-200 outline-none transition-all bg-white"
            >
              {[10, 20, 50, 100, 500].map(val => (
                <option key={val} value={val}>{val}</option>
              ))}
            </select>
          </div>
        </div>
      </div>


      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Orders</p>
          <p className="text-3xl font-black text-gray-900 mt-2">
            {pagination.total}
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Amount</p>
          <p className="text-3xl font-black text-[var(--primary-dark)] mt-2">
            ₹{totalAmount.toLocaleString()}
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Paid</p>
          <p className="text-3xl font-black text-[var(--primary-dark)] mt-2">
            ₹{totalPaid.toLocaleString()}
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Due (Page)</p>
          <p className="text-3xl font-black text-red-600 mt-2">
            ₹{totalDue.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={selectedRows.size === data.length && data.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="w-4 h-4 text-[var(--primary-dark)] rounded border-gray-300 focus:ring-[var(--primary-color)]"
                  />
                </th>
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
              {loading ? (
                <tr>
                   <td colSpan={9} className="px-6 py-12 text-center text-gray-500 italic">
                    Fetching due summary data...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-400 text-sm">
                    No due records found
                  </td>
                </tr>
              ) : (
                data.map((item) => (
                  <tr key={item._id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={selectedRows.has(item._id)}
                        onChange={() => handleSelectRow(item._id)}
                        className="w-4 h-4 text-[var(--primary-dark)] rounded border-gray-300 focus:ring-[var(--primary-color)]"
                      />
                    </td>
                    <td className="px-4 py-3">
                      {editMode ? (
                        <input
                          type="text"
                          value={item.orderNo}
                          onChange={(e) => handleCellEdit(item._id, 'orderNo', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none font-semibold"
                        />
                      ) : (
                        <span className="text-sm font-semibold text-gray-900">{item.orderNo}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editMode ? (
                        <input
                          type="text"
                          value={item.date}
                          onChange={(e) => handleCellEdit(item._id, 'date', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
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
                          className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none font-medium"
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
                          className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none"
                        />
                      ) : (
                        <span className="text-sm text-gray-600">{item.customerPhone}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-semibold text-gray-900">₹{item.total.toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-[var(--primary-dark)] font-semibold">₹{item.paid.toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-bold text-red-600">₹{item.due.toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-3">
                       <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                            item.status === 'Paid' ? 'bg-[var(--primary-alpha-20)] text-[var(--primary-darker)]' :
                            item.status === 'Partial' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {item.status}
                        </span>
                    </td>
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


    </div>
  );
};

export default AdminDueSummary;
