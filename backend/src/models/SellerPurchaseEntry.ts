import mongoose, { Document, Schema } from "mongoose";

export interface ISellerPurchaseEntry extends Document {
  seller: mongoose.Types.ObjectId;
  entryId: string;
  type: "purchase" | "quotation";
  date?: string;
  data: any;
  createdAt: Date;
  updatedAt: Date;
}

const SellerPurchaseEntrySchema = new Schema<ISellerPurchaseEntry>(
  {
    seller: {
      type: Schema.Types.ObjectId,
      ref: "Seller",
      required: true,
      index: true,
    },
    entryId: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["purchase", "quotation"],
      default: "purchase",
      index: true,
    },
    date: {
      type: String,
      trim: true,
    },
    data: {
      type: Schema.Types.Mixed,
      required: true,
    },
  },
  { timestamps: true }
);

SellerPurchaseEntrySchema.index({ seller: 1, entryId: 1 }, { unique: true });
SellerPurchaseEntrySchema.index({ seller: 1, type: 1, createdAt: -1 });

const SellerPurchaseEntry = mongoose.model<ISellerPurchaseEntry>(
  "SellerPurchaseEntry",
  SellerPurchaseEntrySchema
);

export default SellerPurchaseEntry;


