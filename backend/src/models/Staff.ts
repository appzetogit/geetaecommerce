import mongoose, { Document, Schema } from "mongoose";

export type StaffModule = "admin" | "seller";

export interface IStaff extends Document {
  name: string;
  phone: string;
  role: string;
  commission: number;
  permissions: string[];
  module: StaffModule;
  createdAt: Date;
  updatedAt: Date;
}

const StaffSchema = new Schema<IStaff>(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
      validate: {
        validator: (v: string) => /^[0-9]{10}$/.test(v),
        message: "Phone number must be exactly 10 digits",
      },
    },
    role: {
      type: String,
      required: [true, "Role is required"],
      trim: true,
    },
    commission: {
      type: Number,
      default: 0,
      min: [0, "Commission cannot be negative"],
    },
    permissions: {
      type: [String],
      default: ["pos", "orders", "customers"],
    },
    module: {
      type: String,
      enum: ["admin", "seller"],
      required: true,
      default: "admin",
    },
  },
  {
    timestamps: true,
  }
);

const Staff = mongoose.model<IStaff>("Staff", StaffSchema);

export default Staff;


