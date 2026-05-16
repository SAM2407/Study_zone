import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { groupService, meetingService } from '../services/api';
import '../assets/styles/joinMeeting.css'; // Reuse existing meeting styles for consistency

const JoinMeetingLobby = () => {
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [user] = useState(() => {
        try {
            const savedUser = localStorage.getItem('user');
            return savedUser && savedUser !== 'undefined' ? JSON.parse(savedUser) : null;
        } catch (e) { return null; }
    });
    const navigate = useNavigate();

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }
        fetchActiveMeetings();
    }, []);

    const fetchActiveMeetings = async () => {
        setLoading(true);
        try {
            const data = await groupService.getMyGroups();
            setGroups(data.data || []);
        } catch (err) {
            console.error('Error fetching meetings:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateMeeting = async (group) => {
        try {
            const res = await meetingService.createMeeting({
                title: `${group.name} Instant Meeting`,
                groupId: group._id,
                scheduledAt: new Date().toISOString()
            });
            navigate(`/meeting/${res.data.meetingLink}`);
        } catch (err) {
            alert(err || "Failed to create meeting");
        }
    };

    const activeMeetings = groups.filter(g => g.activeMeeting);
    const otherGroups = groups.filter(g => !g.activeMeeting);

    return (
        <div style={{ padding: '40px 20px', minHeight: '80vh', background: 'var(--bg-dark, #0f0f1a)' }}>
            <div style={{ maxWidth: 1000, margin: '0 auto' }}>
                <h1 style={{ color: '#f7a043', marginBottom: 10 }}>Join a Meeting</h1>
                <p style={{ color: 'white', marginBottom: 40 }}>Select an active session from your groups or start a new one.</p>

                {loading ? (
                    <div style={{ color: '#0cdcf7', textAlign: 'center', padding: 50 }}>
                        <div className="loader" style={{ margin: '0 auto 20px' }}></div>
                        Loading available meetings...
                    </div>
                ) : (
                    <>
                        <h2 style={{ color: '#0cdcf7', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 10, marginBottom: 20 }}>
                            🟢 Active Meetings ({activeMeetings.length})
                        </h2>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20, marginBottom: 50 }}>
                            {activeMeetings.length > 0 ? (
                                activeMeetings.map(group => (
                                    <div key={group._id} className="option-card" style={{ width: '100%', margin: 0, border: '2px solid #2ecc71' }}>
                                        <div style={{ fontSize: 12, color: '#2ecc71', fontWeight: 'bold', marginBottom: 5 }}>LIVE NOW</div>
                                        <h2>{group.name}</h2>
                                        <p>{group.description || 'No description available.'}</p>
                                        <div style={{ background: 'rgba(255,255,255,0.05)', padding: 10, borderRadius: 8, margin: '10px 0' }}>
                                            <span style={{ color: '#aaa', fontSize: 12 }}>Active Meeting Found</span>
                                        </div>
                                        <button 
                                            onClick={() => navigate(`/meeting/${group.activeMeeting.meetingLink}`)}
                                            style={{ backgroundColor: '#2ecc71' }}
                                        >
                                            Join Meeting
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div style={{ gridColumn: '1/-1', padding: 40, textAlign: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: 12, color: '#aaa' }}>
                                    No meetings are currently active in your groups.
                                </div>
                            )}
                        </div>

                        <h2 style={{ color: '#aaa', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 10, marginBottom: 20 }}>
                            ⚡ Start a New Meeting
                        </h2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
                            {otherGroups.map(group => (
                                <div key={group._id} className="option-card" style={{ width: '100%', margin: 0, opacity: 0.9 }}>
                                    <h3>{group.name}</h3>
                                    <p style={{ fontSize: 13 }}>Create a new session for this group.</p>
                                    <button 
                                        onClick={() => handleCreateMeeting(group)}
                                        style={{ backgroundColor: '#e67e22', padding: '8px 15px', fontSize: 14 }}
                                    >
                                        Start Meeting
                                    </button>
                                </div>
                            ))}
                            {groups.length === 0 && (
                                <div style={{ gridColumn: '1/-1', padding: 40, textAlign: 'center', color: '#aaa' }}>
                                    You are not enrolled in any study groups yet. <br/>
                                    <button 
                                        onClick={() => navigate('/explore')} 
                                        style={{ marginTop: 15, background: 'none', border: '1px solid #0cdcf7', color: '#0cdcf7', padding: '8px 20px', borderRadius: 8, cursor: 'pointer' }}
                                    >
                                        Explore Groups
                                    </button>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default JoinMeetingLobby;
