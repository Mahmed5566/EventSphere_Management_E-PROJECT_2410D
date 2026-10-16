// In-memory fixed-window rate limiter (no external dependency).
// Suitable for a single Node process. For multi-instance deployments this
// should be backed by Redis, which is documented in the delivery report.

const buckets = new Map();

// Periodically drop expired buckets so the map cannot grow without bound.
const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now > bucket.reset) buckets.delete(key);
  }
}, 5 * 60 * 1000);
if (typeof cleanup.unref === "function") cleanup.unref();

export function rateLimit({ windowMs = 60_000, max = 30, keyFn, message = "Too many requests. Please slow down." } = {}) {
  return (req, res, next) => {
    const identity = keyFn ? keyFn(req) : req.user?._id || req.user?.id || req.ip;
    const key = `${req.method}:${req.baseUrl}${req.path}:${identity}`;
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || now > bucket.reset) {
      buckets.set(key, { count: 1, reset: now + windowMs });
      return next();
    }

    bucket.count += 1;
    if (bucket.count > max) {
      const retryAfter = Math.ceil((bucket.reset - now) / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({ success: false, message });
    }
    return next();
  };
}

// Exposed for unit testing.
export function _resetRateLimitBuckets() {
  buckets.clear();
}
