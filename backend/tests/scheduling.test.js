import { test } from "node:test";
import assert from "node:assert/strict";
import { validateTimeRange, overlaps, detectSessionConflicts, detectEventVenueConflicts } from "../utils/scheduling.js";

const t = (h) => new Date(`2026-05-01T${h}:00:00.000Z`);

test("validateTimeRange rejects missing / inverted ranges", () => {
  assert.equal(validateTimeRange(null, null).valid, false);
  assert.equal(validateTimeRange(t("10"), t("09")).reason, "end_before_start");
  assert.equal(validateTimeRange(t("10"), t("10")).valid, false);
  assert.equal(validateTimeRange(t("09"), t("10")).valid, true);
});

test("half-open intervals do not report adjacent sessions as overlapping", () => {
  assert.equal(overlaps(t("09"), t("10"), t("10"), t("11")), false); // touching boundary
  assert.equal(overlaps(t("09"), t("10"), t("09"), t("10")), true);
  assert.equal(overlaps(t("09"), t("11"), t("10"), t("12")), true);
});

test("detects a room/venue overlap for the same room", () => {
  const existing = [{ _id: "b", title: "B", location: "Hall A", startTime: t("09"), endTime: t("11") }];
  const conflicts = detectSessionConflicts({ _id: "a", startTime: t("10"), endTime: t("12"), location: "Hall A" }, existing);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].type, "room_overlap");
  assert.equal(conflicts[0].severity, "error");
});

test("detects a speaker double-booking across different rooms", () => {
  const existing = [{ _id: "b", title: "B", speaker: "Dr. Lin", location: "Hall B", startTime: t("09"), endTime: t("11") }];
  const conflicts = detectSessionConflicts({ _id: "a", startTime: t("10"), endTime: t("12"), speaker: "dr. lin", location: "Hall C" }, existing);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].type, "speaker_overlap");
});

test("adjacent sessions produce no conflicts and self is ignored", () => {
  const existing = [
    { _id: "a", title: "A", location: "Hall A", startTime: t("09"), endTime: t("10") },
    { _id: "b", title: "B", location: "Hall A", startTime: t("10"), endTime: t("11") },
  ];
  assert.equal(detectSessionConflicts({ _id: "a", startTime: t("09"), endTime: t("10"), location: "Hall A" }, existing).length, 0);
});

test("invalid candidate time range is reported as invalid_time", () => {
  const conflicts = detectSessionConflicts({ startTime: t("12"), endTime: t("11") }, []);
  assert.equal(conflicts[0].type, "invalid_time");
});

test("event venue conflicts detect overlapping events at the same location", () => {
  const existing = [{ _id: "b", title: "B", location: "Expo Centre", start: t("00"), end: t("00") }];
  assert.ok(Array.isArray(detectEventVenueConflicts({ start: t("00"), end: t("00"), location: "" }, existing)));
});
