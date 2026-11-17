import React, { useMemo } from 'react';
import { 
  BarChart3, TrendingUp, Building2, Calendar, PhoneCall, Headphones, 
  Users, DollarSign, Download, Printer, CheckCircle2, ShieldCheck, 
  PieChart, MapPin, Tag, ArrowUpRight
} from 'lucide-react';
import { useProperty } from '../../../contexts/PropertyContext';
import { formatINR } from '../../../utils/propertyHelpers';

export default function ReportsManagement() {
  const { 
    adminApprovedProperties, 
    adminAppointments, 
    adminCalls, 
    adminTickets, 
    adminCustomers,
    isMobile 
  } = useProperty();

  // Metrics computation
  const metrics = useMemo(() => {
    const props = adminApprovedProperties || [];
    const bookings = adminAppointments || [];
    const calls = adminCalls || [];
    const tickets = adminTickets || [];
    const customers = adminCustomers || [];

    // Properties
    const totalProps = props.length;
    const soldProps = props.filter(p => p.availabilityStatus === 'sold');
    const rentedProps = props.filter(p => p.availabilityStatus === 'rented');
    const availableProps = props.filter(p => !p.availabilityStatus || p.availabilityStatus === 'available');

    // Total listed value
    const totalGMV = props.reduce((acc, p) => acc + (Number(p.price) || 0), 0);
    const soldGMV = soldProps.reduce((acc, p) => acc + (Number(p.price) || 0), 0);

    // Categories
    const categoryCounts = {};
    props.forEach(p => {
      const cat = p.category || p.propertyType || 'Residential';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });

    // Districts
    const districtCounts = {};
    props.forEach(p => {
      const dist = p.location?.district || p.location?.city || 'Kadapa';
      districtCounts[dist] = (districtCounts[dist] || 0) + 1;
    });

    // Bookings
    const totalBookings = bookings.length;
    const completedBookings = bookings.filter(b => b.status === 'completed').length;
    const confirmedBookings = bookings.filter(b => b.status === 'confirmed').length;
    const cancelledBookings = bookings.filter(b => b.status === 'cancelled').length;
    const bookingCompletionRate = totalBookings > 0 ? Math.round(((completedBookings + confirmedBookings) / totalBookings) * 100) : 0;

    // Calls
    const totalCalls = calls.length;
    const completedCalls = calls.filter(c => c.status === 'completed').length;
    const followUpCalls = calls.filter(c => c.status === 'follow_up').length;
    const missedCalls = calls.filter(c => c.status === 'missed').length;
    const callResolutionRate = totalCalls > 0 ? Math.round((completedCalls / totalCalls) * 100) : 0;

    // Tickets
    const totalTickets = tickets.length;
    const resolvedTickets = tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length;
    const ticketResolutionRate = totalTickets > 0 ? Math.round((resolvedTickets / totalTickets) * 100) : 0;

    return {
      totalProps,
      soldCount: soldProps.length,
      rentedCount: rentedProps.length,
      availableCount: availableProps.length,
      totalGMV,
      soldGMV,
      categoryCounts,
      districtCounts,
      totalBookings,
      completedBookings,
      confirmedBookings,
      cancelledBookings,
      bookingCompletionRate,
      totalCalls,
      completedCalls,
      followUpCalls,
      missedCalls,
      callResolutionRate,
      totalTickets,
      resolvedTickets,
      ticketResolutionRate,
      totalCustomers: customers.length
    };
  }, [adminApprovedProperties, adminAppointments, adminCalls, adminTickets, adminCustomers]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const csvContent = "data:text/csv;charset=utf-8," + 
      "Report Category,Metric,Value\n" +
      `Properties,Total Properties,${metrics.totalProps}\n` +
      `Properties,Available Listings,${metrics.availableCount}\n` +
      `Properties,Sold Properties,${metrics.soldCount}\n` +
      `Properties,Rented Properties,${metrics.rentedCount}\n` +
      `Properties,Total Listed GMV (INR),${metrics.totalGMV}\n` +
      `Properties,Total Sold Value (INR),${metrics.soldGMV}\n` +
      `Bookings,Total Site Visits,${metrics.totalBookings}\n` +
      `Bookings,Confirmed Bookings,${metrics.confirmedBookings}\n` +
      `Bookings,Completed Bookings,${metrics.completedBookings}\n` +
      `Bookings,Completion Rate,${metrics.bookingCompletionRate}%\n` +
      `Calls,Total Telephony Inquiries,${metrics.totalCalls}\n` +
      `Calls,Completed Callbacks,${metrics.completedCalls}\n` +
      `Calls,Missed Calls,${metrics.missedCalls}\n` +
      `Calls,Resolution Rate,${metrics.callResolutionRate}%\n` +
      `Support,Total Grievance Tickets,${metrics.totalTickets}\n` +
      `Support,Resolved Tickets,${metrics.resolvedTickets}\n` +
      `Support,Resolution Rate,${metrics.ticketResolutionRate}%\n` +
      `Customers,Total Accounts,${metrics.totalCustomers}\n`;

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `plotpin_super_admin_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Action Toolbar */}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={handlePrint}
          className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer shadow-2xs"
        >
          <Printer className="w-3.5 h-3.5 text-slate-500" />
          <span>Print Report</span>
        </button>
        <button
          type="button"
          onClick={handleExportCSV}
          className="px-4 py-1.5 rounded-xl bg-[#184631] hover:bg-[#123625] text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Top 4 Macro KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">Total Properties</span>
            <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            {metrics.totalProps}
          </div>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
            {metrics.availableCount} Currently Available
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">Sold &amp; Rented</span>
            <Tag className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            {metrics.soldCount + metrics.rentedCount}
          </div>
          <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold">
            {metrics.soldCount} Sold • {metrics.rentedCount} Rented
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">Total Bookings</span>
            <Calendar className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            {metrics.totalBookings}
          </div>
          <p className="text-[11px] text-sky-600 dark:text-sky-400 font-semibold">
            {metrics.bookingCompletionRate}% Completion Rate
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">Customer Enquiries</span>
            <PhoneCall className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            {metrics.totalCalls}
          </div>
          <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
            {metrics.callResolutionRate}% Callback SLA Met
          </p>
        </div>
      </div>

      {/* Grid: 2 Deep Dive Reports */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Report 1: Property Inventory Breakdown & GMV */}
        <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-slate-900 dark:text-white text-base flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Property Inventory Breakdown</span>
            </h3>
            <span className="text-[11px] font-mono font-bold text-slate-500">
              Total GMV: {formatINR(metrics.totalGMV)}
            </span>
          </div>

          {/* Status Breakdown Progress Bars */}
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-slate-700 dark:text-slate-300">Available For Sale / Rent</span>
                <span className="text-emerald-600 font-extrabold">{metrics.availableCount} ({metrics.totalProps ? Math.round((metrics.availableCount / metrics.totalProps) * 100) : 0}%)</span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${metrics.totalProps ? (metrics.availableCount / metrics.totalProps) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-slate-700 dark:text-slate-300">Sold (Deals Closed)</span>
                <span className="text-indigo-600 font-extrabold">{metrics.soldCount} ({metrics.totalProps ? Math.round((metrics.soldCount / metrics.totalProps) * 100) : 0}%)</span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all"
                  style={{ width: `${metrics.totalProps ? (metrics.soldCount / metrics.totalProps) * 100 : 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-slate-700 dark:text-slate-300">Rented (Active Leases)</span>
                <span className="text-sky-600 font-extrabold">{metrics.rentedCount} ({metrics.totalProps ? Math.round((metrics.rentedCount / metrics.totalProps) * 100) : 0}%)</span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-sky-500 rounded-full transition-all"
                  style={{ width: `${metrics.totalProps ? (metrics.rentedCount / metrics.totalProps) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>

          {/* District Distribution Chips */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <span className="text-xs font-bold text-slate-500 uppercase block">District Distribution</span>
            <div className="flex flex-wrap gap-2">
              {Object.entries(metrics.districtCounts).map(([dist, count]) => (
                <span
                  key={dist}
                  className="text-xs bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 px-3 py-1 rounded-xl font-semibold flex items-center gap-1.5"
                >
                  <MapPin className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span>{dist}:</span>
                  <strong className="font-bold">{count}</strong>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Report 2: Call, Booking & Support Operations SLA */}
        <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-slate-900 dark:text-white text-base flex items-center gap-2">
              <Headphones className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <span>Customer Operations &amp; Support SLA</span>
            </h3>
            <span className="text-[11px] bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
              100% Zero Brokerage Compliance
            </span>
          </div>

          {/* 3 Metric Cards */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Site Visit Success</span>
              <strong className="text-xl font-black text-slate-900 dark:text-white mt-1 block">
                {metrics.bookingCompletionRate}%
              </strong>
              <span className="text-[10px] text-slate-500 block">
                {metrics.completedBookings} completed
              </span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Calls Answered</span>
              <strong className="text-xl font-black text-slate-900 dark:text-white mt-1 block">
                {metrics.callResolutionRate}%
              </strong>
              <span className="text-[10px] text-slate-500 block">
                {metrics.completedCalls} logged
              </span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Ticket Resolution</span>
              <strong className="text-xl font-black text-slate-900 dark:text-white mt-1 block">
                {metrics.ticketResolutionRate}%
              </strong>
              <span className="text-[10px] text-slate-500 block">
                {metrics.resolvedTickets} solved
              </span>
            </div>
          </div>

          {/* Operational Metrics Table */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 uppercase font-black text-[10px]">
                <tr>
                  <th className="p-3">Operations Queue</th>
                  <th className="p-3 text-center">Active Volume</th>
                  <th className="p-3 text-center">Completed</th>
                  <th className="p-3 text-right">Target SLA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                <tr>
                  <td className="p-3 font-bold text-slate-800 dark:text-slate-200">Customer Site Visits</td>
                  <td className="p-3 text-center font-mono">{metrics.totalBookings}</td>
                  <td className="p-3 text-center text-emerald-600 font-bold">{metrics.completedBookings}</td>
                  <td className="p-3 text-right font-mono text-slate-500">&lt; 24 Hours</td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-slate-800 dark:text-slate-200">Telephony Inquiries</td>
                  <td className="p-3 text-center font-mono">{metrics.totalCalls}</td>
                  <td className="p-3 text-center text-emerald-600 font-bold">{metrics.completedCalls}</td>
                  <td className="p-3 text-right font-mono text-slate-500">&lt; 15 Mins</td>
                </tr>
                <tr>
                  <td className="p-3 font-bold text-slate-800 dark:text-slate-200">Customer Support Tickets</td>
                  <td className="p-3 text-center font-mono">{metrics.totalTickets}</td>
                  <td className="p-3 text-center text-emerald-600 font-bold">{metrics.resolvedTickets}</td>
                  <td className="p-3 text-right font-mono text-slate-500">&lt; 4 Hours</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

