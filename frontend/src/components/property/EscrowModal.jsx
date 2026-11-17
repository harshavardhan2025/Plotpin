import React, { useState } from 'react';
import { X, ShieldCheck, FileCheck, CheckCircle2, IndianRupee, AlertCircle, Loader2 } from 'lucide-react';

export default function EscrowModal({ property, onClose, onSuccess }) {
  const [offerAmount, setOfferAmount] = useState(property?.price ? Math.round(property.price * 0.95) : 36000000);
  const [paymentMode, setPaymentMode] = useState('loan');
  const [closingDays, setClosingDays] = useState(45);
  const [contingency, setContingency] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidationError('');

    const numericAmount = Number(offerAmount);
    if (!numericAmount || isNaN(numericAmount) || numericAmount <= 0) {
      setValidationError('Please enter a valid positive offer amount in INR.');
      return;
    }

    if (property?.price && numericAmount < property.price * 0.1) {
      setValidationError(`Offer amount is too low (must be at least 10% of asking price ₹${property.price.toLocaleString('en-IN')}). Please enter a valid offer.`);
      return;
    }

    if (!contingency) {
      setValidationError('Please confirm acceptance of inspection and verification terms.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSuccess({
        propertyId: property?._id || property?.id,
        offerAmount: numericAmount,
        paymentMode,
        closingDays: Number(closingDays),
        contingency
      });
    } catch (err) {
      setValidationError(err.message || 'Failed to submit offer. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay animate-in fade-in duration-200">
      <div className="modal-content-box max-w-lg p-6 space-y-4 rounded-3xl border border-slate-200 shadow-2xl">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-[#176B4D] flex items-center justify-center font-bold">
              <FileCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900 font-display">Submit Direct Offer</h3>
              <p className="text-[11px] text-slate-500">0% Brokerage · Direct Owner Negotiation</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between text-xs">
          <div>
            <span className="font-bold text-slate-800">{property?.title}</span>
            <div className="text-[11px] text-slate-500">Asking Price: ₹{property?.price?.toLocaleString('en-IN')}</div>
          </div>
          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
            Direct Owner
          </span>
        </div>

        {validationError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2 text-xs text-rose-800 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="font-semibold">{validationError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700">Offer Amount (INR)</label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">₹</span>
              <input 
                type="number"
                min="1000"
                value={offerAmount}
                onChange={(e) => setOfferAmount(Math.max(0, Number(e.target.value)))}
                className="w-full pl-7 pr-3 py-2 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-[#176B4D] outline-none"
                required
              />
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              {offerAmount >= 10000000
                ? `Approx. ₹${(offerAmount / 10000000).toFixed(2)} Cr`
                : offerAmount >= 100000
                  ? `Approx. ₹${(offerAmount / 100000).toFixed(1)} Lakh`
                  : `₹${offerAmount.toLocaleString('en-IN')}`}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700">Financing Method</label>
              <select 
                value={paymentMode} 
                onChange={(e) => setPaymentMode(e.target.value)}
                className="w-full mt-1 p-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white"
              >
                <option value="loan">Bank Loan Pre-Approved</option>
                <option value="self">Self-Funded / Direct Transfer</option>
                <option value="commercial">Commercial Lease</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700">Closing Window</label>
              <select 
                value={closingDays} 
                onChange={(e) => setClosingDays(Number(e.target.value))}
                className="w-full mt-1 p-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white"
              >
                <option value={30}>30 Days (Fast Close)</option>
                <option value={45}>45 Days (Standard)</option>
                <option value={60}>60 Days (Extended)</option>
              </select>
            </div>
          </div>

          <div className="bg-emerald-50/70 p-3 rounded-2xl border border-emerald-200 text-xs text-emerald-950 space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-emerald-900">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <span>Direct Deal Framework:</span>
            </div>
            <ul className="text-[11px] text-emerald-800 space-y-1 list-disc list-inside">
              <li>Direct negotiation with verified property owner (0% brokerage).</li>
              <li>Title deed inspection available before closing.</li>
              <li>Settlement executed at Sub-Registrar office or via direct bank transfer.</li>
            </ul>
          </div>

          <div className="flex items-center gap-2">
            <input 
              type="checkbox" 
              id="terms" 
              checked={contingency} 
              onChange={(e) => setContingency(e.target.checked)}
              className="rounded text-[#176B4D]"
            />
            <label htmlFor="terms" className="text-xs text-slate-600 font-semibold cursor-pointer">
              Subject to physical inspection and title deed verification.
            </label>
          </div>

          <div className="pt-3 border-t flex items-center justify-end gap-2">
            <button 
              type="button" 
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-[#176B4D] hover:bg-[#12553D] text-white rounded-xl text-xs font-bold shadow transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting Offer...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Submit Offer</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
