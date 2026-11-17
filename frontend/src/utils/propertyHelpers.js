// Haversine distance calculator in KM
export function calcDistanceKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

// Robust extractor for property coordinates across GeoJSON, array, or object formats
export function getPropertyLatLng(prop) {
  if (!prop || !prop.location) return null;
  const loc = prop.location;
  if (Array.isArray(loc.point?.coordinates) && loc.point.coordinates.length >= 2) {
    return { lat: Number(loc.point.coordinates[1]), lng: Number(loc.point.coordinates[0]) };
  }
  if (Array.isArray(loc.coordinates) && loc.coordinates.length >= 2) {
    return { lat: Number(loc.coordinates[1]), lng: Number(loc.coordinates[0]) };
  }
  if (typeof loc.latitude === 'number' && typeof loc.longitude === 'number') {
    return { lat: loc.latitude, lng: loc.longitude };
  }
  if (typeof loc.lat === 'number' && typeof loc.lng === 'number') {
    return { lat: loc.lat, lng: loc.lng };
  }
  return null;
}

// Robust image URL extractor supporting string URLs, objects with storageKey, url, publicUrl, dataUrl
export function getFirstPropertyImageUrl(prop) {
  if (!prop) return '';
  const list = prop.images || prop.photos;
  if (!Array.isArray(list) || list.length === 0) return '';
  const first = list[0];
  if (typeof first === 'string') return first;
  return first?.storageKey || first?.url || first?.publicUrl || first?.dataUrl || first?.src || '';
}

// Property Category Classifier for Same-Type Equality Comparison Logic
export function getPropertyTypeCategory(prop) {
  if (!prop) return { id: 'other', label: 'Other Properties', badge: 'Property' };
  const pt = (prop.propertyType || '').toLowerCase();
  const cat = (prop.category || '').toLowerCase();

  if (pt === 'flat' || pt === 'apartment' || cat === 'flat' || cat === 'apartment') {
    return { id: 'flat', label: 'Flats & Apartments', badge: 'Flat / Apt' };
  }
  if (pt === 'house' || pt === 'villa' || cat === 'house' || cat === 'villa') {
    return { id: 'house', label: 'Houses & Villas', badge: 'House / Villa' };
  }
  if (pt === 'plot' || cat === 'land' || cat === 'plot') {
    return { id: 'plot', label: 'Plots & Land', badge: 'Plot / Land' };
  }
  if (pt === 'pg' || pt === 'hostel' || cat === 'pg' || cat === 'hostel') {
    return { id: 'pg', label: 'PG & Hostels', badge: 'PG / Hostel' };
  }
  if (pt === 'shop' || cat === 'commercial' || pt === 'commercial' || pt === 'office') {
    return { id: 'commercial', label: 'Commercial & Shops', badge: 'Commercial' };
  }
  if (pt === 'farmland' || cat === 'agricultural') {
    return { id: 'agricultural', label: 'Farmland & Agricultural', badge: 'Farmland' };
  }
  return { id: pt || cat || 'other', label: (pt || cat || 'Residential').toUpperCase(), badge: 'Property' };
}

// Price formatter for Indian Rupee
export function formatINR(amount) {
  if (amount == null || isNaN(amount)) return '₹0';
  const num = Number(amount);
  if (num >= 10000000) {
    return `₹${(num / 10000000).toFixed(2)} Cr`;
  }
  if (num >= 100000) {
    return `₹${(num / 100000).toFixed(2)} Lakh`;
  }
  return `₹${num.toLocaleString('en-IN')}`;
}

/**
 * Computes whether an administrator can access the "Call" action for a call request.
 * Rule: Admin CANNOT call before (scheduled start time - 10 minutes).
 * Admin can access "Call" starting 10 minutes prior to the scheduled window, during, and after.
 */
export function getCallUnlockStatus(timeString, createdAt = null) {
  if (!timeString && !createdAt) {
    return { isLocked: false, unlockTime: null, startTime: null, formattedUnlock: '', formattedTime: '' };
  }

  const str = String(timeString || '').trim();
  const now = Date.now();

  // If timeString is an ISO timestamp (e.g. 2026-11-04T10:00:00.000Z)
  if (str.includes('T') && !isNaN(Date.parse(str))) {
    const startTime = new Date(str).getTime();
    const unlockTime = startTime - (10 * 60 * 1000); // 10 minutes prior
    const isLocked = now < unlockTime;
    const formattedTime = new Date(startTime).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
    const formattedUnlock = new Date(unlockTime).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
    return {
      isLocked,
      unlockTime: new Date(unlockTime),
      startTime: new Date(startTime),
      formattedUnlock,
      formattedTime
    };
  }

  // Parse day offset and hour/minute
  const baseDate = createdAt ? new Date(createdAt) : new Date();
  const targetDate = new Date(baseDate);

  const lower = str.toLowerCase();
  if (lower.includes('day after tomorrow')) {
    targetDate.setDate(targetDate.getDate() + 2);
  } else if (lower.includes('tomorrow')) {
    targetDate.setDate(targetDate.getDate() + 1);
  } else if (lower.includes('today')) {
    // keep today's date
  }

  // Search for starting time: e.g. "10:00 AM", "07:00 PM", "2:30 PM", "10:00"
  // Handles standard hyphens as well as unicode en-dashes
  const timeMatch = str.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    const meridiem = (timeMatch[3] || '').toUpperCase();

    if (meridiem === 'PM' && hours < 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;

    targetDate.setHours(hours, minutes, 0, 0);

    // If no explicit day keyword was present and the target time is before request creation,
    // the slot was requested for the upcoming occurrence (tomorrow)
    if (!lower.includes('today') && !lower.includes('tomorrow') && targetDate.getTime() < baseDate.getTime()) {
      targetDate.setDate(targetDate.getDate() + 1);
    }

    const startTime = targetDate.getTime();
    const unlockTime = startTime - (10 * 60 * 1000); // 10 minutes prior to scheduled start
    const isLocked = now < unlockTime;

    const formattedTime = targetDate.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
    const formattedUnlock = new Date(unlockTime).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });

    return {
      isLocked,
      unlockTime: new Date(unlockTime),
      startTime: new Date(startTime),
      formattedUnlock,
      formattedTime
    };
  }

  return { isLocked: false, unlockTime: null, startTime: null, formattedUnlock: '', formattedTime: '' };
}

/**
 * Computes whether an administrator can access actions for a site visit booking.
 * Rule: Admin CANNOT call or complete a visit before (scheduled visit startAt - 10 minutes).
 */
export function getBookingUnlockStatus(startAt) {
  if (!startAt) {
    return { isLocked: false, unlockTime: null, startTime: null, formattedUnlock: '', formattedTime: '' };
  }
  const startTime = new Date(startAt).getTime();
  if (isNaN(startTime)) {
    return { isLocked: false, unlockTime: null, startTime: null, formattedUnlock: '', formattedTime: '' };
  }

  const unlockTime = startTime - (10 * 60 * 1000); // 10 minutes prior
  const isLocked = Date.now() < unlockTime;

  const formattedTime = new Date(startTime).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
  const formattedUnlock = new Date(unlockTime).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });

  return {
    isLocked,
    unlockTime: new Date(unlockTime),
    startTime: new Date(startTime),
    formattedUnlock,
    formattedTime
  };
}

