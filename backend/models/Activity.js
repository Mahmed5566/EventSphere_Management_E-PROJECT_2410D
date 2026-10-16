import mongoose from "mongoose";

// Persistent activity feed. Every meaningful action appends an immutable row.
// Fields intentionally store a small, permission-safe summary rather than the
// full entity so the feed never becomes a leak of another user's private data.
const activitySchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    actorName: { type: String, default: "" },
    action: { type: String, required: true }, // created | updated | deleted | issued | checked-in | assigned | completed | ...
    entityType: { type: String, required: true }, // Event | Ticket | Booth | Session | Task | Budget | ...
    entityId: { type: String, default: "" },
    expo: { type: mongoose.Schema.Types.ObjectId, ref: "Expo", default: null, index: true },
    summary: { type: String, default: "" },
    meta: { type: Object, default: {} },
  },
  { timestamps: true }
);

activitySchema.index({ createdAt: -1 });
activitySchema.index({ expo: 1, createdAt: -1 });
activitySchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

export default mongoose.model("Activity", activitySchema);
