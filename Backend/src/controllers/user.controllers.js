import User from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import nodemailer from "nodemailer";

/* ========================
   GENERATE TOKEN
======================== */
const generateToken = (userId, rememberMe = false) => {
    return jwt.sign(
        { id: userId },
        process.env.JWT_SECRET,
        { expiresIn: rememberMe ? "7d" : "1d" }
    );
};

/* ========================
   SEND OTP HELPER (Using Resend API)
======================== */
const sendOTP = async (email, otp, name) => {
    const htmlContent = `
        <div style="font-family:Arial,sans-serif; max-width:500px; margin:auto; padding:20px; background:#f4f4f4; border-radius:10px;">
            <h2 style="color:#1e3a8a;">Study Zone Email Verification</h2>
            <p>Hi <strong>${name}</strong>,</p>
            <p>Your OTP to verify your email is:</p>
            <div style="font-size:36px; font-weight:bold; letter-spacing:10px; text-align:center; color:#1e3a8a; background:white; padding:20px; border-radius:8px; margin:15px 0;">
                ${otp}
            </div>
            <p style="color:#666; font-size:13px;">This OTP expires in <strong>10 minutes</strong>.</p>
            <p style="color:#666; font-size:13px;">If you didn't request this, ignore this email.</p>
        </div>
    `;

    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            from: 'Study Zone <onboarding@resend.dev>',
            to: email,
            subject: 'Study Zone — Email Verification OTP',
            html: htmlContent
        })
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error("Resend API Error:", errorData);
        throw new Error(errorData.message || "Failed to send email via Resend");
    }
};

/* ========================
   STEP 1 — SEND OTP
   (before creating account)
======================== */
export const sendVerificationOTP = asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        throw new ApiError(400, "All fields are required");
    }

    // validate email format
    const emailRegex = /^[a-zA-Z0-9._%+-]{2,}@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
        throw new ApiError(400, "Please enter a valid email address");
    }

    if (password.length < 6) {
        throw new ApiError(400, "Password must be at least 6 characters");
    }

    // check if already verified account exists
    const existingUser = await User.findOne({
        email: email.toLowerCase(),
        isVerified: true
    });
    if (existingUser) {
        throw new ApiError(409, "An account with this email already exists");
    }

    // generate 6-digit OTP
    let otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // DEMO ACCOUNT BYPASS
    const isDemoAccount = email.toLowerCase().endsWith("@demo.com");
    if (isDemoAccount) {
        otp = "123456";
    }

    // save or update unverified user
    let user = await User.findOne({ email: email.toLowerCase() });

    if (user) {
        // update existing unverified user
        user.name = name;
        user.password = await bcrypt.hash(password, 10);
        user.otp = otp;
        user.otpExpires = otpExpires;
        user.isVerified = false;
        await user.save();
    } else {
        // create new unverified user
        const hashedPassword = await bcrypt.hash(password, 10);
        user = await User.create({
            name,
            email: email.toLowerCase(),
            password: hashedPassword,
            otp,
            otpExpires,
            isVerified: false
        });
    }

    // send OTP email (Skip if demo account)
    if (isDemoAccount) {
        console.log(`[DEMO MODE] Skipped email for ${email}. OTP is ${otp}`);
    } else {
        try {
            await sendOTP(email, otp, name);
        } catch (err) {
            console.error("Resend API failed to send OTP:", err);
            await User.findByIdAndDelete(user._id);
            throw new ApiError(500, "Could not send OTP email. Please check your email address and try again.");
        }
    }


    return res.status(200).json(
        new ApiResponse(200, { email }, "OTP sent to your email. Please verify.")
    );
});

/* ========================
   STEP 2 — VERIFY OTP
   (complete registration)
======================== */
export const verifyOTPAndRegister = asyncHandler(async (req, res) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
        throw new ApiError(400, "Email and OTP are required");
    }

    const user = await User.findOne({
        email: email.toLowerCase(),
        isVerified: false
    });

    if (!user) {
        throw new ApiError(404, "No pending registration found for this email");
    }

    // check OTP expired
    if (!user.otpExpires || new Date() > user.otpExpires) {
        throw new ApiError(400, "OTP has expired. Please sign up again.");
    }

    // check OTP matches
    if (user.otp !== otp.toString()) {
        throw new ApiError(400, "Incorrect OTP. Please try again.");
    }

    // mark as verified
    user.isVerified = true;
    user.otp = null;
    user.otpExpires = null;
    await user.save();

    const token = generateToken(user._id);

    return res.status(201).json(
        new ApiResponse(201, {
            user: {
                _id: user._id,
                name: user.name,
                email: user.email
            },
            token
        }, "Email verified! Account created successfully.")
    );
});

/* ========================
   RESEND OTP
======================== */
export const resendOTP = asyncHandler(async (req, res) => {
    const { email } = req.body;

    const user = await User.findOne({
        email: email.toLowerCase(),
        isVerified: false
    });

    if (!user) {
        throw new ApiError(404, "No pending registration found");
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    try {
        await sendOTP(email, otp, user.name);
    } catch (err) {
        throw new ApiError(500, "Could not resend OTP. Try again.");
    }

    return res.status(200).json(
        new ApiResponse(200, {}, "New OTP sent to your email")
    );
});

/* ========================
   LOGIN USER
======================== */
export const loginUser = asyncHandler(async (req, res) => {
    const { email, password, rememberMe } = req.body;

    if (!email || !password) {
        throw new ApiError(400, "Email and password are required");
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
        throw new ApiError(404, "No account found with this email");
    }

    // check if email is verified
    if (!user.isVerified) {
        throw new ApiError(403, "Please verify your email first. Check your inbox for the OTP.");
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
        throw new ApiError(401, "Incorrect password");
    }

    user.lastActive = new Date();
    await user.save();

    const token = generateToken(user._id, rememberMe);

    return res.status(200).json(
        new ApiResponse(200, {
            user: {
                _id: user._id,
                name: user.name,
                email: user.email
            },
            token,
            expiresIn: rememberMe ? "7d" : "1d"
        }, "Login successful")
    );
});

/* ========================
   GET CURRENT USER
======================== */
export const getCurrentUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(req.user._id, { lastActive: new Date() });
    const user = await User.findById(req.user._id)
        .select("-password -resetPasswordToken -resetPasswordExpires -otp -otpExpires");
    return res.status(200).json(new ApiResponse(200, user, "User fetched"));
});

/* ========================
   FORGOT PASSWORD
======================== */
export const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email) throw new ApiError(400, "Email is required");

    const user = await User.findOne({
        email: email.toLowerCase(),
        isVerified: true
    });

    if (!user) {
        return res.status(200).json(
            new ApiResponse(200, {}, "If this email exists, a reset link has been sent")
        );
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    const resetUrl = `${process.env.CORS_ORIGIN}/reset-password?token=${resetToken}&email=${user.email}`;

    const htmlContent = `
        <div style="font-family:Arial,sans-serif; max-width:500px; margin:auto; padding:20px; background:#f4f4f4; border-radius:10px;">
            <h2 style="color:#1e3a8a;">Study Zone Password Reset</h2>
            <p>Hi <strong>${user.name}</strong>,</p>
            <p>You requested to reset your password. Click the button below to reset it:</p>
            <div style="text-align:center; margin:25px 0;">
                <a href="${resetUrl}" style="background:#0cdcf7; color:#111; padding:12px 25px; text-decoration:none; font-weight:bold; border-radius:5px; font-size:16px;">
                    Reset Password
                </a>
            </div>
            <p style="color:#666; font-size:13px;">This link expires in <strong>15 minutes</strong>.</p>
            <p style="color:#666; font-size:13px;">If you didn't request this, you can safely ignore this email.</p>
        </div>
    `;

    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'Study Zone <onboarding@resend.dev>',
                to: user.email,
                subject: 'Study Zone — Password Reset',
                html: htmlContent
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error("Resend API Error (Forgot Password):", errorData);
            throw new Error(errorData.message || "Failed to send email via Resend");
        }
    } catch (err) {
        user.resetPasswordToken = null;
        user.resetPasswordExpires = null;
        await user.save();
        throw new ApiError(500, "Could not send email. Please try again.");
    }

    return res.status(200).json(
        new ApiResponse(200, {}, "Password reset link sent to your email")
    );
});

/* ========================
   RESET PASSWORD
======================== */
export const resetPassword = asyncHandler(async (req, res) => {
    const { email, token, newPassword } = req.body;

    if (!email || !token || !newPassword) {
        throw new ApiError(400, "All fields are required");
    }

    if (newPassword.length < 6) {
        throw new ApiError(400, "Password must be at least 6 characters");
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
        email: email.toLowerCase(),
        resetPasswordToken: hashedToken,
        resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) {
        throw new ApiError(400, "Invalid or expired reset link.");
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    return res.status(200).json(
        new ApiResponse(200, {}, "Password reset successfully. You can now login.")
    );
});