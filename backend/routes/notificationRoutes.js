import { Router } from "express";
import { protect } from "../middleware/auth.js";
import { mine, read, readAll, unreadCount } from "../controllers/notificationController.js";

const r = Router();
r.get("/", protect, mine);
r.get("/unread-count", protect, unreadCount);
r.put("/read-all", protect, readAll);
r.put("/:id/read", protect, read);
export default r;
