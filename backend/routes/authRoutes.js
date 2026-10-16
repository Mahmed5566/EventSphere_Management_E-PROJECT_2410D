import { Router } from "express";
import { register, login, googleLogin, githubLogin, logout, me, updateProfile, changePassword, clearProfile, forgotPassword, resetPassword } from "../controllers/authController.js";
import { protect } from "../middleware/auth.js";

const router = Router();
router.post("/register", register);
router.post("/login", login);
router.post("/google", googleLogin);
router.post("/github", githubLogin);
router.post("/logout", protect, logout);
router.get("/me", protect, me);
router.put("/profile", protect, updateProfile);
router.put("/password", protect, changePassword);
router.delete("/profile", protect, clearProfile);
router.post("/forgot-password", forgotPassword);
router.put("/reset-password/:token", resetPassword);
export default router;
