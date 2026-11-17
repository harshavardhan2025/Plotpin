/**
 * Native Zero-Dependency HTTP Compression Middleware
 * Leverages Node.js core 'zlib' to automatically GZIP compress JSON and Text responses.
 * Reduces payload size by up to 80-90% for lightning-fast database transfers.
 */
const zlib = require('zlib');

function compressionMiddleware(req, res, next) {
  const acceptEncoding = req.headers['accept-encoding'] || '';
  if (!acceptEncoding.includes('gzip')) {
    return next();
  }

  const originalSend = res.send;

  res.send = function (body) {
    if (!body) {
      return originalSend.call(this, body);
    }

    // Only compress responses that are sufficiently large (> 512 bytes)
    let buffer;
    if (typeof body === 'string') {
      buffer = Buffer.from(body);
    } else if (Buffer.isBuffer(body)) {
      buffer = body;
    } else if (typeof body === 'object') {
      try {
        const jsonStr = JSON.stringify(body);
        buffer = Buffer.from(jsonStr);
        if (!res.getHeader('Content-Type')) {
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
        }
      } catch (err) {
        return originalSend.call(this, body);
      }
    }

    if (!buffer || buffer.length < 512) {
      return originalSend.call(this, body);
    }

    // Do not re-compress if already compressed
    if (res.getHeader('Content-Encoding')) {
      return originalSend.call(this, body);
    }

    try {
      const compressed = zlib.gzipSync(buffer, { level: 6 });
      res.setHeader('Content-Encoding', 'gzip');
      res.removeHeader('Content-Length');
      res.setHeader('Vary', 'Accept-Encoding');
      return originalSend.call(this, compressed);
    } catch (err) {
      return originalSend.call(this, body);
    }
  };

  next();
}

module.exports = { compressionMiddleware };

