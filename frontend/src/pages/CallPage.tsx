import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Mic, MicOff, PhoneOff } from 'lucide-react';
import { api, CallRoom } from '../lib/api';
import { getSocket } from '../lib/socket';
import { getRtcConfig } from '../lib/webrtc';

export default function CallPage() {
  const { roomId = '' } = useParams();
  const navigate = useNavigate();
  const [room, setRoom] = useState<CallRoom | null>(null);
  const [status, setStatus] = useState('Connecting...');
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState('');
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const madeOfferRef = useRef(false);
  const roleRef = useRef<'caller' | 'receiver' | null>(null);

  useEffect(() => {
    let closed = false;
    const socket = getSocket();
    if (!socket) {
      navigate('/login');
      return;
    }
    const activeSocket = socket;

    async function start() {
      try {
        const data = await api.get<{ room: CallRoom }>(`/calls/${roomId}`);
        if (closed) return;
        setRoom(data.room);
        roleRef.current = data.room.role;
        if (data.room.status === 'ringing' && data.room.role === 'receiver') {
          await api.patch(`/calls/${roomId}/status`, { status: 'accepted' });
        }

        const localStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
        localStreamRef.current = localStream;

        const pc = new RTCPeerConnection(getRtcConfig());
        pcRef.current = pc;
        localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

        pc.onicecandidate = (event) => {
          if (event.candidate) activeSocket.emit('call:signal', { roomId, type: 'candidate', payload: event.candidate });
        };
        pc.ontrack = (event) => {
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = event.streams[0];
            remoteAudioRef.current.play().catch(() => {});
          }
        };
        pc.onconnectionstatechange = () => {
          const state = pc.connectionState;
          if (state === 'connected') setStatus('Connected');
          if (state === 'connecting') setStatus('Connecting...');
          if (state === 'failed') setStatus('Connection failed. Add TURN server for strict NAT/mobile networks.');
          if (state === 'disconnected') setStatus('Peer disconnected');
          if (state === 'closed') setStatus('Call ended');
        };

        activeSocket.emit('call:join', { roomId }, (ack: { ok: boolean; message?: string }) => {
          if (!ack?.ok) setError(ack?.message || 'Could not join call');
          else setStatus(data.room.role === 'caller' ? 'Ringing...' : 'Joining call...');
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not start call');
      }
    }

    async function handleSignal(signal: { type: string; payload: any }) {
      const pc = pcRef.current;
      if (!pc) return;
      try {
        if (signal.type === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.payload));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          activeSocket.emit('call:signal', { roomId, type: 'answer', payload: answer });
        }
        if (signal.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.payload));
        }
        if (signal.type === 'candidate' && signal.payload) {
          await pc.addIceCandidate(new RTCIceCandidate(signal.payload));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'WebRTC signal failed');
      }
    }

    async function createOfferWhenReady() {
      const pc = pcRef.current;
      if (!pc || roleRef.current !== 'caller' || madeOfferRef.current) return;
      madeOfferRef.current = true;
      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);
      activeSocket.emit('call:signal', { roomId, type: 'offer', payload: offer });
      setStatus('Connecting...');
    }

    activeSocket.on('call:signal', handleSignal);
    activeSocket.on('call:peer-joined', createOfferWhenReady);
    activeSocket.on('call:ended', () => endLocal(false));
    activeSocket.on('call:peer-left', () => setStatus('Peer left the call'));
    start();

    return () => {
      closed = true;
      activeSocket.off('call:signal', handleSignal);
      activeSocket.off('call:peer-joined', createOfferWhenReady);
      activeSocket.off('call:ended');
      activeSocket.off('call:peer-left');
      endLocal(false);
    };
  }, [roomId]);

  function endLocal(goBack = true) {
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    if (goBack) navigate('/dashboard');
  }

  async function endCall() {
    const socket = getSocket();
    socket?.emit('call:end', { roomId });
    try { await api.patch(`/calls/${roomId}/status`, { status: 'ended' }); } catch {}
    endLocal(true);
  }

  function toggleMute() {
    const next = !muted;
    localStreamRef.current?.getAudioTracks().forEach((track) => { track.enabled = !next; });
    setMuted(next);
  }

  return (
    <main className="call-screen">
      <audio ref={remoteAudioRef} autoPlay playsInline />
      <section className="call-card">
        <div className="avatar">{room?.peer?.name?.slice(0, 1).toUpperCase() || '?'}</div>
        <h1>{room?.peer?.name || 'Calling user'}</h1>
        <p className="dial-text">{room?.peer?.dialNumber}</p>
        <p className="status-text">{error || status}</p>
        <div className="call-actions">
          <button className="round secondary" onClick={toggleMute}>{muted ? <MicOff /> : <Mic />}</button>
          <button className="round danger" onClick={endCall}><PhoneOff /></button>
        </div>
        <p className="hint">For best real-world calling, configure TURN in frontend .env.</p>
      </section>
    </main>
  );
}
