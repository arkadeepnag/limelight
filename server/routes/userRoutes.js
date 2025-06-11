import express from 'express';
import { subscribeToUser, unsubscribeFromUser, updateProfileImages } from '../controllers/userController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import User from '../models/User.js';
import mongoose from 'mongoose';
import Video from '../models/Video.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// POST /api/users/subscribe
router.post('/subscribe', authenticate, subscribeToUser);
router.post('/unsubscribe', authenticate, unsubscribeFromUser);

// Ensure upload directories exist
const profileDir = 'uploads/profile';
const bannerDir = 'uploads/banner';
if (!fs.existsSync(profileDir)) fs.mkdirSync(profileDir, { recursive: true });
if (!fs.existsSync(bannerDir)) fs.mkdirSync(bannerDir, { recursive: true });

// Set up Multer storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const isProfile = file.fieldname === 'profilePicture';
        cb(null, isProfile ? profileDir : bannerDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const uniqueName = `${file.fieldname}-${Date.now()}${ext}`;
        cb(null, uniqueName);
    }
});

const upload = multer({ storage });

// Route with multer, auth, and controller
router.post(
    '/update-profile-images',
    authenticate,
    upload.fields([
        { name: 'profilePicture', maxCount: 1 },
        { name: 'banner', maxCount: 1 }
    ]),
    updateProfileImages
);
router.get('/:id', authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .select('-passwordHash') // Exclude password hash for security
            .populate({
                path: 'subscribers', // Populate the subscribers field
                // You might only need the count, or minimal info for display
                select: 'username profilePicture' // Example: populate username and profile pic of subscribers
            })
            .lean(); // Use .lean() for faster query if you don't need Mongoose document methods

        if (!user) return res.status(404).json({ message: 'User not found' });

        // If you only need the count of subscribers on the frontend,
        // you can calculate it here and potentially remove the full array:
        // user.subscriberCount = user.subscribers ? user.subscribers.length : 0;
        // delete user.subscribers; // To avoid sending a potentially large array of subscriber objects

        res.json(user);
    } catch (err) {
        console.error('Server error fetching user channel data:', err); // Log the actual error
        res.status(500).json({ message: 'Server error' });
    }
});
router.get('/videos/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        // Validate if userId is a valid MongoDB ObjectId (optional but recommended)
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: 'Invalid user ID format' });
        }

        // Find all videos where the 'uploadedBy' field matches the userId
        // We'll populate 'uploadedBy' to get the uploader's username and profile picture,
        // and only select relevant fields for the video list.
        const videos = await Video.find({ uploadedBy: userId })
            .select('title description thumbnailPath viewCount uploadedBy createdAt duration') // Select necessary fields
            .populate('uploadedBy', 'username profilePicture') // Populate uploader's username and profilePicture
            .sort({ createdAt: -1 }) // Sort by most recent videos first
            .lean(); // Use .lean() for faster execution if you don't need Mongoose document methods

        if (!videos || videos.length === 0) {
            return res.status(404).json({ message: 'No videos found for this user' });
        }

        res.json(videos);
    } catch (err) {
        console.error('Error fetching videos by user ID:', err);
        res.status(500).json({ message: 'Server error' });
    }
});


export default router;

