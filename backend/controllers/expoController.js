import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import Expo from "../models/Expo.js";
import User from "../models/User.js";
import Booth from "../models/Booth.js";
import ExpoRegistration from "../models/ExpoRegistration.js";
import TicketSetting from "../models/TicketSetting.js";
import TicketOrder from "../models/TicketOrder.js";
import ExhibitorApplication from "../models/ExhibitorApplication.js";
import Notification from "../models/Notification.js";
import { recordActivity } from "../utils/activity.js";

// Optional authentication: the public site is anonymous, dashboards send a JWT.
// `protect` cannot be used (it would 401 the public homepage), so the token is
// read directly when present and ignored when absent/invalid.
async function optionalUser(req) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  try {
    const decoded = jwt.verify(header.split(" ")[1], process.env.JWT_SECRET);
    return await User.findById(decoded.id).select("_id role");
  } catch {
    return null;
  }
}

export const getExpos = async (req, res) => {
  const viewer = await optionalUser(req);
  // Anonymous visitors and non-management roles only ever see events that were
  // actually published. Organizers/admins additionally see the drafts they own.
  // This stops one organizer's private drafts leaking into another's dashboards.
  let filter;
  if (!viewer) {
    filter = { status: "published" };
  } else if (viewer.role === "organizer") {
    filter = { $or: [{ status: "published" }, { createdBy: viewer._id }] };
  } else if (viewer.role === "admin") {
    filter = {};
  } else if (viewer.role === "staff") {
    filter = { status: { $in: ["published", "completed"] } };
  } else {
    // attendee / exhibitor
    filter = { status: { $in: ["published", "completed"] } };
  }

  const expos = await Expo.find(filter).populate("createdBy", "name email").sort({ date: 1 });
  res.json({ success: true, count: expos.length, expos });
};

export const getExpo = async (req, res) => {
  const expo = await Expo.findById(req.params.id).populate("createdBy", "name email");
  if (!expo) return res.status(404).json({ success: false, message: "Expo not found." });
  res.json({ success: true, expo });
};

export const createExpo = async (req, res) => {
  const expo = await Expo.create({ ...req.body, createdBy: req.user._id });
  await recordActivity({ actor: req.user._id, actorName: req.user.name, action: "created", entityType: "Event", entityId: expo._id, expo: expo._id, summary: `Created event "${expo.title}"`, meta: { status: expo.status, location: expo.location } });
  res.status(201).json({ success: true, expo });
};

export const updateExpo = async (req, res) => {
  const filter = req.user.role === "admin" ? { _id: req.params.id } : { _id: req.params.id, createdBy: req.user._id };
  const expo = await Expo.findOneAndUpdate(filter, req.body, { new: true, runValidators: true });
  if (!expo) return res.status(404).json({ success: false, message: "Expo not found." });
  await recordActivity({ actor: req.user._id, actorName: req.user.name, action: "updated", entityType: "Event", entityId: expo._id, expo: expo._id, summary: `Updated event "${expo.title}"`, meta: { fields: Object.keys(req.body || {}) } });
  res.json({ success: true, expo });
};

export const deleteExpo = async (req, res, next) => {
  try {
    const filter = req.user.role === "admin"
      ? { _id: req.params.id }
      : { _id: req.params.id, createdBy: req.user._id };

    // First verify ownership, then remove the event and every event-owned record.
    // This prevents stale tickets, booth reservations, exhibitor applications and
    // ticket settings from making a deleted event appear elsewhere in the app.
    const expo = await Expo.findOne(filter);
    if (!expo) return res.status(404).json({ success: false, message: "Event not found or you do not have permission to delete it." });

    await Promise.all([
      Booth.deleteMany({ expo: expo._id }),
      ExpoRegistration.deleteMany({ expo: expo._id }),
      TicketSetting.deleteMany({ expo: expo._id }),
      TicketOrder.deleteMany({ expo: expo._id }),
      ExhibitorApplication.deleteMany({ expo: expo._id }),
    ]);

    await Expo.deleteOne({ _id: expo._id });
    res.json({ success: true, message: `Event "${expo.title}" deleted successfully.` });
  } catch (error) {
    next(error);
  }
};

export const registerForExpo = async (req, res) => {
  try {
    const expo = await Expo.findById(req.params.id);
    if (!expo) return res.status(404).json({ success: false, message: "Event not found." });
    if (expo.status === "cancelled") return res.status(409).json({ success: false, message: "This event is cancelled." });
    const type = req.user.role === "exhibitor" ? "exhibitor" : "attendee";
    const registration = await ExpoRegistration.create({
      expo: expo._id, user: req.user._id, type,
      status: type === "attendee" ? "approved" : "pending"
    });
    const populated = await ExpoRegistration.findById(registration._id).populate("user", "name email phone").populate("expo", "title date location createdBy");
    if (expo.createdBy && String(expo.createdBy) !== String(req.user._id)) {
      const n = await Notification.create({
        user: expo.createdBy,
        title: type === "attendee" ? "New attendee registration" : "New exhibitor registration",
        message: `${req.user.name} registered for ${expo.title}.`,
        type: type === "attendee" ? "registration" : "exhibitor",
        data: { expoId: expo._id, registrationId: registration._id, userId: req.user._id }
      });
      req.app.get("io")?.to(`user:${expo.createdBy}`).emit("notification:new", n);
    }
    res.status(201).json({ success: true, registration: populated, message: type === "attendee" ? "Event registration saved successfully." : "Exhibitor registration saved successfully." });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: "Already registered for this event." });
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getExpoRegistrations = async (req, res) => {
  try {
    const expo = await Expo.findById(req.params.id).select("title createdBy");
    if (!expo) return res.status(404).json({ success: false, message: "Event not found." });
    if (req.user.role !== "admin" && String(expo.createdBy) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: "You can only view registrations for your own events." });
    }
    const registrations = await ExpoRegistration.find({ expo: expo._id })
      .populate("user", "name email phone role company")
      .populate("expo", "title date location")
      .sort({ createdAt: -1 });
    res.json({ success: true, registrations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


export const setProcessingReady=async(req,res)=>{const filter=req.user.role==='admin'?{_id:req.params.id}:{_id:req.params.id,createdBy:req.user._id};const expo=await Expo.findOneAndUpdate(filter,{processingReady:Boolean(req.body.processingReady)},{new:true});if(!expo)return res.status(404).json({success:false,message:'Event not found.'});res.json({success:true,expo});};