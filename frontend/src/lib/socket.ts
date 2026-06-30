import { io, Socket } from 'socket.io-client';
import { SOCKET_BASE_URL, getToken } from './api';

let socket: Socket | null = null;

export function getSocket() {
  const token = getToken();
  if (!token) return null;
  if (socket?.connected) return socket;
  socket = io(SOCKET_BASE_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    autoConnect: true,
  });
  return socket;
}

export function closeSocket() {
  socket?.disconnect();
  socket = null;
}
