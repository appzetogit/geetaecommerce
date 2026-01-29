import mongoose, { Document, Schema } from "mongoose";

export interface IAppSettings extends Document {
  // App Info
  appName: string;
  appLogo?: string;
  appFavicon?: string;

  // Contact Info
  contactEmail: string;
  contactPhone: string;
  supportEmail?: string;
  supportPhone?: string;

  // Address
  companyAddress?: string;
  companyCity?: string;
  companyState?: string;
  companyPincode?: string;
  companyCountry?: string;

  // Payment Settings
  paymentMethods: {
    cod: boolean;
    online: boolean;
    wallet: boolean;
    upi: boolean;
  };
  paymentGateways?: {
    razorpay?: {
      enabled: boolean;
      keyId?: string;
      keySecret?: string;
    };
    stripe?: {
      enabled: boolean;
      publishableKey?: string;
      secretKey?: string;
    };
  };

  // SMS Gateway Settings
  smsGateway?: {
    provider: string; // e.g., 'Twilio', 'MSG91', 'TextLocal'
    apiKey?: string;
    apiSecret?: string;
    senderId?: string;
    enabled: boolean;
  };

  // Commission Settings
  defaultCommission: number;

  // Delivery Settings
  deliveryCharges: number;
  freeDeliveryThreshold?: number;
  deliveryRadius?: number;
  serviceType?: string;

  // Tax Settings
  gstEnabled: boolean;
  gstRate?: number;

  // Policies
  privacyPolicy?: string;
  termsOfService?: string;
  returnPolicy?: string;
  refundPolicy?: string;
  customerAppPolicy?: string;
  deliveryAppPolicy?: string;

  // FAQ
  faq?: Array<{
    question: string;
    answer: string;
  }>;

  // Home Sections Configuration
  homeSections?: Array<{
    title: string;
    category?: mongoose.Types.ObjectId;
    subcategory?: mongoose.Types.ObjectId;
    city?: string;
    deliverableArea?: string;
    status: string;
    productSortBy?: string;
    productLimit?: number;
    order: number;
  }>;

  // Feature Flags
  features: {
    sellerRegistration: boolean;
    productApproval: boolean;
    orderTracking: boolean;
    wallet: boolean;
    coupons: boolean;
  };

  // Maintenance Mode
  maintenanceMode: boolean;
  maintenanceMessage?: string;

  // External APIs
  geminiApiKey?: string;
  googleCxId?: string; // Search Engine ID for Google Custom Search

  // Product Display Settings
  productDisplaySettings?: Array<{
    id: string;
    title: string;
    description?: string;
    fields: Array<{
      id: string;
      label: string;
      description?: string;
      isEnabled: boolean;
      type?: string;
      canDelete?: boolean;
    }>;
  }>;

  // Flash Deal Settings
  flashDeal?: {
    targetDate?: Date;
    image?: string;
    active?: boolean;
    productIds?: string[];
  };

  // Deal of the Day Settings
  dealOfTheDay?: {
      productIds: string[];
      active?: boolean;
  };

  // Featured Deal Settings
  featuredDeal?: {
      productIds: string[];
      active?: boolean;
  };

  // Payment Discount Settings
  onlinePaymentDiscount?: {
      enabled: boolean;
      percentage: number;
  };

  // Barcode Settings
  barcodeSettings?: {
      width: number;
      height: number;
      fontSize: number;
      barcodeHeight: number;
      productNameSize: number;
      showPrice: boolean;
      showName: boolean;
  };

  // Updated By
  updatedBy?: mongoose.Types.ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const AppSettingsSchema = new Schema<IAppSettings>(
  {
    // App Info
    appName: {
      type: String,
      required: [true, "App name is required"],
      default: "Geeta Stores",
      trim: true,
    },
    appLogo: {
      type: String,
      trim: true,
    },
    appFavicon: {
      type: String,
      trim: true,
    },

    // Contact Info
    contactEmail: {
      type: String,
      required: [true, "Contact email is required"],
      trim: true,
    },

    contactPhone: {
      type: String,
      required: [true, "Contact phone is required"],
      trim: true,

    },

    supportEmail: {
      type: String,
      trim: true,
    },

    supportPhone: {
      type: String,
      trim: true,
    },

    // Address
    companyAddress: {
      type: String,
      trim: true,
    },

    companyCity: {
      type: String,
      trim: true,
    },
    companyState: {
      type: String,
      trim: true,
    },
    companyPincode: {
      type: String,
      trim: true,
    },
    
    companyCountry: {
      type: String,
      default: "India",
      trim: true,
    },

    // Payment Settings
    paymentMethods: {
      cod: {
        type: Boolean,
        default: true,
      },
      online: {
        type: Boolean,
        default: true,
      },
      wallet: {
        type: Boolean,
        default: true,
      },
      upi: {
        type: Boolean,
        default: true,
      },
    },
    paymentGateways: {
      razorpay: {
        enabled: Boolean,
        keyId: String,
        keySecret: String,
      },
      stripe: {
        enabled: Boolean,
        publishableKey: String,
        secretKey: String,
      },
    },

    // SMS Gateway Settings
    smsGateway: {
      provider: {
        type: String,
        trim: true,
      },
      apiKey: {
        type: String,
        trim: true,
      },
      apiSecret: {
        type: String,
        trim: true,
      },
      senderId: {
        type: String,
        trim: true,
      },
      enabled: {
        type: Boolean,
        default: false,
      },
    },

    // Commission Settings
    defaultCommission: {
      type: Number,
      default: 10,
      min: [0, "Commission cannot be negative"],
      max: [100, "Commission cannot exceed 100%"],
    },

    // Delivery Settings
    deliveryCharges: {
      type: Number,
      default: 0,
      min: [0, "Delivery charges cannot be negative"],
    },
    freeDeliveryThreshold: {
      type: Number,
      min: [0, "Free delivery threshold cannot be negative"],
    },
    deliveryRadius: {
      type: Number,
      default: 0,
      min: [0, "Delivery radius cannot be negative"],
    },
    serviceType: {
      type: String,
      enum: ["Delivery", "Pickup", "Delivery + Pickup"],
      default: "Delivery + Pickup",
    },

    // Tax Settings
    gstEnabled: {
      type: Boolean,
      default: false,
    },
    gstRate: {
      type: Number,
      min: [0, "GST rate cannot be negative"],
      max: [100, "GST rate cannot exceed 100%"],
    },

    // Policies
    privacyPolicy: {
      type: String,
      trim: true,
    },
    termsOfService: {
      type: String,
      trim: true,
    },
    returnPolicy: {
      type: String,
      trim: true,
    },
    refundPolicy: {
      type: String,
      trim: true,
    },
    customerAppPolicy: {
      type: String,
      trim: true,
    },
    deliveryAppPolicy: {
      type: String,
      trim: true,
    },

    // FAQ
    faq: [
      {
        question: {
          type: String,
          required: true,
          trim: true,
        },
        answer: {
          type: String,
          required: true,
          trim: true,
        },
      },
    ],

    // Home Sections Configuration
    homeSections: [
      {
        title: String,
        category: {
          type: Schema.Types.ObjectId,
          ref: "Category",
        },
        subcategory: {
          type: Schema.Types.ObjectId,
          ref: "SubCategory",
        },
        city: String,
        deliverableArea: String,
        status: String,
        productSortBy: String,
        productLimit: Number,
        order: {
          type: Number,
          default: 0,
        },
      },
    ],

    // Feature Flags
    features: {
      sellerRegistration: {
        type: Boolean,
        default: true,
      },
      productApproval: {
        type: Boolean,
        default: true,
      },
      orderTracking: {
        type: Boolean,
        default: true,
      },
      wallet: {
        type: Boolean,
        default: true,
      },
      coupons: {
        type: Boolean,
        default: true,
      },
    },

    // Maintenance Mode
    maintenanceMode: {
      type: Boolean,
      default: false,
    },
    maintenanceMessage: {
      type: String,
      trim: true,
    },

    // External APIs
    geminiApiKey: {
      type: String,
      trim: true,
      select: false, // Security: Don't return by default
    },
    googleCxId: {
      type: String,
      trim: true,
      select: false,
    },

    // Product Display Settings
    productDisplaySettings: [
      {
        id: String,
        title: String,
        description: String,
        fields: [
          {
            id: String,
            label: String,
            description: String,
            isEnabled: {
              type: Boolean,
              default: true,
            },
            type: {
              type: String,
              default: "toggle",
            },
            canDelete: {
              type: Boolean,
              default: false,
            },
          },
        ],
      },
    ],

    // Flash Deal Settings
    flashDeal: {
      targetDate: {
        type: Date,
      },
      image: {
        type: String,
        trim: true,
      },
      active: {
        type: Boolean,
        default: true
      },
      productIds: [{
        type: String,
        trim: true
      }]
    },

    // Deal of the Day Settings
    dealOfTheDay: {
      productIds: [{
        type: String, // Storing as String first as these might not be ObjectIds if from different DBs? Actually assuming strictObjectId. But let's use String for robustness with legacy code if any.
        trim: true
      }],
      active: {
          type: Boolean,
          default: true
      }
    },

    // Featured Deal Settings
    featuredDeal: {
      productIds: [{
        type: String,
        trim: true
      }],
      active: {
          type: Boolean,
          default: true
      }
    },

    // Payment Discount Settings
    onlinePaymentDiscount: {
      enabled: {
        type: Boolean,
        default: false
      },
      percentage: {
        type: Number,
        default: 0,
        min: [0, "Discount percentage cannot be negative"],
        max: [100, "Discount percentage cannot exceed 100%"]
      }
    },

    // Barcode Settings
    barcodeSettings: {
        width: { type: Number, default: 38 },
        height: { type: Number, default: 25 },
        fontSize: { type: Number, default: 10 },
        barcodeHeight: { type: Number, default: 40 },
        productNameSize: { type: Number, default: 10 },
        showPrice: { type: Boolean, default: true },
        showName: { type: Boolean, default: true }
    },

    // Updated By
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  {
    timestamps: true,
  }
);

// Ensure only one settings document exists
AppSettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({
      appName: "Geeta Stores",
      contactEmail: "contact@Geeta Stores.com",
      contactPhone: "1234567890",
    });
  }
  return settings;
};

// Indexes
AppSettingsSchema.index({ appName: 1 });

const AppSettings = mongoose.model<IAppSettings>(
  "AppSettings",
  AppSettingsSchema
);

export default AppSettings;
