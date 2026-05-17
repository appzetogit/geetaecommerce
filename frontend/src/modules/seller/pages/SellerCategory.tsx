import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getCategories, Category } from '../../../services/api/categoryService';
import { getSellerProfile } from '../../../services/api/auth/sellerAuthService';
import {
    getSellerOwnCategories as apiGetSellerOwnCategories,
    createSellerOwnCategory as apiCreateSellerOwnCategory,
    updateSellerOwnCategory as apiUpdateSellerOwnCategory,
    deleteSellerOwnCategory as apiDeleteSellerOwnCategory,
} from '../../../services/api/seller/sellerPurchaseService';
import ThemedDropdown from '../components/ThemedDropdown';
import SellerCategoryForm from './SellerCategoryForm';
import { useToast } from '../../../context/ToastContext';

export default function SellerCategory() {
    const { showToast } = useToast();
    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState('');
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [canCreateCategories, setCanCreateCategories] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [ownCategories, setOwnCategories] = useState<Category[]>([]);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);
    const [subcategoryParent, setSubcategoryParent] = useState<Category | null>(null);
    const [navigationStack, setNavigationStack] = useState<Category[]>([]);

    // Initial Data Loading
    useEffect(() => {
        const loadSellerPermission = async () => {
            try {
                const res = await getSellerProfile();
                if (res?.success && res?.data) {
                    setCanCreateCategories(res.data.canCreateCategories === true);
                } else {
                    setCanCreateCategories(false);
                }
            } catch (err) {
                setCanCreateCategories(false);
            }
        };
        loadSellerPermission();

        // 2. Load Own Categories from DB
        const loadOwnCategories = async () => {
            try {
                const res = await apiGetSellerOwnCategories();
                if (res.success && Array.isArray(res.data)) {
                    setOwnCategories(res.data as any);
                    localStorage.setItem('seller_own_categories', JSON.stringify(res.data));
                    return;
                }
            } catch {
                // fallback to local cache
            }

            const savedCategories = localStorage.getItem('seller_own_categories');
            if (savedCategories) {
                setOwnCategories(JSON.parse(savedCategories));
            }
        };
        void loadOwnCategories();
    }, []);

    // Fetch Admin Categories
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

    const normalizeParentId = (cat: any): string | null => {
        const raw = cat?.parentId;
        if (!raw) return null;
        if (typeof raw === 'string') return raw;
        if (typeof raw === 'object' && raw?._id) return String(raw._id);
        return null;
    };

    const sellerCategoriesById = new Map<string, any>();
    ownCategories.forEach((c: any) => {
        if (c && c._id) sellerCategoriesById.set(String(c._id), c);
    });

    const sellerChildrenByParentId = new Map<string, any[]>();
    ownCategories.forEach((c: any) => {
        const parentId = normalizeParentId(c);
        if (!parentId) return;
        const existing = sellerChildrenByParentId.get(parentId) || [];
        existing.push(c);
        sellerChildrenByParentId.set(parentId, existing);
    });

    const isInSubcategoryView = navigationStack.length > 0;
    const activeParent = isInSubcategoryView ? navigationStack[navigationStack.length - 1] : null;
    const activeParentId = activeParent?._id ? String(activeParent._id) : null;

    const sellerRootCategories = ownCategories.filter((c: any) => !normalizeParentId(c));
    const sellerActiveChildren = activeParentId
        ? (sellerChildrenByParentId.get(activeParentId) || [])
        : [];

    // Merge and Filter Categories
    // We mark admin categories as read-only and seller categories as editable
    const allCategories = isInSubcategoryView
        ? sellerActiveChildren.map((c) => ({ ...c, type: 'seller' }))
        : [
            ...(canCreateCategories ? [] : categories.map((c) => ({ ...c, type: 'admin' }))),
            ...sellerRootCategories.map((c) => ({ ...c, type: 'seller' })),
        ];

    const filteredCategories = allCategories.filter((cat: any) =>
        String(cat?.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Pagination
    const displayedCategories = filteredCategories.slice(0, rowsPerPage); // Simple slicing for demo

    const handleSaveCategory = async (category: Category) => {
        try {
            const isEdit = !!editingCategory?._id;
            const res = isEdit
                ? await apiUpdateSellerOwnCategory(String(editingCategory?._id), category)
                : await apiCreateSellerOwnCategory(category);

            if (res.success && res.data) {
                const saved = res.data as any;
                const updatedCategories = isEdit
                    ? ownCategories.map((c) => (c._id === saved._id ? saved : c))
                    : [saved, ...ownCategories];
                setOwnCategories(updatedCategories);
                localStorage.setItem('seller_own_categories', JSON.stringify(updatedCategories));
                showToast(isEdit ? 'Category updated successfully!' : 'Category created successfully!', 'success');
                setEditingCategory(null);
                setIsAddModalOpen(false);
            } else {
                showToast(res.message || 'Failed to save category', 'error');
            }
        } catch {
            showToast('Failed to save category', 'error');
        }
    };

    const handleEdit = (category: Category) => {
        setEditingCategory(category);
        setSubcategoryParent(null);
        setIsAddModalOpen(true);
    };

    const handleAddSubcategory = (parent: Category) => {
        setEditingCategory(null);
        setSubcategoryParent(parent);
        setIsAddModalOpen(true);
    };

    const handleEnterCategory = (category: any) => {
        if (!category?._id) return;
        setSearchTerm('');
        setNavigationStack((prev) => [...prev, category]);
    };

    const handleBack = () => {
        setSearchTerm('');
        setNavigationStack((prev) => prev.slice(0, -1));
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this category?')) {
            try {
                const res = await apiDeleteSellerOwnCategory(id);
                if (res.success) {
                    const updatedCategories = ownCategories.filter(c => c._id !== id);
                    setOwnCategories(updatedCategories);
                    localStorage.setItem('seller_own_categories', JSON.stringify(updatedCategories));
                    showToast('Category deleted successfully!', 'success');
                } else {
                    showToast(res.message || 'Failed to delete category', 'error');
                }
            } catch {
                showToast('Failed to delete category', 'error');
            }
        }
    };

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
                    <Link to="/seller" className="text-[var(--primary-dark)] hover:text-[var(--primary-darker)] font-medium cursor-pointer hover:underline">Home</Link>
                    <span className="text-neutral-400">/</span>
                    <span className="text-neutral-600">Category</span>
                </div>
            </div>

            {/* Permission Banner */}
            {!canCreateCategories && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded shadow-sm">
                    <div className="flex">
                        <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div className="ml-3">
                            <p className="text-sm text-yellow-700">
                                You can currently only view admin categories. Contact support to request permission to create your own categories.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Content Card */}
            <div className="bg-white rounded-xl shadow-sm border border-neutral-200 flex-1 flex flex-col overflow-hidden">
                {/* Header Section */}
                <div className="p-5 border-b border-neutral-100 bg-neutral-50/50 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-3">
                        {isInSubcategoryView && (
                            <button
                                type="button"
                                onClick={handleBack}
                                className="p-2 rounded-lg hover:bg-neutral-100 transition-colors"
                                aria-label="Back"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M19 12H5"></path>
                                    <path d="M12 19l-7-7 7-7"></path>
                                </svg>
                            </button>
                        )}
                        <div>
                            <h2 className="text-lg font-semibold text-neutral-800">
                                {isInSubcategoryView ? (activeParent?.name || 'Subcategories') : 'Category List'}
                            </h2>
                            {isInSubcategoryView && (
                                <p className="text-xs text-neutral-500 mt-0.5">Subcategories</p>
                            )}
                        </div>
                    </div>

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
                                const headers = ['ID', 'Category Name', 'Total Subcategory', 'Type'];
                                const csvContent = [
                                    headers.join(','),
                                    ...filteredCategories.map(cat => [
                                        cat._id,
                                        `"${cat.name}"`,
                                        cat.totalSubcategory,
                                        (cat as any).type
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
                            className="w-full sm:w-auto bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all shadow-sm"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                            Export
                        </button>

                        {/* Add Category Button */}
                        {canCreateCategories && !isInSubcategoryView && (
                            <button
                                onClick={() => {
                                    setEditingCategory(null);
                                     setSubcategoryParent(null);
                                    setIsAddModalOpen(true);
                                }}
                                 className="w-full sm:w-auto bg-[var(--primary-color)] hover:bg-[var(--primary-dark)] text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow active:scale-95"
                             >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                Add Category
                            </button>
                        )}

                        <div className="relative w-full sm:w-64">
                            <input
                                type="text"
                                className="w-full pl-10 pr-4 py-2 bg-white border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]/20 focus:border-[var(--primary-color)] transition-all placeholder:text-neutral-400"
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
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--primary-dark)] mb-4"></div>
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
                                    <th className="p-4 px-6 font-bold text-neutral-500 uppercase text-xs tracking-wider text-center">Type</th>
                                    <th className="p-4 px-6 font-bold text-neutral-500 uppercase text-xs tracking-wider text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100 bg-white">
                                {displayedCategories.map((category, index) => {
                                    const childCount =
                                        sellerChildrenByParentId.get(String(category._id))?.length || 0;
                                    const canOpenSubcategories =
                                        (category as any).type === 'seller' && childCount > 0;

                                    return (
                                    <motion.tr
                                        key={category._id}
                                        onClick={() => {
                                            if (canOpenSubcategories) handleEnterCategory(category);
                                        }}
                                        className={`hover:bg-[var(--primary-alpha-10)]/30 transition-colors group text-sm text-neutral-700 ${
                                            canOpenSubcategories ? 'cursor-pointer' : ''
                                        }`}
                                        variants={itemVariants}
                                        custom={index}
                                    >
                                        <td className="p-4 px-6 align-middle font-mono text-neutral-500">
                                            {category._id.length > 8 ? '#' + category._id.slice(-6) : '#' + category._id}
                                        </td>
                                        <td className="p-4 px-6 align-middle font-medium text-neutral-900">
                                            <span className={(category as any).type === 'seller' && childCount > 0 ? 'hover:underline decoration-[var(--primary-color)] underline-offset-4' : ''}>
                                                {category.name}
                                            </span>
                                            {(category as any).type === 'seller' && childCount > 0 && !isInSubcategoryView && (
                                                <span className="ml-2 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[11px] font-semibold bg-neutral-100 text-neutral-600">
                                                    {childCount}
                                                </span>
                                            )}
                                        </td>
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
                                            {(category as any).type === 'admin' ? (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--primary-alpha-20)] text-[var(--primary-darker)]">
                                                    Admin
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--primary-alpha-20)] text-[var(--primary-darker)]">
                                                    My Category
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4 px-6 align-middle text-center">
                                            {(category as any).type === 'seller' && (
                                                <div className="flex items-center justify-center gap-2">
                                                    {canCreateCategories && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleAddSubcategory(category);
                                                            }}
                                                            className="p-1.5 text-[var(--primary-color)] hover:bg-[var(--primary-color)]/10 rounded transition-colors"
                                                            title="Add Subcategory"
                                                        >
                                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                                                <line x1="5" y1="12" x2="19" y2="12"></line>
                                                            </svg>
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleEdit(category);
                                                        }}
                                                        className="p-1.5 text-[var(--primary-dark)] hover:bg-[var(--primary-alpha-10)] rounded transition-colors"
                                                        title="Edit"
                                                    >
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDelete(category._id);
                                                        }}
                                                        className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                                        title="Delete"
                                                    >
                                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                                    </button>
                                                </div>
                                            )}
                                            {(category as any).type === 'admin' && (
                                                <span className="text-xs text-neutral-400 italic">Read Only</span>
                                            )}
                                        </td>
                                    </motion.tr>
                                    );
                                })}
                                {filteredCategories.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="p-12 text-center text-neutral-500">
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
                <Link to="/seller" className="text-[var(--primary-dark)] hover:text-[var(--primary-darker)] font-medium hover:underline">
                    Geeta Stores
                </Link>
                </p>
            </footer>

            {/* Category Form Modal */}
             <SellerCategoryForm
                 isOpen={isAddModalOpen}
                 onClose={() => setIsAddModalOpen(false)}
                 onSave={handleSaveCategory}
                 editingCategory={editingCategory}
                 parentCategory={subcategoryParent}
                 mode={subcategoryParent ? "create-subcategory" : editingCategory ? "edit" : "create"}
                 ownCategories={ownCategories}
             />
         </motion.div>
     );
}
