import {
  CreateProductPayload,
  ProductFormState,
} from "../types/productForm.types";

export function toCreatePayload(state: ProductFormState): CreateProductPayload {
  const { mainInfo, variants } = state;
  const tags = mainInfo.tags
    ? mainInfo.tags.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  return {
    productName: mainInfo.productName.trim(),
    video: mainInfo.video || undefined,
    smallDescription: mainInfo.smallDescription || undefined,
    description: mainInfo.description || undefined,
    headerCategoryId: mainInfo.headerCategory || undefined,
    categoryId: mainInfo.category || undefined,
    subcategoryId: mainInfo.subcategory || undefined,
    subSubCategoryId: mainInfo.subSubCategory || undefined,
    brandId: mainInfo.brand || undefined,
    gst: mainInfo.gst ? Number(mainInfo.gst) : undefined,
    taxId: mainInfo.tax || undefined,
    hsnCode: mainInfo.hsnCode || undefined,
    publish: mainInfo.publish === "Yes",
    popular: mainInfo.popular === "Yes",
    dealOfDay: mainInfo.dealOfDay === "Yes",
    seoTitle: mainInfo.seoTitle || undefined,
    seoKeywords: mainInfo.seoKeywords || undefined,
    seoDescription: mainInfo.seoDescription || undefined,
    seoImageAlt: mainInfo.seoImageAlt || undefined,
    tags,
    manufacturer: mainInfo.manufacturer || undefined,
    madeIn: mainInfo.madeIn || undefined,
    marketer: mainInfo.marketer || undefined,
    shelfLife: mainInfo.shelfLife || undefined,
    mfgDate: mainInfo.mfgDate || undefined,
    expiryDate: mainInfo.expiryDate || undefined,
    pack: mainInfo.pack || undefined,
    fssaiLicNo: mainInfo.fssaiLicNo || undefined,
    isReturnable: mainInfo.isReturnable === "Yes",
    maxReturnDays: mainInfo.maxReturnDays
      ? Number(mainInfo.maxReturnDays)
      : undefined,
    returnPolicyText: mainInfo.returnPolicyText || undefined,
    warrantyType: mainInfo.warrantyType,
    warrantyDuration: mainInfo.warrantyDuration || undefined,
    totalAllowedQuantity: mainInfo.totalAllowedQuantity
      ? Number(mainInfo.totalAllowedQuantity)
      : undefined,
    lowStockQuantity: mainInfo.lowStockQuantity
      ? Number(mainInfo.lowStockQuantity)
      : undefined,
    deliveryTime: mainInfo.deliveryTime || undefined,
    commission: mainInfo.commission ? Number(mainInfo.commission) : undefined,
    isShopByStoreOnly: mainInfo.isShopByStoreOnly === "Yes",
    shopId: mainInfo.shopId || undefined,
    seller: mainInfo.seller || undefined,
    variants: variants.map((v) => {
      const formMrp = Number(v.compareAtPrice) || Number(v.price) || 0;
      const formPrice = Number(v.price) || 0;
      const formOffer = v.discPrice ? Number(v.discPrice) : undefined;
      return {
        _id: v._id,
        variationType: v.variationType.trim() || "Standard",
        value: v.value.trim() || "Default",
        price: formPrice,
        compareAtPrice: formMrp,
        discPrice: formOffer,
        wholesalePrice: v.wholesalePrice ? Number(v.wholesalePrice) : undefined,
        purchasePrice: v.purchasePrice ? Number(v.purchasePrice) : undefined,
        stock: Number(v.stock) || 0,
        sku: v.sku || undefined,
        barcode: v.barcode,
        rackNumber: v.rackNumber || undefined,
        mainImage: v.mainImage || undefined,
        galleryImages: v.galleryImages,
        status: v.status,
      };
    }),
  };
}
