import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import CallRoom from '../models/CallRoom.js';

async function authenticateSocket(socket, next) {
  try {
    const token = String(socket.handshake.auth?.token || '').replace('Bearer ', '');
    if (!token) return next(new Error('Login required'));
    if (!process.env.JWT_SECRET) return next(new Error('JWT_SECRET is missing'));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return next(new Error('Invalid login'));
    socket.user = user;
    next();
  } catch {
    next(new Error('Invalid socket token'));
  }
}

async function canJoinRoom(userId, roomId) {
  const room = await CallRoom.findOne({
    roomId,
    $or: [{ caller: userId }, { receiver: userId }],
  }).populate('caller', 'name email dialNumber').populate('receiver', 'name email dialNumber');
  if (!room) return { allowed: false };
  const role = String(room.caller._id) === String(userId) ? 'caller' : 'receiver';
  return { allowed: true, room, role };
}

export function registerCallingSocket(io) {
  io.use(authenticateSocket);

  io.on('connection', async (socket) => {
    const user = socket.user;
    socket.join(`user:${user._id}`);
    await User.findByIdAndUpdate(user._id, { $set: { isOnline: true, lastSeenAt: new Date() } });

    socket.on('call:join', async ({ roomId } = {}, ack) => {
      try {
        const check = await canJoinRoom(user._id, String(roomId || ''));
        if (!check.allowed) throw new Error('You cannot join this call');
        socket.join(`call:${roomId}`);
        socket.callRoomId = roomId;
        socket.callRole = check.role;
        socket.to(`call:${roomId}`).emit('call:peer-joined', { userId: user._id.toString(), role: check.role });
        ack?.({ ok: true, role: check.role, room: check.room });
      } catch (error) {
        ack?.({ ok: false, message: error.message || 'Call join failed' });
      }
    });

    socket.on('call:signal', async ({ roomId = '', type = '', payload = {} } = {}, ack) => {
      try {
        const check = await canJoinRoom(user._id, String(roomId));
        if (!check.allowed) throw new Error('You cannot signal this call');
        if (!['offer', 'answer', 'candidate', 'leave'].includes(type)) throw new Error('Invalid signal type');
        socket.to(`call:${roomId}`).emit('call:signal', { from: user._id.toString(), role: check.role, type, payload });
        ack?.({ ok: true });
      } catch (error) {
        ack?.({ ok: false, message: error.message || 'Signal failed' });
      }
    });

    socket.on('call:end', async ({ roomId = '' } = {}, ack) => {
      try {
        const check = await canJoinRoom(user._id, String(roomId));
        if (!check.allowed) throw new Error('You cannot end this call');
        await CallRoom.findOneAndUpdate({ roomId }, { $set: { status: 'ended', endedAt: new Date() } });
        io.to(`call:${roomId}`).emit('call:ended', { roomId, status: 'ended' });
        ack?.({ ok: true });
      } catch (error) {
        ack?.({ ok: false, message: error.message || 'End call failed' });
      }
    });

    socket.on('disconnect', async () => {
      await User.findByIdAndUpdate(user._id, { $set: { isOnline: false, lastSeenAt: new Date() } });
      if (socket.callRoomId) {
        socket.to(`call:${socket.callRoomId}`).emit('call:peer-left', { roomId: socket.callRoomId, userId: user._id.toString() });
      }
    });
  });
}
