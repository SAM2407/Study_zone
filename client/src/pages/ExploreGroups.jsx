import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { groupService, meetingService } from '../services/api';
import '../assets/styles/explore_groups.css';

const ExploreGroups = () => {
    const [activeTab, setActiveTab] = useState('public');
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(() => {
        try {
            const savedUser = localStorage.getItem('user');
            return savedUser && savedUser !== 'undefined' ? JSON.parse(savedUser) : null;
        } catch (e) {
            return null;
        }
    });
    const navigate = useNavigate();

    useEffect(() => {
        fetchGroups();
    }, [activeTab]);

    const fetchGroups = async () => {
        setLoading(true);
        try {
            if (activeTab === 'public') {
                const data = await groupService.getPublicGroups();
                setGroups(data.data || []); // Show ALL public groups, no filtering
            } else {
                const data = await groupService.getMyGroups();
                setGroups(data.data || []);
            }
        } catch (err) {
            console.error('Error fetching groups:', err);
        } finally {
            setLoading(false);
        }
    };

    // Check if logged-in user is already a member of a group
    const isMember = (group) => {
        if (!user) return false;
        return group.members?.some(m => {
            // members can be either a string ID or a populated object with _id
            const id = typeof m === 'object' ? m._id?.toString() : m?.toString();
            return id === user._id?.toString();
        });
    };

    const handleJoin = async (groupId) => {
        if (!user) {
            alert("Please login first to join a group.");
            navigate('/login');
            return;
        }
        try {
            await groupService.joinGroup(groupId);
            alert('Joined successfully!');
            fetchGroups();
        } catch (err) {
            alert(err || 'Failed to join group');
        }
    };

    const handleCreateMeeting = async (group) => {
        try {
            const res = await meetingService.createMeeting({
                title: `${group.name} Instant Meeting`,
                groupId: group._id,
                scheduledAt: new Date().toISOString()
            });
            // Redirect host to the new active meeting
            navigate(`/meeting/${res.data.meetingLink}`);
        } catch (err) {
            alert(err || "Failed to create meeting");
        }
    };

    const handleJoinMeeting = (meetingLink) => {
        navigate(`/meeting/${meetingLink}`);
    };

    return (
        <div>
            {/* HEADER */}
            <div className="header">
                <h1>Explore Study Groups</h1>
                <p>Find public study groups and collaborate with other students.</p>
                <button 
                    type="button" 
                    onClick={() => navigate('/create-group')} 
                    className="create-btn"
                >
                    + Create New Group
                </button>
            </div>

            {/* TABS */}
            <div className="tabs">
                <button 
                    className={`tab-btn ${activeTab === 'public' ? 'active' : ''}`} 
                    onClick={() => setActiveTab('public')}
                >
                    🌍 Public Groups
                </button>
                <button 
                    className={`tab-btn ${activeTab === 'mygroups' ? 'active' : ''}`} 
                    onClick={() => setActiveTab('mygroups')}
                >
                    👤 My Groups
                </button>
            </div>

            {/* GROUP LIST */}
            <div className="groups-container" id="groupsContainer">
                {loading ? (
                    <p className="loading">Loading groups...</p>
                ) : groups.length > 0 ? (
                    groups.map(group => (
                        <div key={group._id} className="group-card">
                            <h3>{group.name}</h3>
                            <p><strong>Category:</strong> {group.category}</p>
                            <p className="group-desc">{group.description || 'No description available for this study group.'}</p>
                            <div className="group-stats">
                                <span>👥 {group.members?.length || 0} Members</span>
                                <span>👤 Admin: {group.createdBy?.name || 'Unknown'}</span>
                            </div>
                            
                            {activeTab === 'public' ? (
                                isMember(group) ? (
                                    <button className="join-btn" disabled style={{ backgroundColor: '#555', cursor: 'default', opacity: 0.7 }}>
                                        ✅ Already Joined
                                    </button>
                                ) : (
                                    <button className="join-btn" onClick={() => handleJoin(group._id)}>
                                        Join Group
                                    </button>
                                )
                            ) : group.activeMeeting ? (
                                 <button 
                                    className="join-btn outline-btn"
                                    onClick={() => handleJoinMeeting(group.activeMeeting.meetingLink)}
                                    style={{backgroundColor: '#2ecc71', color: 'white'}}
                                >
                                    🟢 Join Meeting
                                </button>
                            ) : (
                                 <button 
                                    className="join-btn outline-btn"
                                    onClick={() => handleCreateMeeting(group)}
                                    style={{backgroundColor: '#e67e22', color: 'white'}}
                                >
                                    ⚡ Create Meeting
                                </button>
                            )}
                        </div>
                    ))
                ) : (
                    <p className="loading">No groups found in this category.</p>
                )}
            </div>
        </div>
    );
};

export default ExploreGroups;

