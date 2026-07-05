import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getCategories as getAdminCategories,
  getSubCategories as getAdminSubCategories,
  Category as AdminCategory,
  SubCategory as AdminSubCategory,
} from "../../../../services/api/admin/adminProductService";
import {
  getCategories as getPublicCategories,
  getSubcategories as getPublicSubcategories,
  Category as PublicCategory,
  SubCategory as PublicSubCategory,
} from "../../../../services/api/categoryService";
import {
  getHeaderCategoriesAdmin,
  getHeaderCategoriesPublic,
  HeaderCategory,
} from "../../../../services/api/headerCategoryService";

type Role = "admin" | "seller";

type AnyCategory = AdminCategory | PublicCategory;
type AnySubCategory = AdminSubCategory | PublicSubCategory;

function resolveId(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "_id" in value) {
    return String((value as { _id?: string })._id || "");
  }
  return String(value);
}

function subCategoryParentId(sub: AnySubCategory): string {
  const category = (sub as AdminSubCategory).category;
  if (!category) return "";
  return resolveId(category);
}

function subCategoryLabel(sub: AnySubCategory): string {
  return (
    (sub as AdminSubCategory).name ||
    (sub as PublicSubCategory).subcategoryName ||
    "Unnamed"
  );
}

interface UseCategoryCascadeOptions {
  role: Role;
  headerCategoryId: string;
  categoryId: string;
  subcategoryId: string;
}

export function useCategoryCascade({
  role,
  headerCategoryId,
  categoryId,
  subcategoryId,
}: UseCategoryCascadeOptions) {
  const [headerCategories, setHeaderCategories] = useState<HeaderCategory[]>([]);
  const [categories, setCategories] = useState<AnyCategory[]>([]);
  const [subcategories, setSubcategories] = useState<AnySubCategory[]>([]);
  const [loadingHeaders, setLoadingHeaders] = useState(true);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingSubcategories, setLoadingSubcategories] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadHeaders = async () => {
      setLoadingHeaders(true);
      try {
        const data =
          role === "admin"
            ? await getHeaderCategoriesAdmin()
            : await getHeaderCategoriesPublic();
        if (!cancelled) {
          setHeaderCategories(
            role === "admin"
              ? data
              : data.filter((hc) => hc.status === "Published")
          );
        }
      } catch {
        if (!cancelled) setHeaderCategories([]);
      } finally {
        if (!cancelled) setLoadingHeaders(false);
      }
    };

    loadHeaders();
    return () => {
      cancelled = true;
    };
  }, [role]);

  useEffect(() => {
    let cancelled = false;

    const loadCategories = async () => {
      setLoadingCategories(true);
      try {
        const response =
          role === "admin"
            ? await getAdminCategories({ status: "Active" })
            : await getPublicCategories();
        if (!cancelled && response.success) {
          setCategories(response.data || []);
        }
      } catch {
        if (!cancelled) setCategories([]);
      } finally {
        if (!cancelled) setLoadingCategories(false);
      }
    };

    loadCategories();
    return () => {
      cancelled = true;
    };
  }, [role]);

  const loadSubcategories = useCallback(
    async (parentCategoryId: string) => {
      if (!parentCategoryId) {
        setSubcategories([]);
        return;
      }
      setLoadingSubcategories(true);
      try {
        if (role === "admin") {
          const response = await getAdminSubCategories({
            category: parentCategoryId,
          });
          setSubcategories(response.success ? response.data || [] : []);
        } else {
          const response = await getPublicSubcategories(parentCategoryId);
          setSubcategories(response.success ? response.data || [] : []);
        }
      } catch {
        setSubcategories([]);
      } finally {
        setLoadingSubcategories(false);
      }
    },
    [role]
  );

  useEffect(() => {
    void loadSubcategories(categoryId);
  }, [categoryId, loadSubcategories]);

  const inferredHeaderId = useMemo(() => {
    if (headerCategoryId || !categoryId) return "";
    const cat = categories.find((c) => c._id === categoryId);
    if (!cat) return "";
    return resolveId((cat as AdminCategory).headerCategoryId);
  }, [headerCategoryId, categoryId, categories]);

  const effectiveHeaderId = headerCategoryId || inferredHeaderId;

  const filteredCategoriesWithFallback = useMemo(() => {
    if (!effectiveHeaderId) return [];
    return categories.filter((cat) => {
      const headerId = resolveId((cat as AdminCategory).headerCategoryId);
      return headerId === effectiveHeaderId && !(cat as AdminCategory).parentId;
    });
  }, [categories, effectiveHeaderId]);

  const filteredSubcategories = useMemo(() => {
    if (!categoryId) return [];
    return subcategories.filter(
      (sub) => subCategoryParentId(sub) === categoryId
    );
  }, [subcategories, categoryId]);

  return {
    headerCategories,
    categories: filteredCategoriesWithFallback,
    subcategories: filteredSubcategories,
    effectiveHeaderId,
    loadingHeaders,
    loadingCategories,
    loadingSubcategories,
    subCategoryLabel,
  };
}
