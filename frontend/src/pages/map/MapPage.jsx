import React, { useState, useMemo } from 'react';
import { Box, MapPin, Layers } from 'lucide-react';
import { useProperty } from '../../contexts/PropertyContext';
import PropertyMap from '../../components/maps/PropertyMap';
const SpatialPropertyMap3D = React.lazy(() => import('../../components/3d/SpatialPropertyMap3D'));

export default function MapPage() {
  const {
    properties,
    isOwnerOfProperty,
    userLocation,
    radiusKm,
    isMobile,
    purposeFilter,
    setPurposeFilter,
    selectedProperty,
    setSelectedProperty,
    setShowDetailModal,
    setShowLocationPicker,
    handleOpen3DModal
  } = useProperty();

  const [mapMode3D, setMapMode3D] = useState(false);

  // Exclude owner's own listed properties from discovery map
  const discoveryProperties = useMemo(() => {
    return properties.filter(p => {
      if (typeof isOwnerOfProperty === 'function' && isOwnerOfProperty(p)) return false;
      return true;
    });
  }, [properties, isOwnerOfProperty]);

  // Purpose-filtered count for top badge
  const activeCount = discoveryProperties.filter(p => {
    if (!purposeFilter || purposeFilter === 'all') return true;
    const pPurp = (p.purpose || 'sale').toLowerCase();
    if (purposeFilter === 'sale' || purposeFilter === 'buy') return pPurp === 'sale' || pPurp === 'buy';
    if (purposeFilter === 'rent') return pPurp === 'rent';
    return true;
  }).length;

  return (
    <div className={`space-y-4 max-w-7xl mx-auto ${isMobile ? 'p-2 pb-24' : 'p-6'}`}>
      {/* Top Header Bar - Clean Single-Row Responsive Layout */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-700 shrink-0" />
          <h2 className="font-extrabold text-sm sm:text-base md:text-lg text-slate-900 dark:text-white truncate whitespace-nowrap">
            <span className="sm:hidden">{mapMode3D ? '3D View' : 'Property Map'}</span>
            <span className="hidden sm:inline">{mapMode3D ? '3D Spatial Elevation Grid' : 'Cadastral Geospatial Map'}</span>
          </h2>
          <span className="text-[11px] sm:text-xs bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 px-2 sm:px-2.5 py-0.5 rounded-full font-bold border border-emerald-200 dark:border-emerald-700/60 shrink-0 whitespace-nowrap">
            {activeCount} <span className="hidden sm:inline">{purposeFilter === 'rent' ? 'Rentals' : 'Listings'}</span>
          </span>
        </div>

        {/* 2D vs 3D Spatial Segmented Control */}
        <div className="flex items-center p-0.5 sm:p-1 bg-slate-100 dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0 shadow-2xs">
          <button
            type="button"
            onClick={() => setMapMode3D(false)}
            className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              !mapMode3D 
                ? 'bg-[#184631] text-white shadow-xs font-black dark:bg-emerald-600' 
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>2D</span>
            <span className="hidden sm:inline ml-1">Map</span>
          </button>
          <button
            type="button"
            onClick={() => setMapMode3D(true)}
            className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 whitespace-nowrap ${
              mapMode3D 
                ? 'bg-[#184631] text-white shadow-xs font-black dark:bg-emerald-600' 
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            <span>3D</span>
            <span className="hidden sm:inline ml-0.5">Spatial</span>
          </button>
        </div>
      </div>

      <div className={`bg-white dark:bg-[#131E31] rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden ${isMobile ? 'min-h-[560px]' : 'min-h-[620px]'}`}>
        {mapMode3D ? (
          <React.Suspense fallback={
            <div className="h-[620px] bg-slate-950 flex flex-col items-center justify-center gap-3 text-emerald-400">
              <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs font-bold uppercase tracking-wider">Initializing 3D Spatial Map...</span>
            </div>
          }>
            <SpatialPropertyMap3D
              properties={discoveryProperties}
              userLocation={userLocation}
              maxRadiusKm={100}
              onSelectProperty={(p) => {
                setSelectedProperty(p);
                setShowDetailModal(true);
              }}
              onLaunch3DTour={handleOpen3DModal}
              isMobile={isMobile}
            />
          </React.Suspense>
        ) : (
          <PropertyMap
            properties={discoveryProperties}
            userLocation={userLocation}
            maxRadiusKm={radiusKm || 50}
            searchPurpose={purposeFilter === 'rent' ? 'rent' : 'sale'}
            setSearchPurpose={setPurposeFilter}
            onOpenLocationPicker={() => setShowLocationPicker(true)}
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
    </div>
  );
}

