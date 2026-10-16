import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { list, events, checkConflicts } from "../controllers/calendarController.js";

const r = Router();
r.get("/", protect, list);
r.get("/events", protect, events);
r.post("/conflicts", protect, checkConflicts);
export default r;
