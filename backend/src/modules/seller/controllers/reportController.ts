import { Request, Response } from "express";
import mongoose from "mongoose";
import OrderItem from "../../../models/OrderItem";
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
        const query: any = { seller: sellerId };

        // Date range filter
        if (fromDate || toDate) {
            query.createdAt = {};
            if (fromDate) {
                query.createdAt.$gte = new Date(fromDate as string);
            }
            if (toDate) {
                // Set to end of day
                const endDay = new Date(toDate as string);
                endDay.setHours(23, 59, 59, 999);
                query.createdAt.$lte = endDay;
            }
        }

        // Search filter
        if (search) {
            // Find orders that match the search term (orderNumber)
            const matchedOrders = await mongoose.model("Order").find({
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
