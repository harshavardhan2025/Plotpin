/**
 * API Client for Property Marketplace Express Backend
 */
const rawApiUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL)
  ? String(import.meta.env.VITE_API_URL).trim().replace(/\/+$/, '')
  : '';

let normalizedApiUrl = rawApiUrl;

// If VITE_API_URL was set to an internal Render container name (e.g. 'plotpin-backend:10000' or 'plotpin-backend')
if (normalizedApiUrl.includes('plotpin-backend') && !normalizedApiUrl.includes('.onrender.com')) {
  normalizedApiUrl = 'https://plotpin-backend.onrender.com';
} else if (normalizedApiUrl && !normalizedApiUrl.startsWith('http://') && !normalizedApiUrl.startsWith('https://') && !normalizedApiUrl.startsWith('/')) {
  normalizedApiUrl = `https://${normalizedApiUrl}`;
}

// Ensure BASE_URL ends with /api/v1 without duplicating if VITE_API_URL already contains /api/v1
export const BASE_URL = normalizedApiUrl
  ? (normalizedApiUrl.endsWith('/api/v1') ? normalizedApiUrl : `${normalizedApiUrl}/api/v1`)
  : '/api/v1';

let currentRole = 'user';
const activeTokens = {};

export const setApiRole = async (role) => {
  currentRole = role;
  if (role === 'admin') {
    const storedAdminToken = typeof localStorage !== 'undefined' ? localStorage.getItem('admin_auth_token') : null;
    if (storedAdminToken) {
      activeTokens['admin'] = storedAdminToken;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('auth_token', storedAdminToken);
        localStorage.setItem('auth_role', 'admin');
      }
    } else {
      delete activeTokens['admin'];
    }
  } else {
    // If user already logged in with their own mobile account, preserve their token
    const storedUserToken = typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') : null;
    const storedRole = typeof localStorage !== 'undefined' ? localStorage.getItem('auth_role') : null;
    if (storedUserToken && storedRole === 'user') {
      activeTokens['user'] = storedUserToken;
    } else {
      delete activeTokens['user'];
    }
  }
};

async function getOrFetchToken(path = '') {
  if (typeof localStorage !== 'undefined') {
    const adminToken = localStorage.getItem('admin_auth_token');
    const authToken = localStorage.getItem('auth_token');
    const storedRole = localStorage.getItem('auth_role');

    if (path.startsWith('/admin') || currentRole === 'admin' || storedRole === 'admin') {
      return adminToken || authToken;
    }
    return authToken || adminToken;
  }
  return null;
}

async function fetchJson(endpoint, options = {}) {
  // Normalize endpoint to prevent double /api/v1 prefixes regardless of caller format
  let cleanEndpoint = endpoint;
  while (cleanEndpoint.startsWith('/api/v1')) {
    cleanEndpoint = cleanEndpoint.slice(7);
  }
  while (cleanEndpoint.startsWith('api/v1')) {
    cleanEndpoint = cleanEndpoint.slice(6);
  }
  const path = cleanEndpoint.startsWith('/') ? cleanEndpoint : `/${cleanEndpoint}`;

  // Clean URL construction avoiding double /api/v1
  let requestUrl = `${BASE_URL}${path}`;
  requestUrl = requestUrl.replace(/\/api\/v1\/api\/v1\/?/g, '/api/v1/');

  const isPublicGet = (path.startsWith('/properties') && !path.includes('/my') && !path.includes('/submit')) && (!options.method || options.method === 'GET');
  let token = null;
  if (!isPublicGet) {
    token = await getOrFetchToken(path);
  } else {
    token = typeof localStorage !== 'undefined' ? (localStorage.getItem('auth_token') || localStorage.getItem('admin_auth_token')) : null;
  }

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  let response;
  try {
    response = await fetch(requestUrl, {
      ...options,
      headers
    });
  } catch (netErr) {
    if (!options._retried) {
      await new Promise(r => setTimeout(r, 2000));
      return fetchJson(endpoint, { ...options, _retried: true });
    }
    throw new Error(`Unable to reach backend API (${requestUrl}). If using Render free tier, the server may be waking up from sleep. Please wait 15 seconds and try again.`);
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const err = new Error(data.error || `HTTP ${response.status}: Request failed`);
    err.code = data.code;
    err.status = response.status;
    err.email = data.email;
    err.alreadyExists = data.alreadyExists;
    throw err;
  }

  return data;
}

export const api = {
  setRole: async (role) => {
    await setApiRole(role);
  },
  // Public Properties
  searchProperties: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return fetchJson(`/properties?${query}`);
  },

  getNearbyProperties: (lat, lng, radius = 50) => {
    return fetchJson(`/properties/nearby?lat=${lat}&lng=${lng}&radius=${radius}`);
  },

  searchLocationProxy: (query) => {
    return fetchJson(`/location/search?q=${encodeURIComponent(query)}`);
  },

  reverseGeocodeProxy: (lat, lng) => {
    return fetchJson(`/location/reverse?lat=${lat}&lng=${lng}`);
  },
  
  getPropertyById: (id) => fetchJson(`/properties/${id}`),

  // User / Seller Listings (Unified Account)
  createDraftProperty: (data) => fetchJson('/properties', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  updateProperty: (id, data) => fetchJson(`/properties/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  }),

  removeProperty: (id) => fetchJson(`/properties/${id}`, {
    method: 'DELETE'
  }),

  submitForReview: (id) => fetchJson(`/properties/${id}/submit`, {
    method: 'POST'
  }),

  getMyProperties: () => fetchJson('/properties/my'),

  // Private Document Verification
  uploadDocument: (propId, docMeta) => fetchJson(`/properties/${propId}/documents`, {
    method: 'POST',
    body: JSON.stringify(docMeta)
  }),

  getDocuments: (propId) => fetchJson(`/properties/${propId}/documents`),

  // Admin Verification & Moderation
  getAdminOverview: () => fetchJson('/admin/overview'),
  getAdminUsers: () => fetchJson('/admin/users'),
  getReviewQueue: () => fetchJson('/admin/properties'),
  getApprovedProperties: () => fetchJson('/admin/properties/approved'),
  approveProperty: (id, data = {}) => fetchJson(`/admin/properties/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  requestChanges: (id, notes) => fetchJson(`/admin/properties/${id}/request-changes`, {
    method: 'POST',
    body: JSON.stringify({ notes })
  }),
  rejectProperty: (id, reason, data = {}) => fetchJson(`/admin/properties/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason, ...data })
  }),
  publishProperty: (id) => fetchJson(`/admin/properties/${id}/publish`, { method: 'POST' }),
  suspendProperty: (id, reason) => fetchJson(`/admin/properties/${id}/suspend`, {
    method: 'POST',
    body: JSON.stringify({ reason })
  }),
  updatePropertyStatus: (id, status, notes = '', metadata = {}) => fetchJson(`/admin/properties/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, notes, ...metadata })
  }),
  getAuditLogs: () => fetchJson('/admin/audit-logs'),

  // Admin: Sales & Escrow Management (Mediated Deals)
  getAdminEscrows: () => fetchJson('/admin/escrows'),
  releaseAdminEscrow: (id) => fetchJson(`/admin/escrows/${id}/release`, { method: 'POST' }),
  freezeAdminEscrow: (id, reason) => fetchJson(`/admin/escrows/${id}/freeze`, {
    method: 'POST',
    body: JSON.stringify({ reason })
  }),
  // Deal Completion (Owner & Admin)
  completeDeal: (id, data) => fetchJson(`/properties/${id}/complete-deal`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  // Buyer Deals & Direct Offers
  getMyBuyings: () => fetchJson('/properties/my/buyings'),
  createOffer: (data) => fetchJson('/properties/offers', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  // User Support Desk & Dispute Tickets
  getUserSupportTickets: () => fetchJson('/support/tickets'),
  createSupportTicket: (data) => fetchJson('/support/tickets', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  // Admin: Support Helpdesk
  getAdminSupport: () => fetchJson('/admin/support'),
  replyAdminSupport: (id, replyText, newStatus) => fetchJson(`/admin/support/${id}/reply`, {
    method: 'POST',
    body: JSON.stringify({ replyText, newStatus })
  }),

  createAppointment: (data) => fetchJson('/appointments', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  rescheduleAppointment: (id, data) => fetchJson(`/appointments/${id}/reschedule`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  getSlotAvailability: (propertyId, date) => fetchJson(`/appointments/availability?propertyId=${encodeURIComponent(propertyId)}&date=${encodeURIComponent(date)}`),
  getAppointments: () => fetchJson('/appointments'),
  cancelAppointment: (id) => fetchJson(`/appointments/${id}/cancel`, { method: 'POST' }),
  updateAppointmentStatus: (id, status, note) => fetchJson(`/appointments/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, note })
  }),
  createInquiry: (data) => fetchJson('/appointments/inquiries', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  getInquiries: () => fetchJson('/appointments/inquiries'),
  createCallRequest: (data) => fetchJson('/appointments/calls', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  getCallRequests: () => fetchJson('/appointments/calls'),
  updateCallRequestStatus: (id, status, note) => fetchJson(`/appointments/calls/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, note })
  }),

  // Favorites
  toggleFavorite: (propertyId) => fetchJson('/appointments/favorites', {
    method: 'POST',
    body: JSON.stringify({ propertyId })
  }),
  getFavorites: () => fetchJson('/appointments/favorites'),

  // AI Recommendations (Python FastAPI & Authoritative Backend Hybrid)
  getRecommendations: (payload) => fetchJson('/properties/recommendations', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  getAiRecommendations: (payload) => fetchJson('/properties/recommendations', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),

  // Support
  createSupportTicket: (data) => fetchJson('/support/tickets', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  getSupportTickets: () => fetchJson('/support/tickets'),

  // Auth / Profile
  getMe: () => fetchJson('/auth/me'),
  checkMobile: (mobile, currentEmail) => fetchJson('/auth/check-mobile', {
    method: 'POST',
    body: JSON.stringify({ mobile, currentEmail })
  }),
  updateProfile: (data) => fetchJson('/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(data)
  }),
  login: async (credentials) => {
    const res = await fetchJson('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
    if (res.token) {
      const userRole = (res.user && res.user.roles && res.user.roles.includes('admin')) ? 'admin' : 'user';
      activeTokens[userRole] = res.token;
      activeTokens['user'] = res.token;
      if (userRole === 'admin') {
        activeTokens['admin'] = res.token;
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('auth_token', res.token);
        localStorage.setItem('auth_role', userRole);
        localStorage.setItem('auth_user', JSON.stringify(res.user));
        if (userRole === 'admin') {
          localStorage.setItem('admin_auth_token', res.token);
        }
      }
    }
    return res;
  },
  register: async (userData) => {
    const res = await fetchJson('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
    if (res.token) {
      activeTokens['user'] = res.token;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('auth_token', res.token);
        localStorage.setItem('auth_role', 'user');
        localStorage.setItem('auth_user', JSON.stringify(res.user));
      }
    }
    return res;
  },
  forgotPassword: (email) => fetchJson('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email })
  }),
  resetPassword: async (data) => {
    const res = await fetchJson('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    if (res.token) {
      activeTokens['user'] = res.token;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('auth_token', res.token);
        localStorage.setItem('auth_role', 'user');
        localStorage.setItem('auth_user', JSON.stringify(res.user));
      }
    }
    return res;
  },
  resendVerification: (email) => fetchJson('/auth/resend-verification', {
    method: 'POST',
    body: JSON.stringify({ email })
  }),
  checkVerification: (email) => fetchJson('/auth/check-verification', {
    method: 'POST',
    body: JSON.stringify({ email })
  }),
  checkVerificationStatus: (email) => fetchJson('/auth/check-verification', {
    method: 'POST',
    body: JSON.stringify({ email })
  }),
  verifyEmail: (data) => fetchJson('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  verifyLink: (data) => fetchJson('/auth/verify-link', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  sendEmailVerificationOtp: (payload) => {
    const body = typeof payload === 'string' ? { email: payload } : payload;
    return fetchJson('/auth/email/send-verification-otp', {
      method: 'POST',
      body: JSON.stringify(body)
    });
  },
  verifyEmailOtp: (data) => fetchJson('/auth/email/verify-otp', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  sendPasswordResetOtp: (email) => fetchJson('/auth/email/send-reset-otp', {
    method: 'POST',
    body: JSON.stringify({ email })
  }),
  verifyPasswordResetOtp: (data) => fetchJson('/auth/email/verify-reset-otp', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  adminLogin: async (data) => {
    const res = await fetchJson('/auth/admin/login', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    if (res.token) {
      activeTokens['admin'] = res.token;
      activeTokens['user'] = res.token;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('admin_auth_token', res.token);
        localStorage.setItem('auth_token', res.token);
        localStorage.setItem('auth_role', 'admin');
        localStorage.setItem('auth_user', JSON.stringify(res.user));
      }
    }
    return res;
  },
  verifyAdminMfa: async (data) => {
    const res = await fetchJson('/auth/admin/verify-mfa', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    if (res.token) {
      activeTokens['admin'] = res.token;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('admin_auth_token', res.token);
        localStorage.setItem('auth_token', res.token);
        localStorage.setItem('auth_role', 'admin');
        localStorage.setItem('auth_user', JSON.stringify(res.user));
      }
    }
    return res;
  },
  logout: () => {
    delete activeTokens['user'];
    delete activeTokens['admin'];
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_role');
      localStorage.removeItem('auth_user');
      localStorage.removeItem('admin_auth_token');
    }
  }
};
