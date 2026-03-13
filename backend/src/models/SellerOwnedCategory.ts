import mongoose, { Document, Schema } from "mongoose";

export interface ISellerOwnedCategory extends Document {
  seller: mongoose.Types.ObjectId;
  name: string;
  image?: string;
  order: number;
  parentId?: string | null;
  headerCategoryId?: string | null;
  status: "Active" | "Inactive";
  isBestseller: boolean;
  hasWarning: boolean;
  groupCategory?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SellerOwnedCategorySchema = new Schema<ISellerOwnedCategory>(
  {
    seller: {
      type: Schema.Types.ObjectId,
      ref: "Seller",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    image: {
      type: String,
      trim: true,
    },
    order: {
      type: Number,
      default: 0,
    },
    parentId: {
      type: String,
      default: null,
    },
    headerCategoryId: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
    isBestseller: {
      type: Boolean,
      default: false,
    },
    hasWarning: {
      type: Boolean,
      default: false,
    },
    groupCategory: {
      type: String,
      trim: true,
      default: "",
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

SellerOwnedCategorySchema.index({ seller: 1, name: 1 }, { unique: true });

const SellerOwnedCategory = mongoose.model<ISellerOwnedCategory>(
  "SellerOwnedCategory",
  SellerOwnedCategorySchema
);

export default SellerOwnedCategory;


