import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server as SocketIOServer } from 'socket.io';
import { connectDB } from './models/index.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import callRoutes from './routes/calls.js';
import { registerCallingSocket } from './socket/registerCallingSocket.js';

const app = express();
const server = http.createServer(app);
const allowedOrigins = process.env.CLIENT_URL?.split(',').map((x) => x.trim()).filter(Boolean) || true;
const io = new SocketIOServer(server, {
  cors: { origin: allowedOrigins, credentials: true },
  transports: ['websocket', 'polling'],
});

app.set('io', io);
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, app: 'user-dial-calling' }));
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/calls', callRoutes);

registerCallingSocket(io);

app.use((err, _req, res, _next) => {
  console.error(err);
  if (res.headersSent) return;
  res.status(err.status || 500).json({ message: err.message || 'Server error' });
});

const PORT = process.env.PORT || 5000;
connectDB().then(() => {
  server.listen(PORT, () => console.log(`User dial calling API running on ${PORT}`));
});
