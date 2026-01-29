
import { Request, Response } from 'express';
import Review from '../../../models/Review';
import Order from '../../../models/Order';

// Get reviews for a product (Public)
export const getProductReviews = async (req: Request, res: Response) => {
    try {
        const { productId } = req.params;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 5;
        const skip = (page - 1) * limit;

        const reviews = await Review.find({ product: productId, status: 'Approved' })
            .populate('customer', 'name')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Review.countDocuments({ product: productId, status: 'Approved' });

        // Calculate average rating
        const stats = await Review.aggregate([
            { $match: { product: productId as any, status: 'Approved' } },
            { $group: { _id: null, avgRating: { $avg: '$rating' }, count: { $sum: 1 } } }
        ]);

        const avgRating = stats.length > 0 ? stats[0].avgRating : 0;
        const totalReviews = stats.length > 0 ? stats[0].count : 0;

        return res.status(200).json({
            success: true,
            data: {
                reviews,
                stats: {
                    avgRating: Math.round(avgRating * 10) / 10,
                    totalReviews
                },
                pagination: {
                    total,
                    page,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: 'Error fetching reviews',
            error: error.message
        });
    }
};

// Add a review (Protected, must have purchased)
export const addReview = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.userId;
        const { productId, orderId, rating, comment, title, images } = req.body;

        // Verify purchase
        const order = await Order.findOne({
            _id: orderId,
            customer: userId,
            'items.product': productId,
            status: 'Delivered'
        });

        if (!order) {
            return res.status(400).json({
                success: false,
                message: 'You can only review products from delivered orders.'
            });
        }

        // Check if already reviewed
        const existingReview = await Review.findOne({
            customer: userId,
            product: productId,
            order: orderId
        });

        if (existingReview) {
            return res.status(400).json({
                success: false,
                message: 'You have already reviewed this product for this order.'
            });
        }

        const review = await Review.create({
            customer: userId,
            product: productId,
            order: orderId,
            rating,
            comment,
            title,
            images,
            status: 'Pending', // pending moderation
            isVerifiedPurchase: true
        });

        return res.status(201).json({
            success: true,
            message: 'Review submitted successfully available after moderation',
            data: review
        });

    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: 'Error adding review',
            error: error.message
        });
    }
};
