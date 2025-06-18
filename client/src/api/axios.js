import { lockRefresh } from './refreshQueue';
import axios from 'axios'
const instance = axios.create({
    baseURL: 'http://localhost:5000/api',
    withCredentials: true, // Send refresh token in cookies
});

export const setupAxiosInterceptors = (getToken, onTokenRefreshFail, onTokenRefreshed) => {
    instance.interceptors.request.use(config => {
        const token = getToken();
        if (token) config.headers['Authorization'] = `Bearer ${token}`;
        return config;
    });

    instance.interceptors.response.use(
        res => res,
        async err => {
            const originalRequest = err.config;

            if (err.response?.status === 401 && !originalRequest._retry) {
                originalRequest._retry = true;
                try {
                    const data = await lockRefresh();
                    onTokenRefreshed({ token: data.accessToken, userId: data.userId });

                    originalRequest.headers['Authorization'] = `Bearer ${data.accessToken}`;
                    return instance(originalRequest);
                } catch (e) {
                    onTokenRefreshFail();
                    return Promise.reject(e);
                }
            }

            return Promise.reject(err);
        }
    );
};
