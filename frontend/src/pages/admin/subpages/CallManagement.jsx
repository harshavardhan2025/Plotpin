import React, { useState, useMemo } from 'react';
import { 
  PhoneCall, Phone, PhoneForwarded, PhoneMissed, CheckCircle2, Clock, 
  Search, Filter, Calendar, User, MessageSquare, AlertCircle, Copy, 
  ExternalLink, Building2, MapPin, Check, Lock
} from 'lucide-react';
import { useProperty } from '../../../contexts/PropertyContext';
import { useAuth } from '../../../contexts/AuthContext';
import { getCallUnlockStatus } from '../../../utils/propertyHelpers';

export default function CallManagement() {
  const { showToast } = useAuth();
  const { adminCalls, updateCallRecord, isMobile } = useProperty();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'present' | 'completed' | 'rejected'
  const [selectedCall, setSelectedCall] = useState(null);
  const [editStatus, setEditStatus] = useState('pending');
  const [editNotes, setEditNotes] = useState('');
  const [editFollowUpDate, setEditFollowUpDate] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  // Stats calculation
  const stats = useMemo(() => {
    const list = adminCalls || [];
    return {
      total: list.length,
      present: list.filter(c => c.status === 'pending' || c.status === 'follow_up').length,
      completed: list.filter(c => c.status === 'completed').length,
      rejected: list.filter(c => c.status === 'missed' || c.status === 'rejected').length,
    };
  }, [adminCalls]);

  // Filtered list
  const filteredCalls = useMemo(() => {
    return (adminCalls || []).filter(call => {
      // Status filter
      if (statusFilter === 'present') {
        if (call.status !== 'pending' && call.status !== 'follow_up') return false;
      } else if (statusFilter === 'completed') {
        if (call.status !== 'completed') return false;
      } else if (statusFilter === 'rejected') {
        if (call.status !== 'missed' && call.status !== 'rejected') return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const name = (call.name || call.customerName || '').toLowerCase();
        const phone = (call.phone || call.phoneNumber || '').toLowerCase();
        const propTitle = (call.propertyTitle || call.property?.title || '').toLowerCase();
        const reason = (call.reason || call.notes || '').toLowerCase();
        if (!name.includes(q) && !phone.includes(q) && !propTitle.includes(q) && !reason.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [adminCalls, statusFilter, searchQuery]);

  const handleOpenUpdateModal = (call) => {
    setSelectedCall(call);
    setEditStatus(call.status || 'pending');
    setEditNotes(call.adminNotes || call.notes || '');
    setEditFollowUpDate(call.followUpDate || '');
  };

  const handleSaveUpdate = (e) => {
    e.preventDefault();
    if (!selectedCall) return;

    const callId = selectedCall._id || selectedCall.id;
    updateCallRecord(callId, {
      status: editStatus,
      adminNotes: editNotes,
      followUpDate: editFollowUpDate,
      updatedAt: new Date().toISOString()
    });

    showToast(`Call record #${callId.slice(-4)} updated to "${editStatus.replace('_', ' ').toUpperCase()}"`);
    setSelectedCall(null);
  };

  const handleCopyPhone = (phone, id) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(phone);
      setCopiedId(id);
      showToast(`Copied ${phone} to clipboard`);
      setTimeout(() => setCopiedId(null), 2500);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter and Search Bar with Pill Counts */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by customer name, phone number, property title or notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
          />
        </div>

        {/* Tab Filters with Numbers */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
          {[
            { id: 'all', label: `All (${stats.total})` },
            { id: 'present', label: `Present (${stats.present})` },
            { id: 'completed', label: `Completed (${stats.completed})` },
            { id: 'rejected', label: `Rejected (${stats.rejected})` },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Call Records List */}
      <div className="space-y-3">
        {filteredCalls.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 p-12 rounded-3xl border border-slate-200 dark:border-slate-800 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
              <PhoneMissed className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">
              No call requests found
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery ? 'No calls matched your filter criteria.' : 'There are currently no inbound call requests in this queue.'}
            </p>
          </div>
        ) : (
          filteredCalls.map((call) => {
            const callId = call._id || call.id;
            const phone = call.phone || call.phoneNumber || '+91 98480 12345';
            const name = call.name || call.customerName || 'Verified Inquirer';
            const propTitle = call.propertyTitle || call.property?.title || 'AP Land Listing';
            const timeSlot = call.preferredTime || call.timeSlot || 'Morning (10:00 AM - 01:00 PM)';
            const callUnlock = getCallUnlockStatus(timeSlot, call.createdAt);

            const statusColors = {
              pending: 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-700',
              follow_up: 'bg-indigo-100 text-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700',
              missed: 'bg-rose-100 text-rose-900 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-700',
              completed: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
            };

            return (
              <div
                key={callId}
                className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Left: Customer Info & Call Request Details */}
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${statusColors[call.status] || statusColors.pending}`}>
                      {call.status ? call.status.replace('_', ' ') : 'PENDING'}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      Ref: #{callId.slice(-6).toUpperCase()}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 font-medium">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {call.createdAt ? new Date(call.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Recent request'}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                    <div className="flex items-center gap-1.5 font-black text-slate-900 dark:text-white text-base">
                      <User className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>{name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
                      <Phone className="w-3 h-3 text-slate-400" />
                      <span>{phone}</span>
                      <button
                        type="button"
                        onClick={() => handleCopyPhone(phone, callId)}
                        title="Copy phone"
                        className="ml-1 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                      >
                        {copiedId === callId ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
                    <div className="flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{propTitle}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px]">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      <span>Preferred Slot: <strong className="text-slate-700 dark:text-slate-300">{timeSlot}</strong></span>
                    </div>
                  </div>

                  {/* Customer Requested Call Time Badge */}
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200">
                    <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>
                      Customer Requested Callback Time: <strong className="font-black text-amber-950 dark:text-amber-100">{timeSlot}</strong>
                    </span>
                  </div>

                  {/* Customer Reason / Admin Notes */}
                  {(call.reason || call.notes) && (
                    <div className="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700/60 flex items-start gap-2">
                      <MessageSquare className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-slate-700 dark:text-slate-300">Customer Note: </span>
                        <span>{call.reason || call.notes}</span>
                      </div>
                    </div>
                  )}

                  {call.adminNotes && (
                    <div className="text-xs text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800/50 flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Admin Follow-up Log: </span>
                        <span>{call.adminNotes}</span>
                        {call.followUpDate && (
                          <span className="block text-[11px] font-medium text-emerald-700 dark:text-emerald-400 mt-0.5">
                            Scheduled Next Call: {call.followUpDate}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Actions */}
                <div className="flex sm:flex-col md:flex-row items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800">
                  {callUnlock.isLocked ? (
                    <button
                      type="button"
                      onClick={() => showToast(`🔒 Call scheduled for ${callUnlock.formattedTime || 'later'}. Unlocks at ${callUnlock.formattedUnlock} (10 mins prior).`)}
                      className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 cursor-not-allowed opacity-75"
                      title={`Call unlocks 10 min prior (${callUnlock.formattedUnlock})`}
                    >
                      <Lock className="w-3.5 h-3.5 text-amber-500" />
                      <span>Call (Unlocks {callUnlock.formattedUnlock})</span>
                    </button>
                  ) : (
                    <a
                      href={`tel:${phone}`}
                      className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Call Now</span>
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() => handleOpenUpdateModal(call)}
                    className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <PhoneForwarded className="w-3.5 h-3.5" />
                    <span>Update Record</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Update Call Record Modal */}
      {selectedCall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg overflow-hidden animate-scale-up">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 font-extrabold px-2 py-0.5 rounded-full uppercase">
                    Call Record Editor
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    #{selectedCall._id || selectedCall.id}
                  </span>
                </div>
                <h3 className="text-base font-black text-slate-900 dark:text-white mt-1">
                  Update Call Status &amp; Notes
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCall(null)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveUpdate} className="p-5 space-y-4">
              {/* Customer summary */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1">
                <div className="text-xs font-black text-slate-900 dark:text-white flex items-center justify-between">
                  <span>{selectedCall.name || selectedCall.customerName}</span>
                  <span className="font-mono text-slate-600 dark:text-slate-400">{selectedCall.phone || selectedCall.phoneNumber}</span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  Property: {selectedCall.propertyTitle || selectedCall.property?.title || 'AP Property'}
                </div>
              </div>

              {/* Status Radio Pills */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Call Disposition Status
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'pending', label: 'Present (Pending)', color: 'border-amber-400' },
                    { id: 'completed', label: 'Completed', color: 'border-emerald-500' },
                    { id: 'rejected', label: 'Rejected / Missed', color: 'border-rose-400' },
                  ].map(statusOpt => (
                    <label
                      key={statusOpt.id}
                      className={`flex items-center justify-center p-2.5 rounded-xl border cursor-pointer text-center transition-all ${
                        editStatus === statusOpt.id
                          ? 'bg-slate-900 text-white dark:bg-emerald-600 dark:text-white font-bold border-transparent'
                          : 'bg-slate-50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name="callStatus"
                        value={statusOpt.id}
                        checked={editStatus === statusOpt.id}
                        onChange={(e) => setEditStatus(e.target.value)}
                        className="sr-only"
                      />
                      <span className="text-xs font-semibold">{statusOpt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Follow-up date picker if follow_up */}
              {editStatus === 'follow_up' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Scheduled Follow-up Date &amp; Time
                  </label>
                  <input
                    type="datetime-local"
                    value={editFollowUpDate}
                    onChange={(e) => setEditFollowUpDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-medium"
                  />
                </div>
              )}

              {/* Admin Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Admin Call Notes &amp; Conversation Summary
                </label>
                <textarea
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Record customer preferences, budget discussed, survey inquiry or scheduled visit notes..."
                  className="w-full p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedCall(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs transition-colors cursor-pointer"
                >
                  Save Call Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

