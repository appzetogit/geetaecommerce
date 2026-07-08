import mongoose from "mongoose";
import Product from "../../models/Product";
import Seller from "../../models/Seller";
import Category from "../../models/Category";
import { createProductSchema } from "./dto/product.dto";
import {
  normalizeCreatePayload,
  NormalizedProductPayload,
} from "./productNormalizer";
import { ProductWritePolicy } from "./types";
import { variantToMongooseSubdoc } from "./variantHelpers";
import { toDetail } from "./productReadMapper";

async function resolveAdminSeller(sellerId?: string): Promise<string> {
  if (sellerId && mongoose.Types.ObjectId.isValid(sellerId)) {
    const seller = await Seller.findById(sellerId);
    if (!seller) throw new Error("Seller not found");
    return sellerId;
  }

  let adminSeller = await Seller.findOne({
    $or: [
      { email: "admin-store@geetastores.com" },
      { mobile: "9999999999" },
    ],
  });

  if (!adminSeller) {
    adminSeller = await Seller.create({
      sellerName: "Geeta Stores Admin",
      storeName: "Geeta Stores Admin Store",
      email: "admin-store@geetastores.com",
      mobile: "9999999999",
      password: "AdminStore@123",
      address: "Geeta Stores HQ",
      city: "Admin City",
      category: "Admin",
      commission: 0,
      status: "Approved",
      requireProductApproval: false,
      location: { type: "Point", coordinates: [0, 0] },
    });
  }

  return String(adminSeller._id);
}

async function resolveCategoryId(
  categoryId?: string,
  isShopByStoreOnly?: boolean
): Promise<string | undefined> {
  if (categoryId) return categoryId;
  if (isShopByStoreOnly) return undefined;

  const defaultCategory = await Category.findOne({ status: "Active" })
    .sort({ createdAt: 1 })
    .select("_id")
    .lean();
  return defaultCategory?._id ? String(defaultCategory._id) : undefined;
}

async function inheritHeaderCategoryId(
  categoryId?: string,
  headerCategoryId?: string
): Promise<string | undefined> {
  if (headerCategoryId) return headerCategoryId;
  if (!categoryId) return undefined;
  try {
    const cat = await Category.findById(categoryId)
      .select("headerCategoryId")
      .lean();
    return cat?.headerCategoryId ? String(cat.headerCategoryId) : undefined;
  } catch {
    return undefined;
  }
}

function buildMongooseDoc(
  payload: NormalizedProductPayload,
  sellerId: string
): Record<string, unknown> {
  const variations = payload.variations.map(variantToMongooseSubdoc);

  const doc: Record<string, unknown> = {
    productName: payload.productName,
    seller: sellerId,
    variations,
    publish: payload.publish,
    popular: payload.popular,
    dealOfDay: payload.dealOfDay,
    status: payload.status,
    isReturnable: payload.isReturnable,
    tags: payload.tags,
    requiresApproval: false,
    rating: 0,
    reviewsCount: 0,
    discount: 0,
    isShopByStoreOnly: payload.isShopByStoreOnly,
  };

  if (payload.smallDescription) doc.smallDescription = payload.smallDescription;
  if (payload.description) doc.description = payload.description;
  if (payload.category) doc.category = payload.category;
  if (payload.subcategory) doc.subcategory = payload.subcategory;
  if (payload.subSubCategory) doc.subSubCategory = payload.subSubCategory;
  if (payload.headerCategoryId) doc.headerCategoryId = payload.headerCategoryId;
  if (payload.brand) doc.brand = payload.brand;
  if (payload.gst != null) doc.gst = payload.gst;
  if (payload.tax) doc.tax = payload.tax;
  if (payload.hsnCode) doc.hsnCode = payload.hsnCode;
  if (payload.seoTitle) doc.seoTitle = payload.seoTitle;
  if (payload.seoKeywords) doc.seoKeywords = payload.seoKeywords;
  if (payload.seoDescription) doc.seoDescription = payload.seoDescription;
  if (payload.seoImageAlt) doc.seoImageAlt = payload.seoImageAlt;
  if (payload.manufacturer) doc.manufacturer = payload.manufacturer;
  if (payload.madeIn) doc.madeIn = payload.madeIn;
  if (payload.marketer) doc.marketer = payload.marketer;
  if (payload.shelfLife) doc.shelfLife = payload.shelfLife;
  if (payload.pack) doc.pack = payload.pack;
  if (payload.fssaiLicNo) doc.fssaiLicNo = payload.fssaiLicNo;
  if (payload.maxReturnDays != null) doc.maxReturnDays = payload.maxReturnDays;
  if (payload.returnPolicyText) doc.returnPolicyText = payload.returnPolicyText;
  if (payload.warrantyType) doc.warrantyType = payload.warrantyType;
  if (payload.warrantyDuration) doc.warrantyDuration = payload.warrantyDuration;
  if (payload.totalAllowedQuantity != null)
    doc.totalAllowedQuantity = payload.totalAllowedQuantity;
  if (payload.lowStockQuantity != null)
    doc.lowStockQuantity = payload.lowStockQuantity;
  if (payload.deliveryTime) doc.deliveryTime = payload.deliveryTime;
  if (payload.commission != null) doc.commission = payload.commission;
  if (payload.shopId) doc.shopId = payload.shopId;

  return doc;
}

export class ProductWriteService {
  static async createProduct(
    body: Record<string, unknown>,
    policy: ProductWritePolicy
  ) {
    const zodResult = createProductSchema.safeParse(body);
    if (!zodResult.success) {
      const message = zodResult.error.issues.map((e) => e.message).join(", ");
      throw new ProductWriteError(message, 400);
    }

    const normalized = normalizeCreatePayload(body, {
      publish: policy.defaultPublish,
    });

    const payloadBarcodes: string[] = [];
    for (const variant of normalized.variations) {
      if (Array.isArray(variant.barcode)) {
        for (const bc of variant.barcode) {
          const trimmed = String(bc).trim();
          if (trimmed) payloadBarcodes.push(trimmed);
        }
      }
    }

    const duplicatesInPayload = payloadBarcodes.filter((bc, idx) => payloadBarcodes.indexOf(bc) !== idx);
    if (duplicatesInPayload.length > 0) {
      throw new ProductWriteError(
        `Duplicate barcode(s) found across variants: ${Array.from(new Set(duplicatesInPayload)).join(", ")}`,
        400
      );
    }

    if (payloadBarcodes.length > 0) {
      const otherProduct = await Product.findOne({
        $or: [
          { barcode: { $in: payloadBarcodes } },
          { "variations.barcode": { $in: payloadBarcodes } }
        ]
      });
      if (otherProduct) {
        throw new ProductWriteError(
          `Barcode is already in use by another product: "${otherProduct.productName}"`,
          400
        );
      }
    }

    if (!normalized.productName) {
      throw new ProductWriteError("Product name is required", 400);
    }

    if (!normalized.isShopByStoreOnly && !normalized.category) {
      normalized.category = await resolveCategoryId(undefined, false);
    }

    if (!normalized.isShopByStoreOnly && !normalized.category) {
      throw new ProductWriteError("Category is required", 400);
    }

    let sellerId: string;
    if (policy.role === "seller") {
      if (!policy.sellerId) {
        throw new ProductWriteError("Seller authentication required", 401);
      }
      if (
        normalized.seller &&
        normalized.seller !== policy.sellerId
      ) {
        throw new ProductWriteError(
          "You can only create products for your own account",
          403
        );
      }
      sellerId = policy.sellerId;
    } else {
      sellerId = await resolveAdminSeller(
        policy.allowSellerAssignment ? normalized.seller : undefined
      );
    }

    normalized.headerCategoryId = await inheritHeaderCategoryId(
      normalized.category,
      normalized.headerCategoryId
    );

    const doc = buildMongooseDoc(normalized, sellerId);
    const product = await Product.create(doc);
    return toDetail(product);
  }

  static async updateProduct(
    productId: string,
    body: Record<string, unknown>,
    policy: ProductWritePolicy
  ) {
    const query: Record<string, unknown> = { _id: productId };
    if (policy.role === "seller" && policy.sellerId) {
      query.seller = policy.sellerId;
    }

    const existing = await Product.findOne(query);
    if (!existing) {
      throw new ProductWriteError("Product not found", 404);
    }

    const mergedBody: Record<string, unknown> = {
      ...existing.toObject(),
      ...body,
      productName: body.productName ?? existing.productName,
    };

    if (!body.variants && !body.variations) {
      mergedBody.variations = existing.variations;
    }

    const normalized = normalizeCreatePayload(mergedBody, {
      publish: existing.publish,
    });

    const payloadBarcodes: string[] = [];
    for (const variant of normalized.variations) {
      if (Array.isArray(variant.barcode)) {
        for (const bc of variant.barcode) {
          const trimmed = String(bc).trim();
          if (trimmed) payloadBarcodes.push(trimmed);
        }
      }
    }

    const duplicatesInPayload = payloadBarcodes.filter((bc, idx) => payloadBarcodes.indexOf(bc) !== idx);
    if (duplicatesInPayload.length > 0) {
      throw new ProductWriteError(
        `Duplicate barcode(s) found across variants: ${Array.from(new Set(duplicatesInPayload)).join(", ")}`,
        400
      );
    }

    if (payloadBarcodes.length > 0) {
      const otherProduct = await Product.findOne({
        _id: { $ne: productId },
        $or: [
          { barcode: { $in: payloadBarcodes } },
          { "variations.barcode": { $in: payloadBarcodes } }
        ]
      });
      if (otherProduct) {
        throw new ProductWriteError(
          `Barcode is already in use by another product: "${otherProduct.productName}"`,
          400
        );
      }
    }

    if (policy.role === "seller") {
      delete (normalized as any).seller;
    } else if (normalized.seller) {
      await resolveAdminSeller(normalized.seller);
    }

    normalized.headerCategoryId = await inheritHeaderCategoryId(
      normalized.category ?? String(existing.category),
      normalized.headerCategoryId ?? (existing.headerCategoryId ? String(existing.headerCategoryId) : undefined)
    );

    const sellerId =
      policy.role === "seller"
        ? policy.sellerId!
        : normalized.seller
          ? await resolveAdminSeller(normalized.seller)
          : String(existing.seller);

    const doc = buildMongooseDoc(normalized, sellerId);
    delete doc.seller;

    Object.assign(existing, doc);
    await existing.save();
    return toDetail(existing);
  }

  static async bulkImportProducts(
    products: Record<string, unknown>[],
    policy: ProductWritePolicy
  ) {
    const results = { success: 0, failed: 0, errors: [] as { index: number; error: string }[] };

    for (let i = 0; i < products.length; i++) {
      try {
        await ProductWriteService.createProduct(products[i], policy);
        results.success++;
      } catch (err: any) {
        results.failed++;
        results.errors.push({
          index: i,
          error: err?.message || "Unknown error",
        });
      }
    }

    return results;
  }
}

export class ProductWriteError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}
