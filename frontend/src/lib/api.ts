const configuredApiUrl = import.meta.env.VITE_API_URL || '';
const configuredSocketUrl = import.meta.env.VITE_SOCKET_URL || '';

function normalizeBaseUrl(value: string, fallback: string) {
  const cleaned = (value || fallback).replace(/\/$/, '');
  return cleaned;
}

const rawApiBaseUrl = normalizeBaseUrl(configuredApiUrl, '/api');

export const API_BASE_URL = rawApiBaseUrl.endsWith('/api') ? rawApiBaseUrl : `${rawApiBaseUrl}/api`;
export const SOCKET_BASE_URL = normalizeBaseUrl(
  configuredSocketUrl || rawApiBaseUrl.replace(/\/api$/, ''),
  window.location.origin,
);

export type User = {
  id: string;
  name: string;
  email: string;
  dialNumber: string;
  isOnline?: boolean;
  lastSeenAt?: string;
};

export type CallRoom = {
  roomId: string;
  status: 'ringing' | 'accepted' | 'rejected' | 'missed' | 'ended';
  role: 'caller' | 'receiver';
  peer: User;
  caller: User;
  receiver: User;
  startedAt?: string;
  endedAt?: string;
  createdAt?: string;
};

export function getToken() {
  return localStorage.getItem('dialCallToken');
}

export function getSessionUser(): User | null {
  const raw = localStorage.getItem('dialCallUser');
  if (!raw) return null;
  try { return JSON.parse(raw) as User; } catch { return null; }
}

export function setSession(token: string, user: User) {
  localStorage.setItem('dialCallToken', token);
  localStorage.setItem('dialCallUser', JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem('dialCallToken');
  localStorage.removeItem('dialCallUser');
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  } catch {
    throw new Error('Could not connect to backend. Check VITE_API_URL and backend server.');
  }
  const text = await res.text();
  const payload = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(payload?.message || `Request failed with status ${res.status}`);
  return payload as T;
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) }),
};
