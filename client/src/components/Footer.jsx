import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
    return (
        <div className="footer">
            <div className="box1">
                <Link to="#">About Us</Link>
                <Link to="#">Blogs</Link>
                <Link to="/contact">Contact Us</Link>
                <Link to="/explore">Study Groups</Link>
            </div>
            <div className="box2">
                <Link to="#">Study Tips</Link>
                <Link to="#">Study Materials</Link>
                <Link to="#">FAQs</Link>
                <Link to="#">Privacy Policy</Link>
            </div>
            <div className="box3">
                <h2>Follow Us</h2>
                <br />
                <img src="/images/instagrame.png" alt="Instagram" className="ftimg" />
                <img src="/images/facebook.png" alt="Facebook" className="ftimg" />
                <img src="/images/youtube.png" alt="Youtube" className="ftimg" />
                <img src="/images/twitter.png" alt="Twitter" className="ftimg" />
            </div>
        </div>
    );
};

export default Footer;

