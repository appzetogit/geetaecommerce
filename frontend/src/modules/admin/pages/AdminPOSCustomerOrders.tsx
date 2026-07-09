import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getOrderById, deletePOSOrder } from "../../../services/api/admin/adminOrderService";
import { getCustomerHistory } from "../../../services/api/admin/creditService";
import jsPDF from "jspdf";
import { useToast } from "../../../context/ToastContext";

const FiLoader = ({ className }: { className?: string }) => (
  <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
  </svg>
);

const AdminPOSCustomerOrders = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [customer, setCustomer] = useState<any>(null);
    const [orders, setOrders] = useState<any[]>([]);
    const [filter, setFilter] = useState("all");
    const [selectedActionOrder, setSelectedActionOrder] = useState<any>(null);

    // Filter State
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [selectedPeriod, setSelectedPeriod] = useState("All Time");
    const [dateRange, setDateRange] = useState<{start: Date | null, end: Date | null}>({ start: null, end: null });

    const [customStart, setCustomStart] = useState("");
    const [customEnd, setCustomEnd] = useState("");

    // Fetch Customer Details and Orders
    const fetchData = async (start?: Date, end?: Date) => {
        setLoading(true);
        try {
            const customerRes = await getCustomerHistory(id!);
             if (customerRes.success || customerRes.data) {
                const data = customerRes.data;
                setCustomer(data.customer);

                let fetchedOrders = data.orders || [];

                if (start && end) {
                    fetchedOrders = fetchedOrders.filter((order: any) => {
                        const orderDate = new Date(order.orderDate || order.createdAt);
                        return orderDate >= start && orderDate <= end;
                    });
                }

                fetchedOrders.sort((a: any, b: any) => new Date(b.orderDate || b.createdAt).getTime() - new Date(a.orderDate || a.createdAt).getTime());

                setOrders(fetchedOrders);
            }
        } catch (error) {
            console.error("Error fetching customer orders:", error);
            showToast("Failed to load orders", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (id) {
            fetchData();
        }
    }, [id]);

    const applyDateFilter = (period: string) => {
        if (period === "Custom Range") {
             setSelectedPeriod("Custom Range");
             return;
        }

        const now = new Date();
        let start = new Date();
        let end = new Date();
        let isAllTime = false;

        switch (period) {
            case "Today":
                start.setHours(0,0,0,0);
                end.setHours(23,59,59,999);
                break;
            case "This Week":
                const day = now.getDay() || 7;
                if (day !== 1) start.setHours(-24 * (day - 1));
                else start.setHours(0,0,0,0);
                end.setHours(23,59,59,999);
                break;
            case "This Month":
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
                break;
            case "Last 30 Days":
                start.setDate(now.getDate() - 30);
                break;
             case "All Time":
                isAllTime = true;
                break;
            default:
                break;
        }

        if (isAllTime) {
            setDateRange({ start: null, end: null });
            fetchData();
        } else {
            setDateRange({ start, end });
            fetchData(start, end);
        }

        setSelectedPeriod(period);
        setShowFilterModal(false);
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

    const handleViewBill = async (order: any) => {
        if (!order) return;
        let fullOrder = order;
        // If items are missing details, fetch full order
        if (!order.items || (order.items.length > 0 && !order.items[0].productName && !order.items[0].name)) {
             try {
                 setLoading(true);
                 const res = await getOrderById(order._id);
                 if (res.success) {
                     fullOrder = res.data;
                 }
            } catch(e) {
                 console.error("Error fetching full order", e);
                 // Fallback to existing order data
            } finally {
                 setLoading(false);
            }
        }
        generateOrderPDF(fullOrder);
        setSelectedActionOrder(null);
    };

    const handleDeleteOrder = async (orderId: string) => {
        if (window.confirm("Are you sure you want to delete this order? This action cannot be undone.")) {
            try {
                setLoading(true);
                const res = await deletePOSOrder(orderId);
                if (res.success) {
                    showToast("Order deleted successfully", "success");
                    setSelectedActionOrder(null);
                    fetchData(dateRange.start || undefined, dateRange.end || undefined);
                } else {
                    showToast(res.message || "Failed to delete order", "error");
                }
            } catch (error) {
                console.error("Error deleting order:", error);
                showToast("Failed to delete order", "error");
            } finally {
                setLoading(false);
            }
        }
    };

    const generateOrderPDF = (order: any) => {
        const doc = new jsPDF();
        const invoiceNum = order.orderNumber || order._id.slice(-6).toUpperCase();
        const dateStr = new Date(order.orderDate || order.createdAt).toLocaleDateString();
        const timeStr = new Date(order.orderDate || order.createdAt).toLocaleTimeString();
        const customerName = order.customerName || customer?.name || "Walk-in Customer";
        const customerPhone = order.customerPhone || customer?.phone || customer?.mobile || "-";

        // --- Header ---
        doc.setFillColor(241, 135, 181); // Pink
        doc.rect(0, 0, 210, 40, 'F');
        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 255, 255);
        doc.text("GEETA", 14, 20);

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        const address = "Q7WM+92M, Q7WM+92M, , Indore Division,\nNagda, Madhya Pradesh, India - 454001\n7898111456";
        doc.text(address, 14, 26);

        // --- Invoice Details ---
        doc.setTextColor(0, 0, 0);
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
        doc.text("Total Item List", 105, 78, { align: 'center' });

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
             const itemName = item.productName || item.product?.productName || item.name || item.title || "Unknown Item";
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

        const pdfBlob = doc.output("blob");
        const pdfUrl = URL.createObjectURL(pdfBlob);
        const opened = window.open(pdfUrl, "_blank", "noopener,noreferrer");

        if (!opened) {
            // Fallback when popups are blocked: still open in same tab preview.
            window.location.href = pdfUrl;
        }

        // Cleanup blob URL after browser has consumed it.
        setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000);
    };

    const filteredOrders = orders.filter((order: any) => {
        if (filter === "all") return true;
        if (filter === "cash") return order.paymentMethod === "Cash";
        if (filter === "online") return order.paymentMethod !== "Cash";
        if (filter === "unpaid") return order.paymentStatus !== "Paid";
        return true;
    });

    if (loading && !customer) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px]">
                <FiLoader className="w-10 h-10 text-[var(--primary-color)] animate-spin mb-4" />
                <p className="text-gray-500 font-medium">Loading Customer Orders...</p>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 space-y-6 bg-gray-50 min-h-screen">
            {/* Header */}
             <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-4">
                     <button
                        onClick={() => navigate(`/admin/pos/customers/${id}`)}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Order History</h1>
                        <p className="text-gray-500 text-sm mt-1">
                            {customer?.name} ({customer?.phone})
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                      onClick={() => setShowFilterModal(true)}
                      className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors flex items-center gap-2 shadow-sm"
                    >
                         <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                         {selectedPeriod}
                    </button>
                    <button
                      onClick={() => fetchData(dateRange.start || undefined, dateRange.end || undefined)}
                      className="px-4 py-2 bg-[var(--primary-color)]/10 text-[var(--primary-color)] rounded-xl font-semibold hover:bg-[var(--primary-color)]/20 transition-colors flex items-center gap-2"
                    >
                        <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
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
                                {["All Time", "Today", "This Week", "This Month", "Last 30 Days"].map((period) => (
                                    <button
                                        key={period}
                                        onClick={() => applyDateFilter(period)}
                                        className={`w-full flex items-center justify-between p-3 rounded-xl border transition-colors ${selectedPeriod === period ? 'border-[var(--primary-color)] bg-[var(--primary-color)]/10 text-[var(--primary-color)]' : 'border-gray-100 hover:bg-gray-50 text-gray-600'}`}
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
                                    className={`w-full flex items-center justify-between p-3 rounded-xl border transition-colors ${selectedPeriod === "Custom Range" ? 'border-[var(--primary-color)] bg-[var(--primary-color)]/10 text-[var(--primary-color)]' : 'border-gray-100 hover:bg-gray-50 text-gray-600'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${selectedPeriod === "Custom Range" ? 'bg-white' : 'bg-gray-100'}`}>
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                        </div>
                                        <span className="font-medium">Custom Range</span>
                                    </div>
                                    {selectedPeriod === "Custom Range" && <div className="w-2 h-2 rounded-full bg-[var(--primary-color)]"></div>}
                                </button>
                            </div>

                            {selectedPeriod === "Custom Range" && (
                                <div className="mt-4 pt-4 border-t border-gray-100 animate-in slide-in-from-top-2">
                                     <h4 className="text-sm font-bold text-[var(--primary-color)] mb-3 bg-[var(--primary-color)]/10 px-3 py-1 rounded-md inline-block">Select Date Range</h4>
                                     <div className="flex gap-3 mb-4">
                                         <div className="flex-1">
                                             <label className="text-xs font-semibold text-gray-500 mb-1 block">Start Date</label>
                                             <input
                                                type="date"
                                                value={customStart}
                                                onChange={(e) => setCustomStart(e.target.value)}
                                                className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:border-[var(--primary-color)] focus:ring-1 focus:ring-[var(--primary-color)] outline-none bg-gray-50 focus:bg-white"
                                             />
                                         </div>
                                         <div className="flex-1">
                                              <label className="text-xs font-semibold text-gray-500 mb-1 block">End Date</label>
                                             <input
                                                type="date"
                                                value={customEnd}
                                                onChange={(e) => setCustomEnd(e.target.value)}
                                                className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:border-[var(--primary-color)] focus:ring-1 focus:ring-[var(--primary-color)] outline-none bg-gray-50 focus:bg-white"
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
                                            className="flex-1 py-2.5 bg-[var(--primary-color)] text-white font-semibold rounded-xl hover:bg-[var(--primary-dark)] transition-colors shadow-sm"
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

            {/* Main Content */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
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
                          className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${filter === opt.id ? 'bg-[var(--primary-color)] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50/50">
                            <tr>
                                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Order No</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Items</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Amount</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Method</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Date</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredOrders.length === 0 ? (
                                <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400 italic">No orders found</td></tr>
                            ) : (
                                filteredOrders.map((order: any) => (
                                    <tr
                                        key={order._id}
                                        className="hover:bg-gray-50/80 transition-colors cursor-pointer"
                                        onClick={() => setSelectedActionOrder(order)}
                                    >
                                        <td className="px-6 py-4 font-bold text-gray-800">#{order.orderNumber}</td>
                                        <td className="px-6 py-4 text-sm text-gray-600">{order.items?.length || 0} items</td>
                                        <td className="px-6 py-4 font-bold text-gray-900">₹{(order.total || 0).toLocaleString()}</td>
                                        <td className="px-6 py-4">
                                            <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${order.paymentMethod === 'Cash' ? 'bg-[var(--primary-color)]/10 text-[var(--primary-color)]' : 'bg-[var(--primary-alpha-20)] text-[var(--primary-darker)]'}`}>
                                                {order.paymentMethod}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${order.paymentStatus === 'Paid' ? 'bg-[var(--primary-color)]/10 text-[var(--primary-color)]' : 'bg-red-100 text-red-700'}`}>
                                                {order.paymentStatus || (order.paymentMethod === 'Cash' ? 'Paid' : 'Pending')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-xs text-gray-500 whitespace-nowrap">
                                            {new Date(order.orderDate || order.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setSelectedActionOrder(order); }}
                                                className="bg-[var(--primary-color)]/10 text-[var(--primary-color)] p-2 rounded-lg hover:bg-[var(--primary-color)]/20 transition-colors"
                                                title="View Actions"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Order Action Modal */}
            {selectedActionOrder && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-sm rounded-t-2xl sm:rounded-2xl overflow-hidden shadow-2xl transform transition-all animate-in slide-in-from-bottom-10 sm:zoom-in-95">
                         <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <div>
                                <h3 className="font-bold text-gray-800 text-lg">Order Actions</h3>
                                <p className="text-xs text-gray-500">Choose an action for Order #{selectedActionOrder.orderNumber}</p>
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
                                        showToast("Status update feature coming soon", "success");
                                        setSelectedActionOrder(null);
                                    }}
                                >
                                    <div className="w-10 h-10 rounded-full bg-[var(--primary-color)]/10 text-[var(--primary-color)] flex items-center justify-center group-hover:scale-110 transition-transform">
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
                                    <div className="w-10 h-10 rounded-full bg-[var(--primary-color)]/10 text-[var(--primary-color)] flex items-center justify-center group-hover:scale-110 transition-transform">
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

                                <button
                                    className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 rounded-xl transition-colors text-left group"
                                     onClick={() => {
                                         handleDeleteOrder(selectedActionOrder._id);
                                    }}
                                >
                                    <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </div>
                                    <div>
                                        <div className="font-semibold text-gray-700">Delete Order</div>
                                        <div className="text-xs text-gray-400">Permanently remove order</div>
                                    </div>
                                    <svg className="w-4 h-4 text-gray-300 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPOSCustomerOrders;
