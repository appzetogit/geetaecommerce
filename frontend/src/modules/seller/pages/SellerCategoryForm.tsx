import React, { useState, useEffect } from "react";
import { useToast } from "../../../context/ToastContext";
import { Category } from "../../../services/api/categoryService";
import { uploadImage } from "../../../services/api/uploadService";
import {
  validateImageFile,
  createImagePreview,
} from "../../../utils/imageUpload";
import {
  getAvailableParents,
  validateParentChange,
} from "../../../utils/categoryUtils";
import type { Category as AdminCategory } from "../../../services/api/admin/adminProductService";
import {
  getHeaderCategoriesPublic,
  HeaderCategory,
} from "../../../services/api/headerCategoryService";

interface SellerCategoryFormProps {
  isOpen: boolean;
  onClose: () => void;
  editingCategory?: any | null; // Use any to avoid strict type conflicts with different Category interfaces
  onSave: (category: any) => void;
  parentCategory?: any | null;
  mode?: "create" | "edit" | "create-subcategory";
  ownCategories?: Category[];
}

export default function SellerCategoryForm({
  isOpen,
  onClose,
  editingCategory,
  onSave,
  parentCategory = null,
  mode = "create",
  ownCategories = [],
}: SellerCategoryFormProps) {
  const { showToast } = useToast();
  const isCreateSubcategory =
    mode === "create-subcategory" && !!parentCategory && !editingCategory;
  // New seller-created categories start as "Inactive" by default. This makes
  // category creation a two-step process: create the record (privately), then
  // explicitly flip the "Active Status" checkbox to publish it to customers.
  // Prevents half-finished categories (no image, no subcategories, no
  // products) from immediately showing up in the storefront. The edit branch
  // below preserves whatever status the seller previously saved.
  const [formData, setFormData] = useState({
    name: "",
    image: "",
    order: 0,
    parentId: null as string | null,
    headerCategoryId: null as string | null,
    status: "Inactive" as "Active" | "Inactive",
    isBestseller: false,
    hasWarning: false,
    groupCategory: "",
    description: "", // Keep description if it was being used, though not in admin
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [headerCategories, setHeaderCategories] = useState<HeaderCategory[]>([]);
  const [loadingHeaderCategories, setLoadingHeaderCategories] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const lockHeaderCategory = isCreateSubcategory && !!formData.headerCategoryId;

  // Get available parent categories (seller-owned only)
  const availableParents = getAvailableParents(
    editingCategory?._id || null,
    ownCategories as unknown as AdminCategory[]
  );

  // Fetch data when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchHeaderCategories();
    }
  }, [isOpen]);

  const fetchHeaderCategories = async () => {
    try {
      setLoadingHeaderCategories(true);
      const categories = await getHeaderCategoriesPublic();
      const publishedCategories = categories.filter(
        (cat) => cat.status === "Published"
      );
      setHeaderCategories(publishedCategories);
    } catch (error) {
      console.error("Error fetching header categories:", error);
    } finally {
      setLoadingHeaderCategories(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (editingCategory) {
        setFormData({
          name: editingCategory.name || "",
          image: editingCategory.image || "",
          order: editingCategory.order || 0,
          parentId: editingCategory.parentId || null,
          headerCategoryId: editingCategory.headerCategoryId || null,
          status: editingCategory.status || "Active",
          isBestseller: editingCategory.isBestseller || false,
          hasWarning: editingCategory.hasWarning || false,
          groupCategory: editingCategory.groupCategory || "",
          description: (editingCategory as any).description || "",
        });
        setImagePreview(editingCategory.image || "");
      } else if (isCreateSubcategory && parentCategory) {
        let inheritedHeaderCategoryId: string | null = null;
        const raw = parentCategory.headerCategoryId;
        if (typeof raw === "string") inheritedHeaderCategoryId = raw;
        else if (raw && typeof raw === "object" && typeof raw._id === "string") {
          inheritedHeaderCategoryId = raw._id;
        }

        setFormData({
          name: "",
          image: "",
          order: 0,
          parentId: parentCategory._id || null,
          headerCategoryId: inheritedHeaderCategoryId,
          // Default new subcategories to Inactive — see the useState default
          // above for the rationale.
          status: "Inactive",
          isBestseller: false,
          hasWarning: false,
          groupCategory: "",
          description: "",
        });
        setImagePreview("");
      } else {
        setFormData({
          name: "",
          image: "",
          order: 0,
          parentId: null,
          headerCategoryId: null,
          // Default new root categories to Inactive — see the useState
          // default above for the rationale.
          status: "Inactive",
          isBestseller: false,
          hasWarning: false,
          groupCategory: "",
          description: "",
        });
        setImagePreview("");
      }
      setImageFile(null);
      setErrors({});
      setShowAdvanced(false);
    }
  }, [isOpen, editingCategory, isCreateSubcategory, parentCategory]);

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData((prev) => ({
      ...prev,
      [name]:
        type === "checkbox"
          ? checked
          : type === "number"
          ? parseInt(value) || 0
          : value,
    }));

    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const processFile = async (file: File) => {
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setErrors((prev) => ({
        ...prev,
        image: validation.error || "Invalid image file",
      }));
      return;
    }

    setImageFile(file);
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors.image;
      return newErrors;
    });

    try {
      const preview = await createImagePreview(file);
      setImagePreview(preview);
    } catch (error) {
      setErrors((prev) => ({
        ...prev,
        image: "Failed to create image preview",
      }));
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await processFile(file);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await processFile(file);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Category name is required";
    }

    if (!formData.headerCategoryId) {
      newErrors.headerCategoryId = "Header category is required";
    }

    if (editingCategory) {
      const validation = validateParentChange(
        editingCategory._id,
        formData.parentId,
        ownCategories as unknown as AdminCategory[]
      );
      if (!validation.valid) {
        newErrors.parentId = validation.error || "Invalid parent selection";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setSubmitting(true);
      let imageUrl = formData.image;

      if (imageFile) {
        setUploading(true);
        const imageResult = await uploadImage(imageFile, "Geeta Stores/categories");
        imageUrl = imageResult.secureUrl;
        setUploading(false);
      }

      const categoryData = {
        _id: editingCategory?._id || `seller_${Date.now()}`,
        name: formData.name.trim(),
        image: imageUrl,
        order: formData.order,
        parentId: formData.parentId || undefined,
        headerCategoryId: formData.headerCategoryId,
        status: formData.status,
        isBestseller: formData.isBestseller,
        hasWarning: formData.hasWarning,
        groupCategory: formData.groupCategory,
        createdAt: editingCategory?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      onSave(categoryData);
      onClose();
    } catch (error: any) {
      setErrors({
        submit: error.message || "Failed to save category",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      ></div>

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
          <h2 className="text-lg font-semibold text-neutral-900">
            {isCreateSubcategory
              ? "Create Subcategory"
              : editingCategory
              ? "Edit Category"
              : "Add New Category"}
          </h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-4">
          {errors.submit && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {errors.submit}
            </div>
          )}

          {isCreateSubcategory && parentCategory && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Parent Category
              </label>
              <div className="w-full px-3 py-2 border border-[var(--primary-color)]/30 bg-[var(--primary-color)]/10 rounded-lg text-[var(--primary-color)] font-semibold">
                {parentCategory.name}
              </div>
            </div>
          )}

          {/* Category Name */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Category Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] ${
                errors.name ? "border-red-300" : "border-neutral-300"
              }`}
              placeholder="Enter category name"
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-600">{errors.name}</p>
            )}
          </div>

          {/* Header Category */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Header Category <span className="text-red-500">*</span>
            </label>
            <select
              name="headerCategoryId"
              value={formData.headerCategoryId || ""}
              onChange={handleInputChange}
              disabled={lockHeaderCategory}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] ${
                errors.headerCategoryId ? "border-red-300" : "border-neutral-300"
              } ${lockHeaderCategory ? "bg-neutral-50 cursor-not-allowed" : ""}`}
            >
              <option value="">-- Select Header Category --</option>
              {headerCategories.map((hc) => (
                <option key={hc._id} value={hc._id}>
                  {hc.name}
                </option>
              ))}
            </select>
            {lockHeaderCategory && (
              <p className="mt-1 text-xs text-[var(--primary-color)]">
                Inherited from parent category
              </p>
            )}
            {errors.headerCategoryId && (
              <p className="mt-1 text-xs text-red-600">
                {errors.headerCategoryId}
              </p>
            )}
          </div>

          {/* Category Image */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Category Image
            </label>
            <label
              className={`block border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                isDragging
                  ? "border-[var(--primary-color)] bg-[var(--primary-color)]/10"
                  : "border-neutral-300 hover:border-[var(--primary-color)]"
              }`}
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {imagePreview ? (
                <div className="space-y-2">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="max-h-32 mx-auto rounded-lg object-cover"
                  />
                  <p className="text-xs text-neutral-600">
                    {imageFile?.name || "Current image"}
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setImagePreview("");
                      setImageFile(null);
                      setFormData((prev) => ({ ...prev, image: "" }));
                    }}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="py-4">
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="mx-auto mb-2 text-neutral-400"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <p className="text-xs text-neutral-600">
                    {isDragging ? "Drop image here" : "Choose File or Drag & Drop"}
                  </p>
                  <p className="text-xs text-neutral-500 mt-1">Max 5MB</p>
                </div>
              )}
              <input
                type="file"
                className="hidden"
                accept="image/*"
                onChange={handleFileChange}
              />
            </label>
          </div>

          {!isCreateSubcategory && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Parent Category
              </label>
              <select
                name="parentId"
                value={formData.parentId || ""}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]"
              >
                <option value="">None (Root Category)</option>
                {availableParents.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Display Order */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Display Order
            </label>
            <input
              type="number"
              name="order"
              value={formData.order}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)]"
            />
          </div>

          {/* Active Status */}
          <div className="mb-4">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                name="status"
                checked={formData.status === "Active"}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    status: e.target.checked ? "Active" : "Inactive",
                  }))
                }
                className="w-4 h-4 text-[var(--primary-color)] border-neutral-300 rounded focus:ring-[var(--primary-color)]"
              />
              <span className="text-sm font-medium text-neutral-700">
                Active Status
              </span>
            </label>
          </div>

          {/* Advanced Settings */}
          <div className="mb-6">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center justify-between w-full px-4 py-2 bg-neutral-50 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-100 transition-colors"
            >
              <span>Advanced Settings</span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={`transform transition-transform ${
                  showAdvanced ? "rotate-180" : ""
                }`}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {showAdvanced && (
              <div className="mt-4 p-4 border border-neutral-200 rounded-lg space-y-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="isBestseller"
                    checked={formData.isBestseller}
                    onChange={handleInputChange}
                    className="w-4 h-4 text-[var(--primary-color)] border-neutral-300 rounded focus:ring-[var(--primary-color)]"
                  />
                  <span className="text-sm text-neutral-700">Is Bestseller</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="hasWarning"
                    checked={formData.hasWarning}
                    onChange={handleInputChange}
                    className="w-4 h-4 text-[var(--primary-color)] border-neutral-300 rounded focus:ring-[var(--primary-color)]"
                  />
                  <span className="text-sm text-neutral-700">Has Warning</span>
                </label>
                <div>
                  <label className="block text-xs font-medium text-neutral-500 mb-1">
                    Group Category
                  </label>
                  <input
                    type="text"
                    name="groupCategory"
                    value={formData.groupCategory}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
                    placeholder="Enter group category"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-neutral-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-neutral-300 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || uploading}
              className="px-6 py-2 bg-[var(--primary-color)] hover:bg-[var(--primary-dark)] text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting
                ? "Saving..."
                : isCreateSubcategory
                ? "Create Subcategory"
                : editingCategory
                ? "Update Category"
                : "Create Category"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
