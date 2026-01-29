import mongoose, { Schema, Document } from 'mongoose';

export interface IFreeGiftRule extends Document {
  minCartValue: number;
  giftProductId: mongoose.Types.ObjectId;
  status: 'Active' | 'Inactive';
  createdAt: Date;
  updatedAt: Date;
}

const FreeGiftRuleSchema: Schema = new Schema(
  {
    minCartValue: { type: Number, required: true },
    giftProductId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  },
  { timestamps: true }
);

export default mongoose.model<IFreeGiftRule>('FreeGiftRule', FreeGiftRuleSchema);
