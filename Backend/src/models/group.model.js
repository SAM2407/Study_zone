import mongoose from "mongoose";

const groupSchema = new mongoose.Schema({

    name: {
        type: String,
        required: true,
        trim: true
    },

    description: {
        type: String,
        required: true
    },

    type: {
        type: String,
        enum: ["public", "private", "invite"],
        default: "public"
    },

    tags: {
        type: [String]
    },

    icon: {
        type: String
    },

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },

    members: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],

    activeMeeting: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Meeting",
        default: null
    },

    createdAt: {
        type: Date,
        default: Date.now
    }

});

export default mongoose.model("Group", groupSchema);