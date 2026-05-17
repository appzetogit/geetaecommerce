import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getAllSubcategories, SubCategory, Category } from '../../../services/api/categoryService';
import ThemedDropdown from '../components/ThemedDropdown';
import { uploadImage } from "../../../services/api/uploadService";
import { validateImageFile, createImagePreview } from "../../../utils/imageUpload";
import { getSellerProfile } from '../../../services/api/auth/sellerAuthService';
import {
    getSellerOwnCategories as apiGetSellerOwnCategories,
    getSellerOwnSubcategories as apiGetSellerOwnSubcategories,
    createSellerOwnSubcategory as apiCreateSellerOwnSubcategory,
} from '../../../services/api/seller/sellerPurchaseService';

export default function SellerSubCategory() {
    const [subcategories, setSubcategories] = useState<SubCategory[]>([]);
    const [ownSubcategories, setOwnSubcategories] = useState<SubCategory[]>([]);
    const [ownCategories, setOwnCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>('');
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [sortColumn, setSortColumn] = useState<string | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [totalPages, setTotalPages] = useState(1);
    const [canCreateSubcategories, setCanCreateSubcategories] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        parentId: '',
        name: '',
        image: '',
        order: 0,
        status: 'Active' as 'Active' | 'Inactive',
    });
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string>('');
    const [uploading, setUploading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const [isDragging, setIsDragging] = useState(false);

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

    useEffect(() => {
        const loadSellerData = async () => {
            try {
                const [sellerRes, catRes, subRes] = await Promise.all([
                    getSellerProfile(),
                    apiGetSellerOwnCategories(),
                    apiGetSellerOwnSubcategories(),
                ]);

                if (sellerRes?.success && sellerRes?.data) {
                    setCanCreateSubcategories(sellerRes.data.canCreateCategories === true);
                } else {
                    setCanCreateSubcategories(false);
                }

                if (catRes.success && Array.isArray(catRes.data)) {
                    setOwnCategories(catRes.data as any);
                    localStorage.setItem('seller_own_categories', JSON.stringify(catRes.data));
                }

                if (subRes.success && Array.isArray(subRes.data)) {
                    setOwnSubcategories(subRes.data as any);
                    localStorage.setItem('seller_own_subcategories', JSON.stringify(subRes.data));
                }
                return;
            } catch {
                // fallback to local cache
            }

            setCanCreateSubcategories(false);
            const savedCategories = localStorage.getItem('seller_own_categories');
            if (savedCategories) {
                setOwnCategories(JSON.parse(savedCategories));
            }

            const savedSubcategories = localStorage.getItem('seller_own_subcategories');
            if (savedSubcategories) {
                setOwnSubcategories(JSON.parse(savedSubcategories));
            }
        };
        void loadSellerData();
    }, []);

    useEffect(() => {
        if (!isAddModalOpen) {
            setFormData({
                parentId: '',
                name: '',
                image: '',
                order: 0,
                status: 'Active',
            });
            setImageFile(null);
            setImagePreview('');
            setFormErrors({});
            setIsDragging(false);
        }
    }, [isAddModalOpen]);

    const sellerSubcategoriesFromOwnCategories = useMemo(() => {
        // Seller-created subcategories via SellerCategory page are stored as "own categories" with a parentId.
        // Convert them to SubCategory-like rows so they show in this listing.
        const byId = new Map<string, any>();
        (ownCategories || []).forEach((c: any) => {
            if (c && c._id) byId.set(String(c._id), c);
        });

        const rows = (ownCategories || [])
            .filter((c: any) => {
                const parentId = c?.parentId;
                return !!parentId;
            })
            .map((child: any) => {
                const rawParent = child?.parentId;
                const parentId =
                    typeof rawParent === 'string'
                        ? rawParent
                        : rawParent && typeof rawParent === 'object'
                        ? rawParent._id
                        : '';
                const parent = parentId ? byId.get(String(parentId)) : null;

                return {
                    _id: child?._id,
                    categoryName: parent?.name || child?.categoryName || 'Category',
                    subcategoryName: child?.name || child?.subcategoryName || 'Subcategory',
                    subcategoryImage: child?.image || child?.subcategoryImage || '',
                    totalProduct: 0,
                    parentId: parentId || '',
                } as any;
            })
            .filter((r: any) => r && r._id);

        return rows;
    }, [ownCategories]);

    const mergedSubcategories = useMemo(() => {
        const all = [
            ...(canCreateSubcategories ? [] : subcategories),
            ...ownSubcategories,
            ...sellerSubcategoriesFromOwnCategories,
        ];
        const map = new Map<string, any>();
        for (const row of all) {
            const id = row?._id ? String(row._id) : '';
            if (!id) continue;
            if (!map.has(id)) map.set(id, row);
        }
        return Array.from(map.values());
    }, [canCreateSubcategories, subcategories, ownSubcategories, sellerSubcategoriesFromOwnCategories]);

    // Client-side sorting (if API doesn't handle it)
    const sortedSubcategories = [...mergedSubcategories];
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

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        await processFile(file);
    };

    const processFile = async (file: File) => {
        const validation = validateImageFile(file);
        if (!validation.valid) {
            setFormErrors((prev) => ({
                ...prev,
                image: validation.error || "Invalid image file",
            }));
            return;
        }

        setImageFile(file);
        setFormErrors((prev) => {
            const next = { ...prev };
            delete next.image;
            return next;
        });

        try {
            const preview = await createImagePreview(file);
            setImagePreview(preview);
        } catch {
            setFormErrors((prev) => ({
                ...prev,
                image: "Failed to create image preview",
            }));
        }
    };

    const handleSaveSubcategory = async () => {
        const errors: Record<string, string> = {};
        if (!formData.parentId) errors.parentId = "Parent category is required";
        if (!formData.name.trim()) errors.name = "Subcategory name is required";
        setFormErrors(errors);
        if (Object.keys(errors).length > 0) return;

        try {
            setSubmitting(true);
            let imageUrl = formData.image;

            if (imageFile) {
                setUploading(true);
                const imageResult = await uploadImage(imageFile, "Geeta Stores/subcategories");
                imageUrl = imageResult.secureUrl;
                setUploading(false);
            }

            const res = await apiCreateSellerOwnSubcategory({
                parentId: formData.parentId,
                subcategoryName: formData.name.trim(),
                subcategoryImage: imageUrl,
                order: formData.order,
                status: formData.status,
            });

            if (res.success && res.data) {
                const newSubcategory = res.data as SubCategory;
                const updated = [newSubcategory, ...ownSubcategories];
                setOwnSubcategories(updated);
                localStorage.setItem('seller_own_subcategories', JSON.stringify(updated));
                setIsAddModalOpen(false);
            } else {
                setFormErrors({ submit: res.message || "Failed to save subcategory" });
            }
        } catch (err: any) {
            setFormErrors({ submit: err?.message || "Failed to save subcategory" });
        } finally {
            setSubmitting(false);
            setUploading(false);
        }
    };

    const SortIcon = ({ column }: { column: string }) => (
        <span className={`ml-1 transition-colors ${sortColumn === column ? 'text-[var(--primary-dark)]' : 'text-neutral-300 group-hover:text-neutral-400'}`}>
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
                    <Link to="/seller" className="text-[var(--primary-dark)] hover:text-[var(--primary-darker)] font-medium cursor-pointer hover:underline">Home</Link>
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
                        {canCreateSubcategories && ownCategories.length > 0 && (
                            <button
                                onClick={() => setIsAddModalOpen(true)}
                                className="w-full sm:w-auto bg-[var(--primary-color)] hover:bg-[var(--primary-dark)] text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow active:scale-95"
                            >
                                + Add Subcategory
                            </button>
                        )}
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
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--primary-dark)] mb-4"></div>
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
                                        className="hover:bg-[var(--primary-alpha-10)]/30 transition-colors group text-sm text-neutral-700"
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
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--primary-alpha-20)] text-seller-800">
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
                                        : 'border-neutral-300 text-neutral-600 hover:bg-white hover:border-[var(--primary-color)] hover:text-[var(--primary-dark)] shadow-sm hover:shadow'
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
                                                ? 'bg-[var(--primary-dark)] text-white shadow-md'
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
                                        : 'border-neutral-300 text-neutral-600 hover:bg-white hover:border-[var(--primary-color)] hover:text-[var(--primary-dark)] shadow-sm hover:shadow'
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
                <Link to="/seller" className="text-[var(--primary-dark)] hover:text-[var(--primary-darker)] font-medium hover:underline">
                    Geeta Stores
                </Link>
                </p>
            </footer>
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setIsAddModalOpen(false)}></div>
                    <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
                            <h2 className="text-lg font-semibold text-neutral-900">Create Subcategory</h2>
                            <button
                                onClick={() => setIsAddModalOpen(false)}
                                className="text-neutral-400 hover:text-neutral-600 transition-colors"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M18 6L6 18M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="px-6 py-4">
                            {formErrors.submit && (
                                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                                    {formErrors.submit}
                                </div>
                            )}

                            <div className="mb-4">
                                <label className="block text-sm font-medium text-neutral-700 mb-2">
                                    Parent Category <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={formData.parentId}
                                    onChange={(e) => setFormData(prev => ({ ...prev, parentId: e.target.value }))}
                                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] ${formErrors.parentId ? "border-red-300" : "border-neutral-300"}`}
                                >
                                    <option value="">Select parent category</option>
                                    {ownCategories.map((cat) => (
                                        <option key={cat._id} value={cat._id}>
                                            {cat.name}
                                        </option>
                                    ))}
                                </select>
                                {formErrors.parentId && (
                                    <p className="mt-1 text-xs text-red-600">{formErrors.parentId}</p>
                                )}
                            </div>

                            <div className="mb-4">
                                <label className="block text-sm font-medium text-neutral-700 mb-2">
                                    Subcategory Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] ${formErrors.name ? "border-red-300" : "border-neutral-300"}`}
                                    placeholder="Enter subcategory name"
                                />
                                {formErrors.name && (
                                    <p className="mt-1 text-xs text-red-600">{formErrors.name}</p>
                                )}
                            </div>

                            <div className="mb-4">
                                <label className="block text-sm font-medium text-neutral-700 mb-2">
                                    Subcategory Image
                                </label>
                                <label
                                    className={`block border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                                        isDragging ? "border-[var(--primary-color)] bg-[var(--primary-color)]/10" : "border-neutral-300 hover:border-[var(--primary-color)]"
                                    }`}
                                    onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
                                    onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                    onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
                                    onDrop={async (e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setIsDragging(false);
                                        const file = e.dataTransfer.files?.[0];
                                        if (file) await processFile(file);
                                    }}
                                >
                                    {imagePreview ? (
                                        <div className="space-y-2">
                                            <img src={imagePreview} alt="Preview" className="max-h-32 mx-auto rounded-lg object-cover" />
                                            <p className="text-xs text-neutral-600">{imageFile?.name || "Selected image"}</p>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    setImagePreview('');
                                                    setImageFile(null);
                                                    setFormData(prev => ({ ...prev, image: '' }));
                                                }}
                                                className="text-xs text-red-600 hover:underline"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="py-4">
                                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mx-auto mb-2 text-neutral-400">
                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                <polyline points="17 8 12 3 7 8" />
                                                <line x1="12" y1="3" x2="12" y2="15" />
                                            </svg>
                                            <p className="text-xs text-neutral-600">{isDragging ? "Drop image here" : "Choose File or Drag & Drop"}</p>
                                            <p className="text-xs text-neutral-500 mt-1">Max 5MB</p>
                                        </div>
                                    )}
                                    <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                                </label>
                                {formErrors.image && (
                                    <p className="mt-1 text-xs text-red-600">{formErrors.image}</p>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-neutral-200">
                            <button
                                onClick={() => setIsAddModalOpen(false)}
                                className="px-4 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveSubcategory}
                                disabled={submitting || uploading}
                                className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                                    submitting || uploading ? "bg-neutral-400 cursor-not-allowed" : "bg-[var(--primary-color)] hover:bg-[var(--primary-dark)]"
                                }`}
                            >
                                {submitting ? "Saving..." : uploading ? "Uploading..." : "Create Subcategory"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </motion.div>
    );
}
