import crypto from "crypto";
import mongoose from "mongoose";
import ContactMessage from "../models/ContactMessage.js";
import { asyncHandler, sanitizeText } from "../utils/validation.js";
import { sendEmail } from "../utils/mailer.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const SUBJECTS = ["General question", "Product support", "Organizer / partnership", "Report a problem"];

// Strip control characters, collapse runaway blank lines and clamp length so
// user input can never carry header-injection payloads into the mailer.
function cleanMessage(value) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim()
    .slice(0, 4000);
}

const hashIp = ip =>
  crypto.createHash("sha256").update(`${process.env.JWT_SECRET || "eventsphere"}|${ip || "unknown"}`).digest("hex");

/** Pure validator — exported for unit tests. */
export function validateContact(body = {}) {
  const errors = {};
  const name = sanitizeText(body.name, 120);
  const email = sanitizeText(body.email, 200).toLowerCase();
  const subject = SUBJECTS.includes(body.subject) ? body.subject : SUBJECTS[0];
  const message = cleanMessage(body.message);

  if (name.length < 2) errors.name = "Please provide your name.";
  if (!EMAIL_RE.test(email)) errors.email = "Please provide a valid email address.";
  if (message.length < 10) errors.message = "Please include a message of at least 10 characters.";
  return { valid: Object.keys(errors).length === 0, errors, value: { name, email, subject, message } };
}

// POST /api/contact — public. Honeypot + rate limit (route-level) + validation.
export const submitContact = asyncHandler(async (req, res) => {
  // Honeypot: the hidden "website" field is never filled by a real user.
  // Answer with the normal success shape so bots learn nothing.
  if (sanitizeText(req.body?.website, 500)) {
    return res.json({ success: true, message: "Thanks — your message has been received." });
  }

  const { valid, errors, value } = validateContact(req.body || {});
  if (!valid) return res.status(400).json({ success: false, message: "Please fix the highlighted fields.", errors });

  // Duplicate suppression: the same email+message inside 10 minutes counts as
  // a double-click, not two tickets. Answer with the same success shape.
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
  const recentDuplicate = await ContactMessage.exists({
    email: value.email,
    message: value.message,
    createdAt: { $gte: tenMinAgo },
  });
  if (recentDuplicate) {
    return res.json({ success: true, message: "Thanks — your message has been received." });
  }

  const contact = await ContactMessage.create({
    ...value,
    ipHash: hashIp(req.ip),
    userAgent: sanitizeText(req.get("user-agent"), 300),
  });

  // Optional outbound notification. Failure here does NOT fail the request:
  // the message is already safely stored and shown as handled in the admin list.
  if (process.env.CONTACT_INBOX) {
    sendEmail({
      to: process.env.CONTACT_INBOX,
      subject: `[EventSphere contact] ${value.subject}`,
      html: `<p><b>${value.name}</b> &lt;${value.email}&gt; wrote:</p><p>${value.message.replace(/\n/g, "<br/>")}</p>`,
    }).catch(() => {});
  }

  res.status(201).json({
    success: true,
    message: "Thanks — your message has been received. We reply by email, usually within one business day.",
    id: contact._id,
  });
});

// GET /api/contact — admin inbox listing.
export const listContacts = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
  const filter = req.query.handled === "true" ? { handled: true } : req.query.handled === "false" ? { handled: false } : {};
  const [items, total] = await Promise.all([
    ContactMessage.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    ContactMessage.countDocuments(filter),
  ]);
  res.json({ success: true, items, total, page, pages: Math.ceil(total / limit) });
});

// PUT /api/contact/:id/handled — admin toggle.
export const markContactHandled = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ success: false, message: "Invalid message id." });
  }
  const item = await ContactMessage.findByIdAndUpdate(
    req.params.id,
    { handled: req.body?.handled !== false },
    { new: true }
  );
  if (!item) return res.status(404).json({ success: false, message: "Message not found." });
  res.json({ success: true, item });
});
