import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
export const subscribeToUser = async (req, res) => {
    const { subscriberId, targetUserId } = req.body;

    if (subscriberId === targetUserId) {
        return res.status(400).json({ message: "You cannot subscribe to yourself." });
    }

    try {
        const subscriber = await User.findById(subscriberId);
        const targetUser = await User.findById(targetUserId);

        if (!subscriber || !targetUser) {
            return res.status(404).json({ message: "User not found." });
        }

        // Check if already subscribed
        if (subscriber.subscriptions.includes(targetUserId)) {
            return res.status(400).json({ message: "Already subscribed." });
        }

        // Add to both sides
        subscriber.subscriptions.push(targetUserId);
        targetUser.subscribers.push(subscriberId);

        await subscriber.save();
        await targetUser.save();

        res.status(200).json({ message: "Subscribed successfully." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error." });
    }
};

export const unsubscribeFromUser = async (req, res) => {
    const { subscriberId, targetUserId } = req.body;

    if (subscriberId === targetUserId) {
        return res.status(400).json({ message: "You cannot unsubscribe from yourself." });
    }

    try {
        const subscriber = await User.findById(subscriberId);
        const targetUser = await User.findById(targetUserId);

        if (!subscriber || !targetUser) {
            return res.status(404).json({ message: "User not found." });
        }

        // Check if not subscribed
        if (!subscriber.subscriptions.includes(targetUserId)) {
            return res.status(400).json({ message: "You are not subscribed to this user." });
        }

        // Remove from both sides
        subscriber.subscriptions = subscriber.subscriptions.filter(id => id.toString() !== targetUserId);
        targetUser.subscribers = targetUser.subscribers.filter(id => id.toString() !== subscriberId);

        await subscriber.save();
        await targetUser.save();

        res.status(200).json({ message: "Unsubscribed successfully." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error." });
    }
};
export const updateProfileImages = async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({ message: 'User ID is required.' });
        }

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found.' });

        const hostUrl = `${req.protocol}://${req.get('host')}`;

        // Compress and update profilePicture
        if (req.files?.profilePicture?.[0]) {
            const originalFile = req.files.profilePicture[0];
            const compressedPath = path.join('uploads/profile', `compressed-${Date.now()}.jpeg`);

            await sharp(originalFile.path)
                .resize(300, 300, { fit: 'cover' }) // Resize to square (adjust as needed)
                .jpeg({ quality: 60 }) // Compress to 60% quality
                .toFile(compressedPath);

            fs.unlinkSync(originalFile.path); // Delete original uncompressed image
            user.profilePicture = `${hostUrl}/${compressedPath}`;
        }

        // Compress and update banner
        if (req.files?.banner?.[0]) {
            const originalFile = req.files.banner[0];
            const compressedPath = path.join('uploads/banner', `compressed-${Date.now()}.jpeg`);

            await sharp(originalFile.path)
                .resize({ width: 1280 }) // Resize width (keep aspect ratio)
                .jpeg({ quality: 60 })
                .toFile(compressedPath);

            fs.unlinkSync(originalFile.path);
            user.banner = `${hostUrl}/${compressedPath}`;
        }

        await user.save();

        res.status(200).json({
            message: 'Profile updated successfully.',
            profilePicture: user.profilePicture,
            banner: user.banner,
        });
    } catch (err) {
        console.error('Error updating images:', err);
        res.status(500).json({ message: 'Server error' });
    }
};
