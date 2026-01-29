import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getCategories, Category } from '../../../services/api/categoryService';
import ThemedDropdown from '../components/ThemedDropdown';

export default function SellerCategory() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState('');
    const [rowsPerPage, setRowsPerPage] = useState(10);

    // Fetch categories from API
    useEffect(() => {
        const fetchCategories = async () => {
            setLoading(true);
            setError('');
            try {
                const params: any = {};
                if (searchTerm) {
                    params.search = searchTerm;
                }

                const response = await getCategories(params);
                if (response.success && response.data) {
                    setCategories(response.data);
                } else {
                    setError(response.message || 'Failed to fetch categories');
                }
            } catch (err: any) {
                setError(err.response?.data?.message || err.message || 'Failed to fetch categories');
            } finally {
                setLoading(false);
            }
        };

        fetchCategories();
    }, [searchTerm]);

    // Client-side filtering for display (API handles search, but we can filter further if needed)
    const filteredCategories = categories.filter(cat =>
        cat.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const containerVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: {
            opacity: 1,
            y: 0,
            transition: {
                duration: 0.4,
                staggerChildren: 0.05
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, x: -10 },
        visible: { opacity: 1, x: 0 }
    };

    return (
        <motion.div
            className="flex flex-col h-full space-y-6"
            initial="hidden"
            animate="visible"
            variants={containerVariants}
        >
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 rounded-xl shadow-sm border border-neutral-200">
                <div>
                    <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">Category Management</h1>
                    <p className="text-sm text-neutral-500 mt-1">View and manage product categories</p>
                </div>
                <div className="flex items-center gap-2 text-sm bg-neutral-50 px-3 py-1.5 rounded-lg border border-neutral-200 mt-3 sm:mt-0">
                    <Link to="/seller" className="text-teal-600 hover:text-teal-700 font-medium cursor-pointer hover:underline">Home</Link>
                    <span className="text-neutral-400">/</span>
                    <span className="text-neutral-600">Category</span>
                </div>
            </div>

            {/* Content Card */}
            <div className="bg-white rounded-xl shadow-sm border border-neutral-200 flex-1 flex flex-col overflow-hidden">
                {/* Header Section */}
                <div className="p-5 border-b border-neutral-100 bg-neutral-50/50 flex flex-col md:flex-row justify-between items-center gap-4">
                    <h2 className="text-lg font-semibold text-neutral-800">Category List</h2>

                    {/* Controls */}
                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                        <div className="w-full sm:w-24">
                            <ThemedDropdown
                                options={[10, 20, 50, 100]}
                                value={rowsPerPage}
                                onChange={(val) => setRowsPerPage(Number(val))}
                                placeholder="Rows"
                            />
                        </div>

                        <button
                            onClick={() => {
                                const headers = ['ID', 'Category Name', 'Total Subcategory'];
                                const csvContent = [
                                    headers.join(','),
                                    ...filteredCategories.map(cat => [
                                        cat._id,
                                        `"${cat.name}"`,
                                        cat.totalSubcategory
                                    ].join(','))
                                ].join('\n');
                                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                                const link = document.createElement('a');
                                const url = URL.createObjectURL(blob);
                                link.setAttribute('href', url);
                                link.setAttribute('download', `categories_${new Date().toISOString().split('T')[0]}.csv`);
                                link.style.visibility = 'hidden';
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                            }}
                            className="w-full sm:w-auto bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow active:scale-95"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                            Export CSV
                        </button>

                        <div className="relative w-full sm:w-64">
                            <input
                                type="text"
                                className="w-full pl-10 pr-4 py-2 bg-white border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all placeholder:text-neutral-400"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search categories..."
                            />
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
                                <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M21 21L16.65 16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </div>
                    </div>
                </div>

                {/* Loading and Error States */}
                {loading && (
                    <div className="flex flex-col items-center justify-center p-12">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600 mb-4"></div>
                        <div className="text-neutral-500 font-medium">Loading categories...</div>
                    </div>
                )}
                {error && !loading && (
                    <div className="p-6 text-center">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mb-4">
                            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        </div>
                        <h3 className="text-lg font-medium text-neutral-900">Error</h3>
                        <p className="text-neutral-500 mt-1">{error}</p>
                    </div>
                )}

                {/* Table */}
                {!loading && !error && (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-neutral-50/80 border-b border-neutral-200">
                                    <th className="p-4 px-6 font-bold text-neutral-500 uppercase text-xs tracking-wider w-20">ID</th>
                                    <th className="p-4 px-6 font-bold text-neutral-500 uppercase text-xs tracking-wider">Category Name</th>
                                    <th className="p-4 px-6 font-bold text-neutral-500 uppercase text-xs tracking-wider text-center">Image</th>
                                    <th className="p-4 px-6 font-bold text-neutral-500 uppercase text-xs tracking-wider text-center">Total Subcategory</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100 bg-white">
                                {filteredCategories.map((category, index) => (
                                    <motion.tr
                                        key={category._id}
                                        className="hover:bg-teal-50/30 transition-colors group text-sm text-neutral-700"
                                        variants={itemVariants}
                                        custom={index}
                                    >
                                        <td className="p-4 px-6 align-middle font-mono text-neutral-500">#{category._id}</td>
                                        <td className="p-4 px-6 align-middle font-medium text-neutral-900">{category.name}</td>
                                        <td className="p-4 px-6 align-middle">
                                            <div className="w-16 h-12 bg-white border border-neutral-200 rounded-lg p-1 flex items-center justify-center mx-auto shadow-sm group-hover:scale-110 transition-transform">
                                                <img
                                                    src={category.image || '/assets/category-placeholder.png'}
                                                    alt={category.name}
                                                    className="max-w-full max-h-full object-contain rounded"
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).src = 'https://placehold.co/60x40?text=Img';
                                                    }}
                                                />
                                            </div>
                                        </td>
                                        <td className="p-4 px-6 align-middle text-center">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800">
                                                {category.totalSubcategory || 0}
                                            </span>
                                        </td>
                                    </motion.tr>
                                ))}
                                {filteredCategories.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="p-12 text-center text-neutral-500">
                                            <div className="flex flex-col items-center justify-center">
                                                <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mb-4">
                                                    <svg className="w-8 h-8 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                                                </div>
                                                <h3 className="text-lg font-medium text-neutral-900">No categories found</h3>
                                                <p className="text-neutral-500 mt-1">Try adjusting your search</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

             {/* Footer */}
             <footer className="text-center py-4">
                <p className="text-sm text-neutral-500">
                Copyright © 2025. Developed By{' '}
                <Link to="/seller" className="text-teal-600 hover:text-teal-700 font-medium hover:underline">
                    Geeta Stores
                </Link>
                </p>
            </footer>
        </motion.div>
    );
}
