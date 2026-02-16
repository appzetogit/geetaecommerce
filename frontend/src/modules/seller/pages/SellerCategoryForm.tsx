import React, { useState, useEffect } from 'react';
import { useToast } from '../../../context/ToastContext';

interface Category {
    _id: string;
    name: string;
    image?: string;
    description?: string;
    totalSubcategory?: number;
    createdBy?: string;
    createdAt?: string;
}

interface SellerCategoryFormProps {
    isOpen: boolean;
    onClose: () => void;
    editingCategory?: Category | null;
    onSave: (category: Category) => void;
}

export default function SellerCategoryForm({ isOpen, onClose, editingCategory, onSave }: SellerCategoryFormProps) {
    const { showToast } = useToast();
    const [formData, setFormData] = useState({
        name: '',
        image: '',
        description: ''
    });

    const [imagePreview, setImagePreview] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (editingCategory) {
            setFormData({
                name: editingCategory.name,
                image: editingCategory.image || '',
                description: editingCategory.description || ''
            });
            setImagePreview(editingCategory.image || '');
        } else {
            // Reset form for new category
            setFormData({
                name: '',
                image: '',
                description: ''
            });
            setImagePreview('');
        }
        setErrors({});
    }, [editingCategory, isOpen]);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result as string;
                setImagePreview(base64String);
                setFormData(prev => ({ ...prev, image: base64String }));
            };
            reader.readAsDataURL(file);
        }
    };

    const validate = () => {
        const newErrors: Record<string, string> = {};

        if (!formData.name.trim()) {
            newErrors.name = 'Category name is required';
        }

        if (!formData.image) {
            newErrors.image = 'Category image is required';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!validate()) return;

        const newCategory: Category = {
            _id: editingCategory?._id || `seller_${Date.now()}`,
            name: formData.name,
            image: formData.image,
            description: formData.description,
            totalSubcategory: editingCategory?.totalSubcategory || 0,
            createdBy: 'seller',
            createdAt: editingCategory?.createdAt || new Date().toISOString()
        };

        onSave(newCategory);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                    <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={onClose}></div>
                </div>

                <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

                <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                    <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                        <div className="sm:flex sm:items-start">
                            <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                                <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                                    {editingCategory ? 'Edit Category' : 'Add New Category'}
                                </h3>
                                <div className="mt-4">
                                    <form onSubmit={handleSubmit} className="space-y-4">
                                        {/* Name */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Category Name <span className="text-red-500">*</span></label>
                                            <input
                                                type="text"
                                                value={formData.name}
                                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                className={`mt-1 block w-full border ${errors.name ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-[#f187b5] focus:border-[#f187b5] sm:text-sm`}
                                                placeholder="Enter category name"
                                            />
                                            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
                                        </div>

                                        {/* Image */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Category Image <span className="text-red-500">*</span></label>
                                            <div className="mt-1 flex items-center gap-4">
                                                {imagePreview && (
                                                    <div className="relative w-16 h-16 rounded overflow-hidden border border-gray-200">
                                                        <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                                                    </div>
                                                )}
                                                <label className="cursor-pointer bg-white py-2 px-3 border border-gray-300 rounded-md shadow-sm text-sm leading-4 font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#f187b5]">
                                                    <span>Upload Image</span>
                                                    <input type="file" className="sr-only" accept="image/*" onChange={handleImageUpload} />
                                                </label>
                                            </div>
                                            {errors.image && <p className="mt-1 text-xs text-red-500">{errors.image}</p>}
                                        </div>

                                        {/* Description */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Description</label>
                                            <textarea
                                                rows={3}
                                                value={formData.description}
                                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-[#f187b5] focus:border-[#f187b5] sm:text-sm"
                                                placeholder="Enter description (optional)"
                                            />
                                        </div>
                                    </form>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                        <button
                            type="button"
                            onClick={handleSubmit}
                            className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-[#f187b5] text-base font-medium text-white hover:bg-[#e076a5] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#f187b5] sm:ml-3 sm:w-auto sm:text-sm"
                        >
                            {editingCategory ? 'Update' : 'Create'}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
