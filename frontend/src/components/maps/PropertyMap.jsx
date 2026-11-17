import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  ArrowLeft, MapPin, X, Eye, Bed, Bath, Maximize2, 
  CheckCircle2, Sparkles, Navigation, Layers, Building, LocateFixed, Compass
} from 'lucide-react';
import { getFirstPropertyImageUrl, calcDistanceKm } from '../../utils/propertyHelpers';
import { getCoords, formatPinPrice, formatPreviewPrice } from '../../utils/geoMapHelpers';

export { getCoords, formatPinPrice, formatPreviewPrice };

export default function PropertyMap({ 
  properties = [], 
  userLocation, 
  maxRadiusKm = 50, 
  selectedProperty = null,
  onSelectProperty,
  onViewDetails,
  onBack,
  searchPurpose = 'sale',
  setSearchPurpose,
  onOpenLocationPicker,
  isMobile = false
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersMapRef = useRef(new Map()); // propertyId -> { marker, prop, coords }
  const userMarkerRef = useRef(null);
  const radiusCircleRef = useRef(null);
  
  // Track selected property for preview card & highlighting
  const [activeProperty, setActiveProperty] = useState(selectedProperty);
  
  // Scope mode: 'nearby' (focused near searched location) vs 'all' (whole state view)
  const [viewScope, setViewScope] = useState('nearby');

  // Extract normalized user coordinates
  const userLat = Number(userLocation?.lat ?? userLocation?.latitude);
  const userLng = Number(userLocation?.lng ?? userLocation?.longitude);
  const hasUserCoords = !isNaN(userLat) && !isNaN(userLng) && userLat !== 0 && userLng !== 0;
  const cityName = (userLocation?.name?.split(',')[0] || 'Searched Location').trim();

  // 1. Filter properties strictly by Purpose (Buy / Sale vs Rent) and availability
  const purposeFilteredProperties = useMemo(() => {
    return properties.filter((prop) => {
      // Exclude sold, rented, suspended, archived, or completed properties from the live map
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

      if (!searchPurpose || searchPurpose === 'all') return true;
      const purpose = (prop.purpose || '').toLowerCase();
      if (searchPurpose === 'sale' || searchPurpose === 'buy') {
        return purpose === 'sale' || purpose === 'buy' || !purpose;
      }
      if (searchPurpose === 'rent') {
        return purpose === 'rent';
      }
      return true;
    });
  }, [properties, searchPurpose]);

  // 2. Separate into Nearby Listings (within search radius) and All Listings
  const { nearbyListings, allValidListings } = useMemo(() => {
    const nearby = [];
    const allValid = [];
    const radius = Number(maxRadiusKm) || 50;

    purposeFilteredProperties.forEach((prop) => {
      const coords = getCoords(prop);
      if (!coords || isNaN(coords.lat) || isNaN(coords.lng)) return;

      let distKm = null;
      if (hasUserCoords) {
        distKm = calcDistanceKm(userLat, userLng, coords.lat, coords.lng);
      }

      const item = { prop, coords, distKm };
      allValid.push(item);

      if (distKm !== null && distKm <= radius) {
        nearby.push(item);
      }
    });

    return { nearbyListings: nearby, allValidListings: allValid };
  }, [purposeFilteredProperties, userLat, userLng, hasUserCoords, maxRadiusKm]);

  // 3. Determine active listings to display on the map
  // If in 'nearby' mode and nearby listings exist, display those;
  // If no nearby listings exist in that location, auto-fall back to showing all regional listings ("whole like that pic")
  const hasNearby = nearbyListings.length > 0;
  const isDisplayingNearby = viewScope === 'nearby' && hasNearby;
  const displayedItems = isDisplayingNearby ? nearbyListings : allValidListings;

  // Sync internal state if selectedProperty prop changes externally
  useEffect(() => {
    setActiveProperty(selectedProperty);
  }, [selectedProperty]);

  // Dismiss preview if purpose filter changes and active property no longer matches
  useEffect(() => {
    if (activeProperty) {
      const activePurpose = (activeProperty.purpose || 'sale').toLowerCase();
      if (searchPurpose === 'sale' && activePurpose === 'rent') {
        setActiveProperty(null);
        if (onSelectProperty) onSelectProperty(null);
      } else if (searchPurpose === 'rent' && activePurpose === 'sale') {
        setActiveProperty(null);
        if (onSelectProperty) onSelectProperty(null);
      }
    }
  }, [searchPurpose, activeProperty, onSelectProperty]);

  // Clean unmount to prevent Leaflet container re-init errors
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (e) {
          // ignore cleanup error
        }
        mapInstanceRef.current = null;
      }
      markersMapRef.current.clear();
    };
  }, []);

  // Helper to create custom divIcon with correct styling
  const createMarkerIcon = useCallback((prop, isSelected) => {
    const formattedPrice = formatPinPrice(prop);
    const propId = prop._id || prop.id;

    return L.divIcon({
      className: 'clean-map-price-pin',
      html: `
        <div class="landpin-price-marker ${isSelected ? 'selected' : ''}" data-prop-id="${propId}" title="${prop.title || 'Property'}">
          <span>${formattedPrice}</span>
        </div>
      `,
      iconSize: isSelected ? [96, 38] : [84, 32],
      iconAnchor: isSelected ? [48, 19] : [42, 16]
    });
  }, []);

  // Update marker icons when active property changes
  const updateAllMarkerIcons = useCallback((selectedId) => {
    markersMapRef.current.forEach(({ marker, prop }) => {
      const propId = prop._id || prop.id;
      const isSelected = propId === selectedId;
      marker.setIcon(createMarkerIcon(prop, isSelected));
      marker.setZIndexOffset(isSelected ? 2000 : 0);
    });
  }, [createMarkerIcon]);

  // Smoothly pan & zoom to clicked property
  const flyToProperty = useCallback((prop) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const coords = getCoords(prop);
    if (!coords) return;

    const currentZoom = map.getZoom();
    const targetZoom = Math.max(currentZoom, 15);

    const point = map.project([coords.lat, coords.lng], targetZoom);
    const offsetY = isMobile ? 85 : 65;
    const targetPoint = L.point(point.x, point.y + offsetY);
    const targetLatLng = map.unproject(targetPoint, targetZoom);

    map.flyTo(targetLatLng, targetZoom, {
      duration: 0.8,
      easeLinearity: 0.25
    });
  }, [isMobile]);

  // Handle marker click
  const handleMarkerClick = useCallback((prop) => {
    if (!prop) return;
    const propId = prop._id || prop.id;
    const isAlreadySelected = activeProperty && (activeProperty._id || activeProperty.id) === propId;

    setActiveProperty(prop);
    if (onSelectProperty) {
      onSelectProperty(prop);
    }

    updateAllMarkerIcons(propId);

    const map = mapInstanceRef.current;
    const currentZoom = map ? map.getZoom() : 12;
    if (!isAlreadySelected || currentZoom < 15) {
      flyToProperty(prop);
    }
  }, [activeProperty, onSelectProperty, updateAllMarkerIcons, flyToProperty]);

  // Close preview card
  const handleClosePreview = useCallback(() => {
    setActiveProperty(null);
    if (onSelectProperty) {
      onSelectProperty(null);
    }
    updateAllMarkerIcons(null);
  }, [onSelectProperty, updateAllMarkerIcons]);

  // Primary action: View Full Property Details
  const handleOpenDetails = useCallback(() => {
    if (!activeProperty) return;
    if (onViewDetails) {
      onViewDetails(activeProperty);
    } else if (onSelectProperty) {
      onSelectProperty(activeProperty);
    }
  }, [activeProperty, onViewDetails, onSelectProperty]);

  // Initialize & Update Leaflet Map and Markers
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      if (mapContainerRef.current._leaflet_id) {
        try {
          delete mapContainerRef.current._leaflet_id;
        } catch (e) {
          mapContainerRef.current._leaflet_id = null;
        }
      }

      // Initial center: user location or default Kadapa
      const initialLat = hasUserCoords ? userLat : 14.4673;
      const initialLng = hasUserCoords ? userLng : 78.8242;

      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: 13,
        zoomControl: false
      });

      L.control.zoom({ position: 'topright' }).addTo(map);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(map);

      map.on('click', (e) => {
        if (e.originalEvent && e.originalEvent.target && e.originalEvent.target.classList.contains('leaflet-container')) {
          handleClosePreview();
        }
      });

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;
    if (!map) return;

    // Recalculate dimensions across ticks
    [50, 150, 300, 600].forEach((delay) => {
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, delay);
    });

    // Clear old property markers
    markersMapRef.current.forEach(({ marker }) => marker.remove());
    markersMapRef.current.clear();

    // Clear old user search location marker and circle
    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }
    if (radiusCircleRef.current) {
      radiusCircleRef.current.remove();
      radiusCircleRef.current = null;
    }

    // Add subtle pulsating GPS Locator Dot for Searched Location
    if (hasUserCoords) {
      const searchPinHtml = `
        <div style="position:relative; width:20px; height:20px; pointer-events:none;">
          <div style="position:absolute; inset:0; border-radius:50%; background:#10b981; opacity:0.4; animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>
          <div style="position:absolute; inset:3px; border-radius:50%; background:#047857; border:2px solid #ffffff; box-shadow:0 2px 6px rgba(0,0,0,0.35);"></div>
        </div>
      `;
      const searchPinIcon = L.divIcon({
        className: 'user-search-center-pin',
        html: searchPinHtml,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      userMarkerRef.current = L.marker([userLat, userLng], {
        icon: searchPinIcon,
        zIndexOffset: 1000
      }).addTo(map);

      // Draw subtle radius circle if in nearby mode
      if (isDisplayingNearby) {
        radiusCircleRef.current = L.circle([userLat, userLng], {
          radius: (Number(maxRadiusKm) || 50) * 1000,
          color: '#047857',
          fillColor: '#10b981',
          fillOpacity: 0.08,
          weight: 1.5,
          dashArray: '5, 5'
        }).addTo(map);
      }
    }

    const selectedId = activeProperty ? (activeProperty._id || activeProperty.id) : null;
    const propPoints = [];

    // Render markers for the active displayed items
    displayedItems.forEach(({ prop, coords }) => {
      propPoints.push([coords.lat, coords.lng]);

      const propId = prop._id || prop.id;
      const isSelected = selectedId === propId;
      const customIcon = createMarkerIcon(prop, isSelected);

      const marker = L.marker([coords.lat, coords.lng], { 
        icon: customIcon,
        zIndexOffset: isSelected ? 2000 : 0
      }).addTo(map);

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        handleMarkerClick(prop);
      });

      markersMapRef.current.set(propId, { marker, prop, coords });
    });

    // Intelligent Framing:
    // If no property is actively selected, frame view appropriately
    if (!activeProperty) {
      if (isDisplayingNearby && hasUserCoords) {
        // CASE A: We have nearby properties! Focus specifically near the searched location
        const framingPoints = [[userLat, userLng], ...propPoints];
        if (framingPoints.length > 1) {
          try {
            const bounds = L.latLngBounds(framingPoints);
            map.fitBounds(bounds, { padding: [65, 65], maxZoom: 14 });
          } catch {
            map.setView([userLat, userLng], 13);
          }
        } else {
          map.setView([userLat, userLng], 13);
        }
      } else {
        // CASE B: Whole state/regional view ("whole like that pic")
        if (propPoints.length > 1) {
          try {
            const bounds = L.latLngBounds(propPoints);
            map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
          } catch {
            if (propPoints[0]) map.setView(propPoints[0], 12);
          }
        } else if (propPoints.length === 1) {
          map.setView(propPoints[0], 13);
        } else if (hasUserCoords) {
          map.setView([userLat, userLng], 12);
        }
      }
    }

  }, [
    displayedItems, 
    isDisplayingNearby, 
    hasUserCoords, 
    userLat, 
    userLng, 
    cityName, 
    maxRadiusKm, 
    createMarkerIcon, 
    handleMarkerClick, 
    handleClosePreview
  ]);

  // Derived display details for preview card
  const previewImageUrl = activeProperty ? getFirstPropertyImageUrl(activeProperty) : '';
  const previewCategory = activeProperty ? (activeProperty.propertyType || activeProperty.category || 'Property').toUpperCase() : '';
  const previewLocality = activeProperty ? (activeProperty.location?.locality || activeProperty.location?.address || activeProperty.location?.city || cityName) : '';
  const previewArea = activeProperty?.area?.value ? `${activeProperty.area.value.toLocaleString('en-IN')} ${activeProperty.area.unit || 'sqft'}` : null;
  const previewBeds = activeProperty?.bedrooms ? `${activeProperty.bedrooms} BHK` : null;
  const previewBaths = activeProperty?.bathrooms ? `${activeProperty.bathrooms} Baths` : null;

  return (
    <div className="relative rounded-3xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100 select-none">
      
      {/* Top Floating Controls Header */}
      <div className="absolute top-2.5 left-2.5 right-2.5 sm:top-3 sm:left-3 sm:right-3 z-[1000] flex items-center gap-2 pointer-events-none">
        {/* Back Button */}
        <button
          type="button"
          onClick={onBack}
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-md hover:shadow-lg flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-800 pointer-events-auto active:scale-95 transition-all"
          title="Back to Discover"
          aria-label="Back to Explore"
        >
          <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        {/* Location & Count Pill */}
        <button
          type="button"
          onClick={onOpenLocationPicker}
          className="flex-1 mr-12 sm:mr-0 max-w-sm bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-md hover:shadow-lg rounded-full py-1.5 sm:py-2 px-3 sm:px-4 border border-slate-200 dark:border-slate-800 pointer-events-auto flex items-center justify-between gap-1.5 active:scale-95 transition-all cursor-pointer"
          title="Click to search or auto-detect location"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
            <span className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate">
              {cityName}
            </span>
          </div>
          <span className="text-[10px] sm:text-[11px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/70 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-700/60 shrink-0">
            {displayedItems.length} {searchPurpose === 'rent' ? 'rentals' : 'listings'}
          </span>
        </button>
      </div>

      {/* Floating Purpose Toggle (Buy vs Rent) & Clean Single-Row Scope Selector */}
      <div className="absolute top-14 left-2.5 sm:left-3 z-[1000] flex items-center gap-1.5 pointer-events-auto max-w-[calc(100%-20px)] flex-wrap">
        {/* Buy / Rent Switch */}
        {setSearchPurpose && (
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-full p-0.5 shadow-md border border-slate-200 dark:border-slate-800 flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => setSearchPurpose('sale')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                searchPurpose === 'sale'
                  ? 'bg-[#184631] text-white shadow-xs'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Buy
            </button>
            <button
              type="button"
              onClick={() => setSearchPurpose('rent')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                searchPurpose === 'rent'
                  ? 'bg-[#184631] text-white shadow-xs'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Rent
            </button>
          </div>
        )}

        {/* Compact Scope Switcher (Nearby vs All) */}
        {hasUserCoords && (
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-full p-0.5 shadow-md border border-slate-200 dark:border-slate-800 flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => setViewScope('nearby')}
              className={`px-2.5 sm:px-3 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                viewScope === 'nearby'
                  ? 'bg-emerald-700 text-white shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <LocateFixed className="w-3 h-3 shrink-0" />
              <span>Nearby</span>
            </button>
            <button
              type="button"
              onClick={() => setViewScope('all')}
              className={`px-2.5 sm:px-3 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1 transition-all shrink-0 cursor-pointer ${
                viewScope === 'all'
                  ? 'bg-emerald-700 text-white shadow-xs font-bold'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Compass className="w-3 h-3 shrink-0" />
              <span>All Region</span>
            </button>
          </div>
        )}
      </div>

      {/* Leaflet Map Canvas */}
      <div 
        ref={mapContainerRef} 
        className="map-leaflet-container" 
        style={{ 
          height: isMobile ? '560px' : '640px', 
          minHeight: '460px', 
          width: '100%', 
          position: 'relative', 
          zIndex: 1 
        }} 
      />

      {/* Interactive Property Preview Card (Visible when a pin is selected) */}
      {activeProperty ? (
        <div className={`absolute z-[1001] pointer-events-auto transition-all duration-300 animate-in fade-in slide-in-from-bottom-3 ${
          isMobile 
            ? 'left-3 right-3 bottom-3' 
            : 'left-4 bottom-4 max-w-md w-full'
        }`}>
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-3 sm:p-4 text-slate-900 dark:text-slate-100 ring-1 ring-black/5">
            <div className="flex items-start gap-3">
              {/* Thumbnail Image */}
              <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 border border-slate-200 dark:border-slate-700">
                {previewImageUrl ? (
                  <img 
                    src={previewImageUrl} 
                    alt={activeProperty.title} 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-1 p-2 text-center">
                    <Building className="w-6 h-6 text-slate-400" />
                    <span className="text-[10px] font-semibold leading-tight">PlotPin Verified</span>
                  </div>
                )}
                {/* Purpose Tag */}
                <div className="absolute top-1.5 left-1.5 bg-slate-900/80 backdrop-blur-xs text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider">
                  {activeProperty.purpose === 'rent' ? 'Rent' : 'Buy'}
                </div>
              </div>

              {/* Information Column */}
              <div className="flex-1 min-w-0 pr-6">
                {/* Badges: Category & Verification */}
                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                  <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                    {previewCategory}
                  </span>
                  {(activeProperty.cadastralVerified || activeProperty.verificationStatus === 'approved') && (
                    <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>Verified</span>
                    </span>
                  )}
                </div>

                {/* Title */}
                <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate mb-1" title={activeProperty.title}>
                  {activeProperty.title}
                </h4>

                {/* Location */}
                <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 truncate mb-2">
                  <MapPin className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span className="truncate">{previewLocality}</span>
                </div>

                {/* Authoritative Price */}
                <div className="font-black text-sm sm:text-base text-emerald-700 dark:text-emerald-400 leading-none mb-2">
                  {formatPreviewPrice(activeProperty)}
                </div>

                {/* Specifications Pill */}
                <div className="flex items-center gap-2 text-[10px] text-slate-600 dark:text-slate-400 font-semibold mb-3">
                  {previewBeds && (
                    <span className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                      <Bed className="w-3 h-3 text-slate-500" />
                      {previewBeds}
                    </span>
                  )}
                  {previewBaths && (
                    <span className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                      <Bath className="w-3 h-3 text-slate-500" />
                      {previewBaths}
                    </span>
                  )}
                  {previewArea && (
                    <span className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                      <Maximize2 className="w-3 h-3 text-slate-500" />
                      {previewArea}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Actions Row */}
            <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 hidden sm:inline">
                Direct Owner Listing · 0% Brokerage
              </span>
              <button
                type="button"
                onClick={handleOpenDetails}
                className="w-full sm:w-auto ml-auto px-4 py-2 rounded-xl bg-[#184631] hover:bg-[#123625] active:scale-95 text-white font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
              >
                <span>View Full Details</span>
                <Sparkles className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={handleClosePreview}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white flex items-center justify-center transition-colors"
              title="Close preview"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : null}

      {/* Bottom Floating Hint / Status Pill (Consolidated single pill - never overlaps) */}
      {!activeProperty && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[1000] max-w-[92%] bg-slate-900/90 backdrop-blur-xs text-[11px] font-semibold px-3.5 py-1.5 rounded-full shadow-lg border border-slate-700/80 flex items-center gap-1.5 pointer-events-none whitespace-nowrap">
          {!hasNearby && hasUserCoords ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
              <span className="text-amber-300 truncate">
                No {searchPurpose === 'rent' ? 'rentals' : 'listings'} in {cityName} · Showing regional
              </span>
            </>
          ) : (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
              <span className="text-white">Tap any price pin to preview</span>
            </>
          )}
        </div>
      )}

    </div>
  );
}
