import React, { useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import {
  FolderGit2,
  Play,
  RotateCw,
  Plus,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  Clock,
  Sparkles,
} from 'lucide-react';
import { ChronovaApi } from '../api/client';

export const Header: React.FC<{ onNewWorkspaceModal: () => void }> = ({
  onNewWorkspaceModal,
}) => {
  const {
    workspaces,
    activeWorkspace,
    setActiveWorkspace,
    scans,
    activeScan,
    setActiveScan,
    isScanning,
    triggerScan,
    systemHealthy,
  } = useWorkspace();

  const handleScanClick = async () => {
    try {
      await triggerScan();
    } catch (err: any) {
      alert(`Scan failed: ${err.message || 'Error executing scan'}`);
    }
  };

  return (
    <header className="h-16 border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Left: Workspace & Scan Selectors */}
      <div className="flex items-center gap-4">
        {/* Workspace Selector */}
        <div className="flex items-center gap-2">
          <FolderGit2 className="w-4 h-4 text-cyan-400" />
          <select
            value={activeWorkspace?.id || ''}
            onChange={(e) => {
              const selected = workspaces.find((w) => w.id === e.target.value);
              setActiveWorkspace(selected || null);
            }}
            className="bg-slate-900 border border-slate-700 text-xs font-medium text-white px-3 py-1.5 rounded-xl focus:outline-none focus:border-cyan-500 max-w-xs truncate"
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.root_path})
              </option>
            ))}
            {workspaces.length === 0 && <option value="">No Workspaces</option>}
          </select>

          <button
            onClick={onNewWorkspaceModal}
            title="Create New Workspace"
            className="p-1.5 rounded-xl bg-slate-900 border border-slate-700/80 text-slate-300 hover:text-white hover:border-cyan-500 transition"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Scan Selector */}
        {scans.length > 0 && (
          <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={activeScan?.id || ''}
              onChange={(e) => {
                const s = scans.find((item) => item.id === e.target.value);
                setActiveScan(s || null);
              }}
              className="bg-slate-900/60 border border-slate-800 text-[11px] text-slate-300 px-2 py-1 rounded-lg focus:outline-none focus:border-cyan-500"
            >
              {scans.map((s, idx) => (
                <option key={s.id} value={s.id}>
                  Scan #{scans.length - idx}: {new Date(s.started_at).toLocaleTimeString()} ({s.total_files} files)
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right: Actions & Status */}
      <div className="flex items-center gap-3">
        {/* System Health */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/80 border border-slate-800 text-[11px]">
          <span
            className={`w-2 h-2 rounded-full ${
              systemHealthy ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
            }`}
          />
          <span className="text-slate-300 font-mono">
            {systemHealthy ? 'Core API Online' : 'Offline'}
          </span>
        </div>

        {/* Mode Indicator */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-[11px] text-cyan-400">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span className="font-medium capitalize">
            {activeWorkspace?.analysis_mode || 'Metadata'} Mode
          </span>
        </div>

        {/* Run Scan Button */}
        <button
          onClick={handleScanClick}
          disabled={isScanning || !activeWorkspace}
          className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white text-xs font-semibold shadow-lg shadow-cyan-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
        >
          {isScanning ? (
            <>
              <RotateCw className="w-3.5 h-3.5 animate-spin" />
              <span>Analyzing...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              <span>Run Pipeline</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};
