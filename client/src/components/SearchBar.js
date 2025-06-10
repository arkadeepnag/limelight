import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom'; // Import useLocation
import { BiSearch } from "react-icons/bi";

const SearchBar = () => {
    const [query, setQuery] = useState('');
    const navigate = useNavigate();
    const location = useLocation(); // Initialize useLocation

    // Effect to update query state when location changes (e.g., direct navigation to /search?q=...)
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const qParam = params.get('q');
        if (location.pathname === '/search' && qParam) {
            setQuery(decodeURIComponent(qParam));
        } else if (location.pathname !== '/search' && query) {
            // Clear query if navigating away from /search and query is not empty
            setQuery('');
        }
    }, [location.pathname, location.search]); // Depend on pathname and search for updates

    const handleSubmit = (e) => {
        e.preventDefault();
        if (query.trim()) {
            navigate(`/search?q=${encodeURIComponent(query.trim())}`);
        }
    };

    return (
        <form className="searchBar" onSubmit={handleSubmit}>
            <button type="submit">
                <BiSearch />
            </button>
            <input
                type="text"
                placeholder="Search videos..."
                value={query} // Input value is controlled by the 'query' state
                onChange={(e) => setQuery(e.target.value)}
            />

        </form>
    );
};

export default SearchBar;