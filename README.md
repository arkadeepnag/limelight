# LimeLight

**LimeLight** is a full-featured video sharing platform built with modern web technologies. It offers a secure and scalable infrastructure for both creators and viewers, with features like video transcripts, advanced search, multi-account support, and a custom video player.

---

## Features

### Video Playback
- HLS-based streaming for adaptive and secure video delivery
- Custom-built video player with keyboard shortcuts and caption toggling
- Transcript-enabled captions powered by Vosk for real-time subtitle display

### Transcript and Smart Search
- Full transcript support for each video using Vosk and MongoDB
- Advanced search capabilities that include spoken words (e.g., lyrics, hymns, speeches)

### User Authentication
- Multi-device login system
- Multi-account switching with persistent sessions using Redis
- Secure session handling with React `AuthContext`

### Engagement and Interaction
- Like, comment, and report system for viewer interaction
- View count tracking for analytics
- Hashtag detection with automatic linking
- Trending videos based on real-time activity
- Channel subscription support
- Personalized video suggestions based on history and interactions

### User Experience
- Watch history and recently watched videos
- User/channel profile management
- Upload support using local storage and `Multer`

---

## Technology Stack

### Backend
- **Node.js** with **Express.js** – REST API server
- **MongoDB** – NoSQL database for video, user, and transcript data
- **Redis** – Session and token management
- **Vosk** – Offline speech-to-text transcription engine
- **HLS (HTTP Live Streaming)** – Adaptive video streaming
- **Multer** – File uploads and disk storage handling

### Frontend
- **React.js** – Component-based frontend framework
- **AuthContext** – React Context for authentication and session handling
- **Custom Video Player** – Built with HTML5 APIs , Plyr and React hooks
