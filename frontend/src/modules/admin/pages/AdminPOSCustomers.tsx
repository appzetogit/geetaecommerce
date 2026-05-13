import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCreditCustomers, CreditCustomer } from '../../../services/api/admin/creditService';
import { createCustomer } from '../../../services/api/admin/adminCustomerService';
import { useToast } from '../../../context/ToastContext';

const AdminPOSCustomers = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [customers, setCustomers] = useState<CreditCustomer[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [showDueOnly, setShowDueOnly] = useState(false);
    const [showAdvanceOnly, setShowAdvanceOnly] = useState(false);
    const [loading, setLoading] = useState(false);

    // Add Customer Modal State
    const [showAddModal, setShowAddModal] = useState(false);
    const [newCustomerLoading, setNewCustomerLoading] = useState(false);
    const [newCustomer, setNewCustomer] = useState({
        name: '',
        phone: '',
        email: '',
        address: '',
        city: '',
        state: '',
        pincode: '',
        gst: ''
    });

    // Debounce search
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            loadCustomers();
        }, 500);
        return () => clearTimeout(timeoutId);
    }, [searchQuery, showDueOnly, showAdvanceOnly]);

    const loadCustomers = async () => {
        setLoading(true);
        try {
            const data = await getCreditCustomers(searchQuery, showDueOnly, showAdvanceOnly);
            setCustomers(data.data || []);
        } catch (error) {
            console.error("Failed to load customers", error);
        } finally {
            setLoading(false);
        }
    };

    const submitAddCustomer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCustomer.name || !newCustomer.phone) {
            showToast("Name and Phone are required", "error");
            return;
        }

        if (newCustomer.phone.length !== 10) {
            showToast("Phone number must be 10 digits", "error");
            return;
        }

        setNewCustomerLoading(true);
        try {
            const res = await createCustomer({
                ...newCustomer,
                email: newCustomer.email || `${newCustomer.phone}@placeholder.com`
            });

            if (res.success && res.data) {
                showToast("Customer added successfully", "success");
                setShowAddModal(false);
                setNewCustomer({
                    name: '', phone: '', email: '', address: '', city: '', state: '', pincode: '', gst: ''
                });
                loadCustomers(); // Refresh the list
            } else {
                showToast(res.message || "Failed to add customer", "error");
            }
        } catch (err: any) {
            console.error("Error adding customer", err);
            showToast(err.response?.data?.message || "Failed to add customer", "error");
        } finally {
            setNewCustomerLoading(false);
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
                        <h1 className="text-xl font-bold">Customers</h1>
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
                            title={showDueOnly ? "Showing Due Only" : "Show All Customers"}
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
                            title={showAdvanceOnly ? "Showing Advance Only" : "Show All Customers"}
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
                            placeholder="Search by name or phone"
                            className="w-full bg-gray-100 border-none rounded-lg px-4 py-3 pl-10 text-base focus:ring-2 focus:ring-[var(--primary-color)] outline-none transition-all"
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
            <div className="flex-1 p-0 md:p-4 md:max-w-3xl md:mx-auto w-full">
                {loading && customers.length === 0 ? (
                    <div className="text-center py-20 flex flex-col items-center">
                         <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary-color)] mb-2"></div>
                         <p className="text-gray-500 text-sm">Loading customers...</p>
                    </div>
                ) : customers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                        <svg className="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <p>No customers found</p>
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="mt-4 text-[var(--primary-color)] font-semibold hover:underline"
                        >
                            Add Your First Customer
                        </button>
                    </div>
                ) : (
                    <div className="bg-white md:rounded-xl md:shadow-sm divide-y divide-gray-100 overflow-hidden">
                        {customers.map(customer => (
                            <div
                                key={customer._id || Math.random()}
                                onClick={() => navigate(`/admin/pos/customers/${customer._id}`)}
                                className="p-4 hover:bg-gray-50 active:bg-gray-100 cursor-pointer flex justify-between items-center transition-colors group"
                            >
                                <div>
                                    <h3 className="font-semibold text-base text-gray-900 group-hover:text-[var(--primary-color)] transition-colors">{customer.name}</h3>
                                    <p className="text-sm text-gray-500 mt-0.5">{customer.phone}</p>
                                </div>
                                <div className="text-right">
                                    {customer.creditBalance > 0 ? (
                                        <div className="text-red-600 font-bold text-base">₹{customer.creditBalance.toLocaleString()} Due</div>
                                    ) : (
                                        <div className="text-[var(--primary-color)] font-medium text-sm bg-[var(--primary-color)]/10 px-2 py-0.5 rounded-full inline-block">No Dues</div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Add Customer Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden slide-in-from-bottom-5">
                        <div className="bg-[var(--primary-color)] px-6 py-4 text-white flex justify-between items-center">
                            <h3 className="text-lg font-bold">Register New Customer</h3>
                            <button onClick={() => setShowAddModal(false)} className="text-white/80 hover:text-white transition-colors">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <form onSubmit={submitAddCustomer} className="p-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Full Name *</label>
                                    <input
                                        type="text" required
                                        value={newCustomer.name}
                                        onChange={(e) => setNewCustomer({...newCustomer, name: e.target.value})}
                                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] transition-all"
                                        placeholder="Enter customer name"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Phone Number *</label>
                                        <input
                                            type="tel" required
                                            maxLength={10}
                                            pattern="[0-9]{10}"
                                            value={newCustomer.phone}
                                            onChange={(e) => {
                                                const val = e.target.value.replace(/\D/g, "");
                                                if (val.length <= 10) {
                                                    setNewCustomer({...newCustomer, phone: val});
                                                }
                                            }}
                                            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] transition-all font-mono"
                                            placeholder="10 digit mobile"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Email (Optional)</label>
                                        <input
                                            type="email"
                                            value={newCustomer.email}
                                            onChange={(e) => setNewCustomer({...newCustomer, email: e.target.value})}
                                            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] transition-all"
                                            placeholder="customer@email.com"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Address</label>
                                    <textarea
                                        value={newCustomer.address}
                                        onChange={(e) => setNewCustomer({...newCustomer, address: e.target.value})}
                                        className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] transition-all h-20 resize-none"
                                        placeholder="Street address, building, etc."
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">GST Number (Optional)</label>
                                    <input
                                        type="text"
                                        value={newCustomer.gst}
                                        maxLength={15}
                                        onChange={(e) => {
                                            const gstValue = e.target.value
                                              .toUpperCase()
                                              .replace(/[^0-9A-Z]/g, '')
                                              .slice(0, 15);
                                            setNewCustomer({...newCustomer, gst: gstValue});
                                        }}
                                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] transition-all"
                                        placeholder="Enter GSTIN"
                                    />
                                </div>
                            </div>

                            <div className="mt-8 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={newCustomerLoading}
                                    className="flex-[2] py-3 bg-[var(--primary-color)] text-white rounded-xl font-semibold hover:bg-[var(--primary-dark)] transition-all shadow-lg active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2"
                                >
                                    {newCustomerLoading ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    ) : (
                                        <>
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                            Save Customer
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

export default AdminPOSCustomers;
