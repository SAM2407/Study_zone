import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        match: [
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            "Please enter a valid email address"
        ]
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
      isVerified: { 
        type: Boolean,
         default: false
         },

    otp: {
         type: String,
          default: null
         },
         
    otpExpires: { 
        type: Date, 
        default: null 
    },
    // for forgot password
    resetPasswordToken: {
        type: String,
        default: null
    },
    resetPasswordExpires: {
        type: Date,
        default: null
    },
    // for auto logout tracking
    lastActive: {
        type: Date,
        default: Date.now
    },
     joinedGroups: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Group"
    }]
}, { timestamps: true });

export default mongoose.model("User", userSchema);