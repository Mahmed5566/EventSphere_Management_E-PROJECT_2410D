import { Router } from "express";
import { getSessions, createSession, updateSession, deleteSession, bookmarkSession, joinSession } from "../controllers/sessionController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = Router();
router.get("/expo/:expoId", getSessions);
router.post("/expo/:expoId", protect, authorize("admin","organizer"), createSession);
router.put("/:id", protect, authorize("admin","organizer"), updateSession);
router.delete("/:id", protect, authorize("admin","organizer"), deleteSession);
router.post("/:id/bookmark", protect, bookmarkSession);
router.post("/:id/join", protect, joinSession);
export default router;
