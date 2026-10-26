import React, { useEffect, useState } from 'react';
import { ChronovaApi } from '../api/client';
import { ArchiveRecord } from '../api/types';
import {
  Archive,
  Undo2,
  CheckCircle,
  FileCheck,
  Hash,
  Clock,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { ConfirmModal } from '../components/ConfirmModal';

export const ArchiveManagerPage: React.FC = () => {
  const [archives, setArchives] = useState<ArchiveRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedArchive, setSelectedArchive] = useState<ArchiveRecord | null>(null);
  const [successMsg, setSuccessMsg] = useState('');

  const loadArchives = async () => {
    try {
      setLoading(true);
      const list = await ChronovaApi.getArchives();
      setArchives(list);
    } catch (err) {
      console.error('Failed to load archives:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadArchives();
  }, []);

  const handleRestoreConfirm = async () => {
    if (!selectedArchive) return;
    try {
      await ChronovaApi.undoArchive(selectedArchive.id);
      setSuccessMsg(`File '${selectedArchive.original_path.split(/[\\/]/).pop()}' successfully restored and integrity verified.`);
      setSelectedArchive(null);
      await loadArchives();
    } catch (err: any) {
      alert(`Restore failed: ${err.response?.data?.detail || err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Archive className="w-5 h-5 text-amber-400" />
          Safe File Archive Manager
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Secure, checksum-verified repository of archived files. All files retain their original paths and can be restored with a single click.
        </p>
      </div>

      {successMsg && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-3">Status</th>
                <th className="p-3">Original File Path</th>
                <th className="p-3">Archive Store Path</th>
                <th className="p-3">Size (KB)</th>
                <th className="p-3">SHA-256 Verified</th>
                <th className="p-3">Archived At</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {archives.map((arc) => (
                <tr key={arc.id} className="hover:bg-slate-900/50 transition">
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] uppercase font-semibold ${
                        arc.status === 'archived'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-emerald-500/20 text-emerald-400'
                      }`}
                    >
                      {arc.status}
                    </span>
                  </td>
                  <td className="p-3 font-semibold text-white truncate max-w-xs" title={arc.original_path}>
                    {arc.original_path}
                  </td>
                  <td className="p-3 text-slate-400 truncate max-w-xs" title={arc.archive_path}>
                    {arc.archive_path}
                  </td>
                  <td className="p-3 text-slate-200">
                    {(arc.file_size_bytes / 1024).toFixed(1)} KB
                  </td>
                  <td className="p-3 text-cyan-400 text-[11px] truncate max-w-[120px]" title={arc.sha256_hash}>
                    {arc.sha256_hash ? arc.sha256_hash.substring(0, 12) + '...' : 'Verified'}
                  </td>
                  <td className="p-3 text-slate-400 text-[11px]">
                    {new Date(arc.archived_at).toLocaleString()}
                  </td>
                  <td className="p-3 text-right">
                    {arc.status === 'archived' ? (
                      <button
                        onClick={() => setSelectedArchive(arc)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-sans text-xs font-semibold ml-auto transition shadow-sm"
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                        <span>Restore</span>
                      </button>
                    ) : (
                      <span className="text-emerald-400 text-xs font-sans font-medium flex items-center gap-1 justify-end">
                        <CheckCircle className="w-3.5 h-3.5" /> Restored
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {archives.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-500 font-sans">
                    No files currently in archive.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={!!selectedArchive}
        title="Restore Archived File"
        message={`Restore '${selectedArchive?.original_path}' back to its original location? Chronova will verify SHA-256 checksums and ensure no accidental file overwrites occur.`}
        confirmLabel="Restore File"
        onConfirm={handleRestoreConfirm}
        onCancel={() => setSelectedArchive(null)}
      />
    </div>
  );
};
