import mongoose from "mongoose";

const plannerSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Group",
        default: null
    },
    title: {
        type: String,
        required: true
    },
    description: String,
    date: Date,
    time: String,
    category: String,
    note: String,
    priority: {
        type: String,
        enum: ["Low", "Medium", "High", "low", "medium", "high"],
        default: "Medium"
    },
    completedBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }]
}, { timestamps: true });

export default mongoose.model("Planner", plannerSchema);