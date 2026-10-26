import React, { useEffect, useState } from 'react';
import { ChronovaApi } from '../api/client';
import { AuditLog } from '../api/types';
import { History, Filter, Search, Code2, Clock, User, X } from 'lucide-react';

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [actionFilter, setActionFilter] = useState('');
  const [selectedDetails, setSelectedDetails] = useState<AuditLog | null>(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const data = await ChronovaApi.getAuditLogs(200, 0, actionFilter || undefined);
      setLogs(data.logs);
      setTotal(data.total);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [actionFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <History className="w-5 h-5 text-purple-400" />
          Audit Logging & Accountability Trail
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Chronological, tamper-evident audit records documenting all scans, approvals, archives, and restore operations.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700/80 text-xs text-slate-300 px-3 py-1.5 rounded-xl focus:outline-none focus:border-cyan-500"
          >
            <option value="">All Actions</option>
            <option value="scan_started">Scan Started</option>
            <option value="scan_completed">Scan Completed</option>
            <option value="recommendations_generated">Recommendations Generated</option>
            <option value="recommendation_approved">Recommendation Approved</option>
            <option value="recommendation_rejected">Recommendation Rejected</option>
            <option value="file_archived">File Archived</option>
            <option value="file_restored">File Restored</option>
            <option value="workspace_created">Workspace Created</option>
          </select>
        </div>

        <span className="text-xs text-slate-400 font-mono">
          Total Logged Events: {total}
        </span>
      </div>

      {/* Logs Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-3">Timestamp</th>
                <th className="p-3">Action</th>
                <th className="p-3">Entity Type</th>
                <th className="p-3">Entity ID</th>
                <th className="p-3">User</th>
                <th className="p-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-900/50 transition">
                  <td className="p-3 text-slate-400 text-[11px]">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded text-[10px] uppercase font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      {log.action}
                    </span>
                  </td>
                  <td className="p-3 text-slate-300 capitalize">
                    {log.entity_type || '-'}
                  </td>
                  <td className="p-3 text-slate-500 text-[11px] truncate max-w-[120px]" title={log.entity_id || ''}>
                    {log.entity_id ? log.entity_id.substring(0, 10) + '...' : '-'}
                  </td>
                  <td className="p-3 text-white font-medium">{log.user}</td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => setSelectedDetails(log)}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-sans text-xs transition"
                    >
                      Inspect JSON
                    </button>
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500 font-sans">
                    No audit log records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* JSON Inspector Modal */}
      {selectedDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="glass-panel w-full max-w-lg p-6 rounded-2xl border border-slate-700 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code2 className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white">
                  Audit Log Details &bull; {selectedDetails.action}
                </h3>
              </div>
              <button
                onClick={() => setSelectedDetails(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-cyan-300 overflow-x-auto max-h-96">
              {(() => {
                try {
                  const d = selectedDetails.details;
                  if (!d) return '{}';
                  const parsed = typeof d === 'string' ? JSON.parse(d) : d;
                  return JSON.stringify(parsed, null, 2);
                } catch {
                  return String(selectedDetails.details);
                }
              })()}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
