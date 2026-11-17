import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../lib/api';
import { useAuth } from './AuthContext';

const PropertyContext = createContext(null);

export const sanitizeCall = (c) => {
  if (!c) return c;
  let status = c.status;
  let adminNotes = c.adminNotes || c.notes;
  let updatedAt = c.updatedAt;
  if (typeof status === 'object' && status !== null) {
    adminNotes = status.adminNotes || adminNotes || '';
    updatedAt = status.updatedAt || updatedAt;
    status = status.status || 'pending';
  }
  return {
    ...c,
    customerName: c.customerName || c.buyerName || c.name || 'Citizen Enquirer',
    customerPhone: c.customerPhone || c.buyerPhone || c.phone || '',
    customerEmail: c.customerEmail || c.buyerEmail || c.email || '',
    status: typeof status === 'string' ? status : 'pending',
    adminNotes: typeof adminNotes === 'string' ? adminNotes : '',
    updatedAt: typeof updatedAt === 'string' ? updatedAt : (c.createdAt || new Date().toISOString())
  };
};

export const sanitizeBooking = (b) => {
  if (!b) return b;
  let status = b.status;
  if (typeof status === 'object' && status !== null) {
    status = status.status || 'confirmed';
  }
  return {
    ...b,
    customerName: b.customerName || b.buyerName || b.name || 'Citizen Buyer',
    customerPhone: b.customerPhone || b.buyerPhone || b.phone || '',
    customerEmail: b.customerEmail || b.buyerEmail || b.email || '',
    status: typeof status === 'string' ? status : 'confirmed'
  };
};

export function PropertyProvider({ children }) {
  const { isLoggedIn, activeRole, showToast, requireAuth, currentUser } = useAuth();

  // Screen and Device Viewport tracking
  const [windowWidth, setWindowWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1200));
  const [deviceMode, setDeviceMode] = useState(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return 'mobile';
    }
    return 'desktop';
  });

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      setWindowWidth(w);
      if (w < 768) {
        setDeviceMode('mobile');
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = deviceMode === 'mobile' || windowWidth < 768;

  // Local storage helpers for persisted status overrides (Available for Sale, Sold, Rented, Returned)
  const getPersistedStatusOverrides = useCallback(() => {
    if (typeof localStorage === 'undefined') return {};
    try {
      return JSON.parse(localStorage.getItem('landpin_status_overrides') || '{}');
    } catch {
      return {};
    }
  }, []);

  const applyStatusOverrides = useCallback((propsList) => {
    if (!Array.isArray(propsList)) return [];
    const overrides = getPersistedStatusOverrides();
    return propsList.map((p) => {
      const id = p._id || p.id;
      if (overrides[id]) {
        return {
          ...p,
          availabilityStatus: overrides[id].status || p.availabilityStatus,
          status: overrides[id].status || p.status,
          verificationStatus: overrides[id].verificationStatus || p.verificationStatus,
          publicationStatus: overrides[id].publicationStatus || p.publicationStatus,
          adminNotes: overrides[id].notes ?? p.adminNotes,
          saleMetadata: overrides[id].metadata ?? p.saleMetadata,
          updatedAt: overrides[id].updatedAt || p.updatedAt
        };
      }
      return p;
    });
  }, [getPersistedStatusOverrides]);

  // Public Properties
  const [properties, setProperties] = useState([]);
  const [loadingProperties, setLoadingProperties] = useState(false);
  const [propertiesError, setPropertiesError] = useState(null);

  // User Data - Persistent Favorites for both Guest and Authenticated Sessions
  const [myProperties, setMyProperties] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem('landpin_user_properties');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) { }
    }
    return [];
  });

  // Strict ownership check: Identifies if the currently signed-in citizen is the owner of this property
  const isOwnerOfProperty = useCallback((prop) => {
    if (!currentUser || !prop) return false;
    const currentId = String(currentUser._id || currentUser.id || '').trim();
    const currentAuthId = String(currentUser.auth_id || '').trim();
    const currentEmail = String(currentUser.email || '').toLowerCase().trim();
    const currentMobile = String(currentUser.mobile || '').replace(/\D/g, '').slice(-10);

    const propOwnerId = String(prop.ownerId || prop.owner_id || '').trim();
    const propOwnerEmail = String(prop.ownerEmail || prop.owner_email || '').toLowerCase().trim();
    const propOwnerPhone = String(prop.ownerPhone || prop.owner_phone || '').replace(/\D/g, '').slice(-10);

    if (currentId && propOwnerId && currentId === propOwnerId) return true;
    if (currentAuthId && propOwnerId && currentAuthId === propOwnerId) return true;
    if (currentEmail && propOwnerEmail && currentEmail === propOwnerEmail) return true;
    if (currentMobile && propOwnerPhone && currentMobile === propOwnerPhone) return true;

    // Also match against the citizen's loaded active myProperties
    if (Array.isArray(myProperties) && myProperties.some(myP => {
      const myId = String(myP._id || myP.id || '').trim();
      const pId = String(prop._id || prop.id || '').trim();
      return myId && pId && myId === pId;
    })) {
      return true;
    }

    return false;
  }, [currentUser, myProperties]);

  // Public discovery properties: Strictly excludes the owner's own listings in Explore, Map, and AI Matcher
  const publicProperties = useMemo(() => {
    if (activeRole === 'admin') return properties;
    return properties.filter(p => !isOwnerOfProperty(p));
  }, [properties, isOwnerOfProperty, activeRole]);

  const [myAppointments, setMyAppointments] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem('plotpin_my_appointments') || localStorage.getItem('landpin_my_appointments');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) { }
    }
    return [];
  });

  const [myCallRequests, setMyCallRequests] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem('plotpin_my_calls') || localStorage.getItem('landpin_my_calls');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch (e) { }
    }
    return [];
  });
  const [favoriteIds, setFavoriteIds] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem('landpin_favorites');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch (e) {
        console.error('Error reading saved favorites:', e);
      }
    }
    return [];
  });
  const [myBuyings, setMyBuyings] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem('plotpin_purchased_deals');
        if (stored) return JSON.parse(stored);
      } catch (e) { }
    }
    return [];
  });
  const [myTickets, setMyTickets] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem('plotpin_my_tickets') || localStorage.getItem('landpin_my_tickets');
        if (stored) return JSON.parse(stored);
      } catch (e) { }
    }
    return [];
  });

  // Auto-sync favoriteIds to localStorage
  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('landpin_favorites', JSON.stringify(favoriteIds));
      } catch (e) {
        console.error('Error persisting favorites:', e);
      }
    }
  }, [favoriteIds]);

  // Admin Data
  const [adminKpis, setAdminKpis] = useState(null);
  const [adminQueue, setAdminQueue] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem('plotpin_admin_queue') || localStorage.getItem('landpin_admin_queue');
        if (stored !== null) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            const cleaned = parsed.filter(p => (
              p._id !== 'prop_queue_01' && p.id !== 'prop_queue_01' &&
              p._id !== 'prop_queue_02' && p.id !== 'prop_queue_02'
            ));
            localStorage.setItem('plotpin_admin_queue', JSON.stringify(cleaned));
            localStorage.setItem('landpin_admin_queue', JSON.stringify(cleaned));
            return cleaned;
          }
        }
      } catch (e) { }
    }
    return [];
  });
  const [adminApprovedProperties, setAdminApprovedProperties] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [adminEscrows, setAdminEscrows] = useState([]);
  const [adminTickets, setAdminTickets] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem('landpin_admin_tickets');
        if (stored) return JSON.parse(stored);
      } catch (e) { }
    }
    return [];
  });
  const [adminCalls, setAdminCalls] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem('landpin_admin_calls');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            const sanitized = parsed.map(sanitizeCall);
            try {
              localStorage.setItem('landpin_admin_calls', JSON.stringify(sanitized));
            } catch (e) { }
            return sanitized;
          }
        }
      } catch (e) { }
    }
    return [];
  });
  const [adminAppointments, setAdminAppointments] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem('landpin_admin_bookings');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            const sanitized = parsed.map(sanitizeBooking);
            try {
              localStorage.setItem('landpin_admin_bookings', JSON.stringify(sanitized));
            } catch (e) { }
            return sanitized;
          }
        }
      } catch (e) { }
    }
    return [];
  });
  const [adminCustomers, setAdminCustomers] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem('landpin_admin_customers');
        if (stored) return JSON.parse(stored);
      } catch (e) { }
    }
    return [];
  });

  // Filters & Search State
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [bhkFilter, setBhkFilter] = useState('all');
  const [priceRange, setPriceRange] = useState([0, 50000000]);
  const [sortBy, setSortBy] = useState('relevance');
  const [purposeFilter, setPurposeFilter] = useState('all');
  const [userLocation, setUserLocation] = useState({
    name: 'Kadapa, Andhra Pradesh',
    lat: 14.4673,
    lng: 78.8242,
    latitude: 14.4673,
    longitude: 78.8242
  });
  const [radiusKm, setRadiusKm] = useState(50);

  // Comparison State
  const [comparisonList, setComparisonList] = useState([]);

  // Modals & Selection State
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showComparisonModal, setShowComparisonModal] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showEscrowModal, setShowEscrowModal] = useState(false);
  const [showDeedModal, setShowDeedModal] = useState(false);
  const [selectedDeedProperty, setSelectedDeedProperty] = useState(null);
  const [show3DModal, setShow3DModal] = useState(false);
  const [selected3DProperty, setSelected3DProperty] = useState(null);
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [showCallModal, setShowCallModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [ticketProperty, setTicketProperty] = useState(null);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState(null);

  // One-time platform cache reset to purge all old mock data from browser storage
  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      const resetKey = 'plotpin_db_purged_v3';
      if (!localStorage.getItem(resetKey)) {
        [
          'landpin_status_overrides',
          'landpin_admin_bookings',
          'landpin_admin_calls',
          'landpin_admin_tickets',
          'landpin_admin_customers',
          'landpin_admin_queue',
          'plotpin_admin_queue',
          'landpin_user_properties',
          'plotpin_my_appointments',
          'landpin_my_appointments',
          'plotpin_my_calls',
          'landpin_my_calls',
          'plotpin_my_tickets',
          'landpin_my_tickets',
          'plotpin_purchased_deals',
          'landpin_favorites'
        ].forEach((k) => {
          try { localStorage.removeItem(k); } catch (e) {}
        });
        localStorage.setItem(resetKey, 'true');
        setProperties([]);
        setMyProperties([]);
        setMyAppointments([]);
        setMyCallRequests([]);
        setFavoriteIds([]);
        setMyBuyings([]);
        setMyTickets([]);
        setAdminApprovedProperties([]);
        setAdminQueue([]);
        setAdminAppointments([]);
        setAdminCalls([]);
        setAdminTickets([]);
        setAdminCustomers([]);
      }
    }
  }, []);

  // Fetch Public Properties tailored dynamically to user requirements
  const refreshProperties = useCallback(async (customParams = {}) => {
    setLoadingProperties(true);
    setPropertiesError(null);
    try {
      const queryParams = {
        limit: customParams.limit || 100,
        category: customParams.category && customParams.category !== 'all' ? customParams.category : undefined,
        purpose: customParams.purpose && customParams.purpose !== 'all' ? customParams.purpose : undefined,
        locality: customParams.locality || undefined,
        query: customParams.query || undefined,
        budgetMin: customParams.budgetMin || undefined,
        budgetMax: customParams.budgetMax || undefined,
        radiusKm: customParams.radiusKm && customParams.radiusKm !== 'all' ? customParams.radiusKm : undefined,
        lat: customParams.lat || undefined,
        lng: customParams.lng || undefined,
        sortBy: customParams.sortBy || undefined,
        ...customParams
      };

      // Remove undefined parameters
      Object.keys(queryParams).forEach(key => queryParams[key] === undefined && delete queryParams[key]);

      const data = await api.searchProperties(queryParams);
      if (Array.isArray(data.properties)) {
        setProperties(applyStatusOverrides(data.properties));
      } else {
        setProperties([]);
      }
    } catch (err) {
      console.warn('Failed to load public properties from API:', err.message);
      setProperties([]);
    } finally {
      setLoadingProperties(false);
    }
  }, [applyStatusOverrides]);

  // Fetch Authenticated User Data
  const loadUserData = useCallback(async () => {
    try {
      const [propsData, aptsData, callsData, favsData, buyingsData, ticketsData] = await Promise.all([
        api.getMyProperties().catch(() => ({ properties: [] })),
        api.getAppointments().catch(() => ({ appointments: [] })),
        api.getCallRequests().catch(() => ({ callRequests: [] })),
        api.getFavorites().catch(() => ({ favoriteIds: [] })),
        api.getMyBuyings().catch(() => ({ buyings: [] })),
        api.getUserSupportTickets().catch(() => ({ tickets: [] }))
      ]);

      const expressProps = propsData.properties || [];
      const propMap = new Map();
      expressProps.forEach((p) => propMap.set(p._id || p.id, p));

      setMyProperties(applyStatusOverrides(Array.from(propMap.values())));
      if (Array.isArray(aptsData.appointments) && aptsData.appointments.length > 0) {
        setMyAppointments(aptsData.appointments);
        try { localStorage.setItem('plotpin_my_appointments', JSON.stringify(aptsData.appointments)); } catch (e) { }
      }
      if (Array.isArray(callsData.callRequests) && callsData.callRequests.length > 0) {
        setMyCallRequests(callsData.callRequests);
        try { localStorage.setItem('plotpin_my_calls', JSON.stringify(callsData.callRequests)); } catch (e) { }
      }
      setFavoriteIds((prev) => Array.from(new Set([...prev, ...(favsData.favoriteIds || [])])));
      setMyBuyings(prev => {
        const backendDeals = Array.isArray(buyingsData.buyings) ? buyingsData.buyings : [];
        const localDeals = typeof localStorage !== 'undefined' ? JSON.parse(localStorage.getItem('plotpin_purchased_deals') || '[]') : [];
        const merged = [...backendDeals];
        for (const loc of localDeals) {
          if (!merged.some(m => (m._id || m.id) === (loc._id || loc.id) || (m.propertyId && m.propertyId === loc.propertyId))) {
            merged.push(loc);
          }
        }
        return merged;
      });
      setMyTickets(ticketsData.tickets || []);
    } catch (err) {
      console.error('Failed loading authoritative user data:', err);
    }
  }, [applyStatusOverrides]);

  // Fetch Admin Workspace Data
  const loadAdminData = useCallback(async () => {
    try {
      const [overviewData, queueData, logsData, escrowsData, supportData, callsData, aptsData, approvedData, usersData] = await Promise.all([
        api.getAdminOverview().catch(() => ({ kpis: {} })),
        api.getReviewQueue().catch(() => ({ properties: [] })),
        api.getAuditLogs().catch(() => ({ logs: [] })),
        api.getAdminEscrows().catch(() => ({ escrows: [] })),
        api.getAdminSupport().catch(() => ({ tickets: [] })),
        api.getCallRequests().catch(() => ({ callRequests: [] })),
        api.getAppointments().catch(() => ({ appointments: [] })),
        api.getApprovedProperties().catch(() => ({ properties: [] })),
        api.getAdminUsers().catch(() => ({ users: [] }))
      ]);

      if (overviewData.kpis) setAdminKpis(overviewData.kpis);

      const expressQueue = queueData.properties || [];
      const qMap = new Map();
      expressQueue.forEach((p) => qMap.set(p._id || p.id, p));

      const sortedQueue = Array.from(qMap.values()).sort((a, b) => {
        const timeA = new Date(a.updatedAt || a.updated_at || a.createdAt || a.created_at || 0).getTime();
        const timeB = new Date(b.updatedAt || b.updated_at || b.createdAt || b.created_at || 0).getTime();
        return timeB - timeA;
      });

      setAdminQueue(prev => {
        if (Array.isArray(sortedQueue) && sortedQueue.length > 0) {
          const cleaned = sortedQueue.filter(p => (
            p._id !== 'prop_queue_01' && p.id !== 'prop_queue_01' &&
            p._id !== 'prop_queue_02' && p.id !== 'prop_queue_02'
          ));
          return cleaned;
        }
        const rawStored = typeof localStorage !== 'undefined'
          ? (localStorage.getItem('plotpin_admin_queue') || localStorage.getItem('landpin_admin_queue'))
          : null;
        if (rawStored !== null) {
          try {
            const parsed = JSON.parse(rawStored);
            if (Array.isArray(parsed)) {
              const cleaned = parsed.filter(p => (
                p._id !== 'prop_queue_01' && p.id !== 'prop_queue_01' &&
                p._id !== 'prop_queue_02' && p.id !== 'prop_queue_02'
              ));
              return cleaned;
            }
          } catch (e) { }
        }
        const cleanedPrev = Array.isArray(prev) ? prev.filter(p => (
          p._id !== 'prop_queue_01' && p.id !== 'prop_queue_01' &&
          p._id !== 'prop_queue_02' && p.id !== 'prop_queue_02'
        )) : [];
        return cleanedPrev;
      });
      const rawApproved = approvedData.properties && approvedData.properties.length > 0
        ? approvedData.properties
        : (properties && properties.length > 0 ? properties : []);
      setAdminApprovedProperties(applyStatusOverrides(rawApproved));
      setAuditLogs(logsData.logs && logsData.logs.length > 0 ? logsData.logs : []);
      setAdminEscrows(escrowsData.escrows && escrowsData.escrows.length > 0 ? escrowsData.escrows : []);

      setAdminTickets(Array.isArray(supportData.tickets) ? supportData.tickets : []);

      setAdminCalls(() => {
        const list = Array.isArray(callsData.callRequests) ? callsData.callRequests : [];
        return list.map(sanitizeCall);
      });

      setAdminAppointments(() => {
        const list = Array.isArray(aptsData.appointments) ? aptsData.appointments : [];
        return list.map(sanitizeBooking);
      });

      setAdminCustomers(Array.isArray(usersData?.users) ? usersData.users : []);
    } catch (err) {
      console.error('Failed loading authoritative admin data:', err);
    }
  }, [applyStatusOverrides, properties]);

  // Admin-Controlled Property Status Update (Available for Sale, Sold, Rented, Returned)
  const updatePropertyStatus = useCallback(async (propId, newStatus, adminNotes = '', metadata = {}) => {
    if (!propId || !newStatus) return;

    const now = new Date().toISOString();
    // 1. Save to localStorage overrides
    try {
      const currentOverrides = getPersistedStatusOverrides();
      currentOverrides[propId] = {
        status: newStatus,
        notes: adminNotes,
        metadata,
        updatedAt: now
      };
      localStorage.setItem('landpin_status_overrides', JSON.stringify(currentOverrides));
    } catch (err) {
      console.error('Error saving status overrides:', err);
    }

    const priceValue = metadata.salePrice || metadata.leasePrice;

    // 2. Update properties state (Delist from public search / discovery if marked as sold or rented)
    if (newStatus === 'sold' || newStatus === 'rented') {
      setProperties(prev => prev.filter(p => (p._id || p.id) !== propId));
    } else {
      setProperties(prev => prev.map(p => {
        if ((p._id || p.id) === propId) {
          return {
            ...p,
            availabilityStatus: newStatus,
            status: newStatus,
            buyerName: metadata.buyerName || metadata.buyerReference || p.buyerName,
            buyerPhone: metadata.buyerPhone || p.buyerPhone,
            buyerEmail: metadata.buyerEmail || p.buyerEmail,
            finalPrice: priceValue || p.finalPrice,
            closedAt: now,
            dealType: newStatus,
            adminNotes,
            saleMetadata: metadata,
            updatedAt: now
          };
        }
        return p;
      }));
    }

    // 3. Update adminApprovedProperties
    setAdminApprovedProperties(prev => prev.map(p => {
      if ((p._id || p.id) === propId) {
        return {
          ...p,
          availabilityStatus: newStatus,
          status: newStatus,
          buyerName: metadata.buyerName || metadata.buyerReference || p.buyerName,
          buyerPhone: metadata.buyerPhone || p.buyerPhone,
          buyerEmail: metadata.buyerEmail || p.buyerEmail,
          finalPrice: priceValue || p.finalPrice,
          closedAt: now,
          dealType: newStatus,
          adminNotes,
          saleMetadata: metadata,
          updatedAt: now
        };
      }
      return p;
    }));

    // 4. Update myProperties if matching
    setMyProperties(prev => prev.map(p => {
      if ((p._id || p.id) === propId) {
        return {
          ...p,
          availabilityStatus: newStatus,
          status: newStatus,
          buyerName: metadata.buyerName || metadata.buyerReference || p.buyerName,
          buyerPhone: metadata.buyerPhone || p.buyerPhone,
          buyerEmail: metadata.buyerEmail || p.buyerEmail,
          finalPrice: priceValue || p.finalPrice,
          closedAt: now,
          dealType: newStatus,
          adminNotes,
          saleMetadata: metadata,
          updatedAt: now
        };
      }
      return p;
    }));

    // 5. Append to Audit Logs
    const auditEntry = {
      _id: 'log_' + Date.now(),
      action: `STATUS_${newStatus.toUpperCase()}`,
      type: `STATUS_${newStatus.toUpperCase()}`,
      actorId: 'Admin (PlotPin Cadastral Authority)',
      targetId: propId,
      propertyId: propId,
      details: `Admin updated listing status to [${newStatus.toUpperCase()}]. Buyer/Tenant: ${metadata.buyerName || metadata.buyerReference || 'Private Party'} · Notes: ${adminNotes || 'None'}${priceValue ? ` · Closed at ₹${Number(priceValue).toLocaleString('en-IN')}` : ''}`,
      timestamp: now
    };
    setAuditLogs(prev => [auditEntry, ...prev]);

    // 6. Handle Cascading Deal Closure for Buyer and Deals
    if (newStatus === 'sold' || newStatus === 'rented') {
      const targetProperty = properties.find(p => (p._id || p.id) === propId) ||
        adminApprovedProperties.find(p => (p._id || p.id) === propId) || {};
      const dealRecord = {
        _id: 'deal_' + Date.now(),
        propertyId: propId,
        propertyTitle: targetProperty.title || metadata.propertyTitle || 'Cadastral Asset',
        propertyImage: (targetProperty.images && targetProperty.images[0]?.storageKey) || '',
        buyerId: metadata.buyerId || 'usr_client_001',
        buyerName: metadata.buyerName || metadata.buyerReference || 'Verified Citizen Buyer',
        buyerPhone: metadata.buyerPhone || '',
        buyerEmail: metadata.buyerEmail || '',
        sellerId: targetProperty.ownerId || '',
        sellerName: targetProperty.ownerName || targetProperty.owner?.name || 'Property Owner',
        totalPropertyValue: targetProperty.price || priceValue,
        dealAmount: priceValue || targetProperty.price,
        offerAmount: priceValue || targetProperty.price,
        price: priceValue || targetProperty.price,
        currency: 'INR',
        dealReference: `DEAL-AP-${Date.now().toString().slice(-6)}`,
        stage: newStatus === 'rented' ? 'Tenancy Agreement Executed' : 'Title Deed Transferred · Deal Completed',
        status: 'completed',
        outcome: newStatus,
        dealType: newStatus,
        clearedChecks: ["Meebhoomi Encumbrance Search", "AP MAUD e-Khata Digital QR", "Final Consideration Transferred", "100% Stamp Duty Discharged"],
        pendingChecks: [],
        completedAt: now,
        createdAt: now,
        property: {
          ...targetProperty,
          availabilityStatus: newStatus,
          status: newStatus,
          buyerName: metadata.buyerName || metadata.buyerReference,
          buyerPhone: metadata.buyerPhone,
          buyerEmail: metadata.buyerEmail,
          finalPrice: priceValue || targetProperty.price,
          saleMetadata: metadata
        }
      };

      setMyBuyings(prev => [dealRecord, ...prev.filter(d => (d.propertyId || d.property?._id) !== propId)]);
      setAdminEscrows(prev => [dealRecord, ...prev.filter(d => (d.propertyId || d.property?._id) !== propId)]);

      try {
        const storedDeals = JSON.parse(localStorage.getItem('plotpin_purchased_deals') || '[]');
        const filtered = storedDeals.filter(d => (d.propertyId || d.property?._id) !== propId);
        filtered.unshift(dealRecord);
        localStorage.setItem('plotpin_purchased_deals', JSON.stringify(filtered));
      } catch (e) { }

      const competingClosureMessage = `Sorry for the rejection: this property deal has already been finalized. You can explore other verified properties with the same features.`;

      // Update admin appointments: mark source booking completed, and mark ALL OTHER active bookings for propId as rejected!
      setAdminAppointments(prev => prev.map(a => {
        const isMatch = (a.propertyId === propId || a.property_id === propId);
        if (!isMatch) return a;
        if (metadata.sourceType === 'booking' && (a._id === metadata.sourceId || a.id === metadata.sourceId)) {
          return {
            ...a,
            status: 'completed',
            notes: (a.notes ? a.notes + ' | ' : '') + `Deal finalized as ${newStatus.toUpperCase()} with ${metadata.buyerName || 'Buyer'}`
          };
        }
        if (a.status !== 'completed') {
          return {
            ...a,
            status: 'rejected',
            cancellationReason: competingClosureMessage,
            notes: (a.notes ? a.notes + ' | ' : '') + competingClosureMessage
          };
        }
        return a;
      }));

      // Update admin calls: mark source call completed, and mark ALL OTHER active calls for propId as rejected!
      setAdminCalls(prev => prev.map(c => {
        const isMatch = (c.propertyId === propId || c.property_id === propId);
        if (!isMatch) return c;
        if (metadata.sourceType === 'call' && (c._id === metadata.sourceId || c.id === metadata.sourceId)) {
          return {
            ...c,
            status: 'completed',
            adminNotes: (c.adminNotes ? c.adminNotes + ' | ' : '') + `Deal finalized as ${newStatus.toUpperCase()} with ${metadata.buyerName || 'Buyer'}`
          };
        }
        if (c.status !== 'completed') {
          return {
            ...c,
            status: 'rejected',
            adminNotes: (c.adminNotes ? c.adminNotes + ' | ' : '') + competingClosureMessage
          };
        }
        return c;
      }));

      // Update regular citizen user's scheduled visits (myAppointments)
      setMyAppointments(prev => prev.map(a => {
        const isMatch = (a.propertyId === propId || a.property_id === propId);
        if (!isMatch) return a;
        if (metadata.sourceType === 'booking' && (a._id === metadata.sourceId || a.id === metadata.sourceId)) {
          return { ...a, status: 'completed' };
        }
        return {
          ...a,
          status: 'rejected',
          cancellationReason: competingClosureMessage,
          notes: (a.notes ? a.notes + ' | ' : '') + competingClosureMessage
        };
      }));

      // Update regular citizen user's call requests (myCallRequests)
      setMyCallRequests(prev => prev.map(c => {
        const isMatch = (c.propertyId === propId || c.property_id === propId);
        if (!isMatch) return c;
        if (metadata.sourceType === 'call' && (c._id === metadata.sourceId || c.id === metadata.sourceId)) {
          return { ...c, status: 'completed' };
        }
        return {
          ...c,
          status: 'rejected',
          notes: competingClosureMessage,
          adminNotes: competingClosureMessage
        };
      }));

      // Save updated citizen appointments & calls to localStorage
      try {
        const storedApts = localStorage.getItem('plotpin_my_appointments') || localStorage.getItem('landpin_user_appointments') || '[]';
        const localApts = JSON.parse(storedApts);
        const updatedLocalApts = localApts.map(a => {
          if (a.propertyId === propId && a._id !== metadata.sourceId && a.id !== metadata.sourceId) {
            return { ...a, status: 'rejected', cancellationReason: competingClosureMessage, notes: (a.notes ? a.notes + ' | ' : '') + competingClosureMessage };
          }
          return a;
        });
        localStorage.setItem('plotpin_my_appointments', JSON.stringify(updatedLocalApts));
        localStorage.setItem('landpin_user_appointments', JSON.stringify(updatedLocalApts));

        const storedCalls = localStorage.getItem('plotpin_my_calls') || localStorage.getItem('landpin_user_calls') || '[]';
        const localCalls = JSON.parse(storedCalls);
        const updatedLocalCalls = localCalls.map(c => {
          if (c.propertyId === propId && c._id !== metadata.sourceId && c.id !== metadata.sourceId) {
            return { ...c, status: 'rejected', notes: competingClosureMessage, adminNotes: competingClosureMessage };
          }
          return c;
        });
        localStorage.setItem('plotpin_my_calls', JSON.stringify(updatedLocalCalls));
        localStorage.setItem('landpin_user_calls', JSON.stringify(updatedLocalCalls));
      } catch (e) { }

      // Store in-app citizen notification for competing interest holders
      try {
        const existingNotifs = JSON.parse(localStorage.getItem('plotpin_user_notifications') || '[]');
        existingNotifs.unshift({
          id: 'notif_' + Date.now(),
          type: 'property_closed',
          title: `Plot Deal Finalized (${newStatus === 'rented' ? 'Rented Out' : 'Sold Out'})`,
          message: `Sorry for the rejection: the listing "${metadata.propertyTitle || 'Real Estate Asset'}" has been closed (${newStatus.toUpperCase()}) with another customer. You are welcome to explore other verified properties with the same features.`,
          timestamp: now
        });
        localStorage.setItem('plotpin_user_notifications', JSON.stringify(existingNotifs.slice(0, 30)));
      } catch (e) { }
    }

    // 7. Try background backend sync
    try {
      await api.completeDeal(propId, {
        outcome: newStatus,
        buyerName: metadata.buyerName || metadata.buyerReference,
        buyerPhone: metadata.buyerPhone,
        buyerEmail: metadata.buyerEmail,
        buyerId: metadata.buyerId,
        finalPrice: priceValue,
        sourceId: metadata.sourceId,
        sourceType: metadata.sourceType,
        closureNotes: adminNotes
      }).catch(() => { });
    } catch {
      // offline graceful
    }
  }, [getPersistedStatusOverrides, properties, adminApprovedProperties]);

  // User/Owner Property Edit Submission Lifecycle
  // When a citizen edits their property details, the listing is unlisted from public discovery
  // and submitted to the Super Admin's Verification Queue pending cadastral verification.
  const submitPropertyEditForVerification = useCallback(async (propId, updatedData) => {
    if (!propId || !updatedData) return;
    const now = new Date().toISOString();

    // Retrieve original property representation
    const originalProp =
      myProperties.find(p => (p._id || p.id) === propId) ||
      properties.find(p => (p._id || p.id) === propId) ||
      adminApprovedProperties.find(p => (p._id || p.id) === propId) ||
      {};

    const revisedProp = {
      ...originalProp,
      ...updatedData,
      _id: propId,
      id: propId,
      verificationStatus: 'pending_verification',
      publicationStatus: 'in_review',
      availabilityStatus: 'available',
      cadastralVerified: false,
      isVerified: false,
      isRevision: true,
      hasPendingRevision: true,
      proposedChanges: updatedData,
      previousApprovedState: {
        title: originalProp.title,
        price: originalProp.price,
        category: originalProp.category,
        purpose: originalProp.purpose,
        description: originalProp.description,
        location: originalProp.location,
        area: originalProp.area
      },
      updatedAt: now
    };

    // 1. Update in myProperties (Seller sees 'Under Admin Verification' status)
    setMyProperties(prev => {
      const exists = prev.some(p => (p._id || p.id) === propId);
      const next = exists
        ? prev.map(p => ((p._id || p.id) === propId ? revisedProp : p))
        : [revisedProp, ...prev];
      try {
        localStorage.setItem('landpin_user_properties', JSON.stringify(next));
      } catch (e) { }
      return next;
    });

    // 2. Remove from public live properties (Delisted from Explore, Map, and Public Search)
    setProperties(prev => prev.filter(p => (p._id || p.id) !== propId));

    // 3. Remove from live admin inventory
    setAdminApprovedProperties(prev => prev.filter(p => (p._id || p.id) !== propId));

    // 4. Push directly into Super Admin Verification Queue at top
    setAdminQueue(prev => {
      const filtered = prev.filter(p => (p._id || p.id) !== propId);
      const nextQueue = [revisedProp, ...filtered];
      try {
        localStorage.setItem('landpin_admin_queue', JSON.stringify(nextQueue));
      } catch (e) { }
      return nextQueue;
    });

    // 5. Persist unlisted override so it stays unlisted across page reloads
    try {
      const overrides = getPersistedStatusOverrides();
      overrides[propId] = {
        status: 'in_review',
        verificationStatus: 'pending_verification',
        publicationStatus: 'in_review',
        notes: updatedData.editReason || 'Revisions submitted by owner; pending cadastral verification',
        updatedAt: now
      };
      localStorage.setItem('landpin_status_overrides', JSON.stringify(overrides));
    } catch (e) { }

    // 6. Append to Audit Logs
    const auditEntry = {
      _id: 'log_' + Date.now(),
      action: 'PROPERTY_REVISION_SUBMITTED',
      type: 'PROPERTY_REVISION_SUBMITTED',
      actorId: 'Citizen Landowner',
      targetId: propId,
      propertyId: propId,
      details: `Owner submitted revisions for #${propId}. Listing temporarily unlisted from public discovery pending cadastral re-verification.`,
      timestamp: now
    };
    setAuditLogs(prev => [auditEntry, ...prev]);

    // 7. Background sync attempt
    try {
      await api.updateProperty(propId, {
        ...updatedData,
        verificationStatus: 'pending_verification',
        publicationStatus: 'in_review'
      }).catch(() => { });
    } catch (e) { }
  }, [myProperties, properties, adminApprovedProperties, getPersistedStatusOverrides]);

  // Backward compatibility alias
  const editProperty = submitPropertyEditForVerification;

  // Super Admin: Cadastral Verification Approval
  // Approves title deed / revised specifications and publishes listing to live public discovery
  const approveVerification = useCallback(async (propId) => {
    if (!propId) return;
    const now = new Date().toISOString();

    let targetProp = adminQueue.find(p => (p._id || p.id) === propId);
    if (!targetProp) {
      targetProp = myProperties.find(p => (p._id || p.id) === propId) ||
        properties.find(p => (p._id || p.id) === propId) ||
        {};
    }

    const approvedProp = {
      ...targetProp,
      _id: propId,
      id: propId,
      verificationStatus: 'approved',
      publicationStatus: 'published',
      availabilityStatus: 'available',
      status: 'available',
      cadastralVerified: true,
      isVerified: true,
      isRevision: false,
      hasPendingRevision: false,
      updatedAt: now
    };

    // 1. Remove from adminQueue
    setAdminQueue(prev => {
      const next = prev.filter(p => (p._id || p.id) !== propId);
      try {
        localStorage.setItem('plotpin_admin_queue', JSON.stringify(next));
        localStorage.setItem('landpin_admin_queue', JSON.stringify(next));
      } catch (e) { }
      return next;
    });

    // 2. Publish live to public properties
    setProperties(prev => {
      const filtered = prev.filter(p => (p._id || p.id) !== propId);
      return [approvedProp, ...filtered];
    });

    // 3. Add to live admin properties inventory
    setAdminApprovedProperties(prev => {
      const filtered = prev.filter(p => (p._id || p.id) !== propId);
      return [approvedProp, ...filtered];
    });

    // 4. Update in seller's myProperties
    setMyProperties(prev => {
      const exists = prev.some(p => (p._id || p.id) === propId);
      const next = exists
        ? prev.map(p => ((p._id || p.id) === propId ? approvedProp : p))
        : [approvedProp, ...prev];
      try {
        localStorage.setItem('landpin_user_properties', JSON.stringify(next));
      } catch (e) { }
      return next;
    });

    // 5. Update localStorage overrides to available / approved
    try {
      const overrides = getPersistedStatusOverrides();
      overrides[propId] = {
        status: 'available',
        verificationStatus: 'approved',
        publicationStatus: 'published',
        updatedAt: now
      };
      localStorage.setItem('landpin_status_overrides', JSON.stringify(overrides));
    } catch (e) { }

    // 6. Append audit log
    const auditEntry = {
      _id: 'log_' + Date.now(),
      action: 'PROPERTY_VERIFICATION_APPROVED',
      type: 'PROPERTY_VERIFICATION_APPROVED',
      actorId: 'Super Admin (Cadastral Authority)',
      targetId: propId,
      propertyId: propId,
      details: `Super Admin verified title deed & cadastral specs for #${propId}. Listing published live to public discovery.`,
      timestamp: now
    };
    setAuditLogs(prev => [auditEntry, ...prev]);

    // 7. Background sync attempt
    try {
      await api.approveProperty(propId, {
        cadastralVerified: true,
        notes: 'Approved by Regional Cadastral Compliance Desk'
      }).catch(() => { });
    } catch (e) { }
  }, [adminQueue, myProperties, properties, getPersistedStatusOverrides]);

  // Super Admin: Cadastral Verification Rejection
  const rejectVerification = useCallback(async (propId, reason = '') => {
    if (!propId) return;
    const now = new Date().toISOString();

    const targetProp = adminQueue.find(p => (p._id || p.id) === propId) ||
      myProperties.find(p => (p._id || p.id) === propId) ||
      {};

    const rejectedProp = {
      ...targetProp,
      _id: propId,
      id: propId,
      verificationStatus: 'rejected',
      publicationStatus: 'rejected',
      cadastralVerified: false,
      isVerified: false,
      isRevision: false,
      hasPendingRevision: false,
      adminNotes: reason || 'Rejected by Cadastral Compliance Desk',
      updatedAt: now
    };

    // 1. Remove from adminQueue
    setAdminQueue(prev => {
      const next = prev.filter(p => (p._id || p.id) !== propId);
      try {
        localStorage.setItem('plotpin_admin_queue', JSON.stringify(next));
        localStorage.setItem('landpin_admin_queue', JSON.stringify(next));
      } catch (e) { }
      return next;
    });

    // 2. Remove from public properties and admin live inventory
    setProperties(prev => prev.filter(p => (p._id || p.id) !== propId));
    setAdminApprovedProperties(prev => prev.filter(p => (p._id || p.id) !== propId));

    // 3. Update seller's myProperties with rejection findings
    setMyProperties(prev => {
      const next = prev.map(p => ((p._id || p.id) === propId ? rejectedProp : p));
      try {
        localStorage.setItem('landpin_user_properties', JSON.stringify(next));
      } catch (e) { }
      return next;
    });

    // 4. Update localStorage overrides to rejected
    try {
      const overrides = getPersistedStatusOverrides();
      overrides[propId] = {
        status: 'rejected',
        verificationStatus: 'rejected',
        publicationStatus: 'rejected',
        notes: reason,
        updatedAt: now
      };
      localStorage.setItem('landpin_status_overrides', JSON.stringify(overrides));
    } catch (e) { }

    // 5. Append audit log
    const auditEntry = {
      _id: 'log_' + Date.now(),
      action: 'PROPERTY_VERIFICATION_REJECTED',
      type: 'PROPERTY_VERIFICATION_REJECTED',
      actorId: 'Super Admin (Cadastral Authority)',
      targetId: propId,
      propertyId: propId,
      details: `Super Admin rejected listing verification for #${propId}. Findings: ${reason}`,
      timestamp: now
    };
    setAuditLogs(prev => [auditEntry, ...prev]);

    // 6. Background sync attempt
    try {
      await api.rejectProperty(propId, reason).catch(() => { });
    } catch (e) { }
  }, [adminQueue, myProperties, getPersistedStatusOverrides]);

  // Super Admin: Publish New Property
  const publishNewProperty = useCallback(async (propertyData) => {
    const now = new Date().toISOString();
    const newProp = {
      _id: propertyData._id || 'prop_' + Date.now(),
      id: propertyData._id || 'prop_' + Date.now(),
      verificationStatus: 'approved',
      publicationStatus: 'published',
      availabilityStatus: 'available',
      cadastralVerified: true,
      createdAt: now,
      updatedAt: now,
      ...propertyData
    };

    setProperties(prev => [newProp, ...prev]);
    setAdminApprovedProperties(prev => [newProp, ...prev]);

    try {
      const customs = JSON.parse(localStorage.getItem('landpin_custom_properties') || '[]');
      localStorage.setItem('landpin_custom_properties', JSON.stringify([newProp, ...customs]));
      localStorage.setItem('plotpin_custom_properties', JSON.stringify([newProp, ...customs]));
    } catch (e) { }

    const auditEntry = {
      _id: 'log_' + Date.now(),
      action: 'PROPERTY_PUBLISHED',
      type: 'PROPERTY_PUBLISHED',
      actorId: 'Super Admin',
      targetId: newProp._id,
      propertyId: newProp._id,
      details: `Super Admin published live property listing: ${newProp.title}`,
      timestamp: now
    };
    setAuditLogs(prev => [auditEntry, ...prev]);
    return newProp;
  }, []);

  // Citizen: Submit New Property Listing for Super Admin Verification
  const submitNewPropertyListing = useCallback(async (propertyData) => {
    const now = new Date().toISOString();
    const propId = propertyData._id || 'prop_' + Date.now();

    const newProp = {
      _id: propId,
      id: propId,
      title: propertyData.title || 'PlotPin Cadastral Asset Listing',
      price: Number(propertyData.price) || 0,
      category: propertyData.category || 'residential',
      propertyType: propertyData.propertyType || propertyData.category || 'residential',
      purpose: propertyData.purpose || 'buy',
      location: propertyData.location || {
        district: 'Kadapa',
        city: 'Kadapa',
        state: 'Andhra Pradesh',
        address: 'Kadapa Urban, Andhra Pradesh'
      },
      area: Number(propertyData.area) || 1200,
      areaUnit: propertyData.areaUnit || 'sqft',
      description: propertyData.description || 'Cadastral title verified property listed via PlotPin platform.',
      images: Array.isArray(propertyData.images) && propertyData.images.length > 0
        ? propertyData.images
        : ['https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80'],
      verificationStatus: 'pending_verification',
      publicationStatus: 'in_review',
      availabilityStatus: 'available',
      cadastralVerified: false,
      isVerified: false,
      owner: {
        name: currentUser?.name || 'Citizen Landowner',
        phone: currentUser?.mobile || '+91 98480 12345',
        email: currentUser?.email || 'citizen@plotpin.in'
      },
      createdAt: now,
      updatedAt: now,
      ...propertyData
    };

    // 1. Add to citizen's myProperties
    setMyProperties(prev => {
      const filtered = prev.filter(p => (p._id || p.id) !== propId);
      const updated = [newProp, ...filtered];
      try {
        localStorage.setItem('plotpin_user_properties', JSON.stringify(updated));
        localStorage.setItem('landpin_user_properties', JSON.stringify(updated));
      } catch (e) { }
      return updated;
    });

    // 2. Add directly to Admin Verification Queue (/admin/verifications)
    setAdminQueue(prev => {
      const filtered = prev.filter(p => (p._id || p.id) !== propId);
      const updated = [newProp, ...filtered];
      try {
        localStorage.setItem('plotpin_admin_queue', JSON.stringify(updated));
        localStorage.setItem('landpin_admin_queue', JSON.stringify(updated));
      } catch (e) { }
      return updated;
    });

    // 3. Persist unlisted override so listing is kept under verification
    try {
      const overrides = getPersistedStatusOverrides();
      overrides[propId] = {
        status: 'in_review',
        verificationStatus: 'pending_verification',
        publicationStatus: 'in_review',
        notes: 'Submitted by citizen; pending cadastral deed verification by Super Admin',
        updatedAt: now
      };
      localStorage.setItem('plotpin_status_overrides', JSON.stringify(overrides));
      localStorage.setItem('landpin_status_overrides', JSON.stringify(overrides));
    } catch (e) { }

    // 4. Log audit entry
    const auditEntry = {
      _id: 'log_' + Date.now(),
      action: 'PROPERTY_SUBMITTED_FOR_VERIFICATION',
      type: 'PROPERTY_SUBMITTED_FOR_VERIFICATION',
      actorId: currentUser?.name || 'Citizen Landowner',
      targetId: propId,
      propertyId: propId,
      details: `Citizen submitted listing "${newProp.title}" (#${propId}) for Super Admin cadastral deed verification.`,
      timestamp: now
    };
    setAuditLogs(prev => [auditEntry, ...prev]);

    // 5. Try background API call gracefully
    try {
      await api.createDraftProperty(propertyData);
    } catch (e) { }

    return newProp;
  }, [currentUser, getPersistedStatusOverrides]);

  // Super Admin: Booking Management (Confirm, Reject, Cancel, Reschedule)
  const updateBookingStatus = useCallback(async (bookingId, newStatus, adminNote = '', newStartAt = null, assignedSurveyor = null) => {
    if (!bookingId || !newStatus) return;
    const now = new Date().toISOString();

    let normalizedStatus = typeof newStatus === 'string' ? newStatus.toLowerCase().trim() : 'confirmed';
    if (normalizedStatus === 'reject') normalizedStatus = 'rejected';
    if (normalizedStatus === 'cancel') normalizedStatus = 'cancelled';
    if (normalizedStatus === 'complete') normalizedStatus = 'completed';
    if (normalizedStatus === 'confirm') normalizedStatus = 'confirmed';

    const updater = (item) => {
      if ((item._id || item.id) === bookingId) {
        return {
          ...item,
          status: normalizedStatus,
          notes: adminNote || item.notes,
          adminNotes: adminNote || item.adminNotes,
          startAt: newStartAt || item.startAt,
          assignedSurveyor: assignedSurveyor || item.assignedSurveyor,
          updatedAt: now
        };
      }
      return item;
    };

    setAdminAppointments(prev => {
      const updated = prev.map(updater);
      try {
        localStorage.setItem('landpin_admin_bookings', JSON.stringify(updated));
      } catch (e) { }
      return updated;
    });

    setMyAppointments(prev => prev.map(updater));

    const auditEntry = {
      _id: 'log_' + Date.now(),
      action: `BOOKING_${normalizedStatus.toUpperCase()}`,
      type: `BOOKING_${normalizedStatus.toUpperCase()}`,
      actorId: 'Super Admin',
      targetId: bookingId,
      details: `Super Admin updated site visit booking #${bookingId} to [${normalizedStatus}]. Note: ${adminNote || 'None'}`,
      timestamp: now
    };
    setAuditLogs(prev => [auditEntry, ...prev]);

    try {
      await api.updateAppointmentStatus(bookingId, normalizedStatus, adminNote).catch(() => { });
    } catch { }
  }, []);

  // Super Admin: Schedule New Site Visit Booking
  const scheduleNewBooking = useCallback(async (bookingData) => {
    const now = new Date().toISOString();
    const newBooking = {
      _id: 'apt_' + Date.now(),
      id: 'apt_' + Date.now(),
      status: 'confirmed',
      createdAt: now,
      updatedAt: now,
      ...bookingData
    };

    setAdminAppointments(prev => {
      const updated = [newBooking, ...prev];
      try {
        localStorage.setItem('landpin_admin_bookings', JSON.stringify(updated));
      } catch (e) { }
      return updated;
    });

    setMyAppointments(prev => [newBooking, ...prev]);

    const auditEntry = {
      _id: 'log_' + Date.now(),
      action: 'BOOKING_SCHEDULED',
      type: 'BOOKING_SCHEDULED',
      actorId: 'Super Admin',
      targetId: newBooking._id,
      details: `Super Admin scheduled surveyor escort for ${newBooking.customerName} on ${newBooking.propertyTitle}`,
      timestamp: now
    };
    setAuditLogs(prev => [auditEntry, ...prev]);
    return newBooking;
  }, []);

  // Citizen or Admin: Schedule Site Visit Booking
  const createSiteVisitBooking = useCallback(async (bookingData) => {
    const now = new Date().toISOString();
    const aptId = 'apt_' + Date.now();
    const newBooking = {
      _id: aptId,
      id: aptId,
      propertyId: bookingData.propertyId,
      propertyTitle: bookingData.propertyTitle || 'PlotPin Cadastral Asset',
      customerName: bookingData.customerName || currentUser?.name || 'Citizen Buyer',
      customerPhone: bookingData.customerPhone || currentUser?.mobile || '+91 98480 12345',
      customerEmail: currentUser?.email || 'citizen@plotpin.in',
      startAt: bookingData.startAt,
      endAt: bookingData.endAt,
      status: 'confirmed',
      assignedSurveyor: 'K. Ramana, Licensed AP Surveyor #SV-402',
      notes: bookingData.notes || 'Site visit scheduled with surveyor escort.',
      createdAt: now,
      updatedAt: now
    };

    try {
      await api.createAppointment(bookingData);
    } catch (e) {
      // Local fallback active
    }

    setAdminAppointments(prev => {
      const updated = [newBooking, ...prev.filter(b => (b._id || b.id) !== aptId)];
      try {
        localStorage.setItem('plotpin_admin_bookings', JSON.stringify(updated));
        localStorage.setItem('landpin_admin_bookings', JSON.stringify(updated));
      } catch (e) { }
      return updated;
    });

    setMyAppointments(prev => {
      const updated = [newBooking, ...prev.filter(b => (b._id || b.id) !== aptId)];
      try {
        localStorage.setItem('plotpin_my_appointments', JSON.stringify(updated));
      } catch (e) { }
      return updated;
    });

    const auditEntry = {
      _id: 'log_' + Date.now(),
      action: 'BOOKING_SCHEDULED',
      type: 'BOOKING_SCHEDULED',
      actorId: newBooking.customerName,
      targetId: aptId,
      details: `Site visit booked for ${newBooking.customerName} on ${newBooking.propertyTitle}`,
      timestamp: now
    };
    setAuditLogs(prev => [auditEntry, ...prev]);
    return newBooking;
  }, [currentUser]);

  // Citizen or Admin: Create Inbound Call Request
  const createDirectCallRequest = useCallback(async (callData) => {
    const now = new Date().toISOString();
    const callId = 'call_' + Date.now();
    const newCall = {
      _id: callId,
      id: callId,
      propertyId: callData.propertyId,
      propertyTitle: callData.propertyTitle || 'PlotPin Cadastral Asset',
      customerName: callData.customerName || currentUser?.name || 'Citizen Customer',
      customerPhone: callData.phone || callData.customerPhone || currentUser?.mobile || '+91 98480 99999',
      customerEmail: currentUser?.email || 'citizen@plotpin.in',
      preferredTime: callData.preferredTime || callData.preferredTimeWindow,
      preferredTimeWindow: callData.preferredTime || callData.preferredTimeWindow,
      status: 'pending',
      notes: callData.notes || 'Inbound callback requested via Direct Call Desk',
      createdAt: now,
      updatedAt: now
    };

    try {
      await api.createCallRequest(callData);
    } catch (e) {
      // Local fallback active
    }

    setAdminCalls(prev => {
      const updated = [newCall, ...prev.filter(c => (c._id || c.id) !== callId)];
      try {
        localStorage.setItem('plotpin_admin_calls', JSON.stringify(updated));
        localStorage.setItem('landpin_admin_calls', JSON.stringify(updated));
      } catch (e) { }
      return updated;
    });

    setMyCallRequests(prev => {
      const updated = [newCall, ...prev.filter(c => (c._id || c.id) !== callId)];
      try {
        localStorage.setItem('plotpin_my_calls', JSON.stringify(updated));
      } catch (e) { }
      return updated;
    });

    const auditEntry = {
      _id: 'log_' + Date.now(),
      action: 'CALL_REQUESTED',
      type: 'CALL_REQUESTED',
      actorId: newCall.customerName,
      targetId: callId,
      details: `Call request logged for ${newCall.customerName} (${newCall.customerPhone}) on ${newCall.propertyTitle} [Slot: ${newCall.preferredTime}]`,
      timestamp: now
    };
    setAuditLogs(prev => [auditEntry, ...prev]);
    return newCall;
  }, [currentUser]);

  // Super Admin: Call Management (Update Record, Status, Notes)
  const updateCallRecord = useCallback(async (callId, newStatusOrData, notesArg = '') => {
    if (!callId) return;
    const now = new Date().toISOString();

    let newStatus = 'completed';
    let notes = '';
    let extraFields = {};

    if (typeof newStatusOrData === 'string') {
      newStatus = newStatusOrData;
      notes = notesArg;
    } else if (typeof newStatusOrData === 'object' && newStatusOrData !== null) {
      newStatus = newStatusOrData.status || 'completed';
      notes = newStatusOrData.adminNotes || newStatusOrData.notes || notesArg || '';
      extraFields = { ...newStatusOrData };
      delete extraFields.status;
      delete extraFields.adminNotes;
      delete extraFields.notes;
    }

    let normalizedStatus = typeof newStatus === 'string' ? newStatus.toLowerCase().trim() : 'completed';
    if (normalizedStatus === 'reject') normalizedStatus = 'rejected';
    if (normalizedStatus === 'complete') normalizedStatus = 'completed';

    const updater = (call) => {
      if ((call._id || call.id) === callId) {
        return {
          ...call,
          ...extraFields,
          status: normalizedStatus,
          notes: notes || call.notes,
          adminNotes: notes || call.adminNotes,
          updatedAt: now
        };
      }
      return call;
    };

    setAdminCalls(prev => {
      const updated = prev.map(updater);
      try {
        localStorage.setItem('landpin_admin_calls', JSON.stringify(updated));
      } catch (e) { }
      return updated;
    });

    setMyCallRequests(prev => prev.map(updater));

    const auditEntry = {
      _id: 'log_' + Date.now(),
      action: `CALL_${normalizedStatus.toUpperCase()}`,
      type: `CALL_${normalizedStatus.toUpperCase()}`,
      actorId: 'Super Admin',
      targetId: callId,
      details: `Super Admin updated call request #${callId} to [${normalizedStatus}]. Notes: ${notes || 'None'}`,
      timestamp: now
    };
    setAuditLogs(prev => [auditEntry, ...prev]);

    try {
      await api.updateCallRequestStatus(callId, normalizedStatus, notes).catch(() => { });
    } catch { }
  }, []);

  // Super Admin: Customer Support (Reply, Resolve, Status)
  const replySupportTicket = useCallback(async (ticketId, replyTextOrObj, statusArg = 'in_progress') => {
    if (!ticketId || !replyTextOrObj) return;
    const now = new Date().toISOString();

    let message = '';
    let status = statusArg;
    let adminReply = '';
    let resolvedAt = null;

    if (typeof replyTextOrObj === 'string') {
      message = replyTextOrObj.trim();
      adminReply = message;
      status = statusArg;
    } else if (typeof replyTextOrObj === 'object' && replyTextOrObj !== null) {
      message = (replyTextOrObj.adminReply || replyTextOrObj.message || replyTextOrObj.replyText || '').trim();
      adminReply = message;
      status = replyTextOrObj.status || statusArg || 'in_progress';
      resolvedAt = replyTextOrObj.resolvedAt || (status === 'resolved' ? now : null);
    }

    const updater = (tkt) => {
      if ((tkt._id || tkt.id) === ticketId) {
        const newReply = message ? {
          sender: 'Super Admin (PlotPin Cadastral Desk)',
          author: 'Super Admin (PlotPin Cadastral Desk)',
          message: message,
          timestamp: now
        } : null;
        return {
          ...tkt,
          status: status,
          adminReply: adminReply || tkt.adminReply,
          resolvedAt: resolvedAt || tkt.resolvedAt,
          replies: newReply ? [...(tkt.replies || []), newReply] : (tkt.replies || []),
          updatedAt: now
        };
      }
      return tkt;
    };

    setAdminTickets(prev => {
      const updated = prev.map(updater);
      try {
        localStorage.setItem('plotpin_admin_tickets', JSON.stringify(updated));
        localStorage.setItem('landpin_admin_tickets', JSON.stringify(updated));
      } catch (e) { }
      return updated;
    });

    setMyTickets(prev => {
      const updated = prev.map(updater);
      try {
        localStorage.setItem('plotpin_my_tickets', JSON.stringify(updated));
        localStorage.setItem('landpin_my_tickets', JSON.stringify(updated));
      } catch (e) { }
      return updated;
    });

    const auditEntry = {
      _id: 'log_' + Date.now(),
      action: 'TICKET_REPLIED',
      type: 'TICKET_REPLIED',
      actorId: 'Super Admin',
      targetId: ticketId,
      details: `Super Admin replied to support ticket #${ticketId} and marked as [${status}]`,
      timestamp: now
    };
    setAuditLogs(prev => [auditEntry, ...prev]);

    try {
      await api.replyAdminSupport(ticketId, message || adminReply, status).catch(() => { });
    } catch { }
  }, []);

  // Citizen: Create Support Grievance Ticket
  const createSupportTicket = useCallback(async (ticketData) => {
    const now = new Date().toISOString();
    const tktId = ticketData._id || 'tkt_' + Date.now();
    const newTicket = {
      _id: tktId,
      id: tktId,
      customerName: ticketData.customerName || currentUser?.name || 'Citizen Customer',
      customerPhone: ticketData.customerPhone || currentUser?.mobile || '+91 98480 12345',
      customerEmail: currentUser?.email || 'citizen@plotpin.in',
      propertyId: ticketData.propertyId || '',
      propertyTitle: ticketData.propertyTitle || 'Platform Grievance',
      subject: ticketData.subject || 'Platform Inquiry',
      message: ticketData.message || ticketData.description || '',
      description: ticketData.message || ticketData.description || '',
      category: ticketData.category || 'Cadastral Verification',
      status: 'open',
      replies: [],
      createdAt: now,
      updatedAt: now,
      ...ticketData
    };

    setAdminTickets(prev => {
      const updated = [newTicket, ...prev.filter(t => (t._id || t.id) !== tktId)];
      try {
        localStorage.setItem('plotpin_admin_tickets', JSON.stringify(updated));
        localStorage.setItem('landpin_admin_tickets', JSON.stringify(updated));
      } catch (e) { }
      return updated;
    });

    setMyTickets(prev => {
      const updated = [newTicket, ...prev.filter(t => (t._id || t.id) !== tktId)];
      try {
        localStorage.setItem('plotpin_my_tickets', JSON.stringify(updated));
        localStorage.setItem('landpin_my_tickets', JSON.stringify(updated));
      } catch (e) { }
      return updated;
    });

    const auditEntry = {
      _id: 'log_' + Date.now(),
      action: 'TICKET_CREATED',
      type: 'TICKET_CREATED',
      actorId: newTicket.customerName,
      targetId: tktId,
      details: `Support ticket #${tktId} filed: "${newTicket.subject}"`,
      timestamp: now
    };
    setAuditLogs(prev => [auditEntry, ...prev]);

    try {
      await api.createSupportTicket(ticketData);
    } catch (e) { }

    return newTicket;
  }, [currentUser]);

  useEffect(() => {
    refreshProperties();
  }, [refreshProperties]);

  useEffect(() => {
    if (isLoggedIn) {
      loadUserData();
    }
  }, [isLoggedIn, loadUserData]);

  useEffect(() => {
    if (activeRole === 'admin') {
      loadAdminData();
    }
  }, [activeRole, loadAdminData]);

  // Toggle Favorite (Wishlist) - Requires authentication
  const handleToggleFavorite = useCallback(async (e, propId) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!requireAuth('Please sign in to save properties to your wishlist')) return;
    if (!propId) return;

    setFavoriteIds((prev) => {
      const isAlreadyFav = prev.includes(propId);
      if (isAlreadyFav) {
        showToast('Removed from Saved Wishlist');
        return prev.filter((id) => id !== propId);
      } else {
        showToast('❤️ Saved to your Wishlist!');
        return [...prev, propId];
      }
    });

    if (isLoggedIn) {
      try {
        await api.toggleFavorite(propId);
      } catch (err) {
        console.warn('Backend favorite sync notice:', err);
      }
    }
  }, [isLoggedIn, showToast]);

  // Comparison Management
  const addToComparison = useCallback((prop) => {
    if (!prop) return;
    setComparisonList((prev) => {
      const propKey = prop._id || prop.id;
      if (prev.some((p) => (p._id || p.id) === propKey)) {
        showToast('Property already in comparison');
        return prev;
      }
      if (prev.length >= 3) {
        showToast('You can compare a maximum of 3 properties');
        return prev;
      }
      const updated = [...prev, prop];
      if (updated.length >= 2) {
        showToast(`Comparing ${updated.length} properties side-by-side!`);
      } else {
        showToast(`Added to comparison (1/3). Select another to compare.`);
      }
      return updated;
    });
  }, [showToast]);

  const removeFromComparison = useCallback((propId) => {
    setComparisonList((prev) => prev.filter((p) => (p._id || p.id) !== propId));
  }, []);

  const clearComparison = useCallback(() => {
    setComparisonList([]);
    showToast('Comparison list cleared');
  }, [showToast]);

  const handleOpenDetailModal = useCallback((prop) => {
    setSelectedProperty(prop);
    setShowDetailModal(true);
  }, []);

  const handleOpenVisitModal = useCallback((prop) => {
    if (!requireAuth('Please sign in to schedule a certified site visit')) return;
    if (prop) setSelectedProperty(prop);
    setShowVisitModal(true);
  }, [requireAuth]);

  const handleOpenCallModal = useCallback((prop) => {
    if (!requireAuth('Please sign in to request an official mediation call')) return;
    if (prop) setSelectedProperty(prop);
    setShowCallModal(true);
  }, [requireAuth]);

  const handleOpenEscrowModal = useCallback((prop) => {
    if (!requireAuth('Please sign in to initiate legal token escrow')) return;
    if (prop) setSelectedProperty(prop);
    setShowEscrowModal(true);
  }, [requireAuth]);

  const handleOpenCreateModal = useCallback(() => {
    if (!requireAuth('Please sign in with mobile to post or list a property')) return;
    setShowCreateModal(true);
  }, [requireAuth]);

  const handleOpenTicketModal = useCallback((prop = null) => {
    if (!requireAuth('Please sign in to file an official complaint or dispute')) return;
    setTicketProperty(prop);
    setShowTicketModal(true);
  }, [requireAuth]);

  const handleOpenDeedModal = useCallback((prop) => {
    setSelectedDeedProperty(prop);
    setShowDeedModal(true);
  }, []);

  const handleOpen3DModal = useCallback((prop) => {
    setSelected3DProperty(prop);
    setShow3DModal(true);
  }, []);

  return (
    <PropertyContext.Provider
      value={{
        windowWidth,
        deviceMode,
        setDeviceMode,
        isMobile,
        properties: publicProperties,
        rawProperties: properties,
        isOwnerOfProperty,
        setProperties,
        loadingProperties,
        propertiesError,
        refreshProperties,
        myProperties,
        setMyProperties,
        myAppointments,
        setMyAppointments,
        myCallRequests,
        setMyCallRequests,
        favoriteIds,
        setFavoriteIds,
        handleToggleFavorite,
        myBuyings,
        setMyBuyings,
        myTickets,
        setMyTickets,
        loadUserData,
        adminKpis,
        adminQueue,
        setAdminQueue,
        adminApprovedProperties,
        setAdminApprovedProperties,
        auditLogs,
        adminEscrows,
        adminTickets,
        setAdminTickets,
        adminCalls,
        setAdminCalls,
        adminAppointments,
        setAdminAppointments,
        adminCustomers,
        setAdminCustomers,
        loadAdminData,
        updatePropertyStatus,
        editProperty,
        submitPropertyEditForVerification,
        submitNewPropertyListing,
        approveVerification,
        rejectVerification,
        publishNewProperty,
        updateBookingStatus,
        scheduleNewBooking,
        createSiteVisitBooking,
        createDirectCallRequest,
        updateCallRecord,
        replySupportTicket,
        createSupportTicket,
        selectedCategory,
        setSelectedCategory,
        searchQuery,
        setSearchQuery,
        bhkFilter,
        setBhkFilter,
        priceRange,
        setPriceRange,
        sortBy,
        setSortBy,
        purposeFilter,
        setPurposeFilter,
        userLocation,
        setUserLocation,
        radiusKm,
        setRadiusKm,
        comparisonList,
        setComparisonList,
        addToComparison,
        removeFromComparison,
        clearComparison,
        selectedProperty,
        setSelectedProperty,
        showDetailModal,
        setShowDetailModal,
        showCreateModal,
        setShowCreateModal,
        showComparisonModal,
        setShowComparisonModal,
        showLocationPicker,
        setShowLocationPicker,
        showEscrowModal,
        setShowEscrowModal,
        showDeedModal,
        setShowDeedModal,
        selectedDeedProperty,
        setSelectedDeedProperty,
        show3DModal,
        setShow3DModal,
        selected3DProperty,
        setSelected3DProperty,
        showVisitModal,
        setShowVisitModal,
        showCallModal,
        setShowCallModal,
        showTicketModal,
        setShowTicketModal,
        ticketProperty,
        setTicketProperty,
        showRescheduleModal,
        setShowRescheduleModal,
        rescheduleTarget,
        setRescheduleTarget,
        handleOpenDetailModal,
        handleOpenVisitModal,
        handleOpenCallModal,
        handleOpenEscrowModal,
        handleOpenCreateModal,
        handleOpenTicketModal,
        handleOpenDeedModal,
        handleOpen3DModal
      }}
    >
      {children}
    </PropertyContext.Provider>
  );
}

export function useProperty() {
  const context = useContext(PropertyContext);
  if (!context) {
    throw new Error('useProperty must be used within a PropertyProvider');
  }
  return context;
}

