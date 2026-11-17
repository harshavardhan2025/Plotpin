import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin,
  Navigation,
  Search,
  X,
  Check,
  Sliders,
  Loader2,
  Compass,
  ShieldCheck,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import L from 'leaflet';
import { BASE_URL } from '../../lib/api';

// Andhra Pradesh Cadastral Registry Urban & District Centres
const POPULAR_AREAS = [
  { name: 'Kadapa, Andhra Pradesh', lat: 14.4673, lng: 78.8242 },
  { name: 'Visakhapatnam, Andhra Pradesh', lat: 17.6868, lng: 83.2185 },
  { name: 'Vijayawada, Andhra Pradesh', lat: 16.5062, lng: 80.6480 },
  { name: 'Tirupati, Andhra Pradesh', lat: 13.6288, lng: 79.4192 },
  { name: 'Guntur, Andhra Pradesh', lat: 16.3067, lng: 80.4365 },
  { name: 'Kakinada, Andhra Pradesh', lat: 16.9891, lng: 82.2475 },
  { name: 'Rajahmundry, Andhra Pradesh', lat: 17.0005, lng: 81.8040 },
  { name: 'Nellore, Andhra Pradesh', lat: 14.4426, lng: 79.9865 },
  { name: 'Kurnool, Andhra Pradesh', lat: 15.8281, lng: 78.0373 },
  { name: 'Anantapur, Andhra Pradesh', lat: 14.6819, lng: 77.6006 }
];

const DEFAULT_CADASTRE = {
  lat: 14.4673,
  lng: 78.8242,
  latitude: 14.4673,
  longitude: 78.8242,
  name: 'Kadapa, Andhra Pradesh'
};

export async function reverseGeocode(lat, lng) {
  try {
    // Try backend cached geocoding proxy first (rate-limit protected)
    const proxyRes = await fetch(`${BASE_URL}/location/reverse?lat=${lat}&lng=${lng}`);
    if (proxyRes.ok) {
      const json = await proxyRes.json();
      const data = json.data;
      if (data && data.address) {
        const addr = data.address;
        const locality = addr.suburb || addr.neighbourhood || addr.residential || addr.city_district || addr.town || addr.village;
        const city = addr.city || addr.state_district || addr.county || addr.state;
        if (locality && city && locality !== city) return `${locality}, ${city}`;
        return locality || city || data.display_name?.split(',').slice(0, 2).join(', ');
      }
    }
  } catch {
    // Fall back to direct OpenStreetMap
  }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    if (data && data.address) {
      const addr = data.address;
      const locality = addr.suburb || addr.neighbourhood || addr.residential || addr.city_district || addr.town || addr.village;
      const city = addr.city || addr.state_district || addr.county || addr.state;
      if (locality && city && locality !== city) {
        return `${locality}, ${city}`;
      }
      return locality || city || data.display_name.split(',').slice(0, 2).join(', ');
    }
  } catch (err) {
    console.warn('Reverse geocoding error:', err);
  }
  return `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
}

export default function LocationPickerModal({
  isOpen,
  onClose,
  currentLocation,
  radiusKm,
  onApplyLocation,
  isMobile = false
}) {
  const [tempLocation, setTempLocation] = useState(() => {
    const lat = currentLocation?.lat || currentLocation?.latitude || DEFAULT_CADASTRE.lat;
    const lng = currentLocation?.lng || currentLocation?.longitude || DEFAULT_CADASTRE.lng;
    return {
      lat,
      lng,
      latitude: lat,
      longitude: lng,
      name: currentLocation?.name || DEFAULT_CADASTRE.name,
      isLiveGps: currentLocation?.isLiveGps || false
    };
  });
  const [tempRadius, setTempRadius] = useState(radiusKm || 50);
  const [searchText, setSearchText] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isLocating, setIsLocating] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  const miniMapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);

  useEffect(() => {
    if (currentLocation && (currentLocation.lat != null || currentLocation.latitude != null)) {
      const lat = currentLocation.lat ?? currentLocation.latitude;
      const lng = currentLocation.lng ?? currentLocation.longitude;
      setTempLocation({
        lat,
        lng,
        latitude: lat,
        longitude: lng,
        name: currentLocation.name || DEFAULT_CADASTRE.name,
        isLiveGps: currentLocation.isLiveGps || false
      });
    }
    if (radiusKm) {
      setTempRadius(radiusKm);
    }
  }, [currentLocation, radiusKm, isOpen]);

  // Leaflet Mini Map management
  useEffect(() => {
    if (!isOpen || !miniMapRef.current) return;

    const timer = setTimeout(() => {
      if (!miniMapRef.current) return;

      const targetLat = tempLocation.latitude || DEFAULT_CADASTRE.latitude;
      const targetLng = tempLocation.longitude || DEFAULT_CADASTRE.longitude;

      if (!mapInstanceRef.current) {
        const map = L.map(miniMapRef.current, {
          center: [targetLat, targetLng],
          zoom: 12,
          zoomControl: true,
          attributionControl: false
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

        map.on('click', async (e) => {
          const { lat, lng } = e.latlng;
          setStatusMessage({ type: 'info', text: 'Resolving location coordinates...' });
          const name = await reverseGeocode(lat, lng);
          setTempLocation({
            latitude: lat,
            longitude: lng,
            name: name
          });
          setStatusMessage({ type: 'success', text: `Demarcation point pinned: ${name}` });
        });

        mapInstanceRef.current = map;
      } else {
        mapInstanceRef.current.invalidateSize();
        mapInstanceRef.current.setView([targetLat, targetLng], mapInstanceRef.current.getZoom());
      }

      const map = mapInstanceRef.current;

      // Update Marker with Official SVG Badge (no casual emojis)
      if (markerRef.current) {
        markerRef.current.remove();
      }
      const officialPinHtml = `
        <div style="background:#184631; color:#ffffff; font-size:11px; font-weight:800; padding:5px 12px; border-radius:9999px; border:2px solid #ffffff; box-shadow:0 4px 12px rgba(0,0,0,0.35); display:inline-flex; align-items:center; gap:6px; letter-spacing:-0.2px; white-space:nowrap;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          <span>${tempLocation.name || 'Selected Point'}</span>
        </div>
      `;
      const pinIcon = L.divIcon({
        className: 'custom-official-pin',
        html: officialPinHtml,
        iconSize: [140, 28],
        iconAnchor: [70, 14]
      });
      markerRef.current = L.marker([targetLat, targetLng], { icon: pinIcon }).addTo(map);

      // Update Geofence Radius Circle
      if (circleRef.current) {
        circleRef.current.remove();
      }
      circleRef.current = L.circle([targetLat, targetLng], {
        radius: tempRadius * 1000,
        color: '#184631',
        fillColor: '#10b981',
        fillOpacity: 0.12,
        weight: 2,
        dashArray: '6, 6'
      }).addTo(map);
    }, 120);

    return () => clearTimeout(timer);
  }, [isOpen, tempLocation, tempRadius]);

  if (!isOpen) return null;

  // Auto-fetch Live GPS
  const handleAutoFetchGPS = () => {
    if (!navigator.geolocation) {
      setStatusMessage({ type: 'error', text: 'GPS is not supported by your browser.' });
      return;
    }

    setIsLocating(true);
    setStatusMessage({ type: 'info', text: 'Acquiring GPS satellite coordinates...' });

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setStatusMessage({ type: 'info', text: 'Resolving locality & district name...' });
        const name = await reverseGeocode(latitude, longitude);
        setTempLocation({
          lat: latitude,
          lng: longitude,
          latitude,
          longitude,
          name,
          isLiveGps: true
        });
        setIsLocating(false);
        setStatusMessage({ type: 'success', text: `Live GPS coordinates resolved: ${name}` });
      },
      () => {
        setIsLocating(false);
        setStatusMessage({ type: 'error', text: 'GPS permission denied or timed out. Please select an area below.' });
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Search input change
  const handleSearchChange = (val) => {
    setSearchText(val);
    if (!val.trim()) {
      setSuggestions([]);
      return;
    }
    const matched = POPULAR_AREAS.filter(a => a.name.toLowerCase().includes(val.toLowerCase()));
    setSuggestions(matched);
  };

  // Search location with cached backend proxy (with Nominatim fallback)
  const handlePerformSearch = async () => {
    if (!searchText.trim()) return;
    setIsSearching(true);
    setStatusMessage({ type: 'info', text: `Searching for "${searchText}"...` });

    try {
      let data = null;
      try {
        const proxyRes = await fetch(`${BASE_URL}/location/search?q=${encodeURIComponent(searchText.trim())}`);
        if (proxyRes.ok) {
          const json = await proxyRes.json();
          if (json.success && Array.isArray(json.data) && json.data.length > 0) {
            data = json.data;
          }
        }
      } catch {
        // Continue to fallback
      }

      if (!data) {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchText.trim())}&limit=5&addressdetails=1`, {
          headers: { 'Accept-Language': 'en' }
        });
        data = await res.json();
      }

      if (data && data.length > 0) {
        const first = data[0];
        const name = first.display_name.split(',').slice(0, 3).join(', ');
        const latVal = parseFloat(first.lat);
        const lngVal = parseFloat(first.lon);
        setTempLocation({
          lat: latVal,
          lng: lngVal,
          latitude: latVal,
          longitude: lngVal,
          name: name,
          isLiveGps: false
        });
        setStatusMessage({ type: 'success', text: `Location updated: ${name}` });
        setSuggestions(data.map(item => ({
          name: item.display_name.split(',').slice(0, 3).join(', '),
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon)
        })));
      } else {
        setStatusMessage({ type: 'error', text: `No coordinates found for "${searchText}".` });
      }
    } catch {
      setStatusMessage({ type: 'error', text: 'Search request timed out. Please verify network connection.' });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectArea = (area) => {
    setTempLocation({
      lat: area.lat,
      lng: area.lng,
      latitude: area.lat,
      longitude: area.lng,
      name: area.name,
      isLiveGps: false
    });
    setSearchText('');
    setSuggestions([]);
    setStatusMessage({ type: 'success', text: `Location set: ${area.name}` });
  };

  const handleApply = () => {
    const lat = tempLocation.lat || tempLocation.latitude || DEFAULT_CADASTRE.lat;
    const lng = tempLocation.lng || tempLocation.longitude || DEFAULT_CADASTRE.lng;
    onApplyLocation({
      location: {
        ...tempLocation,
        lat,
        lng,
        latitude: lat,
        longitude: lng
      },
      radiusKm: tempRadius
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className={`bg-white dark:bg-slate-900 w-full ${isMobile ? 'max-w-md' : 'max-w-lg'} rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]`}>
        
        {/* Clean Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/90 dark:bg-slate-800/80">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white leading-tight">
              Location &amp; Radius
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700 flex items-center justify-center transition-all cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 space-y-3.5 overflow-y-auto text-xs custom-smooth-scrollbar">
          
          {/* Single Clean Selected Location Strip */}
          <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2 shadow-2xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
              <span className="font-bold text-xs text-slate-900 dark:text-white truncate">
                {tempLocation.name || 'Kadapa, Andhra Pradesh'}
              </span>
            </div>
            <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-950/80 px-2 py-0.5 rounded-md shrink-0">
              {tempRadius} km
            </span>
          </div>

          {/* Search Area & Auto GPS Row */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <div className="flex-1 relative flex items-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 focus-within:border-emerald-600 focus-within:ring-1 focus-within:ring-emerald-600 transition-all">
                <Search className="w-3.5 h-3.5 text-slate-400 shrink-0 mr-2 pointer-events-none" />
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handlePerformSearch()}
                  placeholder="Search city, district, or pincode..."
                  className="bg-transparent w-full text-xs font-semibold text-slate-800 dark:text-slate-100 border-none outline-none ring-0 focus:outline-none focus:ring-0 focus:border-none focus-visible:outline-none focus-visible:ring-0 shadow-none no-focus-box placeholder:text-slate-400 p-0"
                  style={{
                    outline: 'none',
                    border: 'none',
                    boxShadow: 'none',
                    WebkitAppearance: 'none'
                  }}
                />
                {searchText && (
                  <button
                    type="button"
                    onClick={() => { setSearchText(''); setSuggestions([]); }}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs px-1"
                  >
                    ✕
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={handlePerformSearch}
                disabled={isSearching || !searchText.trim()}
                className="px-3.5 py-2 bg-[#184631] hover:bg-[#12583e] dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all shrink-0 disabled:opacity-40 shadow-xs cursor-pointer"
              >
                {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Search'}
              </button>

              <button
                type="button"
                onClick={handleAutoFetchGPS}
                disabled={isLocating}
                className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-[#184631] dark:bg-emerald-950/60 dark:text-emerald-300 font-bold text-xs rounded-xl border border-emerald-200 dark:border-emerald-700 flex items-center gap-1 transition-all shrink-0 active:scale-95 cursor-pointer disabled:opacity-50"
                title="Use Current GPS"
              >
                {isLocating ? <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-700" /> : <Navigation className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">GPS</span>
              </button>
            </div>

            {/* Quick Suggestions Dropdown */}
            {suggestions.length > 0 && (
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg divide-y divide-slate-100 dark:divide-slate-700 overflow-hidden">
                {suggestions.map((sug) => (
                  <button
                    key={sug.name}
                    type="button"
                    onClick={() => handleSelectArea(sug)}
                    className="w-full text-left px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-slate-700/60 flex items-center justify-between"
                  >
                    <span className="truncate">{sug.name}</span>
                    <span className="text-[10px] text-[#184631] dark:text-emerald-400 font-bold ml-2">Select</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Map */}
          <div className="space-y-1">
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>Map (Click to pin)</span>
              <span className="font-mono text-[10px]">{tempRadius} km</span>
            </div>
            <div
              ref={miniMapRef}
              className="w-full h-40 sm:h-44 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-inner bg-slate-100 dark:bg-slate-950"
            />
          </div>

          {/* Clean Radius Selector */}
          <div className="space-y-1.5 pt-1">
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>Radius</span>
              <span className="font-extrabold text-[#184631] dark:text-emerald-400">{tempRadius} km</span>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {[5, 10, 25, 50, 100].map((val) => {
                const isSelected = tempRadius === val;
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setTempRadius(val)}
                    className={`py-1.5 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer ${
                      isSelected
                        ? 'bg-[#184631] text-white border-[#184631] shadow-2xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {val} km
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => handleSelectArea(POPULAR_AREAS[0])}
            className="text-xs text-slate-500 hover:text-slate-800 font-semibold px-2 py-1 transition-colors cursor-pointer"
          >
            Reset
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-4 py-1.5 bg-[#184631] hover:bg-[#12583e] dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white rounded-xl text-xs font-extrabold shadow-sm transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Apply</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
