/**
 * Lightweight Sliding-Window In-Memory Rate Limiter
 * Protects login, OTP, and sensitive endpoints against brute-force attacks.
 */
function createRateLimiter(options = {}) {
  const windowMs = options.windowMs || 60 * 1000; // 1 minute window
  const maxRequests = options.max || 20; // 20 requests per minute
  const message = options.message || "Too many requests. Please try again later.";
  const hits = new Map();

  // Periodic cleanup
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of hits.entries()) {
      const active = timestamps.filter(t => now - t < windowMs);
      if (active.length === 0) {
        hits.delete(key);
      } else {
        hits.set(key, active);
      }
    }
  }, windowMs);
  if (typeof cleanupTimer.unref === 'function') {
    cleanupTimer.unref();
  }

  return (req, res, next) => {
    const ip = req.ip || req.connection?.remoteAddress || '127.0.0.1';
    const now = Date.now();
    const timestamps = hits.get(ip) || [];
    const active = timestamps.filter(t => now - t < windowMs);

    if (active.length >= maxRequests) {
      return res.status(429).json({
        error: message,
        code: "RATE_LIMIT_EXCEEDED",
        retryAfterSeconds: Math.ceil((active[0] + windowMs - now) / 1000)
      });
    }

    active.push(now);
    hits.set(ip, active);
    next();
  };
}

module.exports = { createRateLimiter };
