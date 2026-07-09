import { ProductVariantForm, defaultVariant } from "../types/productForm.types";
import FormSectionCard from "../components/FormSectionCard";
import VariantCard from "./VariantCard";

interface Props {
  variants: ProductVariantForm[];
  onChange: (variants: ProductVariantForm[]) => void;
  isFieldEnabled: (sectionId: string, fieldId: string) => boolean;
  productName: string;
  enabledVariantTypes: Array<{id: string, label: string}>;
}

export default function VariantListSection({ variants, onChange, isFieldEnabled, productName, enabledVariantTypes }: Props) {
  const addVariant = () => {
    onChange([...variants, defaultVariant()]);
  };

  const updateVariant = (index: number, variant: ProductVariantForm) => {
    const next = [...variants];
    next[index] = variant;
    onChange(next);
  };

  const removeVariant = (index: number) => {
    if (variants.length <= 1) return;
    onChange(variants.filter((_, i) => i !== index));
  };

  return (
    <FormSectionCard
      title="Product Variants"
      subtitle="Add pricing, stock, SKU, and images for each variant — all on this page"
      accent="violet"
      badge={`${variants.length} variant${variants.length === 1 ? "" : "s"}`}
      icon={<span className="text-lg">🎨</span>}
      action={
        <button
          type="button"
          onClick={addVariant}
          className="shrink-0 rounded-xl bg-white px-4 py-2 text-sm font-bold text-violet-700 shadow-md transition hover:scale-[1.02]"
        >
          + Add Variant
        </button>
      }
    >
      <div className="space-y-5">
        {variants.map((variant, index) => (
          <VariantCard
            key={index}
            index={index}
            variant={variant}
            allVariants={variants}
            canRemove={variants.length > 1}
            onChange={(v) => updateVariant(index, v)}
            onRemove={() => removeVariant(index)}
            isFieldEnabled={isFieldEnabled}
            productName={productName}
            enabledVariantTypes={enabledVariantTypes}
          />
        ))}
      </div>
    </FormSectionCard>
  );
}
