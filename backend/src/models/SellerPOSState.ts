import mongoose, { Document, Schema } from "mongoose";

export interface ISellerPOSState extends Document {
  seller: mongoose.Types.ObjectId;
  bills: any[];
  activeBillId: string;
  createdAt: Date;
  updatedAt: Date;
}

const SellerPOSStateSchema = new Schema<ISellerPOSState>(
  {
    seller: {
      type: Schema.Types.ObjectId,
      ref: "Seller",
      required: true,
      unique: true,
      index: true,
    },
    bills: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    } as any,
    activeBillId: {
      type: String,
      default: "1",
    },
  },
  { timestamps: true }
);

const SellerPOSState = mongoose.model<ISellerPOSState>(
  "SellerPOSState",
  SellerPOSStateSchema
);

export default SellerPOSState;


