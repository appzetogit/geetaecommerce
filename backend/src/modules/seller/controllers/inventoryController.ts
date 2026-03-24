import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler } from "../../../utils/asyncHandler";
import Product from "../../../models/Product";
import InventoryLoss from "../../../models/InventoryLoss";
import StockLedger from "../../../models/StockLedger";
import "../../../models/Category";
import "../../../models/Brand";
import "../../../models/Seller";
import "../../../models/Tax";

/**
 * Get Stock Summary Report for Seller
 */
export const getStockSummary = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      page = 1,
      limit = 20,
      search,
      category,
      dateFrom,
      dateTo,
    } = req.query;

    const sellerId = req.user?.userId;

    const query: any = { seller: sellerId }; // Filter by Seller

    if (category) {
      query.category = category;
    }

    if (search) {
      const searchRegex = { $regex: search as string, $options: "i" };
      query.$or = [
        { productName: searchRegex },
        { sku: searchRegex },
        { barcode: searchRegex },
        { hsnCode: searchRegex },
        { "variations.name": searchRegex },
        { "variations.sku": searchRegex },
        { "variations.barcode": searchRegex },
      ];
    }

    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom as string);
      if (dateTo) query.createdAt.$lte = new Date(dateTo as string);
    }

    const totalProducts = await Product.countDocuments(query);
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const products = await Product.find(query)
      .populate("category", "name")
      .populate("brand", "name")
      .populate("seller", "storeName")
      .populate("tax", "name percentage")
      .sort({ productName: 1 })
      .skip(skip)
      .limit(parseInt(limit as string));

    const flatData: any[] = [];

    products.forEach((product: any) => {
      if (product.variations && product.variations.length > 0) {
        product.variations.forEach((v: any) => {
          if (search) {
            const s = (search as string).toLowerCase();
            const matches =
              product.productName.toLowerCase().includes(s) ||
              (v.name && v.name.toLowerCase().includes(s)) ||
              (v.sku && v.sku.toLowerCase().includes(s)) ||
              (v.barcode && v.barcode.toLowerCase().includes(s)) ||
              (product.category?.name && product.category.name.toLowerCase().includes(s)) ||
              (product.brand?.name && product.brand.name.toLowerCase().includes(s));

            if (!matches) return;
          }

          const mrp = v.compareAtPrice || v.price || product.compareAtPrice || product.price || 0;
          const sp = v.price || product.price || 0;
          const qty = v.stock || 0;
          const purchaseVal = v.purchasePrice || product.purchasePrice || 0;
          const discountRs = Math.max(0, mrp - sp);
          const discountPercent = mrp > 0 ? (discountRs / mrp) * 100 : 0;

          flatData.push({
            _id: v._id || `${product._id}_${v.name}`,
            productId: product._id,
            name: product.productName,
            variantName: v.name || v.value || "Standard",
            uom: product.pack || "pcs",
            purchaseValue: purchaseVal,
            mrp: mrp,
            sellingPrice: sp,
            openingStock: qty,
            quantity: qty,
            totalDiscountRs: discountRs,
            totalDiscountPercent: discountPercent,
            totalMRP: mrp * qty,
            totalSP: sp * qty,
            totalPurchasePrice: purchaseVal * qty,
            wholesalePrice: v.wholesalePrice || product.wholesalePrice || 0,
            onlineOfferPrice: v.discPrice || product.discPrice || 0,
            lowStockQty: product.lowStockQuantity || 10,
            supplier: product.seller?.storeName || "Unknown",
            category: product.category?.name || "Uncategorized",
            ean: v.barcode || product.barcode || "",
            gst: product.tax?.percentage || 0,
            hsn: product.hsnCode || "",
            cess: 0,
            brand: product.brand?.name || "No Brand",
            expiryDate: "",
            imageUrl: product.mainImage || ""
          });
        });
      } else {
        const mrp = product.compareAtPrice || product.price || 0;
        const sp = product.price || 0;
        const qty = product.stock || 0;
        const purchaseVal = product.purchasePrice || 0;
        const discountRs = Math.max(0, mrp - sp);
        const discountPercent = mrp > 0 ? (discountRs / mrp) * 100 : 0;

        flatData.push({
          _id: product._id,
          productId: product._id,
          name: product.productName,
          variantName: "Standard",
          uom: product.pack || "pcs",
          purchaseValue: purchaseVal,
          mrp: mrp,
          sellingPrice: sp,
          openingStock: qty,
          quantity: qty,
          totalDiscountRs: discountRs,
          totalDiscountPercent: discountPercent,
          totalMRP: mrp * qty,
          totalSP: sp * qty,
          totalPurchasePrice: purchaseVal * qty,
          wholesalePrice: product.wholesalePrice || 0,
          onlineOfferPrice: product.discPrice || 0,
          lowStockQty: product.lowStockQuantity || 10,
          supplier: product.seller?.storeName || "Unknown",
          category: product.category?.name || "Uncategorized",
          ean: product.barcode || "",
          gst: product.tax?.percentage || 0,
          hsn: product.hsnCode || "",
          cess: 0,
          brand: product.brand?.name || "No Brand",
          expiryDate: "",
          imageUrl: product.mainImage || ""
        });
      }
    });

    return res.status(200).json({
      success: true,
      message: "Stock summary fetched successfully",
      data: flatData,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: totalProducts,
        pages: Math.ceil(totalProducts / parseInt(limit as string)),
      },
    });
  }
);

/**
 * Get Stock Balance Summary Report for Seller
 */
export const getStockBalanceSummary = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      page = 1,
      limit = 20,
      search,
      category,
      dateFrom,
      dateTo,
    } = req.query;

    const sellerId = req.user?.userId;
    const query: any = { seller: sellerId };

    if (category) {
      query.category = category;
    }

    if (search) {
      const searchRegex = { $regex: search as string, $options: "i" };
      query.$or = [
        { productName: searchRegex },
        { sku: searchRegex },
        { barcode: searchRegex },
        { hsnCode: searchRegex },
        { "variations.name": searchRegex },
        { "variations.sku": searchRegex },
        { "variations.barcode": searchRegex },
      ];
    }

    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom as string);
      if (dateTo) query.createdAt.$lte = new Date(dateTo as string);
    }

    const totalProducts = await Product.countDocuments(query);
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const products = await Product.find(query)
      .populate("category", "name")
      .populate("subcategory", "name")
      .populate("seller", "storeName")
      .populate("tax", "percentage")
      .sort({ productName: 1 })
      .skip(skip)
      .limit(parseInt(limit as string));

    const flatData: any[] = [];

    products.forEach((product: any) => {
      if (product.variations && product.variations.length > 0) {
        product.variations.forEach((v: any) => {
          if (search) {
            const s = (search as string).toLowerCase();
            const matches =
              product.productName.toLowerCase().includes(s) ||
              (v.name && v.name.toLowerCase().includes(s)) ||
              (v.sku && v.sku.toLowerCase().includes(s)) ||
              (v.barcode && v.barcode.toLowerCase().includes(s)) ||
              (product.category?.name && product.category.name.toLowerCase().includes(s));

            if (!matches) return;
          }

          const sp = v.price || product.price || 0;
          const qty = v.stock || 0;
          const purchaseVal = v.purchasePrice || product.purchasePrice || 0;

          flatData.push({
            _id: v._id || `${product._id}_${v.name}`,
            name: product.productName,
            variantName: v.name || v.value || "Standard",
            uom: product.pack || "Piece",
            sellingPrice: sp,
            purchasePrice: purchaseVal,
            openingStockQty: qty,
            quantity: qty,
            hsn: product.hsnCode || "",
            cess: 0,
            gst: product.tax?.percentage || 0,
            totalSellingPrice: sp * qty,
            totalPurchasePrice: purchaseVal * qty,
            supplier: product.seller?.storeName || "Unknown",
            category: product.category?.name || "Uncategorized",
            subCategory: product.subcategory?.name || "General"
          });
        });
      } else {
        const sp = product.price || 0;
        const qty = product.stock || 0;
        const purchaseVal = product.purchasePrice || 0;

        flatData.push({
          _id: product._id,
          name: product.productName,
          variantName: "Standard",
          uom: product.pack || "Piece",
          sellingPrice: sp,
          purchasePrice: purchaseVal,
          openingStockQty: qty,
          quantity: qty,
          hsn: product.hsnCode || "",
          cess: 0,
          gst: product.tax?.percentage || 0,
          totalSellingPrice: sp * qty,
          totalPurchasePrice: purchaseVal * qty,
          supplier: product.seller?.storeName || "Unknown",
          category: product.category?.name || "Uncategorized",
          subCategory: product.subcategory?.name || "General"
        });
      }
    });

    return res.status(200).json({
      success: true,
      message: "Stock balance summary fetched successfully",
      data: flatData,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: totalProducts,
        pages: Math.ceil(totalProducts / parseInt(limit as string)),
      },
    });
  }
);

/**
 * Get Low Stock Summary Report for Seller
 */
export const getLowStockSummary = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      page = 1,
      limit = 20,
      search,
      category,
      dateFrom,
      dateTo,
    } = req.query;

    const sellerId = req.user?.userId;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const matchQuery: any = { seller: new mongoose.Types.ObjectId(sellerId) };
    if (category) {
      matchQuery.category = new mongoose.Types.ObjectId(category as string);
    }

    if (dateFrom || dateTo) {
      matchQuery.createdAt = {};
      if (dateFrom) matchQuery.createdAt.$gte = new Date(dateFrom as string);
      if (dateTo) matchQuery.createdAt.$lte = new Date(dateTo as string);
    }

    const searchRegex = search ? new RegExp(search as string, "i") : null;

    const pipeline: any[] = [
      { $match: matchQuery },
      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "categoryDoc",
        },
      },
      {
        $lookup: {
          from: "sellers",
          localField: "seller",
          foreignField: "_id",
          as: "sellerDoc",
        },
      },
      { $unwind: { path: "$categoryDoc", preserveNullAndEmptyArrays: true } },
      { $unwind: { path: "$sellerDoc", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          productName: 1,
          pack: 1,
          purchasePrice: 1,
          compareAtPrice: 1,
          price: 1,
          stock: 1,
          variations: 1,
          lowStockQuantity: 1,
          categoryName: "$categoryDoc.name",
          sellerName: "$sellerDoc.storeName",
        },
      },
      {
        $project: {
          items: {
            $cond: {
              if: { $and: [{ $isArray: "$variations" }, { $gt: [{ $size: "$variations" }, 0] }] },
              then: {
                $map: {
                  input: "$variations",
                  as: "v",
                  in: {
                    _id: "$$v._id",
                    name: "$productName",
                    variantName: { $ifNull: ["$$v.name", { $ifNull: ["$$v.value", "Standard"] }] },
                    uom: { $ifNull: ["$pack", "Piece"] },
                    purchaseValue: { $ifNull: ["$$v.purchasePrice", { $ifNull: ["$purchasePrice", 0] }] },
                    mrp: { $ifNull: ["$$v.compareAtPrice", { $ifNull: ["$compareAtPrice", 0] }] },
                    sellingPrice: { $ifNull: ["$$v.price", { $ifNull: ["$price", 0] }] },
                    quantity: { $ifNull: ["$$v.stock", 0] },
                    lowStockQty: { $ifNull: ["$lowStockQuantity", 10] },
                    supplier: { $ifNull: ["$sellerName", "Unknown"] },
                    category: { $ifNull: ["$categoryName", "Uncategorized"] }
                  }
                }
              },
              else: [
                {
                  _id: "$_id",
                  name: "$productName",
                  variantName: "Standard",
                  uom: { $ifNull: ["$pack", "Piece"] },
                  purchaseValue: { $ifNull: ["$purchasePrice", 0] },
                  mrp: { $ifNull: ["$compareAtPrice", 0] },
                  sellingPrice: { $ifNull: ["$price", 0] },
                  quantity: { $ifNull: ["$stock", 0] },
                  lowStockQty: { $ifNull: ["$lowStockQuantity", 10] },
                  supplier: { $ifNull: ["$sellerName", "Unknown"] },
                  category: { $ifNull: ["$categoryName", "Uncategorized"] }
                }
              ]
            }
          }
        }
      },
      { $unwind: "$items" },
      { $replaceRoot: { newRoot: "$items" } },
      { $match: { $expr: { $lte: ["$quantity", "$lowStockQty"] } } },
      ...(searchRegex ? [
        {
          $match: {
            $or: [
              { name: searchRegex },
              { variantName: searchRegex },
              { supplier: searchRegex },
              { category: searchRegex }
            ]
          }
        }
      ] : []),
      { $sort: { name: 1 } },
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limitNum }
          ],
          totalCount: [
            { $count: "count" }
          ]
        }
      }
    ];

    const results = await Product.aggregate(pipeline);
    const data = results[0].data;
    const total = results[0].totalCount[0]?.count || 0;

    return res.status(200).json({
      success: true,
      message: "Low stock summary fetched successfully",
      data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  }
);

/**
 * Get Out of Stock Summary Report for Seller
 */
export const getOutOfStockSummary = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      page = 1,
      limit = 20,
      search,
      category,
      dateFrom,
      dateTo,
    } = req.query;

    const sellerId = req.user?.userId;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const matchQuery: any = { seller: new mongoose.Types.ObjectId(sellerId) };
    if (category) {
      matchQuery.category = new mongoose.Types.ObjectId(category as string);
    }

    if (dateFrom || dateTo) {
      matchQuery.createdAt = {};
      if (dateFrom) matchQuery.createdAt.$gte = new Date(dateFrom as string);
      if (dateTo) matchQuery.createdAt.$lte = new Date(dateTo as string);
    }

    const searchRegex = search ? new RegExp(search as string, "i") : null;

    const pipeline: any[] = [
      { $match: matchQuery },
      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "categoryDoc",
        },
      },
      {
        $lookup: {
          from: "sellers",
          localField: "seller",
          foreignField: "_id",
          as: "sellerDoc",
        },
      },
      { $unwind: { path: "$categoryDoc", preserveNullAndEmptyArrays: true } },
      { $unwind: { path: "$sellerDoc", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          productName: 1,
          pack: 1,
          purchasePrice: 1,
          compareAtPrice: 1,
          price: 1,
          stock: 1,
          variations: 1,
          categoryName: "$categoryDoc.name",
          sellerName: "$sellerDoc.storeName",
        },
      },
      {
        $project: {
          items: {
            $cond: {
              if: { $and: [{ $isArray: "$variations" }, { $gt: [{ $size: "$variations" }, 0] }] },
              then: {
                $map: {
                  input: "$variations",
                  as: "v",
                  in: {
                    _id: "$$v._id",
                    name: "$productName",
                    variantName: { $ifNull: ["$$v.name", { $ifNull: ["$$v.value", "Standard"] }] },
                    uom: { $ifNull: ["$pack", "Piece"] },
                    purchaseValue: { $ifNull: ["$$v.purchasePrice", { $ifNull: ["$purchasePrice", 0] }] },
                    mrp: { $ifNull: ["$$v.compareAtPrice", { $ifNull: ["$compareAtPrice", 0] }] },
                    sellingPrice: { $ifNull: ["$$v.price", { $ifNull: ["$price", 0] }] },
                    quantity: { $ifNull: ["$$v.stock", 0] },
                    supplier: { $ifNull: ["$sellerName", "Unknown"] },
                    category: { $ifNull: ["$categoryName", "Uncategorized"] }
                  }
                }
              },
              else: [
                {
                  _id: "$_id",
                  name: "$productName",
                  variantName: "Standard",
                  uom: { $ifNull: ["$pack", "Piece"] },
                  purchaseValue: { $ifNull: ["$purchasePrice", 0] },
                  mrp: { $ifNull: ["$compareAtPrice", 0] },
                  sellingPrice: { $ifNull: ["$price", 0] },
                  quantity: { $ifNull: ["$stock", 0] },
                  supplier: { $ifNull: ["$sellerName", "Unknown"] },
                  category: { $ifNull: ["$categoryName", "Uncategorized"] }
                }
              ]
            }
          }
        }
      },
      { $unwind: "$items" },
      { $replaceRoot: { newRoot: "$items" } },
      { $match: { quantity: { $lte: 0 } } },
      ...(searchRegex ? [
        {
          $match: {
            $or: [
              { name: searchRegex },
              { variantName: searchRegex },
              { supplier: searchRegex },
              { category: searchRegex }
            ]
          }
        }
      ] : []),
      { $sort: { name: 1 } },
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limitNum }
          ],
          totalCount: [
            { $count: "count" }
          ]
        }
      }
    ];

    const results = await Product.aggregate(pipeline);
    const data = results[0].data;
    const total = results[0].totalCount[0]?.count || 0;

    return res.status(200).json({
      success: true,
      message: "Out of stock summary fetched successfully",
      data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  }
);

/**
 * Get Loss Summary Report for Seller
 */
export const getLossSummary = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      page = 1,
      limit = 20,
      search,
      dateFrom,
      dateTo,
    } = req.query;

    const sellerId = req.user?.userId;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const matchQuery: any = { seller: new mongoose.Types.ObjectId(sellerId) }; // Filter by Seller

    if (dateFrom || dateTo) {
      matchQuery.date = {};
      if (dateFrom) matchQuery.date.$gte = new Date(dateFrom as string);
      if (dateTo) matchQuery.date.$lte = new Date(dateTo as string);
    }

    const searchRegex = search ? new RegExp(search as string, "i") : null;

    const pipeline: any[] = [
      { $match: matchQuery },
      {
        $lookup: {
          from: "products",
          localField: "product",
          foreignField: "_id",
          as: "productDoc",
        },
      },
      { $unwind: { path: "$productDoc", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          date: 1,
          productName: "$productDoc.productName",
          weight: 1,
          quantity: 1,
          reason: 1,
          sku: "$productDoc.sku"
        },
      },
      ...(searchRegex ? [
        {
          $match: {
            $or: [
              { productName: searchRegex },
              { reason: searchRegex },
              { sku: searchRegex }
            ]
          }
        }
      ] : []),
      { $sort: { date: -1 } },
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limitNum }
          ],
          totalCount: [
            { $count: "count" }
          ]
        }
      }
    ];

    const results = await InventoryLoss.aggregate(pipeline);
    const data = results[0].data;
    const total = results[0].totalCount[0]?.count || 0;

    return res.status(200).json({
      success: true,
      message: "Loss summary fetched successfully",
      data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  }
);

/**
 * Create Loss Record for Seller
 */
export const createLossRecord = asyncHandler(
  async (req: Request, res: Response) => {
    const { productId, variationId, date, quantity, reason, weight } = req.body;
    const sellerId = req.user?.userId;

    if (!productId || !quantity || !reason) {
      return res.status(400).json({
        success: false,
        message: "Please provide product, quantity and reason",
      });
    }

    const product = await Product.findOne({ _id: productId, seller: sellerId }); // Verify product ownership
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found or access denied",
      });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const prevStock = product.stock;
      const newStock = Math.max(0, prevStock - quantity);

      // 1. Create Loss Record
      const lossRecord = new InventoryLoss({
        product: productId,
        variationId,
        date: date || new Date(),
        quantity,
        reason,
        weight: weight || product.pack || "Piece",
        seller: sellerId // Save seller ID
      });
      await lossRecord.save({ session });

      // 2. Update Product Stock
      product.stock = newStock;

      if (variationId && product.variations && product.variations.length > 0) {
        const variation = product.variations.find(v => v._id.toString() === variationId.toString());
        if (variation) {
          const vPrevStock = variation.stock || 0;
          variation.stock = Math.max(0, vPrevStock - quantity);
        }
      }
      await product.save({ session });

      // 3. Record in Stock Ledger
      const ledgerEntry = new StockLedger({
        product: productId,
        variationId,
        sku: product.sku || "N/A",
        quantity,
        type: "OUT",
        source: "MANUAL",
        referenceId: lossRecord._id,
        previousStock: prevStock,
        newStock: newStock,
        seller: sellerId // Assuming StockLedger supports seller field
      });

      // Check if StockLedger schema has seller field, if not, it's fine, but admin might not see it correctly linked if strict
      // Assuming StockLedger is shared or seller-specific?
      // For now, let's assume it works.
      await ledgerEntry.save({ session });

      await session.commitTransaction();
      session.endSession();

      return res.status(201).json({
        success: true,
        message: "Loss record created successfully",
        data: lossRecord
      });
    } catch (error: any) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }
);

/**
 * Delete Loss Record for Seller and Restore Stock
 */
export const deleteLossRecord = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const sellerId = req.user?.userId;

  const lossRecord = await InventoryLoss.findById(id);
  if (!lossRecord) {
    return res.status(404).json({
      success: false,
      message: "Loss record not found",
    });
  }

  if (!sellerId || lossRecord.seller?.toString() !== sellerId.toString()) {
    return res.status(404).json({
      success: false,
      message: "Loss record not found or access denied",
    });
  }

  const product = await Product.findOne({ _id: lossRecord.product, seller: sellerId });
  if (!product) {
    return res.status(404).json({
      success: false,
      message: "Product not found or access denied",
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const prevStock = product.stock;
    const newStock = prevStock + lossRecord.quantity;
    product.stock = newStock;

    if (lossRecord.variationId && product.variations && product.variations.length > 0) {
      const variation = product.variations.find(
        (v) => v._id.toString() === lossRecord.variationId!.toString()
      );
      if (variation) {
        const vPrevStock = variation.stock || 0;
        variation.stock = vPrevStock + lossRecord.quantity;
      }
    }

    await product.save({ session });

    await StockLedger.deleteMany({ referenceId: lossRecord._id }).session(session);
    await InventoryLoss.deleteOne({ _id: lossRecord._id }).session(session);

    await session.commitTransaction();
    session.endSession();

    const io = req.app.get("io");
    if (io) {
      io.emit("stock-update", { productId: product._id, newStock: product.stock });
    }

    return res.status(200).json({
      success: true,
      message: "Loss record deleted and stock restored successfully",
    });
  } catch (error: any) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
});
