import QRCode from "qrcode";
import TicketOrder from "../models/TicketOrder.js";
import Expo from "../models/Expo.js";
import CheckIn from "../models/CheckIn.js";
import EventEngagement from "../models/EventEngagement.js";
import { asyncHandler, trimString } from "../utils/validation.js";
import { recordActivity, notifyUser } from "../utils/activity.js";

const STAFF_ROLES = ["admin", "organizer", "staff"];

// Confirm the caller may scan for a given event.
async function canScan(req, expoId) {
  if (!STAFF_ROLES.includes(req.user.role)) return false;
  if (req.user.role === "organizer") {
    const expo = await Expo.findOne({ _id: expoId, createdBy: req.user._id }).select("_id");
    return Boolean(expo);
  }
  return true;
}

// GET /api/checkin/tickets/:id/qr  -> QR image for a ticket token (never the token in a URL)
export const ticketQr = asyncHandler(async (req, res) => {
  const ticket = await TicketOrder.findById(req.params.id).select("expo qrToken status passType invoiceNo attendee");
  if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found." });
  if (!(await canScan(req, ticket.expo))) return res.status(403).json({ success: false, message: "Check-in access denied." });
  if (!ticket.qrToken) return res.status(400).json({ success: false, message: "This ticket has no QR token." });

  // The QR payload is an opaque server-generated token only.
  const dataUrl = await QRCode.toDataURL(`ES-TICKET:${ticket.qrToken}`, { margin: 1, width: 320, errorCorrectionLevel: "M" });
  res.json({ success: true, qr: dataUrl, ticket: { id: ticket._id, invoiceNo: ticket.invoiceNo, passType: ticket.passType, status: ticket.status } });
});

// GET /api/checkin/verify/:token  -> validate without checking in
export const verify = asyncHandler(async (req, res) => {
  const token = trimString(req.params.token, 200);
  const ticket = await TicketOrder.findOne({ qrToken: token })
    .populate("expo", "title createdBy date location processingReady")
    .populate("attendee", "name email");
  if (!ticket) return res.status(404).json({ success: false, valid: false, message: "Ticket not found.", reason: "not_found" });
  if (!(await canScan(req, ticket.expo?._id))) return res.status(403).json({ success: false, valid: false, message: "Check-in access denied.", reason: "forbidden" });

  if (ticket.status !== "paid") {
    return res.json({ success: true, valid: false, reason: "not_paid", message: `Ticket status is "${ticket.status}". Only paid tickets are valid.`, ticket });
  }
  if (ticket.checkedInAt) {
    return res.json({ success: true, valid: false, reason: "already_checked_in", message: "Ticket has already been checked in.", ticket });
  }
  res.json({ success: true, valid: true, reason: "ok", message: "Ticket is valid and ready to check in.", ticket });
});

async function performCheckin(req, ticket) {
  const now = new Date();
  // Atomic guard: only the first concurrent request can flip checkedInAt from
  // null, so duplicate scans can never both succeed.
  const updated = await TicketOrder.findOneAndUpdate(
    { _id: ticket._id, status: "paid", checkedInAt: null },
    { $set: { checkedInAt: now } },
    { new: true }
  );
  if (!updated) {
    const current = await TicketOrder.findById(ticket._id);
    if (!current) return { ok: false, status: 404, message: "Ticket not found.", reason: "not_found" };
    if (current.status !== "paid") return { ok: false, status: 400, message: `Ticket status is "${current.status}".`, reason: "not_paid" };
    return { ok: false, status: 409, message: "Ticket has already been checked in.", reason: "already_checked_in" };
  }

  let checkin;
  try {
    checkin = await CheckIn.create({
      ticket: updated._id,
      expo: updated.expo,
      attendee: updated.attendee,
      checkedInBy: req.user._id,
      checkedInAt: now,
      method: req.body?.method === "manual" ? "manual" : "QR",
    });
  } catch (error) {
    // Unique index on CheckIn.ticket — another concurrent request won the race.
    if (error?.code === 11000) {
      const existing = await CheckIn.findOne({ ticket: updated._id });
      return { ok: false, status: 409, message: "Ticket has already been checked in.", reason: "already_checked_in", checkin: existing };
    }
    throw error;
  }

  try {
    await EventEngagement.create({ expo: updated.expo, user: updated.attendee, type: "checkin", targetId: updated._id });
  } catch {
    /* engagement is best-effort */
  }

  const io = req.app.get("io");
  io?.to(`expo:${updated.expo}`).emit("attendance:checkin", { ticket: updated._id, user: updated.attendee, checkin });

  await recordActivity({
    actor: req.user._id,
    actorName: req.user.name,
    action: "checked-in",
    entityType: "Ticket",
    entityId: updated._id,
    expo: updated.expo,
    summary: `Checked in ticket ${updated.invoiceNo || updated._id}`,
    meta: { method: req.body?.method || "qr" },
  });

  return { ok: true, checkin, ticket: updated };
}

// POST /api/checkin  { token? | ticketId? | invoiceNo?, method? }
export const checkin = asyncHandler(async (req, res) => {
  const token = trimString(req.body.token || req.body.qrToken, 200);
  const ticketId = trimString(req.body.ticketId, 60);
  const invoiceNo = trimString(req.body.invoiceNo, 80);
  if (!token && !ticketId && !invoiceNo) {
    return res.status(400).json({ success: false, message: "Provide a QR token, ticket id or invoice number." });
  }

  const query = token
    ? { qrToken: token }
    : ticketId
      ? { _id: ticketId }
      : { invoiceNo };
  const ticket = await TicketOrder.findOne(query).populate("expo", "title createdBy").populate("attendee", "name email");
  if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found.", reason: "not_found" });
  if (!(await canScan(req, ticket.expo?._id))) return res.status(403).json({ success: false, message: "Check-in access denied.", reason: "forbidden" });

  const result = await performCheckin(req, ticket);
  if (!result.ok) {
    return res.status(result.status).json({ success: false, message: result.message, reason: result.reason, checkin: result.checkin });
  }

  await notifyUser(req.app.get("io"), {
    user: ticket.attendee?._id,
    title: "Checked in",
    message: `You are checked in for ${ticket.expo?.title || "the event"}.`,
    type: "checkin",
    data: { ticketId: ticket._id, expo: ticket.expo?._id },
    dedupeKey: `checkin:${ticket._id}`,
  });

  res.status(201).json({
    success: true,
    message: "Attendee checked in successfully.",
    checkin: result.checkin,
    attendee: ticket.attendee,
    event: ticket.expo,
  });
});

// GET /api/checkin/stats?expo=
export const stats = asyncHandler(async (req, res) => {
  if (!STAFF_ROLES.includes(req.user.role)) return res.status(403).json({ success: false, message: "Access denied." });
  const filters = [];
  if (req.query.expo) filters.push({ expo: req.query.expo });
  else if (req.user.role === "organizer") {
    const expos = await Expo.find({ createdBy: req.user._id }).select("_id");
    filters.push({ expo: { $in: expos.map((e) => e._id) } });
  }
  const scope = filters.length ? filters[0] : {};

  const [checkins, paidOrders] = await Promise.all([
    CheckIn.countDocuments(scope),
    TicketOrder.countDocuments({ status: "paid", ...(scope.expo ? { expo: scope.expo } : {}) }),
  ]);
  res.json({ success: true, stats: { checkins, paidOrders, pending: Math.max(0, paidOrders - checkins) } });
});
