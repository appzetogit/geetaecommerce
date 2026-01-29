import mongoose, { Document, Schema } from 'mongoose';

export interface ICustomer extends Document {
  name: string;
  email: string;
  phone: string;
  dateOfBirth?: Date;
  registrationDate: Date;
  status: 'Active' | 'Inactive' | 'Suspended';
  refCode: string;
  totalOrders: number;
  totalSpent: number;
  creditBalance: number;
  fcmToken?: string;
  fcmTokenMobile?: string;
  // Location fields
  latitude?: number;
  longitude?: number;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  locationUpdatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  notificationPreferences?: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  donationStats?: {
    totalDonated: number;
    lastDonationDate?: Date;
    impactDescription?: string;
  };
  accountPrivacy?: {
    hideSensitiveItems: boolean;
  };
}


const CustomerSchema = new Schema<ICustomer>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: function (v: string) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: 'Please enter a valid email address',
      },
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      trim: true,
      validate: {
        validator: function (v: string) {
          return /^[0-9]{10}$/.test(v);
        },
        message: 'Phone number must be 10 digits',
      },
    },
    dateOfBirth: {
      type: Date,
    },
    registrationDate: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive', 'Suspended'],
      default: 'Active',
    },
    refCode: {
      type: String,
      unique: true,
      trim: true,
      uppercase: true,
    },
    totalOrders: {
      type: Number,
      default: 0,
      min: [0, 'Total orders cannot be negative'],
    },
    totalSpent: {
      type: Number,
      default: 0,
      min: [0, 'Total spent cannot be negative'],
    },
    creditBalance: {
      type: Number,
      default: 0,
    },
    fcmToken: {
      type: String,
      default: null,
    },
    fcmTokenMobile: {
      type: String,
      default: null,
    },
    // Location fields
    latitude: {
      type: Number,
    },
    longitude: {
      type: Number,
    },
    address: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    state: {
      type: String,
      trim: true,
    },
    pincode: {
      type: String,
      trim: true,
    },
    locationUpdatedAt: {
      type: Date,
    },
    notificationPreferences: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
    },
    donationStats: {
      totalDonated: { type: Number, default: 0 },
      lastDonationDate: Date,
      impactDescription: String,
    },
    accountPrivacy: {
      hideSensitiveItems: { type: Boolean, default: false },
    },
  },

  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for walletAmount to match frontend expectations
CustomerSchema.virtual('walletAmount').get(function (this: ICustomer) {
  return this.creditBalance;
});

// Generate refCode before saving if not provided
CustomerSchema.pre('save', async function (next) {
  if (!this.refCode) {
    // Generate a unique refCode (e.g., first 4 letters of name + random 4 chars)
    const namePart = this.name
      .replace(/\s+/g, '')
      .substring(0, 4)
      .toUpperCase();
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.refCode = `${namePart}${randomPart}`;
  }
  next();
});

const Customer = mongoose.models.Customer || mongoose.model<ICustomer>('Customer', CustomerSchema);

export default Customer;

