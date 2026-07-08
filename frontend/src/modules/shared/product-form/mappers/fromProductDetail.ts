import {
  defaultMainInfo,
  defaultVariant,
  ProductFormState,
} from "../types/productForm.types";

export function fromProductDetail(product: any): ProductFormState {
  const variantsRaw = product?.variants ?? product?.variations ?? [];
  const variants =
    variantsRaw.length > 0
      ? variantsRaw.map((v: any) => ({
          _id: v._id,
          variationType: v.variationType || v.name || "Standard",
          value: v.value || v.title || "Default",
          price: String(v.price ?? ""),
          compareAtPrice: String(v.compareAtPrice || v.price || ""),
          discPrice: String(v.discPrice && v.discPrice < v.price ? v.discPrice : ""),
          wholesalePrice: String(v.wholesalePrice ?? ""),
          purchasePrice: String(v.purchasePrice ?? ""),
          stock: String(v.stock ?? "0"),
          sku: v.sku || "",
          barcode: v.barcode || [],
          rackNumber: v.rackNumber || "",
          mainImage: v.mainImage || v.image || "",
          galleryImages: v.galleryImages || [],
          status: v.status || "Available",
        }))
      : [defaultVariant()];

  return {
    mainInfo: defaultMainInfo({
      productName: product.productName || "",
      video: product.video || product.videoUrl || "",
      smallDescription: product.smallDescription || "",
      description: product.description || "",
      headerCategory:
        product.headerCategoryId?._id ||
        product.headerCategoryId ||
        "",
      category: product.category?._id || product.category || "",
      subcategory:
        product.subcategory?._id || product.subcategory || "",
      subSubCategory: product.subSubCategory || "",
      brand: product.brand?._id || product.brand || "",
      gst: String(product.gst ?? "5"),
      tax: product.tax?._id || product.tax || "",
      hsnCode: product.hsnCode || "",
      publish: product.publish ? "Yes" : "No",
      popular: product.popular ? "Yes" : "No",
      dealOfDay: product.dealOfDay ? "Yes" : "No",
      seoTitle: product.seoTitle || "",
      seoKeywords: product.seoKeywords || "",
      seoDescription: product.seoDescription || "",
      seoImageAlt: product.seoImageAlt || "",
      tags: Array.isArray(product.tags) ? product.tags.join(", ") : "",
      manufacturer: product.manufacturer || "",
      madeIn: product.madeIn || "",
      marketer: product.marketer || "",
      shelfLife: product.shelfLife || "",
      mfgDate: product.mfgDate || "",
      expiryDate: product.expiryDate || "",
      pack: product.pack || "",
      fssaiLicNo: product.fssaiLicNo || "",
      isReturnable: product.isReturnable ? "Yes" : "No",
      maxReturnDays: product.maxReturnDays
        ? String(product.maxReturnDays)
        : "",
      returnPolicyText: product.returnPolicyText || "",
      warrantyType: product.warrantyType || "None",
      warrantyDuration: product.warrantyDuration || "",
      totalAllowedQuantity: String(product.totalAllowedQuantity ?? "10"),
      lowStockQuantity: String(product.lowStockQuantity ?? "5"),
      deliveryTime: product.deliveryTime || "",
      commission: product.commission ? String(product.commission) : "",
      isShopByStoreOnly: product.isShopByStoreOnly ? "Yes" : "No",
      shopId: product.shopId?._id || product.shopId || "",
      seller: product.seller?._id || product.seller || "",
    }),
    variants,
  };
}
