import mongoose, { Document, Schema } from "mongoose";

export interface IStockLedger extends Document {
  product: mongoose.Types.ObjectId;
  variationId?: mongoose.Types.ObjectId;
  sku: string;
  quantity: number;
  type: "IN" | "OUT";
  source: "POS" | "RETURN" | "EXCHANGE" | "MANUAL" | "RESTOCK" | "POS_CANCEL";
  referenceId?: mongoose.Types.ObjectId; // Order ID or special marker
  previousStock: number;
  newStock: number;
  admin?: mongoose.Types.ObjectId;
  createdAt: Date;
}

const StockLedgerSchema = new Schema<IStockLedger>(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product is required"],
    },
    variationId: {
      type: Schema.Types.ObjectId,
    },
    sku: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
    },
    type: {
      type: String,
      enum: ["IN", "OUT"],
      required: true,
    },
    source: {
      type: String,
      enum: ["POS", "RETURN", "EXCHANGE", "MANUAL", "RESTOCK", "POS_CANCEL"],
      required: true,
    },
    referenceId: {
      type: Schema.Types.ObjectId,
    },
    previousStock: {
      type: Number,
      required: true,
    },
    newStock: {
      type: Number,
      required: true,
    },
    admin: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

StockLedgerSchema.index({ product: 1, createdAt: -1 });
StockLedgerSchema.index({ sku: 1 });

const StockLedger = mongoose.models.StockLedger || mongoose.model<IStockLedger>("StockLedger", StockLedgerSchema);

export default StockLedger;
