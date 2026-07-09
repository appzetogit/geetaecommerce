import { Request, Response } from "express";
import mongoose from "mongoose";
import Product from "../../../models/Product";
import Shop from "../../../models/Shop";
import Category from "../../../models/Category";
import Seller from "../../../models/Seller";
import { asyncHandler } from "../../../utils/asyncHandler";
import {
  ProductWriteService,
  ProductWriteError,
} from "../../product/productWriteService";
import { sellerProductPolicy } from "../../product/productPolicies";
import { toDetail, toListItems } from "../../product/productReadMapper";

/** Excel / bulk import often sends category or brand *names*; only valid 24-char hex IDs may be cast to ObjectId. */
function isValidObjectIdString(id: unknown): boolean {
  if (id == null) return false;
  const s = String(id).trim();
  return /^[a-fA-F0-9]{24}$/.test(s);
}

function stripInvalidObjectIdFields(body: Record<string, unknown>): void {
  const keys = [
    "categoryId",
    "subcategoryId",
    "brandId",
    "headerCategoryId",
    "sellerId",
    "shopId",
    "taxId",
  ] as const;
  for (const k of keys) {
    const v = body[k];
    if (v !== undefined && v !== null && v !== "" && !isValidObjectIdString(v)) {
      delete body[k];
    }
  }
}


/**
 * Create a new product
 */
export const createProduct = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    stripInvalidObjectIdFields(req.body);

    try {
      const product = await ProductWriteService.createProduct(
        req.body,
        sellerProductPolicy(sellerId)
      );
      return res.status(201).json({
        success: true,
        message: "Product created successfully",
        data: product,
      });
    } catch (error: any) {
      if (error instanceof ProductWriteError) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message,
        });
      }
      return res.status(500).json({
        success: false,
        message: error.message || "Error creating product",
      });
    }
  }
);

/**
 * Get seller's products with filters
 */
export const getProducts = asyncHandler(async (req: Request, res: Response) => {
  const sellerId = (req as any).user.userId;
  const {
    search,
    category,
    status,
    stock,
    redundant,
    page = "1",
    limit = "10",
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query;

  // Build query
  const query: any = { seller: sellerId };

  // Redundant filter (products with same name or barcode for this seller)
  if (redundant) {
    const mongoose = require("mongoose");
    const sellerObjectId = new mongoose.Types.ObjectId(sellerId);
    let duplicateIds: any[] = [];

    // 1. Find duplicate names
    if (redundant === "true" || redundant === "name") {
      const duplicateNames = await Product.aggregate([
        { $match: { seller: sellerObjectId } },
        { $group: { _id: "$productName", count: { $sum: 1 }, ids: { $push: "$_id" } } },
        { $match: { count: { $gt: 1 } } },
      ]);
      duplicateIds = [...duplicateIds, ...duplicateNames.flatMap((d) => d.ids)];
    }

    // 2. Find duplicate barcodes
    if (redundant === "true" || redundant === "barcode") {
      const duplicateBarcodes = await Product.aggregate([
        { $match: { seller: sellerObjectId } },
        { $unwind: "$barcode" },
        { $group: { _id: "$barcode", count: { $sum: 1 }, ids: { $push: "$_id" } } },
        { $match: { count: { $gt: 1 } } },
      ]);
      duplicateIds = [...duplicateIds, ...duplicateBarcodes.flatMap((d) => d.ids)];
    }

    // 3. Find duplicate SKUs
    if (redundant === "true" || redundant === "sku") {
      const duplicateSKUs = await Product.aggregate([
        { $match: { seller: sellerObjectId, sku: { $nin: [null, ""] } } },
        { $group: { _id: "$sku", count: { $sum: 1 }, ids: { $push: "$_id" } } },
        { $match: { count: { $gt: 1 } } },
      ]);
      duplicateIds = [...duplicateIds, ...duplicateSKUs.flatMap((d) => d.ids)];
    }

    query._id = { $in: [...new Set(duplicateIds.map(id => id.toString()))].map(id => new mongoose.Types.ObjectId(id)) };
  }

  // Search filter
  if (search) {
    const searchFilter = [
      { productName: { $regex: search, $options: "i" } },
      { smallDescription: { $regex: search, $options: "i" } },
      { tags: { $in: [new RegExp(search as string, "i")] } },
      { sku: { $regex: search, $options: "i" } },
      { barcode: { $regex: search, $options: "i" } },
      { rackNumber: { $regex: search, $options: "i" } },
      { hsnCode: { $regex: search, $options: "i" } },
      { "variations.sku": { $regex: search, $options: "i" } },
      { "variations.barcode": { $regex: search, $options: "i" } },
    ];

    if (query.$or) {
      // If redundant filter already added $or, we need to wrap it
      query.$and = [
        { $or: query.$or },
        { $or: searchFilter }
      ];
      delete query.$or;
    } else {
      query.$or = searchFilter;
    }
  }

  // Category filter
  if (category) {
    query.category = category;
  }

  // Status filter (publish, popular, dealOfDay)
  if (status) {
    if (status === "published") {
      query.publish = true;
    } else if (status === "unpublished") {
      query.publish = false;
    } else if (status === "popular") {
      query.popular = true;
    } else if (status === "dealOfDay") {
      query.dealOfDay = true;
    }
  }

  // Stock filter applied after mapping via listing.totalStock
  const stockFilter = stock;

  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);
  const skip = (pageNum - 1) * limitNum;

  const sort: any = {};
  sort[sortBy as string] = sortOrder === "asc" ? 1 : -1;

  const productsRaw = await Product.find(query)
    .populate("category", "name")
    .populate("subcategory", "name")
    // .populate("subSubCategory", "name") // Removed as it is now a string
    .populate("brand", "name")
    .populate("tax", "name percentage")
    .sort(sort)
    .skip(skip)
    .limit(limitNum);

  let products = toListItems(productsRaw);
  if (stockFilter === "inStock") {
    products = products.filter((p) => p.listing.inStock);
  } else if (stockFilter === "outOfStock") {
    products = products.filter((p) => !p.listing.inStock);
  }

  const total = await Product.countDocuments(query);

  return res.status(200).json({
    success: true,
    message: "Products fetched successfully",
    data: products,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum),
    },
  });
});

/**
 * Get product by ID
 */
export const getProductById = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const { id } = req.params;

    // Prevent reserved route names from being treated as product IDs
    const reservedRoutes = ["shops", "brands"];
    if (reservedRoutes.includes(id)) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const product = await Product.findOne({ _id: id, seller: sellerId })
      .populate("category", "name")
      .populate("subcategory", "name")
      // .populate("subSubCategory", "name") // Removed as it is now a string
      .populate("headerCategoryId", "name slug")
      .populate("brand", "name")
      .populate("tax", "name percentage");

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product fetched successfully",
      data: toDetail(product),
    });
  }
);

/**
 * Update product
 */
export const updateProduct = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const { id } = req.params;
    stripInvalidObjectIdFields(req.body);
    delete req.body.sellerId;

    try {
      const product = await ProductWriteService.updateProduct(
        id,
        req.body,
        sellerProductPolicy(sellerId)
      );
      return res.status(200).json({
        success: true,
        message: "Product updated successfully",
        data: product,
      });
    } catch (error: any) {
      if (error instanceof ProductWriteError) {
        return res.status(error.statusCode).json({
          success: false,
          message: error.message,
        });
      }
      return res.status(500).json({
        success: false,
        message: error.message || "Error updating product",
      });
    }
  }
);

/**
 * Delete product
 */
export const deleteProduct = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const { id } = req.params;

    console.log("DEBUG deleteProduct: sellerId from token:", sellerId);
    console.log("DEBUG deleteProduct: productId:", id);

    const product = await Product.findOneAndDelete({
      _id: id,
      seller: sellerId,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product deleted successfully",
    });
  }
);

/**
 * Update stock for a product variation
 */
export const updateStock = asyncHandler(async (req: Request, res: Response) => {
  const sellerId = (req as any).user.userId;
  const { id, variationId } = req.params;
  const { stock, status } = req.body;

  const product = await Product.findOne({ _id: id, seller: sellerId });

  if (!product) {
    return res.status(404).json({
      success: false,
      message: "Product not found",
    });
  }

  const variation: any = product.variations?.find(
    (v: any) => v._id?.toString() === variationId
  );
  if (!variation) {
    return res.status(404).json({
      success: false,
      message: "Variation not found",
    });
  }

  if (stock !== undefined) {
    variation.stock = stock;
    // Automatically update status based on stock
    if (stock === 0) {
      variation.status = "Sold out";
    } else if (stock > 0 && variation.status === "Sold out") {
      variation.status = "Available";
    }
  }
  if (status) {
    variation.status = status;
  }

  // Mark variations as modified since we updated a sub-document field
  product.markModified("variations");
  await product.save();

  return res.status(200).json({
    success: true,
    message: "Stock updated successfully",
    data: product,
  });
});

/**
 * Update product status (publish, popular, dealOfDay)
 */
export const updateProductStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const { id } = req.params;
    const { publish, popular, dealOfDay } = req.body;

    const updateData: any = {};
    if (publish !== undefined) updateData.publish = publish;
    if (popular !== undefined) updateData.popular = popular;
    if (dealOfDay !== undefined) updateData.dealOfDay = dealOfDay;

    const product = await Product.findOneAndUpdate(
      { _id: id, seller: sellerId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product status updated successfully",
      data: product,
    });
  }
);

/**
 * Bulk update stock for multiple products/variations
 */
export const bulkUpdateStock = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const { updates } = req.body; // Array of { productId, variationId, stock }

    if (!Array.isArray(updates)) {
      return res.status(400).json({
        success: false,
        message: "Updates must be an array",
      });
    }

    const results = [];
    for (const update of updates) {
      const { productId, variationId, stock } = update;

      const product = await Product.findOne({
        _id: productId,
        seller: sellerId,
      });
      if (product) {
        const variation: any = product.variations?.find(
          (v: any) => v._id?.toString() === variationId
        );
        if (variation) {
          variation.stock = stock;
          if (stock === 0) variation.status = "Sold out";
          else if (stock > 0 && variation.status === "Sold out")
            variation.status = "In stock";

          await product.save();
          results.push({ productId, variationId, success: true });
        } else {
          results.push({
            productId,
            variationId,
            success: false,
            message: "Variation not found",
          });
        }
      } else {
        results.push({
          productId,
          variationId,
          success: false,
          message: "Product not found",
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Bulk stock update processed",
      data: results,
    });
  }
);

/**
 * Get all active shops (for seller to select when creating shop-by-store-only products)
 */
export const getShops = asyncHandler(async (_req: Request, res: Response) => {
  const shops = await Shop.find({ isActive: true })
    .select("_id name storeId image")
    .sort({ order: 1, name: 1 })
    .lean();

  return res.status(200).json({
    success: true,
    message: "Shops fetched successfully",
    data: shops || [],
  });
});

/**
 * Generate a unique barcode based on product data (productName and variationValue)
 */
export const generateUniqueBarcode = asyncHandler(
  async (req: Request, res: Response) => {
    const { productName = "", variationValue = "", excludeBarcodes } = req.query;

    const excludeList: string[] = [];
    if (Array.isArray(excludeBarcodes)) {
      excludeList.push(...excludeBarcodes.map(String).map(s => s.trim()).filter(Boolean));
    } else if (typeof excludeBarcodes === "string") {
      excludeList.push(...excludeBarcodes.split(",").map(s => s.trim()).filter(Boolean));
    }

    const combinedStr = `${productName}_${variationValue}`;
    let hash = 0;
    for (let i = 0; i < combinedStr.length; i++) {
      hash = (hash * 31 + combinedStr.charCodeAt(i)) % 1000000;
    }
    const prefixNum = String(hash).padStart(6, "0");

    let suffix = 1000;
    let uniqueBarcode = "";
    let isUnique = false;

    while (!isUnique) {
      suffix++;
      uniqueBarcode = `${prefixNum}${suffix}`;

      if (excludeList.includes(uniqueBarcode)) {
        continue;
      }

      const existing = await Product.findOne({
        $or: [
          { barcode: uniqueBarcode },
          { "variations.barcode": uniqueBarcode }
        ]
      });
      if (!existing) {
        isUnique = true;
      }
    }

    return res.status(200).json({
      success: true,
      message: "Unique barcode generated successfully",
      barcode: uniqueBarcode
    });
  }
);

/**
 * Check if a barcode is globally unique (excluding optional productId)
 */
export const checkBarcodeUnique = asyncHandler(
  async (req: Request, res: Response) => {
    const { barcode = "", productId = "" } = req.query;
    const trimmed = String(barcode).trim();
    if (!trimmed) {
      return res.status(200).json({ success: true, isUnique: true });
    }

    const query: Record<string, any> = {
      $or: [
        { barcode: trimmed },
        { "variations.barcode": trimmed }
      ]
    };

    if (productId && mongoose.Types.ObjectId.isValid(productId as string)) {
      query._id = { $ne: productId };
    }

    const existing = await Product.findOne(query);
    if (existing) {
      return res.status(200).json({
        success: true,
        isUnique: false,
        message: `Barcode is already in use by product "${existing.productName}"`
      });
    }

    return res.status(200).json({
      success: true,
      isUnique: true
    });
  }
);
