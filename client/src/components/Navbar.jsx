import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';

const Navbar = () => {
    const [user, setUser] = useState(() => {
        try {
            const savedUser = localStorage.getItem('user');
            return savedUser && savedUser !== 'undefined' ? JSON.parse(savedUser) : null;
        } catch (e) {
            return null;
        }
    });

    const navigate = useNavigate();
    const location = useLocation();
    const [isDark, setIsDark] = useState(localStorage.getItem('theme') === 'dark');
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const isAuthPage = location.pathname === '/login' || location.pathname === '/signup';

    useEffect(() => {
        if (isAuthPage) {
            document.body.classList.remove('dark-theme');
            return;
        }
        
        if (isDark) {
            document.body.classList.add('dark-theme');
            localStorage.setItem('theme', 'dark');
        } else {
            document.body.classList.remove('dark-theme');
            localStorage.setItem('theme', 'light');
        }
    }, [isDark, isAuthPage]);

    const handleLogout = (e) => {
        e.preventDefault();
        if (window.confirm("Are you sure you want to log out?")) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setUser(null);
            alert("Logged out successfully!");
            window.location.reload();
        }
    };

    const handleCreateGroup = () => {
        if (user) {
            navigate('/create-group');
        } else {
            alert("You must log in first to create a group.");
            navigate('/login');
        }
    };

    const toggleTheme = () => {
        setIsDark(!isDark);
    };

    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen);
    };

    return (
        <div className="nav">
            <Link to="/">
                <img src="/images/logo.jpg" alt="page_logo" className="navimg" />
            </Link>
            <button id="Create_group" onClick={handleCreateGroup}>Create a group</button>
            
            <div className="hamburger" onClick={toggleMenu}>
                <div></div>
                <div></div>
                <div></div>
            </div>

            <div className={`navlinks ${isMenuOpen ? 'open' : ''}`}>
                <Link to="/" className="home" onClick={() => setIsMenuOpen(false)}>Home</Link>
                <Link to="/resources" className="Resources" onClick={() => setIsMenuOpen(false)}>Resources</Link>
                <Link to="/join-meeting" className="Meetings" onClick={() => setIsMenuOpen(false)}>Meetings</Link>
                <Link to="#" className="Blogs" onClick={() => setIsMenuOpen(false)}>Blogs</Link>
                <Link to="/contact" className="contactus" onClick={() => setIsMenuOpen(false)}>Contact Us</Link>
                
                {user ? (
                    <div 
                        className="user-avatar" 
                        onClick={handleLogout} 
                        title="Click to logout"
                    >
                        {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                ) : (
                    <Link to="/login" className="login" onClick={() => setIsMenuOpen(false)}>Login</Link>
                )}
                
                {!isAuthPage && (
                    <button id="theme-toggle" onClick={toggleTheme}>
                        {isDark ? '☀️' : '🌙'}
                    </button>
                )}
            </div>
        </div>
    );
};

export default Navbar;

