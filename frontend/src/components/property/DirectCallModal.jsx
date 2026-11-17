import React, { useState, useMemo } from 'react';
import { 
  X, Phone, PhoneCall, ShieldCheck, Clock, MapPin, Loader2, 
  CheckCircle2, AlertCircle, Headphones 
} from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { useProperty } from '../../contexts/PropertyContext';

export function getAvailableCallbackWindows() {
  const now = new Date();
  const currentHour = now.getHours();
  const options = [];

  // Today slots (only offered if still upcoming today)
  if (currentHour < 12) {
    options.push('Today morning (10:00 AM – 01:00 PM)');
  }
  if (currentHour < 16) {
    options.push('Today afternoon (02:00 PM – 05:00 PM)');
  }
  if (currentHour < 19) {
    options.push('Today evening (05:00 PM – 08:00 PM)');
  }

  // Tomorrow slots
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowLabel = tomorrow.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

  options.push(`Tomorrow morning (10:00 AM – 01:00 PM) [${tomorrowLabel}]`);
  options.push(`Tomorrow afternoon (02:00 PM – 05:00 PM) [${tomorrowLabel}]`);
  options.push(`Tomorrow evening (05:00 PM – 08:00 PM) [${tomorrowLabel}]`);

  // Day after tomorrow slots
  const dayAfter = new Date(now);
  dayAfter.setDate(dayAfter.getDate() + 2);
  const dayAfterLabel = dayAfter.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

  options.push(`Day After Tomorrow morning (10:00 AM – 01:00 PM) [${dayAfterLabel}]`);
  options.push(`Day After Tomorrow afternoon (02:00 PM – 05:00 PM) [${dayAfterLabel}]`);

  return options;
}

export default function DirectCallModal({
  isOpen,
  property,
  onClose,
  onSuccess,
  isMobile = false
}) {
  if (!isOpen || !property) return null;

  const { showToast, currentUser } = useAuth();
  const { loadUserData, myCallRequests, createDirectCallRequest } = useProperty();

  const callbackWindows = useMemo(() => getAvailableCallbackWindows(), []);
  const [callWindow, setCallWindow] = useState(() => callbackWindows[0] || 'Tomorrow morning (10:00 AM – 01:00 PM)');
  const [callPhone, setCallPhone] = useState(() => currentUser?.mobile || '');
  const [callNotes, setCallNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const targetPropId = property._id || property.id;
  const isOwner = currentUser?._id && (property.ownerId === currentUser._id || property.owner_id === currentUser._id);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (isOwner) {
      setErrorMsg('Property owners cannot request mediation calls on their own listings.');
      return;
    }

    const cleanPhone = callPhone.trim();
    if (!cleanPhone || cleanPhone.replace(/\D/g, '').length < 8) {
      setErrorMsg('Please enter a valid contact phone number.');
      return;
    }

    // Check duplicate call request
    const hasDuplicateCall = (myCallRequests || []).some(c => {
      const isActive = (c.status === 'pending' || c.status === 'requested' || c.status === 'scheduled');
      const isSameProp = (c.propertyId === targetPropId || c.propertyTitle === property.title);
      const isSameTime = (c.preferredTime || c.preferredTimeWindow || '').trim().toLowerCase() === callWindow.trim().toLowerCase();
      return isActive && isSameProp && isSameTime;
    });

    if (hasDuplicateCall) {
      setErrorMsg(`You already have an active call request for this property during "${callWindow}".`);
      return;
    }

    setLoading(true);
    try {
      let newCall = null;
      if (createDirectCallRequest) {
        newCall = await createDirectCallRequest({
          propertyId: targetPropId,
          propertyTitle: property.title,
          preferredTime: callWindow,
          preferredTimeWindow: callWindow,
          phone: cleanPhone,
          customerPhone: cleanPhone,
          notes: callNotes.trim(),
          customerName: currentUser?.name || 'Citizen Customer'
        });
      } else {
        const res = await api.createCallRequest({
          propertyId: targetPropId,
          preferredTime: callWindow,
          phone: cleanPhone,
          notes: callNotes.trim()
        });
        newCall = res.callRequest || res;
      }

      showToast('📞 Mediation callback scheduled with PlotPin Legal Concierge!');
      if (loadUserData) loadUserData();
      if (onSuccess) onSuccess(newCall);
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to request mediation call.');
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
            <div className="w-9 h-9 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold shadow-2xs">
              <PhoneCall className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 font-display">
                Direct Call Desk
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Zero Brokers · Official Legal &amp; Price Concierge
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

        {/* Direct Hotline Quick Call Banner */}
        <div className="bg-gradient-to-r from-blue-900 to-indigo-950 p-4 rounded-2xl text-white space-y-2.5 border border-blue-800 shadow-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-xs font-bold text-slate-100">Official PlotPin Mediator Hotline</span>
          </div>
          <p className="text-[11px] text-slate-300 leading-relaxed">
            Speak directly with the Regional Admin Mediator on duty for instant title inquiry, inspection coordination, or price settlement:
          </p>
          <a
            href="tel:+918041900001"
            className="w-full py-2.5 px-3 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow transition-all active:scale-95 cursor-pointer"
          >
            <Phone className="w-4 h-4 text-slate-950" />
            <span>Call Hotline: +91 80 4190 0001</span>
          </a>
        </div>

        {/* Divider */}
        <div className="relative flex items-center py-1">
          <div className="flex-grow border-t border-slate-200"></div>
          <span className="shrink-0 mx-2 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            or schedule mediation callback
          </span>
          <div className="flex-grow border-t border-slate-200"></div>
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

        {/* Callback Request Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Preferred Callback Window
            </label>
            <select
              value={callWindow}
              onChange={(e) => setCallWindow(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10"
            >
              {callbackWindows.map(w => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Your Contact Phone Number
            </label>
            <input
              type="text"
              value={callPhone}
              onChange={(e) => setCallPhone(e.target.value)}
              placeholder="+91 98450 XXXXX"
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 font-mono"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Mediation Topic / Offer Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={callNotes}
              onChange={(e) => setCallNotes(e.target.value)}
              placeholder="e.g. Inquiring regarding Meebhoomi 1B title verification or proposing an initial earnest offer to the owner."
              className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/10 resize-none"
            />
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
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow transition-all flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>Request Callback</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

