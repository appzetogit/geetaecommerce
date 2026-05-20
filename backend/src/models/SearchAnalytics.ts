import mongoose, { Document, Schema } from "mongoose";

export interface ISearchAnalytics extends Document {
  query: string;
  normalizedQuery: string;
  resultCount: number;
  user?: mongoose.Types.ObjectId;
  clickedProducts: mongoose.Types.ObjectId[];
  source: "search" | "suggestion" | "similar" | "recommendation";
  metadata?: {
    page?: number;
    limit?: number;
    latencyMs?: number;
    zeroResults?: boolean;
    userAgent?: string;
    ip?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const SearchAnalyticsSchema = new Schema<ISearchAnalytics>(
  {
    query: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    normalizedQuery: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 160,
    },
    resultCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
    },
    clickedProducts: {
      type: [Schema.Types.ObjectId],
      ref: "Product",
      default: [],
    },
    source: {
      type: String,
      enum: ["search", "suggestion", "similar", "recommendation"],
      default: "search",
    },
    metadata: {
      page: Number,
      limit: Number,
      latencyMs: Number,
      zeroResults: Boolean,
      userAgent: String,
      ip: String,
    },
  },
  { timestamps: true }
);

SearchAnalyticsSchema.index({ normalizedQuery: 1, createdAt: -1 });
SearchAnalyticsSchema.index({ createdAt: -1 });
SearchAnalyticsSchema.index({ resultCount: 1, createdAt: -1 });
SearchAnalyticsSchema.index({ clickedProducts: 1 });

const SearchAnalytics = mongoose.model<ISearchAnalytics>(
  "SearchAnalytics",
  SearchAnalyticsSchema
);

export default SearchAnalytics;
