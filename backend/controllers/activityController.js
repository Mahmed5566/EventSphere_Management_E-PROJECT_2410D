import Activity from "../models/Activity.js";
import Expo from "../models/Expo.js";
import { asyncHandler, parsePagination, parseDateRange, escapeRegex } from "../utils/validation.js";

// Activity visibility:
//  admin      -> everything
//  organizer  -> activity for the events they own, plus their own actions
//  everyone   -> only their own actions (never another user's private history)
async function scopeFilter(user, expoId) {
  if (expoId) {
    if (user.role === "admin") return { expo: expoId };
    const owns = await Expo.findOne({ _id: expoId, createdBy: user._id }).select("_id");
    return owns ? { expo: expoId } : { expo: expoId, actor: user._id };
  }
  if (user.role === "admin") return {};
  if (user.role === "organizer") {
    const expos = await Expo.find({ createdBy: user._id }).select("_id");
    return { $or: [{ expo: { $in: expos.map((e) => e._id) } }, { actor: user._id }] };
  }
  return { actor: user._id };
}

// GET /api/activity?expo=&entityType=&action=&from=&to=&q=&page=&limit=
export const list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 25, maxLimit: 100 });
  const range = parseDateRange(req.query);
  if (!range.valid) return res.status(400).json({ success: false, message: "Invalid date range." });

  const filter = { ...(await scopeFilter(req.user, req.query.expo)) };
  if (req.query.entityType) filter.entityType = String(req.query.entityType).slice(0, 40);
  if (req.query.action) filter.action = String(req.query.action).slice(0, 40);
  if (range.from || range.to) {
    filter.createdAt = { ...(range.from ? { $gte: range.from } : {}), ...(range.to ? { $lte: range.to } : {}) };
  }
  if (req.query.q) filter.summary = { $regex: escapeRegex(req.query.q), $options: "i" };

  const [items, total] = await Promise.all([
    Activity.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Activity.countDocuments(filter),
  ]);

  res.json({ success: true, items, page, limit, total, hasMore: skip + items.length < total });
});
