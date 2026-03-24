import mongoose, { Document, Schema } from "mongoose";

export interface IAdminPurchaseEntry extends Document {
  admin: mongoose.Types.ObjectId;
  entryId: string;
  type: "purchase" | "quotation";
  date?: string;
  data: any;
  createdAt: Date;
  updatedAt: Date;
}

const AdminPurchaseEntrySchema = new Schema<IAdminPurchaseEntry>(
  {
    admin: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
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

AdminPurchaseEntrySchema.index({ admin: 1, entryId: 1 }, { unique: true });
AdminPurchaseEntrySchema.index({ admin: 1, type: 1, createdAt: -1 });

const AdminPurchaseEntry = mongoose.model<IAdminPurchaseEntry>(
  "AdminPurchaseEntry",
  AdminPurchaseEntrySchema
);

export default AdminPurchaseEntry;

