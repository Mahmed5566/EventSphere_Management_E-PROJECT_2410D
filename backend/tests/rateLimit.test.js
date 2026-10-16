import { test } from "node:test";
import assert from "node:assert/strict";
import { rateLimit, _resetRateLimitBuckets } from "../utils/rateLimit.js";

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(c) {
      this.statusCode = c;
      return this;
    },
    json(o) {
      this.body = o;
      return this;
    },
  };
}

test("allows requests up to the limit, then returns 429 with Retry-After", () => {
  _resetRateLimitBuckets();
  const limiter = rateLimit({ windowMs: 60_000, max: 2 });
  const req = { method: "POST", baseUrl: "/api/copilot", path: "/ask", ip: "9.9.9.9", user: null };
  let nextCount = 0;
  const call = () => {
    const res = mockRes();
    limiter(req, res, () => { nextCount += 1; });
    return res;
  };
  call();
  call();
  const third = call();
  assert.equal(nextCount, 2);
  assert.equal(third.statusCode, 429);
  assert.equal(third.body.success, false);
  assert.ok(third.headers["Retry-After"]);
});

test("buckets are independent per user identity", () => {
  _resetRateLimitBuckets();
  const limiter = rateLimit({ windowMs: 60_000, max: 1 });
  const base = { method: "POST", baseUrl: "/api/copilot", path: "/ask", ip: "1.1.1.1" };
  const a = mockRes();
  limiter({ ...base, user: { _id: "user-a" } }, a, () => {});
  const b = mockRes();
  limiter({ ...base, user: { _id: "user-b" } }, b, () => {});
  assert.equal(a.statusCode, 200);
  assert.equal(b.statusCode, 200);
});
