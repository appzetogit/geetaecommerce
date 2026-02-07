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
} from '../../../services/api/seller/creditService';
import { jsPDF } from "jspdf";

// Extended type for UI
interface CustomerData {
    _id: string;
    name: string;
    phone: string;
    creditBalance: number;
    transactions: CreditTransaction[];
    orders: any[]; // Order summary
    totalCredit: number;
    totalPaid: number;
}

const SellerPOSCustomerDetail = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [customerData, setCustomerData] = useState<CustomerData | null>(null);
    const [loading, setLoading] = useState(true);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showCreditModal, setShowCreditModal] = useState(false);

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
                creditBalance: data.customer.creditBalance,
                transactions: data.transactions,
                orders: data.orders || [],
                totalCredit,
                totalPaid
            });
        } catch (error) {
            console.error(error);
            showToast("Failed to load customer details", "error");
            navigate('/seller/pos/customers');
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
            const response = await initiateCreditPayment({
                customerId: customerData!._id,
                amount: val,
                gateway: mode
            });

            if (response.success) {
                const { gateway, orderId, paymentSessionId, amount, key, razorpayOrderId, isSandbox } = response.data;

                if (gateway === 'Razorpay') {
                    const res = await loadScript("https://checkout.razorpay.com/v1/checkout.js");
                    if (!res) {
                         showToast("Razorpay SDK failed to load", "error");
                         return;
                    }

                    const options = {
                        key: key,
                        amount: Math.round(amount * 100),
                        currency: "INR",
                        name: "Geeta Stores",
                        description: "Credit Payment",
                        order_id: razorpayOrderId,
                        handler: async function (response: any) {
                             await handleVerifyPayment(orderId, response.razorpay_payment_id, mode, val);
                        },
                        prefill: {
                             name: customerData!.name,
                             contact: customerData!.phone,
                        },
                        theme: { color: "#f187b5" }
                    };
                    const rzp1 = new (window as any).Razorpay(options);
                    rzp1.open();
                } else if (gateway === 'Cashfree') {
                     const res = await loadScript("https://sdk.cashfree.com/js/v3/cashfree.js");
                     if (!res) {
                        showToast("Cashfree SDK failed to load", "error");
                        return;
                     }
                     const cashfree = new (window as any).Cashfree({
                        mode: isSandbox ? "sandbox" : "production"
                     });
                     cashfree.checkout({
                        paymentSessionId: paymentSessionId,
                        redirectTarget: "_modal",
                     }).then((result: any) => {
                          handleVerifyPayment(orderId, "CF_References_Checked_Backend", mode, val);
                     });
                }
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
        doc.setTextColor(241, 135, 181);
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

            doc.setDrawColor(229, 231, 235);
            const rowHeight = Math.max(10, desc.length * 5 + 5);
            doc.line(20, y + rowHeight, 190, y + rowHeight);

            y += rowHeight;
        });

        const pageCount = doc.getNumberOfPages();
        for(let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(156, 163, 175);
            doc.text(`Page ${i} of ${pageCount}`, 105, 290, { align: 'center' });
        }

        doc.save(`${customerData.name.replace(/\s+/g, '_')}_Statement.pdf`);
    };

    if (loading) return <div className="p-10 text-center text-[#f187b5] font-semibold animate-pulse">Loading Customer Data...</div>;
    if (!customerData) return <div className="p-10 text-center">Customer not found</div>;

    return (
        <div className="flex flex-col min-h-[calc(100vh-80px)] md:min-h-[calc(100vh-100px)]">
            <div className="flex-1 p-3 sm:p-4 md:p-6 overflow-x-hidden">
                <div className="max-w-7xl mx-auto space-y-6 pb-24">
                    {/* Header with Back Button */}
                    <div className="flex items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                        <button
                            onClick={() => navigate('/seller/pos/customers')}
                            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        </button>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">{customerData.name}</h1>
                            <p className="text-sm text-gray-500 font-medium tracking-tight font-mono">{customerData.phone}</p>
                        </div>
                        <button
                            onClick={handleExportPDF}
                            className="ml-auto flex items-center gap-2 bg-gray-50 text-gray-700 font-bold px-4 py-2 rounded-lg text-xs hover:bg-gray-100 transition-colors border border-gray-200"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            PDF
                        </button>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Main Balance Card */}
                        <div className="md:col-span-3 bg-gradient-to-br from-[#f187b5] to-[#e076a5] p-8 rounded-3xl shadow-xl shadow-pink-200/50 text-white relative overflow-hidden group">
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
                            <div className="w-12 h-12 rounded-2xl bg-pink-50 flex items-center justify-center text-[#f187b5] group-hover:scale-110 transition-transform">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                            </div>
                            <div className="text-center">
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Credit</p>
                                <p className="text-2xl font-black text-gray-900">₹{customerData.totalCredit.toLocaleString()}</p>
                            </div>
                        </div>

                        {/* Paid Stat */}
                        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center gap-4 group hover:shadow-md transition-all">
                            <div className="w-12 h-12 rounded-2xl bg-pink-50 flex items-center justify-center text-[#f187b5] group-hover:scale-110 transition-transform">
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
                                <div className="w-1.5 h-6 bg-[#f187b5] rounded-full"></div>
                                Recent Orders
                            </h3>
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
                                            <span className="font-mono text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-medium tracking-wide">#{order.orderNumber}</span>
                                            <p className="text-xs text-gray-400 font-medium">{new Date(order.orderDate).toLocaleDateString()}</p>
                                            <div className="inline-flex items-center gap-1.5 mt-2 bg-gray-50 px-2.5 py-1 rounded-lg">
                                                <span className="text-[10px] font-bold text-gray-500">{order.items?.length || 0} items</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-[10px] font-black uppercase mb-1 ${order.paymentMethod === 'Credit' ? 'text-[#f187b5]' : 'text-green-500'}`}>
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
                                <div className="w-1.5 h-6 bg-[#f187b5] rounded-full"></div>
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
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${t.type === 'Payment' ? 'bg-green-50 text-green-500' : 'bg-pink-50 text-pink-500'}`}>
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
                                            <p className={`text-sm font-black ${t.type === 'Payment' ? 'text-green-500' : 'text-pink-500'}`}>
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
                            className="flex-1 bg-[#f187b5]/10 border border-[#f187b5]/20 text-[#f187b5] font-bold py-3.5 rounded-xl hover:bg-[#f187b5]/20 active:bg-[#f187b5]/30 transition-colors flex items-center justify-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                            Add Credit
                        </button>
                        <button
                            onClick={() => { resetForms(); setShowPaymentModal(true); }}
                            className="flex-1 bg-gradient-to-r from-[#f187b5] to-[#e076a5] text-white font-bold py-3.5 rounded-xl shadow-lg hover:shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2"
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
                    <div className="bg-white w-full max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
                        <div className="bg-gray-900 px-6 py-4 flex justify-between items-center">
                            <h3 className="text-white font-bold text-lg">Select Payment Method</h3>
                            <button onClick={() => setShowPaymentModal(false)} className="text-gray-400 hover:text-white transition-colors">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="p-4 grid grid-cols-2 gap-3">
                            {['Cash', 'UPI', 'Card', 'Cheque'].map((mode) => (
                                <button
                                    key={mode}
                                    onClick={() => { setPaymentMode(mode); setShowPaymentModal(false); resetForms(); }}
                                    className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-100 hover:border-[#f187b5] hover:bg-pink-50 transition-all group"
                                >
                                    <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-white transition-colors">
                                        {/* Icons based on mode */}
                                        {mode === 'Cash' && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                                        {mode === 'UPI' && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>}
                                        {mode === 'Card' && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>}
                                        {mode === 'Cheque' && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                                    </div>
                                    <span className="text-xs font-bold text-gray-700">{mode}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Accept Payment Form Modal */}
            {paymentMode !== 'Cash' && paymentMode !== '' && !showPaymentModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden p-6 animate-in zoom-in duration-200">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-full bg-pink-50 flex items-center justify-center text-[#f187b5]">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </div>
                            <div>
                                <h3 className="font-black text-gray-900">Accept {paymentMode}</h3>
                                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Enter payment details</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Amount to Pay</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₹</span>
                                    <input
                                        type="number"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        className="w-full bg-gray-50 border border-gray-100 rounded-xl pl-8 pr-4 py-3 text-sm font-bold focus:ring-2 focus:ring-[#f187b5] focus:outline-none"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Date</label>
                                    <input
                                        type="date"
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-[#f187b5] focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Reference</label>
                                    <input
                                        type="text"
                                        value={note}
                                        onChange={(e) => setNote(e.target.value)}
                                        className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-[#f187b5] focus:outline-none"
                                        placeholder="Note..."
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 mt-8">
                            <button
                                onClick={() => { setPaymentMode(''); resetForms(); }}
                                className="flex-1 py-3 text-xs font-bold text-gray-500 hover:text-gray-900 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSavePayment}
                                className="flex-[2] bg-gradient-to-r from-[#f187b5] to-[#e076a5] text-white font-black text-xs py-3 rounded-xl shadow-lg hover:shadow-xl transition-all"
                            >
                                Confirm Payment
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Credit Modal */}
            {showCreditModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden p-6 animate-in zoom-in duration-200">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-full bg-pink-50 flex items-center justify-center text-[#f187b5]">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                            </div>
                            <div>
                                <h3 className="font-black text-gray-900">Add Credit Balance</h3>
                                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Increase customer due</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Credit Amount</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₹</span>
                                    <input
                                        type="number"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        className="w-full bg-gray-50 border border-gray-100 rounded-xl pl-8 pr-4 py-3 text-sm font-bold focus:ring-2 focus:ring-[#f187b5] focus:outline-none"
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase mb-1">Notes / Reason</label>
                                <textarea
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-xs font-bold focus:ring-2 focus:ring-[#f187b5] focus:outline-none min-h-[80px]"
                                    placeholder="Enter reason for manual credit..."
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-8">
                            <button
                                onClick={() => { setShowCreditModal(false); resetForms(); }}
                                className="flex-1 py-3 text-xs font-bold text-gray-500 hover:text-gray-900 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveCredit}
                                className="flex-[2] bg-[#1a1a1a] text-white font-black text-xs py-3 rounded-xl shadow-lg hover:bg-black transition-all"
                            >
                                Add Credit
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SellerPOSCustomerDetail;
