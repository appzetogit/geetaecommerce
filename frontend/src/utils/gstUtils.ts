export const DEFAULT_GST_PERCENT = 5;

export function isGstDefined(value: unknown): boolean {
  if (value === undefined || value === null || value === "") return false;
  const num = Number(value);
  return Number.isFinite(num) && num >= 0;
}

/** Parse a GST percentage; returns fallback when missing or invalid. */
export function resolveGstPercent(
  value: unknown,
  fallback: number = DEFAULT_GST_PERCENT
): number {
  return isGstDefined(value) ? Number(value) : fallback;
}

/** POS/catalog: use product GST when set, otherwise default 5%. */
export function resolveGstFromProduct(
  productGst: unknown,
  fallback: number = DEFAULT_GST_PERCENT
): number {
  return resolveGstPercent(productGst, fallback);
}

/**
 * Editing an existing bill: keep GST from the order line at creation time.
 * Only fall back to product/default when the line has no stored GST.
 */
export function resolveGstForBillLine(
  lineGst: unknown,
  productGst?: unknown,
  fallback: number = DEFAULT_GST_PERCENT
): number {
  if (isGstDefined(lineGst)) return Number(lineGst);
  return resolveGstFromProduct(productGst, fallback);
}

export function formatGstPercent(
  value: unknown,
  fallback: number = DEFAULT_GST_PERCENT
): string {
  return String(resolveGstPercent(value, fallback));
}
