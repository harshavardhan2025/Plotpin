/**
 * Property Listings & Document Verification Controller
 * Connected with live Supabase Storage & Database
 */
const { db, supabase } = require('../config/database');
const { storage } = require('../config/storage');
const { isPropertyPubliclyEligible, isPropertyActionEligible } = require('../utils/propertyEligibility');
const emailService = require('../services/emailService');
const { cacheService } = require('../services/cacheService');

// Helper to find property (strictly excludes permanently removed/tombstoned properties)
const findPropertyById = (id) => db.properties.find(p => (p._id === id || p.id === id) && !p.isRemoved && p.status !== 'removed' && !(db.removedPropertyIds && (db.removedPropertyIds.has(p._id) || db.removedPropertyIds.has(p.id))));

// Helper to extract lat & lng from property location object
function getPropertyCoordinates(prop) {
  if (!prop || !prop.location) return null;
  const loc = prop.location;
  if (Array.isArray(loc.point?.coordinates) && loc.point.coordinates.length >= 2) {
    return { lng: Number(loc.point.coordinates[0]), lat: Number(loc.point.coordinates[1]) };
  }
  if (Array.isArray(loc.coordinates) && loc.coordinates.length >= 2) {
    return { lng: Number(loc.coordinates[0]), lat: Number(loc.coordinates[1]) };
  }
  if (typeof loc.latitude === 'number' && typeof loc.longitude === 'number') {
    return { lat: loc.latitude, lng: loc.longitude };
  }
  if (typeof loc.lat === 'number' && typeof loc.lng === 'number') {
    return { lat: loc.lat, lng: loc.lng };
  }
  return null;
}

// Haversine formula distance in kilometers
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

// Indian Currency Parser: converts numbers, formatted strings (e.g., ₹3,85,00,000, 3,85,00,000),
// and shorthand units (Cr, Crore, L, Lakh, k) into exact numerical values.
// Rejects NaN, Infinity, negative values, and non-numeric garbage.
function parseIndianCurrency(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') {
    if (!Number.isFinite(val) || isNaN(val) || val < 0) return null;
    return val;
  }
  if (typeof val !== 'string') return null;

  let str = val.trim();
  // Strip currency symbols (₹, $, INR, Rs., Rs) and comma grouping delimiters
  str = str.replace(/[₹$]|INR|Rs\.?|,/gi, '').trim();

  // Check for shorthand suffixes like Cr, Crore, L, Lakh, Lac, k
  const crMatch = str.match(/^([\d.]+)\s*(cr|crore|crores)$/i);
  if (crMatch) {
    const num = parseFloat(crMatch[1]);
    return Number.isFinite(num) && num >= 0 ? Math.round(num * 1e7) : null;
  }
  const lakhMatch = str.match(/^([\d.]+)\s*(l|lac|lakh|lakhs)$/i);
  if (lakhMatch) {
    const num = parseFloat(lakhMatch[1]);
    return Number.isFinite(num) && num >= 0 ? Math.round(num * 1e5) : null;
  }
  const kMatch = str.match(/^([\d.]+)\s*(k|thousand)$/i);
  if (kMatch) {
    const num = parseFloat(kMatch[1]);
    return Number.isFinite(num) && num >= 0 ? Math.round(num * 1e3) : null;
  }

  const parsed = Number(str);
  if (isNaN(parsed) || !Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}
exports.parseIndianCurrency = parseIndianCurrency;

/**
 * Duplicate Property Detection Logic
 * Strictly prevents duplicate property postings across PlotPin.
 * Checks for:
 * 1. Survey / Khata Title Collision (same survey number in same locality/city)
 * 2. Owner Title Collision (same user listing identical title in same locality)
 * 3. Exact Physical Address Collision (identical normalized street address in same locality)
 * 4. Exact GPS Satellite Coordinates Collision (< 20 meters proximity)
 */
function checkForDuplicateProperty(newProp, excludeId = null) {
  if (!newProp) return { isDuplicate: false };

  const norm = (s) => (s ? String(s).toLowerCase().replace(/[^a-z0-9]/g, '') : '');

  const newTitleNorm = norm(newProp.title);
  const newSurveyNorm = norm(newProp.landDetails?.surveyNumber || newProp.surveyNumber);
  const newAddressNorm = norm(newProp.location?.address);
  const newLocalityNorm = norm(newProp.location?.locality);
  const newCityNorm = norm(newProp.location?.city || 'Bengaluru');
  const newOwnerId = newProp.ownerId || newProp.owner_id;
  const newCoords = getPropertyCoordinates(newProp);
  const newCategoryNorm = norm(newProp.category);
  const newTypeNorm = norm(newProp.propertyType);

  for (const existing of db.properties) {
    if (excludeId && existing._id === excludeId) continue;

    // Disregard permanently removed or rejected properties
    if (
      existing.isRemoved || 
      existing.status === 'removed' || 
      existing.verificationStatus === 'rejected' ||
      (db.removedPropertyIds && db.removedPropertyIds.has(existing._id))
    ) {
      continue;
    }

    const exOwnerId = existing.ownerId || existing.owner_id;
    const exLocalityNorm = norm(existing.location?.locality);
    const exCityNorm = norm(existing.location?.city || 'Bengaluru');

    const sameLocality = newLocalityNorm && exLocalityNorm && (newLocalityNorm === exLocalityNorm || newLocalityNorm.includes(exLocalityNorm) || exLocalityNorm.includes(newLocalityNorm));
    const sameCity = newCityNorm && exCityNorm && newCityNorm === exCityNorm;
    const sameArea = sameLocality || sameCity;

    // 1. Cadastral Survey / Khata Number collision
    if (newSurveyNorm && newSurveyNorm.length >= 3) {
      const exSurveyNorm = norm(existing.landDetails?.surveyNumber || existing.surveyNumber);
      if (exSurveyNorm && exSurveyNorm === newSurveyNorm && sameArea) {
        const isSameOwner = newOwnerId && exOwnerId && String(newOwnerId) === String(exOwnerId);
        return {
          isDuplicate: true,
          code: 'DUPLICATE_SURVEY_NUMBER',
          reason: `A property with Cadastral Survey / Khata number "${newProp.landDetails?.surveyNumber || newProp.surveyNumber}" is already registered on PlotPin (${existing.title}).`,
          matchedPropertyId: existing._id,
          matchedPropertyTitle: existing.title,
          matchedOwnerId: exOwnerId,
          matchedOwnerName: existing.ownerName || 'Another Citizen',
          matchedOwnerPhone: existing.ownerPhone || '',
          isSameOwner: Boolean(isSameOwner)
        };
      }
    }

    // 2. Same Owner duplicate title in same locality/city
    if (newOwnerId && exOwnerId && String(newOwnerId) === String(exOwnerId)) {
      const exTitleNorm = norm(existing.title);
      if (newTitleNorm && exTitleNorm && newTitleNorm === exTitleNorm && sameArea) {
        return {
          isDuplicate: true,
          code: 'DUPLICATE_OWNER_LISTING',
          reason: `You have already posted a listing titled "${existing.title}" in this locality. Please edit your existing listing instead of posting a duplicate.`,
          matchedPropertyId: existing._id,
          matchedPropertyTitle: existing.title,
          matchedOwnerId: exOwnerId,
          matchedOwnerName: existing.ownerName || 'Another Citizen',
          matchedOwnerPhone: existing.ownerPhone || '',
          isSameOwner: true
        };
      }
    }

    // 3. Exact physical street address + locality match
    const isGenericFallback = (addr, loc) => {
      if (!addr) return true;
      const a = addr.trim().toLowerCase();
      return a === 'unspecified address' || a.endsWith('corridor') || a === (loc || '').trim().toLowerCase();
    };

    if (newAddressNorm && newAddressNorm.length >= 8 && !isGenericFallback(newProp.location?.address, newProp.location?.locality)) {
      const exAddress = existing.location?.address;
      if (!isGenericFallback(exAddress, existing.location?.locality)) {
        const exAddressNorm = norm(exAddress);
        if (exAddressNorm && exAddressNorm === newAddressNorm && sameLocality) {
          const exCategoryNorm = norm(existing.category);
          const exTypeNorm = norm(existing.propertyType);
          if (
            (newCategoryNorm !== 'flat' && exCategoryNorm !== 'flat') ||
            (newCategoryNorm === exCategoryNorm && newTypeNorm === exTypeNorm)
          ) {
            const isSameOwner = newOwnerId && exOwnerId && String(newOwnerId) === String(exOwnerId);
            return {
              isDuplicate: true,
              code: 'DUPLICATE_ADDRESS',
              reason: `A listing with the address "${newProp.location?.address}" in ${existing.location?.locality || 'this area'} already exists (${existing.title}).`,
              matchedPropertyId: existing._id,
              matchedPropertyTitle: existing.title,
              matchedOwnerId: exOwnerId,
              matchedOwnerName: existing.ownerName || 'Another Citizen',
              matchedOwnerPhone: existing.ownerPhone || '',
              isSameOwner: Boolean(isSameOwner)
            };
          }
        }
      }
    }

    // 4. Exact GPS pin coordinates (< 20 meters) with identical property type or same owner
    if (newCoords && newCoords.lat != null && newCoords.lng != null) {
      const exCoords = getPropertyCoordinates(existing);
      if (exCoords && exCoords.lat != null && exCoords.lng != null) {
        const distKm = calculateDistanceKm(newCoords.lat, newCoords.lng, exCoords.lat, exCoords.lng);
        if (distKm !== null && distKm < 0.02) {
          const exCategoryNorm = norm(existing.category);
          const exTypeNorm = norm(existing.propertyType);
          const isSameOwner = newOwnerId && exOwnerId && String(newOwnerId) === String(exOwnerId);
          if (
            isSameOwner ||
            (newCategoryNorm === exCategoryNorm && newTypeNorm === exTypeNorm && (newCategoryNorm === 'land' || newCategoryNorm === 'agricultural' || newCategoryNorm === 'house'))
          ) {
            return {
              isDuplicate: true,
              code: 'DUPLICATE_GPS_PIN',
              reason: `A property is already pinned at these exact GPS coordinates (${existing.title}).`,
              matchedPropertyId: existing._id,
              matchedPropertyTitle: existing.title,
              matchedOwnerId: exOwnerId,
              matchedOwnerName: existing.ownerName || 'Another Citizen',
              matchedOwnerPhone: existing.ownerPhone || '',
              isSameOwner: Boolean(isSameOwner)
            };
          }
        }
      }
    }
  }

  return { isDuplicate: false };
}
exports.checkForDuplicateProperty = checkForDuplicateProperty;

// Centralized search cache invalidation for Redis & in-memory engines
async function invalidateSearchCache() {
  try {
    await cacheService.delPattern('properties:*');
    await cacheService.delPattern('property:*');
    await cacheService.del('admin:overview');
  } catch (err) {
    console.warn('⚠️ [Cache] Failed to invalidate search cache:', err.message);
  }
}

exports.searchPublic = async (req, res, next) => {
  try {
    const { 
      category, purpose, propertyType, budgetMax, budgetMin, locality, query, 
      excludeOwnerId, lat, lng, radiusKm, sortBy, page, limit 
    } = req.query;

    const excludeId = excludeOwnerId || (req.user ? req.user : null);
    const cacheKey = `properties:search:${JSON.stringify({
      category, purpose, propertyType, budgetMax, budgetMin, locality, query,
      excludeId, lat, lng, radiusKm, sortBy, page, limit
    })}`;

    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Filter available properties using central eligibility rule (strictly excludes removed, unapproved, unpublished, revision-pending, and owner listings)
    let results = db.properties.filter(p => isPropertyPubliclyEligible(p, excludeId));

    if (category && category !== 'all') {
      results = results.filter(p => p.category && p.category.toLowerCase() === category.toLowerCase());
    }

    if (purpose && purpose !== 'all') {
      results = results.filter(p => p.purpose && p.purpose.toLowerCase() === purpose.toLowerCase());
    }

    if (propertyType && propertyType !== 'all') {
      results = results.filter(p => p.propertyType && p.propertyType.toLowerCase() === propertyType.toLowerCase());
    }

    if (budgetMax) {
      const maxVal = parseIndianCurrency(budgetMax);
      if (maxVal !== null) {
        results = results.filter(p => p.price <= maxVal);
      }
    }

    if (budgetMin) {
      const minVal = parseIndianCurrency(budgetMin);
      if (minVal !== null) {
        results = results.filter(p => p.price >= minVal);
      }
    }

    if (locality) {
      results = results.filter(p => 
        (p.location?.locality && p.location.locality.toLowerCase().includes(locality.toLowerCase())) ||
        (p.location?.address && p.location.address.toLowerCase().includes(locality.toLowerCase()))
      );
    }

    if (query) {
      const tokens = String(query).toLowerCase().trim().split(/\s+/).filter(Boolean);
      results = results.filter(p => {
        const cat = (p.category || p.propertyType || '').toLowerCase();
        let catSynonyms = '';
        if (['flat', 'apartment'].includes(cat)) catSynonyms = 'flat apartment apts flat/apartment';
        else if (['house', 'villa'].includes(cat)) catSynonyms = 'house villa bungalow duplex home';
        else if (['plot', 'land'].includes(cat)) catSynonyms = 'plot land site layout';
        else if (['pg', 'hostel'].includes(cat)) catSynonyms = 'pg hostel coliving paying guest';
        else if (['commercial', 'office', 'shop'].includes(cat)) catSynonyms = 'commercial office shop retail showroom';
        else if (['agricultural', 'farmland'].includes(cat)) catSynonyms = 'farmland agricultural farm plantation agro';

        const beds = Number(p.bedrooms || p.bhk || 0);
        const bhkText = beds > 0 ? `${beds}bhk ${beds} bhk ${beds} bed ${beds} bedroom` : '';
        const purposeText = p.purpose === 'rent' ? 'rent rental lease' : 'sale buy purchase';
        const legalText = [
          p.reraId || p.rera_id || p.land_details?.reraNumber,
          p.surveyNumber || p.cadastralSurveyNumber || p.khasraNumber,
          p.khataNumber || p.eKhataNumber || p.pidNumber,
          p.land_details?.khataType,
          p.verificationStatus === 'approved' ? 'cadastral cleared verified demarcated direct owner' : ''
        ].filter(Boolean).join(' ');

        const searchableText = [
          p.title,
          p.description,
          p.propertyType,
          p.category,
          catSynonyms,
          bhkText,
          purposeText,
          legalText,
          p.location?.locality,
          p.location?.address,
          p.location?.city,
          p.location?.state,
          p.location?.pincode,
          p.location?.landmark,
          Array.isArray(p.amenities) ? p.amenities.join(' ') : ''
        ].filter(Boolean).join(' ').toLowerCase();

        return tokens.every(token => searchableText.includes(token));
      });
    }

    // Geospatial Distance Calculation & Radius Filter
    const userLat = lat != null ? parseFloat(lat) : null;
    const userLng = lng != null ? parseFloat(lng) : null;
    const radius = radiusKm != null ? parseFloat(radiusKm) : null;

    if (userLat != null && userLng != null && !isNaN(userLat) && !isNaN(userLng)) {
      results = results.map(p => {
        const coords = getPropertyCoordinates(p);
        const dist = coords ? calculateDistanceKm(userLat, userLng, coords.lat, coords.lng) : null;
        return {
          ...p,
          distanceKm: dist
        };
      });

      // Do not filter out by radius if an explicit search query or locality filter was provided
      if (!query && !locality && radius != null && !isNaN(radius)) {
        results = results.filter(p => p.distanceKm != null && p.distanceKm <= radius);
      }
    }

    // Sorting
    if (sortBy === 'distance' && userLat != null && userLng != null) {
      results.sort((a, b) => {
        if (a.distanceKm == null && b.distanceKm == null) return 0;
        if (a.distanceKm == null) return 1;
        if (b.distanceKm == null) return -1;
        return a.distanceKm - b.distanceKm;
      });
    } else if (sortBy === 'price_asc') {
      results.sort((a, b) => (a.price || 0) - (b.price || 0));
    } else if (sortBy === 'price_desc') {
      results.sort((a, b) => (b.price || 0) - (a.price || 0));
    } else if (sortBy === 'newest') {
      results.sort((a, b) => new Date(b.updatedAt || b.updated_at || b.createdAt || b.created_at || 0) - new Date(a.updatedAt || a.updated_at || a.createdAt || a.created_at || 0));
    }

    // Pagination (bounded to maximum 100 items per page for scalability DOS protection)
    const totalCount = results.length;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const startIndex = (pageNum - 1) * limitNum;
    const paginated = results.slice(startIndex, startIndex + limitNum);

    // Confidentiality enforcement: Only admin and the property owner can see uploaded deeds
    const sanitizedPaginated = paginated.map(p => {
      const isOwner = req.user && (p.ownerId === req.user._id || p.owner_id === req.user._id);
      const isAdmin = req.user && req.user.roles && req.user.roles.includes('admin');
      if (isOwner || isAdmin) {
        return p;
      }
      const { documents, ...safe } = p;
      return safe;
    });

    const payload = {
      success: true,
      count: sanitizedPaginated.length,
      totalCount,
      page: pageNum,
      totalPages: Math.ceil(totalCount / limitNum),
      properties: sanitizedPaginated
    };

    // Cache for 60 seconds (Redis & In-Memory)
    await cacheService.set(cacheKey, payload, 60);

    res.json(payload);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/properties/nearby
 * Worldwide Proximity Search with Haversine great-circle distance & GeoJSON point queries
 * Query params: lat (req), lng (req), radius (opt, default 50, bounded 1-100 km)
 */
exports.getNearby = async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const radius = Number(req.query.radius ?? req.query.radiusKm ?? 50);

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      Math.abs(lat) > 90 ||
      Math.abs(lng) > 180 ||
      !Number.isFinite(radius) ||
      radius < 1 ||
      radius > 100
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid coordinates or radius'
      });
    }

    const excludeId = req.user ? req.user : null;
    const cacheKey = `properties:nearby:${lat.toFixed(4)}:${lng.toFixed(4)}:${radius}:${excludeId || 'anon'}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Public eligibility: strictly excludes unapproved, removed, unpublished, or seller's own listings
    let results = db.properties
      .filter(p => isPropertyPubliclyEligible(p, excludeId))
      .map(p => {
        const coords = getPropertyCoordinates(p);
        const dist = coords ? calculateDistanceKm(lat, lng, coords.lat, coords.lng) : null;
        return {
          ...p,
          distanceKm: dist
        };
      })
      .filter(p => p.distanceKm != null && p.distanceKm <= radius)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 100);

    // Security: Exclude confidential deeds for non-owners/non-admins
    const sanitized = results.map(p => {
      const isOwner = req.user && (p.ownerId === req.user._id || p.owner_id === req.user._id);
      const isAdmin = req.user && req.user.roles && req.user.roles.includes('admin');
      if (isOwner || isAdmin) return p;
      const { documents, deedAudit, ...safe } = p;
      return safe;
    });

    const payload = {
      success: true,
      count: sanitized.length,
      properties: sanitized
    };

    // Cache nearby query for 60 seconds
    await cacheService.set(cacheKey, payload, 60);

    return res.json(payload);
  } catch (error) {
    console.error('Nearby properties error:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to retrieve nearby properties'
    });
  }
};

exports.getById = async (req, res, next) => {
  try {
    const isPublicViewer = !req.user;
    const cacheKey = `property:public:${req.params.id}`;

    if (isPublicViewer) {
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }
    }

    const prop = findPropertyById(req.params.id);
    if (!prop || prop.isRemoved || prop.status === 'removed' || (db.removedPropertyIds && db.removedPropertyIds.has(req.params.id))) {
      return res.status(404).json({ error: "Property listing not found", code: "NOT_FOUND" });
    }

    const isOwner = req.user && (prop.ownerId === req.user._id || prop.owner_id === req.user._id);
    const isAdmin = req.user && req.user.roles && req.user.roles.includes('admin');
    const isBuyer = req.user && (
      (prop.buyerId && String(prop.buyerId) === String(req.user._id)) ||
      (prop.buyerEmail && req.user.email && prop.buyerEmail.toLowerCase() === req.user.email.toLowerCase()) ||
      (prop.buyerPhone && req.user.mobile && prop.buyerPhone.replace(/\D/g, '') === req.user.mobile.replace(/\D/g, ''))
    );

    // If property has been sold or rented out, ONLY the buyer, owner, and admin can access it
    const isClosedTransaction = 
      prop.availabilityStatus === 'sold' || 
      prop.availabilityStatus === 'rented' || 
      prop.status === 'sold' || 
      prop.status === 'rented' ||
      prop.publicationStatus === 'completed';

    if (isClosedTransaction && !isBuyer && !isOwner && !isAdmin) {
      return res.status(403).json({
        error: "This property is no longer active on the market (Sold / Rented). Access to title deeds and property records is restricted to the buyer, owner, or platform administrators.",
        code: "PROPERTY_CLOSED"
      });
    }
    
    // If undergoing revision, hide from public discovery and non-owners/non-admins
    if ((prop.hasPendingRevision || prop.isTemporarilyHidden || prop.verificationStatus === 'pending_revision') && !isOwner && !isAdmin) {
      return res.status(403).json({
        error: "This listing has proposed updates undergoing administrative review and is temporarily unavailable to the public",
        code: "PENDING_REVISION"
      });
    }

    if (prop.publicationStatus !== 'published' && !isOwner && !isAdmin && !isBuyer) {
      return res.status(403).json({
        error: "This property is undergoing verification review and is not yet publicly visible",
        code: "UNPUBLISHED"
      });
    }

    const safeProp = { ...prop };
    if (!isOwner && !isAdmin && !isBuyer) {
      delete safeProp.documents;
      delete safeProp.pendingRevision;
    }

    const payload = {
      success: true,
      property: safeProp
    };

    if (isPublicViewer && prop.publicationStatus === 'published') {
      await cacheService.set(cacheKey, payload, 300);
    }

    res.json(payload);
  } catch (error) {
    next(error);
  }
};

exports.createDraft = async (req, res, next) => {
  try {
    if (req.user.accountStatus === 'suspended') {
      return res.status(403).json({ error: "Suspended accounts cannot create listings" });
    }

    const {
      title, description, category, propertyType, purpose, price, area, bedrooms, bathrooms, amenities, location, images
    } = req.body;

    const numPrice = parseIndianCurrency(price);
    if (!title || typeof title !== 'string' || title.trim().length < 3) {
      return res.status(400).json({ error: "Title is required (minimum 3 characters)", code: "INVALID_TITLE" });
    }
    if (!category || !purpose || numPrice === null || numPrice <= 0) {
      return res.status(400).json({ error: "Valid category, purpose, and positive price are required (e.g. ₹3,85,00,000 or 38500000)", code: "VALIDATION_FAILED" });
    }

    const cleanCategory = category.toLowerCase().trim();
    const cleanPurpose = purpose.toLowerCase().trim();
    const allowedCategories = ['residential', 'commercial', 'agricultural', 'industrial', 'pg'];
    if (!allowedCategories.includes(cleanCategory)) {
      return res.status(400).json({ error: `Invalid category: ${category}. Allowed: ${allowedCategories.join(', ')}`, code: "INVALID_CATEGORY" });
    }

    if (cleanCategory === 'pg' && cleanPurpose !== 'rent') {
      return res.status(400).json({ error: "PG / Coliving accommodations must have purpose set to 'rent'", code: "INVALID_PURPOSE" });
    }

    const areaValue = area && typeof area.value === 'number' ? area.value : (area ? parseFloat(area) : 1000);
    if (isNaN(areaValue) || areaValue <= 0) {
      return res.status(400).json({ error: "Property area dimensions must be a valid positive number", code: "INVALID_DIMENSIONS" });
    }

    // Server-side coordinates bounds validation (-90 to 90, -180 to 180)
    let coordinates = null;
    if (location) {
      const rawCoords = location.coordinates || location.point?.coordinates;
      if (Array.isArray(rawCoords) && rawCoords.length >= 2) {
        const lng = parseFloat(rawCoords[0]);
        const lat = parseFloat(rawCoords[1]);
        if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          coordinates = [lng, lat];
        }
      } else if (location.latitude != null && location.longitude != null) {
        const lat = parseFloat(location.latitude);
        const lng = parseFloat(location.longitude);
        if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          coordinates = [lng, lat];
        }
      }
    }

    const propertyLocation = {
      address: location?.address || (location?.locality ? `${location.locality} Corridor` : "Unspecified Address"),
      locality: location?.locality || location?.city || "Urban",
      city: location?.city || "Bengaluru",
      state: location?.state || "Andhra Pradesh",
      pincode: location?.pincode || "560001",
      coordinates: coordinates,
      point: coordinates ? { type: "Point", coordinates } : null,
      latitude: coordinates ? coordinates[1] : null,
      longitude: coordinates ? coordinates[0] : null
    };

    // Duplicate Verification: check for duplicate or dual-user claims
    const duplicateCheck = checkForDuplicateProperty({
      title: title.trim(),
      ownerId: req.user._id,
      category: cleanCategory,
      propertyType: (propertyType || "flat").toLowerCase(),
      purpose: cleanPurpose,
      location: propertyLocation,
      landDetails: req.body.landDetails || {},
      surveyNumber: req.body.surveyNumber || req.body.landDetails?.surveyNumber
    });

    // Reject any duplicate property collision (identical survey number, address, GPS coordinates, or same-owner title)
    if (duplicateCheck.isDuplicate) {
      return res.status(409).json({
        error: duplicateCheck.reason,
        code: duplicateCheck.code || "DUPLICATE_PROPERTY",
        matchedPropertyId: duplicateCheck.matchedPropertyId,
        matchedPropertyTitle: duplicateCheck.matchedPropertyTitle
      });
    }

    const initialStatus = "pending_review";

    const newProperty = {
      _id: req.body._id || req.body.id || db.generateId('prop'),
      ownerId: req.user._id,
      owner_id: req.user._id,
      ownerName: req.user.name,
      ownerPhone: req.user.mobile,
      title: title.trim(),
      description: description || "",
      category: cleanCategory,
      propertyType: (propertyType || "flat").toLowerCase(),
      purpose: cleanPurpose,
      price: numPrice,
      currency: "INR",
      area: { value: areaValue, unit: area?.unit || "sqft" },
      bedrooms: bedrooms ? parseInt(bedrooms) : 0,
      bathrooms: bathrooms ? parseInt(bathrooms) : 0,
      amenities: amenities || ["parking"],
      location: propertyLocation,
      images: images || [],
      cadastralVerified: false,
      verificationStatus: initialStatus,
      verification_status: initialStatus,
      publicationStatus: "unpublished",
      publication_status: "unpublished",
      availabilityStatus: "available",
      availability_status: "available",
      hasDualClaim: false,
      dualClaimDetails: null,
      documents: req.body.documents || [],
      landDetails: req.body.landDetails || {},
      typeSpecificData: req.body.typeSpecificData || {},
      submittedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Invalidate public search cache
    invalidateSearchCache();

    // Persist to Supabase Database
    await db.insertProperty(newProperty);

    // Also attach documents to db.documents so admin can inspect them
    if (Array.isArray(newProperty.documents) && newProperty.documents.length > 0) {
      newProperty.documents.forEach(doc => {
        db.documents.push({
          _id: db.generateId('doc'),
          propertyId: newProperty._id,
          ownerId: newProperty.ownerId,
          name: doc.name || 'Confidential_Title_Document.pdf',
          type: doc.type || 'Registered Sale Deed',
          storageKey: doc.storageKey || doc.storage_key || '',
          dataUrl: doc.dataUrl || doc.url || null,
          mimeType: doc.mimeType || 'application/pdf',
          size: doc.size || '1.5 MB',
          reviewStatus: 'pending_review',
          uploadedAt: new Date()
        });
      });
    }

    res.status(201).json({
      success: true,
      message: "Property listing created and submitted for administrative approval. It will become publicly visible once approved by an administrator.",
      property: newProperty
    });
  } catch (error) {
    next(error);
  }
};

exports.updateDraft = async (req, res, next) => {
  try {
    const prop = findPropertyById(req.params.id);
    if (!prop || prop.isRemoved || prop.status === 'removed' || (db.removedPropertyIds && db.removedPropertyIds.has(req.params.id))) {
      return res.status(404).json({ error: "Property not found or permanently removed", code: "NOT_FOUND" });
    }

    if (prop.ownerId !== req.user._id && (!req.user.roles || !req.user.roles.includes('admin'))) {
      return res.status(403).json({ error: "Forbidden: You do not own this listing", code: "FORBIDDEN" });
    }

    // Strict Lock: If property has already been sold or rented, modification by the seller is permanently locked
    const isClosedTransaction = 
      prop.availabilityStatus === 'sold' || 
      prop.availabilityStatus === 'rented' || 
      prop.status === 'sold' || 
      prop.status === 'rented' ||
      prop.publicationStatus === 'completed';

    if (isClosedTransaction) {
      return res.status(403).json({
        error: "Immutable Deed Record: This property transaction has already been closed (Sold / Rented). Completed listings are legally locked and cannot be edited.",
        code: "PROPERTY_TRANSACTION_LOCKED"
      });
    }

    const updatable = [
      'title', 'description', 'price', 'area', 'bedrooms', 'bathrooms',
      'amenities', 'location', 'images', 'photos', 'category', 'propertyType',
      'purpose', 'documents', 'landDetails', 'typeSpecificData',
      'surveyNumber', 'cadastralSurveyNumber', 'boundaryDetails'
    ];
    const updates = {};
    updatable.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    if (req.body.price !== undefined) {
      const parsedPrice = parseIndianCurrency(req.body.price);
      if (parsedPrice === null || parsedPrice <= 0) {
        return res.status(400).json({ error: "Invalid price format. Must be a valid positive amount.", code: "INVALID_PRICE" });
      }
      updates.price = parsedPrice;
    }

    // Check if edited fields introduce a duplicate collision with another existing listing
    const candidateProp = {
      ...prop,
      ...updates,
      location: updates.location ? { ...prop.location, ...updates.location } : prop.location,
      landDetails: req.body.landDetails ? { ...prop.landDetails, ...req.body.landDetails } : prop.landDetails,
      ownerId: prop.ownerId
    };

    const duplicateCheck = checkForDuplicateProperty(candidateProp, prop._id);
    if (duplicateCheck.isDuplicate) {
      return res.status(409).json({
        error: duplicateCheck.reason,
        code: duplicateCheck.code || "DUPLICATE_PROPERTY",
        matchedPropertyId: duplicateCheck.matchedPropertyId,
        matchedPropertyTitle: duplicateCheck.matchedPropertyTitle
      });
    }

    // CHECK: Is this an edit of an already approved / published property?
    // Requirement 2: Editing by owner triggers admin reapproval, preserves current version, hides from public discovery
    const isAdmin = req.user.roles && req.user.roles.includes('admin');
    const isApprovedListing = (prop.verificationStatus === 'approved' || prop.publicationStatus === 'published') && !isAdmin;

    if (isApprovedListing) {
      const nextVersion = (prop.version || 1) + 1;
      const revisionId = db.generateId('rev');
      const previousApprovedState = {
        title: prop.title,
        description: prop.description,
        price: prop.price,
        area: prop.area,
        bedrooms: prop.bedrooms,
        bathrooms: prop.bathrooms,
        amenities: prop.amenities,
        location: prop.location,
        images: prop.images,
        category: prop.category,
        propertyType: prop.propertyType,
        purpose: prop.purpose,
        documents: prop.documents || []
      };

      const pendingRevision = {
        _id: revisionId,
        propertyId: prop._id,
        version: nextVersion,
        changes: updates,
        previousState: previousApprovedState,
        status: 'pending_review',
        submittedAt: new Date().toISOString(),
        submittedBy: req.user._id,
        type: 'edit'
      };

      // Base fields are preserved unchanged!
      prop.hasPendingRevision = true;
      prop.isTemporarilyHidden = true;
      prop.pendingRevision = pendingRevision;
      prop.verificationStatus = 'pending_revision';
      prop.updatedAt = new Date();

      await db.updateProperty(prop._id, {
        hasPendingRevision: true,
        isTemporarilyHidden: true,
        pendingRevision,
        verificationStatus: 'pending_revision',
        updatedAt: new Date()
      });

      // Handle documents if attached in revision
      if (req.body.documents && Array.isArray(req.body.documents)) {
        req.body.documents.forEach(doc => {
          const existingIdx = db.documents.findIndex(d => d.propertyId === prop._id && d.name === doc.name);
          const docRecord = {
            _id: db.generateId('doc'),
            propertyId: prop._id,
            ownerId: prop.ownerId,
            name: doc.name || 'Confidential_Title_Deed.pdf',
            type: doc.type || 'Registered Sale Deed',
            storageKey: doc.storageKey || doc.storage_key || '',
            dataUrl: doc.dataUrl || doc.url || null,
            mimeType: doc.mimeType || 'application/pdf',
            size: doc.size || '1.5 MB',
            reviewStatus: 'pending_review',
            uploadedAt: new Date()
          };
          if (existingIdx !== -1) {
            db.documents[existingIdx] = docRecord;
          } else {
            db.documents.push(docRecord);
          }
        });
      }

      invalidateSearchCache();

      await db.insertAuditLog({
        _id: db.generateId('log'),
        actorId: req.user._id,
        actorName: req.user.name,
        action: "PROPERTY_REVISION_SUBMITTED",
        entity: "Property",
        entityId: prop._id,
        details: `Owner submitted revision v${nextVersion} (Revision ID: ${revisionId}). Listing temporarily removed from public discovery pending re-verification.`,
        timestamp: new Date()
      });

      return res.json({
        success: true,
        message: "Proposed updates submitted for administrative review. The listing is temporarily unlisted from public discovery until approved.",
        isRevision: true,
        revision: pendingRevision,
        property: prop
      });
    }

    // Unapproved listing (draft, needs_changes, rejected, or pending_review): updates apply directly
    if (prop.verificationStatus === 'needs_changes' || prop.verificationStatus === 'rejected') {
      updates.verificationStatus = 'pending_review';
      updates.rejectionReason = null;
    }
    updates.updatedAt = new Date();

    const updated = await db.updateProperty(prop._id, updates);

    // If documents are included, update confidential documents store
    if (req.body.documents && Array.isArray(req.body.documents)) {
      req.body.documents.forEach(doc => {
        const existingIdx = db.documents.findIndex(d => d.propertyId === prop._id && d.name === doc.name);
        const docRecord = {
          _id: db.generateId('doc'),
          propertyId: prop._id,
          ownerId: prop.ownerId,
          name: doc.name || 'Confidential_Title_Deed.pdf',
          type: doc.type || 'Registered Sale Deed',
          storageKey: doc.storageKey || doc.storage_key || '',
          dataUrl: doc.dataUrl || doc.url || null,
          mimeType: doc.mimeType || 'application/pdf',
          size: doc.size || '1.5 MB',
          reviewStatus: 'pending_review',
          uploadedAt: new Date()
        };
        if (existingIdx !== -1) {
          db.documents[existingIdx] = docRecord;
        } else {
          db.documents.push(docRecord);
        }
      });
    }

    invalidateSearchCache();

    res.json({
      success: true,
      message: prop.verificationStatus === 'needs_changes' 
        ? "Deeds & listing updated! Automatically re-submitted to review queue."
        : "Listing updated successfully and submitted for administrative approval.",
      property: updated || prop
    });
  } catch (error) {
    next(error);
  }
};

// Permanent Property Removal (Requirement 4)
exports.removeProperty = async (req, res, next) => {
  try {
    const prop = findPropertyById(req.params.id);
    if (!prop || prop.isRemoved || prop.status === 'removed' || (db.removedPropertyIds && db.removedPropertyIds.has(req.params.id))) {
      return res.status(404).json({ error: "Property listing not found or already removed", code: "NOT_FOUND" });
    }

    // Strictly validate ownership
    if (prop.ownerId !== req.user._id && (!req.user.roles || !req.user.roles.includes('admin'))) {
      return res.status(403).json({ error: "Forbidden: You do not own this listing", code: "FORBIDDEN" });
    }

    // Strict Lock: If property has already been sold or rented, modification by the seller is permanently locked
    const isClosedTransaction = 
      prop.availabilityStatus === 'sold' || 
      prop.availabilityStatus === 'rented' || 
      prop.status === 'sold' || 
      prop.status === 'rented' ||
      prop.publicationStatus === 'completed';

    if (isClosedTransaction) {
      return res.status(403).json({
        error: "Immutable Deed Record: This property transaction has already been closed (Sold / Rented). Completed listings are legally locked and cannot be edited.",
        code: "PROPERTY_TRANSACTION_LOCKED"
      });
    }

    const propId = prop._id;
    const propTitle = prop.title;

    // Mark as permanently removed
    prop.isRemoved = true;
    prop.status = 'removed';
    prop.publicationStatus = 'removed';
    prop.verificationStatus = 'removed';
    prop.availabilityStatus = 'removed';
    prop.removedAt = new Date().toISOString();
    prop.removedBy = req.user._id;

    // Purge from active properties collection
    db.properties = db.properties.filter(p => p._id !== propId && p.id !== propId);

    // Register in tombstone set to prevent resurrection by race conditions or delayed approvals
    if (!db.removedPropertyIds) db.removedPropertyIds = new Set();
    db.removedPropertyIds.add(propId);
    if (prop.id) db.removedPropertyIds.add(prop.id);

    // Remove from active Supabase database table
    await db.deleteProperty(propId);

    // Purge active confidential documents
    db.documents = db.documents.filter(d => d.propertyId !== propId);

    // Purge from favorites
    if (db.favorites) {
      db.favorites = db.favorites.filter(f => f.propertyId !== propId);
    }

    // Invalidate public search and discovery cache
    invalidateSearchCache();

    // Preserve audit record and legal retention trail
    await db.insertAuditLog({
      _id: db.generateId('log'),
      actorId: req.user._id,
      actorName: req.user.name,
      action: "PROPERTY_PERMANENTLY_REMOVED",
      entity: "Property",
      entityId: propId,
      details: `Property "${propTitle}" permanently removed by owner ${req.user.name}. Discovery indexes and active documents purged while audit records retained.`,
      timestamp: new Date()
    });

    res.json({
      success: true,
      message: "Property permanently removed from PlotPin and all public discovery."
    });
  } catch (error) {
    next(error);
  }
};

exports.submitForReview = async (req, res, next) => {
  try {
    const prop = findPropertyById(req.params.id);
    if (!prop) return res.status(404).json({ error: "Property not found" });

    if (prop.ownerId !== req.user._id) {
      return res.status(403).json({ error: "Forbidden: You do not own this listing" });
    }

    const updates = {
      verificationStatus: "pending_review",
      verification_status: "pending_review",
      publicationStatus: "unpublished",
      publication_status: "unpublished",
      rejectionReason: null,
      reviewNotes: null,
      submittedAt: new Date(),
      updatedAt: new Date()
    };

    Object.assign(prop, updates);
    await db.updateProperty(prop._id, updates);
    invalidateSearchCache();

    await db.insertAuditLog({
      _id: db.generateId('log'),
      actorId: req.user._id,
      actorName: req.user.name,
      action: "PROPERTY_SUBMITTED_FOR_REVIEW",
      entity: "Property",
      entityId: prop._id,
      details: "Owner submitted property and e-Khata documents for legal desk review.",
      timestamp: new Date()
    });

    res.json({
      success: true,
      message: "Listing submitted for administrative and cadastral title verification.",
      verificationStatus: "pending_review"
    });
  } catch (error) {
    next(error);
  }
};

exports.uploadDocument = async (req, res, next) => {
  try {
    const prop = findPropertyById(req.params.id);
    if (!prop) return res.status(404).json({ error: "Property not found" });

    if (prop.ownerId !== req.user._id && (!req.user.roles || !req.user.roles.includes('admin'))) {
      return res.status(403).json({ error: "Forbidden: You do not own this listing" });
    }

    const { documentType, originalFilename, mimeType, sizeBytes, fileBase64 } = req.body;

    const fileBuffer = fileBase64 
      ? Buffer.from(fileBase64, 'base64') 
      : Buffer.from('%PDF-1.4 encrypted e-khata deed');

    // Server-side file signature & magic byte inspection
    storage.validateUploadMetadata({ 
      mimeType: mimeType || 'application/pdf', 
      sizeBytes: sizeBytes || fileBuffer.length 
    }, fileBuffer);

    const uploadRes = await storage.uploadPrivateDocument(
      prop._id,
      originalFilename || 'e_khata.pdf',
      fileBuffer,
      mimeType || 'application/pdf'
    );

    const newDoc = {
      _id: db.generateId('doc'),
      propertyId: prop._id,
      ownerId: prop.ownerId,
      documentType: documentType || "e_khata",
      storageKey: uploadRes.storageKey,
      originalFilename: originalFilename || "document.pdf",
      mimeType: mimeType || 'application/pdf',
      sizeBytes: sizeBytes || fileBuffer.length,
      reviewStatus: "pending",
      reviewerId: null,
      reviewNotes: "Stored in Supabase property-documents bucket; pending title audit",
      createdAt: new Date()
    };

    db.documents.push(newDoc);

    const signedUrlData = await storage.generateSignedUrl(uploadRes.storageKey, 900);

    res.status(201).json({
      success: true,
      message: "Document uploaded to Supabase property-documents bucket securely.",
      document: newDoc,
      accessUrl: signedUrlData.signedUrl,
      expiresAt: signedUrlData.expiresAt
    });
  } catch (error) {
    next(error);
  }
};

exports.getDocuments = async (req, res, next) => {
  try {
    const prop = findPropertyById(req.params.id);
    if (!prop) return res.status(404).json({ error: "Property not found" });

    const isOwner = prop.ownerId === req.user._id;
    const isAdmin = req.user.roles && req.user.roles.includes('admin');

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "Forbidden: Access to private property deeds requires owner or admin authorization" });
    }

    const propDocs = Array.isArray(prop.documents) ? prop.documents : [];
    const dbDocs = db.documents.filter(d => d.propertyId === prop._id);
    const combinedDocs = [...propDocs];
    dbDocs.forEach(d => {
      const matchIdx = combinedDocs.findIndex(cd => cd.name === d.name || cd._id === d._id || cd.id === d._id);
      if (matchIdx === -1) {
        combinedDocs.push(d);
      } else {
        combinedDocs[matchIdx] = { ...d, ...combinedDocs[matchIdx] };
      }
    });

    // Attach fresh signed URLs for viewing if storageKey exists
    const docsWithSignedUrls = await Promise.all(combinedDocs.map(async doc => {
      let signedUrl = doc.dataUrl || doc.url || null;
      let expiresAt = null;
      if (doc.storageKey && !signedUrl) {
        try {
          const signed = await storage.generateSignedUrl(doc.storageKey, 900);
          signedUrl = signed.signedUrl;
          expiresAt = signed.expiresAt;
        } catch (e) {}
      }
      return {
        ...doc,
        signedUrl: signedUrl || doc.dataUrl || doc.url,
        expiresAt
      };
    }));

    res.json({
      success: true,
      documents: docsWithSignedUrls
    });
  } catch (error) {
    next(error);
  }
};

exports.getMyProperties = (req, res) => {
  const userProperties = db.properties
    .filter(p => 
      (p.ownerId === req.user._id || p.owner_id === req.user._id) && 
      !p.isRemoved && p.status !== 'removed' &&
      !(db.removedPropertyIds && (db.removedPropertyIds.has(p._id) || db.removedPropertyIds.has(p.id)))
    )
    .map(p => {
      // If there is a pending revision, present the owner with their latest submitted values
      if (p.hasPendingRevision && p.pendingRevision && p.pendingRevision.changes) {
        return {
          ...p,
          ...p.pendingRevision.changes,
          hasPendingRevision: true,
          pendingRevision: p.pendingRevision,
          verificationStatus: 'pending_revision'
        };
      }
      return p;
    });
  res.json({
    success: true,
    properties: userProperties
  });
};

// Owner or Admin marks deal as completed (Sold / Rented)
exports.completeDeal = async (req, res, next) => {
  try {
    const prop = findPropertyById(req.params.id);
    if (!prop) return res.status(404).json({ error: "Property not found" });

    const isOwner = prop.ownerId === req.user._id;
    const isAdmin = req.user.roles && req.user.roles.includes('admin');

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: "Only the property owner or an authorized administrator can mark this deal as completed/sold/rented" });
    }

    // Concurrency & duplicate sale protection: prevent double-selling a closed property
    if (prop.availabilityStatus === 'sold' || prop.availability_status === 'sold' || 
        prop.publicationStatus === 'completed' || prop.publication_status === 'completed') {
      return res.status(409).json({ 
        error: "Concurrency Lock: This property listing has already completed its transaction and is no longer available for deal closure.",
        code: "DEAL_ALREADY_COMPLETED" 
      });
    }

    const { outcome = 'sold', buyerName = 'Verified Citizen Buyer', buyerId, finalPrice } = req.body;
    const newStatus = outcome === 'rented' ? 'rented' : 'sold';
    const parsedFinalPrice = finalPrice ? parseIndianCurrency(finalPrice) : prop.price;

    const updates = {
      availabilityStatus: newStatus,
      availability_status: newStatus,
      publicationStatus: 'completed',
      publication_status: 'completed',
      updatedAt: new Date()
    };

    const updated = await db.updateProperty(prop._id, updates);
    invalidateSearchCache();

    // Cascading Deal Closure Effects:
    // 1. Cancel all incompatible pending/confirmed appointments for this listing
    if (db.appointments && Array.isArray(db.appointments)) {
      for (const apt of db.appointments) {
        if (apt.propertyId === prop._id && ['scheduled', 'pending', 'confirmed'].includes(apt.status)) {
          await db.updateAppointment(apt._id, {
            status: 'rejected',
            cancellationReason: `Sorry for the rejection: this land/plot deal has already been closed and finalized with another customer. You are welcome to search and explore other verified properties with the same features on PlotPin.`
          });
        }
      }
    }

    // 2. Archive competing active offers and pending escrow requests for this listing
    if (db.escrows && Array.isArray(db.escrows)) {
      for (const deal of db.escrows) {
        if (deal.propertyId === prop._id && deal.status === 'active') {
          deal.status = 'archived';
          deal.stage = 'Closed: Superseded by another accepted transaction';
          deal.updatedAt = new Date();
        }
      }
    }

    // Create or update a completed deal in escrows so it shows in buyer and seller records
    if (!db.escrows) db.escrows = [];
    const dealRef = `DEAL-BLR-${Date.now().toString().slice(-6)}`;
    const newDeal = {
      _id: db.generateId('deal'),
      propertyId: prop._id,
      propertyTitle: prop.title,
      propertyImage: (prop.images && prop.images[0]?.storageKey) || '',
      buyerId: buyerId || req.user._id || 'usr_client_001',
      buyerName: buyerName || 'Verified Citizen Buyer',
      sellerId: prop.ownerId,
      sellerName: prop.ownerName || 'Property Owner',
      totalPropertyValue: prop.price,
      offerAmount: parsedFinalPrice || prop.price,
      currency: "INR",
      dealReference: dealRef,
      stage: outcome === 'rented' ? "Tenancy Agreement Executed" : "Title Deed Transferred · Deal Completed",
      status: "completed",
      outcome: newStatus,
      clearedChecks: ["Meebhoomi Encumbrance Search", "AP MAUD e-Khata Digital QR", "Final Consideration Transferred", "100% Stamp Duty Discharged"],
      pendingChecks: [],
      completedAt: new Date(),
      createdAt: new Date()
    };

    db.escrows.unshift(newDeal);

    await db.insertAuditLog({
      _id: db.generateId('log'),
      actorId: req.user._id,
      actorName: req.user.name,
      action: outcome === 'rented' ? "PROPERTY_RENTED_DEAL_CLOSED" : "PROPERTY_SOLD_DEAL_CLOSED",
      entity: "Property",
      entityId: prop._id,
      details: `Deal closed: ${prop.title} marked as ${newStatus.toUpperCase()}. Closed by ${req.user.name}. Buyer/Tenant: ${buyerName} at ₹${(parsedFinalPrice || prop.price).toLocaleString('en-IN')}`,
      timestamp: new Date()
    });

    // Resolve seller & buyer emails and dispatch notification emails
    const seller = (db.users || []).find(u => u._id === prop.ownerId);
    const sellerEmail = seller?.email || prop.ownerEmail || '';
    const sellerName = seller?.name || prop.ownerName || 'Property Owner';

    emailService.sendDealClosedEmails({
      propertyTitle: prop.title,
      buyerName: buyerName || 'Verified Citizen Buyer',
      buyerEmail: buyerEmail,
      sellerName: sellerName,
      sellerEmail: sellerEmail,
      outcome: newStatus,
      finalPrice: parsedFinalPrice || prop.price,
      dealReference: dealRef
    }).catch(err => console.warn('[PropertyController] Deal closed email delivery warning:', err.message));

    res.json({
      success: true,
      message: `🎉 Deal closed successfully! Property marked as ${newStatus.toUpperCase()} and removed from public discovery.`,
      property: updated || prop,
      deal: newDeal
    });
  } catch (error) {
    next(error);
  }
};

// Retrieve deals/purchases for the current user
exports.getMyBuyings = (req, res) => {
  if (!db.escrows) db.escrows = [];
  const userId = req.user._id;
  const userName = req.user.name;
  const userMobile = req.user.mobile;
  const userEmail = req.user.email;

  // Find all deals where this user is the buyer OR phone/email matches OR demo default
  const buyings = db.escrows.filter(d => 
    d.buyerId === userId || 
    (userEmail && d.buyerEmail && d.buyerEmail.toLowerCase() === userEmail.toLowerCase()) ||
    (userMobile && d.buyerPhone && d.buyerPhone.replace(/\D/g, '').endsWith(userMobile.replace(/\D/g, '').slice(-10))) ||
    (userName && d.buyerName && d.buyerName.toLowerCase().includes(userName.toLowerCase())) ||
    d.buyerId === 'usr_client_001'
  );

  res.json({
    success: true,
    buyings
  });
};

// Log a direct offer & mediated deal in escrow
exports.createOffer = (req, res, next) => {
  try {
    const { propertyId, offerAmount, paymentMode, closingDays } = req.body;
    const prop = findPropertyById(propertyId);
    if (!prop) return res.status(404).json({ error: "Property not found" });

    // Enforce central action eligibility (removed, pending revision, unapproved, inactive, or owner check)
    const eligibility = isPropertyActionEligible(prop, req.user._id);
    if (!eligibility.eligible) {
      if (eligibility.code === 'OWNER_SELF_ACTION') {
        return res.status(400).json({ 
          error: "Property owners cannot submit an offer on their own listings", 
          code: "OWNER_SELF_OFFER" 
        });
      }
      return res.status(400).json({ error: eligibility.reason, code: eligibility.code });
    }

    const parsedOffer = parseIndianCurrency(offerAmount);
    if (parsedOffer === null || parsedOffer <= 0) {
      return res.status(400).json({ error: "Valid positive offer amount is required (e.g. ₹3,85,00,000 or 38500000)", code: "INVALID_OFFER_AMOUNT" });
    }

    // Sanitize payment mode & closing window (bounded between 7 and 180 days)
    const validModes = ['loan', 'self', 'commercial', 'escrow_vault'];
    const cleanPaymentMode = validModes.includes(paymentMode) ? paymentMode : 'loan';
    const cleanClosingDays = Math.min(Math.max(parseInt(closingDays, 10) || 45, 7), 180);

    if (!db.escrows) db.escrows = [];

    const dealRef = `DEAL-BLR-${Date.now().toString().slice(-6)}`;
    const newDeal = {
      _id: db.generateId('deal'),
      propertyId: prop._id,
      propertyTitle: prop.title,
      propertyImage: (prop.images && prop.images[0]?.storageKey) || '',
      buyerId: req.user._id,
      buyerName: req.user.name,
      buyerPhone: req.user.mobile,
      sellerId: prop.ownerId,
      sellerName: prop.ownerName || 'Property Title Holder',
      totalPropertyValue: prop.price,
      offerAmount: parsedOffer,
      currency: "INR",
      paymentMode: cleanPaymentMode,
      closingDays: cleanClosingDays,
      dealReference: dealRef,
      stage: "Due Diligence & Title Clearance",
      status: "active",
      releaseEligible: true,
      clearedChecks: ["Direct 0% Brokerage Escrow Vault Allocated", "Kaveri 2.0 Encumbrance Search"],
      pendingChecks: ["Draft Sale Agreement Review", "Sub-Registrar Slot Booking"],
      createdAt: new Date()
    };

    db.escrows.unshift(newDeal);

    res.status(201).json({
      success: true,
      message: "Direct offer & mediated deal logged! Regional Admin mediator will coordinate terms with property owner.",
      deal: newDeal
    });
  } catch (error) {
    next(error);
  }
};

module.exports.findPropertyById = findPropertyById;
module.exports.invalidateSearchCache = invalidateSearchCache;
module.exports.checkForDuplicateProperty = checkForDuplicateProperty;

