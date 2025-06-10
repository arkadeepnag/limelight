import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import {
    FaAngleLeft, FaAngleRight
} from 'react-icons/fa';
import { BiPlay, BiSolidVolumeFull, BiSolidVolumeMute, BiSliderAlt, BiExpandAlt, BiExitFullscreen, BiPause, BiFastForward, BiRewind } from "react-icons/bi";


import './CustomVideoPlayer.css';

// --- Helper function to format time in MM:SS format ---
const formatTime = (timeInSeconds) => {
    const seconds = Math.floor(timeInSeconds);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const CustomVideoPlayer = ({ src, poster = '' }) => {
    // --- Refs for DOM Elements ---
    const videoRef = useRef(null);
    const playerContainerRef = useRef(null);
    const timelineRef = useRef(null);
    const settingsPanelRef = useRef(null);
    const settingsButtonRef = useRef(null);

    // --- Refs for Logic ---
    const controlsTimeoutRef = useRef(null);
    const hlsRef = useRef(null);

    // --- Player State ---
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(true); // Start muted for autoplay
    const [volume, setVolume] = useState(1);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [bufferedTime, setBufferedTime] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1);

    // --- HLS Quality State ---
    const [qualityOptions, setQualityOptions] = useState([]);
    const [currentQuality, setCurrentQuality] = useState(-1); // -1 for auto

    // --- UI State ---
    const [showControls, setShowControls] = useState(true);
    const [showSettings, setShowSettings] = useState(false);
    const [settingsView, setSettingsView] = useState('main'); // 'main', 'quality', or 'speed'
    const [seekFeedback, setSeekFeedback] = useState({ show: false, type: 'forward' });

    // --- Effect for HLS.js Initialization and Video Event Listeners ---
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const defaultOptions = {};
        if (Hls.isSupported()) {
            const hls = new Hls(defaultOptions);
            hlsRef.current = hls;
            hls.loadSource(src);
            hls.attachMedia(video);

            hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
                const options = data.levels.map((level, index) => ({
                    label: `${level.height}p`,
                    value: index
                }));
                setQualityOptions([{ label: 'Auto', value: -1 }, ...options]);
                setCurrentQuality(hls.currentLevel);
            });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = src;
        }

        // Set muted to true initially for autoplay
        video.muted = true;
        setIsMuted(true);

        // Attempt to play the video as soon as it's ready
        const attemptAutoplayAndUnmute = () => {
            video.play().then(() => {

            }).catch(error => {
                // Autoplay was prevented. User interaction is required.
                console.warn('Autoplay prevented:', error);
                setIsPlaying(false); // Ensure play button is visible
            });
        };

        // Listen for canplaythrough event to attempt autoplay
        video.addEventListener('canplaythrough', attemptAutoplayAndUnmute);


        const handleTimeUpdate = () => setCurrentTime(video.currentTime);
        const handleDurationChange = () => setDuration(video.duration);
        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);
        const handleVolumeChange = () => { setVolume(video.volume); setIsMuted(video.muted); };
        const handleProgress = () => { if (video.buffered.length > 0) setBufferedTime(video.buffered.end(video.buffered.length - 1)); };
        const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);

        video.addEventListener('timeupdate', handleTimeUpdate);
        video.addEventListener('durationchange', handleDurationChange);
        video.addEventListener('play', handlePlay);
        video.addEventListener('pause', handlePause);
        video.addEventListener('volumechange', handleVolumeChange);
        video.addEventListener('progress', handleProgress);
        document.addEventListener('fullscreenchange', handleFullscreenChange);

        return () => {
            if (hlsRef.current) hlsRef.current.destroy();
            video.removeEventListener('timeupdate', handleTimeUpdate);
            video.removeEventListener('durationchange', handleDurationChange);
            video.removeEventListener('play', handlePlay);
            video.removeEventListener('pause', handlePause);
            video.removeEventListener('volumechange', handleVolumeChange);
            video.removeEventListener('progress', handleProgress);
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            video.removeEventListener('canplaythrough', attemptAutoplayAndUnmute); // Clean up the event listener
        };
    }, [src]);

    // --- Effect for Custom Timeline Fill ---
    useEffect(() => {
        const timeline = timelineRef.current;
        if (!timeline) return;
        const percentage = duration > 0 ? (currentTime / duration) * 100 : 0;
        timeline.style.background = `linear-gradient(to right, #007bff ${percentage}%, rgba(255, 255, 255, 0.4) ${percentage}%)`;
    }, [currentTime, duration]);

    // --- Effect for Keyboard Controls ---
    useEffect(() => {
        const player = playerContainerRef.current;
        if (!player) return;
        const handleKeyDown = (e) => {
            const tagName = document.activeElement.tagName.toLowerCase();
            if (tagName === 'input' || tagName === 'textarea') return;
            switch (e.key.toLowerCase()) {
                case ' ': e.preventDefault(); togglePlayPause(); break;
                case 'f': toggleFullscreen(); break;
                case 'escape': if (document.fullscreenElement) document.exitFullscreen(); break;
                case 'arrowright': videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 5); break;
                case 'arrowleft': videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 5); break;
                case 'arrowup': videoRef.current.volume = Math.min(1, videoRef.current.volume + 0.1); break;
                case 'arrowdown': videoRef.current.volume = Math.max(0, videoRef.current.volume - 0.1); break;
                case 'm': toggleMute(); break;
                case '0': videoRef.current.currentTime = 0; break;
                default: break;
            }
        };
        player.addEventListener('keydown', handleKeyDown);
        return () => player.removeEventListener('keydown', handleKeyDown);
    }, [duration]);

    // --- Effect for Closing Settings on Outside Click ---
    useEffect(() => {
        const handleOutsideClick = (event) => {
            if (showSettings && settingsPanelRef.current && !settingsPanelRef.current.contains(event.target) && settingsButtonRef.current && !settingsButtonRef.current.contains(event.target)) {
                setShowSettings(false);
            }
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, [showSettings]);

    // --- Effect to Reset Settings View When Panel is Closed ---
    useEffect(() => {
        if (!showSettings) setSettingsView('main');
    }, [showSettings]);

    // --- UI Handlers ---
    const handleMouseMove = () => {
        setShowControls(true);
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        if (isPlaying) controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
    };
    const handleMouseLeave = () => { if (isPlaying) setShowControls(false); };
    const togglePlayPause = () => { videoRef.current.paused ? videoRef.current.play() : videoRef.current.pause(); };
    const handleDoubleClick = (e) => {
        const rect = playerContainerRef.current.getBoundingClientRect();
        const isLeft = (e.clientX - rect.left) < rect.width / 2;
        const newTime = isLeft ? Math.max(0, videoRef.current.currentTime - 10) : Math.min(duration, videoRef.current.currentTime + 10);
        videoRef.current.currentTime = newTime;
        setSeekFeedback({ show: true, type: isLeft ? 'backward' : 'forward' });
        setTimeout(() => setSeekFeedback({ show: false, type: 'forward' }), 500);
    };
    const handleSeek = (e) => { videoRef.current.currentTime = parseFloat(e.target.value); };
    const toggleMute = () => { videoRef.current.muted = !videoRef.current.muted; };
    const handleVolumeChange = (e) => {
        const newVolume = parseFloat(e.target.value);
        videoRef.current.volume = newVolume;
        videoRef.current.muted = newVolume === 0;
    };
    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            playerContainerRef.current.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    };
    const changeQuality = (levelIndex) => {
        if (hlsRef.current) hlsRef.current.currentLevel = levelIndex;
        setCurrentQuality(levelIndex);
        setSettingsView('main');
    };
    const changePlaybackRate = (rate) => {
        videoRef.current.playbackRate = rate;
        setPlaybackRate(rate);
        setSettingsView('main');
    };
    const handleContextMenu = (e) => e.preventDefault();

    return (
        <div
            className={`player-container ${showControls || !isPlaying ? 'show-controls' : ''}`}
            ref={playerContainerRef}
            tabIndex="0"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onDoubleClick={handleDoubleClick}
            onContextMenu={handleContextMenu}
        >
            <video ref={videoRef} poster={poster} onClick={togglePlayPause} muted={isMuted} />

            {!isPlaying && <div className="central-play-button" onClick={togglePlayPause} ><BiPlay /></div>}

            <div className={`seek-feedback backward ${seekFeedback.show && seekFeedback.type === 'backward' ? 'visible' : ''}`}><BiRewind /></div>
            <div className={`seek-feedback forward ${seekFeedback.show && seekFeedback.type === 'forward' ? 'visible' : ''}`}><BiFastForward /></div>

            <div className="controls-container">
                <div className="timeline-container">
                    <div className="timeline-buffered" style={{ width: `${(bufferedTime / duration) * 100}%` }}></div>
                    <input ref={timelineRef} type="range" min="0" max={duration || 0} value={currentTime} onChange={handleSeek} className="timeline" />
                </div>
                <div className="bottom-controls">
                    <div className="controls-left">
                        <button className="control-button" onClick={togglePlayPause} style={{ fontSize: "2.2rem" }}>{isPlaying ? <BiPause /> : <BiPlay />}</button>
                        <div className="volume-control">
                            <button className="control-button" onClick={toggleMute}>{isMuted || volume === 0 ? <BiSolidVolumeMute /> : <BiSolidVolumeFull />}</button>
                            <input type="range" min="0" max="1" step="0.05" value={volume} onChange={handleVolumeChange} className="volume-slider" />
                        </div>
                        <span className="time-display">{formatTime(currentTime)} / {formatTime(duration)}</span>
                    </div>
                    <div className="controls-right">
                        <div className="settings-container">
                            <button ref={settingsButtonRef} className="control-button" onClick={() => setShowSettings(!showSettings)}><BiSliderAlt /></button>
                            {showSettings && (
                                <div className="settings-panel" ref={settingsPanelRef}>
                                    {settingsView === 'main' && (
                                        <>
                                            <button className="settings-menu-item" onClick={() => setSettingsView('quality')}>
                                                <span>Quality</span><span className="settings-menu-value">{qualityOptions.find(q => q.value === currentQuality)?.label || 'Auto'} <FaAngleRight /></span>
                                            </button>
                                            <button className="settings-menu-item" onClick={() => setSettingsView('speed')}>
                                                <span>Playback speed</span><span className="settings-menu-value">{playbackRate === 1 ? 'Normal' : `${playbackRate}x`} <FaAngleRight /></span>
                                            </button>
                                        </>
                                    )}
                                    {settingsView === 'quality' && (
                                        <>
                                            <button className="settings-menu-header" onClick={() => setSettingsView('main')}><FaAngleLeft /> Quality</button>
                                            {qualityOptions.map(opt => <button key={opt.value} className={`settings-option ${currentQuality === opt.value ? 'active' : ''}`} onClick={() => changeQuality(opt.value)}>{opt.label}</button>)}
                                        </>
                                    )}
                                    {settingsView === 'speed' && (
                                        <>
                                            <button className="settings-menu-header" onClick={() => setSettingsView('main')}><FaAngleLeft /> Playback speed</button>
                                            {[0.5, 0.75, 1, 1.25, 1.5, 2].map(rate => <button key={rate} className={`settings-option ${playbackRate === rate ? 'active' : ''}`} onClick={() => changePlaybackRate(rate)}>{rate === 1 ? 'Normal' : `${rate}x`}</button>)}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                        <button className="control-button" onClick={toggleFullscreen}>{isFullscreen ? <BiExitFullscreen /> : <BiExpandAlt />}</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CustomVideoPlayer;