import mongoose, { Document, Schema } from 'mongoose';

export interface IWithdrawRequest extends Document {
    sellerId: mongoose.Types.ObjectId;
    amount: number;
    status: 'Pending' | 'Approved' | 'Rejected' | 'Completed';
    paymentMethod: 'Bank Transfer' | 'UPI';
    accountDetails: string;
    remarks?: string;
    createdAt: Date;
    updatedAt: Date;
}

const WithdrawRequestSchema = new Schema<IWithdrawRequest>(
    {
        sellerId: {
            type: Schema.Types.ObjectId,
            ref: 'Seller',
            required: [true, 'Seller ID is required'],
        },
        amount: {
            type: Number,
            required: [true, 'Amount is required'],
            min: [1, 'Minimum withdrawal amount is 1'],
        },
        status: {
            type: String,
            enum: ['Pending', 'Approved', 'Rejected', 'Completed'],
            default: 'Pending',
        },
        paymentMethod: {
            type: String,
            enum: ['Bank Transfer', 'UPI'],
            required: [true, 'Payment method is required'],
        },
        accountDetails: {
            type: String,
            required: [true, 'Account details are required'],
            trim: true,
        },
        remarks: {
            type: String,
            trim: true,
        },
    },
    {
        timestamps: true,
    }
);

WithdrawRequestSchema.index({ sellerId: 1 });
WithdrawRequestSchema.index({ status: 1 });

const WithdrawRequest = mongoose.model<IWithdrawRequest>('WithdrawRequest', WithdrawRequestSchema);

export default WithdrawRequest;
