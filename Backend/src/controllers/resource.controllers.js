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
        // Extract public_id correctly from the Cloudinary URL
        const urlParts = resource.fileUrl.split('/');
        const fileNameWithExt = urlParts[urlParts.length - 1];
        const folder = urlParts[urlParts.length - 2];
        const publicId = `${folder}/${fileNameWithExt.split('.')[0]}`;
        
        // Generate a high-security private download URL
        const signedUrl = cloudinary.utils.private_download_url(publicId, 'pdf', {
            resource_type: resource.fileUrl.includes('/raw/') ? 'raw' : 'image',
            expires_at: Math.floor(Date.now() / 1000) + 3600 // 1 hour
        });

        res.redirect(signedUrl);
    } catch (err) {
        console.error("PDF Sign Error:", err);
        res.status(500).send("Error generating secure link");
    }
});