import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCreditCustomers, CreditCustomer } from '../../../services/api/admin/creditService';
import { useToast } from '../../../context/ToastContext';

const AdminPOSCustomers = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();
    const [customers, setCustomers] = useState<CreditCustomer[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadCustomers();
    }, [searchQuery]);

    // Debounce search could be better, but for now simple effect
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            loadCustomers();
        }, 500);
        return () => clearTimeout(timeoutId);
    }, [searchQuery]);

    const loadCustomers = async () => {
        setLoading(true);
        try {
            const data = await getCreditCustomers(searchQuery);
            // API returns list, allow frontend logic or backend sort
            // The backend already sorts by creditBalance desc
            setCustomers(data.data || []);
        } catch (error) {
            console.error("Failed to load customers", error);
        } finally {
            setLoading(false);
        }
    };

    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.includes(searchQuery)
    );

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900">
            {/* Header Section */}
            <div className="bg-white shadow-sm">
                <div className="p-4 flex items-center gap-3">
                    <button onClick={() => navigate('/admin/pos/orders')} className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <h1 className="text-xl font-bold">Customers</h1>
                </div>

                <div className="px-4 pb-4">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search by name or phone"
                            className="w-full bg-gray-100 border-none rounded-lg px-4 py-3 pl-10 text-base focus:ring-2 focus:ring-blue-500 outline-none"
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
                {loading ? (
                    <div className="text-center py-10">Loading...</div>
                ) : customers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                        <svg className="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <p>No customers found</p>
                    </div>
                ) : (
                    <div className="bg-white md:rounded-xl md:shadow-sm divide-y divide-gray-100">
                        {customers.map(customer => (
                            <div
                                key={customer._id}
                                onClick={() => navigate(`/admin/pos/customers/${customer._id}`)}
                                className="p-4 hover:bg-gray-50 active:bg-gray-100 cursor-pointer flex justify-between items-center transition-colors"
                            >
                                <div>
                                    <h3 className="font-semibold text-base text-gray-900">{customer.name}</h3>
                                    <p className="text-sm text-gray-500 mt-0.5">{customer.phone}</p>
                                </div>
                                <div className="text-right">
                                    {customer.creditBalance > 0 ? (
                                        <div className="text-red-600 font-bold text-base">₹{customer.creditBalance.toLocaleString()} Due</div>
                                    ) : (
                                        <div className="text-green-600 font-medium text-sm">No Dues</div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* FAB to add customer manually if needed? Prompt didn't specify, but good for UX */}
        </div>
    );
};

export default AdminPOSCustomers;
