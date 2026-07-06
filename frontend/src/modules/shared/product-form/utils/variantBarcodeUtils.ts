import { ProductVariantForm } from "../types/productForm.types";

export function normalizeBarcode(code: string): string {
  return code.trim();
}

export function getBarcodesUsedByOtherVariants(
  variants: ProductVariantForm[],
  excludeIndex: number
): Set<string> {
  const used = new Set<string>();
  variants.forEach((variant, index) => {
    if (index === excludeIndex) return;
    (variant.barcode || []).forEach((code) => {
      const normalized = normalizeBarcode(code);
      if (normalized) used.add(normalized);
    });
  });
  return used;
}

export function isBarcodeUsedByOtherVariant(
  variants: ProductVariantForm[],
  excludeIndex: number,
  code: string
): boolean {
  const normalized = normalizeBarcode(code);
  if (!normalized) return false;
  return getBarcodesUsedByOtherVariants(variants, excludeIndex).has(normalized);
}

export function findDuplicateBarcodeMessage(
  variants: ProductVariantForm[]
): string | null {
  const seen = new Map<string, number>();

  for (let i = 0; i < variants.length; i++) {
    for (const code of variants[i].barcode || []) {
      const normalized = normalizeBarcode(code);
      if (!normalized) continue;

      const firstVariant = seen.get(normalized);
      if (firstVariant !== undefined) {
        return `Barcode "${normalized}" is already used on Variant ${firstVariant} and Variant ${i + 1}. Each variant must have a unique barcode.`;
      }
      seen.set(normalized, i + 1);
    }
  }

  return null;
}
