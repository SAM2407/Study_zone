import mongoose from "mongoose";

const meetingSchema = new mongoose.Schema({

    title: String,

    group: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Group"
    },

    meetingLink: String,

    scheduledAt: Date,

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },

    isActive: {
        type: Boolean,
        default: true
    }

});

export default mongoose.model("Meeting", meetingSchema);