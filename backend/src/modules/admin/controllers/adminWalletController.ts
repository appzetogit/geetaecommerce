import { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import Seller from "../../../models/Seller";
import Customer from "../../../models/Customer";
import Order from "../../../models/Order";
import Payment from "../../../models/Payment";
import Commission from "../../../models/Commission";
import WalletTransaction from "../../../models/WalletTransaction";
import Delivery from "../../../models/Delivery";

/**
 * Get wallet transactions
 */
export const getWalletTransactions = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      page = 1,
      limit = 10,
      type, // 'seller' | 'customer'
      userId,
      // transactionType, // 'credit' | 'debit'
      transactionType: _transactionType, // 'credit' | 'debit'
    } = req.query;

    // This is a simplified version - in a real app, you'd have a Transaction model
    // For now, we'll return orders and payments as transactions

    const query: any = {};
    if (type === "customer" && userId) {
      query.customer = userId;
    } else if (type === "seller" && userId) {
      // Get seller's orders through order items
      const orders = await Order.find().populate({
        path: "items",
        match: { seller: userId },
      });
      query._id = { $in: orders.map((o) => o._id) };
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [payments, total] = await Promise.all([
      Payment.find(query)
        .populate("order")
        .populate("customer", "name email")
        .sort({ paymentDate: -1 })
        .skip(skip)
        .limit(parseInt(limit as string)),
      Payment.countDocuments(query),
    ]);

    const transactions = payments.map((payment) => ({
      id: payment._id,
      type: "payment",
      amount: payment.amount,
      transactionType: payment.status === "Completed" ? "debit" : "pending",
      description: `Order ${(payment.order as any)?.orderNumber || "N/A"}`,
      date: payment.paymentDate,
      status: payment.status,
    }));

    return res.status(200).json({
      success: true,
      message: "Wallet transactions fetched successfully",
      data: transactions,
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
 * Process fund transfer
 */
export const processFundTransfer = asyncHandler(
  async (req: Request, res: Response) => {
    const { fromType, fromId, toType, toId, amount, reason } = req.body;

    if (!fromType || !fromId || !toType || !toId || !amount) {
      return res.status(400).json({
        success: false,
        message: "From type, from ID, to type, to ID, and amount are required",
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be greater than 0",
      });
    }

    // Get from account
    let fromAccount: any;
    if (fromType === "seller") {
      fromAccount = await Seller.findById(fromId);
    } else if (fromType === "customer") {
      fromAccount = await Customer.findById(fromId);
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid from type. Must be seller or customer",
      });
    }

    if (!fromAccount) {
      return res.status(404).json({
        success: false,
        message: "From account not found",
      });
    }

    // Check balance
    const balanceField = fromType === "seller" ? "balance" : "walletAmount";
    if (fromAccount[balanceField] < amount) {
      return res.status(400).json({
        success: false,
        message: "Insufficient balance",
      });
    }

    // Get to account
    let toAccount: any;
    if (toType === "seller") {
      toAccount = await Seller.findById(toId);
    } else if (toType === "customer") {
      toAccount = await Customer.findById(toId);
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid to type. Must be seller or customer",
      });
    }

    if (!toAccount) {
      return res.status(404).json({
        success: false,
        message: "To account not found",
      });
    }

    // Process transfer
    fromAccount[balanceField] -= amount;
    const toBalanceField = toType === "seller" ? "balance" : "walletAmount";
    toAccount[toBalanceField] += amount;

    await Promise.all([fromAccount.save(), toAccount.save()]);

    return res.status(200).json({
      success: true,
      message: "Fund transfer completed successfully",
      data: {
        from: {
          type: fromType,
          id: fromId,
          previousBalance: fromAccount[balanceField] + amount,
          newBalance: fromAccount[balanceField],
        },
        to: {
          type: toType,
          id: toId,
          previousBalance: toAccount[toBalanceField] - amount,
          newBalance: toAccount[toBalanceField],
        },
        amount,
        reason,
      },
    });
  }
);

/**
 * Get seller transactions
 */
export const getSellerTransactions = asyncHandler(
  async (req: Request, res: Response) => {
    const { sellerId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    if (!sellerId) {
      return res.status(400).json({
        success: false,
        message: "Seller ID is required",
      });
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    // Get commissions
    const [commissions, commissionTotal] = await Promise.all([
      Commission.find({ seller: sellerId })
        .populate("order")
        .populate("orderItem")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit as string)),
      Commission.countDocuments({ seller: sellerId }),
    ]);

    const transactions = commissions.map((commission) => ({
      id: commission._id,
      type: "commission",
      amount: commission.commissionAmount,
      transactionType: commission.status === "Paid" ? "credit" : "pending",
      description: `Commission for Order ${(commission.order as any)?.orderNumber || "N/A"
        }`,
      date: commission.createdAt,
      status: commission.status,
    }));

    return res.status(200).json({
      success: true,
      message: "Seller transactions fetched successfully",
      data: transactions,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: commissionTotal,
        pages: Math.ceil(commissionTotal / parseInt(limit as string)),
      },
    });
  }
);

/**
 * Process withdrawal request
 */
export const processWithdrawal = asyncHandler(
  async (req: Request, res: Response) => {
    const { sellerId, amount, paymentReference, notes } = req.body;

    if (!sellerId || !amount) {
      return res.status(400).json({
        success: false,
        message: "Seller ID and amount are required",
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Amount must be greater than 0",
      });
    }

    const seller = await Seller.findById(sellerId);
    if (!seller) {
      return res.status(404).json({
        success: false,
        message: "Seller not found",
      });
    }

    if (seller.balance < amount) {
      return res.status(400).json({
        success: false,
        message: "Insufficient balance",
      });
    }

    // Deduct from seller balance
    seller.balance -= amount;
    await seller.save();

    // Update pending commissions to paid
    await Commission.updateMany(
      { seller: sellerId, status: "Pending" },
      {
        status: "Paid",
        paidAt: new Date(),
        paymentReference,
      }
    );

    return res.status(200).json({
      success: true,
      message: "Withdrawal processed successfully",
      data: {
        seller: seller.toObject(),
        transaction: {
          amount,
          paymentReference,
          notes,
          previousBalance: seller.balance + amount,
          newBalance: seller.balance,
        },
      },
    });
  }
);

/**
 * Get comprehensive financial dashboard data
 */
export const getFinancialDashboard = asyncHandler(
  async (req: Request, res: Response) => {
    const { startDate, endDate } = req.query;

    // Build date filter
    const dateFilter: any = {};
    if (startDate) {
      dateFilter.$gte = new Date(startDate as string);
    }
    if (endDate) {
      dateFilter.$lte = new Date(endDate as string);
    }

    const orderDateQuery = Object.keys(dateFilter).length > 0
      ? { createdAt: dateFilter }
      : {};

    // Get order statistics
    const orderStats = await Order.aggregate([
      { $match: { ...orderDateQuery, status: { $ne: 'Cancelled' } } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$total' },
          totalSubtotal: { $sum: '$subtotal' },
          totalDeliveryFees: { $sum: { $ifNull: ['$shipping', 0] } },
          totalPlatformFees: { $sum: { $ifNull: ['$platformFee', 0] } },
          deliveredOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'Delivered'] }, 1, 0] },
          },
          deliveredRevenue: {
            $sum: { $cond: [{ $eq: ['$status', 'Delivered'] }, '$total', 0] },
          },
        },
      },
    ]);

    // Get commission statistics
    const commissionStats = await Commission.aggregate([
      { $match: orderDateQuery },
      {
        $group: {
          _id: null,
          totalCommissions: { $sum: '$commissionAmount' },
          paidCommissions: {
            $sum: { $cond: [{ $eq: ['$status', 'Paid'] }, '$commissionAmount', 0] },
          },
          pendingCommissions: {
            $sum: { $cond: [{ $eq: ['$status', 'Pending'] }, '$commissionAmount', 0] },
          },
          // Calculate seller earnings as orderAmount - commissionAmount
          totalSellerEarnings: { $sum: { $subtract: ['$orderAmount', '$commissionAmount'] } },
        },
      },
    ]);

    // Get seller wallet transactions
    const walletStats = await WalletTransaction.aggregate([
      { $match: orderDateQuery },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
    ]);

    // Get delivery boy earnings
    const deliveryStats = await Delivery.aggregate([
      {
        $group: {
          _id: null,
          totalDeliveryBoys: { $sum: 1 },
          activeDeliveryBoys: {
            $sum: { $cond: [{ $eq: ['$isOnline', true] }, 1, 0] },
          },
          totalBalance: { $sum: '$balance' },
          totalCashCollected: { $sum: '$cashCollected' },
        },
      },
    ]);

    // Get daily trends (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const dailyTrends = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: sevenDaysAgo },
          status: { $ne: 'Cancelled' },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          orders: { $sum: 1 },
          revenue: { $sum: '$total' },
          deliveryFees: { $sum: { $ifNull: ['$shipping', 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const stats = orderStats[0] || {
      totalOrders: 0,
      totalRevenue: 0,
      totalSubtotal: 0,
      totalDeliveryFees: 0,
      totalPlatformFees: 0,
      deliveredOrders: 0,
      deliveredRevenue: 0,
    };

    const commissions = commissionStats[0] || {
      totalCommissions: 0,
      paidCommissions: 0,
      pendingCommissions: 0,
      totalSellerEarnings: 0,
    };

    const deliveryBoys = deliveryStats[0] || {
      totalDeliveryBoys: 0,
      activeDeliveryBoys: 0,
      totalBalance: 0,
      totalCashCollected: 0,
    };

    return res.status(200).json({
      success: true,
      message: 'Financial dashboard data fetched successfully',
      data: {
        overview: {
          totalOrders: stats.totalOrders,
          totalRevenue: stats.totalRevenue,
          deliveredOrders: stats.deliveredOrders,
          deliveredRevenue: stats.deliveredRevenue,
        },
        fees: {
          totalDeliveryFees: stats.totalDeliveryFees,
          totalPlatformFees: stats.totalPlatformFees,
        },
        commissions: {
          total: commissions.totalCommissions,
          paid: commissions.paidCommissions,
          pending: commissions.pendingCommissions,
          sellerEarnings: commissions.totalSellerEarnings,
        },
        deliveryBoys: {
          total: deliveryBoys.totalDeliveryBoys,
          active: deliveryBoys.activeDeliveryBoys,
          totalEarnings: deliveryBoys.totalBalance,
          cashCollected: deliveryBoys.totalCashCollected,
        },
        walletTransactions: walletStats,
        dailyTrends,
      },
    });
  }
);

/**
 * Get all order transactions with commission details
 */
export const getAllOrderTransactions = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      page = 1,
      limit = 20,
      status,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    // Build query
    const query: any = {};
    if (status) {
      query.status = status;
    }
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate as string);
      if (endDate) query.createdAt.$lte = new Date(endDate as string);
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const sortOptions: any = { [sortBy as string]: sortOrder === 'asc' ? 1 : -1 };

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate('customer', 'name email phone')
        .populate('deliveryBoy', 'name mobile')
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit as string))
        .lean(),
      Order.countDocuments(query),
    ]);

    // Get commission data for these orders
    const orderIds = orders.map((o) => o._id);
    const commissions = await Commission.find({ order: { $in: orderIds } })
      .populate('seller', 'storeName sellerName')
      .lean();

    // Map commissions to orders
    const commissionMap = new Map();
    for (const commission of commissions) {
      const orderId = commission.order?.toString();
      if (!commissionMap.has(orderId)) {
        commissionMap.set(orderId, []);
      }
      // Calculate seller earning (order amount minus commission)
      const sellerEarning = commission.orderAmount - commission.commissionAmount;
      commissionMap.get(orderId).push({
        sellerId: commission.seller,
        sellerName: (commission.seller as any)?.storeName || 'Unknown',
        amount: commission.orderAmount,
        commissionRate: commission.commissionRate,
        commissionAmount: commission.commissionAmount,
        sellerEarning: sellerEarning,
        status: commission.status,
      });
    }

    // Transform orders with transaction data
    const transactions = orders.map((order: any) => ({
      orderId: order._id,
      orderNumber: order.orderNumber,
      createdAt: order.createdAt,
      status: order.status,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      customer: {
        id: (order.customer as any)?._id,
        name: (order.customer as any)?.name || order.customerName,
        email: (order.customer as any)?.email || order.customerEmail,
        phone: (order.customer as any)?.phone || order.customerPhone,
      },
      deliveryBoy: order.deliveryBoy
        ? {
            id: (order.deliveryBoy as any)?._id,
            name: (order.deliveryBoy as any)?.name,
            mobile: (order.deliveryBoy as any)?.mobile,
          }
        : null,
      amounts: {
        subtotal: order.subtotal,
        deliveryFee: order.shipping,
        platformFee: order.platformFee,
        discount: order.discount,
        total: order.total,
      },
      commissions: commissionMap.get(order._id.toString()) || [],
    }));

    return res.status(200).json({
      success: true,
      message: 'Order transactions fetched successfully',
      data: transactions,
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
 * Get delivery charges report
 */
export const getDeliveryChargesReport = asyncHandler(
  async (req: Request, res: Response) => {
    const { startDate, endDate, groupBy = 'day' } = req.query;

    // Build date filter
    const dateFilter: any = {};
    if (startDate) dateFilter.$gte = new Date(startDate as string);
    if (endDate) dateFilter.$lte = new Date(endDate as string);

    const matchStage: any = { status: { $ne: 'Cancelled' } };
    if (Object.keys(dateFilter).length > 0) {
      matchStage.createdAt = dateFilter;
    }

    // Determine grouping format
    let dateFormat: string;
    switch (groupBy) {
      case 'month':
        dateFormat = '%Y-%m';
        break;
      case 'week':
        dateFormat = '%Y-W%V';
        break;
      case 'day':
      default:
        dateFormat = '%Y-%m-%d';
    }

    const deliveryCharges = await Order.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { $dateToString: { format: dateFormat, date: '$createdAt' } },
          totalOrders: { $sum: 1 },
          deliveredOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'Delivered'] }, 1, 0] },
          },
          totalDeliveryFees: { $sum: { $ifNull: ['$shipping', 0] } },
          totalPlatformFees: { $sum: { $ifNull: ['$platformFee', 0] } },
          totalRevenue: { $sum: '$total' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Get delivery boy wise breakdown
    const deliveryBoyBreakdown = await Order.aggregate([
      { $match: { ...matchStage, deliveryBoy: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: '$deliveryBoy',
          totalDeliveries: { $sum: 1 },
          totalDeliveryFees: { $sum: { $ifNull: ['$shipping', 0] } },
          totalOrderAmount: { $sum: '$total' },
        },
      },
      {
        $lookup: {
          from: 'deliveries',
          localField: '_id',
          foreignField: '_id',
          as: 'deliveryBoy',
        },
      },
      { $unwind: { path: '$deliveryBoy', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          deliveryBoyId: '$_id',
          deliveryBoyName: '$deliveryBoy.name',
          deliveryBoyMobile: '$deliveryBoy.mobile',
          totalDeliveries: 1,
          totalDeliveryFees: 1,
          totalOrderAmount: 1,
        },
      },
      { $sort: { totalDeliveries: -1 } },
      { $limit: 20 },
    ]);

    // Calculate totals
    const totals = await Order.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          deliveredOrders: {
            $sum: { $cond: [{ $eq: ['$status', 'Delivered'] }, 1, 0] },
          },
          totalDeliveryFees: { $sum: { $ifNull: ['$shipping', 0] } },
          totalPlatformFees: { $sum: { $ifNull: ['$platformFee', 0] } },
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      message: 'Delivery charges report fetched successfully',
      data: {
        totals: totals[0] || {
          totalOrders: 0,
          deliveredOrders: 0,
          totalDeliveryFees: 0,
          totalPlatformFees: 0,
        },
        timeline: deliveryCharges,
        deliveryBoyBreakdown,
      },
    });
  }
);
