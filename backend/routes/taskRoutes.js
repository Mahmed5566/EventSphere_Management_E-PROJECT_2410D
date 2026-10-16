import { Router } from "express";
import { protect } from "../middleware/auth.js";
import * as c from "../controllers/taskController.js";

const r = Router();
r.use(protect);
r.get("/", c.list);
r.post("/", c.create);
r.put("/:id", c.update);
r.delete("/:id", c.remove);
export default r;
