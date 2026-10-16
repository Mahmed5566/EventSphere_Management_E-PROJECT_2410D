import Notification from "../models/Notification.js";
import { asyncHandler, parsePagination } from "../utils/validation.js";

// GET /api/notifications?unread=true&page=&limit=
export const mine = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 20, maxLimit: 50 });
  const filter = { user: req.user._id };
  if (req.query.unread === "true") filter.read = false;

  const [notifications, total, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ user: req.user._id, read: false }),
  ]);

  res.json({ success: true, notifications, page, limit, total, unread, hasMore: skip + notifications.length < total });
});

// GET /api/notifications/unread-count
export const unreadCount = asyncHandler(async (req, res) => {
  const unread = await Notification.countDocuments({ user: req.user._id, read: false });
  res.json({ success: true, unread });
});

// PUT /api/notifications/:id/read — only the owner can mark their own notification.
export const read = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    { read: true, readAt: new Date() },
    { new: true }
  );
  if (!notification) return res.status(404).json({ success: false, message: "Notification not found" });
  res.json({ success: true, notification });
});

// PUT /api/notifications/read-all
export const readAll = asyncHandler(async (req, res) => {
  await Notification.updateMany({ user: req.user._id, read: false }, { read: true, readAt: new Date() });
  res.json({ success: true });
});
