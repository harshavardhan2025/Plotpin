import React, { useState } from 'react';
import { 
  Settings, Shield, Phone, Mail, MapPin, Save, RefreshCw, 
  AlertTriangle, CheckCircle2, ShieldCheck, Database, Sliders, 
  Power, Globe, Check
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { useProperty } from '../../../contexts/PropertyContext';

const DEFAULT_SETTINGS = {
  platformName: 'PlotPin Property Demonstration',
  hotlinePhone: '+91 80 4190 0001',
  supportEmail: 'demo@plotpin.dev',
  officeAddress: 'Academic Project Demo · Andhra Pradesh',
  zeroBrokerageNotice: 'Zero-brokerage direct deal network prototype for demonstration.',
  maintenanceMode: false,
  activeDistricts: [
    'Kadapa', 'Visakhapatnam', 'Vijayawada', 'Tirupati', 
    'Guntur', 'Kakinada', 'Kurnool', 'Nellore', 'Rajahmundry', 'Anantapur'
  ]
};

const ALL_AP_DISTRICTS = [
  'Kadapa', 'Visakhapatnam', 'Vijayawada', 'Tirupati', 'Guntur', 
  'Kakinada', 'Kurnool', 'Nellore', 'Rajahmundry', 'Anantapur',
  'Chittoor', 'Eluru', 'Nandyal', 'Bapatla', 'Palnadu', 'Prakasam',
  'Srikakulam', 'Vizianagaram', 'West Godavari', 'Anakapalli'
];

export default function AdminSettings() {
  const { showToast } = useAuth();
  const { refreshProperties, isMobile } = useProperty();

  const [settings, setSettings] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem('landpin_platform_settings');
        if (stored) return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
      } catch (e) {
        console.error('Failed to parse settings:', e);
      }
    }
    return DEFAULT_SETTINGS;
  });

  const [isSaving, setIsSaving] = useState(false);

  const handleToggleDistrict = (dist) => {
    setSettings(prev => {
      const exists = prev.activeDistricts.includes(dist);
      const updated = exists 
        ? prev.activeDistricts.filter(d => d !== dist)
        : [...prev.activeDistricts, dist];
      return { ...prev, activeDistricts: updated };
    });
  };

  const handleSaveSettings = (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      localStorage.setItem('landpin_platform_settings', JSON.stringify(settings));
      showToast('✓ Super Admin platform settings successfully saved');
    } catch (e) {
      showToast('⚠️ Failed to save settings to storage');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetData = () => {
    if (window.confirm('⚠️ Reset all custom properties, status overrides, booking updates, and call notes to default seed data? This cannot be undone.')) {
      localStorage.removeItem('plotpin_admin_queue');
      localStorage.removeItem('landpin_admin_queue');
      localStorage.removeItem('plotpin_status_overrides');
      localStorage.removeItem('landpin_status_overrides');
      localStorage.removeItem('plotpin_admin_bookings');
      localStorage.removeItem('landpin_admin_bookings');
      localStorage.removeItem('plotpin_admin_calls');
      localStorage.removeItem('landpin_admin_calls');
      localStorage.removeItem('plotpin_admin_tickets');
      localStorage.removeItem('landpin_admin_tickets');
      localStorage.removeItem('plotpin_custom_properties');
      localStorage.removeItem('landpin_custom_properties');
      localStorage.removeItem('plotpin_property_edits');
      localStorage.removeItem('landpin_property_edits');
      localStorage.removeItem('plotpin_platform_settings');
      localStorage.removeItem('landpin_platform_settings');
      showToast('Platform reset to default factory state. Reloading...');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  };

  const handleExportBackup = () => {
    const backup = {
      timestamp: new Date().toISOString(),
      platformSettings: settings,
      statusOverrides: JSON.parse(localStorage.getItem('landpin_status_overrides') || '{}'),
      adminBookings: JSON.parse(localStorage.getItem('landpin_admin_bookings') || '[]'),
      adminCalls: JSON.parse(localStorage.getItem('landpin_admin_calls') || '[]'),
      adminTickets: JSON.parse(localStorage.getItem('landpin_admin_tickets') || '[]'),
      customProperties: JSON.parse(localStorage.getItem('landpin_custom_properties') || '[]'),
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backup, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `plotpin_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('✓ System snapshot downloaded');
  };

  return (
    <div className="space-y-4">
      {/* Top Action Toolbar */}
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={handleExportBackup}
          className="px-4 py-1.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer shadow-2xs"
        >
          <Database className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Export Full JSON Backup</span>
        </button>
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* Section 1: Official Hotline & Contact Channels */}
        <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <Phone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h3 className="font-black text-slate-900 dark:text-white text-base">
              Super Admin Hotline &amp; Identity
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Super Admin / Platform Title
              </label>
              <input
                type="text"
                value={settings.platformName}
                onChange={(e) => setSettings({ ...settings, platformName: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Official Hotline Helpline
              </label>
              <input
                type="text"
                value={settings.hotlinePhone}
                onChange={(e) => setSettings({ ...settings, hotlinePhone: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-mono font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Support &amp; Escalation Email
              </label>
              <input
                type="email"
                value={settings.supportEmail}
                onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Registered Authority Headquarters
              </label>
              <input
                type="text"
                value={settings.officeAddress}
                onChange={(e) => setSettings({ ...settings, officeAddress: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Zero Brokerage Policy Legal Disclaimer
            </label>
            <textarea
              rows={2}
              value={settings.zeroBrokerageNotice}
              onChange={(e) => setSettings({ ...settings, zeroBrokerageNotice: e.target.value })}
              className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-medium"
            />
          </div>
        </div>

        {/* Section 2: District Coverage Controls */}
        <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <h3 className="font-black text-slate-900 dark:text-white text-base">
                Operational District Jurisdictions ({settings.activeDistricts.length} Active)
              </h3>
            </div>
            <span className="text-[11px] text-slate-500 font-bold">
              Toggle districts covered by PlotPin Cadastral Verifiers
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
            {ALL_AP_DISTRICTS.map((dist) => {
              const isActive = settings.activeDistricts.includes(dist);
              return (
                <button
                  key={dist}
                  type="button"
                  onClick={() => handleToggleDistrict(dist)}
                  className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-between gap-1 transition-all cursor-pointer ${
                    isActive
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                      : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300'
                  }`}
                >
                  <span>{dist}</span>
                  {isActive && <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 3: Platform Maintenance & Factory Reset */}
        <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-rose-200 dark:border-rose-950/60 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <h3 className="font-black text-slate-900 dark:text-white text-base">
              Danger Zone &amp; Storage Maintenance
            </h3>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <strong className="text-xs font-black text-slate-900 dark:text-white block">
                Reset Demo Database to Initial Cadastral Seeds
              </strong>
              <p className="text-xs text-slate-500 max-w-lg mt-0.5">
                Clears all custom status updates (Sold, Rented, Returned), local bookings, call logs, and customer grievances, reverting to fresh demo state.
              </p>
            </div>
            <button
              type="button"
              onClick={handleResetData}
              className="px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-black flex items-center gap-2 transition-colors cursor-pointer self-start sm:self-auto"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset Platform Storage</span>
            </button>
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-3 rounded-2xl bg-[#184631] hover:bg-[#123625] text-white text-xs font-black flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving Changes...' : 'Save Super Admin Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

