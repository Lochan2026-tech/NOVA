import React, { useEffect, useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { ChronovaApi } from '../api/client';
import { TemporalReport } from '../api/types';
import { Clock, Calendar, ShieldCheck, Info, FileText, Activity } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export const ActivityTimelinePage: React.FC = () => {
  const { activeScan } = useWorkspace();
  const [report, setReport] = useState<TemporalReport | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeScan) return;
    const fetchTemporal = async () => {
      try {
        setLoading(true);
        const data = await ChronovaApi.getTemporal(activeScan.id);
        setReport(data);
      } catch (err) {
        console.error('Failed to load temporal report:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTemporal();
  }, [activeScan?.id]);

  const bucketData = report?.buckets.map((b) => ({
    name: b.category,
    files: b.count,
    pct: b.percentage,
  })) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Clock className="w-5 h-5 text-cyan-400" />
          File Activity & Temporal Distribution Analysis
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Analyzes creation, modification, and access timestamps while strictly distinguishing observed OS facts from heuristics.
        </p>
      </div>

      {/* Core Principle Callout */}
      <div className="glass-panel p-5 rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-cyan-950/40 to-slate-900/60 space-y-2">
        <div className="flex items-center gap-2 text-cyan-400 font-semibold text-xs">
          <ShieldCheck className="w-4 h-4" />
          <span>Core Chronova Directive: Age != Obsolescence</span>
        </div>
        <p className="text-xs text-slate-200 leading-relaxed">
          {report?.ai_interpretation_note ||
            'A file must never be considered unimportant simply because it is old. Inactive library headers or foundational config files retain high importance when depended upon by other active modules.'}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-panel p-4 rounded-2xl border border-slate-800">
          <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
            Average File Age
          </span>
          <p className="text-2xl font-bold text-white font-mono mt-1">
            {report?.average_age_days.toFixed(1) || '0'} days
          </p>
          <p className="text-xs text-slate-400 mt-0.5">Mean time since modification</p>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800">
          <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
            Oldest Tracked File
          </span>
          <p className="text-sm font-semibold text-white font-mono mt-1 truncate" title={report?.oldest_file?.file_name}>
            {report?.oldest_file?.file_name || 'N/A'}
          </p>
          <p className="text-xs text-cyan-400 font-mono mt-0.5">
            {report?.oldest_file?.created_time ? new Date(report.oldest_file.created_time).toLocaleDateString() : 'N/A'}
          </p>
        </div>

        <div className="glass-panel p-4 rounded-2xl border border-slate-800">
          <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
            Most Recently Modified
          </span>
          <p className="text-sm font-semibold text-white font-mono mt-1 truncate" title={report?.most_recently_modified?.file_name}>
            {report?.most_recently_modified?.file_name || 'N/A'}
          </p>
          <p className="text-xs text-emerald-400 font-mono mt-0.5">
            {report?.most_recently_modified?.modified_time ? new Date(report.most_recently_modified.modified_time).toLocaleDateString() : 'N/A'}
          </p>
        </div>
      </div>

      {/* Temporal Buckets Chart */}
      <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-white">
            Temporal Activity Distribution (File Count)
          </h3>
          <p className="text-xs text-slate-400">Files partitioned into age categories based on last modification</p>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={bucketData}>
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
              <Bar dataKey="files" fill="#06b6d4" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
