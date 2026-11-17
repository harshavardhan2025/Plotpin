/**
 * Location Geocoding & Reverse-Geocoding Controller
 * Caches Nominatim requests with TTL to comply with OpenStreetMap usage policy
 * and eliminate public client-side rate limits.
 */

const geocodeCache = new Map();
const reverseCache = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Cleanup stale cache periodically
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of geocodeCache.entries()) {
    if (now - v.timestamp > CACHE_TTL_MS) geocodeCache.delete(k);
  }
  for (const [k, v] of reverseCache.entries()) {
    if (now - v.timestamp > CACHE_TTL_MS) reverseCache.delete(k);
  }
}, 60 * 60 * 1000);

/**
 * GET /api/v1/location/search?q=...
 */
exports.search = async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) {
      return res.status(400).json({ success: false, message: 'Query parameter q is required' });
    }

    const cacheKey = q.toLowerCase();
    const cached = geocodeCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return res.json({ success: true, data: cached.data, cached: true });
    }

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&addressdetails=1`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'PlotPin-Worldwide/1.0 (support@plotpin.com)',
        'Accept-Language': 'en'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ success: false, message: 'Geocoding service unavailable' });
    }

    const data = await response.json();
    geocodeCache.set(cacheKey, { data, timestamp: Date.now() });

    return res.json({ success: true, data, cached: false });
  } catch (error) {
    console.error('Geocoding error:', error);
    return res.status(500).json({ success: false, message: 'Unable to perform geocoding search' });
  }
};

/**
 * GET /api/v1/location/reverse?lat=...&lng=...
 */
exports.reverse = async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng ?? req.query.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return res.status(400).json({ success: false, message: 'Invalid latitude or longitude coordinates' });
    }

    const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    const cached = reverseCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return res.json({ success: true, data: cached.data, cached: true });
    }

    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'PlotPin-Worldwide/1.0 (support@plotpin.com)',
        'Accept-Language': 'en'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ success: false, message: 'Reverse geocoding service unavailable' });
    }

    const data = await response.json();
    reverseCache.set(cacheKey, { data, timestamp: Date.now() });

    return res.json({ success: true, data, cached: false });
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return res.status(500).json({ success: false, message: 'Unable to perform reverse geocoding' });
  }
};

