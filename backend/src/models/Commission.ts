import mongoose, { Document, Schema } from "mongoose";

export interface ICommission extends Document {
  order: mongoose.Types.ObjectId;
  orderItem: mongoose.Types.ObjectId;
  seller: mongoose.Types.ObjectId;

  // Commission Info
  orderAmount: number;
  commissionRate: number; // Percentage
  commissionAmount: number;

  // Status
  status: "Pending" | "Paid" | "Cancelled";

  // Payment
  paidAt?: Date;
  paymentReference?: string;

  createdAt: Date;
  updatedAt: Date;
}

const CommissionSchema = new Schema<ICommission>(
  {
    order: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: [true, "Order is required"],
    },
    orderItem: {
      type: Schema.Types.ObjectId,
      ref: "OrderItem",
      required: [true, "Order item is required"],
    },
    seller: {
      type: Schema.Types.ObjectId,
      ref: "Seller",
      required: [true, "Seller is required"],
    },

    // Commission Info
    orderAmount: {
      type: Number,
      required: [true, "Order amount is required"],
      min: [0, "Order amount cannot be negative"],
    },
    commissionRate: {
      type: Number,
      required: [true, "Commission rate is required"],
      min: [0, "Commission rate cannot be negative"],
      max: [100, "Commission rate cannot exceed 100%"],
    },
    commissionAmount: {
      type: Number,
      required: [true, "Commission amount is required"],
      min: [0, "Commission amount cannot be negative"],
    },

    // Status
    status: {
      type: String,
      enum: ["Pending", "Paid", "Cancelled"],
      default: "Pending",
    },

    // Payment
    paidAt: {
      type: Date,
    },
    paymentReference: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
CommissionSchema.index({ seller: 1, status: 1 });
CommissionSchema.index({ order: 1 });

const Commission = mongoose.model<ICommission>("Commission", CommissionSchema);

export default Commission;
