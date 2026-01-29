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

const AdminPOSCustomerDetail = () => {
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
                        theme: { color: "#3399cc" }
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
                          // Cashfree JS doesn't always return clear success in promise for modal.
                          // Trigger verification check.
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
        doc.setFillColor(13, 148, 136); // Teal color
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
        doc.setTextColor(22, 163, 74); // Green
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
                doc.setTextColor(22, 163, 74);
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
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans mb-10 pb-20">
            {/* Header */}
            <div className="bg-white px-4 py-4 shadow-sm sticky top-0 z-20 flex items-center justify-between border-b border-gray-100">
                 <div className="flex items-center gap-3">
                    <button onClick={() => navigate('/admin/pos/customers')} className="p-2 -ml-2 text-gray-600 hover:bg-gray-50 rounded-full transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                    </button>
                    <div>
                        <h1 className="font-bold text-lg text-gray-900 leading-tight">{customerData.name}</h1>
                        <p className="text-xs text-gray-500 font-medium">{customerData.phone}</p>
                    </div>
                 </div>
                 <div className="flex gap-2">
                 </div>
                 <div className="flex gap-2">
                    <button
                        onClick={handleExportPDF}
                        className="flex items-center gap-1.5 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-sm font-medium transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        PDF
                    </button>
                 </div>
            </div>

            <div className="max-w-xl mx-auto w-full">
                {/* Balance Card */}
                <div className="m-4 mt-6">
                    <div className={`relative overflow-hidden rounded-2xl p-6 shadow-lg ${customerData.creditBalance > 0 ? 'bg-gradient-to-br from-red-500 to-pink-600 text-white' : 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white'}`}>
                        <div className="relative z-10 flex flex-col items-center justify-center text-center">
                            <p className="text-white/80 text-sm font-medium uppercase tracking-wider mb-2">Total Balance Due</p>
                            <h2 className="text-5xl font-bold mb-1 tracking-tight">
                                ₹{customerData.creditBalance.toLocaleString()}
                            </h2>
                            <p className="text-white/90 text-sm mt-2 font-medium bg-white/20 px-3 py-1 rounded-full backdrop-blur-sm">
                                {customerData.creditBalance > 0 ? 'Amount to Collect' : 'No Payment Due'}
                            </p>
                        </div>
                        {/* Decor circles */}
                        <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-white/10 blur-xl"></div>
                        <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-32 h-32 rounded-full bg-black/10 blur-xl"></div>
                    </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4 px-4 mb-8">
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
                        <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-500 mb-2">
                             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                        </div>
                        <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide">Total Credit</p>
                        <p className="text-lg font-bold text-gray-800 mt-0.5">₹{customerData.totalCredit.toLocaleString()}</p>
                    </div>
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
                        <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-500 mb-2">
                             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
                        </div>
                        <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide">Total Paid</p>
                        <p className="text-lg font-bold text-gray-800 mt-0.5">₹{customerData.totalPaid.toLocaleString()}</p>
                    </div>
                </div>

                {/* Recent Orders Section */}
                <div className="px-4 mb-2">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-bold text-gray-800">Recent Orders</h3>
                        {/* <button className="text-xs font-semibold text-blue-600 hover:text-blue-700">View All</button> */}
                    </div>

                    <div className="space-y-3">
                        {customerData.orders.length === 0 ? (
                            <div className="text-gray-400 text-sm text-center py-6 bg-white rounded-xl border border-dashed border-gray-200">No orders placed yet</div>
                        ) : (
                            customerData.orders.slice(0, 3).map(order => (
                                <div key={order._id} className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex gap-4 transition-transform active:scale-[0.99]">
                                     {/* Image(s) */}
                                     <div className="flex gap-1 flex-wrap w-16 h-16 content-start flex-shrink-0">
                                            {/* Placeholder for now as API might not populate images deep enough or we didn't populate */}
                                            <div className="w-16 h-16 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-center text-gray-300">
                                                <svg className="w-6 h-6 opacity-30" fill="currentColor" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                            </div>
                                     </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start mb-1">
                                            <div>
                                                <span className="font-mono text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-medium tracking-wide">#{order.orderNumber}</span>
                                                <p className="text-[11px] text-gray-400 mt-1.5 font-medium">{new Date(order.orderDate).toLocaleDateString()}</p>
                                            </div>
                                            <div className="text-right">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${order.paymentMethod === 'Credit' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                                                    {order.paymentMethod}
                                                </span>
                                                <p className="font-bold text-gray-900 mt-1">₹{order.total}</p>
                                            </div>
                                        </div>
                                        <p className="text-xs text-gray-600 mt-2 line-clamp-1 font-medium bg-gray-50 px-2 py-1 rounded-lg inline-block max-w-full truncate">
                                            {order.items?.length || 0} items
                                        </p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="border-t border-gray-100 my-8 mx-4"></div>

                {/* Ledger Section */}
                <div className="px-4 pb-4">
                     <h3 className="text-base font-bold text-gray-800 mb-4">Transaction History</h3>

                     <div className="relative border-l-2 border-gray-100 ml-3.5 space-y-6 pb-4">
                        {customerData.transactions.length === 0 ? (
                             <div className="ml-8 text-gray-400 text-sm italic">No entries yet</div>
                        ) : (
                            customerData.transactions.map((txn, idx) => (
                                <div key={txn._id || idx} className="relative ml-8">
                                    {/* Timeline Dot */}
                                    <div className={`absolute -left-[41px] top-1 w-5 h-5 rounded-full border-4 border-white shadow-sm ${txn.type === 'Payment' ? 'bg-green-500' : 'bg-red-500'}`}></div>

                                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex flex-col">
                                                <span className={`text-xs font-bold uppercase tracking-wider mb-0.5 ${txn.type === 'Payment' ? 'text-green-600' : 'text-red-600'}`}>
                                                    {txn.type === 'Payment' ? 'Received' : 'Given'} ({txn.type})
                                                </span>
                                                <span className="text-xs text-gray-400 font-medium">{new Date(txn.date).toLocaleDateString()}</span>
                                            </div>
                                            <span className={`text-lg font-bold ${txn.type === 'Payment' ? 'text-green-600' : 'text-red-600'}`}>
                                                {txn.type === 'Payment' ? '-' : '+'} ₹{Math.abs(txn.amount).toLocaleString()}
                                            </span>
                                        </div>
                                        {(txn.description) && (
                                            <div className="bg-gray-50 rounded-lg p-2.5 mt-2 flex justify-between items-end">
                                                <p className="text-xs text-gray-600 italic leading-relaxed max-w-[70%]">
                                                    {txn.description}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                     </div>
                </div>
            </div>

            {/* Bottom Floating Actions */}
            <div className={`fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-gray-200 shadow-[0_-8px_30px_rgba(0,0,0,0.04)] flex gap-3 z-30 transition-transform duration-300`}>
                <button
                    onClick={() => { resetForms(); setShowCreditModal(true); }}
                    className="flex-1 bg-red-50 border border-red-100 text-red-600 font-bold py-3.5 rounded-xl hover:bg-red-100 active:bg-red-200 transition-colors flex items-center justify-center gap-2"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                    Add Credit
                </button>
                <button
                    onClick={() => { resetForms(); setShowPaymentModal(true); }}
                    className="flex-1 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold py-3.5 rounded-xl shadow-lg hover:shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                    Accept Payment
                </button>
            </div>

            {/* --- MODALS --- */}

            {/* Payment Modal */}
            {showPaymentModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden slide-in-from-bottom-5">
                        {/* Header */}
                        <div className="bg-gray-900 px-6 py-4 flex justify-between items-center">
                            <h3 className="text-white font-bold text-lg">Select Payment Method</h3>
                            <button onClick={() => setShowPaymentModal(false)} className="text-gray-400 hover:text-white transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="p-6 pt-8 pb-8">
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

                            {/* Method List */}
                            <div className="space-y-3">
                                {[
                                    { name: 'Razorpay', icon: null },
                                    { name: 'Cashfree', icon: null },
                                    { name: 'Cash', icon: null }
                                ].map((mode) => (
                                    <button
                                        key={mode.name}
                                        onClick={() => handlePaymentSelection(mode.name)}
                                        className="w-full bg-white border border-gray-200 rounded-xl px-6 py-4 flex justify-between items-center hover:border-gray-300 hover:shadow-sm active:bg-gray-50 transition-all group"
                                    >
                                        <span className="font-bold text-gray-700 text-base group-hover:text-gray-900">{mode.name}</span>
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
                    <div className="bg-white w-full max-w-sm rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden slide-in-from-bottom-5">
                         <div className="bg-gradient-to-r from-red-500 to-pink-600 p-6 text-white text-center">
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
                                        className="w-full pl-8 text-4xl font-bold border-b border-gray-200 focus:border-red-500 outline-none perm-marker-font text-gray-800 placeholder-gray-200 py-2 bg-transparent"
                                        placeholder="0"
                                        value={amount} onChange={e => setAmount(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Reason / Note</label>
                                <textarea
                                    className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-red-100 resize-none"
                                    rows={2} required
                                    value={note} onChange={e => setNote(e.target.value)}
                                    placeholder="Why are you adding this credit?"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Date</label>
                                <input type="date" required className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-medium text-gray-800 outline-none focus:ring-2 focus:ring-red-100" value={date} onChange={e => setDate(e.target.value)} />
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
        </div>
    );
};

export default AdminPOSCustomerDetail;
