import { Router } from "express";
import * as customerAuthController from "../modules/customer/controllers/customerAuthController";
import { otpRateLimiter, loginRateLimiter } from "../middleware/rateLimiter";

const router = Router();

// Send SMS OTP route
router.post("/send-sms-otp", otpRateLimiter, customerAuthController.sendSmsOtp);

// Verify SMS OTP and login route
router.post("/verify-sms-otp", loginRateLimiter, customerAuthController.verifySmsOtp);

// Register route
router.post("/register", customerAuthController.register);

export default router;
