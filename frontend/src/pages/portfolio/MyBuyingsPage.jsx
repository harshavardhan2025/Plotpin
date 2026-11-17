import React from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, Building2, CheckCircle2, FileText } from 'lucide-react';
import { useProperty } from '../../contexts/PropertyContext';
import { formatINR } from '../../utils/propertyHelpers';

export default function MyBuyingsPage() {
  const { myBuyings, myProperties, isMobile, handleOpenDeedModal } = useProperty();

  const totalSpent = myBuyings.reduce((sum, item) => sum + (Number(item.price || item.dealAmount || 0)), 0);

  return (
    <div className={`space-y-6 max-w-7xl mx-auto ${isMobile ? 'p-3 pb-24' : 'p-6'}`}>
      {/* Portfolio Sub-Nav Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Link
            to="/portfolio/my-listings"
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200/80 dark:border-slate-700 flex items-center gap-2 transition-colors"
          >
            <Building2 className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span>My Listings ({myProperties.length})</span>
          </Link>
          <Link
            to="/portfolio/my-buyings"
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#E3F7EB] dark:bg-emerald-950/60 text-[#0A563C] dark:text-emerald-300 border border-[#0A563C]/30 dark:border-emerald-700/60 shadow-2xs flex items-center gap-2"
          >
            <CreditCard className="w-4 h-4 text-[#0A563C] dark:text-emerald-400" />
            <span>Purchased Deeds ({myBuyings.length})</span>
          </Link>
        </div>

        <Link
          to="/explore"
          className="px-3.5 py-1.5 bg-[#184631] hover:bg-[#123625] text-white rounded-xl text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-all self-start sm:self-auto"
        >
          <span>Explore Properties</span>
        </Link>
      </div>

      {/* Capital Summary - only shown if user has purchases */}
      {myBuyings.length > 0 && (
        <div className="bg-[#184631] text-white p-5 rounded-2xl shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-200">
              Total Purchases
            </span>
            <h2 className="text-2xl font-black mt-0.5">{formatINR(totalSpent)}</h2>
          </div>
          <span className="text-xs font-bold text-emerald-100 bg-white/10 px-3 py-1.5 rounded-xl border border-white/20">
            {myBuyings.length} {myBuyings.length === 1 ? 'Property' : 'Properties'}
          </span>
        </div>
      )}

      {/* Bought Deeds List */}
      <div className="space-y-4">
        {myBuyings.length === 0 ? (
          <div className="bg-white dark:bg-[#131E31] p-10 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-3 shadow-2xs">
            <CreditCard className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
            <h4 className="font-bold text-base text-slate-900 dark:text-white">No properties purchased yet</h4>
            <div>
              <Link
                to="/explore"
                className="px-4 py-2 bg-[#184631] hover:bg-[#123625] text-white rounded-xl text-xs font-bold shadow-2xs transition-all inline-flex items-center gap-1.5 mt-1"
              >
                <span>Explore Properties</span>
              </Link>
            </div>
          </div>
        ) : (
          myBuyings.map((deal) => {
            const prop = deal.property || deal;
            const dealId = deal._id || deal.id;
            const isRented = deal.outcome === 'rented' || deal.dealType === 'rented' || prop.purpose === 'rent';
            const dealAmount = deal.dealAmount || deal.salePrice || deal.leasePrice || prop.price;

            return (
              <div
                key={dealId}
                className="bg-white dark:bg-[#131E31] p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                      <span>{isRented ? 'Rented' : 'Purchased'}</span>
                    </span>
                    <span className="text-xs font-mono text-slate-400 dark:text-slate-500">#{dealId}</span>
                  </div>

                  <h4 className="font-bold text-base text-slate-900 dark:text-white">{prop.title}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {prop.location?.address || prop.location?.locality} · <strong className="text-slate-900 dark:text-slate-100 font-semibold">{formatINR(dealAmount)}</strong>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenDeedModal(prop)}
                    className="px-3.5 py-1.5 rounded-xl bg-[#184631] hover:bg-[#123625] text-white text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>View Deed</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
