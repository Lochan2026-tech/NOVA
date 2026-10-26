import React, { useEffect, useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { ChronovaApi } from '../api/client';
import { FileRecord, AppSettings } from '../api/types';
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  Key,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';

export const PrivacyCenterPage: React.FC = () => {
  const { activeScan } = useWorkspace();
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [updateMsg, setUpdateMsg] = useState('');

  useEffect(() => {
    if (!activeScan) return;
    const fetchPrivacyData = async () => {
      try {
        setLoading(true);
        const [filesRes, settingsRes] = await Promise.all([
          ChronovaApi.getFiles(activeScan.id, 500, 0),
          ChronovaApi.getSettings(),
        ]);
        setFiles(filesRes.files);
        setSettings(settingsRes);
      } catch (err) {
        console.error('Failed to load privacy data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPrivacyData();
  }, [activeScan?.id]);

  const handleModeChange = async (mode: string) => {
    try {
      const updated = await ChronovaApi.updateSettings({ analysis_mode: mode });
      setSettings(updated);
      setUpdateMsg(`Privacy analysis mode changed to '${mode}'.`);
    } catch (err: any) {
      alert(`Update failed: ${err.message}`);
    }
  };

  const handleOptInToggle = async (val: boolean) => {
    try {
      const updated = await ChronovaApi.updateSettings({ content_analysis_opt_in: val });
      setSettings(updated);
      setUpdateMsg(`Content-aware inspection ${val ? 'enabled' : 'disabled'}.`);
    } catch (err: any) {
      alert(`Update failed: ${err.message}`);
    }
  };

  const restrictedFiles = files.filter((f) => f.privacy_level === 'restricted');
  const confidentialFiles = files.filter((f) => f.privacy_level === 'confidential');
  const internalFiles = files.filter((f) => f.privacy_level === 'internal');
  const publicFiles = files.filter((f) => f.privacy_level === 'public');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-rose-400" />
          Privacy Center & Classification Engine
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Local privacy classifications protect sensitive credentials, keys, and financial documents from unauthorized exposure or lifecycle deletion.
        </p>
      </div>

      {updateMsg && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          <span>{updateMsg}</span>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-panel p-4 rounded-2xl border border-rose-500/20">
          <span className="text-[10px] uppercase font-semibold text-rose-400 tracking-wider">
            Restricted
          </span>
          <p className="text-2xl font-bold text-white font-mono mt-1">
            {restrictedFiles.length}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">Keys, tokens, .env files</p>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-amber-500/20">
          <span className="text-[10px] uppercase font-semibold text-amber-400 tracking-wider">
            Confidential
          </span>
          <p className="text-2xl font-bold text-white font-mono mt-1">
            {confidentialFiles.length}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">Financial, contracts, HR</p>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-purple-500/20">
          <span className="text-[10px] uppercase font-semibold text-purple-400 tracking-wider">
            Internal Code
          </span>
          <p className="text-2xl font-bold text-white font-mono mt-1">
            {internalFiles.length}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">Project source modules</p>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-emerald-500/20">
          <span className="text-[10px] uppercase font-semibold text-emerald-400 tracking-wider">
            Public Assets
          </span>
          <p className="text-2xl font-bold text-white font-mono mt-1">
            {publicFiles.length}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">Readme, licenses, images</p>
        </div>
      </div>

      {/* Privacy Mode Settings Panel */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
        <h3 className="text-sm font-semibold text-white">Privacy Analysis Settings</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="text-slate-400 block mb-1">Analysis Mode:</label>
            <select
              value={settings?.analysis_mode || 'metadata'}
              onChange={(e) => handleModeChange(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-white p-2.5 rounded-xl font-mono text-xs focus:outline-none focus:border-cyan-500"
            >
              <option value="metadata">Metadata-Only (Paths & Filenames)</option>
              <option value="structural">Structural (Directory Relationships)</option>
              <option value="content-aware">Content-Aware (Opt-in Header Scanning)</option>
            </select>
          </div>

          <div className="flex flex-col justify-end">
            <label className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-900 border border-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={settings?.content_analysis_opt_in || false}
                onChange={(e) => handleOptInToggle(e.target.checked)}
                className="rounded bg-slate-950 border-slate-700 text-cyan-500 focus:ring-0"
              />
              <span className="text-slate-200">
                Explicit Consent for Local Content-Aware Keyword Scanning
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Sensitive Files Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Lock className="w-4 h-4 text-rose-400" />
          Sensitive Files Inventory (Restricted & Confidential)
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-3">Privacy Level</th>
                <th className="p-3">File Name</th>
                <th className="p-3">Full Path</th>
                <th className="p-3">Size (KB)</th>
                <th className="p-3 text-right">Protection Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {[...restrictedFiles, ...confidentialFiles].map((f) => (
                <tr key={f.id} className="hover:bg-slate-900/50 transition">
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] uppercase font-semibold ${
                        f.privacy_level === 'restricted'
                          ? 'bg-rose-500/20 text-rose-400'
                          : 'bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      {f.privacy_level}
                    </span>
                  </td>
                  <td className="p-3 font-semibold text-white truncate max-w-[200px]">
                    {f.file_name}
                  </td>
                  <td className="p-3 text-slate-400 truncate max-w-md" title={f.file_path}>
                    {f.file_path}
                  </td>
                  <td className="p-3 text-slate-200">
                    {(f.size_bytes / 1024).toFixed(1)} KB
                  </td>
                  <td className="p-3 text-right">
                    <span className="text-emerald-400 font-sans text-xs">Protected (No Auto-Delete)</span>
                  </td>
                </tr>
              ))}
              {[...restrictedFiles, ...confidentialFiles].length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500 font-sans">
                    No restricted or confidential files detected in this scan.
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
