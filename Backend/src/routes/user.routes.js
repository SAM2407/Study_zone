import { Router } from "express";
import {
    sendVerificationOTP,
    verifyOTPAndRegister,
    resendOTP,
    loginUser,
    getCurrentUser,
    forgotPassword,
    resetPassword
} from "../controllers/user.controllers.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/send-otp", sendVerificationOTP);        // step 1
router.post("/verify-otp", verifyOTPAndRegister);     // step 2
router.post("/resend-otp", resendOTP);                // resend
router.post("/login", loginUser);
router.get("/current-user", verifyJWT, getCurrentUser);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

export default router;