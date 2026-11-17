import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Search, X, MapPin, Navigation, Building2, Home,
  ChevronDown, Clock, ShieldCheck, ArrowUpRight, Bed, DollarSign
} from 'lucide-react';
import { getFirstPropertyImageUrl, calcDistanceKm, getPropertyLatLng } from '../../utils/propertyHelpers';

const RECENT_SEARCHES_KEY = 'landpin_recent_searches';

// 10 Rotating Search Bar Placeholders
const ROTATING_PLACEHOLDERS = [
  'Find your dream home...',
  'Your perfect property starts here...',
  'Search homes, plots & investments...',
  'Discover properties that match your budget...',
  'Looking to buy, sell or rent?...',
  'Explore endless property possibilities...',
  'Find the right property at the right price...',
  'Your next investment is just a search away...',
  'Search by budget, location or property type...',
  'Where would you like to own a property?...',
  'Search 2 BHK apartments in you area...',
  'Find residential plots with clear titles...',
  'Explore verified homes & villas...',
  'Search agricultural land & farms...',
  'Search commercial shops & offices...',
  'Find PG & co-living under ₹10,000...',
  'Search houses for rent...',
  'Find properties under ₹25 Lakhs...',
  'Search DTCP approved plots...',
  'Search by project name or location...',
  'Explore premium furnished villas for rent...',
  'Search flats with zero brokerage...',
  'Find properties under ₹10 Lakhs...',
  'Find properties under ₹10 Lakhs...',
  'Explore homes under ₹50 Lakhs...',
  'Search properties near your favourite location...',


];

// Curated Real Estate Natural Suggestions categorized by intent
const INTENT_DICTIONARY = [
  // 1 BHK
  { text: '1 BHK Flats for Sale', tags: ['1bhk', 'flat', 'apartment', 'sale', 'buy', '1'] },
  { text: '1 BHK flat for rent', tags: ['1bhk', 'rent', 'flat', 'apartment', '1'] },
  // 2 BHK
  { text: '2 BHK flat for sale', tags: ['2bhk', 'flat', 'apartment', 'sale', 'buy', '2'] },
  { text: '2 BHK flats in Kadapa', tags: ['2bhk', 'flat', 'kadapa', 'sale', 'buy', '2'] },
  { text: '2 BHK flats for rent', tags: ['2bhk', 'rent', 'flat', 'apartment', '2'] },
  { text: 'Affordable 2 BHK apartments', tags: ['2bhk', 'flat', 'affordable', 'budget', '2'] },
  { text: 'Ready-to-move 2 BHK flats', tags: ['2bhk', 'flat', 'ready', 'move', '2'] },
  // 3 BHK
  { text: '3 BHK house for sale', tags: ['3bhk', 'house', 'villa', 'sale', 'buy', '3'] },
  { text: '3 BHK luxury apartments', tags: ['3bhk', 'flat', 'luxury', 'sale', '3'] },
  { text: '3 BHK independent villa', tags: ['3bhk', 'villa', 'house', 'sale', '3'] },
  // Houses & Villas
  { text: 'Houses near me', tags: ['house', 'near', 'local', 'home'] },
  { text: 'Independent house with parking', tags: ['house', 'parking', 'independent', 'home'] },
  { text: 'Luxury villas with garden', tags: ['villa', 'luxury', 'garden', 'house'] },
  { text: 'Duplex house with parking', tags: ['duplex', 'house', 'parking'] },
  { text: 'Newly built houses', tags: ['new', 'house', 'home', 'construction'] },
  { text: 'East-facing house for sale', tags: ['east', 'facing', 'house', 'vaastu', 'sale'] },
  { text: 'Gated community villas', tags: ['gated', 'community', 'villa', 'security'] },
  // Plots & Land
  { text: 'Best residential plots for investment', tags: ['plot', 'residential', 'investment', 'land'] },
  { text: 'DTCP approved plots', tags: ['dtcp', 'plot', 'approved', 'land', 'legal'] },
  { text: 'Open plots with clear documents', tags: ['open', 'plot', 'clear', 'title', 'land'] },
  { text: 'Small plots for sale', tags: ['small', 'plot', 'budget', 'land'] },
  { text: 'Corner plots for sale', tags: ['corner', 'plot', 'land'] },
  { text: 'Plots near main road', tags: ['road', 'plot', 'highway', 'land'] },
  // Commercial
  { text: 'Commercial shops for sale', tags: ['commercial', 'shop', 'sale', 'business'] },
  { text: 'Office spaces for rent', tags: ['office', 'commercial', 'rent', 'space'] },
  { text: 'Commercial land for sale', tags: ['commercial', 'land', 'plot', 'business'] },
  { text: 'Showrooms for rent', tags: ['showroom', 'commercial', 'rent', 'retail'] },
  { text: 'Warehouses for rent', tags: ['warehouse', 'commercial', 'rent', 'godown'] },
  // Agriculture & Farm
  { text: 'Agricultural land with water facility', tags: ['agricultural', 'land', 'water', 'farm', 'borewell'] },
  { text: 'Farm Land for Sale', tags: ['farm', 'land', 'farmland', 'sale', 'agriculture'] },
  { text: 'Farmhouse with open land', tags: ['farmhouse', 'farm', 'land', 'open'] },
  // PG & Hostels
  { text: 'PG under 10k', tags: ['pg', 'hostel', '10k', 'rent', 'coliving', 'budget'] },
  { text: 'Boys PG accommodation', tags: ['boys', 'pg', 'hostel', 'rent'] },
  { text: 'Girls PG accommodation', tags: ['girls', 'pg', 'hostel', 'rent'] },
  { text: 'Co-living luxury PG', tags: ['coliving', 'pg', 'luxury', 'single', 'rent'] },
  // Rentals
  { text: 'House for rent', tags: ['rent', 'house', 'rental', 'home'] },
  { text: '1 BHK flat for rent', tags: ['rent', '1bhk', 'flat', 'rental'] },
  { text: 'Rental houses near me', tags: ['rent', 'house', 'near', 'rental'] },
  // Budget Deals
  { text: 'Properties under ₹25 Lakhs', tags: ['budget', '25', 'lakh', 'affordable', 'low'] },
  { text: 'Properties under ₹50 Lakhs', tags: ['budget', '50', 'lakh', 'affordable'] },
  { text: 'Land for sale at a low price', tags: ['low', 'price', 'land', 'plot', 'budget'] },
  { text: 'Direct Owner Properties', tags: ['owner', 'direct', 'brokerage', 'zero'] }
];

const RADIUS_OPTIONS = [
  { label: '10 km', value: 10 },
  { label: '25 km', value: 25 },
  { label: '50 km', value: 50 },
  { label: '100 km', value: 100 },
  { label: 'Any Proximity', value: 'all' }
];

const DEFAULT_POPULAR_TAGS = [
  '2 BHK flats in Kadapa',
  'Houses near me',
  'Plots for sale',
  'PG under 10k',
  'Direct Owner Rentals'
];

// Helper to format currency cleanly for listings
function formatPropertyPrice(price, purpose) {
  const num = parseFloat(price);
  if (!num || isNaN(num)) return 'Price on Request';

  if (purpose === 'rent') {
    return `₹${num.toLocaleString('en-IN')}/mo`;
  }
  if (num >= 10000000) {
    const cr = num / 10000000;
    return `₹${cr % 1 === 0 ? cr.toFixed(0) : cr.toFixed(2)} Cr`;
  }
  if (num >= 100000) {
    const l = num / 100000;
    return `₹${l % 1 === 0 ? l.toFixed(0) : l.toFixed(1)} Lakhs`;
  }
  return `₹${num.toLocaleString('en-IN')}`;
}

export default function SearchEngine({
  searchQuery,
  setSearchQuery,
  radiusKm,
  setRadiusKm,
  userLocation,
  onOpenLocationPicker,
  properties = [],
  filteredCount = 0,
  onSelectProperty,
  onSelectCategory,
  isMobile = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [showRadiusMenu, setShowRadiusMenu] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery || '');

  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Debounce query for silky-smooth matching performance
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery || '');
    }, 120);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Reset keyboard highlight whenever query changes
  useEffect(() => {
    setSelectedIndex(-1);
  }, [debouncedQuery]);

  // Rotating Search Bar Placeholders
  useEffect(() => {
    if (searchQuery.trim() || isOpen) return;
    const timer = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % ROTATING_PLACEHOLDERS.length);
    }, 2800);
    return () => clearInterval(timer);
  }, [searchQuery, isOpen]);

  // Load recent searches from localStorage safely
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        setRecentSearches(JSON.parse(stored).slice(0, 5));
      }
    } catch {
      // Safe fallback
    }
  }, []);

  const saveRecentSearch = useCallback((query) => {
    const trimmed = (query || '').trim();
    if (!trimmed) return;
    try {
      setRecentSearches((prev) => {
        const updated = [trimmed, ...prev.filter((s) => s.toLowerCase() !== trimmed.toLowerCase())].slice(0, 5);
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
        return updated;
      });
    } catch {
      // Safe fallback
    }
  }, []);

  const removeRecentSearch = (e, target) => {
    e.stopPropagation();
    try {
      setRecentSearches((prev) => {
        const updated = prev.filter((s) => s !== target);
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
        return updated;
      });
    } catch {
      // Safe fallback
    }
  };

  const clearRecentSearches = (e) => {
    e.stopPropagation();
    try {
      setRecentSearches([]);
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch {
      // Safe fallback
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setShowRadiusMenu(false);
        setSelectedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Intelligent Search Engine Core: NLP parsing & ranked recommendations
  const searchResults = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return null;

    // Normalize terms (e.g. '2bhk' -> '2 bhk', 'independent house' -> 'house')
    const tokens = q.split(/\s+/).filter(Boolean);

    // 1. NLP Keyword & Intent Matches for Suggested Searches
    const scoredSuggestions = INTENT_DICTIONARY.map((item) => {
      let score = 0;
      const lowerText = item.text.toLowerCase();

      if (lowerText.startsWith(q)) score += 100;
      else if (lowerText.includes(q)) score += 60;

      tokens.forEach((tok) => {
        if (item.tags.some((tag) => tag.includes(tok) || tok.includes(tag))) {
          score += 35;
        }
      });

      return { text: item.text, score };
    })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map((item) => item.text);

    const userLat = Number(userLocation?.lat ?? userLocation?.latitude);
    const userLng = Number(userLocation?.lng ?? userLocation?.longitude);
    const hasUserCoords = !isNaN(userLat) && !isNaN(userLng) && userLat !== 0 && userLng !== 0;

    // 2. Locality Matching across properties (exclude sold / rented)
    const localityCount = new Map();
    properties.forEach((p) => {
      const avail = (p.availabilityStatus || p.availability_status || p.status || '').toLowerCase();
      if (avail === 'sold' || avail === 'rented' || avail === 'closed' || avail === 'removed') return;
      const pCoords = getPropertyLatLng(p);
      if (radiusKm && radiusKm !== 'all' && hasUserCoords && pCoords) {
        const d = calcDistanceKm(userLat, userLng, pCoords.lat, pCoords.lng);
        if (d !== null && d > Number(radiusKm)) return;
      }
      const loc = p.location?.locality || p.location?.city || p.location?.district;
      if (loc && loc.toLowerCase().includes(q)) {
        localityCount.set(loc, (localityCount.get(loc) || 0) + 1);
      }
    });
    const matchedLocalities = Array.from(localityCount.entries())
      .slice(0, 3)
      .map(([name, count]) => ({ name, count }));

    // 3. Intelligent Property Ranking (Respects Location & Radius)
    // Scores properties based on title, locality, category, bedrooms, purpose, verified status, and proximity
    const scoredProperties = properties
      .map((prop) => {
        let score = 0;
        let hasDirectMatch = false;

        // Exclude sold, rented, closed or removed properties from public search suggestions
        const avail = (prop.availabilityStatus || prop.availability_status || prop.status || '').toLowerCase();
        if (avail === 'sold' || avail === 'rented' || avail === 'closed' || avail === 'removed') {
          return { prop, score: 0, hasDirectMatch: false };
        }

        // Check proximity radius constraint
        const pCoords = getPropertyLatLng(prop);
        if (radiusKm && radiusKm !== 'all' && hasUserCoords && pCoords) {
          const d = calcDistanceKm(userLat, userLng, pCoords.lat, pCoords.lng);
          if (d !== null && d > Number(radiusKm)) {
            return { prop, score: 0, hasDirectMatch: false };
          }
          if (d !== null) {
            // Proximity bonus: closer properties rank higher
            score += Math.max(0, 30 - Math.round(d));
          }
        }

        const title = (prop.title || '').toLowerCase();
        const locality = (prop.location?.locality || prop.location?.address || prop.location?.city || prop.location?.district || '').toLowerCase();
        const category = (prop.category || prop.propertyType || '').toLowerCase();
        const purpose = (prop.purpose || '').toLowerCase();
        const bedrooms = Number(prop.bedrooms || prop.configuration?.bhk || 0);

        // Exact substring matches
        if (title.includes(q)) { score += 80; hasDirectMatch = true; }
        if (locality.includes(q)) { score += 70; hasDirectMatch = true; }
        if (category.includes(q)) { score += 50; hasDirectMatch = true; }

        // Intent detection (BHK matching)
        const bhkMatch = q.match(/(\d+)\s*(?:bhk|bed)/);
        if (bhkMatch) {
          const requestedBhk = parseInt(bhkMatch[1], 10);
          if (bedrooms === requestedBhk) { score += 90; hasDirectMatch = true; }
        }

        // Purpose matching (rent vs buy)
        if (q.includes('rent') && purpose === 'rent') { score += 50; hasDirectMatch = true; }
        if ((q.includes('sale') || q.includes('buy')) && purpose === 'sale') { score += 50; hasDirectMatch = true; }

        // Multi-token query overlap
        tokens.forEach((tok) => {
          if (tok.length >= 2) {
            if (title.includes(tok)) { score += 20; hasDirectMatch = true; }
            if (locality.includes(tok)) { score += 20; hasDirectMatch = true; }
            if (category.includes(tok)) { score += 15; hasDirectMatch = true; }
          }
        });

        // Verification boost ONLY if there's already a direct textual match!
        if (hasDirectMatch && prop.verificationStatus === 'approved') {
          score += 10;
        }

        return { prop, score, hasDirectMatch };
      })
      .filter((item) => item.hasDirectMatch && item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map((item) => item.prop);

    return {
      suggestions: scoredSuggestions,
      localities: matchedLocalities,
      properties: scoredProperties
    };
  }, [debouncedQuery, properties, userLocation, radiusKm]);

  // Linear flat list of items for keyboard navigation
  const flatNavItems = useMemo(() => {
    if (!searchResults) return [];
    const items = [];

    // Add suggested searches
    searchResults.suggestions.forEach((sug) => {
      items.push({ type: 'suggestion', value: sug });
    });

    // Add localities
    searchResults.localities.forEach((loc) => {
      items.push({ type: 'locality', value: loc.name });
    });

    // Add properties
    searchResults.properties.forEach((prop) => {
      items.push({ type: 'property', value: prop });
    });

    return items;
  }, [searchResults]);

  const handleSelectSuggestion = (text) => {
    setSearchQuery(text);
    saveRecentSearch(text);
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  const handleSelectPropertyItem = (prop) => {
    if (onSelectProperty) {
      onSelectProperty(prop);
    }
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  // Keyboard Navigation: ArrowDown, ArrowUp, Enter, Escape
  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < flatNavItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : flatNavItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < flatNavItems.length) {
        const item = flatNavItems[selectedIndex];
        if (item.type === 'suggestion' || item.type === 'locality') {
          handleSelectSuggestion(item.value);
        } else if (item.type === 'property') {
          handleSelectPropertyItem(item.value);
        }
      } else {
        if (searchQuery.trim()) {
          saveRecentSearch(searchQuery);
        }
        setIsOpen(false);
        inputRef.current?.blur();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setSelectedIndex(-1);
      inputRef.current?.blur();
    }
  };

  // Helper to render matched text with clean highlight
  const renderHighlightedText = (text, query) => {
    if (!query) return text;
    const lower = text.toLowerCase();
    const qLower = query.toLowerCase();
    const idx = lower.indexOf(qLower);
    if (idx === -1) return text;

    const before = text.slice(0, idx);
    const match = text.slice(idx, idx + query.length);
    const after = text.slice(idx + query.length);

    return (
      <span>
        {before}
        <strong className="text-emerald-700 dark:text-emerald-400 font-extrabold underline decoration-emerald-400/50">
          {match}
        </strong>
        {after}
      </span>
    );
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Search Input Bar & Proximity Controls */}
      <div className="flex items-center gap-2">
        <div
          className={`flex-1 flex items-center gap-2.5 bg-[#F4F5F4] dark:bg-slate-900/90 rounded-2xl px-4 py-2.5 shadow-2xs transition-all border ${isOpen
            ? 'border-emerald-600 ring-2 ring-emerald-500/20 shadow-md bg-white dark:bg-slate-900'
            : 'border-slate-200/90 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
            }`}
        >
          <Search className={`w-4 h-4 shrink-0 transition-colors ${isOpen ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />

          {/* Inner Input with STRICTLY ZERO outline/border/ring box */}
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onFocus={() => setIsOpen(true)}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsOpen(true);
            }}
            onKeyDown={handleKeyDown}
            placeholder={ROTATING_PLACEHOLDERS[placeholderIndex]}
            className="flex-1 bg-transparent border-0 border-none outline-none ring-0 focus:outline-none focus:ring-0 focus:border-0 focus:shadow-none shadow-none no-focus-box font-semibold text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs sm:text-sm min-w-0"
            style={{
              outline: 'none',
              border: 'none',
              boxShadow: 'none',
              WebkitAppearance: 'none'
            }}
          />

          {/* Quick Clear Button */}
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setDebouncedQuery('');
                inputRef.current?.focus();
              }}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors rounded-full hover:bg-slate-200/60 dark:hover:bg-slate-800"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Result Count Indicator */}
          <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 bg-white/80 dark:bg-slate-800/80 px-2 py-0.5 rounded-full border border-slate-200/60 dark:border-slate-700 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>{filteredCount} {filteredCount === 1 ? 'listing' : 'listings'}</span>
          </span>
        </div>

        {/* Radius Proximity Button & Dropdown (Hidden on mobile for clean full-width search bar) */}
        {!isMobile && (
          <div className="hidden sm:block relative shrink-0">
            <button
              type="button"
              onClick={() => setShowRadiusMenu(!showRadiusMenu)}
              className="bg-[#E8F3EE] dark:bg-emerald-950/70 text-[#1F4E38] dark:text-emerald-300 font-extrabold text-xs px-3.5 py-2.5 rounded-2xl border border-emerald-200/80 dark:border-emerald-600/40 hover:bg-[#DDF0E5] transition-all flex items-center gap-1.5 active:scale-95 shadow-2xs"
              title="Adjust proximity radius"
            >
              <Navigation className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
              <span>{radiusKm === 'all' ? 'Any distance' : `${radiusKm} km radius`}</span>
              <ChevronDown className="w-3 h-3 text-emerald-700/70 dark:text-emerald-300" />
            </button>

            {/* Radius Quick Selector Menu */}
            {showRadiusMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95">
                <div className="px-3 py-1 text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                  Proximity Range
                </div>
                {RADIUS_OPTIONS.map((opt) => (
                  <button
                    key={String(opt.value)}
                    type="button"
                    onClick={() => {
                      setRadiusKm(opt.value);
                      setShowRadiusMenu(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs font-bold flex items-center justify-between transition-colors ${radiusKm === opt.value
                      ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 font-black'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                  >
                    <span>{opt.label}</span>
                    {radiusKm === opt.value && <span className="text-emerald-600 text-xs">✓</span>}
                  </button>
                ))}
                <div className="border-t border-slate-100 dark:border-slate-800 my-1"></div>
                <button
                  type="button"
                  onClick={() => {
                    setShowRadiusMenu(false);
                    if (onOpenLocationPicker) onOpenLocationPicker();
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs font-black text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 flex items-center gap-1.5"
                >
                  <MapPin className="w-3 h-3" />
                  <span>Change Pin Location...</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Production-Ready Google-Style Real-Estate Autocomplete Dropdown */}
      {isOpen && (
        <div
          ref={listRef}
          className="absolute left-0 right-0 top-full mt-2 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 animate-in fade-in zoom-in-98 duration-150 max-h-[460px] overflow-y-auto custom-smooth-scrollbar"
        >
          {/* Mode A: Active Typing with Smart Ranked Autocomplete */}
          {debouncedQuery.trim() ? (
            <div className="p-3 sm:p-4 space-y-3">

              {/* Header result indicator */}
              <div className="flex items-center justify-between text-xs pb-1 border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <span className="font-semibold">
                  Results for <strong className="text-slate-900 dark:text-white">&ldquo;{debouncedQuery}&rdquo;</strong>
                </span>
                <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 font-bold">
                  {filteredCount} matching {filteredCount === 1 ? 'listing' : 'listings'}
                </span>
              </div>

              {/* Check if any category has results */}
              {(!searchResults?.suggestions?.length && !searchResults?.localities?.length && !searchResults?.properties?.length) ? (
                <div className="py-7 px-4 text-center space-y-1">
                  <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                    <Search className="w-4 h-4 stroke-[2]" />
                  </div>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    No suggestions found for &ldquo;{debouncedQuery}&rdquo;
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                    Try searching by city, locality, property type, or BHK.
                  </p>
                </div>
              ) : (
                <>
                  {/* 1. Suggested Searches (Ranked 3-4 suggestions) */}
                  {searchResults?.suggestions && searchResults.suggestions.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider px-1">
                        Suggested Searches
                      </div>
                      {searchResults.suggestions.map((suggestion) => {
                        const navIndex = flatNavItems.findIndex(
                          (item) => item.type === 'suggestion' && item.value === suggestion
                        );
                        const isSelected = selectedIndex === navIndex;
                        return (
                          <button
                            key={suggestion}
                            type="button"
                            onClick={() => handleSelectSuggestion(suggestion)}
                            className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors group ${isSelected
                              ? 'bg-emerald-100/70 dark:bg-emerald-950 text-emerald-950 dark:text-emerald-200 font-bold ring-1 ring-emerald-500/30'
                              : 'text-slate-800 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-slate-800'
                              }`}
                          >
                            <div className="flex items-center gap-2.5 truncate">
                              <Search className={`w-3.5 h-3.5 transition-colors shrink-0 ${isSelected ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-400 group-hover:text-emerald-600'}`} />
                              <span className="truncate">
                                {renderHighlightedText(suggestion, debouncedQuery)}
                              </span>
                            </div>
                            <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-600 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* 2. Matched Localities (Top 3) */}
                  {searchResults?.localities && searchResults.localities.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <div className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider px-1">
                        Areas &amp; Localities
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {searchResults.localities.map((loc) => {
                          const navIndex = flatNavItems.findIndex(
                            (item) => item.type === 'locality' && item.value === loc.name
                          );
                          const isSelected = selectedIndex === navIndex;
                          return (
                            <button
                              key={loc.name}
                              type="button"
                              onClick={() => handleSelectSuggestion(loc.name)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${isSelected
                                ? 'bg-emerald-700 text-white shadow-xs'
                                : 'bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-900 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700/60'
                                }`}
                            >
                              <MapPin className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              <span>{loc.name}</span>
                              <span className="text-[10px] opacity-75 font-mono">({loc.count})</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 3. Matching Properties (Top 3-4 Direct Matches) */}
                  {searchResults?.properties && searchResults.properties.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                      <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center justify-between px-1">
                        <span className="flex items-center gap-1.5">
                          <Home className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>Matching Properties</span>
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">1-Click Preview</span>
                      </div>

                      <div className="space-y-1.5">
                        {searchResults.properties.map((prop) => {
                          const navIndex = flatNavItems.findIndex(
                            (item) => item.type === 'property' && item.value?._id === prop._id
                          );
                          const isSelected = selectedIndex === navIndex;
                          const img = getFirstPropertyImageUrl(prop);
                          const priceFormatted = formatPropertyPrice(prop.price, prop.purpose);
                          const localityText = prop.location?.locality || prop.location?.city || prop.location?.address || 'Andhra Pradesh';
                          const beds = prop.bedrooms || prop.configuration?.bhk;

                          return (
                            <div
                              key={prop._id || prop.id}
                              onClick={() => handleSelectPropertyItem(prop)}
                              className={`flex items-center gap-3 p-2 rounded-xl border cursor-pointer transition-all group overflow-hidden ${isSelected
                                ? 'bg-emerald-50/80 dark:bg-emerald-950/70 border-emerald-500 ring-1 ring-emerald-500/30'
                                : 'border-slate-100 dark:border-slate-800 hover:bg-emerald-50/40 dark:hover:bg-slate-800/60'
                                }`}
                            >
                              {/* Thumbnail strictly compact and bounded */}
                              <div
                                className="w-14 h-14 rounded-lg bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0 border border-slate-200/80 dark:border-slate-700 relative"
                                style={{ width: '56px', height: '56px', minWidth: '56px', minHeight: '56px', maxWidth: '56px', maxHeight: '56px' }}
                              >
                                {img ? (
                                  <img
                                    src={img}
                                    alt={prop.title}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-slate-400">
                                    <Home className="w-5 h-5 text-slate-400" />
                                  </div>
                                )}
                              </div>

                              {/* Property Details */}
                              <div className="flex-1 min-w-0 space-y-0.5">
                                <div className="flex items-center gap-1.5">
                                  <h5 className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                                    {prop.title}
                                  </h5>
                                  {prop.verificationStatus === 'approved' && (
                                    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.5 rounded-md border border-emerald-300/80 dark:border-emerald-700 shrink-0">
                                      <ShieldCheck className="w-2.5 h-2.5" />
                                      <span>Verified</span>
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                                  <span className="truncate">{localityText}</span>
                                  {beds ? (
                                    <>
                                      <span>·</span>
                                      <span className="flex items-center gap-1 shrink-0">
                                        <Bed className="w-3 h-3 text-slate-400" />
                                        <span>{beds} BHK</span>
                                      </span>
                                    </>
                                  ) : null}
                                  <span className="text-emerald-700 dark:text-emerald-400 font-extrabold ml-auto shrink-0">
                                    {priceFormatted}
                                  </span>
                                </div>
                              </div>

                              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 shrink-0 ml-1" />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Bottom Action Bar */}
              <div className="pt-2 flex items-center justify-between text-xs border-t border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                  {filteredCount > 0
                    ? `Showing ${filteredCount} matching ${filteredCount === 1 ? 'listing' : 'listings'}`
                    : 'No listings matching query'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    saveRecentSearch(debouncedQuery);
                    setIsOpen(false);
                  }}
                  className="bg-[#184631] hover:bg-[#123625] text-white font-extrabold text-[11px] px-3.5 py-1.5 rounded-xl transition-all shadow-xs flex items-center gap-1 active:scale-95"
                >
                  <span>View All Results</span>
                  <span className="font-mono text-emerald-200">({filteredCount})</span>
                </button>
              </div>
            </div>
          ) : (
            /* Mode B: Empty Input - Clean Minimalist (Recent Searches & Popular Searches) */
            <div className="p-3 sm:p-4 space-y-3.5">

              {/* Recent Searches */}
              {recentSearches.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 flex items-center gap-1.5 tracking-wider">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>Recent Searches</span>
                    </span>
                    <button
                      type="button"
                      onClick={clearRecentSearches}
                      className="text-[10px] font-bold text-slate-400 hover:text-rose-500 transition-colors"
                    >
                      Clear All
                    </button>
                  </div>
                  <div className="space-y-1">
                    {recentSearches.slice(0, 5).map((rec) => (
                      <div
                        key={rec}
                        onClick={() => handleSelectSuggestion(rec)}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between cursor-pointer group transition-colors"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{rec}</span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => removeRecentSearch(e, rec)}
                          className="text-slate-400 hover:text-rose-500 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remove from history"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Clean Popular Searches */}
              <div className="pt-1">
                <div className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 mb-2 tracking-wider flex items-center gap-1.5 px-1">
                  <span>Popular Searches</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {DEFAULT_POPULAR_TAGS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleSelectSuggestion(tag)}
                      className="bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-emerald-800 dark:hover:text-emerald-300 border border-slate-200/80 dark:border-slate-700 px-3 py-1 rounded-xl text-xs font-semibold transition-all"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          )}
        </div>
      )}
    </div>
  );
}
