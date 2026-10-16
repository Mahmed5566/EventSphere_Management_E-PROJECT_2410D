import Session from "../models/Session.js";
import Expo from "../models/Expo.js";
import { detectSessionConflicts, validateTimeRange } from "../utils/scheduling.js";
import { recordActivity } from "../utils/activity.js";

const DAY_MS = 24 * 60 * 60 * 1000;

// Warn (never block) when a session falls outside the event's own date window.
function eventWindowWarnings(expo, start, end) {
  const warnings = [];
  if (expo?.date && start < new Date(expo.date)) {
    warnings.push({ type: "outside_event_window", severity: "warning", message: `Session starts before the event begins (${new Date(expo.date).toISOString()}).`, session: null });
  }
  if (expo?.endDate) {
    const windowEnd = new Date(new Date(expo.endDate).getTime() + DAY_MS - 1);
    if (end > windowEnd) {
      warnings.push({ type: "outside_event_window", severity: "warning", message: `Session ends after the event finishes (${new Date(expo.endDate).toISOString()}).`, session: null });
    }
  }
  return warnings;
}

export const getSessions = async (req, res) => {
  const sessions = await Session.find({ expo: req.params.expoId }).sort({ startTime: 1 });
  res.json({ success: true, sessions });
};

export const createSession = async (req, res) => {
  const expo = await Expo.findOne(req.user.role === "admin" ? { _id: req.params.expoId } : { _id: req.params.expoId, createdBy: req.user._id });
  if (!expo) return res.status(404).json({ success: false, message: "Event not found or access denied." });

  const range = validateTimeRange(req.body.startTime, req.body.endTime);
  if (!range.valid) return res.status(400).json({ success: false, message: range.message, reason: range.reason });

  const existing = await Session.find({ expo: expo._id }).select("title speaker location startTime endTime").lean();
  const conflicts = detectSessionConflicts(
    { startTime: range.start, endTime: range.end, speaker: req.body.speaker, location: req.body.location },
    existing
  );
  if (conflicts.some((c) => c.severity === "error")) {
    return res.status(409).json({ success: false, message: "Scheduling conflict detected.", conflicts });
  }
  const warnings = eventWindowWarnings(expo, range.start, range.end);

  const session = await Session.create({ ...req.body, expo: expo._id });
  await recordActivity({
    actor: req.user._id,
    actorName: req.user.name,
    action: "created",
    entityType: "Session",
    entityId: session._id,
    expo: expo._id,
    summary: `Scheduled session "${session.title}"${session.speaker ? ` with ${session.speaker}` : ""}`,
    meta: { startTime: session.startTime, endTime: session.endTime, location: session.location },
  });
  res.status(201).json({ success: true, session, warnings });
};

export const updateSession = async (req, res) => {
  const current = await Session.findById(req.params.id);
  if (!current) return res.status(404).json({ success: false, message: "Session not found." });
  const expo = await Expo.findOne(req.user.role === "admin" ? { _id: current.expo } : { _id: current.expo, createdBy: req.user._id });
  if (!expo) return res.status(403).json({ success: false, message: "Access denied." });

  const merge = { ...current.toObject(), ...req.body };
  const range = validateTimeRange(merge.startTime, merge.endTime);
  if (!range.valid) return res.status(400).json({ success: false, message: range.message, reason: range.reason });

  const existing = await Session.find({ expo: current.expo, _id: { $ne: current._id } })
    .select("title speaker location startTime endTime")
    .lean();
  const conflicts = detectSessionConflicts(
    { _id: current._id, startTime: range.start, endTime: range.end, speaker: merge.speaker, location: merge.location },
    existing
  );
  if (conflicts.some((c) => c.severity === "error")) {
    return res.status(409).json({ success: false, message: "Scheduling conflict detected.", conflicts });
  }
  const warnings = eventWindowWarnings(expo, range.start, range.end);

  const session = await Session.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!session) return res.status(404).json({ success: false, message: "Session not found." });
  await recordActivity({
    actor: req.user._id,
    actorName: req.user.name,
    action: "updated",
    entityType: "Session",
    entityId: session._id,
    expo: current.expo,
    summary: `Updated session "${session.title}"`,
    meta: { startTime: session.startTime, endTime: session.endTime },
  });
  res.json({ success: true, session, warnings });
};

export const deleteSession = async (req, res) => {
  const current = await Session.findById(req.params.id);
  if (!current) return res.status(404).json({ success: false, message: "Session not found." });
  const expo = await Expo.findOne(req.user.role === "admin" ? { _id: current.expo } : { _id: current.expo, createdBy: req.user._id });
  if (!expo) return res.status(403).json({ success: false, message: "Access denied." });
  const session = await Session.findByIdAndDelete(req.params.id);
  if (!session) return res.status(404).json({ success: false, message: "Session not found." });
  res.json({ success: true, message: "Session deleted." });
};

export const bookmarkSession = async (req, res) => {
  const session = await Session.findById(req.params.id);
  if (!session) return res.status(404).json({ success: false, message: "Session not found." });
  const exists = session.attendees.some(id => id.toString() === req.user._id.toString());
  if (!exists) session.attendees.push(req.user._id);
  else session.attendees = session.attendees.filter(id => id.toString() !== req.user._id.toString());
  await session.save();
  res.json({ success: true, bookmarked: !exists, session });
};


export const joinSession=async(req,res)=>{const session=await Session.findById(req.params.id);if(!session)return res.status(404).json({success:false,message:'Session not found.'});if(session.attendees.some(x=>String(x)===String(req.user._id)))return res.status(409).json({success:false,message:'Already registered for this session.'});if(session.capacity>0&&session.attendees.length>=session.capacity)return res.status(409).json({success:false,message:'Session is full.'});session.attendees.push(req.user._id);await session.save();try{const Engagement=(await import('../models/EventEngagement.js')).default;await Engagement.create({expo:session.expo,user:req.user._id,type:'session',targetId:session._id});}catch{}res.json({success:true,session,message:'Session booked.'})};