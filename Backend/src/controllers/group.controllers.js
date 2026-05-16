import Group from "../models/group.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";


export const createGroup = asyncHandler(async (req, res) => {

    const { name, description, type, tags } = req.body;

    if (!name || !description) {
        throw new ApiError(400, "Group name and description required");
    }

    const group = await Group.create({
        name,
        description,
        type,
        tags,
        createdBy: req.user._id,
        members: [req.user._id]
    });

    return res
        .status(201)
        .json(new ApiResponse(201, group, "Group created successfully"));

});


export const getPublicGroups = asyncHandler(async (req, res) => {

    const groups = await Group.find({ type: "public" }).populate("createdBy", "name");

    return res
        .status(200)
        .json(new ApiResponse(200, groups, "Public groups fetched"));

});
export const getMyGroups = asyncHandler(async (req, res) => {

    const groups = await Group.find({
        members: req.user._id
    }).populate("createdBy", "name").populate("activeMeeting");

    return res.status(200).json(
        new ApiResponse(200, groups, "User groups fetched successfully")
    );

});


export const joinGroup = asyncHandler(async (req, res) => {

    const { groupId } = req.params;

    const group = await Group.findById(groupId);

    if (!group) {
        throw new ApiError(404, "Group not found");
    }

    const alreadyMember = group.members.some(
        (member) => member.toString() === req.user._id.toString()
    );
    if (alreadyMember) {
   return res.status(200).json(
      new ApiResponse(200, group, "Already a member")
   );
}

    // if (alreadyMember) {
    //     throw new ApiError(400, "Already a member");
    // }

    group.members.push(req.user._id);

    await group.save();

    return res
        .status(200)
        .json(new ApiResponse(200, group, "Joined group successfully"));

});

export const leaveGroup = asyncHandler(async (req, res) => {
    const { groupId } = req.params;
    const group = await Group.findById(groupId);

    if (!group) throw new ApiError(404, "Group not found");

    group.members = group.members.filter(
        (member) => member.toString() !== req.user._id.toString()
    );

    await group.save();

    return res.status(200).json(
        new ApiResponse(200, {}, "Left group successfully")
    );
});

export const getGroupMembers = asyncHandler(async (req, res) => {
    const { groupId } = req.params;
    const group = await Group.findById(groupId).populate("members", "name email _id");

    if (!group) throw new ApiError(404, "Group not found");

    // Only allow members of the group to see the member list
    const isMember = group.members.some(
        (member) => member._id.toString() === req.user._id.toString()
    );

    if (!isMember && group.createdBy.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "Not authorized to view members");
    }

    return res.status(200).json(
        new ApiResponse(200, group.members, "Group members fetched successfully")
    );
});

export const kickMember = asyncHandler(async (req, res) => {
    const { groupId, memberId } = req.params;
    const group = await Group.findById(groupId);

    if (!group) throw new ApiError(404, "Group not found");

    // Verify req.user is the creator of the group
    if (group.createdBy.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "Only the group admin can kick members");
    }

    // Admins cannot kick themselves this way
    if (memberId.toString() === req.user._id.toString()) {
        throw new ApiError(400, "You cannot kick yourself");
    }

    group.members = group.members.filter(
        (member) => member.toString() !== memberId.toString()
    );

    await group.save();

    return res.status(200).json(
        new ApiResponse(200, {}, "Member kicked successfully")
    );
});