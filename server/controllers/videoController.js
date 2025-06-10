const Video = (await import('../models/Video.js')).default;
const User = (await import('../models/User.js')).default;

import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import path from 'path';
import fs from 'fs-extra'; // For file system operations, e.g., deleting temp files

ffmpeg.setFfmpegPath(ffmpegStatic);
ffmpeg.setFfprobePath(ffprobeStatic.path);
export const getAllVideos = async (req, res) => {
  const videos = await Video.find()
    .populate('uploadedBy', 'name profilePicture subscribers')
    .lean(); // lean returns plain JS objects

  // Add subscriberCount to each video
  const videosWithSubCount = videos.map(video => {
    const subscriberCount = video.uploadedBy?.subscribers?.length || 0;
    return {
      ...video,
      uploadedBy: {
        ...video.uploadedBy,
        subscriberCount,
      }
    };
  });

  res.json(videosWithSubCount);
};

export const getSuggestedVideos = async (req, res) => {
  const videos = await Video.aggregate([
    { $sample: { size: 5 } }
  ]);

  // Since aggregate returns plain docs without population,
  // we need to populate uploadedBy here

  // Populate manually with mongoose
  await Video.populate(videos, { path: 'uploadedBy', select: 'name profilePicture subscribers' });

  // Add subscriberCount
  const videosWithSubCount = videos.map(video => {
    const subscriberCount = video.uploadedBy?.subscribers?.length || 0;
    return {
      ...video,
      uploadedBy: {
        ...video.uploadedBy,
        subscriberCount,
      }
    };
  });

  res.json(videosWithSubCount);
};
export const getAllComments = async (req, res) => {
  try {
    const skip = parseInt(req.query.skip) || 0;
    const limit = parseInt(req.query.limit) || 10;

    // First find video IDs that contain comments
    const videosWithComments = await Video.find(
      { comments: { $exists: true, $not: { $size: 0 } } }
    ).select('comments').populate('comments.user', 'name profilePicture');

    // Flatten all comments from all videos
    let allComments = videosWithComments.flatMap(video =>
      video.comments.map(comment => ({
        videoId: video._id,
        ...comment.toObject()
      }))
    );

    // Sort comments by timestamp (newest first)
    allComments = allComments.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Apply pagination
    const paginatedComments = allComments.slice(skip, skip + limit);

    res.json({
      comments: paginatedComments,
      total: allComments.length,
      hasMore: skip + limit < allComments.length
    });
  } catch (err) {
    console.error('Error fetching comments:', err);
    res.status(500).json({ message: 'Server Error' });
  }
};

export const incrementViewCount = async (req, res) => {
  try {
    const { id } = req.params;

    const updated = await Video.findByIdAndUpdate(
      id,
      { $inc: { viewCount: 1 } },
      { new: true }
    );

    if (!updated) return res.status(404).json({ message: 'Video not found' });

    res.json({ viewCount: updated.viewCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error incrementing view count' });
  }
};
export const getVideoById = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id)
      .populate('uploadedBy', 'name profilePicture subscribers'); // basic info

    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }

    // Get subscriber count
    const uploadedByUser = await User.findById(video.uploadedBy._id);
    const subscriberCount = uploadedByUser?.subscribers?.length || 0;

    // Combine video data and subscriber count
    const videoWithSubs = {
      ...video.toObject(),
      uploadedBy: {
        ...video.uploadedBy.toObject(),
        subscriberCount
      }
    };

    res.json(videoWithSubs);
    console.log(videoWithSubs)
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

const resolutions = {
  '360p': '640x360',
  '480p': '854x480',
  '720p': '1280x720',
  '1080p': '1920x1080',
};

export const uploadVideo = async (req, res) => {
  try {
    const { title, description } = req.body;
    const videoFile = req.files?.video?.[0];
    if (!videoFile) return res.status(400).json({ message: 'No video file uploaded' });

    const thumbnailFile = req.files?.thumbnail?.[0];
    const originalPath = videoFile.path;
    const videoId = Date.now().toString();
    const videoDir = path.join('uploads', 'hls', videoId);
    await fs.ensureDir(videoDir);

    // 🔁 HLS conversion (faster: remove redundant params, optimized for speed)
    const tasks = Object.entries(resolutions).map(([label, size]) => {
      return new Promise((resolve, reject) => {
        const resDir = path.join(videoDir, label);
        fs.ensureDirSync(resDir);
        ffmpeg(originalPath)
          .videoCodec('libx264')
          .audioCodec('aac')
          .size(size)
          .outputOptions([
            '-preset veryfast',
            '-g 48',
            '-sc_threshold 0',
            '-c:v libx264',
            '-c:a aac',
            '-ar 48000',
            `-vf scale=${size}`,
            '-crf 20',
            '-hls_time 4',
            '-hls_playlist_type vod',
            `-hls_segment_filename ${resDir}/%03d.ts`,
          ])
          .output(path.join(resDir, 'index.m3u8'))
          .on('end', resolve)
          .on('error', reject)
          .run();
      });
    });

    const hlsResults = await Promise.allSettled(tasks);
    const failed = hlsResults.filter(result => result.status === 'rejected');
    if (failed.length === resolutions.length) throw new Error('HLS encoding failed for all resolutions');

    // 📄 Master playlist
    const masterPlaylist = Object.keys(resolutions).map(label => {
      const bandwidth = {
        '360p': 800000,
        '480p': 1400000,
        '720p': 2800000,
        '1080p': 5000000,
      }[label];
      return `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${resolutions[label]}\n${label}/index.m3u8`;
    }).join('\n');

    const masterPlaylistPath = path.join(videoDir, 'master.m3u8');
    await fs.writeFile(masterPlaylistPath, '#EXTM3U\n' + masterPlaylist);

    // 📸 Thumbnail
    // 📸 Thumbnail
    const thumbnailDir = path.join('uploads', 'thumbnails');
    await fs.ensureDir(thumbnailDir);

    let thumbnailPath;
    if (thumbnailFile) {
      const ext = path.extname(thumbnailFile.originalname); // Keep original extension (.jpg, .png, etc.)
      thumbnailPath = path.join(thumbnailDir, `${videoId}${ext}`);
      await fs.move(thumbnailFile.path, thumbnailPath, { overwrite: true });
    } else {
      thumbnailPath = path.join(thumbnailDir, `${videoId}.jpg`);
      await new Promise((resolve, reject) => {
        ffmpeg(originalPath)
          .on('end', resolve)
          .on('error', reject)
          .screenshots({
            count: 1,
            filename: `${videoId}.jpg`,
            folder: thumbnailDir,
            size: '320x?'
          });
      });
    }


    // 🧠 Metadata extraction
    const metadata = await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(originalPath, (err, data) => {
        if (err) return reject(err);
        const videoStream = data.streams.find(s => s.codec_type === 'video');
        const duration = Number(data.format.duration);
        const bitrate = Number(videoStream?.bit_rate);

        resolve({
          duration: isNaN(duration) ? 0 : duration,
          codec: videoStream?.codec_name || 'unknown',
          bitrate: isNaN(bitrate) ? 0 : bitrate,
          resolution: videoStream?.width && videoStream?.height
            ? `${videoStream.width}x${videoStream.height}` : 'unknown',
        });
      });
    });

    // 💾 Save to DB
    const newVideo = new Video({
      title,
      description,
      hlsFolder: videoId,
      uploadedBy: req.userId,
      availableQualities: Object.keys(resolutions),
      thumbnailPath,
      duration: metadata.duration,
      codec: metadata.codec,
      bitrate: metadata.bitrate,
      resolution: metadata.resolution,
    });

    await newVideo.save();
    res.status(201).json(newVideo);

  } catch (error) {
    console.error('Upload failed:', error);
    res.status(500).json({ message: error.message || 'Upload failed' });
  }
};


// ... (deleteVideo - consider also deleting the video file and thumbnail from disk)
export const deleteVideo = async (req, res) => {
  try {
    const video = await Video.findById(req.params.id);
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }

    if (video.uploadedBy.toString() !== req.userId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Delete video file from disk
    const videoFilePath = path.join('uploads', video.videoPath);
    if (fs.existsSync(videoFilePath)) {
      fs.unlinkSync(videoFilePath);
    }

    // Delete thumbnail file from disk
    const thumbnailFilePath = path.join('uploads', video.thumbnailPath);
    if (fs.existsSync(thumbnailFilePath)) {
      fs.unlinkSync(thumbnailFilePath);
    }

    await video.deleteOne();
    res.json({ message: 'Video and associated files deleted successfully' });
  } catch (error) {
    console.error('Error deleting video:', error);
    res.status(500).json({ message: 'Failed to delete video.' });
  }
};
export const likeVideo = async (req, res) => {
  try {
    const videoId = req.params.id;
    const userId = req.userId; // From authenticate middleware

    const video = await Video.findById(videoId);
    if (!video) return res.status(404).json({ message: 'Video not found' });

    // Check if user already liked
    const hasLiked = video.likes.includes(userId);
    // Check if user already disliked
    const hasDisliked = video.dislikes.includes(userId);

    if (hasLiked) {
      // If already liked, unlike it (remove from likes array)
      video.likes.pull(userId);
    } else {
      // If not liked, add to likes array
      video.likes.push(userId);
      // If previously disliked, remove dislike
      if (hasDisliked) {
        video.dislikes.pull(userId);
      }
    }

    await video.save();
    res.json({ message: 'Like status updated', video });
  } catch (error) {
    console.error('Error liking video:', error);
    res.status(500).json({ message: 'Failed to update like status.' });
  }
};

export const dislikeVideo = async (req, res) => {
  try {
    const videoId = req.params.id;
    const userId = req.userId;

    const video = await Video.findById(videoId);
    if (!video) return res.status(404).json({ message: 'Video not found' });

    const hasDisliked = video.dislikes.includes(userId);
    const hasLiked = video.likes.includes(userId);

    if (hasDisliked) {
      // If already disliked, undislike it
      video.dislikes.pull(userId);
    } else {
      // If not disliked, add to dislikes array
      video.dislikes.push(userId);
      // If previously liked, remove like
      if (hasLiked) {
        video.likes.pull(userId);
      }
    }

    await video.save();
    res.json({ message: 'Dislike status updated', video });
  } catch (error) {
    console.error('Error disliking video:', error);
    res.status(500).json({ message: 'Failed to update dislike status.' });
  }
};

export const addComment = async (req, res) => {
  try {
    const videoId = req.params.id;
    const userId = req.userId;
    const { comment } = req.body;

    if (!comment || comment.trim() === '') {
      return res.status(400).json({ message: 'Comment cannot be empty.' });
    }

    const video = await Video.findById(videoId);
    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }

    // Check if the user has already commented
    const hasCommented = video.comments.some(
      (c) => c.user.toString() === userId.toString()
    );

    if (hasCommented) {
      return res.status(409).json({ message: 'User has already commented on this video.' });
    }

    // Add new comment
    video.comments.push({ user: userId, comment });
    await video.save();

    // Populate and return updated video
    const populatedVideo = await Video.findById(videoId)
      .populate('comments.user', 'username');

    res.status(201).json({ message: 'Comment added', video: populatedVideo });

  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ message: 'Failed to add comment.' });
  }
};

export const getCommentsForVideo = async (req, res) => {
  try {
    const videoId = req.params.id;
    const limit = parseInt(req.query.limit) || 10;
    const skip = parseInt(req.query.skip) || 0;

    const video = await Video.findById(videoId)
      .select('comments')
      .populate('comments.user', 'name profilePicture');

    if (!video) {
      return res.status(404).json({ message: 'Video not found' });
    }

    const sortedComments = video.comments
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const sliced = sortedComments.slice(skip, skip + limit);

    const comments = sliced.map(comment => ({
      _id: comment._id,
      comment: comment.comment,
      timestamp: comment.timestamp,
      user: {
        _id: comment.user?._id,
        name: comment.user?.name,
        profilePicture: comment.user?.profilePicture
      }
    }));

    const hasMore = skip + limit < video.comments.length;

    return res.status(200).json({ comments, hasMore });
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ message: 'Failed to fetch comments.' });
  }
};



export const reportVideo = async (req, res) => {
  try {
    const videoId = req.params.id;
    const userId = req.userId;
    const { reason } = req.body; // Expect a reason for reporting

    const video = await Video.findById(videoId);
    if (!video) return res.status(404).json({ message: 'Video not found' });

    // Prevent multiple reports from the same user for the same video
    const hasReported = video.reports.some(report => report.user.toString() === userId);
    if (hasReported) {
      return res.status(409).json({ message: 'You have already reported this video.' });
    }

    video.reports.push({ user: userId, reason: reason || 'other' }); // Allow a default reason
    await video.save();

    res.status(200).json({ message: 'Video reported successfully.' });
  } catch (error) {
    console.error('Error reporting video:', error);
    res.status(500).json({ message: 'Failed to report video.' });
  }
};


export const watchVideo = async (req, res) => {
  const userId = req.userId; // from auth middleware
  const { id: videoId } = req.params;

  try {
    const video = await Video.findById(videoId);
    if (!video) return res.status(404).json({ message: 'Video not found' });

    const hasViewed = video.viewedBy.includes(userId);

    if (!hasViewed) {
      video.viewedBy.push(userId);
      video.viewCount += 1;
      await video.save();

      // Update user's watch history
      await User.findByIdAndUpdate(userId, {
        $push: {
          watchHistory: {
            video: videoId,
            watchedAt: new Date()
          }
        }
      });
    }

    res.json({ message: 'View recorded (if new)', viewCount: video.viewCount });
  } catch (err) {
    console.error('Error updating view:', err);
    res.status(500).json({ message: 'Failed to update view' });
  }
};
export const Search = async (req, res) => {
  const { q } = req.query;

  try {
    const results = await Video.find({
      $or: [
        { title: new RegExp(q, 'i') },        // Case-insensitive title search
        { description: new RegExp(q, 'i') },  // Case-insensitive description search
        { tags: { $in: [new RegExp(q, 'i')] } }
      ]
    }).populate('uploadedBy', 'name profilePicture subscribers')
      .lean(); // lean returns plain JS objects

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error during search');
  }
};
