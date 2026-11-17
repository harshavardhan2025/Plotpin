import React, { useState, useMemo } from 'react';
import { 
  Headphones, MessageSquare, CheckCircle2, Clock, AlertTriangle, 
  Search, Filter, User, Building2, Send, ShieldAlert, Sparkles, 
  HelpCircle, Check, X, ArrowUpDown
} from 'lucide-react';
import { useProperty } from '../../../contexts/PropertyContext';
import { useAuth } from '../../../contexts/AuthContext';

export default function CustomerSupportManagement() {
  const { showToast } = useAuth();
  const { adminTickets, replySupportTicket, isMobile } = useProperty();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('present'); // 'present' | 'completed'
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [adminReplyText, setAdminReplyText] = useState('');
  const [ticketStatus, setTicketStatus] = useState('resolved');

  // Stats calculation
  const stats = useMemo(() => {
    const list = adminTickets || [];
    return {
      total: list.length,
      present: list.filter(t => t.status === 'open' || t.status === 'in_progress').length,
      completed: list.filter(t => t.status === 'resolved' || t.status === 'closed').length,
    };
  }, [adminTickets]);

  // Categories present in tickets
  const categories = useMemo(() => {
    const set = new Set();
    (adminTickets || []).forEach(t => {
      if (t.category) set.add(t.category);
    });
    return Array.from(set);
  }, [adminTickets]);

  // Filtered list
  const filteredTickets = useMemo(() => {
    return (adminTickets || []).filter(ticket => {
      // Status filter
      if (statusFilter === 'present') {
        if (ticket.status !== 'open' && ticket.status !== 'in_progress') return false;
      } else if (statusFilter === 'completed') {
        if (ticket.status !== 'resolved' && ticket.status !== 'closed') return false;
      }

      // Category filter
      if (categoryFilter !== 'all' && ticket.category !== categoryFilter) {
        return false;
      }
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const subject = (ticket.subject || ticket.title || '').toLowerCase();
        const desc = (ticket.description || ticket.message || '').toLowerCase();
        const name = (ticket.userName || ticket.customerName || ticket.name || '').toLowerCase();
        const ticketId = (ticket._id || ticket.id || '').toLowerCase();
        if (!subject.includes(q) && !desc.includes(q) && !name.includes(q) && !ticketId.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [adminTickets, statusFilter, categoryFilter, searchQuery]);

  const handleOpenReplyModal = (ticket) => {
    setSelectedTicket(ticket);
    setAdminReplyText(ticket.adminReply || ticket.resolution || '');
    setTicketStatus(ticket.status === 'open' ? 'in_progress' : ticket.status || 'resolved');
  };

  const handleSendReply = (e) => {
    e.preventDefault();
    if (!selectedTicket) return;

    if (!adminReplyText.trim()) {
      showToast('⚠️ Please write an official response before submitting');
      return;
    }

    const ticketId = selectedTicket._id || selectedTicket.id;
    replySupportTicket(ticketId, {
      adminReply: adminReplyText.trim(),
      status: ticketStatus,
      resolvedAt: ticketStatus === 'resolved' ? new Date().toISOString() : selectedTicket.resolvedAt,
      updatedAt: new Date().toISOString()
    });

    showToast(`Support Ticket #${ticketId.slice(-4)} updated with status "${ticketStatus.toUpperCase()}"`);
    setSelectedTicket(null);
  };

  const handleQuickResolve = (ticket) => {
    const ticketId = ticket._id || ticket.id;
    replySupportTicket(ticketId, {
      adminReply: 'Resolved by Super Admin after verifying cadastral records and notifying customer.',
      status: 'resolved',
      resolvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    showToast(`Ticket #${ticketId.slice(-4)} marked as Resolved`);
  };

  return (
    <div className="space-y-4">
      {/* Filters bar with Pill Counts */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by ticket ID, customer name, grievance subject or details..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
          />
        </div>

        {/* Tab Filters with Numbers */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
          {[
            { id: 'present', label: `Present (${stats.present})` },
            { id: 'completed', label: `Completed (${stats.completed})` },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Category dropdown */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3.5 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white font-bold cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="all">All Grievance Categories</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* Tickets List */}
      <div className="space-y-3">
        {filteredTickets.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 p-12 rounded-3xl border border-slate-200 dark:border-slate-800 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
              <Headphones className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">
              No support tickets found
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery ? 'No grievances match your search query.' : 'There are currently no open customer tickets in this category.'}
            </p>
          </div>
        ) : (
          filteredTickets.map((ticket) => {
            const ticketId = ticket._id || ticket.id;
            const userName = ticket.userName || ticket.customerName || ticket.name || 'Verified User';
            const userPhone = ticket.userPhone || ticket.phone || '+91 98480 54321';
            const subject = ticket.subject || ticket.title || 'Property Clarification Request';
            const category = ticket.category || 'General Inquiry';
            const priority = ticket.priority || 'medium';

            const statusColors = {
              open: 'bg-rose-100 text-rose-900 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 dark:border-rose-700',
              in_progress: 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-700',
              resolved: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700',
              closed: 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700',
            };

            const priorityBadge = {
              urgent: 'bg-red-500 text-white',
              high: 'bg-orange-500 text-white',
              medium: 'bg-amber-500 text-white',
              low: 'bg-blue-500 text-white'
            };

            return (
              <div
                key={ticketId}
                className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-start justify-between gap-4"
              >
                {/* Left side ticket info */}
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${statusColors[ticket.status] || statusColors.open}`}>
                      {ticket.status ? ticket.status.replace('_', ' ') : 'OPEN'}
                    </span>
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${priorityBadge[priority] || priorityBadge.medium}`}>
                      {priority}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      Ref: #{ticketId.slice(-6).toUpperCase()}
                    </span>
                    <span className="text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md font-bold">
                      {category}
                    </span>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1 font-medium ml-auto sm:ml-0">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Logged today'}
                    </span>
                  </div>

                  {/* Customer details */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                      {subject}
                    </h3>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1 font-bold text-slate-800 dark:text-slate-200">
                      <User className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>{userName}</span>
                    </div>
                    <span>•</span>
                    <span className="font-mono">{userPhone}</span>
                    {ticket.propertyTitle && (
                      <>
                        <span>•</span>
                        <span className="truncate max-w-[200px]">Property: {ticket.propertyTitle}</span>
                      </>
                    )}
                  </div>

                  {/* Description Box */}
                  <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    <p className="font-medium">{ticket.description || ticket.message}</p>
                  </div>

                  {/* Admin Resolution / Reply Box */}
                  {(ticket.adminReply || ticket.resolution) && (
                    <div className="bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-950 dark:text-emerald-200 space-y-1">
                      <div className="flex items-center justify-between font-black text-emerald-800 dark:text-emerald-300">
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          Official Super Admin Response
                        </span>
                        {ticket.resolvedAt && (
                          <span className="text-[10px] font-normal text-emerald-600 dark:text-emerald-400">
                            {new Date(ticket.resolvedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                      </div>
                      <p className="font-medium text-emerald-900 dark:text-emerald-100">
                        {ticket.adminReply || ticket.resolution}
                      </p>
                    </div>
                  )}
                </div>

                {/* Right side actions */}
                <div className="flex sm:flex-col md:flex-row items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800">
                  {ticket.status !== 'resolved' && (
                    <button
                      type="button"
                      onClick={() => handleQuickResolve(ticket)}
                      className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/80 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center justify-center gap-1.5 border border-emerald-300 dark:border-emerald-800 transition-colors cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>1-Click Resolve</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleOpenReplyModal(ticket)}
                    className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-[#184631] hover:bg-[#123625] text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Respond / Resolve</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Admin Reply & Resolve Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg overflow-hidden animate-scale-up">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 font-extrabold px-2 py-0.5 rounded-full uppercase">
                    Admin Support Desk
                  </span>
                  <span className="text-xs font-mono text-slate-400">
                    Ref: #{selectedTicket._id || selectedTicket.id}
                  </span>
                </div>
                <h3 className="text-base font-black text-slate-900 dark:text-white mt-1">
                  Respond to Customer Grievance
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTicket(null)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSendReply} className="p-5 space-y-4">
              {/* Grievance preview */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1.5">
                <div className="text-xs font-black text-slate-900 dark:text-white">
                  {selectedTicket.subject || selectedTicket.title}
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3">
                  "{selectedTicket.description || selectedTicket.message}"
                </div>
                <div className="text-[11px] text-slate-400 pt-1 flex items-center gap-2">
                  <span>Customer: {selectedTicket.userName || selectedTicket.customerName}</span>
                  <span>•</span>
                  <span>Phone: {selectedTicket.userPhone || selectedTicket.phone}</span>
                </div>
              </div>

              {/* Status Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Ticket Resolution Status
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'in_progress', label: 'In Progress', color: 'border-amber-400' },
                    { id: 'resolved', label: 'Resolved', color: 'border-emerald-500' },
                    { id: 'closed', label: 'Closed', color: 'border-slate-400' },
                  ].map(statusOpt => (
                    <label
                      key={statusOpt.id}
                      className={`flex items-center justify-center p-2.5 rounded-xl border cursor-pointer text-center transition-all ${
                        ticketStatus === statusOpt.id
                          ? 'bg-slate-900 text-white dark:bg-emerald-600 dark:text-white font-black border-transparent'
                          : 'bg-slate-50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <input
                        type="radio"
                        name="ticketStatus"
                        value={statusOpt.id}
                        checked={ticketStatus === statusOpt.id}
                        onChange={(e) => setTicketStatus(e.target.value)}
                        className="sr-only"
                      />
                      <span className="text-xs font-bold">{statusOpt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Official Response Body */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Official Administrative Answer / Clarification
                </label>
                <textarea
                  rows={4}
                  value={adminReplyText}
                  onChange={(e) => setAdminReplyText(e.target.value)}
                  placeholder="Explain the resolution, findings from Andhra Pradesh Sub-Registrar records, or next steps for the customer..."
                  className="w-full p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedTicket(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#184631] hover:bg-[#123625] text-white text-xs font-black shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Response &amp; Update</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

