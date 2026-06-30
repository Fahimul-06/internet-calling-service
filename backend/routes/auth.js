import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

function signToken(user) {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is missing');
  return jwt.sign({ id: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

async function generateUniqueDialNumber() {
  for (let i = 0; i < 60; i += 1) {
    const number = String(Math.floor(100000 + Math.random() * 900000));
    const exists = await User.exists({ dialNumber: number });
    if (!exists) return number;
  }
  throw new Error('Could not generate a unique dial number. Please try again.');
}

function publicUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    dialNumber: user.dialNumber,
    isOnline: user.isOnline,
    lastSeenAt: user.lastSeenAt,
  };
}

router.post('/signup', async (req, res, next) => {
  try {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!name) return res.status(400).json({ message: 'Name is required' });
    if (!email || !email.includes('@')) return res.status(400).json({ message: 'Valid email is required' });
    if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ message: 'This email is already registered' });

    const passwordHash = await bcrypt.hash(password, 12);
    const dialNumber = await generateUniqueDialNumber();
    const user = await User.create({ name, email, passwordHash, dialNumber });
    const token = signToken(user);
    res.status(201).json({ token, user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'Invalid email or password' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: 'Invalid email or password' });
    const token = signToken(user);
    res.json({ token, user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

export default router;
