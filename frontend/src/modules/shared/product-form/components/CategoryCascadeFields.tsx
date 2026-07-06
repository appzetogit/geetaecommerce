import { useEffect } from "react";
import FormField, { selectClass } from "../components/FormField";
import { useCategoryCascade } from "../hooks/useCategoryCascade";

interface Props {
  role: "admin" | "seller";
  headerCategoryId: string;
  categoryId: string;
  subcategoryId: string;
  onChange: (patch: {
    headerCategory?: string;
    category?: string;
    subcategory?: string;
  }) => void;
  isFieldEnabled: (sectionId: string, fieldId: string) => boolean;
}

export default function CategoryCascadeFields({
  role,
  headerCategoryId,
  categoryId,
  subcategoryId,
  onChange,
  isFieldEnabled,
}: Props) {
  const {
    headerCategories,
    categories,
    subcategories,
    effectiveHeaderId,
    loadingHeaders,
    loadingCategories,
    loadingSubcategories,
    subCategoryLabel,
  } = useCategoryCascade({ role, headerCategoryId, categoryId, subcategoryId });

  useEffect(() => {
    if (!headerCategoryId && effectiveHeaderId) {
      onChange({ headerCategory: effectiveHeaderId });
    }
  }, [headerCategoryId, effectiveHeaderId, onChange]);

  const handleHeaderChange = (value: string) => {
    onChange({
      headerCategory: value,
      category: "",
      subcategory: "",
    });
  };

  const handleCategoryChange = (value: string) => {
    onChange({
      category: value,
      subcategory: "",
    });
  };

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {isFieldEnabled("basic", "header_category") && (
        <FormField label="Header Category" required>
          <select
            className={selectClass}
            value={headerCategoryId || effectiveHeaderId}
            onChange={(e) => handleHeaderChange(e.target.value)}
            disabled={loadingHeaders}
          >
            <option value="">
              {loadingHeaders ? "Loading..." : "Select header category"}
            </option>
            {headerCategories.map((hc) => (
              <option key={hc._id} value={hc._id}>
                {hc.name}
              </option>
            ))}
          </select>
        </FormField>
      )}

      {isFieldEnabled("basic", "category") && (
        <FormField label="Category" required>
          <select
            className={selectClass}
            value={categoryId}
            onChange={(e) => handleCategoryChange(e.target.value)}
            disabled={!effectiveHeaderId || loadingCategories}
          >
            <option value="">
              {!effectiveHeaderId
                ? "Select header category first"
                : loadingCategories
                  ? "Loading..."
                  : categories.length === 0
                    ? "No categories found"
                    : "Select category"}
            </option>
            {categories.map((cat) => (
              <option key={cat._id} value={cat._id}>
                {cat.name}
              </option>
            ))}
          </select>
        </FormField>
      )}

      {isFieldEnabled("basic", "subcategory") && (
        <FormField label="Sub Category">
          <select
            className={selectClass}
            value={subcategoryId}
            onChange={(e) => onChange({ subcategory: e.target.value })}
            disabled={!categoryId || loadingSubcategories}
          >
            <option value="">
              {!categoryId
                ? "Select category first"
                : loadingSubcategories
                  ? "Loading..."
                  : subcategories.length === 0
                    ? "No sub categories (optional)"
                    : "Select sub category"}
            </option>
            {subcategories.map((sub) => (
              <option key={sub._id} value={sub._id}>
                {subCategoryLabel(sub)}
              </option>
            ))}
          </select>
        </FormField>
      )}
    </div>
  );
}
