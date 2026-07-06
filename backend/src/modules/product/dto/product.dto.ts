import { z } from "zod";

const objectIdRegex = /^[a-fA-F0-9]{24}$/;

export const tieredPriceSchema = z.object({
  minQty: z.coerce.number().min(1),
  price: z.coerce.number().min(0),
});

export const variantSchema = z.object({
  _id: z.string().regex(objectIdRegex).optional(),
  variationType: z.string().min(1, "Variant type is required"),
  value: z.string().min(1, "Variant value is required"),
  name: z.string().optional(),
  price: z.coerce.number().min(0, "Price must be non-negative"),
  discPrice: z.coerce.number().min(0).optional(),
  compareAtPrice: z.coerce.number().min(0).optional(),
  wholesalePrice: z.coerce.number().min(0).optional(),
  purchasePrice: z.coerce.number().min(0).optional(),
  tieredPrices: z.array(tieredPriceSchema).optional(),
  stock: z.coerce.number().min(0).default(0),
  status: z.enum(["Available", "Sold out", "In stock"]).optional(),
  sku: z.string().optional(),
  barcode: z.array(z.string()).optional(),
  rackNumber: z.string().optional(),
  mainImage: z.string().optional(),
  galleryImages: z.array(z.string()).optional(),
  image: z.string().optional(),
});

const productPayloadShape = {
  productName: z.string().min(1, "Product name is required"),
  smallDescription: z.string().optional(),
  description: z.string().optional(),
  headerCategoryId: z.string().regex(objectIdRegex).optional().or(z.literal("")),
  category: z.string().regex(objectIdRegex).optional().or(z.literal("")),
  categoryId: z.string().regex(objectIdRegex).optional().or(z.literal("")),
  subcategory: z.string().regex(objectIdRegex).optional().or(z.literal("")),
  subcategoryId: z.string().regex(objectIdRegex).optional().or(z.literal("")),
  subSubCategory: z.string().optional(),
  subSubCategoryId: z.string().optional(),
  brand: z.string().regex(objectIdRegex).optional().or(z.literal("")),
  brandId: z.string().regex(objectIdRegex).optional().or(z.literal("")),
  gst: z.coerce.number().min(0).optional(),
  taxId: z.string().regex(objectIdRegex).optional().or(z.literal("")),
  tax: z.string().regex(objectIdRegex).optional().or(z.literal("")),
  hsnCode: z.string().optional(),
  publish: z.union([z.boolean(), z.literal("true"), z.literal("false")]).optional(),
  popular: z.union([z.boolean(), z.literal("true"), z.literal("false")]).optional(),
  dealOfDay: z.union([z.boolean(), z.literal("true"), z.literal("false")]).optional(),
  seoTitle: z.string().optional(),
  seoKeywords: z.string().optional(),
  seoDescription: z.string().optional(),
  seoImageAlt: z.string().optional(),
  tags: z.union([z.array(z.string()), z.string()]).optional(),
  manufacturer: z.string().optional(),
  madeIn: z.string().optional(),
  marketer: z.string().optional(),
  shelfLife: z.string().optional(),
  pack: z.string().optional(),
  fssaiLicNo: z.string().optional(),
  isReturnable: z.union([z.boolean(), z.literal("true"), z.literal("false")]).optional(),
  maxReturnDays: z.coerce.number().min(0).optional(),
  returnPolicyText: z.string().optional(),
  warrantyType: z.enum(["None", "Warranty", "Guarantee"]).optional(),
  warrantyDuration: z.string().optional(),
  totalAllowedQuantity: z.coerce.number().min(0).optional(),
  lowStockQuantity: z.coerce.number().min(0).optional(),
  deliveryTime: z.string().optional(),
  commission: z.coerce.number().min(0).optional(),
  isShopByStoreOnly: z.union([z.boolean(), z.literal("true"), z.literal("false")]).optional(),
  shopId: z.string().regex(objectIdRegex).optional().or(z.literal("")),
  seller: z.string().regex(objectIdRegex).optional(),
  sellerId: z.string().regex(objectIdRegex).optional(),
  status: z.enum(["Active", "Inactive", "Pending", "Rejected"]).optional(),
  variants: z.array(variantSchema).min(1, "At least one variant is required").optional(),
  variations: z.array(variantSchema).min(1).optional(),
};

function refineVariants(
  data: { variants?: z.infer<typeof variantSchema>[]; variations?: z.infer<typeof variantSchema>[] },
  ctx: z.RefinementCtx,
  requireAtLeastOne: boolean
) {
  const variants = data.variants ?? data.variations;
  if (!variants || variants.length < 1) {
    if (requireAtLeastOne) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one variant is required",
        path: ["variants"],
      });
    }
    return;
  }
  variants.forEach((v, i) => {
    const disc = v.discPrice ?? 0;
    if (disc > v.price) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Discounted price cannot exceed price for variant ${i + 1}`,
        path: ["variants", i, "discPrice"],
      });
    }
    if (v.compareAtPrice != null && disc > v.compareAtPrice) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Discounted price cannot exceed MRP for variant ${i + 1}`,
        path: ["variants", i, "discPrice"],
      });
    }
  });
}

const productPayloadSchema = z.object(productPayloadShape);

export const createProductSchema = productPayloadSchema.superRefine((data, ctx) => {
  // Variants are not required at the DTO level — the normalizer will auto-generate
  // a default variant from root-level pricing (price, stock, images) if none are provided.
  refineVariants(data, ctx, false);
});


export const updateProductSchema = productPayloadSchema.partial().superRefine((data, ctx) => {
  if (data.variants !== undefined || data.variations !== undefined) {
    refineVariants(data, ctx, true);
  }
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type VariantInput = z.infer<typeof variantSchema>;
