import mongoose, { Schema, Document } from 'mongoose';

export type FreeGiftRuleType = 'free_gift' | 'discount';
export type FreeGiftDiscountType = 'fixed' | 'percentage';

export interface IFreeGiftRule extends Document {
  minCartValue: number;
  ruleType: FreeGiftRuleType;
  giftProductId?: mongoose.Types.ObjectId;
  discountType?: FreeGiftDiscountType;
  discountValue?: number;
  status: 'Active' | 'Inactive';
  createdAt: Date;
  updatedAt: Date;
}

const FreeGiftRuleSchema: Schema = new Schema(
  {
    minCartValue: { type: Number, required: true },
    ruleType: {
      type: String,
      enum: ['free_gift', 'discount'],
      default: 'free_gift',
    },
    giftProductId: { type: Schema.Types.ObjectId, ref: 'Product' },
    discountType: { type: String, enum: ['fixed', 'percentage'] },
    discountValue: { type: Number, min: 0 },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  },
  { timestamps: true }
);

export default mongoose.model<IFreeGiftRule>('FreeGiftRule', FreeGiftRuleSchema);
