import { createContext, useContext, useEffect, useState } from 'react';
import { lockRefresh } from '../api/refreshQueue';
import { setupAxiosInterceptors } from '../api/axios';

const AuthContext = createContext();

const ACCOUNTS_KEY = 'accounts';
const CURRENT_USER_KEY = 'currentUser';

const getAccountsFromStorage = () => {
    const saved = localStorage.getItem(ACCOUNTS_KEY);
    return saved ? JSON.parse(saved) : [];
};

const getCurrentAuth = () => {
    const current = localStorage.getItem(CURRENT_USER_KEY);
    return current ? JSON.parse(current) : null;
};

export const AuthProvider = ({ children }) => {
    const [accounts, setAccounts] = useState(getAccountsFromStorage);
    const [auth, setAuth] = useState(getCurrentAuth);

    const saveAccounts = (accs) => {
        localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accs));
        setAccounts(accs);
    };

    const saveCurrentAuth = (authObj) => {
        if (authObj) {
            localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(authObj));
        } else {
            localStorage.removeItem(CURRENT_USER_KEY);
        }
        setAuth(authObj);
    };

    const login = ({ token, userId }) => {
        const newAccount = { token, userId };
        const updated = [...accounts.filter(acc => acc.userId !== userId), newAccount];
        saveAccounts(updated);
        saveCurrentAuth(newAccount);
    };

    const logout = () => {
        saveCurrentAuth(null);
        setAccounts(prev => prev.filter(acc => acc.userId !== auth?.userId));
        window.localStorage.setItem('logout', Date.now()); // notify all tabs
    };

    const switchAccount = (userId) => {
        const account = accounts.find(acc => acc.userId === userId);
        if (account) saveCurrentAuth(account);
    };

    const removeAccount = (userId) => {
        const updated = accounts.filter(acc => acc.userId !== userId);
        saveAccounts(updated);
        if (auth?.userId === userId) saveCurrentAuth(null);
    };

    // ✅ Setup axios interceptor on mount and auth change
    useEffect(() => {
        setupAxiosInterceptors(
            () => auth?.token,
            logout,
            login // <- needed to update token when refreshToken succeeds
        );
    }, [auth]);

    // ✅ Cross-tab logout listener
    useEffect(() => {
        const handleLogout = (e) => {
            if (e.key === 'logout') {
                setAuth(null);
            }
        };
        window.addEventListener('storage', handleLogout);
        return () => window.removeEventListener('storage', handleLogout);
    }, []);

    // ✅ Auto refresh token every 14 minutes
    useEffect(() => {
        const interval = setInterval(async () => {
            if (auth?.userId) {
                try {
                    const data = await lockRefresh();
                    login({ token: data.accessToken, userId: data.userId });
                    console.log('🔁 Token proactively refreshed');
                } catch (err) {
                    console.error('🛑 Auto-refresh failed:', err.message);
                    logout();
                }
            }
        }, 14 * 60 * 1000);

        return () => clearInterval(interval);
    }, [auth?.userId]);

    return (
        <AuthContext.Provider value={{
            auth,
            login,
            logout,
            switchAccount,
            removeAccount,
            accounts,
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
