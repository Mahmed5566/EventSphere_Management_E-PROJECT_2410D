import { Router } from "express";
import { createFeedback, getFeedback, getMine } from "../controllers/feedbackController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = Router();
router.post("/", protect, createFeedback);
router.get("/mine", protect, getMine);
router.get("/", protect, authorize("admin","organizer"), getFeedback);
export default router;
