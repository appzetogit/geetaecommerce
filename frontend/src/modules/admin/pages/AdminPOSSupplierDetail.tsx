import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '../../../context/ToastContext';
import {
    getSupplierDetail,
    addDebt,
    paySupplier,
    editSupplier,
    deleteSupplier,
    Supplier,
    SupplierTransaction
} from '../../../services/api/admin/supplierService';
import { jsPDF } from "jspdf";

const AdminPOSSupplierDetail = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [supplier, setSupplier] = useState<Supplier | null>(null);
    const [transactions, setTransactions] = useState<SupplierTransaction[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal states
    const [showPayModal, setShowPayModal] = useState(false);
    const [showDebtModal, setShowDebtModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);

    // Form States
    const dateNow = new Date().toISOString().split('T')[0];
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(dateNow);
    const [note, setNote] = useState('');
    const [isActionLoading, setIsActionLoading] = useState(false);

    // Edit state
    const [editData, setEditData] = useState({
        name: '',
        phone: '',
        address: '',
        gstNumber: '',
        notes: ''
    });

    useEffect(() => {
        loadSupplier();
    }, [id]);

    const loadSupplier = async () => {
        if (!id) return;
        setLoading(true);
        try {
            const res = await getSupplierDetail(id);
            if (res.success) {
                setSupplier(res.data.supplier);
                setTransactions(res.data.transactions || []);
                setEditData({
                    name: res.data.supplier.name,
                    phone: res.data.supplier.phone,
                    address: res.data.supplier.address || '',
                    gstNumber: res.data.supplier.gstNumber || '',
                    notes: res.data.supplier.notes || ''
                });
            }
        } catch (error) {
            console.error(error);
            showToast("Failed to load supplier details", "error");
            navigate('/admin/pos/suppliers');
        } finally {
            setLoading(false);
        }
    };

    const handleAddDebt = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id || !amount) return;

        setIsActionLoading(true);
        try {
            const res = await addDebt(id, {
                amount: parseFloat(amount),
                description: note || 'Manual Purchase Debt',
                date
            });
            if (res.success) {
                showToast("Debt added successfully", "success");
                setShowDebtModal(false);
                resetForm();
                loadSupplier();
            }
        } catch (error) {
            showToast("Failed to add debt", "error");
        } finally {
            setIsActionLoading(false);
        }
    };

    const handlePaySupplier = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id || !amount) return;

        setIsActionLoading(true);
        try {
            const res = await paySupplier(id, {
                amount: parseFloat(amount),
                description: note || 'Cash Payment to Supplier',
                date
            });
            if (res.success) {
                showToast("Payment recorded successfully", "success");
                setShowPayModal(false);
                resetForm();
                loadSupplier();
            }
        } catch (error) {
            showToast("Failed to record payment", "error");
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleUpdateSupplier = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id) return;

        setIsActionLoading(true);
        try {
            const res = await editSupplier(id, editData);
            if (res.success) {
                showToast("Supplier updated successfully", "success");
                setShowEditModal(false);
                loadSupplier();
            }
        } catch (error) {
            showToast("Failed to update supplier", "error");
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!id || !window.confirm("Are you sure you want to delete this supplier and all transaction history?")) return;

        try {
            const res = await deleteSupplier(id);
            if (res.success) {
                showToast("Supplier deleted", "success");
                navigate('/admin/pos/suppliers');
            }
        } catch (error) {
            showToast("Failed to delete supplier", "error");
        }
    };

    const resetForm = () => {
        setAmount('');
        setDate(dateNow);
        setNote('');
    };

    const handleExportPDF = () => {
        if (!supplier) return;
        const doc = new jsPDF();

        // Header
        doc.setFillColor(241, 135, 181);
        doc.rect(0, 0, 210, 40, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.text("Supplier Statement", 105, 25, { align: "center" });

        // Supplier Info
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        doc.text(`Supplier: ${supplier.name}`, 20, 50);
        doc.text(`Phone: ${supplier.phone}`, 20, 56);
        if (supplier.gstNumber) doc.text(`GST: ${supplier.gstNumber}`, 20, 62);
        doc.text(`Statement Date: ${new Date().toLocaleDateString()}`, 140, 50);

        // Balance Card in PDF
        doc.setFillColor(249, 250, 251);
        doc.roundedRect(20, 70, 170, 20, 2, 2, 'F');
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Current Balance Due:", 30, 83);
        doc.setTextColor(supplier.currentBalance > 0 ? 220 : 34, supplier.currentBalance > 0 ? 38 : 197, supplier.currentBalance > 0 ? 38 : 94);
        doc.text(`Rs. ${Math.abs(supplier.currentBalance).toLocaleString()} ${supplier.currentBalance < 0 ? '(Advance)' : ''}`, 80, 83);

        doc.setTextColor(0, 0, 0);
        let y = 100;

        // Transactions Header
        doc.setFontSize(14);
        doc.text("Recent Transactions", 20, y);
        y += 10;

        // Table Header
        doc.setFillColor(229, 231, 235);
        doc.rect(20, y, 170, 10, 'F');
        doc.setFontSize(9);
        doc.text("Date", 25, y + 7);
        doc.text("Type", 60, y + 7);
        doc.text("Description", 90, y + 7);
        doc.text("Amount", 185, y + 7, { align: 'right' });
        y += 12;

        doc.setFont("helvetica", "normal");
        transactions.forEach((txn) => {
            if (y > 270) {
                doc.addPage();
                y = 20;
            }

            doc.text(new Date(txn.date).toLocaleDateString(), 25, y);
            doc.text(txn.type, 60, y);

            const desc = doc.splitTextToSize(txn.description || '-', 60);
            doc.text(desc, 90, y);

            const amountStr = `Rs. ${Math.abs(txn.amount).toLocaleString()}`;
            if (txn.amount < 0) {
                doc.setTextColor(0, 150, 0);
                doc.text(`- ${amountStr}`, 185, y, { align: 'right' });
            } else {
                doc.setTextColor(220, 0, 0);
                doc.text(`+ ${amountStr}`, 185, y, { align: 'right' });
            }
            doc.setTextColor(0, 0, 0);

            const rowHeight = Math.max(8, desc.length * 4 + 4);
            y += rowHeight;
            doc.setDrawColor(240);
            doc.line(20, y - 2, 190, y - 2);
        });

        doc.save(`${supplier.name.replace(/\s+/g, '_')}_Khata.pdf`);
    };

    if (loading) return <div className="p-10 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#f187b5] mx-auto mb-4"></div>Loading Ledger...</div>;
    if (!supplier) return <div className="p-10 text-center">Supplier not found</div>;

    const totalPurchased = transactions.filter(t => t.type === 'Purchase' || (t.type === 'Manual' && t.amount > 0)).reduce((sum, t) => sum + t.amount, 0);
    const totalPaid = Math.abs(transactions.filter(t => t.type === 'Payment' || (t.type === 'Manual' && t.amount < 0)).reduce((sum, t) => sum + t.amount, 0));

    return (
        <div className="flex flex-col min-h-screen bg-gray-50/50 pb-24 font-sans">
            <div className="p-4 md:p-6 max-w-5xl mx-auto w-full space-y-6">
                {/* Header Card */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate('/admin/pos/suppliers')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        </button>
                        <div>
                            <h1 className="text-2xl font-black text-gray-900 leading-tight">{supplier.name}</h1>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                                <span className="text-sm text-gray-400 font-bold font-mono">{supplier.phone}</span>
                                {supplier.gstNumber && (
                                    <span className="text-[10px] bg-indigo-50 text-indigo-600 font-black px-2 py-0.5 rounded-full uppercase tracking-tighter">GST: {supplier.gstNumber}</span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-2 w-full md:w-auto">
                        <button onClick={() => setShowEditModal(true)} className="flex-1 md:flex-none p-2.5 bg-gray-50 text-gray-600 rounded-xl hover:bg-gray-100 transition-colors border border-gray-100 font-bold text-xs flex items-center justify-center gap-2">
                             <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                             Edit
                        </button>
                        <button onClick={handleExportPDF} className="flex-1 md:flex-none p-2.5 bg-gray-50 text-gray-600 rounded-xl hover:bg-gray-100 transition-colors border border-gray-100 font-bold text-xs flex items-center justify-center gap-2">
                             <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                             PDF
                        </button>
                    </div>
                </div>

                {/* Hero Balance Card */}
                <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-gray-200 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-white/5 rounded-full blur-[100px] group-hover:bg-white/10 transition-all duration-700"></div>

                    <div className="relative z-10 text-center space-y-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50">Total Amount Payable</p>
                        <h2 className={`text-6xl font-black ${supplier.currentBalance < 0 ? 'text-green-400' : 'text-white'}`}>
                            ₹{Math.abs(supplier.currentBalance).toLocaleString()}
                        </h2>
                        {supplier.currentBalance < 0 && (
                            <span className="inline-block bg-green-400/20 text-green-400 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">Advance Paid</span>
                        )}

                        <div className="grid grid-cols-2 gap-4 mt-8 pt-8 border-t border-white/10">
                            <div>
                                <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Total Purchased</p>
                                <p className="text-xl font-bold">₹{totalPurchased.toLocaleString()}</p>
                            </div>
                            <div>
                                <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest">Total Paid</p>
                                <p className="text-xl font-bold text-[#f187b5]">₹{totalPaid.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Transactions Table */}
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
                        <h3 className="font-black text-gray-900">Transaction History</h3>
                        <span className="text-[10px] font-bold text-gray-400 uppercase">{transactions.length} entries</span>
                    </div>

                    <div className="divide-y divide-gray-50">
                        {transactions.length === 0 ? (
                            <div className="p-12 text-center flex flex-col items-center gap-3">
                                <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center text-gray-300">
                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 01-2 2H6a2 2 0 01-2-2m16 0l-8 4-8-4" /></svg>
                                </div>
                                <p className="text-gray-400 font-medium italic text-sm">No transactions yet</p>
                            </div>
                        ) : (
                            transactions.map((t, idx) => (
                                <div key={t._id || idx} className="p-5 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${t.amount < 0 ? 'bg-green-50 text-green-500' : 'bg-red-50 text-red-500'}`}>
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                {t.amount < 0
                                                    ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                                    : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
                                                }
                                            </svg>
                                        </div>
                                        <div>
                                            <p className="text-xs font-black text-gray-900 leading-tight uppercase tracking-tight">{t.type}</p>
                                            <p className="text-[10px] text-gray-400 font-bold mt-0.5">{new Date(t.date).toLocaleDateString()} • {t.description}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-base font-black ${t.amount < 0 ? 'text-green-500' : 'text-red-500'}`}>
                                            {t.amount < 0 ? '-' : '+'}₹{Math.abs(t.amount).toLocaleString()}
                                        </p>
                                        <p className="text-[10px] font-bold text-gray-300">Bal: ₹{t.balanceAfter.toLocaleString()}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="pt-8 opacity-40 hover:opacity-100 transition-opacity flex justify-center">
                    <button onClick={handleDelete} className="text-red-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-red-50 px-4 py-2 rounded-xl">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        Delete Supplier Forever
                    </button>
                </div>
            </div>

            {/* Sticky Action Footer */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-xl border-t border-gray-100 flex justify-center z-40">
                <div className="flex gap-4 w-full max-w-lg">
                    <button
                        onClick={() => { resetForm(); setShowDebtModal(true); }}
                        className="flex-1 py-4 bg-gray-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-gray-200 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                        Add Debt
                    </button>
                    <button
                        onClick={() => { resetForm(); setShowPayModal(true); }}
                        className="flex-1 py-4 bg-[#f187b5] text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-pink-100 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                        Pay Supplier
                    </button>
                </div>
            </div>

            {/* Pay Modal */}
            {(showPayModal || showDebtModal) && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-sm rounded-t-[2.5rem] sm:rounded-3xl shadow-2xl overflow-hidden slide-in-from-bottom-5">
                        <div className={`p-8 text-white text-center ${showPayModal ? 'bg-[#f187b5]' : 'bg-gray-900'}`}>
                            <h3 className="text-2xl font-black">{showPayModal ? 'Pay Supplier' : 'Add Purchase Debt'}</h3>
                            <p className="text-white/60 text-[10px] font-bold uppercase mt-1 tracking-widest">
                                {showPayModal ? 'Decrease balance you owe' : 'Increase balance you owe'}
                            </p>
                        </div>
                        <form onSubmit={showPayModal ? handlePaySupplier : handleAddDebt} className="p-8 space-y-6">
                            <div className="relative">
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Enter Amount</label>
                                <div className="flex items-center border-b-2 border-gray-100 focus-within:border-[#f187b5] transition-colors pb-3">
                                    <span className="text-4xl font-black text-gray-200 mr-2">₹</span>
                                    <input
                                        type="number" required min="1" autoFocus
                                        className="w-full text-5xl font-black outline-none bg-transparent placeholder-gray-100 text-gray-900"
                                        placeholder="0"
                                        value={amount} onChange={e => setAmount(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Description / Bill No.</label>
                                    <input
                                        type="text" required
                                        className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-[#f187b5]/10 outline-none"
                                        placeholder={showPayModal ? "Cash payment / NEFT Ref" : "Bill #123 / Goods received"}
                                        value={note} onChange={e => setNote(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Transaction Date</label>
                                    <input
                                        type="date" required
                                        className="w-full bg-gray-50 border-none rounded-2xl px-5 py-4 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-[#f187b5]/10 outline-none"
                                        value={date} onChange={e => setDate(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => { setShowPayModal(false); setShowDebtModal(false); }} className="flex-1 py-4 text-gray-400 font-black text-[10px] uppercase tracking-widest hover:bg-gray-50 rounded-2xl transition-all">Cancel</button>
                                <button
                                    type="submit"
                                    disabled={isActionLoading}
                                    className={`flex-[2] py-4 rounded-2xl text-white font-black text-[10px] uppercase tracking-[0.2em] shadow-lg transition-all active:scale-[0.98] ${showPayModal ? 'bg-[#f187b5] shadow-pink-100' : 'bg-gray-900 shadow-gray-200'}`}
                                >
                                    {isActionLoading ? 'Processing...' : (showPayModal ? 'Save Payment' : 'Save Debt')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {showEditModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="bg-gray-50 px-8 py-6 flex justify-between items-center border-b border-gray-100">
                            <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight">Edit Supplier</h3>
                            <button onClick={() => setShowEditModal(false)} className="text-gray-400 p-2 hover:bg-gray-100 rounded-full transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
                        </div>
                        <form onSubmit={handleUpdateSupplier} className="p-8 space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Name</label>
                                <input type="text" required className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-bold" value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Phone</label>
                                <input type="tel" required maxLength={10} className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-bold" value={editData.phone} onChange={e => setEditData({...editData, phone: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">GST Number</label>
                                <input type="text" className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-bold uppercase" value={editData.gstNumber} onChange={e => setEditData({...editData, gstNumber: e.target.value.toUpperCase()})} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Address</label>
                                <textarea rows={2} className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm font-bold resize-none" value={editData.address} onChange={e => setEditData({...editData, address: e.target.value})} />
                            </div>
                            <button type="submit" disabled={isActionLoading} className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest mt-4">Save Changes</button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPOSSupplierDetail;
