import mongoose from "mongoose";

const resourceSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        default: ""
    },
    fileUrl: {
        type: String,
        required: true
    },
    fileType: {
        type: String,
        default: "application/pdf"
    },
    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Group",
        default: null
    },
    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    uploadedByName: {
        type: String,
        default: ""
    },
    size: {
        type: Number,
        default: 0
    }
}, { timestamps: true });

export default mongoose.model("Resource", resourceSchema);