import mongoose from 'mongoose';
import { toJSON } from './index.js';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  passwordHash: { type: String, required: true },
  dialNumber: { type: String, required: true, unique: true, index: true, minlength: 6, maxlength: 6 },
  isOnline: { type: Boolean, default: false },
  lastSeenAt: { type: Date, default: Date.now },
}, { timestamps: true });

toJSON(userSchema);
export default mongoose.models.User || mongoose.model('User', userSchema);
