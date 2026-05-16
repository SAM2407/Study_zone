import { Server } from "socket.io";

export const initSocket = (server) => {
    const io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    // store room state
    const rooms = {};

    io.on("connection", (socket) => {
        console.log("✅ Socket connected:", socket.id);

        /* ========================
           JOIN ROOM
        ======================== */
        socket.on("join-room", ({ roomName, userId, isHost }) => {
            socket.join(roomName);
            socket.roomName = roomName;
            socket.userId = userId;
            let actualHost = false;

            if (!rooms[roomName]) {
                rooms[roomName] = {
                    hostId: socket.id,
                    hostUserId: userId, // Track by userId too
                    allowedUsers: new Set(),
                    members: {},
                    drawHistory: []
                };
                actualHost = true;
            } else {
                // Room exists. Only allow host status if this is the original host reconnecting
                const room = rooms[roomName];
                
                // Room exists — kick duplicate connections for same userId
                const existingSockets = Object.keys(room.members).filter(
                    id => room.members[id].userId === userId
                );

                existingSockets.forEach(id => {
                    delete room.members[id];
                    room.allowedUsers.delete(id);
                    io.to(roomName).emit("user-left", { socketId: id, userId });

                    const oldSocket = io.sockets.sockets.get(id);
                    if (oldSocket) {
                        oldSocket.isBeingReplaced = true; // flag so disconnect skips cleanup
                        oldSocket.disconnect(true);
                    }
                });

                if (isHost || room.hostUserId === userId) {
                    // Reclaiming host status or verified as host by frontend
                    room.hostId = socket.id;
                    room.hostUserId = userId;
                    actualHost = true;
                } else {
                    actualHost = false;
                }
            }

            socket.isHost = actualHost;

            // Store this socket's member info
            rooms[roomName].members[socket.id] = { userId, isHost: actualHost };

            // Notify everyone (including self) about the join
            io.to(roomName).emit("user-joined", {
                userId,
                socketId: socket.id,
                isHost: actualHost
            });

            // Send current participant list to the joiner
            const membersWithPermissions = {};
            for (const [id, info] of Object.entries(rooms[roomName].members)) {
                membersWithPermissions[id] = {
                    ...info,
                    allowed: rooms[roomName].allowedUsers.has(id)
                };
            }
            socket.emit("room-participants", membersWithPermissions);

            // Send current draw permission state to joiner
            const allowed = rooms[roomName].allowedUsers.has(socket.id);
            socket.emit("permission-update", { allowed });

            // Send existing whiteboard state to late joiners
            if (rooms[roomName].drawHistory?.length > 0) {
                socket.emit("wb-history", rooms[roomName].drawHistory);
            }

            console.log(`${userId} joined room: ${roomName}`);
        });

        /* ========================
           WHITEBOARD EVENTS
        ======================== */
        socket.on("wb-draw", (data) => {
            const roomName = socket.roomName;
            if (!roomName || !rooms[roomName]) return;

            const room = rooms[roomName];
            const isHost = room.hostId === socket.id;
            const isAllowed = room.allowedUsers.has(socket.id);

            if (!isHost && !isAllowed) return;

            // Update master state
            rooms[roomName].drawHistory.push(data);

            // broadcast to everyone ELSE in room
            socket.to(roomName).emit("wb-draw", data);
        });

        socket.on("wb-clear", () => {
            const roomName = socket.roomName;
            if (!roomName || !rooms[roomName]) return;

            const room = rooms[roomName];
            const isHost = room.hostId === socket.id;
            const isAllowed = room.allowedUsers.has(socket.id);

            if (!isHost && !isAllowed) return;

            rooms[roomName].drawHistory = [];
            socket.to(roomName).emit("wb-clear");
        });

        socket.on("wb-history", (newHistory) => {
            const roomName = socket.roomName;
            if (!roomName || !rooms[roomName]) return;

            const room = rooms[roomName];
            const isHost = room.hostId === socket.id;
            const isAllowed = room.allowedUsers.has(socket.id);

            if (!isHost && !isAllowed) return;

            rooms[roomName].drawHistory = newHistory;
            socket.to(roomName).emit("wb-history", newHistory);
        });

        socket.on("wb-pen-point", (data) => {
            const roomName = socket.roomName;
            if (!roomName || !rooms[roomName]) return;
            socket.to(roomName).emit("wb-pen-point", data);
        });

        socket.on("wb-draw-draft", (data) => {
            const roomName = socket.roomName;
            if (!roomName || !rooms[roomName]) return;
            socket.to(roomName).emit("wb-draw-draft", data);
        });

        /* ========================
           SAVE BOARD TO RESOURCES
        ======================== */
        socket.on("wb-save", async ({ roomName, imageData, title, groupId }) => {
            if (!roomName || !rooms[roomName]) return;
            if (rooms[roomName].hostId !== socket.id) return;

            try {
                // convert base64 image to buffer and upload to cloudinary
                const { v2: cloudinary } = await import("cloudinary");

                cloudinary.config({
                    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
                    api_key: process.env.CLOUDINARY_API_KEY,
                    api_secret: process.env.CLOUDINARY_API_SECRET
                });

                const uploadResult = await cloudinary.uploader.upload(imageData, {
                    folder: "studyzone_whiteboards",
                    resource_type: "image",
                    public_id: `whiteboard_${roomName}_${Date.now()}`
                });

                // save to resources DB
                const Resource = (await import("./models/resource.model.js")).default;
                const hostSocketData = rooms[roomName].members[socket.id];

                // find user by socket
                const User = (await import("./models/user.model.js")).default;
                const user = await User.findOne({ name: hostSocketData.userId });

                if (user) {
                    await Resource.create({
                        title: title || `Whiteboard — ${roomName}`,
                        description: `Saved from meeting: ${roomName}`,
                        fileUrl: uploadResult.secure_url,
                        fileType: "image/png",
                        groupId: groupId || null,
                        uploadedBy: user._id,
                        uploadedByName: user.name
                    });

                    socket.emit("wb-save-success", {
                        message: "✅ Whiteboard saved to Resources!"
                    });
                } else {
                    socket.emit("wb-save-error", {
                        message: "Could not find user to save resource."
                    });
                }
            } catch (err) {
                console.error("Whiteboard save error:", err);
                socket.emit("wb-save-error", {
                    message: "Failed to save whiteboard."
                });
            }
        });

        /* ========================
           PERMISSION MANAGEMENT
        ======================== */
        socket.on("grant-permission", ({ targetSocketId }) => {
            const roomName = socket.roomName;
            if (!roomName || !rooms[roomName]) return;
            if (rooms[roomName].hostId !== socket.id) return;

            rooms[roomName].allowedUsers.add(targetSocketId);

            io.to(targetSocketId).emit("permission-update", { allowed: true });
            io.to(roomName).emit("permission-changed", {
                socketId: targetSocketId,
                allowed: true
            });

            console.log(`Permission granted to ${targetSocketId}`);
        });

        socket.on("revoke-permission", ({ targetSocketId }) => {
            const roomName = socket.roomName;
            if (!roomName || !rooms[roomName]) return;
            if (rooms[roomName].hostId !== socket.id) return;

            rooms[roomName].allowedUsers.delete(targetSocketId);

            io.to(targetSocketId).emit("permission-update", { allowed: false });
            io.to(roomName).emit("permission-changed", {
                socketId: targetSocketId,
                allowed: false
            });
        });

        socket.on("request-draw-permission", ({ userId, socketId }) => {
            const roomName = socket.roomName;
            if (!roomName || !rooms[roomName]) return;

            const hostId = rooms[roomName].hostId;
            if (hostId) {
                io.to(hostId).emit("request-draw-permission", { userId, socketId });
            }
        });

        socket.on("deny-draw-permission", ({ targetSocketId }) => {
            const roomName = socket.roomName;
            if (!roomName || !rooms[roomName]) return;
            if (rooms[roomName].hostId !== socket.id) return;

            io.to(targetSocketId).emit("permission-update", { allowed: false });
            io.to(targetSocketId).emit("draw-permission-denied");
        });

        /* ── SCREEN SHARE PERMISSIONS (host-controlled) ── */
        socket.on("request-screen-share", ({ userId, socketId }) => {
            const roomName = socket.roomName;
            if (!roomName || !rooms[roomName]) return;

            const hostId = rooms[roomName].hostId;
            if (hostId) {
                io.to(hostId).emit("request-screen-share", { userId, socketId });
            }
        });

        socket.on("reject-screen-share", ({ targetSocketId }) => {
            const roomName = socket.roomName;
            if (!roomName || !rooms[roomName]) return;
            if (rooms[roomName].hostId !== socket.id) return;

            io.to(targetSocketId).emit("screen-share-rejected");
        });

        socket.on("grant-screen-share", ({ targetSocketId }) => {
            const roomName = socket.roomName;
            if (!roomName || !rooms[roomName]) return;
            if (rooms[roomName].hostId !== socket.id) return;

            if (rooms[roomName].members[targetSocketId]) {
                rooms[roomName].members[targetSocketId].screenShareAllowed = true;
            }
            io.to(targetSocketId).emit("screen-share-permission", { allowed: true });
            io.to(roomName).emit("permission-changed", { socketId: targetSocketId, screenShareAllowed: true });
        });

        socket.on("revoke-screen-share", ({ targetSocketId }) => {
            const roomName = socket.roomName;
            if (!roomName || !rooms[roomName]) return;
            if (rooms[roomName].hostId !== socket.id) return;

            if (rooms[roomName].members[targetSocketId]) {
                rooms[roomName].members[targetSocketId].screenShareAllowed = false;
            }
            io.to(targetSocketId).emit("screen-share-permission", { allowed: false });
            io.to(roomName).emit("permission-changed", { socketId: targetSocketId, screenShareAllowed: false });
        });

        socket.on("screen-share-started", ({ roomName }) => {
            if (!roomName) return;
            socket.to(roomName).emit("screen-share-started", { socketId: socket.id });
        });

        socket.on("screen-share-stopped", ({ roomName }) => {
            if (!roomName) return;
            socket.to(roomName).emit("screen-share-stopped");
        });

        /* ========================
           CHAT
        ======================== */
        socket.on("chat-message", ({ roomName, userId, message, time }) => {
            if (!roomName) return;
            // send to everyone ELSE (frontend already added it to sender's own UI)
            socket.to(roomName).emit("chat-message", { userId, message, time, socketId: socket.id });
        });

        /* ========================
           RAISE HAND
        ======================== */
        socket.on("raise-hand", (data) => {
            const roomName = socket.roomName;
            if (roomName) {
                socket.to(roomName).emit("raise-hand", data);
            }
        });

        /* ========================
           USER MUTED
        ======================== */
        socket.on("user-muted", (data) => {
            const roomName = socket.roomName;
            if (roomName) {
                socket.to(roomName).emit("user-muted", data);
            }
        });

        /* ========================
           END MEETING
        ======================== */
        socket.on("end-meeting", () => {
            const roomName = socket.roomName;
            if (!roomName || !rooms[roomName]) return;
            if (rooms[roomName].hostId !== socket.id) return;

            io.to(roomName).emit("meeting-ended");
            delete rooms[roomName];
            console.log(`Meeting ended: ${roomName}`);
        });

        /* ========================
           PEER SIGNAL (for WebRTC)
           helps members find each other
        ======================== */
        socket.on("peer-id", ({ peerId, roomName }) => {
            socket.peerId = peerId;
            if (rooms[roomName]) {
                // Guard: member entry may not exist yet if room was just created
                if (rooms[roomName].members[socket.id]) {
                    rooms[roomName].members[socket.id].peerId = peerId;
                } else {
                    rooms[roomName].members[socket.id] = { userId: socket.userId, peerId };
                }
            }
            // broadcast this peer's ID to everyone else
            socket.to(roomName).emit("new-peer", { peerId, socketId: socket.id });

            // send existing peers to this new joiner
            const existingPeers = Object.values(rooms[roomName]?.members || {})
                .filter(m => m.peerId && m.peerId !== peerId)
                .map(m => ({ peerId: m.peerId }));

            socket.emit("existing-peers", existingPeers);
        });

        /* ========================
           DISCONNECT
        ======================== */
        socket.on("disconnect", () => {
            const roomName = socket.roomName;

            // If this socket was deliberately kicked to make room for a reconnect, skip cleanup
            if (socket.isBeingReplaced) {
                console.log(`↩️ Replaced socket disconnected (no cleanup): ${socket.id}`);
                return;
            }

            if (roomName && rooms[roomName]) {
                rooms[roomName].allowedUsers.delete(socket.id);
                delete rooms[roomName].members[socket.id];

                socket.to(roomName).emit("user-left", {
                    socketId: socket.id,
                    userId: socket.userId
                });

                // If host truly left (not replaced), clean up the room
                if (rooms[roomName].hostId === socket.id) {
                    socket.to(roomName).emit("host-left");
                    delete rooms[roomName];
                }
            }
            console.log("❌ Socket disconnected:", socket.id);
        });
    });

    return io;
};