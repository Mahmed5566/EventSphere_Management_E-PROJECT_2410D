// Calendar / scheduling conflict detection.
// All pure functions so they can be unit tested without a database.

export function toDate(value) {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// A range is only valid when both bounds parse and end is strictly after start.
export function validateTimeRange(start, end) {
  const s = toDate(start);
  const e = toDate(end);
  if (!s || !e) return { valid: false, reason: "invalid_date", message: "Start and end must be valid dates." };
  if (e <= s) return { valid: false, reason: "end_before_start", message: "End time must be after the start time." };
  return { valid: true, start: s, end: e };
}

// Half-open interval overlap [aStart, aEnd) ∩ [bStart, bEnd).
// Adjacent sessions (one ending exactly when the next begins) do NOT overlap.
export function overlaps(aStart, aEnd, bStart, bEnd) {
  return toDate(aStart) < toDate(bEnd) && toDate(bStart) < toDate(aEnd);
}

const norm = (v) => String(v ?? "").trim().toLowerCase();

// Detect conflicts for a candidate session against a list of existing sessions.
// candidate: { _id?, startTime, endTime, speaker?, location?, venue? }
// existing:  array of the same shape (different _id).
// Returns an array of { type, severity, message, session }.
export function detectSessionConflicts(candidate, existing = []) {
  const range = validateTimeRange(candidate.startTime, candidate.endTime);
  if (!range.valid) {
    return [{ type: "invalid_time", severity: "error", message: range.message, session: null }];
  }

  const conflicts = [];
  const candidateId = candidate._id ? String(candidate._id) : null;
  const candidateRoom = norm(candidate.location || candidate.venue);
  const candidateSpeaker = norm(candidate.speaker);

  for (const other of existing) {
    if (!other) continue;
    if (candidateId && other._id && String(other._id) === candidateId) continue;

    const otherRange = validateTimeRange(other.startTime, other.endTime);
    if (!otherRange.valid) continue;
    if (!overlaps(range.start, range.end, otherRange.start, otherRange.end)) continue;

    const otherRoom = norm(other.location || other.venue);
    const otherSpeaker = norm(other.speaker);
    const window = `${otherRange.start.toISOString()} – ${otherRange.end.toISOString()}`;

    if (candidateRoom && otherRoom && candidateRoom === otherRoom) {
      conflicts.push({
        type: "room_overlap",
        severity: "error",
        message: `Room "${other.location || other.venue}" is already booked for "${other.title || "another session"}" (${window}).`,
        session: other,
      });
    }
    if (candidateSpeaker && otherSpeaker && candidateSpeaker === otherSpeaker) {
      conflicts.push({
        type: "speaker_overlap",
        severity: "error",
        message: `Speaker "${other.speaker}" is already assigned to "${other.title || "another session"}" (${window}).`,
        session: other,
      });
    }
  }
  return conflicts;
}

// Detect whether an event window itself is invalid or overlaps another event
// that shares the same venue (location string).
export function detectEventVenueConflicts(candidate, existing = []) {
  const conflicts = [];
  const range = validateTimeRange(candidate.start, candidate.end);
  if (!range.valid) {
    return [{ type: "invalid_time", severity: "error", message: range.message, event: null }];
  }
  const candidateId = candidate._id ? String(candidate._id) : null;
  const loc = norm(candidate.location);

  for (const other of existing) {
    if (!other || !loc) continue;
    if (candidateId && other._id && String(other._id) === candidateId) continue;
    if (norm(other.location) !== loc) continue;
    const otherRange = validateTimeRange(other.start, other.end);
    if (!otherRange.valid) continue;
    if (overlaps(range.start, range.end, otherRange.start, otherRange.end)) {
      conflicts.push({
        type: "venue_overlap",
        severity: "error",
        message: `"${other.location}" is already used by "${other.title || "another event"}" during the selected dates.`,
        event: other,
      });
    }
  }
  return conflicts;
}
