import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isObjectId,
  parsePagination,
  parseDateRange,
  oneOf,
  escapeRegex,
  sanitizeText,
  toFiniteNumber,
  clampInt,
} from "../utils/validation.js";

test("isObjectId accepts valid ids and rejects junk", () => {
  assert.equal(isObjectId("507f1f77bcf86cd799439011"), true);
  assert.equal(isObjectId("not-an-id"), false);
  assert.equal(isObjectId(""), false);
  assert.equal(isObjectId(123), false);
});

test("parsePagination clamps limit and computes skip", () => {
  assert.deepEqual(parsePagination({ page: "3", limit: "10" }), { page: 3, limit: 10, skip: 20 });
  assert.deepEqual(parsePagination({ page: "-1", limit: "9999" }, { maxLimit: 100 }), { page: 1, limit: 100, skip: 0 });
  assert.deepEqual(parsePagination({}), { page: 1, limit: 20, skip: 0 });
});

test("parseDateRange treats date-only 'to' as inclusive end-of-day", () => {
  const { from, to, valid } = parseDateRange({ from: "2026-05-01", to: "2026-05-02" });
  assert.equal(valid, true);
  assert.equal(from.toISOString(), "2026-05-01T00:00:00.000Z");
  assert.equal(to.toISOString(), "2026-05-02T23:59:59.999Z");
});

test("parseDateRange flags an inverted range as invalid", () => {
  const range = parseDateRange({ from: "2026-06-01", to: "2026-05-01" });
  assert.equal(range.valid, false);
});

test("oneOf / escapeRegex / sanitizeText / numbers behave", () => {
  assert.equal(oneOf("a", ["a", "b"]), true);
  assert.equal(oneOf("c", ["a", "b"]), false);
  assert.equal(escapeRegex("a.b*c"), "a\\.b\\*c");
  assert.equal(sanitizeText("  hi\u0000there  "), "hithere");
  assert.equal(toFiniteNumber("3.5"), 3.5);
  assert.equal(toFiniteNumber("x", 7), 7);
  assert.equal(clampInt("50", 1, 10, 5), 10);
});
