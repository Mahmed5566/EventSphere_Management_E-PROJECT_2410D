import Task from "../models/Task.js";
import Expo from "../models/Expo.js";
import User from "../models/User.js";
import { asyncHandler, parsePagination, escapeRegex, sanitizeText, oneOf, isObjectId } from "../utils/validation.js";
import { recordActivity, notifyUser } from "../utils/activity.js";

const STATUSES = ["todo", "in-progress", "completed"];
const PRIORITIES = ["low", "medium", "high", "critical"];

async function loadExpo(user, expoId) {
  if (!isObjectId(expoId)) return { error: 400, message: "A valid event is required." };
  const expo = await Expo.findById(expoId).select("_id title createdBy");
  if (!expo) return { error: 404, message: "Event not found." };
  const canManage = user.role === "admin" || String(expo.createdBy) === String(user._id);
  return { expo, canManage };
}

async function buildSummary(expoId, assigneeOnly) {
  const match = { expo: expoId };
  if (assigneeOnly) match.assignee = assigneeOnly;
  const [byStatus, overdue] = await Promise.all([
    Task.aggregate([{ $match: match }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    Task.countDocuments({ ...match, status: { $ne: "completed" }, dueDate: { $ne: null, $lt: new Date() } }),
  ]);
  const summary = { todo: 0, "in-progress": 0, completed: 0, overdue };
  byStatus.forEach((row) => {
    if (summary[row._id] !== undefined) summary[row._id] = row.count;
  });
  summary.total = summary.todo + summary["in-progress"] + summary.completed;
  return summary;
}

// GET /api/tasks?expo=&status=&priority=&assignee=&q=&sort=&page=&limit=
export const list = asyncHandler(async (req, res) => {
  const access = await loadExpo(req.user, req.query.expo);
  if (access.error) return res.status(access.error).json({ success: false, message: access.message });

  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 50, maxLimit: 200 });
  const filter = { expo: access.expo._id };
  // Non-owners may only see their own assigned tasks.
  if (!access.canManage) filter.assignee = req.user._id;
  else if (req.query.assignee) filter.assignee = req.query.assignee;

  if (req.query.status && oneOf(req.query.status, STATUSES)) filter.status = req.query.status;
  if (req.query.priority && oneOf(req.query.priority, PRIORITIES)) filter.priority = req.query.priority;
  if (req.query.q) {
    const rx = { $regex: escapeRegex(req.query.q), $options: "i" };
    filter.$or = [{ title: rx }, { description: rx }];
  }

  const sort = req.query.sort === "due" ? { dueDate: 1 } : req.query.sort === "priority" ? { priority: -1, createdAt: -1 } : { createdAt: -1 };

  const [items, total] = await Promise.all([
    Task.find(filter).populate("assignee", "name email role").sort(sort).skip(skip).limit(limit).lean(),
    Task.countDocuments(filter),
  ]);
  const summary = await buildSummary(access.expo._id, access.canManage ? null : req.user._id);

  res.json({ success: true, items, summary, page, limit, total, hasMore: skip + items.length < total });
});

// POST /api/tasks
export const create = asyncHandler(async (req, res) => {
  const access = await loadExpo(req.user, req.body?.expo);
  if (access.error) return res.status(access.error).json({ success: false, message: access.message });
  if (!access.canManage) return res.status(403).json({ success: false, message: "Only the event owner can create tasks." });

  const title = sanitizeText(req.body.title, 200);
  if (!title) return res.status(400).json({ success: false, message: "Task title is required." });
  if (req.body.priority && !oneOf(req.body.priority, PRIORITIES)) return res.status(400).json({ success: false, message: "Invalid priority." });
  if (req.body.status && !oneOf(req.body.status, STATUSES)) return res.status(400).json({ success: false, message: "Invalid status." });

  let assignee = null;
  if (req.body.assignee) {
    if (!isObjectId(req.body.assignee)) return res.status(400).json({ success: false, message: "Invalid assignee." });
    assignee = await User.findById(req.body.assignee).select("_id name");
    if (!assignee) return res.status(400).json({ success: false, message: "Assignee not found." });
  }

  const task = await Task.create({
    expo: access.expo._id,
    title,
    description: sanitizeText(req.body.description, 4000),
    priority: req.body.priority || "medium",
    status: req.body.status || "todo",
    dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
    assignee: assignee?._id || null,
    createdBy: req.user._id,
    tags: Array.isArray(req.body.tags) ? req.body.tags.slice(0, 10).map((t) => sanitizeText(t, 40)) : [],
  });

  await recordActivity({
    actor: req.user._id,
    actorName: req.user.name,
    action: "created",
    entityType: "Task",
    entityId: task._id,
    expo: access.expo._id,
    summary: `Created task "${task.title}"${assignee ? ` and assigned ${assignee.name}` : ""}`,
    meta: { priority: task.priority },
  });

  if (assignee && String(assignee._id) !== String(req.user._id)) {
    await notifyUser(req.app.get("io"), {
      user: assignee._id,
      title: "New task assigned",
      message: `${req.user.name} assigned you "${task.title}".`,
      type: "task",
      data: { taskId: task._id, expo: access.expo._id },
      dedupeKey: `task-assigned:${task._id}:${assignee._id}`,
    });
  }

  res.status(201).json({ success: true, task });
});

// PUT /api/tasks/:id
export const update = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id);
  if (!task) return res.status(404).json({ success: false, message: "Task not found." });
  const access = await loadExpo(req.user, task.expo);
  if (access.error) return res.status(access.error).json({ success: false, message: access.message });

  const isAssignee = task.assignee && String(task.assignee) === String(req.user._id);
  if (!access.canManage && !isAssignee) return res.status(403).json({ success: false, message: "You cannot modify this task." });

  const patch = {};
  // An assignee (non-owner) may only move the task's status.
  const fields = access.canManage
    ? ["title", "description", "priority", "status", "dueDate", "assignee", "tags"]
    : ["status"];

  if (fields.includes("title") && req.body.title !== undefined) {
    const title = sanitizeText(req.body.title, 200);
    if (!title) return res.status(400).json({ success: false, message: "Task title cannot be empty." });
    patch.title = title;
  }
  if (fields.includes("description") && req.body.description !== undefined) patch.description = sanitizeText(req.body.description, 4000);
  if (fields.includes("priority") && req.body.priority !== undefined) {
    if (!oneOf(req.body.priority, PRIORITIES)) return res.status(400).json({ success: false, message: "Invalid priority." });
    patch.priority = req.body.priority;
  }
  if (req.body.status !== undefined) {
    if (!oneOf(req.body.status, STATUSES)) return res.status(400).json({ success: false, message: "Invalid status." });
    patch.status = req.body.status;
    patch.completedAt = req.body.status === "completed" ? new Date() : null;
  }
  if (fields.includes("dueDate") && req.body.dueDate !== undefined) patch.dueDate = req.body.dueDate ? new Date(req.body.dueDate) : null;
  if (fields.includes("tags") && req.body.tags !== undefined) patch.tags = Array.isArray(req.body.tags) ? req.body.tags.slice(0, 10).map((t) => sanitizeText(t, 40)) : [];

  let newAssignee = null;
  if (fields.includes("assignee") && req.body.assignee !== undefined) {
    if (req.body.assignee === null || req.body.assignee === "") {
      patch.assignee = null;
    } else {
      if (!isObjectId(req.body.assignee)) return res.status(400).json({ success: false, message: "Invalid assignee." });
      newAssignee = await User.findById(req.body.assignee).select("_id name");
      if (!newAssignee) return res.status(400).json({ success: false, message: "Assignee not found." });
      patch.assignee = newAssignee._id;
    }
  }

  const beforeStatus = task.status;
  Object.assign(task, patch);
  await task.save();

  await recordActivity({
    actor: req.user._id,
    actorName: req.user.name,
    action: patch.status === "completed" && beforeStatus !== "completed" ? "completed" : "updated",
    entityType: "Task",
    entityId: task._id,
    expo: task.expo,
    summary:
      patch.status === "completed" && beforeStatus !== "completed"
        ? `Completed task "${task.title}"`
        : `Updated task "${task.title}"`,
    meta: { changes: Object.keys(patch) },
  });

  if (newAssignee && String(newAssignee._id) !== String(req.user._id)) {
    await notifyUser(req.app.get("io"), {
      user: newAssignee._id,
      title: "Task assigned to you",
      message: `${req.user.name} assigned you "${task.title}".`,
      type: "task",
      data: { taskId: task._id, expo: task.expo },
      dedupeKey: `task-assigned:${task._id}:${newAssignee._id}`,
    });
  }

  res.json({ success: true, task });
});

// DELETE /api/tasks/:id
export const remove = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id);
  if (!task) return res.status(404).json({ success: false, message: "Task not found." });
  const access = await loadExpo(req.user, task.expo);
  if (access.error) return res.status(access.error).json({ success: false, message: access.message });
  if (!access.canManage) return res.status(403).json({ success: false, message: "Only the event owner can delete tasks." });

  await task.deleteOne();
  await recordActivity({
    actor: req.user._id,
    actorName: req.user.name,
    action: "deleted",
    entityType: "Task",
    entityId: req.params.id,
    expo: access.expo._id,
    summary: `Deleted task "${task.title}"`,
  });
  res.json({ success: true });
});
