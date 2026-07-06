import mongoose, { Document, Schema } from "mongoose";

export interface IOrderItem extends Document {
  order: mongoose.Types.ObjectId;
  product: mongoose.Types.ObjectId;
  seller: mongoose.Types.ObjectId;

  // Product Details (snapshot at time of order)
  productName: string;
  productImage?: string;
  sku?: string;

  // Pricing
  mrp?: number;
  unitPrice: number;
  quantity: number;
  total: number;

  // Tax (GST)
  hsnCode?: string;
  // GST percentage applied on this line item (e.g. 5 means 5%)
  gst?: number;
  // GST amount computed for this line item
  gstAmount?: number;

  // Variation
  variation?: string;
  variantId?: mongoose.Types.ObjectId;

  // Status
  status: "Pending" | "Shipped" | "Delivered" | "Cancelled" | "Returned";

  // Warranty (snapshot at time of order)
  warrantyType?: "None" | "Warranty" | "Guarantee";
  warrantyDuration?: string;

  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema = new Schema<IOrderItem>(
  {
    order: {
      type: Schema.Types.ObjectId,
      ref: "Order",
      required: [true, "Order is required"],
    },
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: false,
    },
    seller: {
      type: Schema.Types.ObjectId,
      ref: "Seller",
      required: false,
    },

    // Product Details (snapshot)
    productName: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
    },
    productImage: {
      type: String,
      trim: true,
    },
    sku: {
      type: String,
      trim: true,
    },

    // Pricing
    mrp: {
      type: Number,
      min: [0, "MRP cannot be negative"],
      default: 0,
    },
    unitPrice: {
      type: Number,
      required: [true, "Unit price is required"],
      min: [0, "Unit price cannot be negative"],
    },
    quantity: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [1, "Quantity must be at least 1"],
    },
    total: {
      type: Number,
      required: [true, "Total is required"],
      min: [0, "Total cannot be negative"],
    },

    // Tax (GST)
    hsnCode: {
      type: String,
      trim: true,
      default: "",
    },
    gst: {
      type: Number,
      min: [0, "GST cannot be negative"],
      default: 5,
    },
    gstAmount: {
      type: Number,
      min: [0, "GST amount cannot be negative"],
      default: 0,
    },

    // Variation
    variation: {
      type: String,
      trim: true,
    },
    variantId: {
      type: Schema.Types.ObjectId,
    },

    // Status
    status: {
      type: String,
      enum: ["Pending", "Shipped", "Delivered", "Cancelled", "Returned"],
      default: "Pending",
    },
    // Warranty
    warrantyType: {
      type: String,
      enum: ["None", "Warranty", "Guarantee"],
      default: "None",
    },
    warrantyDuration: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for faster queries
OrderItemSchema.index({ order: 1 });
OrderItemSchema.index({ product: 1 });
OrderItemSchema.index({ seller: 1 });

const OrderItem = mongoose.models.OrderItem || mongoose.model<IOrderItem>("OrderItem", OrderItemSchema);

export default OrderItem;
