import mongoose from "mongoose";

// Messages sent through the public contact form. Stored server-side so a
// failed outbound email never loses a real submission; the optional SMTP
// notification is a second step, not the source of truth.
const contactMessageSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, trim: true, maxlength: 200 },
  subject: { type: String, default: "General question", trim: true, maxlength: 120 },
  message: { type: String, required: true, maxlength: 4000 },
  // Rough client fingerprint for duplicate/rate analysis. Hashed, never a
  // full user profile; the contact form itself is anonymous.
  ipHash: { type: String, select: false },
  userAgent: { type: String, maxlength: 300 },
  handled: { type: Boolean, default: false },
}, { timestamps: true });

contactMessageSchema.index({ createdAt: -1 });

export default mongoose.model("ContactMessage", contactMessageSchema);
