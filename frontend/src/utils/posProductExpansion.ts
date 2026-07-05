import { buildPosCartLineId, resolveVariantId } from "./posCartLineId";

function getVariationLabel(variation: any): string {
  return (
    variation?.value ||
    variation?.title ||
    variation?.name ||
    variation?.variationName ||
    "Variant"
  );
}

/** Expand catalog products for POS billing — one selectable row per variant. */
export function expandProductsForPOS(products: any[]): any[] {
  const expanded: any[] = [];

  products.forEach((product: any) => {
    const variations = Array.isArray(product.variations) ? product.variations : [];

    if (variations.length > 0) {
      variations.forEach((variation: any, index: number) => {
        const variantId =
          resolveVariantId(variation) || String(index);
        const label = getVariationLabel(variation);
        expanded.push({
          ...product,
          _id: buildPosCartLineId(String(product._id), variantId),
          originalProductId: product._id,
          productName: `${product.productName} - ${label}`,
          mainImage:
            variation.mainImage ||
            variation.image ||
            product.mainImage ||
            product.mainImageUrl,
          price: variation.price ?? product.price,
          compareAtPrice: variation.compareAtPrice || product.compareAtPrice,
          purchasePrice: variation.purchasePrice || product.purchasePrice,
          stock: Number(variation.stock) || 0,
          sku: variation.sku || product.sku,
          barcode: variation.barcode || product.barcode,
          isVariation: true,
          variationId: variantId,
          wholesalePrice: Number(
            variation.wholesalePrice || product.wholesalePrice || 0
          ),
        });
      });
      return;
    }

    expanded.push({
      ...product,
      originalProductId: product._id,
      wholesalePrice: product.wholesalePrice || 0,
    });
  });

  return expanded;
}
