import React, { useState, useEffect } from "react";
import { getPOSReport, getStockLedger, deletePOSOrder } from "../../../services/api/admin/adminOrderService";
import { useToast } from "../../../context/ToastContext";

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

    const fetchData = async () => {
        setLoading(true);
        try {
            const [reportRes, ledgerRes] = await Promise.all([
                getPOSReport(),
                getStockLedger({ limit: 20 })
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
        fetchData();
    }, []);

    const handleDeleteOrder = async (orderId: string) => {
        if (window.confirm("Are you sure you want to delete this POS order? This will restore the stock.")) {
            try {
                setLoading(true);
                const response = await deletePOSOrder(orderId);
                if (response.success) {
                    showToast("Order deleted and stock restored", "success");
                    fetchData(); // Refresh data
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

    const filteredOrders = reportData?.orders?.filter((order: any) => {
        if (filter === "all") return true;
        if (filter === "cash") return order.paymentMethod === "Cash";
        if (filter === "online") return order.paymentMethod !== "Cash";
        if (filter === "unpaid") return order.paymentStatus !== "Paid";
        return true;
    }) || [];

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
                <button
                  onClick={fetchData}
                  className="px-4 py-2 bg-orange-50 text-orange-600 rounded-xl font-semibold hover:bg-orange-100 transition-colors flex items-center gap-2"
                >
                    <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                    </svg>
                    Refresh
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                <ReportCard
                    title="Today's Sales"
                    value={`₹${reportData?.summary.totalSales.toLocaleString()}`}
                    icon={<FiTrendingUp className="w-6 h-6" />}
                    color="bg-blue-500"
                    desc="Total POS revenue today"
                />
                <ReportCard
                    title="Cash Sales"
                    value={`₹${reportData?.summary.cashSales.toLocaleString()}`}
                    icon={<FiDollarSign className="w-6 h-6" />}
                    color="bg-green-500"
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
                    color="bg-purple-500"
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
                                        <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400 italic">No orders found for today</td></tr>
                                    ) : (
                                        filteredOrders.map((order: any) => (
                                            <tr key={order._id} className="hover:bg-gray-50/80 transition-colors">
                                                <td className="px-6 py-4 font-bold text-gray-800">#{order.orderNumber}</td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm font-medium text-gray-700">{order.customerName}</div>
                                                    <div className="text-[10px] text-gray-400">{order.customerPhone}</div>
                                                </td>
                                                <td className="px-6 py-4 font-bold text-gray-900">₹{order.total.toLocaleString()}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${order.paymentMethod === 'Cash' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                                        {order.paymentMethod}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${order.paymentStatus === 'Paid' ? 'bg-teal-100 text-teal-700' : 'bg-red-100 text-red-700'}`}>
                                                        {order.paymentStatus}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-xs text-gray-500 whitespace-nowrap">
                                                    {new Date(order.orderDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <button
                                                        onClick={() => handleDeleteOrder(order._id)}
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
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {ledgerData.length === 0 ? (
                                        <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400 italic">No stock movements recorded</td></tr>
                                    ) : (
                                        ledgerData.map((entry: any) => (
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
                                                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${entry.type === 'IN' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                        {entry.type}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 font-bold text-gray-900">{entry.quantity}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2 text-xs">
                                                        <span className="text-gray-400">{entry.previousStock}</span>
                                                        <span className="text-gray-300">→</span>
                                                        <span className="font-bold text-teal-600">{entry.newStock}</span>
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
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
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
