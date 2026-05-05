import { Request, Response } from 'express';
import SupplierLedger from '../../../models/SupplierLedger';
import SupplierTransaction, { SupplierTransactionType } from '../../../models/SupplierTransaction';
import mongoose from 'mongoose';

export const getAllSuppliers = async (req: Request, res: Response): Promise<void> => {
    try {
        const { search, hasDue, hasAdvance } = req.query;
        const query: any = { isAdmin: true };

        if (hasDue === 'true') {
            query.currentBalance = { $gt: 0 };
        } else if (hasAdvance === 'true') {
            query.currentBalance = { $lt: 0 };
        }

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } }
            ];
        }

        const suppliers = await SupplierLedger.find(query).sort({ name: 1 });
        res.status(200).json({ success: true, data: suppliers });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getSupplierById = async (req: Request, res: Response): Promise<void> => {
    try {
        const supplier = await SupplierLedger.findById(req.params.id);
        if (!supplier) {
            res.status(404).json({ success: false, message: "Supplier not found" });
            return;
        }

        const transactions = await SupplierTransaction.find({ supplier: req.params.id })
            .sort({ date: -1, createdAt: -1 })
            .limit(100);

        res.status(200).json({ success: true, data: { supplier, transactions } });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const createSupplier = async (req: Request, res: Response): Promise<void> => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { name, phone, address, gstNumber, openingBalance, notes } = req.body;

        const supplier = new SupplierLedger({
            name,
            phone,
            address,
            gstNumber,
            openingBalance: openingBalance || 0,
            currentBalance: openingBalance || 0,
            notes,
            isAdmin: true
        });

        await supplier.save({ session });

        if (openingBalance && openingBalance !== 0) {
            const transaction = new SupplierTransaction({
                supplier: supplier._id,
                type: SupplierTransactionType.MANUAL,
                amount: openingBalance,
                balanceAfter: openingBalance,
                description: 'Opening Balance',
                date: new Date()
            });
            await transaction.save({ session });
        }

        await session.commitTransaction();
        res.status(201).json({ success: true, data: supplier });
    } catch (error: any) {
        await session.abortTransaction();
        res.status(500).json({ success: false, message: error.message });
    } finally {
        session.endSession();
    }
};

export const updateSupplier = async (req: Request, res: Response): Promise<void> => {
    try {
        const supplier = await SupplierLedger.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        if (!supplier) {
            res.status(404).json({ success: false, message: "Supplier not found" });
            return;
        }
        res.status(200).json({ success: true, data: supplier });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteSupplier = async (req: Request, res: Response): Promise<void> => {
    try {
        const supplier = await SupplierLedger.findByIdAndDelete(req.params.id);
        if (!supplier) {
            res.status(404).json({ success: false, message: "Supplier not found" });
            return;
        }
        // Also delete transactions
        await SupplierTransaction.deleteMany({ supplier: req.params.id });
        res.status(200).json({ success: true, message: "Supplier and transactions deleted" });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const addDebt = async (req: Request, res: Response): Promise<void> => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { amount, description, date } = req.body;
        const supplier = await SupplierLedger.findById(req.params.id);
        if (!supplier) {
            res.status(404).json({ success: false, message: "Supplier not found" });
            return;
        }

        const newBalance = supplier.currentBalance + parseFloat(amount);

        const transaction = new SupplierTransaction({
            supplier: supplier._id,
            type: SupplierTransactionType.MANUAL,
            amount: parseFloat(amount),
            balanceAfter: newBalance,
            description: description || 'Purchase Debt Added',
            date: date || new Date()
        });

        await transaction.save({ session });

        supplier.currentBalance = newBalance;
        await supplier.save({ session });

        await session.commitTransaction();
        res.status(200).json({ success: true, data: { supplier, transaction } });
    } catch (error: any) {
        await session.abortTransaction();
        res.status(500).json({ success: false, message: error.message });
    } finally {
        session.endSession();
    }
};

export const paySupplier = async (req: Request, res: Response): Promise<void> => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { amount, description, date } = req.body;
        const supplier = await SupplierLedger.findById(req.params.id);
        if (!supplier) {
            res.status(404).json({ success: false, message: "Supplier not found" });
            return;
        }

        // Amount is positive in request, but reduces debt
        const newBalance = supplier.currentBalance - parseFloat(amount);

        const transaction = new SupplierTransaction({
            supplier: supplier._id,
            type: SupplierTransactionType.PAYMENT,
            amount: -parseFloat(amount), // Negative to show decrease in debt
            balanceAfter: newBalance,
            description: description || 'Payment Made to Supplier',
            date: date || new Date()
        });

        await transaction.save({ session });

        supplier.currentBalance = newBalance;
        await supplier.save({ session });

        await session.commitTransaction();
        res.status(200).json({ success: true, data: { supplier, transaction } });
    } catch (error: any) {
        await session.abortTransaction();
        res.status(500).json({ success: false, message: error.message });
    } finally {
        session.endSession();
    }
};
