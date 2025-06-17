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
  try {
    const userId = req.userId;

    const user = await User.findById(userId).select('watchHistory likedVideos').lean();

    const seenVideoIds = user ? user.watchHistory.map(h => h.video.toString()) : [];

    const suggestions = new Map();

    // --- STRATEGY 1: Personalized - Videos related to hashtags in liked/watch history ---
    if (user && user.likedVideos.length > 0) {
      const likedVideos = await Video.find({ _id: { $in: user.likedVideos } }).select('hashtags').lean();
      const hashtagCounts = {};

      for (const video of likedVideos) {
        if (video.hashtags) {
          for (const tag of video.hashtags) {
            hashtagCounts[tag] = (hashtagCounts[tag] || 0) + 1;
          }
        }
      }

      const topHashtags = Object.entries(hashtagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([tag]) => tag);

      if (topHashtags.length > 0) {
        const relatedByTags = await Video.find({
          hashtags: { $in: topHashtags },
          _id: { $nin: seenVideoIds }
        }).limit(20).lean();

        for (const video of relatedByTags) {
          suggestions.set(video._id.toString(), { video, score: 5 });
        }
      }
    }

    // --- STRATEGY 2: Collaborative - Videos liked by people with similar tastes ---
    if (user && user.likedVideos.length > 0) {
      const similarUsers = await User.aggregate([
        { $match: { likedVideos: { $in: user.likedVideos.map(id => new mongoose.Types.ObjectId(id)) } } },
        { $unwind: '$likedVideos' },
        { $group: { _id: '$likedVideos', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 30 }
      ]);

      const videoIds = similarUsers.map(item => item._id);
      const similarVideos = await Video.find({ _id: { $in: videoIds, $nin: seenVideoIds } }).lean();

      const videoMap = new Map(similarVideos.map(v => [v._id.toString(), v]));

      for (const item of similarUsers) {
        const id = item._id.toString();
        if (videoMap.has(id)) {
          const video = videoMap.get(id);
          const existing = suggestions.get(id);
          const score = (existing?.score || 0) + item.count * 10;
          suggestions.set(id, { video, score });
        }
      }
    }

    // --- STRATEGY 3: Trending (Fallback or additional) ---
    if (suggestions.size < 10) {
      const trending = await Video.find({ _id: { $nin: seenVideoIds } })
        .sort({ trendingScore: -1 })
        .limit(10)
        .lean();

      for (const video of trending) {
        if (!suggestions.has(video._id.toString())) {
          suggestions.set(video._id.toString(), { video, score: 1 });
        }
      }
    }

    // --- Finalize ---
    let finalSuggestions = Array.from(suggestions.values());
    finalSuggestions.sort((a, b) => b.score - a.score);
    let videosToRespond = finalSuggestions.map(item => item.video);

    await Video.populate(videosToRespond, {
      path: 'uploadedBy',
      select: 'name profilePicture subscribers'
    });

    const result = videosToRespond.map(video => ({
      ...video,
      uploadedBy: {
        ...video.uploadedBy,
        subscriberCount: video.uploadedBy?.subscribers?.length || 0,
      }
    }));

    res.json(result);

  } catch (err) {
    console.error('Failed to get homepage suggestions:', err);
    res.status(500).json({ message: 'Server error while generating homepage suggestions.' });
  }
};

export const getSuggestedVideosForVideo = async (req, res) => {
  try {
    const { videoId } = req.params;
    // Assumes you have authentication middleware that adds the userId to the request object.
    const userId = req.userId;

    // Fetch the current user's watch history and the current video's data in parallel.
    const [currentUser, currentVideo] = await Promise.all([
      User.findById(userId).select('watchHistory likedVideos').lean(),
      Video.findById(videoId).select('hashtags uploadedBy likes').lean()
    ]);

    if (!currentVideo) {
      return res.status(404).json({ message: 'The video you are watching could not be found.' });
    }

    // Create a list of videos the user has already seen to avoid recommending them again.
    const seenVideoIds = currentUser ? currentUser.watchHistory.map(h => h.video.toString()) : [];
    seenVideoIds.push(videoId); // Also exclude the currently playing video.

    // Use a Map to store suggestions and their scores to prevent duplicates and rank them.
    const suggestions = new Map();

    // --- STRATEGY 1: CONTENT-BASED (Videos with similar hashtags) ---
    if (currentVideo.hashtags && currentVideo.hashtags.length > 0) {
      const relatedByTag = await Video.find({
        hashtags: { $in: currentVideo.hashtags },
        _id: { $nin: seenVideoIds }
      }).limit(10).lean();

      for (const video of relatedByTag) {
        // Give a base score for a content match.
        suggestions.set(video._id.toString(), { video, score: 5 });
      }
    }

    // --- STRATEGY 2: COLLABORATIVE FILTERING (Users who liked this also liked...) ---
    if (currentVideo.likes && currentVideo.likes.length > 0) {
      const otherUserIds = currentVideo.likes.map(id => id.toString()).filter(id => id !== userId);

      if (otherUserIds.length > 0) {
        // Find all videos liked by these "similar" users.
        const likedBySimilarUsers = await User.aggregate([
          { $match: { _id: { $in: otherUserIds.map(id => new mongoose.Types.ObjectId(id)) } } },
          { $unwind: '$likedVideos' }, // Deconstruct the likedVideos array
          { $group: { _id: '$likedVideos', count: { $sum: 1 } } }, // Count how many similar users liked each video
          { $sort: { count: -1 } }, // The most co-liked videos are most relevant
          { $limit: 20 }
        ]);

        const videoIds = likedBySimilarUsers.map(item => item._id);
        const populatedVideos = await Video.find({ _id: { $in: videoIds, $nin: seenVideoIds } }).lean();
        const videoMap = new Map(populatedVideos.map(v => [v._id.toString(), v]));

        for (const item of likedBySimilarUsers) {
          const videoIdStr = item._id.toString();
          if (videoMap.has(videoIdStr)) {
            const video = videoMap.get(videoIdStr);
            const existing = suggestions.get(videoIdStr);
            // Boost score heavily for collaborative matches, or add it if new.
            const newScore = (existing ? existing.score : 0) + item.count * 10;
            suggestions.set(videoIdStr, { video, score: newScore });
          }
        }
      }
    }

    // --- STRATEGY 3: FALLBACK (Trending videos if no other suggestions found) ---
    if (suggestions.size === 0) {
      const trendingVideos = await Video.find({ _id: { $nin: seenVideoIds } })
        .sort({ trendingScore: -1 })
        .limit(10)
        .lean();

      for (const video of trendingVideos) {
        suggestions.set(video._id.toString(), { video, score: 1 });
      }
    }

    // --- FINALIZE AND RESPOND ---
    let finalSuggestions = Array.from(suggestions.values());

    // Sort all collected suggestions by their final calculated score.
    finalSuggestions.sort((a, b) => b.score - a.score);

    // Extract just the video documents from the scored results.
    let videosToRespond = finalSuggestions.map(item => item.video);

    // Populate the uploader information for the final list.
    await Video.populate(videosToRespond, {
      path: 'uploadedBy',
      select: 'name profilePicture subscribers'
    });

    // Manually add the subscriberCount to each video's uploader field.
    const result = videosToRespond.map(video => ({
      ...video,
      uploadedBy: {
        ...video.uploadedBy,
        subscriberCount: video.uploadedBy?.subscribers?.length || 0,
      }
    }));

    res.json(result);

  } catch (error) {
    console.error('Failed to get suggested videos:', error);
    res.status(500).json({ message: 'Server error while getting suggestions.' });
  }
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
import { generateTranscript } from '../services/transcriptService.js';

const resolutions = {
  '360p': '640x360',
  '480p': '854x480',
  '720p': '1280x720',
  '1080p': '1920x1080',
};

const extractHashtags = (text) => {
  if (!text) return [];
  const hashtagRegex = /#(\w+)/g;
  const matches = text.match(hashtagRegex) || [];
  return matches.map(tag => tag.substring(1).toLowerCase());
};
export const uploadVideo = async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders(); // make sure headers are flushed

  const sendProgress = (message, percent = 0) => {
    const payload = { message, percent };
    console.log('SSE:', payload); // ✅ log server-sent events
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  try {
    console.log('📥 Upload request received');

    console.log('🧪 Checking request body and files...');
    console.log('req.body:', req.body);
    console.log('req.files:', req.files);

    const { title, description } = req.body;
    const videoFile = req.files?.video?.[0];
    const thumbnailFile = req.files?.thumbnail?.[0];

    if (!videoFile) {
      sendProgress('❌ No video file uploaded', 0);
      console.error('❌ No video file present in request');
      return res.end();
    }

    const videoId = Date.now().toString();
    const ext = path.extname(videoFile.originalname);

    // Save original video
    const originalDir = path.join('uploads', 'originals');
    const originalPath = path.join(originalDir, `${videoId}${ext}`);
    const fullPath = path.join(originalDir, `${videoId}${ext}`);

    await fs.ensureDir(originalDir);
    await fs.move(videoFile.path, originalPath);

    console.log('📁 Video saved to', originalPath);
    sendProgress('✅ Video uploaded', 10);

    // HLS conversion
    const videoDir = path.join('uploads', 'hls', videoId);
    await fs.ensureDir(videoDir);

    sendProgress('⏳ Starting HLS conversion', 15);
    console.log('🎞️ Starting HLS conversion for', originalPath);

    const hlsResults = await Promise.allSettled(
      Object.entries(resolutions).map(([label, size]) => {
        return new Promise((resolve, reject) => {
          const resDir = path.join(videoDir, label);
          fs.ensureDirSync(resDir);
          console.log(`⚙️ Starting FFmpeg for ${label} (${size})`);

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
            .on('end', () => {
              console.log(`✅ FFmpeg finished for ${label}`);
              resolve(label);
            })
            .on('error', (err) => {
              console.error(`❌ FFmpeg error for ${label}:`, err.message);
              reject(err);
            })
            .run();
        });
      })
    );

    const availableQualities = Object.keys(resolutions).filter((_, i) => hlsResults[i].status === 'fulfilled');
    sendProgress(`✅ HLS conversion done (${availableQualities.join(', ')})`, 40);

    // Master playlist
    try {
      const masterPlaylist = availableQualities.map(label => {
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
      console.log('📄 Master playlist written to', masterPlaylistPath);
    } catch (err) {
      console.error('⚠️ Master playlist generation failed:', err.message);
    }

    // Thumbnail
    const thumbnailDir = path.join('uploads', 'thumbnails');
    await fs.ensureDir(thumbnailDir);
    let thumbnailPath = path.join(thumbnailDir, `${videoId}.jpg`);

    try {
      if (thumbnailFile) {
        const tExt = path.extname(thumbnailFile.originalname);
        thumbnailPath = path.join(thumbnailDir, `${videoId}${tExt}`);
        await fs.move(thumbnailFile.path, thumbnailPath, { overwrite: true });
        console.log('🖼️ Custom thumbnail saved to', thumbnailPath);
      } else {
        await new Promise((resolve, reject) => {
          ffmpeg(originalPath)
            .on('end', () => {
              console.log('🖼️ Auto thumbnail generated');
              resolve();
            })
            .on('error', (err) => {
              console.error('❌ Thumbnail generation error:', err.message);
              reject(err);
            })
            .screenshots({
              count: 1,
              filename: `${videoId}.jpg`,
              folder: thumbnailDir,
              size: '320x?',
            });
        });
      }
      sendProgress('✅ Thumbnail generated', 65);
    } catch (err) {
      sendProgress('⚠️ Thumbnail generation failed', 65);
      console.error('⚠️ Thumbnail generation error:', err.message);
    }

    // Metadata
    let metadata = {
      duration: 0,
      codec: 'unknown',
      bitrate: 0,
      resolution: 'unknown',
    };

    try {
      metadata = await new Promise((resolve, reject) => {
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

      console.log('📊 Metadata extracted:', metadata);
      sendProgress('✅ Metadata extracted', 75);
    } catch (err) {
      console.error('⚠️ Metadata extraction failed:', err.message);
      sendProgress('⚠️ Metadata extraction failed', 75);
    }

    // Hashtags
    const hashtags = extractHashtags(description);
    console.log('🏷️ Hashtags extracted:', hashtags);

    let transcript = null;

    try {
      console.log(`📝 Generating transcript for video: ${videoId}`);
      transcript = await generateTranscript(fullPath, videoId);

      if (!transcript || transcript.length === 0) {
        console.warn(`⚠️ No transcript generated for video: ${videoId}`);
      } else {
        console.log(`✅ Transcript generated for video ${videoId}:`);
        console.dir(transcript, { depth: null, colors: true }); // Pretty print JSON
      }
    } catch (err) {
      console.error(`❌ Error generating transcript for video ${videoId}:`, err.message);
    }


    // Save to DB
    const newVideo = new Video({
      title,
      description,
      hlsFolder: videoId,
      uploadedBy: req.userId,
      availableQualities,
      thumbnailPath,
      duration: metadata.duration,
      codec: metadata.codec,
      bitrate: metadata.bitrate,
      resolution: metadata.resolution,
      hashtags,
      transcript, // if you plan to add transcript
    });

    await newVideo.save();
    console.log('💾 Video saved to DB:', newVideo._id);
    sendProgress('✅ Video saved to database', 95);

    sendProgress('🎉 Upload complete', 100);
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();

  } catch (err) {
    console.error('❌ Upload failed:', err.stack);
    sendProgress(`❌ Upload failed: ${err.message}`, 0);
    res.end();
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

  if (!q || typeof q !== 'string') {
    return res.status(400).json({ message: 'Query parameter "q" is required' });
  }

  try {
    const regex = new RegExp(q, 'i'); // case-insensitive regex

    // Step 1: Find users matching the query by name
    const matchedUsers = await User.find({ name: regex }, '_id');
    const userIds = matchedUsers.map(user => user._id);

    // Step 2: Search videos by title, description, tags, or uploader's name
    const results = await Video.find({
      $or: [
        { title: regex },
        { description: regex },
        { tags: { $in: [regex] } },
        { uploadedBy: { $in: userIds } }
      ]
    })
      .populate('uploadedBy', 'name profilePicture subscribers')
      .lean(); // lean returns plain JS objects

    res.json(results);
  } catch (err) {
    console.error('❌ Search error:', err);
    res.status(500).json({ message: 'Error during search' });
  }
};