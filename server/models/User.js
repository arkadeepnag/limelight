import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: String,
  username: String,
  email: String,
  passwordHash: String,
  createdAt: { type: Date, default: Date.now },

  // Profile-related
  profilePicture: {
    type: String,
    default: 'https://cdn-icons-png.flaticon.com/512/149/149071.png'
    // Generic round avatar placeholder
  },
  banner: {
    type: String,
    default: 'https://images.pexels.com/photos/1492364/pexels-photo-1492364.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2'
  },
  location: {
    type: String,
    default: ''
  },
  about: {
    type: String,
    default: ''
  },
  links: [{
    title: String,
    url: String
  }],

  // Subscriptions
  subscribers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  subscriptions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // Watch History
  watchHistory: [{
    video: { type: mongoose.Schema.Types.ObjectId, ref: 'Video' },
    watchedAt: { type: Date, default: Date.now }
  }]
});

export default mongoose.model('User', userSchema);
