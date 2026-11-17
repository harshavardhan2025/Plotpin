import React, { useState, useMemo } from 'react';
import { 
  Calendar, Check, X, Ban, Clock, User, Phone, MapPin, 
  ShieldCheck, AlertTriangle, Search, Filter, RefreshCw,
  PhoneCall, PhoneForwarded, MessageSquare, Copy, CheckCircle2,
  CalendarDays, ExternalLink, ArrowRight, Lock
} from 'lucide-react';
import { useProperty } from '../../../contexts/PropertyContext';
import { useAuth } from '../../../contexts/AuthContext';
import { getCallUnlockStatus, getBookingUnlockStatus, formatINR } from '../../../utils/propertyHelpers';

export default function BookingManagement() {
  const { showToast } = useAuth();
  const { 
    adminAppointments, 
    updateBookingStatus, 
    adminCalls,
    updateCallRecord,
    isMobile,
    properties,
    adminApprovedProperties,
    updatePropertyStatus,
    adminCustomers
  } = useProperty();

  // Search & Status Filter States
  const [bookingSearch, setBookingSearch] = useState('');
  const [callSearch, setCallSearch] = useState('');
  const [bookingStatusFilter, setBookingStatusFilter] = useState('present'); // 'present' | 'completed' | 'rejected'
  const [callStatusFilter, setCallStatusFilter] = useState('present'); // 'present' | 'completed' | 'rejected'
  const [copiedId, setCopiedId] = useState(null);

  // Track call IDs where admin has dialed/initiated a call (persisted in localStorage)
  const [calledCallIds, setCalledCallIds] = useState(() => {
    try {
      const saved = localStorage.getItem('plotpin_admin_called_ids');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch (e) {
      return new Set();
    }
  });

  // Cancel / Reject Booking Modal State
  const [actionModalTarget, setActionModalTarget] = useState(null); // { apt, type: 'reject' | 'cancel' }
  const [actionReason, setActionReason] = useState('');

  // Update Call Record Modal State
  const [selectedCall, setSelectedCall] = useState(null);
  const [callStatus, setCallStatus] = useState('completed');
  const [callNotes, setCallNotes] = useState('');

  // Deal Finalization (Mark Sold / Rented) Modal State
  const [dealModalTarget, setDealModalTarget] = useState(null);
  const [dealOutcome, setDealOutcome] = useState('sold'); // 'sold' | 'rented'
  const [dealBuyerName, setDealBuyerName] = useState('');
  const [dealBuyerPhone, setDealBuyerPhone] = useState('');
  const [dealBuyerEmail, setDealBuyerEmail] = useState('');
  const [dealPrice, setDealPrice] = useState('');
  const [dealNotes, setDealNotes] = useState('');
  const [isSubmittingDeal, setIsSubmittingDeal] = useState(false);

  // Format and Filter Bookings List
  const filteredBookings = useMemo(() => {
    return (adminAppointments || []).filter(b => {
      const s = (typeof b.status === 'string' ? b.status : (b.status?.status || '')).toLowerCase();
      // Status Filter
      if (bookingStatusFilter === 'present') {
        const isPresent = s !== 'rejected' && s !== 'cancelled' && s !== 'completed' && (s === 'pending' || s === 'confirmed' || s === 'rescheduled');
        if (!isPresent) return false;
      } else if (bookingStatusFilter === 'completed') {
        if (s !== 'completed') return false;
      } else if (bookingStatusFilter === 'rejected') {
        const isRejected = s === 'rejected' || s === 'cancelled';
        if (!isRejected) return false;
      }

      // Search Filter
      if (bookingSearch.trim()) {
        const q = bookingSearch.toLowerCase().replace('#', '');
        const id = (b._id || b.id || '').toLowerCase();
        const name = (b.customerName || b.name || '').toLowerCase();
        const phone = (b.customerPhone || b.phone || '').toLowerCase();
        const title = (b.propertyTitle || '').toLowerCase();
        const notes = (b.notes || '').toLowerCase();
        if (!id.includes(q) && !name.includes(q) && !phone.includes(q) && !title.includes(q) && !notes.includes(q)) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => new Date(b.createdAt || b.startAt || 0) - new Date(a.createdAt || a.startAt || 0));
  }, [adminAppointments, bookingSearch, bookingStatusFilter]);

  // Format and Filter Calls List
  const filteredCalls = useMemo(() => {
    return (adminCalls || []).filter(c => {
      const s = (typeof c.status === 'string' ? c.status : (c.status?.status || '')).toLowerCase();
      // Status Filter
      if (callStatusFilter === 'present') {
        const isPresent = s !== 'rejected' && s !== 'cancelled' && s !== 'completed' && s !== 'missed' && (s === 'pending' || s === 'follow_up' || s === 'requested' || s === 'scheduled');
        if (!isPresent) return false;
      } else if (callStatusFilter === 'completed') {
        if (s !== 'completed') return false;
      } else if (callStatusFilter === 'rejected') {
        const isRejected = s === 'rejected' || s === 'missed' || s === 'cancelled';
        if (!isRejected) return false;
      }

      // Search Filter
      if (callSearch.trim()) {
        const q = callSearch.toLowerCase().replace('#', '');
        const id = (c._id || c.id || '').toLowerCase();
        const name = (c.customerName || '').toLowerCase();
        const phone = (c.customerPhone || c.phone || '').toLowerCase();
        const title = (c.propertyTitle || '').toLowerCase();
        const notes = (c.notes || c.adminNotes || '').toLowerCase();
        const timeText = (c.preferredTime || c.preferredTimeWindow || '').toLowerCase();
        if (!id.includes(q) && !name.includes(q) && !phone.includes(q) && !title.includes(q) && !notes.includes(q) && !timeText.includes(q)) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }, [adminCalls, callSearch, callStatusFilter]);

  // Booking Counts
  const bookingCounts = useMemo(() => {
    const all = (adminAppointments || []).length;
    const present = (adminAppointments || []).filter(b => {
      const s = (typeof b.status === 'string' ? b.status : (b.status?.status || '')).toLowerCase();
      return s !== 'rejected' && s !== 'cancelled' && s !== 'completed' && (s === 'pending' || s === 'confirmed' || s === 'rescheduled');
    }).length;
    const completed = (adminAppointments || []).filter(b => {
      const s = (typeof b.status === 'string' ? b.status : (b.status?.status || '')).toLowerCase();
      return s === 'completed';
    }).length;
    const rejected = (adminAppointments || []).filter(b => {
      const s = (typeof b.status === 'string' ? b.status : (b.status?.status || '')).toLowerCase();
      return s === 'rejected' || s === 'cancelled';
    }).length;
    return { all, present, completed, rejected };
  }, [adminAppointments]);

  // Call Counts
  const callCounts = useMemo(() => {
    const all = (adminCalls || []).length;
    const present = (adminCalls || []).filter(c => {
      const s = (typeof c.status === 'string' ? c.status : (c.status?.status || '')).toLowerCase();
      return s !== 'rejected' && s !== 'cancelled' && s !== 'completed' && s !== 'missed' && (s === 'pending' || s === 'follow_up' || s === 'requested' || s === 'scheduled');
    }).length;
    const completed = (adminCalls || []).filter(c => {
      const s = (typeof c.status === 'string' ? c.status : (c.status?.status || '')).toLowerCase();
      return s === 'completed';
    }).length;
    const rejected = (adminCalls || []).filter(c => {
      const s = (typeof c.status === 'string' ? c.status : (c.status?.status || '')).toLowerCase();
      return s === 'rejected' || s === 'missed' || s === 'cancelled';
    }).length;
    return { all, present, completed, rejected };
  }, [adminCalls]);

  // Action Handlers for Bookings (Admin views and updates only)
  const handleConfirmBooking = async (aptId) => {
    try {
      await updateBookingStatus(aptId, 'confirmed', 'Confirmed by Super Admin. Cadastral surveyor escort dispatched.');
      showToast('✓ Booking confirmed. Surveyor escort assigned.');
    } catch (err) {
      showToast(err.message || 'Action failed');
    }
  };

  const handleCompleteBooking = async (apt) => {
    const aptId = apt._id || apt.id;
    const unlockStatus = getBookingUnlockStatus(apt.startAt);
    if (unlockStatus.isLocked) {
      showToast(`🔒 Cannot complete site visit before scheduled time. Available 10 minutes prior to visit (${unlockStatus.formattedUnlock}).`);
      return;
    }
    try {
      await updateBookingStatus(aptId, 'completed', 'Site inspection completed and cadastral boundaries verified with customer.');
      showToast('✓ Site visit marked as Completed.');
    } catch (err) {
      showToast(err.message || 'Action failed');
    }
  };

  const handleInitiateBookingCall = (apt) => {
    const phone = apt.customerPhone || apt.phone;
    const unlockStatus = getBookingUnlockStatus(apt.startAt);
    if (unlockStatus.isLocked) {
      showToast(`🔒 Cannot call before scheduled appointment. Call unlocks at ${unlockStatus.formattedUnlock} (10 minutes before visit).`);
      return;
    }
    showToast(`📞 Dialing ${apt.customerName || 'buyer'} (${phone}).`);
    if (phone) {
      window.location.href = `tel:${phone}`;
    }
  };

  const handleOpenActionModal = (apt, type) => {
    setActionModalTarget({ apt, type });
    setActionReason(type === 'reject' ? 'Surveyor schedule conflict on this date' : 'Customer requested cancellation');
  };

  const handleConfirmActionModal = async (e) => {
    e.preventDefault();
    if (!actionModalTarget) return;
    const { apt, type } = actionModalTarget;
    const aptId = apt._id || apt.id;
    const finalStatus = type === 'reject' ? 'rejected' : 'cancelled';
    try {
      await updateBookingStatus(aptId, finalStatus, actionReason.trim() || `${finalStatus} by Super Admin`);
      showToast(`Booking #${aptId.slice(-4)} has been ${finalStatus}.`);
      setActionModalTarget(null);
    } catch (err) {
      showToast(err.message || 'Action failed');
    }
  };

  // Action Handlers for Calls
  const handleInitiateCall = (call) => {
    const callId = call._id || call.id;
    const phone = call.customerPhone || call.phone;

    const unlockStatus = getCallUnlockStatus(call.preferredTime || call.preferredTimeWindow || call.timeSlot, call.createdAt);
    if (unlockStatus.isLocked) {
      showToast(`🔒 Cannot call before scheduled window. Call unlocks at ${unlockStatus.formattedUnlock} (10 minutes before ${unlockStatus.formattedTime || 'scheduled time'}).`);
      return;
    }

    setCalledCallIds(prev => {
      const next = new Set(prev);
      next.add(callId);
      try {
        localStorage.setItem('plotpin_admin_called_ids', JSON.stringify(Array.from(next)));
      } catch (e) {}
      return next;
    });
    showToast(`📞 Dialing ${call.customerName || 'customer'} (${phone}). You can now mark this call as Completed.`);
    if (phone) {
      window.location.href = `tel:${phone}`;
    }
  };

  const handleOpenCallModal = (call) => {
    setSelectedCall(call);
    setCallStatus(call.status === 'pending' ? 'completed' : call.status);
    setCallNotes(call.adminNotes || call.notes || '');
  };

  const handleSaveCallUpdate = (e) => {
    e.preventDefault();
    if (!selectedCall) return;
    const callId = selectedCall._id || selectedCall.id;
    const unlockStatus = getCallUnlockStatus(selectedCall.preferredTime || selectedCall.preferredTimeWindow || selectedCall.timeSlot, selectedCall.createdAt);

    if (callStatus === 'completed' && unlockStatus.isLocked) {
      showToast(`🔒 Cannot mark as Completed before scheduled window (${unlockStatus.formattedUnlock}).`);
      return;
    }

    const hasCalled = calledCallIds.has(callId) || selectedCall.status === 'completed' || selectedCall.called;

    if (callStatus === 'completed' && !hasCalled) {
      showToast('⚠️ Please click "Call" to contact the customer before marking as Completed.');
      return;
    }

    updateCallRecord(callId, callStatus, callNotes);
    showToast(`Call #${callId.slice(-4)} updated to ${callStatus.toUpperCase()}`);
    setSelectedCall(null);
  };

  const handleQuickCompleteCall = (call) => {
    const callId = call._id || call.id;
    const unlockStatus = getCallUnlockStatus(call.preferredTime || call.preferredTimeWindow || call.timeSlot, call.createdAt);
    if (unlockStatus.isLocked) {
      showToast(`🔒 Cannot complete call enquiry before scheduled window. Unlocks at ${unlockStatus.formattedUnlock} (10 minutes prior).`);
      return;
    }
    const hasCalled = calledCallIds.has(callId) || call.status === 'completed' || call.called;

    if (!hasCalled) {
      showToast('⚠️ Please click "Call" to contact the customer before completing this enquiry.');
      return;
    }

    updateCallRecord(callId, 'completed', 'Resolved via telephone discussion with Super Admin.');
    showToast(`✓ Call #${callId.slice(-4)} marked as Completed`);
  };

  const handleCopyPhone = (phone, id) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(phone);
      setCopiedId(id);
      showToast(`Copied ${phone}`);
      setTimeout(() => setCopiedId(null), 2500);
    }
  };

  // Handlers for Deal Finalization (Mark as Sold / Rented)
  const handleOpenDealModal = (item, type) => {
    const propId = item.propertyId || item.property_id || item.targetId;
    if (!propId) {
      showToast('⚠️ No associated real estate asset linked to this lead.');
      return;
    }
    const allProps = [...(adminApprovedProperties || []), ...(properties || [])];
    const matchedProp = allProps.find(p => (p._id || p.id) === propId);

    const isRentListing = matchedProp 
      ? (matchedProp.purpose === 'rent' || matchedProp.listingType === 'rent') 
      : (item.purpose === 'rent' || item.listingType === 'rent');
    const defaultOutcome = isRentListing ? 'rented' : 'sold';

    // 1. Resolve and Auto-fill customer details from item or matched customer account
    const buyerId = item.buyerId || item.buyer_id || item.userId || item.user_id || item.customerId;
    const matchedCustomer = (adminCustomers || []).find(c => 
      (buyerId && (c._id === buyerId || c.id === buyerId)) || 
      (c.email && (c.email === item.customerEmail || c.email === item.buyerEmail || c.email === item.email)) ||
      (c.mobile && (c.mobile === item.customerPhone || c.mobile === item.buyerPhone || c.mobile === item.phone))
    );

    const resolvedName = item.customerName || item.buyerName || item.name || item.clientName || item.user?.name || matchedCustomer?.name || 'Citizen Customer';
    const resolvedPhone = item.customerPhone || item.buyerPhone || item.phone || item.mobile || item.contactPhone || item.user?.mobile || item.user?.phone || matchedCustomer?.mobile || matchedCustomer?.phone || '+91 9845049120';
    const resolvedEmail = item.customerEmail || item.buyerEmail || item.email || item.contactEmail || item.user?.email || matchedCustomer?.email || '';

    setDealModalTarget({
      item,
      type,
      prop: matchedProp,
      propertyId: propId,
      propertyTitle: item.propertyTitle || matchedProp?.title || 'Cadastral Asset'
    });

    setDealOutcome(defaultOutcome);
    setDealBuyerName(resolvedName);
    setDealBuyerPhone(resolvedPhone);
    setDealBuyerEmail(resolvedEmail);
    setDealPrice(matchedProp?.price ? String(matchedProp.price) : (item.price ? String(item.price) : ''));
    setDealNotes(`Super Admin deal finalized via ${type === 'booking' ? 'Site Visit Appointment' : 'Inbound Call Request'} #${(item._id || item.id || '').slice(-4)}`);
  };

  const handleConfirmDeal = async (e) => {
    e.preventDefault();
    if (!dealModalTarget) return;
    const { item, type, propertyId, prop } = dealModalTarget;
    const itemId = item._id || item.id;
    setIsSubmittingDeal(true);

    try {
      const numericPrice = dealPrice ? Number(String(dealPrice).replace(/[^0-9]/g, '')) : (prop?.price || 0);

      const metadata = {
        buyerName: dealBuyerName.trim() || 'Verified Citizen Buyer',
        buyerPhone: dealBuyerPhone.trim(),
        buyerEmail: dealBuyerEmail.trim(),
        buyerId: item.userId || item.buyerId || 'usr_client_001',
        salePrice: numericPrice,
        leasePrice: numericPrice,
        propertyTitle: dealModalTarget.propertyTitle,
        sourceType: type,
        sourceId: itemId,
        closedAt: new Date().toISOString()
      };

      await updatePropertyStatus(propertyId, dealOutcome, dealNotes.trim(), metadata);

      // Close the visit or call record as completed
      if (type === 'booking') {
        await updateBookingStatus(itemId, 'completed', `Deal finalized as ${dealOutcome.toUpperCase()} with ${dealBuyerName.trim()}`);
      } else {
        updateCallRecord(itemId, 'completed', `Deal finalized as ${dealOutcome.toUpperCase()} with ${dealBuyerName.trim()}`);
      }

      showToast(`🎉 Property successfully marked as ${dealOutcome.toUpperCase()}! Title deed transferred to ${dealBuyerName.trim()}.`);
      setDealModalTarget(null);
    } catch (err) {
      showToast(err.message || 'Failed to complete deal');
    } finally {
      setIsSubmittingDeal(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Two Vertical Columns on the Same Screen */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
        
        {/* ========================================================= */}
        {/* COLUMN 1: CUSTOMER SITE VISIT BOOKINGS                    */}
        {/* ========================================================= */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-4 sm:p-5 space-y-4">
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400">
                <CalendarDays className="w-4 h-4" />
              </span>
              <div>
                <h4 className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
                  Customer Site Visits
                </h4>
                <p className="text-[11px] font-semibold text-slate-400">
                  {bookingCounts.all} Bookings ({bookingCounts.present} Present)
                </p>
              </div>
            </div>

            {/* Filter Pills with Counts */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: 'present', label: `Present (${bookingCounts.present})` },
                { id: 'completed', label: `Completed (${bookingCounts.completed})` },
                { id: 'rejected', label: `Rejected (${bookingCounts.rejected})` },
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setBookingStatusFilter(tab.id)}
                  className={`px-2.5 py-1 text-xs rounded-xl font-bold transition-all cursor-pointer ${
                    bookingStatusFilter === tab.id
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search bookings by customer, phone or property..."
              value={bookingSearch}
              onChange={(e) => setBookingSearch(e.target.value)}
              className="w-full pl-10 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            />
          </div>

          {/* Bookings Feed */}
          <div className="space-y-3">
            {filteredBookings.length === 0 ? (
              <div className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-2">
                <Calendar className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
                <p className="text-xs font-bold text-slate-600 dark:text-slate-400">No site visits found</p>
                <p className="text-[11px] text-slate-400">No customer bookings matching search query.</p>
              </div>
            ) : (
              filteredBookings.map((apt) => {
                const aptId = apt._id || apt.id;
                const isPending = apt.status === 'pending';
                const isConfirmed = apt.status === 'confirmed';
                const isRescheduled = apt.status === 'rescheduled';
                const isCompleted = apt.status === 'completed';
                const isRejected = apt.status === 'rejected' || apt.status === 'cancelled';
                const bookingUnlock = getBookingUnlockStatus(apt.startAt);

                const scheduledDateText = apt.startAt 
                  ? new Date(apt.startAt).toLocaleString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })
                  : 'Date Pending';

                return (
                  <div
                    key={aptId}
                    className="p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 hover:border-indigo-400/40 transition-all shadow-2xs space-y-3"
                  >
                    {/* Top Row: Customer & Status Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                            {apt.customerName || 'Citizen Buyer'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">#{aptId.slice(-4)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <Phone className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span className="font-mono font-semibold">{apt.customerPhone || 'Not provided'}</span>
                          {apt.customerPhone && (
                            <button
                              type="button"
                              onClick={() => handleCopyPhone(apt.customerPhone, aptId)}
                              className="text-slate-400 hover:text-indigo-600 p-0.5"
                              title="Copy phone"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Status Badges */}
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider ${
                        isPending
                          ? 'bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-700/80'
                          : isConfirmed
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-700/80'
                          : isRescheduled
                          ? 'bg-indigo-100 text-indigo-900 border border-indigo-300 dark:bg-indigo-950/80 dark:text-indigo-200 dark:border-indigo-700/80'
                          : isCompleted
                          ? 'bg-slate-100 text-slate-800 border border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700'
                          : 'bg-rose-100 text-rose-900 border border-rose-300 dark:bg-rose-950/80 dark:text-rose-200 dark:border-rose-700/80'
                      }`}>
                        {typeof apt.status === 'string' ? apt.status : (apt.status?.status || 'confirmed')}
                      </span>
                    </div>

                    {/* Property & Inspection Time Box */}
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 space-y-1.5 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 font-bold truncate">
                        <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        <span className="truncate">{apt.propertyTitle || 'Cadastral Asset'}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300 pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
                        <div className="flex items-center gap-1 text-indigo-700 dark:text-indigo-400 font-bold">
                          <Clock className="w-3 h-3" />
                          <span>{scheduledDateText}</span>
                        </div>
                        <span className="text-slate-400 truncate max-w-[180px]">
                          Surveyor: {apt.assignedSurveyor ? apt.assignedSurveyor.split(',')[0] : 'Escort Assigned'}
                        </span>
                      </div>
                    </div>

                    {/* Lock Indicator: Calls & Complete unlock 10 mins prior to visit */}
                    {bookingUnlock.isLocked && !isCompleted && !isRejected && (
                      <div className="flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 px-2.5 py-1.5 rounded-xl font-bold">
                        <Lock className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                        <span>Call &amp; Complete unlock at {bookingUnlock.formattedUnlock} (10 min prior to visit)</span>
                      </div>
                    )}

                    {/* Notes if any */}
                    {apt.notes && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                        "{apt.notes}"
                      </p>
                    )}

                    {/* Operational Action Buttons (Admin Updates Only) */}
                    <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                      {/* Call Customer Button on Site Visit */}
                      {apt.customerPhone && !isCompleted && !isRejected && (
                        bookingUnlock.isLocked ? (
                          <button
                            type="button"
                            onClick={() => showToast(`🔒 Visit scheduled for ${bookingUnlock.formattedTime}. Call unlocks at ${bookingUnlock.formattedUnlock} (10 mins prior).`)}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-75"
                            title={`Call unlocks 10 min prior (${bookingUnlock.formattedUnlock})`}
                          >
                            <Lock className="w-3 h-3 text-amber-500" />
                            <span>Call</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleInitiateBookingCall(apt)}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
                            title="Call customer regarding site visit"
                          >
                            <Phone className="w-3 h-3" />
                            <span>Call</span>
                          </button>
                        )
                      )}

                      {isPending && (
                        <button
                          type="button"
                          onClick={() => handleConfirmBooking(aptId)}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Confirm</span>
                        </button>
                      )}

                      {!isCompleted && !isRejected && (
                        <>
                          {bookingUnlock.isLocked ? (
                            <button
                              type="button"
                              onClick={() => showToast(`🔒 Cannot complete site visit before scheduled time. Available 10 minutes prior to visit (${bookingUnlock.formattedUnlock}).`)}
                              className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold transition-all cursor-not-allowed opacity-60 flex items-center gap-1"
                              title={`Complete unlocks 10 min prior (${bookingUnlock.formattedUnlock})`}
                            >
                              <Lock className="w-3 h-3 text-amber-500" />
                              <span>Complete</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleCompleteBooking(apt)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Complete</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleOpenActionModal(apt, 'reject')}
                            className="px-2 py-1 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg text-xs font-bold transition-all cursor-pointer"
                          >
                            Reject
                          </button>
                        </>
                      )}

                      {/* Close Deal / Finalize Sale or Rental */}
                      {apt.propertyId && !isRejected && (
                        <button
                          type="button"
                          onClick={() => handleOpenDealModal(apt, 'booking')}
                          className="px-2.5 py-1 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-lg text-xs font-black transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                          title="Finalize agreement and mark property as Sold/Rented to this customer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Close Deal</span>
                        </button>
                      )}

                      {(isCompleted || isRejected) && (
                        <span className="text-[11px] font-semibold text-slate-400">
                          Record finalized ({apt.status})
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* COLUMN 2: CUSTOMER INBOUND CALL REQUESTS                  */}
        {/* ========================================================= */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs p-4 sm:p-5 space-y-4">
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-400">
                <PhoneCall className="w-4 h-4" />
              </span>
              <div>
                <h4 className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
                  Customer Call Requests
                </h4>
                <p className="text-[11px] font-semibold text-slate-400">
                  {callCounts.all} Requests ({callCounts.present} Present)
                </p>
              </div>
            </div>

            {/* Filter Pills with Counts */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: 'present', label: `Present (${callCounts.present})` },
                { id: 'completed', label: `Completed (${callCounts.completed})` },
                { id: 'rejected', label: `Rejected (${callCounts.rejected})` },
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCallStatusFilter(tab.id)}
                  className={`px-2.5 py-1 text-xs rounded-xl font-bold transition-all cursor-pointer ${
                    callStatusFilter === tab.id
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search calls by customer name, phone or notes..."
              value={callSearch}
              onChange={(e) => setCallSearch(e.target.value)}
              className="w-full pl-10 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium"
            />
          </div>

          {/* Calls Feed */}
          <div className="space-y-3">
            {filteredCalls.length === 0 ? (
              <div className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-2">
                <PhoneCall className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
                <p className="text-xs font-bold text-slate-600 dark:text-slate-400">No call requests found</p>
                <p className="text-[11px] text-slate-400">No callback requests matching search query.</p>
              </div>
            ) : (
              filteredCalls.map((call) => {
                const callId = call._id || call.id;
                const isPending = call.status === 'pending';
                const isFollowUp = call.status === 'follow_up';
                const isCompleted = call.status === 'completed';
                const isRejected = call.status === 'rejected' || call.status === 'missed';
                const hasCalled = calledCallIds.has(callId) || isCompleted || call.called;

                const requestedTime = call.preferredTime || call.preferredTimeWindow || call.timeSlot || 'Immediate Callback Requested';
                const callUnlock = getCallUnlockStatus(requestedTime, call.createdAt);

                return (
                  <div
                    key={callId}
                    className="p-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 hover:border-sky-400/40 transition-all shadow-2xs space-y-3"
                  >
                    {/* Top Row: Customer & Status Badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                            {call.customerName || 'Inquiring Customer'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">#{callId.slice(-4)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <Phone className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                          <span className="font-mono font-semibold">{call.customerPhone || call.phone || 'Not provided'}</span>
                          {(call.customerPhone || call.phone) && (
                            <button
                              type="button"
                              onClick={() => handleCopyPhone(call.customerPhone || call.phone, callId)}
                              className="text-slate-400 hover:text-sky-600 p-0.5"
                              title="Copy phone"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Status Badge */}
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider ${
                        isPending
                          ? 'bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-700/80'
                          : isFollowUp
                          ? 'bg-indigo-100 text-indigo-900 border border-indigo-300 dark:bg-indigo-950/80 dark:text-indigo-200 dark:border-indigo-700/80'
                          : isCompleted
                          ? 'bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-700/80'
                          : 'bg-rose-100 text-rose-900 border border-rose-300 dark:bg-rose-950/80 dark:text-rose-200 dark:border-rose-700/80'
                      }`}>
                        {typeof call.status === 'string' ? call.status : (call.status?.status || 'completed')}
                      </span>
                    </div>

                    {/* Customer Requested Time Window Box */}
                    <div className="p-2.5 rounded-xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200/70 dark:border-sky-800/50 space-y-1 text-xs">
                      <div className="flex items-center gap-1.5 text-sky-900 dark:text-sky-200 font-extrabold">
                        <Clock className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                        <span>Requested Time: {requestedTime}</span>
                      </div>
                      {call.propertyTitle && (
                        <div className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
                          Asset Inquired: <strong className="text-slate-800 dark:text-slate-200">{call.propertyTitle}</strong>
                        </div>
                      )}
                    </div>

                    {/* Lock Indicator: Calls unlock 10 mins prior to requested window */}
                    {callUnlock.isLocked && !isCompleted && !isRejected && (
                      <div className="flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 px-2.5 py-1.5 rounded-xl font-bold">
                        <Lock className="w-3.5 h-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                        <span>Call access unlocks at {callUnlock.formattedUnlock} (10 min before {callUnlock.formattedTime || 'slot'})</span>
                      </div>
                    )}

                    {/* Customer Question/Note */}
                    {(call.notes || call.message) && (
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg italic">
                        "{call.notes || call.message}"
                      </p>
                    )}

                    {/* Admin Log remarks if recorded */}
                    {call.adminNotes && (
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100/80 dark:bg-slate-800/80 p-2 rounded-lg">
                        <strong>Admin Note:</strong> {call.adminNotes}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                      {(call.customerPhone || call.phone) && (
                        callUnlock.isLocked ? (
                          <button
                            type="button"
                            onClick={() => showToast(`🔒 Call scheduled for ${callUnlock.formattedTime || 'slotted time'}. Call access unlocks at ${callUnlock.formattedUnlock} (10 mins prior).`)}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-75"
                            title={`Call unlocks 10 min prior (${callUnlock.formattedUnlock})`}
                          >
                            <Lock className="w-3 h-3 text-amber-500" />
                            <span>Call</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleInitiateCall(call)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer ${
                              hasCalled
                                ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800 hover:bg-sky-100'
                                : 'bg-sky-600 hover:bg-sky-700 text-white'
                            }`}
                            title={hasCalled ? 'Call customer again' : 'Dial customer phone'}
                          >
                            <Phone className="w-3 h-3" />
                            <span>{hasCalled ? 'Call Again' : 'Call'}</span>
                          </button>
                        )
                      )}

                      {!isCompleted && !isRejected && (
                        <>
                          {callUnlock.isLocked ? (
                            <button
                              type="button"
                              onClick={() => showToast(`🔒 Call window not reached yet. Unlocks at ${callUnlock.formattedUnlock} (10 mins before ${callUnlock.formattedTime || 'scheduled slot'}).`)}
                              className="px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-60"
                              title={`Unlocks 10 min prior (${callUnlock.formattedUnlock})`}
                            >
                              <Lock className="w-3 h-3 text-amber-500" />
                              <span>Complete</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={!hasCalled}
                              onClick={() => {
                                if (!hasCalled) {
                                  showToast('⚠️ Must initiate call first before completing.');
                                  return;
                                }
                                handleQuickCompleteCall(call);
                              }}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                                hasCalled
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-60'
                              }`}
                              title={hasCalled ? 'Mark enquiry as Completed' : 'Call customer first to unlock Complete'}
                            >
                              <Check className="w-3 h-3" />
                              <span>Complete</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleOpenCallModal(call)}
                            className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
                          >
                            Update Log
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenDealModal(call, 'call')}
                            className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-700/60 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                            title="Finalize transaction as Sold/Rented to this customer"
                          >
                            <span>Close Deal</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </>
                      )}

                      {(isCompleted || isRejected) && (
                        <button
                          type="button"
                          onClick={() => handleOpenCallModal(call)}
                          className="px-2.5 py-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 text-xs font-bold cursor-pointer"
                        >
                          Edit Log
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* ========================================================= */}
      {/* MODAL 1: CANCEL / REJECT BOOKING                          */}
      {/* ========================================================= */}
      {actionModalTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 text-rose-600">
                <Ban className="w-5 h-5" />
                <h4 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white capitalize">
                  {actionModalTarget.type} Site Visit Booking
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setActionModalTarget(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmActionModal} className="space-y-3.5 text-xs">
              <p className="text-slate-600 dark:text-slate-400">
                Are you sure you want to {actionModalTarget.type} the booking for <strong>{actionModalTarget.apt.customerName}</strong> on <strong>{actionModalTarget.apt.propertyTitle}</strong>?
              </p>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Reason for {actionModalTarget.type === 'reject' ? 'Rejection' : 'Cancellation'} *
                </label>
                <textarea
                  rows={2}
                  required
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="Specify official reason dispatched to customer..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-medium resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setActionModalTarget(null)}
                  className="px-3.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 font-bold"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition-all cursor-pointer shadow-xs"
                >
                  Confirm {actionModalTarget.type === 'reject' ? 'Rejection' : 'Cancellation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: UPDATE CALL RECORD LOG                           */}
      {/* ========================================================= */}
      {selectedCall && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 text-sky-600">
                <PhoneCall className="w-5 h-5" />
                <h4 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                  Update Inbound Call Record
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCall(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCallUpdate} className="space-y-3.5 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-1">
                <div className="font-extrabold text-slate-900 dark:text-white">
                  {selectedCall.customerName} · {selectedCall.customerPhone || selectedCall.phone}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Requested: {selectedCall.preferredTime || selectedCall.preferredTimeWindow || 'Immediate Callback'}
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Status Outcome *</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'completed', label: 'Completed' },
                    { id: 'follow_up', label: 'Follow-Up' },
                    { id: 'rejected', label: 'Rejected' },
                  ].map(st => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setCallStatus(st.id)}
                      className={`p-2 rounded-xl text-center font-bold border transition-all cursor-pointer ${
                        callStatus === st.id
                          ? 'bg-sky-600 text-white border-sky-600 shadow-2xs'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Admin Discussion Remarks</label>
                <textarea
                  rows={3}
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                  placeholder="Record summary of customer conversation and next steps..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-medium resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedCall(null)}
                  className="px-3.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded-xl text-xs transition-all cursor-pointer shadow-xs"
                >
                  Save Call Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 4: CLOSE DEAL (SOLD / RENTED OUT TO CUSTOMER)       */}
      {/* ========================================================= */}
      {dealModalTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 my-8 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
                <h4 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                  Finalize & Close Deal
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setDealModalTarget(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmDeal} className="space-y-3.5 text-xs">
              {/* Asset Header */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-1 border border-slate-200 dark:border-slate-700">
                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Target Real Estate Asset
                </div>
                <div className="font-extrabold text-sm text-slate-900 dark:text-white">
                  {dealModalTarget.propertyTitle}
                </div>
                <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
                  Source: {dealModalTarget.type === 'booking' ? 'Site Visit Appointment' : 'Inbound Call Request'}
                </div>
              </div>

              {/* Deal Outcome Selector (Sold vs Rented) */}
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Transaction Classification *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDealOutcome('sold')}
                    className={`p-2.5 rounded-xl border text-center font-extrabold transition-all cursor-pointer ${
                      dealOutcome === 'sold'
                        ? 'bg-rose-50 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-700 ring-2 ring-rose-500/20'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    🏡 Mark as Sold
                  </button>
                  <button
                    type="button"
                    onClick={() => setDealOutcome('rented')}
                    className={`p-2.5 rounded-xl border text-center font-extrabold transition-all cursor-pointer ${
                      dealOutcome === 'rented'
                        ? 'bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700 ring-2 ring-blue-500/20'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    🤝 Mark as Rented
                  </button>
                </div>
              </div>

              {/* Buyer / Tenant Information (Auto-Filled from Booking / Call) */}
              <div className="space-y-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <div className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  {dealOutcome === 'sold' ? 'Buyer Identification' : 'Tenant Identification'} (Auto-Filled)
                </div>

                <div>
                  <label className="font-bold text-slate-600 dark:text-slate-400 block mb-0.5">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={dealBuyerName}
                    onChange={(e) => setDealBuyerName(e.target.value)}
                    placeholder="Customer Name"
                    className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold text-slate-600 dark:text-slate-400 block mb-0.5">Phone Number *</label>
                    <input
                      type="tel"
                      required
                      value={dealBuyerPhone}
                      onChange={(e) => setDealBuyerPhone(e.target.value)}
                      placeholder="e.g. 9845049120"
                      className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-600 dark:text-slate-400 block mb-0.5">Email (Optional)</label>
                    <input
                      type="email"
                      value={dealBuyerEmail}
                      onChange={(e) => setDealBuyerEmail(e.target.value)}
                      placeholder="e.g. user@gmail.com"
                      className="w-full px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* Consideration / Final Price */}
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  {dealOutcome === 'sold' ? 'Final Sale Consideration (₹)' : 'Agreed Monthly Rent (₹)'} *
                </label>
                <input
                  type="number"
                  required
                  value={dealPrice}
                  onChange={(e) => setDealPrice(e.target.value)}
                  placeholder="e.g. 3500000"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-black"
                />
              </div>

              {/* Administrative Audit Notes */}
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Transaction Notes / SRO Registration No.
                </label>
                <textarea
                  rows={2}
                  value={dealNotes}
                  onChange={(e) => setDealNotes(e.target.value)}
                  placeholder="Record registration number, deed details, or lease terms..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-medium resize-none"
                />
              </div>

              {/* Multi-Perspective Sync Guarantee Alert */}
              <div className="bg-emerald-50 dark:bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-900 dark:text-emerald-200 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>Automatic Ecosystem Synchronization:</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-[10.5px] text-emerald-800 dark:text-emerald-300">
                  <li><strong>Admin:</strong> Updates inventory status and auto-completes the visit/call record.</li>
                  <li><strong>Seller:</strong> Marks listing as {dealOutcome.toUpperCase()} in "My Listings" with buyer name and price.</li>
                  <li><strong>Buyer:</strong> Instantly links cadastral deed in "My Purchased Deeds" for {dealBuyerName}.</li>
                </ul>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setDealModalTarget(null)}
                  className="px-3.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDeal}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold rounded-xl text-xs transition-all cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{isSubmittingDeal ? 'Finalizing Deal...' : `Confirm & Close (${dealOutcome === 'sold' ? 'Sold' : 'Rented'})`}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
