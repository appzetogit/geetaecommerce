import mongoose, { Schema, Document } from 'mongoose';

export interface IHeaderCategory extends Document {
    name: string;
    iconLibrary: string;
    iconName: string;
    image?: string; // Optional image URL
    slug: string;
    theme: string; // Theme key for color mapping
    relatedCategory?: string; // Links to a product category
    order: number;
    status: 'Published' | 'Unpublished';
    createdAt: Date;
    updatedAt: Date;
}

const HeaderCategorySchema: Schema = new Schema(
    {
        name: { type: String, required: true },
        iconLibrary: { type: String, required: true },
        iconName: { type: String, required: true },
        image: { type: String, required: false }, // New field for optional image
        slug: { type: String, required: true, unique: true },
        theme: { type: String, required: true },
        relatedCategory: { type: String, required: false },
        order: { type: Number, default: 0 },
        status: { type: String, enum: ['Published', 'Unpublished'], default: 'Published' },
    },
    { timestamps: true }
);

export default mongoose.model<IHeaderCategory>('HeaderCategory', HeaderCategorySchema);
