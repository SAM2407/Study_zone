import fetch from "node-fetch";
import Resource from "../models/resource.model.js";
import Group from "../models/group.model.js";
import { cloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/* ========================
   UPLOAD RESOURCE
======================== */
export const uploadResource = asyncHandler(async (req, res) => {
    const { title, description, groupId } = req.body;

    if (!title) throw new ApiError(400, "Title is required");
    if (!req.file) throw new ApiError(400, "PDF file is required");

    // if groupId provided check user is member
    if (groupId) {
        const group = await Group.findById(groupId);
        if (!group) throw new ApiError(404, "Group not found");
        const isMember = group.members.some(
            m => m.toString() === req.user._id.toString()
        );
        if (!isMember) throw new ApiError(403, "You are not a member of this group");
    }

    const resource = await Resource.create({
        title,
        description: description || "",
        fileUrl: req.file.path,
        fileType: "application/pdf",
        groupId: groupId || null,
        uploadedBy: req.user._id,
        uploadedByName: req.user.name,
        size: req.file.size || 0
    });

    return res.status(201).json(
        new ApiResponse(201, resource, "Resource uploaded successfully")
    );
});

/* ========================
   GET ALL RESOURCES
   (public + user's groups)
======================== */
export const getResources = asyncHandler(async (req, res) => {
    const { groupId } = req.query;

    let query = {};

    if (groupId) {
        // get resources for specific group
        query.groupId = groupId;
    } else {
        // get public resources (no group) + resources from user's groups
        const userGroups = await Group.find({ members: req.user._id }).select("_id");
        const groupIds = userGroups.map(g => g._id);
        query = {
            $or: [
                { groupId: null },
                { groupId: { $in: groupIds } }
            ]
        };
    }

    const resources = await Resource.find(query)
        .populate("groupId", "name createdBy")
        .populate("uploadedBy", "name")
        .sort({ createdAt: -1 });

    return res.status(200).json(
        new ApiResponse(200, resources, "Resources fetched")
    );
});

/* ========================
   DELETE RESOURCE
======================== */
export const deleteResource = asyncHandler(async (req, res) => {
    const { resourceId } = req.params;

    const resource = await Resource.findById(resourceId).populate("groupId", "createdBy");
    if (!resource) throw new ApiError(404, "Resource not found");

    // only uploader or group admin can delete
    const isUploader = resource.uploadedBy.toString() === req.user._id.toString();
    const isGroupAdmin = resource.groupId && resource.groupId.createdBy.toString() === req.user._id.toString();

    if (!isUploader && !isGroupAdmin) {
        throw new ApiError(403, "You can only delete your own resources or resources in your group");
    }

    // delete from cloudinary
    const publicId = resource.fileUrl.split("/").pop().split(".")[0];
    const isRaw = resource.fileUrl.includes("/raw/");
    
    await cloudinary.uploader.destroy(`studyzone_resources/${publicId}`, {
        resource_type: isRaw ? "raw" : "image"
    });

    await Resource.findByIdAndDelete(resourceId);

    return res.status(200).json(
        new ApiResponse(200, {}, "Resource deleted successfully")
    );
});

/* ========================
   GET USER'S GROUPS
   for resource grouping
======================== */
export const getUserGroups = asyncHandler(async (req, res) => {
    const groups = await Group.find({ members: req.user._id }).select("name _id");
    return res.status(200).json(
        new ApiResponse(200, groups, "Groups fetched")
    );
});
export const proxyPdf = asyncHandler(async (req, res) => {
    const { resourceId } = req.params;

    const resource = await Resource.findById(resourceId);
    if (!resource) throw new ApiError(404, "Resource not found");

    if (resource.groupId) {
        const group = await Group.findById(resource.groupId);
        const isMember = group?.members.some(
            m => m.toString() === req.user._id.toString()
        );
        if (!isMember) throw new ApiError(403, "Access denied");
    }

    try {
        const targetUrl = resource.fileUrl;
        
        // If it's a PDF, redirect directly so the browser's PDF viewer handles it
        if (targetUrl.toLowerCase().endsWith('.pdf')) {
            return res.redirect(targetUrl);
        }

        // For whiteboard snapshots (PNGs) and other images, return an HTML wrapper.
        // This solves two problems:
        // 1. Transparent PNG backgrounds rendering as completely white/invisible
        // 2. Strict browsers (like Brave) blocking 302 redirects to images inside iframes
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { margin: 0; background-color: #111; display: flex; justify-content: center; align-items: center; height: 100vh; overflow: auto; }
                    img { max-width: 100%; max-height: 100%; object-fit: contain; background-color: #fff; box-shadow: 0 0 20px rgba(0,0,0,0.5); }
                </style>
            </head>
            <body>
                <img src="${targetUrl}" alt="${resource.title}" />
            </body>
            </html>
        `);
    } catch (err) {
        console.error("PDF Redirect Error:", err);
        res.status(500).send("Error generating secure link");
    }
});