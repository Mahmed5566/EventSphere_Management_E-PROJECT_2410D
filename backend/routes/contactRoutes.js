import { Router } from "express";
import { submitContact, listContacts, markContactHandled } from "../controllers/contactController.js";
import { rateLimit } from "../utils/rateLimit.js";
import { protect, authorize } from "../middleware/auth.js";

const router = Router();

// Public contact form. The limiter is in-memory and per-process — documented
// in the README as needing Redis for multi-instance deployments.
const contactLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 6,
  keyFn: req => req.ip,
  message: "Too many messages in a short time. Please wait a few minutes and try again.",
});

router.post("/", contactLimit, submitContact);
router.get("/", protect, authorize("admin"), listContacts);
router.put("/:id/handled", protect, authorize("admin"), markContactHandled);

export default router;
