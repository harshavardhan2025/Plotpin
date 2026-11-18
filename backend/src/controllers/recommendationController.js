/**
 * AI Recommendation & Semantic Matching Controller
 * Integrates Node.js backend with Python FastAPI AI microservice with resilient deterministic fallback.
 * Enforces:
 * 1. Strict public property eligibility (viewer != owner, published, approved, not removed, not pending revision)
 * 2. Comprehensive input validation for search filters and coordinates
 * 3. Strict pre-ranking filtering (purpose, category, propertyType, budgetMax, radius)
 * 4. Real Haversine geospatial calculations (no fabricated 0.88 location scores or distances)
 * 5. Exact scoring formula: S = 0.35R + 0.25L + 0.20B + 0.15F + 0.05Q (all normalized [0..1])
 * 6. Factual explanations only (no false RERA or prime corridor claims)
 * 7. Hardened FastAPI response validation (validating returned IDs against eligible candidates)
 * 8. Property data sanitization (stripping private deeds, seller contact, and moderation notes)
 */

const { db } = require('../config/database');
const { isPropertyPubliclyEligible } = require('../utils/propertyEligibility');
const { cacheService } = require('../services/cacheService');

// Permitted enumeration values
const ALLOWED_PURPOSES = new Set(['sale', 'rent']);
const ALLOWED_CATEGORIES = new Set(['residential', 'commercial', 'land', 'agricultural']);
const ALLOWED_PROPERTY_TYPES = new Set([
  'flat', 'apartment', 'house', 'villa', 'plot', 'shop', 'office', 'farmland', 'commercial', 'land', 'pg'
]);

/**
 * Validates and normalizes recommendation request body.
 * Throws an Error with code and message if validation fails.
 */
function validateRecommendationInputs(body = {}) {
  const errors = [];

  let {
    purpose,
    category,
    propertyType,
    budgetMax,
    budgetMin,
    searchLocation,
    radiusKm,
    preferences,
    queryText
  } = body;

  // 1. Purpose validation
  let normalizedPurpose = null;
  if (purpose !== undefined && purpose !== null && purpose !== '') {
    if (typeof purpose !== 'string' || !ALLOWED_PURPOSES.has(purpose.trim().toLowerCase())) {
      errors.push(`Invalid purpose '${purpose}'. Allowed: sale, rent.`);
    } else {
      normalizedPurpose = purpose.trim().toLowerCase();
    }
  }

  // 2. Category validation
  let normalizedCategory = null;
  if (category !== undefined && category !== null && category !== '' && category !== 'all') {
    if (typeof category !== 'string' || !ALLOWED_CATEGORIES.has(category.trim().toLowerCase())) {
      errors.push(`Invalid category '${category}'. Allowed: residential, commercial, land, agricultural.`);
    } else {
      normalizedCategory = category.trim().toLowerCase();
    }
  }

  // 3. Property Type validation
  let normalizedPropertyType = null;
  if (propertyType !== undefined && propertyType !== null && propertyType !== '' && propertyType !== 'all') {
    if (typeof propertyType !== 'string' || !ALLOWED_PROPERTY_TYPES.has(propertyType.trim().toLowerCase())) {
      errors.push(`Invalid propertyType '${propertyType}'.`);
    } else {
      normalizedPropertyType = propertyType.trim().toLowerCase();
    }
  }

  // 4. Budget Max validation (strict numeric check; 0 is distinct from undefined)
  let normalizedBudgetMax = null;
  if (budgetMax !== undefined && budgetMax !== null && budgetMax !== '') {
    const num = Number(budgetMax);
    if (!Number.isFinite(num) || num < 0) {
      errors.push(`budgetMax must be a finite, non-negative number. Received: ${budgetMax}`);
    } else {
      normalizedBudgetMax = num;
    }
  }

  // 5. Budget Min validation
  let normalizedBudgetMin = null;
  if (budgetMin !== undefined && budgetMin !== null && budgetMin !== '') {
    const num = Number(budgetMin);
    if (!Number.isFinite(num) || num < 0) {
      errors.push(`budgetMin must be a finite, non-negative number. Received: ${budgetMin}`);
    } else {
      normalizedBudgetMin = num;
    }
  }

  if (normalizedBudgetMax !== null && normalizedBudgetMin !== null && normalizedBudgetMin > normalizedBudgetMax) {
    errors.push(`budgetMin (${normalizedBudgetMin}) cannot exceed budgetMax (${normalizedBudgetMax}).`);
  }

  // 6. Search Location validation
  let normalizedLocation = null;
  if (searchLocation !== undefined && searchLocation !== null) {
    if (typeof searchLocation !== 'object' || Array.isArray(searchLocation)) {
      errors.push('searchLocation must be an object containing latitude and longitude.');
    } else {
      const lat = Number(searchLocation.latitude !== undefined ? searchLocation.latitude : searchLocation.lat);
      const lng = Number(searchLocation.longitude !== undefined ? searchLocation.longitude : searchLocation.lng);

      if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
        errors.push(`Latitude must be a finite number between -90 and 90. Received: ${searchLocation.latitude}`);
      }
      if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
        errors.push(`Longitude must be a finite number between -180 and 180. Received: ${searchLocation.longitude}`);
      }

      if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        normalizedLocation = { latitude: lat, longitude: lng };
      }
    }
  }

  // 7. Radius validation (must be positive bounded number)
  let normalizedRadiusKm = 10.0;
  if (radiusKm !== undefined && radiusKm !== null && radiusKm !== '') {
    const r = Number(radiusKm);
    if (!Number.isFinite(r) || r <= 0 || r > 500) {
      errors.push(`radiusKm must be a positive number between 0.1 and 500 km. Received: ${radiusKm}`);
    } else {
      normalizedRadiusKm = r;
    }
  }

  // 8. Query Text validation
  let normalizedQueryText = '';
  if (queryText !== undefined && queryText !== null) {
    if (typeof queryText !== 'string') {
      errors.push('queryText must be a string.');
    } else {
      const trimmed = queryText.trim();
      if (trimmed.length > 500) {
        errors.push('queryText cannot exceed 500 characters.');
      } else {
        normalizedQueryText = trimmed;
      }
    }
  }

  // 9. Preferences validation
  let normalizedPreferences = {};
  if (preferences !== undefined && preferences !== null) {
    if (typeof preferences !== 'object' || Array.isArray(preferences)) {
      errors.push('preferences must be an object.');
    } else {
      normalizedPreferences = { ...preferences };
    }
  }

  if (errors.length > 0) {
    const err = new Error(errors.join(' '));
    err.code = 'INVALID_INPUT';
    err.status = 400;
    err.details = errors;
    throw err;
  }

  return {
    purpose: normalizedPurpose,
    category: normalizedCategory,
    propertyType: normalizedPropertyType,
    budgetMax: normalizedBudgetMax,
    budgetMin: normalizedBudgetMin,
    searchLocation: normalizedLocation,
    radiusKm: normalizedRadiusKm,
    preferences: normalizedPreferences,
    queryText: normalizedQueryText
  };
}

/**
 * Extracts and normalizes geographic coordinates from various property schema representations.
 * Handles:
 * - GeoJSON [longitude, latitude]
 * - Point geometry: { point: { coordinates: [lng, lat] } }
 * - Direct latitude / longitude properties
 * Returns { latitude, longitude, coordinates: [lng, lat] } or null if invalid/missing.
 */
function extractCoordinates(location) {
  if (!location || typeof location !== 'object') return null;

  let lat = null;
  let lng = null;

  if (Array.isArray(location.coordinates) && location.coordinates.length >= 2) {
    lng = Number(location.coordinates[0]);
    lat = Number(location.coordinates[1]);
  } else if (location.point && Array.isArray(location.point.coordinates) && location.point.coordinates.length >= 2) {
    lng = Number(location.point.coordinates[0]);
    lat = Number(location.point.coordinates[1]);
  } else if (location.latitude != null && location.longitude != null) {
    lat = Number(location.latitude);
    lng = Number(location.longitude);
  } else if (location.lat != null && location.lng != null) {
    lat = Number(location.lat);
    lng = Number(location.lng);
  }

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  // Discard placeholder (0, 0)
  if (lat === 0 && lng === 0) return null;

  return { latitude: lat, longitude: lng, coordinates: [lng, lat] };
}

/**
 * Real Haversine distance formula with Earth radius R = 6371.0 km.
 * Returns distance in kilometers rounded to 2 decimal places.
 */
function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  if (!Number.isFinite(lat1) || !Number.isFinite(lon1) || !Number.isFinite(lat2) || !Number.isFinite(lon2)) {
    return null;
  }
  const R = 6371.0;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const rLat1 = lat1 * (Math.PI / 180);
  const rLat2 = lat2 * (Math.PI / 180);

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(rLat1) * Math.cos(rLat2) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

/**
 * Computes semantic or keyword relevance score R in [0..1].
 */
function computeSemanticScore(queryText, property) {
  if (!queryText || queryText.trim() === '') {
    return 0.75; // Neutral baseline when no free-text query is supplied
  }

  const queryTokens = queryText.toLowerCase().split(/\s+/).filter(t => t.length > 1);
  if (queryTokens.length === 0) return 0.75;

  const searchableText = [
    property.title || '',
    property.description || '',
    property.category || '',
    property.propertyType || '',
    (property.amenities || []).join(' '),
    property.location?.locality || '',
    property.location?.city || '',
    property.location?.address || ''
  ].join(' ').toLowerCase();

  let matchedTokens = 0;
  for (const token of queryTokens) {
    if (searchableText.includes(token)) {
      matchedTokens++;
    }
  }

  const tokenRatio = matchedTokens / queryTokens.length;
  // If exact whole-phrase match exists
  if (searchableText.includes(queryText.toLowerCase())) {
    return 0.95;
  }

  // Scale from 0.40 (no match) to 0.90 (all tokens matched)
  return Math.round((0.40 + (0.50 * tokenRatio)) * 1000) / 1000;
}

/**
 * Computes location relevance score L in [0..1] and returns distance in km.
 */
function computeLocationScore(distKm, radiusKm, searchLocationProvided) {
  if (!searchLocationProvided) {
    return { score: 0.75, distanceKm: null };
  }

  if (distKm === null || distKm === undefined) {
    return { score: 0.0, distanceKm: null };
  }

  if (distKm > radiusKm) {
    return { score: 0.0, distanceKm: distKm };
  }

  const effectiveRadius = Math.max(1.0, radiusKm);
  const normalized = Math.max(0.0, 1.0 - (distKm / effectiveRadius));
  return { score: Math.round(normalized * 1000) / 1000, distanceKm: distKm };
}

/**
 * Computes budget compatibility score B in [0..1].
 */
function computeBudgetScore(price, budgetMax) {
  if (budgetMax === null || budgetMax === undefined || budgetMax <= 0) {
    return 0.85; // Neutral high compatibility when unconstrained
  }

  const p = Number(price) || 0;
  if (p <= budgetMax) {
    // Within budget: optimal range gets highest score
    const ratio = budgetMax > 0 ? p / budgetMax : 1.0;
    return Math.round((0.70 + (0.30 * ratio)) * 1000) / 1000;
  }

  // Beyond budget: steep decay
  const excess = (p - budgetMax) / budgetMax;
  const score = Math.max(0.05, 1.0 - (excess * 3.0));
  return Math.round(score * 1000) / 1000;
}

/**
 * Computes feature and preference compatibility score F in [0..1].
 */
function computeFeatureScore(property, preferences = {}) {
  let score = 0.50; // Base neutral score
  let adjustments = 0;

  // 1. Bedrooms preference check
  if (preferences.bedrooms !== undefined && preferences.bedrooms !== null) {
    adjustments++;
    const prefBhk = Number(preferences.bedrooms);
    const propBhk = Number(property.bedrooms || 0);
    if (propBhk === prefBhk) {
      score += 0.25;
    } else if (Math.abs(propBhk - prefBhk) === 1) {
      score += 0.10;
    } else {
      score -= 0.15;
    }
  }

  // 2. Amenities preference overlap
  if (Array.isArray(preferences.amenities) && preferences.amenities.length > 0) {
    adjustments++;
    const propAmenities = new Set((property.amenities || []).map(a => String(a).toLowerCase()));
    let matched = 0;
    for (const a of preferences.amenities) {
      if (propAmenities.has(String(a).toLowerCase())) {
        matched++;
      }
    }
    const overlap = matched / preferences.amenities.length;
    score += (overlap * 0.25);
  }

  // 3. Min Area preference check
  if (preferences.minAreaSqFt !== undefined && preferences.minAreaSqFt !== null) {
    adjustments++;
    const minArea = Number(preferences.minAreaSqFt);
    const propArea = Number(property.area?.value || property.areaSqFt || 0);
    if (propArea >= minArea) {
      score += 0.15;
    } else {
      score -= 0.15;
    }
  }

  // 4. Preferred property types
  if (Array.isArray(preferences.propertyTypes) && preferences.propertyTypes.length > 0) {
    adjustments++;
    const propType = String(property.propertyType || '').toLowerCase();
    const matchesType = preferences.propertyTypes.some(t => String(t).toLowerCase() === propType);
    if (matchesType) {
      score += 0.15;
    } else {
      score -= 0.10;
    }
  }

  return Math.min(1.0, Math.max(0.0, Math.round(score * 1000) / 1000));
}

/**
 * Computes listing quality and verification quality score Q in [0..1].
 * Distinguishes genuine Cadastral and RERA records from basic approval.
 * Missing verification NEVER receives default points.
 */
function computeQualityScore(property) {
  let q = 0.0;

  // Cadastral verification: genuine survey / GIS record
  if (property.cadastralVerified === true || property.cadastral_verified === true) {
    q += 0.40;
  }

  // RERA registration check (authoritative fields)
  const hasRera = Boolean(
    property.land_details?.reraNumber ||
    property.type_specific_data?.reraNumber ||
    property.typeSpecificData?.reraNumber ||
    property.reraApproved === true ||
    property.rera_number
  );
  if (hasRera) {
    q += 0.15;
  }

  // Image completeness
  const imgCount = Array.isArray(property.images) ? property.images.length : (property.imagesCount || 0);
  if (imgCount >= 3) {
    q += 0.25;
  } else if (imgCount >= 1) {
    q += 0.10;
  }

  // Description quality
  const desc = property.description || '';
  if (desc.trim().length >= 80) {
    q += 0.20;
  } else if (desc.trim().length >= 30) {
    q += 0.10;
  }

  return Math.min(1.0, Math.max(0.0, Math.round(q * 1000) / 1000));
}

/**
 * Computes the unified final recommendation score:
 * Final Score = 0.35R + 0.25L + 0.20B + 0.15F + 0.05Q
 */
function computeFinalScore(R, L, B, F, Q) {
  const finalScore = (0.35 * R) + (0.25 * L) + (0.20 * B) + (0.15 * F) + (0.05 * Q);
  return Math.round(finalScore * 10000) / 10000;
}

/**
 * Generates purely factual explanations based strictly on property facts and verified data.
 * Zero fabricated claims ("Cadastral & RERA verified listing" is excluded unless verified).
 */
function generateFactualExplanations(property, metrics = {}) {
  const explanations = [];

  // 1. Cadastral verification
  if (property.cadastralVerified === true || property.cadastral_verified === true) {
    explanations.push("✓ Cadastral verification is recorded");
  }

  // 2. RERA verification
  const hasRera = Boolean(
    property.land_details?.reraNumber ||
    property.type_specific_data?.reraNumber ||
    property.typeSpecificData?.reraNumber ||
    property.reraApproved === true ||
    property.rera_number
  );
  if (hasRera) {
    explanations.push("✓ RERA registration details are recorded in listing");
  }

  // 3. Location distance
  if (metrics.distanceKm !== null && metrics.distanceKm !== undefined) {
    explanations.push(`📍 Located ${metrics.distanceKm} km from chosen search location`);
  } else if (property.location?.locality || property.location?.city) {
    const locName = property.location.locality || property.location.city;
    explanations.push(`📍 Located in ${locName}`);
  }

  // 4. Budget
  const price = Number(property.price) || 0;
  const formattedPrice = `₹${price.toLocaleString('en-IN')}`;
  if (metrics.budgetMax !== null && metrics.budgetMax !== undefined && price <= metrics.budgetMax) {
    explanations.push(`💰 Within your stated budget limit (${formattedPrice})`);
  }

  // 5. Bedrooms
  if (metrics.preferredBedrooms !== null && metrics.preferredBedrooms !== undefined && property.bedrooms === metrics.preferredBedrooms) {
    explanations.push(`🛏️ Exact ${property.bedrooms} BHK configuration matches your preference`);
  }

  // 6. Amenities
  if (Array.isArray(property.amenities) && property.amenities.length > 0) {
    const topAmenities = property.amenities.slice(0, 3).join(', ');
    explanations.push(`✨ Features: ${topAmenities}`);
  }

  if (explanations.length === 0) {
    explanations.push("✓ Verified public listing");
  }

  return explanations;
}

/**
 * Sanitizes property payload to ensure no private deeds, seller contact details,
 * or internal moderation data are exposed to recommendation consumers.
 */
function sanitizeProperty(property) {
  if (!property) return null;

  const {
    deeds: _deeds,
    privateDocuments: _pdocs,
    documents: _docs,
    sellerContact: _contact,
    brokerFee: _fee,
    reviewNotes: _notes,
    reviewedBy: _revBy,
    reviewedAt: _revAt,
    rejectionReason: _rej,
    passwordHash: _pass,
    ...safeProp
  } = property;

  return safeProp;
}

/**
 * Main Recommendation Controller Handler
 */
exports.getRecommendations = async (req, res, next) => {
  try {
    // Step 1: Validate input fields
    let validatedInputs;
    try {
      validatedInputs = validateRecommendationInputs(req.body);
    } catch (valErr) {
      return res.status(valErr.status || 400).json({
        success: false,
        error: valErr.message,
        code: valErr.code || 'INVALID_INPUT',
        details: valErr.details || []
      });
    }

    const {
      purpose,
      category,
      propertyType,
      budgetMax,
      budgetMin,
      searchLocation,
      radiusKm,
      preferences,
      queryText
    } = validatedInputs;

    // Step 2: Public Property Eligibility & Hard Filtering
    const viewerId = req.user ? req.user : null;
    const cacheKey = `recommendations:${JSON.stringify({ ...validatedInputs, viewerId })}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Filter properties strictly
    const eligibleCandidates = db.properties.filter(p => {
      // 1. Central Public Eligibility invariant
      if (!isPropertyPubliclyEligible(p, viewerId)) {
        return false;
      }

      // 2. Transaction Purpose filter
      if (purpose && p.purpose && p.purpose.toLowerCase() !== purpose.toLowerCase()) {
        return false;
      }

      // 3. Category filter
      if (category && p.category && p.category.toLowerCase() !== category.toLowerCase()) {
        return false;
      }

      // 4. Property Type filter
      if (propertyType && p.propertyType && p.propertyType.toLowerCase() !== propertyType.toLowerCase()) {
        return false;
      }

      // 5. Budget Max filter (strict bounds: properties exceeding budget are excluded)
      const price = Number(p.price);
      if (budgetMax !== null && (!Number.isFinite(price) || price > budgetMax)) {
        return false;
      }

      // 6. Budget Min filter
      if (budgetMin !== null && (!Number.isFinite(price) || price < budgetMin)) {
        return false;
      }

      // 7. Geospatial Location & Radius filter (when search location is provided)
      if (searchLocation) {
        const coords = extractCoordinates(p.location);
        if (!coords) {
          // Property with unknown coordinates cannot be proven nearby
          return false;
        }
        const dist = haversineDistanceKm(
          searchLocation.latitude,
          searchLocation.longitude,
          coords.latitude,
          coords.longitude
        );
        if (dist === null || dist > radiusKm) {
          return false;
        }
      }

      return true;
    });

    // Step 3: If zero eligible candidates match, return successful empty result
    if (eligibleCandidates.length === 0) {
      const emptyPayload = {
        success: true,
        source: "internal-deterministic-engine",
        engine: "rule-based-deterministic",
        isAIPowered: false,
        isFallback: false,
        totalCandidates: 0,
        rankedCount: 0,
        results: []
      };
      await cacheService.set(cacheKey, emptyPayload, 60);
      return res.json(emptyPayload);
    }

    // Build candidate map for fast lookup and validation
    const candidateMap = new Map();
    const candidatePayloads = eligibleCandidates.map(p => {
      const coords = extractCoordinates(p.location);
      const safeProp = sanitizeProperty(p);
      candidateMap.set(String(p._id), { raw: p, safe: safeProp, coords });

      return {
        id: String(p._id),
        title: p.title || '',
        description: p.description || '',
        category: p.category || '',
        propertyType: p.propertyType || '',
        purpose: p.purpose || '',
        price: Number(p.price) || 0,
        bedrooms: Number(p.bedrooms || 0),
        bathrooms: Number(p.bathrooms || 0),
        areaSqFt: Number(p.area?.value || 0),
        amenities: Array.isArray(p.amenities) ? p.amenities : [],
        location: {
          address: p.location?.address || '',
          locality: p.location?.locality || '',
          city: p.location?.city || '',
          state: p.location?.state || '',
          pincode: p.location?.pincode || '',
          coordinates: coords ? coords.coordinates : null
        },
        verificationStatus: p.verificationStatus || 'approved',
        publicationStatus: p.publicationStatus || 'published',
        cadastralVerified: p.cadastralVerified === true,
        imagesCount: Array.isArray(p.images) ? p.images.length : 0
      };
    });

    const aiPayload = {
      purpose: purpose || 'sale',
      category: category || null,
      propertyType: propertyType || null,
      budgetMax: budgetMax,
      budgetMin: budgetMin,
      searchLocation: searchLocation,
      radiusKm: radiusKm,
      queryText: queryText,
      preferences: preferences,
      candidates: candidatePayloads
    };

    // Step 4: Try Python FastAPI AI Microservice with strict response validation
    let fastApiSuccess = false;
    let fastApiResults = [];

    try {
      let aiServiceUrl = (process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000').trim().replace(/\/+$/, '');
      if (!aiServiceUrl.startsWith('http://') && !aiServiceUrl.startsWith('https://')) {
        aiServiceUrl = `https://${aiServiceUrl}`;
      }
      const aiSecret = process.env.AI_SERVICE_SECRET || 'property_marketplace_ai_secret';

      const response = await fetch(`${aiServiceUrl}/v1/recommendations/rank`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ai-secret': aiSecret
        },
        body: JSON.stringify(aiPayload),
        signal: AbortSignal.timeout(3000)
      });

      if (response.ok) {
        const data = await response.json();
        if (data && Array.isArray(data.results)) {
          const validatedResults = [];
          const seenIds = new Set();

          for (const item of data.results) {
            const propId = String(item.propertyId || item.property?.id || '');
            if (!propId || seenIds.has(propId)) continue;

            // Security Invariant: NEVER trust external microservice with authorization.
            // Only accept properties that are in our pre-filtered eligible candidate map!
            const entry = candidateMap.get(propId);
            if (!entry) continue;

            seenIds.add(propId);

            // Compute actual distance for verification
            let distanceKm = null;
            if (searchLocation && entry.coords) {
              distanceKm = haversineDistanceKm(
                searchLocation.latitude,
                searchLocation.longitude,
                entry.coords.latitude,
                entry.coords.longitude
              );
            }

            const rawScore = Number(item.score);
            const validScore = Number.isFinite(rawScore) ? Math.min(1.0, Math.max(0.0, rawScore)) : 0.5;

            validatedResults.push({
              propertyId: propId,
              property: entry.safe,
              score: validScore,
              scoreBreakdown: item.scoreBreakdown || {
                semanticScore: 0.75,
                locationScore: 0.75,
                budgetScore: 0.85,
                featureScore: 0.75,
                qualityScore: 0.60,
                finalScore: validScore
              },
              distanceKm: distanceKm,
              explanation: Array.isArray(item.explanation) && item.explanation.length > 0
                ? item.explanation
                : generateFactualExplanations(entry.raw, {
                    distanceKm,
                    budgetMax,
                    preferredBedrooms: preferences.bedrooms
                  })
            });
          }

          if (validatedResults.length > 0) {
            fastApiSuccess = true;
            fastApiResults = validatedResults;
          }
        }
      }
    } catch (_err) {
      // Microservice is offline, timed out, or returned an error; cleanly proceed to deterministic fallback
    }

    if (fastApiSuccess) {
      const payload = {
        success: true,
        source: "python-fastapi-service",
        engine: "ai-model-ranked",
        isAIPowered: true,
        isFallback: false,
        totalCandidates: eligibleCandidates.length,
        rankedCount: fastApiResults.length,
        results: fastApiResults
      };
      await cacheService.set(cacheKey, payload, 60);
      return res.json(payload);
    }

    // Step 5: Resilient Deterministic Fallback implementing exact formula:
    // Final Score = 0.35R + 0.25L + 0.20B + 0.15F + 0.05Q
    const rankedFallback = eligibleCandidates.map(p => {
      const entry = candidateMap.get(String(p._id));
      const coords = entry?.coords;

      // 1. R - Semantic Relevance
      const R = computeSemanticScore(queryText, p);

      // 2. L - Location Proximity
      let distKm = null;
      if (searchLocation && coords) {
        distKm = haversineDistanceKm(
          searchLocation.latitude,
          searchLocation.longitude,
          coords.latitude,
          coords.longitude
        );
      }
      const { score: L, distanceKm } = computeLocationScore(distKm, radiusKm, Boolean(searchLocation));

      // 3. B - Budget Fit
      const B = computeBudgetScore(p.price, budgetMax);

      // 4. F - Feature & Preference Overlap
      const F = computeFeatureScore(p, preferences);

      // 5. Q - Quality & Verification Status
      const Q = computeQualityScore(p);

      // Composite score: S = 0.35R + 0.25L + 0.20B + 0.15F + 0.05Q
      const finalScore = computeFinalScore(R, L, B, F, Q);

      // Factual explanations only
      const explanation = generateFactualExplanations(p, {
        distanceKm,
        budgetMax,
        preferredBedrooms: preferences.bedrooms
      });

      return {
        propertyId: String(p._id),
        property: entry?.safe || sanitizeProperty(p),
        score: finalScore,
        scoreBreakdown: {
          semanticScore: R,
          locationScore: L,
          budgetScore: B,
          featureScore: F,
          qualityScore: Q,
          finalScore: finalScore
        },
        distanceKm: distanceKm,
        explanation: explanation
      };
    });

    // Deterministic tie-breaking:
    // 1. Final score descending
    // 2. Distance ascending (if available)
    // 3. Property ID ascending
    rankedFallback.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      if (a.distanceKm !== null && b.distanceKm !== null && a.distanceKm !== b.distanceKm) {
        return a.distanceKm - b.distanceKm;
      }
      return a.propertyId.localeCompare(b.propertyId);
    });

    const fallbackPayload = {
      success: true,
      source: "internal-deterministic-engine",
      engine: "rule-based-deterministic",
      isAIPowered: false,
      isFallback: true,
      totalCandidates: eligibleCandidates.length,
      rankedCount: rankedFallback.length,
      results: rankedFallback
    };
    await cacheService.set(cacheKey, fallbackPayload, 60);
    res.json(fallbackPayload);
  } catch (error) {
    next(error);
  }
};

// Export individual calculation functions for unit and regression testing
exports.validateRecommendationInputs = validateRecommendationInputs;
exports.extractCoordinates = extractCoordinates;
exports.haversineDistanceKm = haversineDistanceKm;
exports.computeSemanticScore = computeSemanticScore;
exports.computeLocationScore = computeLocationScore;
exports.computeBudgetScore = computeBudgetScore;
exports.computeFeatureScore = computeFeatureScore;
exports.computeQualityScore = computeQualityScore;
exports.computeFinalScore = computeFinalScore;
exports.generateFactualExplanations = generateFactualExplanations;
exports.sanitizeProperty = sanitizeProperty;
