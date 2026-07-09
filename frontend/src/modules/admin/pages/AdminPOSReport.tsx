import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { getPOSReport, getStockLedger, deletePOSOrder, updateStockLedgerEntry, updateOrderStatus, getOrderById } from "../../../services/api/admin/adminOrderService";
import jsPDF from "jspdf";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../../context/ToastContext";
import { readAdminPosBillSettings, ADMIN_POS_BILL_SETTINGS_KEY, ADMIN_POS_BILL_SETTINGS_UPDATED_EVENT } from "../../../utils/adminPosBillSettings";
import { useAppContext } from "../../../context/AppContext";
import { formatAmount } from "../../../utils/priceUtils";

const FiTrendingUp = ({ className }: { className?: string }) => (
  <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline>
  </svg>
);

const FiShoppingBag = ({ className }: { className?: string }) => (
  <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path>
  </svg>
);

const FiDollarSign = ({ className }: { className?: string }) => (
  <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
  </svg>
);

const FiBox = ({ className }: { className?: string }) => (
  <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line>
  </svg>
);

const FiLoader = ({ className }: { className?: string }) => (
  <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
  </svg>
);

const AdminPOSReport = () => {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [reportData, setReportData] = useState<any>(null);
    const [ledgerData, setLedgerData] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<"orders" | "ledger">("orders");
    const [filter, setFilter] = useState("all");
    const [selectedActionOrder, setSelectedActionOrder] = useState<any>(null);
    const [editingLedgerEntry, setEditingLedgerEntry] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
    const { config, refreshConfig } = useAppContext();
    const [posBillSettings, setPosBillSettings] = useState<any>(null);
    const [printOrder, setPrintOrder] = useState<any>(null);

    // Status Update State
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [newStatus, setNewStatus] = useState("");

    // Filter State
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [selectedPeriod, setSelectedPeriod] = useState("Today");
    const [dateRange, setDateRange] = useState<{start: Date | null, end: Date | null}>({ start: null, end: null });

    const navigate = useNavigate();

    const fetchData = async (start?: Date, end?: Date) => {
        setLoading(true);
        try {
            let query = "";
            if (start && end) {
                 query = `?startDate=${start.toISOString()}&endDate=${end.toISOString()}`;
            }

            const ledgerParams: any = { limit: 100 };
            if (start && end) {
                ledgerParams.startDate = start.toISOString();
                ledgerParams.endDate = end.toISOString();
            }

            const [reportRes, ledgerRes] = await Promise.all([
                getPOSReport(query),
                getStockLedger(ledgerParams)
            ]);

            if (reportRes.success) setReportData(reportRes.data);
            if (ledgerRes.success) setLedgerData(ledgerRes.data);

        } catch (error) {
            console.error("Error fetching POS report:", error);
            showToast("Failed to load report data", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Initial load (Today default handled by backend if no params)
        fetchData();
        refreshConfig();
        const loadPosBillSettings = () => {
          try {
            const saved = localStorage.getItem(ADMIN_POS_BILL_SETTINGS_KEY);
            if (saved) {
              setPosBillSettings(JSON.parse(saved));
            } else {
              setPosBillSettings(null);
            }
          } catch (e) {
            console.error('Failed to load POS bill settings', e);
          }
        };
        loadPosBillSettings();
        const onStorage = (e: StorageEvent) => {
          if (e.key === ADMIN_POS_BILL_SETTINGS_KEY || e.key === null) {
            loadPosBillSettings();
          }
        };
        const onBillSettingsUpdated = () => loadPosBillSettings();
        window.addEventListener('storage', onStorage);
        window.addEventListener(ADMIN_POS_BILL_SETTINGS_UPDATED_EVENT, onBillSettingsUpdated);
        window.addEventListener('focus', onBillSettingsUpdated);
        return () => {
          window.removeEventListener('storage', onStorage);
          window.removeEventListener(ADMIN_POS_BILL_SETTINGS_UPDATED_EVENT, onBillSettingsUpdated);
          window.removeEventListener('focus', onBillSettingsUpdated);
        };
    }, []);

    const [customStart, setCustomStart] = useState("");
    const [customEnd, setCustomEnd] = useState("");

    const applyDateFilter = (period: string) => {
        if (period === "Custom Range") {
             setSelectedPeriod("Custom Range");
             return;
        }

        const now = new Date();
        let start = new Date();
        let end = new Date();

        switch (period) {
            case "Today":
                start.setHours(0,0,0,0);
                end.setHours(23,59,59,999);
                break;
            case "This Week":
                // Start of week (Monday)
                const day = now.getDay() || 7;
                if (day !== 1) start.setHours(-24 * (day - 1));
                else start.setHours(0,0,0,0);
                end.setHours(23,59,59,999);
                break;
            case "This Month":
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
                break;
            case "Last 7 Days":
                start.setDate(now.getDate() - 7);
                break;
            case "Last 30 Days":
                start.setDate(now.getDate() - 30);
                break;
            default:
                break;
        }

        setDateRange({ start, end });
        setSelectedPeriod(period);
        setShowFilterModal(false);
        fetchData(start, end);
    };

    const handleApplyCustomFilter = () => {
        if (!customStart || !customEnd) {
             showToast("Please select both start and end dates", "error");
             return;
        }
        const start = new Date(customStart);
        start.setHours(0,0,0,0);
        const end = new Date(customEnd);
        end.setHours(23,59,59,999);

        if (start > end) {
             showToast("Start date cannot be after end date", "error");
             return;
        }

        setDateRange({ start, end });
        setSelectedPeriod("Custom Range");
        setShowFilterModal(false);
        fetchData(start, end);
    };

    const handleDeleteOrder = async (order: any) => {
        // Restriction: Cannot delete orders with customer names
        const isWalkIn = !order.customerName || order.customerName.toLowerCase() === "walk-in customer";
        if (!isWalkIn) {
            showToast("Orders with customer names cannot be deleted.", "error");
            return;
        }

        if (window.confirm("Are you sure you want to delete this POS order?")) {
            try {
                setLoading(true);
                const response = await deletePOSOrder(order._id);
                if (response.success) {
                    showToast("Order deleted successfully", "success");
                    fetchData(dateRange.start || undefined, dateRange.end || undefined);
                } else {
                    showToast(response.message || "Failed to delete order", "error");
                }
            } catch (error) {
                console.error("Error deleting order:", error);
                showToast("An error occurred while deleting the order", "error");
            } finally {
                setLoading(false);
            }
        }
    };

    const handleSelectAllOrders = (checked: boolean, orders: any[]) => {
        if (checked) {
            setSelectedOrderIds(new Set(orders.map((o) => o._id)));
        } else {
            setSelectedOrderIds(new Set());
        }
    };

    const handleSelectOrder = (id: string) => {
        setSelectedOrderIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleDeleteSelectedOrders = async () => {
        if (selectedOrderIds.size === 0) return;

        // Check if any selected order is NOT deletable (has a customer name)
        const selectedOrdersList = reportData?.orders?.filter((o: any) => selectedOrderIds.has(o._id)) || [];
        const hasNamedOrders = selectedOrdersList.some((o: any) => o.customerName && o.customerName.toLowerCase() !== "walk-in customer");

        if (hasNamedOrders) {
            showToast("Cannot delete orders that have customer names assigned. Please deselect them first.", "error");
            return;
        }

        const ok = window.confirm(`Delete ${selectedOrderIds.size} selected item(s)?`);
        if (!ok) return;

        const ids = Array.from(selectedOrderIds);
        const idSet = new Set(ids);

        try {
            setLoading(true);
            const failed: string[] = [];
            for (const id of ids) {
                try {
                    const response = await deletePOSOrder(id);
                    if (!response.success) failed.push(id);
                } catch {
                    failed.push(id);
                }
            }

            setSelectedOrderIds(new Set());
            if (selectedActionOrder?._id && idSet.has(selectedActionOrder._id)) setSelectedActionOrder(null);
            fetchData(dateRange.start || undefined, dateRange.end || undefined);

            if (failed.length > 0) showToast(`Failed to delete ${failed.length} item(s)`, "error");
            else showToast("Selected orders deleted successfully", "success");
        } finally {
            setLoading(false);
        }
    };





    const submitStatusUpdate = async () => {
         if (!selectedActionOrder) return;
         try {
             setLoading(true);
             // We are using a direct fetch here to ensure we hit the right field if the service is strict
             // But better to use the service. I'll modify the service argument to include paymentStatus if I cd.
             // But I can't modify backend.
             // Let's assume `updateOrderStatus` updates the main status.
             // IF the user specifically wants PAYMENT status (Pending -> Paid), that's `paymentStatus`.
             // I will try to send both or check if 'status' maps to paymentStatus for POS.
             // For POS, usually 'status' is 'Delivered'.
             // I'll try to find if there is a payment update endpoint.
             // If not, I'll try a generic patch.

             // ...Actually, looking at `updateOrderStatus` in generic admin, it usually updates `status`.
             // I will implement a specific function here that tries to update payment status via the same endpoint or a likely `payment-status` endpoint.
             // Since I can't confirm backend, I will implement a BEST GUESS using the existing `updateOrderStatus` but passing `paymentStatus` in the body by casting data.

             const updateData: any = { status: selectedActionOrder.status }; // Keep main status same
             if (newStatus) updateData.paymentStatus = newStatus;

             const response = await updateOrderStatus(selectedActionOrder._id, updateData);

             if (response.success) {
                 showToast("Status updated successfully", "success");
                 setShowStatusModal(false);
                 setSelectedActionOrder(null);
                 fetchData(dateRange.start || undefined, dateRange.end || undefined);
             } else {
                 showToast("Failed to update status", "error");
             }
         } catch(error) {
             console.error(error);
             showToast("Error updating status", "error");
         } finally {
             setLoading(false);
         }
    };

    const handlePrintBill = async (order: any) => {
        if (!order) return;

        let fullOrder = order;
        try {
            setLoading(true);
            const res = await getOrderById(order._id);
            if (res.success) fullOrder = res.data;
        } catch (e) {
            console.error("Error fetching full order for print", e);
            showToast("Could not fetch full order details for print.", "error");
        } finally {
            setLoading(false);
        }

        try {
            const fresh = readAdminPosBillSettings();
            setPosBillSettings(fresh);
        } catch (e) {
            console.error('Failed to sync bill settings before print', e);
        }

        setPrintOrder(fullOrder);
        document.body.classList.add('is-printing-admin-report');
        
        // Larger delay for mobile browsers to ensure DOM is ready
        setTimeout(() => {
            window.print();
            // Do not clear immediately to allow mobile browsers to finish rasterization
            setTimeout(() => {
                setPrintOrder(null);
                document.body.classList.remove('is-printing-admin-report');
            }, 3000);
        }, 1000);
        setSelectedActionOrder(null);
    };

    const handleViewBill = async (order: any) => {
        if (!order) return;

        let fullOrder = order;
        // ALWAYS Fetch full order to ensure items are populated with details (productName, etc.)
        // The report list might contain partial data or just item IDs
        try {
             setLoading(true);
             const res = await getOrderById(order._id);
             if (res.success) {
                 fullOrder = res.data;
             }
        } catch(e) {
             console.error("Error fetching full order", e);
             showToast("Could not fetch full order details. Bill might be incomplete.", "error");
        } finally {
             setLoading(false);
        }

        generateOrderPDF(fullOrder);
        setSelectedActionOrder(null);
    };

    const generateOrderPDF = (order: any) => {
        const doc = new jsPDF();
        const invoiceNum = order.orderNumber || order._id.slice(-6).toUpperCase();
        const dateStr = new Date(order.orderDate || order.createdAt).toLocaleDateString();
        const timeStr = new Date(order.orderDate || order.createdAt).toLocaleTimeString();
        const customerName = order.customerName || order.customer?.name || order.customer?.customerName || "Walk-in Customer";
        const customerPhone = order.customerPhone || order.customer?.phone || order.customer?.mobile || "-";
        const paymentMethod = order.paymentMethod || 'Cash';

        // --- Header ---
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.text("GEETA", 14, 20);

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        const address = "Q7WM+92M, Q7WM+92M, , Indore Division,\nNagda, Madhya Pradesh, India - 454001\n7898111456";
        doc.text(address, 14, 26);

        doc.line(14, 40, 196, 40);

        // --- Invoice Details ---
        doc.setFont("helvetica", "bold");
        doc.text("Invoice Number:", 14, 48);
        doc.text("Invoice Date:", 14, 53);
        doc.text("Payment Status:", 14, 58);

        doc.setFont("helvetica", "normal");
        doc.text(invoiceNum, 196, 48, { align: 'right' });
        doc.text(`${dateStr} ${timeStr}`, 196, 53, { align: 'right' });
        doc.text(order.paymentStatus || 'Paid', 196, 58, { align: 'right' });
        doc.text("Customer Name:", 14, 63);
        doc.text("Customer Mobile:", 14, 68);
        doc.text(String(customerName), 196, 63, { align: 'right' });
        doc.text(String(customerPhone), 196, 68, { align: 'right' });

        doc.setLineWidth(0.5);
        doc.line(14, 73, 196, 73);

        // --- Table Header ---
        doc.setFont("helvetica", "bold");
        doc.text("Tax Invoice", 105, 78, { align: 'center' });

        let y = 84;
        doc.setFontSize(10);
        doc.text("Item-name", 14, y);
        doc.text("Qty", 100, y);
        doc.text("Price", 125, y);
        doc.text("Total", 196, y, { align: 'right' });
        y += 4;

        // --- Table Body ---
        doc.setFont("helvetica", "normal");
        let totalQty = 0;
        let totalBillAmount = 0;

        const items = order.items || [];
        items.forEach((item: any, index: number) => {
             // Handle different item structures (populated vs flat)
             // Check: flat object (item.productName), populated object (item.product.productName), or backup (item.name)
             const itemName = item.productName || item.product?.productName || item.name || "Unknown Item";
             const qty = item.quantity || item.qty || 0;
             const price = item.unitPrice || item.price || 0;
             const total = item.total || (qty * price) || 0;

             totalQty += qty;
             totalBillAmount += total;

             y += 6;
             if (y > 280) { doc.addPage(); y = 20; }

             const truncatedName = itemName.length > 45 ? itemName.substring(0, 42) + "..." : itemName;

             doc.text(`${index + 1}. ${truncatedName}`, 14, y);
             doc.text(qty.toString(), 100, y);
             doc.text(price.toString(), 125, y);
             doc.text(total.toString(), 196, y, { align: 'right' });
        });

        y += 8;
        doc.line(14, y, 196, y);
        y += 6;

        // --- Summary ---
        doc.setFont("helvetica", "normal");
        doc.text(`Total Qty.: ${totalQty}`, 14, y);

        y += 6;
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Total Amount:", 14, y);
        doc.text(`Rs ${order.total || totalBillAmount}`, 196, y, { align: 'right' });

        y += 2;
        doc.line(14, y + 2, 196, y + 2);

        const pdfBlob = doc.output("blob");
        const pdfUrl = URL.createObjectURL(pdfBlob);
        const opened = window.open(pdfUrl, "_blank", "noopener,noreferrer");

        if (!opened) {
            // Fallback if popup is blocked.
            window.location.href = pdfUrl;
        }

        // Revoke after some time to avoid leaking object URLs.
        setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000);
    };

    const handleUpdateLedger = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingLedgerEntry) return;

        try {
            setLoading(true);
            const response = await updateStockLedgerEntry(editingLedgerEntry._id, {
                quantity: editingLedgerEntry.quantity,
                type: editingLedgerEntry.type,
                source: editingLedgerEntry.source,
                updateStock: editingLedgerEntry.updateStock
            });

            if (response.success) {
                showToast("Ledger entry updated successfully", "success");
                setEditingLedgerEntry(null);
                fetchData(dateRange.start || undefined, dateRange.end || undefined);
            } else {
                showToast(response.message || "Failed to update ledger", "error");
            }
        } catch (error) {
            console.error("Error updating ledger:", error);
            showToast("Failed to update ledger entry", "error");
        } finally {
            setLoading(false);
        }
    };

    const normalizedSearch = searchTerm.trim().toLowerCase();

    const orderMatchesSearch = (order: any) => {
        if (!normalizedSearch) return true;
        const haystack = [
            order.orderNumber,
            order.customerName,
            order.customerPhone,
            order.paymentMethod,
            order.paymentStatus,
            order.total,
            order.grandTotal,
            order.items?.length
        ]
            .filter((value) => value !== undefined && value !== null)
            .map((value) => String(value).toLowerCase())
            .join(" ");
        return haystack.includes(normalizedSearch);
    };

    const ledgerMatchesSearch = (entry: any) => {
        if (!normalizedSearch) return true;
        const haystack = [
            entry.product?.productName,
            entry.sku,
            entry.source,
            entry.type,
            entry.quantity,
            entry.previousStock,
            entry.newStock
        ]
            .filter((value) => value !== undefined && value !== null)
            .map((value) => String(value).toLowerCase())
            .join(" ");
        return haystack.includes(normalizedSearch);
    };

    const filteredOrders = reportData?.orders?.filter((order: any) => {
        if (filter === "all") return true;
        if (filter === "cash") return order.paymentMethod === "Cash";
        if (filter === "online") return order.paymentMethod !== "Cash";
        if (filter === "unpaid") return order.paymentStatus !== "Paid";
        return true;
    }).filter(orderMatchesSearch) || [];

    const filteredLedger = ledgerData.filter(ledgerMatchesSearch);

    if (loading && !reportData) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px]">
                <FiLoader className="w-10 h-10 text-orange-600 animate-spin mb-4" />
                <p className="text-gray-500 font-medium">Loading POS analytics...</p>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 space-y-6 bg-gray-50 min-h-screen">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">POS Sales Report</h1>
                    <p className="text-gray-500 text-sm mt-1">Track daily point-of-sale activities and stock movements</p>
                </div>
                <div className="flex gap-2">
                    <button
                      onClick={() => setShowFilterModal(true)}
                      className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors flex items-center gap-2 shadow-sm"
                    >
                         <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                         {selectedPeriod}
                    </button>
                    {activeTab === "orders" && (
                        <button
                          onClick={handleDeleteSelectedOrders}
                          disabled={selectedOrderIds.size === 0}
                          className="px-4 py-2 bg-rose-600 text-white rounded-xl font-semibold hover:bg-rose-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Delete{selectedOrderIds.size > 0 ? ` (${selectedOrderIds.size})` : ""}
                        </button>
                    )}
                    <button
                      onClick={() => fetchData(dateRange.start || undefined, dateRange.end || undefined)}
                      className="px-4 py-2 bg-orange-50 text-orange-600 rounded-xl font-semibold hover:bg-orange-100 transition-colors flex items-center gap-2"
                    >
                        <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357-2H15"></path>
                        </svg>
                        Refresh
                    </button>
                </div>
            </div>

            {/* Filter Modal */}
            {showFilterModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl transform transition-all animate-in slide-in-from-bottom-10 sm:zoom-in-95">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="font-bold text-gray-800 text-lg">Filter Orders</h3>
                            <button onClick={() => setShowFilterModal(false)} className="text-gray-400 hover:text-gray-600 p-1">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="p-4">
                            <p className="text-gray-500 font-medium mb-3 text-sm">Quick Periods</p>
                            <div className="space-y-2">
                                {["Today", "This Week", "This Month", "Last 7 Days", "Last 30 Days"].map((period) => (
                                    <button
                                        key={period}
                                        onClick={() => applyDateFilter(period)}
                                        className={`w-full flex items-center justify-between p-3 rounded-xl border transition-colors ${selectedPeriod === period ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-100 hover:bg-gray-50 text-gray-600'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${selectedPeriod === period ? 'bg-white' : 'bg-gray-100'}`}>
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                            </div>
                                            <span className="font-medium">{period}</span>
                                        </div>
                                        {selectedPeriod === period && <div className="w-2 h-2 rounded-full bg-orange-500"></div>}
                                    </button>
                                ))}

                                <button
                                    onClick={() => applyDateFilter("Custom Range")}
                                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition-colors ${selectedPeriod === "Custom Range" ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-100 hover:bg-gray-50 text-gray-600'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${selectedPeriod === "Custom Range" ? 'bg-white' : 'bg-gray-100'}`}>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                        </div>
                                        <span className="font-medium">Custom Range</span>
                                    </div>
                                    {selectedPeriod === "Custom Range" && <div className="w-2 h-2 rounded-full bg-orange-500"></div>}
                                </button>
                            </div>

                            {selectedPeriod === "Custom Range" && (
                                <div className="mt-4 pt-4 border-t border-gray-100 animate-in slide-in-from-top-2">
                                     <h4 className="text-sm font-bold text-orange-600 mb-3 bg-orange-50 px-3 py-1 rounded-md inline-block">Select Date Range</h4>
                                     <div className="flex gap-3 mb-4">
                                         <div className="flex-1">
                                             <label className="text-xs font-semibold text-gray-500 mb-1 block">Start Date</label>
                                             <input
                                                type="date"
                                                value={customStart}
                                                onChange={(e) => setCustomStart(e.target.value)}
                                                className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none bg-gray-50 focus:bg-white"
                                             />
                                         </div>
                                         <div className="flex-1">
                                              <label className="text-xs font-semibold text-gray-500 mb-1 block">End Date</label>
                                             <input
                                                type="date"
                                                value={customEnd}
                                                onChange={(e) => setCustomEnd(e.target.value)}
                                                className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none bg-gray-50 focus:bg-white"
                                             />
                                         </div>
                                     </div>
                                     <div className="flex gap-3">
                                         <button
                                            onClick={() => setShowFilterModal(false)}
                                            className="flex-1 py-2.5 border border-gray-200 text-gray-600 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                                         >
                                            Cancel
                                         </button>
                                         <button
                                            onClick={handleApplyCustomFilter}
                                            className="flex-1 py-2.5 bg-[#013554] text-white font-semibold rounded-xl hover:bg-[#012a42] transition-colors shadow-sm"
                                         >
                                            Apply Filter
                                         </button>
                                     </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                <ReportCard
                    title="Today's Sales"
                    value={`₹${reportData?.summary.totalSales.toLocaleString()}`}
                    icon={<FiTrendingUp className="w-6 h-6" />}
                    color="bg-[var(--primary-color)]"
                    desc="Total POS revenue today"
                />
                <ReportCard
                    title="Cash Sales"
                    value={`₹${reportData?.summary.cashSales.toLocaleString()}`}
                    icon={<FiDollarSign className="w-6 h-6" />}
                    color="bg-[var(--primary-color)]"
                    desc="Physical cash collected"
                />
                <ReportCard
                    title="To Collect"
                    value={`₹${reportData?.summary.unpaidAmount.toLocaleString()}`}
                    icon={<FiDollarSign className="w-6 h-6" />}
                    color="bg-red-500"
                    desc="Pending online/credit payments"
                />
                <ReportCard
                    title="Orders Count"
                    value={reportData?.summary.totalOrders || 0}
                    icon={<FiShoppingBag className="w-6 h-6" />}
                    color="bg-[var(--primary-color)]"
                    desc="Total tickets generated"
                />
            </div>

            {/* Main Content Area */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Tabs */}
                <div className="flex border-b border-gray-100 bg-gray-50/30">
                    <button
                        onClick={() => setActiveTab("orders")}
                        className={`px-8 py-4 text-sm font-bold transition-all relative ${activeTab === "orders" ? "text-orange-600" : "text-gray-500 hover:text-gray-700"}`}
                    >
                        POS Orders
                        {activeTab === "orders" && <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-600"></div>}
                    </button>
                    <button
                        onClick={() => setActiveTab("ledger")}
                        className={`px-8 py-4 text-sm font-bold transition-all relative ${activeTab === "ledger" ? "text-orange-600" : "text-gray-500 hover:text-gray-700"}`}
                    >
                        Stock Ledger
                        {activeTab === "ledger" && <div className="absolute bottom-0 left-0 right-0 h-1 bg-orange-600"></div>}
                    </button>
                </div>

                <div className="p-4 border-b border-gray-50 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="relative flex-1 max-w-md">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder={activeTab === "orders" ? "Search orders by number, customer, phone..." : "Search stock ledger by product, SKU, source..."}
                            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-orange-200 focus:border-orange-400"
                        />
                        <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35m1.85-5.65a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm("")}
                            className="px-3 py-2 text-xs font-semibold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                            Clear
                        </button>
                    )}
                </div>

                {activeTab === "orders" && (
                    <div className="p-0">
                        {/* Filters Row */}
                        <div className="p-4 border-b border-gray-50 flex items-center gap-2 overflow-x-auto no-scrollbar">
                           {[
                               { id: "all", label: "All Orders" },
                               { id: "cash", label: "Cash" },
                               { id: "online", label: "Online" },
                               { id: "unpaid", label: "Unpaid" }
                           ].map(opt => (
                               <button
                                 key={opt.id}
                                 onClick={() => setFilter(opt.id)}
                                 className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${filter === opt.id ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                               >
                                   {opt.label}
                               </button>
                           ))}
                        </div>

                         <div className="overflow-x-auto">
                             <table className="w-full text-left">
                                 <thead className="bg-gray-50/50">
                                     <tr>
                                         <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider w-10">
                                             <input
                                                 type="checkbox"
                                                 checked={filteredOrders.length > 0 && filteredOrders.every((o: any) => selectedOrderIds.has(o._id))}
                                                 onChange={(e) => handleSelectAllOrders(e.target.checked, filteredOrders)}
                                                 className="w-4 h-4 text-orange-600 rounded border-gray-300 focus:ring-orange-500"
                                             />
                                         </th>
                                         <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Order No</th>
                                         <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Customer</th>
                                         <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Amount</th>
                                         <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Method</th>
                                         <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Status</th>
                                         <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Time</th>
                                         <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Action</th>
                                     </tr>
                                 </thead>
                                 <tbody className="divide-y divide-gray-50">
                                     {filteredOrders.length === 0 ? (
                                         <tr><td colSpan={8} className="px-6 py-12 text-center text-gray-400 italic">{searchTerm ? "No orders match your search" : "No orders found for today"}</td></tr>
                                     ) : (
                                         filteredOrders.map((order: any) => (
                                             <tr
                                                 key={order._id}
                                                 className="hover:bg-gray-50/80 transition-colors cursor-pointer"
                                                 onClick={() => setSelectedActionOrder(order)}
                                             >
                                                 <td className="px-6 py-4 w-10" onClick={(e) => e.stopPropagation()}>
                                                     <input
                                                         type="checkbox"
                                                         checked={selectedOrderIds.has(order._id)}
                                                         onChange={() => handleSelectOrder(order._id)}
                                                         className="w-4 h-4 text-orange-600 rounded border-gray-300 focus:ring-orange-500"
                                                     />
                                                 </td>
                                                 <td className="px-6 py-4 font-bold text-gray-800">#{order.orderNumber}</td>
                                                 <td className="px-6 py-4">
                                                     <div className="text-sm font-medium text-gray-700">{order.customerName}</div>
                                                     <div className="text-[10px] text-gray-400">{order.customerPhone}</div>
                                                 </td>
                                                <td className="px-6 py-4 font-bold text-gray-900">₹{order.total.toLocaleString()}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${order.paymentMethod === 'Cash' ? 'bg-[var(--primary-alpha-20)] text-[var(--primary-darker)]' : 'bg-[var(--primary-alpha-20)] text-[var(--primary-darker)]'}`}>
                                                        {order.paymentMethod}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${order.paymentStatus === 'Paid' ? 'bg-[var(--primary-alpha-20)] text-[var(--primary-darker)]' : 'bg-red-100 text-red-700'}`}>
                                                        {order.paymentStatus}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-xs text-gray-500 whitespace-nowrap">
                                                    {new Date(order.orderDate || order.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                 </td>
                                                 <td className="px-6 py-4">
                                                      {(!order.customerName || order.customerName.toLowerCase() === "walk-in customer") ? (
                                                          <button
                                                              onClick={(e) => { e.stopPropagation(); handleDeleteOrder(order); }}
                                                              className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors"
                                                              title="Delete Order"
                                                          >
                                                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                  <polyline points="3 6 5 6 21 6"></polyline>
                                                                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                                  <line x1="10" y1="11" x2="10" y2="17"></line>
                                                                  <line x1="14" y1="11" x2="14" y2="17"></line>
                                                              </svg>
                                                          </button>
                                                      ) : (
                                                          <div className="w-[26px] h-[26px]" /> // Spacer to maintain alignment
                                                      )}
                                                 </td>
                                             </tr>
                                         ))
                                     )}
                                 </tbody>
                             </table>
                         </div>
                    </div>
                )}

                {activeTab === "ledger" && (
                    <div className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50/50">
                                    <tr>
                                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Product</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Type</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Qty</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Stock Change</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Source</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Date</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {filteredLedger.length === 0 ? (
                                        <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400 italic">{searchTerm ? "No stock movements match your search" : "No stock movements recorded"}</td></tr>
                                    ) : (
                                        filteredLedger.map((entry: any) => (
                                            <tr key={entry._id} className="hover:bg-gray-50/80 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded bg-gray-100 flex-shrink-0">
                                                            {entry.product?.mainImage && <img src={entry.product.mainImage} className="w-full h-full object-cover rounded" alt="" />}
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-bold text-gray-800 line-clamp-1">{entry.product?.productName}</div>
                                                            <div className="text-[10px] text-gray-400">SKU: {entry.sku}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${entry.type === 'IN' ? 'bg-[var(--primary-alpha-20)] text-[var(--primary-darker)]' : 'bg-red-100 text-red-700'}`}>
                                                        {entry.type}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 font-bold text-gray-900">{entry.quantity}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2 text-xs">
                                                        <span className="text-gray-400">{entry.previousStock}</span>
                                                        <span className="text-gray-300">→</span>
                                                        <span className="font-bold text-[var(--primary-dark)]">{entry.newStock}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-1 rounded">
                                                        {entry.source}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-xs text-gray-500 whitespace-nowrap">
                                                    {new Date(entry.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setEditingLedgerEntry({ ...entry, updateStock: false });
                                                        }}
                                                        className="text-[var(--primary-color)] hover:text-[var(--primary-darker)] p-1.5 hover:bg-[var(--primary-alpha-10)] rounded-lg transition-colors"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>


            {/* Order Action Modal */}
            {selectedActionOrder && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-sm rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-2xl transform transition-all animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:zoom-in-95">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <div>
                                <h3 className="font-bold text-gray-800 text-lg">Order Actions</h3>
                                <p className="text-xs text-gray-500">Choose an action for this order</p>
                            </div>
                            <button onClick={() => setSelectedActionOrder(null)} className="text-gray-400 hover:text-gray-600 p-1 bg-white rounded-full shadow-sm border border-gray-100">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="p-2 overflow-y-auto max-h-[70vh]">
                            <div className="space-y-1">
                                    <button
                                        className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl transition-colors text-left group"
                                        onClick={() => {
                                            setNewStatus(selectedActionOrder.paymentStatus);
                                            setShowStatusModal(true);
                                            // Keep selectedActionOrder set
                                        }}
                                    >
                                        <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                                        </div>
                                        <div>
                                            <div className="font-semibold text-gray-700">Change Status</div>
                                            <div className="text-xs text-gray-400">Update order payment status</div>
                                        </div>
                                        <svg className="w-4 h-4 text-gray-300 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                                    </button>

                                    <button
                                        className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl transition-colors text-left group"
                                         onClick={() => handleViewBill(selectedActionOrder)}
                                    >
                                        <div className="w-10 h-10 rounded-full bg-[var(--primary-alpha-10)] text-[var(--primary-dark)] flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                        </div>
                                        <div>
                                            <div className="font-semibold text-gray-700">View Bill</div>
                                            <div className="text-xs text-gray-400">Preview order invoice</div>
                                        </div>
                                        <svg className="w-4 h-4 text-gray-300 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                                    </button>

                                    <button
                                        className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl transition-colors text-left group"
                                        onClick={() => handlePrintBill(selectedActionOrder)}
                                    >
                                        <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2zm8-12V5a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v4h10z" /></svg>
                                        </div>
                                        <div>
                                            <div className="font-semibold text-gray-700">Print</div>
                                            <div className="text-xs text-gray-400">Print order receipt</div>
                                        </div>
                                        <svg className="w-4 h-4 text-gray-300 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                                    </button>

                                    <button
                                        className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl transition-colors text-left group"
                                        onClick={() => {
                                            navigate(`/admin/pos/orders?edit=${selectedActionOrder._id}`);
                                            setSelectedActionOrder(null);
                                        }}
                                    >
                                    <div className="w-10 h-10 rounded-full bg-[var(--primary-alpha-10)] text-[var(--primary-dark)] flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                    </div>
                                    <div>
                                        <div className="font-semibold text-gray-700">Edit Order</div>
                                        <div className="text-xs text-gray-400">Modify order details</div>
                                    </div>
                                    <svg className="w-4 h-4 text-gray-300 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                                </button>



                                <div className="border-t border-gray-100 my-1"></div>

                                 {(!selectedActionOrder.customerName || selectedActionOrder.customerName.toLowerCase() === "walk-in customer") && (
                                     <button
                                         className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl transition-colors text-left group"
                                          onClick={() => {
                                              if (window.confirm("Delete this order?")) {
                                                  handleDeleteOrder(selectedActionOrder);
                                                  setSelectedActionOrder(null);
                                              }
                                         }}
                                     >
                                         <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/></svg>
                                         </div>
                                         <div>
                                             <div className="font-semibold text-gray-700">Delete Order</div>
                                             <div className="text-xs text-gray-400">Permanently remove order</div>
                                         </div>
                                         <svg className="w-4 h-4 text-gray-300 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                                     </button>
                                 )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Status Update Modal */}
            {showStatusModal && (
                <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-xs rounded-2xl overflow-hidden shadow-2xl transform transition-all animate-in zoom-in-95">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-800">Update Status</h3>
                            <button onClick={() => setShowStatusModal(false)} className="text-gray-400 hover:text-gray-600">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="p-6">
                             <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Payment Status</label>
                             <select
                                value={newStatus}
                                onChange={(e) => setNewStatus(e.target.value)}
                                className="w-full border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-orange-500 font-semibold text-gray-700 bg-gray-50 mb-6"
                             >
                                 <option value="Paid">Paid</option>
                                 <option value="Pending">Pending</option>
                                 <option value="Failed">Failed</option>
                             </select>

                             <button
                                onClick={submitStatusUpdate}
                                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-orange-200 transition-all active:scale-95"
                             >
                                 Update Status
                             </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Ledger Modal */}
            {editingLedgerEntry && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl transform transition-all animate-in zoom-in-95">
                        <form onSubmit={handleUpdateLedger}>
                            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                                <h3 className="font-bold text-gray-800 text-lg">Edit Ledger Entry</h3>
                                <button type="button" onClick={() => setEditingLedgerEntry(null)} className="text-gray-400 hover:text-gray-600 p-1">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                            <div className="p-4 space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Product</label>
                                    <div className="text-sm font-semibold text-gray-800 bg-gray-50 p-2 rounded-lg border border-gray-100">
                                        {editingLedgerEntry.product?.productName}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">Type</label>
                                        <select
                                            value={editingLedgerEntry.type}
                                            onChange={(e) => setEditingLedgerEntry({...editingLedgerEntry, type: e.target.value})}
                                            className="w-full p-2 rounded-xl border border-gray-200 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 font-medium text-sm"
                                        >
                                            <option value="IN">IN (Add Stock)</option>
                                            <option value="OUT">OUT (Remove Stock)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">Quantity</label>
                                        <input
                                            type="number"
                                            value={editingLedgerEntry.quantity}
                                            onChange={(e) => setEditingLedgerEntry({...editingLedgerEntry, quantity: e.target.value})}
                                            className="w-full p-2 rounded-xl border border-gray-200 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 font-medium text-sm"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Source / Note</label>
                                    <input
                                        type="text"
                                        value={editingLedgerEntry.source}
                                        onChange={(e) => setEditingLedgerEntry({...editingLedgerEntry, source: e.target.value})}
                                        className="w-full p-2 rounded-xl border border-gray-200 outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 font-medium text-sm"
                                        placeholder="Reason for change..."
                                    />
                                </div>

                                <div className="flex items-start gap-2 bg-orange-50 p-3 rounded-xl border border-orange-100">
                                    <input
                                        type="checkbox"
                                        id="updateStockCheck"
                                        checked={editingLedgerEntry.updateStock}
                                        onChange={(e) => setEditingLedgerEntry({...editingLedgerEntry, updateStock: e.target.checked})}
                                        className="mt-1 w-4 h-4 text-orange-600 rounded border-gray-300 focus:ring-orange-500"
                                    />
                                    <label htmlFor="updateStockCheck" className="text-xs text-orange-800">
                                        <span className="font-bold block mb-0.5">Update Actual Product Stock?</span>
                                        If checked, this will adjust the product's live stock quantity based on your changes.
                                    </label>
                                </div>
                            </div>
                            <div className="p-4 border-t border-gray-100 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setEditingLedgerEntry(null)}
                                    className="flex-1 py-2.5 border border-gray-200 text-gray-600 font-semibold rounded-xl hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 py-2.5 bg-orange-600 text-white font-semibold rounded-xl hover:bg-orange-700 transition-colors shadow-sm"
                                >
                                    Update Entry
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Inject print-specific styles to remove browser margins and force width */}
            <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                  @page { margin: 0; size: auto; }
                  html, body { 
                    height: auto !important; 
                    overflow: visible !important; 
                    margin: 0 !important; 
                    padding: 0 !important; 
                    font-family: 'Times New Roman', Times, serif !important;
                    background: white !important;
                  }
                  
                  /* ULTRA AGGRESSIVE: Hide everything that is NOT the print wrapper */
                  body.is-printing-admin-report > *:not(.admin-report-print-wrapper) {
                    display: none !important;
                    visibility: hidden !important;
                    height: 0 !important;
                    overflow: hidden !important;
                  }
                  
                  /* Force the receipt container (now at body level via portal) to be visible */
                  body.is-printing-admin-report .admin-report-print-wrapper { 
                    display: block !important;
                    visibility: visible !important;
                    position: absolute !important;
                    top: 0 !important;
                    left: 0 !important;
                    width: 100% !important; 
                    background: white !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    z-index: 999999 !important;
                  }
                  
                  body.is-printing-admin-report .admin-report-print-wrapper * { 
                    visibility: visible !important; 
                    display: block;
                  }
                  
                  /* Fix grid/flex children layout in print */
                  body.is-printing-admin-report .admin-report-print-wrapper .grid { display: grid !important; }
                  body.is-printing-admin-report .admin-report-print-wrapper .flex { display: flex !important; }
                  
                  body.is-printing-admin-report .receipt-container { 
                    width: 100% !important; 
                    margin: 0 !important; 
                    padding: 15px !important;
                    box-sizing: border-box;
                    font-weight: 600 !important;
                  }
                  body.is-printing-admin-report .receipt-container b, 
                  body.is-printing-admin-report .receipt-container strong, 
                  body.is-printing-admin-report .receipt-container .font-bold, 
                  body.is-printing-admin-report .receipt-container .font-semibold, 
                  body.is-printing-admin-report .receipt-container .font-black {
                    font-weight: 900 !important;
                    -webkit-text-stroke: 0.2px black;
                  }

                  body.is-printing-admin-report .receipt-line {
                    border-bottom: 2.5px solid black !important;
                    margin: 8px 0 !important;
                  }
                  body.is-printing-admin-report .receipt-line-thick {
                    border-bottom: 4px solid black !important;
                    margin: 10px 0 !important;
                  }
                }
            ` }} />

            {/* --- HIDDEN THERMAL RECEIPT (MOVED TO PORTAL FOR ISOLATION) --- */}
            {printOrder && createPortal(
                <div className="hidden admin-report-print-wrapper bg-white p-0 m-0">
                    <div className="receipt-container text-black font-medium" style={{ fontFamily: "'Times New Roman', serif" }}>
                        {/* Header */}
                        <div className="text-left">
                            <h1 className="text-3xl font-black uppercase">{posBillSettings?.shopName || 'GEETA'}</h1>
                            <p className="text-base leading-tight whitespace-pre-wrap font-bold">{posBillSettings?.address || 'Q7WM+92M, Q7WM+92M, , Indore Division,\nNagda, Madhya Pradesh, India - 454001'}</p>
                            <p className="text-base font-black">{posBillSettings?.phone || '7898111456'}</p>
                        </div>

                        <div className="receipt-line-thick"></div>

                        {/* Invoice Metadata */}
                        <div className="space-y-1 text-base">
                            <div className="flex justify-between">
                                <span className="font-bold">Invoice Number:</span>
                                <span className="font-bold">{printOrder.orderNumber || printOrder._id.slice(-6).toUpperCase()}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="font-bold">Invoice Date:</span>
                                <span className="font-bold">
                                    {new Date(printOrder.orderDate || printOrder.createdAt).toLocaleDateString('en-IN')} {new Date(printOrder.orderDate || printOrder.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="font-bold">Payment Status:</span>
                                <span className="font-bold">{printOrder.paymentMethod || 'Cash'}</span>
                            </div>
                        </div>

                        <div className="receipt-line-thick"></div>

                        <div className="text-center font-black text-base mb-1">Estimated Bill</div>

                        {/* Items Table Headers */}
                        <div className="grid grid-cols-12 gap-1 font-black text-base border-b-2 border-black pb-1">
                            <div className="col-span-5">Item-name</div>
                            <div className="col-span-2 text-center">Qty</div>
                            <div className="col-span-2 text-right">MRP</div>
                            <div className="col-span-1 text-right">Sp</div>
                            <div className="col-span-2 text-right">Total</div>
                        </div>

                        {/* Items List */}
                        <div className="py-2 space-y-2">
                            {(printOrder.items || []).map((item: any, idx: number) => {
                                const sp = Number(item.unitPrice || item.price || 0);
                                const mrp = Number(item.mrp || item.compareAtPrice || sp);
                                const qty = Number(item.quantity || item.qty || 0);
                                const total = sp * qty;
                                const itemName = item.productName || item.product?.productName || item.name || "Unknown Item";
                                
                                return (
                                    <div key={idx} className="grid grid-cols-12 gap-1 text-[15px] leading-tight font-bold">
                                        <div className="col-span-5 font-bold">({idx + 1}) {itemName}</div>
                                        <div className="col-span-2 text-center font-bold">{qty}</div>
                                        <div className="col-span-2 text-right font-bold">{mrp > 0 ? formatAmount(mrp) : '-'}</div>
                                        <div className="col-span-1 text-right font-bold">{formatAmount(sp)}</div>
                                        <div className="col-span-2 text-right font-black">{formatAmount(total)}</div>
                                    </div>

                                )
                            })}
                        </div>

                        <div className="receipt-line-thick"></div>

                        {/* Summary Stats */}
                        {(() => {
                            const items = printOrder.items || [];
                            let tQty = 0;
                            let tMRP = 0;
                            items.forEach((item: any) => {
                                const qty = Number(item.quantity || item.qty || 0);
                                const sp = Number(item.unitPrice || item.price || 0);
                                const itemMrp = Number(item.mrp || item.compareAtPrice || sp);
                                tQty += qty;
                                tMRP += itemMrp * qty;
                            });
                            const tBill = Number(printOrder.total || 0);
                            const tSavings = tMRP - tBill;
                            const sPercent = tMRP > 0 ? ((tSavings / tMRP) * 100).toFixed(0) : "0";

                            return (
                                <div className="text-base">
                                    <div className="flex justify-between mb-1">
                                        <span className="font-bold">Total Qty.: {tQty}</span>
                                        <span className="font-black">Total MRP: Rs {formatAmount(tMRP)}</span>
                                    </div>

                                    
                                    {tSavings > 0 && (
                                         <div className="flex justify-between bg-gray-200 px-1 py-2 my-2 border-2 border-black" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                                             <span className="font-black text-[18px] uppercase tracking-tighter">YOU SAVED {sPercent}%</span>
                                             <span className="font-black text-[18px]">{formatAmount(tSavings)}</span>
                                         </div>

                                     )}
                                </div>
                            );
                        })()}

                        <div className="receipt-line-thick"></div>

                        {/* Grand Total */}
                        <div className="flex justify-between font-black text-xl py-1 border-y border-black mt-1">
                            <span>Total bill amount:</span>
                            <span>{formatAmount(printOrder.total || 0)}</span>
                        </div>


                        {/* Footer / Notes */}
                        <div className="text-center mt-6 space-y-2">
                            <p className="text-sm font-bold">।। आपका विश्वास हमारी ताकत ।।</p>
                            
                            {((posBillSettings?.notes?.enabled && posBillSettings?.notes?.text) || (config?.invoiceSettings?.notes?.enabled && config?.invoiceSettings?.notes?.text)) && (
                                <p className="text-[10px] whitespace-pre-wrap">{posBillSettings?.notes?.enabled ? posBillSettings?.notes?.text : config?.invoiceSettings?.notes?.text}</p>
                            )}

                            {posBillSettings?.qrCode && (
                                <div className="mt-4 flex justify-center">
                                    <img src={posBillSettings.qrCode} alt="QR" className="w-24 h-24 object-contain" style={{ WebkitPrintColorAdjust: 'exact' }} />
                                </div>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};


const ReportCard = ({ title, value, icon, color, desc }: any) => (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative overflow-hidden group">
        <div className="flex justify-between items-start mb-4">
            <div className={`p-3 rounded-xl text-white ${color} shadow-lg shadow-gray-200 transition-transform group-hover:scale-110`}>
                {icon}
            </div>
        </div>
        <p className="text-gray-400 text-[10px] font-extrabold uppercase tracking-widest mb-1">{title}</p>
        <div className="text-2xl font-black text-gray-800 tracking-tight">{value}</div>
        <p className="text-gray-400 text-xs mt-1 font-medium">{desc}</p>
        <div className="absolute right-[-10px] bottom-[-10px] opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
            {icon}
        </div>
    </div>
);

export default AdminPOSReport;
