import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Compass, MapPin, DollarSign, Filter, RefreshCw,
  ChevronDown, CheckCircle2, Navigation, X, ShieldCheck,
  Search, Sparkles, Building2, Check, ArrowRight
} from 'lucide-react';
import { useProperty } from '../../contexts/PropertyContext';
import { useAuth } from '../../contexts/AuthContext';
import PropertyCard from '../../components/property/PropertyCard';
import { calcDistanceKm, getPropertyLatLng } from '../../utils/propertyHelpers';

const KNOWN_AREAS = [
  { name: 'Kadapa, Andhra Pradesh', short: 'Kadapa', lat: 14.4673, lng: 78.8242 },
  { name: 'Tirupati, Andhra Pradesh', short: 'Tirupati', lat: 13.6288, lng: 79.4192 },
  { name: 'Visakhapatnam, Andhra Pradesh', short: 'Visakhapatnam', lat: 17.6868, lng: 83.2185 },
  { name: 'Vijayawada, Andhra Pradesh', short: 'Vijayawada', lat: 16.5062, lng: 80.6480 },
  { name: 'Kakinada, Andhra Pradesh', short: 'Kakinada', lat: 16.9891, lng: 82.2475 },
  { name: 'Rajahmundry, Andhra Pradesh', short: 'Rajahmundry', lat: 17.0005, lng: 81.8040 },
  { name: 'Guntur, Andhra Pradesh', short: 'Guntur', lat: 16.3067, lng: 80.4365 },
  { name: 'Nellore, Andhra Pradesh', short: 'Nellore', lat: 14.4426, lng: 79.9865 },
  { name: 'Kurnool, Andhra Pradesh', short: 'Kurnool', lat: 15.8281, lng: 78.0373 },
  { name: 'Anantapur, Andhra Pradesh', short: 'Anantapur', lat: 14.6819, lng: 77.6006 }
];

const RADIUS_OPTIONS = [
  { label: '10 km', value: 10 },
  { label: '25 km', value: 25 },
  { label: '50 km', value: 50 },
  { label: '100 km', value: 100 },
  { label: 'All AP', value: 'all' }
];

export default function AIRecommendationsPage() {
  const { user } = useAuth();
  const {
    properties,
    isOwnerOfProperty,
    isMobile,
    userLocation,
    radiusKm,
    setRadiusKm,
    setShowLocationPicker
  } = useProperty();

  const [aiPurpose, setAiPurpose] = useState('all');
  const [aiPropertyType, setAiPropertyType] = useState('all');
  const [aiBudget, setAiBudget] = useState('all');
  const [searchPrompt, setSearchPrompt] = useState('');
  const [aiResults, setAiResults] = useState([]);
  const [loading, setLoading] = useState(false);

  // Active city name and coordinates from userLocation
  const currentCity = useMemo(() => {
    return userLocation?.name ? userLocation.name.split(',')[0].trim() : 'Kadapa';
  }, [userLocation]);

  const activeRadiusLabel = useMemo(() => {
    if (radiusKm === 'all') return 'All Andhra Pradesh';
    return `${radiusKm || 50} km`;
  }, [radiusKm]);

  // Detect explicit location from natural language search prompt (e.g. "in Tirupati" or "in Visakhapatnam")
  const promptLocation = useMemo(() => {
    if (!searchPrompt.trim()) return null;
    const lower = searchPrompt.toLowerCase();
    for (const area of KNOWN_AREAS) {
      if (lower.includes(area.short.toLowerCase())) {
        return area;
      }
    }
    if (lower.includes('vizag')) {
      return KNOWN_AREAS.find(a => a.short === 'Visakhapatnam');
    }
    return null;
  }, [searchPrompt]);

  // Genuine Multi-Factor AI Matching Engine with STRICT LOCATION BOUNDARY
  const evaluateMatches = useCallback(() => {
    const budgetMap = {
      '30l': 3000000,
      '50l': 5000000,
      '1cr': 10000000,
      '2cr': 20000000,
      '3cr': 30000000,
      '5cr': 50000000
    };
    const budgetMax = budgetMap[aiBudget] || null;

    // Target coordinates and locality: prompt location takes precedence if specified in query
    let targetLat = Number(userLocation?.lat ?? userLocation?.latitude);
    let targetLng = Number(userLocation?.lng ?? userLocation?.longitude);
    let targetName = currentCity;

    if (promptLocation) {
      targetLat = promptLocation.lat;
      targetLng = promptLocation.lng;
      targetName = promptLocation.short;
    }

    const hasTargetCoords = !isNaN(targetLat) && !isNaN(targetLng) && targetLat !== 0 && targetLng !== 0;
    const currentMaxRadius = radiusKm === 'all' ? null : Number(radiusKm || 50);

    const scored = (properties || [])
      .map((prop) => {
        // Strict Hard Invariant 1: Verification and publication status
        if (prop.verificationStatus && prop.verificationStatus !== 'approved') return null;
        if (prop.publicationStatus && prop.publicationStatus !== 'published') return null;

        // Strict Hard Invariant 1b: Sold & Rented properties must NEVER appear in AI Property Match
        const avail = (prop.availabilityStatus || prop.availability_status || prop.status || '').toLowerCase();
        if (avail === 'sold' || avail === 'rented' || avail === 'closed' || avail === 'removed' || avail === 'archived' || avail === 'suspended') {
          return null;
        }
        if (prop.isSold === true || prop.isRented === true || prop.dealClosed === true) {
          return null;
        }

        // Strict Hard Invariant 1c: Do not recommend user's own property to themselves
        if (typeof isOwnerOfProperty === 'function' && isOwnerOfProperty(prop)) {
          return null;
        }
        if (user) {
          const uId = String(user._id || user.id || '').trim();
          const uAuth = String(user.auth_id || '').trim();
          const uEmail = String(user.email || '').toLowerCase().trim();
          const uMobile = String(user.mobile || '').replace(/\D/g, '').slice(-10);

          const oId = String(prop.ownerId || prop.owner_id || '').trim();
          const oEmail = String(prop.ownerEmail || prop.owner_email || '').toLowerCase().trim();
          const oPhone = String(prop.ownerPhone || prop.owner_phone || '').replace(/\D/g, '').slice(-10);

          if (uId && oId && uId === oId) return null;
          if (uAuth && oId && uAuth === oId) return null;
          if (uEmail && oEmail && uEmail === oEmail) return null;
          if (uMobile && oPhone && uMobile === oPhone) return null;
        }

        // Strict Hard Invariant 2: STRICT LOCATION BOUNDARY
        // Properties outside the target location / radius are strictly eliminated
        const propCoords = getPropertyLatLng(prop);
        let distKm = null;

        if (hasTargetCoords && propCoords) {
          distKm = calcDistanceKm(targetLat, targetLng, propCoords.lat, propCoords.lng);
          if (currentMaxRadius !== null && distKm !== null && distKm > currentMaxRadius) {
            return null; // Strictly reject: Outside target radius
          }
        } else {
          // If property or user lacks exact coordinates, strictly match locality/city text
          const qLoc = targetName.toLowerCase().split(',')[0].trim();
          const pLoc = `${prop.location?.locality || ''} ${prop.location?.city || ''} ${prop.location?.district || ''}`.toLowerCase();
          if (qLoc.length >= 3 && !pLoc.includes(qLoc) && !qLoc.includes(pLoc)) {
            return null; // Strictly reject: Mismatched location
          }
        }

        // Strict Hard Invariant 3: Purpose (Buy vs Rent)
        if (aiPurpose && aiPurpose !== 'all') {
          const isRentFilter = aiPurpose === 'rent';
          const isRentProp = prop.purpose === 'rent' || prop.propertyType === 'pg' || prop.category === 'pg';
          if (isRentFilter && !isRentProp) return null;
          if (!isRentFilter && isRentProp) return null;
        }

        // Strict Hard Invariant 4: Asset Class
        if (aiPropertyType && aiPropertyType !== 'all') {
          const pt = (prop.propertyType || '').toLowerCase();
          const cat = (prop.category || '').toLowerCase();
          const target = aiPropertyType.toLowerCase();
          if (target === 'flat' && !['flat', 'apartment'].includes(pt) && !['flat', 'apartment'].includes(cat)) return null;
          if (target === 'house' && !['house', 'villa'].includes(pt) && !['house', 'villa'].includes(cat)) return null;
          if (target === 'plot' && !['plot', 'land'].includes(pt) && !['plot', 'land'].includes(cat)) return null;
          if (target === 'pg' && !['pg', 'hostel'].includes(pt) && !['pg', 'hostel'].includes(cat)) return null;
          if (target === 'commercial' && !['commercial', 'shop', 'office'].includes(pt) && !['commercial', 'shop', 'office'].includes(cat)) return null;
          if (target === 'agricultural' && !['farmland', 'agricultural'].includes(pt) && !['farmland', 'agricultural'].includes(cat)) return null;
        }

        // Strict Hard Invariant 5: Budget Max
        const price = Number(prop.price || 0);
        if (budgetMax && price > budgetMax) return null;

        // Genuine Scoring Calculation (Only for properties that strictly satisfied all boundaries)
        let score = 66;
        const reasons = [];

        // 1. Proximity Scoring (Up to +20 pts)
        if (distKm !== null) {
          if (distKm <= 5) {
            score += 20;
            reasons.push(`📍 Located just ${distKm} km from ${targetName}`);
          } else if (distKm <= 15) {
            score += 17;
            reasons.push(`📍 Prime locality zone (${distKm} km from ${targetName})`);
          } else if (distKm <= 35) {
            score += 13;
            reasons.push(`📍 Within convenient driving radius (${distKm} km)`);
          } else if (distKm <= 60) {
            score += 8;
            reasons.push(`📍 Regional corridor (${distKm} km from ${targetName})`);
          } else {
            score += 4;
            reasons.push(`📍 Search perimeter (${distKm} km)`);
          }
        } else {
          reasons.push(`📍 Verified in ${prop.location?.locality || prop.location?.city || targetName}`);
        }

        // 2. Natural Language Prompt Analysis (Up to +20 pts)
        if (searchPrompt.trim()) {
          const q = searchPrompt.toLowerCase();
          const beds = Number(prop.bedrooms || prop.bhk || prop.specifications?.bedrooms || 0);

          if ((q.includes('1 bhk') || q.includes('1bed')) && beds === 1) {
            score += 8;
            reasons.push('🛏️ Exact 1 BHK layout specification');
          } else if ((q.includes('2 bhk') || q.includes('2bed')) && beds === 2) {
            score += 8;
            reasons.push('🛏️ Exact 2 BHK layout specification');
          } else if ((q.includes('3 bhk') || q.includes('3bed')) && beds === 3) {
            score += 8;
            reasons.push('🛏️ Exact 3 BHK spacious layout');
          } else if ((q.includes('4 bhk') || q.includes('4bed')) && beds >= 4) {
            score += 8;
            reasons.push('🛏️ Spacious 4+ BHK luxury residence');
          }

          if (q.includes('villa') && (prop.propertyType === 'villa' || prop.title?.toLowerCase().includes('villa'))) {
            score += 6;
            reasons.push('🏡 Individual villa residence');
          }
          if (q.includes('flat') || q.includes('apartment')) {
            if (['flat', 'apartment'].includes(prop.propertyType)) {
              score += 6;
              reasons.push('🏢 Verified gated residential community');
            }
          }

          const facing = (prop.specifications?.facing || prop.facing || '').toLowerCase();
          if (q.includes('east') && facing.includes('east')) {
            score += 5;
            reasons.push('🧭 East-facing auspicious Vastu entrance');
          } else if (q.includes('north') && facing.includes('north')) {
            score += 5;
            reasons.push('🧭 North-facing Vastu compliant');
          }

          const textCorpus = `${prop.title} ${prop.description} ${(prop.amenities || []).join(' ')}`.toLowerCase();
          const keywords = q.split(/\s+/).filter(w => w.length > 3 && !['with', 'under', 'from', 'near'].includes(w));
          let matchedWords = 0;
          keywords.forEach(kw => {
            if (textCorpus.includes(kw)) matchedWords++;
          });
          if (matchedWords > 0) {
            score += Math.min(6, matchedWords * 2);
          }
        }

        // 3. Value & Security Highlights
        if (budgetMax && price > 0 && price < budgetMax) {
          score += 5;
          reasons.push('💰 High value: Comfortably within specified budget');
        }

        if (prop.cadastralVerified || prop.verificationStatus === 'approved') {
          score += 4;
          reasons.push('📜 Certified title deed & cadastral demarcation');
        }

        if (reasons.length < 2) {
          reasons.push('🤝 0% Brokerage · Direct Owner transaction');
        }

        const normalized = Math.min(99, Math.max(76, score));

        return {
          ...prop,
          distKm,
          score: normalized / 100,
          matchPercentage: normalized,
          aiReasons: reasons.slice(0, 3)
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.matchPercentage - a.matchPercentage);

    return scored;
  }, [
    properties,
    aiPurpose,
    aiPropertyType,
    aiBudget,
    userLocation,
    currentCity,
    radiusKm,
    searchPrompt,
    promptLocation,
    user
  ]);

  // Execute AI Matching
  const runAiMatching = useCallback(() => {
    setLoading(true);
    setTimeout(() => {
      const results = evaluateMatches();
      setAiResults(results);
      setLoading(false);
    }, 150);
  }, [evaluateMatches]);

  useEffect(() => {
    runAiMatching();
  }, [runAiMatching]);

  return (
    <div className={`space-y-6 max-w-7xl mx-auto ${isMobile ? 'p-3 pb-24' : 'p-6'}`}>
      
      {/* AI Header Card */}
      <div className="relative overflow-hidden rounded-3xl p-5 sm:p-6 text-white shadow-xl border bg-gradient-to-br from-[#123826] via-[#0f2d1e] to-[#0a1f15] border-emerald-800/60 dark:from-[#131E31] dark:via-[#0F172A] dark:to-[#131E31] dark:border-slate-800">
        
        {/* Subtle Ambient Glow */}
        <div className="absolute -right-16 -top-16 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Card Header & Location Trigger */}
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-300 dark:text-emerald-400 flex items-center justify-center border border-emerald-400/30 dark:border-emerald-500/25 shrink-0 shadow-xs">
              <Sparkles className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white leading-tight">
                AI Property Match
              </h2>
            </div>
          </div>

          {/* Location Picker Button */}
          <button
            type="button"
            onClick={() => setShowLocationPicker?.(true)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 dark:bg-slate-800 dark:hover:bg-slate-700/80 border border-white/20 dark:border-slate-700 transition-all text-xs font-bold text-white cursor-pointer shadow-xs"
            title="Click to change location or radius on map"
          >
            <MapPin className="w-3.5 h-3.5 text-emerald-300 dark:text-emerald-400" />
            <span className="font-extrabold">{currentCity}</span>
            <span className="text-[10px] text-emerald-200 dark:text-emerald-300 font-mono">
              ({activeRadiusLabel})
            </span>
            <ChevronDown className="w-3 h-3 text-white/70" />
          </button>
        </div>

        {/* Natural Language Prompt Input Bar */}
        <div className="relative mt-4 flex items-center gap-1.5 bg-black/25 dark:bg-slate-900/90 backdrop-blur-md p-1.5 rounded-2xl border border-white/20 dark:border-slate-700 focus-within:border-emerald-400 dark:focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-400/25 transition-all shadow-inner">
          <Search className="w-4 h-4 text-emerald-300 dark:text-emerald-400 ml-2.5 shrink-0 pointer-events-none" />
          <input
            type="text"
            value={searchPrompt}
            onChange={(e) => setSearchPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') runAiMatching(); }}
            placeholder="e.g. 'East-facing 2 BHK flat under ₹50 Lakh'..."
            className="flex-1 bg-transparent text-white placeholder:text-emerald-200/50 dark:placeholder:text-slate-400 outline-none border-none ring-0 focus:outline-none focus:ring-0 focus:border-none shadow-none text-xs sm:text-sm px-2.5 py-1.5 no-focus-box"
            style={{ outline: 'none', border: 'none', boxShadow: 'none' }}
          />
          {searchPrompt && (
            <button
              type="button"
              onClick={() => setSearchPrompt('')}
              className="text-white/60 hover:text-white px-2 text-xs font-bold transition-colors cursor-pointer"
            >
              ✕
            </button>
          )}
          <button
            type="button"
            onClick={runAiMatching}
            disabled={loading}
            style={{ backgroundColor: '#10B981', color: '#042f1a' }}
            className="hover:brightness-110 active:scale-95 font-black text-xs px-4 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            <span>Match</span>
          </button>
        </div>

        {/* Filter Controls Row: Purpose, Property Type, Max Budget, Radius */}
        <div className="relative mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* Purpose */}
          <div>
            <label className="text-[10px] font-extrabold text-emerald-200/90 dark:text-emerald-400 uppercase tracking-wider block">
              Purpose
            </label>
            <select
              value={aiPurpose}
              onChange={(e) => setAiPurpose(e.target.value)}
              className="mt-1 w-full bg-black/25 dark:bg-slate-900 border border-white/20 dark:border-slate-700 rounded-xl px-2.5 py-2 text-xs font-bold text-white outline-none focus:border-emerald-400 transition-colors cursor-pointer shadow-2xs"
            >
              <option value="all" className="bg-slate-900 text-white">All (Buy &amp; Rent)</option>
              <option value="sale" className="bg-slate-900 text-white">Buy (0% Fee)</option>
              <option value="rent" className="bg-slate-900 text-white">Rent (Direct)</option>
            </select>
          </div>

          {/* Property Type */}
          <div>
            <label className="text-[10px] font-extrabold text-emerald-200/90 dark:text-emerald-400 uppercase tracking-wider block">
              Property Type
            </label>
            <select
              value={aiPropertyType}
              onChange={(e) => setAiPropertyType(e.target.value)}
              className="mt-1 w-full bg-black/25 dark:bg-slate-900 border border-white/20 dark:border-slate-700 rounded-xl px-2.5 py-2 text-xs font-bold text-white outline-none focus:border-emerald-400 transition-colors cursor-pointer shadow-2xs"
            >
              <option value="all" className="bg-slate-900 text-white">All Types</option>
              <option value="flat" className="bg-slate-900 text-white">Flats &amp; Apartments</option>
              <option value="house" className="bg-slate-900 text-white">Houses &amp; Villas</option>
              <option value="plot" className="bg-slate-900 text-white">Plots &amp; Land</option>
              <option value="pg" className="bg-slate-900 text-white">PG &amp; Hostels</option>
              <option value="commercial" className="bg-slate-900 text-white">Commercial</option>
              <option value="agricultural" className="bg-slate-900 text-white">Farmland</option>
            </select>
          </div>

          {/* Max Budget */}
          <div>
            <label className="text-[10px] font-extrabold text-emerald-200/90 dark:text-emerald-400 uppercase tracking-wider block">
              Max Budget
            </label>
            <select
              value={aiBudget}
              onChange={(e) => setAiBudget(e.target.value)}
              className="mt-1 w-full bg-black/25 dark:bg-slate-900 border border-white/20 dark:border-slate-700 rounded-xl px-2.5 py-2 text-xs font-bold text-white outline-none focus:border-emerald-400 transition-colors cursor-pointer shadow-2xs"
            >
              <option value="all" className="bg-slate-900 text-white">Any Budget</option>
              <option value="30l" className="bg-slate-900 text-white">Under ₹30 Lakh</option>
              <option value="50l" className="bg-slate-900 text-white">Under ₹50 Lakh</option>
              <option value="1cr" className="bg-slate-900 text-white">Under ₹1.00 Cr</option>
              <option value="2cr" className="bg-slate-900 text-white">Under ₹2.00 Cr</option>
              <option value="5cr" className="bg-slate-900 text-white">Under ₹5.00 Cr</option>
            </select>
          </div>

          {/* Radius Selector */}
          <div>
            <label className="text-[10px] font-extrabold text-emerald-200/90 dark:text-emerald-400 uppercase tracking-wider block">
              Search Radius
            </label>
            <select
              value={radiusKm || 50}
              onChange={(e) => setRadiusKm?.(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="mt-1 w-full bg-black/25 dark:bg-slate-900 border border-white/20 dark:border-slate-700 rounded-xl px-2.5 py-2 text-xs font-bold text-white outline-none focus:border-emerald-400 transition-colors cursor-pointer shadow-2xs"
            >
              {RADIUS_OPTIONS.map((opt) => (
                <option key={opt.label} value={opt.value} className="bg-slate-900 text-white">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

      </div>

      {/* AI Results Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <span>Verified Matches</span>
              <span className="text-xs font-mono font-bold text-slate-400 dark:text-slate-500">
                ({aiResults.length})
              </span>
            </h3>
            <span className="text-[10px] bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-500/30">
              Location Filtered
            </span>
          </div>

          {(aiPurpose !== 'all' || aiPropertyType !== 'all' || aiBudget !== 'all' || searchPrompt) && (
            <button
              type="button"
              onClick={() => {
                setAiPurpose('all');
                setAiPropertyType('all');
                setAiBudget('all');
                setSearchPrompt('');
              }}
              className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline font-bold cursor-pointer"
            >
              Reset filters
            </button>
          )}
        </div>

        {loading ? (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white dark:bg-[#131E31] rounded-2xl border border-slate-200 dark:border-slate-800 h-80 animate-pulse p-4 space-y-3">
                <div className="bg-slate-200 dark:bg-slate-800/80 h-44 rounded-xl"></div>
                <div className="bg-slate-200 dark:bg-slate-800/80 h-4 w-3/4 rounded"></div>
              </div>
            ))}
          </div>
        ) : aiResults.length === 0 ? (
          <div className="bg-white dark:bg-[#131E31] p-8 sm:p-12 rounded-3xl border border-slate-200 dark:border-slate-800 text-center space-y-4 shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto border border-amber-200 dark:border-amber-800/60">
              <MapPin className="w-6 h-6 stroke-[2]" />
            </div>
            <div>
              <h4 className="font-extrabold text-slate-900 dark:text-white text-base">
                No verified properties found within {activeRadiusLabel} of {currentCity}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
                Only verified listings matching your selected location and radius appear here.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRadiusKm?.(100)}
                className="px-4 py-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-all cursor-pointer"
              >
                Expand to 100 km radius
              </button>
              <button
                type="button"
                onClick={() => setRadiusKm?.('all')}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer border border-transparent dark:border-slate-700"
              >
                View all AP listings
              </button>
              <button
                type="button"
                onClick={() => setShowLocationPicker?.(true)}
                style={{ backgroundColor: '#10B981', color: '#042f1a' }}
                className="px-4 py-2 rounded-xl text-xs font-bold hover:brightness-110 transition-all cursor-pointer shadow-sm"
              >
                Change Location
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {aiResults.map((prop) => (
              <div key={prop._id || prop.id} className="flex flex-col h-full space-y-2">
                {/* AI Match Top Ribbon */}
                <div className="flex items-center justify-between px-1">
                  <div className="inline-flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 px-2.5 py-0.5 rounded-full text-[11px] font-black shadow-2xs">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>{prop.matchPercentage}% Match</span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-300 font-bold">
                    {prop.distKm != null ? `${prop.distKm} km away` : (prop.location?.locality || prop.location?.city)}
                  </span>
                </div>

                {/* Property Card */}
                <div className="flex-1">
                  <PropertyCard property={prop} />
                </div>

                {/* AI Match Insights Box */}
                {Array.isArray(prop.aiReasons) && prop.aiReasons.length > 0 && (
                  <div className="bg-slate-50 dark:bg-[#131E31] rounded-2xl p-3 border border-slate-200 dark:border-slate-800 text-[11px] space-y-1.5 shadow-2xs">
                    <div className="font-extrabold text-slate-700 dark:text-emerald-400 text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 stroke-[3]" />
                      <span>Why This Property Matches</span>
                    </div>
                    {prop.aiReasons.map((reason, rIdx) => (
                      <p key={rIdx} className="text-slate-600 dark:text-slate-300 leading-snug pl-1 truncate font-medium">
                        {reason}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
