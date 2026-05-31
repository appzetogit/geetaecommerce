import { Request, Response } from 'express';
import mongoose from 'mongoose';
import GSTReportEntry from '../../../models/GSTReportEntry';
import SupplierLedger from '../../../models/SupplierLedger';

// Whitelist of fields that can be updated via PATCH (inline-edit safe)
const UPDATABLE_FIELDS = [
    'date', 'billNo',
    'supplierLedgerId', 'supplierName', 'supplierGstNumber',
    'itemCategory', 'totalAmount',
    'slab5Amount', 'slab5Gst',
    'slab12Amount', 'slab12Gst',
    'slab18Amount', 'slab18Gst',
    'slab28Amount', 'slab28Gst',
    'customRate', 'customAmount', 'customGst',
] as const;

const pickUpdatable = (body: any): Record<string, any> => {
    const out: Record<string, any> = {};
    for (const key of UPDATABLE_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(body, key)) {
            out[key] = body[key];
        }
    }
    return out;
};

// GET /admin/reports/gst-register
export const listGSTReport = async (req: Request, res: Response): Promise<void> => {
    try {
        const { search, dateFrom, dateTo } = req.query;
        const query: any = { isAdmin: true };

        if (search) {
            query.$or = [
                { supplierName: { $regex: search, $options: 'i' } },
                { billNo: { $regex: search, $options: 'i' } },
                { supplierGstNumber: { $regex: search, $options: 'i' } },
                { itemCategory: { $regex: search, $options: 'i' } },
            ];
        }

        if (dateFrom || dateTo) {
            query.date = {} as any;
            if (dateFrom) query.date.$gte = new Date(String(dateFrom));
            if (dateTo) query.date.$lte = new Date(String(dateTo));
        }

        const entries = await GSTReportEntry.find(query).sort({ date: -1, createdAt: -1 });
        res.status(200).json({ success: true, data: entries });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST /admin/reports/gst-register
export const createGSTReportEntry = async (req: Request, res: Response): Promise<void> => {
    try {
        const body = pickUpdatable(req.body);

        if (!body.supplierName || !body.billNo) {
            res.status(400).json({ success: false, message: 'supplierName and billNo are required' });
            return;
        }

        // If a supplierLedgerId is provided, verify it belongs to admin
        if (body.supplierLedgerId) {
            if (!mongoose.Types.ObjectId.isValid(body.supplierLedgerId)) {
                res.status(400).json({ success: false, message: 'Invalid supplierLedgerId' });
                return;
            }
            const supplier = await SupplierLedger.findOne({ _id: body.supplierLedgerId, isAdmin: true });
            if (!supplier) {
                res.status(404).json({ success: false, message: 'Supplier not found' });
                return;
            }
        }

        const entry = await GSTReportEntry.create({
            ...body,
            isAdmin: true,
        });

        res.status(201).json({ success: true, data: entry });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// PATCH /admin/reports/gst-register/:id
export const updateGSTReportEntry = async (req: Request, res: Response): Promise<void> => {
    try {
        const patch = pickUpdatable(req.body);
        if (Object.keys(patch).length === 0) {
            res.status(400).json({ success: false, message: 'No updatable fields supplied' });
            return;
        }

        const entry = await GSTReportEntry.findOneAndUpdate(
            { _id: req.params.id, isAdmin: true },
            patch,
            { new: true, runValidators: true }
        );

        if (!entry) {
            res.status(404).json({ success: false, message: 'Entry not found' });
            return;
        }
        res.status(200).json({ success: true, data: entry });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// DELETE /admin/reports/gst-register/:id
export const deleteGSTReportEntry = async (req: Request, res: Response): Promise<void> => {
    try {
        const entry = await GSTReportEntry.findOneAndDelete({ _id: req.params.id, isAdmin: true });
        if (!entry) {
            res.status(404).json({ success: false, message: 'Entry not found' });
            return;
        }
        res.status(200).json({ success: true, message: 'Entry deleted' });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};
