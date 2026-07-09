import mongoose from "mongoose";
import { ProductVariant, ProductListingComputed } from "./types";

export function normalizeVariantArray(raw: unknown): ProductVariant[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeVariant);
}

export function normalizeVariant(v: any): ProductVariant {
  const mainImage = v.mainImage ?? v.image ?? undefined;
  const galleryImages = Array.isArray(v.galleryImages)
    ? v.galleryImages
    : mainImage && !v.galleryImages
      ? []
      : [];

  let price = Number(v.price);
  if (!Number.isFinite(price) || price < 0) price = 0;

  let stock = Number(v.stock);
  if (!Number.isFinite(stock) || stock < 0) stock = 0;

  const discPriceRaw = v.discPrice ?? v.offerPrice;
  const discPrice =
    discPriceRaw != null && discPriceRaw !== ""
      ? Number(discPriceRaw)
      : undefined;

  const variationType =
    String(v.variationType || v.name || "Standard").trim() || "Standard";
  const value =
    String(v.value || v.title || "Default").trim() || "Default";

  const cleaned: ProductVariant = {
    ...(v._id ? { _id: v._id } : {}),
    variationType,
    value,
    name: v.name || variationType,
    price,
    stock,
    status: v.status || "Available",
    barcode: Array.isArray(v.barcode) ? v.barcode : [],
    galleryImages,
  };

  if (mainImage) cleaned.mainImage = mainImage;
  if (discPrice != null && Number.isFinite(discPrice)) cleaned.discPrice = discPrice;
  if (v.compareAtPrice != null) cleaned.compareAtPrice = Number(v.compareAtPrice) || 0;
  if (v.wholesalePrice != null) cleaned.wholesalePrice = Number(v.wholesalePrice) || 0;
  if (v.purchasePrice != null) cleaned.purchasePrice = Number(v.purchasePrice) || 0;
  if (v.tieredPrices?.length) cleaned.tieredPrices = v.tieredPrices;
  if (v.sku && String(v.sku).trim()) cleaned.sku = String(v.sku).trim();
  if (v.rackNumber) cleaned.rackNumber = String(v.rackNumber).trim();

  if (!cleaned.discPrice || cleaned.discPrice === 0) {
    cleaned.discPrice = cleaned.price;
  }

  return cleaned;
}

export function getVariantDisplayPrice(v: ProductVariant): number {
  const disc = v.discPrice ?? 0;
  if (disc > 0) return disc;
  return v.price ?? 0;
}

export function getMinDisplayPrice(variants: ProductVariant[]): number {
  if (!variants.length) return 0;
  return Math.min(...variants.map(getVariantDisplayPrice));
}

export function getMaxDisplayPrice(variants: ProductVariant[]): number {
  if (!variants.length) return 0;
  return Math.max(...variants.map(getVariantDisplayPrice));
}

export function getTotalStock(variants: ProductVariant[]): number {
  return variants.reduce((acc, v) => acc + (Number(v.stock) || 0), 0);
}

/** Legacy products may still have stock on the root document before variant migration. */
export function getLegacyRootStock(product: any): number {
  const rootStock = Number(product?.stock);
  return Number.isFinite(rootStock) && rootStock > 0 ? rootStock : 0;
}

/** Total sellable stock from variants, with legacy root `stock` fallback. */
export function getProductDocTotalStock(product: any): number {
  const variantTotal = getTotalStock(variantsFromProductDoc(product));
  if (variantTotal > 0) return variantTotal;
  return getLegacyRootStock(product);
}

export function isProductDocInStock(product: any, allowNegative = false): boolean {
  if (allowNegative) return true;
  return getProductDocTotalStock(product) > 0;
}

export function getListingImage(variants: ProductVariant[]): string | null {
  if (!variants.length) return null;
  const inStock = variants.find((v) => (Number(v.stock) || 0) > 0 && v.mainImage);
  if (inStock?.mainImage) return inStock.mainImage;
  const withImage = variants.find((v) => v.mainImage);
  return withImage?.mainImage ?? null;
}

export function isInStock(variants: ProductVariant[], allowNegative = false): boolean {
  if (!variants.length) return false;
  if (allowNegative) return true;
  return variants.some((v) => (Number(v.stock) || 0) > 0);
}

function resolveLegacyRootDisplayPrice(product: any): number {
  const disc = Number(product?.discPrice) || 0;
  const price = Number(product?.price) || 0;
  if (disc > 0) return disc;
  return price > 0 ? price : 0;
}

function resolveLegacyRootMrp(product: any, displayPrice: number): number {
  const mrp =
    Number(product?.compareAtPrice) ||
    Number(product?.mrp) ||
    0;
  if (mrp > 0) return mrp;
  return displayPrice;
}

export function computeListing(
  variants: ProductVariant[],
  allowNegative = false,
  product?: any
): ProductListingComputed {
  const variantStock = getTotalStock(variants);
  const legacyStock = product ? getLegacyRootStock(product) : 0;
  const totalStock = Math.max(variantStock, legacyStock);

  let minPrice = getMinDisplayPrice(variants);
  let maxPrice = getMaxDisplayPrice(variants);

  // Legacy products may still store sell price on the root document while
  // placeholder variants keep price/discPrice at 0.
  if (minPrice <= 0 && product) {
    const rootDisplay = resolveLegacyRootDisplayPrice(product);
    if (rootDisplay > 0) {
      minPrice = rootDisplay;
      if (maxPrice <= 0) {
        maxPrice = resolveLegacyRootMrp(product, rootDisplay);
      }
    }
  }

  return {
    minPrice,
    maxPrice,
    totalStock,
    imageUrl: getListingImage(variants) ?? product?.mainImage ?? null,
    inStock: allowNegative || totalStock > 0,
  };
}

export function findVariantById(
  variants: ProductVariant[],
  variantId?: string | null
): ProductVariant | undefined {
  if (!variantId || !variants?.length) return undefined;
  return variants.find((v) => String(v._id) === String(variantId));
}

export function resolveVariantForCart(
  variants: ProductVariant[],
  variantId?: string | null,
  variationLabel?: string | null
): ProductVariant | undefined {
  if (variantId) {
    const byId = findVariantById(variants, variantId);
    if (byId) return byId;
  }
  if (variationLabel && variants.length) {
    const label = variationLabel.toLowerCase();
    const byLabel = variants.find(
      (v) =>
        String(v.value).toLowerCase() === label ||
        String(v.name).toLowerCase() === label ||
        `${v.variationType}:${v.value}`.toLowerCase() === label
    );
    if (byLabel) return byLabel;
  }
  if (variants.length === 1) return variants[0];
  return undefined;
}

export function resolveOrderItemVariantId(
  productDoc: any,
  hints: {
    variantId?: string | null;
    variationId?: string | null;
    sku?: string | null;
    variation?: string | null;
    productName?: string | null;
    unitPrice?: number | null;
  }
): string | undefined {
  const variants = variantsFromProductDoc(productDoc);
  if (!variants.length) return undefined;

  const explicit = hints.variantId || hints.variationId;
  if (explicit && mongoose.Types.ObjectId.isValid(String(explicit))) {
    const found = findVariantById(variants, String(explicit));
    if (found?._id) return String(found._id);
  }

  const sku = hints.sku ? String(hints.sku).trim() : "";
  if (sku && sku !== "NO-SKU") {
    const bySku = variants.find((v) => v.sku && String(v.sku).trim() === sku);
    if (bySku?._id) return String(bySku._id);
  }

  const productName = String(hints.productName || "");
  const sep = productName.lastIndexOf(" - ");
  if (sep > 0) {
    const label = productName.slice(sep + 3).trim().toLowerCase();
    const byLabel = variants.find((v) => {
      const value = String(v.value || "").toLowerCase();
      const name = String(v.name || v.variationType || "").toLowerCase();
      const composed = `${name}: ${value}`;
      return (
        value === label ||
        name === label ||
        composed === label ||
        composed.includes(label)
      );
    });
    if (byLabel?._id) return String(byLabel._id);
  }

  if (hints.variation) {
    const variationLabel = String(hints.variation).toLowerCase();
    const byVariation = variants.find((v) => {
      const value = String(v.value || "").toLowerCase();
      const name = String(v.name || v.variationType || "").toLowerCase();
      const composed = `${name}: ${value}`;
      return (
        value === variationLabel ||
        name === variationLabel ||
        composed === variationLabel
      );
    });
    if (byVariation?._id) return String(byVariation._id);
  }

  const unitPrice = Number(hints.unitPrice);
  if (Number.isFinite(unitPrice)) {
    const byPrice = variants.filter(
      (v) => Number(v.discPrice ?? v.price) === unitPrice
    );
    if (byPrice.length === 1 && byPrice[0]._id) return String(byPrice[0]._id);
  }

  if (variants.length === 1 && variants[0]._id) return String(variants[0]._id);
  return undefined;
}

export function variantToMongooseSubdoc(v: ProductVariant): Record<string, unknown> {
  const doc: Record<string, unknown> = {
    variationType: v.variationType,
    value: v.value,
    name: v.name || v.variationType,
    price: v.price,
    discPrice: v.discPrice ?? v.price,
    stock: v.stock ?? 0,
    status: v.status || "Available",
    barcode: v.barcode ?? [],
    galleryImages: v.galleryImages ?? [],
  };
  if (v._id && mongoose.Types.ObjectId.isValid(String(v._id))) {
    doc._id = v._id;
  }
  if (v.compareAtPrice != null) doc.compareAtPrice = v.compareAtPrice;
  if (v.wholesalePrice != null) doc.wholesalePrice = v.wholesalePrice;
  if (v.purchasePrice != null) doc.purchasePrice = v.purchasePrice;
  if (v.tieredPrices?.length) doc.tieredPrices = v.tieredPrices;
  if (v.sku) doc.sku = v.sku;
  if (v.rackNumber) doc.rackNumber = v.rackNumber;
  if (v.mainImage) {
    doc.mainImage = v.mainImage;
    doc.image = v.mainImage;
  }
  return doc;
}

export function variantsFromProductDoc(product: any): ProductVariant[] {
  const raw = product?.variations ?? product?.variants ?? [];
  return normalizeVariantArray(raw);
}

/** StockLedger requires a non-empty sku string. */
export function resolveLedgerSku(
  ...candidates: Array<string | null | undefined>
): string {
  for (const candidate of candidates) {
    const value = candidate != null ? String(candidate).trim() : "";
    if (value) return value;
  }
  return "NO-SKU";
}
