import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2, Plus, Clock, AlertTriangle, CheckCircle2,
  FileText, CreditCard, ChevronRight, Edit3, CheckSquare,
  X, Save, ShieldAlert, MapPin, Tag
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useProperty } from '../../contexts/PropertyContext';
import { formatINR } from '../../utils/propertyHelpers';
import { api } from '../../lib/api';

const AP_DISTRICTS = [
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

export default function MyListingsPage() {
  const { currentUser, requireAuth, showToast } = useAuth();
  const {
    myProperties,
    myBuyings,
    isMobile,
    handleOpenCreateModal,
    handleOpenDeedModal,
    submitPropertyEditForVerification,
    loadUserData
  } = useProperty();

  const [completingDealId, setCompletingDealId] = useState(null);

  // Edit Modal State
  const [editingProperty, setEditingProperty] = useState(null);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [editFormData, setEditFormData] = useState({
    title: '',
    price: '',
    purpose: 'sale',
    category: 'residential',
    propertyType: 'Villa',
    areaValue: '',
    areaUnit: 'sq.ft',
    description: '',
    locality: '',
    district: 'Kadapa',
    editReason: ''
  });

  const handleOpenEditModal = (prop) => {
    const isSoldOrRented = 
      prop.availabilityStatus === 'sold' || 
      prop.availabilityStatus === 'rented' || 
      prop.status === 'sold' || 
      prop.status === 'rented' ||
      prop.publicationStatus === 'completed' ||
      prop.publicationStatus === 'archived';

    if (isSoldOrRented) {
      showToast('🔒 This listing is closed (Sold / Rented). Completed transactions are legally locked and cannot be edited.');
      return;
    }

    setEditingProperty(prop);
    setEditFormData({
      title: prop.title || '',
      price: prop.price || '',
      purpose: prop.purpose || 'sale',
      category: prop.category || 'residential',
      propertyType: prop.propertyType || 'Villa',
      areaValue: prop.area?.value || (typeof prop.area === 'number' ? prop.area : '') || '',
      areaUnit: prop.area?.unit || 'sq.ft',
      description: prop.description || '',
      locality: prop.location?.address || prop.location?.locality || prop.city || '',
      district: prop.location?.district || prop.district || 'Kadapa',
      editReason: ''
    });
  };

  const handleCloseEditModal = () => {
    setEditingProperty(null);
    setIsSubmittingEdit(false);
  };

  const handleSubmitEdit = async (e) => {
    e.preventDefault();
    if (!editingProperty) return;

    const propId = editingProperty._id || editingProperty.id;
    setIsSubmittingEdit(true);

    try {
      const updatedPayload = {
        title: editFormData.title.trim(),
        price: Number(editFormData.price) || 0,
        purpose: editFormData.purpose,
        category: editFormData.category,
        propertyType: editFormData.propertyType,
        area: {
          value: Number(editFormData.areaValue) || editFormData.areaValue,
          unit: editFormData.areaUnit
        },
        description: editFormData.description.trim(),
        location: {
          ...(editingProperty.location || {}),
          address: editFormData.locality.trim(),
          locality: editFormData.locality.trim(),
          district: editFormData.district,
          city: editFormData.district
        },
        city: editFormData.district,
        district: editFormData.district,
        editReason: editFormData.editReason.trim() || 'Owner revised property specifications'
      };

      if (typeof submitPropertyEditForVerification === 'function') {
        await submitPropertyEditForVerification(propId, updatedPayload);
      }

      showToast('✓ Changes submitted for Super Admin verification! Listing is temporarily unlisted until approved.');
      handleCloseEditModal();
    } catch (err) {
      showToast(err.message || 'Failed to submit property revisions');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleCompleteDeal = async (propId, purpose = 'sale') => {
    if (!requireAuth()) return;
    const isRent = purpose === 'rent';
    const actionLabel = isRent ? 'Rented' : 'Sold';
    const confirm = window.confirm(`Are you sure you want to mark this deal as ${actionLabel.toUpperCase()}? This will record the closure and update public status.`);
    if (!confirm) return;

    setCompletingDealId(propId);
    try {
      const outcome = isRent ? 'rented' : 'sold';
      await api.completeDeal(propId, {
        outcome,
        dealType: outcome,
        closureNotes: `Deal closed directly by seller through PlotPin portal (${outcome})`
      });
      showToast(`🎉 Listing marked as completed / ${outcome}!`);
      await loadUserData();
    } catch (err) {
      showToast(err.message || 'Failed to update deal status');
    } finally {
      setCompletingDealId(null);
    }
  };

  return (
    <div className={`space-y-6 max-w-7xl mx-auto ${isMobile ? 'p-3 pb-24' : 'p-6'}`}>
      {/* Portfolio Sub-Nav Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Link
            to="/portfolio/my-listings"
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#E3F7EB] dark:bg-emerald-950/60 text-[#0A563C] dark:text-emerald-300 border border-[#0A563C]/30 dark:border-emerald-700/60 shadow-2xs flex items-center gap-2"
          >
            <Building2 className="w-4 h-4 text-[#0A563C] dark:text-emerald-400" />
            <span>My Listings ({myProperties.length})</span>
          </Link>
          <Link
            to="/portfolio/my-buyings"
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200/80 dark:border-slate-700 flex items-center gap-2 transition-colors"
          >
            <CreditCard className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span>Purchased Deeds ({myBuyings.length})</span>
          </Link>
        </div>

        <button
          type="button"
          onClick={handleOpenCreateModal}
          className="px-3.5 py-1.5 bg-[#184631] hover:bg-[#123625] text-white rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-all self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Post Property</span>
        </button>
      </div>

      {/* Listings List */}
      <div className="space-y-4">
        {myProperties.length === 0 ? (
          <div className="bg-white dark:bg-[#131E31] p-8 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-3 shadow-2xs">
            <Building2 className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
            <h4 className="font-bold text-base text-slate-900 dark:text-white">No properties listed yet</h4>
            <div>
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="px-4 py-2 bg-[#184631] hover:bg-[#123625] text-white rounded-xl text-xs font-bold shadow-2xs transition-all inline-flex items-center gap-1.5 cursor-pointer mt-1"
              >
                <Plus className="w-4 h-4" />
                <span>List Property</span>
              </button>
            </div>
          </div>
        ) : (
          myProperties.map((prop) => {
            const propId = prop._id || prop.id;
            const isRent = prop.purpose === 'rent';
            const isSold = prop.availabilityStatus === 'sold' || prop.status === 'sold' || prop.availability_status === 'sold';
            const isRented = prop.availabilityStatus === 'rented' || prop.status === 'rented' || prop.availability_status === 'rented';
            const isClosed = isSold || isRented || prop.publicationStatus === 'archived' || prop.publicationStatus === 'completed' || prop.publication_status === 'completed';
            const isPendingVerification = 
              prop.verificationStatus === 'pending_verification' || 
              prop.verificationStatus === 'pending_review' || 
              prop.publicationStatus === 'in_review';
            const isApproved = 
              (prop.verificationStatus === 'approved' || prop.verificationStatus === 'verified') && 
              prop.publicationStatus === 'published' && 
              !isPendingVerification;
            const isRejected = prop.verificationStatus === 'rejected';

            return (
              <div
                key={propId}
                className="bg-white dark:bg-[#131E31] p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Status Pill */}
                    {isPendingVerification ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 flex items-center gap-1 shadow-2xs">
                          <Clock className="w-3 h-3 text-amber-600" />
                          <span>Under Admin Verification</span>
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                          Temporarily Unlisted
                        </span>
                      </div>
                    ) : isRejected ? (
                      <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-700 flex items-center gap-1 shadow-2xs">
                        <AlertTriangle className="w-3 h-3 text-rose-600" />
                        <span>Verification Rejected</span>
                      </span>
                    ) : isApproved ? (
                      <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 flex items-center gap-1 shadow-2xs">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>Verified &amp; Live</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600">
                        {prop.verificationStatus || 'In Review'}
                      </span>
                    )}

                    {isSold && (
                      <span className="text-[10px] bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 font-extrabold px-2.5 py-0.5 rounded-full uppercase border border-purple-200 dark:border-purple-700">
                        Deal Closed (Sold Out)
                      </span>
                    )}

                    {isRented && (
                      <span className="text-[10px] bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 font-extrabold px-2.5 py-0.5 rounded-full uppercase border border-blue-200 dark:border-blue-700">
                        Tenancy Active (Rented Out)
                      </span>
                    )}

                    <span className="text-xs font-mono text-slate-400 dark:text-slate-500">#{propId}</span>
                  </div>

                  <h4 className="font-extrabold text-base text-slate-900 dark:text-white leading-snug">{prop.title}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    <span className="capitalize">{prop.category}</span> ({prop.propertyType || 'Asset'}) · <span className="uppercase font-semibold">{prop.purpose}</span> · <strong className="text-slate-900 dark:text-slate-100">{formatINR(prop.price)}</strong>
                    {prop.location?.district && ` · ${prop.location.district}`}
                  </p>

                  {/* Closed Deal Beneficiary Info */}
                  {isClosed && (prop.buyerName || prop.saleMetadata?.buyerName) && (
                    <div className="text-[11px] bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-2 rounded-xl text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>
                        {isRented ? 'Leased to' : 'Sold to'}: <strong>{prop.buyerName || prop.saleMetadata?.buyerName}</strong>
                        {(prop.finalPrice || prop.saleMetadata?.salePrice || prop.saleMetadata?.leasePrice) && ` · Consideration: ₹${formatINR(prop.finalPrice || prop.saleMetadata?.salePrice || prop.saleMetadata?.leasePrice)}`}
                      </span>
                    </div>
                  )}

                  {/* Informational Alerts */}
                  {isPendingVerification && (
                    <div className="text-[11px] bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 p-2.5 rounded-xl text-amber-900 dark:text-amber-200 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        Revisions submitted to Super Admin Verification Queue. This listing is temporarily unlisted from public discovery until verified by Admin.
                      </span>
                    </div>
                  )}

                  {isRejected && prop.adminNotes && (
                    <div className="text-[11px] bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 p-2.5 rounded-xl text-rose-900 dark:text-rose-200 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span><strong>Admin Findings:</strong> {prop.adminNotes}</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {/* Edit Details Button - Exclusive to Citizen Owner */}
                  {!isClosed && (
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(prop)}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                      title="Edit property specifications & submit revisions for cadastral re-verification"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Edit Details</span>
                    </button>
                  )}

                  {/* Deed Inspection */}
                  <button
                    type="button"
                    onClick={() => handleOpenDeedModal(prop)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                    <span>View Cadastral Deed</span>
                  </button>

                  {/* Mark Deal Closed */}
                  {!isClosed && (
                    <button
                      type="button"
                      disabled={completingDealId === propId}
                      onClick={() => handleCompleteDeal(propId, prop.purpose)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>{completingDealId === propId ? 'Closing...' : (isRent ? 'Mark as Rented' : 'Mark as Sold')}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ========================================================================= */}
      {/* CITIZEN PROPERTY EDIT MODAL                                               */}
      {/* ========================================================================= */}
      {editingProperty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white dark:bg-[#131E31] rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-scale-up">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-emerald-400" />
                <h3 className="font-extrabold text-sm sm:text-base">
                  Edit Property Details
                </h3>
                <span className="text-xs font-mono text-slate-400">
                  #{editingProperty._id || editingProperty.id}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCloseEditModal}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Cadastral Governance Notice */}
            <div className="p-4 mx-6 mt-4 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 space-y-1">
              <div className="flex items-center gap-2 font-black">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Verification &amp; Delisting Rule</span>
              </div>
              <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
                Saving revisions will temporarily unlist your property from public discovery (Explore, Map, Search) and re-route the listing to the <strong>PlotPin Super Admin Verification Queue</strong>. Once cadastral details are re-verified by the administrator, your listing will automatically return to live public status.
              </p>
            </div>

            <form onSubmit={handleSubmitEdit} className="p-6 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Property Title / Headline
                </label>
                <input
                  type="text"
                  required
                  value={editFormData.title}
                  onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                  placeholder="e.g. 3 BHK Luxury Villa in Whitefield"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-medium"
                />
              </div>

              {/* Price & Purpose Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Listed Price (₹ INR)
                  </label>
                  <input
                    type="number"
                    required
                    value={editFormData.price}
                    onChange={(e) => setEditFormData({ ...editFormData, price: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-mono font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Listing Purpose
                  </label>
                  <select
                    value={editFormData.purpose}
                    onChange={(e) => setEditFormData({ ...editFormData, purpose: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-medium"
                  >
                    <option value="sale">Direct Sale (0% Brokerage)</option>
                    <option value="rent">Rent / Lease</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Asset Classification
                  </label>
                  <select
                    value={editFormData.category}
                    onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-medium"
                  >
                    <option value="residential">Residential</option>
                    <option value="agricultural">Agricultural Land</option>
                    <option value="commercial">Commercial</option>
                    <option value="plots">Plots &amp; Layouts</option>
                  </select>
                </div>
              </div>

              {/* Area & Units Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Plotted Area Value
                  </label>
                  <input
                    type="text"
                    required
                    value={editFormData.areaValue}
                    onChange={(e) => setEditFormData({ ...editFormData, areaValue: e.target.value })}
                    placeholder="e.g. 1850 or 2.5"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Area Unit
                  </label>
                  <select
                    value={editFormData.areaUnit}
                    onChange={(e) => setEditFormData({ ...editFormData, areaUnit: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-medium"
                  >
                    <option value="sq.ft">Square Feet (sq.ft)</option>
                    <option value="acres">Acres</option>
                    <option value="cents">Cents</option>
                    <option value="sq.yards">Square Yards (Gaj)</option>
                  </select>
                </div>
              </div>

              {/* Location Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Locality / Address
                  </label>
                  <input
                    type="text"
                    required
                    value={editFormData.locality}
                    onChange={(e) => setEditFormData({ ...editFormData, locality: e.target.value })}
                    placeholder="e.g. Indiranagar, Main Road"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    District (AP)
                  </label>
                  <select
                    value={editFormData.district}
                    onChange={(e) => setEditFormData({ ...editFormData, district: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-medium"
                  >
                    {AP_DISTRICTS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Property Description &amp; Highlights
                </label>
                <textarea
                  rows={3}
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  placeholder="Detail key boundaries, title history, proximity to highways, etc."
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-medium"
                />
              </div>

              {/* Revision Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Reason for Revision (for Admin Verification)
                </label>
                <input
                  type="text"
                  value={editFormData.editReason}
                  onChange={(e) => setEditFormData({ ...editFormData, editReason: e.target.value })}
                  placeholder="e.g. Revised asking price, updated boundary dimensions"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-medium"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleCloseEditModal}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="px-5 py-2.5 rounded-xl bg-[#184631] hover:bg-[#123625] text-white text-xs font-black shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{isSubmittingEdit ? 'Submitting for Review...' : 'Submit Revisions for Verification'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
