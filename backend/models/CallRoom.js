import mongoose from 'mongoose';
import { toJSON } from './index.js';

const callRoomSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true, index: true },
  caller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  status: { type: String, enum: ['ringing', 'accepted', 'rejected', 'missed', 'ended'], default: 'ringing', index: true },
  startedAt: Date,
  endedAt: Date,
}, { timestamps: true });

toJSON(callRoomSchema);
export default mongoose.models.CallRoom || mongoose.model('CallRoom', callRoomSchema);
