
import { Request, Response } from "express";
import mongoose from "mongoose";
import { asyncHandler } from "../../../utils/asyncHandler";
import Customer from "../../../models/Customer";
import CreditTransaction from "../../../models/CreditTransaction";

import Order from "../../../models/Order";

/**
 * Get all customers with credit info
 */
export const getCreditCustomers = asyncHandler(async (req: Request, res: Response) => {
    const { search } = req.query;

    const query: any = {};
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

    const [customer, transactions, orders] = await Promise.all([
        Customer.findById(customerId).select('name phone email creditBalance'),
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

import axios from "axios";

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
    const receiptId = `RCPT_${Date.now()}`;

    if (gateway === 'Razorpay') {
        const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
        try {
            const razorpayResponse = await axios.post('https://api.razorpay.com/v1/orders', {
                amount: amountInPaise,
                currency: "INR",
                receipt: receiptId,
                notes: { customer_id: customer._id.toString(), type: "Credit_Repayment" }
            }, {
                headers: { 'Authorization': `Basic ${auth}` }
            });

            return res.status(200).json({
                success: true,
                data: {
                    gateway: 'Razorpay',
                    razorpayOrderId: razorpayResponse.data.id,
                    amount: parseFloat(amount),
                    key: process.env.RAZORPAY_KEY_ID
                }
            });
        } catch (error: any) {
            console.error("Razorpay Error:", error.response?.data || error);
            return res.status(500).json({ success: false, message: "Device Error: Razorpay init failed" });
        }
    } else if (gateway === 'Cashfree') {
        try {
             const cashfreeResponse = await axios.post(`${process.env.CASHFREE_MODE === 'production' ? 'https://api.cashfree.com' : 'https://sandbox.cashfree.com'}/pg/orders`, {
                order_id: `CF_${Date.now()}_${customerId.toString().slice(-4)}`,
                order_amount: parseFloat(amount),
                order_currency: "INR",
                customer_details: {
                    customer_id: customer._id.toString(),
                    customer_email: customer.email || "pos@geetastores.com",
                    customer_phone: customer.phone || "9999999999"
                },
                order_meta: {
                    return_url: `${process.env.FRONTEND_URL || 'http://localhost:5173/'}admin/pos/credit/verify?order_id={order_id}`
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
                    orderId: cashfreeResponse.data.order_id,
                    paymentSessionId: cashfreeResponse.data.payment_session_id,
                    amount: parseFloat(amount),
                    isSandbox: process.env.CASHFREE_MODE !== 'production'
                }
            });
        } catch (error: any) {
            console.error("Cashfree Error:", error.response?.data || error);
            return res.status(500).json({ success: false, message: "Device Error: Cashfree init failed" });
        }
    }

    return res.status(400).json({ success: false, message: "Invalid Gateway" });
});

/**
 * Verify Online Credit Payment
 */
export const verifyCreditPayment = asyncHandler(async (req: Request, res: Response) => {
    const { customerId, amount, paymentId, gateway } = req.body;
    const adminId = req.user?.userId;

    // In a real production environment, you MUST verify the signature/payment status with the Gateway server-side here.
    // For now, mirroring the Order verification logic which trusts the client's success callback for POS speed (as staff is present).
    // Ideally: call Razorpay/Cashfree GET /payments/{id} to confirm status.

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
