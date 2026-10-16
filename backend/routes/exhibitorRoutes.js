import { Router } from "express";
import { getExhibitors, getMyExhibitor, upsertExhibitor, approveExhibitor } from "../controllers/exhibitorController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = Router();
router.get("/", getExhibitors);
router.get("/me", protect, authorize("exhibitor"), getMyExhibitor);
router.post("/me", protect, authorize("exhibitor"), upsertExhibitor);
router.put("/:id/approve", protect, authorize("admin","organizer"), approveExhibitor);
export default router;
