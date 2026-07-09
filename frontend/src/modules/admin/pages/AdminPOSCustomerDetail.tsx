import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '../../../context/ToastContext';
import {
    getCustomerHistory,
    addCredit,
    acceptPayment,
    initiateCreditPayment,
    verifyCreditPayment,
    CreditTransaction
} from '../../../services/api/admin/creditService';
import { updateCustomer, deleteCustomer } from '../../../services/api/admin/adminCustomerService';
import { jsPDF } from "jspdf";

// Extended type for UI
interface CustomerData {
    _id: string;
    name: string;
    phone: string;
    gst?: string;
    creditBalance: number;
    transactions: CreditTransaction[];
    orders: any[];
    totalCredit: number;
    totalPaid: number;
    address?: string;
    email?: string;
}

const AdminPOSCustomerDetail = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [customerData, setCustomerData] = useState<CustomerData | null>(null);
    const [loading, setLoading] = useState(true);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showCreditModal, setShowCreditModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isActionLoading, setIsActionLoading] = useState(false);

    // Edit state
    const [editData, setEditData] = useState({
        name: '',
        phone: '',
        gst: '',
        address: '',
        email: ''
    });

    // Form States
    const dateNow = new Date().toISOString().split('T')[0];
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(dateNow);
    const [note, setNote] = useState('');
    const [paymentMode, setPaymentMode] = useState('Cash');

    useEffect(() => {
        loadCustomer();
    }, [id]);

    const loadCustomer = async () => {
        if (!id) return;
        setLoading(true);
        try {
            const response = await getCustomerHistory(id);
            const data = response.data; // { customer, transactions, orders }

            // Calculate Totals
            let totalCredit = 0;
            let totalPaid = 0;
            data.transactions.forEach((t: CreditTransaction) => {
                if (t.type === 'Payment') {
                    totalPaid += Math.abs(t.amount);
                } else if (t.type === 'Order' || t.type === 'Manual') {
                     totalCredit += t.amount;
                }
            });

            setCustomerData({
                _id: data.customer._id,
                name: data.customer.name,
                phone: data.customer.phone,
                gst: data.customer.gst,
                address: data.customer.address,
                creditBalance: data.customer.creditBalance,
                transactions: data.transactions,
                orders: data.orders || [],
                totalCredit,
                totalPaid,
                email: data.customer.email
            });

            setEditData({
                name: data.customer.name,
                phone: data.customer.phone,
                gst: data.customer.gst || '',
                address: data.customer.address || '',
                email: data.customer.email || ''
            });
        } catch (error) {
            console.error(error);
            showToast("Failed to load customer details", "error");
            navigate('/admin/pos/customers');
        } finally {
            setLoading(false);
        }
    };

    const handleSavePayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!customerData) return;

        const val = parseFloat(amount);
        if (isNaN(val) || val <= 0) {
            showToast("Enter valid amount", "error");
            return;
        }

        try {
            await acceptPayment({
                customerId: customerData._id,
                amount: val,
                description: `${paymentMode} Payment${note ? ': ' + note : ''}`,
                date
            });
            showToast("Payment recorded", "success");
            setShowPaymentModal(false);
            resetForms();
            loadCustomer();
        } catch (error) {
            showToast("Failed to record payment", "error");
        }
    };

    const handleSaveCredit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!customerData) return;

        const val = parseFloat(amount);
        if (isNaN(val) || val <= 0) {
            showToast("Enter valid amount", "error");
            return;
        }

        try {
            await addCredit({
                customerId: customerData._id,
                amount: val,
                description: note || 'Manual Credit',
                date
            });
            showToast("Credit added", "success");
            setShowCreditModal(false);
            resetForms();
            loadCustomer();
        } catch (error) {
            showToast("Failed to add credit", "error");
        }
    };

    const handleUpdateCustomer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id || !customerData) return;

        setIsActionLoading(true);
        try {
            const res = await updateCustomer(id, editData);
            if (res.success) {
                showToast("Customer updated successfully", "success");
                setShowEditModal(false);
                loadCustomer();
            }
        } catch (error) {
            showToast("Failed to update customer", "error");
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleDeleteCustomer = async () => {
        if (!id) return;
        setIsActionLoading(true);
        try {
            const res = await deleteCustomer(id);
            if (res.success) {
                showToast("Customer deleted successfully", "success");
                navigate('/admin/pos/customers');
            }
        } catch (error) {
            showToast("Failed to delete customer", "error");
        } finally {
            setIsActionLoading(false);
            setShowDeleteModal(false);
        }
    };

    const resetForms = () => {
        setAmount('');
        setDate(new Date().toISOString().split('T')[0]);
        setNote('');
        setPaymentMode('Cash');
    };

    const loadScript = (src: string) => {
        return new Promise((resolve) => {
          const script = document.createElement("script");
          script.src = src;
          script.onload = () => resolve(true);
          script.onerror = () => resolve(false);
          document.body.appendChild(script);
        });
    };

    const handleVerifyPayment = async (orderId: string, paymentId: string, gateway: string, paidAmount: number) => {
          setLoading(true);
          try {
             // For Cashfree, orderId is reference. For Razorpay, paymentId is reference.
             const response = await verifyCreditPayment({
                 customerId: customerData!._id,
                 amount: paidAmount,
                 paymentId: paymentId,
                 gateway: gateway
             });

             if (response.success) {
                 showToast("Payment Verified & Recorded!", "success");
                 setShowPaymentModal(false);
                 resetForms();
                 loadCustomer();
             } else {
                 showToast(response.message || "Payment Verification Failed", "error");
             }
          } catch(e) {
             console.error(e);
             showToast("Error verifying payment", "error");
          } finally {
             setLoading(false);
          }
    };

    const handlePaymentSelection = async (mode: string) => {
        setPaymentMode(mode);
        const val = parseFloat(amount);
        if(!amount || val <= 0) {
             showToast("Please enter a valid amount", "error");
             return;
        }

        if (mode === 'Cash') {
             try {
                await acceptPayment({
                    customerId: customerData!._id,
                    amount: val,
                    description: `${mode} Payment${note ? ': ' + note : ''}`,
                    date
                });
                showToast("Payment recorded", "success");
                setShowPaymentModal(false);
                resetForms();
                loadCustomer();
            } catch (error) {
                showToast("Failed to record payment", "error");
            }
            return;
        }

        // Online Logic
        try {
            // Initiate
            // Note: We don't block UI with full screen loader here to allow modal interaction if needed,
            // but for safety we should probably set a local loading state or global.
            // Using global loading for now.

            const response = await initiateCreditPayment({
                customerId: customerData!._id,
                amount: val,
                gateway: 'PhonePe'
            });

            if (response.success) {
                const { gateway, redirectUrl, merchantTransactionId } = response.data;

                if (gateway === 'PhonePe' && redirectUrl) {
                    sessionStorage.setItem(
                      'admin_pos_credit_payment',
                      JSON.stringify({ customerId: customerData!._id, amount: val, merchantTransactionId })
                    );
                    window.location.href = redirectUrl;
                    return;
                }

                showToast("Unsupported payment gateway", "error");
            } else {
                 showToast(response.message || "Failed to initiate payment", "error");
            }

        } catch (error) {
             console.error("Payment Error", error);
             showToast("Error initiating payment", "error");
        }
    };

    const handleExportPDF = () => {
        if (!customerData) return;
        const doc = new jsPDF();

        // Header
        doc.setFillColor(241, 135, 181); // Pink color
        doc.rect(0, 0, 210, 40, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.text("Customer Statement", 105, 25, { align: "center" });

        // Customer Info
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(12);
        doc.text(`Customer Name: ${customerData.name}`, 20, 50);
        doc.text(`Phone Number: ${customerData.phone}`, 20, 58);
        doc.text(`Generated On: ${new Date().toLocaleDateString()}`, 140, 50);

        // Balance Section
        doc.setFillColor(243, 244, 246);
        doc.roundedRect(20, 65, 170, 25, 3, 3, 'F');
        doc.setFontSize(10);
        doc.text("Current Balance Due", 30, 75);
        doc.text("Total Paid", 90, 75);
        doc.text("Total Credit", 150, 75);

        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(`Rs. ${customerData.creditBalance.toLocaleString()}`, 30, 85);
        doc.setTextColor(241, 135, 181); // Pink instead of Green
        doc.text(`Rs. ${customerData.totalPaid.toLocaleString()}`, 90, 85);
        doc.setTextColor(220, 38, 38); // Red
        doc.text(`Rs. ${customerData.totalCredit.toLocaleString()}`, 150, 85);

        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "normal");

        let y = 105;

        // Transactions Header
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Transaction History", 20, y);
        y += 10;

        // Table Header
        doc.setFillColor(229, 231, 235);
        doc.rect(20, y, 170, 10, 'F');
        doc.setFontSize(10);
        doc.text("Date", 25, y + 7);
        doc.text("Type", 60, y + 7);
        doc.text("Description", 90, y + 7);
        doc.text("Amount", 170, y + 7, { align: 'right' });
        y += 10;

        doc.setFont("helvetica", "normal");

        customerData.transactions.forEach((txn, index) => {
            if (y > 270) {
                doc.addPage();
                y = 20;
            }

            doc.text(new Date(txn.date).toLocaleDateString(), 25, y + 7);
            doc.text(txn.type, 60, y + 7);

            const desc = doc.splitTextToSize(txn.description || '-', 60);
            doc.text(desc, 90, y + 7);

            const amountStr = `Rs. ${Math.abs(txn.amount).toLocaleString()}`;
            if (txn.type === 'Payment') {
                doc.setTextColor(241, 135, 181);
                doc.text(`- ${amountStr}`, 170, y + 7, { align: 'right' });
            } else {
                doc.setTextColor(220, 38, 38);
                doc.text(`+ ${amountStr}`, 170, y + 7, { align: 'right' });
            }
            doc.setTextColor(0, 0, 0);

            // Row line
            doc.setDrawColor(229, 231, 235);
            const rowHeight = Math.max(10, desc.length * 5 + 5);
            doc.line(20, y + rowHeight, 190, y + rowHeight);

            y += rowHeight;
        });

        // Footer
        const pageCount = doc.getNumberOfPages();
        for(let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(156, 163, 175);
            doc.text(`Page ${i} of ${pageCount}`, 105, 290, { align: 'center' });
        }

        doc.save(`${customerData.name.replace(/\s+/g, '_')}_Statement.pdf`);
    };

    if (loading) return <div className="p-10 text-center">Loading...</div>;
    if (!customerData) return <div className="p-10 text-center">Customer not found</div>;

    return (
        <div className="flex flex-col min-h-[calc(100vh-80px)] md:min-h-[calc(100vh-100px)] bg-gray-50/50">
            <div className="flex-1 p-3 sm:p-4 md:p-6 overflow-x-hidden">
                <div className="max-w-7xl mx-auto space-y-6 pb-24">
                    {/* Header with Back Button */}
                    <div className="flex items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                        <button
                            onClick={() => navigate('/admin/pos/customers')}
                            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        </button>
                        <div>
                             <h1 className="text-xl font-bold text-gray-900">{customerData.name}</h1>
                             <div className="flex items-center gap-3">
                                 <p className="text-sm text-gray-500 font-medium tracking-tight font-mono">{customerData.phone}</p>
                                 {customerData.gst && (
                                     <>
                                         <div className="w-1 h-1 bg-gray-300 rounded-full"></div>
                                         <p className="text-xs text-[var(--primary-dark)] font-bold bg-[var(--primary-alpha-10)] px-2 py-0.5 rounded uppercase tracking-wider">GST: {customerData.gst}</p>
                                     </>
                                 )}
                             </div>
                         </div>
                        <div className="ml-auto flex gap-2">
                            <button
                                onClick={() => setShowDeleteModal(true)}
                                className="flex items-center gap-2 bg-red-50 text-red-600 font-bold px-4 py-2 rounded-lg text-xs hover:bg-red-100 transition-colors border border-red-100"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                Delete
                            </button>
                            <button
                                onClick={() => setShowEditModal(true)}
                                className="flex items-center gap-2 bg-gray-50 text-gray-700 font-bold px-4 py-2 rounded-lg text-xs hover:bg-gray-100 transition-colors border border-gray-200"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                Edit
                            </button>
                            <button
                                onClick={handleExportPDF}
                                className="flex items-center gap-2 bg-gray-50 text-gray-700 font-bold px-4 py-2 rounded-lg text-xs hover:bg-gray-100 transition-colors border border-gray-200"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                PDF
                            </button>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Main Balance Card */}
                        <div className="md:col-span-3 bg-gradient-to-br from-[var(--primary-color)] to-[var(--primary-dark)] p-8 rounded-3xl shadow-xl shadow-pink-200/50 text-white relative overflow-hidden group">
                            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all duration-500"></div>
                            <div className="relative z-10 text-center space-y-2">
                                <p className="text-[11px] font-black uppercase tracking-[0.2em] opacity-80">Total Balance Due</p>
                                <h2 className="text-6xl font-black">₹{customerData.creditBalance.toLocaleString()}</h2>
                                <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full backdrop-blur-md text-[11px] font-bold mt-4">
                                    <div className={`w-2 h-2 rounded-full ${customerData.creditBalance > 0 ? 'bg-orange-300 animate-pulse' : 'bg-green-300'}`}></div>
                                    {customerData.creditBalance > 0 ? 'Payment Overdue' : 'No Payment Due'}
                                </div>
                            </div>
                        </div>

                        {/* Credit Stat */}
                        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center gap-4 group hover:shadow-md transition-all">
                            <div className="w-12 h-12 rounded-2xl bg-pink-50 flex items-center justify-center text-[var(--primary-color)] group-hover:scale-110 transition-transform">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                            </div>
                            <div className="text-center">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Credit</p>
                                <p className="text-2xl font-black text-gray-900">₹{customerData.totalCredit.toLocaleString()}</p>
                            </div>
                        </div>

                        {/* Paid Stat */}
                        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center gap-4 group hover:shadow-md transition-all">
                            <div className="w-12 h-12 rounded-2xl bg-pink-50 flex items-center justify-center text-[var(--primary-color)] group-hover:scale-110 transition-transform">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                            </div>
                            <div className="text-center">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Paid</p>
                                <p className="text-2xl font-black text-gray-900">₹{customerData.totalPaid.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>

                    {/* Transaction History Section */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                                <div className="w-1.5 h-6 bg-[var(--primary-color)] rounded-full"></div>
                                Recent Orders
                            </h3>
                            <button
                                onClick={() => navigate(`/admin/pos/customers/${id}/orders`)}
                                className="text-[var(--primary-color)] text-xs font-bold hover:bg-[var(--primary-color)]/10 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                            >
                                View All Past Orders
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                            </button>
                        </div>

                        <div className="space-y-4">
                            {customerData.orders.length === 0 ? (
                                <div className="text-center py-12 bg-white rounded-3xl border border-gray-100 border-dashed">
                                    <p className="text-gray-400 font-medium italic">No recent transactions found</p>
                                </div>
                            ) : (
                                customerData.orders.slice(0, 5).map((order) => (
                                    <div key={order._id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex items-center gap-4">
                                        <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center">
                                            <svg className="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <span className="font-mono text-[10px] text-[var(--primary-dark)] bg-[var(--primary-alpha-10)] px-1.5 py-0.5 rounded font-medium tracking-wide">#{order.orderNumber}</span>
                                            <p className="text-xs text-gray-400 font-medium">{new Date(order.orderDate).toLocaleDateString()}</p>
                                            <div className="inline-flex items-center gap-1.5 mt-2 bg-gray-50 px-2.5 py-1 rounded-lg">
                                                <span className="text-[10px] font-bold text-gray-500">{order.items?.length || 0} items</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-[10px] font-black uppercase mb-1 ${order.paymentMethod === 'Credit' ? 'text-[var(--primary-color)]' : 'text-[var(--primary-color)]'}`}>
                                                {order.paymentMethod}
                                            </p>
                                            <p className="text-xl font-black text-gray-900">₹{order.total}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* History Section */}
                    <div>
                        <div className="flex items-center justify-between mb-4 mt-8">
                            <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                                <div className="w-1.5 h-6 bg-[var(--primary-color)] rounded-full"></div>
                                Transaction History
                            </h3>
                        </div>

                        <div className="space-y-4">
                            {customerData.transactions.length === 0 ? (
                                <div className="text-center py-12 bg-white rounded-3xl border border-gray-100 border-dashed">
                                    <p className="text-gray-400 font-medium italic">No entries yet</p>
                                </div>
                            ) : (
                                customerData.transactions.map((t, idx) => (
                                    <div key={t._id || idx} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${t.type === 'Payment' ? 'bg-[var(--primary-alpha-10)] text-[var(--primary-color)]' : 'bg-pink-50 text-pink-500'}`}>
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    {t.type === 'Payment'
                                                        ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                                        : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                                                    }
                                                </svg>
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-900">{t.type}</p>
                                                <p className="text-[10px] text-gray-400">{new Date(t.date).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-sm font-black ${t.type === 'Payment' ? 'text-[var(--primary-color)]' : 'text-pink-500'}`}>
                                                {t.type === 'Payment' ? '-' : '+'}₹{Math.abs(t.amount).toLocaleString()}
                                            </p>
                                            <p className="text-[10px] text-gray-400 italic truncate max-w-[100px]">{t.description}</p>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Floating Actions */}
            <div className="mt-auto sticky bottom-[-12px] sm:bottom-[-16px] md:bottom-[-24px] -mx-3 sm:-mx-4 md:-mx-6 z-30 transition-all duration-300">
                <div className="w-full p-4 bg-white/95 backdrop-blur-md border-t border-gray-100 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] flex justify-center">
                    <div className="flex gap-3 w-full max-w-md">
                        <button
                            onClick={() => { resetForms(); setShowCreditModal(true); }}
                            className="flex-1 bg-[var(--primary-color)]/10 border border-[var(--primary-color)]/20 text-[var(--primary-color)] font-bold py-3.5 rounded-xl hover:bg-[var(--primary-color)]/20 active:bg-[var(--primary-color)]/30 transition-colors flex items-center justify-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                            Add Credit
                        </button>
                        <button
                            onClick={() => { resetForms(); setShowPaymentModal(true); }}
                            className="flex-1 bg-gradient-to-r from-[var(--primary-color)] to-[var(--primary-dark)] text-white font-bold py-3.5 rounded-xl shadow-lg hover:shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                            Accept Payment
                        </button>
                    </div>
                </div>
            </div>

            {/* Modals and other absolute components */}
            {showPaymentModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden slide-in-from-bottom-5">
                        <div className="bg-gray-900 px-6 py-4 flex justify-between items-center">
                            <h3 className="text-white font-bold text-lg">Select Payment Method</h3>
                            <button onClick={() => setShowPaymentModal(false)} className="text-gray-400 hover:text-white transition-colors">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="p-4 pt-8">
                             {/* Amount Display/Input */}
                             <div className="text-center mb-8">
                                <p className="text-gray-500 text-sm font-medium mb-1">Total Amount</p>
                                <div className="flex items-center justify-center relative">
                                    <span className="text-4xl font-bold text-gray-900 mr-1">₹</span>
                                    <input
                                        type="number" required min="1"
                                        className="w-32 text-center text-4xl font-bold text-gray-900 outline-none bg-transparent placeholder-gray-300 p-0 m-0"
                                        placeholder="0"
                                        value={amount} onChange={e => setAmount(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div className="space-y-3">
                                {['PhonePe', 'Cash'].map((mode) => (
                                    <button
                                        key={mode}
                                        onClick={() => handlePaymentSelection(mode)}
                                        className="w-full bg-white border border-gray-200 rounded-xl px-6 py-4 flex justify-between items-center hover:border-gray-300 hover:shadow-sm active:bg-gray-50 transition-all group"
                                    >
                                        <span className="font-bold text-gray-700 text-base group-hover:text-gray-900">{mode}</span>
                                        <span className="text-gray-300 group-hover:text-gray-400">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Credit Modal */}
            {showCreditModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden slide-in-from-bottom-5">
                         <div className="bg-gradient-to-r from-[var(--primary-color)] to-[var(--primary-dark)] p-6 text-white text-center">
                            <h3 className="text-xl font-bold">Add Credit</h3>
                            <p className="text-white/80 text-sm mt-1">Increase customer balance manualy</p>
                        </div>
                        <form onSubmit={handleSaveCredit} className="p-6 space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Credit Amount</label>
                                <div className="relative">
                                    <span className="absolute left-0 top-1/2 -translate-y-1/2 text-2xl font-bold text-gray-400">₹</span>
                                    <input
                                        type="number" required min="1"
                                        className="w-full pl-8 text-4xl font-bold border-b border-gray-200 focus:border-[var(--primary-color)] outline-none perm-marker-font text-gray-800 placeholder-gray-200 py-2 bg-transparent"
                                        placeholder="0"
                                        value={amount} onChange={e => setAmount(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Reason / Note</label>
                                <textarea
                                    className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-[var(--primary-color)]/10 resize-none"
                                    rows={2} required
                                    value={note} onChange={e => setNote(e.target.value)}
                                    placeholder="Why are you adding this credit?"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Date</label>
                                <input type="date" required className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-medium text-gray-800 outline-none focus:ring-2 focus:ring-[var(--primary-color)]/10" value={date} onChange={e => setDate(e.target.value)} />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowCreditModal(false)} className="flex-1 py-3.5 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" className="flex-[2] bg-gray-900 text-white font-bold py-3.5 rounded-xl hover:bg-black shadow-lg hover:shadow-xl transition-all">
                                    Add Credit
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {showEditModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="bg-[var(--primary-color)] px-6 py-4 text-white flex justify-between items-center">
                             <h3 className="text-lg font-bold">Edit Customer Details</h3>
                             <button onClick={() => setShowEditModal(false)} className="text-white/80 hover:text-white transition-colors">
                                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                             </button>
                         </div>
                        <form onSubmit={handleUpdateCustomer} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 ml-1">Full Name *</label>
                                <input type="text" required className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] transition-all" value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 ml-1">Phone Number *</label>
                                    <input type="tel" required maxLength={10} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] transition-all font-mono" value={editData.phone} onChange={e => setEditData({...editData, phone: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 ml-1">Email (Optional)</label>
                                    <input type="email" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] transition-all" value={editData.email} onChange={e => setEditData({...editData, email: e.target.value})} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 ml-1">Address</label>
                                <textarea rows={2} className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] transition-all resize-none h-20" value={editData.address} onChange={e => setEditData({...editData, address: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 ml-1">GST Number (Optional)</label>
                                <input type="text" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] transition-all uppercase" value={editData.gst} onChange={e => setEditData({...editData, gst: e.target.value.toUpperCase()})} />
                            </div>
                            <button type="submit" disabled={isActionLoading} className="w-full py-4 bg-[var(--primary-color)] text-white rounded-2xl font-bold flex items-center justify-center gap-2 mt-4 shadow-lg shadow-pink-100 hover:scale-[1.02] active:scale-[0.98] transition-all">
                                {isActionLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : (
                                    <>
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                                        Save Changes
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden p-8 text-center">
                        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center text-red-500 mx-auto mb-6">
                            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Customer?</h3>
                        <p className="text-sm text-gray-500 mb-8 px-4">This action cannot be undone. All transaction history for this customer will be permanently removed.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowDeleteModal(false)} className="flex-1 py-3 text-sm font-bold text-gray-500 hover:bg-gray-50 rounded-xl transition-colors">Cancel</button>
                            <button onClick={handleDeleteCustomer} disabled={isActionLoading} className="flex-1 py-3 bg-red-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-red-100 hover:bg-red-700 transition-all">
                                {isActionLoading ? 'Deleting...' : 'Yes, Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPOSCustomerDetail;
