import React, { useEffect, useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { ChronovaApi } from '../api/client';
import { DuplicateReport, DuplicateGroup, FileRecord } from '../api/types';
import {
  Copy,
  Trash2,
  Archive,
  CheckCircle,
  FileCheck,
  AlertCircle,
  Hash,
  HardDrive,
} from 'lucide-react';
import { ConfirmModal } from '../components/ConfirmModal';

export const DuplicateDetectorPage: React.FC = () => {
  const { activeScan } = useWorkspace();
  const [report, setReport] = useState<DuplicateReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedFileToArchive, setSelectedFileToArchive] = useState<FileRecord | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');

  const loadDuplicates = async () => {
    if (!activeScan) return;
    try {
      setLoading(true);
      const data = await ChronovaApi.getDuplicates(activeScan.id);
      setReport(data);
    } catch (err) {
      console.error('Failed to load duplicates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDuplicates();
  }, [activeScan?.id]);

  const handleArchiveConfirm = async () => {
    if (!selectedFileToArchive) return;
    try {
      await ChronovaApi.archiveFile(selectedFileToArchive.id, undefined, 'user');
      setActionSuccessMsg(`File '${selectedFileToArchive.file_name}' successfully archived.`);
      setSelectedFileToArchive(null);
      await loadDuplicates();
    } catch (err: any) {
      alert(`Archive failed: ${err.message || 'Error archiving file'}`);
    }
  };

  const wastedMb = report ? (report.total_wasted_bytes / (1024 * 1024)).toFixed(2) : '0';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Copy className="w-5 h-5 text-amber-400" />
          Cryptographic Duplicate Detection (SHA-256)
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Detect byte-for-byte identical files across directories and reclaim wasted disk capacity.
        </p>
      </div>

      {actionSuccessMsg && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-panel p-4 rounded-2xl border border-amber-500/20">
          <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
            Duplicate Groups
          </span>
          <p className="text-2xl font-bold text-white font-mono mt-1">
            {report?.total_duplicate_groups || 0}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">Distinct SHA-256 checksum collisions</p>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-amber-500/20">
          <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
            Duplicate Files
          </span>
          <p className="text-2xl font-bold text-amber-400 font-mono mt-1">
            {report?.total_duplicate_files || 0}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">Redundant copies discovered</p>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-amber-500/20">
          <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
            Recoverable Space
          </span>
          <p className="text-2xl font-bold text-emerald-400 font-mono mt-1">
            {wastedMb} MB
          </p>
          <p className="text-xs text-slate-400 mt-0.5">Potential disk capacity savings</p>
        </div>
      </div>

      {/* Duplicate Groups List */}
      <div className="space-y-4">
        {report?.groups.map((group) => (
          <div
            key={group.group_id}
            className="glass-panel rounded-2xl border border-slate-800 p-5 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-mono text-slate-300">
                  SHA-256: <span className="text-cyan-400">{group.sha256_hash}</span>
                </span>
              </div>
              <div className="text-xs font-mono text-slate-400">
                {group.count} copies &bull; {(group.file_size / 1024).toFixed(1)} KB each &bull;{' '}
                <span className="text-amber-400 font-bold">
                  {(group.wasted_bytes / 1024).toFixed(1)} KB redundant
                </span>
              </div>
            </div>

            {/* Copies list */}
            <div className="space-y-2">
              {group.files.map((file, idx) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800/60 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        idx === 0
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      {idx === 0 ? 'Primary Copy' : 'Duplicate'}
                    </span>
                    <div>
                      <p className="text-white font-medium font-mono truncate max-w-lg" title={file.file_path}>
                        {file.file_path}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Modified: {file.modified_time ? new Date(file.modified_time).toLocaleString() : 'N/A'}
                      </p>
                    </div>
                  </div>

                  {idx > 0 && (
                    <button
                      onClick={() => setSelectedFileToArchive(file)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-medium transition"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      <span>Archive Duplicate</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {report?.groups.length === 0 && (
          <div className="glass-panel p-12 text-center text-slate-400 space-y-2 rounded-2xl">
            <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto" />
            <h3 className="text-base font-semibold text-white">No Duplicate Files Detected</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              All scanned files have unique SHA-256 checksums. Workspace storage is free of redundant copies.
            </p>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={!!selectedFileToArchive}
        title="Confirm Duplicate Archival"
        message={`Are you sure you want to archive redundant copy '${selectedFileToArchive?.file_name}'? The primary copy will be safely preserved in the workspace, and this copy can be restored at any time.`}
        confirmLabel="Archive File"
        onConfirm={handleArchiveConfirm}
        onCancel={() => setSelectedFileToArchive(null)}
      />
    </div>
  );
};
