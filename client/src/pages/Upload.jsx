import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadVideo } from '../api';

const Upload = () => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [file, setFile] = useState(null);
    const [thumbnail, setThumbnail] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [videoInfo, setVideoInfo] = useState(null);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();

        const token = localStorage.getItem('token');
        if (!token) {
            alert('Login required');
            return;
        }

        if (!file) {
            alert('Please select a video file');
            return;
        }

        const formData = new FormData();
        formData.append('title', title);
        formData.append('description', description);
        formData.append('video', file);
        if (thumbnail) {
            formData.append('thumbnail', thumbnail);
        }

        setUploading(true);
        try {
            const videoData = await uploadVideo(formData, token);
            setVideoInfo(videoData);
            alert('Upload successful!');
            navigate(`/video/${videoData._id}`);
        } catch (err) {
            alert('Upload failed.');
            console.error(err);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div style={{ maxWidth: '600px', margin: 'auto' }}>
            <h2>Upload Video</h2>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Title"
                    required
                />
                <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Description"
                    rows={4}
                    required
                />
                <input
                    type="file"
                    accept="video/*"
                    onChange={(e) => setFile(e.target.files[0])}
                    required
                />
                {file && <p>Selected video: {file.name}</p>}

                <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setThumbnail(e.target.files[0])}
                />
                {thumbnail && <p>Selected thumbnail: {thumbnail.name}</p>}

                <button type="submit" disabled={uploading}>
                    {uploading ? 'Uploading...' : 'Upload'}
                </button>
            </form>

            {videoInfo && (
                <div style={{ marginTop: '20px' }}>
                    <h3>Uploaded Video Info</h3>
                    <p><strong>Title:</strong> {videoInfo.title}</p>
                    <p><strong>Duration:</strong> {Math.round(videoInfo.duration)} seconds</p>
                    {videoInfo.thumbnailPath && (
                        <img
                            src={`/uploads/${videoInfo.thumbnailPath}`}
                            alt="Thumbnail"
                            style={{ width: '320px', borderRadius: '8px', marginTop: '10px' }}
                        />
                    )}
                </div>
            )}
        </div>
    );
};

export default Upload;
