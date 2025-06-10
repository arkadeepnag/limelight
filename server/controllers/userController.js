import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

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
