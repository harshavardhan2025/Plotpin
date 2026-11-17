import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar, Layers, Clock, AlertCircle, PhoneCall,
  Compass
} from 'lucide-react';
import { useProperty } from '../../contexts/PropertyContext';
import { useAuth } from '../../contexts/AuthContext';
import AppointmentsCalendarView from '../../components/property/AppointmentsCalendarView';
import RescheduleVisitModal from '../../components/property/RescheduleVisitModal';
import { api } from '../../lib/api';

export default function SiteVisitsPage() {
  const { showToast } = useAuth();
  const {
    myAppointments,
    setMyAppointments,
    myCallRequests,
    updateBookingStatus,
    isMobile
  } = useProperty();

  const [visitViewMode, setVisitViewMode] = useState('list'); // 'list' | 'calendar'
  const [activeTab, setActiveTab] = useState('bookings'); // 'bookings' | 'calls' | 'closed'
  const [reschedulingApt, setReschedulingApt] = useState(null);
  const [cancellingAptId, setCancellingAptId] = useState(null);

  const activeBookings = useMemo(() => {
    return myAppointments.filter(a => a.status === 'confirmed');
  }, [myAppointments]);

  const activeCalls = useMemo(() => {
    return myCallRequests.filter(c => c.status === 'pending' || c.status === 'scheduled');
  }, [myCallRequests]);

  const closedApts = useMemo(() => {
    return myAppointments.filter(a => a.status === 'rejected' || a.status === 'cancelled');
  }, [myAppointments]);

  const closedCalls = useMemo(() => {
    return myCallRequests.filter(c => c.status === 'rejected' || c.status === 'cancelled' || c.status === 'missed');
  }, [myCallRequests]);

  const closedCount = closedApts.length + closedCalls.length;

  const handleCancelAppointment = async (aptId) => {
    const confirm = window.confirm('Are you sure you want to cancel this scheduled site visit?');
    if (!confirm) return;

    setCancellingAptId(aptId);
    try {
      if (typeof updateBookingStatus === 'function') {
        await updateBookingStatus(aptId, 'cancelled', 'Cancelled by citizen');
      } else {
        await api.cancelAppointment(aptId, 'Cancelled by citizen');
        setMyAppointments((prev) =>
          prev.map((a) => ((a._id === aptId || a.id === aptId) ? { ...a, status: 'cancelled' } : a))
        );
      }
      showToast('Site visit cancelled.');
    } catch (err) {
      showToast(err.message || 'Failed to cancel appointment');
    } finally {
      setCancellingAptId(null);
    }
  };

  return (
    <div className={`space-y-4 max-w-7xl mx-auto ${isMobile ? 'p-3 pb-24' : 'p-6'}`}>
      {/* Clean Header & View Mode Switcher */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <h2 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
          <Calendar className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0" />
          <span>Site Visits &amp; Calls</span>
        </h2>

        <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setVisitViewMode('list')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              visitViewMode === 'list'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>List</span>
          </button>
          <button
            type="button"
            onClick={() => setVisitViewMode('calendar')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              visitViewMode === 'calendar'
                ? 'bg-[#184631] text-white shadow-2xs dark:bg-emerald-600'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Calendar</span>
          </button>
        </div>
      </div>

      {/* Main View Container */}
      {visitViewMode === 'calendar' ? (
        <AppointmentsCalendarView
          appointments={myAppointments}
          onReschedule={(apt) => setReschedulingApt(apt)}
          onCancel={handleCancelAppointment}
          cancellingAptId={cancellingAptId}
        />
      ) : (
        <div className="space-y-4">
          {/* Simple Clean Tab Bar - Single Row */}
          <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveTab('bookings')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'bookings'
                  ? 'bg-[#184631] text-white font-bold shadow-2xs dark:bg-emerald-600'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Bookings ({activeBookings.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('calls')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'calls'
                  ? 'bg-[#184631] text-white font-bold shadow-2xs dark:bg-emerald-600'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Calls ({activeCalls.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('closed')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'closed'
                  ? 'bg-rose-700 text-white font-bold shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>Closed ({closedCount})</span>
            </button>
          </div>

          {/* TAB 1: BOOKINGS */}
          {activeTab === 'bookings' && (
            <div className="max-w-2xl space-y-3">
              {activeBookings.length === 0 ? (
                <div className="bg-white dark:bg-[#131E31] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-2">
                  <Calendar className="w-7 h-7 text-slate-300 dark:text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-500 dark:text-slate-400">No active visits scheduled</p>
                  <Link
                    to="/explore"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline pt-1"
                  >
                    <span>Explore Properties →</span>
                  </Link>
                </div>
              ) : (
                activeBookings.map((apt) => {
                  const isPast = Date.now() >= new Date(apt.endAt || new Date(apt.startAt).getTime() + 3600000).getTime();
                  return (
                    <div key={apt._id || apt.id} className="bg-white dark:bg-[#131E31] p-3.5 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">{apt.propertyTitle}</h4>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                          {apt.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Slot: {new Date(apt.startAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>

                      {!isPast && (
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                          <button
                            type="button"
                            onClick={() => setReschedulingApt(apt)}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <Clock className="w-3 h-3" />
                            <span>Reschedule</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCancelAppointment(apt._id || apt.id)}
                            className="px-2.5 py-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg text-xs font-bold transition-all cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: CALLS */}
          {activeTab === 'calls' && (
            <div className="max-w-2xl space-y-3">
              {activeCalls.length === 0 ? (
                <div className="bg-white dark:bg-[#131E31] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-2">
                  <PhoneCall className="w-7 h-7 text-slate-300 dark:text-slate-600 mx-auto" />
                  <p className="text-xs text-slate-500 dark:text-slate-400">No active calls requested</p>
                  <Link
                    to="/explore"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline pt-1"
                  >
                    <span>Explore Properties →</span>
                  </Link>
                </div>
              ) : (
                activeCalls.map((call) => (
                  <div key={call._id || call.id} className="bg-white dark:bg-[#131E31] p-3.5 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">{call.propertyTitle || 'Mediation Callback'}</h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300">
                        {call.status || 'Requested'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Time Window: {call.preferredTime || call.preferredTimeWindow || 'Scheduled Callback'}
                    </p>
                    {call.notes && !call.notes.toLowerCase().includes('inbound callback requested') && (
                      <p className="text-[11px] text-slate-400 italic">
                        &quot;{call.notes}&quot;
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 3: CLOSED DEALS */}
          {activeTab === 'closed' && (
            <div className="max-w-2xl space-y-3">
              {closedCount === 0 ? (
                <div className="bg-white dark:bg-[#131E31] p-6 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-2">
                  <p className="text-xs text-slate-500 dark:text-slate-400">No closed or rejected deals</p>
                </div>
              ) : (
                <>
                  {closedApts.map((apt) => (
                    <div key={apt._id || apt.id} className="bg-white dark:bg-[#131E31] p-3.5 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">{apt.propertyTitle}</h4>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300">
                          {apt.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Slot: {new Date(apt.startAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>

                      <div className="p-3 rounded-xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 space-y-2 text-xs">
                        <div className="flex items-start gap-2 text-amber-900 dark:text-amber-200">
                          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <p className="font-bold text-xs text-amber-950 dark:text-amber-100">
                              Deal Closed with Another Customer
                            </p>
                            <p className="text-[11px] leading-relaxed text-amber-900 dark:text-amber-200">
                              Sorry for the rejection: this deal on <strong>{apt.propertyTitle}</strong> was finalized with another buyer. Your scheduled visit is cancelled. Explore similar verified properties below.
                            </p>
                          </div>
                        </div>
                        <Link
                          to="/explore"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#184631] hover:bg-[#123625] text-white font-semibold text-xs transition-colors shadow-2xs"
                        >
                          <Compass className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Explore Similar Properties →</span>
                        </Link>
                      </div>
                    </div>
                  ))}

                  {closedCalls.map((call) => (
                    <div key={call._id || call.id} className="bg-white dark:bg-[#131E31] p-3.5 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white truncate">{call.propertyTitle || 'Mediation Callback'}</h4>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300">
                          {call.status || 'Closed'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Time Window: {call.preferredTime || call.preferredTimeWindow || 'Scheduled Callback'}
                      </p>

                      <div className="p-3 rounded-xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 space-y-2 text-xs">
                        <div className="flex items-start gap-2 text-amber-900 dark:text-amber-200">
                          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <p className="font-bold text-xs text-amber-950 dark:text-amber-100">
                              Deal Closed with Another Customer
                            </p>
                            <p className="text-[11px] leading-relaxed text-amber-900 dark:text-amber-200">
                              Sorry for the rejection: this deal on <strong>{call.propertyTitle || 'Property'}</strong> was finalized with another buyer. Your callback is closed. You can explore similar verified properties below.
                            </p>
                          </div>
                        </div>
                        <Link
                          to="/explore"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#184631] hover:bg-[#123625] text-white font-semibold text-xs transition-colors shadow-2xs"
                        >
                          <Compass className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Explore Similar Properties →</span>
                        </Link>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Reschedule Visit Modal */}
      {reschedulingApt && (
        <RescheduleVisitModal
          isOpen={Boolean(reschedulingApt)}
          appointment={reschedulingApt}
          onClose={() => setReschedulingApt(null)}
          onSuccess={async (updated) => {
            const aptId = updated._id || updated.id;
            if (typeof updateBookingStatus === 'function') {
              await updateBookingStatus(aptId, 'rescheduled', updated.notes || 'Rescheduled by citizen', updated.startAt);
            }
            setMyAppointments((prev) => {
              const next = prev.map((a) => ((a._id === aptId || a.id === aptId) ? { ...a, ...updated, status: 'rescheduled' } : a));
              try {
                localStorage.setItem('plotpin_my_appointments', JSON.stringify(next));
              } catch (e) {}
              return next;
            });
            setReschedulingApt(null);
            showToast('✅ Visit successfully rescheduled!');
          }}
        />
      )}
    </div>
  );
}