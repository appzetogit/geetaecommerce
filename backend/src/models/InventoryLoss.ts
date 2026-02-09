import mongoose, { Document, Schema } from "mongoose";

export interface IInventoryLoss extends Document {
  product: mongoose.Types.ObjectId;
  variationId?: mongoose.Types.ObjectId;
  date: Date;
  quantity: number;
  reason: "Missing" | "Damaged" | "Expired" | "Theft" | "Broken" | "Other";
  weight: string; // UOM
  admin: mongoose.Types.ObjectId;
  seller: mongoose.Types.ObjectId; // Added seller field
  createdAt: Date;
  updatedAt: Date;
}

const InventoryLossSchema = new Schema<IInventoryLoss>(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product is required"],
    },
    variationId: {
      type: Schema.Types.ObjectId,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    quantity: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [0, "Quantity cannot be negative"],
    },
    reason: {
      type: String,
      enum: ["Missing", "Damaged", "Expired", "Theft", "Broken", "Other"],
      required: [true, "Reason is required"],
    },
    weight: {
      type: String,
      default: "Piece",
    },
    admin: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
    },
    seller: {
      type: Schema.Types.ObjectId,
      ref: "Seller",
    },
  },
  {
    timestamps: true,
  }
);

InventoryLossSchema.index({ date: -1 });
InventoryLossSchema.index({ product: 1 });
InventoryLossSchema.index({ admin: 1 });
InventoryLossSchema.index({ seller: 1 });

const InventoryLoss = mongoose.models.InventoryLoss || mongoose.model<IInventoryLoss>("InventoryLoss", InventoryLossSchema);

export default InventoryLoss;
