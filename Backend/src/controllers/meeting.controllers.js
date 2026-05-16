import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import Meeting from "../models/metting.model.js";
import Planner from "../models/planner.model.js";
import Group from "../models/group.model.js";

/* ========================
   CREATE MEETING ROOM
======================== */
export const createMeetingRoom = asyncHandler(async (req, res) => {
    const { title, groupId, scheduledAt } = req.body;

    if (!title) {
        throw new ApiError(400, "Title is required");
    }

    let group = null;
    if (groupId) {
        group = await Group.findById(groupId);
        if (!group) throw new ApiError(404, "Group not found");
        
        // Prevent duplicate meetings
        if (group.activeMeeting) {
            throw new ApiError(400, "An active meeting already exists for this group.");
        }
    }

    // Generate a unique meeting ID
    const uniqueId = `meet-${Math.random().toString(36).substr(2, 9)}`;

    // Create Meeting in DB
    const meeting = await Meeting.create({
        title,
        group: groupId || null,
        meetingLink: uniqueId,
        scheduledAt: scheduledAt || new Date(),
        createdBy: req.user._id,
        isActive: true
    });

    // Link meeting to group
    if (group) {
        group.activeMeeting = meeting._id;
        await group.save();
    }

    // Auto Add to Planner
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    await Planner.create({
        title: `Meeting: ${title}`,
        description: `Scheduled meeting. Join via link.`,
        date: scheduledAt || new Date(),
        time: scheduledAt ? new Date(scheduledAt).toLocaleTimeString() : new Date().toLocaleTimeString(),
        category: "Meeting",
        priority: "High",
        note: `Join Link: ${frontendUrl}/meeting/${uniqueId}`,
        groupId: groupId || null,
        user: req.user._id,
        completedBy: []
    });

    return res.status(201).json(
        new ApiResponse(201, meeting, "Meeting room created and added to planner")
    );
});

/* ========================
   GET MEETING DETAILS
======================== */
export const getMeetingDetails = asyncHandler(async (req, res) => {
    const { meetingId } = req.params;

    const meeting = await Meeting.findOne({ meetingLink: meetingId, isActive: true })
        .populate("group")
        .populate("createdBy", "_id name");
    
    if (!meeting) {
        throw new ApiError(404, "Meeting not found or has already ended");
    }

    // Verify group restriction if it's a group meeting
    if (meeting.group) {
        const isMember = meeting.group.members.some(
            (mId) => mId.toString() === req.user._id.toString()
        );
        if (!isMember) {
            throw new ApiError(403, "You are not a member of this group");
        }
    }

    return res.status(200).json(
        new ApiResponse(200, meeting, "Meeting details fetched")
    );
});

/* ========================
   END MEETING ROOM
======================== */
export const endMeetingRoom = asyncHandler(async (req, res) => {
    const { roomName } = req.params;

    const meeting = await Meeting.findOne({ meetingLink: roomName, isActive: true });
    if (!meeting) {
        throw new ApiError(404, "Meeting not found or already ended");
    }

    // Only host can end
    if (meeting.createdBy.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "Only the host can end the meeting");
    }

    // Mark as inactive
    meeting.isActive = false;
    await meeting.save();

    // Remove from group's active meeting
    if (meeting.group) {
        const group = await Group.findById(meeting.group);
        if (group && group.activeMeeting?.toString() === meeting._id.toString()) {
            group.activeMeeting = null;
            await group.save();
        }
    }

    return res.status(200).json(
        new ApiResponse(200, {}, "Meeting ended successfully")
    );
});