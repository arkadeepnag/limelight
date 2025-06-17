const API_BASE = 'http://localhost:5000/api';

export const register = async (data) => {
    const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    return res.json();
};

export const login = async (data) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    return res.json();
};

export const getVideos = async () => {
    const res = await fetch(`${API_BASE}/videos`);
    return res.json();
};

export const getVideo = async (id) => {
    const res = await fetch(`${API_BASE}/videos/${id}`);
    return res.json();
};
export const getVideosByUserId = async (userId, token) => {
    // Construct the URL using the base API and the new route for fetching videos by user ID
    const res = await fetch(`${API_BASE}/user/videos/${userId}`, {
        method: 'GET', // Explicitly specify GET method
        headers: {
            'Content-Type': 'application/json', // Indicate that we expect JSON back
            'Authorization': `Bearer ${token}` // Include the authorization token for authenticated access
        }
    });

    // Check if the response was successful
    if (!res.ok) {
        // If not successful, throw an error with more detail
        const errorData = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(`Failed to fetch videos for user ${userId}: ${errorData.message}`);
    }

    // Parse and return the JSON response
    return res.json();
};
export const uploadVideo = async (formData, token) => {
    const res = await fetch(`${API_BASE}/videos/upload`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
        },
        body: formData,
    });

    if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const message = errData.message || `Upload failed with status ${res.status}`;
        throw new Error(message);
    }

    return res.json(); // safe to parse here
};


export const deleteVideo = async (id, token) => {
    const res = await fetch(`${API_BASE}/videos/${id}`, {
        method: 'DELETE',
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
    return res.json();
};

export const getSuggestedVideos = async () => {
    const res = await fetch(`${API_BASE}/videos/suggested`);
    return res.json();
};
export const likeVideo = (id, token) =>
    fetch(`${API_BASE}/videos/${id}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
    }).then(res => res.json());

export const dislikeVideo = (id, token) =>
    fetch(`${API_BASE}/videos/${id}/dislike`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
    }).then(res => res.json());

export const addComment = async (id, comment, token) => {
    const res = await fetch(`${API_BASE}/videos/${id}/comment`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ comment }),
    });

    const data = await res.json().catch(() => ({})); // handle invalid JSON

    if (!res.ok) {
        const error = new Error(data.message || 'Failed to add comment');
        error.status = res.status;
        error.body = data;
        throw error;
    }

    return data;
};



export const getComments = (id, token) =>
    fetch(`${API_BASE}/videos/${id}/comments`, {
        headers: { Authorization: `Bearer ${token}` },
    }).then(res => res.json());

export const getUserInfo = (id, token) =>
    fetch(`${API_BASE}/user/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
    }).then(res => res.json());


export const watchVideo = (id, token) =>
    fetch(`${API_BASE}/videos/${id}/watch`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
        },
    }).then(res => res.json());

export const searchVideos = (query) =>
    fetch(`${API_BASE}/utilities/search?q=${encodeURIComponent(query)}`)
        .then(res => {
            if (!res.ok) {
                throw new Error('Search request failed');
            }
            return res.json();
        })
        .catch((err) => {
            console.error('Search error:', err.message);
            return { error: err.message };
        });
export const unsubscribe = (uploaderId, userId, token) =>
    fetch(`${API_BASE}/user/unsubscribe`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
            subscriberId: userId,
            targetUserId: uploaderId,
        }),
    }).then(res => {
        if (!res.ok) throw new Error('Failed to unsubscribe');
        return res.json();
    });

export const subscribe = (uploaderId, userId, token) =>
    fetch(`${API_BASE}/user/subscribe`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
            subscriberId: userId,     // Ensure `token` is actually the user ID here
            targetUserId: uploaderId
        }),
    }).then(res => {
        if (!res.ok) throw new Error('Failed to subscribe');
        return res.json();
    });

export const getAllComments = async (videoId, limit = 10, skip = 0, token) => {
    const res = await fetch(`${API_BASE}/videos/${videoId}/comments?=${limit}&skip=${skip}`, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });
    if (!res.ok) throw new Error('Failed to fetch comments');
    return res.json();
};
export const updateProfileImage = async (profilePicFile, bannerFile, userId, token) => {
    const formData = new FormData();

    if (profilePicFile) formData.append('profilePicture', profilePicFile);
    if (bannerFile) formData.append('banner', bannerFile);
    formData.append('userId', userId); // append manually

    return fetch(`${API_BASE}/user/update-profile-images`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`, // Only Authorization header is needed
        },
        body: formData,
    }).then(res => {
        if (!res.ok) throw new Error('Failed to update profile images');
        return res.json();
    });
};
