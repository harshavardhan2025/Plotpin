import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  MapPin, CheckCircle2, ShieldCheck, Box, Phone, Calendar,
  CreditCard, ArrowLeft, Heart, Share2, Layers, AlertCircle, FileText
} from 'lucide-react';
import { api } from '../../lib/api';
import { useProperty } from '../../contexts/PropertyContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  formatINR,
  getPropertyLatLng,
  getFirstPropertyImageUrl
} from '../../utils/propertyHelpers';

export default function PropertyDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser, isAdmin, showToast } = useAuth();
  const {
    properties,
    favoriteIds,
    handleToggleFavorite,
    handleOpenCallModal,
    handleOpenVisitModal,
    handleOpenEscrowModal,
    handleOpen3DModal,
    handleOpenDeedModal,
    isMobile
  } = useProperty();

  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // 1. Try finding in loaded properties cache
    const existing = properties.find((p) => (p._id || p.id) === id);
    if (existing) {
      setProperty(existing);
      setLoading(false);
      return;
    }

    // 2. Fetch directly from backend
    setLoading(true);
    api.getPropertyById(id)
      .then((res) => {
        setProperty(res.property || res);
      })
      .catch((err) => {
        console.error('Failed fetching property:', err);
        setError('Property not found or currently under administrative review.');
      })
      .finally(() => setLoading(false));
  }, [id, properties]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto p-6 space-y-4">
        <div className="bg-slate-200 dark:bg-slate-800 h-80 rounded-3xl animate-pulse"></div>
        <div className="bg-slate-200 dark:bg-slate-800 h-8 w-1/2 rounded animate-pulse"></div>
        <div className="bg-slate-200 dark:bg-slate-800 h-4 w-1/3 rounded animate-pulse"></div>
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="max-w-lg mx-auto p-8 my-12 bg-white dark:bg-[#131E31] rounded-3xl border border-slate-200 dark:border-slate-800 text-center space-y-4 shadow-sm">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Property Listing Unavailable</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">{error || 'This property is not currently accessible.'}</p>
        <Link
          to="/explore"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#184631] text-white rounded-xl text-xs font-bold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Explore</span>
        </Link>
      </div>
    );
  }

  const propId = property._id || property.id;
  const isFav = favoriteIds.includes(propId);
  const status = property.availabilityStatus || 'available';
  const isSold = status === 'sold';
  const isRented = status === 'rented';
  const imgUrl = getFirstPropertyImageUrl(property);

  return (
    <div className={`max-w-5xl mx-auto space-y-6 ${isMobile ? 'p-3 pb-24' : 'p-6'}`}>
      {/* Top Breadcrumb */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => handleToggleFavorite(e, propId)}
            className={`w-9 h-9 rounded-full flex items-center justify-center border transition-all ${
              isFav ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 border-rose-200 dark:border-rose-800' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
            }`}
          >
            <Heart className={`w-4 h-4 ${isFav ? 'fill-rose-600' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => {
              if (typeof navigator !== 'undefined' && navigator.clipboard) {
                navigator.clipboard.writeText(window.location.href);
                showToast('Link copied to clipboard!');
              }
            }}
            className="w-9 h-9 rounded-full flex items-center justify-center bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Hero Media Section */}
      <div className="relative rounded-3xl overflow-hidden bg-slate-900 h-80 sm:h-96 shadow-md border border-slate-200">
        {imgUrl ? (
          <img src={imgUrl} alt={property.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400">
            <span>No images provided</span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent pointer-events-none" />

        <div className="absolute top-4 left-4 flex items-center gap-2">
          {isSold ? (
            <span className="bg-rose-600 text-white text-xs font-black px-3.5 py-1 rounded-full shadow-md uppercase tracking-wider flex items-center gap-1">
              <span>🔒 SOLD</span>
            </span>
          ) : isRented ? (
            <span className="bg-blue-600 text-white text-xs font-black px-3.5 py-1 rounded-full shadow-md uppercase tracking-wider flex items-center gap-1">
              <span>🤝 RENTED</span>
            </span>
          ) : (
            <span className="bg-emerald-600 text-white text-xs font-extrabold px-3 py-1 rounded-full shadow">
              {property.purpose === 'rent' ? 'Available for Rent' : 'Available for Sale'}
            </span>
          )}
          <span className="bg-white/90 text-slate-900 text-xs font-bold px-3 py-1 rounded-full shadow">
            0% Brokerage
          </span>
        </div>

        <button
          type="button"
          onClick={() => handleOpen3DModal(property)}
          className="absolute bottom-4 right-4 bg-[#184631] text-white px-4 py-2 rounded-xl text-xs font-extrabold shadow-lg flex items-center gap-2 border border-white/20"
        >
          <Box className="w-4 h-4 text-emerald-300" />
          <span>Launch 3D Elevation Tour</span>
        </button>

        <div className="absolute bottom-4 left-4 text-white">
          <h1 className="text-xl sm:text-2xl font-black drop-shadow-md">{property.title}</h1>
          <p className="text-xs text-slate-200 flex items-center gap-1 drop-shadow mt-1">
            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
            <span>{property.location?.address || property.location?.locality}</span>
          </p>
        </div>
      </div>

      {/* Main Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Specs, Demarcation, Description */}
        <div className="md:col-span-2 space-y-6">
          {/* Key Specs Card */}
          <div className="bg-white dark:bg-[#131E31] p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs grid grid-cols-3 gap-4 text-center">
            <div className="p-2">
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Total Area</span>
              <p className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">
                {property.area?.value ? `${property.area.value} sq.ft` : 'N/A'}
              </p>
            </div>
            <div className="p-2 border-x border-slate-100 dark:border-slate-700">
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Class</span>
              <p className="text-base font-extrabold text-slate-900 dark:text-white capitalize mt-0.5">
                {property.propertyType || property.category}
              </p>
            </div>
            <div className="p-2">
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Transaction</span>
              <p className="text-base font-extrabold text-emerald-700 dark:text-emerald-400 uppercase mt-0.5">
                {property.purpose || 'Sale'}
              </p>
            </div>
          </div>

          {/* Cadastral Boundary & Verification */}
          <div className="bg-emerald-50/60 dark:bg-emerald-950/40 p-5 rounded-2xl border border-emerald-200/80 dark:border-emerald-800/60 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                <h3 className="font-extrabold text-sm text-emerald-950 dark:text-emerald-100">Andhra Pradesh Cadastral Audit</h3>
              </div>
              <button
                type="button"
                onClick={() => handleOpenDeedModal(property)}
                className="text-xs font-bold text-emerald-800 dark:text-emerald-400 hover:text-emerald-950 dark:hover:text-emerald-300 flex items-center gap-1 underline"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Inspect Title Deed</span>
              </button>
            </div>

            <p className="text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed">
              This property has undergone boundary coordinate verification against village survey maps. All four physical boundaries are demarcated with geo-referenced coordinates.
            </p>
          </div>

          {/* Description */}
          <div className="bg-white dark:bg-[#131E31] p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-2">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">Description</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {property.description || 'No extended description provided by the owner.'}
            </p>
          </div>
        </div>

        {/* Right Column: Price & Direct Actions */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-[#131E31] p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4 sticky top-24">
            <div>
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500">Asking Price</span>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">
                {formatINR(property.price)}
              </div>
              <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-extrabold">
                0% Brokerage · Direct Deal
              </span>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-700">
              {isAdmin ? (
                <div className="space-y-2.5">
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 font-semibold flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
                    <span>Administrative Registry View (Admin Desk)</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenDeedModal(property)}
                    className="w-full py-2.5 rounded-xl bg-[#184631] hover:bg-[#123625] text-white text-xs font-extrabold shadow flex items-center justify-center gap-2 transition-all"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Inspect Cadastral Title Deed</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate('/admin/properties')}
                    className="w-full py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-2 transition-all border border-slate-200 dark:border-slate-700 cursor-pointer"
                  >
                    <span>Manage Status in Admin Inventory</span>
                  </button>
                </div>
              ) : isSold ? (
                <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-800 text-center space-y-1">
                  <div className="text-xs font-black text-rose-700 dark:text-rose-300 uppercase tracking-wider flex items-center justify-center gap-1.5">
                    <span>🔒 Property Sold</span>
                  </div>
                  <p className="text-[11px] text-rose-600 dark:text-rose-400">
                    This property has been officially sold and title deed transferred. No longer open for visits or public offers.
                  </p>
                </div>
              ) : isRented ? (
                <div className="p-3.5 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-800 text-center space-y-1">
                  <div className="text-xs font-black text-blue-700 dark:text-blue-300 uppercase tracking-wider flex items-center justify-center gap-1.5">
                    <span>🤝 Property Rented</span>
                  </div>
                  <p className="text-[11px] text-blue-600 dark:text-blue-400">
                    This property is currently leased out under an active tenancy contract.
                  </p>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => handleOpenCallModal(property)}
                    className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold shadow flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Phone className="w-4 h-4" />
                    <span>Direct Mediation Call</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenVisitModal(property)}
                    className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold shadow flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Calendar className="w-4 h-4" />
                    <span>Schedule Surveyor Escort</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenEscrowModal(property)}
                    className="w-full py-2.5 rounded-xl bg-[#184631] hover:bg-[#123625] text-white text-xs font-extrabold shadow flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Lock Price with Legal Escrow</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

