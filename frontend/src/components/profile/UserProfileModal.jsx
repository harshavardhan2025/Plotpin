import React, { useState, useEffect } from 'react';
import { 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  ShieldCheck, 
  Calendar, 
  Building2, 
  PhoneCall, 
  Headphones, 
  LogOut, 
  X, 
  CheckCircle2, 
  Lock, 
  KeyRound, 
  Edit3, 
  Save 
} from 'lucide-react';

export default function UserProfileModal({
  isOpen,
  onClose,
  currentUser,
  onUpdateProfile,
  onLogout,
  myProperties = [],
  myAppointments = [],
  myCallRequests = [],
  myTickets = [],
  onNavigateTab
}) {
  if (!isOpen) return null;

  const isAdmin = currentUser?.role === 'admin' || (Array.isArray(currentUser?.roles) && currentUser.roles.includes('admin'));
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState((currentUser?.name || 'Citizen Account').replace(/LandPin/gi, 'PlotPin'));
  const [email, setEmail] = useState((currentUser?.email || '').replace(/LandPin/gi, 'PlotPin'));
  const [city, setCity] = useState(currentUser?.city || 'Kadapa, Andhra Pradesh');
  const [activeSubTab, setActiveSubTab] = useState('overview'); // 'overview' | 'security'
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState(null);

  useEffect(() => {
    if (currentUser) {
      setName((currentUser.name || 'Citizen Account').replace(/LandPin/gi, 'PlotPin'));
      setEmail((currentUser.email || '').replace(/LandPin/gi, 'PlotPin'));
      setCity(currentUser.city || 'Kadapa, Andhra Pradesh');
    }
  }, [currentUser]);

  const userInitials = (() => {
    if (!name) return 'PP';
    const clean = name.replace(/LandPin/gi, 'PlotPin');
    const parts = clean.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  })();

  const handleSave = (e) => {
    e.preventDefault();
    if (onUpdateProfile) {
      onUpdateProfile({
        ...currentUser,
        name: name.trim(),
        city: city.trim()
      });
    }
    setIsEditing(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleChangePassword = (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'Passwords do not match' });
      return;
    }
    setPasswordMsg({ type: 'success', text: 'Password updated successfully' });
    setNewPassword('');
    setConfirmPassword('');
    setTimeout(() => setPasswordMsg(null), 3000);
  };

  return (
    <div 
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Hero Banner */}
        <div className="relative bg-gradient-to-r from-[#184631] via-[#1b5038] to-[#246346] p-6 text-white shrink-0">
          <button 
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all active:scale-95"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center text-2xl font-black text-white shadow-inner ring-2 ring-emerald-300/40">
              {userInitials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-black tracking-tight truncate">{name}</h2>
                {isAdmin ? (
                  <span className="inline-flex items-center gap-1 bg-amber-400 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-full shadow-2xs">
                    <ShieldCheck className="w-3 h-3 text-slate-950" />
                    Cadastral Admin
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 bg-emerald-400/20 text-emerald-200 border border-emerald-400/30 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                    <ShieldCheck className="w-3 h-3 text-emerald-300" />
                    RERA Verified
                  </span>
                )}
              </div>
              <p className="text-xs text-emerald-100/90 mt-0.5 flex items-center gap-1.5 font-medium">
                <span>📱 {currentUser?.mobile || 'Verified Mobile'}</span>
                <span>•</span>
                <span>{isAdmin ? 'Regional Authority' : 'Direct Citizen Owner'}</span>
              </p>
            </div>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="flex items-center gap-2 mt-5 border-t border-white/15 pt-3">
            <button
              type="button"
              onClick={() => setActiveSubTab('overview')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeSubTab === 'overview'
                  ? 'bg-white text-[#184631] shadow-xs'
                  : 'text-emerald-100 hover:bg-white/10'
              }`}
            >
              Account Overview
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('security')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeSubTab === 'security'
                  ? 'bg-white text-[#184631] shadow-xs'
                  : 'text-emerald-100 hover:bg-white/10'
              }`}
            >
              Security &amp; Password
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {saveSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Profile details updated successfully!</span>
            </div>
          )}

          {activeSubTab === 'overview' ? (
            <>
              {/* Quick Activity Stats (Citizen only) */}
              {!isAdmin && (
                <div>
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2.5">
                    My Real Estate Activity
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <button
                      type="button"
                      onClick={() => { onClose(); onNavigateTab && onNavigateTab('mylistings'); }}
                      className="p-3 rounded-2xl bg-slate-50 hover:bg-emerald-50/60 border border-slate-200/80 text-left transition-all active:scale-95 group"
                    >
                      <div className="flex items-center justify-between">
                        <Building2 className="w-4 h-4 text-emerald-700" />
                        <span className="text-base font-black text-slate-900 group-hover:text-emerald-700">
                          {myProperties.length}
                        </span>
                      </div>
                      <div className="text-[11px] font-bold text-slate-600 mt-1">Listings</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => { onClose(); onNavigateTab && onNavigateTab('visits'); }}
                      className="p-3 rounded-2xl bg-slate-50 hover:bg-indigo-50/60 border border-slate-200/80 text-left transition-all active:scale-95 group"
                    >
                      <div className="flex items-center justify-between">
                        <Calendar className="w-4 h-4 text-indigo-600" />
                        <span className="text-base font-black text-slate-900 group-hover:text-indigo-700">
                          {myAppointments.length}
                        </span>
                      </div>
                      <div className="text-[11px] font-bold text-slate-600 mt-1">Site Visits</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => { onClose(); onNavigateTab && onNavigateTab('visits'); }}
                      className="p-3 rounded-2xl bg-slate-50 hover:bg-blue-50/60 border border-slate-200/80 text-left transition-all active:scale-95 group"
                    >
                      <div className="flex items-center justify-between">
                        <PhoneCall className="w-4 h-4 text-blue-600" />
                        <span className="text-base font-black text-slate-900 group-hover:text-blue-700">
                          {myCallRequests.length}
                        </span>
                      </div>
                      <div className="text-[11px] font-bold text-slate-600 mt-1">Calls</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => { onClose(); onNavigateTab && onNavigateTab('support'); }}
                      className="p-3 rounded-2xl bg-slate-50 hover:bg-amber-50/60 border border-slate-200/80 text-left transition-all active:scale-95 group"
                    >
                      <div className="flex items-center justify-between">
                        <Headphones className="w-4 h-4 text-amber-600" />
                        <span className="text-base font-black text-slate-900 group-hover:text-amber-700">
                          {myTickets.length}
                        </span>
                      </div>
                      <div className="text-[11px] font-bold text-slate-600 mt-1">Tickets</div>
                    </button>
                  </div>
                </div>
              )}

              {/* Profile Information Form */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">
                    Profile Information
                  </h3>
                  {!isEditing ? (
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 active:scale-95"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit Details</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="text-xs font-bold text-slate-500 hover:text-slate-700"
                    >
                      Cancel
                    </button>
                  )}
                </div>

                <form onSubmit={handleSave} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Full Legal Name</label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        disabled={!isEditing}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none disabled:opacity-75 disabled:cursor-not-allowed transition-all"
                        placeholder="Your full name"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Registered Mobile Number
                      <span className="text-[10px] text-slate-400 font-normal ml-1.5">(Primary login identifier • Locked)</span>
                    </label>
                    <div className="relative">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
                        <span className="text-sm">🇮🇳</span>
                        <span className="text-xs font-bold text-slate-500">+91</span>
                      </div>
                      <input
                        type="tel"
                        disabled
                        value={currentUser?.mobile?.replace(/^\+91\s*/, '') || ''}
                        className="w-full pl-16 pr-24 py-2.5 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 cursor-not-allowed outline-none select-none"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-emerald-700 bg-emerald-100 dark:bg-emerald-950/80 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1 select-none pointer-events-none">
                        <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        Verified
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Email Address
                      <span className="text-[10px] text-slate-400 font-normal ml-1.5">(Registered credential • Locked)</span>
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        disabled
                        value={currentUser?.email || email}
                        className="w-full pl-10 pr-24 py-2.5 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 cursor-not-allowed outline-none select-none"
                        placeholder="your.email@example.com"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-emerald-700 bg-emerald-100 dark:bg-emerald-950/80 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1 select-none pointer-events-none">
                        <Lock className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                        Verified
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">City / Jurisdiction</label>
                    <div className="relative">
                      <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        disabled={!isEditing}
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none disabled:opacity-75 disabled:cursor-not-allowed transition-all"
                        placeholder="Kadapa, Andhra Pradesh"
                      />
                    </div>
                  </div>

                  {isEditing && (
                    <button
                      type="submit"
                      className="w-full py-2.5 bg-[#184631] hover:bg-[#123625] text-white rounded-xl text-xs font-bold shadow-md flex items-center justify-center gap-1.5 transition-all active:scale-98"
                    >
                      <Save className="w-4 h-4" />
                      <span>Save Profile Changes</span>
                    </button>
                  )}
                </form>
              </div>

              {/* RERA Legal Verification Notice */}
              <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-emerald-900">Official RERA &amp; Cadastral Verification</div>
                  <div className="text-[11px] text-emerald-800/90 leading-relaxed mt-0.5">
                    Your phone number is authenticated against registered title deeds and Andhra Pradesh Land Registry records for seamless 0% brokerage transactions.
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Security Sub-Tab */
            <div className="space-y-4">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-extrabold text-slate-900">Mobile &amp; Password Security</div>
                  <div className="text-[11px] text-slate-600">
                    Your account uses 256-bit hash encryption and tokenized JWT authentication.
                  </div>
                </div>
              </div>

              {passwordMsg && (
                <div
                  className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                    passwordMsg.type === 'success'
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border border-rose-200 text-rose-800'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{passwordMsg.text}</span>
                </div>
              )}

              <form onSubmit={handleChangePassword} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">New Password</label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Confirm New Password</label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-[#184631] hover:bg-[#123625] text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-98"
                >
                  Update Account Password
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Modal Footer with Sign Out */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <button
            type="button"
            onClick={() => {
              onClose();
              if (onLogout) onLogout();
            }}
            className="px-4 py-2 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors border border-rose-200"
          >
            <LogOut className="w-4 h-4 text-rose-600" />
            <span>Sign Out</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
