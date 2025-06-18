import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API_BASE = 'http://localhost:5000/api';

const Upload = () => {
    const { auth } = useAuth();
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [file, setFile] = useState(null);
    const [thumbnail, setThumbnail] = useState(null);
    const [generatedThumbnails, setGeneratedThumbnails] = useState([]);
    const [selectedThumbnail, setSelectedThumbnail] = useState(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [progress, setProgress] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [message, setMessage] = useState('');
    const videoRef = useRef();

    const handleVideoDrop = (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('video/')) {
            setFile(file);
            setGeneratedThumbnails([]);
            setStep(2);
        }
    };

    const handleThumbnailDrop = (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            setThumbnail(file);
        }
    };

    const generateThumbnails = () => {
        const video = videoRef.current;
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        const duration = video.duration;
        const interval = duration / 5;
        const thumbnails = [];

        for (let i = 1; i <= 5; i++) {
            const time = i * interval;
            const capture = new Promise(resolve => {
                video.currentTime = time;
                video.onseeked = () => {
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    context.drawImage(video, 0, 0);
                    canvas.toBlob(blob => {
                        const url = URL.createObjectURL(blob);
                        resolve({ blob, url });
                    }, 'image/jpeg');
                };
            });
            thumbnails.push(capture);
        }

        Promise.all(thumbnails).then(setGeneratedThumbnails);
    };

    const handleSubmit = async () => {
        const token = auth?.token;
        if (!token || !file || !title || !description) return;

        const formData = new FormData();
        formData.append('title', title);
        formData.append('description', description);
        formData.append('video', file);
        if (selectedThumbnail?.blob) {
            formData.append('thumbnail', selectedThumbnail.blob, 'thumbnail.jpg');
        } else if (thumbnail) {
            formData.append('thumbnail', thumbnail);
        }

        setUploading(true);
        setMessage('Uploading...');
        setProgress(0);

        try {
            const res = await fetch(`${API_BASE}/videos/upload`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                body: formData,
            });

            if (!res.ok) throw new Error('Upload failed');

            const finalJson = await res.json();
            setMessage('✅ Upload complete');
            setProgress(100);
            navigate(`/video/${finalJson._id}`);
        } catch (err) {
            setMessage(`❌ Upload failed: ${err.message}`);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div style={{ maxWidth: '700px', margin: 'auto', padding: '20px' }}>
            <h2>Upload Video</h2>
            <p>Step {step} of 3</p>

            {step === 1 && (
                <div
                    onDrop={handleVideoDrop}
                    onDragOver={(e) => e.preventDefault()}
                    style={{
                        border: '2px dashed #aaa',
                        padding: '40px',
                        textAlign: 'center',
                        marginBottom: '20px',
                        borderRadius: '10px'
                    }}
                >
                    <p>Drag & drop your video here</p>
                    <input
                        type="file"
                        accept="video/*"
                        onChange={(e) => {
                            setFile(e.target.files[0]);
                            setGeneratedThumbnails([]);
                            setStep(2);
                        }}
                    />
                </div>
            )}

            {step === 2 && file && (
                <>
                    <video
                        src={URL.createObjectURL(file)}
                        ref={videoRef}
                        controls
                        style={{ width: '100%', marginBottom: '10px' }}
                        onLoadedMetadata={generateThumbnails}
                    />
                    <h4>Select a Thumbnail</h4>
                    <div style={{ display: 'flex', gap: '10px', overflowX: 'auto' }}>
                        {generatedThumbnails.map((t, i) => (
                            <img
                                key={i}
                                src={t.url}
                                alt={`thumb-${i}`}
                                onClick={() => setSelectedThumbnail(t)}
                                style={{
                                    width: '120px',
                                    height: 'auto',
                                    cursor: 'pointer',
                                    border: selectedThumbnail?.url === t.url ? '3px solid green' : '2px solid gray'
                                }}
                            />
                        ))}
                    </div>

                    <p>Or drag and drop a custom image:</p>
                    <div
                        onDrop={handleThumbnailDrop}
                        onDragOver={(e) => e.preventDefault()}
                        style={{
                            border: '2px dashed #aaa',
                            padding: '20px',
                            textAlign: 'center',
                            margin: '10px 0',
                            borderRadius: '10px'
                        }}
                    >
                        <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => setThumbnail(e.target.files[0])}
                        />
                        {thumbnail && <p>Selected: {thumbnail.name}</p>}
                    </div>

                    <button onClick={() => setStep(3)}>Next</button>
                </>
            )}

            {step === 3 && (
                <>
                    <input
                        placeholder="Video Title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required
                        style={{ width: '100%', marginBottom: '10px', padding: '8px' }}
                    />
                    <textarea
                        placeholder="Video Description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={4}
                        required
                        style={{ width: '100%', padding: '8px' }}
                    />
                    <button onClick={handleSubmit} disabled={uploading}>
                        {uploading ? 'Uploading...' : 'Submit'}
                    </button>
                </>
            )}

            {progress !== null && (
                <div style={{ marginTop: '20px' }}>
                    <p>{message}</p>
                    <progress value={progress} max="100" style={{ width: '100%' }} />
                </div>
            )}
        </div>
    );
};

export default Upload;
