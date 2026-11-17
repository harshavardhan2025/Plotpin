import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Building2, Calendar, PhoneCall, Headphones, Users, FileText, 
  Settings, ArrowUpRight, ArrowRight, CheckCircle2, ShieldCheck, Clock, 
  TrendingUp, Tag, Plus, AlertCircle, Sparkles, MapPin, DollarSign
} from 'lucide-react';
import { useProperty } from '../../../contexts/PropertyContext';
import { formatINR } from '../../../utils/propertyHelpers';

function formatLogAction(action) {
  if (!action) return 'Admin Activity Logged';
  const map = {
    'PROPERTY_PERMANENTLY_REMOVED': 'Property Listing Delisted & Purged',
    'PROPERTY_REVISION_SUBMITTED': 'Specification Revision Submitted',
    'PROPERTY_APPROVED': 'Cadastral Deed Approved & Published',
    'PROPERTY_REJECTED': 'Title Verification Rejected',
    'STATUS_SOLD': 'Property Marked as Sold Out',
    'STATUS_RENTED': 'Property Marked as Rented Out',
    'PROPERTY_SOLD_DEAL_CLOSED': 'Deal Finalized (Sold Out)',
    'PROPERTY_RENTED_DEAL_CLOSED': 'Deal Finalized (Rented Out)',
    'BOOKING_CONFIRMED': 'Site Visit Confirmed',
    'BOOKING_REJECTED': 'Site Visit Rejected',
    'BOOKING_CANCELLED': 'Site Visit Cancelled',
    'CALL_COMPLETED': 'Phone Consultation Completed',
    'CALL_REJECTED': 'Call Request Rejected',
    'ESCROW_RELEASED': 'Escrow Consideration Released',
    'ESCROW_FROZEN': 'Escrow Disputed / Frozen'
  };
  return map[action] || action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function formatActor(actorId, actorName) {
  if (actorName) return actorName;
  if (!actorId) return 'Super Admin';
  if (actorId === 'usr_client_001') return 'Vikramaditya Rao (Owner)';
  if (actorId.startsWith('usr_')) return `Registered User (${actorId.slice(-4)})`;
  return actorId;
}

export default function SuperAdminOverview() {
  const navigate = useNavigate();
  const { 
    properties = [],
    adminApprovedProperties = [], 
    adminQueue = [],
    adminAppointments = [], 
    adminCalls = [], 
    adminTickets = [], 
    adminCustomers = [],
    auditLogs = [],
    handleOpenCreateModal,
    isMobile
  } = useProperty();

  const propsList = Array.isArray(adminApprovedProperties) ? adminApprovedProperties : [];
  const bookingsList = Array.isArray(adminAppointments) ? adminAppointments : [];
  const callsList = Array.isArray(adminCalls) ? adminCalls : [];
  const ticketsList = Array.isArray(adminTickets) ? adminTickets : [];
  const queueList = Array.isArray(adminQueue) ? adminQueue : [];
  const customersList = Array.isArray(adminCustomers) ? adminCustomers : [];
  const logsList = Array.isArray(auditLogs) ? auditLogs : [];

  const totalProps = propsList.length;
  const soldCount = propsList.filter(p => p.availabilityStatus === 'sold').length;
  const rentedCount = propsList.filter(p => p.availabilityStatus === 'rented').length;
  const availableCount = propsList.filter(p => !p.availabilityStatus || p.availabilityStatus === 'available').length;

  const pendingBookings = bookingsList.filter(a => {
    const s = (typeof a.status === 'string' ? a.status : (a.status?.status || '')).toLowerCase();
    return s !== 'rejected' && s !== 'cancelled' && s !== 'completed' && (s === 'pending' || s === 'confirmed' || s === 'rescheduled');
  }).length;
  const pendingCalls = callsList.filter(c => {
    const s = (typeof c.status === 'string' ? c.status : (c.status?.status || '')).toLowerCase();
    return s !== 'rejected' && s !== 'cancelled' && s !== 'completed' && s !== 'missed' && (s === 'pending' || s === 'follow_up' || s === 'requested' || s === 'scheduled');
  }).length;
  const openTickets = ticketsList.filter(t => t.status === 'open' || t.status === 'in_progress').length;

  return (
    <div className="space-y-6">
      {/* 6 Pillar Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Verifications Pillar */}
        <div 
          onClick={() => navigate('/admin/verifications')}
          className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-emerald-500/40 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Verifications</span>
            <span className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 group-hover:scale-110 transition-transform">
              <ShieldCheck className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">{queueList.length}</div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            <span className="text-emerald-600 font-bold">{queueList.length} Deeds Pending Review</span>
          </div>
        </div>

        {/* Properties Pillar */}
        <div 
          onClick={() => navigate('/admin/properties')}
          className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-emerald-500/40 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Properties</span>
            <span className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 group-hover:scale-110 transition-transform">
              <Building2 className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">{availableCount}</div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
            <span className="text-emerald-600 font-bold">{availableCount} Available</span> · 
            <span className="text-rose-600 font-bold">{soldCount + rentedCount} Sold / Rented</span>
          </div>
        </div>

        {/* Combined Book & Call Pillar */}
        <div 
          onClick={() => navigate('/admin/bookings')}
          className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-indigo-500/40 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Book &amp; Call</span>
            <span className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 group-hover:scale-110 transition-transform">
              <Calendar className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">
            {pendingBookings + pendingCalls}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            <span className="text-amber-600 font-bold">{pendingBookings + pendingCalls} Active Present</span>
            <span className="text-slate-400 ml-1">({bookingsList.length + callsList.length} total)</span>
          </div>
        </div>

        {/* Support Pillar */}
        <div 
          onClick={() => navigate('/admin/support')}
          className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-rose-500/40 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Support</span>
            <span className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 group-hover:scale-110 transition-transform">
              <Headphones className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">{openTickets}</div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            {openTickets > 0 ? (
              <span className="text-rose-600 font-bold">{openTickets} Present (Open) · {ticketsList.length} Total</span>
            ) : (
              <span className="text-emerald-600 font-bold">100% Resolved SLA ({ticketsList.length} Total)</span>
            )}
          </div>
        </div>

        {/* Customers Pillar */}
        <div 
          onClick={() => navigate('/admin/customers')}
          className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-teal-500/40 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Customer Directory</span>
            <span className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400 group-hover:scale-110 transition-transform">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">{customersList.length}</div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            <span className="text-teal-700 dark:text-teal-400 font-bold">Verified User Accounts</span>
          </div>
        </div>

        {/* Reports Pillar */}
        <div 
          onClick={() => navigate('/admin/reports')}
          className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-purple-500/40 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Reports &amp; Analytics</span>
            <span className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 group-hover:scale-110 transition-transform">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-purple-700 dark:text-purple-400 mt-2">Live</div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            <span className="text-purple-700 dark:text-purple-400 font-bold">Telemetry &amp; SLA Auditing</span>
          </div>
        </div>
      </div>

      {/* Super Admin Fast Action Switchboard */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <h3 className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-600" />
          <span>Super Admin Fast Control Switchboard</span>
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5">
          <button
            type="button"
            onClick={() => navigate('/admin/properties')}
            className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 text-left transition-all cursor-pointer"
          >
            <Building2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 mb-1" />
            <div className="font-black text-xs text-emerald-900 dark:text-emerald-200">Manage Properties</div>
            <p className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-0.5">Audit &amp; update listings</p>
          </button>

          <button
            type="button"
            onClick={() => navigate('/admin/verifications')}
            className="p-3 rounded-2xl bg-teal-50 dark:bg-teal-950/50 hover:bg-teal-100 dark:hover:bg-teal-900/60 border border-teal-200 dark:border-teal-800 text-left transition-all cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4 text-teal-700 dark:text-teal-400 mb-1" />
            <div className="font-black text-xs text-teal-900 dark:text-teal-200">Deed Verification</div>
            <p className="text-[10px] text-teal-700 dark:text-teal-400 mt-0.5">Cadastral &amp; RERA audit</p>
          </button>

          <button
            type="button"
            onClick={() => navigate('/admin/properties')}
            className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800 text-left transition-all cursor-pointer"
          >
            <Tag className="w-4 h-4 text-rose-700 dark:text-rose-400 mb-1" />
            <div className="font-black text-xs text-rose-900 dark:text-rose-200">Mark Sold / Rented</div>
            <p className="text-[10px] text-rose-700 dark:text-rose-400 mt-0.5">Close deal &amp; update status</p>
          </button>

          <button
            type="button"
            onClick={() => navigate('/admin/bookings')}
            className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 text-left transition-all cursor-pointer"
          >
            <Calendar className="w-4 h-4 text-indigo-700 dark:text-indigo-400 mb-1" />
            <div className="font-black text-xs text-indigo-900 dark:text-indigo-200">Book &amp; Call</div>
            <p className="text-[10px] text-indigo-700 dark:text-indigo-400 mt-0.5">Manage visits &amp; callbacks</p>
          </button>

          <button
            type="button"
            onClick={() => navigate('/admin/support')}
            className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 border border-amber-200 dark:border-amber-800 text-left transition-all cursor-pointer"
          >
            <Headphones className="w-4 h-4 text-amber-700 dark:text-amber-400 mb-1" />
            <div className="font-black text-xs text-amber-900 dark:text-amber-200">Resolve Tickets</div>
            <p className="text-[10px] text-amber-700 dark:text-amber-400 mt-0.5">Customer dispute replies</p>
          </button>

          <button
            type="button"
            onClick={() => navigate('/admin/customers')}
            className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 text-left transition-all cursor-pointer"
          >
            <Users className="w-4 h-4 text-blue-700 dark:text-blue-400 mb-1" />
            <div className="font-black text-xs text-blue-900 dark:text-blue-200">Customer Accounts</div>
            <p className="text-[10px] text-blue-700 dark:text-blue-400 mt-0.5">View user directory</p>
          </button>

          <button
            type="button"
            onClick={() => navigate('/admin/reports')}
            className="p-3 rounded-2xl bg-purple-50 dark:bg-purple-950/50 hover:bg-purple-100 dark:hover:bg-purple-900/60 border border-purple-200 dark:border-purple-800 text-left transition-all cursor-pointer"
          >
            <TrendingUp className="w-4 h-4 text-purple-700 dark:text-purple-400 mb-1" />
            <div className="font-black text-xs text-purple-900 dark:text-purple-200">Platform Reports</div>
            <p className="text-[10px] text-purple-700 dark:text-purple-400 mt-0.5">Analytics &amp; CSV export</p>
          </button>
        </div>
      </div>

      {/* Two Column Section: Recent Platform Activity & Pending Customer Inquiries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: Recent Activity Feed */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <h4 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Recent Super Admin Event Log</span>
            </h4>
            <Link to="/admin/audit" className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline">
              View Full Audit Trail →
            </Link>
          </div>

          <div className="space-y-2.5">
            {logsList.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No recent administrative events logged.
              </div>
            ) : (
              logsList.slice(0, 5).map((log, idx) => {
                const actionLabel = formatLogAction(log.action || log.type);
                const actorLabel = formatActor(log.actorId, log.actorName);
                const assetId = log.propertyId || log.targetId;

                return (
                  <div key={idx} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-extrabold text-slate-900 dark:text-white text-[11px]">
                          {actionLabel}
                        </span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 text-[11px] leading-relaxed">
                        {log.details || log.notes || 'Administrative action recorded.'}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <span>Actor: <strong className="text-slate-600 dark:text-slate-300 font-semibold">{actorLabel}</strong></span>
                        {assetId && assetId !== '-' && (
                          <span>· Asset #{String(assetId).slice(-6)}</span>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 shrink-0">
                      {new Date(log.timestamp || Date.now()).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Urgent Customer Action Queue */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <h4 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              <span>Urgent Customer Requests Queue</span>
            </h4>
            <span className={`text-xs font-bold ${
              (pendingBookings + pendingCalls + openTickets) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'
            }`}>
              {pendingBookings + pendingCalls + openTickets} Pending Actions
            </span>
          </div>

          <div className="space-y-2.5">
            {(() => {
              const activeBookings = bookingsList.filter(a => {
                const s = (typeof a.status === 'string' ? a.status : (a.status?.status || '')).toLowerCase();
                return s !== 'rejected' && s !== 'cancelled' && s !== 'completed' && (s === 'pending' || s === 'confirmed' || s === 'rescheduled');
              });
              const activeCalls = callsList.filter(c => {
                const s = (typeof c.status === 'string' ? c.status : (c.status?.status || '')).toLowerCase();
                return s !== 'rejected' && s !== 'cancelled' && s !== 'completed' && s !== 'missed' && (s === 'pending' || s === 'follow_up' || s === 'requested' || s === 'scheduled');
              });
              const activeTickets = ticketsList.filter(t => t.status === 'open' || t.status === 'in_progress');
              const totalActive = activeBookings.length + activeCalls.length + activeTickets.length;

              if (totalActive === 0) {
                return (
                  <div className="py-8 text-center space-y-2.5">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-200 dark:border-emerald-800/60">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <h5 className="font-extrabold text-sm text-slate-900 dark:text-white">
                        All Customer Requests Addressed
                      </h5>
                      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                        There are currently no urgent site visit bookings, phone callbacks, or tickets pending admin action.
                      </p>
                    </div>
                    <Link
                      to="/admin/bookings"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors"
                    >
                      <span>View Bookings &amp; Call History</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                );
              }

              return (
                <>
                  {activeBookings.slice(0, 2).map((apt) => (
                    <div key={apt._id || apt.id} className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-indigo-900 dark:text-indigo-200">Site Visit Booking</span>
                          <span className="text-[10px] bg-indigo-200 dark:bg-indigo-900 text-indigo-950 dark:text-indigo-200 font-extrabold px-1.5 py-0.2 rounded uppercase">
                            {typeof apt.status === 'string' ? apt.status : (apt.status?.status || 'pending')}
                          </span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 text-[11px] mt-0.5">
                          {apt.customerName} ({apt.customerPhone}) · {apt.propertyTitle}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate('/admin/bookings')}
                        className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-bold text-[11px] shadow-2xs hover:bg-indigo-700 cursor-pointer"
                      >
                        Manage
                      </button>
                    </div>
                  ))}

                  {activeCalls.slice(0, 2).map((call) => (
                    <div key={call._id || call.id} className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-blue-900 dark:text-blue-200">Customer Call Request</span>
                          <span className="text-[10px] bg-blue-200 dark:bg-blue-900 text-blue-950 dark:text-blue-200 font-extrabold px-1.5 py-0.2 rounded uppercase">
                            {typeof call.status === 'string' ? call.status : (call.status?.status || 'pending')}
                          </span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 text-[11px] mt-0.5">
                          {call.customerName || 'Inquirer'} · {call.preferredTime || call.preferredTimeWindow || 'Immediate'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate('/admin/bookings')}
                        className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-bold text-[11px] shadow-2xs hover:bg-blue-700 cursor-pointer"
                      >
                        Call
                      </button>
                    </div>
                  ))}

                  {activeTickets.slice(0, 1).map((tkt) => (
                    <div key={tkt._id || tkt.id} className="p-3 rounded-xl bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-rose-900 dark:text-rose-200">Support Grievance</span>
                          <span className="text-[10px] bg-rose-200 dark:bg-rose-900 text-rose-950 dark:text-rose-200 font-extrabold px-1.5 py-0.2 rounded uppercase">
                            {tkt.status || 'open'}
                          </span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 text-[11px] mt-0.5 truncate max-w-xs">
                          {tkt.customerName || tkt.subject}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate('/admin/support')}
                        className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-bold text-[11px] shadow-2xs hover:bg-rose-700 cursor-pointer"
                      >
                        Reply
                      </button>
                    </div>
                  ))}
                </>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}

