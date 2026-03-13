import mongoose, { Document, Schema } from "mongoose";

export interface ISellerLoginSession extends Document {
  sellerId: mongoose.Types.ObjectId;
  mobile: string;
  createdAt: Date;
  expiresAt: Date;
}

const SellerLoginSessionSchema = new Schema<ISellerLoginSession>({
  sellerId: {
    type: Schema.Types.ObjectId,
    ref: "Seller",
    required: true,
    index: true,
  },
  mobile: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    index: { expires: "0s" }, // TTL index
  },
});

const SellerLoginSession = mongoose.model<ISellerLoginSession>(
  "SellerLoginSession",
  SellerLoginSessionSchema
);

export default SellerLoginSession;


