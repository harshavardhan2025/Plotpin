import React from 'react';
import { 
  X, ShieldCheck, CheckCircle2, Calendar, MessageCircle, 
  Phone, ArrowRight, Trash2, MapPin, Building, Ruler, 
  Check, Minus, Sparkles, ImageOff, Layers
} from 'lucide-react';
import { getFirstPropertyImageUrl } from '../../utils/propertyHelpers';

const AMENITY_LABELS = {
  high_speed_wifi: 'High Speed Wi-Fi',
  high_speed_wi_fi: 'High Speed Wi-Fi',
  wifi: 'High-Speed Wi-Fi',
  attached_washroom: 'Attached Washroom',
  geyser_hot_water: 'Geyser / Hot Water',
  geyser__hot_water: 'Geyser / Hot Water',
  washing_machine_laundry: 'Washing Machine & Laundry',
  washing_machine___laundry: 'Washing Machine & Laundry',
  ro_purified_water: 'RO Purified Water',
  power_backup: 'Power Backup',
  air_conditioning: 'Air Conditioning',
  cctv_security: '24/7 CCTV Security',
  parking: 'Reserved Parking',
  elevator: 'Lift / Elevator',
  gym: 'Fitness Gym',
  swimming_pool: 'Swimming Pool',
  security: 'Gated Security Desk'
};

function formatAmenity(name) {
  if (!name || typeof name !== 'string') return '';
  const normalizedKey = name.toLowerCase().replace(/[\s\-/]+/g, '_').replace(/_+/g, '_').trim();
  if (AMENITY_LABELS[normalizedKey]) {
    return AMENITY_LABELS[normalizedKey];
  }
  return name
    .replace(/[_\-/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map(w => {
      const lower = w.toLowerCase();
      if (lower === 'wifi' || lower === 'wi-fi') return 'Wi-Fi';
      if (lower === 'ro') return 'RO';
      if (lower === 'cctv') return 'CCTV';
      if (lower === 'ac') return 'AC';
      if (lower === 'tv') return 'TV';
      if (lower === 'pg') return 'PG';
      if (lower === '24/7') return '24/7';
      if (lower === 'hot') return 'Hot';
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(' ');
}

export default function PropertyComparisonModal({
  properties = [],
  comparisonList = [],
  userLocation,
  onClose,
  onRemoveProperty,
  onClearAll,
  onBookVisit,
  onRequestCall,
  onOpenChat,
  onSelectProperty,
  isMobile = false
}) {
  const items = (properties && properties.length > 0) ? properties : (comparisonList || []);

  const formatPrice = (price, purpose) => {
    if (!price) return '₹0';
    if (purpose === 'rent') return `₹${price.toLocaleString('en-IN')}/mo`;
    if (price >= 10000000) return `₹${(price / 10000000).toFixed(2)} Cr`;
    if (price >= 100000) return `₹${(price / 100000).toFixed(1)} Lakh`;
    return `₹${price.toLocaleString('en-IN')}`;
  };

  const getPricePerSqFt = (price, area) => {
    if (!price || !area || area <= 0) return '—';
    const rate = Math.round(price / area);
    return `₹${rate.toLocaleString('en-IN')}/sq.ft`;
  };

  if (!items || items.length === 0) {
    return (
      <div className="modal-overlay animate-in fade-in duration-200">
        <div className="modal-content-box max-w-md w-full p-6 text-center space-y-4 rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131E31] shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto border border-amber-200 dark:border-amber-700">
            <Layers className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-black text-slate-900 dark:text-white">No Properties to Compare</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Select 2 or 3 properties by clicking the <strong>Compare</strong> button on any listing card to inspect their specifications side-by-side.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="w-full bg-[#184631] hover:bg-[#123625] text-white py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            Browse Listings
          </button>
        </div>
      </div>
    );
  }

  // Extract all unique amenities across compared properties
  const allAmenities = Array.from(
    new Set(items.flatMap(p => p.amenities || []))
  );

  // Dynamic grid column template matching exact number of compared properties
  const colGridStyle = {
    display: 'grid',
    gridTemplateColumns: isMobile 
      ? `120px repeat(${items.length}, minmax(180px, 1fr))` 
      : `170px repeat(${items.length}, minmax(210px, 1fr))`,
    gap: isMobile ? '12px' : '16px'
  };

  const comparedCategory = items[0]?.propertyType || items[0]?.category || 'Property';

  return (
    <div className="modal-overlay animate-in fade-in duration-200">
      <div className="modal-content-box max-w-6xl w-full p-0 overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131E31] shadow-2xl flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 bg-slate-900 text-white flex items-center justify-between sticky top-0 z-50 shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 flex items-center justify-center font-bold shrink-0">
              <Sparkles className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-extrabold text-base text-white tracking-tight">
                  Side-by-Side Property Comparison
                </h3>
                <span className="text-[11px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-0.5 rounded-full font-bold">
                  {items.length} / 3 Properties
                </span>
                <span className="text-[11px] bg-amber-400 text-slate-950 font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  {comparedCategory} Class Match
                </span>
                {onClearAll && items.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearAll}
                    className="text-[11px] text-rose-300 hover:text-rose-100 font-bold underline ml-1 cursor-pointer"
                  >
                    Clear All
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Comparing specifications, pricing, amenities, and cadastral deed status side-by-side.
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-all shrink-0"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Comparison Table */}
        <div className="overflow-x-auto overflow-y-auto flex-1 p-4 sm:p-6 custom-smooth-scrollbar">
          <div className="min-w-[550px]">
            {/* Grid Header Cards */}
            <div style={colGridStyle} className="pb-6 border-b border-slate-200 dark:border-slate-700 items-stretch">
              <div className="pt-6 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex flex-col justify-end">
                <span className="text-slate-800 dark:text-slate-100 font-extrabold text-sm font-display">Specifications</span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500 normal-case font-normal mt-0.5">Scroll across to compare details</span>
              </div>

              {items.map((prop) => {
                const imgUrl = getFirstPropertyImageUrl(prop);
                const propId = prop._id || prop.id;
                return (
                  <div key={propId} className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 flex flex-col justify-between relative group shadow-xs hover:border-emerald-300 dark:hover:border-emerald-600 transition-all">
                    {onRemoveProperty && (
                      <button
                        type="button"
                        onClick={() => onRemoveProperty(propId)}
                        className="absolute top-2 right-2 p-1 text-slate-400 hover:text-rose-600 bg-white/90 dark:bg-slate-900/90 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg transition-all z-10 shadow-xs border border-slate-200 dark:border-slate-700"
                        title="Remove from comparison"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <div className="space-y-2">
                      <div className="h-28 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        {imgUrl ? (
                          <img 
                            src={imgUrl} 
                            alt={prop.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center text-slate-400 p-2 text-center">
                            <ImageOff className="w-5 h-5 text-slate-300 dark:text-slate-600 mb-0.5" />
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Photos not available</span>
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-700 inline-block">
                            {prop.purpose === 'rent' ? 'For Rent' : 'For Sale'}
                          </span>
                          <span className="text-[10px] font-bold uppercase text-slate-700 dark:text-slate-300 bg-slate-200/70 dark:bg-slate-700 px-2 py-0.5 rounded inline-block">
                            {prop.propertyType || prop.category}
                          </span>
                        </div>
                        <h4 
                          onClick={() => onSelectProperty && onSelectProperty(prop)}
                          className="font-extrabold text-xs text-slate-900 dark:text-white line-clamp-2 mt-1 hover:text-emerald-700 dark:hover:text-emerald-400 cursor-pointer"
                          title={prop.title}
                        >
                          {prop.title}
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>{prop.location?.locality || prop.location?.city || prop.location?.address}</span>
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                      <div className="text-sm font-extrabold text-emerald-800 dark:text-emerald-400">
                        {formatPrice(prop.price, prop.purpose)}
                      </div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">
                        {getPricePerSqFt(prop.price, prop.area?.value)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Spec Rows */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              
              {/* Row: Distance */}
              <div style={colGridStyle} className="py-3 items-center">
                <div className="font-bold text-slate-600 dark:text-slate-400">Proximity</div>
                {items.map(p => (
                  <div key={p._id || p.id} className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                    {p.distanceKm !== undefined && p.distanceKm !== null ? (
                      <span className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700 px-2 py-0.5 rounded-full text-[11px] font-bold">
                        📍 {p.distanceKm} km away
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Row: Super Built-up Area */}
              <div style={colGridStyle} className="py-3 items-center">
                <div className="font-bold text-slate-600 dark:text-slate-400">Super Built-up Area</div>
                {items.map(p => (
                  <div key={p._id || p.id} className="font-bold text-slate-900 dark:text-slate-100">
                    {p.area?.value ? `${p.area.value} sq.ft` : '—'}
                  </div>
                ))}
              </div>

              {/* Row: Property Type & Config */}
              <div style={colGridStyle} className="py-3 items-center">
                <div className="font-bold text-slate-600 dark:text-slate-400">Category &amp; Layout</div>
                {items.map(p => (
                  <div key={p._id || p.id} className="font-medium text-slate-800 dark:text-slate-200">
                    <span className="capitalize font-bold">{p.propertyType || p.category}</span>
                    {(p.bedrooms || p.bhk || p.specifications?.bedrooms) && (
                      <span className="text-slate-500 dark:text-slate-400 ml-1">({p.bedrooms || p.bhk || p.specifications?.bedrooms} BHK)</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Row: Facing */}
              <div style={colGridStyle} className="py-3 items-center">
                <div className="font-bold text-slate-600 dark:text-slate-400">Facing Direction</div>
                {items.map(p => (
                  <div key={p._id || p.id} className="text-slate-700 dark:text-slate-300 capitalize font-medium">
                    {p.specifications?.facing || p.facing || 'East Facing'}
                  </div>
                ))}
              </div>

              {/* Row: Legal Verification Status */}
              <div style={colGridStyle} className="py-3 items-center bg-slate-50/50 dark:bg-slate-800/30">
                <div className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Title &amp; Khata</span>
                </div>
                {items.map(p => (
                  <div key={p._id || p.id}>
                    <span className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded text-[10px] font-extrabold inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      {p.verificationStatus === 'approved' || p.verificationStatus === 'verified' ? 'Verified & Approved' : 'Under Registry Check'}
                    </span>
                  </div>
                ))}
              </div>

              {/* Row: Direct Owner / Brokerage */}
              <div style={colGridStyle} className="py-3 items-center">
                <div className="font-bold text-slate-600 dark:text-slate-400">Brokerage Fee</div>
                {items.map(p => (
                  <div key={p._id || p.id} className="text-emerald-700 dark:text-emerald-400 font-extrabold text-[11px]">
                    0% Zero Brokerage
                  </div>
                ))}
              </div>

              {/* Row: Amenities Checklist */}
              {allAmenities.length > 0 && allAmenities.map(amenity => (
                <div key={amenity} style={colGridStyle} className="py-2.5 items-center">
                  <div className="text-slate-500 dark:text-slate-400 font-medium text-[11px] truncate" title={formatAmenity(amenity)}>
                    {formatAmenity(amenity)}
                  </div>
                  {items.map(p => {
                    const hasIt = (p.amenities || []).includes(amenity);
                    return (
                      <div key={p._id || p.id} className="text-slate-700 dark:text-slate-300">
                        {hasIt ? (
                          <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </span>
                        ) : (
                          <span className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 flex items-center justify-center">
                            <Minus className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* Row: Direct Action Controls */}
              <div style={colGridStyle} className="py-4 items-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-2 mt-4">
                <div className="font-extrabold text-slate-800 dark:text-slate-200 text-xs">
                  Next Steps
                </div>
                {items.map(p => (
                  <div key={p._id || p.id} className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => onBookVisit && onBookVisit(p)}
                      className="w-full bg-[#184631] hover:bg-[#123625] text-white py-1.5 px-2 rounded-xl text-[11px] font-bold shadow-xs transition-all active:scale-95"
                    >
                      Book Visit
                    </button>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => onRequestCall && onRequestCall(p)}
                        className="w-full bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-700 py-1 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-all"
                        title="Direct Call"
                      >
                        <Phone className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                        <span>Call</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3 bg-slate-100 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0 text-xs text-slate-500 dark:text-slate-400">
          <span>Specifications are verified against registered property documents.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 dark:bg-slate-700 text-white rounded-xl font-bold hover:bg-slate-800 dark:hover:bg-slate-600 transition-colors shadow-xs"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
