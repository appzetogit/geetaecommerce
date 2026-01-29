import mongoose, { Schema, Document } from 'mongoose';

export interface IVideoFind extends Document {
  title: string;
  price: number;
  originalPrice: number;
  videoUrl: string;
  views: string;
  likes: mongoose.Types.ObjectId[];
  shares: number;
  linkedProduct: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const VideoFindSchema: Schema = new Schema(
  {
    title: { type: String, required: true },
    price: { type: Number, required: true },
    originalPrice: { type: Number, required: true },
    videoUrl: { type: String, required: true },
    views: { type: String, default: '0' },
    likes: [{ type: Schema.Types.ObjectId, ref: 'Customer', default: [] }],
    shares: { type: Number, default: 0 },
    linkedProduct: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  },
  { timestamps: true }
);

export default mongoose.model<IVideoFind>('VideoFind', VideoFindSchema);
