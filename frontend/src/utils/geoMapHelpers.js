/**
 * PlotPin Geospatial & Map Helper Functions
 */

/**
 * Robust Geospatial Coordinates Extractor
 * Extracts valid latitude and longitude regardless of GeoJSON or flattened formats.
 * Handles:
 * 1. GeoJSON Point: point.coordinates = [lng, lat]
 * 2. GeoJSON Array: coordinates = [lng, lat]
 * 3. Flat properties: location.latitude, location.longitude, or location.lat, location.lng
 * 4. Coordinate order validation & sanity checks for India (-90 to 90 lat, -180 to 180 lng)
 */
export function getCoords(prop) {
  if (!prop || !prop.location) return null;
  const loc = prop.location;

  // 1. Check GeoJSON point format [lng, lat]
  if (Array.isArray(loc.point?.coordinates) && loc.point.coordinates.length >= 2) {
    const c0 = Number(loc.point.coordinates[0]);
    const c1 = Number(loc.point.coordinates[1]);
    if (!isNaN(c0) && !isNaN(c1)) {
      if (c0 > 50 && c1 < 40) return { lat: c1, lng: c0 }; // India longitude > 60, latitude < 40
      if (c0 < 40 && c1 > 50) return { lat: c0, lng: c1 };
      return { lat: c1, lng: c0 }; // GeoJSON standard is [lon, lat]
    }
  }

  // 2. Check coordinates array [lng, lat] or [lat, lng]
  if (Array.isArray(loc.coordinates) && loc.coordinates.length >= 2) {
    const c0 = Number(loc.coordinates[0]);
    const c1 = Number(loc.coordinates[1]);
    if (!isNaN(c0) && !isNaN(c1)) {
      if (c0 > 50 && c1 < 40) return { lat: c1, lng: c0 };
      if (c0 < 40 && c1 > 50) return { lat: c0, lng: c1 };
      return { lat: c1, lng: c0 };
    }
  }

  // 3. Check explicit latitude and longitude properties
  const latVal = loc.latitude != null ? loc.latitude : (loc.lat != null ? loc.lat : null);
  const lngVal = loc.longitude != null ? loc.longitude : (loc.lng != null ? loc.lng : null);
  if (latVal != null && lngVal != null) {
    const lat = Number(latVal);
    const lng = Number(lngVal);
    if (!isNaN(lat) && !isNaN(lng)) {
      // Auto-correct reversed coordinates
      if (lat > 50 && lng < 40) return { lat: lng, lng: lat };
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { lat, lng };
      }
    }
  }

  // 4. Check flattened coordinates directly on prop
  const propLat = prop.latitude != null ? prop.latitude : (prop.lat != null ? prop.lat : null);
  const propLng = prop.longitude != null ? prop.longitude : (prop.lng != null ? prop.lng : null);
  if (propLat != null && propLng != null) {
    const lat = Number(propLat);
    const lng = Number(propLng);
    if (!isNaN(lat) && !isNaN(lng)) {
      if (lat > 50 && lng < 40) return { lat: lng, lng: lat };
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return { lat, lng };
      }
    }
  }

  return null;
}

/**
 * Format price compactly for map pin pills matching visual screenshot
 */
export function formatPinPrice(prop) {
  if (!prop) return '₹0';
  const price = Number(prop.price) || 0;
  const isRent = prop.purpose === 'rent' || prop.category === 'pg';

  let formatted = '';
  if (price >= 10000000) {
    const cr = price / 10000000;
    formatted = `₹${cr % 1 === 0 ? cr.toFixed(0) : cr.toFixed(2)} Cr`;
  } else if (price >= 100000) {
    const l = price / 100000;
    formatted = `₹${l % 1 === 0 ? l.toFixed(0) : l.toFixed(1)} L`;
  } else if (price >= 1000) {
    formatted = `₹${Math.round(price / 1000)}k`;
  } else {
    formatted = `₹${price.toLocaleString('en-IN')}`;
  }

  return isRent ? `${formatted}/mo` : formatted;
}

/**
 * Format full authoritative price for property preview card
 */
export function formatPreviewPrice(prop) {
  if (!prop) return '₹0';
  const price = Number(prop.price) || 0;
  const isRent = prop.purpose === 'rent' || prop.category === 'pg';

  if (isRent) {
    if (prop.category === 'pg') {
      return `₹${price.toLocaleString('en-IN')} / bed / month`;
    }
    return `₹${price.toLocaleString('en-IN')} / month`;
  }

  if (price >= 10000000) {
    const cr = price / 10000000;
    return `₹${cr % 1 === 0 ? cr.toFixed(0) : cr.toFixed(2)} Cr`;
  }
  if (price >= 100000) {
    const l = price / 100000;
    return `₹${l % 1 === 0 ? l.toFixed(0) : l.toFixed(1)} Lakh`;
  }
  return `₹${price.toLocaleString('en-IN')}`;
}
