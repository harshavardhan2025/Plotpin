import React from 'react';
import { Shield, Clock, FileText } from 'lucide-react';
import { useProperty } from '../../../contexts/PropertyContext';

export default function AuditLogs() {
  const { auditLogs } = useProperty();

  return (
    <div className="space-y-4">
      <div className="border-b border-slate-200 pb-3">
        <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
          System Compliance Audit Logs ({auditLogs.length})
        </h3>
        <p className="text-xs text-slate-500">
          Immutable event log of administrative approvals, rejections, deal closures, and vault transitions
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        {auditLogs.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No audit records logged yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-extrabold">
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Actor / Officer</th>
                  <th className="py-2.5 px-3">Target Asset</th>
                  <th className="py-2.5 px-3">Notes / Findings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {auditLogs.map((log, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-2 px-3 text-slate-500">
                      {new Date(log.timestamp || log.createdAt || Date.now()).toLocaleString('en-IN')}
                    </td>
                    <td className="py-2 px-3">
                      <span className="font-bold text-slate-900 uppercase">{log.action || log.type}</span>
                    </td>
                    <td className="py-2 px-3 text-slate-600">{log.actorId || log.userId || 'Admin'}</td>
                    <td className="py-2 px-3 text-emerald-800">{log.propertyId || log.targetId || '-'}</td>
                    <td className="py-2 px-3 text-slate-600 max-w-xs truncate">{log.details || log.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

