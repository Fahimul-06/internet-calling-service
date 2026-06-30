import { FormEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Copy, LogOut, PhoneCall, Search } from 'lucide-react';
import { api, CallRoom, clearSession, getSessionUser, setSession, User } from '../lib/api';
import { closeSocket, getSocket } from '../lib/socket';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [me, setMe] = useState<User | null>(getSessionUser());
  const [dialNumber, setDialNumber] = useState('');
  const [foundUser, setFoundUser] = useState<User | null>(null);
  const [incoming, setIncoming] = useState<CallRoom | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get<{ user: User }>('/auth/me').then((data) => {
      setMe(data.user);
      const token = localStorage.getItem('dialCallToken');
      if (token) setSession(token, data.user);
    }).catch(() => logout());

    const socket = getSocket();
    socket?.on('call:incoming', ({ room }: { room: CallRoom }) => setIncoming(room));
    socket?.on('call:room', ({ room }: { room: CallRoom }) => {
      if (room.status === 'accepted') navigate(`/call/${room.roomId}`);
    });
    return () => {
      socket?.off('call:incoming');
      socket?.off('call:room');
    };
  }, []);

  function logout() {
    closeSocket();
    clearSession();
    navigate('/login');
  }

  async function lookup(e: FormEvent) {
    e.preventDefault();
    setFoundUser(null);
    setMessage('');
    const cleaned = dialNumber.replace(/\D/g, '');
    if (cleaned.length !== 6) return setMessage('Enter a valid 6-digit number.');
    setLoading(true);
    try {
      const data = await api.get<{ user: User }>(`/users/lookup/${cleaned}`);
      setFoundUser(data.user);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'User not found');
    } finally {
      setLoading(false);
    }
  }

  async function dial() {
    setLoading(true);
    setMessage('');
    try {
      const data = await api.post<{ room: CallRoom }>('/calls/dial', { dialNumber: foundUser?.dialNumber || dialNumber });
      navigate(`/call/${data.room.roomId}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Call failed');
    } finally {
      setLoading(false);
    }
  }

  async function acceptIncoming() {
    if (!incoming) return;
    await api.patch(`/calls/${incoming.roomId}/status`, { status: 'accepted' });
    navigate(`/call/${incoming.roomId}`);
  }

  async function rejectIncoming() {
    if (!incoming) return;
    await api.patch(`/calls/${incoming.roomId}/status`, { status: 'rejected' });
    setIncoming(null);
  }

  return (
    <main className="dashboard-screen">
      <header className="topbar">
        <div>
          <h1>DialCall</h1>
          <p>Call users by 6-digit number</p>
        </div>
        <button className="ghost" onClick={logout}><LogOut size={18} /> Logout</button>
      </header>

      {incoming && (
        <section className="incoming-card">
          <div>
            <strong>Incoming call</strong>
            <p>{incoming.peer.name} is calling you from {incoming.peer.dialNumber}</p>
          </div>
          <div className="row">
            <button className="danger" onClick={rejectIncoming}>Reject</button>
            <button onClick={acceptIncoming}>Accept</button>
          </div>
        </section>
      )}

      <section className="grid">
        <div className="panel profile-panel">
          <h2>Your calling number</h2>
          <div className="my-number">{me?.dialNumber || '------'}</div>
          <p>Share this number with another user so they can call you.</p>
          <button className="secondary" onClick={() => me?.dialNumber && navigator.clipboard.writeText(me.dialNumber)}>
            <Copy size={18} /> Copy number
          </button>
          <hr />
          <p><b>Name:</b> {me?.name}</p>
          <p><b>Email:</b> {me?.email}</p>
        </div>

        <div className="panel dial-panel">
          <h2>Dial a user</h2>
          <form onSubmit={lookup} className="dial-form">
            <input
              inputMode="numeric"
              maxLength={6}
              placeholder="Enter 6-digit number"
              value={dialNumber}
              onChange={(e) => setDialNumber(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
            <button disabled={loading}><Search size={18} /> Find</button>
          </form>
          {message && <div className="error soft">{message}</div>}
          {foundUser && (
            <div className="found-user">
              <div>
                <strong>{foundUser.name}</strong>
                <p>{foundUser.dialNumber} {foundUser.isOnline ? '• Online' : '• Offline'}</p>
              </div>
              <button onClick={dial} disabled={loading}><PhoneCall size={18} /> Call</button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
