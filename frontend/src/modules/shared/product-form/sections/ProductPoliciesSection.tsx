import { ProductMainInfoForm } from "../types/productForm.types";
import FormField, { inputClass, selectClass } from "../components/FormField";
import FormSectionCard from "../components/FormSectionCard";

interface Props {
  mainInfo: ProductMainInfoForm;
  onChange: (patch: Partial<ProductMainInfoForm>) => void;
}

export default function ProductPoliciesSection({ mainInfo, onChange }: Props) {
  return (
    <div className="space-y-6">
      <FormSectionCard
        title="SEO & Discovery"
        subtitle="Help customers find this product in search"
        accent="rose"
        icon={<span className="text-lg">🔍</span>}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Tags" hint="Comma separated" className="md:col-span-2">
            <input
              className={inputClass}
              value={mainInfo.tags}
              onChange={(e) => onChange({ tags: e.target.value })}
              placeholder="organic, grocery, fresh"
            />
          </FormField>
          <FormField label="SEO Title">
            <input
              className={inputClass}
              value={mainInfo.seoTitle}
              onChange={(e) => onChange({ seoTitle: e.target.value })}
            />
          </FormField>
          <FormField label="SEO Keywords">
            <input
              className={inputClass}
              value={mainInfo.seoKeywords}
              onChange={(e) => onChange({ seoKeywords: e.target.value })}
            />
          </FormField>
          <FormField label="SEO Description" className="md:col-span-2">
            <textarea
              className={inputClass}
              rows={2}
              value={mainInfo.seoDescription}
              onChange={(e) => onChange({ seoDescription: e.target.value })}
            />
          </FormField>
        </div>
      </FormSectionCard>

      {/* Policies & Product Info — hidden for now
      <FormSectionCard
        title="Policies & Product Info"
        subtitle="Returns, warranty, and manufacturer details"
        accent="emerald"
        icon={<span className="text-lg">📋</span>}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <FormField label="Manufacturer">
            <input
              className={inputClass}
              value={mainInfo.manufacturer}
              onChange={(e) => onChange({ manufacturer: e.target.value })}
            />
          </FormField>
          <FormField label="FSSAI Lic No">
            <input
              className={inputClass}
              value={mainInfo.fssaiLicNo}
              onChange={(e) => onChange({ fssaiLicNo: e.target.value })}
            />
          </FormField>
          <FormField label="Returnable">
            <select
              className={selectClass}
              value={mainInfo.isReturnable}
              onChange={(e) =>
                onChange({ isReturnable: e.target.value as "Yes" | "No" })
              }
            >
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          </FormField>
          <FormField label="Max Return Days">
            <input
              type="number"
              className={inputClass}
              value={mainInfo.maxReturnDays}
              onChange={(e) => onChange({ maxReturnDays: e.target.value })}
            />
          </FormField>
          <FormField label="Warranty Type">
            <select
              className={selectClass}
              value={mainInfo.warrantyType}
              onChange={(e) =>
                onChange({
                  warrantyType: e.target.value as ProductMainInfoForm["warrantyType"],
                })
              }
            >
              <option value="None">None</option>
              <option value="Warranty">Warranty</option>
              <option value="Guarantee">Guarantee</option>
            </select>
          </FormField>
          <FormField label="Warranty Duration">
            <input
              className={inputClass}
              value={mainInfo.warrantyDuration}
              onChange={(e) => onChange({ warrantyDuration: e.target.value })}
            />
          </FormField>
        </div>
      </FormSectionCard>
      */}
    </div>
  );
}
