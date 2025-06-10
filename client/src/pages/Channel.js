import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaRegFolder, FaInfo, FaLocationDot, FaLink, FaRegCalendar, FaPeopleRoof } from "react-icons/fa6";

import { getUserInfo, getVideosByUserId, subscribe, unsubscribe } from '../api';
import "../styles/channel.css";

const Channel = () => {
    const { userId } = useParams();
    const { auth } = useAuth(); // Contains `user` object and `token`
    const navigate = useNavigate();

    const [userData, setUserData] = useState(null);
    const [userVideos, setUserVideos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isSubscribed, setIsSubscribed] = useState(false); // New state for subscription status
    const [subscriberCount, setSubscriberCount] = useState(0); // Manage subscriber count dynamically
    const [subscribable, setSubscribable] = useState(true)
    useEffect(() => {
        const fetchChannelData = async () => {
            setLoading(true);
            setError(null);

            if (!auth?.token) {
                setError("Authentication required to view channel.");
                setLoading(false);
                // navigate('/login'); // Optionally redirect
                return;
            }

            if (!userId) {
                setError("Channel ID is missing.");
                setLoading(false);
                return;
            }

            try {
                // Fetch user profile information
                const userInfo = await getUserInfo(userId, auth.token);
                setUserData(userInfo);
                setSubscriberCount(userInfo.subscribers ? userInfo.subscribers.length : 0);

                // Determine if the current user is subscribed to this channel
                if (auth.userId && userInfo.subscribers) {
                    setIsSubscribed(userInfo.subscribers.some(
                        (subscriber) => subscriber._id === auth.user._id // Check if auth.user is in subscribers list
                    ));
                }
                if (auth.userId == userId) {
                    setSubscribable(false)
                }
                // Fetch videos uploaded by this user
                const videos = await getVideosByUserId(userId, auth.token);
                setUserVideos(videos);

            } catch (err) {
                console.error('Error fetching channel data:', err);
                setError(err.message || 'Failed to load channel data. Please try again.');
                setUserData(null);
                setUserVideos([]);
            } finally {
                setLoading(false);
            }
        };

        fetchChannelData();
    }, [userId, auth?.token, auth?.user]); // Added auth.user to dependencies for subscription check

    const handleSubscribeToggle = async () => {
        if (!auth.token) {
            alert("You must be logged in to subscribe.");
            navigate('/login');
            return;
        }

        try {
            if (isSubscribed) {
                // Unsubscribe
                await unsubscribe(userId, auth.token);
                setIsSubscribed(false);
                setSubscriberCount(prevCount => prevCount - 1);
            } else {
                // Subscribe
                await subscribe(userId, auth.token);
                setIsSubscribed(true);
                setSubscriberCount(prevCount => prevCount + 1);
            }
        } catch (err) {
            console.error('Subscription error:', err);
            alert(err.message || 'Failed to update subscription status.');
        }
    };

    // --- Loading and Error States ---
    if (loading) {
        return <div className="channel-loading">Loading channel...</div>;
    }

    if (error) {
        return <div className="channel-error">{error}</div>;
    }

    if (!userData) {
        return <div className="channel-error">Channel not found or data is unavailable.</div>;
    }

    // Determine if the current user is viewing their own channel
    const isOwner = auth.user && auth.user._id === userId;
    const timeSinceUpload = (uploadDateString) => {
        const uploadDate = new Date(uploadDateString);
        const now = new Date();

        const diffMs = now - uploadDate;

        const diffSeconds = Math.floor(diffMs / 1000);
        const diffMinutes = Math.floor(diffSeconds / 60);
        const diffHours = Math.floor(diffMinutes / 60);
        const diffDays = Math.floor(diffHours / 24);
        const diffMonths = Math.floor(diffDays / 30);
        const diffYears = Math.floor(diffDays / 365);

        if (diffYears > 0) {
            return diffYears === 1 ? '1 year ago' : `${diffYears} years ago`;
        } else if (diffMonths > 0) {
            return diffMonths === 1 ? '1 month ago' : `${diffMonths} months ago`;
        } else if (diffDays > 0) {
            return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
        } else if (diffHours > 0) {
            return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
        } else if (diffMinutes > 0) {
            return diffMinutes === 1 ? '1 minute ago' : `${diffMinutes} minutes ago`;
        } else {
            return diffSeconds <= 1 ? 'just now' : `${diffSeconds} seconds ago`;
        }
    };


    const formatDuration = (durationInSeconds) => {
        const totalSeconds = Math.floor(durationInSeconds);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;


        if (hours > 0) {
            return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        } else {
            return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }
    };
    return (
        <div className="channel-container">
            {/* Banner Image */}
            <div className="channel-about-content">
                <div className="channel-about-left">
                    <div className="channel-banner">
                        <img src={userData.banner} alt={`${userData.username}'s banner`} className="banner-image" />
                    </div>
                    <img src={userData.profilePicture} alt={`${userData.username}'s profile`} className="profile-picture-channel" />
                    {!subscribable ? (
                        <div className="buttons-action">
                            {/* Owner's buttons */}
                            <button
                                onClick={() => navigate('/upload')} // Navigate to your upload page
                                className="action-button upload-button"
                            >
                                Upload Video
                            </button>
                            <button
                                onClick={() => navigate(`/edit-channel/${userId}`)} // Navigate to channel settings/edit page
                                className="action-button edit-channel-button"
                            >
                                Edit Channel
                            </button>
                        </div>
                    ) : (
                        // Subscriber button for non-owners (and logged-in users)
                        auth.user && ( // Ensure user is logged in
                            <button
                                onClick={handleSubscribeToggle}
                                className={`subscribe-button ${isSubscribed ? 'subscribed' : ''}`}
                            >
                                {isSubscribed ? 'Subscribed' : 'Subscribe'}
                            </button>
                        )
                    )}
                    <div className="channel-header">
                        {/* Profile Picture */}

                        <div className="user-primary-info"> {/* New wrapper for main info and button */}
                            <div className="user-text-info">
                                {/* User Name */}
                                <h1 className="user-name">{userData.name}</h1>
                                {/* User Username */}
                                <p className="user-username">@{userData.username}</p>
                                {/* Subscriber Count */}

                            </div>

                            {/* Subscribe/Unsubscribe Button */}

                        </div>
                    </div>


                </div>
                <div className="channel-about-links-section"> {/* New section for about and links */}
                    <div className="channel-about-links-header">
                        <FaRegFolder /><h3>About</h3>
                    </div>
                    <div className="channel-about">
                        {/* User About/Bio (only if exists) */}
                        {userData.about && <p className="about-text"><FaInfo />  {userData.about}</p>}
                        {userData.location && (
                            <p className="channel-location"><FaLocationDot />  {userData.location}</p>
                        )}
                        <p><FaRegCalendar />  Joined {timeSinceUpload(userData.createdAt)}</p>
                        <p><FaPeopleRoof />  {subscriberCount} Followers</p>


                        {/* External Links Section */}

                        {userData.links && userData.links.length > 0 ? (
                            <div className="channel-links">
                                <h3 className="linkTitle"><FaLink /> Links</h3>
                                <ul>
                                    {userData.links.map((link, index) => (
                                        <li key={index}>
                                            <a href={link.url} target="_blank" rel="noopener noreferrer">{link.title}</a>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ) : (
                            // This block will render if there are no links.
                            // You can choose to render nothing, or a "No Links provided" message.
                            <div className="channel-links no-links-placeholder"> {/* Add a class for styling if needed */}
                                <h3 className="linkTitle"><FaLink /> Links</h3>
                                <p>No links provided</p>
                            </div>
                            // Or simply null if you want the section to disappear completely
                            // null
                        )}

                    </div>

                </div>
            </div>

            <div className="channel-content">
                <h2>Videos</h2>
                <div className="video-list">
                    {userVideos.length > 0 ? (
                        userVideos.map(video => (
                            <div className="card">
                                <Link to={`/video/${video._id}`} className="link">

                                    <div class="thumbnailContainer">
                                        <img
                                            src={`http://localhost:5000/${video.thumbnailPath}`}
                                            alt="Thumbnail"
                                            className="thumbnail"
                                        />
                                        <div class="timePeriod">{formatDuration(video.duration)}</div>
                                    </div>

                                    <div className="meta">
                                        <div class="stats"><p>{video.viewCount || "No"} views </p> <p>Uploaded {timeSinceUpload(video.createdAt)}</p></div>
                                        <h3 className="title">{video.title}</h3>


                                    </div>
                                </Link>
                            </div>
                        ))
                    ) : (
                        <p className="no-videos-message">No videos uploaded by this user yet.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Channel;