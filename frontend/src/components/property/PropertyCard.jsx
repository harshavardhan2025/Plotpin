import React from 'react';
import {
  MapPin, Check, Bookmark, Box, Phone, Calendar, ImageOff
} from 'lucide-react';
import {
  calcDistanceKm,
  getPropertyLatLng,
  getFirstPropertyImageUrl,
  getPropertyTypeCategory
} from '../../utils/propertyHelpers';
import { useAuth } from '../../contexts/AuthContext';
import { useProperty } from '../../contexts/PropertyContext';

export default function PropertyCard({ property }) {
  const { currentUser } = useAuth();
  const {
    userLocation,
    isMobile,
    favoriteIds,
    handleToggleFavorite,
    comparisonList,
    addToComparison,
    removeFromComparison,
    setShowComparisonModal,
    handleOpenDetailModal,
    handleOpenCallModal,
    handleOpenVisitModal,
    handleOpen3DModal
  } = useProperty();

  if (!property) return null;

  const propId = property._id || property.id;
  const isFav = favoriteIds.includes(propId);
  const isComparing = comparisonList.some((p) => (p._id || p.id) === propId);

  const status = property.availabilityStatus || 'available';
  const isSold = status === 'sold';
  const isRented = status === 'rented';

  const coords = getPropertyLatLng(property);
  const userLat = Number(userLocation?.lat ?? userLocation?.latitude);
  const userLng = Number(userLocation?.lng ?? userLocation?.longitude);
  const distKm = property.distanceKm != null ? property.distanceKm : (
    coords && !isNaN(userLat) && !isNaN(userLng) && userLat !== 0 && userLng !== 0
      ? calcDistanceKm(userLat, userLng, coords.lat, coords.lng)
      : null
  );

  const propImgUrl = getFirstPropertyImageUrl(property);
  const hasRealPhoto = Boolean(propImgUrl);

  const formattedPrice = (() => {
    const isRent = property.purpose === 'rent' || property.propertyType === 'pg' || property.category === 'pg';
    if (isRent) {
      return `₹${Number(property.price || 0).toLocaleString('en-IN')}/mo`;
    }
    const num = Number(property.price || 0);
    if (num >= 10000000) {
      return `₹${(num / 10000000).toFixed(2)} Cr`;
    }
    if (num >= 100000) {
      return `₹${(num / 100000).toFixed(1)} Lakh`;
    }
    return `₹${num.toLocaleString('en-IN')}`;
  })();

  const handleCompareClick = (e) => {
    e.stopPropagation();
    if (isComparing) {
      setShowComparisonModal(true);
    } else {
      addToComparison(property);
    }
  };

  return (
    <div className="card-3d-wrapper">
      <div
        className="card-3d-inner bg-white dark:bg-slate-900/95 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs flex flex-col cursor-pointer group h-full hover:shadow-md transition-shadow"
        onClick={() => handleOpenDetailModal(property)}
      >
        {/* Card Media Header */}
        <div className={`relative ${isMobile ? 'h-44' : 'h-56'} bg-slate-100 dark:bg-slate-800 overflow-hidden flex items-center justify-center`}>
          {hasRealPhoto ? (
            <img
              src={propImgUrl}
              alt={property.title}
              className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500 ease-out"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-400 p-4 text-center">
              <ImageOff className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-1" />
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Photos not available</span>
            </div>
          )}

          {/* Bottom Gradient Scrim */}
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />

          {/* Top Left Badges - Distinct Status Pill */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5 z-10 pointer-events-none">
            {isSold ? (
              <span className="pointer-events-auto bg-rose-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-md uppercase tracking-wider flex items-center gap-1">
                <span>🔒 SOLD</span>
              </span>
            ) : isRented ? (
              <span className="pointer-events-auto bg-blue-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-md uppercase tracking-wider flex items-center gap-1">
                <span>🤝 RENTED</span>
              </span>
            ) : (
              <span className="pointer-events-auto bg-emerald-700/90 text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                <Check className="w-3 h-3 text-emerald-300 stroke-[3]" />
                <span>{property.purpose === 'rent' ? 'Available for Rent' : 'Available for Sale'}</span>
              </span>
            )}
          </div>

          {/* Top Right Badges */}
          <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
            <button
              type="button"
              onClick={handleCompareClick}
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-sm flex items-center gap-1 transition-all ${isComparing
                  ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-300 font-black scale-105'
                  : 'bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-slate-100 hover:bg-white dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700'
                }`}
            >
              <span>{isComparing ? 'Comparing' : 'Compare'}</span>
            </button>

            <button
              type="button"
              onClick={(e) => handleToggleFavorite(e, propId)}
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${isFav
                  ? 'bg-white dark:bg-slate-900 text-rose-600 shadow'
                  : 'bg-white/95 dark:bg-slate-900/95 text-slate-700 dark:text-slate-200 hover:text-emerald-700 dark:hover:text-emerald-400 shadow-sm border border-slate-200 dark:border-slate-700'
                }`}
              title={isFav ? 'Remove from favorites' : 'Save to favorites'}
            >
              <Bookmark className={`w-3.5 h-3.5 ${isFav ? 'fill-rose-600 text-rose-600' : ''}`} />
            </button>
          </div>

          {/* Bottom Left Price & Distance */}
          <div className="absolute bottom-3 left-3 text-left z-10 pointer-events-none">
            <div className="text-xl font-black text-white leading-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
              {formattedPrice}
            </div>
            {distKm != null && (
              <div className="text-[11px] text-white/95 font-semibold drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                {distKm} km away
              </div>
            )}
          </div>

          {/* Bottom Right 3D Tour */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleOpen3DModal(property);
            }}
            className="absolute bottom-3 right-3 bg-[#184631]/95 hover:bg-[#123625] text-white text-[11px] font-bold px-3 py-1 rounded-lg shadow-md flex items-center gap-1.5 border border-white/20 transition-all z-10"
          >
            <Box className="w-3.5 h-3.5 text-emerald-300" />
            <span>3D Tour</span>
          </button>
        </div>

        {/* Card Body - Decreased vertical space & heightened clarity */}
        <div className="p-3 flex flex-col flex-1 justify-between gap-2">
          <div>
            <h4 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 line-clamp-1 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors capitalize">
              {property.title}
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="truncate">{property.location?.locality || property.location?.city || property.location?.address || 'Verified Locality'}</span>
            </p>
          </div>

          {/* Specs Bar - Compact & Clear */}
          <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 px-2.5 py-1 rounded-lg border border-slate-100 dark:border-slate-700/80 text-[11px]">
            <div className="flex items-center gap-1">
              <span className="text-slate-400 font-medium text-[10px]">Area</span>
              <strong className="text-slate-800 dark:text-slate-200 font-bold">
                {property.area?.value ? `${property.area.value} sq.ft` : 'N/A'}
              </strong>
            </div>
            <span className="text-slate-200 dark:text-slate-700">·</span>
            <div className="flex items-center gap-1">
              <span className="text-slate-400 font-medium text-[10px]">Type</span>
              <strong className="text-slate-800 dark:text-slate-200 font-bold capitalize">
                {property.propertyType || property.category || 'Plot'}
              </strong>
            </div>
            <span className="text-slate-200 dark:text-slate-700">·</span>
            <div className="flex items-center gap-1">
              <span className="text-slate-400 font-medium text-[10px]">For</span>
              <strong className={`font-black uppercase text-[9px] px-1.5 py-0.5 rounded ${
                property.purpose === 'rent'
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                  : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
              }`}>
                {property.purpose === 'rent' ? 'Rent' : 'Sale'}
              </strong>
            </div>
          </div>

          {/* Actions Bar - Compact & Tight */}
          <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 dark:border-slate-800/80">
            {isSold ? (
              <span className="text-[10px] font-black uppercase text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-800/80">
                Closed · Sold
              </span>
            ) : isRented ? (
              <span className="text-[10px] font-black uppercase text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 rounded-lg border border-blue-200 dark:border-blue-800/80">
                Leased · Rented
              </span>
            ) : (
              <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => handleOpenCallModal(property)}
                  className="h-6.5 px-2.5 rounded-lg border border-blue-200 dark:border-blue-500/40 text-blue-700 dark:text-blue-300 bg-blue-50/80 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 flex items-center gap-1 text-[11px] font-bold transition-all shadow-2xs active:scale-95 cursor-pointer"
                  title="Direct Owner Call"
                >
                  <Phone className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                  <span>Call</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenVisitModal(property)}
                  className="h-6.5 px-2.5 rounded-lg border border-indigo-200 dark:border-indigo-500/40 text-indigo-700 dark:text-indigo-300 bg-indigo-50/80 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 flex items-center gap-1 text-[11px] font-bold transition-all shadow-2xs active:scale-95 cursor-pointer"
                  title="Schedule Site Visit"
                >
                  <Calendar className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                  <span>Visit</span>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => handleOpenDetailModal(property)}
              className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 transition-colors inline-flex items-center gap-0.5 cursor-pointer"
            >
              <span>Details</span>
              <span className="text-sm leading-none">→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

