import React, { useState, useMemo, useEffect } from 'react';
import {
  Search, MapPin, ChevronDown, X, Building2, Home, Store,
  Trees, BedDouble, Layers, Filter, Sparkles, AlertCircle,
  RotateCcw, Compass, ShieldCheck, Navigation
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useProperty } from '../../contexts/PropertyContext';
import PropertyCard from '../../components/property/PropertyCard';
import SearchEngine from '../../components/property/SearchEngine';
import { calcDistanceKm, getPropertyLatLng } from '../../utils/propertyHelpers';

export default function ExplorePage() {
  const { currentUser } = useAuth();
  const {
    properties,
    loadingProperties,
    propertiesError,
    refreshProperties,
    isOwnerOfProperty,
    userLocation,
    radiusKm,
    setRadiusKm,
    isMobile,
    selectedCategory,
    setSelectedCategory,
    searchQuery,
    setSearchQuery,
    bhkFilter,
    setBhkFilter,
    sortBy,
    setSortBy,
    purposeFilter,
    setPurposeFilter,
    comparisonList,
    setShowComparisonModal,
    setShowLocationPicker,
    handleOpenDetailModal
  } = useProperty();

  const categoryTabs = [
    { id: 'all', label: 'All Assets', icon: Layers, bg: 'bg-slate-100', iconColor: 'text-slate-700' },
    { id: 'flat', label: 'Flats & Apts', icon: Building2, bg: 'bg-emerald-50', iconColor: 'text-emerald-700' },
    { id: 'house', label: 'Houses & Villas', icon: Home, bg: 'bg-blue-50', iconColor: 'text-blue-700' },
    { id: 'plot', label: 'Plots & Land', icon: Trees, bg: 'bg-amber-50', iconColor: 'text-amber-700' },
    { id: 'pg', label: 'PG & Hostels', icon: BedDouble, bg: 'bg-teal-50', iconColor: 'text-teal-700' },
    { id: 'commercial', label: 'Commercial', icon: Store, bg: 'bg-purple-50', iconColor: 'text-purple-700' },
    { id: 'agricultural', label: 'Farmland', icon: Trees, bg: 'bg-lime-50', iconColor: 'text-lime-700' }
  ];

  // On-demand fast database query based on user requirements (debounced 250ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      const userLat = Number(userLocation?.lat ?? userLocation?.latitude);
      const userLng = Number(userLocation?.lng ?? userLocation?.longitude);
      refreshProperties({
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        purpose: purposeFilter !== 'all' ? purposeFilter : undefined,
        query: searchQuery.trim() || undefined,
        radiusKm: radiusKm !== 'all' && Number(radiusKm) > 0 ? radiusKm : undefined,
        lat: !isNaN(userLat) && userLat !== 0 ? userLat : undefined,
        lng: !isNaN(userLng) && userLng !== 0 ? userLng : undefined,
        sortBy: sortBy || 'newest',
        limit: 100
      });
    }, 250);

    return () => clearTimeout(timer);
  }, [selectedCategory, purposeFilter, searchQuery, userLocation, radiusKm, sortBy, refreshProperties]);

  // Filter properties with all invariants and multi-criteria search engine enforced
  const filteredProperties = useMemo(() => {
    return properties.filter((prop) => {
      // Invariant 1: Seller-owned properties must not appear in their own discovery feed
      if (typeof isOwnerOfProperty === 'function' && isOwnerOfProperty(prop)) {
        return false;
      }
      if (currentUser) {
        const uId = String(currentUser._id || currentUser.id || '').trim();
        const uAuth = String(currentUser.auth_id || '').trim();
        const uEmail = String(currentUser.email || '').toLowerCase().trim();
        const uMobile = String(currentUser.mobile || '').replace(/\D/g, '').slice(-10);

        const oId = String(prop.ownerId || prop.owner_id || '').trim();
        const oEmail = String(prop.ownerEmail || prop.owner_email || '').toLowerCase().trim();
        const oPhone = String(prop.ownerPhone || prop.owner_phone || '').replace(/\D/g, '').slice(-10);

        if (uId && oId && uId === oId) return false;
        if (uAuth && oId && uAuth === oId) return false;
        if (uEmail && oEmail && uEmail === oEmail) return false;
        if (uMobile && oPhone && uMobile === oPhone) return false;
      }

      // Invariant 2: Verification and publication status
      if (prop.verificationStatus && prop.verificationStatus !== 'approved' && prop.verificationStatus !== 'verified') return false;
      if (prop.publicationStatus && prop.publicationStatus !== 'published') return false;
      if (
        prop.availabilityStatus === 'suspended' || 
        prop.availabilityStatus === 'returned' ||
        prop.availabilityStatus === 'sold' ||
        prop.availabilityStatus === 'rented' ||
        prop.status === 'sold' ||
        prop.status === 'rented' ||
        prop.publicationStatus === 'archived' ||
        prop.publicationStatus === 'completed'
      ) return false;

      // Category filter
      if (selectedCategory !== 'all') {
        const pt = (prop.propertyType || '').toLowerCase();
        const cat = (prop.category || '').toLowerCase();
        if (selectedCategory === 'flat' && !['flat', 'apartment'].includes(pt) && !['flat', 'apartment'].includes(cat)) return false;
        if (selectedCategory === 'house' && !['house', 'villa'].includes(pt) && !['house', 'villa'].includes(cat)) return false;
        if (selectedCategory === 'plot' && !['plot', 'land'].includes(pt) && !['plot', 'land'].includes(cat)) return false;
        if (selectedCategory === 'pg' && !['pg', 'hostel'].includes(pt) && !['pg', 'hostel'].includes(cat)) return false;
        if (selectedCategory === 'commercial' && !['commercial', 'shop', 'office'].includes(pt) && !['commercial', 'shop', 'office'].includes(cat)) return false;
        if (selectedCategory === 'agricultural' && !['farmland', 'agricultural'].includes(pt) && !['farmland', 'agricultural'].includes(cat)) return false;
      }

      // Purpose filter (sale vs rent)
      if (purposeFilter !== 'all') {
        if (purposeFilter === 'rent' && prop.purpose !== 'rent' && prop.propertyType !== 'pg') return false;
        if (purposeFilter === 'sale' && prop.purpose !== 'sale') return false;
      }

      // BHK filter
      if (bhkFilter !== 'all') {
        const beds = Number(prop.bedrooms || prop.bhk || 0);
        if (bhkFilter === '1' && beds !== 1) return false;
        if (bhkFilter === '2' && beds !== 2) return false;
        if (bhkFilter === '3' && beds !== 3) return false;
        if (bhkFilter === '4+' && beds < 4) return false;
      }

      // Proximity Radius filter: strictly filter by distance from user's selected location & radius
      const userLat = Number(userLocation?.lat ?? userLocation?.latitude);
      const userLng = Number(userLocation?.lng ?? userLocation?.longitude);
      const hasUserCoords = !isNaN(userLat) && !isNaN(userLng) && userLat !== 0 && userLng !== 0;

      if (radiusKm && radiusKm !== 'all' && Number(radiusKm) > 0 && hasUserCoords) {
        const coords = getPropertyLatLng(prop);
        if (coords) {
          const dist = calcDistanceKm(userLat, userLng, coords.lat, coords.lng);
          if (dist !== null && dist > Number(radiusKm)) {
            return false;
          }
        } else {
          // If property lacks coordinates, ensure its locality/city text matches user's location
          const locName = (userLocation?.name || '').toLowerCase();
          const pLoc = `${prop.location?.locality || ''} ${prop.location?.city || ''} ${prop.location?.district || ''}`.toLowerCase();
          const areaKeyword = locName.split(',')[0].trim();
          if (!pLoc.includes(areaKeyword) && !areaKeyword.includes(pLoc)) {
            return false;
          }
        }
      }

      // Multi-Criteria Full Search Engine
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();

        // 1. Budget conditions in query text
        const price = Number(prop.price || 0);
        if (q.includes('under 1 cr') || q.includes('below 1 cr')) {
          if (price > 10000000) return false;
        }
        if (q.includes('under 2 cr') || q.includes('below 2 cr')) {
          if (price > 20000000) return false;
        }
        if (q.includes('under 3 cr') || q.includes('below 3 cr')) {
          if (price > 30000000) return false;
        }
        if (q.includes('under 50 lakh') || q.includes('under 50l')) {
          if (price > 5000000) return false;
        }

        // 2. Category synonyms
        const cat = (prop.category || prop.propertyType || '').toLowerCase();
        let catSynonyms = '';
        if (['flat', 'apartment'].includes(cat)) catSynonyms = 'flat apartment apts flats apartments condo';
        else if (['house', 'villa'].includes(cat)) catSynonyms = 'house villa bungalow duplex home houses villas';
        else if (['plot', 'land'].includes(cat)) catSynonyms = 'plot land site layout plots lands';
        else if (['pg', 'hostel'].includes(cat)) catSynonyms = 'pg hostel coliving paying guest co-living';
        else if (['commercial', 'office', 'shop'].includes(cat)) catSynonyms = 'commercial office shop retail showroom warehouse';
        else if (['agricultural', 'farmland'].includes(cat)) catSynonyms = 'farmland agricultural farm plantation agro';

        // 3. BHK and Bedroom synonyms
        const beds = Number(prop.bedrooms || prop.bhk || 0);
        const bhkSynonyms = beds > 0 ? `${beds}bhk ${beds} bhk ${beds} bed ${beds} bedroom ${beds} beds` : '';

        // 4. Purpose synonyms
        const purposeSynonyms = prop.purpose === 'rent'
          ? 'rent rental lease direct owner'
          : 'sale buy purchase resale 0% brokerage 0% fee';

        // 5. Legal, Cadastral & Regulatory synonyms
        const legalSynonyms = [
          prop.reraId,
          prop.rera_id,
          prop.land_details?.reraNumber,
          prop.surveyNumber,
          prop.cadastralSurveyNumber,
          prop.khasraNumber,
          prop.khataNumber,
          prop.eKhataNumber,
          prop.pidNumber,
          prop.land_details?.khataType,
          prop.verificationStatus === 'approved' ? 'cadastral cleared verified title demarcated zero broker' : ''
        ].filter(Boolean).join(' ');

        // 6. Amenities and features
        const amenitiesText = Array.isArray(prop.amenities) ? prop.amenities.join(' ') : '';

        // Build comprehensive searchable corpus for all criteria
        const fullCorpus = [
          prop.title || '',
          prop.description || '',
          prop.propertyType || '',
          prop.category || '',
          catSynonyms,
          bhkSynonyms,
          purposeSynonyms,
          legalSynonyms,
          prop.location?.locality || '',
          prop.location?.address || '',
          prop.location?.city || '',
          prop.location?.state || '',
          prop.location?.landmark || '',
          prop.location?.pincode || '',
          amenitiesText,
          prop.facing || '',
          prop.furnishing || '',
          prop.sellerContact?.name || ''
        ].join(' ').toLowerCase();

        // Token matching: split query into tokens, filtering out trivial noise words when query has multiple tokens
        const rawTokens = q.split(/\s+/).filter(Boolean);
        const stopWords = new Set(['in', 'at', 'near', 'of', 'for', 'with', 'and', 'the', 'under', 'below', 'cr', 'lakh', 'lakhs']);
        const tokens = rawTokens.length > 1 ? rawTokens.filter(t => !stopWords.has(t)) : rawTokens;

        const allTokensMatch = tokens.every(token => fullCorpus.includes(token));
        if (!allTokensMatch) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'price_asc') return (a.price || 0) - (b.price || 0);
      if (sortBy === 'price_desc') return (b.price || 0) - (a.price || 0);
      const userLat = Number(userLocation?.lat ?? userLocation?.latitude);
      const userLng = Number(userLocation?.lng ?? userLocation?.longitude);
      const hasUserCoords = !isNaN(userLat) && !isNaN(userLng) && userLat !== 0 && userLng !== 0;

      if (sortBy === 'distance') {
        const cA = getPropertyLatLng(a);
        const cB = getPropertyLatLng(b);
        const dA = cA && hasUserCoords ? calcDistanceKm(userLat, userLng, cA.lat, cA.lng) ?? 99999 : 99999;
        const dB = cB && hasUserCoords ? calcDistanceKm(userLat, userLng, cB.lat, cB.lng) ?? 99999 : 99999;
        return dA - dB;
      }
      if (sortBy === 'relevance' && hasUserCoords) {
        // By default, prioritize closer properties within the same relevance bracket
        const cA = getPropertyLatLng(a);
        const cB = getPropertyLatLng(b);
        const dA = cA ? calcDistanceKm(userLat, userLng, cA.lat, cA.lng) ?? 99999 : 99999;
        const dB = cB ? calcDistanceKm(userLat, userLng, cB.lat, cB.lng) ?? 99999 : 99999;
        return dA - dB;
      }
      if (sortBy === 'newest') {
        const tA = new Date(a.createdAt || a.created_at || 0).getTime();
        const tB = new Date(b.createdAt || b.created_at || 0).getTime();
        return tB - tA;
      }
      return 0; // default order
    });
  }, [properties, currentUser, selectedCategory, purposeFilter, bhkFilter, searchQuery, radiusKm, sortBy, userLocation]);

  return (
    <div className={`space-y-5 max-w-7xl mx-auto ${isMobile ? 'p-3 pb-24' : 'p-6'}`}>
      {/* Forest Green Hero Banner */}
      <div className={`bg-[#184631] text-white shadow-md relative overflow-hidden ${isMobile ? 'rounded-2xl p-4 space-y-2' : 'rounded-3xl p-6 sm:p-8 space-y-3'}`}>
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowLocationPicker(true)}
            className="inline-flex items-center gap-1.5 bg-white/15 hover:bg-white/25 active:scale-95 text-white font-bold uppercase tracking-wider rounded-full transition-all border border-white/20 shadow-xs text-[11px] px-3.5 py-1.5"
            title="Click to change locality or GPS proximity center"
          >
            <MapPin className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
            <span>{(userLocation?.name?.split(',')[0] || 'KADAPA, ANDHRA PRADESH').toUpperCase()}</span>
            <ChevronDown className="w-3.5 h-3.5 text-white/80 shrink-0" />
          </button>

          <span className="text-[10px] bg-emerald-800/80 text-emerald-200 px-2.5 py-1 rounded-full font-extrabold border border-emerald-600/40">
            Verified Listings
          </span>
        </div>

        <h1 className={`${isMobile ? 'text-xl' : 'text-3xl sm:text-4xl'} font-black text-white tracking-tight leading-tight`}>
          Your land. Your legacy.
        </h1>
        <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-emerald-100/90 font-medium`}>
          0% Brokerage · Direct Owner · Verified Title Deeds
        </p>
      </div>

      {/* Advanced Multi-Criteria Search Engine with Natural Recommendations */}
      <SearchEngine
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        radiusKm={radiusKm || 50}
        setRadiusKm={setRadiusKm}
        userLocation={userLocation}
        onOpenLocationPicker={() => setShowLocationPicker(true)}
        properties={properties}
        filteredCount={filteredProperties.length}
        onSelectProperty={(prop) => handleOpenDetailModal(prop)}
        onSelectCategory={(catId) => setSelectedCategory(catId)}
        isMobile={isMobile}
      />

      {/* Purpose & BHK Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Purpose Segmented Control */}
        <div className="inline-flex items-center p-1 rounded-xl bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 shadow-2xs">
          <button
            type="button"
            onClick={() => setPurposeFilter('all')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
              purposeFilter === 'all'
                ? 'bg-[#184631] text-white shadow-xs font-black dark:bg-emerald-600'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setPurposeFilter('sale')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              purposeFilter === 'sale'
                ? 'bg-[#184631] text-white shadow-xs font-black dark:bg-emerald-600'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>Buy</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-extrabold ${purposeFilter === 'sale' ? 'bg-white/20 text-white' : 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300'}`}>0% Fee</span>
          </button>
          <button
            type="button"
            onClick={() => setPurposeFilter('rent')}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              purposeFilter === 'rent'
                ? 'bg-[#184631] text-white shadow-xs font-black dark:bg-emerald-600'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>Rent</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-extrabold ${purposeFilter === 'rent' ? 'bg-white/20 text-white' : 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300'}`}>Direct</span>
          </button>
        </div>

        {/* BHK Configuration Segmented Bar (Hidden on mobile mode to avoid vertical clutter) */}
        {!isMobile && (
          <div className="hidden sm:inline-flex items-center p-1 rounded-xl bg-slate-100/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 shadow-2xs">
            {[
              { id: 'all', label: 'All' },
              { id: '1', label: '1 BHK' },
              { id: '2', label: '2 BHK' },
              { id: '3', label: '3 BHK' },
              { id: '4+', label: '4+ BHK' }
            ].map((item) => {
              const isSelected = bhkFilter === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setBhkFilter(item.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    isSelected
                      ? 'bg-[#184631] text-white shadow-xs font-black dark:bg-emerald-600'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Category Pills */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
        {categoryTabs.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          const IconComp = cat.icon;
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`w-28 sm:w-32 p-3 rounded-2xl shrink-0 border bg-white dark:bg-slate-900/90 flex flex-col items-center text-center transition-all shadow-2xs group ${
                isSelected
                  ? 'border-2 border-[#184631] dark:border-emerald-400 shadow-xs ring-1 ring-[#184631]/20 bg-emerald-50/20'
                  : 'border-slate-200/80 dark:border-slate-700 hover:border-slate-300 hover:shadow-xs'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-xl mb-1.5 flex items-center justify-center transition-all ${
                  isSelected ? 'bg-[#184631] text-white shadow-2xs' : `${cat.bg} ${cat.iconColor} group-hover:scale-105`
                }`}
              >
                <IconComp className="w-4 h-4 stroke-[2.2]" />
              </div>
              <span className="text-xs font-black text-slate-900 dark:text-slate-100 leading-tight block truncate w-full">
                {cat.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Header & Sort Bar - Responsive & Clean */}
      <div className="flex items-center justify-between pt-1 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white tracking-tight truncate">
              Verified Properties
            </h3>
            <span className="text-xs font-mono font-bold text-slate-400 dark:text-slate-500 shrink-0">
              ({filteredProperties.length})
            </span>
          </div>
          <span className="hidden sm:inline-flex text-[10px] bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-700/60 items-center gap-1 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>0% Brokerage</span>
          </span>
        </div>

        <div className="relative shrink-0">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 rounded-xl px-2.5 py-1.5 pr-7 focus:outline-none appearance-none cursor-pointer shadow-2xs"
          >
            <option value="relevance">Featured</option>
            <option value="distance">Nearest</option>
            <option value="newest">Newest First</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
          </select>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Properties Grid */}
      {loadingProperties ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 h-80 animate-pulse p-4 space-y-3">
              <div className="bg-slate-200 dark:bg-slate-800 h-44 rounded-xl"></div>
              <div className="bg-slate-200 dark:bg-slate-800 h-4 w-3/4 rounded"></div>
              <div className="bg-slate-200 dark:bg-slate-800 h-4 w-1/2 rounded"></div>
            </div>
          ))}
        </div>
      ) : propertiesError ? (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 p-6 rounded-2xl text-center space-y-2">
          <AlertCircle className="w-8 h-8 text-rose-600 dark:text-rose-400 mx-auto" />
          <p className="text-xs font-bold text-rose-800 dark:text-rose-200">{propertiesError}</p>
          <button
            type="button"
            onClick={refreshProperties}
            className="bg-rose-600 text-white text-xs font-bold px-4 py-1.5 rounded-lg hover:bg-rose-700"
          >
            Retry Loading
          </button>
        </div>
      ) : filteredProperties.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 p-8 sm:p-12 rounded-3xl border border-slate-200 dark:border-slate-800 text-center space-y-3.5 shadow-xs">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center">
            <Search className="w-6 h-6 stroke-[2]" />
          </div>

          <div className="max-w-md mx-auto">
            <h4 className="font-extrabold text-slate-900 dark:text-white text-base sm:text-lg">
              No properties found matching filters.
            </h4>
          </div>

          <div className="pt-1">
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('all');
                setSearchQuery('');
                setBhkFilter('all');
                setPurposeFilter('all');
                if (setRadiusKm) setRadiusKm(100);
              }}
              className="bg-[#184631] hover:bg-[#123625] active:scale-95 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-xs transition-all inline-flex items-center gap-2"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear all filters</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {filteredProperties.map((prop) => (
            <PropertyCard key={prop._id || prop.id} property={prop} />
          ))}
        </div>
      )}
    </div>
  );
}


