import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Building2, Search, MapPin, Compass, Shield, Heart, User, CheckCircle2,
  AlertCircle, Clock, FileText, Phone, Send, Plus, Eye, Check, X,
  Sparkles, RefreshCw, Smartphone, Monitor, ChevronRight, ChevronLeft, ChevronDown, Layers, Lock,
  Navigation, MessageCircle, BadgePercent, Trees, Home, Store, ArrowRight,
  ShieldCheck, ShieldAlert, Calendar, Filter, Users, MessageSquare, AlertTriangle,
  CreditCard, Headphones, Scale, Ban, CheckCircle, HelpCircle, PhoneCall,
  BookmarkCheck, Star, DollarSign, Award, CheckSquare, Box, ArrowUpDown, ImageOff,
  Loader2, Edit3, Archive, Bell, Bookmark, Trash2, BedDouble, LogIn, LogOut,
  Sun, Moon
} from 'lucide-react';
import LandPinLogo from './components/common/LandPinLogo';
import { api } from './lib/api';
import PropertyMap from './components/maps/PropertyMap';
import PropertyDetailModal from './components/property/PropertyDetailModal';
import EscrowModal from './components/property/EscrowModal';
import CreatePropertyModal from './components/forms/CreatePropertyModal';
import PropertyComparisonModal from './components/property/PropertyComparisonModal';
import LocationPickerModal, { reverseGeocode } from './components/common/LocationPickerModal';
import HeroEstate3D from './components/3d/HeroEstate3D';
import PropertyViewer3DModal from './components/3d/PropertyViewer3DModal';
import SpatialPropertyMap3D from './components/3d/SpatialPropertyMap3D';
import DeedViewerModal from './components/property/DeedViewerModal';
import AppointmentsCalendarView from './components/property/AppointmentsCalendarView';
import RescheduleVisitModal from './components/property/RescheduleVisitModal';
import AuthModal from './components/auth/AuthModal';
import UserProfileModal from './components/profile/UserProfileModal';
import { supabase, storage } from './lib/supabase';
import useDebounce from './hooks/useDebounce';

// Haversine distance calculator in KM
function calcDistanceKm(lat1, lon1, lat2, lon2) {
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
function getPropertyLatLng(prop) {
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

const BANGALORE_LOCALITIES = [
  { name: 'Indiranagar Core (100ft & Defense Colony)', lat: 12.9784, lng: 77.6412 },
  { name: 'Defense Colony, Indiranagar', lat: 12.9795, lng: 77.6435 },
  { name: 'Koramangala 4th Block (80ft Road)', lat: 12.9352, lng: 77.6271 },
  { name: 'Koramangala 5th & 6th Block', lat: 12.9340, lng: 77.6180 },
  { name: 'Whitefield (ITPL & Hope Farm)', lat: 12.9698, lng: 77.7499 },
  { name: 'HSR Layout Sector 1 & 2', lat: 12.9121, lng: 77.6446 },
  { name: 'Bommasandra Industrial & Hosur Rd', lat: 12.8184, lng: 77.6892 },
  { name: 'Electronic City Phase 1 & 2', lat: 12.8399, lng: 77.6770 },
  { name: 'Jayanagar 4th Block', lat: 12.9250, lng: 77.5938 },
  { name: 'JP Nagar Phase 1 to 7', lat: 12.9063, lng: 77.5857 },
  { name: 'BTM Layout 2nd Stage', lat: 12.9166, lng: 77.6101 },
  { name: 'Hebbal & Manyata Tech Park', lat: 13.0358, lng: 77.5970 },
  { name: 'Bellary Road Corridor', lat: 13.0500, lng: 77.5920 },
  { name: 'Marathahalli Bridge', lat: 12.9591, lng: 77.6974 },
  { name: 'Bellandur EcoSpace Corridor', lat: 12.9279, lng: 77.6784 },
  { name: 'Sarjapur Road (Wipro Gate)', lat: 12.9080, lng: 77.6800 },
  { name: 'Yelahanka New Town', lat: 13.1007, lng: 77.5963 },
  { name: 'Malleshwaram 8th Cross', lat: 13.0031, lng: 77.5643 },
  { name: 'Rajajinagar 1st Block', lat: 12.9982, lng: 77.5530 },
  { name: 'Banashankari 3rd Stage', lat: 12.9255, lng: 77.5468 },
  { name: 'MG Road & Brigade Road CBD', lat: 12.9756, lng: 77.6066 },
  { name: 'Domlur & EGL Tech Park', lat: 12.9609, lng: 77.6387 },
  { name: 'Ulsoor / Halasuru Lake', lat: 12.9817, lng: 77.6285 },
  { name: 'Old Airport Road & HAL', lat: 12.9600, lng: 77.6500 },
  { name: 'Cunningham Road & Vasanth Nagar', lat: 12.9890, lng: 77.5930 }
];

async function resolveLocationCoordinates(query) {
  if (!query || !query.trim()) return null;
  const clean = query.trim().toLowerCase();

  // 1. Direct dictionary match
  const found = BANGALORE_LOCALITIES.find(l =>
    l.name.toLowerCase().includes(clean) || clean.includes(l.name.toLowerCase().split(' ')[0])
  );
  if (found) return found;

  // 2. OpenStreetMap Nominatim live search for any typed locality or address
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', Bengaluru')}`);
    const data = await res.json();
    if (data && data.length > 0) {
      return {
        name: data[0].display_name.split(',').slice(0, 2).join(','),
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
      };
    }
  } catch (e) {
    // offline fallback
  }

  // If location cannot be resolved, return null rather than silently defaulting to Bengaluru coordinates
  return null;
}


export default function App() {
  // Screen width resolution tracking
  const [windowWidth, setWindowWidth] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1200));

  // Device Mode: 'desktop' | 'mobile' (auto-detects real mobile screens on load)
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

  // Unified Architecture:
  // 'user': Single Unified User Account (Vikramaditya Rao) can buy, sell, rent, view maps, post listings, make offers
  // 'admin': Regional Administrator & Legal Concierge Mediator (Verifications, Mediation Calls, Escrows, Support Helpdesk)
  const [activeRole, setActiveRole] = useState('user');

  // Active View Tab for Unified User: 'explore' | 'map' | 'ai' | 'mylistings' | 'saved' | 'visits'
  const [activeTab, setActiveTab] = useState('explore');

  // Active Sub-Tab for Admin Portal: 'verifications' | 'calls' | 'escrows' | 'support' | 'audit'
  const [adminSubTab, setAdminSubTab] = useState('verifications');

  // Unified Portfolio Sub-Tab: 'listings' | 'buyings'
  const [portfolioSubTab, setPortfolioSubTab] = useState('listings');

  // Ref for main application viewport container
  const mainScrollRef = useRef(null);

  // Bulletproof Scroll-to-Top utility across all modules, roles, and viewport modes
  const scrollToTop = useCallback((instant = true) => {
    // 1. Direct container ref (.app-scroll-body in mobile mockup and responsive modes)
    if (mainScrollRef.current) {
      try {
        if (instant) {
          mainScrollRef.current.scrollTop = 0;
        } else {
          mainScrollRef.current.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
        }
      } catch (e) {
        mainScrollRef.current.scrollTop = 0;
      }
    }

    // 2. Global window and document root (desktop view and native mobile screens)
    if (typeof window !== 'undefined') {
      try {
        if (instant) {
          window.scrollTo(0, 0);
        } else {
          window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
        }
      } catch (e) {
        window.scroll(0, 0);
      }
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
    }

    // 3. Fallback for all scrollable view containers
    try {
      const scrollContainers = document.querySelectorAll(
        '.app-scroll-body, .phone-mockup-frame, .desktop-app-view, .custom-smooth-scrollbar'
      );
      scrollContainers.forEach((container) => {
        if (container) container.scrollTop = 0;
      });
    } catch (e) {
      // ignore DOM query fallback errors
    }
  }, []);

  // Universal effect: Guarantee top scroll whenever tab, role, sub-tab, or device mode changes
  useEffect(() => {
    scrollToTop(true);
    const r1 = requestAnimationFrame(() => scrollToTop(true));
    const r2 = requestAnimationFrame(() => requestAnimationFrame(() => scrollToTop(true)));
    const t = setTimeout(() => scrollToTop(true), 40);
    return () => {
      cancelAnimationFrame(r1);
      cancelAnimationFrame(r2);
      clearTimeout(t);
    };
  }, [activeRole, activeTab, adminSubTab, portfolioSubTab, deviceMode, scrollToTop]);

  // Light / Dark Theme State
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('landpin_theme');
      if (saved === 'dark' || saved === 'light') return saved;
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    }
    return 'light';
  });

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
    localStorage.setItem('landpin_theme', theme);
  }, [theme]);

  // Authentication & Current User State
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('login'); // 'login' | 'signup' | 'forgot' | 'reset'
  const [authResetEmail, setAuthResetEmail] = useState('');
  const [authResetToken, setAuthResetToken] = useState('');
  const [authResetOtp, setAuthResetOtp] = useState('');

  // Detect Email Verification & Password Reset Action Links from Email (Resend SMTP / OTP)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const url = new URL(window.location.href);
      const action = url.searchParams.get('action');
      const email = url.searchParams.get('email');
      const token = url.searchParams.get('token');
      const otp = url.searchParams.get('otp');
      const hash = window.location.hash || '';

      if (action === 'reset-password' || hash.includes('type=recovery')) {
        if (email) setAuthResetEmail(decodeURIComponent(email));
        if (token) setAuthResetToken(token);
        if (otp) setAuthResetOtp(otp);
        setAuthModalMode('forgot');
        setShowAuthModal(true);
        // Scrub token & OTP from address bar for security
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (action === 'verify-email') {
        const cleanEmail = email ? decodeURIComponent(email) : '';
        if (cleanEmail) {
          setAuthResetEmail(cleanEmail);
          if (token || otp) {
            api.verifyEmail({ email: cleanEmail, token, otp })
              .then((res) => {
                alert(res.message || 'Email verified successfully! You can now log in.');
              })
              .catch((err) => {
                console.warn('Auto verify email note:', err.message);
              });
          }
        }
        setAuthModalMode('login');
        setShowAuthModal(true);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch (e) {
      // Ignore URL parsing fallback
    }
  }, []);

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      try {
        const token = localStorage.getItem('auth_token');
        const stored = localStorage.getItem('auth_user');
        if (token && stored) return JSON.parse(stored);
      } catch (e) {}
    }
    return null; // Guest Citizen by default if not signed in!
  });

  const isLoggedIn = useMemo(() => {
    return Boolean(
      currentUser && 
      currentUser._id && 
      currentUser._id !== 'usr_guest' && 
      (typeof localStorage !== 'undefined' ? Boolean(localStorage.getItem('auth_token')) : false)
    );
  }, [currentUser]);

  const userInitials = useMemo(() => {
    if (!currentUser || !currentUser.name) return 'LP';
    const parts = currentUser.name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }, [currentUser]);

  const requireAuth = useCallback((reason = 'Please sign in with your mobile number to continue') => {
    if (!isLoggedIn) {
      showToast(`🔒 ${reason}`);
      setAuthModalMode('login');
      setShowAuthModal(true);
      return false;
    }
    return true;
  }, [isLoggedIn]);

  const handleOpenVisitModal = (prop) => {
    if (!requireAuth('Please sign in to schedule a certified site visit')) return;
    if (prop) setSelectedProperty(prop);
    setShowVisitModal(true);
  };

  const handleOpenCallModal = (prop) => {
    if (!requireAuth('Please sign in to request an official mediation call')) return;
    if (prop) setSelectedProperty(prop);
    setShowCallModal(true);
  };

  const handleOpenEscrowModal = (prop) => {
    if (!requireAuth('Please sign in to initiate legal token escrow')) return;
    if (prop) setSelectedProperty(prop);
    setShowEscrowModal(true);
  };

  const handleOpenCreateModal = () => {
    if (!requireAuth('Please sign in with mobile to post or list a property')) return;
    setShowCreateModal(true);
  };

  const handleOpenTicketModal = (prop = null) => {
    if (!requireAuth('Please sign in to file an official complaint or dispute')) return;
    setTicketProperty(prop);
    setShowTicketModal(true);
  };

  const handleOpenProfileModal = () => {
    if (!requireAuth('Please sign in to view your profile and account details')) return;
    setShowProfileModal(true);
  };

  const handleUpdateProfile = (updated) => {
    setCurrentUser(updated);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('auth_user', JSON.stringify(updated));
    }
    showToast('✅ Profile updated successfully!');
  };

  const handleAuthSuccess = async (user) => {
    setCurrentUser(user);
    const userRole = (user.roles && user.roles.includes('admin')) ? 'admin' : 'user';
    setActiveRole(userRole);
    showToast(`✅ Welcome, ${user.name || 'Citizen'}! Signed in successfully.`);
    if (userRole === 'admin') {
      await loadAdminData();
    } else {
      await loadUserData();
    }
  };

  const handleLogout = () => {
    api.logout();
    setCurrentUser(null);
    showToast('👋 Signed out successfully');
    setShowProfileMenu(false);
    setShowDesktopProfileMenu(false);
    setShowProfileModal(false);
    setActiveTab('explore');
  };

  // Admin Mediation Sub-Tabs & Archive States: 'calls' | 'visits'
  const [adminMediationView, setAdminMediationView] = useState('calls');
  const [showArchivedCalls, setShowArchivedCalls] = useState(false);
  const [showArchivedVisits, setShowArchivedVisits] = useState(false);

  // Data States
  const [properties, setProperties] = useState([]);
  const [myProperties, setMyProperties] = useState([]);
  const [favoriteIds, setFavoriteIds] = useState([]);
  const [myAppointments, setMyAppointments] = useState([]);
  const [myCallRequests, setMyCallRequests] = useState([]);
  const [adminQueue, setAdminQueue] = useState([]);
  const [adminKpis, setAdminKpis] = useState({
    pendingReviewCount: 0,
    approvedCount: 0,
    publishedCount: 0,
    totalUsers: 0,
    activeInquiries: 0,
    scheduledAppointments: 0,
    activeMediationCallsCount: 0,
    activeDealsCount: 0
  });
  const [auditLogs, setAuditLogs] = useState([]);
  const [aiResults, setAiResults] = useState([]);
  const [toastMessage, setToastMessage] = useState(null);

  // Admin Specific Collections (Only User & Admin - Zero Brokers, Direct Admin Mediation)
  const [adminEscrows, setAdminEscrows] = useState([]);
  const [adminTickets, setAdminTickets] = useState([]);
  const [adminCalls, setAdminCalls] = useState([]);
  const [adminAppointments, setAdminAppointments] = useState([]);
  const [adminApprovedProperties, setAdminApprovedProperties] = useState([]);
  const [adminApprovedSearch, setAdminApprovedSearch] = useState('');
  const [adminApprovedFilter, setAdminApprovedFilter] = useState('all'); // 'all' | 'published' | 'suspended'

  // Sorted My Properties: Live & Pending at the top; Sold & Rented at the bottom; Most recently updated first
  const sortedMyProperties = useMemo(() => {
    return [...myProperties].sort((a, b) => {
      const aIsClosed = a.availabilityStatus === 'sold' || a.availabilityStatus === 'rented' || a.publicationStatus === 'completed';
      const bIsClosed = b.availabilityStatus === 'sold' || b.availabilityStatus === 'rented' || b.publicationStatus === 'completed';
      if (!aIsClosed && bIsClosed) return -1;
      if (aIsClosed && !bIsClosed) return 1;
      const timeA = new Date(a.updatedAt || a.updated_at || a.createdAt || a.created_at || 0).getTime();
      const timeB = new Date(b.updatedAt || b.updated_at || b.createdAt || b.created_at || 0).getTime();
      return timeB - timeA;
    });
  }, [myProperties]);

  // Admin Search & Filter for Approved / Live Properties
  const filteredAdminApprovedProperties = useMemo(() => {
    let list = adminApprovedProperties || [];
    if (adminApprovedFilter === 'published') {
      list = list.filter(p => p.publicationStatus === 'published' && p.availabilityStatus !== 'suspended');
    } else if (adminApprovedFilter === 'suspended') {
      list = list.filter(p => p.publicationStatus === 'suspended' || p.availabilityStatus === 'suspended');
    }

    if (adminApprovedSearch && adminApprovedSearch.trim()) {
      const q = adminApprovedSearch.trim().toLowerCase();
      list = list.filter(p => {
        const titleMatch = (p.title || '').toLowerCase().includes(q);
        const idMatch = (p._id || p.id || '').toLowerCase().includes(q);
        const localityMatch = (p.location?.locality || '').toLowerCase().includes(q);
        const cityMatch = (p.location?.city || '').toLowerCase().includes(q);
        const addressMatch = (p.location?.address || '').toLowerCase().includes(q);
        const surveyMatch = (p.landDetails?.surveyNumber || '').toLowerCase().includes(q);
        const ownerMatch = (p.ownerName || '').toLowerCase().includes(q);
        const phoneMatch = (p.ownerPhone || '').toLowerCase().includes(q);
        const propTypeMatch = (p.propertyType || p.category || '').toLowerCase().includes(q);
        return titleMatch || idMatch || localityMatch || cityMatch || addressMatch || surveyMatch || ownerMatch || phoneMatch || propTypeMatch;
      });
    }
    return list;
  }, [adminApprovedProperties, adminApprovedFilter, adminApprovedSearch]);

  // Search, Purpose & Category Filters
  const [searchPurpose, setSearchPurpose] = useState('sale'); // 'sale' | 'rent'
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all'); // 'all' | 'house' | 'flat' | 'plot' | 'shop'
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 250);
  const [sortBy, setSortBy] = useState('distance'); // 'distance' | 'relevance' | 'price_asc' | 'price_desc'

  // Real-Time GPS & Manual Typed Location State
  const [userLocation, setUserLocation] = useState({
    latitude: 16.9890,
    longitude: 82.2474,
    name: 'Surampalem, Kakinada'
  });
  const [locationInputText, setLocationInputText] = useState('Surampalem, Kakinada');
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isLiveGps, setIsLiveGps] = useState(false);

  // Property Comparison State (Compare 2-4 properties side-by-side)
  const [comparedPropertyIds, setComparedPropertyIds] = useState([]);
  const [showComparisonModal, setShowComparisonModal] = useState(false);

  // Radius Filter Geofence State (Default 500 km regional radius for instant discovery)
  const [maxRadiusKm, setMaxRadiusKm] = useState(500);
  const [inspectedAdminPropId, setInspectedAdminPropId] = useState(null);

  // Modals & Drawers
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEscrowModal, setShowEscrowModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [showCallModal, setShowCallModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showDealModal, setShowDealModal] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [propertyToRemove, setPropertyToRemove] = useState(null);
  const [isRemovingProperty, setIsRemovingProperty] = useState(false);
  const [rejectingProperty, setRejectingProperty] = useState(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showDesktopProfileMenu, setShowDesktopProfileMenu] = useState(false);

  // 3D Experience States
  const [showProperty3DModal, setShowProperty3DModal] = useState(false);
  const [property3DTarget, setProperty3DTarget] = useState(null);
  const [mapMode3D, setMapMode3D] = useState(false);

  const handleLaunch3DTour = (property) => {
    setProperty3DTarget(property);
    setShowProperty3DModal(true);
  };

  // Curated Available Time Slots for Cadastral Site Visits
  const VISIT_TIME_SLOTS = [
    { id: '10:00-11:00', label: '10:00 AM – 11:00 AM (Morning)', startH: 10, startM: 0, endH: 11, endM: 0 },
    { id: '11:30-12:30', label: '11:30 AM – 12:30 PM (Mid-Day)', startH: 11, startM: 30, endH: 12, endM: 30 },
    { id: '14:00-15:00', label: '02:00 PM – 03:00 PM (Afternoon)', startH: 14, startM: 0, endH: 15, endM: 0 },
    { id: '16:00-17:00', label: '04:00 PM – 05:00 PM (Late Afternoon)', startH: 16, startM: 0, endH: 17, endM: 0 },
    { id: '17:30-18:30', label: '05:30 PM – 06:30 PM (Sunset Viewing)', startH: 17, startM: 30, endH: 18, endM: 30 }
  ];

  const getTomorrowString = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const getMaxBookingDateString = () => {
    const d = new Date();
    d.setDate(d.getDate() + 60);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const [visitDate, setVisitDate] = useState(getTomorrowString());
  const [visitTimeSlot, setVisitTimeSlot] = useState('10:00-11:00');
  const [visitNotes, setVisitNotes] = useState('Admin-mediated site visit with cadastral boundary stone inspection');
  const [isBookingVisit, setIsBookingVisit] = useState(false);
  const [cancellingAptId, setCancellingAptId] = useState(null);
  const [isRequestingCall, setIsRequestingCall] = useState(false);

  // Call Request State
  const [callTimeSlot, setCallTimeSlot] = useState('Today afternoon (2:00 PM - 5:00 PM)');
  const [callPhone, setCallPhone] = useState('+91 98450 49120');
  const [callNote, setCallNote] = useState('Requesting callback regarding e-Khata verification & final price');

  // Deal Completion State
  const [dealOutcome, setDealOutcome] = useState('sold'); // 'sold' | 'rented'
  const [dealBuyerName, setDealBuyerName] = useState('Pooja Hegde');
  const [dealFinalPrice, setDealFinalPrice] = useState('');

  // Citizen Buyings & Support Ticket States
  const [myBuyings, setMyBuyings] = useState([]);
  const [myTickets, setMyTickets] = useState([]);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [ticketProperty, setTicketProperty] = useState(null);
  const [ticketCategory, setTicketCategory] = useState('title_dispute');
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);

  // Admin Interactive Modals
  const [selectedAdminTicket, setSelectedAdminTicket] = useState(null);
  const [ticketReplyText, setTicketReplyText] = useState('');
  const [ticketNewStatus, setTicketNewStatus] = useState('in_progress');
  const [adminTicketFilter, setAdminTicketFilter] = useState('pending'); // 'pending' | 'resolved'

  // Deed Preview & Property Edit States
  const [selectedDeedPreview, setSelectedDeedPreview] = useState(null);
  const [deedModalPage, setDeedModalPage] = useState(1);
  const [editingProperty, setEditingProperty] = useState(null);

  // Visits & Appointments View Mode: 'list' | 'calendar'
  const [visitViewMode, setVisitViewMode] = useState('list');
  const [reschedulingApt, setReschedulingApt] = useState(null);

  // AI Match Predictor Choice States
  const [aiPurpose, setAiPurpose] = useState('sale'); // 'sale' | 'rent'
  const [aiLocation, setAiLocation] = useState('all'); // 'all' | locality name
  const [aiPropertyType, setAiPropertyType] = useState('all'); // 'all' | 'house' | 'flat' | 'plot' | 'shop' | 'agricultural' | 'pg'
  const [aiBudget, setAiBudget] = useState('all'); // 'all' | budget tier string
  const [isAiLoading, setIsAiLoading] = useState(false);

  // On initial mount, attempt real-time GPS detection if permission is already granted
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;
          const detectedName = await reverseGeocode(latitude, longitude);
          setUserLocation({
            latitude,
            longitude,
            name: detectedName,
            isLiveGps: true
          });
          setLocationInputText(detectedName);
          setIsLiveGps(true);
        },
        () => {
          // Keep Indiranagar default if permission not pre-granted
        },
        { timeout: 5000, maximumAge: 300000 }
      );
    }
  }, []);

  // Initial Data Load & Role synchronization
  useEffect(() => {
    let isCancelled = false;
    const syncRoleAndData = async () => {
      await api.setRole(activeRole);
      if (isCancelled) return;
      loadPublicProperties();
      if (activeRole === 'admin') {
        await loadAdminData();
      } else {
        await loadUserData();
      }
    };
    syncRoleAndData();
    return () => { isCancelled = true; };
  }, [activeRole, searchPurpose]);

  // URL Routing & Browser Navigation State Synchronization
  const updateRouteUrl = (newRole, newTab, newSub, propId) => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams();
    const r = newRole !== undefined ? newRole : activeRole;
    const t = newTab !== undefined ? newTab : activeTab;
    const s = newSub !== undefined ? newSub : adminSubTab;
    const p = propId !== undefined ? propId : (showDetailModal && selectedProperty ? (selectedProperty._id || selectedProperty.id) : null);

    if (r === 'admin') {
      params.set('role', 'admin');
      if (s && s !== 'verifications') params.set('sub', s);
    } else {
      if (t && t !== 'explore') params.set('tab', t);
    }

    if (p) {
      params.set('property', p);
    }

    const qs = params.toString();
    const targetUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    if (window.location.search !== (qs ? `?${qs}` : '')) {
      window.history.pushState({ role: r, tab: t, sub: s, property: p }, '', targetUrl);
    }
  };

  // Synchronize on initial mount from URL query parameters
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const urlRole = params.get('role');
    const urlTab = params.get('tab');
    const urlSub = params.get('sub');

    if (urlRole === 'admin') {
      setActiveRole('admin');
      if (urlSub) setAdminSubTab(urlSub);
    } else if (urlTab) {
      setActiveTab(urlTab);
    }
  }, []);

  // Handle direct property link once properties are loaded
  useEffect(() => {
    if (typeof window === 'undefined' || properties.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const urlProp = params.get('property');
    if (urlProp) {
      const match = properties.find(p => p._id === urlProp || p.id === urlProp);
      if (match) {
        setSelectedProperty(match);
        setShowDetailModal(true);
      }
    }
  }, [properties]);

  // Synchronize browser Back and Forward navigation (popstate)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const urlRole = params.get('role');
      const urlTab = params.get('tab');
      const urlSub = params.get('sub');
      const urlProp = params.get('property');

      if (urlRole === 'admin') {
        setActiveRole('admin');
        if (urlSub) setAdminSubTab(urlSub);
      } else {
        setActiveRole('user');
        setActiveTab(urlTab || 'explore');
      }

      if (urlProp && properties.length > 0) {
        const match = properties.find(p => p._id === urlProp || p.id === urlProp);
        if (match) {
          setSelectedProperty(match);
          setShowDetailModal(true);
        }
      } else {
        setShowDetailModal(false);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [properties]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3800);
  };

  // Manual Typing Location Handler with instant suggestions
  const handleLocationInputChange = (text) => {
    setLocationInputText(text);
    if (!text.trim()) {
      setLocationSuggestions([]);
      setShowLocationSuggestions(false);
      return;
    }
    const filtered = BANGALORE_LOCALITIES.filter(l =>
      l.name.toLowerCase().includes(text.toLowerCase())
    ).slice(0, 6);
    setLocationSuggestions(filtered);
    setShowLocationSuggestions(true);
  };

  // Apply typed location
  const handleApplyTypedLocation = async (overrideText) => {
    const textToSearch = overrideText || locationInputText;
    if (!textToSearch.trim()) return;

    setShowLocationSuggestions(false);
    showToast(`🔍 Setting location to "${textToSearch}"...`);

    const resolved = await resolveLocationCoordinates(textToSearch);
    if (resolved) {
      setUserLocation({
        latitude: resolved.lat,
        longitude: resolved.lng,
        name: resolved.name
      });
      setLocationInputText(resolved.name);
      setIsLiveGps(false);
      showToast(`📍 Location set to ${resolved.name}! Properties sorted by distance.`);
    }
  };

  const handleSelectSuggestion = (sug) => {
    setUserLocation({
      latitude: sug.lat,
      longitude: sug.lng,
      name: sug.name
    });
    setLocationInputText(sug.name);
    setIsLiveGps(false);
    setShowLocationSuggestions(false);
    showToast(`📍 Center set to ${sug.name}! Properties sorted by distance.`);
  };

  // Real-Time GPS Detection Button
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by your browser');
      return;
    }

    setIsLocating(true);
    showToast('📡 Acquiring your real-time satellite GPS coordinates...');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const placeName = await reverseGeocode(latitude, longitude);
        setUserLocation({
          latitude,
          longitude,
          name: placeName,
          isLiveGps: true
        });
        setLocationInputText(placeName);
        setIsLiveGps(true);
        setIsLocating(false);
        showToast(`🎯 Real-time GPS acquired: ${placeName}! Properties recalculated.`);
      },
      (err) => {
        setIsLocating(false);
        showToast('GPS permission not available. Please type your locality or area manually.');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Property Comparison Handlers (Enforces Same-Category Equality Logic)
  const handleToggleCompare = (e, propId) => {
    if (e && e.stopPropagation) e.stopPropagation();

    // Toggle OFF if already in comparison
    if (comparedPropertyIds.includes(propId)) {
      const updated = comparedPropertyIds.filter(id => id !== propId);
      setComparedPropertyIds(updated);
      showToast('Removed from comparison');
      return;
    }

    // Find the property being added
    const targetProp = properties.find(p => (p._id || p.id) === propId);
    if (!targetProp) return;

    const targetCategory = getPropertyTypeCategory(targetProp);

    // If there is already at least 1 property selected, enforce equality logic
    if (comparedPropertyIds.length > 0) {
      const firstProp = properties.find(p => (p._id || p.id) === comparedPropertyIds[0]);
      if (firstProp) {
        const firstCategory = getPropertyTypeCategory(firstProp);
        if (firstCategory.id !== targetCategory.id) {
          showToast(
            `⚠️ Category Mismatch! You can only compare properties of the same type (${firstCategory.label}). Cannot compare ${targetCategory.label} with ${firstCategory.label}. Clear comparison first to switch.`
          );
          return;
        }
      }
    }

    // Maximum limit check
    if (comparedPropertyIds.length >= 4) {
      showToast('You can compare a maximum of 4 properties at once');
      return;
    }

    const updated = [...comparedPropertyIds, propId];
    setComparedPropertyIds(updated);
    if (updated.length === 1) {
      showToast(`Selected 1st property (${targetCategory.label}). Select 1 more ${targetCategory.label} to compare!`);
    } else {
      showToast(`Added! ${updated.length} ${targetCategory.label} ready to compare side-by-side`);
    }
  };

  // Floating Comparison Dock Renderer (Positioned responsive to mobile frame and desktop)
  const renderCompareDock = () => {
    if (comparedPropertyIds.length === 0) return null;
    const comparedList = properties.filter(p => comparedPropertyIds.includes(p._id || p.id));
    const firstProp = comparedList[0];
    const cat = firstProp ? getPropertyTypeCategory(firstProp) : null;

    if (deviceMode === 'mobile') {
      return (
        <div className="mx-3 mb-2 p-3 bg-slate-950/95 backdrop-blur-md text-white border border-slate-700/80 rounded-2xl shadow-2xl z-40 animate-in fade-in slide-in-from-bottom-2 shrink-0 space-y-2">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
              <span className="text-xs font-black text-white">
                Comparing: <span className="text-amber-300">{cat?.label || 'Properties'}</span>
              </span>
              <span className="text-[10px] bg-amber-500/20 text-amber-300 font-extrabold px-1.5 py-0.5 rounded border border-amber-500/30">
                {comparedPropertyIds.length}/4
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setComparedPropertyIds([]);
                showToast('Cleared property comparison');
              }}
              className="text-[11px] text-slate-400 hover:text-white px-1.5 py-0.5 rounded transition-colors"
            >
              Clear
            </button>
          </div>

          {/* Selected Preview Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 no-scrollbar">
            {comparedList.map((p) => (
              <div
                key={p._id || p.id}
                className="flex items-center gap-1.5 bg-slate-800/90 border border-slate-700 rounded-xl px-2 py-1 shrink-0 text-xs text-slate-200 shadow-2xs"
              >
                <div className="w-4 h-4 rounded bg-slate-700 overflow-hidden shrink-0">
                  {getFirstPropertyImageUrl(p) ? (
                    <img src={getFirstPropertyImageUrl(p)} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Building2 className="w-3 h-3 text-slate-400 m-auto" />
                  )}
                </div>
                <span className="font-bold text-[10px] max-w-[100px] truncate">{p.title}</span>
                <button
                  type="button"
                  onClick={(e) => handleToggleCompare(e, p._id || p.id)}
                  className="text-slate-400 hover:text-rose-400 p-0.5 transition-colors"
                  title="Remove"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          {/* Action Row */}
          <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between">
            {comparedPropertyIds.length >= 2 ? (
              <button
                type="button"
                onClick={() => setShowComparisonModal(true)}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2 px-3 rounded-xl text-xs font-black shadow flex items-center justify-center gap-1.5 transition-all active:scale-95"
              >
                <Scale className="w-3.5 h-3.5 text-emerald-200" />
                <span>Compare {comparedPropertyIds.length} {cat?.label} Side-by-Side</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <div className="text-[11px] text-amber-300 font-semibold italic flex items-center gap-1 py-1">
                <span>Select 1 more {cat?.badge || 'property'} to compare</span>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Desktop mode
    return (
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 backdrop-blur-md text-white border border-slate-700 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-200 max-w-[94vw] overflow-x-auto">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
          <span className="text-xs font-black text-white">
            Comparing: <span className="text-amber-300">{cat?.label || 'Properties'}</span>
          </span>
          <span className="text-[10px] bg-amber-500/20 text-amber-300 font-extrabold px-1.5 py-0.5 rounded border border-amber-500/30">
            {comparedPropertyIds.length}/4
          </span>
        </div>

        {/* Selected Preview Chips */}
        <div className="flex items-center gap-2 overflow-x-auto py-0.5 no-scrollbar max-w-sm">
          {comparedList.map((p) => (
            <div
              key={p._id || p.id}
              className="flex items-center gap-1.5 bg-slate-800/90 border border-slate-700 rounded-xl px-2 py-1 shrink-0 text-xs text-slate-200 shadow-2xs"
            >
              <div className="w-4 h-4 rounded bg-slate-700 overflow-hidden shrink-0">
                {getFirstPropertyImageUrl(p) ? (
                  <img src={getFirstPropertyImageUrl(p)} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Building2 className="w-3 h-3 text-slate-400 m-auto" />
                )}
              </div>
              <span className="font-bold text-[11px] max-w-[120px] truncate">{p.title}</span>
              <button
                type="button"
                onClick={(e) => handleToggleCompare(e, p._id || p.id)}
                className="text-slate-400 hover:text-rose-400 p-0.5 transition-colors"
                title="Remove"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {comparedPropertyIds.length >= 2 ? (
            <button
              type="button"
              onClick={() => setShowComparisonModal(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-xl text-xs font-black shadow transition-all active:scale-95 flex items-center gap-1.5"
            >
              <Scale className="w-3.5 h-3.5 text-emerald-200" />
              <span>Compare Side-by-Side</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <span className="text-[11px] text-amber-300 font-semibold italic">
              Select at least 1 more {cat?.badge}
            </span>
          )}

          <button
            type="button"
            onClick={() => {
              setComparedPropertyIds([]);
              showToast('Cleared property comparison');
            }}
            className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-lg transition-colors"
          >
            Clear
          </button>
        </div>
      </div>
    );
  };

  const loadPublicProperties = async () => {
    try {
      const data = await api.searchProperties();
      // Defense in depth: strictly filter out any sold, rented, or completed properties
      const liveOnly = (data.properties || []).filter(p =>
        p.availabilityStatus !== 'sold' &&
        p.availabilityStatus !== 'rented' &&
        p.publicationStatus !== 'completed' &&
        p.availability_status !== 'sold' &&
        p.availability_status !== 'rented' &&
        p.publication_status !== 'completed'
      );
      setProperties(liveOnly);
    } catch (err) {
      console.error(err);
    }
  };

  const loadUserData = async () => {
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
      expressProps.forEach(p => propMap.set(p._id || p.id, p));

      setMyProperties(Array.from(propMap.values()));
      setMyAppointments(aptsData.appointments || []);
      setMyCallRequests(callsData.callRequests || []);
      setFavoriteIds(favsData.favoriteIds || []);
      setMyBuyings(buyingsData.buyings || []);
      setMyTickets(ticketsData.tickets || []);
    } catch (err) {
      console.error('Failed loading authoritative user data:', err);
    }
  };

  const loadAdminData = async () => {
    try {
      const [overviewData, queueData, logsData, escrowsData, supportData, callsData, aptsData, approvedData] = await Promise.all([
        api.getAdminOverview().catch(() => ({ kpis: {} })),
        api.getReviewQueue().catch(() => ({ properties: [] })),
        api.getAuditLogs().catch(() => ({ logs: [] })),
        api.getAdminEscrows().catch(() => ({ escrows: [] })),
        api.getAdminSupport().catch(() => ({ tickets: [] })),
        api.getCallRequests().catch(() => ({ callRequests: [] })),
        api.getAppointments().catch(() => ({ appointments: [] })),
        api.getApprovedProperties().catch(() => ({ properties: [] }))
      ]);
      if (overviewData.kpis) setAdminKpis(overviewData.kpis);

      const expressQueue = queueData.properties || [];
      const qMap = new Map();
      expressQueue.forEach(p => qMap.set(p._id || p.id, p));

      const sortedQueue = Array.from(qMap.values()).sort((a, b) => {
        const timeA = new Date(a.updatedAt || a.updated_at || a.createdAt || a.created_at || 0).getTime();
        const timeB = new Date(b.updatedAt || b.updated_at || b.createdAt || b.created_at || 0).getTime();
        return timeB - timeA;
      });

      setAdminQueue(sortedQueue);
      setAdminApprovedProperties(approvedData.properties || []);
      setAuditLogs(logsData.logs || []);
      setAdminEscrows(escrowsData.escrows || []);
      setAdminTickets(supportData.tickets || []);
      setAdminCalls(callsData.callRequests || []);
      setAdminAppointments(aptsData.appointments || []);
    } catch (err) {
      console.error('Failed loading authoritative admin data:', err);
    }
  };

  // Toggle Favorite
  const handleToggleFavorite = async (e, propId) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!requireAuth('Please sign in with your mobile number to save properties to your favorites')) return;
    try {
      const res = await api.toggleFavorite(propId);
      if (res.favorited) {
        setFavoriteIds([...favoriteIds, propId]);
        showToast('❤️ Saved to your Favorites!');
      } else {
        setFavoriteIds(favoriteIds.filter(id => id !== propId));
        showToast('Removed from Favorites');
      }
    } catch (err) {
      showToast('Could not update favorites');
    }
  };

  // AI Match Predictor & Multi-Criteria Ranking Engine
  const runStructuredAiRanking = async (overrides = {}) => {
    setIsAiLoading(true);
    const purpose = overrides.purpose || aiPurpose;
    const location = overrides.location !== undefined ? overrides.location : aiLocation;
    const propType = overrides.propertyType !== undefined ? overrides.propertyType : aiPropertyType;
    const budget = overrides.budget !== undefined ? overrides.budget : aiBudget;

    showToast(`🤖 AI Match Predictor: Scoring ${purpose === 'sale' ? 'Sale' : 'Rent'} listings...`);

    try {
      // 1. Gather all candidate properties - strictly exclude sold, rented, or completed
      const candidates = properties.filter(p => {
        if (currentUser?._id && (p.ownerId === currentUser._id || p.owner_id === currentUser._id)) return false;
        if (p.availabilityStatus && p.availabilityStatus !== 'available') return false;
        if (p.availability_status && p.availability_status !== 'available') return false;
        if (p.publicationStatus === 'completed' || p.publication_status === 'completed') return false;
        if (p.purpose !== purpose) return false;
        // Strictly exclude PG if Sale
        if (purpose === 'sale' && (p.propertyType === 'pg' || p.propertyType === 'hostel' || p.category === 'pg' || p.category === 'hostel')) return false;
        return true;
      });

      if (candidates.length === 0) {
        setAiResults([]);
        showToast(`No verified ${purpose === 'sale' ? 'Sale' : 'Rental'} listings found matching active criteria.`);
        setIsAiLoading(false);
        return;
      }

      // 2. Budget range limits
      let budgetMin = 0;
      let budgetMax = Infinity;
      if (purpose === 'sale') {
        if (budget === 'under_50l') { budgetMax = 5000000; }
        else if (budget === '50l_1cr') { budgetMin = 5000000; budgetMax = 10000000; }
        else if (budget === '1cr_2.5cr') { budgetMin = 10000000; budgetMax = 25000000; }
        else if (budget === '2.5cr_5cr') { budgetMin = 25000000; budgetMax = 50000000; }
        else if (budget === 'above_5cr') { budgetMin = 50000000; }
      } else {
        if (budget === 'under_15k') { budgetMax = 15000; }
        else if (budget === '15k_30k') { budgetMin = 15000; budgetMax = 30000; }
        else if (budget === '30k_60k') { budgetMin = 30000; budgetMax = 60000; }
        else if (budget === '60k_1.2l') { budgetMin = 60000; budgetMax = 120000; }
        else if (budget === 'above_1.2l') { budgetMin = 120000; }
      }

      // 3. Multi-Criteria Scoring: S = 0.35T + 0.25L + 0.25B + 0.15Q
      const ranked = candidates.map(p => {
        // Property Type Score (0.35 weight)
        let typeScore = 0.5;
        let typeMatched = false;
        if (propType === 'all') {
          typeScore = 0.90;
          typeMatched = true;
        } else {
          if (propType === 'flat' && (p.propertyType === 'flat' || p.propertyType === 'apartment' || (p.category === 'residential' && !p.propertyType))) {
            typeScore = 1.0; typeMatched = true;
          } else if (propType === 'house' && (p.propertyType === 'house' || p.propertyType === 'villa')) {
            typeScore = 1.0; typeMatched = true;
          } else if (propType === 'plot' && (p.propertyType === 'plot' || p.category === 'land')) {
            typeScore = 1.0; typeMatched = true;
          } else if (propType === 'shop' && (p.propertyType === 'shop' || p.category === 'commercial')) {
            typeScore = 1.0; typeMatched = true;
          } else if (propType === 'agricultural' && (p.category === 'agricultural' || p.propertyType === 'farmland')) {
            typeScore = 1.0; typeMatched = true;
          } else if (propType === 'pg' && purpose === 'rent' && (p.propertyType === 'pg' || p.propertyType === 'hostel' || p.category === 'pg' || p.category === 'hostel')) {
            typeScore = 1.0; typeMatched = true;
          } else {
            typeScore = 0.25;
          }
        }

        // Location Score (0.25 weight) - Supports manual entry, tokens, and GPS area
        let locScore = 0.6;
        let locMatched = false;
        const pLocText = `${p.location?.locality || ''} ${p.location?.address || ''} ${p.location?.city || ''} ${p.location?.landmark || ''}`.toLowerCase();
        const locQuery = (location || '').trim().toLowerCase();
        if (!locQuery || locQuery === 'all') {
          locScore = 0.90;
          locMatched = true;
        } else if (pLocText.includes(locQuery) || locQuery.split(/[\s,]+/).some(token => token.length > 2 && pLocText.includes(token))) {
          locScore = 1.0;
          locMatched = true;
        } else {
          // Strictly exclude candidate if not present in the specified location
          return null;
        }

        // Budget Score (0.25 weight)
        let budgetScore = 0.6;
        let budgetMatched = false;
        const price = p.price || 0;
        if (budget === 'all') {
          budgetScore = 0.90;
          budgetMatched = true;
        } else if (price >= budgetMin && (budgetMax === Infinity || price <= budgetMax)) {
          budgetScore = 1.0;
          budgetMatched = true;
        } else if (price > budgetMax) {
          const excessRatio = (price - budgetMax) / budgetMax;
          budgetScore = Math.max(0.15, 1.0 - (excessRatio * 1.5));
        } else if (price < budgetMin) {
          const deficitRatio = (budgetMin - price) / budgetMin;
          budgetScore = Math.max(0.35, 1.0 - (deficitRatio * 0.8));
        }

        // Quality and Verification Score (0.15 weight)
        const qualityScore = (p.cadastralVerified || p.verificationStatus === 'approved' || p.verificationStatus === 'verified') ? 1.0 : 0.7;

        // Composite Final Score
        const finalScore = Number(((typeScore * 0.35) + (locScore * 0.25) + (budgetScore * 0.25) + (qualityScore * 0.15)).toFixed(3));

        // Curated Value Highlights (Clean, trustworthy, zero redundancy)
        const explanations = [];
        if (locMatched && location && location !== 'all') {
          explanations.push(`In ${location}`);
        }
        if (typeMatched && propType && propType !== 'all') {
          const typeName = p.propertyType === 'flat' ? 'Apartment' : p.propertyType === 'house' ? 'Villa / House' : (p.propertyType || p.category);
          explanations.push(`Matches ${typeName}`);
        }
        if (budgetMatched && budget && budget !== 'all') {
          explanations.push('Within Target Budget');
        }
        if (p.cadastralVerified || p.verificationStatus === 'approved' || p.verificationStatus === 'verified') {
          explanations.push('RERA & e-Khata Verified');
        }
        if (!p.brokerFee || p.brokerFee === 0) {
          explanations.push('Direct Owner · 0% Fee');
        }
        if (explanations.length === 0) {
          explanations.push('Verified Listing', 'Direct Owner');
        }

        return {
          propertyId: p._id || p.id,
          property: p,
          score: finalScore,
          scoreBreakdown: { typeScore, locScore, budgetScore, qualityScore, finalScore },
          explanation: explanations
        };
      })
        .filter(Boolean)
        .sort((a, b) => b.score - a.score);

      setAiResults(ranked);
      if (ranked.length === 0) {
        showToast(locQuery && locQuery !== 'all' ? `Not present in present location (${location})` : 'No properties found matching criteria');
      } else {
        showToast(`✨ AI Matcher ranked ${ranked.length} listings! Top match: ${Math.round((ranked[0]?.score || 0.85) * 100)}%`);
      }
    } catch (err) {
      console.error(err);
      showToast('AI ranking could not complete.');
    } finally {
      setIsAiLoading(false);
    }
  };

  // Acquire or use current GPS for AI Matcher
  const handleUseAiCurrentGps = () => {
    if (userLocation?.name && userLocation.name !== 'Bengaluru, India') {
      const cleanLoc = userLocation.name.split(',')[0].trim();
      setAiLocation(cleanLoc);
      showToast(`📍 Set AI search location to ${cleanLoc} from GPS`);
      runStructuredAiRanking({ location: cleanLoc });
      return;
    }

    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by your browser');
      return;
    }

    showToast('📡 Detecting current GPS location for AI search...');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const placeName = await reverseGeocode(latitude, longitude);
        const cleanLoc = placeName.split(',')[0].trim();
        setUserLocation({
          latitude,
          longitude,
          name: placeName,
          isLiveGps: true
        });
        setAiLocation(cleanLoc);
        showToast(`🎯 GPS Location detected: ${cleanLoc}`);
        runStructuredAiRanking({ location: cleanLoc });
      },
      () => {
        showToast('GPS unavailable. Please enter your locality manually.');
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  const triggerAiRecommendations = async (overrideParams = {}) => {
    setActiveTab('ai');
    await runStructuredAiRanking(overrideParams);
  };

  // Auto-run AI Matcher when entering AI tab if results are empty
  useEffect(() => {
    if (activeTab === 'ai' && aiResults.length === 0 && properties.length > 0) {
      runStructuredAiRanking();
    }
  }, [activeTab, properties.length]);

  // Admin Actions: Property Queue
  const handleAdminApprove = async (propOrId, payload = {}) => {
    const id = typeof propOrId === 'object' ? (propOrId._id || propOrId.id) : propOrId;
    const isRevision = typeof propOrId === 'object' ? Boolean(propOrId.isRevision || propOrId.hasPendingRevision) : false;
    const body = typeof propOrId === 'object' && isRevision
      ? { revisionId: propOrId.revisionId || propOrId.pendingRevision?._id, version: propOrId.revisionVersion || propOrId.pendingRevision?.version, ...payload }
      : payload;

    try {
      await api.approveProperty(id, body);
      showToast(isRevision ? '✓ Property revision APPROVED! Changes promoted and published.' : '✓ Property verification APPROVED & PUBLISHED! Now live in online search.');

      // Immediate state synchronization
      setAdminQueue(prev => prev.filter(p => (p._id || p.id) !== id));
      await Promise.all([loadAdminData(), loadPublicProperties(), loadUserData()]);
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    }
  };

  const handleAdminReject = async (propOrId, reason, payload = {}) => {
    const id = typeof propOrId === 'object' ? (propOrId._id || propOrId.id) : propOrId;
    const isRevision = typeof propOrId === 'object' ? Boolean(propOrId.isRevision || propOrId.hasPendingRevision) : false;
    const body = typeof propOrId === 'object' && isRevision
      ? { revisionId: propOrId.revisionId || propOrId.pendingRevision?._id, version: propOrId.revisionVersion || propOrId.pendingRevision?.version, ...payload }
      : payload;

    try {
      await api.rejectProperty(id, reason, body);
      showToast(isRevision ? 'Listing revision rejected. Last approved version restored to public discovery.' : 'Listing rejected and marked as non-eligible.');
      setRejectingProperty(null);
      setRejectionReasonInput('');
      setAdminQueue(prev => prev.filter(p => (p._id || p.id) !== id));
      await Promise.all([loadAdminData(), loadPublicProperties(), loadUserData()]);
    } catch (err) {
      showToast(`Error: ${err.message}`, 'error');
    }
  };

  const handleConfirmRemoveProperty = async () => {
    if (!propertyToRemove) return;
    setIsRemovingProperty(true);
    try {
      const id = propertyToRemove._id || propertyToRemove.id;
      await api.removeProperty(id);
      showToast('Property permanently removed from LandPin and all public discovery.');
      setPropertyToRemove(null);
      // Remove from client states immediately
      setMyProperties(prev => prev.filter(p => (p._id || p.id) !== id));
      setProperties(prev => prev.filter(p => (p._id || p.id) !== id));
      setAdminQueue(prev => prev.filter(p => (p._id || p.id) !== id));
      setAdminApprovedProperties(prev => prev.filter(p => (p._id || p.id) !== id));
      setFavoriteIds(prev => prev.filter(favId => favId !== id));
      await Promise.all([loadUserData(), loadPublicProperties(), loadAdminData()]);
    } catch (err) {
      showToast(`Error removing property: ${err.message}`, 'error');
    } finally {
      setIsRemovingProperty(false);
    }
  };

  const handleAdminPublish = async (id) => {
    try {
      await api.publishProperty(id);
      showToast('🚀 Approved property unblocked & PUBLISHED to live discovery!');
      await Promise.all([loadAdminData(), loadPublicProperties()]);
    } catch (err) {
      showToast(`Error: ${err.message}`);
    }
  };

  const handleAdminSuspend = async (propOrId, defaultReason = 'Administrative compliance suspension') => {
    const id = typeof propOrId === 'object' ? (propOrId._id || propOrId.id) : propOrId;
    const title = typeof propOrId === 'object' ? propOrId.title : 'Property';
    const reason = prompt(`Enter reason to suspend / block listing "${title}" from public visibility:`, defaultReason);
    if (reason === null) return; // User cancelled prompt
    try {
      await api.suspendProperty(id, reason || defaultReason);
      showToast(`🚫 Listing "${title}" BLOCKED & suspended from public search.`);
      await Promise.all([loadAdminData(), loadPublicProperties()]);
    } catch (err) {
      showToast(`Error suspending listing: ${err.message}`, 'error');
    }
  };

  const handleAdminRequestChanges = async (id) => {
    if (!reviewNotes) {
      showToast('Please enter review notes for the owner');
      return;
    }
    try {
      await api.requestChanges(id, reviewNotes);
      showToast('📝 Marked as Needs Changes. Review notes sent to owner.');
      setShowReviewModal(false);
      setReviewNotes('');
      loadAdminData();
      loadUserData();
    } catch (err) {
      showToast(`Error: ${err.message}`);
    }
  };

  // Deal Completed (Sold / Rented) - Removes listing from active search results!
  const handleCompleteDeal = async () => {
    const targetProp = selectedProperty;
    if (!targetProp) return;
    const propId = targetProp._id || targetProp.id;
    try {
      await api.completeDeal(propId, {
        outcome: dealOutcome,
        buyerName: dealBuyerName,
        finalPrice: dealFinalPrice || targetProp.price
      });

      showToast(`🎉 Property marked as ${dealOutcome.toUpperCase()}! Automatically removed from online search & map.`);
      setShowDealModal(false);

      // Immediately filter out from active online discovery
      setProperties(prev => prev.filter(p => (p._id || p.id) !== propId));

      // Update in My Listings to show archived / deal closed
      setMyProperties(prev => prev.map(p => {
        if ((p._id || p.id) === propId) {
          return { ...p, availabilityStatus: dealOutcome, publicationStatus: 'completed' };
        }
        return p;
      }));

      await loadAdminData();
      await loadUserData();
      await loadPublicProperties();
    } catch (err) {
      showToast(`Error closing deal: ${err.message}`);
    }
  };

  // Admin Actions: Escrow & Sales (Mediated Transactions)
  const handleReleaseEscrow = async (escrowId) => {
    try {
      await api.releaseAdminEscrow(escrowId);
      showToast('💰 Escrow funds released to seller bank account following title clearance.');
      loadAdminData();
    } catch (err) {
      showToast(`Error releasing escrow: ${err.message}`);
    }
  };

  const handleFreezeEscrow = async (escrowId) => {
    try {
      await api.freezeAdminEscrow(escrowId, 'Escrow vault frozen by RERA compliance officer pending investigation');
      showToast('🔒 Escrow vault locked and frozen for dispute mediation.');
      loadAdminData();
    } catch (err) {
      showToast(`Error freezing escrow: ${err.message}`);
    }
  };

  // Admin Actions: Support Desk
  const handleReplySupportTicket = async (ticketId) => {
    if (!ticketReplyText) {
      showToast('Please enter a response message for the user');
      return;
    }
    try {
      await api.replyAdminSupport(ticketId, ticketReplyText, ticketNewStatus);
      showToast(`✅ Support response dispatched. Ticket marked as ${ticketNewStatus}.`);
      setTicketReplyText('');
      setSelectedAdminTicket(null);
      loadAdminData();
    } catch (err) {
      showToast(`Error replying to ticket: ${err.message}`);
    }
  };


  const handleAdminUpdateCallStatus = async (callId, status) => {
    try {
      await api.updateCallRequestStatus(callId, status);
      setAdminCalls(prev => prev.map(c => c._id === callId ? { ...c, status } : c));
      showToast(`📞 Mediation call marked as ${status.toUpperCase()}`);
      loadAdminData();
    } catch (err) {
      showToast(err.message || 'Failed to update call status');
    }
  };

  const handleSubmitForReview = async (id) => {
    try {
      await api.submitForReview(id);
      showToast('🚀 Submitted for RERA Cadastral Review! Admin queue updated.');
      loadUserData();
      if (activeRole === 'admin') loadAdminData();
    } catch (err) {
      showToast(`Error: ${err.message}`);
    }
  };

  // User Actions: Book Visit
  const handleBookVisit = async () => {
    if (!requireAuth('Please sign in with your mobile number to schedule a certified site visit')) return;

    if (!visitDate) {
      showToast('⚠️ Please select a visit date');
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    if (visitDate < todayStr) {
      showToast('⚠️ Cannot schedule visits in the past. Please pick a future date.');
      return;
    }

    const slot = VISIT_TIME_SLOTS.find(s => s.id === visitTimeSlot) || VISIT_TIME_SLOTS[0];
    const [year, month, day] = visitDate.split('-').map(Number);
    const startDate = new Date(year, month - 1, day, slot.startH, slot.startM, 0);
    const endDate = new Date(year, month - 1, day, slot.endH, slot.endM, 0);

    if (startDate <= new Date()) {
      showToast('⚠️ This time slot has already passed for today. Please select an upcoming slot or future date.');
      return;
    }

    const targetPropId = selectedProperty?._id || selectedProperty?.id || properties[0]?._id;

    // Invariant: A user cannot book overlapping visit appointments across ANY property
    const hasUserOverlap = myAppointments.some(a => {
      if (a.status !== 'confirmed') return false;
      const aStart = new Date(a.startAt).getTime();
      const aEnd = new Date(a.endAt || aStart + 3600000).getTime();
      return (startDate.getTime() < aEnd && endDate.getTime() > aStart);
    });

    if (hasUserOverlap) {
      showToast('⚠️ You already have a confirmed site visit scheduled during this time window. A single user cannot book overlapping bookings.');
      return;
    }

    try {
      setIsBookingVisit(true);
      await api.createAppointment({
        propertyId: targetPropId,
        startAt: startDate.toISOString(),
        endAt: endDate.toISOString(),
        notes: visitNotes || "Direct owner site visit with cadastral boundary verification"
      });
      showToast('✅ Viewing appointment confirmed! Owner & Field Surveyor alerted.');
      setShowVisitModal(false);
      await loadUserData();
    } catch (err) {
      showToast(`Appointment Error: ${err.message}`);
    } finally {
      setIsBookingVisit(false);
    }
  };

  // Role Switch Handler (Guarantees fresh JWT issuance & data synchronization)
  const handleSwitchRole = async (newRole) => {
    setActiveRole(newRole);
    await api.setRole(newRole);
    if (newRole === 'admin') {
      showToast('🛡️ Switched to LandPin Admin Desk');
      await loadAdminData();
    } else {
      setActiveTab('explore');
      showToast('👤 Citizen Account: Vikramaditya Rao');
      await loadUserData();
    }
  };

  // User Actions: Cancel an Appointment
  const handleCancelAppointment = async (aptId) => {
    try {
      setCancellingAptId(aptId);
      await api.cancelAppointment(aptId);
      showToast('Site visit appointment cancelled successfully.');
      await loadUserData();
    } catch (err) {
      showToast(`Cancellation Error: ${err.message}`);
    } finally {
      setCancellingAptId(null);
    }
  };

  // Admin Actions: Moderate Site Visit (Complete or Cancel)
  const handleAdminUpdateAppointmentStatus = async (aptId, newStatus) => {
    try {
      await api.updateAppointmentStatus(aptId, newStatus);
      showToast(`Site visit marked as ${newStatus.toUpperCase()}`);
      await loadAdminData();
      await loadUserData();
    } catch (err) {
      showToast(`Status Update Error: ${err.message}`);
    }
  };

  // User Actions: Request a Call
  const handleRequestCall = async () => {
    if (!requireAuth('Please sign in with your mobile number to request an official mediation call')) return;

    const cleanPhone = callPhone.trim();
    if (!cleanPhone || cleanPhone.length < 8) {
      showToast('⚠️ Please enter a valid contact phone number.');
      return;
    }
    const targetPropId = selectedProperty?._id || selectedProperty?.id || properties[0]?._id;
    const hasDuplicateCall = myCallRequests.some(c => {
      const isActive = (c.status === 'requested' || c.status === 'scheduled');
      const isSameTime = (c.preferredTime || '').trim().toLowerCase() === callTimeSlot.trim().toLowerCase();
      const isSameProp = (c.propertyId === targetPropId || c.propertyTitle === selectedProperty?.title);
      return isActive && isSameTime && isSameProp;
    });

    if (hasDuplicateCall) {
      showToast(`⚠️ You already have an active call request for this property during "${callTimeSlot}".`);
      return;
    }

    try {
      setIsRequestingCall(true);
      await api.createCallRequest({
        propertyId: targetPropId,
        preferredTime: callTimeSlot,
        phone: cleanPhone,
        note: callNote
      });
      showToast('📞 Direct mediation request submitted! Regional Admin Mediator will contact you and mediate with the owner.');
      setShowCallModal(false);
      await loadUserData();
    } catch (err) {
      showToast(`Call Request Error: ${err.message}`);
    } finally {
      setIsRequestingCall(false);
    }
  };

  const handleEscrowSuccess = async (offerData) => {
    setShowEscrowModal(false);
    if (!requireAuth('Please sign in with your mobile number to submit an offer')) return;
    const amt = offerData.offerAmount || 0;
    const formatted = amt >= 10000000
      ? `₹${(amt / 10000000).toFixed(2)} Cr`
      : amt >= 100000
        ? `₹${(amt / 100000).toFixed(1)} Lakh`
        : `₹${amt.toLocaleString('en-IN')}`;
    try {
      const res = await api.createOffer(offerData);
      showToast(`🎉 Direct offer of ${formatted} logged! Regional Admin will mediate terms with property owner.`);
      await loadUserData();
    } catch (e) {
      showToast(`⚠️ Offer Submission Notice: ${e.message || 'Please check your offer details'}`);
      console.error(e);
    }
  };

  // User Action: Create Dispute / Legal Support Ticket (Enforces urgent priority for sold/purchased deals)
  const handleCreateSupportTicket = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!ticketProperty) {
      showToast('⚠️ You must select an associated bought or listed property. Casual support tickets are strictly prohibited.');
      return;
    }
    if (!ticketSubject.trim()) {
      showToast('⚠️ Please enter a ticket subject');
      return;
    }
    try {
      setIsSubmittingTicket(true);
      const isDeal = Boolean(
        ticketProperty?.availabilityStatus === 'sold' ||
        ticketProperty?.status === 'completed' ||
        ticketProperty?.outcome === 'sold' ||
        ticketCategory === 'title_dispute' ||
        ticketCategory === 'escrow_clearance' ||
        ticketCategory === 'possession_delay'
      );
      const res = await api.createSupportTicket({
        subject: ticketSubject,
        details: ticketMessage || ticketSubject,
        category: ticketCategory,
        propertyId: ticketProperty?._id || ticketProperty?.id || ticketProperty?.propertyId || null,
        propertyTitle: ticketProperty?.title || ticketProperty?.propertyTitle || null,
        isSoldProperty: isDeal,
        isPurchasedProperty: isDeal,
        priority: isDeal ? 'urgent' : 'medium'
      });
      showToast(res.message || '✅ Support ticket logged! Assigned to RERA Legal Officer.');
      setShowTicketModal(false);
      setTicketSubject('');
      setTicketMessage('');
      setTicketProperty(null);
      await loadUserData();
      setActiveTab('support');
    } catch (err) {
      showToast(`Support Ticket Error: ${err.message}`);
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  const handleOpenTicketForProperty = (prop) => {
    setTicketProperty(prop);
    const isDeal = Boolean(prop?.availabilityStatus === 'sold' || prop?.status === 'completed' || prop?.outcome === 'sold');
    setTicketCategory(isDeal ? 'title_dispute' : 'document_help');
    setTicketSubject(
      isDeal
        ? `[URGENT] Post-Purchase / Sold Deed Inquiry: ${prop.title || prop.propertyTitle}`
        : `Deed / e-Khata Clarification: ${prop.title || prop.propertyTitle}`
    );
    setShowTicketModal(true);
  };

  const handleOpenNewTicket = () => {
    if (myBuyings.length === 0 && myProperties.length === 0) {
      showToast('⚠️ Support tickets are strictly restricted to verified buyers and sellers. You must have an active, sold, or bought property in your portfolio.');
      return;
    }
    const defaultProp = myBuyings[0] || myProperties[0];
    setTicketProperty(defaultProp);
    setTicketCategory('title_dispute');
    setTicketSubject(
      defaultProp
        ? `Legal & Title Inquiry: ${defaultProp.title || defaultProp.propertyTitle}`
        : ''
    );
    setTicketMessage('');
    setShowTicketModal(true);
  };

  // Create or Update Property Listing (Unified Citizen Account)
  const handleSaveProperty = async (propertyData) => {
    if (!requireAuth('Please sign in with your mobile number to post or edit a property')) return;
    try {
      if (editingProperty) {
        showToast('🚀 Submitting updates for administrative review...');
        const propId = editingProperty._id || editingProperty.id || propertyData.id || propertyData._id;
        const res = await api.updateProperty(propId, propertyData);
        setShowCreateModal(false);
        setEditingProperty(null);

        const updatedProp = {
          ...editingProperty,
          ...propertyData,
          _id: propId,
          id: propId,
          hasPendingRevision: Boolean(res?.isRevision),
          verificationStatus: res?.isRevision ? 'pending_revision' : (editingProperty.verificationStatus || 'pending_review'),
          updatedAt: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        // Immediately update user side and admin desk state
        setMyProperties(prev => prev.map(p => (p._id || p.id) === propId ? updatedProp : p));
        setAdminQueue(prev => {
          const exists = prev.some(p => (p._id || p.id) === propId);
          if (exists) return prev.map(p => (p._id || p.id) === propId ? { ...updatedProp, isRevision: Boolean(res?.isRevision), hasPendingRevision: Boolean(res?.isRevision) } : p);
          return [{ ...updatedProp, isRevision: Boolean(res?.isRevision), hasPendingRevision: Boolean(res?.isRevision) }, ...prev];
        });

        if (res?.isRevision) {
          showToast(`✅ Proposed updates submitted for admin re-verification! Listing temporarily hidden from public discovery until approved.`);
        } else {
          showToast(`✅ Listing "${propertyData.title || editingProperty.title}" updated and submitted for review.`);
        }

        await Promise.all([loadUserData(), loadAdminData(), loadPublicProperties()]);
        return;
      }

      showToast('🚀 Verifying property uniqueness & submitting listing...');
      const propId = propertyData._id || propertyData.id || `prop_${Date.now()}`;
      const ownerId = currentUser?._id;
      if (!ownerId) {
        showToast('🔒 Please sign in with your mobile number to list a property');
        setShowAuthModal(true);
        return;
      }
      const ownerName = currentUser?.name || 'Citizen Owner';
      const ownerPhone = currentUser?.mobile || '';
      const newProp = {
        ...propertyData,
        _id: propId,
        id: propId,
        ownerId,
        owner_id: ownerId,
        ownerName,
        ownerPhone,
        verificationStatus: 'pending_review',
        verification_status: 'pending_review',
        publicationStatus: 'unpublished',
        publication_status: 'unpublished',
        availabilityStatus: 'available',
        availability_status: 'available',
        createdAt: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // 1. Authoritative backend validation first: checks duplicate survey number, address, title, or GPS
      await api.createDraftProperty(newProp);

      // 2. Only after backend verifies non-duplicate, update local state & close modal
      setMyProperties(prev => [newProp, ...prev.filter(p => (p._id || p.id) !== propId)]);
      setAdminQueue(prev => [newProp, ...prev.filter(p => (p._id || p.id) !== propId)]);
      setAdminKpis(prev => prev ? { ...prev, pendingReviewCount: (prev.pendingReviewCount || 0) + 1 } : prev);

      setShowCreateModal(false);
      setActiveTab('mylistings');

      showToast(`✅ Listing "${newProp.title}" submitted! In RERA verification queue.`);

      // 3. Background re-sync to ensure exact server-client consistency
      await Promise.all([loadUserData(), loadAdminData(), loadPublicProperties()]);
    } catch (err) {
      showToast(`⚠️ Listing Not Submitted: ${err.message}`);
      throw err;
    }
  };

  // Ensure selectedCategoryFilter is reset to 'all' if PG is active and purpose becomes 'sale'
  useEffect(() => {
    if (searchPurpose === 'sale' && selectedCategoryFilter === 'pg') {
      setSelectedCategoryFilter('all');
    }
  }, [searchPurpose, selectedCategoryFilter]);

  // Dynamic Bangalore Localities (Extracted from real listings + prominent hubs)
  const availableLocalities = useMemo(() => {
    const locSet = new Set([
      'Indiranagar', 'Whitefield', 'Koramangala', 'HSR Layout',
      'Jayanagar', 'Sarjapur Road', 'Hebbal', 'Bellandur', 'Electronic City'
    ]);
    properties.forEach(p => {
      if (p.location?.locality) locSet.add(p.location.locality);
    });
    return Array.from(locSet).sort();
  }, [properties]);

  // Base Verified Properties matching active Purpose, Location Search, and Radius
  const baseActiveProperties = useMemo(() => {
    return properties
      .filter(p => {
        // Only exclude current user's own listing when browsing casually without an explicit search query
        if (!debouncedSearchQuery && currentUser?._id && currentUser._id !== 'usr_guest') {
          if (p.ownerId === currentUser._id || p.owner_id === currentUser._id) {
            return false;
          }
        }

        // Invariant: exclude sold or rented properties from public discovery
        if (p.availabilityStatus && p.availabilityStatus !== 'available') return false;

        // Purpose filter (sale vs rent)
        if (searchPurpose && p.purpose !== searchPurpose) return false;

        // Strictly exclude PG & Hostels from Sale listings (PG is Rent Only)
        if (searchPurpose === 'sale') {
          if (p.category === 'pg' || p.category === 'hostel' || p.propertyType === 'pg' || p.propertyType === 'hostel') {
            return false;
          }
        }

        // Tokenized multi-field search query matching title, description, locality, city, state, RERA ID, survey no, e-Khata, amenities
        if (debouncedSearchQuery && debouncedSearchQuery.trim()) {
          const tokens = debouncedSearchQuery.toLowerCase().trim().split(/\s+/).filter(Boolean);
          const searchableText = [
            p.title,
            p.description,
            p.propertyType,
            p.category,
            p.location?.locality,
            p.location?.address,
            p.location?.city,
            p.location?.state,
            p.location?.pincode,
            p.reraId || p.rera_id,
            p.surveyNumber || p.cadastralSurveyNumber || p.khasraNumber || p.landDetails?.surveyNumber,
            p.khataNumber || p.eKhataNumber || p.pidNumber,
            Array.isArray(p.amenities) ? p.amenities.join(' ') : ''
          ].filter(Boolean).join(' ').toLowerCase();

          const allTokensMatch = tokens.every(token => searchableText.includes(token));
          if (!allTokensMatch) return false;
        }

        return true;
      })
      .map(p => {
        const pCoords = getPropertyLatLng(p);
        const dist = (pCoords && userLocation?.latitude && userLocation?.longitude)
          ? calcDistanceKm(userLocation.latitude, userLocation.longitude, pCoords.lat, pCoords.lng)
          : null;
        return {
          ...p,
          distanceKm: dist
        };
      })
      .filter(p => {
        // If user is searching by query (e.g. location / city like "Kakinada"), do not drop by distance!
        if (debouncedSearchQuery && debouncedSearchQuery.trim()) {
          return true;
        }
        // Strict Radius filter only when browsing without search query
        if (maxRadiusKm && maxRadiusKm < 500 && p.distanceKm !== null && p.distanceKm > maxRadiusKm) {
          return false;
        }
        return true;
      });
  }, [properties, searchPurpose, debouncedSearchQuery, userLocation, maxRadiusKm, currentUser]);

  // Real-time Category Counter: Evaluates exact real-time availability for active filters
  const getCategoryCount = (catId) => {
    if (catId === 'all') return baseActiveProperties.length;
    return baseActiveProperties.filter(p => {
      if (catId === 'flat') return p.propertyType === 'flat' || p.propertyType === 'apartment' || (p.category === 'residential' && !p.propertyType);
      if (catId === 'house') return p.propertyType === 'house' || p.propertyType === 'villa';
      if (catId === 'plot') return p.propertyType === 'plot' || p.category === 'land';
      if (catId === 'shop') return p.propertyType === 'shop' || p.category === 'commercial';
      if (catId === 'agricultural') return p.category === 'agricultural' || p.propertyType === 'farmland';
      if (catId === 'pg') return searchPurpose === 'rent' && (p.propertyType === 'pg' || p.propertyType === 'hostel' || p.category === 'pg' || p.category === 'hostel');
      return false;
    }).length;
  };

  // Dynamic Official Real Estate Category Tabs with Premium Vector Icons
  const categoryTabs = useMemo(() => {
    const tabs = [
      { id: 'all', label: 'All Listings', icon: Layers, iconColor: 'text-[#184631]', bg: 'bg-emerald-50' },
      { id: 'flat', label: 'Flats & Apts', icon: Building2, iconColor: 'text-sky-700', bg: 'bg-sky-50' },
      { id: 'house', label: 'Houses & Villas', icon: Home, iconColor: 'text-amber-700', bg: 'bg-amber-50' },
      { id: 'plot', label: 'Plots & Land', icon: Compass, iconColor: 'text-purple-700', bg: 'bg-purple-50' },
      { id: 'shop', label: 'Commercial', icon: Store, iconColor: 'text-indigo-700', bg: 'bg-indigo-50' },
      { id: 'agricultural', label: 'Farmland', icon: Trees, iconColor: 'text-emerald-700', bg: 'bg-emerald-50' }
    ];
    if (searchPurpose === 'rent') {
      tabs.push({ id: 'pg', label: 'PG & Hostels', icon: BedDouble, iconColor: 'text-rose-700', bg: 'bg-rose-50' });
    }
    return tabs;
  }, [searchPurpose]);

  // Real-time matching candidate count for AI Matcher panel
  const matchingCandidateCount = useMemo(() => {
    return properties.filter(p => {
      if (currentUser?._id && (p.ownerId === currentUser._id || p.owner_id === currentUser._id)) return false;
      if (p.availabilityStatus && p.availabilityStatus !== 'available') return false;
      if (p.purpose !== aiPurpose) return false;
      if (aiPurpose === 'sale' && (p.propertyType === 'pg' || p.propertyType === 'hostel' || p.category === 'pg' || p.category === 'hostel')) return false;
      return true;
    }).length;
  }, [properties, aiPurpose, currentUser]);

  // Reactive Property Filtering by Category & Multi-Criteria Sort
  const filteredProperties = useMemo(() => {
    return baseActiveProperties
      .filter(p => {
        if (selectedCategoryFilter === 'all') return true;
        if (selectedCategoryFilter === 'flat') return p.propertyType === 'flat' || p.propertyType === 'apartment' || (p.category === 'residential' && !p.propertyType);
        if (selectedCategoryFilter === 'house') return p.propertyType === 'house' || p.propertyType === 'villa';
        if (selectedCategoryFilter === 'plot') return p.propertyType === 'plot' || p.category === 'land';
        if (selectedCategoryFilter === 'shop') return p.propertyType === 'shop' || p.category === 'commercial';
        if (selectedCategoryFilter === 'agricultural') return p.category === 'agricultural' || p.propertyType === 'farmland';
        if (selectedCategoryFilter === 'pg') return searchPurpose === 'rent' && (p.propertyType === 'pg' || p.propertyType === 'hostel' || p.category === 'pg' || p.category === 'hostel');
        return false;
      })
      .sort((a, b) => {
        if (sortBy === 'distance') {
          if (a.distanceKm === null && b.distanceKm === null) return 0;
          if (a.distanceKm === null) return 1;
          if (b.distanceKm === null) return -1;
          return a.distanceKm - b.distanceKm;
        }
        if (sortBy === 'newest') {
          const dateA = new Date(a.updatedAt || a.updated_at || a.createdAt || a.created_at || 0).getTime();
          const dateB = new Date(b.updatedAt || b.updated_at || b.createdAt || b.created_at || 0).getTime();
          return dateB - dateA;
        }
        if (sortBy === 'price_asc') {
          return (a.price || 0) - (b.price || 0);
        }
        if (sortBy === 'price_desc') {
          return (b.price || 0) - (a.price || 0);
        }
        if (sortBy === 'relevance') {
          const scoreA = (a.verificationStatus === 'approved' || a.verificationStatus === 'verified' ? 100 : 0) - (a.distanceKm || 999);
          const scoreB = (b.verificationStatus === 'approved' || b.verificationStatus === 'verified' ? 100 : 0) - (b.distanceKm || 999);
          return scoreB - scoreA;
        }
        return 0;
      });
  }, [baseActiveProperties, selectedCategoryFilter, sortBy, searchPurpose]);

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col font-sans">

      {/* ========================================================================
          TOP MASTER CONTROL BAR (Unified User Account vs Admin Portal)
          ======================================================================== */}
      <header className="master-control-bar">
        <div className="flex items-center gap-3.5 group cursor-pointer" onClick={() => setActiveTab('explore')}>
          <div className="relative w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-950/90 via-slate-900 to-emerald-950/90 border border-emerald-500/30 p-1 flex items-center justify-center shadow-lg shadow-emerald-950/50 group-hover:border-emerald-400/60 transition-all duration-300 shrink-0">
            <LandPinLogo className="w-full h-full object-contain filter drop-shadow group-hover:scale-105 transition-transform duration-300" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-slate-900 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-2xl tracking-tight text-white font-display flex items-center leading-none">
                Land<span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">Pin</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 ml-0.5 inline-block self-end mb-1" />
              </span>
              <span className="text-[10px] font-black tracking-wider text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/30 shadow-xs uppercase">
                0% Brokerage
              </span>
            </div>
            <p className="text-[11px] text-slate-300/80 hidden md:flex items-center gap-1.5 font-medium mt-0.5">
              <span>Direct Owner Network</span>
              <span>·</span>
              <span className="text-emerald-400 font-semibold">0% Brokerage</span>
            </p>
          </div>
        </div>

        {/* Control Bar Actions (Device, Theme, Role, Profile) */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
          {/* Device Switcher */}
          <div className="flex items-center bg-white/10 p-1 rounded-full border border-white/15 gap-1">
            <button
              onClick={() => { setDeviceMode('desktop'); showToast('🖥️ Switched to Desktop Layout'); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${deviceMode === 'desktop' ? 'bg-[#176B4D] text-white shadow' : 'text-slate-300 hover:text-white'
                }`}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Desktop</span>
            </button>
            <button
              onClick={() => { setDeviceMode('mobile'); showToast('📱 Switched to Mobile App Frame'); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${deviceMode === 'mobile' ? 'bg-[#176B4D] text-white shadow' : 'text-slate-300 hover:text-white'
                }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Mobile App</span>
            </button>
          </div>

          {/* Light / Dark Mode Theme Switcher */}
          <div className="flex items-center bg-white/10 p-1 rounded-full border border-white/15 gap-1">
            <button
              onClick={() => { setTheme('light'); showToast('☀️ Switched to Light Mode'); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                theme === 'light' ? 'bg-amber-400 text-slate-950 font-bold shadow' : 'text-slate-300 hover:text-white'
              }`}
              title="Switch to Light Mode"
            >
              <Sun className="w-3.5 h-3.5" />
              <span>Light</span>
            </button>
            <button
              onClick={() => { setTheme('dark'); showToast('🌙 Switched to Dark Mode'); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                theme === 'dark' ? 'bg-[#176B4D] text-white font-bold shadow' : 'text-slate-300 hover:text-white'
              }`}
              title="Switch to Dark Mode"
            >
              <Moon className="w-3.5 h-3.5" />
              <span>Dark</span>
            </button>
          </div>

          {/* Unified Account Switcher */}
          <div className="flex items-center gap-2">
            <div className="flex bg-white/10 p-1 rounded-xl border border-white/15 gap-1">
              <button
                onClick={() => handleSwitchRole('user')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${activeRole === 'user' ? 'bg-white text-slate-900 shadow' : 'text-slate-300 hover:text-white'
                  }`}
              >
                <User className="w-3.5 h-3.5 text-[#176B4D]" />
                <span>User Account</span>
              </button>

              <button
                onClick={() => handleSwitchRole('admin')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${activeRole === 'admin' ? 'bg-amber-400 text-slate-950 shadow font-extrabold' : 'text-slate-300 hover:text-white'
                  }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Admin Desk</span>
              </button>
            </div>

            {/* Desktop Top Header User Profile Avatar & Sign In */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setShowAuthModal(true); setAuthModalMode('login'); }}
                className="bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-bold px-3 py-1.5 rounded-lg border border-white/20 flex items-center gap-1.5 transition-all"
                title="Sign in with Mobile & Password"
              >
                <LogIn className="w-3.5 h-3.5 text-emerald-300" />
                <span>Sign In / Join</span>
              </button>

              <div
                onClick={() => setShowDesktopProfileMenu(prev => !prev)}
                className="flex items-center gap-2 pl-2 border-l border-white/15 cursor-pointer hover:opacity-90 transition-opacity"
                title={`${currentUser?.name || 'Citizen'} · ${currentUser?.mobile || ''}`}
              >
                <div className="w-7 h-7 rounded-full bg-[#184631] text-white font-extrabold flex items-center justify-center text-xs shadow-xs border border-white/20 ring-1 ring-emerald-400/40">
                  {userInitials}
                </div>
                <div className="hidden lg:block text-left leading-tight">
                  <div className="text-xs font-extrabold text-white truncate max-w-[120px]">{currentUser?.name || 'Citizen Account'}</div>
                  <div className="text-[10px] text-emerald-300 font-medium truncate max-w-[120px]">{currentUser?.mobile || 'Direct Owner'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Optional Admin Desk subtle indicator (only when admin active) */}
      {activeRole === 'admin' && (
        <div className="bg-amber-950 text-amber-200 px-4 py-1.5 text-xs font-bold flex items-center justify-between border-b border-amber-800">
          <span>🛡️ Regional Mediator Desk</span>
          <span className="text-[10px] bg-amber-900 px-2 py-0.5 rounded text-amber-300">Admin Mode</span>
        </div>
      )}

      {/* ========================================================================
          APP VIEWPORT CONTAINER (DESKTOP OR MOBILE FRAME)
          ======================================================================== */}
      <div className={deviceMode === 'mobile' ? 'mobile-frame-view-container' : 'desktop-app-view'}>
        <div className={deviceMode === 'mobile' ? 'phone-mockup-frame' : 'w-full max-w-7xl mx-auto px-4 py-6'}>

          {/* Mobile phone status notch */}
          {deviceMode === 'mobile' && (
            <div className="phone-notch-bar">
              <span>9:41</span>
              <div className="status-notch-pill"></div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px]">5G</span>
                <div className="w-4 h-2.5 border border-slate-700 rounded-sm p-0.5">
                  <div className="h-full bg-slate-900 rounded-2xs w-3/4"></div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Bar inside the frame - pinned, non-movable and crystal clear */}
          <div className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 shrink-0 z-40">
            {deviceMode === 'mobile' ? (
              activeRole === 'user' ? (
                /* Mobile App Top Header */
                <div className="w-full">
                  <div className="flex items-center justify-between">
                    {/* Brand Logo & Name Matching Image 1 */}
                    <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => { setActiveTab('explore'); scrollToTop(true); }}>
                      <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200/80 p-0.5 flex items-center justify-center shadow-xs shrink-0">
                        <LandPinLogo className="w-full h-full object-contain" />
                      </div>
                      <span className="font-extrabold text-base text-slate-900 tracking-tight font-display flex items-center">
                        Land<span className="text-[#184631]">Pin</span>
                      </span>
                    </div>

                    {/* Right Action Icons: Saved, Bell, AL Avatar */}
                    <div className="flex items-center gap-1.5">
                      {/* Saved Icon Button with Count Badge */}
                      <button
                        type="button"
                        onClick={() => { setActiveTab('saved'); scrollToTop(true); }}
                        className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-2xs active:scale-95 ${activeTab === 'saved' ? 'bg-rose-50 text-rose-600 border border-rose-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                        title="Saved Properties"
                      >
                        <Heart className={`w-4 h-4 ${activeTab === 'saved' || favoriteIds.length > 0 ? 'fill-rose-600 text-rose-600' : 'text-slate-700'}`} />
                        <span className="absolute -top-1 -right-1 bg-[#184631] text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                          {favoriteIds.length}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => showToast('No new notifications')}
                        className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors shadow-2xs active:scale-95"
                        title="Notifications"
                      >
                        <Bell className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const nextTheme = theme === 'dark' ? 'light' : 'dark';
                          setTheme(nextTheme);
                          showToast(nextTheme === 'dark' ? '🌙 Switched to Dark Mode' : '☀️ Switched to Light Mode');
                        }}
                        className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors shadow-2xs active:scale-95"
                        title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
                      >
                        {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-indigo-600" />}
                      </button>

                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowProfileMenu(prev => !prev)}
                          className="w-8 h-8 rounded-full bg-[#184631] text-white font-extrabold flex items-center justify-center text-xs shadow-2xs hover:bg-[#123625] transition-colors active:scale-95 ring-1 ring-emerald-500/40"
                          title="Account Menu"
                        >
                          {userInitials}
                        </button>

                        {/* Mobile Profile Dropdown: Lists line-by-line all modules */}
                        {showProfileMenu && (
                          <div
                            className="absolute right-0 top-12 w-64 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden divide-y divide-slate-100 animate-in fade-in slide-in-from-top-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* Profile Header */}
                            {isLoggedIn ? (
                              <div 
                                onClick={() => { handleOpenProfileModal(); setShowProfileMenu(false); }}
                                className="p-3 bg-slate-50 hover:bg-emerald-50/50 flex items-center gap-2.5 cursor-pointer transition-colors"
                                title="Click to view full Profile"
                              >
                                <div className="w-9 h-9 rounded-full bg-[#184631] text-white font-extrabold flex items-center justify-center text-xs shrink-0 shadow-xs ring-2 ring-emerald-500/20">
                                  {userInitials}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="font-extrabold text-xs text-slate-900 truncate flex items-center justify-between">
                                    <span>{currentUser?.name || 'Citizen Account'}</span>
                                    <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-full">Verified</span>
                                  </div>
                                  <div className="text-[10px] text-slate-500 truncate">{currentUser?.mobile ? `📱 ${currentUser.mobile}` : 'Direct Owner'}</div>
                                </div>
                              </div>
                            ) : (
                              <div className="p-3 bg-gradient-to-br from-slate-50 to-emerald-50/40">
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold">
                                    <User className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <div className="font-black text-xs text-slate-900">Guest Citizen</div>
                                    <div className="text-[10px] text-slate-500">Not signed in</div>
                                  </div>
                                </div>
                                <button
                                  onClick={() => { setShowAuthModal(true); setAuthModalMode('login'); setShowProfileMenu(false); }}
                                  className="w-full py-1.5 bg-[#184631] hover:bg-[#123625] text-white rounded-xl text-xs font-extrabold shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-95"
                                >
                                  <LogIn className="w-3.5 h-3.5 text-emerald-300" />
                                  <span>Sign In / Join</span>
                                </button>
                              </div>
                            )}

                            {/* Menu Modules List */}
                            <div className="py-1">
                              {/* My Profile Module */}
                              <button
                                onClick={() => { handleOpenProfileModal(); setShowProfileMenu(false); }}
                                className="w-full px-3.5 py-2 text-left text-xs font-bold text-slate-800 hover:bg-emerald-50 flex items-center justify-between transition-colors"
                              >
                                <span className="flex items-center gap-2">
                                  <User className="w-4 h-4 text-emerald-700" />
                                  <span>My Profile &amp; KYC</span>
                                </span>
                                {isLoggedIn && (
                                  <span className="text-[9px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">View</span>
                                )}
                              </button>

                              <button
                                onClick={() => { 
                                  if (!requireAuth('Please sign in to access Lists & Boughts')) return;
                                  setActiveTab('mylistings'); setPortfolioSubTab('listings'); setShowProfileMenu(false); scrollToTop(true); 
                                }}
                                className="w-full px-3.5 py-2 text-left text-xs font-bold text-slate-800 hover:bg-emerald-50 flex items-center justify-between transition-colors"
                              >
                                <span className="flex items-center gap-2">
                                  <Building2 className="w-4 h-4 text-emerald-700" />
                                  <span>Lists &amp; Boughts</span>
                                </span>
                                {isLoggedIn && (
                                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full">
                                    {myProperties.length + myBuyings.length}
                                  </span>
                                )}
                              </button>

                              <button
                                onClick={() => { 
                                  if (!requireAuth('Please sign in to view Visits & Calls')) return;
                                  setActiveTab('visits'); setShowProfileMenu(false); scrollToTop(true); 
                                }}
                                className="w-full px-3.5 py-2 text-left text-xs font-bold text-slate-800 hover:bg-emerald-50 flex items-center justify-between transition-colors"
                              >
                                <span className="flex items-center gap-2">
                                  <Calendar className="w-4 h-4 text-indigo-600" />
                                  <span>Visits &amp; Calls</span>
                                </span>
                                {isLoggedIn && (
                                  <span className="bg-indigo-100 text-indigo-800 text-[10px] font-black px-2 py-0.5 rounded-full">
                                    {myAppointments.length + myCallRequests.length}
                                  </span>
                                )}
                              </button>

                              <button
                                onClick={() => { 
                                  if (!requireAuth('Please sign in to access Disputes & Support')) return;
                                  setActiveTab('support'); setShowProfileMenu(false); scrollToTop(true); 
                                }}
                                className="w-full px-3.5 py-2 text-left text-xs font-bold text-slate-800 hover:bg-emerald-50 flex items-center justify-between transition-colors"
                              >
                                <span className="flex items-center gap-2">
                                  <Headphones className="w-4 h-4 text-amber-600" />
                                  <span>Disputes &amp; Support</span>
                                </span>
                                {isLoggedIn && (
                                  <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded-full">
                                    {myTickets.length}
                                  </span>
                                )}
                              </button>

                              <button
                                onClick={() => { triggerAiRecommendations(); setShowProfileMenu(false); scrollToTop(true); }}
                                className="w-full px-3.5 py-2 text-left text-xs font-bold text-slate-800 hover:bg-emerald-50 flex items-center gap-2 transition-colors"
                              >
                                <Sparkles className="w-4 h-4 text-purple-600" />
                                <span>AI Matcher</span>
                              </button>

                              <button
                                onClick={() => { setActiveTab('map'); setShowProfileMenu(false); scrollToTop(true); }}
                                className="w-full px-3.5 py-2 text-left text-xs font-bold text-slate-800 hover:bg-emerald-50 flex items-center gap-2 transition-colors"
                              >
                                <MapPin className="w-4 h-4 text-emerald-600" />
                                <span>Interactive Map</span>
                              </button>
                            </div>

                            <div className="py-1">
                              <button
                                onClick={() => { handleOpenCreateModal(); setShowProfileMenu(false); }}
                                className="w-full px-3.5 py-2 text-left text-xs font-black text-[#184631] hover:bg-emerald-50 flex items-center gap-2 transition-colors"
                              >
                                <Plus className="w-4 h-4 stroke-[2.5]" />
                                <span>Post Property (0% Fee)</span>
                              </button>
                            </div>

                            <div className="py-1">
                              <button
                                onClick={() => { handleSwitchRole('admin'); setShowProfileMenu(false); scrollToTop(true); }}
                                className="w-full px-3.5 py-1.5 text-left text-[11px] font-bold text-slate-500 hover:bg-slate-100 flex items-center gap-2 transition-colors"
                              >
                                <Shield className="w-3.5 h-3.5 text-slate-400" />
                                <span>Switch to Admin Mediator</span>
                              </button>
                              
                              {/* Dedicated Logout / Sign In button */}
                              {isLoggedIn ? (
                                <button
                                  onClick={() => { handleLogout(); setShowProfileMenu(false); }}
                                  className="w-full px-3.5 py-2 text-left text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors"
                                >
                                  <LogOut className="w-4 h-4 text-rose-600" />
                                  <span>Log Out</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => { setShowAuthModal(true); setAuthModalMode('login'); setShowProfileMenu(false); }}
                                  className="w-full px-3.5 py-2 text-left text-xs font-bold text-emerald-700 hover:bg-emerald-50 flex items-center gap-2 transition-colors"
                                >
                                  <LogIn className="w-4 h-4 text-emerald-600" />
                                  <span>Log In / Sign Up</span>
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Admin Mobile Horizontal Scroll */
                <div className="w-full flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                  <button
                    onClick={() => { setAdminSubTab('verifications'); scrollToTop(true); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-all flex items-center gap-1 ${adminSubTab === 'verifications' ? 'bg-amber-500 text-slate-950 shadow-xs font-extrabold' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Review ({adminQueue.length})
                  </button>
                  <button
                    onClick={() => { setAdminSubTab('inventory'); scrollToTop(true); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-all flex items-center gap-1 ${adminSubTab === 'inventory' ? 'bg-amber-500 text-slate-950 shadow-xs font-extrabold' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Approved &amp; Live ({adminApprovedProperties.length})
                  </button>
                  <button
                    onClick={() => { setAdminSubTab('calls'); scrollToTop(true); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-all flex items-center gap-1 ${adminSubTab === 'calls' ? 'bg-amber-500 text-slate-950 shadow-xs font-extrabold' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    Mediation Calls ({adminCalls.length})
                  </button>
                  <button
                    onClick={() => { setAdminSubTab('escrows'); scrollToTop(true); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-all flex items-center gap-1 ${adminSubTab === 'escrows' ? 'bg-amber-500 text-slate-950 shadow-xs font-extrabold' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    Mediated Deals ({adminEscrows.length})
                  </button>
                  <button
                    onClick={() => { setAdminSubTab('support'); scrollToTop(true); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-all flex items-center gap-1 ${adminSubTab === 'support' ? 'bg-amber-500 text-slate-950 shadow-xs font-extrabold' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                  >
                    <Headphones className="w-3.5 h-3.5" />
                    Support ({adminTickets.length})
                  </button>
                  <button
                    onClick={() => { setAdminSubTab('audit'); scrollToTop(true); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-all flex items-center gap-1 ${adminSubTab === 'audit' ? 'bg-amber-500 text-slate-950 shadow-xs font-extrabold' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    Audit
                  </button>
                </div>
              )
            ) : (
              /* Desktop Mode Navigation */
              activeRole === 'user' ? (
                /* User Navigation (Clean single line with tabs on left and Post button on right) */
                <div className="flex items-center justify-between w-full gap-2 flex-wrap lg:flex-nowrap">
                  <div className="flex items-center gap-1.5 flex-wrap lg:flex-nowrap overflow-x-auto no-scrollbar py-0.5">
                    <button
                      onClick={() => { setActiveTab('explore'); scrollToTop(true); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'explore' ? 'bg-[#184631] text-white shadow-xs' : 'text-slate-600 hover:bg-[#E8F3EE]'
                        }`}
                    >
                      Explore Properties
                    </button>

                    <button
                      onClick={() => { setActiveTab('map'); scrollToTop(true); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'map' ? 'bg-[#184631] text-white shadow-xs' : 'text-slate-600 hover:bg-[#E8F3EE]'
                        }`}
                    >
                      🗺️ Map View
                    </button>

                    <button
                      onClick={() => { triggerAiRecommendations(); scrollToTop(true); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${activeTab === 'ai' ? 'bg-purple-700 text-white shadow-xs' : 'text-purple-700 bg-purple-50 hover:bg-purple-100'
                        }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>AI Matcher</span>
                    </button>

                    <button
                      onClick={() => { 
                        if (!requireAuth('Please sign in to access Lists & Boughts')) return;
                        setPortfolioSubTab('listings'); setActiveTab('mylistings'); scrollToTop(true); 
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${activeTab === 'mylistings' ? 'bg-[#184631] text-white shadow-xs font-extrabold' : 'text-emerald-800 bg-emerald-50 hover:bg-[#E8F3EE]'
                        }`}
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      <span>Lists &amp; Boughts {isLoggedIn ? `(${myProperties.length + myBuyings.length})` : ''}</span>
                    </button>

                    <button
                      onClick={() => { 
                        if (!requireAuth('Please sign in to access Disputes & Support')) return;
                        setActiveTab('support'); scrollToTop(true); 
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${activeTab === 'support' ? 'bg-amber-600 text-white shadow-xs font-extrabold' : 'text-amber-800 bg-amber-50 hover:bg-amber-100'
                        }`}
                    >
                      <Headphones className="w-3.5 h-3.5" />
                      <span>Disputes &amp; Support {isLoggedIn ? `(${myTickets.length})` : ''}</span>
                    </button>

                    <button
                      onClick={() => { setActiveTab('saved'); scrollToTop(true); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${activeTab === 'saved' ? 'bg-rose-600 text-white shadow-xs' : 'text-rose-700 bg-rose-50 hover:bg-rose-100'
                        }`}
                    >
                      <Heart className="w-3.5 h-3.5" />
                      <span>Saved ({favoriteIds.length})</span>
                    </button>

                    <button
                      onClick={() => { 
                        if (!requireAuth('Please sign in to view Visits & Calls')) return;
                        setActiveTab('visits'); scrollToTop(true); 
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${activeTab === 'visits' ? 'bg-[#184631] text-white shadow-xs' : 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100'
                        }`}
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Visits &amp; Calls {isLoggedIn ? `(${myAppointments.length + myCallRequests.length})` : ''}</span>
                    </button>
                  </div>

                  {/* Desktop Right Action Bar: Post Property + Notifications + Profile Avatar */}
                  <div className="ml-auto shrink-0 flex items-center gap-2.5">
                    <button
                      onClick={handleOpenCreateModal}
                      className="bg-[#184631] hover:bg-[#123625] text-white px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>+ Post Property (0% Fee)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => showToast('No new notifications')}
                      className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors shadow-2xs active:scale-95"
                      title="Notifications"
                    >
                      <Bell className="w-4 h-4" />
                    </button>

                    {/* Theme Toggle Button for Desktop Layout */}
                    <button
                      type="button"
                      onClick={() => {
                        const nextTheme = theme === 'dark' ? 'light' : 'dark';
                        setTheme(nextTheme);
                        showToast(nextTheme === 'dark' ? '🌙 Switched to Dark Mode' : '☀️ Switched to Light Mode');
                      }}
                      className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors shadow-2xs active:scale-95"
                      title={theme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
                    >
                      {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-indigo-600" />}
                    </button>

                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowDesktopProfileMenu(prev => !prev)}
                        className="w-8 h-8 rounded-full bg-[#184631] text-white font-extrabold flex items-center justify-center text-xs shadow-2xs hover:bg-[#123625] transition-colors active:scale-95 ring-2 ring-emerald-600/30"
                        title={`${currentUser?.name || 'Citizen Account'} · ${currentUser?.mobile || ''}`}
                      >
                        {userInitials}
                      </button>

                      {showDesktopProfileMenu && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setShowDesktopProfileMenu(false)}
                          />
                          <div
                            className="absolute right-0 top-10 w-64 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden divide-y divide-slate-100 animate-in fade-in slide-in-from-top-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* Desktop Profile Header */}
                            {isLoggedIn ? (
                              <div 
                                onClick={() => { handleOpenProfileModal(); setShowDesktopProfileMenu(false); }}
                                className="p-3 bg-slate-50 hover:bg-emerald-50/50 flex items-center gap-2.5 cursor-pointer transition-colors"
                                title="Click to view full Profile"
                              >
                                <div className="w-9 h-9 rounded-full bg-[#184631] text-white font-extrabold flex items-center justify-center text-xs shrink-0 shadow-xs ring-2 ring-emerald-500/20">
                                  {userInitials}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="font-extrabold text-xs text-slate-900 truncate flex items-center justify-between">
                                    <span>{currentUser?.name || 'Citizen Account'}</span>
                                    <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-full">Verified</span>
                                  </div>
                                  <div className="text-[10px] text-slate-500 truncate">{currentUser?.mobile ? `📱 ${currentUser.mobile}` : 'Direct Owner'}</div>
                                </div>
                              </div>
                            ) : (
                              <div className="p-3 bg-gradient-to-br from-slate-50 to-emerald-50/40">
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold">
                                    <User className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <div className="font-black text-xs text-slate-900">Guest Citizen</div>
                                    <div className="text-[10px] text-slate-500">Not signed in</div>
                                  </div>
                                </div>
                                <button
                                  onClick={() => { setShowAuthModal(true); setAuthModalMode('login'); setShowDesktopProfileMenu(false); }}
                                  className="w-full py-1.5 bg-[#184631] hover:bg-[#123625] text-white rounded-xl text-xs font-extrabold shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-95"
                                >
                                  <LogIn className="w-3.5 h-3.5 text-emerald-300" />
                                  <span>Sign In / Join</span>
                                </button>
                              </div>
                            )}

                            {/* Menu Modules List */}
                            <div className="py-1">
                              {/* My Profile Module */}
                              <button
                                onClick={() => { handleOpenProfileModal(); setShowDesktopProfileMenu(false); }}
                                className="w-full px-3.5 py-2 text-left text-xs font-bold text-slate-800 hover:bg-emerald-50 flex items-center justify-between transition-colors"
                              >
                                <span className="flex items-center gap-2">
                                  <User className="w-4 h-4 text-emerald-700" />
                                  <span>My Profile &amp; KYC</span>
                                </span>
                                {isLoggedIn && (
                                  <span className="text-[9px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">View</span>
                                )}
                              </button>

                              <button
                                onClick={() => { 
                                  if (!requireAuth('Please sign in to access Lists & Boughts')) return;
                                  setActiveTab('mylistings'); setPortfolioSubTab('listings'); setShowDesktopProfileMenu(false); scrollToTop(true); 
                                }}
                                className="w-full px-3.5 py-2 text-left text-xs font-bold text-slate-800 hover:bg-emerald-50 flex items-center justify-between transition-colors"
                              >
                                <span className="flex items-center gap-2">
                                  <Building2 className="w-4 h-4 text-emerald-700" />
                                  <span>Lists &amp; Boughts</span>
                                </span>
                                {isLoggedIn && (
                                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full">
                                    {myProperties.length + myBuyings.length}
                                  </span>
                                )}
                              </button>

                              <button
                                onClick={() => { 
                                  if (!requireAuth('Please sign in to view Visits & Calls')) return;
                                  setActiveTab('visits'); setShowDesktopProfileMenu(false); scrollToTop(true); 
                                }}
                                className="w-full px-3.5 py-2 text-left text-xs font-bold text-slate-800 hover:bg-emerald-50 flex items-center justify-between transition-colors"
                              >
                                <span className="flex items-center gap-2">
                                  <Calendar className="w-4 h-4 text-indigo-600" />
                                  <span>Visits &amp; Calls</span>
                                </span>
                                {isLoggedIn && (
                                  <span className="bg-indigo-100 text-indigo-800 text-[10px] font-black px-2 py-0.5 rounded-full">
                                    {myAppointments.length + myCallRequests.length}
                                  </span>
                                )}
                              </button>

                              <button
                                onClick={() => { 
                                  if (!requireAuth('Please sign in to access Disputes & Support')) return;
                                  setActiveTab('support'); setShowDesktopProfileMenu(false); scrollToTop(true); 
                                }}
                                className="w-full px-3.5 py-2 text-left text-xs font-bold text-slate-800 hover:bg-emerald-50 flex items-center justify-between transition-colors"
                              >
                                <span className="flex items-center gap-2">
                                  <Headphones className="w-4 h-4 text-amber-600" />
                                  <span>Disputes &amp; Support</span>
                                </span>
                                {isLoggedIn && (
                                  <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded-full">
                                    {myTickets.length}
                                  </span>
                                )}
                              </button>

                              <button
                                onClick={() => { triggerAiRecommendations(); setShowDesktopProfileMenu(false); scrollToTop(true); }}
                                className="w-full px-3.5 py-2 text-left text-xs font-bold text-slate-800 hover:bg-emerald-50 flex items-center gap-2 transition-colors"
                              >
                                <Sparkles className="w-4 h-4 text-purple-600" />
                                <span>AI Matcher</span>
                              </button>

                              <button
                                onClick={() => { setActiveTab('map'); setShowDesktopProfileMenu(false); scrollToTop(true); }}
                                className="w-full px-3.5 py-2 text-left text-xs font-bold text-slate-800 hover:bg-emerald-50 flex items-center gap-2 transition-colors"
                              >
                                <MapPin className="w-4 h-4 text-emerald-600" />
                                <span>Interactive Map</span>
                              </button>
                            </div>

                            <div className="py-1">
                              <button
                                onClick={() => { handleOpenCreateModal(); setShowDesktopProfileMenu(false); }}
                                className="w-full px-3.5 py-2 text-left text-xs font-black text-[#184631] hover:bg-emerald-50 flex items-center gap-2 transition-colors"
                              >
                                <Plus className="w-4 h-4 stroke-[2.5]" />
                                <span>Post Property (0% Fee)</span>
                              </button>
                            </div>

                            <div className="py-1">
                              <button
                                onClick={() => { handleSwitchRole('admin'); setShowDesktopProfileMenu(false); scrollToTop(true); }}
                                className="w-full px-3.5 py-1.5 text-left text-[11px] font-bold text-slate-500 hover:bg-slate-100 flex items-center gap-2 transition-colors"
                              >
                                <Shield className="w-3.5 h-3.5 text-slate-400" />
                                <span>Switch to Admin Mediator</span>
                              </button>

                              {/* Dedicated Logout / Sign In button */}
                              {isLoggedIn ? (
                                <button
                                  onClick={() => { handleLogout(); setShowDesktopProfileMenu(false); }}
                                  className="w-full px-3.5 py-2 text-left text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2 transition-colors"
                                >
                                  <LogOut className="w-4 h-4 text-rose-600" />
                                  <span>Log Out</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => { setShowAuthModal(true); setAuthModalMode('login'); setShowDesktopProfileMenu(false); }}
                                  className="w-full px-3.5 py-2 text-left text-xs font-bold text-emerald-700 hover:bg-emerald-50 flex items-center gap-2 transition-colors"
                                >
                                  <LogIn className="w-4 h-4 text-emerald-600" />
                                  <span>Log In / Sign Up</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* Admin Desktop Navigation Tabs */
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => { setAdminSubTab('verifications'); scrollToTop(true); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${adminSubTab === 'verifications' ? 'bg-amber-500 text-slate-950 shadow-xs font-extrabold' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Listing Reviews ({adminQueue.length})
                  </button>

                  <button
                    onClick={() => { setAdminSubTab('inventory'); scrollToTop(true); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${adminSubTab === 'inventory' ? 'bg-amber-500 text-slate-950 shadow-xs font-extrabold' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Approved &amp; Live ({adminApprovedProperties.length})
                  </button>

                  <button
                    onClick={() => { setAdminSubTab('calls'); scrollToTop(true); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${adminSubTab === 'calls' ? 'bg-amber-500 text-slate-950 shadow-xs font-extrabold' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    Mediation Calls ({adminCalls.length})
                  </button>

                  <button
                    onClick={() => { setAdminSubTab('escrows'); scrollToTop(true); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${adminSubTab === 'escrows' ? 'bg-amber-500 text-slate-950 shadow-xs font-extrabold' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    Mediated Deals ({adminEscrows.length})
                  </button>

                  <button
                    onClick={() => { setAdminSubTab('support'); scrollToTop(true); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${adminSubTab === 'support' ? 'bg-amber-500 text-slate-950 shadow-xs font-extrabold' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                  >
                    <Headphones className="w-3.5 h-3.5" />
                    Support Tickets ({adminTickets.length})
                  </button>

                  <button
                    onClick={() => { setAdminSubTab('audit'); scrollToTop(true); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${adminSubTab === 'audit' ? 'bg-amber-500 text-slate-950 shadow-xs font-extrabold' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    Audit Logs
                  </button>
                </div>
              )
            )}

            {/* Admin Refresh Desk Action for Desktop Mode */}
            {deviceMode === 'desktop' && activeRole === 'admin' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={loadAdminData}
                  className="bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Refresh Desk
                </button>
              </div>
            )}
          </div>

          {/* App Scrollable Content Area */}
          <div ref={mainScrollRef} className={`app-scroll-body ${isMobile ? 'p-3 space-y-3.5 pb-20' : 'p-4 space-y-6 pb-8'}`}>

            {/* ================================================================
                USER VIEW 1: EXPLORE & INSTANT FILTERING
                ================================================================ */}
            {activeRole === 'user' && activeTab === 'explore' && (
              <div className={isMobile ? 'space-y-3.5' : 'space-y-5'}>

                {/* Forest Green Hero Banner Matching Image 1 */}
                <div className={`bg-[#184631] text-white shadow-md relative overflow-hidden ${isMobile ? 'rounded-2xl p-3.5 space-y-2' : 'rounded-3xl p-5 sm:p-6 space-y-3'}`}>
                  {/* Location Pill Dropdown - Click to auto-detect GPS or search area */}
                  <button
                    type="button"
                    onClick={() => setShowLocationPicker(true)}
                    className={`inline-flex items-center gap-1 bg-white/15 hover:bg-white/25 active:scale-95 text-white font-bold uppercase tracking-wider rounded-full transition-all border border-white/20 shadow-xs ${isMobile ? 'text-[9.5px] px-2.5 py-1' : 'text-[11px] px-3.5 py-1.5'}`}
                    title="Click to search locality, detect GPS, or adjust radius"
                  >
                    <MapPin className="w-3 h-3 text-white shrink-0" />
                    <span>{(userLocation?.name?.split(',')[0] ? `${userLocation.name.split(',')[0]}, ANDHRA PRADESH` : 'KADAPA, ANDHRA PRADESH').toUpperCase()}</span>
                    <ChevronDown className="w-3 h-3 text-white/80 shrink-0" />
                  </button>

                  {/* Hero Title */}
                  <h1 className={`${isMobile ? 'text-lg' : 'text-2xl sm:text-3xl'} font-black text-white tracking-tight leading-tight`}>
                    Your land. Your legacy.
                  </h1>

                  {/* Hero Subtitle */}
                  <p className={`${isMobile ? 'text-[11px]' : 'text-xs sm:text-sm'} text-emerald-100/90 font-medium`}>
                    0% Brokerage · Direct Owner · Verified Listings
                  </p>
                </div>

                {/* Search Bar Row Matching Image 1 */}
                <div className="flex items-center gap-2">
                  <div className={`flex-1 flex items-center gap-2 bg-[#F4F5F4] border border-slate-200/70 shadow-2xs ${isMobile ? 'px-3 py-1.5 rounded-xl' : 'px-4 py-2.5 rounded-2xl'}`}>
                    <Search className={`${isMobile ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-slate-400 shrink-0`} />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                      placeholder="Search locality or RERA ID"
                      className={`flex-1 bg-transparent font-semibold text-slate-800 placeholder:text-slate-400 outline-none min-w-0 ${isMobile ? 'text-xs' : 'text-xs sm:text-sm'}`}
                    />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Radius Pill */}
                  <button
                    type="button"
                    onClick={() => setShowLocationPicker(true)}
                    className={`bg-[#E8F3EE] text-[#1F4E38] font-bold shrink-0 border border-emerald-200/60 hover:bg-[#DDF0E5] transition-colors ${isMobile ? 'text-[11px] px-2.5 py-1.5 rounded-xl' : 'text-xs px-3.5 py-2.5 rounded-2xl'}`}
                    title="Change search radius"
                  >
                    {maxRadiusKm} km
                  </button>

                  {/* Dark green search button */}
                  <button
                    type="button"
                    onClick={loadPublicProperties}
                    className={`${isMobile ? 'w-8 h-8 rounded-xl' : 'w-10 h-10 rounded-2xl'} bg-[#275D44] hover:bg-[#1F4E38] active:scale-95 text-white flex items-center justify-center shrink-0 shadow-sm transition-all`}
                    title="Search properties"
                  >
                    <Search className={`${isMobile ? 'w-3.5 h-3.5' : 'w-4 h-4'} stroke-[2.5]`} />
                  </button>
                </div>

                {/* Purpose Segmented Pills Matching Image 1 */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedCategoryFilter === 'pg') setSelectedCategoryFilter('all');
                      setSearchPurpose('sale');
                    }}
                    className={`${isMobile ? 'px-3.5 py-1.5 text-[11px]' : 'px-5 py-2 text-xs'} rounded-full font-black flex items-center gap-1.5 transition-all ${searchPurpose === 'sale'
                      ? 'bg-[#1C1C1E] text-white shadow-sm'
                      : 'bg-[#F0F2F0] text-slate-600 hover:bg-slate-200'
                      }`}
                  >
                    <span>Buy</span>
                    <span className={`text-[9.5px] px-1.5 py-0.2 rounded-full font-bold ${searchPurpose === 'sale' ? 'bg-[#275D44] text-emerald-200' : 'bg-slate-300 text-slate-700'
                      }`}>
                      0% Fee
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSearchPurpose('rent')}
                    className={`${isMobile ? 'px-3.5 py-1.5 text-[11px]' : 'px-5 py-2 text-xs'} rounded-full font-black flex items-center gap-1.5 transition-all ${searchPurpose === 'rent'
                      ? 'bg-[#1C1C1E] text-white shadow-sm'
                      : 'bg-[#F0F2F0] text-slate-600 hover:bg-slate-200'
                      }`}
                  >
                    <span>Rent</span>
                    <span className={`text-[9.5px] px-1.5 py-0.2 rounded-full font-bold ${searchPurpose === 'rent' ? 'bg-[#275D44] text-emerald-200' : 'bg-slate-300 text-slate-700'
                      }`}>
                      Direct
                    </span>
                  </button>
                </div>

                {/* Category Cards Horizontal Scroll Matching Image 1 */}
                <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
                  {categoryTabs.map((cat) => {
                    const isSelected = selectedCategoryFilter === cat.id;
                    const count = getCategoryCount(cat.id);
                    const IconComp = cat.icon;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => {
                          setSelectedCategoryFilter(cat.id);
                          if (cat.id === 'pg') setSearchPurpose('rent');
                        }}
                        className={`${isMobile ? 'w-22 p-2 rounded-xl' : 'w-28 sm:w-32 p-3.5 rounded-2xl'} shrink-0 border bg-white flex flex-col items-center text-center transition-all shadow-2xs group ${isSelected
                          ? 'border-2 border-[#184631] shadow-xs ring-1 ring-[#184631]/20 bg-emerald-50/20'
                          : 'border-slate-200/80 hover:border-slate-300 hover:shadow-xs'
                          }`}
                      >
                        <div className={`${isMobile ? 'w-7 h-7 rounded-lg mb-1' : 'w-9 h-9 rounded-xl mb-1.5'} flex items-center justify-center transition-all ${isSelected
                          ? 'bg-[#184631] text-white shadow-2xs'
                          : `${cat.bg} ${cat.iconColor} group-hover:scale-105`
                          }`}>
                          <IconComp className={`${isMobile ? 'w-3.5 h-3.5' : 'w-5 h-5'} stroke-[2.2]`} />
                        </div>
                        <span className={`${isMobile ? 'text-[10px]' : 'text-xs'} font-black text-slate-900 leading-tight block truncate w-full`}>
                          {cat.label}
                        </span>
                        <span className={`${isMobile ? 'text-[9px]' : 'text-[11px]'} text-slate-400 font-semibold mt-0.5`}>
                          {count} available
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Available Properties Header Matching Image 1 */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <h3 className="font-extrabold text-sm sm:text-base text-slate-900 tracking-tight shrink-0">
                      Properties ({filteredProperties.length})
                    </h3>
                    <span className="text-[10px] bg-emerald-50 text-[#1F4E38] font-bold px-2 py-0.5 rounded-full border border-emerald-200 shrink-0">
                      0% Fee
                    </span>
                  </div>

                  <div className="relative shrink-0">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="bg-white border border-slate-200 text-xs font-bold text-slate-700 rounded-xl px-2.5 py-1.5 pr-7 focus:outline-none appearance-none cursor-pointer shadow-2xs"
                    >
                      <option value="distance">Nearest</option>
                      <option value="relevance">Featured</option>
                      <option value="newest">Newest First (Recent)</option>
                      <option value="price_asc">Price: Low to high</option>
                      <option value="price_desc">Price: High to low</option>
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                {filteredProperties.length === 0 ? (
                  <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-3 shadow-xs">
                    <div className="text-3xl">📍</div>
                    <h4 className="font-extrabold text-slate-900 text-sm">
                      No properties found within {maxRadiusKm} km of {userLocation.name}
                    </h4>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      Try expanding your search radius or selecting a different location.
                    </p>
                    <div className="flex flex-wrap justify-center gap-2 pt-1">
                      <button
                        onClick={() => {
                          setMaxRadiusKm(100);
                          setLocationInputText('Indiranagar');
                          handleApplyTypedLocation('Indiranagar');
                        }}
                        className="bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs"
                      >
                        Reset location (Bangalore, 100 km)
                      </button>
                      <button
                        onClick={() => setMaxRadiusKm(300)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-4 py-2 rounded-xl text-xs font-bold transition-all border border-slate-300 shadow-xs"
                      >
                        Expand Search to 300 km
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={`grid gap-4 ${deviceMode === 'mobile' ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
                    {filteredProperties.map((prop) => {
                      const distKm = prop.distanceKm != null ? prop.distanceKm : (
                        (() => {
                          const c = getPropertyLatLng(prop);
                          return c ? calcDistanceKm(userLocation.latitude, userLocation.longitude, c.lat, c.lng) : null;
                        })()
                      );
                      const isFav = favoriteIds.includes(prop._id || prop.id);
                      const propImgUrl = getFirstPropertyImageUrl(prop);
                      const hasRealPhoto = Boolean(propImgUrl);
                      const isComparing = comparedPropertyIds.includes(prop._id || prop.id);
                      const firstCompared = comparedPropertyIds.length > 0 ? properties.find(p => (p._id || p.id) === comparedPropertyIds[0]) : null;
                      const activeCat = firstCompared ? getPropertyTypeCategory(firstCompared) : null;
                      const currentCat = getPropertyTypeCategory(prop);
                      const isCategoryMismatch = activeCat && activeCat.id !== currentCat.id;

                      return (
                        <div
                          key={prop._id || prop.id}
                          className="card-3d-wrapper"
                        >
                          <div
                            className="card-3d-inner bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs flex flex-col cursor-pointer group h-full"
                            onClick={() => { setSelectedProperty(prop); setShowDetailModal(true); }}
                          >
                            <div className={`relative ${isMobile ? 'h-40' : 'h-56'} bg-slate-100 overflow-hidden flex items-center justify-center`}>
                              {hasRealPhoto ? (
                                <img
                                  src={propImgUrl}
                                  alt={prop.title}
                                  className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500 ease-out"
                                />
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-400 p-4 text-center">
                                  <ImageOff className="w-8 h-8 text-slate-300 mb-1" />
                                  <span className="text-xs font-bold text-slate-600">Photos not available</span>
                                </div>
                              )}

                              {/* Subtle bottom scrim only for price contrast - no dark overlay on image */}
                              <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />

                              {/* Top Left Badges */}
                              <div className="absolute top-3 left-3 flex items-center gap-1.5 z-10 pointer-events-none">
                                <span className="pointer-events-auto bg-white text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1 border border-slate-200">
                                  <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
                                  <span>Cadastral Cleared</span>
                                </span>
                                <span className="pointer-events-auto bg-slate-900/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                                  Direct Owner
                                </span>
                              </div>

                              {/* Top Right Badges (No overlap) */}
                              <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
                                {/* Compare Button */}
                                <button
                                  type="button"
                                  onClick={(e) => handleToggleCompare(e, prop._id || prop.id)}
                                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-sm flex items-center gap-1 transition-all ${isComparing
                                    ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-300 font-black scale-105'
                                    : 'bg-white text-slate-800 hover:bg-slate-50 border border-slate-200'
                                    }`}
                                >
                                  <span>Compare</span>
                                </button>

                                {/* Bookmark / Favorite */}
                                <button
                                  type="button"
                                  onClick={(e) => handleToggleFavorite(e, prop._id || prop.id)}
                                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${isFav ? 'bg-white text-rose-600 shadow' : 'bg-white text-slate-700 hover:text-emerald-700 shadow-sm border border-slate-200'
                                    }`}
                                >
                                  <Bookmark className={`w-3.5 h-3.5 ${isFav ? 'fill-rose-600' : ''}`} />
                                </button>
                              </div>

                              {/* Bottom Left: Bold Price & Distance */}
                              <div className="absolute bottom-3 left-3 text-left z-10 pointer-events-none">
                                <div className="text-xl font-black text-white leading-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                                  {prop.propertyType === 'pg' || prop.category === 'pg' ? (
                                    `₹${prop.price?.toLocaleString('en-IN')}/mo`
                                  ) : prop.purpose === 'rent' ? (
                                    `₹${prop.price?.toLocaleString('en-IN')}/mo`
                                  ) : (
                                    `₹${(prop.price >= 10000000 ? (prop.price / 10000000).toFixed(2) + ' Cr' : (prop.price / 100000).toFixed(1) + ' Lakh')}`
                                  )}
                                </div>
                                {distKm != null && (
                                  <div className="text-[11px] text-white/95 font-semibold drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                                    {distKm} km away
                                  </div>
                                )}
                              </div>

                              {/* Bottom Right: 3D Tour Button */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleLaunch3DTour(prop);
                                }}
                                className="absolute bottom-3 right-3 bg-[#184631]/95 hover:bg-[#123625] text-white text-[11px] font-bold px-3 py-1 rounded-lg shadow-md flex items-center gap-1.5 border border-white/20 transition-all z-10"
                              >
                                <Box className="w-3.5 h-3.5 text-emerald-300" />
                                <span>3D Tour</span>
                              </button>
                            </div>

                            <div className="p-3.5 flex flex-col flex-1 justify-between gap-2.5">
                              <div>
                                {(prop.propertyType === 'pg' || prop.category === 'pg') && (
                                  <div className="mb-1">
                                    <span className="text-[10px] font-extrabold bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full border border-teal-200 inline-flex items-center gap-1">
                                      <span>🛏️</span> PG &amp; Hostel · Rent Only
                                    </span>
                                  </div>
                                )}
                                <h4 className="font-extrabold text-sm text-slate-900 line-clamp-1 group-hover:text-emerald-700 transition-colors">
                                  {prop.title}
                                </h4>
                                <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                  <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span className="truncate">{prop.location?.address || prop.location?.locality}</span>
                                </p>
                              </div>

                              {/* Compact Decent Spec Bar */}
                              <div className="flex items-center justify-between bg-slate-50/90 px-3 py-1.5 rounded-xl border border-slate-100 text-[11px]">
                                <div className="flex items-center gap-1">
                                  <span className="text-slate-400 font-semibold">{prop.propertyType === 'pg' || prop.category === 'pg' ? 'Sharing:' : 'Area:'}</span>
                                  <strong className="text-slate-800 font-extrabold">
                                    {prop.propertyType === 'pg' || prop.category === 'pg'
                                      ? (prop.typeSpecificData?.pgDetails?.sharingType?.split(' ')[0] || `${prop.bedrooms || 1}+ Bed`)
                                      : `${prop.area?.value} sq.ft`}
                                  </strong>
                                </div>
                                <span className="text-slate-200">|</span>
                                <div className="flex items-center gap-1">
                                  <span className="text-slate-400 font-semibold">Type:</span>
                                  <strong className="text-slate-800 font-extrabold capitalize">
                                    {prop.propertyType === 'pg' || prop.category === 'pg' ? 'PG' : (prop.propertyType || 'Plot')}
                                  </strong>
                                </div>
                                <span className="text-slate-200">|</span>
                                <div className="flex items-center gap-1">
                                  <span className="text-slate-400 font-semibold">For:</span>
                                  <strong className={`font-black uppercase ${prop.propertyType === 'pg' || prop.category === 'pg' ? 'text-teal-700' : 'text-indigo-600'}`}>
                                    {prop.propertyType === 'pg' || prop.category === 'pg' ? 'Rent' : prop.purpose}
                                  </strong>
                                </div>
                              </div>

                              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                {/* Quick Contact with Regional Admin Mediator */}
                                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenCallModal(prop)}
                                    className="h-7 px-2.5 rounded-lg border border-blue-200 text-blue-700 bg-blue-50/80 hover:bg-blue-100 flex items-center gap-1 text-[11px] font-bold transition-all shadow-2xs group/btn active:scale-95"
                                    title="Direct Call"
                                  >
                                    <Phone className="w-3.5 h-3.5 text-blue-600" />
                                    <span>Call</span>
                                  </button>
                                </div>

                                {/* Direct Actions: Offer & Book Visit */}
                                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEscrowModal(prop)}
                                    className="h-7 px-2.5 rounded-lg border border-amber-300/80 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold transition-all shadow-2xs active:scale-95"
                                    title="Make Legal Offer"
                                  >
                                    Offer
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenVisitModal(prop)}
                                    className="h-7 px-3 rounded-lg bg-[#176B4D] hover:bg-[#12553D] text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1 active:scale-95"
                                    title="Book Site Visit"
                                  >
                                    <Calendar className="w-3 h-3 text-emerald-200" />
                                    <span>Book Visit</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 3D Immersive Hero Estate Experience (Positioned at Bottom of Explore Module) */}
                <div className="pt-6 border-t border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-extrabold text-sm text-slate-900 font-display flex items-center gap-2">
                        <Box className="w-4 h-4 text-emerald-700" />
                        <span>3D Architectural Showcase</span>
                      </h3>
                      <p className="text-xs text-slate-500">
                        Real-time 3D villa, sky deck, and infinity pool
                      </p>
                    </div>
                    <span className="text-[10px] font-black bg-emerald-100 text-emerald-900 px-2.5 py-0.5 rounded-full border border-emerald-300">
                      WebGL 3D
                    </span>
                  </div>

                  <HeroEstate3D
                    onExploreClick={() => {
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    onBookVisitClick={() => {
                      if (properties && properties.length > 0) {
                        handleOpenVisitModal(properties[0]);
                      }
                    }}
                    isMobile={isMobile}
                  />
                </div>
              </div>
            )}

            {/* ================================================================
                USER VIEW 2: INTERACTIVE MAP VIEW (Leaflet + OpenStreetMap)
                ================================================================ */}
            {activeRole === 'user' && activeTab === 'map' && (
              <div className="space-y-3">
                {deviceMode !== 'mobile' && (
                  <div className="flex items-center justify-between pb-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-slate-800">
                        {mapMode3D ? '3D Spatial Grid' : 'Interactive Map'}
                      </h3>
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-semibold">
                        {filteredProperties.length} properties
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                      <button
                        onClick={() => setMapMode3D(false)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${!mapMode3D ? 'bg-[#184631] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                          }`}
                      >
                        2D Map
                      </button>
                      <button
                        onClick={() => setMapMode3D(true)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${mapMode3D ? 'bg-[#184631] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                          }`}
                      >
                        <Box className="w-3.5 h-3.5" />
                        <span>3D Spatial</span>
                      </button>
                    </div>
                  </div>
                )}

                {mapMode3D ? (
                  <SpatialPropertyMap3D
                    properties={filteredProperties}
                    userLocation={userLocation}
                    maxRadiusKm={maxRadiusKm}
                    onSelectProperty={(p) => {
                      setSelectedProperty(p);
                      setShowDetailModal(true);
                    }}
                    onLaunch3DTour={handleLaunch3DTour}
                    isMobile={isMobile}
                  />
                ) : (
                  <PropertyMap
                    properties={filteredProperties}
                    userLocation={userLocation}
                    maxRadiusKm={maxRadiusKm}
                    searchPurpose={searchPurpose}
                    setSearchPurpose={setSearchPurpose}
                    onOpenLocationPicker={() => setShowLocationPicker(true)}
                    onBack={() => { setActiveTab('explore'); scrollToTop(true); }}
                    selectedProperty={selectedProperty}
                    onSelectProperty={(p) => setSelectedProperty(p)}
                    onViewDetails={(p) => {
                      setSelectedProperty(p);
                      setShowDetailModal(true);
                    }}
                    isMobile={isMobile}
                  />
                )}
              </div>
            )}

            {/* ========================================================================
                USER VIEW 3: AI SMART PROPERTY MATCHER
                ======================================================================== */}
            {activeRole === 'user' && activeTab === 'ai' && (
              <div className="space-y-5">
                {/* Executive AI Matcher Card */}
                <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-4 sm:p-6 rounded-2xl sm:rounded-3xl text-white shadow-xl border border-slate-800 space-y-4">
                  {/* Subtle ambient lighting */}
                  <div className="absolute -top-24 -right-24 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
                  <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

                  {/* Header */}
                  <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-950/40">
                        <Sparkles className="w-5 h-5 text-white" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base sm:text-lg font-black text-white leading-tight font-display">
                            Property Matcher
                          </h3>
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-400/30 uppercase tracking-wider hidden sm:inline-block">
                            Verified
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Instant AI matching
                        </p>
                      </div>
                    </div>

                    <div className="text-xs bg-slate-800/90 border border-slate-700/80 text-emerald-300 px-2.5 py-1 rounded-full font-bold shrink-0 flex items-center gap-1.5 shadow-xs">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>{matchingCandidateCount} Verified</span>
                    </div>
                  </div>

                  {/* Structured Form Controls */}
                  <div className="relative z-10 bg-slate-950/70 p-3.5 sm:p-5 rounded-2xl border border-white/10 backdrop-blur-md space-y-4 shadow-inner">
                    <div className={`grid ${isMobile ? 'grid-cols-2 gap-2.5' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'}`}>
                      {/* 1. Purpose (Buy vs Rent) */}
                      <div className={isMobile ? "col-span-1 space-y-1" : "space-y-1.5"}>
                        <label className="text-[11px] font-extrabold text-slate-300 uppercase tracking-wider block">
                          Looking To
                        </label>
                        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-900 rounded-xl border border-white/10 h-10 items-center">
                          <button
                            type="button"
                            onClick={() => {
                              setAiPurpose('sale');
                              if (aiPropertyType === 'pg') setAiPropertyType('all');
                              if (aiBudget !== 'all' && !aiBudget.includes('cr') && !aiBudget.includes('l')) setAiBudget('all');
                              runStructuredAiRanking({
                                purpose: 'sale',
                                propertyType: aiPropertyType === 'pg' ? 'all' : aiPropertyType,
                                budget: (aiBudget !== 'all' && !aiBudget.includes('cr') && !aiBudget.includes('l')) ? 'all' : aiBudget
                              });
                            }}
                            className={`h-full rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${aiPurpose === 'sale'
                              ? 'bg-[#176B4D] text-white shadow-sm font-extrabold'
                              : 'text-slate-400 hover:text-white'
                              }`}
                          >
                            <span>Buy</span>
                            <span className="text-[9px] bg-white/20 px-1 py-0.2 rounded font-semibold">0% Fee</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setAiPurpose('rent');
                              if (aiBudget !== 'all' && (aiBudget.includes('cr') || aiBudget.includes('50l'))) setAiBudget('all');
                              runStructuredAiRanking({
                                purpose: 'rent',
                                budget: (aiBudget !== 'all' && (aiBudget.includes('cr') || aiBudget.includes('50l'))) ? 'all' : aiBudget
                              });
                            }}
                            className={`h-full rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 ${aiPurpose === 'rent'
                              ? 'bg-[#176B4D] text-white shadow-sm font-extrabold'
                              : 'text-slate-400 hover:text-white'
                              }`}
                          >
                            <span>Rent</span>
                            <span className="text-[9px] bg-white/20 px-1 py-0.2 rounded font-semibold">Direct</span>
                          </button>
                        </div>
                      </div>

                      {/* 2. Property Type */}
                      <div className={isMobile ? "col-span-1 space-y-1" : "space-y-1.5"}>
                        <label className="text-[11px] font-extrabold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                          <span>Property Type</span>
                          {aiPurpose === 'rent' && <span className="text-[10px] text-emerald-400 font-bold">PG OK</span>}
                        </label>
                        <div className="relative">
                          <select
                            value={aiPropertyType}
                            onChange={(e) => {
                              const newType = e.target.value;
                              setAiPropertyType(newType);
                              runStructuredAiRanking({ propertyType: newType });
                            }}
                            className="w-full h-10 bg-slate-900 border border-white/15 text-white rounded-xl px-2.5 text-xs font-semibold outline-none focus:border-emerald-400 transition-all appearance-none cursor-pointer pr-7"
                          >
                            <option value="all" className="bg-slate-900 text-white">All Properties</option>
                            <option value="flat" className="bg-slate-900 text-white">Flats &amp; Apartments</option>
                            <option value="house" className="bg-slate-900 text-white">Houses &amp; Luxury Villas</option>
                            <option value="plot" className="bg-slate-900 text-white">Plots &amp; Gated Land</option>
                            <option value="shop" className="bg-slate-900 text-white">Commercial Shops &amp; Office</option>
                            <option value="agricultural" className="bg-slate-900 text-white">Agricultural &amp; Farm Land</option>
                            {aiPurpose === 'rent' && (
                              <option value="pg" className="bg-slate-900 text-emerald-400 font-bold">PG &amp; Co-Living</option>
                            )}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                            <ChevronDown className="w-4 h-4" />
                          </div>
                        </div>
                      </div>

                      {/* 3. Location / Corridor */}
                      <div className={isMobile ? "col-span-2 space-y-1" : "space-y-1.5"}>
                        <label className="text-[11px] font-extrabold text-slate-300 uppercase tracking-wider block">
                          Preferred Location
                        </label>
                        <div className="flex items-center gap-1.5">
                          <div className="relative flex-1 min-w-0">
                            <MapPin className="w-3.5 h-3.5 text-emerald-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                              type="text"
                              value={aiLocation === 'all' ? '' : aiLocation}
                              onChange={(e) => {
                                const val = e.target.value;
                                setAiLocation(val || 'all');
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') runStructuredAiRanking();
                              }}
                              placeholder="Locality (e.g. Indiranagar)..."
                              className="w-full h-10 bg-slate-900 border border-white/15 text-white rounded-xl pl-8 pr-7 text-xs font-semibold outline-none focus:border-emerald-400 placeholder:text-slate-500 transition-all"
                            />
                            {aiLocation && aiLocation !== 'all' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setAiLocation('all');
                                  runStructuredAiRanking({ location: 'all' });
                                }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold p-1"
                                title="Clear location"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={handleUseAiCurrentGps}
                            className="h-10 px-3 bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-400/40 text-emerald-200 rounded-xl text-xs font-bold shrink-0 flex items-center gap-1.5 active:scale-95 transition-all shadow-xs"
                            title="Detect location from current GPS"
                          >
                            <Compass className="w-3.5 h-3.5 text-emerald-300" />
                            <span>GPS</span>
                          </button>
                        </div>
                      </div>

                      {/* 4. Budget Range */}
                      <div className={isMobile ? "col-span-2 space-y-1" : "space-y-1.5"}>
                        <label className="text-[11px] font-extrabold text-slate-300 uppercase tracking-wider block">
                          Budget Range ({aiPurpose === 'sale' ? 'Purchase Price' : 'Monthly Rent'})
                        </label>
                        <div className="relative">
                          <select
                            value={aiBudget}
                            onChange={(e) => {
                              const newBudget = e.target.value;
                              setAiBudget(newBudget);
                              runStructuredAiRanking({ budget: newBudget });
                            }}
                            className="w-full h-10 bg-slate-900 border border-white/15 text-white rounded-xl px-3 text-xs font-semibold outline-none focus:border-emerald-400 transition-all appearance-none cursor-pointer pr-8"
                          >
                            <option value="all" className="bg-slate-900 text-white">Any Budget</option>
                            {aiPurpose === 'sale' ? (
                              <>
                                <option value="under_50l" className="bg-slate-900 text-white">Under ₹50 Lakhs</option>
                                <option value="50l_1cr" className="bg-slate-900 text-white">₹50 Lakhs – ₹1 Crore</option>
                                <option value="1cr_2.5cr" className="bg-slate-900 text-white">₹1 Crore – ₹2.5 Crores</option>
                                <option value="2.5cr_5cr" className="bg-slate-900 text-white">₹2.5 Crores – ₹5 Crores</option>
                                <option value="above_5cr" className="bg-slate-900 text-white">Above ₹5 Crores</option>
                              </>
                            ) : (
                              <>
                                <option value="under_15k" className="bg-slate-900 text-white">Under ₹15,000 / month</option>
                                <option value="15k_30k" className="bg-slate-900 text-white">₹15,000 – ₹30,000 / month</option>
                                <option value="30k_60k" className="bg-slate-900 text-white">₹30,000 – ₹60,000 / month</option>
                                <option value="60k_1.2l" className="bg-slate-900 text-white">₹60,000 – ₹1.2 Lakhs / month</option>
                                <option value="above_1.2l" className="bg-slate-900 text-white">Above ₹1.2 Lakhs / month</option>
                              </>
                            )}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400">
                            <ChevronDown className="w-4 h-4" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Quick Corridor Chips & Action Row */}
                    <div className={`flex ${isMobile ? 'flex-col gap-3' : 'flex-row items-center justify-between gap-3'} pt-1 border-t border-white/10`}>
                      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                        <span className="text-[11px] text-slate-400 font-bold shrink-0">Popular:</span>
                        {['Indiranagar', 'Whitefield', 'Koramangala', 'HSR Layout', 'Sarjapur Road', 'Hebbal'].map((loc) => (
                          <button
                            key={loc}
                            type="button"
                            onClick={() => {
                              setAiLocation(loc);
                              runStructuredAiRanking({ location: loc });
                            }}
                            className={`text-[11px] px-3 py-1 rounded-full border shrink-0 transition-all font-semibold ${aiLocation?.toLowerCase() === loc.toLowerCase()
                              ? 'bg-emerald-600 text-white border-emerald-400 shadow-xs font-bold'
                              : 'bg-white/5 hover:bg-white/15 text-slate-300 border-white/10'
                              }`}
                          >
                            {loc}
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => runStructuredAiRanking()}
                        disabled={isAiLoading}
                        className={`${isMobile ? 'w-full' : 'sm:w-auto px-6'} h-11 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-emerald-950/40 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 shrink-0`}
                      >
                        {isAiLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-emerald-200" />
                            <span>Finding Matches...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 text-emerald-200" />
                            <span>Find Matches</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* AI Results Section */}
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-black text-slate-900 tracking-tight">
                        Recommendations
                      </h4>
                      <span className="bg-emerald-50 text-emerald-800 text-[11px] px-2.5 py-0.5 rounded-full font-bold border border-emerald-200 shrink-0">
                        {aiResults.length} {aiResults.length === 1 ? 'property' : 'properties'}
                      </span>
                    </div>
                    {!isMobile && (
                      <span className="text-xs text-slate-400 font-medium hidden md:inline">
                        Verified matches
                      </span>
                    )}
                  </div>

                  {aiResults.length === 0 ? (
                    <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-3 shadow-xs">
                      <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto text-xl">
                        📍
                      </div>
                      <h4 className="font-extrabold text-sm text-slate-900">
                        {aiLocation && aiLocation !== 'all'
                          ? `No verified listings in "${aiLocation}"`
                          : 'No properties matched this combination'}
                      </h4>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        {aiLocation && aiLocation !== 'all'
                          ? `We could not find active verified properties in "${aiLocation}". Try selecting "All Bengaluru" or explore neighboring corridors.`
                          : 'Try selecting "All Types", clearing the location filter, or widening your budget.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setAiLocation('all');
                          setAiPropertyType('all');
                          setAiBudget('all');
                          runStructuredAiRanking({ location: 'all', propertyType: 'all', budget: 'all' });
                        }}
                        className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                      >
                        {aiLocation && aiLocation !== 'all' ? 'Explore All Locations' : 'Reset All Filters'}
                      </button>
                    </div>
                  ) : (
                    aiResults.map((item, idx) => {
                      const prop = item.property || {};
                      const featuredImgUrl = getFirstPropertyImageUrl(prop);
                      const hasPhoto = Boolean(featuredImgUrl);
                      const priceVal = prop.price;
                      let formattedPrice = 'Price on Request';
                      if (priceVal || priceVal === 0) {
                        if (priceVal >= 10000000) {
                          formattedPrice = `₹${(priceVal / 10000000).toFixed(2)} Cr`;
                        } else if (priceVal >= 100000) {
                          formattedPrice = `₹${(priceVal / 100000).toFixed(2)} L`;
                        } else {
                          formattedPrice = `₹${priceVal.toLocaleString('en-IN')}`;
                        }
                        if (prop.purpose === 'rent') formattedPrice += '/mo';
                      }

                      return (
                        <div
                          key={idx}
                          onClick={() => { setSelectedProperty(prop); setShowDetailModal(true); }}
                          className={`bg-white rounded-2xl border border-slate-200/90 hover:border-emerald-500/50 shadow-xs hover:shadow-lg transition-all duration-300 p-3.5 sm:p-4 cursor-pointer group flex flex-col ${isMobile ? '' : 'md:flex-row'} gap-3.5 items-stretch`}
                        >
                          {/* Property Thumbnail with Match Badge */}
                          <div className={`relative ${isMobile ? 'w-full h-44' : 'w-full md:w-56 h-44 md:h-38'} rounded-xl overflow-hidden bg-slate-100 shrink-0`}>
                            {hasPhoto ? (
                              <img
                                src={featuredImgUrl}
                                alt={prop.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-400 p-3">
                                <Building2 className="w-8 h-8 text-slate-300 mb-1" />
                                <span className="text-[11px] font-bold text-slate-500">Verified Listing</span>
                              </div>
                            )}

                            {/* Match Score Floating Badge */}
                            <div className="absolute top-2.5 left-2.5 bg-slate-900/90 backdrop-blur-md text-emerald-300 border border-emerald-500/40 px-2.5 py-1 rounded-lg text-xs font-black shadow-md flex items-center gap-1.5 z-10">
                              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                              <span>{Math.round((item.score || 0.85) * 100)}% Match</span>
                            </div>

                            {/* Direct Owner 0% Fee Tag */}
                            <div className="absolute bottom-2.5 left-2.5 bg-slate-950/85 backdrop-blur-sm text-slate-200 text-[10px] font-extrabold px-2 py-0.5 rounded shadow z-10">
                              Direct Owner · 0% Fee
                            </div>

                            {/* Mobile Price Overlay */}
                            {isMobile && (
                              <div className="absolute bottom-2.5 right-2.5 bg-[#176B4D] text-white text-xs font-black px-2.5 py-1 rounded-lg shadow-md z-10">
                                {formattedPrice}
                              </div>
                            )}
                          </div>

                          {/* Center Details */}
                          <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5 space-y-2">
                            <div>
                              <div className="flex items-start justify-between gap-3">
                                <h4 className="font-extrabold text-sm sm:text-base text-slate-900 group-hover:text-emerald-700 transition-colors line-clamp-1">
                                  {prop.title}
                                </h4>
                              </div>

                              <div className="flex items-center gap-1 text-xs text-slate-500 font-medium mt-1">
                                <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                                <span className="truncate">{prop.location?.locality || prop.location?.city || 'Bengaluru'}</span>
                                <span className="text-slate-300">•</span>
                                <span className="capitalize">{prop.propertyType === 'flat' ? 'Apartment' : prop.propertyType || prop.category || 'Residential'}</span>
                              </div>

                              {/* Key Specs Bar */}
                              <div className="flex items-center gap-2 mt-2 text-xs text-slate-600 flex-wrap">
                                {Number(prop.bedrooms) > 0 && (
                                  <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md font-bold text-[11px]">
                                    {prop.bedrooms} BHK
                                  </span>
                                )}
                                {prop.area?.value && (
                                  <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md font-bold text-[11px]">
                                    {prop.area.value} sq.ft
                                  </span>
                                )}
                                <span className="bg-emerald-50 text-emerald-800 border border-emerald-200/80 px-2 py-0.5 rounded-md font-bold text-[11px] capitalize">
                                  For {prop.purpose === 'rent' ? 'Rent' : 'Sale'}
                                </span>
                              </div>

                              {/* AI Verified Match Highlights */}
                              <div className="flex flex-wrap gap-1.5 mt-2.5">
                                {item.explanation?.map((exp, eIdx) => (
                                  <span
                                    key={eIdx}
                                    className="text-[10px] font-semibold bg-emerald-50/80 text-emerald-900 px-2 py-0.5 rounded-md border border-emerald-200/60 flex items-center gap-1"
                                  >
                                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                                    <span>{exp}</span>
                                  </span>
                                ))}
                              </div>
                            </div>

                            {/* Mobile Actions Bar */}
                            {isMobile && (
                              <div className="pt-2 border-t border-slate-100 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => handleOpenCallModal(prop)}
                                  className="flex-1 py-2 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95"
                                >
                                  <Phone className="w-3.5 h-3.5 text-blue-700" />
                                  <span>Call</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenVisitModal(prop)}
                                  className="flex-1 py-2 bg-[#176B4D] hover:bg-[#12583e] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 active:scale-95"
                                >
                                  <Calendar className="w-3.5 h-3.5 text-emerald-200" />
                                  <span>Book Visit</span>
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Desktop Price & Actions Column */}
                          {!isMobile && (
                            <div className="hidden md:flex flex-col items-end justify-between pl-4 border-l border-slate-100 shrink-0 min-w-[160px]" onClick={(e) => e.stopPropagation()}>
                              <div className="text-right">
                                <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                                  {prop.purpose === 'rent' ? 'Monthly Rent' : 'Verified Price'}
                                </div>
                                <div className="text-lg font-black text-emerald-800 mt-0.5">
                                  {formattedPrice}
                                </div>
                                <div className="text-[10px] text-emerald-700 font-bold">0% Brokerage · Direct</div>
                              </div>

                              <div className="flex flex-col gap-2 w-full pt-3">
                                <button
                                  type="button"
                                  onClick={() => handleOpenCallModal(prop)}
                                  className="w-full py-1.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-2xs active:scale-95"
                                >
                                  <Phone className="w-3.5 h-3.5 text-blue-700" />
                                  <span>Direct Call</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenVisitModal(prop)}
                                  className="w-full py-1.5 px-3 bg-[#176B4D] hover:bg-[#12583e] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 active:scale-95"
                                >
                                  <Calendar className="w-3.5 h-3.5 text-emerald-200" />
                                  <span>Book Visit</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* ================================================================
                USER VIEW 4: MY LISTINGS & DEEDS + MY BUYINGS & DEALS (Unified Portfolio)
                ================================================================ */}
            {activeRole === 'user' && (activeTab === 'mylistings' || activeTab === 'buyings') && (
              <div className="space-y-6">
                {/* Unified Portfolio Toggle Pills (Mobile & Desktop) */}
                <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar py-1">
                  <button
                    type="button"
                    onClick={() => { setPortfolioSubTab('listings'); setActiveTab('mylistings'); scrollToTop(true); }}
                    className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 border shadow-xs ${!(activeTab === 'buyings' || portfolioSubTab === 'buyings')
                      ? 'bg-[#E3F7EB] text-[#0A563C] border-[#0A563C]/30 shadow-xs ring-2 ring-[#0A563C]/15 font-black'
                      : 'bg-[#F2FAF5] text-[#136C4E] border-emerald-200/60 hover:bg-[#EAF7EE] font-bold'
                      }`}
                  >
                    <Building2 className="w-4 h-4 text-[#0A563C] shrink-0" />
                    <span>Lists ({myProperties.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setPortfolioSubTab('buyings'); setActiveTab('buyings'); scrollToTop(true); }}
                    className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 border shadow-xs ${(activeTab === 'buyings' || portfolioSubTab === 'buyings')
                      ? 'bg-[#E3F7EB] text-[#0A563C] border-[#0A563C]/30 shadow-xs ring-2 ring-[#0A563C]/15 font-black'
                      : 'bg-[#F2FAF5] text-[#136C4E] border-emerald-200/60 hover:bg-[#EAF7EE] font-bold'
                      }`}
                  >
                    <CreditCard className="w-4 h-4 text-[#0A563C] shrink-0" />
                    <span>Boughts ({myBuyings.length})</span>
                  </button>
                </div>

                {!(activeTab === 'buyings' || portfolioSubTab === 'buyings') ? (
                  <div className="space-y-6">
                    <div className={`bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex ${isMobile ? 'flex-col gap-3' : 'flex-col sm:flex-row sm:items-center'} justify-between`}>
                      <div>
                        <h3 className="font-extrabold text-sm text-emerald-900">Your Listings &amp; Documents</h3>
                        <p className="text-xs text-emerald-700 mt-0.5">
                          Manage your properties, title deeds, and live verification status.
                        </p>
                      </div>
                      <button
                        onClick={() => setShowCreateModal(true)}
                        className={`${isMobile ? 'w-full justify-center py-2.5' : 'px-4 py-2'} bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 transition-all shrink-0`}
                      >
                        <Plus className="w-4 h-4" />
                        + Add Listing
                      </button>
                    </div>

                    <div className="space-y-3">
                      <h4 className="font-extrabold text-slate-900 text-sm">Your Properties</h4>
                      {sortedMyProperties.length === 0 ? (
                        <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-3 shadow-xs">
                          <Building2 className="w-10 h-10 text-slate-300 mx-auto" />
                          <h4 className="font-extrabold text-sm text-slate-800">No properties listed yet</h4>
                          <p className="text-xs text-slate-500 max-w-md mx-auto">
                            You have not posted any properties yet. List your property directly with 0% brokerage.
                          </p>
                          <button
                            onClick={() => setShowCreateModal(true)}
                            className="px-4 py-2 bg-[#184631] hover:bg-[#123625] text-white rounded-xl text-xs font-bold shadow transition-all inline-flex items-center gap-1.5"
                          >
                            <Plus className="w-4 h-4" />
                            <span>Post a Property</span>
                          </button>
                        </div>
                      ) : (
                        sortedMyProperties.map((prop) => (
                          <div key={prop._id || prop.id} className={`bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col ${isMobile ? '' : 'md:flex-row md:items-center'} justify-between gap-3`}>
                            <div className="w-full">
                              <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                                <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${(prop.hasPendingRevision || prop.verificationStatus === 'pending_revision') ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                                  prop.verificationStatus === 'approved' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                                    prop.verificationStatus === 'pending_review' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                                      prop.verificationStatus === 'needs_changes' ? 'bg-purple-100 text-purple-800 border border-purple-300' :
                                        prop.verificationStatus === 'rejected' ? 'bg-red-100 text-red-800 border border-red-300' :
                                          'bg-slate-100 text-slate-700 border border-slate-300'
                                  }`}>
                                  {(prop.hasPendingRevision || prop.verificationStatus === 'pending_revision') ? 'Pending Revision Approval' :
                                    prop.verificationStatus === 'approved' ? 'Live & Verified' :
                                      prop.verificationStatus === 'pending_review' ? 'Pending Approval' :
                                        prop.verificationStatus}
                                </span>
                                <span className="text-xs text-slate-400 font-mono">#{prop._id || prop.id}</span>
                                {prop.availabilityStatus && (
                                  <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded uppercase">
                                    Status: {prop.availabilityStatus}
                                  </span>
                                )}
                              </div>
                              <h4 className="font-extrabold text-sm text-slate-900 leading-tight">{prop.title}</h4>
                              <div className="text-xs text-slate-500 mt-1">
                                {prop.category} · {prop.purpose} · ₹{prop.price?.toLocaleString('en-IN')}
                              </div>

                              {/* Status Notices */}
                              {(prop.hasPendingRevision || prop.verificationStatus === 'pending_revision') && (
                                <div className="mt-2 text-xs bg-amber-50 text-amber-900 p-2.5 rounded-xl border border-amber-200 flex items-start gap-2">
                                  <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                  <div>
                                    <strong>Pending Admin Approval:</strong> You submitted proposed updates for administrative re-verification. The listing is temporarily unlisted from public discovery until approved.
                                  </div>
                                </div>
                              )}

                              {prop.verificationStatus === 'rejected' && (
                                <div className="mt-3 p-3.5 bg-red-50/90 text-red-950 rounded-xl border border-red-300 shadow-2xs space-y-2.5">
                                  <div className="flex items-start gap-2.5">
                                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                                    <div className="space-y-1">
                                      <div className="font-black text-red-900 text-xs tracking-wide uppercase">
                                        ❌ Listing Disqualified / Rejected by Verification Desk
                                      </div>
                                      <p className="text-xs text-red-800 leading-relaxed font-medium">
                                        <strong>Rejection Reason:</strong> {prop.rejectionReason || prop.reviewNotes || 'Does not meet listing standards or verification criteria.'}
                                      </p>
                                      <p className="text-[11px] text-red-700">
                                        As the listing owner, you can edit details, correct boundary/survey records, update deeds, or permanently remove this listing.
                                      </p>
                                    </div>
                                  </div>
                                  <div className="pt-2 border-t border-red-200/80 flex flex-wrap items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => { setEditingProperty(prop); setShowCreateModal(true); }}
                                      className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 active:scale-95"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                      <span>✏️ Fix Listing &amp; Resubmit</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setPropertyToRemove(prop)}
                                      className="px-3 py-1.5 bg-white hover:bg-red-100 text-red-700 border border-red-300 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 text-red-600" />
                                      <span>Delete Listing</span>
                                    </button>
                                  </div>
                                </div>
                              )}

                              {prop.reviewNotes && prop.verificationStatus === 'needs_changes' && (
                                <div className="mt-2 text-xs bg-purple-50 text-purple-900 p-2.5 rounded-xl border border-purple-200">
                                  <strong>Admin Note:</strong> {prop.reviewNotes}
                                </div>
                              )}

                              {/* Confidential Deeds & Demarcation Badges */}
                              <div className="mt-2.5 pt-2 border-t border-slate-100">
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                    Documents &amp; Deeds ({prop.documents?.length || 0}):
                                  </span>
                                  {prop.documents && prop.documents.length > 2 && (
                                    <span className="text-[10px] text-slate-400 font-medium">Scrollable list ↓</span>
                                  )}
                                </div>
                                {prop.documents && prop.documents.length > 0 ? (
                                  <div className="flex flex-wrap items-center gap-1.5 max-h-24 overflow-y-auto custom-smooth-scrollbar pr-1">
                                    {prop.documents.map((doc, dIdx) => (
                                      <div key={dIdx} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-900 font-bold">
                                        <FileText className="w-3 h-3 text-emerald-700 shrink-0" />
                                        <span className="max-w-[130px] truncate" title={doc.name}>{doc.type || doc.name}</span>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSelectedDeedPreview({ doc, property: prop });
                                            setDeedModalPage(1);
                                          }}
                                          className="text-emerald-700 hover:text-emerald-950 underline font-black ml-0.5 shrink-0"
                                        >
                                          Preview
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-[11px] text-slate-400 italic">
                                    No documents attached yet. Click "Edit Listing &amp; Deeds" to upload documents.
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className={`flex flex-wrap items-center gap-2 ${isMobile ? 'w-full pt-2.5 border-t border-slate-100' : ''}`}>
                              {!(prop.availabilityStatus === 'sold' || prop.availabilityStatus === 'rented' || prop.publicationStatus === 'completed') ? (
                                <button
                                  onClick={() => { setEditingProperty(prop); setShowCreateModal(true); }}
                                  className={`${isMobile ? 'flex-1' : ''} px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1`}
                                >
                                  <Edit3 className="w-3.5 h-3.5 text-indigo-700" />
                                  <span>Edit Listing &amp; Deeds</span>
                                </button>
                              ) : (
                                <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200 flex items-center gap-1">
                                  <span>Completed (Archived)</span>
                                </span>
                              )}

                              {/* Permanent Remove Property Action (Requirement 4) */}
                              <button
                                type="button"
                                onClick={() => setPropertyToRemove(prop)}
                                className={`${isMobile ? 'flex-1' : ''} px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1`}
                                title="Permanently remove this property from LandPin"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-600" />
                                <span>Remove Property</span>
                              </button>

                              {prop.availabilityStatus === 'sold' || prop.availabilityStatus === 'rented' ? (
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-300 flex items-center gap-1.5 shadow-2xs">
                                    <CheckCircle className="w-4 h-4 text-emerald-700" />
                                    <span>Closed ({prop.availabilityStatus})</span>
                                  </span>
                                  <button
                                    onClick={() => handleOpenTicketForProperty(prop)}
                                    className="text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg border border-amber-300 transition-all flex items-center gap-1"
                                  >
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                    <span>Get Support</span>
                                  </button>
                                </div>
                              ) : prop.verificationStatus === 'draft' || prop.verificationStatus === 'needs_changes' || prop.verificationStatus === 'rejected' ? (
                                <button
                                  onClick={() => handleSubmitForReview(prop._id || prop.id)}
                                  className={`${isMobile ? 'flex-1' : 'px-4 py-2'} bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5`}
                                >
                                  <Send className="w-3.5 h-3.5" />
                                  Submit for Verification
                                </button>
                              ) : (prop.verificationStatus === 'approved' && !prop.hasPendingRevision) ? (
                                <div className={`flex items-center gap-2 ${isMobile ? 'w-full justify-between' : ''}`}>
                                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 flex items-center gap-1 shrink-0">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                    Verified &amp; Live
                                  </span>
                                  <button
                                    onClick={() => { setSelectedProperty(prop); setShowDealModal(true); }}
                                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg shadow-xs shrink-0"
                                  >
                                    Mark as Closed
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200 flex items-center gap-1">
                                  <Clock className="w-4 h-4 text-amber-600" />
                                  In Review Queue
                                </span>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className={`bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 p-4 rounded-2xl flex ${isMobile ? 'flex-col gap-3' : 'flex-col sm:flex-row sm:items-center'} justify-between`}>
                      <div>
                        <h3 className="font-extrabold text-sm text-emerald-950 flex items-center gap-1.5">
                          <CreditCard className="w-4 h-4 text-emerald-700" />
                          Purchases &amp; Transactions
                        </h3>
                        <p className="text-xs text-emerald-800 mt-0.5">
                          Track your property offers, closing progress, and completed purchases.
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setTicketProperty(null);
                          setTicketCategory('title_dispute');
                          setTicketSubject('[URGENT] Buyer Escrow / Title Escalation');
                          setShowTicketModal(true);
                        }}
                        className={`${isMobile ? 'w-full justify-center py-2' : 'px-3.5 py-2'} bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs flex items-center justify-center gap-1.5 transition-all shrink-0`}
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Request Assistance</span>
                      </button>
                    </div>

                    {myBuyings.length === 0 ? (
                      <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-3">
                        <CreditCard className="w-10 h-10 text-slate-300 mx-auto" />
                        <h4 className="font-extrabold text-sm text-slate-800">No property transactions yet</h4>
                        <p className="text-xs text-slate-500 max-w-md mx-auto">
                          Browse verified listings and submit direct offers to property owners.
                        </p>
                        <button
                          onClick={() => setActiveTab('explore')}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow transition-all inline-flex items-center gap-1"
                        >
                          Explore Properties →
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {myBuyings.map((deal) => {
                          const isCompleted = deal.status === 'completed' || deal.outcome === 'sold' || deal.stage?.includes('Completed') || deal.stage?.includes('Transferred');
                          return (
                            <div key={deal._id || deal.dealReference} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider border ${isCompleted
                                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                      : 'bg-amber-100 text-amber-800 border-amber-300'
                                      }`}>
                                      {isCompleted ? '✓ Title Transferred · Deal Completed' : '⏳ In Escrow · Due Diligence'}
                                    </span>
                                    <span className="text-xs text-slate-400 font-mono">Ref: {deal.dealReference || deal._id}</span>
                                  </div>
                                  <h4 className="font-extrabold text-base text-slate-900 mt-1">{deal.propertyTitle}</h4>
                                  <p className="text-xs text-slate-500">
                                    Seller / Title Holder: <strong>{deal.sellerName || 'Direct Owner'}</strong> · Buyer: <strong>{deal.buyerName}</strong>
                                  </p>
                                </div>
                                <div className="text-right sm:self-center">
                                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Agreed Consideration</span>
                                  <span className="text-lg font-black text-emerald-700">
                                    ₹{deal.offerAmount ? Number(deal.offerAmount).toLocaleString('en-IN') : deal.totalPropertyValue?.toLocaleString('en-IN')}
                                  </span>
                                  <span className="text-[10px] font-bold text-emerald-600 block">0% Brokerage Saved</span>
                                </div>
                              </div>

                              {/* Milestones / Cleared Checks */}
                              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                                <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
                                  <span>Milestone: <strong>{deal.stage}</strong></span>
                                  <span className="text-[11px] font-semibold text-emerald-700">
                                    {isCompleted ? '100% Verified & Discharged' : 'Verification Underway'}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                  {(deal.clearedChecks || ["Kaveri 2.0 Encumbrance Search", "BBMP e-Khata Digital QR", "11E Boundary Demarcation"]).map((chk, cIdx) => (
                                    <span key={cIdx} className="text-[10px] font-bold bg-white text-emerald-800 px-2.5 py-1 rounded-md border border-emerald-200 shadow-2xs flex items-center gap-1">
                                      <Check className="w-3 h-3 text-emerald-600" />
                                      <span>{chk}</span>
                                    </span>
                                  ))}
                                </div>
                              </div>

                              {/* Actions: Priority Dispute / Help Button */}
                              <div className="flex items-center justify-between pt-2">
                                <span className="text-xs text-slate-400">
                                  {isCompleted ? 'Title insured by Andhra Pradesh RERA Concierge' : 'Funds protected in RERA mediated vault'}
                                </span>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleOpenTicketForProperty(deal)}
                                    className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-extrabold shadow-sm flex items-center gap-1.5 transition-all active:scale-95"
                                  >
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    <span>⚡ Raise Priority Dispute / Query</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ================================================================
                USER VIEW 5: SAVED & FAVORITES
                ================================================================ */}
            {activeRole === 'user' && activeTab === 'saved' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900">Saved Properties</h3>
                    <p className="text-xs text-slate-400">Shortlist</p>
                  </div>
                  <span className="text-xs font-bold bg-rose-50 text-rose-700 px-3 py-1 rounded-full border border-rose-200">
                    {favoriteIds.length} Saved
                  </span>
                </div>

                {favoriteIds.length === 0 ? (
                  <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-3 shadow-xs">
                    <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto">
                      <Heart className="w-6 h-6 fill-rose-100 stroke-rose-500" />
                    </div>
                    <div className="text-sm font-bold text-slate-800">No saved properties</div>
                    <p className="text-xs text-slate-400 max-w-xs mx-auto">
                      Tap the heart icon on any listing to save it.
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('explore')}
                      className="px-4 py-2 bg-[#176B4D] hover:bg-[#12583e] text-white rounded-xl text-xs font-bold transition-all shadow-xs inline-block"
                    >
                      Browse Listings
                    </button>
                  </div>
                ) : (
                  <div className={`grid gap-4 ${deviceMode === 'mobile' ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
                    {properties.filter(p => favoriteIds.includes(p._id || p.id)).map((prop) => {
                      const isComparing = comparedPropertyIds.includes(prop._id || prop.id);
                      return (
                        <div
                          key={prop._id || prop.id}
                          className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col cursor-pointer group"
                          onClick={() => { setSelectedProperty(prop); setShowDetailModal(true); }}
                        >
                          <div className="relative h-44 bg-slate-100 overflow-hidden flex items-center justify-center">
                            {getFirstPropertyImageUrl(prop) ? (
                              <img
                                src={getFirstPropertyImageUrl(prop)}
                                alt={prop.title}
                                className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                              />
                            ) : (
                              <div className="flex flex-col items-center justify-center text-slate-400 p-4 text-center">
                                <ImageOff className="w-6 h-6 text-slate-300 mb-1" />
                                <span className="text-xs font-bold text-slate-500">Photos not available</span>
                              </div>
                            )}

                            {/* Badges on Saved Card */}
                            <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5 z-10">
                              <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow">
                                ✓ Cadastral Cleared
                              </span>
                              <span className="bg-slate-900/90 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow">
                                Direct Owner
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => handleToggleFavorite(e, prop._id || prop.id)}
                              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all z-10"
                              title="Remove from saved shortlist"
                            >
                              <Heart className="w-4 h-4 fill-current" />
                            </button>
                          </div>

                          <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-black uppercase text-emerald-800 mb-1">
                                <span className="bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                  {prop.purpose === 'rent' ? 'For Rent' : 'For Sale'}
                                </span>
                                <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                                  {prop.propertyType || prop.category}
                                </span>
                                {prop.area?.value && (
                                  <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
                                    {prop.area.value} sq.ft
                                  </span>
                                )}
                              </div>
                              <h4 className="font-extrabold text-sm text-slate-900 line-clamp-1">{prop.title}</h4>
                              <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{prop.location?.address || prop.location?.locality}</p>
                              <div className="text-sm font-extrabold text-emerald-700 mt-2">
                                ₹{prop.price?.toLocaleString('en-IN')}
                              </div>
                            </div>

                            {/* Quick Actions in Saved Shortlist */}
                            <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenVisitModal(prop);
                                }}
                                className="flex-1 bg-[#176B4D] hover:bg-[#12553D] text-white py-1.5 px-3 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 text-center"
                              >
                                Book Visit
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleToggleCompare(e, prop._id || prop.id)}
                                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1 ${isComparing
                                  ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-xs'
                                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                                  }`}
                                title="Compare this property"
                              >
                                <Scale className="w-3.5 h-3.5" />
                                <span>{isComparing ? 'Comparing' : 'Compare'}</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ================================================================
                USER VIEW 6: VISITS & CALL REQUESTS
                ================================================================ */}
            {activeRole === 'user' && activeTab === 'visits' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-slate-200">
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900">Visits &amp; Calls</h3>
                    <p className="text-xs text-slate-400">Scheduled</p>
                  </div>

                  {/* View Mode Toggle: List vs Interactive Monthly Calendar */}
                  <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setVisitViewMode('list')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${visitViewMode === 'list'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>List View</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setVisitViewMode('calendar')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${visitViewMode === 'calendar'
                        ? 'bg-[#184631] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Calendar View</span>
                    </button>
                  </div>
                </div>

                {visitViewMode === 'calendar' ? (
                  <AppointmentsCalendarView
                    appointments={myAppointments}
                    onReschedule={(apt) => setReschedulingApt(apt)}
                    onCancel={(aptId) => handleCancelAppointment(aptId)}
                    cancellingAptId={cancellingAptId}
                  />
                ) : (
                  <div className={`grid gap-4 ${deviceMode === 'mobile' ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                    {/* Confirmed Visits */}
                    <div className="space-y-3">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-[#176B4D]" />
                        Site Visits ({myAppointments.length})
                      </h4>
                      {myAppointments.length === 0 ? (
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 text-center space-y-2">
                          <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
                          <div className="text-xs font-bold text-slate-700">No visits scheduled</div>
                          <p className="text-[11px] text-slate-400">
                            Book a visit from any property listing.
                          </p>
                          <button
                            onClick={() => setActiveTab('explore')}
                            className="text-xs font-bold text-[#176B4D] hover:underline pt-1 inline-block"
                          >
                            Explore Properties →
                          </button>
                        </div>
                      ) : (
                        myAppointments.map((apt) => {
                          const startTime = new Date(apt.startAt).getTime();
                          const endTime = new Date(apt.endAt || startTime + 3600000).getTime();
                          const nowTime = Date.now();
                          const isPast = nowTime >= endTime || apt.status === 'completed';
                          const minutesToStart = Math.floor((startTime - nowTime) / 60000);
                          const displayStatus = isPast ? 'completed' : apt.status;

                          return (
                            <div key={apt._id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-xs text-slate-900">{apt.propertyTitle}</span>
                                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded uppercase ${displayStatus === 'completed'
                                  ? 'bg-slate-100 text-slate-700 border border-slate-300'
                                  : displayStatus === 'confirmed'
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : 'bg-rose-50 text-rose-600 line-through'
                                  }`}>
                                  {displayStatus}
                                </span>
                              </div>
                              <div className="text-xs text-[#176B4D] font-semibold flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" />
                                <span>
                                  {new Date(apt.startAt).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} at {new Date(apt.startAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500">{apt.notes}</p>

                              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                                {isPast ? (
                                  <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                                    <CheckCircle className="w-3.5 h-3.5 text-slate-400" />
                                    <span>Visit Concluded</span>
                                  </span>
                                ) : displayStatus === 'confirmed' ? (
                                  minutesToStart > 20 ? (
                                    <div className="w-full flex items-center justify-end gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setReschedulingApt(apt)}
                                        className="text-[11px] font-bold text-amber-700 hover:text-amber-800 hover:bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-300 transition-all flex items-center gap-1 active:scale-95"
                                      >
                                        <Clock className="w-3 h-3" />
                                        <span>Reschedule</span>
                                      </button>
                                      <button
                                        type="button"
                                        disabled={cancellingAptId === apt._id}
                                        onClick={() => handleCancelAppointment(apt._id)}
                                        className="text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200 transition-all flex items-center gap-1 active:scale-95 disabled:opacity-50"
                                      >
                                        {cancellingAptId === apt._id ? (
                                          <>
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                            <span>Cancelling...</span>
                                          </>
                                        ) : (
                                          <>
                                            <X className="w-3 h-3" />
                                            <span>Cancel Visit</span>
                                          </>
                                        )}
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 flex items-center gap-1">
                                      <span>🔒 Cancellation Locked (&lt;20m · Contact Admin Desk)</span>
                                    </span>
                                  )
                                ) : (
                                  <span className="text-[11px] text-slate-400 italic">Appointment cancelled</span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Call Requests */}
                    <div className="space-y-3">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                        <PhoneCall className="w-4 h-4 text-emerald-700" />
                        Callbacks ({myCallRequests.length})
                      </h4>
                      {myCallRequests.length === 0 ? (
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 text-center space-y-2">
                          <PhoneCall className="w-8 h-8 text-slate-300 mx-auto" />
                          <div className="text-xs font-bold text-slate-700">No callbacks requested</div>
                          <p className="text-[11px] text-slate-400">
                            Request a callback directly from any listing.
                          </p>
                        </div>
                      ) : (
                        myCallRequests.map((call) => (
                          <div key={call._id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-xs text-slate-900">{call.propertyTitle}</span>
                              <span className="text-[10px] font-extrabold bg-blue-100 text-blue-800 px-2 py-0.5 rounded uppercase">
                                {call.status}
                              </span>
                            </div>
                            <div className="text-xs text-slate-700 font-semibold">
                              ⏰ Preferred: {call.preferredTime}
                            </div>
                            <p className="text-[11px] text-slate-500">Note: "{call.note}"</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}



            {/* ================================================================
                USER VIEW 8: LEGAL SUPPORT & DISPUTE DESK
                ================================================================ */}
            {activeRole === 'user' && activeTab === 'support' && (
              <div className="space-y-6">
                <div className={`bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 p-4 rounded-2xl flex ${isMobile ? 'flex-col gap-3' : 'flex-col sm:flex-row sm:items-center'} justify-between`}>
                  <div>
                    <h3 className="font-extrabold text-sm text-amber-950 flex items-center gap-1.5">
                      <Headphones className="w-4 h-4 text-amber-700" />
                      Support &amp; Legal Desk
                    </h3>
                    <p className="text-xs text-amber-800 mt-0.5">
                      Assistance &amp; dispute resolution
                    </p>
                  </div>
                  <button
                    onClick={handleOpenNewTicket}
                    className={`${isMobile ? 'w-full justify-center py-2' : 'px-4 py-2'} bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-extrabold shadow-sm flex items-center justify-center gap-1.5 transition-all shrink-0`}
                  >
                    <Plus className="w-4 h-4" />
                    <span>New Ticket</span>
                  </button>
                </div>

                {myTickets.length === 0 ? (
                  <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-3 shadow-xs">
                    <Headphones className="w-10 h-10 text-slate-300 mx-auto" />
                    <h4 className="font-extrabold text-sm text-slate-800">No open tickets</h4>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                      Need help? Submit a support request.
                    </p>
                    <button
                      onClick={handleOpenNewTicket}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow transition-all inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>New Ticket</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {myTickets.map((tkt) => (
                      <div key={tkt._id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider border ${tkt.priority === 'urgent'
                                ? 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse'
                                : 'bg-blue-100 text-blue-800 border-blue-200'
                                }`}>
                                {tkt.priority === 'urgent' ? '🚨 URGENT FAST-TRACK (4hr SLA)' : 'STANDARD RESOLUTION'}
                              </span>
                              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${tkt.status === 'resolved' ? 'bg-emerald-100 text-emerald-800' :
                                tkt.status === 'in_progress' ? 'bg-indigo-100 text-indigo-800' :
                                  'bg-amber-100 text-amber-800'
                                }`}>
                                Status: {tkt.status}
                              </span>
                              <span className="text-xs text-slate-400 font-mono">#{tkt._id}</span>
                            </div>
                            <h4 className="font-extrabold text-base text-slate-900 mt-1">{tkt.subject}</h4>
                            {tkt.propertyTitle && (
                              <p className="text-xs text-emerald-800 font-bold mt-0.5 flex items-center gap-1">
                                <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                                Linked Property: {tkt.propertyTitle}
                              </p>
                            )}
                          </div>
                          <div className="text-right sm:self-center">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Assigned Advocate</span>
                            <span className="text-xs font-bold text-slate-700">{tkt.assignedStaff || 'RERA Duty Officer'}</span>
                          </div>
                        </div>

                        {/* Ticket Message */}
                        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs text-slate-700 font-medium">
                          <p>{tkt.message}</p>
                        </div>

                        {/* Admin / Registrar Official Reply if available */}
                        {tkt.adminReply && (
                          <div className="bg-emerald-50/80 p-3.5 rounded-xl border border-emerald-300 text-xs text-emerald-950 space-y-1">
                            <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                              <ShieldCheck className="w-4 h-4 text-emerald-700" />
                              <span>Official Registrar Ruling / Resolution:</span>
                            </div>
                            <p className="font-semibold text-emerald-900 pl-5">{tkt.adminReply}</p>
                          </div>
                        )}

                        <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1">
                          <span>Category: <strong className="capitalize">{tkt.category?.replace('_', ' ')}</strong></span>
                          <span>Logged on {new Date(tkt.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ================================================================
                ADMIN DESK: REGIONAL MEDIATION & PROPERTY MANAGEMENT SUITE
                (Verifications, Mediation Calls, Sales & Escrow, Leads, Support)
                ================================================================ */}
            {activeRole === 'admin' && (
              <div className="space-y-6">

                {/* Top KPI Metrics Bar */}
                {adminKpis && (
                  <div className={`grid ${deviceMode === 'mobile' ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-6'} gap-3`}>
                    <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Pending Review</div>
                      <div className="text-xl font-extrabold text-amber-600 mt-1">{adminKpis.pendingReviewCount}</div>
                    </div>
                    <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Approved Listings</div>
                      <div className="text-xl font-extrabold text-emerald-600 mt-1">{adminKpis.approvedCount}</div>
                    </div>
                    <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Live Listings</div>
                      <div className="text-xl font-extrabold text-[#176B4D] mt-1">{adminKpis.publishedCount}</div>
                    </div>
                    <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Mediation Calls</div>
                      <div className="text-xl font-extrabold text-blue-600 mt-1">{adminCalls.length}</div>
                    </div>
                    <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Active Deals</div>
                      <div className="text-xl font-extrabold text-purple-600 mt-1">{adminEscrows.length}</div>
                    </div>
                    <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Support Tickets</div>
                      <div className="text-xl font-extrabold text-rose-600 mt-1">{adminTickets.length}</div>
                    </div>
                  </div>
                )}

                {/* -------------------------------------------------------------
                    SUB-TAB 1: PROPERTY VERIFICATION QUEUE
                    ------------------------------------------------------------- */}
                {adminSubTab === 'verifications' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-extrabold text-slate-900 text-sm">Administrative Verification Queue</h3>
                      <span className="text-xs font-bold text-slate-500">Andhra Pradesh RERA Cadastral &amp; Title Verification</span>
                    </div>

                    {adminQueue.length === 0 ? (
                      <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500 text-sm">
                        ✓ No properties pending verification in current queue.
                      </div>
                    ) : (
                      adminQueue.map((prop) => {
                        const isRevision = Boolean(prop.isRevision || prop.hasPendingRevision);
                        const changes = prop.proposedChanges || prop.pendingRevision?.changes || null;
                        const previous = prop.previousApprovedState || prop.pendingRevision?.previousState || null;

                        return (
                          <div key={prop._id || prop.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3.5">
                            {/* Header with Type & Meta */}
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className={`text-[11px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${isRevision
                                  ? 'bg-purple-100 text-purple-900 border border-purple-300'
                                  : 'bg-amber-100 text-amber-900 border border-amber-300'
                                  }`}>
                                  {isRevision ? `Proposed Edit (Revision v${prop.revisionVersion || (prop.version || 1) + 1})` : 'New Listing Initial Review'}
                                </span>
                                <span className="text-xs text-slate-400 font-mono">#{prop._id || prop.id}</span>
                              </div>
                              <div className="text-xs text-slate-500 font-medium">
                                <span>Owner: <strong className="text-slate-800">{prop.ownerName || 'Property Owner'}</strong> ({prop.ownerId})</span>
                                {prop.submissionDate && (
                                  <span className="ml-2 pl-2 border-l border-slate-200">
                                    Submitted: {new Date(prop.submissionDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Multi-User Dual Ownership Claim / Dispute Alert Banner */}
                            {(prop.hasDualClaim || prop.verificationStatus === 'flagged_dual_claim' || prop.dualClaimDetails) && (
                              <div className="bg-rose-50 border-2 border-rose-300 rounded-xl p-3.5 text-xs space-y-2">
                                <div className="flex flex-wrap items-center justify-between gap-1">
                                  <span className="font-extrabold text-rose-900 flex items-center gap-1.5 text-xs sm:text-sm">
                                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                                    ⚠️ Multi-User Property Claim Dispute Detected!
                                  </span>
                                  <span className="text-[10px] bg-rose-200 text-rose-900 px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider">
                                    {prop.dualClaimDetails?.collisionCode || 'DUAL_OWNERSHIP_CLAIM'}
                                  </span>
                                </div>
                                <p className="text-slate-700 font-medium">
                                  Another citizen (<strong className="text-slate-900">{prop.dualClaimDetails?.otherOwnerName || 'Prior Claimant'}</strong>, ID: <code className="text-rose-800">{prop.dualClaimDetails?.otherOwnerId || 'Conflicting User'}</code>) has also submitted a listing for this same property:
                                </p>
                                <div className="bg-white p-2.5 rounded-lg border border-rose-200 font-mono text-[11px] text-rose-950">
                                  Matched Property: <strong>{prop.dualClaimDetails?.matchedPropertyTitle || prop.dualClaimTargetTitle || 'Conflicting Land Listing'}</strong> ({prop.dualClaimDetails?.matchedPropertyId || prop.dualClaimTargetId})
                                  <div className="text-slate-600 text-[10px] mt-0.5">
                                    Collision Detail: {prop.dualClaimDetails?.collisionReason || 'Identical Cadastral Survey number, GPS coordinates, or address registered by multiple users.'}
                                  </div>
                                </div>
                                <div className="text-[11px] text-rose-800 font-bold flex items-center gap-1">
                                  <span>⚖️ Legal Action: Inspect deed documents below to confirm the authentic registered title holder before approving.</span>
                                </div>
                              </div>
                            )}

                            <div>
                              <h4 className="font-extrabold text-base text-slate-900">{prop.title}</h4>
                              <p className="text-xs text-slate-600 mt-1">{prop.description}</p>
                              <div className="text-xs text-indigo-700 font-bold mt-1">
                                ₹{prop.price?.toLocaleString('en-IN')} · {prop.category} ({prop.propertyType}) · Purpose: {prop.purpose}
                              </div>
                            </div>

                            {/* Side-by-Side Diff Comparison for Edit Revisions (Requirement 2 & 3) */}
                            {isRevision && changes && (
                              <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-3.5 text-xs space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="font-extrabold text-purple-950 flex items-center gap-1.5">
                                    <Edit3 className="w-3.5 h-3.5 text-purple-700" />
                                    Proposed Changes for Reapproval (Review against current approved listing)
                                  </span>
                                  <span className="text-[10px] bg-purple-200 text-purple-900 px-2 py-0.5 rounded font-black">
                                    v{prop.version || 1} → v{prop.revisionVersion || (prop.version || 1) + 1}
                                  </span>
                                </div>

                                <div className="overflow-x-auto">
                                  <table className="w-full text-left text-[11px] border-collapse">
                                    <thead>
                                      <tr className="border-b border-purple-200 text-purple-900">
                                        <th className="py-1 px-2 font-bold">Field</th>
                                        <th className="py-1 px-2 font-bold text-slate-600">Currently Approved Version</th>
                                        <th className="py-1 px-2 font-bold text-emerald-800">Proposed Updated Version</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-purple-100">
                                      {changes.title && (
                                        <tr>
                                          <td className="py-1 px-2 font-bold text-slate-700">Title</td>
                                          <td className="py-1 px-2 text-slate-500 line-through">{previous?.title || prop.title}</td>
                                          <td className="py-1 px-2 font-bold text-emerald-900">{changes.title}</td>
                                        </tr>
                                      )}
                                      {changes.price !== undefined && (
                                        <tr>
                                          <td className="py-1 px-2 font-bold text-slate-700">Price</td>
                                          <td className="py-1 px-2 text-slate-500 line-through">₹{Number(previous?.price || prop.price).toLocaleString('en-IN')}</td>
                                          <td className="py-1 px-2 font-bold text-emerald-900">₹{Number(changes.price).toLocaleString('en-IN')}</td>
                                        </tr>
                                      )}
                                      {changes.description && (
                                        <tr>
                                          <td className="py-1 px-2 font-bold text-slate-700">Description</td>
                                          <td className="py-1 px-2 text-slate-500 line-through max-w-[200px] truncate">{previous?.description || prop.description}</td>
                                          <td className="py-1 px-2 font-bold text-emerald-900 max-w-[200px] truncate">{changes.description}</td>
                                        </tr>
                                      )}
                                      {changes.category && (
                                        <tr>
                                          <td className="py-1 px-2 font-bold text-slate-700">Category</td>
                                          <td className="py-1 px-2 text-slate-500 line-through">{previous?.category || prop.category}</td>
                                          <td className="py-1 px-2 font-bold text-emerald-900">{changes.category}</td>
                                        </tr>
                                      )}
                                      {changes.propertyType && (
                                        <tr>
                                          <td className="py-1 px-2 font-bold text-slate-700">Property Type</td>
                                          <td className="py-1 px-2 text-slate-500 line-through">{previous?.propertyType || prop.propertyType}</td>
                                          <td className="py-1 px-2 font-bold text-emerald-900">{changes.propertyType}</td>
                                        </tr>
                                      )}
                                      {changes.area && (
                                        <tr>
                                          <td className="py-1 px-2 font-bold text-slate-700">Area</td>
                                          <td className="py-1 px-2 text-slate-500 line-through">{previous?.area?.value || prop.area?.value} {previous?.area?.unit || 'sqft'}</td>
                                          <td className="py-1 px-2 font-bold text-emerald-900">{changes.area?.value || changes.area} {changes.area?.unit || 'sqft'}</td>
                                        </tr>
                                      )}
                                      {changes.bedrooms !== undefined && (
                                        <tr>
                                          <td className="py-1 px-2 font-bold text-slate-700">Bedrooms</td>
                                          <td className="py-1 px-2 text-slate-500 line-through">{previous?.bedrooms ?? prop.bedrooms}</td>
                                          <td className="py-1 px-2 font-bold text-emerald-900">{changes.bedrooms}</td>
                                        </tr>
                                      )}
                                      {changes.bathrooms !== undefined && (
                                        <tr>
                                          <td className="py-1 px-2 font-bold text-slate-700">Bathrooms</td>
                                          <td className="py-1 px-2 text-slate-500 line-through">{previous?.bathrooms ?? prop.bathrooms}</td>
                                          <td className="py-1 px-2 font-bold text-emerald-900">{changes.bathrooms}</td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            {/* Private Deeds & Documents Section (Admin Only Inspection) */}
                            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <FileText className="w-4 h-4 text-emerald-700" />
                                  <span className="font-extrabold text-slate-800">
                                    Private Deeds &amp; Cadastral Survey Records ({prop.documents?.length || 2} documents attached)
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setInspectedAdminPropId(inspectedAdminPropId === (prop._id || prop.id) ? null : (prop._id || prop.id))}
                                  className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-100 hover:bg-emerald-200 px-3 py-1 rounded-lg border border-emerald-300 transition-all shadow-2xs"
                                >
                                  {inspectedAdminPropId === (prop._id || prop.id) ? '▲ Hide Private Documents' : '▼ Inspect Land Deeds & Documents (Admin Only)'}
                                </button>
                              </div>

                              {/* Expanded Private Inspection Drawer */}
                              {inspectedAdminPropId === (prop._id || prop.id) && (
                                <div className="bg-white p-4 rounded-xl border border-emerald-200 space-y-4 animate-in fade-in duration-150">

                                  {/* Land Survey & Cadastral Demarcation Details */}
                                  <div className="bg-emerald-50/60 p-3 rounded-lg border border-emerald-200 text-xs space-y-1.5">
                                    <div className="font-extrabold text-emerald-950 flex items-center gap-1.5">
                                      <Compass className="w-3.5 h-3.5 text-emerald-700" />
                                      <span>Land Cadastral Survey &amp; Title Verification Data:</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-700 pt-1">
                                      <div><span className="text-slate-500">Survey / Khata No:</span> <strong className="text-slate-900">{prop.landDetails?.surveyNumber || prop.typeSpecificData?.plotDimension || 'Sy. No. 42/1B, Varthur Hobli'}</strong></div>
                                      <div><span className="text-slate-500">Khata Authority:</span> <strong className="text-slate-900">{prop.typeSpecificData?.approvalAuthority || 'BBMP A-Khata Verified'}</strong></div>
                                      <div className="col-span-2"><span className="text-slate-500">Four Boundary Demarcation:</span> <strong className="text-slate-900">{prop.landDetails?.boundaryDetails || 'North: 40ft Main Road, South: Plot 18, East: Green Park, West: Private Villa'}</strong></div>
                                    </div>
                                  </div>

                                  {/* Uploaded Private Documents List with Direct Verification Links */}
                                  <div>
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                                        Uploaded Confidential Deeds ({prop.documents?.length || 0} attached):
                                      </div>
                                      {prop.documents && prop.documents.length > 2 && (
                                        <span className="text-[10px] text-slate-500 font-medium">Scroll down for all documents ↓</span>
                                      )}
                                    </div>
                                    {prop.documents && prop.documents.length > 0 ? (
                                      <div className={`grid gap-2 max-h-52 overflow-y-auto custom-smooth-scrollbar pr-1 ${deviceMode === 'mobile' ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                                        {prop.documents.map((doc, dIdx) => (
                                          <div key={dIdx} className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex items-center justify-between text-xs hover:border-emerald-300 transition-colors">
                                            <div className="flex items-center gap-2 overflow-hidden">
                                              <FileText className="w-4 h-4 text-emerald-700 shrink-0" />
                                              <div className="truncate">
                                                <div className="font-bold text-slate-800 truncate" title={doc.name}>{doc.name}</div>
                                                <div className="text-[10px] text-slate-400 font-medium">{doc.type || 'Certified Deed'} · {doc.size || '2.5 MB'} {doc.pages ? `· ${doc.pages} Pages` : ''}</div>
                                              </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                              <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${doc.status === 'pending_review'
                                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                                : 'bg-emerald-100 text-emerald-800'
                                                }`}>
                                                {doc.status === 'pending_review' ? '⏳ Pending' : '✓ Reviewed'}
                                              </span>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setSelectedDeedPreview({ doc, property: prop });
                                                  setDeedModalPage(1);
                                                }}
                                                className="text-[10px] text-emerald-800 hover:text-emerald-950 font-bold underline px-1"
                                              >
                                                Preview Deed
                                              </button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-center gap-2 font-medium">
                                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                                        <span>No confidential title deeds or survey sketches uploaded yet by seller for Sy. No. {prop.landDetails?.surveyNumber || prop.title}.</span>
                                      </div>
                                    )}
                                  </div>

                                  {/* Admin Action Checklist */}
                                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-700 space-y-1.5">
                                    <div className="font-extrabold text-slate-800">Legal Title Audit Checklist:</div>
                                    <div className="grid grid-cols-2 gap-1.5">
                                      <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input type="checkbox" defaultChecked className="accent-emerald-600 rounded" />
                                        <span>Chain of Title (Mother Deed to Present)</span>
                                      </label>
                                      <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input type="checkbox" defaultChecked className="accent-emerald-600 rounded" />
                                        <span>15–30 Year EC (Zero Encumbrances)</span>
                                      </label>
                                      <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input type="checkbox" defaultChecked className="accent-emerald-600 rounded" />
                                        <span>Municipal e-Khata &amp; Current Tax Paid</span>
                                      </label>
                                      <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input type="checkbox" defaultChecked className="accent-emerald-600 rounded" />
                                        <span>Cadastral Boundary Stones Match Ground</span>
                                      </label>
                                    </div>
                                  </div>

                                </div>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                              <button
                                onClick={() => handleAdminApprove(prop)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm transition-all"
                              >
                                <Check className="w-3.5 h-3.5" />
                                {isRevision ? 'Approve & Publish Revision' : 'Approve & Publish Live'}
                              </button>

                              <button
                                onClick={() => { setSelectedProperty(prop); setShowReviewModal(true); }}
                                className="bg-purple-600 hover:bg-purple-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm transition-all"
                              >
                                Request Changes
                              </button>

                              <button
                                onClick={() => { setRejectingProperty(prop); setRejectionReasonInput(''); }}
                                className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all"
                              >
                                {isRevision ? 'Reject Revision' : 'Reject Listing'}
                              </button>

                              <button
                                onClick={() => handleAdminPublish(prop._id || prop.id)}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm transition-all"
                              >
                                Publish to Live Search
                              </button>

                              <button
                                onClick={() => { setSelectedProperty(prop); setShowDealModal(true); }}
                                className="bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm"
                              >
                                Record Deal (Sold/Rented)
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* -------------------------------------------------------------
                    SUB-TAB: APPROVED & LIVE INVENTORY MODERATION (Search, Block, Remove)
                    ------------------------------------------------------------- */}
                {adminSubTab === 'inventory' && (
                  <div className="space-y-4">
                    {/* Module Header Banner */}
                    <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center font-bold">
                            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                          </div>
                          <div>
                            <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">
                              Approved &amp; Live Inventory Desk
                            </h3>
                            <p className="text-xs text-slate-500">
                              Oversee verified listings, search cadastral records, suspend/block, or permanently remove properties.
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-extrabold bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-xl border border-emerald-300 flex items-center gap-1.5">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{adminApprovedProperties.length} Total Approved</span>
                        </span>
                        <button
                          onClick={loadAdminData}
                          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-all"
                          title="Refresh inventory"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Search & Status Filter Bar */}
                    <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
                      {/* Search Bar */}
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={adminApprovedSearch}
                          onChange={(e) => setAdminApprovedSearch(e.target.value)}
                          placeholder="Search approved listings by title, ID (#prop...), survey #, locality, or owner name/phone..."
                          className="w-full pl-9 pr-8 py-2 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-amber-500 rounded-xl text-xs font-semibold text-slate-800 placeholder:text-slate-400 transition-all focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                        />
                        {adminApprovedSearch && (
                          <button
                            onClick={() => setAdminApprovedSearch('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            title="Clear search"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Status Filter Pills */}
                      <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto no-scrollbar">
                        <button
                          onClick={() => setAdminApprovedFilter('all')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                            adminApprovedFilter === 'all'
                              ? 'bg-slate-900 text-white shadow-xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          All ({adminApprovedProperties.length})
                        </button>
                        <button
                          onClick={() => setAdminApprovedFilter('published')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 whitespace-nowrap ${
                            adminApprovedFilter === 'published'
                              ? 'bg-emerald-700 text-white shadow-xs'
                              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}
                        >
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          Live ({adminApprovedProperties.filter(p => p.publicationStatus === 'published' && p.availabilityStatus !== 'suspended').length})
                        </button>
                        <button
                          onClick={() => setAdminApprovedFilter('suspended')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 whitespace-nowrap ${
                            adminApprovedFilter === 'suspended'
                              ? 'bg-red-700 text-white shadow-xs'
                              : 'bg-red-50 hover:bg-red-100 text-red-800 border border-red-200'
                          }`}
                        >
                          <Ban className="w-3 h-3 text-red-400" />
                          Blocked ({adminApprovedProperties.filter(p => p.publicationStatus === 'suspended' || p.availabilityStatus === 'suspended').length})
                        </button>
                      </div>
                    </div>

                    {/* Listings Display */}
                    <div className="space-y-3">
                      {filteredAdminApprovedProperties.length === 0 ? (
                        <div className="bg-white p-10 rounded-2xl border border-slate-200 text-center space-y-3 shadow-xs">
                          <Building2 className="w-10 h-10 text-slate-300 mx-auto" />
                          <h4 className="font-extrabold text-sm text-slate-800">
                            {adminApprovedSearch ? 'No matching approved listings found' : 'No approved properties in database yet'}
                          </h4>
                          <p className="text-xs text-slate-500 max-w-md mx-auto">
                            {adminApprovedSearch
                              ? `No approved properties matched "${adminApprovedSearch}". Try clearing your search or checking another filter.`
                              : 'Properties approved from the review queue will appear here for ongoing moderation, suspension, or removal.'}
                          </p>
                          {adminApprovedSearch && (
                            <button
                              onClick={() => { setAdminApprovedSearch(''); setAdminApprovedFilter('all'); }}
                              className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl shadow-xs transition-all inline-flex items-center gap-1"
                            >
                              <span>Clear Search &amp; Filters</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        filteredAdminApprovedProperties.map((prop) => {
                          const isSuspended = prop.publicationStatus === 'suspended' || prop.availabilityStatus === 'suspended';
                          const isSoldOrRented = prop.availabilityStatus === 'sold' || prop.availabilityStatus === 'rented' || prop.publicationStatus === 'completed';

                          return (
                            <div
                              key={prop._id || prop.id}
                              className={`bg-white p-4 sm:p-5 rounded-2xl border transition-all shadow-sm hover:shadow-md space-y-3 ${
                                isSuspended ? 'border-red-300 bg-red-50/20' : 'border-slate-200'
                              }`}
                            >
                              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                <div className="space-y-1.5 flex-1">
                                  {/* Badges Bar */}
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span
                                      className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 ${
                                        isSuspended
                                          ? 'bg-red-100 text-red-900 border border-red-300'
                                          : isSoldOrRented
                                          ? 'bg-slate-100 text-slate-700 border border-slate-300'
                                          : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                      }`}
                                    >
                                      {isSuspended ? (
                                        <>
                                          <Ban className="w-3 h-3 text-red-600" />
                                          <span>Blocked / Suspended</span>
                                        </>
                                      ) : isSoldOrRented ? (
                                        <>
                                          <CheckCircle className="w-3 h-3 text-slate-600" />
                                          <span>Closed ({prop.availabilityStatus})</span>
                                        </>
                                      ) : (
                                        <>
                                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                          <span>Live &amp; Published</span>
                                        </>
                                      )}
                                    </span>

                                    <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-200 uppercase">
                                      {prop.category} · {prop.purpose}
                                    </span>

                                    <span className="text-[10px] font-mono text-slate-400">
                                      #{prop._id || prop.id}
                                    </span>

                                    <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                                      <span>RERA Cadastral Verified</span>
                                    </span>
                                  </div>

                                  {/* Title & Price */}
                                  <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1">
                                    <h4 className="font-extrabold text-sm sm:text-base text-slate-900 leading-snug">
                                      {prop.title}
                                    </h4>
                                    <div className="text-sm sm:text-base font-black text-emerald-800 shrink-0">
                                      ₹{prop.price?.toLocaleString('en-IN')}
                                    </div>
                                  </div>

                                  {/* Details Row: Address, Survey #, Owner */}
                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1 text-xs text-slate-600">
                                    <div className="flex items-center gap-1.5">
                                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                      <span className="truncate" title={prop.location?.address}>
                                        {prop.location?.address || prop.location?.locality || 'Indiranagar Corridor'}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                      <FileText className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                      <span className="truncate">
                                        Survey: <strong>{prop.landDetails?.surveyNumber || prop.surveyNumber || 'Sy. No. Verified'}</strong>
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                      <User className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                      <span className="truncate">
                                        Owner: <strong>{prop.ownerName || 'Citizen Owner'}</strong> {prop.ownerPhone ? `(${prop.ownerPhone})` : ''}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Suspension Note Alert if blocked */}
                                  {isSuspended && prop.reviewNotes && (
                                    <div className="mt-2 text-xs bg-red-100/90 text-red-950 p-2.5 rounded-xl border border-red-300 flex items-start gap-2">
                                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                                      <div>
                                        <strong>Suspension Reason:</strong> {prop.reviewNotes}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Action Buttons for Administrator */}
                              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => { setSelectedProperty(prop); setShowDetailModal(true); }}
                                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                                  >
                                    <Eye className="w-3.5 h-3.5 text-slate-500" />
                                    <span>Preview Listing</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => { setSelectedProperty(prop); setShowDealModal(true); }}
                                    className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                                  >
                                    <Award className="w-3.5 h-3.5 text-indigo-600" />
                                    <span>Record Deal</span>
                                  </button>
                                </div>

                                <div className="flex items-center gap-2">
                                  {/* Block / Suspend vs Unblock / Publish Toggle */}
                                  {isSuspended ? (
                                    <button
                                      type="button"
                                      onClick={() => handleAdminPublish(prop._id || prop.id)}
                                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 active:scale-95"
                                      title="Restore to public live search"
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
                                      <span>Unblock &amp; Publish</span>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleAdminSuspend(prop)}
                                      className="px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold shadow-2xs transition-all flex items-center gap-1.5 active:scale-95"
                                      title="Temporarily suspend listing from search & map"
                                    >
                                      <Ban className="w-3.5 h-3.5 text-amber-700" />
                                      <span>Block / Suspend</span>
                                    </button>
                                  )}

                                  {/* Permanent Removal Action */}
                                  <button
                                    type="button"
                                    onClick={() => setPropertyToRemove(prop)}
                                    className="px-3.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-300 rounded-xl text-xs font-bold shadow-2xs transition-all flex items-center gap-1.5 active:scale-95"
                                    title="Permanently remove property from LandPin and Supabase"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-red-600" />
                                    <span>Remove Listing</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* -------------------------------------------------------------
                    SUB-TAB: OFFERS, VISITS & DEALS PIPELINE (Mediated Transactions)
                    ------------------------------------------------------------- */}
                {adminSubTab === 'escrows' && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="font-extrabold text-slate-900 text-sm">Deals Pipeline</h3>
                        <p className="text-xs text-slate-400">Offers &amp; milestones</p>
                      </div>
                      <span className="text-xs font-bold bg-[#E8F3EE] text-[#176B4D] px-2.5 py-0.5 rounded-full border border-[#176B4D]/30 shrink-0">
                        {adminEscrows.length} Active
                      </span>
                    </div>

                    <div className="space-y-4">
                      {adminEscrows.map((deal) => (
                        <div key={deal._id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-extrabold text-base text-slate-900">{deal.propertyTitle}</h4>
                              <p className="text-xs text-slate-500 font-mono">Deal Ref: {deal.dealReference || deal._id} · 0% Direct Brokerage</p>
                            </div>
                            <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${deal.status === 'completed' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                              deal.status === 'on_hold' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                                'bg-emerald-50 text-[#176B4D] border border-emerald-200'
                              }`}>
                              {deal.status === 'completed' ? 'Deal Closed (Sold/Rented)' : deal.status === 'on_hold' ? 'Mediation Hold' : 'Active Offer Negotiation'}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs gap-2">
                            <div>
                              <span className="text-slate-400 font-bold block text-[10px]">ASKING VALUE</span>
                              <span className="font-extrabold text-slate-800">
                                {deal.totalPropertyValue > 1000000
                                  ? `₹${(deal.totalPropertyValue / 10000000).toFixed(2)} Cr`
                                  : `₹${deal.totalPropertyValue?.toLocaleString('en-IN')}/mo`}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 font-bold block text-[10px]">CURRENT OFFER</span>
                              <span className="font-extrabold text-[#176B4D]">
                                {deal.offerAmount > 1000000
                                  ? `₹${(deal.offerAmount / 10000000).toFixed(2)} Cr`
                                  : `₹${deal.offerAmount?.toLocaleString('en-IN')}`}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 font-bold block text-[10px]">BUYER / TENANT</span>
                              <span className="font-bold text-slate-800">{deal.buyerName}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 font-bold block text-[10px]">PROPERTY OWNER</span>
                              <span className="font-bold text-slate-800">{deal.sellerName}</span>
                            </div>
                          </div>

                          {/* Due Diligence Checklist */}
                          <div className="space-y-1">
                            <span className="text-xs font-bold text-slate-700">Due Diligence &amp; Title Verification Checklist:</span>
                            <div className="flex flex-wrap gap-2">
                              {deal.clearedChecks?.map((chk, cIdx) => (
                                <span key={cIdx} className="text-[11px] font-semibold bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  {chk}
                                </span>
                              ))}
                              {deal.pendingChecks?.map((chk, pIdx) => (
                                <span key={pIdx} className="text-[11px] font-semibold bg-amber-50 text-amber-800 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-amber-600" />
                                  Pending: {chk}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                            <span className="text-xs text-slate-600">Current Milestone: <strong>{deal.stage}</strong></span>
                            <div className="flex items-center gap-2">
                              {deal.status !== 'completed' && (
                                <button
                                  onClick={() => handleReleaseEscrow(deal._id)}
                                  className="bg-[#176B4D] hover:bg-[#12583e] text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1"
                                >
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  Mark Due Diligence Cleared
                                </button>
                              )}

                              {deal.status !== 'on_hold' && deal.status !== 'completed' && (
                                <button
                                  onClick={() => handleFreezeEscrow(deal._id)}
                                  className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                                >
                                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                                  Hold for Mediation
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* -------------------------------------------------------------
                    SUB-TAB: ADMIN MEDIATION DESK (Direct User-to-Admin Calls & Site Visits)
                    ------------------------------------------------------------- */}
                {adminSubTab === 'calls' && (() => {
                  const liveCalls = adminCalls.filter(c => c.status !== 'completed' && c.status !== 'cancelled');
                  const archivedCalls = adminCalls.filter(c => c.status === 'completed' || c.status === 'cancelled');

                  const liveVisits = adminAppointments.filter(a => {
                    const isPast = Date.now() >= new Date(a.endAt || new Date(a.startAt).getTime() + 3600000).getTime();
                    if (isPast && a.status === 'confirmed') return false;
                    return a.status !== 'completed' && a.status !== 'cancelled';
                  });
                  const archivedVisits = adminAppointments.filter(a => {
                    const isPast = Date.now() >= new Date(a.endAt || new Date(a.startAt).getTime() + 3600000).getTime();
                    if (isPast && a.status === 'confirmed') return true;
                    return a.status === 'completed' || a.status === 'cancelled';
                  });

                  return (
                    <div className="space-y-5">
                      {/* Sub-Tabs: Mediation Calls vs Site Visits */}
                      <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar py-1">
                        <button
                          type="button"
                          onClick={() => setAdminMediationView('calls')}
                          className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 border shadow-xs ${adminMediationView === 'calls'
                            ? 'bg-blue-50 text-blue-900 border-blue-400/50 ring-2 ring-blue-500/15 font-black shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 font-bold'
                            }`}
                        >
                          <PhoneCall className="w-4 h-4 text-blue-700 shrink-0" />
                          <span>Calls ({liveCalls.length})</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setAdminMediationView('visits')}
                          className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 border shadow-xs ${adminMediationView === 'visits'
                            ? 'bg-emerald-50 text-emerald-950 border-emerald-400/50 ring-2 ring-emerald-600/15 font-black shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 font-bold'
                            }`}
                        >
                          <Calendar className="w-4 h-4 text-emerald-700 shrink-0" />
                          <span>Visits ({liveVisits.length})</span>
                        </button>
                      </div>

                      {/* VIEW 1: DIRECT MEDIATION CALLS */}
                      {adminMediationView === 'calls' && (
                        <div className="space-y-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <h3 className="font-extrabold text-slate-900 text-sm">Direct Calls</h3>
                              <p className="text-xs text-slate-400">Buyer inquiries</p>
                            </div>
                            <span className="text-xs font-bold bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full border border-blue-200 shrink-0">
                              {liveCalls.length} Active
                            </span>
                          </div>

                          {/* Live Calls Grid */}
                          {liveCalls.length === 0 ? (
                            <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-2 shadow-xs">
                              <PhoneCall className="w-8 h-8 text-slate-300 mx-auto" />
                              <h4 className="font-extrabold text-slate-700 text-sm">No active calls</h4>
                              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                                All callback requests resolved or archived.
                              </p>
                            </div>
                          ) : (
                            <div className={`grid gap-4 ${deviceMode === 'mobile' ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                              {liveCalls.map((call) => (
                                <div key={call._id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                                  <div className="flex items-center justify-between">
                                    <span className="font-extrabold text-sm text-slate-900">{call.propertyTitle}</span>
                                    <span className="text-[10px] font-extrabold bg-blue-100 text-blue-800 px-2 py-0.5 rounded uppercase">
                                      {call.status}
                                    </span>
                                  </div>
                                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1 text-xs">
                                    <div><strong>Caller:</strong> {call.buyerName} ({call.buyerPhone})</div>
                                    <div><strong>Preferred Window:</strong> {call.preferredTime}</div>
                                    <div className="text-slate-600"><strong>Note:</strong> "{call.note}"</div>
                                  </div>
                                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                                    <a
                                      href={`tel:${call.buyerPhone}`}
                                      className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1 active:scale-95"
                                    >
                                      <Phone className="w-3.5 h-3.5" />
                                      Dial
                                    </a>
                                    <button
                                      type="button"
                                      onClick={() => handleAdminUpdateCallStatus(call._id, 'completed')}
                                      className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold transition-all flex items-center gap-1 active:scale-95"
                                    >
                                      <CheckCircle className="w-3.5 h-3.5 text-emerald-700" />
                                      <span>Mark Completed</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleAdminUpdateCallStatus(call._id, 'cancelled')}
                                      className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1 active:scale-95"
                                    >
                                      <X className="w-3.5 h-3.5 text-rose-600" />
                                      <span>Cancel</span>
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Separate Archived Calls Box */}
                          <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Archive className="w-4 h-4 text-slate-500" />
                                <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">
                                  Archived Calls ({archivedCalls.length})
                                </h4>
                              </div>
                              <button
                                type="button"
                                onClick={() => setShowArchivedCalls(prev => !prev)}
                                className="text-xs font-bold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg border border-blue-200 transition-colors"
                              >
                                {showArchivedCalls ? '▲ Hide Archive' : `▼ Archived (${archivedCalls.length})`}
                              </button>
                            </div>
                            {showArchivedCalls && (
                              archivedCalls.length === 0 ? (
                                <p className="text-xs text-slate-400 italic">No archived calls yet.</p>
                              ) : (
                                <div className={`grid gap-3 pt-2 ${deviceMode === 'mobile' ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                                  {archivedCalls.map((call) => (
                                    <div key={call._id} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2 opacity-85">
                                      <div className="flex items-center justify-between">
                                        <span className="font-bold text-xs text-slate-900 truncate">{call.propertyTitle}</span>
                                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded uppercase ${call.status === 'completed'
                                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                          : 'bg-slate-100 text-slate-600 border border-slate-300 line-through'
                                          }`}>
                                          {call.status === 'completed' ? '✓ Completed' : '✕ Cancelled'}
                                        </span>
                                      </div>
                                      <div className="text-[11px] text-slate-600">
                                        Caller: <strong>{call.buyerName}</strong> ({call.buyerPhone}) · Time: {call.preferredTime}
                                      </div>
                                      {call.note && (
                                        <div className="text-[10px] text-slate-400 truncate">Note: "{call.note}"</div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}

                      {/* VIEW 2: SITE VISITS & PHYSICAL INSPECTIONS */}
                      {adminMediationView === 'visits' && (
                        <div className="space-y-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <h3 className="font-extrabold text-slate-900 text-sm">Site Visits</h3>
                              <p className="text-xs text-slate-400">Scheduled visits</p>
                            </div>
                            <span className="text-xs font-bold bg-emerald-50 text-emerald-800 px-2.5 py-0.5 rounded-full border border-emerald-200 shrink-0">
                              {liveVisits.length} Scheduled
                            </span>
                          </div>

                          {/* Live Visits Grid */}
                          {liveVisits.length === 0 ? (
                            <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-2 shadow-xs">
                              <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
                              <h4 className="font-extrabold text-slate-700 text-sm">No visits scheduled</h4>
                              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                                All scheduled visits concluded or archived.
                              </p>
                            </div>
                          ) : (
                            <div className={`grid gap-3.5 ${deviceMode === 'mobile' ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                              {liveVisits.map((apt) => (
                                <div key={apt._id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-extrabold text-xs text-slate-900 truncate">{apt.propertyTitle || 'Property Site Visit'}</span>
                                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                                      {apt.status}
                                    </span>
                                  </div>
                                  <div className="text-xs text-[#176B4D] font-semibold flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5 text-[#176B4D]" />
                                    <span>
                                      {new Date(apt.startAt).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} at {new Date(apt.startAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                  <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                    <div><strong>Applicant:</strong> {apt.buyerName || 'Verified Buyer'}</div>
                                    {apt.notes && <div className="text-slate-500 mt-0.5">"{apt.notes}"</div>}
                                  </div>
                                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                                    <button
                                      type="button"
                                      onClick={() => handleAdminUpdateAppointmentStatus(apt._id, 'completed')}
                                      className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold transition-all flex items-center gap-1 active:scale-95"
                                    >
                                      <CheckCircle className="w-3 h-3 text-emerald-700" />
                                      <span>Mark Completed</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleAdminUpdateAppointmentStatus(apt._id, 'cancelled')}
                                      className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1 active:scale-95"
                                    >
                                      <X className="w-3 h-3 text-rose-600" />
                                      <span>Cancel Visit</span>
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Separate Archived Visits Box */}
                          <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Archive className="w-4 h-4 text-slate-500" />
                                <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider">
                                  Archived Visits ({archivedVisits.length})
                                </h4>
                              </div>
                              <button
                                type="button"
                                onClick={() => setShowArchivedVisits(prev => !prev)}
                                className="text-xs font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-100/70 hover:bg-emerald-200 px-2.5 py-1 rounded-lg border border-emerald-200 transition-colors"
                              >
                                {showArchivedVisits ? '▲ Hide Archive' : `▼ Archived (${archivedVisits.length})`}
                              </button>
                            </div>
                            {showArchivedVisits && (
                              archivedVisits.length === 0 ? (
                                <p className="text-xs text-slate-400 italic">No archived visits yet.</p>
                              ) : (
                                <div className={`grid gap-3 pt-2 ${deviceMode === 'mobile' ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
                                  {archivedVisits.map((apt) => {
                                    const isPast = Date.now() >= new Date(apt.endAt || new Date(apt.startAt).getTime() + 3600000).getTime();
                                    const finalStatus = (isPast && apt.status === 'confirmed') ? 'completed' : apt.status;
                                    return (
                                      <div key={apt._id} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2 opacity-85">
                                        <div className="flex items-center justify-between">
                                          <span className="font-bold text-xs text-slate-900 truncate">{apt.propertyTitle || 'Property Site Visit'}</span>
                                          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded uppercase ${finalStatus === 'completed'
                                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                            : 'bg-slate-100 text-slate-600 border border-slate-300 line-through'
                                            }`}>
                                            {finalStatus === 'completed' ? '✓ Completed' : '✕ Cancelled'}
                                          </span>
                                        </div>
                                        <div className="text-[11px] text-slate-600">
                                          Applicant: <strong>{apt.buyerName || 'Verified Buyer'}</strong> · Slot: {new Date(apt.startAt).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} at {new Date(apt.startAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                        {apt.notes && (
                                          <div className="text-[10px] text-slate-400 truncate">Notes: "{apt.notes}"</div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* -------------------------------------------------------------
                    SUB-TAB 6: SUPPORT HELPDESK & COMPLAINTS
                    ------------------------------------------------------------- */}
                {adminSubTab === 'support' && (() => {
                  const pendingTickets = adminTickets.filter(t => t.status !== 'resolved');
                  const resolvedTickets = adminTickets.filter(t => t.status === 'resolved');
                  const visibleTickets = adminTicketFilter === 'pending' ? pendingTickets : resolvedTickets;

                  return (
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <h3 className="font-extrabold text-slate-900 text-sm">Support Desk</h3>
                          <p className="text-xs text-slate-400">User tickets</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setAdminTicketFilter('pending')}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${adminTicketFilter === 'pending'
                              ? 'bg-rose-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                          >
                            Pending ({pendingTickets.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setAdminTicketFilter('resolved')}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${adminTicketFilter === 'resolved'
                              ? 'bg-emerald-700 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                          >
                            Resolved ({resolvedTickets.length})
                          </button>
                        </div>
                      </div>

                      {visibleTickets.length === 0 ? (
                        <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-2">
                          <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                          <h4 className="font-extrabold text-sm text-slate-800">
                            {adminTicketFilter === 'pending'
                              ? 'All tickets resolved'
                              : 'No resolved tickets'}
                          </h4>
                          <p className="text-xs text-slate-400">
                            {adminTicketFilter === 'pending'
                              ? 'No pending inquiries'
                              : 'Resolved tickets will appear here'}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {visibleTickets.map((tkt) => (
                            <div key={tkt._id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="font-extrabold text-sm text-slate-900">{tkt.subject}</span>
                                  <span className="text-xs text-slate-400 font-mono">#{tkt._id}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${tkt.priority === 'urgent' ? 'bg-red-100 text-red-800 border border-red-300' :
                                    tkt.priority === 'high' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                                      'bg-slate-100 text-slate-700 border border-slate-300'
                                    }`}>
                                    Priority: {tkt.priority}
                                  </span>
                                  <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${tkt.status === 'resolved' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                                    tkt.status === 'in_progress' ? 'bg-blue-100 text-blue-800 border border-blue-300' :
                                      'bg-amber-100 text-amber-800 border border-amber-300'
                                    }`}>
                                    {tkt.status}
                                  </span>
                                </div>
                              </div>

                              <div className="text-xs text-slate-600 flex flex-wrap items-center gap-2">
                                <span><strong>User:</strong> {tkt.userName}</span>
                                <span>·</span>
                                <span><strong>Category:</strong> {tkt.category}</span>
                                <span>·</span>
                                <span><strong>Assigned:</strong> {tkt.assignedStaff}</span>
                                {tkt.propertyTitle && (
                                  <>
                                    <span>·</span>
                                    <span className="text-emerald-800 font-bold">Property: {tkt.propertyTitle}</span>
                                  </>
                                )}
                              </div>

                              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-800">
                                "{tkt.message}"
                              </div>

                              {/* Official Registrar Ruling / Reply */}
                              {tkt.adminReply && (
                                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-950 space-y-1">
                                  <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                                    <span>Admin Ruling / Resolution:</span>
                                  </div>
                                  <p className="font-semibold text-emerald-900 pl-5">{tkt.adminReply}</p>
                                </div>
                              )}

                              {/* Existing Replies */}
                              {tkt.replies?.length > 0 && (
                                <div className="space-y-1 pl-4 border-l-2 border-indigo-200">
                                  {tkt.replies.map((rep, rIdx) => (
                                    <div key={rIdx} className="text-xs">
                                      <strong className="text-indigo-900">{rep.sender}:</strong> <span className="text-slate-700">{rep.text}</span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                                <span className="text-[11px] text-slate-400">
                                  {tkt.status === 'resolved'
                                    ? `Case closed on ${new Date(tkt.resolvedAt || tkt.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
                                    : 'Awaiting Administrator / Registrar intervention'}
                                </span>
                                {tkt.status !== 'resolved' ? (
                                  <button
                                    onClick={() => {
                                      setSelectedAdminTicket(tkt);
                                      setTicketReplyText('');
                                      setTicketNewStatus('resolved');
                                    }}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1"
                                  >
                                    <Send className="w-3.5 h-3.5" />
                                    Reply &amp; Resolve Ticket
                                  </button>
                                ) : (
                                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200 flex items-center gap-1">
                                    <Check className="w-3.5 h-3.5" /> Resolved &amp; Archival Protected
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* -------------------------------------------------------------
                    SUB-TAB 7: REAL-TIME AUDIT LOGS
                    ------------------------------------------------------------- */}
                {adminSubTab === 'audit' && (
                  <div className="space-y-3">
                    <h4 className="font-extrabold text-slate-900 text-sm">Regulatory Compliance &amp; Moderation Audit Logs</h4>
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-2 max-h-96 overflow-y-auto">
                      {auditLogs.map((log) => (
                        <div key={log._id} className="text-xs p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                          <div>
                            <strong className="text-indigo-900 font-bold">{log.action}:</strong> <span className="text-slate-800">{log.details}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono shrink-0 ml-2">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            )}

          </div>

          {/* Mobile Comparison Dock (Pinned smoothly right above bottom navigation bar) */}
          {deviceMode === 'mobile' && renderCompareDock()}

          {/* Mobile Bottom Navigation Bar for User Account */}
          {deviceMode === 'mobile' && activeRole === 'user' && (
            <div className="bg-white/95 backdrop-blur-md border-t border-slate-200 px-3 py-1.5 flex items-center justify-around sticky bottom-0 z-50 shadow-lg">
              <button
                type="button"
                onClick={() => { setActiveTab('explore'); scrollToTop(true); }}
                className={`flex flex-col items-center gap-0.5 text-[10px] font-extrabold transition-colors ${activeTab === 'explore' ? 'text-[#184631]' : 'text-slate-500 hover:text-slate-800'}`}
              >
                <Compass className={`w-4 h-4 ${activeTab === 'explore' ? 'stroke-[2.5]' : ''}`} />
                <span>Explore</span>
              </button>

              <button
                type="button"
                onClick={() => { setActiveTab('map'); scrollToTop(true); }}
                className={`flex flex-col items-center gap-0.5 text-[10px] font-bold transition-colors ${activeTab === 'map' ? 'text-[#184631] font-extrabold' : 'text-slate-500 hover:text-slate-800'}`}
              >
                <MapPin className={`w-4 h-4 ${activeTab === 'map' ? 'stroke-[2.5]' : ''}`} />
                <span>Map</span>
              </button>

              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="flex flex-col items-center gap-0.5 -mt-2.5 group active:scale-95 transition-transform"
                title="Post Property"
              >
                <div className="w-9 h-9 rounded-full bg-[#184631] hover:bg-[#123625] text-white flex items-center justify-center shadow-md border-2 border-white transition-all">
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                </div>
                <span className="text-[9px] font-extrabold text-slate-700">+ Post</span>
              </button>

              <button
                type="button"
                onClick={() => { triggerAiRecommendations(); scrollToTop(true); }}
                className={`flex flex-col items-center gap-0.5 text-[10px] font-bold transition-colors ${activeTab === 'ai' ? 'text-[#184631] font-extrabold' : 'text-slate-500 hover:text-slate-800'}`}
              >
                <Sparkles className={`w-4 h-4 ${activeTab === 'ai' ? 'stroke-[2.5]' : ''}`} />
                <span>AI Match</span>
              </button>

              <button
                type="button"
                onClick={() => { 
                  if (!requireAuth('Please sign in to access your portfolio dashboard')) return;
                  setPortfolioSubTab('listings'); setActiveTab('mylistings'); scrollToTop(true); 
                }}
                className={`flex flex-col items-center gap-0.5 text-[10px] font-bold transition-colors ${activeTab === 'mylistings' ? 'text-[#184631] font-extrabold' : 'text-slate-500 hover:text-slate-800'}`}
              >
                <Building2 className={`w-4 h-4 ${activeTab === 'mylistings' ? 'stroke-[2.5]' : ''}`} />
                <span>Dashboard</span>
              </button>
            </div>
          )}

        </div>
      </div>      {/* ========================================================================
          MODAL 1: RICH PROPERTY DETAIL MODAL (With Call, Chat, Visit, Escrow)
          ======================================================================== */}
      {showDetailModal && selectedProperty && (
        <PropertyDetailModal
          property={selectedProperty}
          isOwner={Boolean(currentUser?._id && (selectedProperty.ownerId === currentUser._id || selectedProperty.owner_id === currentUser._id))}
          onEditProperty={(prop) => {
            setShowDetailModal(false);
            setEditingProperty(prop);
            setShowCreateModal(true);
          }}
          onClose={() => {
            setShowDetailModal(false);
            updateRouteUrl(activeRole, activeTab, adminSubTab, null);
          }}
          onLaunch3DTour={(p) => {
            setShowDetailModal(false);
            handleLaunch3DTour(p);
          }}
          onBookVisit={() => {
            setShowDetailModal(false);
            handleOpenVisitModal(selectedProperty);
          }}
          onRequestCall={() => {
            setShowDetailModal(false);
            handleOpenCallModal(selectedProperty);
          }}
          onMakeOffer={() => {
            setShowDetailModal(false);
            handleOpenEscrowModal(selectedProperty);
          }}
          isMobile={isMobile}
        />
      )}

      {/* ========================================================================
          MODAL 1B: INTERACTIVE 3D ARCHITECTURAL PROPERTY VIEWER
          ======================================================================== */}
      {showProperty3DModal && property3DTarget && (
        <PropertyViewer3DModal
          property={property3DTarget}
          onClose={() => {
            setShowProperty3DModal(false);
            setProperty3DTarget(null);
          }}
          onBookVisit={() => {
            setShowProperty3DModal(false);
            handleOpenVisitModal(property3DTarget);
          }}
          onRequestCall={() => {
            setShowProperty3DModal(false);
            handleOpenCallModal(property3DTarget);
          }}
          isMobile={isMobile}
        />
      )}

      {/* ========================================================================
          MODAL 3: TOKEN ESCROW OFFER MODAL
          ======================================================================== */}
      {showEscrowModal && selectedProperty && (
        <EscrowModal
          property={selectedProperty}
          onClose={() => setShowEscrowModal(false)}
          onSuccess={handleEscrowSuccess}
        />
      )}

      {/* ========================================================================
          MODAL 4: CATEGORY-ADAPTIVE PROPERTY / PLOT LISTING WIZARD
          ======================================================================== */}
      {showCreateModal && (
        <CreatePropertyModal
          onClose={() => { setShowCreateModal(false); setEditingProperty(null); }}
          onSubmit={handleSaveProperty}
          isMobile={isMobile}
          initialProperty={editingProperty}
        />
      )}

      {/* ========================================================================
          MODAL 4B: LOCATION SEARCH, AUTO GPS & RADIUS RANGE PICKER
          ======================================================================== */}
      {showLocationPicker && (
        <LocationPickerModal
          isOpen={showLocationPicker}
          onClose={() => setShowLocationPicker(false)}
          currentLocation={userLocation}
          radiusKm={maxRadiusKm}
          isMobile={isMobile}
          onApplyLocation={({ location, radiusKm }) => {
            setUserLocation(location);
            setMaxRadiusKm(radiusKm);
            setIsLiveGps(!!location.isLiveGps);
            showToast(`📍 Proximity center set to ${location.name} (${radiusKm} km radius)!`);
          }}
        />
      )}

      {/* ========================================================================
          MODAL 5: BOOK VIEWING APPOINTMENT
          ======================================================================== */}
      {showVisitModal && (
        <div className="modal-overlay animate-in fade-in duration-200">
          <div className={`modal-content-box ${isMobile ? 'p-4 max-w-sm rounded-2xl' : 'p-6 max-w-md rounded-3xl'} space-y-4`}>
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-[#176B4D] flex items-center justify-center font-bold">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 font-display">Schedule Admin-Mediated Site Visit</h3>
                  <p className="text-[11px] text-slate-500">0% Brokerage · Admin Concierge &amp; Licensed Surveyor Escort</p>
                </div>
              </div>
              <button
                onClick={() => setShowVisitModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
              <div className="text-xs font-bold text-slate-800 line-clamp-1">{selectedProperty?.title || 'Selected Property'}</div>
              <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-slate-400" />
                <span className="truncate">{selectedProperty?.location?.address || selectedProperty?.location?.locality || 'Indiranagar'}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Visit Date</span>
                  <span className="text-[10px] text-emerald-700 font-semibold">Future dates only</span>
                </label>
                <input
                  type="date"
                  min={getTomorrowString()}
                  max={getMaxBookingDateString()}
                  value={visitDate}
                  onChange={(e) => setVisitDate(e.target.value)}
                  className="w-full mt-1.5 p-2.5 border border-slate-300 rounded-xl text-xs font-semibold bg-white outline-none focus:ring-2 focus:ring-[#176B4D]"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Time Slot</label>
                <select
                  value={visitTimeSlot}
                  onChange={(e) => setVisitTimeSlot(e.target.value)}
                  className="w-full mt-1.5 p-2.5 border border-slate-300 rounded-xl text-xs font-semibold bg-white outline-none focus:ring-2 focus:ring-[#176B4D]"
                >
                  {VISIT_TIME_SLOTS.map(slot => (
                    <option key={slot.id} value={slot.id}>
                      {slot.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Visit Notes (Optional)</label>
                <textarea
                  value={visitNotes}
                  onChange={(e) => setVisitNotes(e.target.value)}
                  placeholder="e.g. Interested in checking layout, dimensions, or deed copies"
                  className="w-full mt-1.5 p-2.5 border border-slate-300 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-[#176B4D] h-18 resize-none"
                />
              </div>

              <div className="p-3.5 bg-emerald-50/90 border border-emerald-200 rounded-2xl text-[11px] text-emerald-950 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-emerald-900">
                  <ShieldCheck className="w-4 h-4 text-[#176B4D] shrink-0" />
                  <span>Direct Owner Coordination</span>
                </div>
                <p className="text-emerald-800 leading-relaxed pl-5">
                  Our team coordinates directly with the property owner to confirm your visit time. 0% brokerage fees.
                </p>
              </div>
            </div>

            <div className={`flex ${isMobile ? 'w-full gap-2' : 'justify-end gap-2'} pt-3 border-t`}>
              <button
                type="button"
                onClick={() => setShowVisitModal(false)}
                className={`${isMobile ? 'flex-1' : ''} px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-700 transition-all`}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isBookingVisit}
                onClick={handleBookVisit}
                className={`${isMobile ? 'flex-1' : ''} px-5 py-2 bg-[#176B4D] hover:bg-[#12553D] text-white rounded-xl text-xs font-bold shadow transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 active:scale-95`}
              >
                {isBookingVisit ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Confirming...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Confirm Visit</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================
          MODAL 6: DIRECT ADMIN MEDIATION & CALL DESK
          ======================================================================== */}
      {showCallModal && (
        <div className="modal-overlay">
          <div className={`modal-content-box ${isMobile ? 'p-4 max-w-sm rounded-2xl' : 'p-6 space-y-4 max-w-md rounded-3xl'} space-y-4`}>
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                  <PhoneCall className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 font-display">Direct Call Desk</h3>
                  <p className="text-[11px] text-slate-500">Zero Brokers · Direct Legal Concierge</p>
                </div>
              </div>
              <button onClick={() => setShowCallModal(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <div className="space-y-3">
              {/* Direct Hotline Quick Call Banner */}
              <div className="bg-gradient-to-r from-blue-900 to-indigo-950 p-3.5 rounded-2xl text-white space-y-2 border border-blue-800 shadow-sm">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-xs font-bold text-slate-100">Official LandPin Mediator Hotline</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Speak directly with the Regional Admin Mediator on duty for instant title inquiry, inspection booking, or price negotiation:
                </p>
                <a
                  href="tel:+918041900001"
                  className="w-full py-2 px-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow transition-all active:scale-95"
                >
                  <Phone className="w-3.5 h-3.5 text-slate-950" />
                  <span>Call Hotline: +91 80 4190 0001</span>
                </a>
              </div>

              <div className="relative flex items-center py-1">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-2 text-[10px] uppercase font-bold text-slate-400 tracking-wider">or schedule mediation callback</span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              <p className="text-xs text-slate-600">
                Property: <strong>{selectedProperty?.title || 'Selected Property'}</strong>
              </p>

              <div>
                <label className="text-xs font-bold text-slate-700">Preferred Callback Window</label>
                <select
                  value={callTimeSlot}
                  onChange={(e) => setCallTimeSlot(e.target.value)}
                  className="w-full mt-1 p-2.5 border border-slate-300 rounded-xl text-xs font-semibold bg-white"
                >
                  <option value="Today morning (10:00 AM - 1:00 PM)">Today morning (10:00 AM - 1:00 PM)</option>
                  <option value="Today afternoon (2:00 PM - 5:00 PM)">Today afternoon (2:00 PM - 5:00 PM)</option>
                  <option value="Today evening (5:00 PM - 8:00 PM)">Today evening (5:00 PM - 8:00 PM)</option>
                  <option value="Tomorrow morning (10:00 AM - 1:00 PM)">Tomorrow morning (10:00 AM - 1:00 PM)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Your Phone Number</label>
                <input
                  type="text"
                  value={callPhone}
                  onChange={(e) => setCallPhone(e.target.value)}
                  className="w-full mt-1 p-2.5 border border-slate-300 rounded-xl text-xs font-semibold"
                  placeholder="+91 98450 XXXXX"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Mediation Request / Offer Notes (Optional)</label>
                <textarea
                  value={callNote}
                  onChange={(e) => setCallNote(e.target.value)}
                  className="w-full mt-1 p-2.5 border border-slate-300 rounded-xl text-xs font-semibold h-18 resize-none"
                  placeholder="e.g. Inquiring regarding municipal e-Khata verification or negotiating token price with owner."
                />
              </div>
            </div>

            <div className={`flex ${isMobile ? 'w-full gap-2' : 'justify-end gap-2'} pt-3 border-t`}>
              <button onClick={() => setShowCallModal(false)} className={`${isMobile ? 'flex-1' : ''} px-4 py-2 border rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50`}>
                Cancel
              </button>
              <button
                type="button"
                disabled={isRequestingCall}
                onClick={handleRequestCall}
                className={`${isMobile ? 'flex-1' : ''} px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 active:scale-95`}
              >
                {isRequestingCall ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>Request Call</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================
          MODAL 7: RECORD DEAL COMPLETED (SOLD / RENTED)
          ======================================================================== */}
      {showDealModal && (
        <div className="modal-overlay">
          <div className="modal-content-box p-6 space-y-4 rounded-3xl max-w-md">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-emerald-600" />
                <h3 className="font-extrabold text-base text-slate-900 font-display">Record Deal Outcome</h3>
              </div>
              <button onClick={() => setShowDealModal(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>
            <div className="space-y-3">
              <p className="text-xs text-slate-600">
                Closing transaction for <strong>{selectedProperty?.title || 'Selected Property'}</strong>. Property will be archived from public search results.
              </p>

              <div>
                <label className="text-xs font-bold text-slate-700">Deal Outcome</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setDealOutcome('sold')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold ${dealOutcome === 'sold' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700'}`}
                  >
                    🎉 Sold
                  </button>
                  <button
                    type="button"
                    onClick={() => setDealOutcome('rented')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold ${dealOutcome === 'rented' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700'}`}
                  >
                    🔑 Rented
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Buyer / Tenant Name</label>
                <input
                  type="text"
                  value={dealBuyerName}
                  onChange={(e) => setDealBuyerName(e.target.value)}
                  className="w-full mt-1 p-2.5 border border-slate-300 rounded-xl text-xs font-semibold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Final Agreed Price (₹)</label>
                <input
                  type="number"
                  value={dealFinalPrice}
                  onChange={(e) => setDealFinalPrice(e.target.value)}
                  placeholder={selectedProperty?.price?.toString()}
                  className="w-full mt-1 p-2.5 border border-slate-300 rounded-xl text-xs font-semibold"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button onClick={() => setShowDealModal(false)} className="px-4 py-2 border rounded-xl text-xs font-bold text-slate-600">
                Cancel
              </button>
              <button
                onClick={handleCompleteDeal}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow"
              >
                Archive as {dealOutcome.toUpperCase()}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================
          MODAL 8: ADMIN REQUEST CHANGES
          ======================================================================== */}
      {showReviewModal && (
        <div className="modal-overlay">
          <div className="modal-content-box p-6 space-y-4 rounded-3xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-extrabold text-base text-slate-900 font-display">Request Corrections</h3>
              <button onClick={() => setShowReviewModal(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>
            <div>
              <p className="text-xs text-slate-600">Specify details the owner needs to revise before listing approval.</p>
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="e.g. Please re-upload e-Khata extract with visible QR code and clear boundary demarcations."
                className="w-full mt-2 p-3 border border-slate-300 rounded-xl text-xs font-semibold h-28 outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t">
              <button onClick={() => setShowReviewModal(false)} className="px-4 py-2 border rounded-xl text-xs font-bold text-slate-600">
                Cancel
              </button>
              <button
                onClick={() => handleAdminRequestChanges(selectedProperty?._id || selectedProperty?.id)}
                className="px-5 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold shadow"
              >
                Send to Owner
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================
          MODAL 8B: PERMANENT REMOVE PROPERTY CONFIRMATION (Requirement 4)
          ======================================================================== */}
      {propertyToRemove && (
        <div className="modal-overlay">
          <div className="modal-content-box p-6 space-y-4 rounded-3xl max-w-md border border-red-200 shadow-2xl">
            <div className="flex items-center gap-3 border-b pb-3 text-red-600">
              <div className="p-2.5 bg-red-100 rounded-2xl">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-900 font-display">Remove this property permanently?</h3>
                <p className="text-xs text-slate-500 font-mono">#{propertyToRemove._id || propertyToRemove.id}</p>
              </div>
            </div>
            <div className="space-y-2.5">
              <p className="text-xs text-slate-700 leading-relaxed font-medium">
                This property will be removed from LandPin and will no longer appear in search results or recommendations. You will not be able to restore it through your account.
              </p>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-600">
                <span className="font-bold text-slate-800">{propertyToRemove.title}</span>
                <div className="mt-0.5 text-[11px] text-slate-500">
                  {propertyToRemove.category} · {propertyToRemove.purpose} · ₹{propertyToRemove.price?.toLocaleString('en-IN')}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2.5 pt-3 border-t">
              <button
                type="button"
                onClick={() => setPropertyToRemove(null)}
                disabled={isRemovingProperty}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRemoveProperty}
                disabled={isRemovingProperty}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow transition-all flex items-center gap-1.5"
              >
                {isRemovingProperty ? 'Removing...' : 'Remove Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================
          MODAL 8C: ADMIN REJECT LISTING / REVISION CONFIRMATION
          ======================================================================== */}
      {rejectingProperty && (
        <div className="modal-overlay">
          <div className="modal-content-box p-6 space-y-4 rounded-3xl max-w-md border border-red-200 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <h3 className="font-extrabold text-base text-slate-900 font-display">
                  {rejectingProperty.isRevision || rejectingProperty.hasPendingRevision ? 'Reject Proposed Revision' : 'Reject Property Listing'}
                </h3>
              </div>
              <button onClick={() => setRejectingProperty(null)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>
            <div className="space-y-3">
              <p className="text-xs text-slate-600">
                {rejectingProperty.isRevision || rejectingProperty.hasPendingRevision
                  ? 'Rejecting this revision will discard the proposed changes and restore the last approved listing version back to public discovery.'
                  : 'Please state the official reason for disqualifying this property listing.'}
              </p>
              <div>
                <label className="text-xs font-bold text-slate-700">Official Disqualification / Rejection Reason</label>
                <textarea
                  value={rejectionReasonInput}
                  onChange={(e) => setRejectionReasonInput(e.target.value)}
                  placeholder="e.g. Encumbrance Certificate reveals ongoing litigation, or demarcation survey discrepancies."
                  className="w-full mt-1.5 p-3 border border-slate-300 rounded-xl text-xs font-semibold h-24 outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2.5 pt-3 border-t">
              <button
                type="button"
                onClick={() => setRejectingProperty(null)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleAdminReject(rejectingProperty, rejectionReasonInput || 'Failed verification standards')}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow transition-all"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ========================================================================
          MODAL 10: ADMIN SUPPORT TICKET REPLY MODAL
          ======================================================================== */}
      {selectedAdminTicket && (
        <div className="modal-overlay">
          <div className="modal-content-box p-6 space-y-4 rounded-3xl max-w-lg">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Headphones className="w-5 h-5 text-indigo-600" />
                <h3 className="font-extrabold text-base text-slate-900 font-display">Reply to Ticket</h3>
              </div>
              <button onClick={() => setSelectedAdminTicket(null)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>
            <div className="space-y-3">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs">
                <div><strong>Subject:</strong> {selectedAdminTicket.subject}</div>
                <div><strong>User:</strong> {selectedAdminTicket.userName}</div>
                <div className="mt-1 text-slate-600">"{selectedAdminTicket.message}"</div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">Your Official Resolution / Reply</label>
                <textarea
                  value={ticketReplyText}
                  onChange={(e) => setTicketReplyText(e.target.value)}
                  placeholder="e.g. We have assigned our nodal surveyor to inspect boundary stones tomorrow at 10 AM. Ticket will be marked resolved."
                  className="w-full mt-1.5 p-3 border border-slate-300 rounded-xl text-xs font-semibold h-24 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">Update Ticket Status</label>
                <select
                  value={ticketNewStatus}
                  onChange={(e) => setTicketNewStatus(e.target.value)}
                  className="w-full mt-1 p-2 border border-slate-300 rounded-xl text-xs font-bold bg-white"
                >
                  <option value="in_progress">In Progress (Staff Assigned)</option>
                  <option value="resolved">Resolved &amp; Closed</option>
                  <option value="open">Keep Open</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t">
              <button onClick={() => setSelectedAdminTicket(null)} className="px-4 py-2 border rounded-xl text-xs font-bold text-slate-600">
                Cancel
              </button>
              <button
                onClick={() => handleReplySupportTicket(selectedAdminTicket._id)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow"
              >
                Send Support Reply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================
          MODAL 11: CITIZEN LEGAL SUPPORT & DISPUTE TICKET MODAL
          ======================================================================== */}
      {showTicketModal && (
        <div className="modal-overlay">
          <div className="modal-content-box p-6 space-y-4 rounded-3xl max-w-lg border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <Headphones className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 font-display">Property Support &amp; Inquiries</h3>
                  <p className="text-[11px] text-slate-500">Direct assistance for your listed or purchased properties</p>
                </div>
              </div>
              <button
                onClick={() => { setShowTicketModal(false); setTicketProperty(null); }}
                className="text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            {/* Property Linkage Banner */}
            {ticketProperty && (
              <div className={`p-3 rounded-2xl border text-xs space-y-1 ${ticketProperty.availabilityStatus === 'sold' || ticketProperty.status === 'completed'
                ? 'bg-rose-50 border-rose-300 text-rose-950'
                : 'bg-emerald-50 border-emerald-300 text-emerald-950'
                }`}>
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-[11px] uppercase tracking-wider flex items-center gap-1">
                    {ticketProperty.availabilityStatus === 'sold' || ticketProperty.status === 'completed' ? (
                      <>
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        <span>Priority Support</span>
                      </>
                    ) : (
                      <>
                        <Building2 className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Linked Property</span>
                      </>
                    )}
                  </span>
                  <span className="font-mono text-[10px] text-slate-500">#{ticketProperty._id || ticketProperty.id || ticketProperty.dealReference}</span>
                </div>
                <div className="font-bold">{ticketProperty.title || ticketProperty.propertyTitle}</div>
                <p className="text-[11px] text-slate-600">
                  {ticketProperty.availabilityStatus === 'sold' || ticketProperty.status === 'completed'
                    ? "Requests regarding closed deals or escrow milestones are expedited by our support desk."
                    : "Our team will review your property inquiry and respond promptly."}
                </p>
              </div>
            )}

            <form onSubmit={handleCreateSupportTicket} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Linked Property *</span>
                  <span className="text-[10px] text-amber-700 font-extrabold">Required</span>
                </label>
                <select
                  required
                  value={ticketProperty?._id || ticketProperty?.id || ''}
                  onChange={(e) => {
                    const selId = e.target.value;
                    const found =
                      myBuyings.find(b => (b._id || b.id) === selId) ||
                      myProperties.find(p => (p._id || p.id) === selId);
                    setTicketProperty(found || null);
                  }}
                  className="w-full mt-1 p-2.5 border border-slate-300 rounded-xl text-xs font-bold bg-white focus:ring-2 focus:ring-amber-500 outline-none"
                >
                  <option value="">-- Select a property --</option>
                  {myBuyings.length > 0 && (
                    <optgroup label="Purchased Properties">
                      {myBuyings.map(b => (
                        <option key={b._id || b.id} value={b._id || b.id}>
                          Bought: {b.propertyTitle || b.title} (₹{(b.offerAmount || b.totalPropertyValue)?.toLocaleString('en-IN')})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {myProperties.length > 0 && (
                    <optgroup label="Your Listed Properties">
                      {myProperties.map(p => (
                        <option key={p._id || p.id} value={p._id || p.id}>
                          {p.availabilityStatus === 'sold' ? 'Sold' : 'Listed'}: {p.title} · ({p.availabilityStatus || 'Active'})
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <p className="text-[10px] text-slate-500 mt-1 font-medium">
                  Support requests must be linked to a property you have listed or purchased.
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Category</label>
                <select
                  value={ticketCategory}
                  onChange={(e) => setTicketCategory(e.target.value)}
                  className="w-full mt-1 p-2.5 border border-slate-300 rounded-xl text-xs font-bold bg-white"
                >
                  <option value="title_dispute">Title Deed &amp; Boundary Inquiry</option>
                  <option value="escrow_clearance">Payment &amp; Escrow Question</option>
                  <option value="possession_delay">Registration &amp; Possession Timeline</option>
                  <option value="document_help">Khata &amp; Deed Documentation</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Subject</label>
                <input
                  type="text"
                  required
                  value={ticketSubject}
                  onChange={(e) => setTicketSubject(e.target.value)}
                  placeholder="e.g. Question about deed registration or timeline"
                  className="w-full mt-1 p-2.5 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700">Message Details</label>
                <textarea
                  required
                  rows={4}
                  value={ticketMessage}
                  onChange={(e) => setTicketMessage(e.target.value)}
                  placeholder="Describe your inquiry or question in detail..."
                  className="w-full mt-1 p-3 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-[11px] text-slate-400">
                  LandPin Support Desk
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { setShowTicketModal(false); setTicketProperty(null); }}
                    className="px-4 py-2 border rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingTicket}
                    className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow transition-all active:scale-95 flex items-center gap-1.5"
                  >
                    {isSubmittingTicket ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Logging...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Submit Ticket</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Desktop Floating Side-by-Side Comparison Dock */}
      {deviceMode === 'desktop' && renderCompareDock()}

      {/* Property Comparison Modal */}
      {showComparisonModal && (
        <PropertyComparisonModal
          properties={properties.filter(p => comparedPropertyIds.includes(p._id || p.id))}
          userLocation={userLocation}
          onClose={() => setShowComparisonModal(false)}
          onRemoveProperty={(id) => {
            const updated = comparedPropertyIds.filter(x => x !== id);
            setComparedPropertyIds(updated);
            if (updated.length < 2) setShowComparisonModal(false);
          }}
          onBookVisit={(prop) => {
            setShowComparisonModal(false);
            handleOpenVisitModal(prop);
          }}
          onRequestCall={(prop) => {
            setShowComparisonModal(false);
            handleOpenCallModal(prop);
          }}
          onSelectProperty={(prop) => {
            setShowComparisonModal(false);
            setSelectedProperty(prop);
            setShowDetailModal(true);
          }}
        />
      )}

      {/* ========================================================================
          MODAL 12: OFFICIAL ANDHRA PRADESH CADASTRAL & TITLE DEED AUDIT PREVIEW MODAL
          ======================================================================== */}
      {selectedDeedPreview && (
        <DeedViewerModal
          selectedDeedPreview={selectedDeedPreview}
          setSelectedDeedPreview={setSelectedDeedPreview}
          deedPreviewPage={deedModalPage}
          setDeedPreviewPage={setDeedModalPage}
        />
      )}

      {/* ========================================================================
          MODAL 13: RESCHEDULE VISIT MODAL (Authoritative Slot Availability & Concurrency Guard)
          ======================================================================== */}
      {reschedulingApt && (
        <RescheduleVisitModal
          isOpen={Boolean(reschedulingApt)}
          appointment={reschedulingApt}
          onClose={() => setReschedulingApt(null)}
          onSuccess={(updated) => {
            setMyAppointments(prev => prev.map(a => (a._id === updated._id || a.id === updated.id) ? { ...a, ...updated } : a));
            showToast('✅ Visit successfully rescheduled!');
          }}
        />
      )}

      {/* Global Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-slate-900/95 text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 z-[10002] animate-in fade-in slide-in-from-bottom-4">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></div>
          <span className="text-xs font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Mobile & Password Auth Modal (Login / Sign Up / Reset) */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthSuccess}
        initialMode={authModalMode}
        initialEmail={authResetEmail}
        initialToken={authResetToken}
        initialOtp={authResetOtp}
        isMobile={deviceMode === 'mobile'}
      />

      {/* User Profile & KYC Verification Modal */}
      <UserProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        currentUser={currentUser}
        onUpdateProfile={handleUpdateProfile}
        onLogout={handleLogout}
        myProperties={myProperties}
        myAppointments={myAppointments}
        myCallRequests={myCallRequests}
        myTickets={myTickets}
        onNavigateTab={(tab) => {
          setActiveTab(tab);
          scrollToTop(true);
        }}
      />

    </div>
  );
}
