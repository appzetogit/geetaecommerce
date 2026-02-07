import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler } from "../../../utils/asyncHandler";
import Product from "../../../models/Product";
import Order from "../../../models/Order";
import InventoryLoss from "../../../models/InventoryLoss";
import StockLedger from "../../../models/StockLedger";
import Return from "../../../models/Return";
import OrderItem from "../../../models/OrderItem";
import "../../../models/Category";
import "../../../models/Brand";
import "../../../models/Seller";
import "../../../models/Tax";

/**
 * Get Stock Summary Report
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

    const query: any = {};

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

    // Date range filter for createdAt if needed, but stock summary is usually current state
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
          // If searching, filter variations too if the main product didn't match the name
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
            openingStock: qty, // Defaulting to current for now
            quantity: qty,
            totalDiscountRs: discountRs,
            totalDiscountPercent: discountPercent,
            totalMRP: mrp * qty,
            totalSP: sp * qty,
            totalPurchasePrice: purchaseVal * qty,
            wholesalePrice: v.wholesalePrice || product.wholesalePrice || 0,
            onlineOfferPrice: v.discPrice || product.discPrice || 0,
            lowStockQty: product.lowStockQuantity || 10,
            supplier: product.seller?.storeName || "Admin",
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
          supplier: product.seller?.storeName || "Admin",
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
 * Get Stock Balance Summary Report
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

    const query: any = {};

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
              (product.category?.name && product.category.name.toLowerCase().includes(s)) ||
              (product.seller?.storeName && product.seller.storeName.toLowerCase().includes(s));

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
            openingStockQty: qty, // Default to current stock
            quantity: qty,
            hsn: product.hsnCode || "",
            cess: 0,
            gst: product.tax?.percentage || 0,
            totalSellingPrice: sp * qty,
            totalPurchasePrice: purchaseVal * qty,
            supplier: product.seller?.storeName || "Admin",
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
          supplier: product.seller?.storeName || "Admin",
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
 * Get Low Stock Summary Report
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

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build the initial match query
    const matchQuery: any = {};
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
      // Create a flat structure for each product/variation
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
                    supplier: { $ifNull: ["$sellerName", "Admin"] },
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
                  supplier: { $ifNull: ["$sellerName", "Admin"] },
                  category: { $ifNull: ["$categoryName", "Uncategorized"] }
                }
              ]
            }
          }
        }
      },
      { $unwind: "$items" },
      { $replaceRoot: { newRoot: "$items" } },
      // Filter for Low Stock items
      { $match: { $expr: { $lte: ["$quantity", "$lowStockQty"] } } },
      // Apply search filter if present
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
 * Get Out of Stock Summary Report
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

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build the initial match query
    const matchQuery: any = {};
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
      // Create a flat structure for each product/variation
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
                    supplier: { $ifNull: ["$sellerName", "Admin"] },
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
                  supplier: { $ifNull: ["$sellerName", "Admin"] },
                  category: { $ifNull: ["$categoryName", "Uncategorized"] }
                }
              ]
            }
          }
        }
      },
      { $unwind: "$items" },
      { $replaceRoot: { newRoot: "$items" } },
      // Filter for Out of Stock items
      { $match: { quantity: { $lte: 0 } } },
      // Apply search filter if present
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
 * Get Loss Summary Report
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

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build the initial match query
    const matchQuery: any = {};

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
      // Apply search filter if present
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
 * Create Loss Record
 */
export const createLossRecord = asyncHandler(
  async (req: Request, res: Response) => {
    const { productId, variationId, date, quantity, reason, weight } = req.body;

    if (!productId || !quantity || !reason) {
      return res.status(400).json({
        success: false,
        message: "Please provide product, quantity and reason",
      });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Start a session for transaction
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
        admin: (req as any).admin?._id
      });
      await lossRecord.save({ session });

      // 2. Update Product Stock (If no variation, otherwise variation stock should also be updated)
      // For simplicity, let's update main stock. In a real scenario, variation stock should be handled too.
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
        source: "MANUAL", // Or "LOSS" if we added it to enum
        referenceId: lossRecord._id,
        previousStock: prevStock,
        newStock: newStock,
        admin: (req as any).admin?._id
      });
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

export const getGSTSalesReport = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      page = 1,
      limit = 20,
      search,
      dateFrom,
      dateTo,
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const searchRegex = search ? new RegExp(search as string, "i") : null;

    const matchQuery: any = {};
    if (dateFrom || dateTo) {
      matchQuery.orderDate = {};
      if (dateFrom) matchQuery.orderDate.$gte = new Date(dateFrom as string);
      if (dateTo) matchQuery.orderDate.$lte = new Date(dateTo as string);
    }

    // Pipeline to get GST sales data
    // We need to unwind order items, join with products to get HSN and GST info if not in order items
    // OrderSchema Items have: productName, unitPrice, quantity, total. Missing: hsn, gst details?
    // Order model doesn't explicitly store HSN/TAX per item in the schema provided in previous context.
    // It seems we need to fetch from Product.
    const pipeline: any[] = [
      { $match: { ...matchQuery, status: "Delivered" } }, // Only delivered orders for GST report usually? Or all? User didn't specify, assume all valid sales or just Delivered/Paid.
      { $unwind: "$items" },
      {
        $lookup: {
          from: "orderitems",
          localField: "items",
          foreignField: "_id",
          as: "itemDetails"
        }
      },
      { $unwind: "$itemDetails" },
      {
        $lookup: {
          from: "products",
          localField: "itemDetails.product",
          foreignField: "_id",
          as: "productDetails"
        }
      },
      { $unwind: { path: "$productDetails", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "taxes",
          localField: "productDetails.tax",
          foreignField: "_id",
          as: "taxDetails"
        }
      },
      { $unwind: { path: "$taxDetails", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          date: { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } },
          invoiceNo: "$orderNumber",
          customerName: "$customerName",
          gstin: { $ifNull: ["$billingAddress.gstin", "N/A"] }, // Assuming billing address has GSTIN if B2B
          productName: "$itemDetails.productName",
          hsn: { $ifNull: ["$productDetails.hsnCode", ""] },
          quantity: "$itemDetails.quantity",
          taxableAmount: {
            $multiply: ["$itemDetails.unitPrice", "$itemDetails.quantity"]
            // Note: If unitPrice is inclusive of tax, we need to back-calculate.
            // Assuming unitPrice is the selling price. If tax is extra or inclusive depends on business logic.
            // For simplicity, let's assume unitPrice is the taxable value for now or just display it.
          },
          cgst: { $ifNull: ["$taxDetails.cgst", 0] }, // If tax model has split
          sgst: { $ifNull: ["$taxDetails.sgst", 0] },
          igst: { $ifNull: ["$taxDetails.igst", 0] },
          totalAmount: "$itemDetails.total"
        }
      },
      ...(searchRegex ? [
        {
          $match: {
            $or: [
              { invoiceNo: searchRegex },
              { customerName: searchRegex },
              { productName: searchRegex }
            ]
          }
        }
      ] : []),
      { $sort: { date: -1, invoiceNo: -1 } },
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

    const results = await Order.aggregate(pipeline);
    const data = results[0].data;
    const total = results[0].totalCount[0]?.count || 0;

    return res.status(200).json({
      success: true,
      message: "GST Sales report fetched successfully",
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

export const getPaymentReport = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      page = 1,
      limit = 20,
      search,
      dateFrom,
      dateTo,
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const searchRegex = search ? new RegExp(search as string, "i") : null;

    const matchQuery: any = {};
    if (dateFrom || dateTo) {
      matchQuery.orderDate = {};
      if (dateFrom) matchQuery.orderDate.$gte = new Date(dateFrom as string);
      if (dateTo) matchQuery.orderDate.$lte = new Date(dateTo as string);
    }

    const pipeline: any[] = [
      { $match: matchQuery },
      {
        $addFields: {
          type: {
            $cond: {
              if: {
                $or: [
                  { $regexMatch: { input: { $ifNull: ["$adminNotes", ""] }, regex: "pos", options: "i" } },
                  { $eq: ["$deliveryAddress.address", "POS Order"] }
                ]
              },
              then: "POS",
              else: "Online"
            }
          }
        }
      },
      {
        $project: {
          _id: 1,
          date: { $dateToString: { format: "%Y-%m-%d", date: "$orderDate" } },
          paymentId: { $ifNull: ["$paymentId", "N/A"] },
          orderNumber: 1,
          customerName: 1,
          amount: "$total",
          paymentMethod: 1,
          status: "$paymentStatus",
          type: 1
        }
      },
      ...(searchRegex ? [
        {
          $match: {
            $or: [
              { orderNumber: searchRegex },
              { paymentId: searchRegex },
              { customerName: searchRegex }
            ]
          }
        }
      ] : []),
      { $sort: { date: -1, orderNumber: -1 } },
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

    const results = await Order.aggregate(pipeline);
    const data = results[0].data;
    const total = results[0].totalCount[0]?.count || 0;

    return res.status(200).json({
      success: true,
      message: "Payment report fetched successfully",
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

export const getSalesSummaryReport = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      page = 1,
      limit = 20,
      search,
      dateFrom,
      dateTo,
    } = req.query;

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;
    const skip = (pageNum - 1) * limitNum;

    // Sanitize search string for regex
    const sanitizedSearch = search ? (search as string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : null;
    const searchRegex = sanitizedSearch ? new RegExp(sanitizedSearch, "i") : null;

    const matchQuery: any = {};
    if (dateFrom || dateTo) {
      matchQuery.orderDate = {};
      if (dateFrom) {
        const dFrom = new Date(dateFrom as string);
        if (!isNaN(dFrom.getTime())) matchQuery.orderDate.$gte = dFrom;
      }
      if (dateTo) {
        const dTo = new Date(dateTo as string);
        if (!isNaN(dTo.getTime())) matchQuery.orderDate.$lte = dTo;
      }
      if (Object.keys(matchQuery.orderDate).length === 0) delete matchQuery.orderDate;
    }

    const pipeline: any[] = [
      { $match: matchQuery },
      {
        $lookup: {
          from: "orderitems",
          localField: "_id",
          foreignField: "order",
          as: "items"
        }
      },
      {
        $addFields: {
          noOfItems: { $size: "$items" },
          mode: {
            $cond: {
              if: {
                $or: [
                  { $regexMatch: { input: { $ifNull: ["$adminNotes", ""] }, regex: "pos", options: "i" } },
                  { $eq: ["$deliveryAddress.address", "POS Order"] }
                ]
              },
              then: "POS",
              else: "Retail"
            }
          }
        }
      },
      {
        $unwind: { path: "$items", preserveNullAndEmptyArrays: true }
      },
      {
        $lookup: {
          from: "products",
          localField: "items.product",
          foreignField: "_id",
          as: "productInfo"
        }
      },
      {
        $addFields: {
          "items.purchasePrice": { $ifNull: [{ $arrayElemAt: ["$productInfo.purchasePrice", 0] }, 0] },
          "items.mrp": { $ifNull: [{ $arrayElemAt: ["$productInfo.compareAtPrice", 0] }, "$items.unitPrice"] }
        }
      },
      {
        $group: {
          _id: "$_id",
          date: { $first: { $dateToString: { format: "%Y-%m-%d", date: "$orderDate", onNull: "N/A" } } },
          time: { $first: { $dateToString: { format: "%H:%M", date: "$orderDate", onNull: "N/A" } } },
          invoiceNo: { $first: "$orderNumber" },
          customerName: { $first: "$customerName" },
          paymentMode: { $first: "$paymentMethod" },
          status: { $first: "$status" },
          total: { $first: "$total" },
          noOfItems: { $first: "$noOfItems" },
          mode: { $first: "$mode" },
          totalMRP: { $sum: { $multiply: [{ $ifNull: ["$items.mrp", 0] }, { $ifNull: ["$items.quantity", 0] }] } },
          totalSP: { $sum: { $multiply: [{ $ifNull: ["$items.unitPrice", 0] }, { $ifNull: ["$items.quantity", 0] }] } },
          totalPurchase: { $sum: { $multiply: [{ $ifNull: ["$items.purchasePrice", 0] }, { $ifNull: ["$items.quantity", 0] }] } }
        }
      },
      {
        $addFields: {
          totalDiscount: { $subtract: ["$totalMRP", "$totalSP"] },
          totalDiscountPercent: {
            $cond: {
              if: { $gt: ["$totalMRP", 0] },
              then: { $multiply: [{ $divide: [{ $subtract: ["$totalMRP", "$totalSP"] }, "$totalMRP"] }, 100] },
              else: 0
            }
          },
          profit: { $subtract: ["$totalSP", "$totalPurchase"] }
        }
      },
      ...(searchRegex ? [
        {
          $match: {
            $or: [
              { invoiceNo: searchRegex },
              { customerName: searchRegex }
            ]
          }
        }
      ] : []),
      { $sort: { date: -1, invoiceNo: -1 } },
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

    try {
      const results = await Order.aggregate(pipeline);
      const data = results[0]?.data || [];
      const total = results[0]?.totalCount?.[0]?.count || 0;

      return res.status(200).json({
        success: true,
        message: "Sales summary report fetched successfully",
        data,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      });
    } catch (error: any) {
      console.error("Aggregation Error:", error);
      return res.status(500).json({
        success: false,
        message: "Error generating sales report",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * Get Return and Exchange Report
 */
export const getReturnExchangeReport = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      page = 1,
      limit = 20,
      search,
      dateFrom,
      dateTo,
    } = req.query;

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;
    const skip = (pageNum - 1) * limitNum;

    // Sanitize search string
    const sanitizedSearch = search ? (search as string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : null;
    const searchRegex = sanitizedSearch ? new RegExp(sanitizedSearch, "i") : null;

    const matchQuery: any = {};
    if (dateFrom || dateTo) {
      matchQuery.createdAt = {};
      if (dateFrom) {
        const dFrom = new Date(dateFrom as string);
        if (!isNaN(dFrom.getTime())) matchQuery.createdAt.$gte = dFrom;
      }
      if (dateTo) {
        const dTo = new Date(dateTo as string);
        if (!isNaN(dTo.getTime())) matchQuery.createdAt.$lte = dTo;
      }
      if (Object.keys(matchQuery.createdAt).length === 0) delete matchQuery.createdAt;
    }

    const pipeline: any[] = [
      { $match: matchQuery },
      // Lookup Order
      {
        $lookup: {
          from: "orders",
          localField: "order",
          foreignField: "_id",
          as: "orderDoc"
        }
      },
      { $unwind: { path: "$orderDoc", preserveNullAndEmptyArrays: true } },
      // Lookup Customer
      {
        $lookup: {
          from: "customers",
          localField: "customer",
          foreignField: "_id",
          as: "customerDoc"
        }
      },
      { $unwind: { path: "$customerDoc", preserveNullAndEmptyArrays: true } },
      // Lookup Order Item
      {
        $lookup: {
          from: "orderitems",
          localField: "orderItem",
          foreignField: "_id",
          as: "itemDoc"
        }
      },
      { $unwind: { path: "$itemDoc", preserveNullAndEmptyArrays: true } },
      // Lookup Product for MRP if needed
      {
        $lookup: {
          from: "products",
          localField: "itemDoc.product",
          foreignField: "_id",
          as: "productDoc"
        }
      },
      { $unwind: { path: "$productDoc", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", onNull: "N/A" } },
          saleReturnNo: { $toString: "$_id" }, // Simple conversion for now
          invoiceNo: { $ifNull: ["$orderDoc.orderNumber", "N/A"] },
          customerName: { $ifNull: ["$customerDoc.name", "N/A"] },
          paymentMode: { $ifNull: ["$orderDoc.paymentMethod", "N/A"] },
          noOfItems: { $ifNull: ["$quantity", 0] },
          unitPrice: { $ifNull: ["$itemDoc.unitPrice", 0] },
          mrp: { $ifNull: ["$productDoc.compareAtPrice", { $ifNull: ["$itemDoc.unitPrice", 0] }] },
          quantity: { $ifNull: ["$quantity", 0] },
          refundAmount: 1,
          billAmt: { $ifNull: ["$orderDoc.total", 0] },
          paidBy: { $ifNull: ["$orderDoc.paymentMethod", "N/A"] }
        }
      },
      {
        $addFields: {
          totalMRP: { $multiply: ["$mrp", "$quantity"] },
          totalSP: { $multiply: ["$unitPrice", "$quantity"] },
          saleAmt: { $multiply: ["$unitPrice", "$quantity"] }, // Original sale value of returned items
        }
      },
      {
        $addFields: {
          totalDiscount: { $subtract: ["$totalMRP", "$totalSP"] },
          returnAmt: { $ifNull: ["$refundAmount", "$totalSP"] } // If refundAmount is not set, assume return value is SP
        }
      },
      // Search Filter
      ...(searchRegex ? [
        {
          $match: {
            $or: [
              { invoiceNo: searchRegex },
              { customerName: searchRegex },
              { saleReturnNo: searchRegex }
            ]
          }
        }
      ] : []),
      { $sort: { date: -1, invoiceNo: -1 } },
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

    try {
      const results = await Return.aggregate(pipeline);
      const data = results[0]?.data || [];
      const total = results[0]?.totalCount?.[0]?.count || 0;

      return res.status(200).json({
        success: true,
        message: "Return exchange report fetched successfully",
        data,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      });

    } catch (error: any) {
      console.error("Return Report Aggregation Error:", error);
      return res.status(500).json({
        success: false,
        message: "Error generating return report",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * Get Stock Sales Summary Report
 */
export const getStockSalesSummary = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      page = 1,
      limit = 20,
      search,
      category,
      dateFrom,
      dateTo,
    } = req.query;

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;
    const skip = (pageNum - 1) * limitNum;

    // Sanitize search string
    const sanitizedSearch = search ? (search as string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : null;
    const searchRegex = sanitizedSearch ? new RegExp(sanitizedSearch, "i") : null;

    // Initial Match Stage for Orders
    const matchQuery: any = {
       // status: "Delivered" // Uncomment if strictly delivered only
    };

    // Order Date Filter
    if (dateFrom || dateTo) {
      matchQuery.orderDate = {};
      if (dateFrom) {
        const dFrom = new Date(dateFrom as string);
        if (!isNaN(dFrom.getTime())) matchQuery.orderDate.$gte = dFrom;
      }
      if (dateTo) {
        const dTo = new Date(dateTo as string);
        if (!isNaN(dTo.getTime())) matchQuery.orderDate.$lte = dTo;
      }
      if (Object.keys(matchQuery.orderDate).length === 0) delete matchQuery.orderDate;
    }

    const pipeline: any[] = [
      { $match: matchQuery },

      // Lookup Items
      {
        $lookup: {
          from: "orderitems",
          localField: "_id",
          foreignField: "order",
          as: "itemDoc"
        }
      },
      { $unwind: "$itemDoc" },

      // Lookup Product Details
      {
        $lookup: {
          from: "products",
          localField: "itemDoc.product",
          foreignField: "_id",
          as: "productDoc"
        }
      },
      { $unwind: { path: "$productDoc", preserveNullAndEmptyArrays: true } },

      // Lookup Category
      {
        $lookup: {
          from: "categories",
          localField: "productDoc.category",
          foreignField: "_id",
          as: "categoryDoc"
        }
      },
      { $unwind: { path: "$categoryDoc", preserveNullAndEmptyArrays: true } },

      // Get Tax Info (for GST/Cess)
      {
        $lookup: {
          from: "taxes",
          localField: "productDoc.tax",
          foreignField: "_id",
          as: "taxDoc"
        }
      },
      { $unwind: { path: "$taxDoc", preserveNullAndEmptyArrays: true } },

      // Apply Filters that need Product/Category info (Search, Category Filter)
      ...(category ? [
        {
           $match: { "categoryDoc.name": category }
        }
      ] : []),

      ...(searchRegex ? [
         {
           $match: {
             $or: [
               { "itemDoc.productName": searchRegex },
               { "categoryDoc.name": searchRegex },
               { "productDoc.hsnCode": searchRegex }
             ]
           }
         }
      ] : []),

      // Group by Product/Variant
      {
        $group: {
          _id: {
            prodId: "$productDoc._id",
            variant: "$itemDoc.variation"
          },
          itemName: { $first: "$itemDoc.productName" },
          variantName: { $first: { $ifNull: ["$itemDoc.variation", "Standard"] } },
          uom: { $first: { $ifNull: ["$productDoc.pack", "Piece"] } },
          hsn: { $first: { $ifNull: ["$productDoc.hsnCode", "N/A"] } },
          category: { $first: { $ifNull: ["$categoryDoc.name", "Uncategorized"] } },
          taxPercent: { $first: { $ifNull: ["$taxDoc.percentage", 0] } },

          unitsSold: { $sum: "$itemDoc.quantity" },
          purchasePrice: { $first: { $ifNull: ["$productDoc.purchasePrice", 0] } },
          averageSellingPrice: { $avg: "$itemDoc.unitPrice" },
          totalSellingPrice: { $sum: "$itemDoc.total" },

          // Debug/Extra
          orderDate: { $max: "$orderDate" },
        }
      },

      // Calculate Computed Fields
      {
        $addFields: {
           gst: { $concat: [{ $toString: "$taxPercent" }, "%"] },
           cess: "0%",

           // Profit = Total Sales - (Units * Purchase Price)
           profit: {
             $subtract: [
               "$totalSellingPrice",
               { $multiply: ["$unitsSold", "$purchasePrice"] }
             ]
           },

           // Format prices
           sellingPrice: { $round: ["$averageSellingPrice", 2] }
        }
      },

      // Sort
      { $sort: { totalSellingPrice: -1 } },

      // Pagination Facet
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

    try {
      const results = await Order.aggregate(pipeline);
      const data = results[0]?.data || [];
      const total = results[0]?.totalCount?.[0]?.count || 0;

      return res.status(200).json({
        success: true,
        message: "Stock sales summary fetched successfully",
        data: data.map((item: any) => ({
             ...item,
             _id: `${item._id.prodId}_${item._id.variant || 'std'}`, // Flatten ID for frontend
             salesman: "Admin" // Default for now
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      });

    } catch (error: any) {
      console.error("Stock Sales Summary Error:", error);
      return res.status(500).json({
        success: false,
        message: "Error generating stock sales summary",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

/**
 * Get Due Summary Report
 */
export const getDueSummaryReport = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      page = 1,
      limit = 20,
      search,
      dateFrom,
      dateTo,
    } = req.query;

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 20;
    const skip = (pageNum - 1) * limitNum;

    // Sanitize search string
    const sanitizedSearch = search ? (search as string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : null;
    const searchRegex = sanitizedSearch ? new RegExp(sanitizedSearch, "i") : null;

    const matchQuery: any = {
      // We can filter by paymentStatus if we only want Dues:
      // paymentStatus: { $ne: "Paid" } // But maybe user wants to see history of cleared dues too?
      // "Due Summary" usually just lists debts.
      // But let's follow the dummy data which had "Pending".
      // Let's filter for paymentStatus != 'Paid' OR 'Refunded'?
      // Actually, let's return all and let frontend decide or just filter primarily Pending/Failed.
      // Usually a due report is for unpaid items.
      paymentStatus: { $in: ["Pending", "Failed"] }
    };

    if (dateFrom || dateTo) {
      matchQuery.orderDate = {};
      if (dateFrom) {
        const dFrom = new Date(dateFrom as string);
        if (!isNaN(dFrom.getTime())) matchQuery.orderDate.$gte = dFrom;
      }
      if (dateTo) {
        const dTo = new Date(dateTo as string);
        if (!isNaN(dTo.getTime())) matchQuery.orderDate.$lte = dTo;
      }
      if (Object.keys(matchQuery.orderDate).length === 0) delete matchQuery.orderDate;
    }

    const pipeline: any[] = [
      { $match: matchQuery },
      {
        $project: {
          _id: 1,
          orderNo: "$orderNumber",
          date: { $dateToString: { format: "%Y-%m-%d", date: "$orderDate", onNull: "N/A" } },
          customerName: "$customerName",
          customerPhone: "$customerPhone",
          total: "$total",
          reason: { $ifNull: ["$cancellationReason", "N/A"] },
          status: "$paymentStatus", // This is the payment status
          orderStatus: "$status",
          paymentMode: "$paymentMethod"
        }
      },
      // Calculate Paid/Due based on status
      {
        $addFields: {
          paid: {
             $cond: {
               if: { $eq: ["$status", "Paid"] },
               then: "$total",
               else: 0
             }
          },
          due: {
             $cond: {
               if: { $eq: ["$status", "Paid"] },
               then: 0,
               else: "$total"
             }
          }
        }
      },
      ...(searchRegex ? [
        {
          $match: {
            $or: [
              { orderNo: searchRegex },
              { customerName: searchRegex },
              { customerPhone: searchRegex }
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

    try {
      const results = await Order.aggregate(pipeline);
      const data = results[0]?.data || [];
      const total = results[0]?.totalCount?.[0]?.count || 0;

      return res.status(200).json({
        success: true,
        message: "Due summary fetched successfully",
        data,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      });
    } catch (error: any) {
      console.error("Due Summary Error:", error);
      return res.status(500).json({
        success: false,
        message: "Error generating due summary",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

