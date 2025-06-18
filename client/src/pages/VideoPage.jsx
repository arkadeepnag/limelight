import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import CustomVideoPlayer from '../components/CustomVideoPlayer';
import { Link } from 'react-router-dom';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';
import Hls from 'hls.js';
import {
    getVideo, deleteVideo, likeVideo, dislikeVideo,
    addComment, getComments, watchVideo, subscribe, unsubscribe, getAllComments
} from '../api';
import { BiLike, BiDislike, BiBookmark, BiShareAlt, BiSolidLike, BiSolidDislike } from "react-icons/bi";
import { FaArrowUp, FaArrowUpAZ } from "react-icons/fa6";

import { useAuth } from '../context/AuthContext';
import { profanity } from '@2toad/profanity';
import "./VideoPage.css"
const VideoPage = () => {
    const { id } = useParams();
    const [video, setVideo] = useState(null);
    const [likeState, setLikeState] = useState({ likes: [], dislikes: [] });
    const [loading, setLoading] = useState(true);


    const [comment, setComment] = useState('');
    const [comments, setComments] = useState([]);
    const [submittingComment, setSubmittingComment] = useState(false);
    const MAX_CHARS = 150;


    const [qualities, setQualities] = useState([]);
    const [selectedQuality, setSelectedQuality] = useState(null);
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [subscribing, setSubscribing] = useState(false);
    const { auth, logout } = useAuth();
    const [skip, setSkip] = useState(0);
    const [hasMoreComments, setHasMoreComments] = useState(true);
    const commentLimit = 5;
    const navigate = useNavigate();
    const token = auth?.token;
    const userId = auth?.userId;
    const videoRef = useRef(null);
    const playerRef = useRef(null);
    const hlsRef = useRef(null);



    const containsSneakyLinks = (text) => {

        const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|\.[a-z]{2,}\/?)/gi;


        const dotComRegex = /\b([a-z0-9-]+)\s*\[?\s*dot\s*\]?\s*(com|net|org|io|dev|app|cloud|xyz)\b/gi;


        const colonSlashSlashRegex = /(http|https)\s*:\s*\/\/\s*([^\s]+)/gi;


        const dotTldSeparated = /\b[a-z0-9-]+\s+dot\s+(com|org|net)\b/gi;



        const httpSpaceTld = /(https?:\/\/[^\s]+)\s+(com|org|net)\b/gi;

        return (
            urlRegex.test(text) ||
            dotComRegex.test(text) ||
            colonSlashSlashRegex.test(text) ||
            dotTldSeparated.test(text) ||
            httpSpaceTld.test(text)
        );
    };
    const containsLinks = useCallback((text) => {
        return containsSneakyLinks(text);
    }, []);

    const containsBadWords = (text) => {
        profanity.addWords(['rape', 'murder', 'suicide', 'terrorist', 'paedophile', 'child abuse', 'molest']);

        profanity.addWords(['maderchod', 'behenchod', 'harami', 'kutte', 'randi']);
        profanity.addWords(['fck', 'sh1t', 'b!tch']);
        profanity.options.grawlix = '@#$*!';
        return profanity.exists(text);
    };

    const handleCommentChange = useCallback((e) => {
        const value = e.target.value;
        setComment(value);
    }, []);


    useEffect(() => {
        const fetchData = async () => {
            try {
                const videoData = await getVideo(id);

                setVideo(videoData);
                setLikeState({
                    likes: videoData.likes || [],
                    dislikes: videoData.dislikes || [],
                });

                // Set page title
                document.title = `${videoData.title} | Limelight` || 'Video Page';

                const commentsData = await getAllComments(id, commentLimit, 0, token);
                setComments(commentsData.comments);
                setSkip(commentLimit);
                setHasMoreComments(commentsData.hasMore);
            } catch (err) {
                console.error("Failed to fetch video or comments", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();

        if (token) {
            watchVideo(id, token).catch(console.error);
        }

        // Cleanup: optionally reset title on unmount
        return () => {
            document.title = 'Limelight'; // or your default title
        };
    }, [id, token, commentLimit]);


    useEffect(() => {
        if (!video) return;

        const videoElement = videoRef.current;

        if (playerRef.current) playerRef.current.destroy();
        if (hlsRef.current) hlsRef.current.destroy();

        if (Hls.isSupported()) {
            const hls = new Hls();
            hls.loadSource(`http://localhost:5000/api/videos/${video._id}/master.m3u8`);
            hls.attachMedia(videoElement);
            hlsRef.current = hls;

            hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
                const availableQualities = data.levels.map((l, i) => ({
                    label: `${l.height}p`,
                    value: i,
                }));
                setQualities(availableQualities);
                setSelectedQuality(hls.currentLevel);

                if (playerRef.current) {
                    playerRef.current.play().catch(console.warn);
                }
            });

            hls.on(Hls.Events.ERROR, (event, data) => {
                console.error('HLS.js Error:', data);
            });
        } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
            videoElement.src = `http://localhost:5000/api/videos/${video._id}/master.m3u8`;
        }

        playerRef.current = new Plyr(videoElement, {
            controls: [
                'play', 'rewind', 'fast-forward', 'progress',
                'current-time', 'duration', 'mute', 'volume',
                'settings', 'fullscreen'
            ],
        });

        return () => {
            if (playerRef.current) playerRef.current.destroy();
            if (hlsRef.current) hlsRef.current.destroy();
        };
    }, [video]);

    const loadMoreComments = async () => {
        try {
            const response = await getAllComments(id, commentLimit, skip, token);
            setComments(prev => [...prev, ...response.comments]);
            setSkip(prev => prev + commentLimit);
            setHasMoreComments(response.hasMore);
        } catch (err) {
            console.error('Failed to load more comments:', err);
        }
    };

    const handleLike = async () => {
        if (!token) return alert('Login required');

        const alreadyLiked = likeState.likes.includes(userId);
        const updatedLikes = alreadyLiked
            ? likeState.likes.filter((id) => id !== userId)
            : [...likeState.likes, userId];

        const updatedDislikes = likeState.dislikes.includes(userId)
            ? likeState.dislikes.filter((id) => id !== userId)
            : likeState.dislikes;

        setLikeState({ likes: updatedLikes, dislikes: updatedDislikes });

        try {
            await likeVideo(id, token);
        } catch (err) {
            console.error("Failed to like video:", err);
        }
    };

    const handleDislike = async () => {
        if (!token) return alert('Login required');

        const alreadyDisliked = likeState.dislikes.includes(userId);
        const updatedDislikes = alreadyDisliked
            ? likeState.dislikes.filter((id) => id !== userId)
            : [...likeState.dislikes, userId];

        const updatedLikes = likeState.likes.includes(userId)
            ? likeState.likes.filter((id) => id !== userId)
            : likeState.likes;

        setLikeState({ likes: updatedLikes, dislikes: updatedDislikes });

        try {
            await dislikeVideo(id, token);
        } catch (err) {
            console.error("Failed to dislike video:", err);
        }
    };


    const handleCommentSubmit = async (e) => {
        e.preventDefault();

        const currentHasLinks = containsLinks(comment);
        const currentHasBadWords = containsBadWords(comment);
        const currentExtraChars = comment.length > MAX_CHARS ? comment.length - MAX_CHARS : 0;

        const isValid = comment.trim().length > 0 &&
            currentExtraChars === 0 &&
            !currentHasLinks &&
            !currentHasBadWords;

        if (!isValid) {
            if (comment.trim().length === 0) alert('Comment cannot be empty.');
            else if (currentExtraChars > 0) alert(`Comment is ${currentExtraChars} characters over the limit.`);
            else if (currentHasLinks) alert('Links are not allowed in comments.');
            else if (currentHasBadWords) alert('Your comment contains inappropriate language.');
            return;
        }

        setSubmittingComment(true);

        try {
            await addComment(id, comment.substring(0, MAX_CHARS), token);

            const updatedCommentsData = await getAllComments(id, commentLimit, 0, token);
            setComments(updatedCommentsData.comments);
            setSkip(commentLimit);
            setHasMoreComments(updatedCommentsData.hasMore);
            setComment('');
        } catch (err) {
            console.error("Failed to add comment", err);
            if (err.status === 409) {
                alert('You have already commented on this video. Sorry, but you cannot comment again.');
            } else {
                alert('Failed to add comment. Please try again.');
            }
        } finally {
            setSubmittingComment(false);
        }
    };


    useEffect(() => {

        if (video && video.uploadedBy?.subscribers) {
            if (video.uploadedBy.subscribers.includes(userId))
                setIsSubscribed(true);
        }
    }, [video, userId]);

    const handleSubscribeToggle = async () => {
        if (!token) return alert('Login required');

        try {
            if (isSubscribed) {
                await unsubscribe(video.uploadedBy._id, userId, token);

                setVideo((v) => ({
                    ...v,
                    uploadedBy: {
                        ...v.uploadedBy,
                        subscribers: v.uploadedBy.subscribers.filter(id => id !== userId),
                    }
                }));
                setIsSubscribed(false)
            } else {
                await subscribe(video.uploadedBy._id, userId, token);

                setVideo((v) => ({
                    ...v,
                    uploadedBy: {
                        ...v.uploadedBy,
                        subscribers: [...v.uploadedBy.subscribers, userId],
                    }
                }));
                setIsSubscribed(true)
            }
        } catch (err) {
            alert('Subscription action failed');
            console.error(err);
        } finally {
            setSubscribing(false);
        }
    };



    if (!video) return <p>Video not found</p>;


    const extraChars = comment.length > MAX_CHARS ? comment.length - MAX_CHARS : 0;
    const charsLeft = MAX_CHARS - comment.length;

    const validCommentPart = comment.substring(0, MAX_CHARS);
    const extraCommentPart = comment.substring(MAX_CHARS);

    const hasLinks = containsLinks(comment);
    const hasBadWords = containsBadWords(comment);

    const isCommentInputValid = comment.trim().length > 0 &&
        extraChars === 0 &&
        !hasLinks &&
        !hasBadWords;

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

    return (
        <div className="videopageContainer">
            <div style={{ maxWidth: '900px' }} className="videoContainer">
                {video && (
                    <CustomVideoPlayer src={`http://localhost:5000/api/videos/${video._id}/master.m3u8`} transcript={video.transcript || []} />
                )}

                <h1 className="titleVideo">{video.title}</h1>
                <p className="viewsVideo">{video.viewCount || "No"} views </p>
                <div className="videoMeta">

                    <div className="uploader">
                        <Link to={`/channel/${video.uploadedBy?._id}`} className="link">  <img src={`${video.uploadedBy?.profilePicture}`} className="profilePicture" alt="Profile" /></Link>

                        <div>

                            <Link to={`/channel/${video.uploadedBy?._id}`} className="link"> <strong>{video.uploadedBy?.name || "Uploader"}</strong><br /></Link>
                            <small>{video.uploadedBy?.subscribers?.length || 0} subscribers</small>
                        </div>

                        {userId !== video.uploadedBy?._id ? (
                            <button
                                className={isSubscribed ? 'subscribers-btn subscribed-btn' : 'subscribers-btn subscribe-btn'}
                                onClick={handleSubscribeToggle}
                                disabled={subscribing}
                                style={{ cursor: subscribing ? 'not-allowed' : 'pointer' }}
                            >
                                {isSubscribed ? 'Followed' : 'Follow'}
                            </button>
                        ) : (
                            <button className="subscribers-btn" disabled style={{ cursor: 'not-allowed' }}>
                                Your Video
                            </button>
                        )}
                    </div>
                    <div className="likesSection">
                        <button
                            className={likeState.likes.includes(userId) ? "likeBtn liked" : "likeBtn"}
                            onClick={handleLike}
                        >
                            {/* Conditionally render filled or outline icon for Like */}
                            {likeState.likes.includes(userId) ? <BiSolidLike /> : <BiLike />}
                            {likeState.likes.length}
                        </button>

                        <button
                            className={likeState.dislikes.includes(userId) ? "likeBtn liked" : "likeBtn"}
                            onClick={handleDislike}
                        >
                            {/* Conditionally render filled or outline icon for Dislike */}
                            {likeState.dislikes.includes(userId) ? <BiSolidDislike /> : <BiDislike />}
                            {likeState.dislikes.length}
                        </button>
                        <button className="likeBtn">
                            <BiBookmark /> Save
                        </button>
                        <button className="likeBtn">
                            <BiShareAlt /> Share
                        </button>
                    </div>
                </div>
                <div className="description">
                    <p>Uploaded <span className="date">{timeSinceUpload(video.createdAt)}</span></p>
                    <p>
                        {video.description.split(/(\s+)/).map((word, idx) => {
                            if (word.startsWith('#')) {
                                const tag = word.slice(1);
                                return (
                                    <a key={idx} href={`/tags/${tag}`} style={{ color: '#007bff' }}>
                                        {word}
                                    </a>
                                );
                            }
                            return word;
                        })}
                    </p>

                </div>
            </div>

            {/* --- Comment Section with enhanced input --- */}
            <div className="commentSection">

                <div className="commentInput">
                    <input
                        value={comment}
                        onChange={handleCommentChange}
                        placeholder="Add a comment"
                        required
                        className={(extraChars > 0 || hasLinks || hasBadWords) ? 'input-error' : ''}

                    />

                    <div className="commentFooter">
                        <div>
                            <span style={{ color: charsLeft < 0 ? 'red' : '#666' }}>
                                {charsLeft >= 0 ? `${charsLeft} characters left` : `${Math.abs(charsLeft)} characters over`}
                            </span>



                        </div>

                        <button
                            onClick={handleCommentSubmit}
                            disabled={submittingComment || !isCommentInputValid}
                        >
                            <FaArrowUp />
                        </button>
                    </div>
                </div>


                {hasLinks && <p style={{ color: 'red', margin: '5px 0 0' }}>Links are not allowed in comments.</p>}
                {hasBadWords && <p style={{ color: 'red', margin: '5px 0 0' }}>Your comment contains inappropriate language.</p>}

                {!comments || comments.length === 0 ? (
                    <>

                        <h3>Comments</h3>
                        <p>No comments yet</p>
                    </>
                ) : (
                    <ul className="commentList">
                        <div className="commentList-header"><h3>Comments</h3>
                            <button className="typeComment"><FaArrowUpAZ /> <span>Most Recent</span></button></div>
                        {comments.map((c) => (
                            <li key={c._id} style={{ display: 'flex', justifyContent: 'center', flexDirection: 'column', marginBottom: '12px', gap: '14px' }}>
                                <Link to={`/channel/${c.user?._id}`} className="link">
                                    <div className="uploader">
                                        <img
                                            src={c.user?.profilePicture}
                                            alt="User"
                                            style={{
                                                width: '20px',
                                                height: '20px',
                                                borderRadius: '50%',
                                                objectFit: 'cover',
                                                marginRight: '5px'
                                            }}
                                        />
                                        <strong>{c.user?.name || 'User'}</strong>
                                        <span>{timeSinceUpload(c.timestamp) || 'User'}</span>
                                    </div>
                                </Link>
                                <div>

                                    <p style={{ margin: 0, marginLeft: '30px' }}>{c.comment}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}

                {hasMoreComments && (
                    <button
                        onClick={loadMoreComments}
                        style={{ marginTop: '10px', padding: '8px 12px' }}
                    >
                        Load More Comments
                    </button>
                )}
            </div>
        </div>
    );
};

export default VideoPage;