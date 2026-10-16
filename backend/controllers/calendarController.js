import Session from "../models/Session.js";
import Expo from "../models/Expo.js";
import { asyncHandler, parseDateRange, escapeRegex } from "../utils/validation.js";
import { detectSessionConflicts, validateTimeRange } from "../utils/scheduling.js";

const STAFF = ["admin", "organizer", "staff"];

// Which events a user may see on the calendar.
//  admin      -> null (all)
//  organizer  -> events they created
//  others     -> published events only
async function allowedExpoIds(user) {
  if (user.role === "admin") return null;
  const query = user.role === "organizer" ? { createdBy: user._id } : { status: "published" };
  const expos = await Expo.find(query).select("_id");
  return expos.map((e) => e._id);
}

// GET /api/calendar?expo=&from=&to=&speaker=&location=
export const list = asyncHandler(async (req, res) => {
  const range = parseDateRange(req.query);
  if (!range.valid) return res.status(400).json({ success: false, message: "Invalid date range." });

  const allowed = await allowedExpoIds(req.user);
  const filter = {};
  if (req.query.expo) {
    if (allowed && !allowed.some((id) => String(id) === String(req.query.expo))) {
      return res.status(403).json({ success: false, message: "Access denied for this event." });
    }
    filter.expo = req.query.expo;
  } else if (allowed) {
    filter.expo = { $in: allowed };
  }
  if (req.query.speaker) filter.speaker = { $regex: escapeRegex(req.query.speaker), $options: "i" };
  if (req.query.location) filter.location = { $regex: escapeRegex(req.query.location), $options: "i" };
  if (range.from || range.to) {
    filter.startTime = { ...(range.from ? { $gte: range.from } : {}), ...(range.to ? { $lte: range.to } : {}) };
  }

  const sessions = await Session.find(filter)
    .populate("expo", "title date endDate location status createdBy")
    .sort({ startTime: 1 })
    .limit(500)
    .lean();

  let conflicts = [];
  if (STAFF.includes(req.user.role)) {
    for (let i = 0; i < sessions.length; i += 1) {
      for (let j = i + 1; j < sessions.length; j += 1) {
        const a = sessions[i];
        const b = sessions[j];
        if (String(a.expo?._id || a.expo) !== String(b.expo?._id || b.expo)) continue;
        for (const conflict of detectSessionConflicts(a, [b])) {
          conflicts.push({ ...conflict, sessionA: a._id, sessionB: b._id, expo: a.expo?._id || a.expo });
        }
      }
    }
  }

  res.json({ success: true, sessions, conflicts, from: range.from, to: range.to });
});

// GET /api/calendar/events?from=&to=
export const events = asyncHandler(async (req, res) => {
  const range = parseDateRange(req.query);
  if (!range.valid) return res.status(400).json({ success: false, message: "Invalid date range." });

  const allowed = await allowedExpoIds(req.user);
  const filter = {};
  if (allowed) filter._id = { $in: allowed };
  if (range.to) filter.date = { $lte: range.to };
  if (range.from) {
    filter.$or = [{ endDate: { $gte: range.from } }, { endDate: null, date: { $gte: range.from } }];
  }

  const expos = await Expo.find(filter).select("title date endDate location status").sort({ date: 1 }).limit(500).lean();
  res.json({ success: true, events: expos });
});

// POST /api/calendar/conflicts  (preflight)  { expo, startTime, endTime, speaker, location, ignoreId }
export const checkConflicts = asyncHandler(async (req, res) => {
  if (!STAFF.includes(req.user.role)) return res.status(403).json({ success: false, message: "Access denied." });
  const { expo, startTime, endTime, speaker, location, ignoreId } = req.body || {};

  const range = validateTimeRange(startTime, endTime);
  if (!range.valid) {
    return res.json({ success: true, conflicts: [{ type: "invalid_time", severity: "error", message: range.message, session: null }] });
  }
  if (!expo) return res.status(400).json({ success: false, message: "A valid event is required." });

  const allowed = await allowedExpoIds(req.user);
  if (allowed && !allowed.some((id) => String(id) === String(expo))) {
    return res.status(403).json({ success: false, message: "Access denied for this event." });
  }

  const query = { expo };
  if (ignoreId) query._id = { $ne: ignoreId };
  const existing = await Session.find(query).select("title speaker location startTime endTime").lean();
  const conflicts = detectSessionConflicts({ _id: ignoreId, startTime, endTime, speaker, location }, existing);
  res.json({ success: true, conflicts });
});
