import React, { useEffect, useState } from 'react';
import { getVideos, getSuggestedVideos } from '../api';
import { Link } from 'react-router-dom';
import Skeleton from 'react-loading-skeleton';

import 'react-loading-skeleton/dist/skeleton.css';

const VideoCard = ({ video }) => {
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

    const thumbnailUrl = video.thumbnailPath
        ? `http://localhost:5000/${video.thumbnailPath}`
        : null;
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
        <div className="card">
            <Link to={`/channel/${video.uploadedBy?._doc?._id}`} className="link">
                <p className="uploader homeUploader">
                    <img src={`${video.uploadedBy?._doc?.profilePicture}`} class="profilePictureHome" />
                    <b>{video.uploadedBy?._doc?.name || "Uploader"}</b>
                </p>
            </Link>
            <Link to={`/video/${video._id}`} className="link">

                <div class="thumbnailContainer">
                    <img
                        src={thumbnailUrl}
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
    );
};

const Home = () => {
    const [videos, setVideos] = useState([]);
    const [suggested, setSuggested] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAll = async () => {
            try {
                const [all, suggestedList] = await Promise.all([
                    getVideos(),
                    getSuggestedVideos(),
                ]);
                setVideos(all);
                setSuggested(suggestedList);
            } catch (err) {
                console.error('Error loading videos', err);
            } finally {
                setLoading(false);
            }
        };
        fetchAll();
    }, []);

    const renderSkeletons = (count = 50) => (
        <div className="videoGrid">
            {Array.from({ length: count }).map((_, idx) => (
                <div key={idx} className="card">
                    <Skeleton height={180} />
                    <Skeleton count={2} />
                </div>
            ))}
        </div>
    );

    return (
        <div className="videoContainer">


            {loading ? renderSkeletons(50) : (
                <div className="videoGrid">
                    {suggested.map((video) => (
                        <VideoCard key={video._id} video={video} />
                    ))}
                </div>
            )}


        </div>
    );
};


export default Home;
