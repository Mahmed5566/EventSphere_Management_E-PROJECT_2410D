import mongoose from "mongoose";

// Small, dependency-free request validation helpers.
// Kept intentionally simple: the project has no validation library and we
// do not want to introduce a heavy dependency just for guards.

export const isObjectId = (value) =>
  typeof value === "string" && mongoose.Types.ObjectId.isValid(value);

export function requireObjectId(value) {
  return isObjectId(value) ? String(value) : null;
}

// Wrap an async route handler so rejected promises reach the error middleware
// instead of becoming unhandled rejections.
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function parsePagination(query = {}, { defaultLimit = 20, maxLimit = 100 } = {}) {
  const rawPage = parseInt(query.page, 10);
  const rawLimit = parseInt(query.limit, 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit = Math.min(maxLimit, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

// Parse an ISO date or date-only string. Date-only "to" values are pushed to
// the end of that UTC day so date-range filters are inclusive.
export function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parseDateRange(query = {}, { fromKey = "from", toKey = "to" } = {}) {
  const from = parseDate(query[fromKey]);
  let to = parseDate(query[toKey]);
  const rawTo = query[toKey];
  if (to && typeof rawTo === "string" && /^\d{4}-\d{2}-\d{2}$/.test(rawTo.trim())) {
    to = new Date(to.getTime() + 24 * 60 * 60 * 1000 - 1);
  }
  return { from, to, valid: !from || !to || from <= to };
}

export function oneOf(value, allowed) {
  return allowed.includes(value);
}

export function toFiniteNumber(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function clampInt(value, min, max, fallback) {
  const n = parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function trimString(value, max = 2000) {
  return String(value ?? "").trim().slice(0, max);
}

// Escape a user string so it is safe to embed in a regex (search endpoints).
export function escapeRegex(value) {
  return String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Strip control characters and clamp length of free-text fields.
export function sanitizeText(value, max = 2000) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim()
    .slice(0, max);
}
