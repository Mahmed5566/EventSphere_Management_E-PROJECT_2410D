import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import Exhibitor from "../models/Exhibitor.js";
import User from "../models/User.js";

// Exhibitor profiles contain business contact details (phone) plus the linked
// account's email. That is not public information, so the directory is
// role-aware: anonymous visitors and attendees see an approved, contact-free
// listing; organizers, admins and the exhibitor's own account see full records.
async function viewerFrom(req) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  try {
    const decoded = jwt.verify(header.split(" ")[1], process.env.JWT_SECRET);
    return await User.findById(decoded.id).select("_id role");
  } catch {
    return null;
  }
}

export const getExhibitors = async (req, res) => {
  const viewer = await viewerFrom(req);
  const privileged = viewer && ["admin", "organizer"].includes(viewer.role);

  const and = [];
  if (req.query.q) {
    const safe = String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    and.push({ $or: [
      { companyName: { $regex: safe, $options: "i" } },
      { description: { $regex: safe, $options: "i" } },
      { products: { $regex: safe, $options: "i" } },
      { services: { $regex: safe, $options: "i" } }
    ] });
  }
  if (req.query.expo && mongoose.isValidObjectId(req.query.expo)) {
    // Booths attach an exhibitor to an event; filter the directory by event.
    const Booth = (await import("../models/Booth.js")).default;
    const ids = await Booth.find({ expo: req.query.expo, exhibitor: { $ne: null } }).distinct("exhibitor");
    and.push({ _id: { $in: ids } });
  }
  // Anonymous/non-management callers only ever see approved exhibitors.
  if (!privileged) and.push({ approved: true });

  const filter = and.length ? { $and: and } : {};
  const query = Exhibitor.find(filter).sort({ companyName: 1 });
  // Field projection is what actually prevents the leak — never select the
  // linked user's email/phone for a non-privileged viewer.
  query.populate("user", privileged ? "name email phone" : "name");
  const exhibitors = await query.select(privileged ? "" : "-phone -documents");

  res.json({ success: true, count: exhibitors.length, exhibitors });
};

export const getMyExhibitor = async (req, res) => {
  const exhibitor = await Exhibitor.findOne({ user: req.user._id }).populate("user", "name email phone");
  res.json({ success: true, exhibitor });
};

export const upsertExhibitor = async (req, res) => {
  const exhibitor = await Exhibitor.findOneAndUpdate(
    { user: req.user._id },
    { ...req.body, user: req.user._id },
    { new: true, upsert: true, runValidators: true }
  );
  res.json({ success: true, exhibitor });
};

export const approveExhibitor = async (req, res) => {
  const exhibitor = await Exhibitor.findById(req.params.id);
  if (!exhibitor) return res.status(404).json({ success: false, message: "Exhibitor not found." });
  // An organizer may only approve an exhibitor that applied to one of their own
  // events. Without this check any organizer could approve any exhibitor.
  if (req.user.role === "organizer") {
    const [Expo, ExhibitorApplication] = await Promise.all([
      import("../models/Expo.js").then((m) => m.default),
      import("../models/ExhibitorApplication.js").then((m) => m.default),
    ]);
    const apps = await ExhibitorApplication.find({ exhibitor: exhibitor._id }).populate("expo", "createdBy").select("expo");
    const owns = apps.some((a) => a.expo && String(a.expo.createdBy) === String(req.user._id));
    if (!owns) return res.status(403).json({ success: false, message: "You can only approve exhibitors for your own events." });
  }
  exhibitor.approved = req.body.approved !== false;
  await exhibitor.save();
  res.json({ success: true, exhibitor });
};
