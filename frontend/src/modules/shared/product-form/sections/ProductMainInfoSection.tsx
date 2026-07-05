import { useEffect, useState } from "react";
import { ProductMainInfoForm } from "../types/productForm.types";
import FormField, { inputClass, selectClass } from "../components/FormField";
import FormSectionCard from "../components/FormSectionCard";
import CategoryCascadeFields from "../components/CategoryCascadeFields";
import { getBrands, Brand } from "../../../../services/api/brandService";

interface Props {
  role: "admin" | "seller";
  mainInfo: ProductMainInfoForm;
  onChange: (patch: Partial<ProductMainInfoForm>) => void;
  showSellerPicker?: boolean;
}

const yesNoSelect = (
  value: "Yes" | "No",
  onChange: (v: "Yes" | "No") => void
) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value as "Yes" | "No")}
    className={selectClass}
  >
    <option value="Yes">Yes</option>
    <option value="No">No</option>
  </select>
);

export default function ProductMainInfoSection({
  role,
  mainInfo,
  onChange,
  showSellerPicker,
}: Props) {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loadingBrands, setLoadingBrands] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const loadBrands = async () => {
      setLoadingBrands(true);
      try {
        const response = await getBrands();
        if (!cancelled && response.success) {
          setBrands(response.data || []);
        }
      } catch {
        if (!cancelled) setBrands([]);
      } finally {
        if (!cancelled) setLoadingBrands(false);
      }
    };
    void loadBrands();
    return () => {
      cancelled = true;
    };
  }, [role]);

  return (
    <div className="space-y-6">
      <FormSectionCard
        title="Basic Details"
        subtitle="Name, descriptions, and visibility flags"
        accent="sky"
        icon={<span className="text-lg">📦</span>}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Product Name" required className="md:col-span-2">
            <input
              className={inputClass}
              value={mainInfo.productName}
              onChange={(e) => onChange({ productName: e.target.value })}
              placeholder="Enter product name"
              required
            />
          </FormField>
          <FormField label="Short Description" className="md:col-span-2">
            <textarea
              className={inputClass}
              rows={2}
              value={mainInfo.smallDescription}
              onChange={(e) => onChange({ smallDescription: e.target.value })}
              placeholder="Brief summary for listings"
            />
          </FormField>
          <FormField label="Full Description" className="md:col-span-2">
            <textarea
              className={inputClass}
              rows={4}
              value={mainInfo.description}
              onChange={(e) => onChange({ description: e.target.value })}
              placeholder="Detailed product information"
            />
          </FormField>
          <FormField label="Publish">
            {yesNoSelect(mainInfo.publish, (v) => onChange({ publish: v }))}
          </FormField>
          <FormField label="Popular">
            {yesNoSelect(mainInfo.popular, (v) => onChange({ popular: v }))}
          </FormField>
          <FormField label="Deal of the Day">
            {yesNoSelect(mainInfo.dealOfDay, (v) => onChange({ dealOfDay: v }))}
          </FormField>
          {showSellerPicker && (
            <FormField label="Seller ID">
              <input
                className={inputClass}
                value={mainInfo.seller}
                onChange={(e) => onChange({ seller: e.target.value })}
                placeholder="Seller ObjectId"
              />
            </FormField>
          )}
        </div>
      </FormSectionCard>

      <FormSectionCard
        title="Category & Brand"
        subtitle="Organize product in your catalog hierarchy"
        accent="amber"
        icon={<span className="text-lg">🏷️</span>}
      >
        <CategoryCascadeFields
          role={role}
          headerCategoryId={mainInfo.headerCategory}
          categoryId={mainInfo.category}
          subcategoryId={mainInfo.subcategory}
          onChange={(patch) => onChange(patch)}
        />

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Brand Name">
            <select
              className={selectClass}
              value={mainInfo.brand}
              onChange={(e) => onChange({ brand: e.target.value })}
              disabled={loadingBrands}
            >
              <option value="">
                {loadingBrands ? "Loading brands..." : "Select brand (optional)"}
              </option>
              {brands.map((brand) => (
                <option key={brand._id} value={brand._id}>
                  {brand.name}
                </option>
              ))}
            </select>
          </FormField>
        </div>
      </FormSectionCard>

      <FormSectionCard
        title="Tax & Compliance"
        subtitle="GST, HSN, and tax configuration"
        accent="emerald"
        icon={<span className="text-lg">💰</span>}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="GST %">
            <input
              type="number"
              className={inputClass}
              value={mainInfo.gst}
              onChange={(e) => onChange({ gst: e.target.value })}
            />
          </FormField>
          <FormField label="HSN Code">
            <input
              className={inputClass}
              value={mainInfo.hsnCode}
              onChange={(e) => onChange({ hsnCode: e.target.value })}
            />
          </FormField>
        </div>
      </FormSectionCard>
    </div>
  );
}
