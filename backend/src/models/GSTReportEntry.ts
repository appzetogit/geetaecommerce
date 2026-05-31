import mongoose, { Schema, Document } from 'mongoose';

export interface IGSTReportEntry extends Document {
  // Ownership (mirrors SupplierLedger pattern)
  sellerId?: mongoose.Types.ObjectId; // present for seller-owned rows
  isAdmin: boolean; // true for admin-owned rows

  // Header
  date: Date; // bill date
  billNo: string;

  // Supplier (denormalized so admin/seller can freely edit each row
  // without mutating the source supplier ledger)
  supplierLedgerId?: mongoose.Types.ObjectId; // optional ref to SupplierLedger
  supplierName: string;
  supplierGstNumber?: string;

  // Item details
  itemCategory?: string;
  totalAmount: number;

  // Fixed GST slabs
  slab5Amount: number;
  slab5Gst: number;
  slab12Amount: number;
  slab12Gst: number;
  slab18Amount: number;
  slab18Gst: number;
  slab28Amount: number;
  slab28Gst: number;

  // Custom slab ("Amount @ [ ]%")
  customRate?: number;
  customAmount: number;
  customGst: number;

  createdAt: Date;
  updatedAt: Date;
}

const GSTReportEntrySchema: Schema = new Schema(
  {
    sellerId: { type: Schema.Types.ObjectId, ref: 'Seller' },
    isAdmin: { type: Boolean, default: false, required: true },

    date: { type: Date, required: true, default: Date.now },
    billNo: { type: String, required: true, trim: true },

    supplierLedgerId: { type: Schema.Types.ObjectId, ref: 'SupplierLedger' },
    supplierName: { type: String, required: true, trim: true },
    supplierGstNumber: { type: String, trim: true },

    itemCategory: { type: String, trim: true },
    totalAmount: { type: Number, default: 0, min: 0 },

    slab5Amount: { type: Number, default: 0, min: 0 },
    slab5Gst: { type: Number, default: 0, min: 0 },
    slab12Amount: { type: Number, default: 0, min: 0 },
    slab12Gst: { type: Number, default: 0, min: 0 },
    slab18Amount: { type: Number, default: 0, min: 0 },
    slab18Gst: { type: Number, default: 0, min: 0 },
    slab28Amount: { type: Number, default: 0, min: 0 },
    slab28Gst: { type: Number, default: 0, min: 0 },

    customRate: { type: Number, default: 0, min: 0 },
    customAmount: { type: Number, default: 0, min: 0 },
    customGst: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

GSTReportEntrySchema.index({ sellerId: 1, date: -1 });
GSTReportEntrySchema.index({ isAdmin: 1, date: -1 });
GSTReportEntrySchema.index({ supplierName: 'text', billNo: 'text', supplierGstNumber: 'text' });

export default mongoose.model<IGSTReportEntry>('GSTReportEntry', GSTReportEntrySchema);
