import mongoose, { Schema, Document } from "mongoose";

export interface IVariationType extends Document {
  name: string;
  createdBy: "Admin" | "Seller";
  createdAt: Date;
  updatedAt: Date;
}

const VariationTypeSchema: Schema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    createdBy: { type: String, enum: ["Admin", "Seller"], required: true },
  },
  { timestamps: true }
);

export default mongoose.model<IVariationType>("VariationType", VariationTypeSchema);
