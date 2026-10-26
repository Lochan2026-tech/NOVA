import React, { useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import {
  Scan,
  FolderSearch,
  Play,
  RotateCw,
  Clock,
  AlertTriangle,
  CheckCircle2,
  FileCode,
  HardDrive,
} from 'lucide-react';

export const FileScannerPage: React.FC = () => {
  const {
    activeWorkspace,
    scans,
    activeScan,
    setActiveScan,
    isScanning,
    triggerScan,
  } = useWorkspace();

  const [customPath, setCustomPath] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleStartScan = async () => {
    setErrorMsg('');
    try {
      await triggerScan(customPath.trim() || undefined);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || err.message || 'Scan failed');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Scan className="w-5 h-5 text-cyan-400" />
          File Scanner & Pipeline Orchestration
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Perform directory traversal, metadata extraction, cryptographic hashing, and graph generation.
        </p>
      </div>

      {/* Scan Config Card */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <FolderSearch className="w-4 h-4 text-cyan-400" />
          Target Directory Configuration
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="text-slate-400 block mb-1">Workspace Root:</label>
            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-700/80 font-mono text-cyan-300 truncate">
              {activeWorkspace?.root_path || 'No workspace selected'}
            </div>
          </div>
          <div>
            <label className="text-slate-400 block mb-1">
              Custom Subdirectory (Optional):
            </label>
            <input
              type="text"
              value={customPath}
              onChange={(e) => setCustomPath(e.target.value)}
              placeholder="e.g. C:\Users\...\Chronova\backend"
              className="w-full bg-slate-900 border border-slate-700 text-white p-2.5 rounded-xl font-mono text-xs focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Path validation and traversal defenses active</span>
          </div>

          <button
            onClick={handleStartScan}
            disabled={isScanning || !activeWorkspace}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-lg shadow-cyan-600/20 disabled:opacity-50 transition"
          >
            {isScanning ? (
              <>
                <RotateCw className="w-4 h-4 animate-spin" />
                <span>Running Scan & Analysis...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>Execute Complete Pipeline</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Scan History Table */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Clock className="w-4 h-4 text-purple-400" />
          Scan Execution History
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-3">Status</th>
                <th className="p-3">Started At</th>
                <th className="p-3">Target Path</th>
                <th className="p-3">Files</th>
                <th className="p-3">Directories</th>
                <th className="p-3">Total Size</th>
                <th className="p-3">Errors</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {scans.map((s) => {
                const isSelected = activeScan?.id === s.id;
                const sizeMb = (s.total_size_bytes / (1024 * 1024)).toFixed(2);
                return (
                  <tr
                    key={s.id}
                    className={`hover:bg-slate-900/50 transition ${
                      isSelected ? 'bg-cyan-500/10' : ''
                    }`}
                  >
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] uppercase font-semibold ${
                          s.status === 'completed'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : s.status === 'running'
                            ? 'bg-cyan-500/20 text-cyan-400 animate-pulse'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="p-3 text-slate-300">
                      {new Date(s.started_at).toLocaleString()}
                    </td>
                    <td className="p-3 text-slate-400 truncate max-w-xs" title={s.scan_path}>
                      {s.scan_path}
                    </td>
                    <td className="p-3 text-white font-bold">{s.total_files}</td>
                    <td className="p-3 text-slate-300">{s.total_directories}</td>
                    <td className="p-3 text-cyan-400">{sizeMb} MB</td>
                    <td className="p-3">
                      {s.errors_count > 0 ? (
                        <span className="text-amber-400 font-bold">{s.errors_count}</span>
                      ) : (
                        <span className="text-slate-500">0</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => setActiveScan(s)}
                        className={`px-3 py-1 rounded-lg text-xs font-sans transition ${
                          isSelected
                            ? 'bg-cyan-500 text-slate-950 font-bold'
                            : 'bg-slate-800 text-slate-300 hover:text-white'
                        }`}
                      >
                        {isSelected ? 'Active' : 'Select'}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {scans.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500 font-sans">
                    No scan runs recorded yet for this workspace.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
