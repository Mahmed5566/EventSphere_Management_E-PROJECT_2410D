import Activity from "../models/Activity.js";
import Notification from "../models/Notification.js";

// Append an activity-feed entry. Never throws to the caller: a logging
// failure must not roll back the user-facing operation. Returns the doc or null.
export async function recordActivity({
  actor = null,
  actorName = "",
  action,
  entityType,
  entityId = "",
  expo = null,
  summary = "",
  meta = {},
} = {}) {
  try {
    return await Activity.create({
      actor: actor || null,
      actorName,
      action,
      entityType,
      entityId: entityId ? String(entityId) : "",
      expo: expo || null,
      summary,
      meta,
    });
  } catch (error) {
    console.error("activity:", error.message);
    return null;
  }
}

// Create + persist a notification for a specific user and push it over
// Socket.IO to that user's private room only. `dedupeKey` makes repeated
// emissions of the same logical event idempotent.
export async function notifyUser(io, { user, title, message, type = "system", data = {}, dedupeKey = undefined } = {}) {
  if (!user) return null;
  try {
    if (dedupeKey) {
      const existing = await Notification.findOne({ user, dedupeKey });
      if (existing) return existing;
    }
    const notification = await Notification.create({ user, title, message, type, data, dedupeKey });
    io?.to(`user:${user}`).emit("notification:new", notification);
    return notification;
  } catch (error) {
    // Unique index race: another request created the same deduped notification.
    if (error?.code === 11000 && dedupeKey) {
      return Notification.findOne({ user, dedupeKey });
    }
    console.error("notify:", error.message);
    return null;
  }
}

// Convenience: record an activity entry and push it to the event room so live
// dashboards update. Rooms are only joined by clients that explicitly asked
// for that expo, so no cross-user leakage occurs.
export async function recordAndBroadcast(io, payload, room) {
  const doc = await recordActivity(payload);
  if (doc && room) io?.to(room).emit("activity:new", doc);
  return doc;
}
