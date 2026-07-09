import { Request, Response } from "express";
import mongoose from "mongoose";
import axios from "axios";
import { asyncHandler } from "../../../utils/asyncHandler";
import Order from "../../../models/Order";
import OrderItem from "../../../models/OrderItem";
import Delivery from "../../../models/Delivery";
import DeliveryAssignment from "../../../models/DeliveryAssignment";
import Return from "../../../models/Return";
import { notifySellersOfOrderUpdate } from "../../../services/sellerNotificationService";
import Product from "../../../models/Product";
import Customer from "../../../models/Customer";
import { Server as SocketIOServer } from "socket.io";
import StockLedger from "../../../models/StockLedger";
import CreditTransaction from "../../../models/CreditTransaction";
import {
  decrementVariantStock,
  getVariantStock,
  incrementVariantStock,
} from "../../product/variantStockService";
import {
  findVariantById,
  resolveLedgerSku,
  resolveOrderItemVariantId,
  variantsFromProductDoc,
} from "../../product/variantHelpers";
import {
  buildPhonePeMerchantTransactionId,
  initiatePhonePePayment,
  isPhonePeConfigured,
} from "../../../services/phonepeService";
import { completePosOnlinePayment } from "../../pos/completePosOnlinePayment";

/**
 * Get all orders with filters
 */
export const getAllOrders = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      page = 1,
      limit = 10,
      status,
      paymentStatus,
      seller,
      dateFrom,
      dateTo,
      search,
    } = req.query;

    const query: any = {};

    if (status) query.status = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (dateFrom || dateTo) {
      query.orderDate = {};
      if (dateFrom) query.orderDate.$gte = new Date(dateFrom as string);
      if (dateTo) query.orderDate.$lte = new Date(dateTo as string);
    }
    if (search) {
      query.$or = [
        { orderNumber: { $regex: search as string, $options: "i" } },
        { customerName: { $regex: search as string, $options: "i" } },
        { customerEmail: { $regex: search as string, $options: "i" } },
        { customerPhone: { $regex: search as string, $options: "i" } },
      ];
    }

    // If seller filter, need to check order items
    if (seller) {
      const orderItems = await OrderItem.find({ seller }).distinct("order");
      query._id = { $in: orderItems };
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate("customer", "name email phone")
        .populate("deliveryBoy", "name mobile")
        .populate("items")
        .sort({ orderDate: -1 })
        .skip(skip)
        .limit(parseInt(limit as string)),
      Order.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      message: "Orders fetched successfully",
      data: orders,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  }
);

/**
 * Get online orders only (excluding POS) with filters for reports
 */
export const getOnlineOrders = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      page = 1,
      limit = 10,
      status,
      paymentStatus,
      paymentMethod,
      dateFrom,
      dateTo,
      search,
    } = req.query;

    const query: any = {
      $and: [
        { adminNotes: { $not: { $regex: "pos", $options: "i" } } },
        { "deliveryAddress.address": { $ne: "POS Order" } }
      ]
    };

    if (status && status !== "All Status") query.status = status;
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (paymentMethod) query.paymentMethod = paymentMethod;

    if (dateFrom || dateTo) {
      query.orderDate = {};
      if (dateFrom) query.orderDate.$gte = new Date(dateFrom as string);
      if (dateTo) query.orderDate.$lte = new Date(dateTo as string);
    }

    if (search) {
      const searchRegex = { $regex: search as string, $options: "i" };
      query.$or = [
        { orderNumber: searchRegex },
        { customerName: searchRegex },
        { customerEmail: searchRegex },
        { customerPhone: searchRegex },
        { paymentMethod: searchRegex },
        { paymentStatus: searchRegex }
      ];
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate("customer", "name email phone")
        .sort({ orderDate: -1 })
        .skip(skip)
        .limit(parseInt(limit as string)),
      Order.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      message: "Online orders fetched successfully",
      data: orders,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  }
);

/**
 * Get POS orders only with filters for reports
 */
export const getPOSOrders = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      page = 1,
      limit = 10,
      status,
      paymentMethod,
      dateFrom,
      dateTo,
      search,
    } = req.query;

    const query: any = {
      $and: [
        {
          $or: [
            { adminNotes: { $regex: "pos", $options: "i" } },
            { "deliveryAddress.address": "POS Order" }
          ]
        },
        {
          adminNotes: { $not: { $regex: "POS Order - Seller:", $options: "i" } }
        }
      ]
    };

    if (status) query.status = status;
    if (paymentMethod && paymentMethod !== "All Methods") query.paymentMethod = paymentMethod;

    if (dateFrom || dateTo) {
      query.orderDate = {};
      if (dateFrom) query.orderDate.$gte = new Date(dateFrom as string);
      if (dateTo) query.orderDate.$lte = new Date(dateTo as string);
    }

    if (search) {
      const searchRegex = { $regex: search as string, $options: "i" };
      query.$and.push({
        $or: [
          { orderNumber: searchRegex },
          { customerName: searchRegex },
          { customerEmail: searchRegex },
          { customerPhone: searchRegex },
          { paymentMethod: searchRegex }
        ]
      });
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate("customer", "name email phone")
        .sort({ orderDate: -1 })
        .skip(skip)
        .limit(parseInt(limit as string)),
      Order.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      message: "POS orders fetched successfully",
      data: orders,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  }
);

/**
 * Get order by ID
 */
export const getOrderById = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const order = await Order.findById(id)
      .populate("customer", "name email phone")
      .populate("deliveryBoy", "name mobile email")
      .populate({
        path: "items",
        populate: [
          {
            path: "product",
            select: "productName mainImage price compareAtPrice wholesalePrice variations",
          },
          {
            path: "seller",
            select: "sellerName storeName",
          },
        ],
      })
      .populate("cancelledBy", "firstName lastName");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Order fetched successfully",
      data: order,
    });
  }
);

/**
 * Update order status
 */
export const updateOrderStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, adminNotes } = req.body;

    const validStatuses = [
      "Received",
      "Pending",
      "Processed",
      "Shipped",
      "Out for Delivery",
      "Delivered",
      "Cancelled",
      "Rejected",
      "Returned",
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    const updateData: any = { status };
    if (adminNotes) updateData.adminNotes = adminNotes;

    if (status === "Delivered") {
      updateData.deliveredAt = new Date();
    }

    if (status === "Cancelled") {
      updateData.cancelledAt = new Date();
      updateData.cancelledBy = req.user?.userId;
    }

    const order = await Order.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    })
      .populate("customer", "name email phone")
      .populate("deliveryBoy", "name mobile")
      .populate("items");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Trigger notification if status is "Processed" (Confirmed) or if paymentStatus changed to "Paid"
    if (status === "Processed" || order.paymentStatus === "Paid") {
      const io: SocketIOServer = req.app.get("io");
      if (io) {
        notifySellersOfOrderUpdate(io, order, "STATUS_UPDATE");
      }
    }

    return res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      data: order,
    });
  }
);

/**
 * Update order items (Edit Order)
 */
export const updateOrderItems = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { items: newItemsData } = req.body; // Array of { productId, variationId?, quantity, unitPrice?, mrp?, productName?, productImage? }

    if (!newItemsData || !Array.isArray(newItemsData) || newItemsData.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Items are required and must be an array",
      });
    }

    const order = await Order.findById(id).populate("items");
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Do not allow editing if already cancelled or returned, but ALLOW Delivered
    // We explicitly allow Delivered to fix mistakes on completed bills.
    const restrictedStatuses = ["Cancelled", "Returned"];
    if (restrictedStatuses.includes(order.status)) {
       return res.status(400).json({
           success: false,
           message: `Cannot edit order when status is ${order.status}`
       });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const userId = req.user?.userId;
      const userType = req.user?.userType;

      // Permission Check for Sellers
      if (userType === 'Seller') {
        const isTheirPOSOrder = order.adminNotes?.includes(`POS Order - Seller: ${userId}`);
        // Check if seller owns any items in the order (for online orders if we ever allow editing them)
        const sellerItems = await OrderItem.find({ order: order._id, seller: userId });
        
        if (!isTheirPOSOrder && (!sellerItems || sellerItems.length === 0)) {
           return res.status(403).json({
               success: false,
               message: "Access denied. You can only edit your own POS orders."
           });
        }
      }

      const stockModifierField = userType === 'Admin' ? 'admin' : 'seller';

      // 1. Restore stock for existing items
      const existingItems = await OrderItem.find({ order: order._id }).session(session);
      for (const item of existingItems) {
        if (!item.product) continue;

        const productId = String(item.product);
        const qty = Number(item.quantity) || 0;
        if (qty <= 0) continue;

        const product = await Product.findById(productId).lean().session(session);
        if (!product) continue;

        const variantId = resolveOrderItemVariantId(product, {
          variantId: (item as any).variantId,
          sku: item.sku,
          variation: item.variation,
          productName: item.productName,
          unitPrice: item.unitPrice,
        });

        if (!variantId) {
          console.warn(`Order edit restore skip: no variant for product ${productId}`);
          continue;
        }

        const prevStock = await getVariantStock(productId, variantId);
        const restored = await incrementVariantStock(productId, variantId, qty, {
          session,
        });

        if (restored) {
          await StockLedger.create(
            [
              {
                product: productId,
                variationId: variantId,
                sku: resolveLedgerSku(item.sku),
                quantity: qty,
                type: "IN",
                source: "ORDER_EDIT_RESTORE",
                referenceId: order._id,
                previousStock: prevStock,
                newStock: prevStock + qty,
                [stockModifierField]: userId,
              },
            ],
            { session }
          );
        }
      }

      // 2. Delete old OrderItems
      await OrderItem.deleteMany({ order: order._id }).session(session);

      // 3. Create new OrderItems and deduct stock
      let newSubtotal = 0;
      let newTaxTotal = 0;
      const newItemIds = [];

      for (let itemIndex = 0; itemIndex < newItemsData.length; itemIndex++) {
        const itemData = newItemsData[itemIndex];
        const quantity = Number(itemData.quantity) || 0; // Force number
        const normalizedProductId = typeof itemData.productId === "string" ? itemData.productId.trim() : "";
        const normalizedVariationId = typeof itemData.variationId === "string" ? itemData.variationId.trim() : "";
        const normalizedSku = typeof itemData.sku === "string" ? itemData.sku.trim() : "";
        const snapshotProductName = typeof itemData.productName === "string" ? itemData.productName.trim() : "";
        const fallbackNameFromPayload =
          typeof itemData.name === "string"
            ? itemData.name.trim()
            : typeof itemData.title === "string"
              ? itemData.title.trim()
              : "";
        const snapshotProductImage = typeof itemData.productImage === "string" ? itemData.productImage.trim() : "";

        let product = null;

        if (normalizedProductId && mongoose.Types.ObjectId.isValid(normalizedProductId)) {
          product = await Product.findById(normalizedProductId).populate("seller").session(session);
        }

        if (!product && normalizedSku) {
          product = await Product.findOne({
            $or: [
              { sku: normalizedSku },
              { "variations.sku": normalizedSku }
            ]
          }).populate("seller").session(session);
        }

        if (!product) {
          const fallbackProductName =
            snapshotProductName ||
            fallbackNameFromPayload ||
            normalizedSku ||
            `Custom Item ${itemIndex + 1}`;

          const customUnitPrice = Number(itemData.unitPrice) || 0;
          const customMrp = Number(itemData.mrp) || 0;
          const customVariationLabel =
            typeof itemData.variation === "string"
              ? itemData.variation.trim()
              : !mongoose.Types.ObjectId.isValid(normalizedVariationId)
                ? normalizedVariationId
                : "";
          const customTotal = customUnitPrice * quantity;
          newSubtotal += customTotal;

          // GST is treated as inclusive in the unit price (consistent with retail invoice flow)
          const customGstRate = itemData.gst !== undefined && itemData.gst !== null && itemData.gst !== ""
            ? Number(itemData.gst)
            : 5;
          const safeCustomGstRate = Number.isFinite(customGstRate) && customGstRate >= 0 ? customGstRate : 5;
          const customGstAmount = safeCustomGstRate > 0
            ? Number(((customTotal * safeCustomGstRate) / (100 + safeCustomGstRate)).toFixed(2))
            : 0;
          newTaxTotal += customGstAmount;

          const detachedOrderItem = new OrderItem({
            order: order._id,
            productName: fallbackProductName,
            productImage: snapshotProductImage,
            sku: normalizedSku,
            mrp: customMrp,
            unitPrice: customUnitPrice,
            quantity,
            total: customTotal,
            hsnCode: typeof itemData.hsnCode === "string" ? itemData.hsnCode.trim() : "",
            gst: safeCustomGstRate,
            gstAmount: customGstAmount,
            variation: customVariationLabel,
            status: "Pending",
            warrantyType: itemData.warrantyType || "None",
            warrantyDuration: itemData.warrantyDuration || ""
          });

          await detachedOrderItem.save({ session });
          newItemIds.push(detachedOrderItem._id);
          continue;
        }

        let unitPrice = Number(itemData.unitPrice) || (product as any).price || 0;
        let mrp = Number(itemData.mrp) || Number((product as any).compareAtPrice) || 0;
        let variationName = "";
        let sku = normalizedSku || (product as any).sku || "NO-SKU";
        let resolvedVariantId: string | undefined;

        const variants = variantsFromProductDoc(product);
        resolvedVariantId = resolveOrderItemVariantId(product, {
          variationId: normalizedVariationId,
          sku: normalizedSku,
          variation:
            typeof itemData.variation === "string" ? itemData.variation : undefined,
          productName: snapshotProductName || product.productName,
          unitPrice: Number(itemData.unitPrice),
        });

        const foundVariation = resolvedVariantId
          ? findVariantById(variants, resolvedVariantId)
          : undefined;

        if (foundVariation) {
          unitPrice =
            Number(itemData.unitPrice) ||
            Number(foundVariation.discPrice ?? foundVariation.price) ||
            unitPrice;
          mrp =
            Number(itemData.mrp) ||
            Number(foundVariation.compareAtPrice) ||
            Number((product as any).compareAtPrice) ||
            mrp;
          variationName = `${foundVariation.name || foundVariation.variationType || "Variant"}: ${foundVariation.value}`;
          sku = foundVariation.sku || sku;
        }

        const total = unitPrice * quantity;
        newSubtotal += total;

        if (resolvedVariantId && quantity > 0) {
          const prevStock = await getVariantStock(String(product._id), resolvedVariantId);
          const decremented = await decrementVariantStock(
            String(product._id),
            resolvedVariantId,
            quantity,
            { session }
          );

          if (decremented) {
            await StockLedger.create(
              [
                {
                  product: product._id,
                  variationId: resolvedVariantId,
                  sku: resolveLedgerSku(sku, foundVariation?.sku, normalizedSku),
                  quantity,
                  type: "OUT",
                  source: "ORDER_EDIT_DEDUCT",
                  referenceId: order._id,
                  previousStock: prevStock,
                  newStock: Math.max(0, prevStock - quantity),
                  [stockModifierField]: userId,
                },
              ],
              { session }
            );
          }
        }

        // Resolve GST rate: explicit payload value > product default > 5%
        const payloadGstProvided =
          itemData.gst !== undefined && itemData.gst !== null && itemData.gst !== "";
        const productGstRate =
          (product as any).gst !== undefined && (product as any).gst !== null
            ? Number((product as any).gst)
            : NaN;
        const resolvedGstRate = payloadGstProvided
          ? Number(itemData.gst)
          : Number.isFinite(productGstRate)
            ? productGstRate
            : 5;
        const safeGstRate = Number.isFinite(resolvedGstRate) && resolvedGstRate >= 0 ? resolvedGstRate : 5;

        // GST is inclusive in the unit price (B2C retail behaviour)
        const lineGstAmount = safeGstRate > 0
          ? Number(((total * safeGstRate) / (100 + safeGstRate)).toFixed(2))
          : 0;
        newTaxTotal += lineGstAmount;

        const resolvedHsnCode =
          typeof itemData.hsnCode === "string" && itemData.hsnCode.trim()
            ? itemData.hsnCode.trim()
            : (product as any).hsnCode || "";

        const newOrderItem = new OrderItem({
          order: order._id,
          product: product._id,
          seller: (product.seller as any)?._id || product.seller,
          productName: snapshotProductName || product.productName,
          productImage: snapshotProductImage || (product as any).mainImage,
          sku: sku,
          mrp: mrp,
          unitPrice: unitPrice,
          quantity: quantity,
          total: total,
          hsnCode: resolvedHsnCode,
          gst: safeGstRate,
          gstAmount: lineGstAmount,
          variation: variationName,
          status: "Pending",
          warrantyType: itemData.warrantyType || product.warrantyType || "None",
          warrantyDuration: itemData.warrantyDuration || product.warrantyDuration || "",
          ...(resolvedVariantId ? { variantId: resolvedVariantId } : {}),
        });

        await newOrderItem.save({ session });
        newItemIds.push(newOrderItem._id);
      }

      // 4. Update Order
      const { 
        customerId, 
        customerName: newCustomerName, 
        customerPhone: newCustomerPhone, 
        customerEmail: newCustomerEmail, 
        paymentMethod: newPaymentMethod 
      } = req.body;

      // Handle Credit Adjustment for Old State
      if (order.paymentMethod === 'Credit' && order.customer) {
        const oldCustomer = await Customer.findById(order.customer).session(session);
        if (oldCustomer) {
          oldCustomer.creditBalance = Math.max(0, (oldCustomer.creditBalance || 0) - (order.total || 0));
          await oldCustomer.save({ session });
          // Delete old transaction
          await CreditTransaction.deleteMany({ referenceId: order._id.toString(), type: 'Order' }).session(session);
        }
      }

      // Update Order Fields
      if (customerId && mongoose.Types.ObjectId.isValid(customerId)) {
        const newCustomer = await Customer.findById(customerId).session(session);
        if (newCustomer) {
          order.customer = newCustomer._id;
          order.customerName = newCustomer.name;
          order.customerEmail = newCustomer.email;
          order.customerPhone = newCustomer.phone;
        }
      } else if (newCustomerName) {
        order.customerName = newCustomerName;
        if (newCustomerPhone) order.customerPhone = newCustomerPhone;
        if (newCustomerEmail) order.customerEmail = newCustomerEmail;
      }

      if (newPaymentMethod) {
        order.paymentMethod = newPaymentMethod;
        order.paymentStatus = newPaymentMethod === 'Credit' ? 'Pending' : (order.paymentStatus || 'Paid');
      }

      order.items = newItemIds as any;
      order.subtotal = newSubtotal;
      // Recompute tax from line-level GST (inclusive in unit price).
      // Subtotal already includes tax for GST-inclusive pricing, so we don't add it again to total.
      order.tax = Number(newTaxTotal.toFixed(2));
      order.total = newSubtotal + (order.shipping || 0) - (order.discount || 0);

      await order.save({ session });

      // Handle Credit Adjustment for New State
      if (order.paymentMethod === 'Credit' && order.customer) {
        const finalCustomer = await Customer.findById(order.customer).session(session);
        if (finalCustomer) {
          finalCustomer.creditBalance = (finalCustomer.creditBalance || 0) + order.total;
          await finalCustomer.save({ session });

          await CreditTransaction.create([{
            customer: finalCustomer._id,
            type: 'Order',
            amount: order.total,
            balanceAfter: finalCustomer.creditBalance,
            description: `POS Order #${order.orderNumber} (Updated)`,
            referenceId: order._id.toString(),
            date: new Date(),
            createdBy: userId
          }], { session });
        }
      }

      await session.commitTransaction();
      session.endSession();

      const updatedOrder = await Order.findById(id).populate({
        path: "items",
        populate: [
          { path: "product", select: "productName mainImage price compareAtPrice wholesalePrice variations" },
          { path: "seller", select: "sellerName storeName" }
        ]
      });

      return res.status(200).json({
        success: true,
        message: "Order items updated successfully",
        data: updatedOrder,
      });

    } catch (error: any) {
      await session.abortTransaction();
      session.endSession();
      console.error("UpdateOrderItems Error:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Failed to update order items",
      });
    }
  }
);

/**
 * Assign delivery boy to order
 */
export const assignDeliveryBoy = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { deliveryBoyId } = req.body;

    if (!deliveryBoyId) {
      return res.status(400).json({
        success: false,
        message: "Delivery boy ID is required",
      });
    }

    // Verify delivery boy exists and is active
    const deliveryBoy = await Delivery.findById(deliveryBoyId);
    if (!deliveryBoy) {
      return res.status(404).json({
        success: false,
        message: "Delivery boy not found",
      });
    }

    if (deliveryBoy.status !== "Active") {
      return res.status(400).json({
        success: false,
        message: "Delivery boy is not active",
      });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Update order
    order.deliveryBoy = deliveryBoyId as any;
    order.deliveryBoyStatus = "Assigned";
    order.assignedAt = new Date();
    await order.save();

    // Create or update delivery assignment
    await DeliveryAssignment.findOneAndUpdate(
      { order: id },
      {
        order: id,
        deliveryBoy: deliveryBoyId,
        assignedAt: new Date(),
        assignedBy: req.user?.userId,
        status: "Assigned",
      },
      { upsert: true, new: true }
    );

    const updatedOrder = await Order.findById(id)
      .populate("customer", "name email phone")
      .populate("deliveryBoy", "name mobile email")
      .populate("items");

    return res.status(200).json({
      success: true,
      message: "Delivery boy assigned successfully",
      data: updatedOrder,
    });
  }
);

/**
 * Get orders by status
 */
export const getOrdersByStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const { status } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const validStatuses = [
      "Received",
      "Pending",
      "Processed",
      "Shipped",
      "Out for Delivery",
      "Delivered",
      "Cancelled",
      "Rejected",
      "Returned",
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [orders, total] = await Promise.all([
      Order.find({ status })
        .populate("customer", "name email phone")
        .populate("deliveryBoy", "name mobile")
        .populate("items")
        .sort({ orderDate: -1 })
        .skip(skip)
        .limit(parseInt(limit as string)),
      Order.countDocuments({ status }),
    ]);

    return res.status(200).json({
      success: true,
      message: `Orders with status ${status} fetched successfully`,
      data: orders,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  }
);

/**
 * Get all return requests
 */
export const getReturnRequests = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      page = 1,
      limit = 10,
      search = "",
      status,
      seller,
      dateFrom,
      dateTo,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const query: any = {};

    // Status filter
    if (status && status !== "all") {
      query.status = status;
    }

    // Request Type filter (Return vs Replacement)
    const { requestType } = req.query;
    if (requestType && requestType !== "all") {
      query.requestType = requestType;
    }

    // Date filter
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) {
        query.createdAt.$gte = new Date(dateFrom as string);
      }
      if (dateTo) {
        query.createdAt.$lte = new Date(dateTo as string);
      }
    }

    // Search filter (complex because we need to search populated fields)
    // For now, simpler implementation - search by order ID or return reason or customer
    if (search) {
      // Find orders matching search first
      const orders = await Order.find({
        orderNumber: { $regex: search as string, $options: "i" },
      }).select("_id");
      const orderIds = orders.map((o) => o._id);

      query.$or = [
        { order: { $in: orderIds } },
        { reason: { $regex: search as string, $options: "i" } },
        { description: { $regex: search as string, $options: "i" } },
      ];
    }

    // Seller filter requires looking up order items
    if (seller && seller !== "all") {
      // Find order items for this seller
      const orderItems = await OrderItem.find({ seller }).select("_id");
      const orderItemIds = orderItems.map((oi) => oi._id);
      query.orderItem = { $in: orderItemIds };
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const sort: any = {};
    sort[sortBy as string] = sortOrder === "asc" ? 1 : -1;

    const [requests, total] = await Promise.all([
      Return.find(query)
        .populate("order", "orderNumber")
        .populate("customer", "name email phone")
        .populate({
          path: "orderItem",
          populate: {
            path: "product",
            select: "productName mainImage",
          },
        })
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit as string)),
      Return.countDocuments(query),
    ]);

    // Transform logic to match frontend expectations if necessary
    // AdminReturnRequest.tsx expects: _id, orderItemId, userName, productName, variant, price, quantity, total, status, requestedAt
    // It seems flattened. Let's send structured data and let frontend handle it, or flatten it here.
    // The frontend uses "request.orderItemId", "request.userName", "request.productName" etc.
    // This implies a flattened structure.

    const transformedRequests = requests.map((req: any) => ({
      _id: req._id,
      orderId: req.order?._id,
      orderNumber: req.order?.orderNumber,
      orderItemId: req.orderItem?._id, // Frontend displays this
      userId: req.customer?._id,
      userName: req.customer?.name || "Unknown",
      // product info from orderItem
      productId: req.orderItem?.product?._id,
      productName: req.orderItem?.productName || "Unknown Product",
      variant: req.orderItem?.variation,
      price: req.orderItem?.unitPrice || 0,
      quantity: req.quantity,
      total: req.quantity * (req.orderItem?.unitPrice || 0),
      reason: req.reason,
      requestType: req.requestType,
      images: req.images,
      status: req.status,
      requestedAt: req.createdAt,
      processedAt: req.processedAt,
    }));

    return res.status(200).json({
      success: true,
      message: "Return requests fetched successfully",
      data: transformedRequests,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string)),
      },
    });
  }
);

/**
 * Get return request by ID
 */
export const getReturnRequestById = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    const returnRequest = await Return.findById(id)
      .populate("order")
      .populate("customer", "name email phone")
      .populate({
        path: "orderItem",
        populate: [
          { path: "product", select: "productName mainImage" },
          { path: "seller", select: "sellerName storeName" },
        ],
      })
      .populate("processedBy", "firstName lastName");

    if (!returnRequest) {
      return res.status(404).json({
        success: false,
        message: "Return request not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Return request details fetched successfully",
      data: returnRequest,
    });
  }
);

/**
 * Process return request (Update)
 */
export const processReturnRequest = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, rejectionReason, adminNotes } = req.body;

    const validStatuses = ["Approved", "Rejected", "Processing", "Completed"];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    const returnRequest = await Return.findById(id);
    if (!returnRequest) {
      return res.status(404).json({
        success: false,
        message: "Return request not found",
      });
    }

    const updateData: any = {
      processedBy: req.user?.userId,
      processedAt: new Date(),
    };

    if (status) updateData.status = status;

    // Handle rejection reason (frontend sends 'adminNotes' for rejection reason)
    if (status === "Rejected") {
      if (rejectionReason) updateData.rejectionReason = rejectionReason;
      else if (adminNotes) updateData.rejectionReason = adminNotes;
    }

    if (status === "Approved") {
      const { refundAmount, deliveryBoyId } = req.body;
      if (refundAmount) updateData.refundAmount = refundAmount;

      if (deliveryBoyId) {
        // Create or update delivery assignment
        await DeliveryAssignment.findOneAndUpdate(
          { returnRequest: id },
          {
            order: returnRequest.order,
            returnRequest: id,
            deliveryBoy: deliveryBoyId,
            assignedAt: new Date(),
            assignedBy: req.user?.userId,
            status: "Assigned",
            assignmentType: returnRequest.requestType === "Replacement" ? "Replacement" : "Return",
          },
          { upsert: true, new: true }
        );
      }
    }

    const updatedReturn = await Return.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    })
      .populate("order")
      .populate("orderItem")
      .populate("customer", "name email phone");

    return res.status(200).json({
      success: true,
      message: `Return request ${status ? status.toLowerCase() : "updated"
        } successfully`,
      data: updatedReturn,
    });
  }
);

/**
 * Export orders to CSV
 */
export const exportOrders = asyncHandler(
  async (req: Request, res: Response) => {
    const { status, dateFrom, dateTo } = req.query;

    const query: any = {};
    if (status) query.status = status;
    if (dateFrom || dateTo) {
      query.orderDate = {};
      if (dateFrom) query.orderDate.$gte = new Date(dateFrom as string);
      if (dateTo) query.orderDate.$lte = new Date(dateTo as string);
    }

    const orders = await Order.find(query)
      .populate("customer", "name email phone")
      .populate("deliveryBoy", "name mobile")
      .sort({ orderDate: -1 })
      .lean();

    // Convert to CSV format
    const csvHeaders = [
      "Order Number",
      "Customer Name",
      "Customer Email",
      "Customer Phone",
      "Order Date",
      "Status",
      "Payment Status",
      "Total Amount",
      "Delivery Address",
      "Delivery Boy",
    ];

    const csvRows = orders.map((order) => [
      order.orderNumber,
      order.customerName,
      order.customerEmail,
      order.customerPhone,
      order.orderDate.toISOString(),
      order.status,
      order.paymentStatus,
      order.total.toString(),
      `${order.deliveryAddress.address}, ${order.deliveryAddress.city} - ${order.deliveryAddress.pincode}`,
      order.deliveryBoy ? (order.deliveryBoy as any).name : "Not Assigned",
    ]);

    const csvContent = [
      csvHeaders.join(","),
      ...csvRows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=orders_${Date.now()}.csv`
    );
    res.send(csvContent);
  }
);

/**
 * Create POS Order
 */
// ... (previous code)

/**
 * Create POS Order
 */
export const createPOSOrder = asyncHandler(
  async (req: Request, res: Response) => {
    try {
        const { items, paymentMethod, paymentStatus } = req.body;
        let { customerId } = req.body;

        // Validate request
        if (!customerId || !items || !items.length || !paymentMethod) {
          return res.status(400).json({
            success: false,
            message: "Missing required fields: customerId, items, paymentMethod",
          });
        }

        const adminId = req.user?.userId;
        if (!adminId) {
             console.warn("createPOSOrder: No admin user found in request (req.user)");
        }

        // Handle Walk-in Customer
        if (customerId === "walk-in-customer") {
          let walkIn = await Customer.findOne({ email: "walkin@pos.com" });
          if (!walkIn) {
            try {
              walkIn = await Customer.create({
                name: "Walk-in Customer",
                email: "walkin@pos.com",
                phone: "0000000000",
                status: "Active",
              });
            } catch (err) {
                 console.error("Error creating walk-in customer", err);
            }
          }
          if (walkIn) customerId = walkIn._id;
        }

        // Fetch customer
        const customer = await Customer.findById(customerId);
        if (!customer) {
          return res.status(404).json({
            success: false,
            message: "Customer not found",
          });
        }

        // 1. Create Order shell
        let order = await Order.create({
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
          adminNotes: "Created via POS System"
        });

        // 2. Create Order Items
        let subtotal = 0;
        let taxTotal = 0;
        const orderItemsIds = [];

        for (const item of items) {
           let productData: any = {
               productName: item.name || "Custom Item",
               mainImage: "",
               sku: "",
               seller: null
           };
           let productId = null;
           let product: any = null;
           let resolvedVariant: ReturnType<typeof findVariantById> = undefined;

           if (mongoose.Types.ObjectId.isValid(item.productId)) {
               product = await Product.findById(item.productId).populate('seller');
               if (product) {
                   productId = product._id;
                   const variants = variantsFromProductDoc(product);
                   resolvedVariant = item.variationId
                     ? findVariantById(variants, item.variationId)
                     : variants.length === 1
                       ? variants[0]
                       : undefined;
                   productData = {
                       productName: item.name || product.productName,
                       mainImage: resolvedVariant?.mainImage || (product as any).listing?.imageUrl || "",
                       sku: resolvedVariant?.sku || "",
                       seller: (product.seller as any)?._id || product.seller
                   };
               }
           }

           const total = Number(item.price) * Number(item.quantity);
           subtotal += total;

           // Resolve HSN/GST: prefer per-line payload (POS Edit Item modal), then product, then defaults.
           const payloadHsnCode =
             typeof item.hsnCode === "string" && item.hsnCode.trim()
               ? item.hsnCode.trim()
               : typeof item.hsn === "string" && item.hsn.trim()
                 ? item.hsn.trim()
                 : "";
           const resolvedHsnCode =
             payloadHsnCode ||
             (typeof (product as any)?.hsnCode === "string" ? String((product as any).hsnCode).trim() : "");

           const payloadGstRateRaw =
             item.gst !== undefined && item.gst !== null && item.gst !== ""
               ? Number(item.gst)
               : item.gstPercent !== undefined && item.gstPercent !== null && item.gstPercent !== ""
                 ? Number(item.gstPercent)
                 : NaN;
           const resolvedGstRate = Number.isFinite(payloadGstRateRaw)
             ? payloadGstRateRaw
             : Number.isFinite(Number((product as any)?.gst))
               ? Number((product as any).gst)
               : 5;
           const safeGstRate = resolvedGstRate >= 0 ? resolvedGstRate : 5;
           // GST is treated as inclusive in the POS price (B2C retail convention).
           const resolvedGstAmount = safeGstRate > 0
             ? Number(((total * safeGstRate) / (100 + safeGstRate)).toFixed(2))
             : 0;
           taxTotal += resolvedGstAmount;

            const orderItemPayload: any = {
              order: order._id,
              productName: productData.productName,
              productImage: productData.mainImage,
              sku: productData.sku,
              mrp: Number(item.mrp) || 0,
              unitPrice: item.price,
              quantity: item.quantity,
              total: total,
              hsnCode: resolvedHsnCode,
              gst: safeGstRate,
              gstAmount: resolvedGstAmount,
              warrantyType: item.warrantyType || (product as any)?.warrantyType || "None",
              warrantyDuration: item.warrantyDuration || (product as any)?.warrantyDuration || "",
              status: "Delivered"
           };

           if (productId) orderItemPayload.product = productId;
           if (productData.seller) orderItemPayload.seller = productData.seller;
           if (resolvedVariant) {
             orderItemPayload.variantId = resolvedVariant._id;
             orderItemPayload.variation = `${resolvedVariant.name || resolvedVariant.variationType || "Variant"}: ${resolvedVariant.value}`;
           }

           const orderItem = await OrderItem.create(orderItemPayload);
           orderItemsIds.push(orderItem._id);
        }

        // 3. Update Order with correct totals
        const shipping = 0;
        const discount = 0;
        // GST is inclusive in unitPrice, so subtotal already contains tax — don't add it again to the grand total.
        const total = subtotal + shipping - discount;

        order.items = orderItemsIds;
        order.subtotal = subtotal;
        order.tax = Number(taxTotal.toFixed(2));
        order.total = total;

        if (paymentMethod === 'Credit') {
            order.paymentStatus = 'Pending';
        }

        await order.save();

        // --- CREDIT MANAGEMENT ---
        if (paymentMethod === 'Credit') {
            customer.creditBalance = (customer.creditBalance || 0) + total;
            await customer.save();

            await CreditTransaction.create({
                customer: customer._id,
                type: 'Order',
                amount: total,
                balanceAfter: customer.creditBalance,
                description: `POS Order #${order.orderNumber}`,
                referenceId: order._id.toString(),
                date: new Date(),
                createdBy: adminId
            });
        }

        // --- STOCK MANAGEMENT ---
        for (const item of items) {
           if (!mongoose.Types.ObjectId.isValid(item.productId)) continue;

           const productId = String(item.productId);
           const soldQty = Number(item.quantity) || 0;
           if (soldQty <= 0) continue;

           try {
               const product = await Product.findById(productId).lean();
               if (!product) continue;

               const variants = variantsFromProductDoc(product);
               if (!variants.length) {
                   console.warn(`POS stock skip: product ${productId} has no variants`);
                   continue;
               }

               let variantId = item.variationId ? String(item.variationId) : undefined;
               if (variantId && !findVariantById(variants, variantId)) {
                   variantId = undefined;
               }
               if (!variantId && variants.length === 1) {
                   variantId = String(variants[0]._id);
               }
               if (!variantId) {
                   console.warn(`POS stock skip: could not resolve variant for product ${productId}`);
                   continue;
               }

               const variant = findVariantById(variants, variantId)!;
               const prevStock = await getVariantStock(productId, variantId);
               const decremented = await decrementVariantStock(productId, variantId, soldQty);
               if (!decremented) {
                   console.warn(`POS stock decrement failed for ${productId}/${variantId}`);
                   continue;
               }

               await StockLedger.create({
                   product: productId,
                   variationId: variantId,
                   sku: resolveLedgerSku(variant.sku),
                   quantity: soldQty,
                   type: "OUT",
                   source: "POS",
                   referenceId: order._id,
                   previousStock: prevStock,
                   newStock: Math.max(0, prevStock - soldQty),
                   admin: adminId
               });
           } catch (err) {
               console.error("POS stock update error", err);
           }
        }

        return res.status(201).json({
            success: true,
            message: "Order created successfully",
            data: order
        });

    } catch (error) {
        console.error("createPOSOrder CRASH:", error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error during POS Order creation",
            error: process.env.NODE_ENV === 'development' ? error : undefined
        });
    }
  }
);


/**
 * Initiate POS Online Order (Razorpay/Cashfree)
 */
export const initiatePOSOnlineOrder = asyncHandler(
  async (req: Request, res: Response) => {
    const { items, gateway } = req.body;
    let { customerId } = req.body;

    if (!customerId || !items || !items.length || !gateway) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    // Handle Walk-in Customer
    if (customerId === "walk-in-customer") {
      let walkIn = await Customer.findOne({ email: "walkin@pos.com" });
      if (!walkIn) {
         try {
            walkIn = await Customer.create({
                name: "Walk-in Customer",
                email: "walkin@pos.com",
                phone: "0000000000",
                status: "Active",
            });
         } catch (err) {
            console.error("Error creating walk-in customer", err);
         }
      }
      if (walkIn) customerId = walkIn._id;
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    // Calculate Total
    let subtotal = 0;
    let taxTotal = 0;
    const orderItemsPayload = [];

    for (const item of items) {
       let productData: any = {
           productName: item.name || "Custom Item",
           mainImage: "",
           sku: "",
           seller: null
       };
       let productId = null;
       let product: any = null;

       if (item.productId && mongoose.Types.ObjectId.isValid(item.productId)) {
           product = await Product.findById(item.productId).populate('seller');
           if (product) {
               productId = product._id;
               productData = {
                   productName: product.productName,
                   mainImage: product.mainImage,
                   sku: product.sku,
                   seller: product.seller ? ((product.seller as any)._id || product.seller) : null
               };
           }
       }

       const total = Number(item.price) * Number(item.quantity);
       subtotal += total;

       // Resolve HSN/GST: prefer per-line payload, then product, then defaults.
       const payloadHsnCode =
         typeof item.hsnCode === "string" && item.hsnCode.trim()
           ? item.hsnCode.trim()
           : typeof item.hsn === "string" && item.hsn.trim()
             ? item.hsn.trim()
             : "";
       const resolvedHsnCode =
         payloadHsnCode ||
         (typeof (product as any)?.hsnCode === "string" ? String((product as any).hsnCode).trim() : "");

       const payloadGstRateRaw =
         item.gst !== undefined && item.gst !== null && item.gst !== ""
           ? Number(item.gst)
           : item.gstPercent !== undefined && item.gstPercent !== null && item.gstPercent !== ""
             ? Number(item.gstPercent)
             : NaN;
       const resolvedGstRate = Number.isFinite(payloadGstRateRaw)
         ? payloadGstRateRaw
         : Number.isFinite(Number((product as any)?.gst))
           ? Number((product as any).gst)
           : 5;
       const safeGstRate = resolvedGstRate >= 0 ? resolvedGstRate : 5;
       const resolvedGstAmount = safeGstRate > 0
         ? Number(((total * safeGstRate) / (100 + safeGstRate)).toFixed(2))
         : 0;
       taxTotal += resolvedGstAmount;

        const payload: any = {
          productName: productData.productName,
          productImage: productData.mainImage,
          sku: productData.sku,
          mrp: Number(item.mrp) || 0,
          unitPrice: item.price,
          quantity: item.quantity,
          total: total,
          hsnCode: resolvedHsnCode,
          gst: safeGstRate,
          gstAmount: resolvedGstAmount,
          warrantyType: item.warrantyType || (product as any)?.warrantyType || "None",
          warrantyDuration: item.warrantyDuration || (product as any)?.warrantyDuration || "",
         status: "Pending" // Initial status
       };
       if (productId) payload.product = productId;
       if (productData.seller) payload.seller = productData.seller;

       orderItemsPayload.push(payload);
    }

    // Create Pending Order
    const order = await Order.create({
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
      items: [], // Will populate after creating items
      subtotal: subtotal,
      tax: Number(taxTotal.toFixed(2)),
      total: subtotal, // GST is inclusive in unit prices, so grand total stays at subtotal.
      paymentMethod: gateway,
      paymentStatus: "Pending",
      status: "Pending",
      adminNotes: `POS Online Order via ${gateway}`
    });

    // Create Items
    const itemIds = [];
    for (const payload of orderItemsPayload) {
        payload.order = order._id;
        const item = await OrderItem.create(payload);
        itemIds.push(item._id);
    }
    order.items = itemIds;
    await order.save();

    // Initiate PhonePe payment
    const amountInPaise = Math.round(subtotal * 100);
    const normalizedGateway = String(gateway || "").toLowerCase();
    const usePhonePe =
      normalizedGateway === "phonepe" ||
      normalizedGateway === "online" ||
      !normalizedGateway;

    if (!usePhonePe) {
      return res.status(400).json({ success: false, message: "Invalid Gateway. Use PhonePe or Online." });
    }

    if (!isPhonePeConfigured()) {
      return res.status(500).json({
        success: false,
        message: "PhonePe is not configured. Set PHONEPE_MERCHANT_ID and PHONEPE_SALT_KEY.",
      });
    }

    try {
      const merchantTransactionId = buildPhonePeMerchantTransactionId(
        "POS",
        order._id.toString()
      );
      const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:5173").replace(
        /\/$/,
        ""
      );
      const redirectUrl = `${frontendUrl}/admin/pos/success?order_id=${order._id}&merchantTransactionId=${merchantTransactionId}`;

      const phonePeResult = await initiatePhonePePayment({
        merchantTransactionId,
        merchantUserId: customer._id.toString(),
        amountPaise: amountInPaise,
        redirectUrl,
        mobileNumber: customer.phone || "9999999999",
      });

      order.paymentMethod = "PhonePe";
      order.paymentId = merchantTransactionId;
      order.adminNotes = "POS Online Order via PhonePe";
      await order.save();

      return res.status(200).json({
        success: true,
        data: {
          gateway: "PhonePe",
          orderId: order._id,
          merchantTransactionId,
          redirectUrl: phonePeResult.redirectUrl,
          amount: subtotal,
          customer: {
            name: customer.name,
            email: customer.email,
            contact: customer.phone,
          },
        },
      });
    } catch (error: any) {
      console.error("PhonePe Error:", error.response?.data || error.message || error);
      return res.status(500).json({
        success: false,
        message: error.message || "PhonePe gateway error",
      });
    }
  }
);

/**
 * Verify POS Online Payment
 */
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

/**
 * Get POS Report (Summary + Recent Orders)
 */
export const getPOSReport = asyncHandler(
  async (req: Request, res: Response) => {
    const { startDate, endDate } = req.query;

    let start: Date, end: Date;

    // Default to Today if no filter provided
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (startDate && endDate) {
      start = new Date(startDate as string);
      end = new Date(endDate as string);
      // Ensure end date includes the full day if it's just a date string (e.g. YYYY-MM-DD)
      // If end date is same as start date or just a day, set it to end of that day?
      // Usually user sends YYYY-MM-DD. We treat start as 00:00 and end as 23:59:59.999
      // Assuming frontend sends precise or we adjust here.
      // Let's assume frontend sends ISO strings or plain dates.
      // If we just get "2023-01-01", "new Date()" sets it to 00:00 UTC (or local).
      // Safest is to handle "End of Day" logic if frontend sends same date.
      // But typically easier to rely on frontend sending correct timestamps.
      // We will trust the input for now, but ensure validity.
    } else {
      start = today;
      end = tomorrow;
    }

    // Common POS Check
    const posFilter = {
      $and: [
        {
          $or: [
            { adminNotes: { $regex: "POS", $options: "i" } },
            { "deliveryAddress.address": "POS Order" }
          ]
        },
        {
          adminNotes: { $not: { $regex: "POS Order - Seller:", $options: "i" } }
        }
      ]
    };

    // 1. Summary Query: Always respects the determined range (Default Today, or Filtered Range)
    const summaryQuery: any = {
      orderDate: { $gte: start, $lt: end },
      ...posFilter
    };

    // 2. List Query:
    // If Filter is applied: respect the range.
    // If No Filter (Default Dashboard): Show Recent 50 (Any Date)
    let listQuery: any;
    let limit = 50;

    if (startDate && endDate) {
        listQuery = { ...summaryQuery };
        limit = 500; // Increase limit for filtered reports to see more data
    } else {
        // Default Dashboard: Recent 50 (ignoring date, just last 50 POS orders)
        listQuery = { ...posFilter };
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
          paidAmount: {
            $sum: { $cond: [{ $eq: ["$paymentStatus", "Paid"] }, "$total", 0] }
          },
          unpaidAmount: {
            $sum: { $cond: [{ $ne: ["$paymentStatus", "Paid"] }, "$total", 0] }
          }
        }
      }
    ]);

    const recentOrders = await Order.find(listQuery)
      .sort({ orderDate: -1 })
      .limit(limit)
      .populate("customer", "name phone");

    return res.status(200).json({
      success: true,
      data: {
        summary: summary[0] || {
          totalSales: 0,
          totalOrders: 0,
          cashSales: 0,
          onlineSales: 0,
          paidAmount: 0,
          unpaidAmount: 0
        },
        orders: recentOrders,
        period: { start, end }
      }
    });
  }
);

/**
 * Get POS Stock Ledger
 */
export const getPOSStockLedger = asyncHandler(
  async (req: Request, res: Response) => {
    const { page = 1, limit = 50, productId, sku, type, startDate, endDate } = req.query;
    const query: any = {};

    if (productId) query.product = productId;
    if (sku) query.sku = sku;
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
 * Process POS Exchange
 */
export const processPOSExchange = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      customerId,
      returnItems, // [{ productId, variationId, quantity, price }]
      newItems     // [{ productId, variationId, quantity, price }]
    } = req.body;

    if (!customerId || !returnItems || !newItems) {
       return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Process Returns
      for (const item of returnItems) {
        if (mongoose.Types.ObjectId.isValid(item.productId)) {
          const product = await Product.findById(item.productId).session(session);
          if (product) {
            const qty = Number(item.quantity);
            const prevStock = product.stock;

            if (item.variationId && product.variations) {
              const vIndex = product.variations.findIndex((v: any) => v._id?.toString() === item.variationId.toString());
              if (vIndex > -1) {
                const prevVarStock = product.variations[vIndex].stock || 0;
                product.variations[vIndex].stock = prevVarStock + qty;
                product.stock = prevStock + qty;
                await product.save({ session });

                await StockLedger.create([{
                  product: product._id,
                  variationId: item.variationId,
                  sku: product.variations[vIndex].sku || product.sku,
                  quantity: qty,
                  type: "IN",
                  source: "EXCHANGE",
                  previousStock: prevVarStock,
                  newStock: product.variations[vIndex].stock,
                  admin: req.user?.userId
                }], { session });
              }
            } else {
              product.stock = prevStock + qty;
              await product.save({ session });

              await StockLedger.create([{
                  product: product._id,
                  sku: product.sku || "N/A",
                  quantity: qty,
                  type: "IN",
                  source: "EXCHANGE",
                  previousStock: prevStock,
                  newStock: product.stock,
                  admin: req.user?.userId
              }], { session });
            }
          }
        }
      }

      // 2. Process Sales
      for (const item of newItems) {
        if (mongoose.Types.ObjectId.isValid(item.productId)) {
          const product = await Product.findById(item.productId).session(session);
          if (product) {
            const qty = Number(item.quantity);
            const prevStock = product.stock;

            if (item.variationId && product.variations) {
              const vIndex = product.variations.findIndex((v: any) => v._id?.toString() === item.variationId.toString());
              if (vIndex > -1) {
                const prevVarStock = product.variations[vIndex].stock || 0;
                product.variations[vIndex].stock = Math.max(0, prevVarStock - qty);
                product.stock = Math.max(0, prevStock - qty);
                await product.save({ session });

                await StockLedger.create([{
                  product: product._id,
                  variationId: item.variationId,
                  sku: product.variations[vIndex].sku || product.sku,
                  quantity: qty,
                  type: "OUT",
                  source: "EXCHANGE",
                  previousStock: prevVarStock,
                  newStock: product.variations[vIndex].stock,
                  admin: req.user?.userId
                }], { session });
              }
            } else {
              product.stock = Math.max(0, prevStock - qty);
              await product.save({ session });

              await StockLedger.create([{
                  product: product._id,
                  sku: product.sku || "N/A",
                  quantity: qty,
                  type: "OUT",
                  source: "EXCHANGE",
                  previousStock: prevStock,
                  newStock: product.stock,
                  admin: req.user?.userId
              }], { session });
            }
          }
        }
      }

      // 3. Create a consolidated "Exchange Order" for record keeping if needed
      // For now, assume this logic is enough as per requirement "One transaction"

      await session.commitTransaction();
      session.endSession();

      return res.status(200).json({
        success: true,
        message: "Exchange processed successfully and stock updated"
      });

    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.error("Exchange Error:", error);
      return res.status(500).json({ success: false, message: "Error processing exchange" });
    }
  }
);

/**
 * Delete POS Order and Restore Stock
 */
export const deletePOSOrder = asyncHandler(
  async (req: Request, res: Response) => {
    const { id } = req.params;

    // Find the order with populated items
    const order = await Order.findById(id).populate('items');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    // Check if it's a POS order (has adminNotes containing "POS")
    if (!order.adminNotes?.includes('POS')) {
      return res.status(400).json({
        success: false,
        message: "Only POS orders can be deleted"
      });
    }

    // Note: Stock is intentionally NOT restored when deleting a POS order

    // Delete order items
    await OrderItem.deleteMany({ order: order._id });

    // Delete the order
    await Order.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "POS Order deleted successfully"
    });
  }
);
