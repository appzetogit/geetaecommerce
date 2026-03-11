import mongoose, { Schema, Document } from 'mongoose';

export enum SupplierTransactionType {
    PURCHASE = 'Purchase',
    PAYMENT = 'Payment',
    MANUAL = 'Manual',
    RETURN = 'Return'
}

export interface ISupplierTransaction extends Document {
    supplier: mongoose.Types.ObjectId;
    type: SupplierTransactionType;
    amount: number; // Positive increases balance (we owe more), Negative decreases (we paid)
    balanceAfter: number;
    description: string;
    date: Date;
    referenceId?: string; // Order ID if Purchase
    createdAt: Date;
}

const SupplierTransactionSchema: Schema = new Schema({
    supplier: { type: Schema.Types.ObjectId, ref: 'SupplierLedger', required: true },
    type: {
        type: String,
        enum: Object.values(SupplierTransactionType),
        required: true
    },
    amount: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    description: { type: String },
    date: { type: Date, default: Date.now },
    referenceId: { type: String }
}, { timestamps: true });

export default mongoose.model<ISupplierTransaction>('SupplierTransaction', SupplierTransactionSchema);
