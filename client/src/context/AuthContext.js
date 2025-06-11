// src/context/AuthContext.js
import { createContext, useContext, useEffect, useState } from 'react';

const AuthContext = createContext();

const getAccountsFromStorage = () => {
    const saved = sessionStorage.getItem('accounts');
    return saved ? JSON.parse(saved) : [];
};

const getCurrentAuth = () => {
    const current = sessionStorage.getItem('currentUser');
    return current ? JSON.parse(current) : null;
};

export const AuthProvider = ({ children }) => {
    const [accounts, setAccounts] = useState(getAccountsFromStorage);
    const [auth, setAuth] = useState(getCurrentAuth);

    const saveAccounts = (accs) => {
        sessionStorage.setItem('accounts', JSON.stringify(accs));
        setAccounts(accs);
    };

    const login = ({ token, userId }) => {
        const newAccount = { token, userId };

        const updated = [...accounts.filter(acc => acc.userId !== userId), newAccount];
        saveAccounts(updated);
        sessionStorage.setItem('currentUser', JSON.stringify(newAccount));
        setAuth(newAccount);
    };

    const logout = () => {
        sessionStorage.clear();
        setAccounts([]);
        setAuth(null);
    };

    const switchAccount = (userId) => {
        const account = accounts.find(acc => acc.userId === userId);
        if (account) {
            sessionStorage.setItem('currentUser', JSON.stringify(account));
            setAuth(account);
        }
    };

    const removeAccount = (userId) => {
        const updated = accounts.filter(acc => acc.userId !== userId);
        saveAccounts(updated);

        const current = auth?.userId === userId ? null : auth;
        sessionStorage.setItem('currentUser', JSON.stringify(current));
        setAuth(current);
    };

    return (
        <AuthContext.Provider
            value={{ auth, login, logout, switchAccount, accounts, removeAccount }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
