import React, { useState } from 'react';
import {
  Headphones, ShieldAlert, Plus, MessageSquare, AlertCircle, CheckCircle2, Clock
} from 'lucide-react';
import { useProperty } from '../../contexts/PropertyContext';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../lib/api';

export default function SupportPage() {
  const { currentUser, requireAuth, showToast } = useAuth();
  const {
    myProperties,
    myBuyings,
    myTickets,
    setMyTickets,
    createSupportTicket,
    isMobile,
    loadUserData
  } = useProperty();

  const [showNewTicketModal, setShowNewTicketModal] = useState(false);
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');
  const [selectedPropertyId, setSelectedPropertyId] = useState('general');
  const [submitting, setSubmitting] = useState(false);

  const handleOpenTicketForm = () => {
    if (!requireAuth('Please sign in to file a dispute or inquiry')) return;
    setShowNewTicketModal(true);
  };

  const handleCreateTicket = async (e) => {
    e.preventDefault();
    if (!ticketSubject.trim() || !ticketMessage.trim()) {
      showToast('Subject and message are required');
      return;
    }

    setSubmitting(true);
    try {
      const allProps = [...myProperties, ...myBuyings.map((b) => b.property || b)];
      const matched = allProps.find((p) => (p._id || p.id) === selectedPropertyId);

      const ticketPayload = {
        propertyId: selectedPropertyId || 'general',
        propertyTitle: matched?.title || (selectedPropertyId === 'general' ? 'General Cadastral / Platform Assistance' : 'PlotPin Asset'),
        subject: ticketSubject.trim(),
        message: ticketMessage.trim()
      };

      if (typeof createSupportTicket === 'function') {
        await createSupportTicket(ticketPayload);
      } else {
        await api.createSupportTicket(ticketPayload);
      }

      showToast('✅ Support ticket filed. Regional Administrator notified.');
      setTicketSubject('');
      setTicketMessage('');
      setShowNewTicketModal(false);
    } catch (err) {
      showToast(err.message || 'Failed to file ticket');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`space-y-6 max-w-7xl mx-auto ${isMobile ? 'p-3 pb-24' : 'p-6'}`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <h2 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
          <Headphones className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
          <span>Support Tickets</span>
        </h2>

        <button
          type="button"
          onClick={handleOpenTicketForm}
          className="px-3.5 py-1.5 bg-[#184631] hover:bg-[#123625] text-white rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Ticket</span>
        </button>
      </div>

      {/* Ticket List */}
      <div className="space-y-3">
        {myTickets.length === 0 ? (
          <div className="bg-white dark:bg-[#131E31] p-8 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-3 shadow-2xs">
            <MessageSquare className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
            <h4 className="font-bold text-base text-slate-900 dark:text-white">No active support tickets</h4>
            <div>
              <button
                type="button"
                onClick={handleOpenTicketForm}
                className="px-4 py-2 bg-[#184631] hover:bg-[#123625] text-white rounded-xl text-xs font-bold shadow-2xs transition-all inline-flex items-center gap-1.5 cursor-pointer mt-1"
              >
                <Plus className="w-4 h-4" />
                <span>Create Ticket</span>
              </button>
            </div>
          </div>
        ) : (
          myTickets.map((ticket) => (
            <div
              key={ticket._id || ticket.id}
              className="bg-white dark:bg-[#131E31] p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-extrabold px-2 py-0.5 rounded uppercase ${
                      ticket.status === 'resolved'
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                        : ticket.status === 'in_progress'
                        ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300'
                        : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                    }`}
                  >
                    {ticket.status || 'Open'}
                  </span>
                  <span className="text-xs font-mono text-slate-400 dark:text-slate-500">#{ticket._id || ticket.id}</span>
                </div>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                  {new Date(ticket.createdAt || Date.now()).toLocaleDateString('en-IN')}
                </span>
              </div>

              <div>
                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">{ticket.subject}</h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{ticket.message}</p>
                <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-bold mt-1">
                  Asset: {ticket.propertyTitle || 'Associated Property'}
                </div>
              </div>

              {(ticket.adminReply || (ticket.replies && ticket.replies.length > 0)) && (
                <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-100 dark:border-slate-700 space-y-2 mt-2">
                  <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Administrator Response</span>
                  {ticket.adminReply && (!ticket.replies || ticket.replies.length === 0) && (
                    <div className="text-xs text-slate-700 dark:text-slate-300">
                      <strong className="text-slate-900 dark:text-slate-100">Super Admin (PlotPin Cadastral Desk): </strong>
                      {ticket.adminReply}
                    </div>
                  )}
                  {ticket.replies && ticket.replies.map((reply, idx) => (
                    <div key={idx} className="text-xs text-slate-700 dark:text-slate-300">
                      <strong className="text-slate-900 dark:text-slate-100">{reply.author || reply.sender || 'Regional Mediator'}: </strong>
                      {reply.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* New Ticket Modal */}
      {showNewTicketModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white dark:bg-[#131E31] rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">File Mediation Grievance</h3>
              <button
                type="button"
                onClick={() => setShowNewTicketModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Associated Property Listing *
                </label>
                <select
                  value={selectedPropertyId}
                  onChange={(e) => setSelectedPropertyId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 dark:text-slate-100 outline-none focus:border-emerald-600"
                  required
                >
                  <option value="general">General Cadastral / Platform Assistance</option>
                  {myProperties.map((p) => (
                    <option key={p._id || p.id} value={p._id || p.id}>
                      [Your Listing] {p.title}
                    </option>
                  ))}
                  {myBuyings.map((b) => {
                    const p = b.property || b;
                    return (
                      <option key={p._id || p.id} value={p._id || p.id}>
                        [Purchased Deed] {p.title}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Subject *</label>
                <input
                  type="text"
                  value={ticketSubject}
                  onChange={(e) => setTicketSubject(e.target.value)}
                  placeholder="e.g. Discrepancy in Cadastral Boundary demarkation"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 outline-none focus:border-emerald-600"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">Details &amp; Evidence *</label>
                <textarea
                  rows={4}
                  value={ticketMessage}
                  onChange={(e) => setTicketMessage(e.target.value)}
                  placeholder="Provide comprehensive details of your dispute or inquiry for RERA mediation..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs text-slate-800 dark:text-slate-100 outline-none focus:border-emerald-600"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewTicketModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-[#184631] hover:bg-[#123625] text-white text-xs font-extrabold shadow-sm transition-all"
                >
                  {submitting ? 'Submitting...' : 'Submit Grievance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

