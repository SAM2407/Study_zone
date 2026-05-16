import React from 'react';
import { Link } from 'react-router-dom';
import '../assets/styles/home.css';

const Home = () => {
    return (
        <div>
            {/* Hero Section */}
            <section className="hero">
                <div className="hero-content">
                    <h1>Welcome to the Study Zone</h1>
                    <p>Your ultimate platform to connect, learn, and grow.</p>
                    <a href="#explore" className="btn-primary">Explore More</a>
                </div>
            </section>

            {/* Cards Section */}
            <section id="explore" className="cards-section">
                <h2>Explore Our Features</h2>
                <div className="cards-container">
                    <div className="card">
                        <img src="/images/research_15175872.png" alt="Study Groups" />
                        <h3>Study Groups</h3>
                        <p>Join a group that matches your interests and goals.</p>
                        <Link to="/explore" className="btn-card">Explore Groups</Link>
                    </div>
                    <div className="card">
                        <img src="/images/resources.png" alt="Resources" />
                        <h3>Resources</h3>
                        <p>Access helpful study materials and tools.</p>
                        <Link to="/resources" className="btn-card">Get Resources</Link>
                    </div>
                    <div className="card">
                        <img src="/images/blog.png" alt="Blogs" />
                        <h3>Blogs</h3>
                        <p>Read insightful articles and blog posts.</p>
                        <Link to="#" className="btn-card">Read Blogs</Link>
                    </div>
                    <div className="card">
                        <img src="/images/Meetings.png" alt="Meetings" />
                        <h3>Join Meeting</h3>
                        <p>Join the meeting to interact and clear your doubts.</p>
                        <Link to="/join-meeting" className="btn-card">Join Meetings</Link>
                    </div>
                    <div className="card">
                        <img src="/images/calender.png" alt="Study Planner" />
                        <h3>Study Planner</h3>
                        <p>Plan your study time to improve your performance.</p>
                        <Link to="/planner" className="btn-card">Study Planner</Link>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default Home;

