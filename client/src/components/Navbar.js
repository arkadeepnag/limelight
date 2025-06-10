import React, { useEffect, useState, useRef } from 'react';
import "../styles/navbar.css";
import SearchBar from '../components/SearchBar';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getUserInfo } from '../api';

const Navbar = () => {
    const { auth, logout } = useAuth();
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
                            <button onClick={handleProfileClick}>Profile</button>
                            <button onClick={handleHistoryClick}>Watch History</button>
                            <button onClick={handleLogout}>Logout</button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Navbar;
