import { useState, useEffect } from "react";
import {
  ProductFormState,
  ProductMainInfoForm,
  ProductVariantForm,
  defaultMainInfo,
  defaultVariant,
} from "./types/productForm.types";
import { toCreatePayload } from "./mappers/toCreatePayload";
import { fromProductDetail } from "./mappers/fromProductDetail";
import ProductMainInfoSection from "./sections/ProductMainInfoSection";
import VariantListSection from "./sections/VariantListSection";
import ProductPoliciesSection from "./sections/ProductPoliciesSection";
import { findDuplicateBarcodeMessage } from "./utils/variantBarcodeUtils";
import { getAppSettings } from "../../../services/api/admin/adminSettingsService";

export interface ProductFormConfig {
  role: "admin" | "seller";
  defaultPublish: "Yes" | "No";
  showSellerPicker?: boolean;
  submitDisabled?: boolean;
  createProduct: (data: ReturnType<typeof toCreatePayload>) => Promise<any>;
  updateProduct: (id: string, data: ReturnType<typeof toCreatePayload>) => Promise<any>;
  getProduct?: (id: string) => Promise<any>;
}

interface ProductFormPageProps {
  config: ProductFormConfig;
  productId?: string;
  onSuccess?: () => void;
}

export default function ProductFormPage({
  config,
  productId,
  onSuccess,
}: ProductFormPageProps) {
  const [formState, setFormState] = useState<ProductFormState>(() => ({
    mainInfo: defaultMainInfo({ publish: config.defaultPublish }),
    variants: [defaultVariant()],
  }));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [displaySettings, setDisplaySettings] = useState<any[]>([]);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [loadingProduct, setLoadingProduct] = useState(!!productId);

  useEffect(() => {
    let active = true;
    const fetchSettings = async () => {
      try {
        const res = await getAppSettings();
        if (active && res.success && res.data.productDisplaySettings) {
          setDisplaySettings(res.data.productDisplaySettings);
        }
      } catch (err) {
        console.error("Error fetching product display settings:", err);
      } finally {
        if (active) {
          setLoadingSettings(false);
        }
      }
    };
    fetchSettings();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (productId && config.getProduct) {
      setLoadingProduct(true);
      config.getProduct(productId)
        .then((res) => {
          if (res?.data) {
            setFormState(fromProductDetail(res.data));
          }
        })
        .finally(() => {
          setLoadingProduct(false);
        });
    } else {
      setLoadingProduct(false);
    }
  }, [productId, config]);

  const isFieldEnabled = (sectionId: string, fieldId: string) => {
    if (loadingSettings) return true;
    const section = displaySettings.find((s) => s.id === sectionId);
    if (!section) return true;
    const field = section.fields.find((f: any) => f.id === fieldId);
    return field ? field.isEnabled : true;
  };

  const enabledVariantTypes = displaySettings
    .find((s) => s.id === "variants")
    ?.fields.filter((f: any) => f.isEnabled && f.id !== "online_offer_price") || [];

  const updateMainInfo = (patch: Partial<ProductMainInfoForm>) => {
    setFormState((prev) => ({
      ...prev,
      mainInfo: { ...prev.mainInfo, ...patch },
    }));
  };

  const setVariants = (variants: ProductVariantForm[]) => {
    setFormState((prev) => ({ ...prev, variants }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!formState.mainInfo.productName.trim()) {
      setError("Product name is required");
      return;
    }
    if (isFieldEnabled("basic", "header_category") && !formState.mainInfo.headerCategory) {
      setError("Header category is required");
      return;
    }
    if (isFieldEnabled("basic", "category") && !formState.mainInfo.category) {
      setError("Category is required");
      return;
    }
    if (formState.variants.length < 1) {
      setError("At least one variant is required");
      return;
    }
    for (let i = 0; i < formState.variants.length; i++) {
      const v = formState.variants[i];
      if (!v.variationType.trim() || !v.value.trim()) {
        setError("Each variant needs a type and value");
        return;
      }
      if (!v.price || Number(v.price) < 0) {
        setError("Each variant needs a valid price");
        return;
      }
      if (!v.barcode?.length || !v.barcode.some((b) => b.trim())) {
        setError(`Variant ${i + 1} needs at least one barcode`);
        return;
      }
    }

    const duplicateBarcodeMessage = findDuplicateBarcodeMessage(formState.variants);
    if (duplicateBarcodeMessage) {
      setError(duplicateBarcodeMessage);
      return;
    }

    setLoading(true);
    try {
      const payload = toCreatePayload(formState);
      const res = productId
        ? await config.updateProduct(productId, payload)
        : await config.createProduct(payload);
      if (res?.success) {
        setSuccess(productId ? "Product updated successfully!" : "Product created successfully!");
        onSuccess?.();
        if (!productId) {
          setFormState({
            mainInfo: defaultMainInfo({ publish: config.defaultPublish }),
            variants: [defaultVariant()],
          });
        }
      } else {
        setError(res?.message || "Failed to save product");
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || "Failed to save");
    } finally {
      setLoading(false);
    }
  };

  if (loadingSettings || loadingProduct) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-violet-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/30 to-amber-50/40 pb-28">
      <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 px-4 py-8 text-white shadow-lg md:px-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-white/70">
            {config.role === "admin" ? "Admin Panel" : "Seller Panel"}
          </p>
          <h1 className="mt-1 text-3xl font-black tracking-tight md:text-4xl">
            {productId ? "Edit Product" : "Add New Product"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-white/85 md:text-base">
            Fill in all details on this page — product info, variants, and policies together.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-8">
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 shadow-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 shadow-sm">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <ProductMainInfoSection
            role={config.role}
            mainInfo={formState.mainInfo}
            onChange={updateMainInfo}
            showSellerPicker={config.showSellerPicker}
            isFieldEnabled={isFieldEnabled}
          />

          <VariantListSection
            variants={formState.variants}
            onChange={setVariants}
            isFieldEnabled={isFieldEnabled}
            productName={formState.mainInfo.productName}
            enabledVariantTypes={enabledVariantTypes}
          />

          <ProductPoliciesSection
            mainInfo={formState.mainInfo}
            onChange={updateMainInfo}
            isFieldEnabled={isFieldEnabled}
          />

          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/90 px-4 py-4 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] backdrop-blur-md md:px-8">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
              <p className="hidden text-sm text-slate-500 sm:block">
                {formState.variants.length} variant
                {formState.variants.length === 1 ? "" : "s"} · scroll up to review
              </p>
              <button
                type="submit"
                disabled={loading || config.submitDisabled}
                className="ml-auto rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-8 py-3 text-sm font-bold text-white shadow-lg shadow-violet-200 transition hover:scale-[1.02] hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading
                  ? "Saving..."
                  : productId
                    ? "Update Product"
                    : "Create Product"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
