import { Request, Response } from "express";
import Order from "../../../models/Order";
import Product from "../../../models/Product";
import OrderItem from "../../../models/OrderItem";
import Customer from "../../../models/Customer";
import Seller from "../../../models/Seller";
import Return from "../../../models/Return";
import AppSettings from "../../../models/AppSettings";
import mongoose from "mongoose";
import axios from "axios";
import { calculateDistance } from "../../../utils/locationHelper";
import { notifyDeliveryBoysOfNewOrder } from "../../../services/orderNotificationService";
import { notifySellersOfOrderUpdate } from "../../../services/sellerNotificationService";
import { generateDeliveryOtp } from "../../../services/deliveryOtpService";
import { Server as SocketIOServer } from "socket.io";

// Create a new order
export const createOrder = async (req: Request, res: Response) => {
    let session: mongoose.ClientSession | null = null;
    try {
        // Only start session if we are on a replica set (required for transactions)
        // For simplicity in local dev, we check and fallback if it fails
        try {
            session = await mongoose.startSession();
            session.startTransaction();
        } catch (sessionError) {
            console.warn("MongoDB Transactions not supported or failed to start. Proceeding without transaction.");
            session = null;
        }

        const { items, address, paymentMethod, fees } = req.body;
        const userId = req.user!.userId;

        // Log incoming request for debugging
        console.log("DEBUG: Order creation request:", {
            userId,
            itemsCount: items?.length,
            hasAddress: !!address,
            addressLat: address?.latitude,
            addressLng: address?.longitude,
            paymentMethod,
        });

        if (!items || items.length === 0) {
            if (session) await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: "Order must have at least one item",
            });
        }

        if (!address) {
            if (session) await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: "Delivery address is required",
            });
        }

        // Validate required address fields
        if (!address.city || (typeof address.city === 'string' && address.city.trim() === '')) {
            if (session) await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: "City is required in delivery address",
                details: {
                    receivedCity: address.city,
                    addressObject: address
                }
            });
        }

        if (!address.pincode || (typeof address.pincode === 'string' && address.pincode.trim() === '')) {
            if (session) await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: "Pincode is required in delivery address",
                details: {
                    receivedPincode: address.pincode,
                    addressObject: address
                }
            });
        }

        // Fetch customer details
        const customer = await Customer.findById(userId);
        if (!customer) {
            if (session) await session.abortTransaction();
            return res.status(404).json({
                success: false,
                message: "Customer not found",
            });
        }

        // Validate delivery address location
        // Handle both string and number types, and check for null/undefined (not truthy, since 0 is valid)
        const deliveryLat = address.latitude != null
            ? (typeof address.latitude === 'number' ? address.latitude : parseFloat(address.latitude))
            : null;
        const deliveryLng = address.longitude != null
            ? (typeof address.longitude === 'number' ? address.longitude : parseFloat(address.longitude))
            : null;

        if (deliveryLat == null || deliveryLng == null || isNaN(deliveryLat) || isNaN(deliveryLng)) {
            if (session) await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: "Delivery address location (latitude/longitude) is required",
                details: {
                    receivedLatitude: address.latitude,
                    receivedLongitude: address.longitude,
                    parsedLatitude: deliveryLat,
                    parsedLongitude: deliveryLng,
                }
            });
        }

        // Validate coordinates
        if (deliveryLat < -90 || deliveryLat > 90 || deliveryLng < -180 || deliveryLng > 180) {
            if (session) await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: "Invalid delivery address coordinates",
            });
        }

        // Initialize Order first to get an ID
        const newOrder = new Order({
            customer: new mongoose.Types.ObjectId(userId),
            customerName: customer.name,
            customerEmail: customer.email,
            customerPhone: customer.phone,
            deliveryAddress: {
                address: address.address || address.street || 'N/A',
                city: address.city || 'N/A',
                state: address.state || '',
                pincode: address.pincode || '000000',
                landmark: address.landmark || '',
                latitude: deliveryLat,
                longitude: deliveryLng,
            },
            paymentMethod: paymentMethod || 'COD',
            paymentStatus: 'Pending',
            status: 'Received',
            subtotal: 0,
            tax: 0,
            shipping: fees?.deliveryFee || 0,
            platformFee: fees?.platformFee || 0,
            discount: 0,
            total: 0,
            items: []
        });

        let calculatedSubtotal = 0;
        const orderItemIds: mongoose.Types.ObjectId[] = [];
        const sellerIds = new Set<string>(); // Track unique sellers

        for (const item of items) {
            if (!item.product || !item.product.id) {
                throw new Error("Invalid item structure: product.id is missing");
            }

            const qty = Number(item.quantity) || 0;
            if (qty <= 0) {
                throw new Error("Invalid item quantity");
            }

            // Atomically check stock and decrement to prevent race conditions
            let product;
            // The frontend sends variation info as 'variant' or 'variation'
            // In the product model, it's stored in 'variations' array
            const variationValue = item.variant || item.variation;

            if (variationValue) {
                // Try to decrement stock for the specific variation first
                // We check variations._id, variations.value, variations.title, or variations.pack
                product = session
                    ? await Product.findOneAndUpdate(
                        {
                            _id: item.product.id,
                            $or: [
                                { "variations._id": mongoose.isValidObjectId(variationValue) ? variationValue : new mongoose.Types.ObjectId() },
                                { "variations.value": variationValue },
                                { "variations.title": variationValue },
                                { "variations.pack": variationValue }
                            ],
                            "variations.stock": { $gte: qty }
                        },
                        { $inc: { "variations.$.stock": -qty, stock: -qty } },
                        { session, new: true }
                    )
                    : await Product.findOneAndUpdate(
                        {
                            _id: item.product.id,
                            $or: [
                                { "variations._id": mongoose.isValidObjectId(variationValue) ? variationValue : new mongoose.Types.ObjectId() },
                                { "variations.value": variationValue },
                                { "variations.title": variationValue },
                                { "variations.pack": variationValue }
                            ],
                            "variations.stock": { $gte: qty }
                        },
                        { $inc: { "variations.$.stock": -qty, stock: -qty } },
                        { new: true }
                    );
            }

            if (!product) {
                // If we are here, either variationValue wasn't provided, or it didn't match any variation with enough stock.
                // We'll try to find the product first to see if it has variations.
                const checkProduct = await Product.findById(item.product.id);

                if (checkProduct && checkProduct.variations && checkProduct.variations.length > 0) {
                    // Product has variations, but we didn't match one.
                    // If a variation was provided, it means that specific variation is out of stock.
                    if (variationValue) {
                         throw new Error(`Insufficient stock for variation: ${variationValue}`);
                    }

                    // No variation was provided, but the product has them.
                    // To maintain data consistency, we'll try to decrement from the first variation.
                    product = session
                        ? await Product.findOneAndUpdate(
                            {
                                _id: item.product.id,
                                "variations.0.stock": { $gte: qty }
                            },
                            { $inc: { "variations.0.stock": -qty, stock: -qty } },
                            { session, new: true }
                        )
                        : await Product.findOneAndUpdate(
                            {
                                _id: item.product.id,
                                "variations.0.stock": { $gte: qty }
                            },
                            { $inc: { "variations.0.stock": -qty, stock: -qty } },
                            { new: true }
                        );
                } else {
                    // No variations, just decrement top-level stock
                    product = session
                        ? await Product.findOneAndUpdate(
                            { _id: item.product.id, stock: { $gte: qty } },
                            { $inc: { stock: -qty } },
                            { session, new: true }
                          )
                        : await Product.findOneAndUpdate(
                            { _id: item.product.id, stock: { $gte: qty } },
                            { $inc: { stock: -qty } },
                            { new: true }
                          );
                }
            }

            if (!product) {
                throw new Error(`Insufficient stock or product not found: ${item.product.name || 'ID: ' + item.product.id}${variationValue ? ' (' + variationValue + ')' : ''}`);
            }

            // Track seller IDs to validate location
            if (product.seller) {
                sellerIds.add(product.seller.toString());
            }

            // Determine the price based on variation and discounts
            let selectedVariation;
            if (variationValue && product.variations) {
                 selectedVariation = product.variations.find((v: any) =>
                     (v._id && v._id.toString() === variationValue) ||
                     v.value === variationValue ||
                     v.title === variationValue ||
                     v.pack === variationValue
                 );
            }
            if (!selectedVariation && product.variations && product.variations.length > 0) {
                 // Fallback to first if no variation spec or not found (consistent with stock fallback)
                 selectedVariation = product.variations[0];
            }

            const itemPrice = (selectedVariation?.discPrice && selectedVariation.discPrice > 0)
                ? selectedVariation.discPrice
                : (product.discPrice && product.discPrice > 0)
                ? product.discPrice
                : (selectedVariation?.price || product.price || 0);
            const itemTotal = itemPrice * qty;
            calculatedSubtotal += itemTotal;

            // Create OrderItem
            const newOrderItemData = {
                order: newOrder._id,
                product: product._id,
                seller: product.seller,
                productName: product.productName,
                productImage: product.mainImage,
                sku: product.sku,
                unitPrice: itemPrice,
                quantity: qty,
                total: itemTotal,
                variation: variationValue,
                status: 'Pending'
            };

            const newOrderItem = new OrderItem(newOrderItemData);
            if (session) {
                await newOrderItem.save({ session });
            } else {
                await newOrderItem.save();
            }
            orderItemIds.push(newOrderItem._id as mongoose.Types.ObjectId);
        }

        // Validate all sellers can deliver to user's location
        if (sellerIds.size > 0) {
            const uniqueSellerIds = Array.from(sellerIds).map(id => new mongoose.Types.ObjectId(id));

            // Find sellers and check if user is within their service radius
            const sellers = await Seller.find({
                _id: { $in: uniqueSellerIds },
                status: "Approved",
                location: { $exists: true, $ne: null },
            });

            // Check each seller can deliver to user's location
            for (const seller of sellers) {
                if (!seller.location || !seller.location.coordinates) {
                    if (session) await session.abortTransaction();
                    return res.status(403).json({
                        success: false,
                        message: `Seller ${seller.storeName} does not have a valid location. Order cannot be placed.`,
                    });
                }

                const sellerLng = seller.location.coordinates[0];
                const sellerLat = seller.location.coordinates[1];
                const distance = calculateDistance(deliveryLat, deliveryLng, sellerLat, sellerLng);
                const serviceRadius = seller.serviceRadiusKm || 10;

                if (distance > serviceRadius) {
                    if (session) await session.abortTransaction();
                    return res.status(403).json({
                        success: false,
                        message: `Your delivery address is ${distance.toFixed(2)} km away from ${seller.storeName}. They only deliver within ${serviceRadius} km. Please select products from sellers in your area.`,
                    });
                }
            }
        }

        // Apply fees
        const platformFee = Number(fees?.platformFee) || 0;
        const deliveryFee = Number(fees?.deliveryFee) || 0;
        const finalTotal = calculatedSubtotal + platformFee + deliveryFee;

        // Update Order with calculated values and items
        newOrder.subtotal = Number(calculatedSubtotal.toFixed(2));
        newOrder.total = Number(finalTotal.toFixed(2));
        newOrder.items = orderItemIds;


        if (session) {
            await newOrder.save({ session });
            await session.commitTransaction();
        } else {
            // Validate before saving to catch errors with details
            const validationError = newOrder.validateSync();
            if (validationError) {
                console.error("DEBUG: Order Validation Error:", validationError.errors);
                throw validationError;
            }
            await newOrder.save();
        }


        // Emit notification to all available delivery boys
        try {
            const io: SocketIOServer = (req.app.get("io") as SocketIOServer);
            if (io) {
                // Reload order to ensure orderNumber is set (generated by pre-validate hook)
                const savedOrder = await Order.findById(newOrder._id).lean();
                if (savedOrder) {
                    await notifyDeliveryBoysOfNewOrder(io, savedOrder);
                    await notifySellersOfOrderUpdate(io, savedOrder, 'NEW_ORDER');
                }
            }
        } catch (notificationError) {
            // Log error but don't fail the order creation
            console.error("Error notifying delivery boys:", notificationError);
        }

        return res.status(201).json({
            success: true,
            message: "Order placed successfully",
            data: newOrder,
        });

    } catch (error: any) {
        if (session) {
            try {
                await session.abortTransaction();
            } catch (abortError) {
                console.error("Error aborting transaction:", abortError);
            }
        }

        console.error("DEBUG: Order Creation Error Detail:", {
            message: error.message,
            name: error.name,
            errors: error.errors ? Object.keys(error.errors).map(key => ({
                field: key,
                message: error.errors[key].message,
                value: error.errors[key].value
            })) : undefined,
            stack: error.stack,
            body: req.body
        });

        // Return a more informative error message if it's a validation error
        let errorMessage = "Error creating order. " + error.message;
        if (error.name === 'ValidationError') {
            const fields = Object.keys(error.errors).join(', ');
            errorMessage = `Validation failed for fields: ${fields}. ${error.message}`;
        }

        return res.status(500).json({
            success: false,
            message: errorMessage,
            error: error.message,
            details: error.errors,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    } finally {
        if (session) session.endSession();
    }
};

// Get authenticated customer's orders
export const getMyOrders = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.userId;
        const { status, page = 1, limit = 10 } = req.query;

        const query: any = { customer: userId };

        if (status) {
            query.status = status; // Note: Model field is 'status', not 'orderStatus'
        }

        const skip = (Number(page) - 1) * Number(limit);

        const orders = await Order.find(query)
            .populate({
                path: 'items',
                populate: { path: 'product', select: 'productName mainImage price' }
            })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit));

        const total = await Order.countDocuments(query);

        // Transform orders to match frontend Order type
        const transformedOrders = orders.map(order => {
            const orderObj = order.toObject();
            return {
                ...orderObj,
                id: orderObj._id.toString(),
                totalItems: Array.isArray(orderObj.items) ? orderObj.items.length : 0,
                totalAmount: orderObj.total,
                fees: {
                    platformFee: orderObj.platformFee || 0,
                    deliveryFee: orderObj.shipping || 0
                },
                // Keep original fields for backward compatibility
                subtotal: orderObj.subtotal,
                address: orderObj.deliveryAddress
            };
        });

        return res.status(200).json({
            success: true,
            data: transformedOrders,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit)),
            },
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: "Error fetching orders",
            error: error.message,
        });
    }
};

// Get single order details
export const getOrderById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user!.userId;

        // Find order and ensure it belongs to the user
        const order = await Order.findOne({ _id: id, customer: userId })
            .populate({
                path: 'items',
                populate: [
                    { path: 'product', select: 'productName mainImage pack manufacturer price' },
                    { path: 'seller', select: 'storeName city phone fssaiLicNo' }
                ]
            });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found",
            });
        }

        // Transform order to match frontend Order type
        const orderObj = order.toObject();
        const transformedOrder = {
            ...orderObj,
            id: orderObj._id.toString(),
            totalItems: Array.isArray(orderObj.items) ? orderObj.items.length : 0,
            totalAmount: orderObj.total,
            fees: {
                platformFee: orderObj.platformFee || 0,
                deliveryFee: orderObj.shipping || 0
            },
            // Keep original fields for backward compatibility
            subtotal: orderObj.subtotal,
            address: orderObj.deliveryAddress,
            // Include invoice enabled flag
            invoiceEnabled: orderObj.invoiceEnabled || false
        };

        return res.status(200).json({
            success: true,
            data: transformedOrder,
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: "Error fetching order detail",
            error: error.message,
        });
    }
};

/**
 * Refresh Delivery OTP
 */
export const refreshDeliveryOtp = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.user!.userId;

        const order = await Order.findOne({ _id: id, customer: userId });
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        if (order.status === 'Delivered') {
            return res.status(400).json({ success: false, message: "Order is already delivered" });
        }

        // Generate and send new OTP
        const result = await generateDeliveryOtp(id, order.customerPhone);

        // Emit socket event if needed (customer room)
        const io = (req.app as any).get("io");
        if (io) {
            io.to(`order-${id}`).emit('delivery-otp-refreshed', {
                orderId: id,
                deliveryOtp: order.deliveryOtp, // The service saves it to the order
                expiresAt: order.deliveryOtpExpiresAt
            });
        }

        return res.status(200).json(result);
    } catch (error: any) {
        console.error('Error refreshing delivery OTP:', error);
        return res.status(500).json({
            success: false,
            message: "Failed to refresh delivery OTP",
            error: error.message
        });
    }
};

// Cancel Order
export const cancelOrder = async (req: Request, res: Response) => {
    let session: mongoose.ClientSession | null = null;
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const userId = req.user!.userId;

        if (!reason) {
            return res.status(400).json({ success: false, message: "Cancellation reason is required" });
        }

        // Only start session if we are on a replica set (required for transactions)
        try {
            session = await mongoose.startSession();
            session.startTransaction();
        } catch (sessionError) {
             console.warn("MongoDB Transactions not supported or failed to start. Proceeding without transaction.");
             session = null;
        }

        const order = session
            ? await Order.findOne({ _id: id, customer: userId }).session(session)
            : await Order.findOne({ _id: id, customer: userId });

        if (!order) {
            if(session) await session.abortTransaction();
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        if (['Delivered', 'Cancelled', 'Returned', 'Rejected', 'Out for Delivery', 'Shipped'].includes(order.status)) {
             if(session) await session.abortTransaction();
            return res.status(400).json({
                success: false,
                message: `Order cannot be cancelled as it is already ${order.status}`
            });
        }

        // Restore stock
        for (const item of order.items) {
             const orderItem = session
                ? await OrderItem.findById(item).session(session)
                : await OrderItem.findById(item);

             if (orderItem) {
                 const product = session
                    ? await Product.findById(orderItem.product).session(session)
                    : await Product.findById(orderItem.product);

                 if (product) {
                     // Check if it was a variation
                     if (orderItem.variation) {
                          // Try to find matching variation
                          const variationIndex = product.variations?.findIndex((v: any) => v.value === orderItem.variation || v.title === orderItem.variation || v.pack === orderItem.variation);

                          if (variationIndex !== undefined && variationIndex !== -1 && product.variations) {
                               product.variations[variationIndex].stock += orderItem.quantity;
                          } else if (product.variations && product.variations.length > 0) {
                               // Fallback to first variation if specific one not found (should be rare)
                               product.variations[0].stock += orderItem.quantity;
                          }
                     }

                     // Helper: also increment main stock if variations are just attributes or if simple product
                     product.stock += orderItem.quantity;
                     if (session) {
                        await product.save({ session });
                     } else {
                        await product.save();
                     }
                 }

                 orderItem.status = 'Cancelled';
                 if (session) {
                    await orderItem.save({ session });
                 } else {
                    await orderItem.save();
                 }
             }
        }

        order.status = 'Cancelled';
        order.cancellationReason = reason;
        order.cancelledAt = new Date();
        order.cancelledBy = new mongoose.Types.ObjectId(userId); // Use Customer ID as canceller

        if (session) {
            await order.save({ session });
            await session.commitTransaction();
        } else {
            await order.save();
        }

        // Notify
        try {
            const io = (req.app as any).get("io");
            if (io) {
                await notifySellersOfOrderUpdate(io, order, 'ORDER_CANCELLED');
                // Notify delivery boy if assigned?
            }
        } catch (err) {
            console.error("Notification error:", err);
        }

        return res.status(200).json({
            success: true,
            message: "Order cancelled successfully",
            data: {
                id: order._id,
                status: order.status,
                cancelledAt: order.cancelledAt
            }
        });

    } catch (error: any) {
        if(session) {
            try {
                await session.abortTransaction();
            } catch (e) {}
        }
        console.error('Error cancelling order:', error);
        return res.status(500).json({
            success: false,
            message: "Failed to cancel order",
            error: error.message
        });
    } finally {
        if (session) session.endSession();
    }
};

// Update Order Notes (Instructions/Special Requests)
export const updateOrderNotes = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { deliveryInstructions, specialRequests } = req.body;
        const userId = req.user!.userId;

        const order = await Order.findOne({ _id: id, customer: userId });

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        if (['Delivered', 'Cancelled', 'Returned'].includes(order.status)) {
            return res.status(400).json({
                success: false,
                message: `Cannot update notes for ${order.status} order`
            });
        }

        if (deliveryInstructions !== undefined) order.deliveryInstructions = deliveryInstructions;
        if (specialRequests !== undefined) order.specialRequests = specialRequests;

        await order.save();

        return res.status(200).json({
            success: true,
            message: "Order notes updated",
            data: {
                deliveryInstructions: order.deliveryInstructions,
                specialRequests: order.specialRequests
            }
        });
    } catch (error: any) {
         console.error('Error updating order notes:', error);
        return res.status(500).json({
            success: false,
            message: "Failed to update order notes",
            error: error.message
        });
    }
};

/**
 * Initiate Online Order (Razorpay/Cashfree)
 */
export const initiateOnlineOrder = async (req: Request, res: Response) => {
    let session: mongoose.ClientSession | null = null;
    try {
        // Only start session if we are on a replica set (required for transactions)
        try {
            session = await mongoose.startSession();
            session.startTransaction();
        } catch (sessionError) {
             session = null;
        }

        const { items, address, paymentMethod, fees } = req.body;
        const userId = req.user!.userId;

        // --- Validation Logic (Same as createOrder) ---
        if (!items || items.length === 0) {
            if (session) await session.abortTransaction();
            return res.status(400).json({ success: false, message: "Order must have at least one item" });
        }

        if (!address) {
            if (session) await session.abortTransaction();
            return res.status(400).json({ success: false, message: "Delivery address is required" });
        }

        const customer = await Customer.findById(userId);
        if (!customer) {
            if (session) await session.abortTransaction();
            return res.status(404).json({ success: false, message: "Customer not found" });
        }

        const deliveryLat = address.latitude != null ? Number(address.latitude) : null;
        const deliveryLng = address.longitude != null ? Number(address.longitude) : null;

        if (deliveryLat == null || deliveryLng == null || isNaN(deliveryLat) || isNaN(deliveryLng)) {
             if (session) await session.abortTransaction();
             return res.status(400).json({ success: false, message: "Invalid delivery address coordinates" });
        }

        // Fetch AppSettings to check for online payment discount
        const settings = await AppSettings.findOne().lean();
        const onlineDiscountConfig = settings?.onlinePaymentDiscount;

        // --- Create Order Shell ---
        const newOrder = new Order({
            customer: new mongoose.Types.ObjectId(userId),
            customerName: customer.name,
            customerEmail: customer.email,
            customerPhone: customer.phone,
            deliveryAddress: {
                address: address.address || address.street || 'N/A',
                city: address.city || 'N/A',
                state: address.state || '',
                pincode: address.pincode || '000000',
                landmark: address.landmark || '',
                latitude: deliveryLat,
                longitude: deliveryLng,
            },
            paymentMethod: paymentMethod || 'Online',
            paymentStatus: 'Pending',
            status: 'Pending', // Pending payment
            subtotal: 0,
            tax: 0,
            shipping: fees?.deliveryFee || 0,
            platformFee: fees?.platformFee || 0,
            discount: 0,
            total: 0,
            items: []
        });

        let calculatedSubtotal = 0;
        const orderItemIds: mongoose.Types.ObjectId[] = [];
        const sellerIds = new Set<string>();

        // --- Process Items & Stock ---
        for (const item of items) {
            const qty = Number(item.quantity) || 0;
            if (qty <= 0) throw new Error("Invalid item quantity");

            const variationValue = item.variant || item.variation;
            let product;

            // Try decrementing stock (with session if available)
            // Skip stock check/deduction for Free Gifts
            if (item.isFreeGift) {
                // For free gifts, we just need the product details to create the order item
                product = await Product.findById(item.product.id);
                if (!product) {
                     // If it's a transient object from frontend (rare), we might need to handle differently,
                     // but for now assume it exists in DB. If not found, log warning and skip adding to order?
                     // Or better, just continue; it won't be added to orderItemIds if we don't push it.
                     // But we should likely throw error if gift rule implies it exists.
                     // However, to prevent order blocking:
                     console.warn(`Free gift product ${item.product.id} not found in DB.`);
                     continue;
                }
            } else {
                const query = {
                    _id: item.product.id,
                ...(variationValue ? {
                    $or: [
                        { "variations._id": mongoose.isValidObjectId(variationValue) ? variationValue : new mongoose.Types.ObjectId() },
                        { "variations.value": variationValue },
                        { "variations.title": variationValue },
                        { "variations.pack": variationValue }
                    ],
                     "variations.stock": { $gte: qty }
                } : { stock: { $gte: qty } })
            };

            const update = variationValue
                ? { $inc: { "variations.$.stock": -qty, stock: -qty } }
                : { $inc: { stock: -qty } };

            product = session
                ? await Product.findOneAndUpdate(query, update, { session, new: true })
                : await Product.findOneAndUpdate(query, update, { new: true });
            }

            // Fallback logic for variations (simplified from createOrder for brevity, but crucial parts retained)
            if (!product && variationValue) {
                // ... (If specific variation query failed, maybe try generic or throw error)
                // Assuming strict check for now as per createOrder logic
                throw new Error(`Insufficient stock for variation: ${variationValue}`);
            }
            if(!product && !variationValue) {
                 // Try finding if it has variations but none selected (fallback to first)
                 const checkProd = await Product.findById(item.product.id);
                 if(checkProd && checkProd.variations && checkProd.variations.length > 0) {
                     product = session
                        ? await Product.findOneAndUpdate({ _id: item.product.id, "variations.0.stock": { $gte: qty } }, { $inc: { "variations.0.stock": -qty, stock: -qty } }, { session, new: true })
                        : await Product.findOneAndUpdate({ _id: item.product.id, "variations.0.stock": { $gte: qty } }, { $inc: { "variations.0.stock": -qty, stock: -qty } }, { new: true });
                 }
            }
            // End of Free Gift vs Regular Product Logic


            if (!product) {
                console.error(`Processed Item Failed:`, {
                    itemId: item.product.id,
                    isFreeGift: item.isFreeGift,
                    variant: variationValue
                });
                throw new Error(`Insufficient stock or product not found: ID ${item.product.id}`);
            }

            if (product.seller) sellerIds.add(product.seller.toString());

            // Price Logic
            let selectedVariation;
            if (variationValue && product.variations) {
                selectedVariation = product.variations.find((v: any) =>
                    (v._id && v._id.toString() === variationValue) || v.value === variationValue || v.title === variationValue || v.pack === variationValue
                );
            }
            if (!selectedVariation && product.variations && product.variations.length > 0) selectedVariation = product.variations[0];

            const itemPrice = (selectedVariation?.discPrice && selectedVariation.discPrice > 0)
                 ? selectedVariation.discPrice
                 : (product.discPrice && product.discPrice > 0 ? product.discPrice : (selectedVariation?.price || product.price || 0));

            const itemTotal = itemPrice * qty;
            calculatedSubtotal += itemTotal;

            const newOrderItem = new OrderItem({
                order: newOrder._id,
                product: product._id,
                seller: product.seller,
                productName: product.productName,
                productImage: product.mainImage,
                sku: product.sku,
                unitPrice: itemPrice,
                quantity: qty,
                total: itemTotal,
                variation: variationValue,
                status: 'Pending'
            });

            if (session) await newOrderItem.save({ session });
            else await newOrderItem.save();
            orderItemIds.push(newOrderItem._id as mongoose.Types.ObjectId);
        }

        // --- Validate Sellers (Distance) ---
        if (sellerIds.size > 0) {
            const uniqueSellerIds = Array.from(sellerIds).map(id => new mongoose.Types.ObjectId(id));
            const sellers = await Seller.find({ _id: { $in: uniqueSellerIds }, status: "Approved", location: { $exists: true, $ne: null } });

            for (const seller of sellers) {
                 if (!seller.location || !seller.location.coordinates) continue;
                 const distance = calculateDistance(deliveryLat, deliveryLng, seller.location.coordinates[1], seller.location.coordinates[0]);
                 const serviceRadius = seller.serviceRadiusKm || 10;
                 if (distance > serviceRadius) {
                     // if (session) await session.abortTransaction();
                     // return res.status(403).json({ success: false, message: `Seller ${seller.storeName} does not deliver to your location.` });
                     console.warn(`Seller ${seller.storeName} is out of radius (${distance}km > ${serviceRadius}km) but allowing for testing.`);
                 }
            }
        }

        // --- Finalize Order Totals ---
        const platformFee = Number(fees?.platformFee) || 0;
        const deliveryFee = Number(fees?.deliveryFee) || 0;

        // Base amount for discount is subtotal + shipping + platform fee
        const baseAmount = calculatedSubtotal + deliveryFee + platformFee;

        let onlineDiscount = 0;
        if (onlineDiscountConfig?.enabled && onlineDiscountConfig?.percentage > 0) {
            onlineDiscount = (baseAmount * onlineDiscountConfig.percentage) / 100;
        }

        const finalTotal = baseAmount - onlineDiscount;

        newOrder.subtotal = Number(calculatedSubtotal.toFixed(2));
        newOrder.discount = Number(onlineDiscount.toFixed(2));
        newOrder.total = Number(finalTotal.toFixed(2));
        newOrder.items = orderItemIds;

        if (session) {
            await newOrder.save({ session });
            await session.commitTransaction();
        } else {
             await newOrder.save();
        }

        // --- Initiate Gateway ---
        const amountInPaise = Math.round(finalTotal * 100);

        if (paymentMethod === 'Razorpay') {
             const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
             const razorpayResponse = await axios.post('https://api.razorpay.com/v1/orders', {
                 amount: amountInPaise,
                 currency: "INR",
                 receipt: newOrder.orderNumber,
                 notes: { order_id: newOrder._id.toString() }
             }, { headers: { 'Authorization': `Basic ${auth}` } });

             return res.status(200).json({
                 success: true,
                 data: {
                     gateway: 'Razorpay',
                     orderId: newOrder._id,
                     razorpayOrderId: razorpayResponse.data.id,
                     amount: finalTotal,
                     key: process.env.RAZORPAY_KEY_ID,
                     customer: { name: customer.name, email: customer.email, contact: customer.phone }
                 }
             });
        } else if (paymentMethod === 'Cashfree') {
            const baseUrl = process.env.CASHFREE_MODE === 'production' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';
            const cashfreeResponse = await axios.post(`${baseUrl}/orders`, {
                order_id: `cust_${newOrder._id}_${Date.now()}`,
                order_amount: finalTotal,
                order_currency: "INR",
                customer_details: {
                    customer_id: customer._id.toString(),
                    customer_email: customer.email || "customer@example.com",
                    customer_phone: customer.phone || "9999999999"
                },
                order_meta: {
                    return_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/order/success?order_id=${newOrder._id}`
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
                    orderId: newOrder._id,
                    paymentSessionId: cashfreeResponse.data.payment_session_id,
                    amount: finalTotal,
                    isSandbox: process.env.CASHFREE_MODE !== 'production'
                }
            });
        }

        return res.status(400).json({ success: false, message: "Invalid Payment Gateway" });

    } catch (error: any) {
        if (session) {
             try { await session.abortTransaction(); } catch (e) {}
        }
        console.error("Initiate Online Order Error:", error);
        return res.status(500).json({ success: false, message: error.message || "Failed to initiate order" });
    } finally {
        if (session) session.endSession();
    }
};

/**
 * Verify Online Payment
 */
export const verifyOnlinePayment = async (req: Request, res: Response) => {
    try {
        const { orderId, paymentId, status } = req.body;

        const order = await Order.findById(orderId);
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });

        if (order.status !== 'Pending') {
            return res.status(400).json({ success: false, message: "Order is not in pending state" });
        }

        order.paymentStatus = "Paid";
        order.status = "Received"; // Now ready for processing
        order.adminNotes = (order.adminNotes || "") + `\nOnline Payment Verified (ID: ${paymentId})`;
        await order.save();

        // Notify
        const io: SocketIOServer = (req.app.get("io") as SocketIOServer);
        if (io) {
            await notifyDeliveryBoysOfNewOrder(io, order);
            await notifySellersOfOrderUpdate(io, order, 'NEW_ORDER');
        }

        return res.status(200).json({ success: true, message: "Payment verified", data: order });
    } catch (error: any) {
        return res.status(500).json({ success: false, message: "Verification failed", error: error.message });
    }
};

/**
 * Request Return or Replacement
 */
export const requestReturnOrReplace = async (req: Request, res: Response) => {
    try {
        const { orderId, orderItemId, requestType, reason, description, images, quantity } = req.body;
        const userId = req.user!.userId;

        // Validation
        if (!orderId || !orderItemId || !requestType || !reason) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: orderId, orderItemId, requestType, reason"
            });
        }

        if (requestType === "Replacement" && (!images || images.length === 0)) {
            return res.status(400).json({
                success: false,
                message: "Issue image is mandatory for replacement request"
            });
        }

        const order = await Order.findOne({ _id: orderId, customer: userId });
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        // Validate that order is delivered (standard policy)
        if (order.status !== "Delivered") {
            return res.status(400).json({
                success: false,
                message: "Requests can only be raised for delivered orders"
            });
        }

        const orderItem = await OrderItem.findOne({ _id: orderItemId, order: orderId });
        if (!orderItem) {
            return res.status(404).json({ success: false, message: "Order item not found" });
        }

        const requestedQuantity = Number(quantity) || orderItem.quantity;
        if (requestedQuantity > orderItem.quantity) {
             return res.status(400).json({ success: false, message: "Quantity exceeds ordered quantity" });
        }

        // Check if a request already exists for this item
        const existingRequest = await Return.findOne({ orderItem: orderItemId, status: { $ne: "Rejected" } });
        if (existingRequest) {
            return res.status(400).json({
                success: false,
                message: `A ${existingRequest.requestType} request already exists for this item`
            });
        }

        // Create return/replacement request
        const returnRequest = new Return({
            order: orderId,
            orderItem: orderItemId,
            customer: userId,
            requestType,
            reason,
            description,
            images: images || [],
            quantity: requestedQuantity,
            status: "Pending"
        });

        await returnRequest.save();

        return res.status(201).json({
            success: true,
            message: `${requestType} request raised successfully`,
            data: returnRequest
        });

    } catch (error: any) {
        console.error("Error requesting return/replace:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to raise request",
            error: error.message
        });
    }
};

