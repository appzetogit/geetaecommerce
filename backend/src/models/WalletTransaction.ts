import mongoose, { Document, Schema } from 'mongoose';

export interface IWalletTransaction extends Document {
    sellerId: mongoose.Types.ObjectId;
    amount: number;
    type: 'Credit' | 'Debit';
    description: string;
    status: 'Completed' | 'Pending' | 'Failed';
    reference: string;
    createdAt: Date;
    updatedAt: Date;
}

const WalletTransactionSchema = new Schema<IWalletTransaction>(
    {
        sellerId: {
            type: Schema.Types.ObjectId,
            ref: 'Seller',
            required: [true, 'Seller ID is required'],
        },
        amount: {
            type: Number,
            required: [true, 'Amount is required'],
            min: [0, 'Amount cannot be negative'],
        },
        type: {
            type: String,
            enum: ['Credit', 'Debit'],
            required: [true, 'Transaction type is required'],
        },
        description: {
            type: String,
            required: [true, 'Description is required'],
            trim: true,
        },
        status: {
            type: String,
            enum: ['Completed', 'Pending', 'Failed'],
            default: 'Completed',
        },
        reference: {
            type: String,
            unique: true,
            required: [true, 'Reference ID is required'],
        },
    },
    {
        timestamps: true,
    }
);

WalletTransactionSchema.index({ sellerId: 1 });
WalletTransactionSchema.index({ createdAt: -1 });

const WalletTransaction = mongoose.model<IWalletTransaction>('WalletTransaction', WalletTransactionSchema);

export default WalletTransaction;
