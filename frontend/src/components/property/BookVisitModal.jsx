import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, Calendar, Clock, MapPin, ShieldCheck, Loader2, CheckCircle2, 
  AlertCircle, Building2, User 
} from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useProperty } from '../../contexts/PropertyContext';

const VISIT_TIME_SLOTS = [
  { id: '10:00-11:00', label: '10:00 AM – 11:00 AM (Morning Slot)', startH: 10, startM: 0, endH: 11, endM: 0 },
  { id: '11:30-12:30', label: '11:30 AM – 12:30 PM (Mid-Day Slot)', startH: 11, startM: 30, endH: 12, endM: 30 },
  { id: '14:00-15:00', label: '02:00 PM – 03:00 PM (Afternoon Slot)', startH: 14, startM: 0, endH: 15, endM: 0 },
  { id: '16:00-17:00', label: '04:00 PM – 05:00 PM (Late Afternoon)', startH: 16, startM: 0, endH: 17, endM: 0 },
  { id: '17:30-18:30', label: '05:30 PM – 06:30 PM (Sunset Inspection)', startH: 17, startM: 30, endH: 18, endM: 30 }
];

function getMinBookingDateString() {
  const now = new Date();
  // Sunset slot starts at 17:30. If current hour is 17:00 or later, today cannot be booked -> min is tomorrow
  if (now.getHours() >= 17) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }
  return now.toISOString().split('T')[0];
}

function getMaxBookingDateString() {
  const d = new Date();
  d.setDate(d.getDate() + 60);
  return d.toISOString().split('T')[0];
}

export default function BookVisitModal({
  isOpen,
  property,
  onClose,
  onSuccess,
  isMobile = false
}) {
  if (!isOpen || !property) return null;

  const { showToast, currentUser } = useAuth();
  const { loadUserData, myAppointments, createSiteVisitBooking } = useProperty();

  const minBookingDate = useMemo(() => getMinBookingDateString(), []);
  const [visitDate, setVisitDate] = useState(minBookingDate);

  // Filter slots for today that have already passed
  const availableSlots = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    if (visitDate === todayStr) {
      const now = new Date();
      return VISIT_TIME_SLOTS.filter(slot => {
        const slotStart = new Date();
        slotStart.setHours(slot.startH, slot.startM, 0, 0);
        return slotStart > now;
      });
    }
    return VISIT_TIME_SLOTS;
  }, [visitDate]);

  const [visitTimeSlot, setVisitTimeSlot] = useState(() => availableSlots[0]?.id || VISIT_TIME_SLOTS[0].id);

  // Sync slot if selected slot is no longer available on date change
  useEffect(() => {
    if (availableSlots.length > 0 && !availableSlots.some(s => s.id === visitTimeSlot)) {
      setVisitTimeSlot(availableSlots[0].id);
    }
  }, [availableSlots, visitTimeSlot]);

  const [visitNotes, setVisitNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const targetPropId = property._id || property.id;
  const isOwner = currentUser?._id && (property.ownerId === currentUser._id || property.owner_id === currentUser._id);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (isOwner) {
      setErrorMsg('Property owners cannot schedule visits on their own listings.');
      return;
    }

    if (!visitDate) {
      setErrorMsg('Please select a visit date.');
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    if (visitDate < todayStr) {
      setErrorMsg('Cannot schedule visits in the past. Please select an upcoming date.');
      return;
    }

    const slot = availableSlots.find(s => s.id === visitTimeSlot) || availableSlots[0];
    if (!slot) {
      setErrorMsg('No available time slots for the selected date. Please choose another date.');
      return;
    }

    const [year, month, day] = visitDate.split('-').map(Number);
    const startDate = new Date(year, month - 1, day, slot.startH, slot.startM, 0);
    const endDate = new Date(year, month - 1, day, slot.endH, slot.endM, 0);

    if (startDate <= new Date()) {
      setErrorMsg('This time slot has already passed. Please select a future time slot.');
      return;
    }

    // Check client-side duplicate booking
    const hasExistingVisit = (myAppointments || []).some(a => {
      if (a.status === 'cancelled') return false;
      const isSameProp = (a.propertyId === targetPropId || a.propertyTitle === property.title);
      const isSameDate = a.startAt && new Date(a.startAt).toDateString() === startDate.toDateString();
      return isSameProp && isSameDate;
    });

    if (hasExistingVisit) {
      setErrorMsg('You already have a scheduled visit for this property on this date.');
      return;
    }

    setLoading(true);
    try {
      let newBooking = null;
      if (createSiteVisitBooking) {
        newBooking = await createSiteVisitBooking({
          propertyId: targetPropId,
          propertyTitle: property.title,
          customerName: currentUser?.name || 'Citizen Buyer',
          customerPhone: currentUser?.mobile || '+91 98480 12345',
          startAt: startDate.toISOString(),
          endAt: endDate.toISOString(),
          notes: visitNotes.trim()
        });
      } else {
        const res = await api.createAppointment({
          propertyId: targetPropId,
          startAt: startDate.toISOString(),
          endAt: endDate.toISOString(),
          notes: visitNotes.trim()
        });
        newBooking = res.appointment || res;
      }

      showToast('✅ Site visit scheduled with licensed surveyor escort!');
      if (loadUserData) loadUserData();
      if (onSuccess) onSuccess(newBooking);
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to schedule appointment. This slot may already be reserved.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-[9999] animate-in fade-in duration-150">
      <div className={`bg-white rounded-3xl border border-slate-200 shadow-2xl w-full ${isMobile ? 'max-w-sm p-5' : 'max-w-md p-6'} space-y-4`}>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-100 text-[#184631] flex items-center justify-center font-bold shadow-2xs">
              <Calendar className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 font-display">
                Schedule Site Visit
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Licensed Andhra Pradesh Cadastral Surveyor Escort Included
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Property Brief Card */}
        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1">
          <div className="text-xs font-extrabold text-slate-900 line-clamp-1">
            {property.title}
          </div>
          <div className="text-[11px] text-slate-500 flex items-center gap-1">
            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="truncate">{property.location?.address || property.location?.locality || 'Bangalore'}</span>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Booking Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Select Visit Date
            </label>
            <input
              type="date"
              min={minBookingDate}
              max={getMaxBookingDateString()}
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-[#184631] focus:ring-2 focus:ring-emerald-600/10"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Available 60-Minute Slot ({availableSlots.length} available)
            </label>
            <select
              value={visitTimeSlot}
              onChange={(e) => setVisitTimeSlot(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-[#184631] focus:ring-2 focus:ring-emerald-600/10"
            >
              {availableSlots.map(slot => (
                <option key={slot.id} value={slot.id}>
                  {slot.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Inspection Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={visitNotes}
              onChange={(e) => setVisitNotes(e.target.value)}
              placeholder="e.g. Would like to inspect corner survey markers, access road width, or Meebhoomi 1B title deeds"
              className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-[#184631] focus:ring-2 focus:ring-emerald-600/10 resize-none"
            />
          </div>

          <div className="p-3 bg-emerald-50/80 border border-emerald-200/80 rounded-2xl flex items-start gap-2.5 text-[11px] text-emerald-900">
            <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-bold">100% Broker-Free Escort Guarantee</strong>
              <span>A licensed field surveyor will meet you on site with official cadastral boundary maps. 0% brokerage fees.</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-[#184631] hover:bg-[#123625] text-white rounded-xl text-xs font-bold shadow transition-all flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Reserving Slot...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Confirm Site Visit</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

