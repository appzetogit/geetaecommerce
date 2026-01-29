
import mongoose, { Document, Schema } from 'mongoose';

export interface ICreditTransaction extends Document {
  customer: mongoose.Types.ObjectId;
  type: 'Order' | 'Payment' | 'Manual' | 'Return'; // 'Order' increases balance (debt), 'Payment' decreases it
  amount: number;
  balanceAfter: number;
  description: string;
  referenceId?: string; // Order ID or Payment ID
  date: Date;
  createdBy?: mongoose.Types.ObjectId; // Admin who performed the action
}

const CreditTransactionSchema = new Schema<ICreditTransaction>(
  {
    customer: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
    },
    type: {
      type: String,
      enum: ['Order', 'Payment', 'Manual', 'Return'],
      required: true,
    },
    amount: {
      type: Number,
      required: true, // Can be positive (debt increase) or negative (debt decrease)
    },
    balanceAfter: {
      type: Number,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    referenceId: {
      type: String,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'Admin',
    },
  },
  {
    timestamps: true,
  }
);

const CreditTransaction = mongoose.models.CreditTransaction || mongoose.model<ICreditTransaction>('CreditTransaction', CreditTransactionSchema);

export default CreditTransaction;
