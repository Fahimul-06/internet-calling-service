# User Dial Calling App

A clean user-to-user internet calling module. The old admin/customer/delivery-man support system has been removed.

## Features

- User signup and login
- Auto-generated unique 6-digit calling number after signup
- Dashboard showing the user's own calling number
- Search another user by 6-digit number
- Start a call by dialing that number
- Incoming call popup with Accept / Reject
- Browser audio call using WebRTC + Socket.IO signaling
- MongoDB user and call-room storage

## Project structure

```txt
backend/
  server.js
  models/User.js
  models/CallRoom.js
  routes/auth.js
  routes/users.js
  routes/calls.js
  socket/registerCallingSocket.js
frontend/
  src/pages/LoginPage.tsx
  src/pages/SignupPage.tsx
  src/pages/DashboardPage.tsx
  src/pages/CallPage.tsx
```

## Backend setup

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Required backend `.env`:

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_long_secret
CLIENT_URL=http://localhost:5173
```

## Frontend setup

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Required frontend `.env`:

```env
VITE_API_URL=http://localhost:5000/api
```

Optional TURN config for real-world mobile/strict NAT networks:

```env
VITE_TURN_URLS=turn:your-turn-domain.com:3478
VITE_TURN_USERNAME=username
VITE_TURN_CREDENTIAL=password
```

## How calling works

1. User A signs up and receives a 6-digit number.
2. User B signs up and receives another 6-digit number.
3. User B enters User A's number in the dashboard.
4. User B clicks Call.
5. User A receives an incoming call popup.
6. User A accepts.
7. Both users enter the call page and WebRTC audio starts.

## Important production note

Direct WebRTC with STUN works on many networks, but not all. For stable production calling on mobile networks, CGNAT, office Wi-Fi, or strict NAT, configure a TURN server such as coturn.
