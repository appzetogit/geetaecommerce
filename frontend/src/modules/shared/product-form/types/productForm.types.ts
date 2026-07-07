export interface ProductVariantForm {
  _id?: string;
  variationType: string;
  value: string;
  price: string;
  compareAtPrice: string;
  discPrice: string;
  wholesalePrice: string;
  purchasePrice: string;
  stock: string;
  sku: string;
  barcode: string[];
  rackNumber: string;
  mainImage: string;
  galleryImages: string[];
  status: "Available" | "Sold out" | "In stock";
  attributes?: Record<string, string>;
}

export interface ProductMainInfoForm {
  productName: string;
  video: string;
  smallDescription: string;
  description: string;
  headerCategory: string;
  category: string;
  subcategory: string;
  subSubCategory: string;
  brand: string;
  gst: string;
  tax: string;
  hsnCode: string;
  publish: "Yes" | "No";
  popular: "Yes" | "No";
  dealOfDay: "Yes" | "No";
  seoTitle: string;
  seoKeywords: string;
  seoDescription: string;
  seoImageAlt: string;
  tags: string;
  manufacturer: string;
  madeIn: string;
  marketer: string;
  shelfLife: string;
  mfgDate: string;
  expiryDate: string;
  pack: string;
  fssaiLicNo: string;
  isReturnable: "Yes" | "No";
  maxReturnDays: string;
  returnPolicyText: string;
  warrantyType: "None" | "Warranty" | "Guarantee";
  warrantyDuration: string;
  totalAllowedQuantity: string;
  lowStockQuantity: string;
  deliveryTime: string;
  commission: string;
  isShopByStoreOnly: "Yes" | "No";
  shopId: string;
  seller: string;
}

export interface ProductFormState {
  mainInfo: ProductMainInfoForm;
  variants: ProductVariantForm[];
}

export const defaultVariant = (): ProductVariantForm => ({
  variationType: "Standard",
  value: "Default",
  price: "",
  compareAtPrice: "",
  discPrice: "0",
  wholesalePrice: "",
  purchasePrice: "",
  stock: "0",
  sku: "",
  barcode: [],
  rackNumber: "",
  mainImage: "",
  galleryImages: [],
  status: "Available",
  attributes: {},
});

export const defaultMainInfo = (overrides?: Partial<ProductMainInfoForm>): ProductMainInfoForm => ({
  productName: "",
  video: "",
  smallDescription: "",
  description: "",
  headerCategory: "",
  category: "",
  subcategory: "",
  subSubCategory: "",
  brand: "",
  gst: "5",
  tax: "",
  hsnCode: "",
  publish: "No",
  popular: "No",
  dealOfDay: "No",
  seoTitle: "",
  seoKeywords: "",
  seoDescription: "",
  seoImageAlt: "",
  tags: "",
  manufacturer: "",
  madeIn: "",
  marketer: "",
  shelfLife: "",
  mfgDate: "",
  expiryDate: "",
  pack: "",
  fssaiLicNo: "",
  isReturnable: "No",
  maxReturnDays: "",
  returnPolicyText: "",
  warrantyType: "None",
  warrantyDuration: "",
  totalAllowedQuantity: "10",
  lowStockQuantity: "5",
  deliveryTime: "",
  commission: "",
  isShopByStoreOnly: "No",
  shopId: "",
  seller: "",
  ...overrides,
});

export interface CreateProductPayload {
  productName: string;
  video?: string;
  smallDescription?: string;
  description?: string;
  headerCategoryId?: string;
  categoryId?: string;
  subcategoryId?: string;
  subSubCategoryId?: string;
  brandId?: string;
  gst?: number;
  taxId?: string;
  hsnCode?: string;
  publish: boolean;
  popular: boolean;
  dealOfDay: boolean;
  seoTitle?: string;
  seoKeywords?: string;
  seoDescription?: string;
  seoImageAlt?: string;
  tags?: string[];
  manufacturer?: string;
  madeIn?: string;
  marketer?: string;
  shelfLife?: string;
  mfgDate?: string;
  expiryDate?: string;
  pack?: string;
  fssaiLicNo?: string;
  isReturnable: boolean;
  maxReturnDays?: number;
  returnPolicyText?: string;
  warrantyType?: "None" | "Warranty" | "Guarantee";
  warrantyDuration?: string;
  totalAllowedQuantity?: number;
  lowStockQuantity?: number;
  deliveryTime?: string;
  commission?: number;
  isShopByStoreOnly?: boolean;
  shopId?: string;
  seller?: string;
  variants: Array<{
    _id?: string;
    variationType: string;
    value: string;
    price: number;
    discPrice?: number;
    compareAtPrice?: number;
    wholesalePrice?: number;
    purchasePrice?: number;
    stock: number;
    sku?: string;
    barcode?: string[];
    rackNumber?: string;
    mainImage?: string;
    galleryImages?: string[];
    status?: string;
    attributes?: Record<string, string>;
  }>;
}
