import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Compass } from 'lucide-react';
import { useProperty } from '../../contexts/PropertyContext';
import PropertyCard from '../../components/property/PropertyCard';

export default function SavedPropertiesPage() {
  const { properties, favoriteIds, isMobile } = useProperty();

  const savedList = useMemo(() => {
    return properties.filter((p) => favoriteIds.includes(p._id || p.id));
  }, [properties, favoriteIds]);

  return (
    <div className={`space-y-6 max-w-7xl mx-auto ${isMobile ? 'p-3 pb-24' : 'p-6'}`}>
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center border border-rose-200 dark:border-rose-800 shadow-2xs">
            <Heart className="w-4 h-4 fill-rose-600" />
          </div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight">
            Saved Properties {savedList.length > 0 && `(${savedList.length})`}
          </h2>
        </div>

        {savedList.length > 0 && (
          <Link
            to="/explore"
            className="px-3.5 py-1.5 bg-[#184631] hover:bg-[#123625] text-white rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-all"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Explore More</span>
          </Link>
        )}
      </div>

      {savedList.length === 0 ? (
        <div className="bg-white dark:bg-[#131E31] p-10 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-3 shadow-2xs">
          <Heart className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
          <h4 className="font-bold text-base text-slate-900 dark:text-white">No saved properties</h4>
          <div>
            <Link
              to="/explore"
              className="px-4 py-2 bg-[#184631] hover:bg-[#123625] text-white rounded-xl text-xs font-bold shadow-2xs transition-all inline-flex items-center gap-1.5 mt-1"
            >
              <span>Explore Properties</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {savedList.map((prop) => (
            <PropertyCard key={prop._id || prop.id} property={prop} />
          ))}
        </div>
      )}
    </div>
  );
}
