import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { groupService } from '../services/api';
import '../assets/styles/createGroup.css';

const CreateGroup = () => {
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        type: 'public',
        tags: '',
        category: 'study'
    });
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                alert('Please authenticate first');
                navigate('/login');
                return;
            }

            const payload = {
                ...formData,
                tags: formData.tags.split(',').map(tag => tag.trim()).filter(t => t)
            };

            await groupService.createGroup(payload);
            alert('Group created successfully!');
            navigate('/explore');
        } catch (err) {
            alert(err || 'Failed to create group');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <div className="container">
                <h2>Create a New Group</h2>
                <form id="createGroupForm" onSubmit={handleSubmit}>
                    <label>Group Name</label>
                    <input 
                        type="text" 
                        name="name" 
                        required 
                        placeholder="Enter group name"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />

                    <label>Group Description</label>
                    <textarea 
                        name="description" 
                        rows="4" 
                        required 
                        placeholder="Enter group description"
                        value={formData.description}
                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                    ></textarea>

                    <label>Group Type</label>
                    <div className="group-type">
                        <label>
                            <input 
                                type="radio" 
                                name="type" 
                                value="public" 
                                checked={formData.type === 'public'}
                                onChange={(e) => setFormData({...formData, type: e.target.value})}
                            /> Public
                        </label>
                        <label>
                            <input 
                                type="radio" 
                                name="type" 
                                value="private"
                                checked={formData.type === 'private'}
                                onChange={(e) => setFormData({...formData, type: e.target.value})}
                            /> Private
                        </label>
                        <label>
                            <input 
                                type="radio" 
                                name="type" 
                                value="invite"
                                checked={formData.type === 'invite'}
                                onChange={(e) => setFormData({...formData, type: e.target.value})}
                            /> Invite-only
                        </label>
                    </div>

                    <label>Tags</label>
                    <input 
                        type="text" 
                        name="tags" 
                        placeholder="e.g. DSA, OS, DBMS"
                        value={formData.tags}
                        onChange={(e) => setFormData({...formData, tags: e.target.value})}
                    />

                    <div className="upload-section">
                        <label>Upload Group Icon</label>
                        <input type="file" name="groupIcon" accept="image/*" title="Select an image file for the group icon" />
                    </div>

                    <button type="submit" disabled={loading}>
                        {loading ? 'Creating...' : 'Create Group'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default CreateGroup;
