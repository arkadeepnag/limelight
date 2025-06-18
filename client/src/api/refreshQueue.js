let refreshPromise = null;

export const lockRefresh = () => {
    if (!refreshPromise) {
        refreshPromise = new Promise(async (resolve, reject) => {
            try {
                const res = await fetch('http://localhost:5000/api/auth/refresh', {
                    method: 'POST',
                    credentials: 'include',
                });

                if (!res.ok) throw new Error('Refresh failed');

                const data = await res.json();
                localStorage.setItem('token', data.accessToken); // or use context
                resolve(data);
            } catch (err) {
                reject(err);
            } finally {
                refreshPromise = null;
            }
        });
    }

    return refreshPromise;
};
