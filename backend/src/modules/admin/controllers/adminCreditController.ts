
import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler } from "../../../utils/asyncHandler";
import Customer from "../../../models/Customer";
import CreditTransaction from "../../../models/CreditTransaction";
import {
  buildPhonePeMerchantTransactionId,
  getPhonePePaymentStatus,
  initiatePhonePePayment,
  isPhonePeConfigured,
} from "../../../services/phonepeService";

import Order from "../../../models/Order";

/**
 * Get all customers with credit info
 */
export const getCreditCustomers = asyncHandler(async (req: Request, res: Response) => {
    const { search, hasDue, hasAdvance } = req.query;

    const query: any = {};

    if (hasDue === "true") {
        query.creditBalance = { $gt: 0 };
    } else if (hasAdvance === "true") {
        query.creditBalance = { $lt: 0 };
    }

    // Filter by sellerId to separate Admin and Seller customers
    if (req.user && req.user.userType === "Seller") {
        query.sellerId = req.user.userId;
    } else if (req.user && req.user.userType === "Admin") {
        query.sellerId = null;
    }

    if (search) {
        query.$or = [
            { name: { $regex: search, $options: "i" } },
            { phone: { $regex: search, $options: "i" } }
        ];
    }

    // Sort by credit balance desc (highest debt first)
    const customers = await Customer.find(query)
        .select('name phone creditBalance')
        .sort({ creditBalance: -1, updatedAt: -1 })
        .limit(50); // Pagination can be added if needed

    return res.status(200).json({
        success: true,
        data: customers
    });
});

/**
 * Get credit history for a customer
 */
export const getCustomerHistory = asyncHandler(async (req: Request, res: Response) => {
    const { customerId } = req.params;
    const customerQuery: any = { _id: customerId };
    if (req.user && req.user.userType === 'Seller') {
        customerQuery.sellerId = req.user.userId;
    } else if (req.user && req.user.userType === 'Admin') {
        customerQuery.sellerId = null;
    }

    const [customer, transactions, orders] = await Promise.all([
        Customer.findOne(customerQuery).select('name phone email creditBalance'),
        CreditTransaction.find({ customer: customerId }).sort({ date: -1 }).limit(100),
        Order.find({ customer: customerId }).sort({ orderDate: -1 }).limit(10).select('orderNumber orderDate total paymentMethod items')
    ]);

    if (!customer) {
        return res.status(404).json({ success: false, message: "Customer not found" });
    }

    return res.status(200).json({
        success: true,
        data: {
            customer,
            transactions,
            orders
        }
    });
});

/**
 * Add Credit (Manual) - Increases Balance (Udhaar)
 */
export const addCredit = asyncHandler(async (req: Request, res: Response) => {
    const { customerId, amount, description, date } = req.body;
    const adminId = req.user?.userId;

    const numericAmount = parseFloat(amount);
    if (!customerId || isNaN(numericAmount) || numericAmount <= 0) {
        return res.status(400).json({ success: false, message: "Invalid data" });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const customer = await Customer.findById(customerId).session(session);
        if (!customer) {
            throw new Error("Customer not found");
        }

        customer.creditBalance = (customer.creditBalance || 0) + numericAmount;
        await customer.save({ session });

        await CreditTransaction.create([{
            customer: customerId,
            type: 'Manual',
            amount: numericAmount,
            balanceAfter: customer.creditBalance,
            description: description || "Manual Credit Added",
            date: date || new Date(),
            createdBy: adminId
        }], { session });

        await session.commitTransaction();

        return res.status(200).json({
            success: true,
            message: "Credit added successfully",
            data: { balance: customer.creditBalance }
        });
    } catch (error: any) {
        await session.abortTransaction();
        return res.status(500).json({ success: false, message: error.message });
    } finally {
        session.endSession();
    }
});

/**
 * Initiate Online Credit Payment
 */
export const initiateCreditPayment = asyncHandler(async (req: Request, res: Response) => {
    const { customerId, amount, gateway } = req.body;

    if (!customerId || !amount || !gateway) {
        return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
        return res.status(404).json({ success: false, message: "Customer not found" });
    }

    const amountInPaise = Math.round(parseFloat(amount) * 100);
    const normalizedGateway = String(gateway || "").toLowerCase();
    const usePhonePe =
      normalizedGateway === "phonepe" ||
      normalizedGateway === "online" ||
      !normalizedGateway;

    if (!usePhonePe) {
      return res.status(400).json({ success: false, message: "Invalid Gateway. Use PhonePe or Online." });
    }

    if (!isPhonePeConfigured()) {
      return res.status(500).json({
        success: false,
        message: "PhonePe is not configured. Set PHONEPE_MERCHANT_ID and PHONEPE_SALT_KEY.",
      });
    }

    try {
      const merchantTransactionId = buildPhonePeMerchantTransactionId(
        "CREDIT",
        customer._id.toString()
      );
      const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:5173").replace(
        /\/$/,
        ""
      );
      const portalPrefix =
        req.user?.userType === "Seller" ? "/seller" : "/admin";
      const redirectUrl = `${frontendUrl}${portalPrefix}/pos/credit/verify?customerId=${customerId}&amount=${amount}&merchantTransactionId=${merchantTransactionId}`;

      const phonePeResult = await initiatePhonePePayment({
        merchantTransactionId,
        merchantUserId: customer._id.toString(),
        amountPaise: amountInPaise,
        redirectUrl,
        mobileNumber: customer.phone || "9999999999",
      });

      return res.status(200).json({
        success: true,
        data: {
          gateway: "PhonePe",
          merchantTransactionId,
          redirectUrl: phonePeResult.redirectUrl,
          amount: parseFloat(amount),
        },
      });
    } catch (error: any) {
      console.error("PhonePe Credit Error:", error.response?.data || error.message || error);
      return res.status(500).json({
        success: false,
        message: error.message || "PhonePe init failed",
      });
    }
});

/**
 * Verify Online Credit Payment
 */
export const verifyCreditPayment = asyncHandler(async (req: Request, res: Response) => {
    const { customerId, amount, paymentId, merchantTransactionId, gateway } = req.body;
    const adminId = req.user?.userId;
    const paymentRef = merchantTransactionId || paymentId;

    if (paymentRef && isPhonePeConfigured()) {
      const status = await getPhonePePaymentStatus(paymentRef);
      if (!status.success) {
        return res.status(400).json({
          success: false,
          message: `Payment not completed (${status.state || "UNKNOWN"})`,
        });
      }
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const customer = await Customer.findById(customerId).session(session);
        if (!customer) {
            throw new Error("Customer not found");
        }

        const numericAmount = parseFloat(amount);

        // Decrease balance
        customer.creditBalance = (customer.creditBalance || 0) - numericAmount;
        await customer.save({ session });

        await CreditTransaction.create([{
            customer: customerId,
            type: 'Payment',
            amount: -numericAmount,
            balanceAfter: customer.creditBalance,
            description: `Online Payment (${gateway}) - Ref: ${paymentId}`,
            referenceId: paymentId,
            date: new Date(),
            createdBy: adminId
        }], { session });

        await session.commitTransaction();

        return res.status(200).json({
            success: true,
            message: "Payment verified & recorded",
            data: { balance: customer.creditBalance }
        });
    } catch (error: any) {
        await session.abortTransaction();
        return res.status(500).json({ success: false, message: error.message });
// ... verifyCreditPayment
    } finally {
        session.endSession();
    }
});

/**
 * Accept Payment (Cash/Manual) - Decreases Balance
 */
export const acceptPayment = asyncHandler(async (req: Request, res: Response) => {
    const { customerId, amount, description, date } = req.body;
    const adminId = req.user?.userId;

    const numericAmount = parseFloat(amount);
    if (!customerId || isNaN(numericAmount) || numericAmount <= 0) {
        return res.status(400).json({ success: false, message: "Invalid data" });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const customer = await Customer.findById(customerId).session(session);
        if (!customer) {
            throw new Error("Customer not found");
        }

        // Decrease balance
        customer.creditBalance = (customer.creditBalance || 0) - numericAmount;
        await customer.save({ session });

        await CreditTransaction.create([{
            customer: customerId,
            type: 'Payment',
            amount: -numericAmount, // Negative for payment
            balanceAfter: customer.creditBalance,
            description: description || "Payment Received",
            date: date || new Date(),
            createdBy: adminId
        }], { session });

        await session.commitTransaction();

        return res.status(200).json({
            success: true,
            message: "Payment recorded successfully",
            data: { balance: customer.creditBalance }
        });
    } catch (error: any) {
        await session.abortTransaction();
        return res.status(500).json({ success: false, message: error.message });
    } finally {
        session.endSession();
    }
});
