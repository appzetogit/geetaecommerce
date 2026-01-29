import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getAllSubcategories, SubCategory } from '../../../services/api/categoryService';
import ThemedDropdown from '../components/ThemedDropdown';

export default function SellerSubCategory() {
    const [subcategories, setSubcategories] = useState<SubCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [sortColumn, setSortColumn] = useState<string | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [totalPages, setTotalPages] = useState(1);

    // Fetch subcategories from API
    useEffect(() => {
        const fetchSubcategories = async () => {
            setLoading(true);
            setError('');
            try {
                const params: any = {
                    page: currentPage,
                    limit: rowsPerPage,
                    sortBy: sortColumn || 'subcategoryName',
                    sortOrder: sortDirection,
                };

                const response = await getAllSubcategories(params);
                if (response.success && response.data) {
                    setSubcategories(response.data);
                    // Extract pagination info if available
                    if ((response as any).pagination) {
                        setTotalPages((response as any).pagination.pages);
                    }
                } else {
                    setError(response.message || 'Failed to fetch subcategories');
                }
            } catch (err: any) {
                setError(err.response?.data?.message || err.message || 'Failed to fetch subcategories');
            } finally {
                setLoading(false);
            }
        };

        fetchSubcategories();
    }, [currentPage, rowsPerPage, sortColumn, sortDirection]);

    // Client-side sorting (if API doesn't handle it)
    let sortedSubcategories = [...subcategories];
    if (sortColumn && !sortColumn.includes('.')) {
        sortedSubcategories.sort((a, b) => {
            let aVal: any = a[sortColumn as keyof typeof a];
            let bVal: any = b[sortColumn as keyof typeof b];
            if (typeof aVal === 'string') {
                aVal = aVal.toLowerCase();
                bVal = bVal.toLowerCase();
            }
            if (sortDirection === 'asc') {
                return aVal > bVal ? 1 : -1;
            } else {
                return aVal < bVal ? 1 : -1;
            }
        });
    }

    // Pagination (client-side if API doesn't handle it)
    const displayTotalPages = totalPages > 1 ? totalPages : Math.ceil(sortedSubcategories.length / rowsPerPage);
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const displayedSubcategories = sortedSubcategories.slice(startIndex, endIndex);

    const handleSort = (column: string) => {
        if (sortColumn === column) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    const SortIcon = ({ column }: { column: string }) => (
        <span className={`ml-1 transition-colors ${sortColumn === column ? 'text-teal-600' : 'text-neutral-300 group-hover:text-neutral-400'}`}>
            {sortColumn === column ? (sortDirection === 'asc' ? '↑' : '↓') : '⇅'}
        </span>
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
                    <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">SubCategory Management</h1>
                    <p className="text-sm text-neutral-500 mt-1">View and manage product subcategories</p>
                </div>
                <div className="flex items-center gap-2 text-sm bg-neutral-50 px-3 py-1.5 rounded-lg border border-neutral-200 mt-3 sm:mt-0">
                    <Link to="/seller" className="text-teal-600 hover:text-teal-700 font-medium cursor-pointer hover:underline">Home</Link>
                    <span className="text-neutral-400">/</span>
                    <span className="text-neutral-600">SubCategory</span>
                </div>
            </div>

            {/* Content Card */}
            <div className="bg-white rounded-xl shadow-sm border border-neutral-200 flex-1 flex flex-col overflow-hidden">
                {/* Header Section */}
                <div className="p-5 border-b border-neutral-100 bg-neutral-50/50 flex flex-col md:flex-row justify-between items-center gap-4">
                    <h2 className="text-lg font-semibold text-neutral-800">SubCategory List</h2>

                    {/* Controls */}
                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                        <div className="w-full sm:w-32">
                             <ThemedDropdown
                                options={[
                                    { id: 10, label: '10 entries', value: 10 },
                                    { id: 20, label: '20 entries', value: 20 },
                                    { id: 50, label: '50 entries', value: 50 },
                                    { id: 100, label: '100 entries', value: 100 },
                                ]}
                                value={rowsPerPage}
                                onChange={(val) => {
                                    setRowsPerPage(Number(val));
                                    setCurrentPage(1);
                                }}
                                placeholder="Entries"
                            />
                        </div>
                    </div>
                </div>

                {/* Loading and Error States */}
                {loading && (
                    <div className="flex flex-col items-center justify-center p-12">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600 mb-4"></div>
                        <div className="text-neutral-500 font-medium">Loading subcategories...</div>
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
                                    <th
                                        className="p-4 px-6 font-bold text-neutral-500 uppercase text-xs tracking-wider cursor-pointer hover:bg-neutral-100 transition-colors group"
                                        onClick={() => handleSort('id')}
                                    >
                                        <div className="flex items-center">
                                            ID <SortIcon column="id" />
                                        </div>
                                    </th>
                                    <th
                                        className="p-4 px-6 font-bold text-neutral-500 uppercase text-xs tracking-wider cursor-pointer hover:bg-neutral-100 transition-colors group"
                                        onClick={() => handleSort('categoryName')}
                                    >
                                        <div className="flex items-center">
                                            Category Name <SortIcon column="categoryName" />
                                        </div>
                                    </th>
                                    <th
                                        className="p-4 px-6 font-bold text-neutral-500 uppercase text-xs tracking-wider cursor-pointer hover:bg-neutral-100 transition-colors group"
                                        onClick={() => handleSort('subcategoryName')}
                                    >
                                        <div className="flex items-center">
                                            Subcategory Name <SortIcon column="subcategoryName" />
                                        </div>
                                    </th>
                                    <th
                                        className="p-4 px-6 font-bold text-neutral-500 uppercase text-xs tracking-wider cursor-pointer hover:bg-neutral-100 transition-colors group text-center"
                                        onClick={() => handleSort('subcategoryImage')}
                                    >
                                        <div className="flex items-center justify-center">
                                            Subcategory Image <SortIcon column="subcategoryImage" />
                                        </div>
                                    </th>
                                    <th
                                        className="p-4 px-6 font-bold text-neutral-500 uppercase text-xs tracking-wider cursor-pointer hover:bg-neutral-100 transition-colors group text-center"
                                        onClick={() => handleSort('totalProduct')}
                                    >
                                        <div className="flex items-center justify-center">
                                            Total Product <SortIcon column="totalProduct" />
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100 bg-white">
                                {displayedSubcategories.map((subcategory, index) => (
                                    <motion.tr
                                        key={subcategory._id || subcategory.id}
                                        className="hover:bg-teal-50/30 transition-colors group text-sm text-neutral-700"
                                        variants={itemVariants}
                                        custom={index}
                                    >
                                        <td className="p-4 px-6 align-middle font-mono text-neutral-500">#{subcategory._id || subcategory.id}</td>
                                        <td className="p-4 px-6 align-middle font-medium text-neutral-900">{subcategory.categoryName}</td>
                                        <td className="p-4 px-6 align-middle text-neutral-600">{subcategory.subcategoryName}</td>
                                        <td className="p-4 px-6 align-middle">
                                            <div className="w-16 h-12 bg-white border border-neutral-200 rounded-lg p-1 flex items-center justify-center mx-auto shadow-sm group-hover:scale-110 transition-transform">
                                                <img
                                                    src={subcategory.subcategoryImage || '/assets/category-placeholder.png'}
                                                    alt={subcategory.subcategoryName}
                                                    className="max-w-full max-h-full object-contain rounded"
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).src = 'https://placehold.co/60x40?text=Img';
                                                    }}
                                                />
                                            </div>
                                        </td>
                                        <td className="p-4 px-6 align-middle text-center">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800">
                                                {subcategory.totalProduct || 0}
                                            </span>
                                        </td>
                                    </motion.tr>
                                ))}
                                {displayedSubcategories.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="p-12 text-center text-neutral-500">
                                            <div className="flex flex-col items-center justify-center">
                                                <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mb-4">
                                                    <svg className="w-8 h-8 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                                                </div>
                                                <h3 className="text-lg font-medium text-neutral-900">No subcategories found</h3>
                                                <p className="text-neutral-500 mt-1">Try adjusting the filters</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                 {/* Pagination Footer */}
                 {displayTotalPages > 1 && (
                    <div className="p-4 px-6 border-t border-neutral-200 bg-neutral-50 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="text-sm text-neutral-500">
                            Showing <span className="font-semibold text-neutral-900">{startIndex + 1}</span> to <span className="font-semibold text-neutral-900">{Math.min(endIndex, sortedSubcategories.length)}</span> of <span className="font-semibold text-neutral-900">{sortedSubcategories.length}</span> entries
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className={`p-2 rounded-lg border transition-all ${
                                    currentPage === 1
                                        ? 'border-neutral-200 text-neutral-300 cursor-not-allowed bg-white'
                                        : 'border-neutral-300 text-neutral-600 hover:bg-white hover:border-teal-500 hover:text-teal-600 shadow-sm hover:shadow'
                                }`}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            </button>

                             <div className="hidden sm:flex items-center gap-1">
                                {Array.from({ length: displayTotalPages }, (_, i) => i + 1).map(page => (
                                    <button
                                        key={page}
                                        onClick={() => setCurrentPage(page)}
                                        className={`min-w-[32px] h-8 flex items-center justify-center rounded-md text-sm font-medium transition-all ${
                                            currentPage === page
                                                ? 'bg-teal-600 text-white shadow-md'
                                                : 'text-neutral-600 hover:bg-neutral-200'
                                        }`}
                                    >
                                        {page}
                                    </button>
                                ))}
                             </div>

                            <button
                                onClick={() => setCurrentPage(prev => Math.min(displayTotalPages, prev + 1))}
                                disabled={currentPage === displayTotalPages}
                                className={`p-2 rounded-lg border transition-all ${
                                    currentPage === displayTotalPages
                                        ? 'border-neutral-200 text-neutral-300 cursor-not-allowed bg-white'
                                        : 'border-neutral-300 text-neutral-600 hover:bg-white hover:border-teal-500 hover:text-teal-600 shadow-sm hover:shadow'
                                }`}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            </button>
                        </div>
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
