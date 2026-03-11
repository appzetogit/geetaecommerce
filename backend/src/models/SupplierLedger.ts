import mongoose, { Schema, Document } from 'mongoose';

export interface ISupplierLedger extends Document {
  name: string;
  phone: string;
  address?: string;
  gstNumber?: string;
  openingBalance: number;
  currentBalance: number; // Positive means we owe them (Debt), Negative means Advance paid
  notes?: string;
  sellerId?: mongoose.Types.ObjectId; // If added by a seller
  isAdmin: boolean; // True if added by admin
  createdAt: Date;
  updatedAt: Date;
}

const SupplierLedgerSchema: Schema = new Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  address: { type: String },
  gstNumber: { type: String },
  openingBalance: { type: Number, default: 0 },
  currentBalance: { type: Number, default: 0 },
  notes: { type: String },
  sellerId: { type: Schema.Types.ObjectId, ref: 'Seller' },
  isAdmin: { type: Boolean, default: false },
}, { timestamps: true });

// Index for searching
SupplierLedgerSchema.index({ name: 'text', phone: 'text' });

export default mongoose.model<ISupplierLedger>('SupplierLedger', SupplierLedgerSchema);
