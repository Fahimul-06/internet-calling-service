import express from 'express';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.get('/lookup/:dialNumber', requireAuth, async (req, res) => {
  const dialNumber = String(req.params.dialNumber || '').replace(/\D/g, '');
  if (dialNumber.length !== 6) return res.status(400).json({ message: 'Enter a valid 6-digit number' });
  const user = await User.findOne({ dialNumber }).select('name email dialNumber isOnline lastSeenAt');
  if (!user) return res.status(404).json({ message: 'No user found with this number' });
  if (String(user._id) === String(req.user._id)) return res.status(400).json({ message: 'You cannot call your own number' });
  res.json({ user });
});

export default router;
