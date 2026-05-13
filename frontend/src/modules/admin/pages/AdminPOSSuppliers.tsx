import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllSuppliers, createSupplier, Supplier } from '../../../services/api/admin/supplierService';
import { useToast } from '../../../context/ToastContext';

const AdminPOSSuppliers = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [showDueOnly, setShowDueOnly] = useState(false);
    const [showAdvanceOnly, setShowAdvanceOnly] = useState(false);
    const [loading, setLoading] = useState(false);

    // Add Supplier Modal State
    const [showAddModal, setShowAddModal] = useState(false);
    const [newSupplierLoading, setNewSupplierLoading] = useState(false);
    const [newSupplier, setNewSupplier] = useState({
        name: '',
        phone: '',
        address: '',
        gstNumber: '',
        notes: '',
        openingBalance: 0,
        openingBalanceType: 'Receive' as 'Payment' | 'Receive'
    });

    // Debounce search
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            loadSuppliers();
        }, 500);
        return () => clearTimeout(timeoutId);
    }, [searchQuery, showDueOnly, showAdvanceOnly]);

    const loadSuppliers = async () => {
        setLoading(true);
        try {
            const res = await getAllSuppliers(searchQuery, showDueOnly, showAdvanceOnly);
            setSuppliers(res.data || []);
        } catch (error) {
            console.error("Failed to load suppliers", error);
        } finally {
            setLoading(false);
        }
    };

    const submitAddSupplier = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newSupplier.name || !newSupplier.phone) {
            showToast("Name and Phone are required", "error");
            return;
        }

        if (newSupplier.phone.length !== 10) {
            showToast("Phone number must be 10 digits", "error");
            return;
        }

        setNewSupplierLoading(true);
        try {
            const res = await createSupplier(newSupplier);

            if (res.success) {
                showToast("Supplier added successfully", "success");
                setShowAddModal(false);
                setNewSupplier({
                    name: '', phone: '', address: '', gstNumber: '', notes: '', openingBalance: 0, openingBalanceType: 'Receive'
                });
                loadSuppliers(); // Refresh the list
            } else {
                showToast(res.message || "Failed to add supplier", "error");
            }
        } catch (err: any) {
            console.error("Error adding supplier", err);
            showToast(err.response?.data?.message || "Failed to add supplier", "error");
        } finally {
            setNewSupplierLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900 pb-20">
            {/* Header Section */}
            <div className="bg-white shadow-sm">
                <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate('/admin/pos/orders')} className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <h1 className="text-xl font-bold">Supplier Ledger (Khata)</h1>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                setShowDueOnly(!showDueOnly);
                                if (!showDueOnly) setShowAdvanceOnly(false);
                            }}
                            className={`px-2 py-2 sm:px-3 rounded-lg transition-all border flex items-center gap-2 text-sm font-semibold ${
                                showDueOnly 
                                ? "bg-red-50 border-red-200 text-red-600 shadow-sm" 
                                : "bg-gray-100 border-transparent text-gray-600 hover:bg-gray-200"
                            }`}
                            title={showDueOnly ? "Showing Due Only" : "Show All Suppliers"}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="hidden sm:inline">Due Only</span>
                        </button>
                        <button
                            onClick={() => {
                                setShowAdvanceOnly(!showAdvanceOnly);
                                if (!showAdvanceOnly) setShowDueOnly(false);
                            }}
                            className={`px-2 py-2 sm:px-3 rounded-lg transition-all border flex items-center gap-2 text-sm font-semibold ${
                                showAdvanceOnly 
                                ? "bg-[var(--primary-alpha-10)] border-green-200 text-[var(--primary-dark)] shadow-sm" 
                                : "bg-gray-100 border-transparent text-gray-600 hover:bg-gray-200"
                            }`}
                            title={showAdvanceOnly ? "Showing Advance Only" : "Show All Suppliers"}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="hidden sm:inline">Advance Only</span>
                        </button>
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="p-2 bg-[var(--primary-color)] text-white rounded-full shadow-lg hover:bg-[var(--primary-dark)] active:scale-95 transition-all"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div className="px-4 pb-4">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search by name, phone or GST"
                            className="w-full bg-gray-100 border-none rounded-xl px-4 py-3 pl-10 text-base focus:ring-2 focus:ring-[var(--primary-color)]/20 outline-none transition-all"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <svg className="w-5 h-5 text-gray-500 absolute left-3 top-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                </div>
            </div>

            {/* List */}
            <div className="flex-1 p-0 md:p-4 md:max-w-4xl md:mx-auto w-full">
                {loading && suppliers.length === 0 ? (
                    <div className="text-center py-20 flex flex-col items-center">
                         <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary-color)] mb-2"></div>
                         <p className="text-gray-500 text-sm">Loading suppliers...</p>
                    </div>
                ) : suppliers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                        <svg className="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <p>No suppliers found</p>
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="mt-4 text-[var(--primary-color)] font-semibold hover:underline"
                        >
                            Add Your First Supplier
                        </button>
                    </div>
                ) : (
                    <div className="bg-white md:rounded-2xl md:shadow-sm divide-y divide-gray-100 overflow-hidden border border-gray-100">
                        {suppliers.map(supplier => (
                            <div
                                key={supplier._id}
                                onClick={() => navigate(`/admin/pos/suppliers/${supplier._id}`)}
                                className="p-4 hover:bg-gray-50 active:bg-gray-100 cursor-pointer flex justify-between items-center transition-colors group"
                            >
                                <div className="flex-1">
                                    <h3 className="font-bold text-gray-900 group-hover:text-[var(--primary-color)] transition-colors">{supplier.name}</h3>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <p className="text-xs text-gray-500 font-medium">{supplier.phone}</p>
                                        {supplier.gstNumber && (
                                            <>
                                                <div className="w-1 h-1 bg-gray-300 rounded-full"></div>
                                                <p className="text-[10px] text-[var(--primary-dark)] font-bold uppercase">GST: {supplier.gstNumber}</p>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black uppercase text-gray-400 mb-0.5">Amt. Payable</p>
                                    {supplier.currentBalance > 0 ? (
                                        <div className="text-red-500 font-black text-lg">₹{supplier.currentBalance.toLocaleString()}</div>
                                    ) : supplier.currentBalance < 0 ? (
                                        <div className="text-[var(--primary-color)] font-black text-lg">₹{Math.abs(supplier.currentBalance).toLocaleString()} (Adv)</div>
                                    ) : (
                                        <div className="text-gray-300 font-black text-lg">₹0</div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Add Supplier Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden slide-in-from-bottom-5">
                        <div className="bg-[var(--primary-color)] px-6 py-5 text-white flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold">New Supplier</h3>
                                <p className="text-white/70 text-xs">Add a supplier to track credit/debit</p>
                            </div>
                            <button onClick={() => setShowAddModal(false)} className="text-white/80 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <form onSubmit={submitAddSupplier} className="p-6">
                            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Supplier Name *</label>
                                        <input
                                            type="text" required
                                            value={newSupplier.name}
                                            onChange={(e) => setNewSupplier({...newSupplier, name: e.target.value})}
                                            className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[var(--primary-color)]/20 outline-none transition-all"
                                            placeholder="John Doe Enterprises"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Phone Number *</label>
                                        <input
                                            type="tel" required
                                            maxLength={10}
                                            pattern="[0-9]{10}"
                                            value={newSupplier.phone}
                                            onChange={(e) => {
                                                const val = e.target.value.replace(/\D/g, "");
                                                if (val.length <= 10) {
                                                    setNewSupplier({...newSupplier, phone: val});
                                                }
                                            }}
                                            className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[var(--primary-color)]/20 outline-none transition-all font-mono"
                                            placeholder="10 digit mobile"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">GST Number</label>
                                        <input
                                            type="text"
                                            value={newSupplier.gstNumber}
                                            onChange={(e) => setNewSupplier({...newSupplier, gstNumber: e.target.value.toUpperCase()})}
                                            className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[var(--primary-color)]/20 outline-none transition-all"
                                            placeholder="08AAAAA0000A1Z5"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Opening Balance</label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₹</span>
                                            <input
                                                type="number"
                                                value={newSupplier.openingBalance}
                                                onChange={(e) => setNewSupplier({...newSupplier, openingBalance: parseFloat(e.target.value) || 0})}
                                                className="w-full bg-gray-50 border-none rounded-xl px-8 py-3 text-sm focus:ring-2 focus:ring-[var(--primary-color)]/20 outline-none transition-all font-bold"
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <select
                                            className="bg-gray-50 border-none rounded-xl px-3 py-3 text-xs font-bold text-gray-600 focus:ring-2 focus:ring-[var(--primary-color)]/20 outline-none transition-all"
                                            value={newSupplier.openingBalanceType}
                                            onChange={(e) => setNewSupplier({...newSupplier, openingBalanceType: e.target.value as any})}
                                        >
                                            <option value="Receive">I Owe</option>
                                            <option value="Payment">Adv. Paid</option>
                                        </select>
                                    </div>
                                    <p className="text-[10px] text-gray-400 mt-1 ml-1">
                                        {newSupplier.openingBalanceType === 'Receive' ? 'Initial debt you owe to this supplier' : 'Initial advance you have paid to this supplier'}
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Address</label>
                                    <textarea
                                        value={newSupplier.address}
                                        onChange={(e) => setNewSupplier({...newSupplier, address: e.target.value})}
                                        className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[var(--primary-color)]/20 outline-none transition-all h-20 resize-none"
                                        placeholder="Full address of supplier"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Internal Notes</label>
                                    <textarea
                                        value={newSupplier.notes}
                                        onChange={(e) => setNewSupplier({...newSupplier, notes: e.target.value})}
                                        className="w-full bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[var(--primary-color)]/20 outline-none transition-all h-16 resize-none"
                                        placeholder="Note down terms, or any details..."
                                    />
                                </div>
                            </div>

                            <div className="mt-8 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="flex-1 py-3.5 text-gray-500 font-bold hover:bg-gray-50 rounded-2xl transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={newSupplierLoading}
                                    className="flex-[2] py-3.5 bg-[var(--primary-color)] text-white rounded-2xl font-bold hover:bg-[var(--primary-dark)] transition-all shadow-lg shadow-pink-100 active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2"
                                >
                                    {newSupplierLoading ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    ) : (
                                        <>
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                            Create Supplier
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPOSSuppliers;
