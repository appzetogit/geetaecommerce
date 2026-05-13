import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { deletePOSOrder, getPOSOrders, updateOrderStatus, Order } from "../../../services/api/admin/adminOrderService";
import { useAuth } from "../../../context/AuthContext";
import { toast } from "react-hot-toast";

type DateFilterType = 'today' | 'last7days' | 'last30days' | 'alltime' | 'custom';

const AdminPOSInvoiceReport = () => {
  const { isAuthenticated, token } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilterType, setDateFilterType] = useState<DateFilterType>('alltime');
  const [customDateRange, setCustomDateRange] = useState({ start: "", end: "" });
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("All Methods");
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [editMode, setEditMode] = useState(false);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    pages: 1,
    limit: 20
  });

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchOrders();
    }
  }, [token, isAuthenticated, pagination.page, pagination.limit, dateFilterType, customDateRange, paymentMethodFilter, debouncedSearchTerm]);

  // Handle search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setPagination(prev => ({ ...prev, page: 1 }));
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchOrders = async () => {
    try {
      setLoading(true);

      const params: any = {
        page: pagination.page,
        limit: pagination.limit,
        paymentMethod: paymentMethodFilter !== "All Methods" ? paymentMethodFilter : undefined,
        search: debouncedSearchTerm || undefined,
      };

      // Date Filters
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

      const response = await getPOSOrders(params);
      if (response.success) {
        setOrders(response.data);
        if (response.pagination) {
          setPagination(prev => ({
            ...prev,
            total: response.pagination!.total,
            pages: response.pagination!.pages
          }));
        }
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
      toast.error("Failed to load POS data");
    } finally {
      setLoading(false);
    }
  };

  const handleDateFilterChange = (type: DateFilterType) => {
    setDateFilterType(type);
    if (type === 'custom') setShowCustomDatePicker(true);
    else setShowCustomDatePicker(false);
  };

  const handleCellEdit = async (id: string, field: keyof Order, value: any) => {
    // Local Update
    setOrders(prev => (prev as Order[]).map((item: Order) =>
      item._id === id ? { ...item, [field]: value } : item
    ));

    // If status is updated, sync with backend
    if (field === 'status') {
      try {
        await updateOrderStatus(id, { status: value });
        toast.success(`Updated Invoice #${id.slice(-6)} to ${value}`);
      } catch (error) {
        toast.error("Failed to sync status update");
      }
    }
  };

  const downloadExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(orders.map(item => ({
      "Invoice No": item.orderNumber,
      "Date": new Date(item.orderDate).toLocaleDateString(),
      "Customer": item.customerName,
      "Phone": item.customerPhone,
      "Amount": item.total,
      "Payment Method": item.paymentMethod,
      "Status": item.status
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "POS Invoice Report");
    XLSX.writeFile(workbook, `POS_Invoice_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const downloadPDF = () => {
    const doc = new jsPDF('portrait');
    doc.setFontSize(18);
    doc.text('POS Invoice Report', 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);

    const tableData = orders.map(item => [
      item.orderNumber,
      new Date(item.orderDate).toLocaleDateString(),
      item.customerName,
      item.customerPhone,
      `₹${item.total.toLocaleString()}`,
      item.paymentMethod,
      item.status
    ]);

    autoTable(doc, {
      head: [['Invoice No', 'Date', 'Customer', 'Phone', 'Amount', 'Method', 'Status']],
      body: tableData,
      startY: 28,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [79, 70, 229] }
    });

    doc.save(`POS_Invoice_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRows(new Set(orders.map(item => item._id)));
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
    const ok = window.confirm(`Delete ${selectedRows.size} selected invoice(s)?`);
    if (!ok) return;

    const ids = Array.from(selectedRows);
    const idSet = new Set(ids);

    try {
      const failed: string[] = [];

      for (const id of ids) {
        try {
          await deletePOSOrder(id);
        } catch (e: any) {
          // If it's already missing on server, treat as deleted.
          if (e?.response?.status !== 404) failed.push(id);
        }
      }

      setOrders((prev) => prev.filter((o) => !idSet.has(o._id)));
      setSelectedRows(new Set());

      if (failed.length > 0) toast.error(`Failed to delete ${failed.length} invoice(s)`);
      else toast.success("Selected invoices deleted");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.response?.data?.message || "Failed to delete invoices");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-black text-gray-900">POS Invoice Report</h1>
              <p className="text-xs text-gray-500 font-bold mt-0.5">Manage and track Point of Sale sales</p>
            </div>

            <div className="flex flex-wrap gap-2 text-white">
              <button
                onClick={() => setEditMode(!editMode)}
                className={`inline-flex items-center px-5 py-2 text-xs font-black rounded-lg active:scale-95 transition-all shadow-sm ${editMode ? 'bg-[var(--primary-darker)]' : 'bg-[var(--primary-dark)] hover:bg-[var(--primary-darker)]'}`}>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                {editMode ? 'Done Editing' : 'Bulk Edit'}
              </button>

              <button
                onClick={handleDeleteSelected}
                disabled={selectedRows.size === 0}
                className="inline-flex items-center px-5 py-2 bg-rose-600 font-black text-xs rounded-lg hover:bg-rose-700 active:scale-95 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete{selectedRows.size > 0 ? ` (${selectedRows.size})` : ""}
              </button>

              <button
                onClick={downloadExcel}
                className="inline-flex items-center px-5 py-2 bg-emerald-600 font-black text-xs rounded-lg hover:bg-emerald-700 active:scale-95 transition-all shadow-sm">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z" />
                </svg>
                Excel
              </button>

              <button
                onClick={downloadPDF}
                className="inline-flex items-center px-5 py-2 bg-rose-600 font-black text-xs rounded-lg hover:bg-rose-700 active:scale-95 transition-all shadow-sm">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 21h10a2 2 0 0 0 2-2V9.414a1 1 0 0 0-.293-.707l-5.414-5.414A1 1 0 0 0 12.586 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2z" />
                </svg>
                PDF
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 bg-gray-50 p-1.5 rounded-xl border border-gray-100">
            {['today', 'last7days', 'last30days', 'alltime', 'custom'].map((type) => (
              <button
                key={type}
                onClick={() => handleDateFilterChange(type as DateFilterType)}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                  dateFilterType === type
                    ? 'bg-white text-[var(--primary-dark)] shadow-sm border border-gray-100'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'
                }`}>
                {type === 'alltime' ? 'All Time' : type.charAt(0).toUpperCase() + type.slice(1).replace('last', 'Last ')}
              </button>
            ))}

            <div className="h-4 w-px bg-gray-200 mx-1 hidden sm:block"></div>

            <button
              onClick={fetchOrders}
              className="p-1.5 text-[var(--primary-dark)] hover:bg-[var(--primary-alpha-10)] rounded-lg transition-all"
              title="Refresh Data">
              <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>

          {showCustomDatePicker && (
            <div className="mt-4 p-4 bg-[var(--primary-alpha-10)]/30 rounded-2xl border border-indigo-100 flex gap-4 animate-slide-left">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black text-indigo-400 uppercase ml-1 tracking-widest">START DATE</label>
                <input type="date" value={customDateRange.start} onChange={(e) => setCustomDateRange({ ...customDateRange, start: e.target.value })} className="px-3 py-1.5 bg-white rounded-lg border border-indigo-200 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-[var(--primary-color)] transition-all shadow-sm" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black text-indigo-400 uppercase ml-1 tracking-widest">END DATE</label>
                <input type="date" value={customDateRange.end} onChange={(e) => setCustomDateRange({ ...customDateRange, end: e.target.value })} className="px-3 py-1.5 bg-white rounded-lg border border-indigo-200 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-[var(--primary-color)] transition-all shadow-sm" />
              </div>
            </div>
          )}

          <div className="mt-4 flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
               <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-gray-400">
                 <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
               </span>
               <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by Invoice No, Customer, Phone or Payment Method..."
                className="w-full pl-11 pr-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-semibold focus:border-[var(--primary-color)] focus:ring-4 focus:ring-indigo-50 transition-all outline-none shadow-sm"
                />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest min-w-fit">Show</label>
              <select
                value={pagination.limit}
                onChange={(e) => setPagination(prev => ({ ...prev, limit: parseInt(e.target.value), page: 1 }))}
                className="px-3 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-black text-gray-700 outline-none focus:border-[var(--primary-color)] transition-all min-w-[80px]">
                {[10, 20, 50, 100, 500].map(l => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>

            <select
              value={paymentMethodFilter}
              onChange={(e) => setPaymentMethodFilter(e.target.value)}
              className="px-4 py-2.5 bg-white border border-gray-100 rounded-xl text-sm font-black text-gray-700 outline-none focus:border-[var(--primary-color)] transition-all min-w-[160px]">
              <option>All Methods</option>
              <option>Cash</option>
              <option>UPI</option>
              <option>Card</option>
              <option>Net Banking</option>
            </select>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar scrollbar-hide">
            <table className="w-full text-sm min-w-[1200px]">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-6 py-4 text-left">
                    <input
                      type="checkbox"
                      checked={selectedRows.size === orders.length && orders.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="w-4 h-4 text-[var(--primary-dark)] rounded border-gray-300 focus:ring-[var(--primary-color)] cursor-pointer transition-all"
                    />
                  </th>
                  <th className="px-4 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Invoice No</th>
                  <th className="px-4 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Date</th>
                  <th className="px-4 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Customer</th>
                  <th className="px-4 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Amount</th>
                  <th className="px-4 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Method</th>
                  <th className="px-4 py-4 text-left text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Status</th>
                  <th className="px-6 py-4 text-right text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                   <tr>
                     <td colSpan={8} className="px-6 py-24 text-center">
                       <div className="w-10 h-10 border-4 border-[var(--primary-color)] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                       <p className="text-gray-400 font-black text-[10px] uppercase tracking-[0.2em]">Syncing POS Records...</p>
                     </td>
                   </tr>
                ) : orders.length === 0 ? (
                  <tr><td colSpan={8} className="px-6 py-24 text-center text-gray-400 font-black italic tracking-widest uppercase text-[10px]">No POS invoices found</td></tr>
                ) : (
                  orders.map((item: any) => (
                    <tr key={item._id} className="hover:bg-[var(--primary-alpha-10)]/30 transition-colors group">
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedRows.has(item._id)}
                          onChange={() => handleSelectRow(item._id)}
                          className="w-4 h-4 text-[var(--primary-dark)] rounded border-gray-300 focus:ring-[var(--primary-color)] cursor-pointer transition-all"
                        />
                      </td>
                      <td className="px-4 py-4">
                        <Link to={`/admin/orders/${item._id}`} className="text-[var(--primary-dark)] font-black hover:underline underline-offset-4 decoration-2">
                          #{item.orderNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-4 font-bold text-gray-500 text-xs">{new Date(item.orderDate).toLocaleDateString()}</td>
                      <td className="px-4 py-4">
                        {editMode ? (
                          <div className="flex flex-col gap-1 min-w-[150px]">
                            <input
                              type="text"
                              value={item.customerName}
                              onChange={(e) => handleCellEdit(item._id, 'customerName', e.target.value)}
                              className="px-2 py-1 text-xs border border-gray-200 rounded-md focus:border-[var(--primary-color)] outline-none font-bold"
                            />
                            <input
                              type="text"
                              value={item.customerPhone}
                              onChange={(e) => handleCellEdit(item._id, 'customerPhone', e.target.value)}
                              className="px-2 py-1 text-[10px] border border-gray-200 rounded-md focus:border-[var(--primary-color)] outline-none font-mono"
                            />
                          </div>
                        ) : (
                          <div className="flex flex-col">
                            <span className="font-bold text-gray-900 leading-tight mb-1 text-xs">{item.customerName}</span>
                            <span className="text-[10px] font-black text-gray-400 tracking-wider font-mono">{item.customerPhone}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {editMode ? (
                           <div className="flex items-center gap-1 font-black text-gray-900 min-w-[100px]">
                             <span>₹</span>
                             <input
                              type="number"
                              value={item.total}
                              onChange={(e) => handleCellEdit(item._id, 'total', parseFloat(e.target.value))}
                              className="w-full px-2 py-1 text-xs border border-gray-200 rounded-md focus:border-[var(--primary-color)] outline-none font-black"
                            />
                           </div>
                        ) : (
                          <span className="font-black text-gray-900 text-sm">₹{item.total.toLocaleString()}</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className="px-3 py-1 bg-gray-100 rounded-lg text-[10px] font-black text-gray-500 uppercase tracking-widest">{item.paymentMethod}</span>
                      </td>
                      <td className="px-4 py-4 min-w-[140px]">
                        {editMode ? (
                           <select
                            value={item.status}
                            onChange={(e) => handleCellEdit(item._id, 'status', e.target.value)}
                            className={`w-full px-2 py-1 text-[10px] font-black rounded-md border border-gray-200 outline-none focus:border-[var(--primary-color)] transition-all uppercase tracking-widest ${item.status === 'Delivered' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                             {["Processed", "Delivered", "Cancelled"].map(s => (
                               <option key={s} value={s}>{s}</option>
                             ))}
                           </select>
                        ) : (
                          <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.15em] ${item.status === 'Delivered' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                            {item.status}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                         <Link to={`/admin/orders/${item._id}`} className="px-4 py-2 bg-white border border-gray-100 text-[var(--primary-dark)] rounded-xl text-[10px] font-black hover:bg-[var(--primary-dark)] hover:text-white hover:border-[var(--primary-dark)] transition-all active:scale-95 shadow-sm">Details</Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <div className="text-xs font-black text-gray-400 uppercase tracking-widest">
              Showing <span className="text-[var(--primary-dark)]">{orders.length}</span> of <span className="text-[var(--primary-dark)]">{pagination.total}</span> Invoices
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
                      className={`w-9 h-9 flex items-center justify-center rounded-xl text-xs font-black transition-all ${pagination.page === p ? 'bg-[var(--primary-dark)] text-white shadow-lg shadow-indigo-200' : 'hover:bg-[var(--primary-alpha-10)] text-gray-500'}`}>
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

export default AdminPOSInvoiceReport;
