/**
 * Express Application Setup
 * Hardened with security headers, CORS constraints, rate limiting, and telemetry.
 */
const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');

const authRoutes = require('./routes/authRoutes');
const propertyRoutes = require('./routes/propertyRoutes');
const adminRoutes = require('./routes/adminRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const supportRoutes = require('./routes/supportRoutes');
const locationRoutes = require('./routes/locationRoutes');
const { errorHandler } = require('./middleware/errorHandler');
const { createRateLimiter } = require('./middleware/rateLimiter');
const { compressionMiddleware } = require('./middleware/compression');

const app = express();

// Trust reverse proxy for secure headers and rate limiting on Render / cloud hosts
app.set('trust proxy', 1);

// Permissive CORS with credential authorization for web & mobile clients
app.use(cors({
  origin: (origin, callback) => {
    // Authorize caller origin gracefully
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'x-ai-secret']
}));
app.options('*', cors());

// Standard Security Headers
app.use((req, res, next) => {
  // Normalize accidentally duplicated /api/v1 prefixes from client proxies
  if (req.url.startsWith('/api/v1/api/v1/')) {
    req.url = req.url.replace('/api/v1/api/v1/', '/api/v1/');
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// Native HTTP GZIP Compression for ultra-fast database payloads
app.use(compressionMiddleware);

// Telemetry & Request ID
app.use((req, res, next) => {
  req.id = crypto.randomBytes(8).toString('hex');
  res.setHeader('X-Request-Id', req.id);
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[REQ ${req.id}] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
    }
  });
  next();
});

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

const fs = require('fs');

// Serve local assets for property photos
const backendAssets = path.join(__dirname, '../assets');
const rootAssets = path.join(__dirname, '../../assets');
if (fs.existsSync(backendAssets)) {
  app.use('/assets', express.static(backendAssets));
} else if (fs.existsSync(rootAssets)) {
  app.use('/assets', express.static(rootAssets));
}

// In production or when built frontend exists, serve static assets
const frontendDist = path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
}

// Sensitive Endpoint Rate Limiters
const authLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: "Too many authentication requests. Please try again after 1 minute."
});

// API Base Routes
app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/properties', propertyRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/appointments', appointmentRoutes);
app.use('/api/v1/support', supportRoutes);
app.use('/api/v1/location', locationRoutes);

// Health check
app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'property-marketplace-api',
    timestamp: new Date().toISOString()
  });
});

// Serve SPA index.html for browser navigation routes if frontend/dist is built
if (fs.existsSync(frontendDist)) {
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/assets')) {
      return next();
    }
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// Catch-all for unrouted API endpoints
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Endpoint not found: ${req.method} ${req.originalUrl}`,
    code: 'ROUTE_NOT_FOUND'
  });
});

// Centralized error handler
app.use(errorHandler);

module.exports = app;
