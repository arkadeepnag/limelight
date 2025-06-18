import React, { useEffect, useState } from 'react';
import { getWatchHistory } from '../api'; // Make sure this API exists
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

const WatchHistory = () => {
    const { auth } = useAuth();
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const data = await getWatchHistory(auth.userId, auth.token);
                setHistory(data);
            } catch (err) {
                console.error(err);
                setError('Failed to fetch watch history.');
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, [auth.userId, auth.token]);

    const timeSinceUpload = (uploadDateString) => {
        const uploadDate = new Date(uploadDateString);
        const now = new Date();
        const diffMs = now - uploadDate;

        const seconds = Math.floor(diffMs / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        const months = Math.floor(days / 30);
        const years = Math.floor(days / 365);

        if (years > 0) return `${years} year${years > 1 ? 's' : ''} ago`;
        if (months > 0) return `${months} month${months > 1 ? 's' : ''} ago`;
        if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
        if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        return `${seconds <= 1 ? 'just now' : `${seconds} seconds ago`}`;
    };

    const formatDuration = (durationInSeconds) => {
        const total = Math.floor(durationInSeconds);
        const hrs = Math.floor(total / 3600);
        const mins = Math.floor((total % 3600) / 60);
        const secs = total % 60;

        return hrs > 0
            ? `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
            : `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    if (loading) return <div className="watch-history-loading">Loading...</div>;
    if (error) return <div className="watch-history-error">{error}</div>;

    return (
        <div className="watch-history-container">
            <h2 className="watch-history-title">Watch History</h2>

            {history.length === 0 ? (
                <p className="watch-history-empty">You haven't watched anything yet.</p>
            ) : (
                <div className="video-list">
                    {history.map((item, idx) => {
                        const video = item.video; // because history is [{ video: {..}, watchedAt: Date }]
                        if (!video) return null;
                        return (
                            <div className="card" key={idx}>
                                <Link to={`/video/${video._id}`} className="link">
                                    <div className="thumbnailContainer">
                                        <img
                                            src={`http://localhost:5000/${video.thumbnailPath}`}
                                            alt="Thumbnail"
                                            className="thumbnail"
                                        />
                                        <div className="timePeriod">{formatDuration(video.duration)}</div>
                                    </div>

                                    <div className="meta">
                                        <div className="stats">
                                            <p>{video.viewCount || "No"} views</p>
                                            <p>Watched {timeSinceUpload(item.watchedAt)}</p>
                                        </div>
                                        <h3 className="title">{video.title}</h3>
                                    </div>
                                </Link>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default WatchHistory;
