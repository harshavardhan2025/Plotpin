import React, { useState } from 'react';
import { CreditCard, Lock, Unlock, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useProperty } from '../../../contexts/PropertyContext';
import { useAuth } from '../../../contexts/AuthContext';
import { api } from '../../../lib/api';
import { formatINR } from '../../../utils/propertyHelpers';

export default function EscrowDashboard() {
  const { showToast } = useAuth();
  const { adminEscrows, loadAdminData } = useProperty();
  const [processingId, setProcessingId] = useState(null);

  const handleRelease = async (escrowId) => {
    const confirm = window.confirm('Are you sure you want to authorize the release of these escrow funds to the seller?');
    if (!confirm) return;

    setProcessingId(escrowId);
    try {
      await api.releaseAdminEscrow(escrowId);
      showToast('✅ Escrow funds authorized for disbursement.');
      await loadAdminData();
    } catch (err) {
      showToast(err.message || 'Escrow release failed');
    } finally {
      setProcessingId(null);
    }
  };

  const handleFreeze = async (escrowId) => {
    const reason = window.prompt('Enter official reason for freezing escrow vault:');
    if (!reason || !reason.trim()) return;

    setProcessingId(escrowId);
    try {
      await api.freezeAdminEscrow(escrowId, reason.trim());
      showToast('🔒 Escrow vault frozen pending legal dispute resolution.');
      await loadAdminData();
    } catch (err) {
      showToast(err.message || 'Freeze action failed');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="border-b border-slate-200 pb-3">
        <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
          Escrow &amp; Financial Settlement Dashboard ({adminEscrows.length})
        </h3>
        <p className="text-xs text-slate-500">
          Earnest money token escrow vaults held in legal custody pending cadastral transfer
        </p>
      </div>

      <div className="bg-purple-50/70 border border-purple-200 p-4 rounded-2xl flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-purple-700 shrink-0 mt-0.5" />
        <div className="text-xs text-purple-900 leading-relaxed">
          <strong>Settlement Protocol:</strong> Escrow deposits require verified cadastral boundary survey reports and buyer handover confirmation prior to administrative fund release.
        </div>
      </div>

      <div className="space-y-3">
        {adminEscrows.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
            No active escrow vaults in this district.
          </div>
        ) : (
          adminEscrows.map((vault) => {
            const vaultId = vault._id || vault.id;
            const isFrozen = vault.status === 'frozen';

            return (
              <div
                key={vaultId}
                className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                        isFrozen
                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                          : vault.status === 'released'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                          : 'bg-purple-100 text-purple-800 border border-purple-300'
                      }`}
                    >
                      {isFrozen ? 'Vault Frozen' : vault.status || 'Active In Escrow'}
                    </span>
                    <span className="text-xs font-mono text-slate-400">#{vaultId}</span>
                  </div>

                  <h4 className="font-extrabold text-sm text-slate-900">{vault.propertyTitle || 'Property Escrow'}</h4>
                  <p className="text-xs text-slate-500">
                    Deposit Amount: <strong className="text-slate-900">{formatINR(vault.depositAmount || vault.amount)}</strong> · Buyer: {vault.buyerId} → Seller: {vault.sellerId}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {!isFrozen && vault.status !== 'released' && (
                    <>
                      <button
                        type="button"
                        disabled={processingId === vaultId}
                        onClick={() => handleFreeze(vaultId)}
                        className="px-3 py-1.5 rounded-xl border border-rose-300 text-rose-700 hover:bg-rose-50 text-xs font-bold flex items-center gap-1"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>Freeze</span>
                      </button>

                      <button
                        type="button"
                        disabled={processingId === vaultId}
                        onClick={() => handleRelease(vaultId)}
                        className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow flex items-center gap-1.5"
                      >
                        <Unlock className="w-3.5 h-3.5" />
                        <span>Authorize Release</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

