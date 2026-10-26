import React, { useEffect, useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { ChronovaApi } from '../api/client';
import { AppSettings } from '../api/types';
import {
  Settings as SettingsIcon,
  Save,
  CheckCircle,
  FolderPlus,
  Trash2,
  Cpu,
  Database,
  Shield,
  Bot,
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const {
    workspaces,
    refreshWorkspaces,
    activeWorkspace,
    setActiveWorkspace,
  } = useWorkspace();

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // New workspace form
  const [wsName, setWsName] = useState('');
  const [wsPath, setWsPath] = useState('');
  const [wsDesc, setWsDesc] = useState('');
  const [wsMsg, setWsMsg] = useState('');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        const data = await ChronovaApi.getSettings();
        setSettings(data);
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSaveSettings = async () => {
    if (!settings) return;
    try {
      const updated = await ChronovaApi.updateSettings(settings);
      setSettings(updated);
      setSaveMsg('Settings successfully updated.');
      setTimeout(() => setSaveMsg(''), 4000);
    } catch (err: any) {
      alert(`Save failed: ${err.message}`);
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wsName.trim() || !wsPath.trim()) return;
    try {
      await ChronovaApi.createWorkspace({
        name: wsName.trim(),
        root_path: wsPath.trim(),
        description: wsDesc.trim(),
      });
      setWsMsg(`Workspace '${wsName}' created successfully.`);
      setWsName('');
      setWsPath('');
      setWsDesc('');
      await refreshWorkspaces();
      setTimeout(() => setWsMsg(''), 4000);
    } catch (err: any) {
      alert(`Workspace creation failed: ${err.response?.data?.detail || err.message}`);
    }
  };

  const handleDeleteWorkspace = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete workspace '${name}'? All scan history for this workspace will be deleted.`)) return;
    try {
      await ChronovaApi.deleteWorkspace(id);
      await refreshWorkspaces();
    } catch (err: any) {
      alert(`Deletion failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-cyan-400" />
          System Settings & Workspace Management
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Configure local analysis models, storage boundaries, privacy policies, and directory bindings.
        </p>
      </div>

      {saveMsg && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          <span>{saveMsg}</span>
        </div>
      )}

      {/* Analysis Engine Configuration */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-5">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Cpu className="w-4 h-4 text-cyan-400" />
          Analysis Engine & Local AI Configuration
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="text-slate-400 block mb-1">Default Analysis Mode</label>
            <select
              value={settings?.analysis_mode || 'metadata'}
              onChange={(e) =>
                setSettings((prev) => prev ? { ...prev, analysis_mode: e.target.value } : null)
              }
              className="w-full bg-slate-900 border border-slate-700 text-white p-2.5 rounded-xl font-mono text-xs focus:outline-none focus:border-cyan-500"
            >
              <option value="metadata">Metadata-Only (Safest, No File Reading)</option>
              <option value="structural">Structural (Directory Relationships)</option>
              <option value="content-aware">Content-Aware (Opt-in Header Scans)</option>
            </select>
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Max Scanned Files Cap</label>
            <input
              type="number"
              value={settings?.max_scan_files || 10000}
              onChange={(e) =>
                setSettings((prev) => prev ? { ...prev, max_scan_files: Number(e.target.value) } : null)
              }
              className="w-full bg-slate-900 border border-slate-700 text-white p-2.5 rounded-xl font-mono text-xs focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Local Ollama LLM Model</label>
            <input
              type="text"
              value={settings?.ollama_model || 'llama3'}
              onChange={(e) =>
                setSettings((prev) => prev ? { ...prev, ollama_model: e.target.value } : null)
              }
              placeholder="e.g. llama3, mistral, qwen"
              className="w-full bg-slate-900 border border-slate-700 text-white p-2.5 rounded-xl font-mono text-xs focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Max File Size Threshold (MB)</label>
            <input
              type="number"
              value={settings?.max_file_size_mb || 500}
              onChange={(e) =>
                setSettings((prev) => prev ? { ...prev, max_file_size_mb: Number(e.target.value) } : null)
              }
              className="w-full bg-slate-900 border border-slate-700 text-white p-2.5 rounded-xl font-mono text-xs focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-4 pt-2">
          <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={settings?.ollama_enabled || false}
              onChange={(e) =>
                setSettings((prev) => prev ? { ...prev, ollama_enabled: e.target.checked } : null)
              }
              className="rounded bg-slate-950 border-slate-700 text-cyan-500 focus:ring-0"
            />
            <span>Enable Local Ollama Integration (falls back seamlessly if offline)</span>
          </label>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={handleSaveSettings}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-lg shadow-cyan-600/20 transition"
          >
            <Save className="w-4 h-4" />
            <span>Save Configuration</span>
          </button>
        </div>
      </div>

      {/* Workspace Management */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-5">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <FolderPlus className="w-4 h-4 text-purple-400" />
          Add Authorized Workspace Directory
        </h3>

        {wsMsg && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            <span>{wsMsg}</span>
          </div>
        )}

        <form onSubmit={handleCreateWorkspace} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-slate-400 block mb-1">Workspace Name *</label>
              <input
                type="text"
                value={wsName}
                onChange={(e) => setWsName(e.target.value)}
                placeholder="e.g. Project Repository"
                required
                className="w-full bg-slate-900 border border-slate-700 text-white p-2.5 rounded-xl text-xs focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Absolute Directory Path *</label>
              <input
                type="text"
                value={wsPath}
                onChange={(e) => setWsPath(e.target.value)}
                placeholder="e.g. C:\Users\gorij\OneDrive\Documents\Chronova"
                required
                className="w-full bg-slate-900 border border-slate-700 text-white p-2.5 rounded-xl font-mono text-xs focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Description (Optional)</label>
            <input
              type="text"
              value={wsDesc}
              onChange={(e) => setWsDesc(e.target.value)}
              placeholder="e.g. Operating Systems File Lifecycle Research Environment"
              className="w-full bg-slate-900 border border-slate-700 text-white p-2.5 rounded-xl text-xs focus:outline-none focus:border-cyan-500"
            />
          </div>

          <button
            type="submit"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg shadow-purple-600/20 transition"
          >
            <FolderPlus className="w-4 h-4" />
            <span>Register Workspace</span>
          </button>
        </form>

        {/* Existing Workspaces List */}
        <div className="pt-4 border-t border-slate-800 space-y-2">
          <h4 className="text-xs font-semibold text-slate-300">Authorized Workspaces:</h4>
          <div className="space-y-2">
            {workspaces.map((w) => (
              <div
                key={w.id}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs"
              >
                <div>
                  <p className="font-semibold text-white">{w.name}</p>
                  <p className="text-[11px] font-mono text-slate-400 truncate max-w-lg">
                    {w.root_path}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteWorkspace(w.id, w.name)}
                  className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition"
                  title="Delete Workspace"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
