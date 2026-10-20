import { test, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { validateContact } from "../controllers/contactController.js";
import { securityHeaders } from "../middleware/security.js";
import seoRoutes from "../routes/seoRoutes.js";

// ---- validateContact (pure validator used by POST /api/contact) ----

test("validateContact accepts a complete, well-formed message", () => {
  const r = validateContact({
    name: "  Ayesha Khan ",
    email: "AYESHA@Example.COM",
    subject: "Product support",
    message: "Our QR scanner stopped recognising passes after the last event.",
  });
  assert.equal(r.valid, true);
  assert.deepEqual(r.errors, {});
  assert.equal(r.value.name, "Ayesha Khan");
  assert.equal(r.value.email, "ayesha@example.com"); // trimmed + lowercased
  assert.equal(r.value.subject, "Product support");
});

test("validateContact rejects missing or malformed fields", () => {
  const r = validateContact({ name: "A", email: "not-an-email", message: "short" });
  assert.equal(r.valid, false);
  assert.ok(r.errors.name, "flags a too-short name");
  assert.ok(r.errors.email, "flags an invalid email");
  assert.ok(r.errors.message, "flags a too-short message");
});

test("validateContact falls back to the first subject for unknown subjects", () => {
  const r = validateContact({
    name: "Bilal Ahmed",
    email: "b@example.com",
    subject: "<Injected: Bcc: evil@example.com>",
    message: "A perfectly normal ten+ character message.",
  });
  assert.equal(r.valid, true);
  assert.equal(r.value.subject, "General question"); // whitelist, never user input
});

test("validateContact strips control characters used for header injection", () => {
  const r = validateContact({
    name: "Hina Raza",
    email: "h@example.com",
    subject: "Report a problem",
    message: "Line one\r\nBcc: victim@example.com\u0000\u0007\nLine two continues.",
  });
  assert.equal(r.valid, true);
  assert.ok(!/[\r\u0000\u0007]/.test(r.value.message), "control characters are removed");
  assert.ok(!r.value.message.includes("\r"), "CRLF is normalised to LF");
});

test("validateContact clamps runaway input instead of storing it whole", () => {
  const longButValidEmail = `${"y".repeat(185)}@example.com`; // 197 chars, still valid
  const r = validateContact({
    name: "x".repeat(500),
    email: longButValidEmail,
    subject: "General question",
    message: "z".repeat(9000),
  });
  assert.equal(r.valid, true);
  assert.equal(r.value.name.length, 120);
  assert.equal(r.value.email.length, longButValidEmail.length);
  assert.equal(r.value.message.length, 4000);

  // An absurd email is truncated to the cap; past the "@" it stops looking
  // like an address and is rejected rather than passed through unbounded.
  const oversized = validateContact({
    name: "Ok Name",
    email: `${"y".repeat(500)}@example.com`,
    subject: "General question",
    message: "A perfectly normal ten+ character message.",
  });
  assert.equal(oversized.value.email.length, 200);
  assert.equal(oversized.valid, false);
  assert.ok(oversized.errors.email);
});

// ---- securityHeaders middleware ----

function mockRes() {
  return {
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
  };
}

test("securityHeaders always sets the baseline hardening headers", () => {
  const res = mockRes();
  securityHeaders({}, res, () => {});
  assert.equal(res.headers["X-Content-Type-Options"], "nosniff");
  assert.equal(res.headers["X-Frame-Options"], "DENY");
  assert.equal(res.headers["Referrer-Policy"], "strict-origin-when-cross-origin");
  assert.equal(res.headers["Cross-Origin-Opener-Policy"], "same-origin");
  assert.ok(String(res.headers["Permissions-Policy"]).includes("camera=(self)"));
  assert.equal(res.headers["Content-Security-Policy"], undefined, "CSP is opt-in");
});

test("securityHeaders adds CSP only when ENABLE_CSP=true", () => {
  const prev = process.env.ENABLE_CSP;
  process.env.ENABLE_CSP = "true";
  const res = mockRes();
  securityHeaders({}, res, () => {});
  assert.ok(String(res.headers["Content-Security-Policy"]).includes("default-src 'self'"));
  assert.ok(String(res.headers["Content-Security-Policy"]).includes("frame-ancestors 'none'"));
  if (prev === undefined) delete process.env.ENABLE_CSP;
  else process.env.ENABLE_CSP = prev;
});

// ---- /sitemap.xml and /robots.txt served by the real router ----

const server = express()
  .use(securityHeaders)
  .use(seoRoutes)
  .listen(0);
if (!server.address?.()) {
  await new Promise(resolve => server.once("listening", resolve));
}
after(() => server.close());
const origin = () => `http://127.0.0.1:${server.address().port}`;

test("robots.txt allows crawling, disallows the API, and advertises the sitemap", async () => {
  const res = await fetch(`${origin()}/robots.txt`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /text\/plain/);
  const body = await res.text();
  assert.match(body, /User-agent: \*/);
  assert.match(body, /Disallow: \/api\//);
  assert.match(body, /Disallow: \/thank-you/);
  assert.match(body, new RegExp(`Sitemap: ${origin().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/sitemap\\.xml`));
  assert.equal(res.headers.get("x-content-type-options"), "nosniff", "headers applied before routes");
});

test("sitemap.xml lists only public routes with valid XML", async () => {
  const res = await fetch(`${origin()}/sitemap.xml`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /application\/xml/);
  const body = await res.text();
  assert.ok(body.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  assert.ok(body.includes("</urlset>"));
  const locs = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  assert.ok(locs.length >= 15, "every public route is listed");
  assert.ok(locs.every(l => l.startsWith(origin())), "base URL comes from SITE_URL or the request host");
  assert.ok(locs.includes(`${origin()}/`));
  assert.ok(locs.includes(`${origin()}/designs/bento-grid`));
  assert.ok(!locs.some(l => l.includes("/api/")), "API routes never appear");
  assert.ok(!locs.some(l => l.includes("/thank-you")), "utility pages stay out of the sitemap");
});
