import React, { useState, useMemo } from 'react';
import { 
  Users, User, Phone, Mail, MapPin, Calendar, Clock, Building2, 
  Search, ShieldCheck, CheckCircle2, Eye, ExternalLink, FileText,
  PhoneCall, Headphones, Check, ArrowUpRight
} from 'lucide-react';
import { useProperty } from '../../../contexts/PropertyContext';
import { useAuth } from '../../../contexts/AuthContext';

export default function CustomerManagement() {
  const { showToast } = useAuth();
  const { 
    adminCustomers, 
    adminAppointments, 
    adminCalls, 
    adminTickets,
    adminApprovedProperties,
    isMobile 
  } = useProperty();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // Link customer records with bookings, calls, tickets
  const enrichedCustomers = useMemo(() => {
    return (adminCustomers || []).map(cust => {
      const custId = cust.id || cust._id;
      const custPhone = cust.phone ? cust.phone.replace(/[^0-9]/g, '') : '';
      const custName = (cust.name || '').toLowerCase();

      // Match appointments
      const bookings = (adminAppointments || []).filter(a => {
        const aPhone = a.customerPhone || a.phone ? (a.customerPhone || a.phone).replace(/[^0-9]/g, '') : '';
        const aName = (a.userName || a.customerName || '').toLowerCase();
        return (custPhone && aPhone && custPhone.includes(aPhone.slice(-8))) || (custName && aName && aName === custName);
      });

      // Match calls
      const calls = (adminCalls || []).filter(c => {
        const cPhone = c.phone || c.customerPhone || c.phoneNumber ? (c.phone || c.customerPhone || c.phoneNumber).replace(/[^0-9]/g, '') : '';
        const cName = (c.name || c.customerName || '').toLowerCase();
        return (custPhone && cPhone && custPhone.includes(cPhone.slice(-8))) || (custName && cName && cName === custName);
      });

      // Match tickets
      const tickets = (adminTickets || []).filter(t => {
        const tPhone = t.userPhone || t.customerPhone || t.phone ? (t.userPhone || t.customerPhone || t.phone).replace(/[^0-9]/g, '') : '';
        const tName = (t.userName || t.customerName || '').toLowerCase();
        return (custPhone && tPhone && custPhone.includes(tPhone.slice(-8))) || (custName && tName && tName === custName);
      });

      return {
        ...cust,
        bookingsList: bookings,
        callsList: calls,
        ticketsList: tickets,
        totalBookings: bookings.length,
        totalCalls: calls.length,
        totalTickets: tickets.length
      };
    });
  }, [adminCustomers, adminAppointments, adminCalls, adminTickets]);

  // Stats calculation
  const stats = useMemo(() => {
    const list = enrichedCustomers;
    return {
      total: list.length,
      activeBookings: list.filter(c => c.totalBookings > 0).length,
      activeCalls: list.filter(c => c.totalCalls > 0).length,
      activeTickets: list.filter(c => c.totalTickets > 0).length
    };
  }, [enrichedCustomers]);

  // Filtered customers (search across all customers directly, no role filtering)
  const filteredCustomers = useMemo(() => {
    return enrichedCustomers.filter(cust => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const name = (cust.name || '').toLowerCase();
        const phone = (cust.phone || '').toLowerCase();
        const email = (cust.email || '').toLowerCase();
        const district = (cust.district || cust.city || '').toLowerCase();
        if (!name.includes(q) && !phone.includes(q) && !email.includes(q) && !district.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [enrichedCustomers, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Direct Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search by customer name, phone number, email or district..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
        />
      </div>

      {/* Customer Account Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredCustomers.length === 0 ? (
          <div className="col-span-full bg-white dark:bg-slate-900 p-12 rounded-3xl border border-slate-200 dark:border-slate-800 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">
              No customer accounts found
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No registered customer profiles matched your search query.
            </p>
          </div>
        ) : (
          filteredCustomers.map(cust => {
            const custId = cust.id || cust._id;

            return (
              <div
                key={custId}
                className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between gap-4"
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      Verified Customer
                    </span>
                    <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-extrabold px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      Verified KYC
                    </span>
                  </div>

                  {/* Customer Identity */}
                  <div className="mt-3 flex items-start gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-[#184631] text-white flex items-center justify-center font-black text-base shrink-0 shadow-xs">
                      {cust.name ? cust.name[0].toUpperCase() : 'U'}
                    </div>
                    <div className="space-y-0.5 overflow-hidden">
                      <h3 className="font-black text-base text-slate-900 dark:text-white truncate">
                        {cust.name}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 truncate">
                        <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="font-mono">{cust.phone || '+91 98480 12345'}</span>
                      </p>
                      {cust.email && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 truncate">
                          <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{cust.email}</span>
                        </p>
                      )}
                      {cust.district && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{cust.district}, Andhra Pradesh</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Activity Stats Strip */}
                  <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-center">
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-2 rounded-xl">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Bookings</span>
                      <strong className="text-sm font-black text-slate-900 dark:text-white mt-0.5 block">
                        {cust.totalBookings}
                      </strong>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-2 rounded-xl">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Calls</span>
                      <strong className="text-sm font-black text-slate-900 dark:text-white mt-0.5 block">
                        {cust.totalCalls}
                      </strong>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-2 rounded-xl">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Grievances</span>
                      <strong className="text-sm font-black text-slate-900 dark:text-white mt-0.5 block">
                        {cust.totalTickets}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex items-center gap-2 pt-2">
                  <a
                    href={`tel:${cust.phone}`}
                    className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                    title="Call Customer"
                  >
                    <Phone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </a>

                  <button
                    type="button"
                    onClick={() => setSelectedCustomer(cust)}
                    className="flex-1 py-2.5 rounded-xl bg-[#184631] hover:bg-[#123625] text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Customer File</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Customer Details Drawer / Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-scale-up">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#184631] text-white flex items-center justify-center font-black">
                  {selectedCustomer.name ? selectedCustomer.name[0].toUpperCase() : 'U'}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    {selectedCustomer.name}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    ID: #{selectedCustomer.id || selectedCustomer._id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-6">
              {/* Profile details */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Phone</span>
                  <a href={`tel:${selectedCustomer.phone}`} className="font-bold text-xs text-emerald-700 dark:text-emerald-400 font-mono mt-0.5 block hover:underline">
                    {selectedCustomer.phone || '+91 98480 12345'}
                  </a>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Email</span>
                  <span className="font-semibold text-xs text-slate-900 dark:text-white mt-0.5 block truncate">
                    {selectedCustomer.email || 'customer@plotpin.in'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">District</span>
                  <span className="font-semibold text-xs text-slate-900 dark:text-white mt-0.5 block">
                    {selectedCustomer.district || 'Kadapa'}, AP
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">Account Role</span>
                  <span className="font-extrabold text-xs text-slate-900 dark:text-white uppercase mt-0.5 block">
                    {selectedCustomer.role || 'Buyer'}
                  </span>
                </div>
              </div>

              {/* Section 1: Track Booking History */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Booking &amp; Site Visit History ({selectedCustomer.bookingsList.length})</span>
                  </h4>
                </div>

                {selectedCustomer.bookingsList.length === 0 ? (
                  <p className="text-xs text-slate-400 italic bg-slate-50 dark:bg-slate-800/20 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                    No site visits scheduled yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectedCustomer.bookingsList.map((b) => (
                      <div
                        key={b._id || b.id}
                        className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs"
                      >
                        <div className="space-y-0.5">
                          <strong className="text-slate-900 dark:text-white block font-bold">
                            {b.propertyTitle || 'AP Cadastral Parcel'}
                          </strong>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            {b.visitDate || b.date} at {b.visitTime || b.time || '10:00 AM'}
                          </span>
                        </div>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                          b.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                          b.status === 'completed' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300' :
                          'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        }`}>
                          {b.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 2: Call Inquiries */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                    <PhoneCall className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                    <span>Telephony Inquiries ({selectedCustomer.callsList.length})</span>
                  </h4>
                </div>

                {selectedCustomer.callsList.length === 0 ? (
                  <p className="text-xs text-slate-400 italic bg-slate-50 dark:bg-slate-800/20 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                    No phone calls logged for this customer.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectedCustomer.callsList.map((c) => (
                      <div
                        key={c._id || c.id}
                        className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs"
                      >
                        <div className="space-y-0.5">
                          <strong className="text-slate-900 dark:text-white block font-bold">
                            {c.propertyTitle || 'Property Inquiry'}
                          </strong>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            Preferred Slot: {c.preferredTime || c.timeSlot || 'Morning'}
                          </span>
                          {c.adminNotes && (
                            <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                              Note: {c.adminNotes}
                            </p>
                          )}
                        </div>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 uppercase">
                          {c.status || 'pending'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 3: Grievances / Tickets */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Headphones className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                    <span>Support Questions &amp; Complaints ({selectedCustomer.ticketsList.length})</span>
                  </h4>
                </div>

                {selectedCustomer.ticketsList.length === 0 ? (
                  <p className="text-xs text-slate-400 italic bg-slate-50 dark:bg-slate-800/20 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                    No customer complaints or support tickets on record.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectedCustomer.ticketsList.map((t) => (
                      <div
                        key={t._id || t.id}
                        className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <strong className="text-slate-900 dark:text-white font-bold">
                            {t.subject || t.title}
                          </strong>
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 uppercase">
                            {t.status || 'open'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300">
                          {t.description || t.message}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-black cursor-pointer"
              >
                Close Customer File
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

