import React, { useState, useEffect, useMemo } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  Compass, MapPin, Sparkles, Building2, Heart, Calendar, Headphones,
  Plus, LogIn, LogOut, User, Shield, Moon, Sun, ShoppingBag,
  LayoutDashboard, BarChart3, Users, ShieldCheck, PlusCircle
} from 'lucide-react';
import PlotPinLogo from '../common/PlotPinLogo';
import { useAuth } from '../../contexts/AuthContext';
import { useProperty } from '../../contexts/PropertyContext';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    currentUser,
    isLoggedIn,
    hasAdminPrivilege,
    isAdmin,
    activeRole,
    setActiveRole,
    userInitials,
    setShowAuthModal,
    setAuthModalMode,
    setShowProfileModal,
    logout,
    showToast
  } = useAuth();

  const {
    myProperties = [],
    myBuyings = [],
    myAppointments = [],
    favoriteIds = [],
    isMobile,
    handleOpenCreateModal,
    adminQueue = [],
    adminCalls = [],
    adminApprovedProperties = [],
    adminTickets = [],
    adminAppointments = [],
    adminCustomers = []
  } = useProperty();

  const [theme, setTheme] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('plotpin_theme') || localStorage.getItem('landpin_theme') || 'light';
    }
    return 'light';
  });

  const [showProfileMenu, setShowProfileMenu] = useState(false);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
        document.body.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
        document.body.classList.remove('dark');
      }
    }
  }, [theme]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', next);
      if (next === 'dark') {
        document.documentElement.classList.add('dark');
        document.body.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
        document.body.classList.remove('dark');
      }
      localStorage.setItem('plotpin_theme', next);
      localStorage.setItem('landpin_theme', next);
    }
    showToast(next === 'dark' ? '🌙 Dark Mode' : '☀️ Light Mode');
  };

  const citizenNavItems = [
    { to: '/explore', label: 'Explore', icon: Compass },
    { to: '/map', label: 'Map', icon: MapPin },
    { to: '/ai', label: 'AI Match', icon: Sparkles, badge: 'Smart' },
    { to: '/portfolio/my-listings', label: 'My Listings', icon: Building2, requiresAuth: true },
    { to: '/support', label: 'Support', icon: Headphones, requiresAuth: true },
    { to: '/saved', label: 'Saved', icon: Heart, count: (favoriteIds || []).length, requiresAuth: true },
    { to: '/visits', label: 'Site Visits', icon: Calendar, requiresAuth: true }
  ];

  // Present (active) Book & Call count
  const presentBookingsCount = useMemo(() => {
    const presentBookings = (adminAppointments || []).filter(b => {
      const status = typeof b.status === 'string' ? b.status.toLowerCase() : (b.status?.status || '');
      return status === 'pending' || status === 'confirmed' || status === 'rescheduled';
    }).length;
    const presentCalls = (adminCalls || []).filter(c => {
      const status = typeof c.status === 'string' ? c.status.toLowerCase() : (c.status?.status || '');
      return status === 'pending' || status === 'follow_up' || status === 'requested';
    }).length;
    return presentBookings + presentCalls;
  }, [adminAppointments, adminCalls]);

  // Present (available) Properties count
  const presentPropertiesCount = useMemo(() => {
    return (adminApprovedProperties || []).filter(p => {
      const status = (p.availabilityStatus || p.status || '').toLowerCase();
      const pubStatus = (p.publicationStatus || '').toLowerCase();
      return (status === 'available' || (!status && pubStatus === 'published')) && pubStatus !== 'archived' && status !== 'sold' && status !== 'rented';
    }).length;
  }, [adminApprovedProperties]);

  // Present (pending review) Verifications count
  const presentQueueCount = useMemo(() => {
    return (adminQueue || []).filter(q => {
      const status = (q.verificationStatus || q.status || '').toLowerCase();
      return status !== 'approved' && status !== 'verified' && status !== 'rejected' && status !== 'archived';
    }).length;
  }, [adminQueue]);

  // Present (open/pending) Support tickets count
  const presentTicketsCount = useMemo(() => {
    return (adminTickets || []).filter(t => {
      const status = (t.status || '').toLowerCase();
      return status !== 'resolved' && status !== 'closed' && status !== 'rejected';
    }).length;
  }, [adminTickets]);

  const adminNavItems = [
    { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/admin/verifications', label: 'Verifications', icon: ShieldCheck, count: presentQueueCount },
    { to: '/admin/properties', label: 'Properties', icon: Building2, count: presentPropertiesCount },
    { to: '/admin/bookings', label: 'Book & Call', icon: Calendar, count: presentBookingsCount },
    { to: '/admin/support', label: 'Support', icon: Headphones, count: presentTicketsCount },
    { to: '/admin/customers', label: 'Customers', icon: Users, count: (adminCustomers || []).length },
    { to: '/admin/reports', label: 'Reports', icon: BarChart3 }
  ];

  const navItems = isAdmin ? adminNavItems : citizenNavItems;

  return (
    <>
      {/* Primary Clean Navigation Bar */}
      <nav className="bg-white dark:bg-[#131E31] border-b border-slate-200/90 dark:border-slate-800 px-3.5 sm:px-6 py-2.5 sticky top-0 z-50 shadow-xs transition-colors">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Brand Logo */}
          <NavLink to={isAdmin ? "/admin/dashboard" : "/explore"} className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-xl plotpin-brand-badge p-1 flex items-center justify-center shrink-0">
              <PlotPinLogo className="w-full h-full object-contain" />
            </div>
            <span className="font-black text-lg text-slate-900 dark:text-white tracking-tight flex items-center">
              Plot<span className="text-[#184631] dark:text-emerald-400">Pin</span>
            </span>
          </NavLink>

          {/* Desktop Nav Items */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={(e) => {
                    if (item.requiresAuth && !isLoggedIn) {
                      e.preventDefault();
                      setAuthModalMode('login');
                      setShowAuthModal(true);
                      showToast(`Please sign in to access ${item.label}`);
                    }
                  }}
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      isActive
                        ? isAdmin
                          ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                          : 'bg-[#184631] text-white shadow-xs dark:bg-emerald-600'
                        : isAdmin
                          ? 'bg-white dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border border-slate-200/90 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-[#E8F3EE] dark:hover:bg-slate-800 hover:text-[#184631] dark:hover:text-white'
                    }`
                  }
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                  {item.count !== undefined && item.count > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                      isAdmin ? 'bg-slate-900 text-white' : 'bg-rose-500 text-white'
                    }`}>
                      {item.count}
                    </span>
                  )}
                  {item.badge && (
                    <span className="text-[9px] bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 px-1 py-0.2 rounded font-extrabold uppercase">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </div>

          {/* Right Action Cluster: Post Button, Dark Toggle, and Profile */}
          <div className="flex items-center gap-2">
            {/* Post Listing (Citizen only) */}
            {!isAdmin && (
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="bg-[#184631] hover:bg-[#123625] active:scale-95 text-white font-bold text-xs px-3 sm:px-3.5 py-1.5 rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Post Listing</span>
              </button>
            )}

            {/* Dark Mode Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center transition-all cursor-pointer border border-slate-200/80 dark:border-slate-700"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700 dark:text-slate-300" />
              )}
            </button>

            {/* Profile Menu / Sign In */}
            {isLoggedIn ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowProfileMenu((prev) => !prev)}
                  className="flex items-center gap-2 p-1 sm:px-2.5 sm:py-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-all cursor-pointer border border-slate-200/80 dark:border-slate-700"
                  title="User Profile"
                >
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-[#184631] text-white text-[11px] font-black flex items-center justify-center shrink-0">
                    {userInitials}
                  </div>
                  <span className="hidden md:inline font-bold text-xs text-slate-800 dark:text-slate-100 max-w-[110px] truncate">
                    {currentUser?.name || 'Citizen'}
                  </span>
                </button>

                {showProfileMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowProfileMenu(false)}
                    />
                    <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-[#131E31] text-slate-800 dark:text-slate-100 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 py-2 z-50 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 max-h-[85vh] overflow-y-auto">
                      {/* User Profile Header */}
                      <div className="px-4 py-3 bg-slate-50/80 dark:bg-slate-800/60">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                            {(currentUser?.name || 'Citizen').replace(/LandPin/gi, 'PlotPin')}
                          </p>
                          {isAdmin ? (
                            <span className="shrink-0 text-[10px] uppercase font-black px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700">
                              Admin
                            </span>
                          ) : (
                            <span className="shrink-0 text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700">
                              Citizen
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5 truncate">
                          {currentUser?.mobile || (currentUser?.email ? currentUser.email.replace(/LandPin/gi, 'PlotPin') : '')}
                        </p>
                      </div>

                      {/* Role-Specific Navigation Menu */}
                      {isAdmin ? (
                        <div className="py-1.5 bg-slate-50/50 dark:bg-slate-850/50">
                          <div className="px-4 py-1 text-[10px] font-black tracking-wider uppercase text-amber-800 dark:text-amber-400 flex items-center gap-1">
                            <Shield className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                            <span>Administrative Center</span>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setShowProfileMenu(false);
                              navigate('/admin/dashboard');
                            }}
                            className="w-full text-left px-4 py-2 text-xs font-semibold hover:bg-amber-50/80 dark:hover:bg-slate-800 flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:text-amber-900 dark:hover:text-amber-300 transition-colors cursor-pointer"
                          >
                            <LayoutDashboard className="w-4 h-4 text-amber-600" />
                            <span>Executive Dashboard</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setShowProfileMenu(false);
                              navigate('/admin/properties');
                            }}
                            className="w-full text-left px-4 py-2 text-xs font-semibold hover:bg-amber-50/80 dark:hover:bg-slate-800 flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:text-amber-900 dark:hover:text-amber-300 transition-colors cursor-pointer"
                          >
                            <Building2 className="w-4 h-4 text-amber-600" />
                            <span>Property Inventory</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setShowProfileMenu(false);
                              navigate('/admin/bookings');
                            }}
                            className="w-full text-left px-4 py-2 text-xs font-semibold hover:bg-amber-50/80 dark:hover:bg-slate-800 flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:text-amber-900 dark:hover:text-amber-300 transition-colors cursor-pointer"
                          >
                            <Calendar className="w-4 h-4 text-amber-600" />
                            <span>Book &amp; Call</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setShowProfileMenu(false);
                              navigate('/admin/support');
                            }}
                            className="w-full text-left px-4 py-2 text-xs font-semibold hover:bg-amber-50/80 dark:hover:bg-slate-800 flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:text-amber-900 dark:hover:text-amber-300 transition-colors cursor-pointer"
                          >
                            <Headphones className="w-4 h-4 text-amber-600" />
                            <span>Support</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setShowProfileMenu(false);
                              navigate('/admin/customers');
                            }}
                            className="w-full text-left px-4 py-2 text-xs font-semibold hover:bg-amber-50/80 dark:hover:bg-slate-800 flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:text-amber-900 dark:hover:text-amber-300 transition-colors cursor-pointer"
                          >
                            <Users className="w-4 h-4 text-amber-600" />
                            <span>Customer Directory</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setShowProfileMenu(false);
                              navigate('/admin/reports');
                            }}
                            className="w-full text-left px-4 py-2 text-xs font-semibold hover:bg-amber-50/80 dark:hover:bg-slate-800 flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:text-amber-900 dark:hover:text-amber-300 transition-colors cursor-pointer"
                          >
                            <BarChart3 className="w-4 h-4 text-amber-600" />
                            <span>Reports &amp; Analytics</span>
                          </button>
                        </div>
                      ) : (
                        <div className="py-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setShowProfileMenu(false);
                              navigate('/portfolio/my-listings');
                            }}
                            className="w-full text-left px-4 py-2 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between text-slate-700 dark:text-slate-200 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5">
                              <Building2 className="w-4 h-4 text-emerald-600" />
                              <span>My Listings</span>
                            </div>
                            {myProperties?.length > 0 && (
                              <span className="text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-700">
                                {myProperties.length}
                              </span>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setShowProfileMenu(false);
                              navigate('/portfolio/my-buyings');
                            }}
                            className="w-full text-left px-4 py-2 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between text-slate-700 dark:text-slate-200 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5">
                              <ShoppingBag className="w-4 h-4 text-emerald-600" />
                              <span>Purchased Deeds</span>
                            </div>
                            {myBuyings?.length > 0 && (
                              <span className="text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-700">
                                {myBuyings.length}
                              </span>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setShowProfileMenu(false);
                              navigate('/saved');
                            }}
                            className="w-full text-left px-4 py-2 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between text-slate-700 dark:text-slate-200 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5">
                              <Heart className="w-4 h-4 text-rose-500" />
                              <span>Saved Wishlist</span>
                            </div>
                            {favoriteIds?.length > 0 && (
                              <span className="text-[10px] font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-300 px-1.5 py-0.5 rounded-full border border-rose-200 dark:border-rose-700">
                                {favoriteIds.length}
                              </span>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setShowProfileMenu(false);
                              navigate('/visits');
                            }}
                            className="w-full text-left px-4 py-2 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between text-slate-700 dark:text-slate-200 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5">
                              <Calendar className="w-4 h-4 text-blue-600" />
                              <span>Site Visits &amp; Calls</span>
                            </div>
                            {myAppointments?.length > 0 && (
                              <span className="text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-700">
                                {myAppointments.length}
                              </span>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setShowProfileMenu(false);
                              navigate('/support');
                            }}
                            className="w-full text-left px-4 py-2 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors cursor-pointer"
                          >
                            <Headphones className="w-4 h-4 text-amber-600" />
                            <span>Support</span>
                          </button>

                          {hasAdminPrivilege && (
                            <button
                              type="button"
                              onClick={() => {
                                setShowProfileMenu(false);
                                setActiveRole('admin');
                                navigate('/admin/dashboard');
                              }}
                              className="w-full text-left px-4 py-2 text-xs font-bold text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-slate-800 flex items-center gap-2.5 transition-colors cursor-pointer border-t border-slate-100 dark:border-slate-800 mt-1 pt-2"
                            >
                              <Shield className="w-4 h-4 text-amber-600" />
                              <span>Switch to Admin Workspace</span>
                            </button>
                          )}
                        </div>
                      )}

                      {/* Account Settings & Sign Out */}
                      <div className="py-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setShowProfileMenu(false);
                            setShowProfileModal(true);
                          }}
                          className="w-full text-left px-4 py-2 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2.5 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                        >
                          <User className="w-4 h-4 text-slate-500" />
                          <span>Profile &amp; Settings</span>
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowProfileMenu(false);
                              setActiveRole('user');
                            }}
                            className="w-full text-left px-4 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-slate-800 flex items-center gap-2.5 transition-colors cursor-pointer"
                          >
                            <User className="w-4 h-4 text-emerald-600" />
                            <span>Switch to Citizen View</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setShowProfileMenu(false);
                            logout('/explore');
                          }}
                          className="w-full text-left px-4 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 flex items-center gap-2.5 transition-colors cursor-pointer"
                        >
                          <LogOut className="w-4 h-4 text-rose-500" />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setAuthModalMode('login');
                  setShowAuthModal(true);
                }}
                className="bg-[#184631] hover:bg-[#123625] text-white font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all text-xs cursor-pointer shadow-xs"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-[#131E31]/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-2 py-1.5 z-40 flex items-center justify-around shadow-lg">
        {navItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={(e) => {
                if (item.requiresAuth && !isLoggedIn) {
                  e.preventDefault();
                  setAuthModalMode('login');
                  setShowAuthModal(true);
                  showToast(`Please sign in to access ${item.label}`);
                }
              }}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                  isActive
                    ? isAdmin
                      ? 'text-amber-800 dark:text-amber-400 font-black'
                      : 'text-[#184631] dark:text-emerald-400'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`
              }
            >
              <div className="relative">
                <Icon className="w-4 h-4" />
                {item.count !== undefined && item.count > 0 && (
                  <span className={`absolute -top-1 -right-2 text-[8px] px-1 py-0.2 rounded-full font-black ${
                    isAdmin ? 'bg-amber-400 text-slate-950 shadow-2xs' : 'bg-rose-500 text-white'
                  }`}>
                    {item.count}
                  </span>
                )}
              </div>
              <span className="truncate max-w-[64px] text-center">{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </>
  );
}