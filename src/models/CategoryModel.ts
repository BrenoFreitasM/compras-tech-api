import mongoose, { Document, Schema } from 'mongoose';

export interface ICategory extends Document {
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>({
  name: { type: String, required: true, unique: true },
}, {
  timestamps: true // Automatically adds createdAt and updatedAt
});

export const CategoryModel = mongoose.model<ICategory>('Category', CategorySchema);
