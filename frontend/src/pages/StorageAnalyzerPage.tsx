import React, { useEffect, useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { ChronovaApi } from '../api/client';
import { StorageReport } from '../api/types';
import {
  PieChart as PieIcon,
  HardDrive,
  Folder,
  FileCode,
  ArrowUpDown,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export const StorageAnalyzerPage: React.FC = () => {
  const { activeScan } = useWorkspace();
  const [report, setReport] = useState<StorageReport | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeScan) return;
    const fetchStorage = async () => {
      try {
        setLoading(true);
        const data = await ChronovaApi.getStorage(activeScan.id);
        setReport(data);
      } catch (err) {
        console.error('Failed to load storage report:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStorage();
  }, [activeScan?.id]);

  const extChartData = report?.by_extension.slice(0, 8).map((e) => ({
    name: e.extension || '(none)',
    mb: Number((e.total_bytes / (1024 * 1024)).toFixed(2)),
    pct: e.percentage,
  })) || [];

  const dirChartData = report?.by_directory.slice(0, 8).map((d) => ({
    name: d.directory.split(/[\\/]/).pop() || 'root',
    mb: Number((d.total_bytes / (1024 * 1024)).toFixed(2)),
  })) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <PieIcon className="w-5 h-5 text-cyan-400" />
          Disk Space & Storage Analyzer
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Multidimensional disk consumption analysis by file type, folder tree, and volumetric file size.
        </p>
      </div>

      {/* Top Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Extension */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Storage by File Type (MB)</h3>
            <p className="text-xs text-slate-400">Total bytes aggregated per file extension</p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={extChartData}>
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="mb" fill="#06b6d4" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* By Directory */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Storage by Subfolder (MB)</h3>
            <p className="text-xs text-slate-400">Heaviest directories in workspace</p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dirChartData}>
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="mb" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Top 15 Largest Files Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-cyan-400" />
          Top 15 Largest Files
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-3">Rank</th>
                <th className="p-3">File Name</th>
                <th className="p-3">Path</th>
                <th className="p-3">Size (KB)</th>
                <th className="p-3">Privacy</th>
                <th className="p-3 text-right">Modified</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {report?.largest_files.map((file, idx) => (
                <tr key={file.id} className="hover:bg-slate-900/50 transition">
                  <td className="p-3 text-slate-500 font-bold">#{idx + 1}</td>
                  <td className="p-3 text-white font-semibold flex items-center gap-2">
                    <FileCode className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="truncate max-w-[200px]">{file.file_name}</span>
                  </td>
                  <td className="p-3 text-slate-400 truncate max-w-sm" title={file.file_path}>
                    {file.file_path}
                  </td>
                  <td className="p-3 text-cyan-400 font-bold">
                    {(file.size_bytes / 1024).toFixed(1)} KB
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded text-[10px] uppercase font-semibold bg-slate-800 text-slate-300">
                      {file.privacy_level}
                    </span>
                  </td>
                  <td className="p-3 text-right text-slate-400">
                    {file.modified_time ? new Date(file.modified_time).toLocaleDateString() : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
