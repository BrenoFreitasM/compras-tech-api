import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  name: string;
  activeSessionId: string | null;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  name: { type: String, required: true },
  activeSessionId: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
});

export const UserModel = mongoose.model<IUser>('User', UserSchema);
