import { Router } from "express";
import { protect, authorize } from "../middleware/auth.js";
import * as c from "../controllers/budgetController.js";

const r = Router();
r.use(protect, authorize("admin", "organizer"));
r.get("/", c.list);
r.get("/export.csv", c.exportCsv);
r.post("/", c.create);
r.put("/:id", c.update);
r.delete("/:id", c.remove);
export default r;
