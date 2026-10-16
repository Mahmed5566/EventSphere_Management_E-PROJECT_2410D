import Booth from "../models/Booth.js";
import Expo from "../models/Expo.js";
import User from "../models/User.js";
import { oneOf } from "../utils/validation.js";
import { recordActivity, notifyUser } from "../utils/activity.js";

export const getBooths = async (req, res) => {
  const filter = req.params.expoId ? { expo: req.params.expoId } : {};
  const booths = await Booth.find(filter).populate("exhibitor", "name email company");
  res.json({ success: true, count: booths.length, booths });
};

export const createBooth = async (req, res) => {
  try {
    const booth = await Booth.create({ ...req.body, expo: req.params.expoId });
    res.status(201).json({ success: true, booth });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: "Booth number already exists for this expo." });
    res.status(400).json({ success: false, message: error.message });
  }
};

export const updateBooth = async (req, res) => {
  const booth = await Booth.findById(req.params.id);
  if (!booth) return res.status(404).json({ success: false, message: "Booth not found." });
  if (req.user.role !== "admin") {
    const expo = await Expo.findOne({ _id: booth.expo, createdBy: req.user._id });
    if (!expo) return res.status(403).json({ success: false, message: "Access denied." });
  }
  Object.assign(booth, req.body);
  await booth.save();
  res.json({ success: true, booth });
};

export const reserveBooth = async (req, res) => {
  const booth = await Booth.findById(req.params.id);
  if (!booth) return res.status(404).json({ success: false, message: "Booth not found." });
  if (booth.status !== "available") return res.status(409).json({ success: false, message: "Booth is not available." });
  booth.status = "reserved";
  booth.exhibitor = req.user._id;
  await booth.save();
  res.json({ success: true, booth });
};

export const deleteBooth=async(req,res,next)=>{try{const booth=await Booth.findById(req.params.id);if(!booth)return res.status(404).json({success:false,message:"Booth not found."});if(req.user.role!=="admin"){const expo=await Expo.findOne({_id:booth.expo,createdBy:req.user._id});if(!expo)return res.status(403).json({success:false,message:"Access denied."});}await booth.deleteOne();res.json({success:true})}catch(e){next(e)}};

// Axis-aligned rectangle overlap test for validating a saved floor plan.
const rectsOverlap = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

// PUT /api/booths/expo/:expoId/layout  { layout:[{id,x,y,width,height,rotation}], board?:{width,height} }
export const saveLayout = async (req, res, next) => {
  try {
    const { expoId } = req.params;
    const expo = await Expo.findOne(req.user.role === "admin" ? { _id: expoId } : { _id: expoId, createdBy: req.user._id });
    if (!expo) return res.status(404).json({ success: false, message: "Event not found or access denied." });

    const items = req.body?.layout;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "layout must be a non-empty array." });
    }
    const board = req.body?.board || null;

    const booths = await Booth.find({ expo: expoId });
    const byId = new Map(booths.map((b) => [String(b._id), b]));
    const updates = [];
    const errors = [];

    for (const raw of items) {
      const booth = byId.get(String(raw.id || raw._id));
      if (!booth) {
        errors.push(`Unknown booth ${raw.id || raw._id}.`);
        continue;
      }
      const x = Number(raw.x);
      const y = Number(raw.y);
      const width = raw.width !== undefined ? Number(raw.width) : booth.width;
      const height = raw.height !== undefined ? Number(raw.height) : booth.height;
      const rotation = raw.rotation !== undefined ? Number(raw.rotation) : booth.rotation;

      if (![x, y, width, height, rotation].every(Number.isFinite)) {
        errors.push(`Booth ${booth.boothNumber}: coordinates and dimensions must be numbers.`);
        continue;
      }
      if (width < 0.5 || width > 60 || height < 0.5 || height > 60) {
        errors.push(`Booth ${booth.boothNumber}: size must be between 0.5 and 60.`);
        continue;
      }
      if (x < 0 || y < 0) {
        errors.push(`Booth ${booth.boothNumber}: coordinates cannot be negative.`);
        continue;
      }
      if (board && (x + width > Number(board.width) || y + height > Number(board.height))) {
        errors.push(`Booth ${booth.boothNumber}: placement is outside the venue boundary.`);
        continue;
      }
      updates.push({ booth, x, y, width, height, rotation });
    }

    if (errors.length) return res.status(422).json({ success: false, message: "Layout validation failed.", errors });

    const overlaps = [];
    for (let i = 0; i < updates.length; i += 1) {
      for (let j = i + 1; j < updates.length; j += 1) {
        if (rectsOverlap(updates[i], updates[j])) overlaps.push(`${updates[i].booth.boothNumber} overlaps ${updates[j].booth.boothNumber}`);
      }
    }
    if (overlaps.length) return res.status(409).json({ success: false, message: "Booth placements overlap.", conflicts: overlaps });

    await Promise.all(
      updates.map((u) => {
        u.booth.x = u.x;
        u.booth.y = u.y;
        u.booth.width = u.width;
        u.booth.height = u.height;
        u.booth.rotation = u.rotation;
        return u.booth.save();
      })
    );

    await recordActivity({
      actor: req.user._id,
      actorName: req.user.name,
      action: "updated",
      entityType: "BoothLayout",
      entityId: expoId,
      expo: expoId,
      summary: `Updated floor plan for ${updates.length} booth(s)`,
      meta: { count: updates.length },
    });

    const saved = await Booth.find({ expo: expoId }).populate("exhibitor", "name email company");
    res.json({ success: true, updated: updates.length, booths: saved });
  } catch (error) {
    next(error);
  }
};

// PUT /api/booths/:id/assign  { exhibitor?: id|null, status?: 'available'|'reserved'|'occupied' }
export const assign = async (req, res, next) => {
  try {
    const booth = await Booth.findById(req.params.id);
    if (!booth) return res.status(404).json({ success: false, message: "Booth not found." });
    if (req.user.role !== "admin") {
      const expo = await Expo.findOne({ _id: booth.expo, createdBy: req.user._id });
      if (!expo) return res.status(403).json({ success: false, message: "Access denied." });
    }

    const { exhibitor, status } = req.body || {};
    if (status !== undefined && !oneOf(status, ["available", "reserved", "occupied"])) {
      return res.status(400).json({ success: false, message: "Invalid booth status." });
    }

    let exhibitorUser = null;
    if (exhibitor) {
      exhibitorUser = await User.findById(exhibitor).select("_id name role");
      if (!exhibitorUser) return res.status(400).json({ success: false, message: "Exhibitor not found." });
    }

    if (exhibitorUser) {
      booth.exhibitor = exhibitorUser._id;
      booth.status = status || "reserved";
    } else if (exhibitor === null) {
      booth.exhibitor = null;
      if (status) booth.status = status;
      else booth.status = "available";
    } else if (status) {
      booth.status = status;
      if (status === "available") booth.exhibitor = null;
    }

    await booth.save();

    await recordActivity({
      actor: req.user._id,
      actorName: req.user.name,
      action: "assigned",
      entityType: "Booth",
      entityId: booth._id,
      expo: booth.expo,
      summary: `Booth ${booth.boothNumber} set to ${booth.status}${exhibitorUser ? ` for ${exhibitorUser.name}` : ""}`,
      meta: { status: booth.status, exhibitor: booth.exhibitor ? String(booth.exhibitor) : null },
    });

    if (exhibitorUser && String(exhibitorUser._id) !== String(req.user._id)) {
      await notifyUser(req.app.get("io"), {
        user: exhibitorUser._id,
        title: "Booth assigned",
        message: `Booth ${booth.boothNumber} has been assigned to you.`,
        type: "booth",
        data: { boothId: booth._id, expo: booth.expo },
        dedupeKey: `booth-assigned:${booth._id}:${exhibitorUser._id}`,
      });
    }

    res.json({ success: true, booth });
  } catch (error) {
    next(error);
  }
};
