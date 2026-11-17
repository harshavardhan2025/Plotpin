import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, MapPin, Headphones, FileText, GraduationCap } from 'lucide-react';
import PlotPinLogo from '../common/PlotPinLogo';

export default function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-300 text-xs border-t border-slate-800 mt-12 pb-16 md:pb-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          {/* Brand Column */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg plotpin-brand-badge p-1 flex items-center justify-center shrink-0">
                <PlotPinLogo className="w-full h-full object-contain" />
              </div>
              <span className="font-black text-base text-white tracking-tight flex items-center gap-1.5">
                Plot<span className="text-emerald-400">Pin</span>
                <span className="text-[10px] bg-emerald-950/80 text-emerald-400 border border-emerald-800/80 px-2 py-0.5 rounded-full font-bold">
                  Demo
                </span>
              </span>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed">
              A full-stack demonstration project showcasing a zero-brokerage direct buyer-to-owner property marketplace with simulated cadastral demarcations and verified title deed inspection.
            </p>
          </div>

          {/* Quick Links */}
          <div className="space-y-2">
            <h4 className="font-extrabold text-white uppercase text-[11px] tracking-wider">Marketplace</h4>
            <ul className="space-y-1.5 text-slate-400">
              <li><Link to="/explore" className="hover:text-emerald-400 transition-colors">Explore All Properties</Link></li>
              <li><Link to="/map" className="hover:text-emerald-400 transition-colors">Interactive Geospatial Map</Link></li>
              <li><Link to="/ai" className="hover:text-emerald-400 transition-colors">AI Match &amp; Valuation</Link></li>
              <li><Link to="/portfolio/my-listings" className="hover:text-emerald-400 transition-colors">Seller Dashboard</Link></li>
            </ul>
          </div>

          {/* Citizen Services */}
          <div className="space-y-2">
            <h4 className="font-extrabold text-white uppercase text-[11px] tracking-wider"> Services</h4>
            <ul className="space-y-1.5 text-slate-400">
              <li><Link to="/visits" className="hover:text-emerald-400 transition-colors">Schedule Site Visit</Link></li>
              <li><Link to="/portfolio/my-buyings" className="hover:text-emerald-400 transition-colors">Purchased Deeds</Link></li>
              <li><Link to="/support" className="hover:text-emerald-400 transition-colors">Help &amp; Support</Link></li>
              <li><Link to="/admin/login" className="hover:text-amber-400 transition-colors">Admin Console</Link></li>
            </ul>
          </div>

          {/* Demonstration Scope */}
          <div className="space-y-2">
            <h4 className="font-extrabold text-white uppercase text-[11px] tracking-wider">Project Scope</h4>
            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60 space-y-1.5">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-[11px]">
                <GraduationCap className="w-4 h-4 shrink-0" />
                <span>PlotPin Project</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">
                Developed for academic evaluation . All property listings, cadastral boundaries, and deeds are simulated.
              </p>
            </div>
          </div>
        </div>

        {/* Disclaimer & Copyright */}
        <div className="pt-6 border-t border-slate-800/80 text-center md:flex md:justify-between items-center text-slate-500 text-[11px]">
          <p>© {new Date().getFullYear()} PlotPin · Student Demonstration Project </p>
          <p className="mt-2 md:mt-0">
            For demonstration and educational purposes only. Not a licensed commercial brokerage or government authority.
          </p>
        </div>
      </div>
    </footer>
  );
}

