import React, { useState, useEffect, useCallback } from "react";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getGSTSalesReport, deleteGSTSalesReportEntries, GSTSalesData } from "../../../services/api/admin/adminInventoryService";
import { toast } from "react-hot-toast";

type DateFilterType = 'today' | 'tomorrow' | 'last7days' | 'last30days' | 'alltime' | 'custom';

const AdminGSTSalesReport = () => {
  const [data, setData] = useState<GSTSalesData[]>([]);
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
    total: 0,
    pages: 1,
    limit: 20
  });

  const getDisplayHsn = (item: GSTSalesData) => item.hsnCode ?? item.hsn ?? "";
  const getDisplayQuantity = (item: GSTSalesData) => item.quantity ?? item.stock ?? 0;
  const getDisplayGstRate = (item: GSTSalesData) =>
    item.taxPercentage ?? ((item.cgst ?? 0) + (item.sgst ?? 0) + (item.igst ?? 0));
  // Display override: GST = Total × rate / 100 (forward percentage), so the
  // row reads the way users intuitively expect — "5% of ₹400 is ₹20" — and
  // `Taxable + GST = Total` always holds. We deliberately ignore the
  // server-projected `taxAmount` / `taxableAmount` (which use the
  // GST-inclusive backward formula `total ÷ (1 + r/100)`); the backend
  // behaviour itself is left untouched.
  const getDisplayTotalAmount = (item: GSTSalesData) =>
    item.totalAmount ?? item.price ?? 0;
  const getDisplayGstAmount = (item: GSTSalesData) =>
    (getDisplayTotalAmount(item) * getDisplayGstRate(item)) / 100;
  const getDisplayTaxableAmount = (item: GSTSalesData) =>
    getDisplayTotalAmount(item) - getDisplayGstAmount(item);
  const averageGstRate = data.length
    ? data.reduce((sum, item) => sum + getDisplayGstRate(item), 0) / data.length
    : 0;

  // Fetch data
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

      const response = await getGSTSalesReport(params);
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
      console.error("Error fetching GST reports:", error);
      toast.error("Failed to fetch GST sales data");
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, debouncedSearchTerm, dateFilterType, customDateRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setPagination(prev => ({ ...prev, page: 1 }));
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleCellEdit = (id: string, field: keyof GSTSalesData, value: any) => {
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

  const handleDeleteSelected = async () => {
    if (selectedRows.size === 0) return;
    const ok = window.confirm(`Delete ${selectedRows.size} selected item(s)?`);
    if (!ok) return;

    const ids = Array.from(selectedRows);

    try {
      const response = await deleteGSTSalesReportEntries(ids);

      if (response.failed?.length) {
        toast.error(response.message || `Failed to delete ${response.failed.length} item(s)`);
      } else {
        toast.success("Selected items deleted");
      }

      setSelectedRows(new Set());
      await fetchData();
    } catch (error: any) {
      console.error("Error deleting GST sales records:", error);
      toast.error(error?.response?.data?.message || "Failed to delete selected items");
    }
  };

  const handleDateFilterChange = (type: DateFilterType) => {
    setDateFilterType(type);
    setPagination(prev => ({ ...prev, page: 1 }));
    setShowCustomDatePicker(type === 'custom');
  };

  const downloadExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(data.map(item => ({
      "Date": item.date || "",
      "Invoice No": item.invoiceNo || "",
      "Customer Name": item.customerName || "",
      "Product Name": item.productName,
      "HSN Code": getDisplayHsn(item),
      "Quantity": getDisplayQuantity(item),
      "Taxable Amount": getDisplayTaxableAmount(item),
      "GST %": getDisplayGstRate(item),
      "GST Amount": getDisplayGstAmount(item),
      "Total Amount": getDisplayTotalAmount(item)
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

    const tableData = data.map(item => [
      item.date || "",
      item.invoiceNo || "",
      item.customerName || "",
      item.productName,
      getDisplayHsn(item),
      getDisplayQuantity(item).toString(),
      `₹${getDisplayTaxableAmount(item)}`,
      `${getDisplayGstRate(item)}%`,
      `₹${getDisplayGstAmount(item).toFixed(2)}`,
      `₹${getDisplayTotalAmount(item)}`
    ]);

    autoTable(doc, {
      head: [['Date', 'Invoice', 'Customer', 'Product', 'HSN', 'Qty', 'Taxable', 'GST %', 'GST Amt', 'Total']],
      body: tableData,
      startY: 28,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [16, 185, 129] }
    });

    doc.save(`GST_Sales_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const totalTaxAmount = averageGstRate;
  const totalPrice = data.reduce((sum, item) => sum + getDisplayTotalAmount(item), 0);

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
                className="inline-flex items-center px-4 py-2 bg-[var(--primary-dark)] text-white text-sm font-semibold rounded-lg hover:bg-[var(--primary-darker)] active:scale-95 transition-all shadow-sm">
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
            {(['today', 'tomorrow', 'last7days', 'last30days', 'alltime'] as DateFilterType[]).map(type => (
              <button
                key={type}
                onClick={() => handleDateFilterChange(type)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  dateFilterType === type
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                }`}>
                {type.charAt(0).toUpperCase() + type.slice(1).replace(/(\d)/, ' $1')}
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
            <div className="mt-4 p-4 bg-[var(--primary-alpha-10)] rounded-lg border border-teal-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">Start Date</label>
                  <input
                    type="date"
                    value={customDateRange.start}
                    onChange={(e) => setCustomDateRange({ ...customDateRange, start: e.target.value })}
                    className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-200 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">End Date</label>
                  <input
                    type="date"
                    value={customDateRange.end}
                    onChange={(e) => setCustomDateRange({ ...customDateRange, end: e.target.value })}
                    className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-200 outline-none transition-all"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Search and Limit Filters */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5 px-1">Search</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by product name or HSN code..."
                className="w-full px-4 py-2.5 text-sm bg-white border border-gray-300 rounded-lg focus:border-pink-500 focus:ring-2 focus:ring-pink-200 outline-none transition-all shadow-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 px-1">Show per page</label>
              <select
                value={pagination.limit}
                onChange={(e) => setPagination(prev => ({ ...prev, limit: Number(e.target.value), page: 1 }))}
                className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:border-pink-500 focus:ring-2 focus:ring-pink-200 outline-none transition-all"
              >
                {[10, 20, 50, 100, 500].map(val => (
                  <option key={val} value={val}>{val}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Stats and Table Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Products</p>
            <p className="text-3xl font-black text-[var(--primary-dark)] mt-2">
              {pagination.total}
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Sales Value</p>
            <p className="text-3xl font-black text-[var(--primary-dark)] mt-2">
              ₹{totalPrice.toLocaleString()}
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Average GST %</p>
            <p className="text-3xl font-black text-[var(--primary-dark)] mt-2">
              {totalTaxAmount.toFixed(2)}%
            </p>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-r from-green-50 to-emerald-50 border-b-2 border-green-200">
                  <th className="px-3 py-3 text-left sticky left-0 bg-[var(--primary-alpha-10)] z-20 w-10">
                    <input
                      type="checkbox"
                      checked={selectedRows.size === data.length && data.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="w-4 h-4 text-pink-600 rounded border-gray-300 focus:ring-pink-500"
                    />
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider sticky left-10 bg-[var(--primary-alpha-10)] z-10">Date</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Invoice No</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Customer</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Product Name</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">HSN Code</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Qty</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Taxable Amount</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider bg-[var(--primary-alpha-10)]">GST %</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider bg-[var(--primary-alpha-10)]">GST Amount</th>
                  <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider bg-[var(--primary-alpha-20)]">Total Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={11} className="px-6 py-12 text-center text-gray-500 text-sm italic">
                      Fetching report data...
                    </td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-6 py-12 text-center text-gray-400 text-sm">
                      No GST sales data found
                    </td>
                  </tr>
                ) : (
                  data.map((item) => (
                    <tr key={item._id} className="hover:bg-[var(--primary-alpha-10)]/30 transition-colors">
                      <td className="px-3 py-3 sticky left-0 bg-white z-10 w-10">
                        <input
                          type="checkbox"
                          checked={selectedRows.has(item._id)}
                          onChange={() => handleSelectRow(item._id)}
                          className="w-4 h-4 text-pink-600 rounded border-gray-300 focus:ring-pink-500"
                        />
                      </td>
                      <td className="px-3 py-3 sticky left-10 bg-white z-10">
                        <span className="text-sm text-gray-900">{item.date || "N/A"}</span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-sm text-gray-900">{item.invoiceNo || "N/A"}</span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-sm text-gray-900">{item.customerName || "N/A"}</span>
                      </td>
                      <td className="px-3 py-3">
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
                        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded-full font-medium">{getDisplayHsn(item) || "N/A"}</span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-sm text-gray-900">{getDisplayQuantity(item)}</span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-sm font-semibold text-gray-900">₹{getDisplayTaxableAmount(item).toFixed(2)}</span>
                      </td>
                      <td className="px-3 py-3 bg-[var(--primary-alpha-10)]">
                        <span className="text-sm font-semibold text-[var(--primary-darker)]">{getDisplayGstRate(item).toFixed(2)}%</span>
                      </td>
                      <td className="px-3 py-3 bg-[var(--primary-alpha-10)]">
                        <span className="text-sm font-semibold text-[var(--primary-darker)]">₹{getDisplayGstAmount(item).toFixed(2)}</span>
                      </td>
                      <td className="px-3 py-3 bg-[var(--primary-alpha-20)]">
                        <span className="text-sm font-semibold text-[var(--primary-darker)]">₹{getDisplayTotalAmount(item).toFixed(2)}</span>
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
    </div>
  );
};

export default AdminGSTSalesReport;
