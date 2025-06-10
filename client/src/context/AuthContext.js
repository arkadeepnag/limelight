// src/context/AuthContext.js
import { createContext, useContext, useEffect, useState } from 'react';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [auth, setAuth] = useState(() => {
        const token = sessionStorage.getItem('token');
        const userId = sessionStorage.getItem('userId');
        return token && userId ? { token, userId } : null;
    });

    const login = ({ token, userId }) => {
        sessionStorage.setItem('token', token);
        sessionStorage.setItem('userId', userId);
        setAuth({ token, userId });
    };

    const logout = () => {
        sessionStorage.clear();
        setAuth(null);
    };

    return (
        <AuthContext.Provider value={{ auth, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

// Access anywhere
export const useAuth = () => useContext(AuthContext);
