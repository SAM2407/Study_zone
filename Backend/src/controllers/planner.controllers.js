import Planner from "../models/planner.model.js";
import Group from "../models/group.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const createTask = asyncHandler(async (req, res) => {
    const { title, description, date, time, priority, category, note, groupId } = req.body;

    if (!title) {
        throw new ApiError(400, "Title is required");
    }

    const task = await Planner.create({
        title,
        description,
        date,
        time,
        priority,
        category,
        note,
        groupId: groupId || null,
        user: req.user._id,
        completedBy: []
    });

    return res
        .status(201)
        .json(new ApiResponse(201, task, "Task added"));
});

export const updateTask = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { completed } = req.body; // Expecting boolean

    const task = await Planner.findById(id);
    if (!task) throw new ApiError(404, "Task not found");

    if (completed !== undefined) {
        if (completed) {
            // Add user to completedBy if not already there
            if (!task.completedBy.includes(req.user._id)) {
                task.completedBy.push(req.user._id);
            }
        } else {
            // Remove user from completedBy
            task.completedBy = task.completedBy.filter(uid => uid.toString() !== req.user._id.toString());
        }
    }

    await task.save();

    return res.status(200).json(new ApiResponse(200, task, "Task updated"));
});

export const deleteTask = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const task = await Planner.findById(id);

    if (!task) throw new ApiError(404, "Task not found");

    // Only allow task creator to delete
    if (task.user.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "Not authorized to delete this task");
    }

    await Planner.findByIdAndDelete(id);

    return res.status(200).json(new ApiResponse(200, {}, "Task deleted"));
});

export const getPlannerTasks = asyncHandler(async (req, res) => {
    // Get user's groups
    const userGroups = await Group.find({ members: req.user._id }).select("_id");
    const groupIds = userGroups.map(g => g._id);

    const tasks = await Planner.find({
        $or: [
            { user: req.user._id },
            { groupId: { $in: groupIds } }
        ]
    });

    // We can format the response or just send it as is.
    return res.status(200).json(
        new ApiResponse(200, { tasks }, "Planner tasks fetched successfully")
    );
});

export const getUserTasks = asyncHandler(async (req, res) => {
    const tasks = await Planner.find({ user: req.user._id });

    return res
        .status(200)
        .json(new ApiResponse(200, tasks, "Tasks fetched"));
});