import React, { useEffect, useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { ChronovaApi } from '../api/client';
import { FileRecord } from '../api/types';
import {
  FolderTree,
  Search,
  Filter,
  FileText,
  Copy,
  Shield,
  Layers,
  ArrowUpDown,
  Download,
  X,
  Clock,
  HardDrive,
  Hash,
  CheckCircle,
} from 'lucide-react';

export const FileExplorerPage: React.FC = () => {
  const { activeScan } = useWorkspace();
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [extFilter, setExtFilter] = useState('');
  const [privacyFilter, setPrivacyFilter] = useState('');
  const [dupOnly, setDupOnly] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileRecord | null>(null);

  useEffect(() => {
    if (!activeScan) return;
    const fetchFiles = async () => {
      try {
        setLoading(true);
        const data = await ChronovaApi.getFiles(
          activeScan.id,
          500,
          0,
          extFilter || undefined,
          privacyFilter || undefined
        );
        setFiles(data.files);
        setTotal(data.total);
      } catch (err) {
        console.error('Failed to load files:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchFiles();
  }, [activeScan?.id, extFilter, privacyFilter]);

  const filteredFiles = files.filter((f) => {
    if (search && !f.file_name.toLowerCase().includes(search.toLowerCase()) && !f.file_path.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (dupOnly && !f.is_duplicate) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <FolderTree className="w-5 h-5 text-cyan-400" />
          File Explorer & Metadata Inspector
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Browse all indexed workspace files with size, privacy, and graph centrality rankings.
        </p>
      </div>

      {/* Filter Toolbar */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search filename or path..."
              className="bg-slate-900 border border-slate-700/80 pl-9 pr-4 py-1.5 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-64"
            />
          </div>

          {/* Extension Filter */}
          <select
            value={extFilter}
            onChange={(e) => setExtFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700/80 text-xs text-slate-300 px-3 py-1.5 rounded-xl focus:outline-none focus:border-cyan-500"
          >
            <option value="">All Extensions</option>
            <option value=".py">.py (Python)</option>
            <option value=".ts">.ts (TypeScript)</option>
            <option value=".tsx">.tsx (React)</option>
            <option value=".json">.json</option>
            <option value=".md">.md (Markdown)</option>
            <option value=".txt">.txt</option>
          </select>

          {/* Privacy Filter */}
          <select
            value={privacyFilter}
            onChange={(e) => setPrivacyFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700/80 text-xs text-slate-300 px-3 py-1.5 rounded-xl focus:outline-none focus:border-cyan-500"
          >
            <option value="">All Privacy Levels</option>
            <option value="restricted">Restricted</option>
            <option value="confidential">Confidential</option>
            <option value="internal">Internal</option>
            <option value="public">Public</option>
          </select>

          {/* Duplicate Toggle */}
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer bg-slate-900/60 px-3 py-1.5 rounded-xl border border-slate-800">
            <input
              type="checkbox"
              checked={dupOnly}
              onChange={(e) => setDupOnly(e.target.checked)}
              className="rounded bg-slate-950 border-slate-700 text-cyan-500 focus:ring-0"
            />
            <span>Duplicates Only</span>
          </label>
        </div>

        <div className="text-xs text-slate-400 font-mono">
          Showing {filteredFiles.length} of {total} files
        </div>
      </div>

      {/* Main Files Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-3">File Name</th>
                <th className="p-3">Directory</th>
                <th className="p-3">Size</th>
                <th className="p-3">Privacy</th>
                <th className="p-3">Importance</th>
                <th className="p-3">Duplicate</th>
                <th className="p-3 text-right">Modified</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredFiles.map((f) => (
                <tr
                  key={f.id}
                  onClick={() => setSelectedFile(f)}
                  className="hover:bg-slate-900/50 cursor-pointer transition"
                >
                  <td className="p-3 font-semibold text-white flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="truncate max-w-[200px]">{f.file_name}</span>
                  </td>
                  <td className="p-3 text-slate-400 truncate max-w-xs" title={f.parent_directory}>
                    {f.parent_directory}
                  </td>
                  <td className="p-3 text-slate-200">
                    {(f.size_bytes / 1024).toFixed(1)} KB
                  </td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] uppercase font-semibold ${
                        f.privacy_level === 'restricted'
                          ? 'bg-rose-500/20 text-rose-400'
                          : f.privacy_level === 'confidential'
                          ? 'bg-amber-500/20 text-amber-400'
                          : f.privacy_level === 'public'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-purple-500/20 text-purple-400'
                      }`}
                    >
                      {f.privacy_level}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-cyan-400 h-1.5 rounded-full"
                          style={{ width: `${(f.importance_score || 0) * 100}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-slate-300">
                        {((f.importance_score || 0) * 100).toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  <td className="p-3">
                    {f.is_duplicate ? (
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-semibold flex items-center gap-1 w-max">
                        <Copy className="w-2.5 h-2.5" /> Duplicate
                      </span>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </td>
                  <td className="p-3 text-slate-400 text-right text-[11px]">
                    {f.modified_time ? new Date(f.modified_time).toLocaleDateString() : '-'}
                  </td>
                </tr>
              ))}
              {filteredFiles.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500 font-sans">
                    No files found matching the criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* File Details Inspector Modal */}
      {selectedFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="glass-panel w-full max-w-xl p-6 rounded-2xl border border-slate-700 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white font-mono">
                    {selectedFile.file_name}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono truncate max-w-sm" title={selectedFile.file_path}>
                    {selectedFile.file_path}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedFile(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">File Size</span>
                <p className="font-mono font-bold text-white">
                  {(selectedFile.size_bytes / 1024).toFixed(2)} KB ({selectedFile.size_bytes.toLocaleString()} bytes)
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Privacy Classification</span>
                <div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                      selectedFile.privacy_level === 'restricted'
                        ? 'bg-rose-500/20 text-rose-400'
                        : selectedFile.privacy_level === 'confidential'
                        ? 'bg-amber-500/20 text-amber-400'
                        : selectedFile.privacy_level === 'public'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-purple-500/20 text-purple-400'
                    }`}
                  >
                    {selectedFile.privacy_level}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">MIME Type & Extension</span>
                <p className="font-mono text-slate-300">
                  {selectedFile.mime_type} ({selectedFile.extension || 'none'})
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-1">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Graph Importance</span>
                <p className="font-mono font-bold text-cyan-400">
                  {((selectedFile.importance_score || 0) * 100).toFixed(0)}% (Centrality Rank)
                </p>
              </div>
            </div>

            {/* SHA-256 Checksum */}
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-1 text-xs font-mono">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                SHA-256 Cryptographic Checksum
              </span>
              <p className="text-[11px] text-cyan-300 break-all select-all">
                {selectedFile.sha256_hash || 'Checksum computed on demand during duplicate analysis'}
              </p>
            </div>

            {/* Timestamps */}
            <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-2 text-xs">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                Filesystem Timestamps (OS Facts)
              </span>
              <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-300 font-mono">
                <div>
                  <span className="text-slate-500 block">Created</span>
                  {selectedFile.created_time ? new Date(selectedFile.created_time).toLocaleString() : 'N/A'}
                </div>
                <div>
                  <span className="text-slate-500 block">Modified</span>
                  {selectedFile.modified_time ? new Date(selectedFile.modified_time).toLocaleString() : 'N/A'}
                </div>
                <div>
                  <span className="text-slate-500 block">Accessed</span>
                  {selectedFile.accessed_time ? new Date(selectedFile.accessed_time).toLocaleString() : 'N/A'}
                </div>
              </div>
            </div>

            {/* Attributes & Flags */}
            <div className="flex items-center gap-2 pt-1">
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                  selectedFile.is_duplicate ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {selectedFile.is_duplicate ? `Duplicate (Group: ${selectedFile.duplicate_group_id || 'yes'})` : 'Unique Content'}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                  selectedFile.is_readonly ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {selectedFile.is_readonly ? 'Read-Only' : 'Writable'}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                  selectedFile.is_hidden ? 'bg-purple-500/20 text-purple-400' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {selectedFile.is_hidden ? 'Hidden' : 'Visible'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
