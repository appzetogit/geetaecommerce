import { useState, useEffect, useMemo } from "react";
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  toggleCategoryStatus,
  bulkDeleteCategories,
  type Category,
  type CreateCategoryData,
  type UpdateCategoryData,
} from "../../../services/api/admin/adminProductService";
import { useAuth } from "../../../context/AuthContext";
import { useConfirmation } from "../../../context/ConfirmationContext";
import { useToast } from "../../../context/ToastContext";
import CategoryFormModal from "../components/CategoryFormModal";
import CategoryTreeView from "../components/CategoryTreeView";
import CategoryListView from "../components/CategoryListView";
import ThemedDropdown from "../components/ThemedDropdown"; // Import the new component
import {
  buildCategoryTree,
  searchCategories,
  filterCategoriesByStatus,
} from "../../../utils/categoryUtils";

// Flatten tree structure for filtering
const flattenTree = (cats: Category[]): Category[] => {
  const result: Category[] = [];
  cats.forEach((cat) => {
    const { children, ...catWithoutChildren } = cat;
    let normalizedParentId: string | null = null;
    if (catWithoutChildren.parentId) {
      if (typeof catWithoutChildren.parentId === "string") {
        normalizedParentId = catWithoutChildren.parentId;
      } else if (
        typeof catWithoutChildren.parentId === "object" &&
        catWithoutChildren.parentId !== null
      ) {
        normalizedParentId =
          (catWithoutChildren.parentId as { _id?: string })._id || null;
      }
    }

    result.push({
      ...catWithoutChildren,
      parentId: normalizedParentId,
      childrenCount:
        cat.childrenCount ||
        (children && children.length > 0 ? children.length : 0),
    } as Category);
    if (children && children.length > 0) {
      result.push(...flattenTree(children));
    }
  });
  return result;
};

export default function AdminCategory() {
  const { openConfirmation } = useConfirmation();
  const { showToast } = useToast();
  const { isAuthenticated, token } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [viewMode, setViewMode] = useState<"tree" | "list">("tree");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "All" | "Active" | "Inactive"
  >("All");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isModalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<
    "create" | "edit" | "create-subcategory"
  >("create");
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [parentCategory, setParentCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [listPage, setListPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Fetch categories on mount
  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async (preserveExpandedIds?: Set<string>) => {
    try {
      setLoading(true);
      setError(null);
      const response = await getCategories({
        includeChildren: true,
      });
      if (response.success) {
        setCategories(response.data);
        if (preserveExpandedIds && preserveExpandedIds.size > 0) {
          setExpandedIds(preserveExpandedIds);
        } else {
          // Auto-expand all categories by default
          const allIds = new Set<string>();
          const collectIds = (cats: Category[]) => {
            cats.forEach((cat) => {
              allIds.add(cat._id);
              if (cat.children && cat.children.length > 0) {
                collectIds(cat.children);
              }
            });
          };
          collectIds(response.data);
          setExpandedIds(allIds);
        }
      }
    } catch (err: any) {
      console.error("Error fetching categories:", err);
      const errorMessage =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : "Failed to load categories. Please try again.";
      setError(errorMessage || "Failed to load categories. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Navigation Stack for Drill-Down (List View)
  const [navigationStack, setNavigationStack] = useState<Category[]>([]);

  const filteredCategories = useMemo(() => {
    const flatCategories = flattenTree(categories);
    let filtered = [...flatCategories];

    if (searchQuery.trim()) {
      filtered = searchCategories(filtered, searchQuery);
    }

    filtered = filterCategoriesByStatus(filtered, statusFilter);
    return filtered;
  }, [categories, searchQuery, statusFilter]);

  // Derived list for display (Filtered by Navigation Stack if not searching)
  const displayedCategories = useMemo(() => {
    if (viewMode === 'tree') return [];

    // If searching, show all matches regardless of hierarchy
    if (searchQuery.trim()) {
      return filteredCategories;
    }

    // Drill-down logic:
    // Identify current parent ID
    const currentParentId = navigationStack.length > 0
      ? navigationStack[navigationStack.length - 1]._id
      : null;

    // Filter categories that belong to current parent
    return filteredCategories.filter(cat => {
      // Normalize parentId from the flat list
      const pId = cat.parentId || null;
      return pId === currentParentId;
    });

  }, [filteredCategories, searchQuery, navigationStack, viewMode]);

  const categoryTree = useMemo(() => {
    if (viewMode === "tree") {
      return buildCategoryTree(filteredCategories);
    }
    return [];
  }, [filteredCategories, viewMode]);

  const handleCreateCategory = () => {
    setModalMode("create");
    setEditingCategory(null);
    setParentCategory(null);
    setModalOpen(true);
  };

  const handleCreateSubcategory = (parent: Category) => {
    setModalMode("create-subcategory");
    setEditingCategory(null);
    setParentCategory(parent);
    setModalOpen(true);
  };

  const handleEdit = (category: Category) => {
    setModalMode("edit");
    setEditingCategory(category);
    setParentCategory(null);
    setModalOpen(true);
  };

  // --- NAVIGATION HANDLERS ---
  const handleCategoryClick = (category: Category) => {
    // Only navigate if it has children or it effectively acts as a parent
    // Logic: If filteredCategories contains any item whose parentId is this category, then it has children to show.
    // Or if childrenCount > 0 from DB.
    const hasChildren = (category.childrenCount && category.childrenCount > 0) ||
                        filteredCategories.some(c => c.parentId === category._id);

    if (hasChildren) {
      setNavigationStack(prev => [...prev, category]);
      setListPage(1); // Reset page on nav
      setSearchQuery(""); // Clear search on drill down to avoid confusion? Or keep? Clearing is safer for "entering" a folder.
    }
  };

  const handleNavigateBack = () => {
    setNavigationStack(prev => prev.slice(0, -1));
    setListPage(1);
  };

  const handleDelete = (category: Category) => {
    openConfirmation({
      title: 'Delete Category',
      message: `Are you sure you want to delete "${category.name}"? This action cannot be undone.`,
      confirmText: 'Delete',
      confirmButtonClass: 'bg-red-600 hover:bg-red-700 text-white',
      onConfirm: async () => {
        try {
          const response = await deleteCategory(category._id);
          if (response.success) {
            showToast("Category deleted successfully!");
            fetchCategories();
          }
        } catch (error: any) {
          const errorMessage =
            error && typeof error === "object" && "response" in error
              ? (error as { response?: { data?: { message?: string } } }).response
                  ?.data?.message
              : "Failed to delete category. Please try again.";
          showToast(errorMessage || "Failed to delete category. Please try again.");
        }
      }
    });
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) {
      showToast("Please select at least one category to delete.");
      return;
    }

    openConfirmation({
      title: 'Bulk Delete',
      message: `Are you sure you want to delete ${selectedIds.size} selected category(ies)? This action cannot be undone.`,
      confirmText: 'Delete All',
      confirmButtonClass: 'bg-red-600 hover:bg-red-700 text-white',
      onConfirm: async () => {
        try {
          const response = await bulkDeleteCategories(Array.from(selectedIds));
          if (response.success) {
            const deletedCount = response.data.deleted.length;
            const failedCount = response.data.failed.length;
            if (failedCount > 0) {
              showToast(
                `Deleted ${deletedCount} category(ies). ${failedCount} failed. Check console for details.`
              );
              console.log("Failed deletions:", response.data.failed);
            } else {
              showToast(`Successfully deleted ${deletedCount} category(ies).`);
            }
            setSelectedIds(new Set());
            fetchCategories();
          }
        } catch (error: any) {
          const errorMessage =
            error && typeof error === "object" && "response" in error
              ? (error as { response?: { data?: { message?: string } } }).response
                  ?.data?.message
              : "Failed to delete categories. Please try again.";
          showToast(errorMessage || "Failed to delete categories. Please try again.");
        }
      }
    });
  };

  const handleToggleStatus = (category: Category) => {
    const newStatus = category.status === "Active" ? "Inactive" : "Active";

    const performToggle = async (cascade: boolean) => {
      try {
        const response = await toggleCategoryStatus(
          category._id,
          newStatus,
          cascade
        );
        if (response.success) {
          showToast(`Category status updated to ${newStatus}`);
          fetchCategories();
        }
      } catch (error: any) {
        const errorMessage =
          error && typeof error === "object" && "response" in error
            ? (error as { response?: { data?: { message?: string } } }).response
                ?.data?.message
            : "Failed to update category status. Please try again.";
        showToast(
          errorMessage || "Failed to update category status. Please try again."
        );
      }
    };

    if (category.childrenCount && category.childrenCount > 0) {
      openConfirmation({
        title: 'Cascade Status Update',
        message: `This category has subcategories. Do you want to ${
          newStatus === "Inactive" ? "deactivate" : "activate"
        } all subcategories as well?`,
        confirmText: 'Yes, Cascade',
        cancelText: 'No, Only This',
        onConfirm: () => performToggle(true),
        onCancel: () => performToggle(false)
      });
    } else {
      performToggle(false);
    }
  };

  const handleFormSubmit = async (
    data: CreateCategoryData | UpdateCategoryData
  ) => {
    if (modalMode === "edit" && editingCategory) {
      const response = await updateCategory(editingCategory._id, data);
      if (response.success) {
        showToast("Category updated successfully!");
        fetchCategories();
      }
    } else {
      const response = await createCategory(data as CreateCategoryData);
      if (response.success) {
        showToast("Category created successfully!");
        if (modalMode === "create-subcategory" && parentCategory) {
          const newExpandedIds = new Set(expandedIds);
          newExpandedIds.add(parentCategory._id);
          fetchCategories(newExpandedIds);
        } else {
          fetchCategories();
        }
      }
    }
  };

  const handleExport = () => {
    const headers = [
      "ID",
      "Name",
      "Parent",
      "Status",
      "Order",
      "Image",
      "Created At",
    ];
    const csvContent = [
      headers.join(","),
      ...filteredCategories.map((category) =>
        [
          category._id,
          `"${category.name}"`,
          category.parent
            ? typeof category.parent === "string"
              ? category.parent
              : category.parent.name
            : category.parentId || "Root",
          category.status,
          category.order || 0,
          category.image || "",
          category.createdAt || "",
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `categories_${new Date().toISOString().split("T")[0]}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === displayedCategories.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayedCategories.map((cat) => cat._id)));
    }
  };

  const handleToggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleExpandAll = () => {
    const allIds = new Set<string>();
    const collectIds = (cats: Category[]) => {
      cats.forEach((cat) => {
        allIds.add(cat._id);
        if (cat.children && cat.children.length > 0) {
          collectIds(cat.children);
        }
      });
    };
    collectIds(categoryTree);
    setExpandedIds(allIds);
  };

  const handleCollapseAll = () => {
    setExpandedIds(new Set());
  };

  const currentActiveCategory = navigationStack.length > 0 ? navigationStack[navigationStack.length - 1] : null;

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header Section */}
      <div className="bg-white border-b border-neutral-200">
         <div className="px-4 py-4 md:px-6 md:py-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
           <div>
             <h1 className="text-xl md:text-2xl font-bold text-neutral-900 tracking-tight">Manage Categories</h1>
             <p className="text-sm text-neutral-500 mt-1">Organize and manage your product catalog</p>
           </div>

           <div className="flex items-center gap-3">
             <button
                onClick={handleCreateCategory}
                className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition-all focus:ring-2 focus:ring-teal-600 focus:ring-offset-2 flex items-center gap-2"
             >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                   <line x1="12" y1="5" x2="12" y2="19"></line>
                   <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Add Category
             </button>

              <button
                onClick={handleExport}
                className="bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-700 px-4 py-2.5 rounded-lg text-sm font-medium shadow-sm transition-all flex items-center gap-2"
              >
                 <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                 </svg>
                 Export
              </button>
           </div>
         </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 px-4 md:px-6 pb-6">
        <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden flex flex-col">

           {/* Controls Bar */}
           <div className="p-4 border-b border-neutral-200 bg-neutral-50/50 space-y-4">
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">

                 {/* Left Side Controls */}
                 <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto">
                    {/* View Toggle */}
                    <div className="bg-neutral-100 p-1 rounded-lg border border-neutral-200 flex shrink-0">
                       <button
                          onClick={() => setViewMode("tree")}
                          className={`flex-1 sm:flex-none px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                             viewMode === "tree" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
                          }`}
                       >
                          Tree
                       </button>
                       <button
                          onClick={() => setViewMode("list")}
                          className={`flex-1 sm:flex-none px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                             viewMode === "list" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
                          }`}
                       >
                          List
                       </button>
                    </div>

                    {/* Status Filter */}
                    <div className="w-full sm:w-48">
                       <ThemedDropdown
                          options={['All', 'Active', 'Inactive']}
                          value={statusFilter}
                          onChange={(val) => setStatusFilter(val)}
                          placeholder="Filter by Status"
                       />
                    </div>
                 </div>

                 {/* Right Side Controls */}
                 <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto">
                    {/* Search */}
                    <div className="relative w-full sm:w-64">
                       <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="11" cy="11" r="8"></circle>
                          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                       </svg>
                       <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => {
                             setSearchQuery(e.target.value);
                             setListPage(1);
                             if (e.target.value) setNavigationStack([]); // Reset stack on search to find globally
                          }}
                          placeholder="Search categories..."
                          className="w-full pl-9 pr-4 py-2 bg-white border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                       />
                    </div>

                    {/* Bulk Delete (List View Only) */}
                    {viewMode === "list" && selectedIds.size > 0 && (
                       <button
                          onClick={handleBulkDelete}
                          className="bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 border border-red-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                       >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                             <polyline points="3 6 5 6 21 6"></polyline>
                             <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          </svg>
                          Delete ({selectedIds.size})
                       </button>
                    )}

                    {/* Expand/Collapse (Tree View Only) */}
                     {viewMode === "tree" && (
                       <div className="flex items-center gap-2 shrink-0">
                         <button onClick={handleExpandAll} className="px-3 py-2 text-xs font-medium text-neutral-600 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors">
                           Expand All
                         </button>
                         <button onClick={handleCollapseAll} className="px-3 py-2 text-xs font-medium text-neutral-600 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors">
                           Collapse All
                         </button>
                       </div>
                     )}
                 </div>
              </div>
           </div>

           {/* Drilled-Down Header (Back Button + Title) */}
           {viewMode === 'list' && !searchQuery.trim() && currentActiveCategory && (
             <div className="flex items-center gap-3 px-4 py-3 bg-neutral-50 border-b border-neutral-200">
                <button
                  onClick={handleNavigateBack}
                  className="p-1.5 hover:bg-neutral-200 rounded-full transition-colors text-neutral-600"
                  title="Go Back"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 12H5M12 19l-7-7 7-7"/>
                  </svg>
                </button>
                <div>
                   <h2 className="text-base font-bold text-neutral-900">{currentActiveCategory.name}</h2>
                   <p className="text-xs text-neutral-500">Subcategories</p>
                </div>
             </div>
           )}

           {/* Content View */}
           <div className="min-h-[400px]">
             {loading ? (
               <div className="flex flex-col items-center justify-center h-64 text-neutral-500">
                  <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                  <p className="text-sm font-medium">Loading categories...</p>
               </div>
             ) : error ? (
               <div className="p-8 text-center bg-red-50 border-b border-red-100">
                  <p className="text-red-600 font-medium">{error}</p>
               </div>
             ) : (
                <div className="p-4 sm:p-6 overflow-x-auto">
                   {viewMode === "tree" ? (
                      <CategoryTreeView
                         categories={categoryTree}
                         onAddSubcategory={handleCreateSubcategory}
                         onEdit={handleEdit}
                         onDelete={handleDelete}
                         onToggleStatus={handleToggleStatus}
                         expandedIds={expandedIds}
                         onToggleExpand={handleToggleExpand}
                      />
                   ) : (
                      <CategoryListView
                         categories={displayedCategories}
                         selectedIds={selectedIds}
                         onSelect={handleSelect}
                         onSelectAll={handleSelectAll}
                         onEdit={handleEdit}
                         onDelete={handleDelete}
                         onCategoryClick={handleCategoryClick}
                         currentPage={listPage}
                         itemsPerPage={itemsPerPage}
                         onPageChange={setListPage}
                      />
                   )}
                </div>
             )}
           </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-6 text-xs text-neutral-500 border-t border-neutral-200 mt-auto bg-white">
        <div className="max-w-7xl mx-auto px-4">
           Copyright © 2025. Developed By <span className="font-semibold text-teal-600">Geeta Stores - 10 Minute App</span>
        </div>
      </div>

      {/* Category Form Modal */}
      {isModalOpen && (
        <CategoryFormModal
          isOpen={isModalOpen}
          onClose={() => {
            setModalOpen(false);
            setEditingCategory(null);
            setParentCategory(null);
          }}
          onSubmit={handleFormSubmit}
          category={editingCategory || undefined}
          parentCategory={parentCategory || undefined}
          mode={modalMode}
          allCategories={categories}
        />
      )}
    </div>
  );
}
