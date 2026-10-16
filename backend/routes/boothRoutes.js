import { Router } from "express";
import { getBooths, createBooth, updateBooth, reserveBooth, deleteBooth, saveLayout, assign } from "../controllers/boothController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = Router();
router.get("/expo/:expoId", getBooths);
router.post("/expo/:expoId", protect, authorize("admin","organizer"), createBooth);
router.put("/expo/:expoId/layout", protect, authorize("admin","organizer"), saveLayout);
router.put("/:id", protect, authorize("admin","organizer"), updateBooth);
router.put("/:id/assign", protect, authorize("admin","organizer"), assign);
router.post("/:id/reserve", protect, authorize("exhibitor"), reserveBooth);
router.delete("/:id", protect, authorize("admin","organizer"), deleteBooth);
export default router;
