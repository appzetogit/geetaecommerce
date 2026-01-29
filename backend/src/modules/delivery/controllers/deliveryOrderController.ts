import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import Order from "../../../models/Order";
import { notifySellersOfOrderUpdate } from "../../../services/sellerNotificationService";
import Delivery from "../../../models/Delivery";
import OrderItem from "../../../models/OrderItem";
import Seller from "../../../models/Seller";
import { generateDeliveryOtp, verifyDeliveryOtp } from "../../../services/deliveryOtpService";
import { processOrderStatusTransition } from "../../../services/orderService";
import DeliveryAssignment from "../../../models/DeliveryAssignment";
import Return from "../../../models/Return";

/**
 * Helper to map order items for response
 */
const mapOrderItems = (items: any[]) => {
    if (!items || !Array.isArray(items)) return [];
    return items.map((item: any) => ({
        name: item.productName || "Unknown Item",
        quantity: item.quantity || 0,
        price: item.total || 0, // Using total price for the line item
        image: item.productImage
    }));
};

/**
 * Get All Orders History
 * Returns all past orders with pagination
 */
export const getAllOrdersHistory = asyncHandler(async (req: Request, res: Response) => {
    const deliveryId = req.user?.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const orders = await Order.find({ deliveryBoy: deliveryId })
        .populate("items") // Populate OrderItems
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

    const total = await Order.countDocuments({ deliveryBoy: deliveryId });

    // Format orders for frontend
    const formattedOrders = orders.map(order => ({
        id: order._id,
        orderId: order.orderNumber,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        status: order.status,
        address: `${order.deliveryAddress.address}, ${order.deliveryAddress.city}`,
        totalAmount: order.total,
        items: mapOrderItems(order.items),
        createdAt: order.createdAt,
        estimatedDeliveryTime: order.estimatedDeliveryDate ? new Date(order.estimatedDeliveryDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'
    }));

    res.status(200).json({
        success: true,
        data: formattedOrders,
        pagination: {
            current: page,
            pages: Math.ceil(total / limit),
            total
        }
    });
});

/**
 * Get Today's Assigned Orders
 */
export const getTodayOrders = asyncHandler(async (req: Request, res: Response) => {
    const deliveryId = req.user?.userId;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const orders = await Order.find({
        deliveryBoy: deliveryId,
        $or: [
            { createdAt: { $gte: todayStart, $lte: todayEnd } }, // Created today
            { updatedAt: { $gte: todayStart, $lte: todayEnd } }  // OR Updated today
        ]
    })
        .populate("items")
        .sort({ updatedAt: -1 });

    const formattedOrders = orders.map(order => ({
        id: order._id,
        orderId: order.orderNumber,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        status: order.status,
        address: `${order.deliveryAddress?.address || ''}, ${order.deliveryAddress?.city || ''}`,
        items: mapOrderItems(order.items), // Real items
        totalAmount: order.total,
        estimatedDeliveryTime: order.estimatedDeliveryDate ? new Date(order.estimatedDeliveryDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A',
        createdAt: order.createdAt,
        // Distance calculation to be implemented. sending null/undefined for now to avoid fake data
        distance: null
    }));

    return res.status(200).json({
        success: true,
        data: formattedOrders
    });
});

/**
 * Get Pending Orders
 */
export const getPendingOrders = asyncHandler(async (req: Request, res: Response) => {
    const deliveryId = req.user?.userId;

    // Pending statuses: Ready for pickup, Out for delivery, Picked Up, Assigned, In Transit
    const orders = await Order.find({
        deliveryBoy: deliveryId,
        status: { $in: ["Ready for pickup", "Out for Delivery", "Picked Up", "Assigned", "In Transit"] }
    })
        .populate("items")
        .sort({ createdAt: -1 });

    const formattedOrders = orders.map(order => ({
        id: order._id,
        orderId: order.orderNumber,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        status: order.status,
        address: `${order.deliveryAddress?.address || ''}, ${order.deliveryAddress?.city || ''}`,
        items: mapOrderItems(order.items), // Real items
        totalAmount: order.total,
        estimatedDeliveryTime: order.estimatedDeliveryDate ? new Date(order.estimatedDeliveryDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A',
        createdAt: order.createdAt,
        distance: null
    }));

    return res.status(200).json({
        success: true,
        data: formattedOrders
    });
});

/**
 * Get Specific Order Details
 */
export const getOrderDetails = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const order = await Order.findById(id).populate("items");

    if (!order) {
        return res.status(404).json({ success: false, message: "Order not found" });
    }

    const formattedOrder = {
        id: order._id,
        orderId: order.orderNumber,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        address: `${order.deliveryAddress?.address || ''}, ${order.deliveryAddress?.city || ''}`,
        status: order.status,
        items: mapOrderItems(order.items), // Real populated items
        totalAmount: order.total,
        createdAt: order.createdAt,
        distance: null
    };

    return res.status(200).json({
        success: true,
        data: formattedOrder
    });
});

/**
 * Update Order Status
 */
export const updateOrderStatus = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;
    const deliveryId = req.user?.userId;

    const order = await Order.findById(id);
    if (!order) {
        return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.deliveryBoy?.toString() != deliveryId) {
        return res.status(403).json({ success: false, message: "This order is not assigned to you" });
    }

    // Save previous status before updating
    const previousStatus = order.status;

    // Status transition logic
    if (status) order.status = status;

    if (status === 'Picked up' || status === 'Out for Delivery') {
        order.deliveryBoyStatus = 'Picked Up';
    } else if (status === 'Delivered') {
        order.deliveryBoyStatus = 'Delivered';
        order.deliveredAt = new Date();
        order.paymentStatus = 'Paid'; // Assume paid on delivery (or already paid)

        // CASH COLLECTION LOGIC
        if (order.paymentMethod === 'COD') {
            await Delivery.findByIdAndUpdate(deliveryId, {
                $inc: { cashCollected: order.total }
            });
        }

        // COMMISSION LOGIC (Fixed mock amount for now, should be dynamic in future)
        const COMMISSION = 40;
        await Delivery.findByIdAndUpdate(deliveryId, {
            $inc: { balance: COMMISSION }
        });
    }

    await order.save();

    // Emit socket events for status changes
    const io = (req.app as any).get("io");
    if (io) {
        if (status === 'Picked up' && previousStatus !== 'Picked up') {
            // Emit order-taken event
            io.to(`order-${id}`).emit('order-taken', {
                orderId: id,
                message: 'Order has been picked up from seller',
            });
        }

        if (status === 'Delivered' && previousStatus !== 'Delivered') {
            // Emit order-delivered event to all relevant parties
            io.to(`order-${id}`).emit('order-delivered', {
                orderId: id,
                orderNumber: order.orderNumber,
                message: 'Order has been delivered successfully',
            });

            // Also emit to delivery boy room
            io.to(`delivery-${deliveryId}`).emit('order-delivered', {
                orderId: id,
                orderNumber: order.orderNumber,
                message: 'Order delivered successfully',
            });
        }

        // Trigger notification to sellers for payment status change or specific transitions
        if (order.paymentStatus === 'Paid' || status === 'Delivered') {
            notifySellersOfOrderUpdate(io, order, 'STATUS_UPDATE');
        }
    }

    return res.status(200).json({
        success: true,
        message: `Order status updated to ${status}`,
        data: order
    });
});

/**
 * Get Return Orders
 */
export const getReturnOrders = asyncHandler(async (req: Request, res: Response) => {
    const deliveryId = req.user?.userId;

    const orders = await Order.find({
        deliveryBoy: deliveryId,
        status: { $in: ["Returned", "Cancelled", "Rejected"] }
    })
        .populate("items")
        .sort({ updatedAt: -1 });

    const formattedOrders = orders.map(order => ({
        id: order._id,
        orderId: order.orderNumber,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        status: order.status,
        address: `${order.deliveryAddress?.address || ''}, ${order.deliveryAddress?.city || ''}`,
        items: mapOrderItems(order.items),
        totalAmount: order.total,
        createdAt: order.createdAt,
        distance: null
    }));

    return res.status(200).json({
        success: true,
        data: formattedOrders
    });
});

/**
 * Get Seller Locations for Order
 * Returns all unique seller shop locations for items in this order
 */
export const getSellerLocationsForOrder = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const deliveryId = req.user?.userId;

    // Verify order exists and is assigned to this delivery boy
    const order = await Order.findById(id);
    if (!order) {
        return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.deliveryBoy?.toString() !== deliveryId) {
        return res.status(403).json({ success: false, message: "This order is not assigned to you" });
    }

    // Get all unique seller IDs from order items
    const orderItems = await OrderItem.find({ order: id });
    const sellerIds = [...new Set(orderItems.map(item => item.seller.toString()))];

    // Get seller details including locations
    const sellers = await Seller.find({ _id: { $in: sellerIds } })
        .select('storeName address city latitude longitude');

    // Format seller locations
    const sellerLocations = sellers
        .filter(seller => seller.latitude && seller.longitude) // Only include sellers with location data
        .map(seller => ({
            sellerId: seller._id.toString(),
            storeName: seller.storeName,
            address: seller.address,
            city: seller.city,
            latitude: parseFloat(seller.latitude || '0'),
            longitude: parseFloat(seller.longitude || '0'),
        }));

    return res.status(200).json({
        success: true,
        data: sellerLocations
    });
});

/**
 * Send Delivery OTP
 * Generates and sends OTP to customer
 */
export const sendDeliveryOtp = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const deliveryId = req.user?.userId;

    const order = await Order.findById(id);
    if (!order) {
        return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.deliveryBoy?.toString() !== deliveryId) {
        return res.status(403).json({ success: false, message: "This order is not assigned to you" });
    }

    if (order.status === 'Delivered') {
        return res.status(400).json({ success: false, message: "Order is already delivered" });
    }

    if (order.status !== 'Picked up' && order.status !== 'Out for Delivery') {
        return res.status(400).json({ success: false, message: "Order must be picked up before sending delivery OTP" });
    }

    try {
        const result = await generateDeliveryOtp(id, order.customerPhone);

        // Emit otp-sent event to delivery boy
        const io = (req.app as any).get("io");
        if (io) {
            io.to(`delivery-${deliveryId}`).emit('otp-sent', {
                orderId: id,
                orderNumber: order.orderNumber,
                message: 'Delivery OTP sent to customer',
            });
        }

        return res.status(200).json({
            success: true,
            message: result.message
        });
    } catch (error: any) {
        return res.status(400).json({
            success: false,
            message: error.message || "Failed to send delivery OTP"
        });
    }
});

/**
 * Verify Delivery OTP and mark order as delivered
 */
export const verifyDeliveryOtpController = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { otp } = req.body;
    const deliveryId = req.user?.userId;

    if (!otp) {
        return res.status(400).json({ success: false, message: "OTP is required" });
    }

    const order = await Order.findById(id);
    if (!order) {
        return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.deliveryBoy?.toString() !== deliveryId) {
        return res.status(403).json({ success: false, message: "This order is not assigned to you" });
    }

    try {
        const previousStatus = order.status;
        const result = await verifyDeliveryOtp(id, otp);
        // Note: verifyDeliveryOtp is from service, not this controller

        // Reload order to get updated status
        const updatedOrder = await Order.findById(id);

        // Process order status transition for financial transactions
        if (updatedOrder && updatedOrder.status === 'Delivered' && previousStatus !== 'Delivered') {
            try {
                await processOrderStatusTransition(id, 'Delivered', previousStatus);
            } catch (transitionError: any) {
                console.error('Error processing order status transition:', transitionError);
                // Continue even if transition fails - order is already marked as delivered
            }
        }

        // Update delivery boy balance and cash collected (if COD)
        if (updatedOrder && updatedOrder.status === 'Delivered') {
            if (updatedOrder.paymentMethod === 'COD') {
                await Delivery.findByIdAndUpdate(deliveryId, {
                    $inc: { cashCollected: updatedOrder.total }
                });
            }

            // Update delivery boy commission
            const COMMISSION = 40; // Fixed amount for now, should be dynamic in future
            await Delivery.findByIdAndUpdate(deliveryId, {
                $inc: { balance: COMMISSION }
            });
        }

        return res.status(200).json({
            success: true,
            message: result.message,
            data: updatedOrder
        });
    } catch (error: any) {
        return res.status(400).json({
            success: false,
            message: error.message || "Failed to verify delivery OTP"
        });
    }
});

/**
 * Get Return/Replacement Tasks assigned to delivery boy
 */
export const getReturnTasks = asyncHandler(async (req: Request, res: Response) => {
    const deliveryId = req.user?.userId;

    const assignments = await DeliveryAssignment.find({
        deliveryBoy: deliveryId,
        assignmentType: { $in: ["Return", "Replacement"] },
        status: { $in: ["Assigned", "Accepted", "Picked Up", "In Transit"] }
    }).populate({
        path: "returnRequest",
        populate: [
            { path: "order", select: "orderNumber items customerName customerPhone deliveryAddress" },
            { path: "orderItem", populate: { path: "product", select: "productName mainImage" } }
        ]
    });

    const formattedTasks = assignments.map(asgn => {
        const rReq = asgn.returnRequest as any;
        if (!rReq) return null;

        return {
            id: asgn._id,
            returnRequestId: rReq._id,
            orderId: rReq.order?._id,
            orderNumber: rReq.order?.orderNumber,
            productName: rReq.orderItem?.productName || "Unknown Product",
            productImage: rReq.orderItem?.product?.mainImage,
            customerName: rReq.order?.customerName,
            customerPhone: rReq.order?.customerPhone,
            address: rReq.order?.deliveryAddress,
            quantity: rReq.quantity,
            reason: rReq.reason,
            requestType: rReq.requestType,
            status: asgn.status,
            createdAt: asgn.assignedAt
        };
    }).filter(t => t !== null);

    return res.status(200).json({
        success: true,
        data: formattedTasks
    });
});

/**
 * Update Return/Replacement Task Status
 */
export const updateReturnTaskStatus = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params; // assignmentId
    const { status } = req.body;
    const deliveryId = req.user?.userId;

    const assignment = await DeliveryAssignment.findOne({ _id: id, deliveryBoy: deliveryId });
    if (!assignment) {
        return res.status(404).json({ success: false, message: "Task assignment not found" });
    }

    const validStatuses = ["Accepted", "Picked Up", "In Transit", "Delivered", "Failed", "Cancelled"];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ success: false, message: "Invalid status" });
    }

    assignment.status = status as any;
    if (status === "Accepted") assignment.acceptedAt = new Date();
    if (status === "Picked Up") assignment.pickedUpAt = new Date();
    if (status === "In Transit") assignment.inTransitAt = new Date();
    if (status === "Delivered") assignment.deliveredAt = new Date();
    if (status === "Failed") assignment.failedAt = new Date();

    await assignment.save();

    // Update the Return request status as well
    if (assignment.returnRequest) {
        const rReq = await Return.findById(assignment.returnRequest);
        if (rReq) {
            if (status === "Picked Up") {
                rReq.status = "Picked Up";
                rReq.pickupCompleted = new Date();
            } else if (status === "Delivered") {
                rReq.status = "Completed";

                // If it was a return, mark order item as returned
                if (rReq.requestType === "Return") {
                    await OrderItem.findByIdAndUpdate(rReq.orderItem, { status: "Returned" });
                }
            }
            await rReq.save();
        }
    }

    return res.status(200).json({
        success: true,
        message: `Task status updated to ${status}`,
        data: assignment
    });
});
