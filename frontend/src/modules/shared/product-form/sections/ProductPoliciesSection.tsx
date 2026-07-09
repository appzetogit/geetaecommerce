import { ProductMainInfoForm } from "../types/productForm.types";
import FormField, { inputClass, selectClass } from "../components/FormField";
import FormSectionCard from "../components/FormSectionCard";

interface Props {
  mainInfo: ProductMainInfoForm;
  onChange: (patch: Partial<ProductMainInfoForm>) => void;
  isFieldEnabled: (sectionId: string, fieldId: string) => boolean;
}

export default function ProductPoliciesSection({ mainInfo, onChange, isFieldEnabled }: Props) {
  const showTags = isFieldEnabled("basic", "tags");
  const showSeoTitle = isFieldEnabled("seo", "seo_title");
  const showSeoKeywords = isFieldEnabled("seo", "seo_keywords");
  const showSeoDescription = isFieldEnabled("seo", "seo_description");
  const showSeoImageAlt = isFieldEnabled("seo", "seo_image_alt");

  const showSeoSection = showTags || showSeoTitle || showSeoKeywords || showSeoDescription || showSeoImageAlt;

  const showManufacturer = isFieldEnabled("basic", "manufacturer");
  const showMadeIn = isFieldEnabled("basic", "made_in");
  const showFssai = isFieldEnabled("basic", "fssai");
  const showReturnable = isFieldEnabled("basic", "is_returnable");
  const showMaxQuantity = isFieldEnabled("basic", "total_allowed_quantity");

  const showPoliciesSection = showManufacturer || showMadeIn || showFssai || showReturnable || showMaxQuantity;

  return (
    <div className="space-y-6">
      {showSeoSection && (
        <FormSectionCard
          title="SEO & Discovery"
          subtitle="Help customers find this product in search"
          accent="rose"
          icon={<span className="text-lg">🔍</span>}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {showTags && (
              <FormField label="Tags" hint="Comma separated" className="md:col-span-2">
                <input
                  className={inputClass}
                  value={mainInfo.tags}
                  onChange={(e) => onChange({ tags: e.target.value })}
                  placeholder="organic, grocery, fresh"
                />
              </FormField>
            )}
            {showSeoTitle && (
              <FormField label="SEO Title">
                <input
                  className={inputClass}
                  value={mainInfo.seoTitle}
                  onChange={(e) => onChange({ seoTitle: e.target.value })}
                />
              </FormField>
            )}
            {showSeoKeywords && (
              <FormField label="SEO Keywords">
                <input
                  className={inputClass}
                  value={mainInfo.seoKeywords}
                  onChange={(e) => onChange({ seoKeywords: e.target.value })}
                />
              </FormField>
            )}
            {showSeoDescription && (
              <FormField label="SEO Description" className="md:col-span-2">
                <textarea
                  className={inputClass}
                  rows={2}
                  value={mainInfo.seoDescription}
                  onChange={(e) => onChange({ seoDescription: e.target.value })}
                />
              </FormField>
            )}
            {showSeoImageAlt && (
              <FormField label="SEO Image Alt" className="md:col-span-2">
                <input
                  className={inputClass}
                  value={mainInfo.seoImageAlt}
                  onChange={(e) => onChange({ seoImageAlt: e.target.value })}
                  placeholder="Alt text for SEO image"
                />
              </FormField>
            )}
          </div>
        </FormSectionCard>
      )}

      {showPoliciesSection && (
        <FormSectionCard
          title="Policies & Product Info"
          subtitle="Returns, warranty, and manufacturer details"
          accent="emerald"
          icon={<span className="text-lg">📋</span>}
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {showManufacturer && (
              <FormField label="Manufacturer">
                <input
                  className={inputClass}
                  value={mainInfo.manufacturer}
                  onChange={(e) => onChange({ manufacturer: e.target.value })}
                />
              </FormField>
            )}
            {showMadeIn && (
              <FormField label="Made In">
                <input
                  className={inputClass}
                  value={mainInfo.madeIn}
                  onChange={(e) => onChange({ madeIn: e.target.value })}
                />
              </FormField>
            )}
            {showFssai && (
              <FormField label="FSSAI Lic No">
                <input
                  className={inputClass}
                  value={mainInfo.fssaiLicNo}
                  onChange={(e) => onChange({ fssaiLicNo: e.target.value })}
                />
              </FormField>
            )}
            {showReturnable && (
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
            )}
            {showReturnable && mainInfo.isReturnable === "Yes" && (
              <FormField label="Max Return Days">
                <input
                  type="number"
                  className={inputClass}
                  value={mainInfo.maxReturnDays}
                  onChange={(e) => onChange({ maxReturnDays: e.target.value })}
                />
              </FormField>
            )}
            {showMaxQuantity && (
              <FormField label="Max Allowed Qty">
                <input
                  type="number"
                  className={inputClass}
                  value={mainInfo.totalAllowedQuantity}
                  onChange={(e) => onChange({ totalAllowedQuantity: e.target.value })}
                />
              </FormField>
            )}
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
      )}
    </div>
  );
}
