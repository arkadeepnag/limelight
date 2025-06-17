import "../styles/sidebar.css";
import { BiSolidCollection, BiSolidCabinet, BiMenuAltLeft } from "react-icons/bi";
import { FaHashtag, FaHouse } from "react-icons/fa6";
// 1. Make sure to import NavLink and useLocation
import { NavLink, useLocation } from "react-router-dom";

const Sidebar = () => {
    const { pathname } = useLocation();

    // This helper is needed for the "Trending" link, which should be active
    // for both the /trending and /explore paths.
    const isTrendActive = pathname === '/trending' || pathname === '/explore';

    // This function generates the correct class string for a NavLink.
    // It's the standard way to handle active states.
    const getNavLinkClass = (baseClass) => {
        return ({ isActive }) => `${baseClass} ${isActive ? 'activeEle' : ''}`;
    };

    return (
        <div className="sidebar">
            {/* 2. Wrap the logo in a NavLink to make it a clickable link to the homepage */}


            {/* 3. Each navigation item is a NavLink with a 'to' prop for the path */}

            {/* Home Icon links to "/" */}
            <NavLink to="/" className={getNavLinkClass('sidebarEle homeIcon')}>
                <FaHouse />
            </NavLink>

            {/* Trending Icon links to "/trending" */}
            <NavLink
                to="/trending"
                className={`sidebarEle trendIcon ${isTrendActive ? 'activeEle' : ''}`}
            >
                <FaHashtag />
            </NavLink>

            {/* Subscriptions Icon links to "/subscriptions" */}
            <NavLink to="/subscriptions" className={getNavLinkClass('sidebarEle subscriptionIcon')}>
                <BiSolidCabinet />
            </NavLink>

            {/* History/Library Icon links to "/library" */}
            <NavLink to="/library" className={getNavLinkClass('sidebarEle historyIcon')}>
                <BiSolidCollection />
            </NavLink>
        </div>
    );
};

export default Sidebar;