import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcrypt';

export interface IDelivery extends Document {
  // Personal Information
  name: string;
  mobile: string;
  email: string;
  dateOfBirth?: Date;
  password: string;
  address: string;
  city: string;
  pincode?: string;
  fcmToken?: string;
  fcmTokenMobile?: string;

  // Documents (URLs pointing to cloud storage)
  drivingLicense?: string;
  nationalIdentityCard?: string;

  // Bank Account Information
  accountName?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;

  // Vehicle Information
  vehicleNumber?: string;
  vehicleType?: string;

  // Commission & Payment
  bonusType?: string; // 'Fixed' | 'Salaried' | 'Commission Based'
  status: 'Active' | 'Inactive';
  isOnline: boolean; // Availability status
  location?: {
    type: "Point";
    coordinates: [number, number]; // [longitude, latitude]
  };
  balance: number;
  cashCollected: number;
  settings: {
    notifications: boolean;
    location: boolean;
    sound: boolean;
  };

  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const DeliverySchema = new Schema<IDelivery>(
  {
    // Personal Information
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    mobile: {
      type: String,
      required: [true, 'Mobile number is required'],
      unique: true,
      trim: true,
      validate: {
        validator: function (v: string) {
          return /^[0-9]{10}$/.test(v);
        },
        message: 'Mobile number must be 10 digits',
      },
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
    dateOfBirth: {
      type: Date,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // Don't return password by default
    },
    address: {
      type: String,
      required: [true, 'Address is required'],
      trim: true,
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
    },
    pincode: {
      type: String,
      trim: true,
    },
    fcmToken: {
      type: String,
      default: null,
    },
    fcmTokenMobile: {
      type: String,
      default: null,
    },

    // Documents (URLs)
    drivingLicense: {
      type: String,
      trim: true,
    },
    nationalIdentityCard: {
      type: String,
      trim: true,
    },

    // Bank Account Information
    accountName: {
      type: String,
      trim: true,
    },
    bankName: {
      type: String,
      trim: true,
    },
    accountNumber: {
      type: String,
      trim: true,
    },
    ifscCode: {
      type: String,
      trim: true,
    },

    // Vehicle Information
    vehicleNumber: {
      type: String,
      trim: true,
    },
    vehicleType: {
      type: String,
      trim: true,
    },

    // Commission & Payment
    bonusType: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive'],
      default: 'Inactive', // New delivery partners start as Inactive until approved
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        index: "2dsphere",
      },
    },
    balance: {
      type: Number,
      default: 0,
      min: [0, 'Balance cannot be negative'],
    },
    cashCollected: {
      type: Number,
      default: 0,
      min: [0, 'Cash collected cannot be negative'],
    },
    settings: {
      notifications: { type: Boolean, default: true },
      location: { type: Boolean, default: true },
      sound: { type: Boolean, default: true }
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
DeliverySchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Method to compare password
DeliverySchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

const Delivery = mongoose.model<IDelivery>('Delivery', DeliverySchema);

export default Delivery;

