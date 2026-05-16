import React, { useState, useEffect } from 'react';
import { resourceService, groupService } from '../services/api';
import '../assets/styles/resources.css';

const Resources = () => {
    const [resources, setResources] = useState([]);
    const [groups, setGroups] = useState([]);
    const [activeFilter, setActiveFilter] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('newest');
    const [loading, setLoading] = useState(false);
    
    // Upload state
    const [file, setFile] = useState(null);
    const [selectedGroup, setSelectedGroup] = useState('');
    const [uploading, setUploading] = useState(false);

    // PDF Viewer
    const [viewerUrl, setViewerUrl] = useState(null);

    const [user] = useState(() => {
        try {
            const saved = localStorage.getItem('user');
            return saved && saved !== 'undefined' ? JSON.parse(saved) : null;
        } catch (e) {
            return null;
        }
    });

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            console.warn('No token found. Please login first.');
            setResources([]);
            return;
        }
        fetchGroups();
        fetchResources(null);
    }, []);

    const fetchGroups = async () => {
        try {
            const data = await groupService.getMyGroups();
            setGroups(data.data || []);
        } catch (err) {
            console.error('Failed to fetch user groups', err);
        }
    };

    const fetchResources = async (groupId) => {
        setLoading(true);
        try {
            const data = await resourceService.getGroupResources(groupId || 'public');
            setResources(data.resources || data.data || []);
        } catch (err) {
            console.error('Failed to fetch resources', err);
            setResources([]);
        } finally {
            setLoading(false);
        }
    };

    const handleFilter = (groupId) => {
        setActiveFilter(groupId);
        fetchResources(groupId);
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!file) return alert('Please select a file to upload');

        const formData = new FormData();
        formData.append('title', file.name); // Use filename as title
        formData.append('description', ''); // Default empty description
        formData.append('groupId', selectedGroup || '');
        formData.append('file', file);

        setUploading(true);
        try {
            await resourceService.uploadResource(formData);
            alert('File uploaded successfully!');
            fetchResources(activeFilter);
            // reset form
            setFile(null);
        } catch (err) {
            alert('Upload failed: ' + err);
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (resourceId) => {
        if (!window.confirm("Are you sure you want to delete this resource?")) return;
        try {
            await resourceService.deleteResource(resourceId);
            alert("Resource deleted successfully");
            fetchResources(activeFilter);
        } catch (err) {
            alert(err || "Failed to delete resource");
        }
    };

    const getAbsoluteUrl = (url) => {
        if (!url) return '';
        if (url.startsWith('http')) return url;
        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        // Remove trailing slash from baseUrl and leading slash from url if needed
        return `${baseUrl.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
    };

    const downloadResource = (url, filename) => {
        const absoluteUrl = getAbsoluteUrl(url);
        const link = document.createElement('a');
        link.href = absoluteUrl;
        link.download = filename || 'download';
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Filter and Sort applied locally (similar to frontend rendering)
    const filteredResources = resources.filter(res => 
        res.title.toLowerCase().includes(searchQuery.toLowerCase())
    ).sort((a, b) => {
        if (sortBy === 'newest') return new Date(b.createdAt) - new Date(a.createdAt);
        if (sortBy === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
        if (sortBy === 'title') return a.title.localeCompare(b.title);
        return 0;
    });

    return (
        <div className="resources-layout">
            {/* LEFT SIDEBAR */}
            <div className="sidebar">
                <h3 className="sidebar-title">📁 Filter by Group</h3>
                <button 
                    className={`group-filter-btn ${activeFilter === null ? 'active-group' : ''}`}
                    onClick={() => handleFilter(null)}
                >
                    🌍 All Resources
                </button>
                <button 
                    className={`group-filter-btn ${activeFilter === 'public' ? 'active-group' : ''}`}
                    onClick={() => handleFilter('public')}
                >
                    📄 Public Resources
                </button>
                <div id="groupFilterList">
                    {groups.map(group => (
                        <button 
                            key={group._id}
                            className={`group-filter-btn ${activeFilter === group._id ? 'active-group' : ''}`}
                            onClick={() => handleFilter(group._id)}
                        >
                            {group.name}
                        </button>
                    ))}
                </div>

                {/* UPLOAD FORM */}
                <div className="upload-section">
                    <h3 className="sidebar-title">📤 Upload Resource</h3>
                    <form id="resourceForm" onSubmit={handleUpload}>
                        <select id="resourceGroup" title="Select a group for this resource" value={selectedGroup} onChange={(e) => setSelectedGroup(e.target.value)}>
                            <option value="">🌍 Public (No Group)</option>
                            {groups.map(g => (
                                <option key={g._id} value={g._id}>{g.name}</option>
                            ))}
                        </select>
                        <label className="file-label">
                            📎 Choose PDF
                            <input type="file" id="resourceFile" accept="application/pdf" required onChange={(e) => setFile(e.target.files[0])} />
                        </label>
                        <span id="fileName" className="file-name">{file ? file.name : 'No file chosen'}</span>
                        <button type="submit" id="uploadBtn" disabled={uploading}>
                            {uploading ? 'Uploading...' : '📤 Upload'}
                        </button>
                    </form>
                </div>
            </div>

            {/* MAIN CONTENT */}
            <div className="main-content">
                {/* SEARCH + SORT */}
                <div className="search-bar">
                    <input type="text" id="searchResource" placeholder="🔍 Search resources..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    <select id="sortSelect" title="Sort resources by" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                        <option value="newest">Newest First</option>
                        <option value="oldest">Oldest First</option>
                        <option value="title">A-Z</option>
                    </select>
                </div>

                {/* RESOURCE CARDS */}
                <div id="resourceList" className="resource-grid">
                    {loading ? (
                        <p className="loading-msg">Loading resources...</p>
                    ) : filteredResources.length > 0 ? (
                        filteredResources.map(res => (
                            <div key={res._id} className="resource-card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <h3 style={{ margin: 0, color: '#f7a043' }}>{res.title}</h3>
                                    <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4 }}>PDF</span>
                                </div>
                                <p style={{ fontSize: 13, margin: '10px 0', color: '#ccc' }}>{res.description}</p>
                                <div className="card-actions" style={{ marginTop: 'auto' }}>
                                    <button 
                                        onClick={() => {
                                            const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
                                            const token = localStorage.getItem('token');
                                            // Directly set the URL to the authenticated proxy endpoint
                                            const secureUrl = `${baseUrl}/resources/view/${res._id}?token=${token}`;
                                            setViewerUrl(secureUrl);
                                        }} 
                                        className="btn" 
                                        style={{ width: '100%', background: '#0cdcf7', color: '#000', fontWeight: 'bold' }}
                                    >
                                        📖 View Document
                                    </button>
                                    
                                    {(res.uploadedBy?._id === user?._id || res.uploadedBy === user?._id || (res.groupId && res.groupId.createdBy === user?._id)) && (
                                        <button 
                                            onClick={() => handleDelete(res._id)} 
                                            className="btn outline-btn" 
                                            style={{ marginTop: '10px', width: '100%', backgroundColor: 'rgba(231, 76, 60, 0.1)', color: '#e74c3c', borderColor: '#e74c3c' }}
                                        >
                                            🗑️ Delete Resource
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="loading-msg">No resources found.</p>
                    )}
                </div>
            </div>

            {/* PDF VIEWER MODAL */}
            {viewerUrl && (
                <div className="pdf-modal-overlay" onClick={() => setViewerUrl(null)} style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.95)', zIndex: 10000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '10px'}}>
                    <div className="pdf-modal-header" style={{width: '95%', maxWidth: '1200px', display: 'flex', justifyContent: 'space-between', marginBottom: '10px', background: '#111', padding: '10px 20px', borderRadius: '8px 8px 0 0', border: '1px solid #333', borderBottom: 'none'}}>
                        <h3 style={{color: '#0cdcf7', margin: 0}}>📄 Study Zone Document Reader</h3>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button onClick={() => setViewerUrl(null)} style={{background: '#e74c3c', color: 'white', border: 'none', padding: '5px 15px', borderRadius: '5px', cursor: 'pointer'}}>Close Reader</button>
                        </div>
                    </div>
                    <div style={{ width: '95%', maxWidth: '1200px', height: '85vh', background: 'white', borderRadius: '0 0 8px 8px', overflow: 'hidden' }}>
                        {/* Direct viewing for maximum reliability */}
                        <iframe 
                            src={`${viewerUrl}#toolbar=0&navpanes=0&scrollbar=1`}
                            style={{width: '100%', height: '100%', border: 'none'}}
                            title="Document Viewer"
                        ></iframe>
                    </div>
                    <div style={{ marginTop: 10, color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>
                        Can't see the document? <a href={viewerUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#0cdcf7' }}>Open Direct Link</a>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Resources;
