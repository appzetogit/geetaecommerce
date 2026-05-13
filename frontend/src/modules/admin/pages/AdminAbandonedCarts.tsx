import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search,
    Calendar,
    Filter,
    ChevronRight,
    User,
    Mail,
    Phone,
    MapPin,
    ShoppingBag,
    ArrowLeft,
    Share2,
    MessageCircle,
    PhoneCall,
    X,
    Clock,
    ShoppingCart,
    Loader2
} from 'lucide-react';
import { getAbandonedCarts } from '../../../services/api/admin/adminCustomerService';
import toast from 'react-hot-toast';

export default function AdminAbandonedCarts() {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState('');
    const [minCartValue, setMinCartValue] = useState('');
    const [selectedCart, setSelectedCart] = useState<any>(null);
    const [carts, setCarts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [pagination, setPagination] = useState({
        page: 1,
        total: 0,
        pages: 1
    });

    const fetchCarts = useCallback(async () => {
        try {
            setLoading(true);
            const response = await getAbandonedCarts({
                page: pagination.page,
                limit: 20,
                search: searchTerm || undefined,
                startDate: dateFilter || undefined,
                minPrice: minCartValue ? parseFloat(minCartValue) : undefined
            });

            if (response.success) {
                setCarts(response.data || []);
                if (response.pagination) {
                    setPagination(prev => ({
                        ...prev,
                        total: response.pagination!.total,
                        pages: response.pagination!.pages
                    }));
                }
            }
        } catch (error) {
            console.error("Error fetching abandoned carts:", error);
            toast.error("Failed to fetch abandoned carts");
        } finally {
            setLoading(false);
        }
    }, [pagination.page, searchTerm, dateFilter, minCartValue]);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchCarts();
        }, 500);
        return () => clearTimeout(timer);
    }, [fetchCarts]);

    const filteredCarts = carts;

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="min-h-screen bg-[#F8F9FB] pb-12">
            {/* Header */}
            <div className="flex items-center justify-between bg-white px-4 py-4 border-b border-neutral-200 md:px-8">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-2 hover:bg-neutral-100 rounded-full transition-colors md:hidden">
                        <ArrowLeft className="h-5 w-5 text-neutral-600" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-neutral-900">Abandoned Carts</h1>
                        <p className="text-sm text-neutral-500">Track and recover lost sales</p>
                    </div>
                </div>
                <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-pink-50 rounded-lg">
                    <Clock className="h-4 w-4 text-[var(--primary-color)]" />
                    <span className="text-sm font-medium text-[var(--primary-color)]">{filteredCarts.length} Leads found</span>
                </div>
            </div>

            {/* Filters Section */}
            <div className="p-4 md:px-8 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-400" />
                        <input
                            type="text"
                            placeholder="Search Name or Phone..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] transition-all"
                        />
                    </div>
                    {/* Date Filter */}
                    <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-400" />
                        <input
                            type="date"
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] transition-all"
                        />
                    </div>
                    {/* Cart Value Filter */}
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-neutral-400" />
                        <select
                            value={minCartValue}
                            onChange={(e) => setMinCartValue(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-white border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] transition-all appearance-none"
                        >
                            <option value="">All Cart Values</option>
                            <option value="100">Above ₹100</option>
                            <option value="500">Above ₹500</option>
                            <option value="1000">Above ₹1000</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Table View (Desktop) */}
            <div className="hidden md:block px-8">
                <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm">
                    <table className="w-full text-left">
                        <thead className="bg-[#f8f9fb] border-b border-neutral-200">
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">User</th>
                                <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Contact</th>
                                <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Cart Items</th>
                                <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Total Value</th>
                                <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider">Last Updated</th>
                                <th className="px-6 py-4 text-xs font-bold text-neutral-500 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <Loader2 className="h-10 w-10 text-[var(--primary-color)] animate-spin" />
                                            <p className="text-neutral-500">Loading abandoned carts...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredCarts.length > 0 ? filteredCarts.map((cart) => (
                                <tr key={cart._id} className="hover:bg-neutral-50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 flex-shrink-0 rounded-full bg-pink-100 flex items-center justify-center text-[var(--primary-color)]">
                                                <User className="h-5 w-5" />
                                            </div>
                                            <div className="font-semibold text-neutral-900">{cart.customer?.name || "Guest User"}</div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm text-neutral-700">{cart.customer?.phone}</div>
                                        <div className="text-xs text-neutral-400">{cart.customer?.email}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-1 text-sm font-medium text-neutral-700">
                                            <ShoppingBag className="h-4 w-4 text-neutral-400" />
                                            {cart.items.length} {cart.items.length === 1 ? 'Item' : 'Items'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-bold text-neutral-900">₹{cart.total}</td>
                                    <td className="px-6 py-4 text-sm text-neutral-500">{formatDate(cart.updatedAt)}</td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => setSelectedCart(cart)}
                                            className="px-4 py-2 bg-white border border-neutral-200 text-neutral-700 rounded-lg hover:bg-[var(--primary-color)] hover:text-white hover:border-[var(--primary-color)] transition-all font-medium text-sm inline-flex items-center gap-2"
                                        >
                                            View Details
                                            <ChevronRight className="h-4 w-4" />
                                        </button>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <ShoppingCart className="h-10 w-10 text-neutral-300" />
                                            <p className="text-neutral-500">No abandoned carts found</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* List View (Mobile) */}
            <div className="md:hidden px-4 space-y-4">
                {loading ? (
                    <div className="py-12 text-center bg-white rounded-2xl border border-neutral-200">
                        <Loader2 className="mx-auto h-12 w-12 text-[var(--primary-color)] animate-spin mb-3" />
                        <p className="text-neutral-500 font-medium">Loading abandoned carts...</p>
                    </div>
                ) : filteredCarts.length > 0 ? filteredCarts.map((cart) => (
                    <div key={cart._id} className="bg-white rounded-2xl border border-neutral-200 p-4 shadow-sm">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className="h-12 w-12 rounded-full bg-pink-100 flex items-center justify-center text-[var(--primary-color)]">
                                    <User className="h-6 w-6" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-neutral-900">{cart.customer?.name || "Guest User"}</h3>
                                    <p className="text-sm text-neutral-500">{formatDate(cart.updatedAt)}</p>
                                </div>
                            </div>
                            <div className="bg-pink-50 text-[var(--primary-color)] font-bold px-3 py-1 rounded-lg">
                                ₹{cart.total}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <div className="flex items-center gap-2 text-sm text-neutral-600">
                                <Phone className="h-4 w-4 text-neutral-400" />
                                {cart.customer?.phone}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-neutral-600">
                                <ShoppingBag className="h-4 w-4 text-neutral-400" />
                                {cart.items.length} Items
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => setSelectedCart(cart)}
                                className="w-full py-2.5 bg-[var(--primary-color)] text-white rounded-xl font-semibold text-sm transition-all hover:bg-[var(--primary-dark)] active:scale-[0.98]"
                            >
                                Details
                            </button>
                        </div>
                    </div>
                )) : (
                    <div className="py-12 text-center bg-white rounded-2xl border border-neutral-200">
                        <ShoppingCart className="mx-auto h-12 w-12 text-neutral-300 mb-3" />
                        <p className="text-neutral-500 font-medium">No abandoned carts found</p>
                    </div>
                )}
            </div>

            {/* View Details Modal (Image 2 style) */}
            {selectedCart && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm"
                        onClick={() => setSelectedCart(null)}
                    ></div>
                    <div className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="p-6 pb-2">
                            <div className="flex justify-between items-center mb-6">
                                <button
                                    onClick={() => setSelectedCart(null)}
                                    className="p-2.5 hover:bg-neutral-100 rounded-full transition-colors"
                                >
                                    <ArrowLeft className="h-6 w-6 text-neutral-900" />
                                </button>
                                <h3 className="text-xl font-bold text-neutral-900">Leads</h3>
                                <button
                                    onClick={() => setSelectedCart(null)}
                                    className="p-2.5 hover:bg-neutral-100 rounded-full transition-colors"
                                >
                                    <X className="h-6 w-6 text-neutral-400" />
                                </button>
                            </div>

                            {/* Mobile style buttons from image 2 */}
                            {/* Tabs removed as requested */}
                        </div>

                         {/* Scrollable Content */}
                         <div className="flex-1 overflow-y-auto px-6 pb-8 space-y-8">
                             {/* User Info Section */}
                             <div className="space-y-6">
                                 <div className="text-center bg-neutral-100 inline-block px-4 py-1 rounded-lg text-sm font-medium text-neutral-600 mx-auto">
                                     {new Date(selectedCart.updatedAt).toLocaleDateString()}
                                 </div>

                                 <div className="space-y-4">
                                     <div className="flex items-start gap-4">
                                         <div className="h-12 w-12 rounded bg-black flex items-center justify-center text-white">
                                             <User className="h-6 w-6" />
                                         </div>
                                         <div className="flex-1">
                                             <div className="flex items-center justify-between mb-1">
                                                 <h4 className="text-lg font-bold text-neutral-900">{selectedCart.customer?.phone || "N/A"}</h4>
                                             </div>
                                             <p className="text-sm text-neutral-500 italic mb-4">
                                                 Updated on {new Date(selectedCart.updatedAt).toLocaleDateString('en-IN', { weekday: 'long' })}, {new Date(selectedCart.updatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                             </p>
                                         </div>
                                     </div>
                                 </div>
                             </div>

                             {/* Cart Items Details - (Enhanced) */}
                             <div className="border-t border-neutral-100 pt-6">
                                 <h5 className="text-sm font-bold text-neutral-400 uppercase tracking-wider mb-4">Cart Items</h5>
                                 <div className="space-y-4">
                                     {selectedCart.items.map((item: any) => (
                                         <div key={item._id} className="flex gap-4">
                                             <div className="h-16 w-16 bg-white border border-neutral-200 rounded-xl overflow-hidden flex-shrink-0">
                                                 <img src={item.product?.mainImage} alt={item.product?.productName} className="h-full w-full object-contain p-1" />
                                             </div>
                                             <div className="flex-1">
                                                 <div className="font-bold text-neutral-900">{item.product?.productName}</div>
                                                 <div className="text-sm text-neutral-500">Qty: {item.quantity} × ₹{item.product?.price}</div>
                                             </div>
                                             <div className="font-bold text-neutral-900">₹{item.quantity * (item.product?.price || 0)}</div>
                                         </div>
                                     ))}
                                     <div className="pt-4 mt-4 border-t border-dashed border-neutral-200">
                                         <div className="flex justify-between items-center text-lg">
                                             <span className="font-bold text-neutral-900">Total Cart Value</span>
                                             <span className="font-black text-[var(--primary-color)]">₹{selectedCart.total}</span>
                                         </div>
                                     </div>
                                 </div>
                             </div>

                             {/* User Profile Detail Section */}
                             <div className="space-y-4 bg-[#F8F9FB] p-6 rounded-[2rem] border border-neutral-100">
                                 <h5 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">User Information</h5>
                                 <div className="space-y-3">
                                     <div className="flex items-center gap-3">
                                         <User className="h-4 w-4 text-neutral-400" />
                                         <span className="text-sm font-medium text-neutral-700">{selectedCart.customer?.name || "Guest User"}</span>
                                     </div>
                                     <div className="flex items-center gap-3">
                                         <Mail className="h-4 w-4 text-neutral-400" />
                                         <span className="text-sm font-medium text-neutral-700">{selectedCart.customer?.email || "N/A"}</span>
                                     </div>
                                     <div className="flex items-start gap-3">
                                         <MapPin className="h-4 w-4 text-neutral-400 mt-0.5" />
                                         <span className="text-sm font-medium text-neutral-700 leading-relaxed">{selectedCart.customer?.address || "No address provided"}</span>
                                     </div>
                                 </div>
                             </div>
                         </div>

                        {/* Sticky Bottom Actions */}
                        <div className="p-6 bg-white border-t border-neutral-100">
                            <button
                                onClick={() => setSelectedCart(null)}
                                className="w-full py-4 bg-white border border-neutral-200 rounded-2xl font-bold text-neutral-700 transition-all hover:bg-neutral-50"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
