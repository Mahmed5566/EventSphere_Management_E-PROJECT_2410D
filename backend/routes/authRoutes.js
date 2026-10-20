import { Router } from "express";
import { register, login, googleLogin, githubLogin, logout, me, updateProfile, changePassword, clearProfile, forgotPassword, resetPassword } from "../controllers/authController.js";
import { protect } from "../middleware/auth.js";
import { rateLimit } from "../utils/rateLimit.js";

const router = Router();

// Credential endpoints are the highest-value brute-force targets, so every one
// of them is rate limited per IP. Other app endpoints keep their own limits.
const loginLimit = rateLimit({ windowMs: 15 * 60_000, max: 10, message: "Too many sign-in attempts. Please wait 15 minutes and try again." });
const registerLimit = rateLimit({ windowMs: 60 * 60_000, max: 20, message: "Too many accounts created from this address. Please try again later." });
const resetLimit = rateLimit({ windowMs: 60 * 60_000, max: 5, message: "Too many password reset requests. Please try again later." });
const googleLimit = rateLimit({ windowMs: 15 * 60_000, max: 30, message: "Too many Google sign-in attempts. Please slow down." });

router.post("/register", registerLimit, register);
router.post("/login", loginLimit, login);
router.post("/google", googleLimit, googleLogin);
router.post("/github", githubLogin);
router.post("/logout", protect, logout);
router.get("/me", protect, me);
router.put("/profile", protect, updateProfile);
router.put("/password", protect, changePassword);
router.delete("/profile", protect, clearProfile);
router.post("/forgot-password", resetLimit, forgotPassword);
router.put("/reset-password/:token", resetLimit, resetPassword);
export default router;
