import { Request, Response } from "express";
import Order from "../../../models/Order";
import OrderItem from "../../../models/OrderItem";
import { asyncHandler } from "../../../utils/asyncHandler";
import Seller from "../../../models/Seller";
import WalletTransaction from "../../../models/WalletTransaction";

/**
 * Get seller's orders with filters, sorting, and pagination
 */
export const getOrders = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const {
      dateFrom,
      dateTo,
      status,
      search,
      page = "1",
      limit = "10",
      sortBy = "orderDate",
      sortOrder = "desc",
    } = req.query;

    // Find all order IDs that contain items from this seller
    const orderItems = await OrderItem.find({ seller: sellerId }).distinct("order");

    // Build query - filter by orders containing this seller's items OR POS orders created by this seller
    const query: any = {
      $or: [
        { _id: { $in: orderItems } },
        { adminNotes: { $regex: `POS Order - Seller: ${sellerId}`, $options: "i" } },
      ],
    };

    // Date range filter
    if (dateFrom || dateTo) {
      query.orderDate = {};
      if (dateFrom) {
        query.orderDate.$gte = new Date(dateFrom as string);
      }
      if (dateTo) {
        query.orderDate.$lte = new Date(dateTo as string);
      }
    }

    // Status filter
    if (status && status !== 'All Status') {
      // Map frontend status to backend status
      const statusMapping: Record<string, string> = {
        'Pending': 'Pending',
        'Accepted': 'Accepted',
        'On the way': 'On the way',
        'Delivered': 'Delivered',
        'Cancelled': 'Cancelled',
        'Rejected': 'Rejected',
      };
      query.status = statusMapping[status as string] || status;
    }

    // Search filter — wrap in $and to avoid overwriting the top-level $or
    if (search) {
      const searchOr = [
        { orderNumber: { $regex: search, $options: "i" } },
        { customerName: { $regex: search, $options: "i" } },
        { customerPhone: { $regex: search, $options: "i" } },
      ];
      query.$and = [...(query.$and || []), { $or: searchOr }];
    }

    // Pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Sort
    const sort: any = {};
    sort[sortBy as string] = sortOrder === "asc" ? 1 : -1;

    // Get orders with populated customer and delivery info
    const orders = await Order.find(query)
      .populate("customer", "name email phone")
      .populate("deliveryBoy", "name mobile")
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    // Get total count for pagination
    const total = await Order.countDocuments(query);

    // Format response for frontend
    const formattedOrders = orders.map(order => ({
      id: order._id,
      orderId: order.orderNumber,
      deliveryDate: order.estimatedDeliveryDate
        ? order.estimatedDeliveryDate.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
        : order.orderDate.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
      orderDate: order.orderDate.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
      status: order.status === 'On the way' ? 'On the way' : order.status,
      amount: order.total,
      customerName: (order.customer as any)?.name || order.customerName || '',
      customerPhone: (order.customer as any)?.phone || order.customerPhone || '',
      deliveryBoyName: (order.deliveryBoy as any)?.name || '',
    }));

    return res.status(200).json({
      success: true,
      message: "Orders fetched successfully",
      data: formattedOrders,
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
 * Get order by ID with populated order items, customer, and delivery info
 */
 export const getOrderById = asyncHandler(
   async (req: Request, res: Response) => {
     const sellerId = (req as any).user.userId;
     const { id } = req.params;

     // 1. Get order with populated data
     const order = await Order.findById(id)
       .populate("customer", "name email phone")
       .populate("deliveryBoy", "name mobile email");

     if (!order) {
       return res.status(404).json({
         success: false,
         message: "Order not found",
       });
     }

     // 2. Access check: Either seller has items in it, OR it's their POS order
     const isTheirPOSOrder = order.adminNotes?.includes(`POS Order - Seller: ${sellerId}`);

     // Get this seller's specific items (important for online orders)
     const sellerItems = await OrderItem.find({ order: id, seller: sellerId })
       .populate("seller", "storeName")
       .populate("product");

     if (!isTheirPOSOrder && (!sellerItems || sellerItems.length === 0)) {
       return res.status(403).json({
         success: false,
         message: "Access denied or order not found",
       });
     }

     // 3. For POS orders created by this seller, return ALL items.
     // For online orders, return only items belonging to this seller.
     let orderItems;
     if (isTheirPOSOrder) {
         orderItems = await OrderItem.find({ order: id })
            .populate("seller", "storeName")
            .populate("product");
     } else {
         orderItems = sellerItems;
     }

    // Format order items for frontend
    // Format order items for frontend
    const formattedItems = orderItems.map(item => {
      let unit = item.variation || 'N/A';
      let variationMatched = false;
      let resolvedVariationId = '';

      // Try to resolve variation value from product if it exists
      // item.product is populated now
      const product = item.product as any;
      if (product && product.variations && Array.isArray(product.variations)) {
        // 1. Try to match by ID or Value if validation is present
        if (item.variation) {
            const variationById = product.variations.find((v: any) => v._id.toString() === item.variation);
            if (variationById) {
              unit = variationById.value;
              variationMatched = true;
              resolvedVariationId = variationById._id.toString();
            } else {
                const variationByValue = product.variations.find((v: any) => v.value === item.variation);
                if (variationByValue) {
                    unit = variationByValue.value;
                    variationMatched = true;
                    resolvedVariationId = variationByValue._id.toString();
                }
            }
        }

        // 2. Fallback: If not matched yet (even if we have a value like '250'), try to recover
        if (!variationMatched) {
             const variationByPrice = product.variations.find((v: any) => v.price === item.unitPrice || v.discPrice === item.unitPrice);
             if (variationByPrice) {
                 unit = variationByPrice.value;
                 variationMatched = true;
                 resolvedVariationId = variationByPrice._id.toString();
             } else if (product.variations.length === 1) {
                 // 3. Last Resort: If there is only one variation, assume it's that one
                 unit = product.variations[0].value;
                 resolvedVariationId = product.variations[0]._id.toString();
             }
        }
      }

      return {
        _id: item._id,
        srNo: item._id.toString().slice(-4), // Use last 4 chars of ID as srNo
        product: item.productName || 'Unknown Product',
        productId: product?._id?.toString?.() || item.product?.toString?.() || '',
        productName: item.productName || 'Unknown Product',
        productImage: item.productImage || product?.mainImage || '',
        soldBy: (item.seller as any)?.storeName || 'N/A',
        unit: unit,
        price: item.unitPrice || 0,
        unitPrice: item.unitPrice || 0,
        tax: 0,
        taxPercent: 0,
        qty: item.quantity || 0,
        quantity: item.quantity || 0,
        subtotal: item.total || 0,
        sku: item.sku || '',
        variation: item.variation || '',
        variationId: resolvedVariationId,
      };
    });

    // Format order data for frontend
    const orderDetail = {
      id: order._id,
      _id: order._id,
      orderNumber: order.orderNumber || order.invoiceNumber || 'N/A',
      invoiceNumber: order.invoiceNumber || order.orderNumber || 'N/A',
      orderDate: order.orderDate ? order.orderDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      deliveryDate: order.estimatedDeliveryDate ? order.estimatedDeliveryDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      timeSlot: order.timeSlot || 'N/A',
      status: order.status === 'On the way' ? 'Out For Delivery' : order.status,
      customer: order.customer,
      customerName: (order.customer as any)?.name || order.customerName || '',
      customerEmail: (order.customer as any)?.email || order.customerEmail || '',
      customerPhone: (order.customer as any)?.phone || order.customerPhone || '',
      deliveryBoyName: (order.deliveryBoy as any)?.name || '',
      deliveryBoyPhone: (order.deliveryBoy as any)?.mobile || '',
      items: formattedItems,
      subtotal: order.subtotal || 0,
      tax: order.tax || 0,
      grandTotal: order.total || 0,
      paymentMethod: order.paymentMethod || 'N/A',
      paymentStatus: order.paymentStatus || 'Pending',
      deliveryAddress: order.deliveryAddress || {},
    };

    return res.status(200).json({
      success: true,
      message: "Order details fetched successfully",
      data: orderDetail,
    });
  }
);

/**
 * Update order status (seller can update: Accepted, On the way, Delivered, Cancelled)
 */
export const updateOrderStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const { id } = req.params;
    const { status } = req.body;

    // Validate allowed status updates for seller
    const allowedStatuses = ['Accepted', 'On the way', 'Delivered', 'Cancelled'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Seller can only update to: ${allowedStatuses.join(', ')}`,
      });
    }

    // Check if seller has items in this order
    const hasItems = await OrderItem.exists({ order: id, seller: sellerId });
    if (!hasItems) {
      return res.status(404).json({
        success: false,
        message: "Order not found or access denied",
      });
    }

    // Find the order
    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Check if status is already the same
    if (order.status === status) {
      return res.status(400).json({
        success: false,
        message: `Order is already ${status}`,
      });
    }

    const previousStatus = order.status;
    order.status = status;
    await order.save();

    // If order is delivered, credit seller's balance
    if (status === 'Delivered' && previousStatus !== 'Delivered') {
      const seller = await Seller.findById(sellerId);
      if (seller) {
        // Calculate net earning (sale amount - commission)
        // Commission is stored in seller model
        const commissionRate = (seller.commission || 0) / 100;
        const commissionAmount = order.grandTotal * commissionRate;
        const netEarning = order.grandTotal - commissionAmount;

        seller.balance = (seller.balance || 0) + netEarning;
        await seller.save();

        // Log transaction
        await WalletTransaction.create({
          sellerId,
          amount: netEarning,
          type: 'Credit',
          description: `Earnings from Order #${order.orderId}`,
          reference: `ORD-${order.orderId}-${Date.now()}`,
          status: 'Completed'
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      data: {
        id: order._id,
        status: order.status,
      },
    });
  }
);

/**
 * Get online orders (excluding POS) for seller
 */
export const getOnlineOrders = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const {
      dateFrom,
      dateTo,
      status,
      search,
      page = "1",
      limit = "10",
      sortBy = "orderDate",
      sortOrder = "desc",
    } = req.query;

    // Find all order IDs that contain items from this seller
    const orderItems = await OrderItem.find({ seller: sellerId }).distinct("order");

    // Build query - filter by orders containing this seller's items
    const query: any = {
      _id: { $in: orderItems },
      // Exclude POS orders
      adminNotes: { $not: { $regex: `POS Order - Seller:`, $options: 'i' } }
    };

    // Date range filter
    if (dateFrom || dateTo) {
      query.orderDate = {};
      if (dateFrom) {
        query.orderDate.$gte = new Date(dateFrom as string);
      }
      if (dateTo) {
        query.orderDate.$lte = new Date(dateTo as string);
      }
    }

    // Status filter
    if (status && status !== 'All Status') {
      const statusMapping: Record<string, string> = {
        'Pending': 'Pending',
        'Accepted': 'Accepted',
        'On the way': 'On the way',
        'Delivered': 'Delivered',
        'Cancelled': 'Cancelled',
        'Rejected': 'Rejected',
      };
      query.status = statusMapping[status as string] || status;
    }

    // Search filter
    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: "i" } },
        { customerName: { $regex: search, $options: "i" } },
        { customerPhone: { $regex: search, $options: "i" } },
       // { 'deliveryAddress.phone': { $regex: search, $options: "i" } },
      ];
    }

    // Pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Sort
    const sort: any = {};
    sort[sortBy as string] = sortOrder === "asc" ? 1 : -1;

    // Get orders
    const orders = await Order.find(query)
      .populate("customer", "name email phone")
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    // Get total count
    const total = await Order.countDocuments(query);

    // Format for report
    const formattedOrders = orders.map(order => ({
      _id: order._id,
      orderNumber: order.orderNumber,
      orderDate: order.orderDate,
      customerName: order.customerName || (order.customer as any)?.name || 'Guest',
      customerPhone: order.customerPhone || (order.customer as any)?.phone || '',
      total: order.total,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      status: order.status
    }));

    return res.status(200).json({
      success: true,
      data: formattedOrders,
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
 * Get POS orders for seller report
 */
export const getSellerPOSOrders = asyncHandler(
  async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const {
      dateFrom,
      dateTo,
      paymentMethod,
      search,
      page = "1",
      limit = "10",
      sortBy = "orderDate",
      sortOrder = "desc",
    } = req.query;

    const query: any = {
      // Filter strictly by POS note for this seller
      adminNotes: { $regex: `POS Order - Seller: ${sellerId}`, $options: 'i' }
    };

    // Date range filter
    if (dateFrom || dateTo) {
      query.orderDate = {};
      if (dateFrom) {
        query.orderDate.$gte = new Date(dateFrom as string);
      }
      if (dateTo) {
        query.orderDate.$lte = new Date(dateTo as string);
      }
    }

    // Payment Method Filter
    if (paymentMethod && paymentMethod !== 'All Methods') {
      query.paymentMethod = paymentMethod;
    }

    // Search filter
    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: "i" } },
        { customerName: { $regex: search, $options: "i" } },
        { customerPhone: { $regex: search, $options: "i" } },
      ];
    }

    // Pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Sort
    const sort: any = {};
    if (sortBy) {
        sort[sortBy as string] = sortOrder === "asc" ? 1 : -1;
    } else {
        sort.orderDate = -1;
    }

    // Get orders
    const orders = await Order.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    const total = await Order.countDocuments(query);

    // Format Data
    const formattedOrders = orders.map(order => ({
      _id: order._id,
      orderNumber: order.orderNumber,
      orderDate: order.orderDate,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      total: order.total,
      paymentMethod: order.paymentMethod,
      status: order.status // Usually 'Delivered' for POS
    }));

    return res.status(200).json({
      success: true,
      data: formattedOrders,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  }
);
