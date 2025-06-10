import mongoose from 'mongoose';

const videoSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,

  hlsFolder: { type: String, required: true },         // Stores HLS video folder ID
  thumbnailPath: { type: String },                     // Relative path to the thumbnail image
  duration: { type: Number },                          // Duration in seconds
  resolution: { type: String },                        // e.g., '1920x1080'
  bitrate: { type: Number },                           // In bits per second
  codec: { type: String },                             // e.g., 'h264'

  availableQualities: [String],                        // ['360p', '480p', '720p', '1080p']

  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  viewCount: { type: Number, default: 0 },
  viewedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  dislikes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  reports: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: {
      type: String,
      enum: ['spam', 'hate_speech', 'misinformation', 'other', 'copyright'],
      default: 'other'
    },
    timestamp: { type: Date, default: Date.now }
  }],

  comments: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    comment: String,
    timestamp: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

videoSchema.index({ title: 'text', description: 'text' });

export default mongoose.model('Video', videoSchema);
