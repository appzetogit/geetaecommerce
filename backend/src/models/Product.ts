import mongoose, { Document, Schema } from "mongoose";
import { generateEmbedding } from "../utils/embedding";

export interface IProduct extends Document {
  // Basic Info
  productName: string;
  video?: string;
  smallDescription?: string;
  description?: string;

  // Categorization
  category: mongoose.Types.ObjectId;
  subcategory?: mongoose.Types.ObjectId;
  subSubCategory?: mongoose.Types.ObjectId;
  headerCategoryId?: mongoose.Types.ObjectId;
  brand?: mongoose.Types.ObjectId;

  // Seller Info
  seller: mongoose.Types.ObjectId;

  // Tax & compliance (product-level)
  hsnCode?: string;
  gst?: number;
  lowStockQuantity?: number;
  deliveryTime?: string;

  // Variations (canonical sellable SKUs — min 1 required on create)
  variationType?: string; // legacy product-level; prefer per-variant variationType
  variations: Array<{
    _id?: any;
    variationType?: string;
    name?: string;
    value: string;
    price: number;
    wholesalePrice?: number;
    discPrice?: number;
    compareAtPrice?: number;
    purchasePrice?: number;
    stock: number;
    sku?: string;
    status?: string;
    barcode?: string[];
    rackNumber?: string;
    mainImage?: string;
    galleryImages?: string[];
    image?: string;
    tieredPrices?: { minQty: number; price: number }[];
    attributes?: Record<string, string>;
  }>;

  // Status Flags
  publish: boolean;
  popular: boolean;
  dealOfDay: boolean;
  status: "Active" | "Inactive" | "Pending" | "Rejected";

  // Product Details
  manufacturer?: string;
  madeIn?: string;
  tax?: string;
  mfgDate?: string;
  expiryDate?: string;
  fssaiLicNo?: string;
  totalAllowedQuantity?: number;

  // Return Policy
  isReturnable: boolean;
  maxReturnDays?: number;

  // SEO
  seoTitle?: string;
  seoKeywords?: string;
  seoDescription?: string;
  seoImageAlt?: string;

  // Details
  pack?: string;
  shelfLife?: string;
  marketer?: string;

  // Ratings
  rating: number;
  reviewsCount: number;
  discount: number; // Calculated percentage

  returnPolicyText?: string;

  // Tags
  tags: string[];

  // Search
  embedding: number[];
  searchMetadata?: {
    sourceText?: string;
    model?: string;
    dimensions?: number;
    updatedAt?: Date;
    version?: number;
  };
  searchCount: number;

  // Approval
  requiresApproval: boolean;
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;

  // Commission
  commission?: number;

  // Shop by Store
  isShopByStoreOnly?: boolean;
  shopId?: mongoose.Types.ObjectId;

  // Warranty
  warrantyType?: "None" | "Warranty" | "Guarantee";
  warrantyDuration?: string;

  inactiveReason?: string;

  createdAt: Date;
  updatedAt: Date;
}


  const ProductSchema = new Schema<IProduct>(
    {
      // Basic Info
      productName: {
        type: String,
        required: [true, "Product name is required"],
        trim: true,
      },
      video: {
        type: String,
        trim: true,
      },
      smallDescription: {
        type: String,
        trim: true,
      },
      description: {
        type: String,
        trim: true,
      },

    // Categorization
    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: [
        function (this: any) {
          return !this.isShopByStoreOnly;
        },
        "Category is required",
      ],
    },
    subcategory: {
      type: Schema.Types.ObjectId,
      ref: "SubCategory",
    },
    subSubCategory: {
      type: String,
      trim: true,
    },
    headerCategoryId: {
      type: Schema.Types.ObjectId,
      ref: "HeaderCategory",
    },
    brand: {
      type: Schema.Types.ObjectId,
      ref: "Brand",
    },

    // Seller Info
    seller: {
      type: Schema.Types.ObjectId,
      ref: "Seller",
      required: [true, "Seller is required"],
    },

    hsnCode: {
      type: String,
      trim: true,
    },
    gst: {
      type: Number,
      min: [0, "GST cannot be negative"],
      default: 5,
    },
    lowStockQuantity: {
      type: Number,
      min: [0, "Low stock quantity cannot be negative"],
      default: 5,
    },
    deliveryTime: {
      type: String,
      trim: true,
    },

    // Variations (required sellable SKUs)
    variations: {
      type: [
        {
          variationType: { type: String, trim: true, default: "Standard" },
          name: String,
          value: { type: String, required: true },
          price: { type: Number, required: true, min: 0 },
          wholesalePrice: { type: Number, default: 0 },
          discPrice: { type: Number, default: 0 },
          compareAtPrice: { type: Number },
          purchasePrice: { type: Number },
          stock: { type: Number, default: 0, min: 0 },
          status: {
            type: String,
            enum: ["Available", "Sold out", "In stock"],
            default: "Available",
          },
          sku: String,
          barcode: { type: [String], default: [] },
          rackNumber: { type: String, trim: true },
          mainImage: { type: String, trim: true },
          galleryImages: { type: [String], default: [] },
          image: { type: String, trim: true },
          tieredPrices: {
            type: [{ minQty: Number, price: Number }],
            default: [],
          },
          attributes: {
            type: Map,
            of: String,
            default: {},
          },
        },
      ],
      validate: {
        validator: function (v: unknown[]) {
          return Array.isArray(v) && v.length >= 1;
        },
        message: "At least one variant is required",
      },
    },

    // Status Flags
    publish: {
      type: Boolean,
      default: true,
    },
    popular: {
      type: Boolean,
      default: false,
    },
    dealOfDay: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["Active", "Inactive", "Pending", "Rejected"],
      default: "Active",
    },

    // Product Details
    manufacturer: {
      type: String,
      trim: true,
    },
    mfgDate: {
      type: String,
      trim: true,
    },
    expiryDate: {
      type: String,
      trim: true,
    },
    madeIn: {
      type: String,
      trim: true,
    },
    tax: {
      type: Schema.Types.ObjectId,
      ref: "Tax",
    },
    fssaiLicNo: {
      type: String,
      trim: true,
    },
    totalAllowedQuantity: {
      type: Number,
      min: [0, "Total allowed quantity cannot be negative"],
    },

    // Return Policy
    isReturnable: {
      type: Boolean,
      default: false,
    },
    maxReturnDays: {
      type: Number,
      min: [0, "Max return days cannot be negative"],
    },

    // SEO
    seoTitle: {
      type: String,
      trim: true,
    },
    seoKeywords: {
      type: String,
      trim: true,
    },
    seoDescription: {
      type: String,
      trim: true,
    },
    seoImageAlt: {
      type: String,
      trim: true,
    },

    // Details
    pack: { type: String, trim: true },
    shelfLife: { type: String, trim: true },
    marketer: { type: String, trim: true },

    // Ratings
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewsCount: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0, max: 100 },

    returnPolicyText: { type: String, trim: true },

    // Tags
    tags: {
      type: [String],
      default: [],
    },

    // AI search
    embedding: {
      type: [Number],
      default: [],
      select: false,
    },
    searchMetadata: {
      sourceText: { type: String, trim: true, select: false },
      model: { type: String, default: "Xenova/all-MiniLM-L6-v2" },
      dimensions: { type: Number, default: 0 },
      updatedAt: { type: Date },
      version: { type: Number, default: 1 },
    },
    searchCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Approval
    requiresApproval: {
      type: Boolean,
      default: false,
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
    },
    approvedAt: {
      type: Date,
    },

    // Commission
    commission: {
      type: Number,
      min: [0, "Commission cannot be negative"],
    },

    // Shop by Store
    isShopByStoreOnly: {
      type: Boolean,
      default: false,
    },
    shopId: {
      type: Schema.Types.ObjectId,
      ref: "Shop",
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
    inactiveReason: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for mrp — computed from variants at read time via productReadMapper
ProductSchema.virtual("mrp").get(function () {
  const v = this.variations?.[0];
  return v?.compareAtPrice ?? v?.price ?? 0;
});

const SEARCHABLE_PRODUCT_FIELDS = [
  "productName",
  "smallDescription",
  "description",
  "category",
  "subcategory",
  "subSubCategory",
  "brand",
  "tags",
  "manufacturer",
  "marketer",
  "seoKeywords",
  "seoTitle",
  "seoDescription",
  "pack",
];

const readName = (value: unknown): string => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const record = value as Record<string, any>;
    return String(record.name || record.productName || record.title || "").trim();
  }
  return "";
};

const lookupModelName = async (modelName: string, value: unknown): Promise<string> => {
  if (!value) return "";
  const directName = readName(value);
  if (directName && !mongoose.Types.ObjectId.isValid(directName)) return directName;

  const id = typeof value === "object" ? (value as any)?._id || (value as any)?.id : value;
  if (!id || !mongoose.Types.ObjectId.isValid(String(id))) return "";

  const Model = mongoose.models[modelName];
  if (!Model) return "";

  const item = await Model.findById(id).select("name").lean();
  return readName(item);
};

export const buildProductSearchText = async (product: Partial<IProduct> | Record<string, any>): Promise<string> => {
  const pieces = [
    product.productName,
    product.smallDescription,
    product.description,
    await lookupModelName("Category", product.category),
    await lookupModelName("SubCategory", product.subcategory),
    product.subSubCategory,
    await lookupModelName("Brand", product.brand),
    Array.isArray(product.tags) ? product.tags.join(" ") : product.tags,
    product.manufacturer,
    product.marketer,
    product.seoTitle,
    product.seoKeywords,
    product.seoDescription,
    product.pack,
  ];

  return pieces
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
};

const hasSearchableChanges = (doc: IProduct): boolean => {
  return doc.isNew || SEARCHABLE_PRODUCT_FIELDS.some((field) => doc.isModified(field));
};

// Normalize variant subdocs before save
ProductSchema.pre("save", function (next) {
  if (!this.variations || this.variations.length < 1) {
    return next(new Error("At least one variant is required"));
  }

  this.variations.forEach((v: any) => {
    if (!v.variationType) {
      v.variationType = v.name || "Standard";
    }
    if (!v.name) v.name = v.variationType;
    if (v.mainImage && !v.image) v.image = v.mainImage;
    if (!v.mainImage && v.image) v.mainImage = v.image;
    if (!v.discPrice || v.discPrice === 0) v.discPrice = v.price;
    if (!v.compareAtPrice || v.compareAtPrice === 0) {
      v.compareAtPrice = v.compareAtPrice ?? v.price;
    }
  });

  const first = this.variations[0];
  const minDisc = Math.min(
    ...this.variations.map((v: any) => Number(v.discPrice ?? v.price) || 0)
  );
  const maxMrp = Math.max(
    ...this.variations.map((v: any) => Number(v.compareAtPrice) || Number(v.price) || 0)
  );
  if (maxMrp > minDisc) {
    this.discount = Math.round(((maxMrp - minDisc) / maxMrp) * 100);
  } else {
    this.discount = 0;
  }

  next();
});

ProductSchema.pre("save", async function (next) {
  if (!hasSearchableChanges(this)) return next();

  try {
    const sourceText = await buildProductSearchText(this);
    if (!sourceText) return next();

    const embedding = await generateEmbedding(sourceText);
    this.embedding = embedding;
    this.searchMetadata = {
      sourceText,
      model: "Xenova/all-MiniLM-L6-v2",
      dimensions: embedding.length,
      updatedAt: new Date(),
      version: 1,
    };
  } catch (error) {
    console.error("[Product] Skipping embedding generation during save", error);
  }

  return next();
});

ProductSchema.pre("findOneAndUpdate", async function (next) {
  const update = this.getUpdate() as Record<string, any> | null;
  if (!update) return next();

  const updatePayload = { ...(update.$set || {}), ...update };
  delete updatePayload.$set;
  delete updatePayload.$inc;
  delete updatePayload.$unset;
  delete updatePayload.$push;
  delete updatePayload.$pull;

  const shouldRefreshEmbedding = SEARCHABLE_PRODUCT_FIELDS.some((field) =>
    Object.prototype.hasOwnProperty.call(updatePayload, field)
  );

  if (!shouldRefreshEmbedding) return next();

  try {
    const current = await this.model.findOne(this.getQuery()).select("+embedding +searchMetadata").lean();
    if (!current) return next();

    const merged = { ...current, ...updatePayload };
    const sourceText = await buildProductSearchText(merged);
    if (!sourceText) return next();

    const embedding = await generateEmbedding(sourceText);
    this.setUpdate({
      ...update,
      $set: {
        ...(update.$set || {}),
        embedding,
        searchMetadata: {
          sourceText,
          model: "Xenova/all-MiniLM-L6-v2",
          dimensions: embedding.length,
          updatedAt: new Date(),
          version: 1,
        },
      },
    });
  } catch (error) {
    console.error("[Product] Skipping embedding generation during update", error);
  }

  return next();
});

// Indexes for faster queries
ProductSchema.index({ seller: 1, status: 1 });
ProductSchema.index({ category: 1 });
ProductSchema.index({ subcategory: 1 });
ProductSchema.index({ brand: 1 });
ProductSchema.index({ status: 1 });
ProductSchema.index({ publish: 1 });
ProductSchema.index({ tags: 1 });
ProductSchema.index({ searchCount: -1 });
// Compound indexes for common queries
ProductSchema.index({ status: 1, publish: 1 }); // For getProducts
ProductSchema.index({ category: 1, status: 1, publish: 1 }); // For category products
ProductSchema.index({ subcategory: 1, status: 1, publish: 1 }); // For subcategory products
ProductSchema.index({
  productName: "text",
  smallDescription: "text",
  description: "text",
  tags: "text",
  pack: "text",
});

const Product = mongoose.model<IProduct>("Product", ProductSchema);

export default Product;
