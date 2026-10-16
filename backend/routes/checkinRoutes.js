import { Router } from "express";
import { protect, authorize } from "../middleware/auth.js";
import * as c from "../controllers/checkinController.js";

const router = Router();

// QR image for a ticket token (token never appears in a URL).
router.get("/tickets/:id/qr", protect, authorize("admin", "organizer", "staff"), c.ticketQr);
// Validate a scanned token without consuming it.
router.get("/verify/:token", protect, authorize("admin", "organizer", "staff"), c.verify);
// Perform a real, atomic check-in.
router.post("/", protect, authorize("admin", "organizer", "staff"), c.checkin);
// Attendance stats.
router.get("/stats", protect, authorize("admin", "organizer", "staff"), c.stats);

export default router;
