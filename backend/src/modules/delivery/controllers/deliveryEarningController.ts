import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import Order from "../../../models/Order";
import mongoose from "mongoose";

/**
 * Get Earnings History
 */
export const getEarningsHistory = asyncHandler(async (req: Request, res: Response) => {
    const deliveryId = req.user?.userId;
    const objectId = new mongoose.Types.ObjectId(deliveryId);

    // Aggregation to group earnings by day
    // Filtering for delivered orders assigned to this user
    const earnings = await Order.aggregate([
        {
            $match: {
                deliveryBoy: objectId,
                status: "Delivered",
                deliveredAt: { $exists: true } // Ensure delivered date exists
            }
        },
        {
            $group: {
                _id: {
                    $dateToString: { format: "%Y-%m-%d", date: "$deliveredAt" }
                },
                amount: { $sum: 40 }, // Using mock commission of 40 per order. Replace with field if exists.
                deliveries: { $sum: 1 }
            }
        },
        { $sort: { _id: -1 } }, // Sort by date descending
        { $limit: 30 } // Last 30 days
    ]);

    const formattedEarnings = earnings.map(day => {
        // Humanize date labels like "Today", "Yesterday"
        const date = new Date(day._id);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        let dateLabel = day._id;
        if (date.toDateString() === today.toDateString()) dateLabel = "Today";
        else if (date.toDateString() === yesterday.toDateString()) dateLabel = "Yesterday";
        else {
            // Calculate "X days ago" if needed or leave date string
            const diffTime = Math.abs(today.getTime() - date.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays <= 7) dateLabel = `${diffDays} days ago`;
        }

        return {
            date: dateLabel,
            rawDate: day._id, // Keep raw date for sorting/logic if needed
            amount: day.amount,
            deliveries: day.deliveries
        };
    });

    return res.status(200).json({
        success: true,
        data: formattedEarnings
    });
});
