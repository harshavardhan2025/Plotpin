import React from 'react';
import { PhoneCall, Calendar, Users, CheckCircle2 } from 'lucide-react';
import { useProperty } from '../../../contexts/PropertyContext';

export default function MediationCenter() {
  const { adminCalls, adminAppointments } = useProperty();

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-3">
        <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
          Mediation &amp; Direct Conference Center
        </h3>
        <p className="text-xs text-slate-500">
          Direct buyer-owner conference mediation requests supervised by Regional Administrators
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Call Mediation Queue */}
        <div className="space-y-3">
          <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <PhoneCall className="w-4 h-4 text-blue-600" />
            <span>Mediation Call Requests ({adminCalls.length})</span>
          </h4>

          {adminCalls.length === 0 ? (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
              No active call mediation requests.
            </div>
          ) : (
            adminCalls.map((call) => (
              <div key={call._id || call.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900">{call.propertyTitle || 'Property Listing'}</span>
                  <span className="text-[10px] bg-blue-100 text-blue-800 font-extrabold px-2 py-0.5 rounded">
                    {call.status || 'Pending'}
                  </span>
                </div>
                <div className="text-xs text-slate-600">
                  <p>Buyer Contact: {call.buyerPhone || call.buyerId}</p>
                  <p className="text-slate-400 text-[11px] mt-0.5">Preferred Window: {call.preferredTimeWindow}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Surveyor Escort Appointments */}
        <div className="space-y-3">
          <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <span>Licensed Surveyor Site Escorts ({adminAppointments.length})</span>
          </h4>

          {adminAppointments.length === 0 ? (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
              No surveyor escorts currently scheduled.
            </div>
          ) : (
            adminAppointments.map((apt) => (
              <div key={apt._id || apt.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900">{apt.propertyTitle || 'Property Site'}</span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded">
                    {apt.status || 'Confirmed'}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Slot: {new Date(apt.startAt).toLocaleString('en-IN')}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

