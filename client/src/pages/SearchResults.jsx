import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { searchVideos } from '../api';
import "../styles/SearchResults.css"

const SearchResults = () => {
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [params] = useSearchParams();
    const query = params.get('q');

    useEffect(() => {
        const fetchResults = async () => {
            try {
                const res = await searchVideos(query);
                setResults(res);
            } catch (err) {
                console.error('Search failed:', err);
            } finally {
                setLoading(false);
            }
        };

        if (query) fetchResults();
    }, [query]);
    function getDescriptionSnippet(description) {
        // Check for a full stop within the first 100 characters
        const first100Chars = description.substring(0, 100);
        const fullStopIndex = first100Chars.indexOf('.');

        if (fullStopIndex !== -1) {
            // If a full stop is found, return the text up to and including it
            return description.substring(0, fullStopIndex + 1);
        } else {
            // If no full stop in the first 100 characters, get the first 50 words
            const words = description.split(/\s+/); // Split by one or more spaces
            return words.slice(0, 50).join(' '); // Join the first 50 words back into a string
        }
    }
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
        <div>

            {loading ? (
                <p>Loading...</p>
            ) : results.length === 0 ? (
                <p>No videos found.</p>
            ) : (
                <ul>
                    {results.map((video) => (

                        <li key={video._id} class="result">
                            <Link to={`/video/${video._id}`}>
                                {video.thumbnailPath ? (

                                    <div class="thumbnailContainer">
                                        <img
                                            src={`http://localhost:5000/${video.thumbnailPath}`}
                                            alt="thumbnail"
                                            class="thumbnailSearch"
                                        />
                                        <div class="timePeriod">{formatDuration(video.duration)}</div>
                                    </div>
                                ) : null}
                                <div className="videoDetails">
                                    <strong className="videoTitle">{video.title}</strong>
                                    <p className="videoDescription">{getDescriptionSnippet(video.description)}</p>
                                    <p>{video.viewCount || 0} views • {video.likes?.length || 0} likes</p>

                                    <p className="uploader">
                                        <img src={`${video.uploadedBy?.profilePicture}`} class="profilePictureHome" />
                                        <b>{video.uploadedBy?.name || "Uploader"}</b>
                                    </p>
                                </div>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default SearchResults;
