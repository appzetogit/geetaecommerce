import { Request, Response } from "express";
import mongoose from "mongoose";
import OrderItem from "../../../models/OrderItem";
import Order from "../../../models/Order"; // Direct import to ensure model is registered
import { asyncHandler } from "../../../utils/asyncHandler";

/**
 * Get seller's sales report with filters, sorting, and pagination
 */
export const getSalesReport = asyncHandler(
    async (req: Request, res: Response) => {
        const sellerId = (req as any).user.userId;
        const {
            fromDate,
            toDate,
            search,
            page = "1",
            limit = "10",
            sortBy = "createdAt",
            sortOrder = "desc",
        } = req.query;

        // Build query - filter by authenticated seller
        const query: any = { seller: new mongoose.Types.ObjectId(sellerId) };

        // Date range filter - Improved to handle empty strings or invalid dates
        if ((fromDate && fromDate !== '') || (toDate && toDate !== '')) {
            query.createdAt = {};
            if (fromDate && fromDate !== '') {
                const startDate = new Date(fromDate as string);
                if (!isNaN(startDate.getTime())) {
                    query.createdAt.$gte = startDate;
                }
            }
            if (toDate && toDate !== '') {
                const endDate = new Date(toDate as string);
                if (!isNaN(endDate.getTime())) {
                    // Set to end of day
                    endDate.setHours(23, 59, 59, 999);
                    query.createdAt.$lte = endDate;
                }
            }

            // If query.createdAt is still empty, remove it
            if (Object.keys(query.createdAt).length === 0) {
                delete query.createdAt;
            }
        }

        // Search filter
        if (search) {
            // Find orders that match the search term (orderNumber)
            const matchedOrders = await Order.find({
                orderNumber: { $regex: search, $options: "i" }
            }).select("_id");

            const matchedOrderIds = matchedOrders.map((o: any) => o._id);

            query.$or = [
                { productName: { $regex: search, $options: "i" } },
                { variation: { $regex: search, $options: "i" } },
                { order: { $in: matchedOrderIds } }
            ];
        }

        // Pagination
        const pageNum = parseInt(page as string);
        const limitNum = parseInt(limit as string);
        const skip = (pageNum - 1) * limitNum;

        // Sort mappings (frontend names to backend names)
        const sortMap: Record<string, string> = {
            'orderId': 'order',
            'orderItemId': '_id',
            'product': 'productName',
            'variant': 'variation',
            'total': 'total',
            'date': 'createdAt'
        };

        const backendSortBy = sortMap[sortBy as string] || sortBy as string;

        // Sort
        const sort: any = {};
        sort[backendSortBy] = sortOrder === "asc" ? 1 : -1;

        // Get order items with populated order info
        const orderItems = await OrderItem.find(query)
            .populate({
                path: "order",
                select: "orderNumber createdAt"
            })
            .sort(sort)
            .skip(skip)
            .limit(limitNum);

        // Get total count for pagination
        const total = await OrderItem.countDocuments(query);

        // Format response for frontend
        const reports = orderItems.map(item => ({
            orderId: (item.order as any)?.orderNumber || '',
            dbOrderId: (item.order as any)?._id || '', // Added for linking
            orderItemId: item._id.toString().slice(-6).toUpperCase(), // Item ID shortcut
            product: item.productName,
            variant: item.variation || 'N/A',
            total: item.total,
            date: item.createdAt.toISOString().replace('T', ' ').split('.')[0], // YYYY-MM-DD HH:mm:ss
        }));

        return res.status(200).json({
            success: true,
            message: "Sales report fetched successfully",
            data: reports,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum),
            },
        });
    }
);
