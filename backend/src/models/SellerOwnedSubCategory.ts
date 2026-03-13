import mongoose, { Document, Schema } from "mongoose";

export interface ISellerOwnedSubCategory extends Document {
  seller: mongoose.Types.ObjectId;
  parentId: string;
  categoryName: string;
  subcategoryName: string;
  subcategoryImage?: string;
  order: number;
  status: "Active" | "Inactive";
  createdAt: Date;
  updatedAt: Date;
}

const SellerOwnedSubCategorySchema = new Schema<ISellerOwnedSubCategory>(
  {
    seller: {
      type: Schema.Types.ObjectId,
      ref: "Seller",
      required: true,
      index: true,
    },
    parentId: {
      type: String,
      required: true,
      index: true,
    },
    categoryName: {
      type: String,
      required: true,
      trim: true,
    },
    subcategoryName: {
      type: String,
      required: true,
      trim: true,
    },
    subcategoryImage: {
      type: String,
      trim: true,
      default: "",
    },
    order: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
  },
  { timestamps: true }
);

SellerOwnedSubCategorySchema.index(
  { seller: 1, parentId: 1, subcategoryName: 1 },
  { unique: true }
);

const SellerOwnedSubCategory = mongoose.model<ISellerOwnedSubCategory>(
  "SellerOwnedSubCategory",
  SellerOwnedSubCategorySchema
);

export default SellerOwnedSubCategory;


