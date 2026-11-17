import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, 
  MapPin, CheckCircle, RefreshCw, X, AlertCircle, Building2, Eye,
  ShieldCheck, ArrowRight, Compass
} from 'lucide-react';

export default function AppointmentsCalendarView({
  appointments = [],
  onReschedule,
  onCancel,
  onSelectProperty,
  isMobile = false
}) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const upcoming = (appointments || [])
      .filter(a => a.startAt && new Date(a.startAt).getTime() >= today.getTime() && a.status === 'confirmed')
      .sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
    if (upcoming.length > 0 && !appointments.some(a => a.startAt && a.startAt.startsWith(todayKey))) {
      const firstD = new Date(upcoming[0].startAt);
      return `${firstD.getFullYear()}-${String(firstD.getMonth() + 1).padStart(2, '0')}-${String(firstD.getDate()).padStart(2, '0')}`;
    }
    return todayKey;
  });
  const [statusFilter, setStatusFilter] = useState('confirmed'); // 'confirmed' | 'cancelled'

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`);
  };

  // Days in month calculation
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sunday

  // Group appointments by date string YYYY-MM-DD
  const appointmentsByDate = useMemo(() => {
    const map = {};
    appointments.forEach(apt => {
      if (!apt.startAt) return;
      const d = new Date(apt.startAt);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!map[key]) map[key] = [];
      map[key].push(apt);
    });
    return map;
  }, [appointments]);

  // Filtered appointments for the selected date
  const selectedDateAppointments = useMemo(() => {
    if (statusFilter === 'cancelled') {
      return (appointments || []).filter(a => a.status === 'cancelled' || a.status === 'rejected');
    }
    const list = appointmentsByDate[selectedDate] || [];
    if (statusFilter === 'all') return list;
    return list.filter(a => {
      const isPast = Date.now() >= new Date(a.endAt || new Date(a.startAt).getTime() + 3600000).getTime();
      const effStatus = isPast && a.status === 'confirmed' ? 'completed' : a.status;
      return effStatus === statusFilter;
    });
  }, [appointments, appointmentsByDate, selectedDate, statusFilter]);

  // Upcoming appointments across all dates for convenience
  const upcomingAppointments = useMemo(() => {
    const now = Date.now();
    return appointments
      .filter(a => new Date(a.startAt).getTime() >= now && a.status === 'confirmed')
      .sort((a, b) => new Date(a.startAt) - new Date(b.startAt))
      .slice(0, 5);
  }, [appointments]);

  const totalConfirmed = appointments.filter(a => a.status === 'confirmed').length;
  const totalCompleted = appointments.filter(a => a.status === 'completed' || (Date.now() >= new Date(a.endAt || a.startAt).getTime() && a.status !== 'cancelled' && a.status !== 'rejected')).length;
  const totalCancelled = appointments.filter(a => a.status === 'cancelled' || a.status === 'rejected').length;

  const todayStr = (() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  })();

  const selectedDateFormatted = useMemo(() => {
    try {
      const [y, m, d] = selectedDate.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      return dateObj.toLocaleDateString('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return selectedDate;
    }
  }, [selectedDate]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* LEFT COLUMN: Compact Month Calendar Widget */}
      <div className="lg:col-span-7 bg-white dark:bg-[#131E31] p-5 sm:p-6 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-5">
        {/* Calendar Navigation & Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center transition-all active:scale-95 cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <h3 className="font-extrabold text-base text-slate-900 dark:text-white min-w-[140px] text-center tracking-tight">
              {monthNames[month]} {year}
            </h3>

            <button
              type="button"
              onClick={handleNextMonth}
              className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center transition-all active:scale-95 cursor-pointer"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleToday}
              className="text-xs font-bold text-[#184631] dark:text-emerald-300 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-700/60 transition-colors ml-1 active:scale-95 cursor-pointer"
            >
              Today
            </button>
          </div>

          {/* Status Filter Tabs - 2 clean buttons: Confirmed & Closed/Cancelled */}
          <div className="flex items-center gap-1 bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-xl self-start sm:self-auto overflow-x-auto text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setStatusFilter('confirmed')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                statusFilter === 'confirmed'
                  ? 'bg-emerald-700 text-white shadow-2xs font-extrabold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Confirmed ({totalConfirmed})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('cancelled')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                statusFilter === 'cancelled'
                  ? 'bg-rose-700 text-white shadow-2xs font-extrabold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Closed / Cancelled ({totalCancelled})
            </button>
          </div>
        </div>

        {/* Compact Calendar Grid */}
        <div className="max-w-md mx-auto sm:max-w-none">
          {/* Weekday Labels */}
          <div className="grid grid-cols-7 gap-1 text-center font-bold text-[11px] text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
            <span>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {/* Blank leading days */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`blank-${i}`} className="aspect-square max-h-12 rounded-xl" />
            ))}

            {/* Calendar day buttons */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const isToday = dayStr === todayStr;
              const isSelected = dayStr === selectedDate;
              const dayApts = appointmentsByDate[dayStr] || [];
              const hasConfirmed = dayApts.some(a => a.status === 'confirmed');

              return (
                <button
                  key={`day-${dayNum}`}
                  type="button"
                  onClick={() => setSelectedDate(dayStr)}
                  className={`aspect-square max-h-12 w-full rounded-2xl flex flex-col items-center justify-center relative transition-all active:scale-95 cursor-pointer ${
                    isSelected
                      ? 'bg-[#184631] text-white shadow-md shadow-emerald-950/20 ring-4 ring-emerald-600/10 font-black'
                      : isToday
                        ? 'border-2 border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300 font-extrabold'
                        : dayApts.length > 0
                          ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 text-emerald-950 dark:text-emerald-200 font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold'
                  }`}
                >
                  <span className="text-xs sm:text-sm leading-none">{dayNum}</span>

                  {/* Dot indicator if day has appointments */}
                  {dayApts.length > 0 && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full mt-1 ${
                        isSelected
                          ? 'bg-amber-300'
                          : hasConfirmed
                            ? 'bg-emerald-600'
                            : 'bg-slate-400'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#184631]" />
            <span>Selected Date</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full border border-emerald-500 bg-emerald-50 dark:bg-emerald-950" />
            <span>Today</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-600" />
            <span>Visit Booked</span>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Selected Date Agenda & Upcoming Inspections */}
      <div className="lg:col-span-5 space-y-4">
        {/* Selected Date Header Card */}
        <div className="bg-white dark:bg-[#131E31] p-5 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                {statusFilter === 'cancelled' ? 'Closed Records' : 'Itinerary'}
              </span>
              <h4 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-1.5 mt-0.5">
                <CalendarIcon className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                <span>{statusFilter === 'cancelled' ? 'Closed / Cancelled Visits' : selectedDateFormatted}</span>
              </h4>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              selectedDateAppointments.length > 0
                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
            }`}>
              {selectedDateAppointments.length} Visit{selectedDateAppointments.length === 1 ? '' : 's'}
            </span>
          </div>

          {/* Visits List for the Selected Day */}
          {selectedDateAppointments.length === 0 ? (
            <div className="py-6 text-center space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center mx-auto">
                <Clock className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">No visits on this date</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 max-w-xs mx-auto">
                  Select a date with a green indicator or explore listings to schedule a visit.
                </p>
              </div>
              <Link
                to="/explore"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-700/60 transition-colors"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Explore Properties</span>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {selectedDateAppointments.map((apt) => {
                const startDate = new Date(apt.startAt);
                const endDate = new Date(apt.endAt || startDate.getTime() + 3600000);
                const isPast = Date.now() >= endDate.getTime() || apt.status === 'completed';
                const displayStatus = isPast && apt.status === 'confirmed' ? 'completed' : apt.status;

                return (
                  <div
                    key={apt._id || apt.id}
                    className="p-3 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/60 space-y-2 shadow-2xs hover:border-emerald-300 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5 min-w-0">
                        <h5 className="font-bold text-xs text-slate-900 dark:text-white truncate">
                          {apt.propertyTitle || 'Property Site Inspection'}
                        </h5>
                        <p className="text-[11px] text-[#184631] dark:text-emerald-400 font-semibold flex items-center gap-1">
                          <Clock className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
                          <span>
                            {startDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} – {endDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </p>
                      </div>

                      <span className={`shrink-0 text-[9.5px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                        displayStatus === 'completed'
                          ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                          : displayStatus === 'confirmed'
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                            : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 line-through'
                      }`}>
                        {displayStatus}
                      </span>
                    </div>

                    {apt.notes && !apt.notes.toLowerCase().includes('inbound callback requested') && (
                      <p className="text-[10.5px] text-slate-500 dark:text-slate-400 italic">
                        &quot;{apt.notes}&quot;
                      </p>
                    )}

                    {(displayStatus === 'cancelled' || displayStatus === 'rejected') && (
                      <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 space-y-2 text-xs">
                        <div className="flex items-start gap-1.5 text-amber-900 dark:text-amber-200">
                          <span className="text-sm">⚠️</span>
                          <div className="space-y-0.5">
                            <p className="font-bold text-[11px] text-amber-950 dark:text-amber-100">
                              Deal Closed with Another Customer
                            </p>
                            <p className="text-[10.5px] leading-relaxed text-amber-900 dark:text-amber-200">
                              {apt.cancellationReason || `Sorry for the rejection: this deal on "${apt.propertyTitle || 'Property'}" was finalized with another buyer. Your scheduled visit is cancelled. Explore similar verified properties below.`}
                            </p>
                          </div>
                        </div>
                        <Link
                          to="/explore"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#184631] hover:bg-[#123625] text-white font-semibold text-[10px] transition-all shadow-xs cursor-pointer ml-5"
                        >
                          <Compass className="w-3 h-3 text-emerald-400" />
                          <span>Explore Similar Properties →</span>
                        </Link>
                      </div>
                    )}

                    {/* Action buttons */}
                    {displayStatus === 'confirmed' && !isPast && (
                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-800 text-xs">
                        <button
                          type="button"
                          onClick={() => onReschedule && onReschedule(apt)}
                          className="px-2.5 py-1 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
                          <span>Reschedule</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onCancel && onCancel(apt._id || apt.id)}
                          className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                          <span>Cancel</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Upcoming Inspections Quick List (Always accessible) */}
        {upcomingAppointments.length > 0 && (
          <div className="bg-white dark:bg-[#131E31] p-5 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-3">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
              <span>Upcoming Visits</span>
            </h4>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {upcomingAppointments.map((apt) => {
                const sDate = new Date(apt.startAt);
                return (
                  <div
                    key={`upcoming-${apt._id || apt.id}`}
                    onClick={() => {
                      const dKey = `${sDate.getFullYear()}-${String(sDate.getMonth() + 1).padStart(2, '0')}-${String(sDate.getDate()).padStart(2, '0')}`;
                      setCurrentDate(new Date(sDate.getFullYear(), sDate.getMonth(), 1));
                      setSelectedDate(dKey);
                    }}
                    className="py-2.5 flex items-center justify-between gap-2 hover:bg-slate-50/80 dark:hover:bg-slate-800/80 px-2 rounded-xl transition-colors cursor-pointer group"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 truncate">
                        {apt.propertyTitle}
                      </p>
                      <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
                        {sDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} at {sDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 shrink-0" />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
