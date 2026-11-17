import React, { useState } from 'react';
import {
  ShieldCheck, AlertTriangle, Check, X, FileText, Edit3, ArrowRight, RefreshCw,
  Clock, MapPin, User, CheckCircle2
} from 'lucide-react';
import { useProperty } from '../../../contexts/PropertyContext';
import { useAuth } from '../../../contexts/AuthContext';
import { api } from '../../../lib/api';
import { formatINR } from '../../../utils/propertyHelpers';

export default function VerificationQueue() {
  const { showToast } = useAuth();
  const { 
    adminQueue, 
    setAdminQueue, 
    loadAdminData, 
    handleOpenDeedModal,
    approveVerification,
    rejectVerification
  } = useProperty();

  const [processingId, setProcessingId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [activeRejectPropId, setActiveRejectPropId] = useState(null);

  const handleApprove = async (propId) => {
    setProcessingId(propId);
    try {
      if (typeof approveVerification === 'function') {
        await approveVerification(propId);
      } else {
        setAdminQueue(prev => {
          const next = prev.filter(p => (p._id || p.id) !== propId);
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('plotpin_admin_queue', JSON.stringify(next));
            localStorage.setItem('landpin_admin_queue', JSON.stringify(next));
          }
          return next;
        });
      }

      showToast('✅ Property cadastral deed verified and published to public discovery!');
    } catch (err) {
      showToast(err.message || 'Approval failed');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (propId) => {
    if (!rejectionReason.trim()) {
      showToast('Please state official rejection findings');
      return;
    }
    setProcessingId(propId);
    try {
      if (typeof rejectVerification === 'function') {
        await rejectVerification(propId, rejectionReason.trim());
      } else {
        setAdminQueue(prev => {
          const next = prev.filter(p => (p._id || p.id) !== propId);
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('plotpin_admin_queue', JSON.stringify(next));
            localStorage.setItem('landpin_admin_queue', JSON.stringify(next));
          }
          return next;
        });
      }

      showToast('Property rejected with formal findings dispatched to landowner.');
      setActiveRejectPropId(null);
      setRejectionReason('');
    } catch (err) {
      showToast(err.message || 'Rejection failed');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Queue Feed */}
      {adminQueue.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 p-12 rounded-3xl border border-slate-200 dark:border-slate-800 text-center space-y-2">
          <ShieldCheck className="w-10 h-10 text-emerald-500 mx-auto opacity-70" />
          <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200">
            All Title Deeds Verified
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            There are currently no land titles or property listings pending administrative cadastral verification.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {adminQueue.map((prop) => {
            const propId = prop._id || prop.id;
            const isRevision = Boolean(prop.isRevision || prop.hasPendingRevision);
            const changes = prop.proposedChanges || prop.pendingRevision?.changes || null;
            const previous = prop.previousApprovedState || prop.pendingRevision?.previousState || null;

            return (
              <div
                key={propId}
                className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4"
              >
                {/* Header with Type & Meta */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                        isRevision
                          ? 'bg-purple-100 text-purple-900 border border-purple-300 dark:bg-purple-950/80 dark:text-purple-200 dark:border-purple-800'
                          : 'bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/80 dark:text-amber-200 dark:border-amber-800'
                      }`}
                    >
                      {isRevision ? 'Proposed Edit Revision' : 'New Listing Initial Review'}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">#{propId}</span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Owner: <strong className="text-slate-800 dark:text-slate-200">{prop.ownerName || 'Landowner'}</strong> ({prop.ownerPhone || prop.ownerId || 'AP Citizen'})
                  </div>
                </div>

                {/* Title & Specs */}
                <div>
                  <h4 className="font-extrabold text-base text-slate-900 dark:text-white">{prop.title}</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">{prop.description}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="text-xs text-emerald-700 dark:text-emerald-400 font-black bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                      {formatINR(prop.price)}
                    </span>
                    <span className="text-xs text-slate-600 dark:text-slate-300 font-bold">
                      {prop.category} ({prop.propertyType || 'Asset'}) · Purpose: {prop.purpose || 'sale'}
                    </span>
                    {prop.city && (
                      <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-rose-500" />
                        {prop.city}, {prop.district || 'Andhra Pradesh'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Uploaded Documents List */}
                {Array.isArray(prop.documents) && prop.documents.length > 0 && (
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Submitted Legal &amp; Cadastral Records ({prop.documents.length})
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {prop.documents.map((doc, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                          <div className="flex items-center gap-2 truncate">
                            <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{doc.name || 'Title Deed'}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono shrink-0 ml-1">{doc.type || 'Deed'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Revision Diff View */}
                {isRevision && changes && (
                  <div className="bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/70 rounded-2xl p-3.5 text-xs space-y-2">
                    <span className="font-extrabold text-purple-950 dark:text-purple-200 flex items-center gap-1.5">
                      <Edit3 className="w-3.5 h-3.5 text-purple-700 dark:text-purple-400" />
                      Proposed Changes for Re-Approval
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-[11px] bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-purple-100 dark:border-purple-900">
                      <div>
                        <span className="text-slate-400 uppercase font-bold text-[9px] block">Current Approved</span>
                        <pre className="font-mono text-slate-700 dark:text-slate-300 mt-1 whitespace-pre-wrap">
                          {JSON.stringify(previous, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <span className="text-emerald-700 dark:text-emerald-400 uppercase font-bold text-[9px] block">Proposed Revision</span>
                        <pre className="font-mono text-emerald-900 dark:text-emerald-300 mt-1 whitespace-pre-wrap font-bold">
                          {JSON.stringify(changes, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}

                {/* Rejection Form Input */}
                {activeRejectPropId === propId && (
                  <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 p-3.5 rounded-2xl space-y-2 text-xs">
                    <label className="font-bold text-rose-900 dark:text-rose-200 block">
                      Formal Findings &amp; Rejection Reason *
                    </label>
                    <textarea
                      rows={2}
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="State reason (e.g. Mismatched survey demarcations, encumbrance detected)..."
                      className="w-full bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-700 rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-200 outline-none"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveRejectPropId(null)}
                        className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 font-bold"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReject(propId)}
                        className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                      >
                        Confirm Rejection
                      </button>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => handleOpenDeedModal ? handleOpenDeedModal(prop) : showToast('Inspecting deeds...')}
                    className="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Inspect Uploaded Deeds</span>
                  </button>

                  <div className="flex items-center gap-2">
                    {activeRejectPropId !== propId && (
                      <button
                        type="button"
                        onClick={() => setActiveRejectPropId(propId)}
                        className="px-3.5 py-1.5 rounded-xl border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/60 text-xs font-bold cursor-pointer"
                      >
                        Reject with Findings
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={processingId === propId}
                      onClick={() => handleApprove(propId)}
                      className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow flex items-center gap-1.5 cursor-pointer"
                    >
                      {processingId === propId ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      <span>Approve &amp; Publish</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
