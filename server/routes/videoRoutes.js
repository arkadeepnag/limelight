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
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});

const upload = multer({ storage });

router.get('/', getAllVideos);
router.get('/suggested', getSuggestedVideos);
router.get('/:id', getVideoById);
router.post(
  '/upload',
  authenticate,
  upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 }
  ]),
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