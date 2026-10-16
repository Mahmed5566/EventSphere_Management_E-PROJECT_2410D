import { Router } from "express";
import { getAnalytics } from "../controllers/analyticsController.js";
import { summary, exportCsv, exportPdf, breakdown } from "../controllers/analyticsReportController.js";
import { protect, authorize } from "../middleware/auth.js";

const router = Router();
router.get("/", protect, authorize("admin", "organizer"), getAnalytics);
router.get("/summary", protect, authorize("admin", "organizer"), summary);
router.get("/breakdown", protect, authorize("admin", "organizer"), breakdown);
router.get("/export.csv", protect, authorize("admin", "organizer"), exportCsv);
router.get("/report.pdf", protect, authorize("admin", "organizer"), exportPdf);
export default router;
