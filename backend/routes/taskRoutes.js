import { Router } from "express";
import { protect, authorize } from "../middleware/auth.js";
import * as c from "../controllers/taskController.js";

const r = Router();
// Tasks are event-scoped operational data. Organizers and admins manage them;
// the controller additionally restricts non-owners to their own assignments.
r.use(protect, authorize("admin", "organizer", "staff"));
r.get("/", c.list);
r.post("/", c.create);
r.put("/:id", c.update);
r.delete("/:id", c.remove);
export default r;
