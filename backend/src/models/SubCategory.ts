import mongoose, { Document, Schema } from "mongoose";

export interface ISubCategory extends Document {
  name: string;
  category: mongoose.Types.ObjectId;
  image?: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const SubCategorySchema = new Schema<ISubCategory>(
  {
    name: {
      type: String,
      required: [true, "Subcategory name is required"],
      trim: true,
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Category is required"],
    },
    image: {
      type: String,
      trim: true,
    },
    order: {
      type: Number,
      default: 0,
      min: [0, "Order cannot be negative"],
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
SubCategorySchema.index({ category: 1, order: 1 });
SubCategorySchema.index({ name: 1 });

const SubCategory = mongoose.model<ISubCategory>(
  "SubCategory",
  SubCategorySchema
);

export default SubCategory;
