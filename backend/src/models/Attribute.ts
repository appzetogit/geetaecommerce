import mongoose, { Schema, Document } from "mongoose";

export interface IAttribute extends Document {
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

const AttributeSchema: Schema = new Schema(
  {
    name: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

export default mongoose.model<IAttribute>("Attribute", AttributeSchema);
