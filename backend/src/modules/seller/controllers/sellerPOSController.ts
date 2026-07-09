
import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler } from "../../../utils/asyncHandler";
import Order from "../../../models/Order";
import OrderItem from "../../../models/OrderItem";
import Product from "../../../models/Product";
import Customer from "../../../models/Customer";
import StockLedger from "../../../models/StockLedger";
import CreditTransaction from "../../../models/CreditTransaction";
import SellerPurchaseEntry from "../../../models/SellerPurchaseEntry";
import Seller from "../../../models/Seller";
import SellerPOSState from "../../../models/SellerPOSState";
import SellerOwnedCategory from "../../../models/SellerOwnedCategory";
import SellerOwnedSubCategory from "../../../models/SellerOwnedSubCategory";
import {
  decrementVariantStock,
  getVariantStock,
} from "../../product/variantStockService";
import {
  findVariantById,
  resolveLedgerSku,
  variantsFromProductDoc,
} from "../../product/variantHelpers";
import { initiatePosOnlineOrderCore } from "../../pos/initiatePosOnlineOrder";
import { completePosOnlinePayment } from "../../pos/completePosOnlinePayment";

// ... existing code ...

/**
 * Get all products for POS billing (Seller View - Global Catalog)
 * This allows sellers to search and sell ANY active product in the system.
 */
export const getPOSProducts = asyncHandler(
  async (req: Request, res: Response) => {
    const { search, category, brand } = req.query;
    const query: any = { status: "Active" };

    if (category) query.category = category;
    if (brand) query.brand = brand;

    // Note: We are deliberately NOT filtering by seller: sellerId here
    // based on the requirement to mimic Admin POS search capability.
    // If stricta seller-only inventory is needed later, uncomment:
    // query.seller = (req as any).user.userId;

    if (search) {
        const searchRegex = new RegExp(search as string, "i");
        query.$or = [
            { productName: searchRegex },
            { sku: searchRegex },
            { barcode: searchRegex },
            { "variations.sku": searchRegex },
            { "variations.barcode": searchRegex },
            { itemCode: searchRegex }
        ];
    }

    const products = await Product.find(query)
      .select("productName mainImage price compareAtPrice wholesalePrice purchasePrice discPrice stock sku variations category barcode itemCode seller hsnCode gst tax")
      .populate("category", "name")
      .sort({ productName: 1 })
      .limit(100); // Limit results for performance

    return res.status(200).json({
      success: true,
      message: "POS products fetched successfully",
      data: products
    });
  }
);

/**
 * Create POS Order for Seller
 */
export const createPOSOrder = asyncHandler(
  async (req: Request, res: Response) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { items, paymentMethod, paymentStatus } = req.body;
        let { customerId } = req.body;
        const sellerId = (req as any).user.userId;

        if (!sellerId) {
             throw new Error("Seller not identified");
        }

        // Validate request
        if (!customerId || !items || !items.length || !paymentMethod) {
          return res.status(400).json({
            success: false,
            message: "Missing required fields: customerId, items, paymentMethod",
          });
        }

        // Handle Walk-in Customer
        if (customerId === "walk-in-customer") {
          let walkIn = await Customer.findOne({ email: "walkin@pos.com" }).session(session);
          if (!walkIn) {
               try {
                  walkIn = await Customer.create([{
                    name: "Walk-in Customer",
                    email: "walkin@pos.com",
                    phone: "0000000000",
                    status: "Active",
                  }], { session }) as any;
                  walkIn = walkIn[0];
               } catch (e) {
                   walkIn = await Customer.findOne({ email: "walkin@pos.com" }).session(session);
               }
          }
          if (walkIn) customerId = walkIn._id;
        }

        // Fetch customer
        const customer = await Customer.findById(customerId).session(session);
        if (!customer) {
          return res.status(404).json({
            success: false,
            message: "Customer not found",
          });
        }

        const order = new Order({
          customer: customer._id,
          customerName: customer.name,
          customerEmail: customer.email,
          customerPhone: customer.phone,
          deliveryAddress: {
            address: customer.address || "POS Order",
            city: customer.city || "POS",
            pincode: customer.pincode || "000000",
            state: customer.state || "POS"
          },
          items: [],
          subtotal: 0,
          tax: 0,
          shipping: 0,
          discount: 0,
          total: 0,
          paymentMethod,
          paymentStatus: paymentStatus || "Paid",
          status: "Delivered",
          deliveryBoyStatus: "Delivered",
          deliveredAt: new Date(),
          adminNotes: `POS Order - Seller: ${sellerId}`
        });

        let subtotal = 0;
        const orderItemsIds = [];

        for (const item of items) {
           const soldQty = Number(item.quantity) || 0;
           const unitPrice = Number(item.price);
           const totalItemPrice = unitPrice * soldQty;
           subtotal += totalItemPrice;

           // Handle Database Product vs Quick Add
           const isDbProduct = mongoose.Types.ObjectId.isValid(item.productId);
           let product = null;
           if (isDbProduct) {
               product = await Product.findOne({ _id: item.productId }).session(session);
           }

           let productData = {
               productName: item.name || (product?.productName) || "Quick Add Item",
               mainImage: "",
               sku: (item.sku && String(item.sku).trim()) || "NO-SKU",
           };

           if (product) {
               const variants = variantsFromProductDoc(product);
               const variant = item.variationId
                 ? findVariantById(variants, item.variationId)
                 : variants.length === 1
                   ? variants[0]
                   : undefined;
               productData = {
                   productName: item.name || product.productName,
                   mainImage: variant?.mainImage || (product as any).listing?.imageUrl || "",
                   sku: variant?.sku || productData.sku,
               };
           }

           const payloadHsnCode =
             typeof item.hsnCode === "string" && item.hsnCode.trim()
               ? item.hsnCode.trim()
               : typeof item.hsn === "string" && item.hsn.trim()
                 ? item.hsn.trim()
                 : "";
           const payloadGstRateRaw =
             item.gst !== undefined && item.gst !== null && item.gst !== ""
               ? Number(item.gst)
               : item.gstPercent !== undefined && item.gstPercent !== null && item.gstPercent !== ""
                 ? Number(item.gstPercent)
                 : undefined;
           const resolvedGstRate = Number.isFinite(payloadGstRateRaw as number)
             ? Number(payloadGstRateRaw)
             : Number.isFinite(Number((product as any)?.gst))
               ? Number((product as any).gst)
               : 5;
           const safeGstRate = resolvedGstRate >= 0 ? resolvedGstRate : 5;
           const resolvedHsnCode =
             payloadHsnCode ||
             (typeof (product as any)?.hsnCode === "string" ? String((product as any).hsnCode).trim() : "");
           const resolvedGstAmount = safeGstRate > 0
             ? Number(((totalItemPrice * safeGstRate) / (100 + safeGstRate)).toFixed(2))
             : 0;

           let sku = productData.sku;
           let varId: string | null = null;

           // Deduct stock only if product exists in DB and has resolvable variant
           if (product) {
               const variants = variantsFromProductDoc(product);
               let variantId = item.variationId ? String(item.variationId) : undefined;
               if (variantId && !findVariantById(variants, variantId)) {
                   variantId = undefined;
               }
               if (!variantId && variants.length === 1) {
                   variantId = String(variants[0]._id);
               }

               if (variantId && variants.length) {
                   const variant = findVariantById(variants, variantId)!;
                   sku = (variant.sku && String(variant.sku).trim()) || sku;
                   varId = variantId;

                   const prevStock = await getVariantStock(String(product._id), variantId);
                   const decremented = await decrementVariantStock(
                       String(product._id),
                       variantId,
                       soldQty,
                       { session }
                   );

                   if (decremented) {
                       await StockLedger.create([{
                           product: product._id,
                           variationId: varId,
                           sku: sku || "NO-SKU",
                           quantity: soldQty,
                           type: "OUT",
                           source: "POS",
                           referenceId: order._id,
                           previousStock: prevStock,
                           newStock: Math.max(0, prevStock - soldQty),
                           seller: sellerId
                       }], { session });
                   } else {
                       console.warn(`Seller POS stock decrement failed for ${product._id}/${variantId}`);
                   }
               } else if (variants.length === 0) {
                   console.warn(`Seller POS stock skip: product ${product._id} has no variants`);
               }
           }

           const orderItem = new OrderItem({
             order: order._id,
             product: product?._id,
             seller: product?.seller || sellerId,
             productName: productData.productName,
             productImage: productData.mainImage,
             sku: sku || "NO-SKU",
             hsnCode: resolvedHsnCode,
             gst: safeGstRate,
             unitPrice: unitPrice,
             quantity: soldQty,
             total: totalItemPrice,
             gstAmount: resolvedGstAmount,
             status: "Delivered",
             warrantyType: item.warrantyType || product?.warrantyType || "None",
             warrantyDuration: item.warrantyDuration || product?.warrantyDuration || ""
           });

           if (varId && product) {
                const variants = variantsFromProductDoc(product);
                const v = findVariantById(variants, varId);
                if (v) {
                  orderItem.variation = `${v.name || v.variationType || "Variation"}: ${v.value}`;
                  orderItem.variantId = v._id as any;
                }
           } else if (item.variationName) {
                orderItem.variation = item.variationName;
           }

           await orderItem.save({ session });
           orderItemsIds.push(orderItem._id);
        }

        order.items = orderItemsIds as any;
        order.subtotal = subtotal;
        order.total = subtotal;

        if (paymentMethod === 'Credit') {
            order.paymentStatus = 'Pending';
        }

        await order.save({ session });

        if (paymentMethod === 'Credit') {
            customer.creditBalance = (customer.creditBalance || 0) + order.total;
            await customer.save({ session });

            await CreditTransaction.create([{
                customer: customer._id,
                type: 'Order',
                amount: order.total,
                balanceAfter: customer.creditBalance,
                description: `POS Order #${order.orderNumber} (Seller)`,
                referenceId: order._id.toString(),
                date: new Date(),
                createdBy: sellerId
            }], { session });
        }

        await session.commitTransaction();
        session.endSession();

        return res.status(201).json({
            success: true,
            message: "POS Order created successfully",
            data: order
        });

    } catch (error: any) {
        await session.abortTransaction();
        session.endSession();
        console.error("Seller createPOSOrder CRASH:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });
    }
  }
);

export const initiatePOSOnlineOrder = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const { items, gateway } = req.body;
    let { customerId } = req.body;

    if (!customerId || !items?.length) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    try {
      const data = await initiatePosOnlineOrderCore({
        customerId,
        items,
        gateway,
        sellerId,
        redirectPathPrefix: "/seller",
      });

      return res.status(200).json({ success: true, data });
    } catch (error: any) {
      console.error("Seller PhonePe POS Error:", error.message || error);
      return res.status(500).json({
        success: false,
        message: error.message || "PhonePe gateway error",
      });
    }
  }
);

export const verifyPOSPayment = asyncHandler(
  async (req: Request, res: Response) => {
    const { orderId, paymentId, merchantTransactionId } = req.body;
    const paymentRef = merchantTransactionId || paymentId;

    const result = await completePosOnlinePayment(req, orderId, paymentRef);
    if (!result.success) {
      return res.status(result.message === "Order not found" ? 404 : 400).json({
        success: false,
        message: result.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: result.message,
    });
  }
);

export const getPOSReport = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const { start, end } = req.query;

    const summaryQuery: any = {
       'adminNotes': { $regex: 'POS', $options: 'i' },
    };

    summaryQuery.adminNotes = { $regex: `POS Order - Seller: ${sellerId}`, $options: 'i' };

    if (start && end) {
        summaryQuery.orderDate = {
            $gte: new Date(start as string),
            $lte: new Date(end as string)
        };
    }

    const summary = await Order.aggregate([
      { $match: summaryQuery },
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$total" },
          totalOrders: { $count: {} },
          cashSales: {
            $sum: { $cond: [{ $eq: ["$paymentMethod", "Cash"] }, "$total", 0] }
          },
          onlineSales: {
            $sum: { $cond: [{ $ne: ["$paymentMethod", "Cash"] }, "$total", 0] }
          },
          unpaidAmount: {
             $sum: { $cond: [{ $eq: ["$paymentStatus", "Pending"] }, "$total", 0] }
          }
        }
      }
    ]);

    const recentOrders = await Order.find({ ...summaryQuery })
      .sort({ orderDate: -1 })
      .limit(50)
      .populate("customer", "name phone");

    return res.status(200).json({
      success: true,
      data: {
        summary: summary[0] || { totalSales: 0, totalOrders: 0, cashSales: 0, onlineSales: 0, unpaidAmount: 0 },
        orders: recentOrders
      }
    });
  }
);

export const getPOSStockLedger = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const { page = 1, limit = 50, productId, type, startDate, endDate } = req.query;

    const query: any = { seller: sellerId };

    if (productId) query.product = productId;
    if (type) query.type = type;

    if (startDate && endDate) {
        const start = new Date(startDate as string);
        const end = new Date(endDate as string);
        query.createdAt = { $gte: start, $lte: end };
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [ledger, total] = await Promise.all([
      StockLedger.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit as string))
        .populate("product", "productName mainImage sku"),
      StockLedger.countDocuments(query)
    ]);

    return res.status(200).json({
      success: true,
      data: ledger,
      pagination: {
        total,
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        pages: Math.ceil(total / parseInt(limit as string))
      }
    });
  }
);

/**
 * Get seller purchase/quotation entries
 */
export const getSellerPurchaseEntries = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const { type } = req.query;
    const query: any = { seller: sellerId };
    if (type === "purchase" || type === "quotation") {
      query.type = type;
    }

    const entries = await SellerPurchaseEntry.find(query)
      .sort({ updatedAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      message: "Purchase entries fetched successfully",
      data: entries.map((entry) => {
        const payload = (entry.data || {}) as any;
        return {
          ...payload,
          id: payload.id || entry.entryId,
          type: payload.type || entry.type,
          date: payload.date || entry.date || "",
        };
      }),
    });
  }
);

/**
 * Create or update seller purchase/quotation entry
 */
export const upsertSellerPurchaseEntry = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const entry = req.body;

    if (!entry || !entry.id) {
      return res.status(400).json({
        success: false,
        message: "Entry id is required",
      });
    }

    const type = entry.type === "quotation" ? "quotation" : "purchase";

    const saved = await SellerPurchaseEntry.findOneAndUpdate(
      { seller: sellerId, entryId: String(entry.id) },
      {
        seller: sellerId,
        entryId: String(entry.id),
        type,
        date: entry.date || "",
        data: entry,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    return res.status(200).json({
      success: true,
      message: "Purchase entry saved successfully",
      data: {
        ...(saved?.data || entry),
        id: (saved?.data as any)?.id || saved?.entryId || String(entry.id),
      },
    });
  }
);

/**
 * Delete seller purchase/quotation entry
 */
export const deleteSellerPurchaseEntry = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const { entryId } = req.params;

    const deleted = await SellerPurchaseEntry.findOneAndDelete({
      seller: sellerId,
      entryId,
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Purchase entry not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Purchase entry deleted successfully",
    });
  }
);

/**
 * Get seller bill settings
 */
export const getSellerBillSettings = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const seller = await Seller.findById(sellerId).select("billSettings").lean();

    if (!seller) {
      return res.status(404).json({
        success: false,
        message: "Seller not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Seller bill settings fetched successfully",
      data: seller.billSettings || null,
    });
  }
);

/**
 * Update seller bill settings
 */
export const updateSellerBillSettings = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const billSettings = req.body;

    const seller = await Seller.findById(sellerId);
    if (!seller) {
      return res.status(404).json({
        success: false,
        message: "Seller not found",
      });
    }

    seller.billSettings = {
      shopName: billSettings?.shopName || "",
      address: billSettings?.address || "",
      phone: billSettings?.phone || "",
      notes: {
        text: billSettings?.notes?.text || "Thank you for your business",
        enabled: !!billSettings?.notes?.enabled,
      },
      terms: {
        text:
          billSettings?.terms?.text ||
          "Goods once sold will not be taken back.",
        enabled: !!billSettings?.terms?.enabled,
      },
      gst: {
        text: billSettings?.gst?.text || "",
        enabled: !!billSettings?.gst?.enabled,
      },
      fssai: {
        text: billSettings?.fssai?.text || "",
        enabled: !!billSettings?.fssai?.enabled,
      },
    } as any;

    await seller.save();

    return res.status(200).json({
      success: true,
      message: "Seller bill settings updated successfully",
      data: seller.billSettings,
    });
  }
);

/**
 * Get seller POS UI state (bills + active bill id)
 */
export const getSellerPOSState = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const state = await SellerPOSState.findOne({ seller: sellerId }).lean();

    return res.status(200).json({
      success: true,
      message: "POS state fetched successfully",
      data: state
        ? { bills: state.bills || [], activeBillId: state.activeBillId || "1" }
        : { bills: [], activeBillId: "1" },
    });
  }
);

/**
 * Upsert seller POS UI state
 */
export const upsertSellerPOSState = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const { bills, activeBillId } = req.body || {};

    const nextBills = Array.isArray(bills) ? bills : [];
    const nextActive = typeof activeBillId === "string" ? activeBillId : "1";

    const saved = await SellerPOSState.findOneAndUpdate(
      { seller: sellerId },
      { seller: sellerId, bills: nextBills, activeBillId: nextActive },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    return res.status(200).json({
      success: true,
      message: "POS state updated successfully",
      data: { bills: saved?.bills || [], activeBillId: saved?.activeBillId || "1" },
    });
  }
);

/**
 * Seller-owned categories (separate from global admin categories)
 */
export const getSellerOwnCategories = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const rows = await SellerOwnedCategory.find({ seller: sellerId })
      .sort({ updatedAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      message: "Seller own categories fetched successfully",
      data: rows,
    });
  }
);

const ensureSellerCanCreateCategories = async (sellerId: string) => {
  const seller = await Seller.findById(sellerId).select("canCreateCategories").lean();
  if (!seller) {
    const err: any = new Error("Seller not found");
    err.statusCode = 404;
    throw err;
  }
  if (!seller.canCreateCategories) {
    const err: any = new Error("Category creation is disabled for this seller");
    err.statusCode = 403;
    throw err;
  }
};

export const createSellerOwnCategory = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const payload = req.body || {};

    await ensureSellerCanCreateCategories(sellerId);

    if (payload.parentId) {
      const parent = await SellerOwnedCategory.findOne({
        _id: payload.parentId,
        seller: sellerId,
      })
        .select("_id")
        .lean();
      if (!parent) {
        return res.status(404).json({
          success: false,
          message: "Parent category not found",
        });
      }
    }

    const created = await SellerOwnedCategory.create({
      seller: sellerId,
      name: payload.name?.trim(),
      image: payload.image || "",
      order: payload.order || 0,
      parentId: payload.parentId || null,
      headerCategoryId: payload.headerCategoryId || null,
      status: payload.status === "Inactive" ? "Inactive" : "Active",
      isBestseller: !!payload.isBestseller,
      hasWarning: !!payload.hasWarning,
      groupCategory: payload.groupCategory || "",
      description: payload.description || "",
    });

    return res.status(201).json({
      success: true,
      message: "Seller category created successfully",
      data: created.toObject(),
    });
  }
);

export const updateSellerOwnCategory = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const { id } = req.params;
    const payload = req.body || {};

    await ensureSellerCanCreateCategories(sellerId);

    if (payload.parentId) {
      if (String(payload.parentId) === String(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid parent category",
        });
      }
      const parent = await SellerOwnedCategory.findOne({
        _id: payload.parentId,
        seller: sellerId,
      })
        .select("_id")
        .lean();
      if (!parent) {
        return res.status(404).json({
          success: false,
          message: "Parent category not found",
        });
      }
    }

    const updated = await SellerOwnedCategory.findOneAndUpdate(
      { _id: id, seller: sellerId },
      {
        name: payload.name?.trim(),
        image: payload.image || "",
        order: payload.order || 0,
        parentId: payload.parentId || null,
        headerCategoryId: payload.headerCategoryId || null,
        status: payload.status === "Inactive" ? "Inactive" : "Active",
        isBestseller: !!payload.isBestseller,
        hasWarning: !!payload.hasWarning,
        groupCategory: payload.groupCategory || "",
        description: payload.description || "",
      },
      { new: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Seller category not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Seller category updated successfully",
      data: updated,
    });
  }
);

export const deleteSellerOwnCategory = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const { id } = req.params;

    await ensureSellerCanCreateCategories(sellerId);

    const deleted = await SellerOwnedCategory.findOneAndDelete({
      _id: id,
      seller: sellerId,
    }).lean();

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Seller category not found",
      });
    }

    await SellerOwnedSubCategory.deleteMany({ seller: sellerId, parentId: id });

    return res.status(200).json({
      success: true,
      message: "Seller category deleted successfully",
    });
  }
);

/**
 * Seller-owned subcategories
 */
export const getSellerOwnSubCategories = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const rows = await SellerOwnedSubCategory.find({ seller: sellerId })
      .sort({ updatedAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      message: "Seller own subcategories fetched successfully",
      data: rows.map((row) => ({
        _id: row._id,
        categoryName: row.categoryName,
        subcategoryName: row.subcategoryName,
        subcategoryImage: row.subcategoryImage || "",
        totalProduct: 0,
        parentId: row.parentId,
      })),
    });
  }
);

export const createSellerOwnSubCategory = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const payload = req.body || {};

    await ensureSellerCanCreateCategories(sellerId);

    if (!payload.parentId || !payload.subcategoryName) {
      return res.status(400).json({
        success: false,
        message: "parentId and subcategoryName are required",
      });
    }

    const parent = await SellerOwnedCategory.findOne({
      _id: payload.parentId,
      seller: sellerId,
    }).lean();
    if (!parent) {
      return res.status(404).json({
        success: false,
        message: "Parent category not found",
      });
    }

    const created = await SellerOwnedSubCategory.create({
      seller: sellerId,
      parentId: payload.parentId,
      categoryName: parent.name,
      subcategoryName: payload.subcategoryName?.trim(),
      subcategoryImage: payload.subcategoryImage || "",
      order: payload.order || 0,
      status: payload.status === "Inactive" ? "Inactive" : "Active",
    });

    return res.status(201).json({
      success: true,
      message: "Seller subcategory created successfully",
      data: {
        _id: created._id,
        categoryName: created.categoryName,
        subcategoryName: created.subcategoryName,
        subcategoryImage: created.subcategoryImage || "",
        totalProduct: 0,
        parentId: created.parentId,
      },
    });
  }
);
