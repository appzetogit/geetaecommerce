/** Resolve a variant subdocument id from API / mongoose shapes. */
export function resolveVariantId(variation: {
  _id?: unknown;
  id?: unknown;
  variationId?: unknown;
} | null | undefined): string {
  const raw = variation?._id ?? variation?.id ?? variation?.variationId;
  return raw != null && String(raw).trim() ? String(raw).trim() : "";
}

/** Extract variant label from POS display names like "Product - kg". */
export function getVariantLabelFromProductName(productName?: string | null): string {
  const name = String(productName || "").trim();
  const sep = name.lastIndexOf(" - ");
  if (sep > 0) return name.slice(sep + 3).trim();
  return "";
}

/** Stable POS cart line id: parent product id, or `parentId-variantId` for variants. */
export function buildPosCartLineId(
  productId: string,
  variationId?: string | null
): string {
  const parentId = String(productId || "").trim();
  if (!parentId) return "";
  const variantId = variationId ? String(variationId).trim() : "";
  return variantId ? `${parentId}-${variantId}` : parentId;
}

export function getParentProductIdFromLineId(lineId: string): string {
  const raw = String(lineId || "").trim();
  const atSku = raw.indexOf("@sku:");
  if (atSku > 0) return raw.slice(0, atSku);
  const atLabel = raw.indexOf("@label:");
  if (atLabel > 0) return raw.slice(0, atLabel);
  const dash = raw.indexOf("-");
  if (dash === 24 && /^[a-f\d]{24}-/i.test(raw)) return raw.slice(0, 24);
  if (dash > 0) return raw.slice(0, dash);
  return raw;
}

/** Match an order line back to a catalog variant when variantId was not persisted. */
export function resolveVariantFromOrderLine(item: {
  variationId?: string | null;
  variantId?: string | null;
  variation?: string | null;
  sku?: string | null;
  productName?: string | null;
  unitPrice?: number | null;
  product?: { variations?: any[] } | null;
}): string {
  const existing = item.variationId || item.variantId
    ? String(item.variationId || item.variantId).trim()
    : "";
  if (existing && /^[a-f\d]{24}$/i.test(existing)) return existing;

  const variations = Array.isArray(item.product?.variations)
    ? item.product!.variations!
    : [];
  if (!variations.length) return "";

  const sku = item.sku ? String(item.sku).trim() : "";
  if (sku) {
    const bySku = variations.find(
      (v) => v.sku && String(v.sku).trim() === sku
    );
    const id = resolveVariantId(bySku);
    if (id) return id;
  }

  const labelFromName = getVariantLabelFromProductName(item.productName);
  if (labelFromName) {
    const lower = labelFromName.toLowerCase();
    const byLabel = variations.find((v) => {
      const value = String(v.value || "").toLowerCase();
      const name = String(v.name || v.variationType || "").toLowerCase();
      const composed = `${name}: ${value}`;
      return (
        value === lower ||
        name === lower ||
        composed === lower ||
        composed.includes(lower)
      );
    });
    const id = resolveVariantId(byLabel);
    if (id) return id;
  }

  if (item.variation) {
    const variationLabel = String(item.variation).toLowerCase();
    const byVariation = variations.find((v) => {
      const value = String(v.value || "").toLowerCase();
      const name = String(v.name || v.variationType || "").toLowerCase();
      const composed = `${name}: ${value}`;
      return (
        value === variationLabel ||
        name === variationLabel ||
        composed === variationLabel
      );
    });
    const id = resolveVariantId(byVariation);
    if (id) return id;
  }

  const unitPrice = Number(item.unitPrice);
  if (Number.isFinite(unitPrice)) {
    const byPrice = variations.filter((v) => {
      const p = Number(v.discPrice ?? v.price);
      return p === unitPrice;
    });
    if (byPrice.length === 1) {
      const id = resolveVariantId(byPrice[0]);
      if (id) return id;
    }
  }

  return "";
}

export function getCartLineId(item: {
  _id?: string;
  variationId?: string | null;
  originalProductId?: string | null;
  sku?: string | null;
  productName?: string | null;
}): string {
  const rawId = String(item._id || "").trim();
  const parentId =
    (item.originalProductId && String(item.originalProductId).trim()) ||
    getParentProductIdFromLineId(rawId);

  const variationId = item.variationId ? String(item.variationId).trim() : "";
  if (variationId && parentId) {
    return buildPosCartLineId(parentId, variationId);
  }

  const sku = item.sku ? String(item.sku).trim() : "";
  if (sku && parentId) {
    return `${parentId}@sku:${sku}`;
  }

  const label = getVariantLabelFromProductName(item.productName);
  if (label && parentId) {
    return `${parentId}@label:${label.toLowerCase()}`;
  }

  if (rawId && parentId && rawId !== parentId) {
    return rawId;
  }

  return rawId || parentId;
}

/** Ensure cart rows use unique line ids and retain parent product reference for checkout. */
export function normalizePosCartItem<T extends Record<string, any>>(item: T): T {
  const variationId = item.variationId ? String(item.variationId).trim() : "";
  const rawId = String(item._id || "").trim();
  const parentId =
    (item.originalProductId && String(item.originalProductId).trim()) ||
    (variationId || rawId.includes("@")
      ? getParentProductIdFromLineId(rawId)
      : rawId);

  const draft = {
    ...item,
    ...(parentId ? { originalProductId: parentId } : {}),
    ...(variationId
      ? { variationId, isVariation: item.isVariation ?? true }
      : {}),
  };

  return {
    ...draft,
    _id: getCartLineId(draft),
  };
}
