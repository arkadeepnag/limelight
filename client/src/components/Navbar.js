import React, { useEffect, useState, useRef } from 'react';
import "../styles/navbar.css";
import SearchBar from '../components/SearchBar';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getUserInfo } from '../api';

const Navbar = () => {
    const { auth, logout, accounts, switchAccount, removeAccount } = useAuth();
    const navigate = useNavigate();
    const [userData, setUserData] = useState(null);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef();

    useEffect(() => {
        if (auth?.token && auth?.userId) {
            getUserInfo(auth.userId, auth.token)
                .then(setUserData)
                .catch(err => console.error('Failed to fetch user data:', err));
        }
    }, [auth]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const handleSwitchAccount = (userId) => {
        switchAccount(userId);
        setDropdownOpen(false);
        navigate('/');
    };

    const handleRemoveAccount = (userId) => {
        removeAccount(userId);
        if (auth?.userId === userId) {
            navigate('/login');
        }
    };

    const handleProfileClick = () => navigate(`/channel/${auth?.userId}`);
    const handleHistoryClick = () => navigate('/watch-history');

    return (
        <div className="navbar">
            <SearchBar />
            {auth?.token && userData && (
                <div className="profile-section" ref={dropdownRef}>
                    <img
                        src={userData.profilePicture}
                        alt="Profile"
                        className="profile-picture"
                        onClick={() => setDropdownOpen(prev => !prev)}
                    />


                    {dropdownOpen && (
                        <div className="dropdown-menu">
                            {/* Current user info */}
                            <div className="current-user">
                                <img src={userData.profilePicture} alt="Profile" className="dropdown-profile-pic" />
                                <div className="user-info">
                                    <strong>{userData.name}</strong>

                                </div>
                            </div>

                            <button onClick={handleProfileClick}>👤 Profile</button>
                            <button onClick={handleHistoryClick}>🕓 Watch History</button>
                            <button onClick={handleLogout}>🚪 Logout</button>

                            <hr />

                            <div className="account-switch-section">
                                <strong>Switch Accounts:</strong>
                                {accounts
                                    .filter(acc => acc.userId !== auth.userId)
                                    .map(acc => (
                                        <AccountItem
                                            key={acc.userId}
                                            account={acc}
                                            onSwitch={handleSwitchAccount}
                                            onRemove={handleRemoveAccount}
                                        />
                                    ))}
                                <button className="add-account-button" onClick={() => navigate('/login')}>
                                    ➕ Add Account
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// 👤 AccountItem component to fetch name/pic for each saved account
const AccountItem = ({ account, onSwitch, onRemove }) => {
    const [info, setInfo] = useState(null);

    useEffect(() => {
        getUserInfo(account.userId, account.token)
            .then(setInfo)
            .catch(() => setInfo({ name: account.userId }));
    }, [account]);

    return (
        <div className="switch-account-item">
            <div className="switch-account-left" onClick={() => onSwitch(account.userId)}>
                <img
                    src={info?.profilePicture || '/default-avatar.png'}
                    alt="User"
                    className="switch-avatar"
                />
                <span>{info?.name || account.userId}</span>
            </div>
            <button className="remove-account" onClick={() => onRemove(account.userId)}>❌</button>
        </div>
    );
};

export default Navbar;
