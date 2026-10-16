import { Router } from "express";
import { protect, authorize } from "../middleware/auth.js";
import { status, ask } from "../controllers/copilotController.js";
import { rateLimit } from "../utils/rateLimit.js";

const r = Router();
r.get("/status", protect, status);
// The AI provider is the one external, paid resource: throttle per user.
r.post("/ask", protect, authorize("admin", "organizer", "staff", "attendee", "exhibitor"), rateLimit({ windowMs: 60_000, max: 20 }), ask);
export default r;
