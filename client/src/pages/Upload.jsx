import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Upload = () => {
    const API_BASE = 'http://localhost:5000/api';
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [file, setFile] = useState(null);
    const [thumbnail, setThumbnail] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(null);
    const [message, setMessage] = useState('');
    const [videoInfo, setVideoInfo] = useState(null);

    const navigate = useNavigate();
    const { auth } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();

        const token = auth?.token;
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
        setProgress(0);
        setMessage('Uploading...');

        try {
            const res = await fetch(`${API_BASE}/videos/upload`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                body: formData,
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || `Upload failed with status ${res.status}`);
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });

                let parts = buffer.split('\n\n');
                buffer = parts.pop(); // leave incomplete chunk

                for (const part of parts) {
                    const match = part.match(/^data:\s*(.*)$/m);
                    if (match) {
                        const json = JSON.parse(match[1]);
                        if (json.message) setMessage(json.message);
                        if (json.percent != null) setProgress(json.percent);
                        if (json.done) {
                            // Upload finished, now refetch final JSON
                            const finalJson = await res.json().catch(() => null);
                            if (finalJson) {
                                setVideoInfo(finalJson);
                                navigate(`/video/${finalJson._id}`);
                            }
                            break;
                        }
                    }
                }
            }

            setMessage('✅ Upload complete');
            setProgress(100);
        } catch (err) {
            setMessage(`❌ Upload failed: ${err.message}`);
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

            {progress !== null && (
                <div style={{ marginTop: '20px' }}>
                    <p>{message}</p>
                    <progress value={progress} max="100" style={{ width: '100%' }} />
                </div>
            )}

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
