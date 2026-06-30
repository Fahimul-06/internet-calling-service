export function getRtcConfig(): RTCConfiguration {
  const urlsRaw = import.meta.env.VITE_TURN_URLS || '';
  const username = import.meta.env.VITE_TURN_USERNAME || '';
  const credential = import.meta.env.VITE_TURN_CREDENTIAL || '';
  const iceServers: RTCIceServer[] = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ];
  const urls = urlsRaw.split(',').map((x: string) => x.trim()).filter(Boolean);
  if (urls.length) iceServers.push({ urls, username, credential });
  return { iceServers, iceTransportPolicy: 'all', bundlePolicy: 'balanced' };
}
