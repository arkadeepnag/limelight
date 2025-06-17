import express from 'express';
import multer from 'multer';
import path from 'path';
const Video = (await import('../models/Video.js')).default;
import { authenticate } from '../middleware/authMiddleware.js';
import fs from 'fs-extra';
import {
  getAllVideos,
  getSuggestedVideos,
  getVideoById,
  uploadVideo,
  deleteVideo,
  likeVideo,
  dislikeVideo,
  addComment,
  reportVideo,
  getCommentsForVideo,
  watchVideo,
  Search
} from '../controllers/videoController.js';

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    console.log(`📁 Saving "${file.originalname}" to uploads/`);
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + path.extname(file.originalname);
    console.log(`📝 Naming file: ${file.originalname} -> ${uniqueName}`);
    cb(null, uniqueName);
  }
});

// ✅ File type filter (optional but recommended)
const fileFilter = (req, file, cb) => {
  console.log(`🔎 File received: ${file.fieldname} - ${file.originalname}`);
  const allowedTypes = ['video/mp4', 'video/mkv', 'video/avi', 'image/jpeg', 'image/png'];
  if (!allowedTypes.includes(file.mimetype)) {
    const errorMsg = `❌ File type not allowed: ${file.mimetype}`;
    console.error(errorMsg);
    return cb(new Error(errorMsg), false);
  }
  cb(null, true);
};

// ✅ Set limits if needed (e.g., 1GB max size)
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 1 * 1024 * 1024 * 1024 }, // 1 GB
});

router.get('/', getAllVideos);
router.get('/suggested', getSuggestedVideos);
router.get('/:id', getVideoById);
router.post(
  '/upload',
  authenticate,
  (req, res, next) => {
    console.log("Hellop")
    const uploader = upload.fields([
      { name: 'video', maxCount: 1 },
      { name: 'thumbnail', maxCount: 1 },
    ]);
    uploader(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        console.error(`📦 Multer error: ${err.message}`);
        return res.status(400).json({ success: false, message: `Multer error: ${err.message}` });
      } else if (err) {
        console.error(`🔥 Upload error: ${err.message}`);
        return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
      }
      console.log('✅ Multer completed successfully');
      next();
    });
  },
  uploadVideo
);
router.delete('/:id', authenticate, deleteVideo);
router.post('/:id/like', authenticate, likeVideo);
router.post('/:id/dislike', authenticate, dislikeVideo);
router.post('/:id/comment', authenticate, addComment);
router.post('/:id/report', authenticate, reportVideo);
router.get('/:id/comments', authenticate, getCommentsForVideo);
router.post('/:id/watch', authenticate, watchVideo);
router.get('/:id/comments', getCommentsForVideo);

router.get('/:videoId/master.m3u8', async (req, res) => {
  const { videoId } = req.params;
  console.log
  try {
    const video = await Video.findById(videoId).lean();

    if (!video || !video.hlsFolder) {
      console.log("No")
      return res.status(404).send('Video not found');
    }

    const filePath = path.join('uploads', 'hls', video.hlsFolder, 'master.m3u8');
    if (!fs.existsSync(filePath)) return res.status(404).send('Playlist not found');

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

router.get('/:videoId/:quality/:segment', async (req, res) => {
  const { videoId, quality, segment } = req.params;

  try {
    const video = await Video.findById(videoId).lean();
    if (!video || !video.hlsFolder) return res.status(404).send('Video not found');

    const filePath = path.join('uploads', 'hls', video.hlsFolder, quality, segment);
    if (!fs.existsSync(filePath)) return res.status(404).send('Segment not found');

    res.setHeader('Content-Type', 'video/MP2T');
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

export default router;