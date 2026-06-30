import express from 'express';
import crypto from 'crypto';
import User from '../models/User.js';
import CallRoom from '../models/CallRoom.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

function roomPayload(room, currentUserId) {
  const caller = room.caller;
  const receiver = room.receiver;
  const isCaller = String(caller._id || caller) === String(currentUserId);
  const peer = isCaller ? receiver : caller;
  return {
    roomId: room.roomId,
    status: room.status,
    role: isCaller ? 'caller' : 'receiver',
    peer,
    caller,
    receiver,
    startedAt: room.startedAt,
    endedAt: room.endedAt,
    createdAt: room.createdAt,
  };
}

async function getUserRoom(roomId, userId) {
  return CallRoom.findOne({
    roomId,
    $or: [{ caller: userId }, { receiver: userId }],
  }).populate('caller', 'name email dialNumber isOnline lastSeenAt').populate('receiver', 'name email dialNumber isOnline lastSeenAt');
}

router.post('/dial', requireAuth, async (req, res) => {
  const dialNumber = String(req.body?.dialNumber || '').replace(/\D/g, '');
  if (dialNumber.length !== 6) return res.status(400).json({ message: 'Enter a valid 6-digit number' });
  const receiver = await User.findOne({ dialNumber });
  if (!receiver) return res.status(404).json({ message: 'No user found with this number' });
  if (String(receiver._id) === String(req.user._id)) return res.status(400).json({ message: 'You cannot call yourself' });

  const room = await CallRoom.create({
    roomId: crypto.randomUUID(),
    caller: req.user._id,
    receiver: receiver._id,
    status: 'ringing',
  });

  const populated = await getUserRoom(room.roomId, req.user._id);
  const io = req.app.get('io');
  io?.to(`user:${receiver._id}`).emit('call:incoming', { room: roomPayload(populated, receiver._id) });
  io?.to(`user:${req.user._id}`).emit('call:room', { room: roomPayload(populated, req.user._id) });
  res.status(201).json({ room: roomPayload(populated, req.user._id) });
});

router.get('/:roomId', requireAuth, async (req, res) => {
  const room = await getUserRoom(req.params.roomId, req.user._id);
  if (!room) return res.status(404).json({ message: 'Call room not found' });
  res.json({ room: roomPayload(room, req.user._id) });
});

router.patch('/:roomId/status', requireAuth, async (req, res) => {
  const status = String(req.body?.status || '').trim();
  if (!['accepted', 'rejected', 'missed', 'ended'].includes(status)) {
    return res.status(400).json({ message: 'Invalid call status' });
  }

  const room = await getUserRoom(req.params.roomId, req.user._id);
  if (!room) return res.status(404).json({ message: 'Call room not found' });

  const patch = { status };
  if (status === 'accepted') patch.startedAt = new Date();
  if (status === 'ended' || status === 'rejected' || status === 'missed') patch.endedAt = new Date();

  const updated = await CallRoom.findOneAndUpdate({ roomId: room.roomId }, { $set: patch }, { new: true })
    .populate('caller', 'name email dialNumber isOnline lastSeenAt')
    .populate('receiver', 'name email dialNumber isOnline lastSeenAt');

  const io = req.app.get('io');
  io?.to(`call:${room.roomId}`).emit('call:room', { room: roomPayload(updated, req.user._id) });
  io?.to(`user:${updated.caller._id}`).emit('call:room', { room: roomPayload(updated, updated.caller._id) });
  io?.to(`user:${updated.receiver._id}`).emit('call:room', { room: roomPayload(updated, updated.receiver._id) });
  if (status === 'ended' || status === 'rejected' || status === 'missed') {
    io?.to(`call:${room.roomId}`).emit('call:ended', { roomId: room.roomId, status });
  }

  res.json({ room: roomPayload(updated, req.user._id) });
});

export default router;
