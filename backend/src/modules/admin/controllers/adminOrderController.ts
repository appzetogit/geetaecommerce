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
            select: "productName mainImage",
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
    const { status, rejectionReason, refundAmount, adminNotes } = req.body;

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
        const orderItemsIds = [];

        for (const item of items) {
           let productData: any = {
               productName: item.name || "Custom Item",
               mainImage: "",
               sku: "",
               seller: null
           };
           let productId = null;

           if (mongoose.Types.ObjectId.isValid(item.productId)) {
               const product = await Product.findById(item.productId).populate('seller');
               if (product) {
                   productId = product._id;
                   productData = {
                       productName: product.productName,
                       mainImage: product.mainImage,
                       sku: product.sku,
                       seller: (product.seller as any)?._id || product.seller
                   };
               }
           }

           const total = Number(item.price) * Number(item.quantity);
           subtotal += total;

           const orderItemPayload: any = {
             order: order._id,
             productName: productData.productName,
             productImage: productData.mainImage,
             sku: productData.sku,
             unitPrice: item.price,
             quantity: item.quantity,
             total: total,
             status: "Delivered"
           };

           if (productId) orderItemPayload.product = productId;
           if (productData.seller) orderItemPayload.seller = productData.seller;

           const orderItem = await OrderItem.create(orderItemPayload);
           orderItemsIds.push(orderItem._id);
        }

        // 3. Update Order with correct totals
        const tax = 0;
        const shipping = 0;
        const discount = 0;
        const total = subtotal + tax + shipping - discount;

        order.items = orderItemsIds;
        order.subtotal = subtotal;
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
           if (mongoose.Types.ObjectId.isValid(item.productId)) {
               const product = await Product.findById(item.productId);
               if (product) {
                   const prevStock = product.stock;
                   const soldQty = Number(item.quantity) || 0;

                   if (item.variationId && product.variations) {
                       const variationIndex = product.variations.findIndex((v: any) => v._id?.toString() === item.variationId.toString());
                       if (variationIndex > -1) {
                           const prevVarStock = product.variations[variationIndex].stock || 0;
                           product.variations[variationIndex].stock = Math.max(0, prevVarStock - soldQty);
                           product.stock = Math.max(0, prevStock - soldQty);
                           await product.save();

                           try {
                               await StockLedger.create({
                                   product: product._id,
                                   variationId: item.variationId,
                                   sku: product.variations[variationIndex].sku || product.sku,
                                   quantity: soldQty,
                                   type: "OUT",
                                   source: "POS",
                                   referenceId: order._id,
                                   previousStock: prevVarStock,
                                   newStock: product.variations[variationIndex].stock,
                                   admin: adminId
                               });
                           } catch (err) { console.error("StockLedger Error (Var)", err); }
                       }
                   } else {
                       product.stock = Math.max(0, prevStock - soldQty);
                       await product.save();

                       try {
                           await StockLedger.create({
                               product: product._id,
                               sku: product.sku,
                               quantity: soldQty,
                               type: "OUT",
                               source: "POS",
                               referenceId: order._id,
                               previousStock: prevStock,
                               newStock: product.stock,
                               admin: adminId
                           });
                       } catch (err) { console.error("StockLedger Error (Main)", err); }
                   }
               }
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
    const orderItemsPayload = [];

    for (const item of items) {
       let productData: any = {
           productName: item.name || "Custom Item",
           mainImage: "",
           sku: "",
           seller: null
       };
       let productId = null;

       if (item.productId && mongoose.Types.ObjectId.isValid(item.productId)) {
           const product = await Product.findById(item.productId).populate('seller');
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

       const payload: any = {
         productName: productData.productName,
         productImage: productData.mainImage,
         sku: productData.sku,
         unitPrice: item.price,
         quantity: item.quantity,
         total: total,
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
      total: subtotal, // Assuming no tax/shipping for POS for now
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

    // Initiate Gateway Payment
    const amountInPaise = Math.round(subtotal * 100);

    if (gateway === 'Razorpay') {
        const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
        try {
            const razorpayResponse = await axios.post('https://api.razorpay.com/v1/orders', {
                amount: amountInPaise,
                currency: "INR",
                receipt: order.orderNumber,
                notes: { order_id: order._id.toString() }
            }, {
                headers: { 'Authorization': `Basic ${auth}` }
            });

            return res.status(200).json({
                success: true,
                data: {
                    gateway: 'Razorpay',
                    orderId: order._id,
                    razorpayOrderId: razorpayResponse.data.id,
                    amount: subtotal,
                    key: process.env.RAZORPAY_KEY_ID,
                    customer: {
                        name: customer.name,
                        email: customer.email,
                        contact: customer.phone
                    }
                }
            });
        } catch (error: any) {
            console.error("Razorpay Error:", error.response?.data || error);
            return res.status(500).json({ success: false, message: "Gateway Error" });
        }
    } else if (gateway === 'Cashfree') {
        try {
            const baseUrl = process.env.CASHFREE_MODE === 'production'
                ? 'https://api.cashfree.com/pg'
                : 'https://sandbox.cashfree.com/pg';

            const cashfreeResponse = await axios.post(`${baseUrl}/orders`, {
                order_id: `pos_${order._id}_${Date.now()}`, // Unique Order ID required by CF
                order_amount: subtotal,
                order_currency: "INR",
                customer_details: {
                    customer_id: customer._id.toString(),
                    customer_email: customer.email || "pos@example.com",
                    customer_phone: customer.phone || "9999999999"
                },
                order_meta: {
                    return_url: `${process.env.FRONTEND_URL || 'http://localhost:5173/'}admin/pos/success?order_id=${order._id}` // Not strictly used in seamless/popup but required
                }
            }, {
                headers: {
                    'x-client-id': process.env.CASHFREE_APP_ID,
                    'x-client-secret': process.env.CASHFREE_SECRET_KEY,
                    'x-api-version': '2023-08-01'
                }
            });

            return res.status(200).json({
                success: true,
                data: {
                    gateway: 'Cashfree',
                    orderId: order._id,
                    paymentSessionId: cashfreeResponse.data.payment_session_id,
                    amount: subtotal,
                    isSandbox: process.env.CASHFREE_MODE !== 'production'
                }
            });
        } catch (error: any) {
            console.error("Cashfree Error:", error.response?.data || error);
            return res.status(500).json({ success: false, message: "Gateway Error" });
        }
    }

    return res.status(400).json({ success: false, message: "Invalid Gateway" });
  }
);

/**
 * Verify POS Online Payment
 */
export const verifyPOSPayment = asyncHandler(
  async (req: Request, res: Response) => {
    const { orderId, paymentId } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
        return res.status(404).json({ success: false, message: "Order not found" });
    }

    order.paymentStatus = "Paid";
    order.status = "Delivered"; // Auto deliver for POS
    order.deliveryBoyStatus = "Delivered";
    order.deliveredAt = new Date();
    order.adminNotes = (order.adminNotes || "") + `\nPayment Verified (ID: ${paymentId})`;

    await order.save();

    // --- STOCK MANAGEMENT for Online POS orders when verified ---
    const orderItems = await OrderItem.find({ order: order._id });
    for (const item of orderItems) {
        if (item.product) {
            const product = await Product.findById(item.product);
            if (product) {
                const prevStock = product.stock;
                const soldQty = item.quantity;

                // For Online orders, we reduce from main stock or variation if identifiable
                // Since initiatePOSOnlineOrder doesn't store variationId in orderItem yet,
                // we'll at least reduce from total stock if SKU matches variation we can try to find it.

                let stockUpdated = false;
                if (item.sku && product.variations) {
                    const vIndex = product.variations.findIndex(v => v.sku === item.sku);
                    if (vIndex > -1) {
                        const prevVarStock = product.variations[vIndex].stock || 0;
                        product.variations[vIndex].stock = Math.max(0, prevVarStock - soldQty);
                        product.stock = Math.max(0, prevStock - soldQty);
                        await product.save();

                        await StockLedger.create({
                            product: product._id,
                            variationId: product.variations[vIndex]._id,
                            sku: item.sku,
                            quantity: soldQty,
                            type: "OUT",
                            source: "POS",
                            referenceId: order._id,
                            previousStock: prevVarStock,
                            newStock: product.variations[vIndex].stock,
                            admin: req.user?.userId
                        });
                        stockUpdated = true;
                    }
                }

                if (!stockUpdated) {
                    product.stock = Math.max(0, prevStock - soldQty);
                    await product.save();

                    await StockLedger.create({
                        product: product._id,
                        sku: item.sku || product.sku || "N/A",
                        quantity: soldQty,
                        type: "OUT",
                        source: "POS",
                        referenceId: order._id,
                        previousStock: prevStock,
                        newStock: product.stock,
                        admin: req.user?.userId
                    });
                }

                // --- SOCKET EMIT ---
                const io = req.app.get("io");
                if (io) {
                    io.emit("stock-update", {
                        productId: product._id,
                        newStock: product.stock
                    });
                }
            }
        }
    }

    // Update items status
    await OrderItem.updateMany({ order: order._id }, { status: "Delivered" });

    return res.status(200).json({
        success: true,
        message: "Payment verified and Order completed"
    });
  }
);

/**
 * Get POS Report (Summary + Recent Orders)
 */
export const getPOSReport = asyncHandler(
  async (req: Request, res: Response) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Filter POS orders for today
    // POS orders have adminNotes saying "Created via POS System" or "POS Online Order..."
    // Ideally we should have a 'source' field in Order model, but since we don't,
    // we'll check adminNotes or if deliveryAddress is 'POS Order' (set in createPOSOrder)
    const posQuery: any = {
      orderDate: { $gte: today, $lt: tomorrow },
      $or: [
        { adminNotes: { $regex: "POS", $options: "i" } },
        { "deliveryAddress.address": "POS Order" }
      ]
    };

    const summary = await Order.aggregate([
      { $match: posQuery },
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

    const recentOrders = await Order.find(posQuery)
      .sort({ orderDate: -1 })
      .limit(50)
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
        orders: recentOrders
      }
    });
  }
);

/**
 * Get POS Stock Ledger
 */
export const getPOSStockLedger = asyncHandler(
  async (req: Request, res: Response) => {
    const { page = 1, limit = 50, productId, sku, type } = req.query;
    const query: any = {};

    if (productId) query.product = productId;
    if (sku) query.sku = sku;
    if (type) query.type = type;

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
      newItems,    // [{ productId, variationId, quantity, price }]
      paymentMethod,
      isDifferencePaid // boolean
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

    // Restore stock for each item
    const orderItems = await OrderItem.find({ order: order._id }).populate('product');

    for (const item of orderItems) {
      if (item.product) {
        const product = await Product.findById(item.product);
        if (product) {
          const prevStock = product.stock;
          const returnQty = item.quantity;

          // Check if item has variation (by SKU match)
          let stockRestored = false;
          if (item.sku && product.variations) {
            const vIndex = product.variations.findIndex(v => v.sku === item.sku);
            if (vIndex > -1) {
              const prevVarStock = product.variations[vIndex].stock || 0;
              product.variations[vIndex].stock = prevVarStock + returnQty;
              product.stock = prevStock + returnQty;
              await product.save();

              // Create stock ledger entry
              await StockLedger.create({
                product: product._id,
                variationId: product.variations[vIndex]._id,
                sku: item.sku,
                quantity: returnQty,
                type: "IN",
                source: "POS_CANCEL",
                referenceId: order._id,
                previousStock: prevVarStock,
                newStock: product.variations[vIndex].stock,
                admin: req.user?.userId
              });
              stockRestored = true;
            }
          }

          if (!stockRestored) {
            product.stock = prevStock + returnQty;
            await product.save();

            // Create stock ledger entry
            await StockLedger.create({
              product: product._id,
              sku: item.sku || product.sku || "N/A",
              quantity: returnQty,
              type: "IN",
              source: "POS_CANCEL",
              referenceId: order._id,
              previousStock: prevStock,
              newStock: product.stock,
              admin: req.user?.userId
            });
          }

          // Emit socket event for real-time stock update
          const io = req.app.get("io");
          if (io) {
            io.emit("stock-update", {
              productId: product._id,
              newStock: product.stock
            });
          }
        }
      }
    }

    // Delete order items
    await OrderItem.deleteMany({ order: order._id });

    // Delete the order
    await Order.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "POS Order deleted and stock restored successfully"
    });
  }
);
