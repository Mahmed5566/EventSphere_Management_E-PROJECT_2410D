import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { list } from "../controllers/activityController.js";

const router = Router();
router.get("/", protect, list);
export default router;
