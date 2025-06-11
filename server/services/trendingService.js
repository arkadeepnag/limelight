// file: services/trendingService.js

import cron from 'node-cron';
import Video from '../models/Video.js'; // Adjust path to your model
import User from '../models/User.js';   // Adjust path to your model

// ## The main function to calculate scores
const updateTrendingScores = async () => {
    console.log('Running scheduled job: Updating trending scores...');
    try {
        const videos = await Video.find({});
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        for (const video of videos) {
            // Find likes within the last 24 hours.
            // This assumes your 'likes' array stores user IDs directly.
            // For time-based tracking, 'likes' should be an array of { user: ObjectId, likedAt: Date }.
            // Here, we'll simplify and use total likes as a stand-in.
            const recentLikes = video.likes.length; // Replace with time-based logic if you adapt schema

            // Find comments within the last 24 hours
            const recentComments = video.comments.filter(c => c.timestamp >= oneDayAgo).length;

            // Find views within the last 24 hours
            const recentViews = await User.countDocuments({
                'watchHistory.video': video._id,
                'watchHistory.watchedAt': { $gte: oneDayAgo }
            });

            // Calculate score with weighted values
            const score = (recentViews * 0.5) + (recentLikes * 0.3) + (recentComments * 0.2);

            // Update the video's score in the database
            await Video.findByIdAndUpdate(video._id, { trendingScore: score });
        }
        console.log('Trending scores updated successfully.');
    } catch (error) {
        console.error('Error updating trending scores:', error);
    }
};

// ## Schedule the job to run every hour
export const startTrendingJob = () => {
    cron.schedule('0 * * * *', updateTrendingScores);
};