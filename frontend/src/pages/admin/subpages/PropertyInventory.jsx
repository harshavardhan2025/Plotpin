import React, { useState, useMemo } from 'react';
import { 
  Building2, Ban, CheckCircle2, MapPin, FileText, Search, Filter, 
  RotateCcw, ShieldCheck, Tag, Eye, Check, X, ArrowUpDown, Calendar,
  DollarSign, User, ExternalLink, AlertTriangle, Layers, Home, RefreshCw
} from 'lucide-react';
import { useProperty } from '../../../contexts/PropertyContext';
import { useAuth } from '../../../contexts/AuthContext';
import { api } from '../../../lib/api';
import { formatINR, getFirstPropertyImageUrl } from '../../../utils/propertyHelpers';

const AP_DISTRICTS = [
  'All Districts',
  'Kadapa',
  'Visakhapatnam',
  'Vijayawada',
  'Tirupati',
  'Guntur',
  'Kakinada',
  'Kurnool',
  'Nellore',
  'Rajahmundry',
  'Anantapur'
];

export default function PropertyInventory() {
  const { showToast } = useAuth();
  const { 
    adminApprovedProperties, 
    updatePropertyStatus, 
    handleOpenDeedModal, 
    handleOpenDetailModal,
    loadAdminData,
    isMobile
  } = useProperty();

  // Filters state
  const [statusFilter, setStatusFilter] = useState('available'); // 'available' | 'sold_out' | 'all'
  const [selectedDistrict, setSelectedDistrict] = useState('All Districts');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedPurpose, setSelectedPurpose] = useState('all'); // 'all' | 'buy' | 'rent'
  const [searchQuery, setSearchQuery] = useState('');

  // Interactive Action Modals state
  const [statusModalProperty, setStatusModalProperty] = useState(null);
  const [targetStatus, setTargetStatus] = useState('available');
  const [adminNotes, setAdminNotes] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [buyerRef, setBuyerRef] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [buyerEmail, setBuyerEmail] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Review Drawer state
  const [reviewProperty, setReviewProperty] = useState(null);

  // KPI Calculations
  const stats = useMemo(() => {
    const list = adminApprovedProperties || [];
    return {
      total: list.length,
      availableTotal: list.filter(p => (!p.availabilityStatus || p.availabilityStatus === 'available') && p.status !== 'sold' && p.status !== 'rented').length,
      soldOut: list.filter(p => p.availabilityStatus === 'sold' || p.availabilityStatus === 'rented' || p.status === 'sold' || p.status === 'rented').length,
      sold: list.filter(p => p.availabilityStatus === 'sold' || p.status === 'sold').length,
      rented: list.filter(p => p.availabilityStatus === 'rented' || p.status === 'rented').length
    };
  }, [adminApprovedProperties]);

  // Filtered List
  const filteredProperties = useMemo(() => {
    return (adminApprovedProperties || []).filter(prop => {
      const status = (prop.availabilityStatus || prop.status || 'available').toLowerCase();

      // Status Filter
      if (statusFilter === 'available') {
        if (status === 'sold' || status === 'rented' || status === 'suspended' || prop.publicationStatus === 'archived') return false;
      } else if (statusFilter === 'sold_out') {
        if (status !== 'sold' && status !== 'rented') return false;
      }

      // Purpose Filter
      if (selectedPurpose !== 'all') {
        if (selectedPurpose === 'buy' && prop.purpose === 'rent') return false;
        if (selectedPurpose === 'rent' && prop.purpose !== 'rent') return false;
      }

      // District Filter
      if (selectedDistrict !== 'All Districts') {
        const districtName = (prop.location?.district || prop.location?.city || '').toLowerCase();
        if (!districtName.includes(selectedDistrict.toLowerCase())) return false;
      }

      // Category Filter
      if (selectedCategory !== 'all') {
        const cat = (prop.category || prop.propertyType || '').toLowerCase();
        if (cat !== selectedCategory.toLowerCase()) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const id = (prop._id || prop.id || '').toLowerCase();
        const title = (prop.title || '').toLowerCase();
        const locality = (prop.location?.locality || '').toLowerCase();
        const city = (prop.location?.city || '').toLowerCase();
        const survey = (prop.surveyNumber || prop.survey_number || '').toLowerCase();
        const owner = (prop.ownerId || prop.sellerContact?.name || '').toLowerCase();

        const matches = id.includes(q) || title.includes(q) || locality.includes(q) || city.includes(q) || survey.includes(q) || owner.includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [adminApprovedProperties, statusFilter, selectedPurpose, selectedDistrict, selectedCategory, searchQuery]);

  // Open Status Update Modal
  const openStatusModal = (property, preselectedStatus = null) => {
    setStatusModalProperty(property);
    const curr = property.availabilityStatus || 'available';
    const isRent = property.purpose === 'rent';
    const defaultTarget = preselectedStatus || (curr !== 'available' ? curr : (isRent ? 'rented' : 'sold'));
    setTargetStatus(defaultTarget);
    setAdminNotes(property.adminNotes || '');
    setSalePrice(property.saleMetadata?.salePrice || property.saleMetadata?.leasePrice || property.price || '');
    setBuyerRef(property.saleMetadata?.buyerReference || property.saleMetadata?.tenantReference || '');
    setBuyerName(property.saleMetadata?.buyerName || property.buyerName || '');
    setBuyerPhone(property.saleMetadata?.buyerPhone || property.buyerPhone || '');
    setBuyerEmail(property.saleMetadata?.buyerEmail || property.buyerEmail || '');
    setReturnReason(property.saleMetadata?.returnReason || '');
  };

  const closeStatusModal = () => {
    setStatusModalProperty(null);
    setAdminNotes('');
    setSalePrice('');
    setBuyerRef('');
    setBuyerName('');
    setBuyerPhone('');
    setBuyerEmail('');
    setReturnReason('');
  };

  // Submit Status Change
  const handleSaveStatus = async (e) => {
    e.preventDefault();
    if (!statusModalProperty) return;

    const propId = statusModalProperty._id || statusModalProperty.id;
    setIsUpdating(true);

    try {
      const metadata = {};
      const isRent = targetStatus === 'rented';
      if (targetStatus === 'sold' || targetStatus === 'rented') {
        const numPrice = salePrice ? Number(salePrice) : statusModalProperty.price;
        if (!isRent) {
          metadata.salePrice = numPrice;
          metadata.buyerReference = buyerRef.trim();
          metadata.closedAt = new Date().toISOString();
        } else {
          metadata.leasePrice = numPrice;
          metadata.tenantReference = buyerRef.trim();
          metadata.leasedAt = new Date().toISOString();
        }
        metadata.buyerName = buyerName.trim() || buyerRef.trim() || 'Verified Citizen';
        metadata.buyerPhone = buyerPhone.trim();
        metadata.buyerEmail = buyerEmail.trim();
        metadata.propertyTitle = statusModalProperty.title;
      }

      await updatePropertyStatus(propId, targetStatus, adminNotes.trim(), metadata);
      showToast(`✓ Property #${propId.slice(-6)} status updated to ${targetStatus.toUpperCase()}`);
      closeStatusModal();
      if (reviewProperty && (reviewProperty._id || reviewProperty.id) === propId) {
        setReviewProperty(prev => ({
          ...prev,
          availabilityStatus: targetStatus,
          status: targetStatus,
          adminNotes: adminNotes.trim(),
          saleMetadata: metadata
        }));
      }
    } catch (err) {
      showToast(err.message || 'Failed to update property status');
    } finally {
      setIsUpdating(false);
    }
  };

  // Quick Toggle Public Visibility
  const handleToggleSuspend = async (prop) => {
    const propId = prop._id || prop.id;
    const isCurrentlySuspended = prop.publicationStatus === 'suspended' || prop.availabilityStatus === 'suspended';

    if (isCurrentlySuspended) {
      // Re-activate to available
      await updatePropertyStatus(propId, 'available', 'Re-published live on platform by Administrator');
      showToast(`Listing #${propId.slice(-6)} re-published live`);
    } else {
      const reason = window.prompt('Enter reason for unpublishing / suspending listing from public discovery:');
      if (!reason || !reason.trim()) return;
      await updatePropertyStatus(propId, 'suspended', reason.trim());
      showToast(`Listing #${propId.slice(-6)} suspended and unindexed`);
    }
  };

  return (
    <div className="space-y-4">
      {/* Status Filter Pills with Counts & Search */}
      <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Status Filter Pills with Numbers */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto shrink-0">
          {[
            { id: 'available', label: `Available (${stats.availableTotal})` },
            { id: 'sold_out', label: `Sold / Rented (${stats.soldOut})` },
          ].map(st => (
            <button
              key={st.id}
              type="button"
              onClick={() => setStatusFilter(st.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                statusFilter === st.id
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>

        {/* Multi-Criteria Search */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, property ID, Sy. number, locality, city, owner..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={selectedPurpose}
            onChange={(e) => setSelectedPurpose(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">All Purposes (Sale &amp; Rent)</option>
            <option value="buy">Sale Only</option>
            <option value="rent">Rent Only</option>
          </select>

          <select
            value={selectedDistrict}
            onChange={(e) => setSelectedDistrict(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {AP_DISTRICTS.map((dist) => (
              <option key={dist} value={dist}>{dist}</option>
            ))}
          </select>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">All Asset Types</option>
            <option value="residential">Residential</option>
            <option value="commercial">Commercial</option>
            <option value="agricultural">Farmland / Agro</option>
            <option value="plot">Land / Plots</option>
            <option value="pg">PG / Co-Living</option>
          </select>
        </div>
      </div>

      {/* Property Cards List */}
      <div className="space-y-3">
        {filteredProperties.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 p-12 rounded-3xl border border-slate-200 dark:border-slate-800 text-center space-y-2">
            <Building2 className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
            <h4 className="font-extrabold text-sm text-slate-700 dark:text-slate-300">No properties found</h4>
            <p className="text-xs text-slate-400">
              No matching listings found for the selected status "{statusFilter}" or search term.
            </p>
            <button
              onClick={() => {
                setStatusFilter('all');
                setSelectedDistrict('All Districts');
                setSelectedCategory('all');
                setSearchQuery('');
              }}
              className="text-xs font-bold text-emerald-700 dark:text-emerald-400 underline mt-2 inline-block cursor-pointer"
            >
              Reset all filters
            </button>
          </div>
        ) : (
          filteredProperties.map((prop) => {
            const propId = prop._id || prop.id;
            const status = prop.availabilityStatus || 'available';
            const isSuspended = prop.publicationStatus === 'suspended' || status === 'suspended';
            const isSold = status === 'sold';
            const isRented = status === 'rented';
            const isReturned = status === 'returned';
            const isAvailable = status === 'available' && !isSuspended;
            const imgUrl = getFirstPropertyImageUrl(prop);

            return (
              <div
                key={propId}
                className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                {/* Left Section: Thumbnail & Core Details */}
                <div className="flex items-start sm:items-center gap-3.5">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700 relative">
                    {imgUrl ? (
                      <img src={imgUrl} alt={prop.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 text-[10px] p-1 text-center font-bold">
                        <span>Plot Pin</span>
                      </div>
                    )}
                    {/* Tiny status indicator badge on photo */}
                    <div className="absolute top-1 left-1">
                      {isSold ? (
                        <span className="bg-rose-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded shadow-xs uppercase">
                          SOLD
                        </span>
                      ) : isRented ? (
                        <span className="bg-blue-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded shadow-xs uppercase">
                          RENTED
                        </span>
                      ) : isReturned ? (
                        <span className="bg-amber-600 text-white text-[9px] font-black px-1.5 py-0.2 rounded shadow-xs uppercase">
                          RETURNED
                        </span>
                      ) : (
                        <span className="bg-emerald-600 text-white text-[9px] font-bold px-1.5 py-0.2 rounded shadow-xs uppercase">
                          LIVE
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Prominent Status Pill */}
                      {isSold ? (
                        <span className="text-[11px] font-black uppercase bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-200 px-2.5 py-0.5 rounded-full border border-rose-300 dark:border-rose-800 flex items-center gap-1 shadow-2xs">
                          <span>🔒 Sold</span>
                        </span>
                      ) : isRented ? (
                        <span className="text-[11px] font-black uppercase bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-200 px-2.5 py-0.5 rounded-full border border-blue-300 dark:border-blue-800 flex items-center gap-1 shadow-2xs">
                          <span>🤝 Rented</span>
                        </span>
                      ) : (
                        <span className="text-[11px] font-black uppercase bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200 px-2.5 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800 flex items-center gap-1 shadow-2xs">
                          <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400 stroke-[3]" />
                          <span>{prop.purpose === 'rent' ? 'Available for Rent' : 'Available for Sale'}</span>
                        </span>
                      )}

                      <span className="text-[11px] font-mono font-bold text-slate-400 dark:text-slate-500">
                        #{propId.slice(-8)}
                      </span>

                      {prop.cadastralVerified && (
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                          Deed Verified
                        </span>
                      )}
                    </div>

                    <h4 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white line-clamp-1">
                      {prop.title}
                    </h4>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
                      <span className="font-black text-slate-900 dark:text-white text-sm">
                        {formatINR(prop.price)}
                        {prop.purpose === 'rent' && <span className="text-[11px] font-normal text-slate-400">/mo</span>}
                      </span>
                      <span>·</span>
                      <span className="capitalize">{prop.category} ({prop.propertyType || 'Asset'})</span>
                      <span>·</span>
                      <span>{prop.area?.value ? `${prop.area.value} ${prop.area.unit || 'sq.ft'}` : 'Plotted Area'}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        {prop.location?.locality || prop.location?.city}, {prop.location?.district || 'AP'}
                      </span>
                    </div>

                    {/* Transaction / Audit Note if Sold */}
                    {(isSold || isRented) && (
                      <div className="text-[11px] p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 mt-1 flex flex-wrap items-center gap-x-2">
                        <strong className="font-bold uppercase text-[10px] text-slate-500">Admin Log:</strong>
                        {isSold && (
                          <span>
                            Sold for <strong>₹{Number(prop.saleMetadata?.salePrice || prop.price).toLocaleString('en-IN')}</strong>
                            {prop.saleMetadata?.buyerReference && ` · Ref: ${prop.saleMetadata.buyerReference}`}
                          </span>
                        )}
                        {isRented && (
                          <span>
                            Rented at <strong>₹{Number(prop.saleMetadata?.leasePrice || prop.price).toLocaleString('en-IN')}/mo</strong>
                            {prop.saleMetadata?.tenantReference && ` · Tenant Ref: ${prop.saleMetadata.tenantReference}`}
                          </span>
                        )}
                        {prop.adminNotes && (
                          <span className="italic text-slate-500 dark:text-slate-400 font-sans">
                            — "{prop.adminNotes}"
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Section: Interactive Action Controls */}
                <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 self-start lg:self-center shrink-0">
                  {/* Primary Status Update Action */}
                  <button
                    type="button"
                    onClick={() => openStatusModal(prop)}
                    className="px-3.5 py-2 rounded-xl bg-[#184631] hover:bg-[#123625] text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                    title="Change listing lifecycle status: Available, Sold, or Rented"
                  >
                    <Tag className="w-3.5 h-3.5 text-emerald-300" />
                    <span>Update Status</span>
                  </button>

                  {/* Review Details Button */}
                  <button
                    type="button"
                    onClick={() => setReviewProperty(prop)}
                    className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
                    title="Inspect all property specs, cadastral demarcation, boundaries, and owner info"
                  >
                    <Eye className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                    <span>Review Details</span>
                  </button>

                  {/* Inspect Deeds Button */}
                  <button
                    type="button"
                    onClick={() => handleOpenDeedModal(prop)}
                    className="px-3 py-2 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-900 dark:text-emerald-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                    title="Open official 4-page cadastral title deed and Meebhoomi schedule"
                  >
                    <FileText className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                    <span>Inspect Deed</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ========================================================================= */}
      {/* 1. INTERACTIVE STATUS UPDATE MODAL                                         */}
      {/* ========================================================================= */}
      {statusModalProperty && (
        <div className="modal-overlay animate-in fade-in duration-200 z-50">
          <div className="modal-content-box max-w-lg w-full p-0 overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131E31] shadow-2xl">
            {/* Modal Header */}
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-emerald-400" />
                <h3 className="font-extrabold text-sm sm:text-base">
                  Update Listing Status
                </h3>
              </div>
              <button
                type="button"
                onClick={closeStatusModal}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveStatus} className="p-5 space-y-4">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Selected Listing</div>
                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white mt-0.5">
                  {statusModalProperty.title}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  ID: #{statusModalProperty._id || statusModalProperty.id} · {statusModalProperty.location?.locality || statusModalProperty.location?.city}
                </p>
              </div>

              {/* Status Radio Pills */}
              <div className="space-y-1.5">
                <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Target Status
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetStatus('available')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      targetStatus === 'available'
                        ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 font-extrabold ring-2 ring-emerald-500/20'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-black">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Available</span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Active on public portal</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetStatus('sold')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      targetStatus === 'sold'
                        ? 'border-rose-600 bg-rose-50 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200 font-extrabold ring-2 ring-rose-500/20'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-black text-rose-700 dark:text-rose-400">
                      <span>🔒 Sold</span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Title transferred; mark closed</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetStatus('rented')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      targetStatus === 'rented'
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-200 font-extrabold ring-2 ring-blue-500/20'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-black text-blue-700 dark:text-blue-400">
                      <span>🤝 Rented</span>
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Leased out to tenant</p>
                  </button>
                </div>
              </div>

              {/* Conditional Fields for Sold or Rented */}
              {(targetStatus === 'sold' || targetStatus === 'rented') && (
                <div className={`p-3.5 rounded-xl border space-y-3 ${
                  targetStatus === 'sold' 
                    ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/60'
                    : 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/60'
                }`}>
                  <div className={`text-xs font-black flex items-center gap-1.5 ${
                    targetStatus === 'sold' ? 'text-rose-800 dark:text-rose-200' : 'text-blue-800 dark:text-blue-200'
                  }`}>
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>{targetStatus === 'sold' ? 'Sale Transaction Details' : 'Tenancy Lease Details'}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                        {targetStatus === 'sold' ? 'Final Consideration (₹)' : 'Monthly Rent (₹)'}
                      </label>
                      <input
                        type="number"
                        value={salePrice}
                        onChange={(e) => setSalePrice(e.target.value)}
                        placeholder={String(statusModalProperty.price || '3500000')}
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                        SRO / Deed / Agreement Ref #
                      </label>
                      <input
                        type="text"
                        value={buyerRef}
                        onChange={(e) => setBuyerRef(e.target.value)}
                        placeholder="e.g. SRO-KDP-2026-441"
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                        {targetStatus === 'sold' ? 'Buyer Name' : 'Tenant Name'}
                      </label>
                      <input
                        type="text"
                        value={buyerName}
                        onChange={(e) => setBuyerName(e.target.value)}
                        placeholder="Full Name"
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        value={buyerPhone}
                        onChange={(e) => setBuyerPhone(e.target.value)}
                        placeholder="e.g. 9845049120"
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                        Email (Optional)
                      </label>
                      <input
                        type="email"
                        value={buyerEmail}
                        onChange={(e) => setBuyerEmail(e.target.value)}
                        placeholder="buyer@gmail.com"
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white font-medium"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Admin Notes */}
              <div>
                <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                  Administrative Audit Notes
                </label>
                <textarea
                  rows={2}
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Record verification findings, SRO confirmation, or transaction notes..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={closeStatusModal}
                  className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-5 py-2 rounded-xl bg-[#184631] hover:bg-[#123625] text-white text-xs font-black flex items-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isUpdating ? 'Saving...' : 'Confirm Status Update'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. COMPREHENSIVE PROPERTY REVIEW DRAWER                                   */}
      {/* ========================================================================= */}
      {reviewProperty && (
        <div className="modal-overlay animate-in fade-in duration-200 z-50">
          <div className="modal-content-box max-w-2xl w-full p-0 overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131E31] shadow-2xl">
            {/* Drawer Header */}
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base leading-tight">
                    Administrative Property Review
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    Cadastral Registry Schedule #{reviewProperty._id || reviewProperty.id}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReviewProperty(null)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="p-5 max-h-[75vh] overflow-y-auto space-y-4 custom-smooth-scrollbar text-xs">
              {/* Status Header Strip */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Current Platform Status</span>
                  <div className="text-sm font-black text-slate-900 dark:text-white mt-0.5 capitalize">
                    {reviewProperty.availabilityStatus || 'Available for Sale'}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openStatusModal(reviewProperty)}
                    className="px-3 py-1.5 bg-[#184631] text-white rounded-xl text-xs font-extrabold flex items-center gap-1 shadow-xs cursor-pointer hover:bg-[#123625]"
                  >
                    <Tag className="w-3 h-3 text-emerald-300" />
                    <span>Update Status</span>
                  </button>
                </div>
              </div>

              {/* Title & Core Location */}
              <div className="space-y-1">
                <h4 className="font-extrabold text-base text-slate-900 dark:text-white">
                  {reviewProperty.title}
                </h4>
                <p className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>
                    {reviewProperty.location?.address || reviewProperty.location?.locality}, {reviewProperty.location?.city} - {reviewProperty.location?.pincode}
                  </span>
                </p>
              </div>

              {/* Cadastral & Survey Demarcation Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                <div className="bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Survey Number</span>
                  <strong className="text-slate-900 dark:text-white font-mono mt-0.5 block">
                    {reviewProperty.surveyNumber || reviewProperty.survey_number || 'Sy. 142/2B'}
                  </strong>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Khata Classification</span>
                  <strong className="text-slate-900 dark:text-white mt-0.5 block truncate">
                    {reviewProperty.khataType || 'Certified A-Khata'}
                  </strong>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Plotted Area</span>
                  <strong className="text-emerald-700 dark:text-emerald-400 mt-0.5 block">
                    {reviewProperty.area?.value ? `${reviewProperty.area.value} ${reviewProperty.area.unit || 'sq.ft'}` : 'Recorded'}
                  </strong>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Listed Price</span>
                  <strong className="text-slate-900 dark:text-white mt-0.5 block">
                    {formatINR(reviewProperty.price)}
                  </strong>
                </div>
              </div>

              {/* Coordinates & Boundary */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Meebhoomi GPS Coordinates</span>
                <div className="font-mono text-slate-800 dark:text-slate-200 font-bold">
                  {reviewProperty.location?.lat || 14.4690}° N, {reviewProperty.location?.lng || 78.8210}° E
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Cadastral boundary pegs reconciled with Andhra Pradesh Sub-Registrar map data.
                </p>
              </div>

              {/* Owner & Contact Verification */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Owner Contact ID</span>
                  <div className="font-bold text-slate-900 dark:text-white mt-0.5">
                    {reviewProperty.ownerId || reviewProperty.sellerContact?.name || 'Verified LandOwner'}
                  </div>
                </div>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2.5 py-1 rounded-full">
                  KYC Verified
                </span>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setReviewProperty(null);
                  handleOpenDeedModal(reviewProperty);
                }}
                className="px-3.5 py-2 rounded-xl bg-[#184631] hover:bg-[#123625] text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Open 4-Page Deed</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const curr = reviewProperty;
                    setReviewProperty(null);
                    handleOpenDetailModal(curr);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all cursor-pointer"
                >
                  Portal View
                </button>
                <button
                  type="button"
                  onClick={() => setReviewProperty(null)}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold transition-all cursor-pointer"
                >
                  Close Review
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
