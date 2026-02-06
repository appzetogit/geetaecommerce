import { Request, Response } from 'express';
import Seller from '../../../models/Seller';
import WalletTransaction from '../../../models/WalletTransaction';
import WithdrawRequest from '../../../models/WithdrawRequest';
import OrderItem from '../../../models/OrderItem';
import { asyncHandler } from '../../../utils/asyncHandler';
import mongoose from 'mongoose';

/**
 * Get seller's wallet statistics
 */
export const getWalletStats = asyncHandler(async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;

    const seller = await Seller.findById(sellerId).select('balance');
    if (!seller) {
        return res.status(404).json({ success: false, message: 'Seller not found' });
    }

    // Calculate total earnings (sum of all credit transactions from orders)
    const earningsData = await WalletTransaction.aggregate([
        { $match: { sellerId: new mongoose.Types.ObjectId(sellerId), type: 'Credit', description: { $regex: /Order/i } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Calculate total withdrawn (sum of all completed withdrawal requests)
    const withdrawnData = await WithdrawRequest.aggregate([
        { $match: { sellerId: new mongoose.Types.ObjectId(sellerId), status: 'Completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Pending settlements (OrderItem total - net earnings if not yet settled in wallet)
    // For simplicity, we'll fetch items assigned to this seller that are not 'Cancelled' but not yet reflected in wallet balance if applicable
    // In a real system, this would be more complex. Here we use delivered/shipped orders not yet settled.
    const pendingData = await OrderItem.aggregate([
        {
            $match: {
                sellerId: new mongoose.Types.ObjectId(sellerId),
                status: { $in: ['Confirmed', 'Shipped', 'On the way'] }
            }
        },
        { $group: { _id: null, total: { $sum: '$subtotal' } } }
    ]);

    return res.status(200).json({
        success: true,
        data: {
            availableBalance: seller.balance || 0,
            totalEarnings: earningsData[0]?.total || 0,
            pendingSettlement: pendingData[0]?.total || 0,
            totalWithdrawn: withdrawnData[0]?.total || 0,
        }
    });
});

/**
 * Get wallet transactions
 */
export const getTransactions = asyncHandler(async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const { page = 1, limit = 10, type, status, searchQuery, search, fromDate, toDate } = req.query;

    const query: any = { sellerId: new mongoose.Types.ObjectId(sellerId) };

    if (type && type !== 'All') query.type = type;
    if (status && status !== 'All') query.status = status;

    // Support both searchQuery and search param
    const term = (searchQuery || search) as string;
    if (term) {
        query.$or = [
            { description: { $regex: term, $options: 'i' } },
            { reference: { $regex: term, $options: 'i' } }
        ];
    }

    if (fromDate || toDate) {
        query.createdAt = {};
        if (fromDate) query.createdAt.$gte = new Date(fromDate as string);
        if (toDate) {
            const end = new Date(toDate as string);
            end.setHours(23, 59, 59, 999);
            query.createdAt.$lte = end;
        }
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [transactions, total] = await Promise.all([
        WalletTransaction.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit)),
        WalletTransaction.countDocuments(query)
    ]);

    return res.status(200).json({
        success: true,
        data: {
            transactions,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                pages: Math.ceil(total / Number(limit))
            }
        }
    });
});

/**
 * Get withdrawal requests
 */
export const getWithdrawalRequests = asyncHandler(async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const { page = 1, limit = 10, status, search, fromDate, toDate } = req.query;

    const query: any = { sellerId: new mongoose.Types.ObjectId(sellerId) };
    if (status && status !== 'All') query.status = status;

    if (search) {
        query.remarks = { $regex: search, $options: 'i' };
    }

    if (fromDate || toDate) {
        query.createdAt = {};
        if (fromDate) query.createdAt.$gte = new Date(fromDate as string);
        if (toDate) {
            const end = new Date(toDate as string);
            end.setHours(23, 59, 59, 999);
            query.createdAt.$lte = end;
        }
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [requests, total] = await Promise.all([
        WithdrawRequest.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit)),
        WithdrawRequest.countDocuments(query)
    ]);

    return res.status(200).json({
        success: true,
        data: {
            requests,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                pages: Math.ceil(total / Number(limit))
            }
        }
    });
});

/**
 * Create withdrawal request
 */
export const createWithdrawalRequest = asyncHandler(async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const { amount, paymentMethod = 'Bank Transfer', accountDetails, remarks } = req.body;

    if (!amount || amount <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid withdrawal amount' });
    }

    const seller = await Seller.findById(sellerId);
    if (!seller) {
        return res.status(404).json({ success: false, message: 'Seller not found' });
    }

    if (seller.balance < amount) {
        return res.status(400).json({ success: false, message: 'Insufficient balance' });
    }

    // Final account details string
    const details = accountDetails || `Bank: ${seller.bankName}, A/C: ${seller.accountNumber}, IFSC: ${seller.ifsc}`;

    const withdrawRequest = await WithdrawRequest.create({
        sellerId,
        amount,
        paymentMethod,
        accountDetails: details,
        remarks,
        status: 'Pending'
    });

    // Deduct from balance
    seller.balance -= amount;
    await seller.save();

    // Log as a debit transaction with "Pending" status
    // The Admin approval will move this to "Completed"
    await WalletTransaction.create({
        sellerId,
        amount,
        type: 'Debit',
        description: `Withdrawal Request - ${withdrawRequest._id}`,
        reference: `WD-${Date.now()}`,
        status: 'Pending'
    });

    return res.status(201).json({
        success: true,
        message: 'Withdrawal request submitted successfully',
        data: withdrawRequest
    });
});

/**
 * Get order earnings
 */
export const getOrderEarnings = asyncHandler(async (req: Request, res: Response) => {
    const sellerId = (req as any).user.userId;
    const { page = 1, limit = 10, status } = req.query;

    const query: any = { sellerId };
    if (status && status !== 'All') {
        if (status === 'Settled') query.status = 'Delivered';
        else query.status = { $in: ['Confirmed', 'Shipped', 'On the way'] };
    }

    const earnings = await OrderItem.find(query)
        .sort({ createdAt: -1 })
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit));

    const total = await OrderItem.countDocuments(query);

    const formattedEarnings = earnings.map(item => ({
        id: item._id,
        orderId: item.orderId,
        source: item.productName,
        amount: item.subtotal,
        commission: (item.subtotal * 0.15), // Mock 15% commission if not stored
        netEarning: item.subtotal * 0.85,
        date: item.createdAt,
        status: item.status === 'Delivered' ? 'Settled' : 'Pending'
    }));

    return res.status(200).json({
        success: true,
        data: {
            earnings: formattedEarnings,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                pages: Math.ceil(total / Number(limit))
            }
        }
    });
});
