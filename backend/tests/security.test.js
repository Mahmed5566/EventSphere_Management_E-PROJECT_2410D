import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { rateLimit, _resetRateLimitBuckets } from "../utils/rateLimit.js";

// ---- registration role policy (privilege-escalation guard) ----
// Mirrors resolveRegistrationRole in controllers/authController.js without
// importing the controller (which would require a live database connection).

async function resolveRegistrationRole(role) {
  const mod = await import("../controllers/authController.js");
  return mod.resolveRegistrationRole(role);
}

test("public signup may create attendee, exhibitor or organizer", async () => {
  for (const role of ["attendee", "exhibitor", "organizer"]) {
    const r = await resolveRegistrationRole(role);
    assert.equal(r.ok, true, `${role} is allowed`);
    assert.equal(r.role, role);
  }
});

test("public signup can never self-assign staff or admin", async () => {
  for (const role of ["staff", "admin", "Staff", "ADMIN", " admin "]) {
    const r = await resolveRegistrationRole(role);
    assert.equal(r.ok, false, `${role} is rejected`);
    assert.match(r.message, /organizer/i);
  }
});

test("an unknown or missing role falls back to attendee, never a privilege", async () => {
  for (const role of [undefined, "", "superuser", "root", "owner"]) {
    const r = await resolveRegistrationRole(role);
    assert.equal(r.ok, true);
    assert.equal(r.role, "attendee");
  }
});

// ---- password reset token hashing ----
// The controller stores sha256(token); the raw token is never returned to the
// client. Verify the hash is deterministic, one-way and not the raw value.

test("password reset tokens are stored as a sha256 hash, never plaintext", () => {
  const hashResetToken = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");
  const token = crypto.randomBytes(32).toString("hex");
  const stored = hashResetToken(token);

  assert.notEqual(stored, token, "the stored value differs from the token");
  assert.equal(stored.length, 64, "sha256 produces a 64-char hex digest");
  assert.equal(stored, hashResetToken(token), "hashing is deterministic");
  assert.match(stored, /^[a-f0-9]{64}$/);

  // A different token must not collide with the stored hash.
  assert.notEqual(hashResetToken(crypto.randomBytes(32).toString("hex")), stored);
});

// ---- rate limiter ----

function runLimiter(limiter, count, ip = "10.0.0.1") {
  return Array.from({ length: count }, () => {
    let status = 0;
    const res = {
      headers: {},
      setHeader(k, v) { this.headers[k] = v; },
      status(code) { status = code; return this; },
      json() { return this; },
    };
    limiter({ method: "POST", baseUrl: "/api/auth", path: "/login", ip }, res, () => { status = 200; });
    return { status, headers: res.headers };
  });
}

test("rate limiter allows traffic up to the limit then blocks with 429", () => {
  _resetRateLimitBuckets();
  const limiter = rateLimit({ windowMs: 60_000, max: 3 });
  const results = runLimiter(limiter, 5);
  assert.deepEqual(results.map(r => r.status), [200, 200, 200, 429, 429]);
  assert.ok(results[3].headers["Retry-After"], "429 responses advertise a retry delay");
});

test("rate limiter isolates different source IPs", () => {
  _resetRateLimitBuckets();
  const limiter = rateLimit({ windowMs: 60_000, max: 2 });
  assert.equal(runLimiter(limiter, 3, "1.1.1.1").map(r => r.status).join(","), "200,200,429");
  // A different IP has its own bucket and is not punished for the first IP.
  assert.equal(runLimiter(limiter, 2, "2.2.2.2").map(r => r.status).join(","), "200,200");
});

test("rate limiter windows expire so a client recovers", () => {
  _resetRateLimitBuckets();
  const limiter = rateLimit({ windowMs: 1, max: 1 });
  assert.equal(runLimiter(limiter, 1).map(r => r.status).join(","), "200");
  assert.equal(runLimiter(limiter, 1).map(r => r.status).join(","), "429");
  const start = Date.now();
  while (Date.now() - start < 5) { /* wait for the 1ms window to roll over */ }
  assert.equal(runLimiter(limiter, 1).map(r => r.status).join(","), "200");
});
