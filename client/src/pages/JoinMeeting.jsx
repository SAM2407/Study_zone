import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import Peer from 'peerjs';
import { meetingService } from '../services/api';
import '../assets/styles/joinMeeting.css';

const JoinMeeting = () => {
    const { meetingId } = useParams();
    const navigate = useNavigate();
    const user = React.useMemo(() => {
        try {
            const savedUser = localStorage.getItem('user');
            return savedUser && savedUser !== 'undefined' ? JSON.parse(savedUser) : null;
        } catch (e) { return null; }
    }, []);

    const [isLoading, setIsLoading] = useState(true);
    const [loadingStatus, setLoadingStatus] = useState('Verifying access...');

    const socketRef = useRef(null);
    const peerRef = useRef(null);
    const localVideoRef = useRef(null);
    const localStreamRef = useRef(null);

    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [showChat, setShowChat] = useState(false);
    const [messages, setMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [participants, setParticipants] = useState({});
    const [isHost, setIsHost] = useState(false);
    const [canDraw, setCanDraw] = useState(false);
    const [remoteStreams, setRemoteStreams] = useState({});
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [tool, setTool] = useState('pen');
    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState('#000000');
    const [lineWidth, setLineWidth] = useState(2);
    const [history, setHistory] = useState([]);
    const [redoStack, setRedoStack] = useState([]);
    const [screenRequests, setScreenRequests] = useState([]); // [{userId, socketId}]

    const canvasRef = useRef(null);
    const draftCanvasRef = useRef(null);
    const ctxRef = useRef(null);
    const draftCtxRef = useRef(null);
    const startPosRef = useRef({ x: 0, y: 0 });
    const activePointsRef = useRef([]); // track points for current pen/brush stroke without re-rendering

    const [fullscreenPeerId, setFullscreenPeerId] = useState(null); // which video is fullscreen
    const [screenShareAllowed, setScreenShareAllowed] = useState(false); // can this user share screen?
    const [whoIsSharing, setWhoIsSharing] = useState(null); // socketId of current screen sharer
    const [isTheaterMode, setIsTheaterMode] = useState(false);
    const screenShareRef = useRef(null); // ref for fullscreen container
    const whiteboardContainerRef = useRef(null);

    // Keep isHost and canDraw in a ref so socket callbacks always have latest value
    const isHostRef = useRef(false);
    const canDrawRef = useRef(false);

    useEffect(() => { isHostRef.current = isHost; }, [isHost]);
    useEffect(() => { canDrawRef.current = canDraw; }, [canDraw]);

    // Self-healing: Attach local stream whenever the video element appears
    useEffect(() => {
        if (localVideoRef.current && localStreamRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
        }
    }, [localVideoRef.current, localStreamRef.current, isTheaterMode]);

    useEffect(() => {
        if (!user) { navigate('/login'); return; }

        const checkAccess = async () => {
            try {
                const res = await meetingService.getMeetingDetails(meetingId);
                const createdBy = res.data?.createdBy;
                const createdById = (typeof createdBy === 'object' ? createdBy?._id : createdBy)?.toString();
                const currentUserId = user?._id?.toString();

                // Robust host check: must both exist and match
                const isHostCheck = !!createdById && !!currentUserId && createdById === currentUserId;
                
                console.log("Host check:", { createdById, currentUserId, isHostCheck });
                
                setIsHost(isHostCheck);
                isHostRef.current = isHostCheck;
                if (isHostCheck) { 
                    setCanDraw(true); 
                    canDrawRef.current = true; 
                }
                setLoadingStatus('Initializing media devices...');
                await initializeSession(isHostCheck);
                setIsLoading(false);
            } catch (err) {
                console.error("Meeting access error:", err);
                const msg = typeof err === 'string' ? err : err?.message || 'Meeting not found';
                alert(`Cannot join meeting: ${msg}`);
                navigate('/explore');
            }
        };
        checkAccess();

        return () => { cleanupSession(); };
    }, [meetingId]);

    const initializeSession = async (isHostUser) => {
        let stream = null;
        try {
            // Standard approach: request both. If it fails, we fall back.
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        } catch (err) {
            console.warn("Combined media failed, trying video only...", err.name);
            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: true });
            } catch (err2) {
                console.warn("Video failed, trying audio only...", err2.name);
                try {
                    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    setIsVideoOff(true);
                } catch (err3) {
                    console.error("All physical media failed.");
                }
            }
        }

        if (!stream) {
            console.warn("🚫 All physical media failed, using dummy stream...");
            try {
                // Create a silent dummy stream
                const canvas = document.createElement('canvas');
                canvas.width = 640; canvas.height = 480;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#1a1a2e';
                ctx.fillRect(0, 0, 640, 480);
                ctx.fillStyle = 'white';
                ctx.font = '24px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('Camera Not Detected', 320, 240);
                ctx.font = '16px sans-serif';
                ctx.fillText('Check hardware or permissions', 320, 270);
                
                const videoTrack = canvas.captureStream(1).getVideoTracks()[0];
                
                // Audio fallback (silent)
                const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                const dst = audioCtx.createMediaStreamDestination();
                const audioTrack = dst.stream.getAudioTracks()[0];
                
                stream = new MediaStream([videoTrack, audioTrack]);
                setIsVideoOff(true);
            } catch (dummyErr) {
                console.error("Dummy stream creation failed:", dummyErr);
            }
        }

        if (stream) {
            localStreamRef.current = stream;
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
                localVideoRef.current.play().catch(() => {});
            }
        }

        setupSocket(isHostUser);
    };

    const setupSocket = (isHostUser) => {
        const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000');
        socketRef.current = socket;

        socket.on('connect', () => {
            socket.emit('join-room', {
                roomName: meetingId,
                userId: user.name,
                isHost: isHostUser
            });
            setupPeer();
        });

        socket.on('room-participants', (members) => {
            setParticipants(members);
        });

        socket.on('user-joined', ({ userId, socketId, isHost: remoteIsHost }) => {
            if (socketId === socket.id) {
                setIsHost(remoteIsHost);
                isHostRef.current = remoteIsHost;
                if (remoteIsHost) { setCanDraw(true); canDrawRef.current = true; }
            }
            setParticipants(prev => ({ ...prev, [socketId]: { userId, isHost: remoteIsHost, allowed: false } }));
        });

        socket.on('permission-changed', ({ socketId, allowed, screenShareAllowed }) => {
            setParticipants(prev => {
                if (!prev[socketId]) return prev;
                const updated = { ...prev[socketId] };
                if (allowed !== undefined) updated.allowed = allowed;
                if (screenShareAllowed !== undefined) updated.screenShareAllowed = screenShareAllowed;
                return { ...prev, [socketId]: updated };
            });
        });

        socket.on('user-left', ({ socketId, userId }) => {
            console.log(`User left: ${userId} (${socketId})`);
            setParticipants(prev => {
                const updated = { ...prev };
                const participant = updated[socketId];
                const peerIdToRemove = participant?.peerId;
                
                delete updated[socketId];
                
                if (peerIdToRemove) {
                    setRemoteStreams(streams => {
                        const newStreams = { ...streams };
                        delete newStreams[peerIdToRemove];
                        return newStreams;
                    });
                }
                return updated;
            });
        });

        socket.on('chat-message', (data) => {
            setMessages(prev => [...prev, { ...data, isOwn: false }]);
        });

        socket.on('wb-history', (history) => {
            setHistory(history);
            // Draw all history to base canvas
            setTimeout(() => {
                redrawCanvas(history);
            }, 500);
        });

        socket.on('wb-draw-draft', (data) => {
            const ctx = draftCtxRef.current;
            if (!ctx) return;
            drawShape(ctx, data.type, data.start, data.end, data.color, data.width);
        });

        socket.on('wb-pen-point', ({ x, y, isNew, color: c, width: w }) => {
            const ctx = ctxRef.current;
            if (!ctx) return;
            if (isNew) {
                ctx.beginPath();
                ctx.moveTo(x, y);
            } else {
                ctx.strokeStyle = c;
                ctx.lineWidth = w;
                ctx.lineTo(x, y);
                ctx.stroke();
            }
        });

        socket.on('wb-clear', () => {
            setHistory([]);
            setRedoStack([]);
            const canvas = canvasRef.current;
            const ctx = ctxRef.current;
            if (ctx && canvas) {
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
        });

        socket.on('wb-save-success', ({ message }) => { alert(message); });
        socket.on('wb-save-error', ({ message }) => { alert(message); });

        socket.on('permission-update', ({ allowed }) => {
            setCanDraw(allowed);
            canDrawRef.current = allowed;
        });

        // Screen share request workflow
        socket.on('request-screen-share', ({ userId, socketId }) => {
            if (isHostRef.current) {
                setScreenRequests(prev => [...prev, { userId, socketId }]);
            }
        });

        socket.on('screen-share-rejected', () => {
            alert("Your screen share request was rejected by the host.");
        });

        // Screen share permission (host grants/revokes)
        socket.on('screen-share-permission', ({ allowed }) => {
            setScreenShareAllowed(allowed);
            if (allowed && !isScreenSharing) {
                alert("The host has granted you permission to share your screen. Click 'Share Screen' to begin.");
            }
            if (!allowed && isScreenSharing) stopScreenShare();
        });

        // Broadcast: someone started/stopped screen sharing
        socket.on('screen-share-started', ({ socketId }) => {
            setWhoIsSharing(socketId);
        });

        socket.on('screen-share-stopped', () => {
            setWhoIsSharing(null);
            setFullscreenPeerId(null);
        });

        socket.on('meeting-ended', () => {
            alert("The host has ended the meeting.");
            cleanupSession();
            navigate('/explore');
        });
    };

    const setupPeer = () => {
        const peer = new Peer(`sz-${user.name.replace(/\s+/g, '')}-${Date.now()}`, {
            host: '0.peerjs.com', port: 443, path: '/', secure: true
        });
        peerRef.current = peer;

        peer.on('open', (id) => {
            socketRef.current?.emit('peer-id', { peerId: id, roomName: meetingId });
        });

        peer.on('call', (call) => {
            call.answer(localStreamRef.current || undefined);
            call.on('stream', (remoteStream) => {
                setRemoteStreams(prev => ({
                    ...prev,
                    [call.peer]: { stream: remoteStream, name: 'Participant' }
                }));
            });
        });

        socketRef.current?.on('existing-peers', (peers) => {
            peers.forEach(({ peerId }) => {
                if (localStreamRef.current) {
                    const call = peer.call(peerId, localStreamRef.current);
                    call?.on('stream', (remoteStream) => {
                        setRemoteStreams(prev => ({
                            ...prev,
                            [peerId]: { stream: remoteStream, name: 'Participant' }
                        }));
                    });
                }
            });
        });
    };

    const redrawCanvas = (hist) => {
        const canvas = canvasRef.current;
        const ctx = ctxRef.current;
        if (!ctx || !canvas) return;
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        hist.forEach(item => {
            drawShape(ctx, item.type, item.start, item.end, item.color, item.width, item.points);
        });
    };

    const drawShape = (ctx, type, start, end, col, width, pts) => {
        ctx.strokeStyle = col;
        ctx.lineWidth = width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();

        if (type === 'pen' || type === 'brush') {
            if (pts && pts.length > 0) {
                ctx.moveTo(pts[0].x, pts[0].y);
                pts.forEach(p => ctx.lineTo(p.x, p.y));
                ctx.stroke();
            }
        } else if (type === 'rectangle') {
            ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
        } else if (type === 'circle') {
            const radius = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
            ctx.arc(start.x, start.y, radius, 0, 2 * Math.PI);
            ctx.stroke();
        } else if (type === 'line') {
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();
        } else if (type === 'arrow') {
            const headlen = 10;
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const angle = Math.atan2(dy, dx);
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
            ctx.lineTo(end.x - headlen * Math.cos(angle - Math.PI / 6), end.y - headlen * Math.sin(angle - Math.PI / 6));
            ctx.moveTo(end.x, end.y);
            ctx.lineTo(end.x - headlen * Math.cos(angle + Math.PI / 6), end.y - headlen * Math.sin(angle + Math.PI / 6));
            ctx.stroke();
        } else if (type === 'eraser') {
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 20;
            if (pts && pts.length > 0) {
                ctx.moveTo(pts[0].x, pts[0].y);
                pts.forEach(p => ctx.lineTo(p.x, p.y));
                ctx.stroke();
            }
        }
    };

    const startDrawing = ({ nativeEvent }) => {
        if (!isHostRef.current && !canDrawRef.current) return;
        const { offsetX, offsetY } = nativeEvent;
        startPosRef.current = { x: offsetX, y: offsetY };
        setIsDrawing(true);
        if (tool === 'pen' || tool === 'eraser' || tool === 'brush') {
            const ctx = ctxRef.current;
            ctx.beginPath();
            ctx.moveTo(offsetX, offsetY);
            
            // Start tracking points in ref instead of state
            activePointsRef.current = [{ x: offsetX, y: offsetY }];
            
            throttledEmit('wb-pen-point', { x: offsetX, y: offsetY, isNew: true }, 10);
        }
    };

    const draw = ({ nativeEvent }) => {
        if (!isDrawing) return;
        if (!isHostRef.current && !canDrawRef.current) return;
        const { offsetX, offsetY } = nativeEvent;
        const start = startPosRef.current;

        if (tool === 'pen' || tool === 'eraser' || tool === 'brush') {
            const ctx = ctxRef.current;
            ctx.lineTo(offsetX, offsetY);
            ctx.stroke();
            
            // Add point to ref (no re-render)
            activePointsRef.current.push({ x: offsetX, y: offsetY });

            const currentStrokeColor = tool === 'eraser' ? 'white' : color;
            const currentStrokeWidth = tool === 'eraser' ? 20 : (tool === 'brush' ? lineWidth * 2.5 : lineWidth);
            throttledEmit('wb-pen-point', { x: offsetX, y: offsetY, isNew: false, color: currentStrokeColor, width: currentStrokeWidth }, 10);
        } else {
            // Shapes: use draft canvas for preview
            const dCtx = draftCtxRef.current;
            if (!dCtx) return;
            dCtx.clearRect(0, 0, dCtx.canvas.width, dCtx.canvas.height);
            drawShape(dCtx, tool, start, { x: offsetX, y: offsetY }, color, lineWidth);
            // Sync draft to others
            throttledEmit('wb-draw-draft', { type: tool, start, end: { x: offsetX, y: offsetY }, color, width: lineWidth }, 50);
        }
    };

    const stopDrawing = ({ nativeEvent }) => {
        if (!isDrawing) return;
        const { offsetX, offsetY } = nativeEvent;
        const start = startPosRef.current;
        setIsDrawing(false);

        let newHistory = [...history];
        if (tool === 'pen' || tool === 'eraser' || tool === 'brush') {
            // Commit the stroke from ref to history state
            const currentStrokeColor = tool === 'eraser' ? 'white' : color;
            const currentStrokeWidth = tool === 'eraser' ? 20 : (tool === 'brush' ? lineWidth * 2.5 : lineWidth);
            newHistory.push({
                type: tool,
                color: currentStrokeColor,
                width: currentStrokeWidth,
                points: [...activePointsRef.current]
            });
            setHistory(newHistory);
            socketRef.current?.emit('wb-history', newHistory);
        } else {
            // Shapes
            const dCtx = draftCtxRef.current;
            if (dCtx) dCtx.clearRect(0, 0, dCtx.canvas.width, dCtx.canvas.height);
            
            const newItem = { type: tool, start, end: { x: offsetX, y: offsetY }, color, width: lineWidth };
            newHistory.push(newItem);
            setHistory(newHistory);
            redrawCanvas(newHistory);
            socketRef.current?.emit('wb-history', newHistory);
        }
        setRedoStack([]);
        activePointsRef.current = [];
    };

    const undo = () => {
        if (history.length === 0) return;
        const last = history[history.length - 1];
        const newHistory = history.slice(0, -1);
        setHistory(newHistory);
        setRedoStack(prev => [last, ...prev]);
        redrawCanvas(newHistory);
        socketRef.current?.emit('wb-history', newHistory);
    };

    const redo = () => {
        if (redoStack.length === 0) return;
        const first = redoStack[0];
        const newRedo = redoStack.slice(1);
        const newHistory = [...history, first];
        setHistory(newHistory);
        setRedoStack(newRedo);
        redrawCanvas(newHistory);
        socketRef.current?.emit('wb-history', newHistory);
    };

    const handleClearBoard = () => {
        if (!isHostRef.current && !canDrawRef.current) return;
        setHistory([]);
        setRedoStack([]);
        const canvas = canvasRef.current;
        const ctx = ctxRef.current;
        if (ctx && canvas) {
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        socketRef.current?.emit('wb-clear');
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        const dCanvas = draftCanvasRef.current;
        if (!canvas || !dCanvas) return;
        
        const ctx = canvas.getContext('2d');
        const dCtx = dCanvas.getContext('2d');
        
        const rect = canvas.parentElement.getBoundingClientRect();
        [canvas, dCanvas].forEach(c => {
            c.width = rect.width;
            c.height = rect.height || 600;
        });

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctxRef.current = ctx;
        draftCtxRef.current = dCtx;
    }, []);

    useEffect(() => {
        if (ctxRef.current) {
            ctxRef.current.strokeStyle = color;
            ctxRef.current.lineWidth = tool === 'brush' ? lineWidth * 2.5 : lineWidth;
            if (tool === 'eraser') {
                ctxRef.current.strokeStyle = 'white';
                ctxRef.current.lineWidth = 20;
            }
        }
    }, [tool, color, lineWidth]);

    // Throttle utility
    const throttleRef = useRef({});
    const throttledEmit = useCallback((event, data, delay = 80) => {
        if (!throttleRef.current[event]) {
            socketRef.current?.emit(event, data);
            throttleRef.current[event] = setTimeout(() => {
                delete throttleRef.current[event];
            }, delay);
        }
    }, []);


    const saveBoardToResources = async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        try {
            const dataUrl = canvas.toDataURL("image/png");
            socketRef.current?.emit("wb-save", {
                roomName: meetingId,
                imageData: dataUrl,
                title: `Whiteboard ${meetingId}`
            });
            alert("Saving board to resources...");
        } catch (err) {
            console.error("Export failed:", err);
            alert("Failed to export board");
        }
    };

    const handleSendMessage = () => {
        if (!chatInput.trim()) return;
        const data = {
            userId: user.name,
            message: chatInput,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            roomName: meetingId
        };
        socketRef.current?.emit('chat-message', data);
        setMessages(prev => [...prev, { ...data, isOwn: true }]);
        setChatInput('');
    };

    const toggleMute = () => {
        const track = localStreamRef.current?.getAudioTracks()[0];
        if (track) { track.enabled = !track.enabled; setIsMuted(!track.enabled); }
    };

    const toggleVideo = () => {
        const track = localStreamRef.current?.getVideoTracks()[0];
        if (track) { track.enabled = !track.enabled; setIsVideoOff(!track.enabled); }
    };

    const toggleScreenShare = async () => {
        if (isHost) {
            if (!isScreenSharing) {
                try {
                    const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
                    startScreenSharingStream(screen);
                } catch (err) { console.error("Screen share failed:", err); }
            } else { stopScreenShare(); }
        } else {
            // Participant: Request permission
            if (!screenShareAllowed) {
                alert("Requesting permission to share screen...");
                socketRef.current?.emit('request-screen-share', { userId: user.name, socketId: socketRef.current.id });
            } else {
                if (!isScreenSharing) {
                    try {
                        const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
                        startScreenSharingStream(screen);
                    } catch (err) { console.error("Screen share failed:", err); }
                } else { stopScreenShare(); }
            }
        }
    };

    const startScreenSharingStream = (stream) => {
        const vTrack = stream.getVideoTracks()[0];
        if (peerRef.current) {
            Object.values(peerRef.current.connections).forEach(conns => {
                conns.forEach(conn => {
                    const sender = conn.peerConnection?.getSenders().find(s => s.track?.kind === 'video');
                    if (sender) sender.replaceTrack(vTrack);
                });
            });
        }
        if (localVideoRef.current) localVideoRef.current.srcObject = new MediaStream([vTrack]);
        vTrack.onended = stopScreenShare;
        setIsScreenSharing(true);
        socketRef.current?.emit('screen-share-started', { roomName: meetingId });
    };

    const stopScreenShare = () => {
        const vTrack = localStreamRef.current?.getVideoTracks()[0];
        if (peerRef.current && vTrack) {
            Object.values(peerRef.current.connections).forEach(conns => {
                conns.forEach(conn => {
                    const sender = conn.peerConnection?.getSenders().find(s => s.track?.kind === 'video');
                    if (sender) sender.replaceTrack(vTrack);
                });
            });
        }
        if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
        setIsScreenSharing(false);
        socketRef.current?.emit('screen-share-stopped', { roomName: meetingId });
    };

    const toggleFullscreen = (peerId, videoEl) => {
        if (fullscreenPeerId === peerId) {
            // Exit fullscreen
            document.exitFullscreen?.();
            setFullscreenPeerId(null);
        } else {
            // Enter fullscreen on that video element
            videoEl?.requestFullscreen?.();
            setFullscreenPeerId(peerId);
        }
    };

    const cleanupSession = () => {
        console.log("🧹 Cleaning up session...");
        localStreamRef.current?.getTracks().forEach(t => t.stop());
        socketRef.current?.removeAllListeners();
        socketRef.current?.disconnect();
        peerRef.current?.destroy();
        localStreamRef.current = null;
        socketRef.current = null;
        peerRef.current = null;
    };

    const leaveMeeting = async () => {
        if (isHost) {
            const ok = window.confirm("You are the host. End this meeting for everyone?");
            if (ok) {
                try { await meetingService.endMeeting(meetingId); } catch {}
                socketRef.current?.emit("end-meeting");
            }
        }
        cleanupSession();
        navigate('/explore');
    };

    const viewModeEnabled = !isHost && !canDraw;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', background: '#0f0f1a', overflow: 'hidden', position: 'relative' }}>
            
            {/* ── LOADING OVERLAY ── */}
            {isLoading && (
                <div style={{
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                    background: '#0f0f1a', zIndex: 9999, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', transition: 'all 0.5s ease'
                }}>
                    <div className="loader" style={{ marginBottom: 20 }}></div>
                    <h2 style={{ color: 'white', fontSize: 24, marginBottom: 10 }}>Study Zone</h2>
                    <p style={{ color: '#0cdcf7', fontSize: 14 }}>{loadingStatus}</p>
                    <div style={{ width: 200, height: 2, background: '#333', marginTop: 20, borderRadius: 1, overflow: 'hidden' }}>
                        <div className="progress-bar-inner"></div>
                    </div>
                </div>
            )}

            {/* ── TOP BAR ── */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'rgba(0,0,0,0.85)', padding: '10px 20px',
                borderBottom: '1px solid rgba(255,255,255,0.1)', flexShrink: 0, flexWrap: 'wrap', gap: 8
            }}>
                <span style={{ color: '#ffcc00', fontWeight: 'bold', fontSize: 15 }}>📡 {meetingId}</span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button className="ctrl-btn" onClick={toggleMute}>🎤 {isMuted ? 'Unmute' : 'Mute'}</button>
                    <button className="ctrl-btn" onClick={toggleVideo}>📷 {isVideoOff ? 'Start Video' : 'Stop Video'}</button>
                    <button className="ctrl-btn" onClick={toggleScreenShare}>💻 {isScreenSharing ? 'Stop Share' : 'Share Screen'}</button>
                    <button className="ctrl-btn" onClick={() => setShowChat(c => !c)}>💬 Chat</button>
                    {(isHost || canDraw) && (
                        <button className="ctrl-btn" style={{ background: '#1d4a2a', borderColor: '#2ecc71' }} onClick={saveBoardToResources}>💾 Save Board</button>
                    )}
                    <button className="ctrl-btn leave-btn" onClick={leaveMeeting}>🚪 Leave</button>
                </div>
            </div>

            {/* ── MAIN AREA ── */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

                {/* ── LEFT: Video + Participants ── */}
                {!isTheaterMode && (
                    <div style={{ width: 300, minWidth: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', background: 'rgba(0,0,0,0.6)', borderRight: '1px solid rgba(255,255,255,0.1)', overflowY: 'auto', padding: 10, gap: 10 }}>
                        {/* Videos */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                            <div style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', background: '#111', aspectRatio: '4/3' }}>
                                <video ref={localVideoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                <span style={{ position: 'absolute', bottom: 4, left: 6, color: 'white', fontSize: 10, background: 'rgba(0,0,0,0.7)', padding: '1px 6px', borderRadius: 8 }}>
                                    You {isHost ? '(Host)' : ''} {isScreenSharing ? '🖥️' : ''}
                                </span>
                            </div>
                            {Object.entries(remoteStreams).map(([id, info]) => (
                                <div key={id} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', background: '#111', aspectRatio: '4/3', cursor: 'pointer' }}
                                    onDoubleClick={(e) => toggleFullscreen(id, e.currentTarget.querySelector('video'))}>
                                    <video autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        ref={el => { if (el) el.srcObject = info.stream; }} />
                                    <span style={{ position: 'absolute', bottom: 4, left: 6, color: 'white', fontSize: 10, background: 'rgba(0,0,0,0.7)', padding: '1px 6px', borderRadius: 8 }}>{info.name}</span>
                                    {/* Fullscreen button — always visible for screen shares */}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); toggleFullscreen(id, e.currentTarget.previousSibling.previousSibling); }}
                                        style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.7)', border: 'none', color: 'white', borderRadius: 4, cursor: 'pointer', padding: '2px 5px', fontSize: 12 }}
                                        title="Fullscreen"
                                    >⛶</button>
                                </div>
                            ))}
                        </div>

                        {/* Participants */}
                        <div style={{ background: 'rgba(0,0,0,0.5)', borderRadius: 10, padding: 12, border: '1px solid #0cdcf7' }}>
                            <h4 style={{ color: '#f7a043', marginBottom: 8, fontSize: 13 }}>
                                👥 Participants ({Object.keys(participants).length + 1})
                            </h4>
                            {Object.entries(participants).map(([socketId, info]) => (
                                <div key={socketId} style={{ padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ color: 'white', fontSize: 12 }}>{info.userId} {info.isHost ? '(Host)' : ''}</span>
                                    </div>
                                    {isHost && !info.isHost && (
                                        <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                                            {/* Draw permission */}
                                            {info.allowed
                                                ? <button className="revoke-btn" onClick={() => socketRef.current?.emit('revoke-permission', { targetSocketId: socketId })}>Revoke Draw</button>
                                                : <button className="grant-btn" onClick={() => socketRef.current?.emit('grant-permission', { targetSocketId: socketId })}>Grant Draw</button>
                                            }
                                            {/* Screen share permission */}
                                            {info.screenShareAllowed
                                                ? <button className="revoke-btn" style={{ fontSize: 10 }} onClick={() => socketRef.current?.emit('revoke-screen-share', { targetSocketId: socketId })}>Revoke Share</button>
                                                : <button className="grant-btn" style={{ fontSize: 10, background: '#1a5276' }} onClick={() => socketRef.current?.emit('grant-screen-share', { targetSocketId: socketId })}>Allow Share</button>
                                            }
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── RIGHT: Whiteboard ── */}
                <div ref={whiteboardContainerRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
                    {/* Board header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 14px', background: 'rgba(0,0,0,0.7)', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
                        <span style={{ color: 'white', fontWeight: 'bold', fontSize: 13, display: 'flex', alignItems: 'center', gap: 10 }}>
                            ✏️ Collaborative Board
                            {viewModeEnabled && <span style={{ fontSize: 11, background: '#c0392b', padding: '2px 8px', borderRadius: 10 }}>Read Only</span>}
                            <button onClick={() => setIsTheaterMode(!isTheaterMode)} style={{ background: '#333', border: 'none', color: 'white', padding: '2px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
                                {isTheaterMode ? 'Show Videos' : 'Theater Mode'}
                            </button>
                            <button onClick={() => whiteboardContainerRef.current?.requestFullscreen()} style={{ background: '#333', border: 'none', color: 'white', padding: '2px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>
                                Fullscreen
                            </button>
                        </span>
                    </div>

                    {/* ── Toolbar & Canvas ── */}
                    <div style={{ padding: '8px 14px', background: 'rgba(0,0,0,0.85)', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.05)', padding: 4, borderRadius: 8 }}>
                            <button className={`tool-btn ${tool === 'pen' ? 'active-tool' : ''}`} onClick={() => setTool('pen')} disabled={viewModeEnabled} title="Pen">✏️</button>
                            <button className={`tool-btn ${tool === 'brush' ? 'active-tool' : ''}`} onClick={() => setTool('brush')} disabled={viewModeEnabled} title="Brush">🖌️</button>
                            <button className={`tool-btn ${tool === 'eraser' ? 'active-tool' : ''}`} onClick={() => setTool('eraser')} disabled={viewModeEnabled} title="Eraser">🧽</button>
                            <button className={`tool-btn ${tool === 'rectangle' ? 'active-tool' : ''}`} onClick={() => setTool('rectangle')} disabled={viewModeEnabled} title="Rectangle">⬜</button>
                            <button className={`tool-btn ${tool === 'circle' ? 'active-tool' : ''}`} onClick={() => setTool('circle')} disabled={viewModeEnabled} title="Circle">⭕</button>
                            <button className={`tool-btn ${tool === 'line' ? 'active-tool' : ''}`} onClick={() => setTool('line')} disabled={viewModeEnabled} title="Line">📏</button>
                            <button className={`tool-btn ${tool === 'arrow' ? 'active-tool' : ''}`} onClick={() => setTool('arrow')} disabled={viewModeEnabled} title="Arrow">↗️</button>
                        </div>

                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '0 10px', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
                            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} disabled={viewModeEnabled} style={{ width: 24, height: 24, padding: 0, border: 'none', background: 'none', cursor: 'pointer' }} />
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ color: 'white', fontSize: 10 }}>Size</span>
                                <input 
                                    type="range" 
                                    min="1" 
                                    max="40" 
                                    value={lineWidth} 
                                    onChange={(e) => setLineWidth(Number(e.target.value))} 
                                    disabled={viewModeEnabled} 
                                    style={{ width: 80, height: 4, borderRadius: 2, background: '#444', accentColor: '#0cdcf7', cursor: 'pointer' }} 
                                />
                                <span style={{ color: '#aaa', fontSize: 10, width: 15 }}>{lineWidth}</span>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
                            <button className="tool-btn" onClick={undo} disabled={viewModeEnabled || history.length === 0} title="Undo">↩️</button>
                            <button className="tool-btn" onClick={redo} disabled={viewModeEnabled || redoStack.length === 0} title="Redo">↪️</button>
                            <button className="tool-btn" onClick={handleClearBoard} disabled={viewModeEnabled} title="Clear">🗑️</button>
                        </div>
                    </div>
                    <div style={{ position: 'relative', flex: 1, background: 'white' }}>
                        <canvas
                            ref={canvasRef}
                            style={{ position: 'absolute', inset: 0, zIndex: 1 }}
                        />
                        <canvas
                            ref={draftCanvasRef}
                            onMouseDown={startDrawing}
                            onMouseMove={draw}
                            onMouseUp={stopDrawing}
                            onMouseOut={stopDrawing}
                            style={{ 
                                position: 'absolute', inset: 0, zIndex: 2,
                                cursor: viewModeEnabled ? 'not-allowed' : (tool === 'eraser' ? 'cell' : 'crosshair')
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* ── CHAT PANEL (overlay) ── */}
            {showChat && (
                <div style={{
                    position: 'fixed', right: 0, top: 0, bottom: 0, width: 300,
                    background: 'rgba(15,15,26,0.97)', borderLeft: '1px solid rgba(255,255,255,0.15)',
                    display: 'flex', flexDirection: 'column', zIndex: 1000
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#f7a043', fontWeight: 'bold' }}>
                        💬 Meeting Chat
                        <button onClick={() => setShowChat(false)} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: 18 }}>✕</button>
                    </div>
                    <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {messages.map((msg, i) => (
                            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.isOwn ? 'flex-end' : 'flex-start', gap: 2 }}>
                                <span style={{ fontSize: 10, color: msg.isOwn ? '#ffcc00' : '#0cdcf7', fontWeight: 'bold' }}>{msg.userId}</span>
                                <span style={{ background: msg.isOwn ? '#1e3a8a' : 'rgba(255,255,255,0.1)', padding: '8px 12px', borderRadius: 10, color: 'white', fontSize: 13, maxWidth: 220, wordBreak: 'break-word' }}>{msg.message}</span>
                                <span style={{ fontSize: 10, color: '#555' }}>{msg.time}</span>
                            </div>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: 6, padding: 10, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                        <input
                            style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.08)', color: 'white', fontSize: 13, outline: 'none' }}
                            placeholder="Type a message..."
                            value={chatInput}
                            onChange={e => setChatInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleSendMessage(); }}
                        />
                        <button onClick={handleSendMessage} className="ctrl-btn">Send</button>
                    </div>
                </div>
            )}
            {/* ── SCREEN SHARE REQUEST MODAL (Host only) ── */}
            {isHost && screenRequests.length > 0 && (
                <div style={{ position: 'fixed', bottom: 20, right: 20, width: 300, background: '#1a1a2e', border: '1px solid #0cdcf7', borderRadius: 12, padding: 15, zIndex: 2000, boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                    <h4 style={{ color: '#ffcc00', marginTop: 0, marginBottom: 10, fontSize: 14 }}>Screen Share Request</h4>
                    <p style={{ color: 'white', fontSize: 12, marginBottom: 15 }}>
                        <b>{screenRequests[0].userId}</b> wants to share their screen.
                    </p>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button 
                            style={{ flex: 1, padding: '8px', borderRadius: 6, border: 'none', background: '#2ecc71', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}
                            onClick={() => {
                                socketRef.current?.emit('accept-screen-share', { targetSocketId: screenRequests[0].socketId });
                                setScreenRequests(prev => prev.slice(1));
                            }}
                        >Accept</button>
                        <button 
                            style={{ flex: 1, padding: '8px', borderRadius: 6, border: 'none', background: '#e74c3c', color: 'white', cursor: 'pointer', fontWeight: 'bold' }}
                            onClick={() => {
                                socketRef.current?.emit('reject-screen-share', { targetSocketId: screenRequests[0].socketId });
                                setScreenRequests(prev => prev.slice(1));
                            }}
                        >Reject</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default JoinMeeting;
