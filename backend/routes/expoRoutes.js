import { Router } from "express";
import { getExpos, getExpo, createExpo, updateExpo, deleteExpo, registerForExpo, getExpoRegistrations, setProcessingReady } from "../controllers/expoController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = Router();
router.get("/", getExpos);
router.get("/:id", getExpo);
router.post("/", protect, authorize("admin","organizer"), createExpo);
router.put("/:id", protect, authorize("admin","organizer"), updateExpo);
router.delete("/:id", protect, authorize("admin","organizer"), deleteExpo);
router.post("/:id/register", protect, registerForExpo);
router.get("/:id/registrations", protect, authorize("admin","organizer"), getExpoRegistrations);
router.put("/:id/processing-ready", protect, authorize("admin","organizer"), setProcessingReady);
export default router;
