import React, { useEffect, useMemo } from 'react';
import { Outlet, useLocation, Navigate } from 'react-router-dom';
import { Shield, LogOut, RefreshCw } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useProperty } from '../../contexts/PropertyContext';

const ADMIN_TAB_MAP = [
  { prefix: '/admin/verifications', name: 'Verifications', tag: 'Deeds & Cadastral Queue' },
  { prefix: '/admin/properties', name: 'Properties', tag: 'Property Inventory' },
  { prefix: '/admin/inventory', name: 'Properties', tag: 'Property Inventory' },
  { prefix: '/admin/bookings', name: 'Book & Call', tag: 'Site Visits & Phone Requests' },
  { prefix: '/admin/calls', name: 'Book & Call', tag: 'Site Visits & Phone Requests' },
  { prefix: '/admin/support', name: 'Support', tag: 'Citizen Grievances & Mediation' },
  { prefix: '/admin/customers', name: 'Customers', tag: 'User Accounts & Roles' },
  { prefix: '/admin/reports', name: 'Reports', tag: 'BI & Analytics' },
  { prefix: '/admin/settings', name: 'Settings', tag: 'Platform Configuration' },
  { prefix: '/admin/mediation', name: 'Mediation', tag: 'Dispute Mediation' },
  { prefix: '/admin/escrows', name: 'Escrow', tag: 'Escrow Accounts' },
  { prefix: '/admin/audit', name: 'Audit Logs', tag: 'Security Audit Trail' },
  { prefix: '/admin/dashboard', name: 'Dashboard', tag: 'Executive Overview' },
];

export default function AdminDashboard() {
  const { logout, isAdmin } = useAuth();
  const { loadAdminData, isMobile } = useProperty();
  const location = useLocation();

  const activeTab = useMemo(() => {
    const currentPath = location.pathname.toLowerCase();
    const found = ADMIN_TAB_MAP.find(tab => currentPath.startsWith(tab.prefix));
    return found || { name: 'Dashboard', tag: 'Executive Overview' };
  }, [location.pathname]);

  // Admin Data Sync
  useEffect(() => {
    if (isAdmin && typeof loadAdminData === 'function') {
      loadAdminData();
    }
  }, [isAdmin, loadAdminData]);

  // If not admin, immediately redirect to normal user explorer
  if (!isAdmin) {
    return <Navigate to="/explore" replace />;
  }

  return (
    <div className={`space-y-4 sm:space-y-6 ${isMobile ? 'p-3 pb-24' : 'max-w-7xl mx-auto p-6'}`}>
      {/* Super Admin Top Header */}
      <div className={`bg-gradient-to-r from-slate-950 via-slate-900 to-[#184631] text-white ${isMobile ? 'p-3.5 rounded-2xl' : 'p-5 rounded-3xl'} border border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4`}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shrink-0 shadow-md">
            <Shield className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-black text-white">
                Super Admin Console
              </h2>
              <span className="text-[9px] sm:text-[10px] bg-amber-400 text-slate-950 font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                Full Control
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-emerald-500/25 border border-emerald-400/40 text-emerald-300 text-xs font-black tracking-wide shadow-xs uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                {activeTab.name}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-emerald-300/80 font-medium mt-0.5">
              One Dashboard • Complete Governance
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={loadAdminData}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Refresh All Queues"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => logout('/explore')}
            className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            title="Sign out and reload as normal user"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Exit Admin</span>
          </button>
        </div>
      </div>

      {/* Render Active Admin Subpage */}
      <Outlet />
    </div>
  );
}
