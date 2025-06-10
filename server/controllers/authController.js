import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const register = async (req, res) => {
  try {
    const { username, email, password, name = '', location = '', about = '' } = req.body;

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'User already exists' });

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      username,
      email,
      passwordHash,
      name,
      location,
      about
    });

    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error during registration' });
  }
};
export const login = async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });

  console.log('Login attempt for:', email);

  if (!user) {
    console.log('User not found');
    return res.status(400).json({ message: 'Invalid email' });
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  console.log('Password match:', match);
  if (!match) return res.status(400).json({ message: 'Invalid password' });

  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });

  res.json({ token, _id: user._id });
};
