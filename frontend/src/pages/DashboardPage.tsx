import React, { useEffect, useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { ChronovaApi } from '../api/client';
import {
  StorageReport,
  DuplicateReport,
  LifecycleRecommendation,
  DependencyGraphResponse,
} from '../api/types';
import { StatCard } from '../components/StatCard';
import {
  HardDrive,
  Network,
  Copy,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  TrendingUp,
  FileCheck2,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

export const DashboardPage: React.FC<{ onNavigate: (page: any) => void }> = ({
  onNavigate,
}) => {
  const { activeWorkspace, activeScan, triggerScan, isScanning } = useWorkspace();
  const [storage, setStorage] = useState<StorageReport | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateReport | null>(null);
  const [recs, setRecs] = useState<LifecycleRecommendation[]>([]);
  const [graph, setGraph] = useState<DependencyGraphResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeScan) return;
    const loadDashboardData = async () => {
      try {
        setLoading(true);
        const [storageData, dupData, recData, graphData] = await Promise.all([
          ChronovaApi.getStorage(activeScan.id).catch(() => null),
          ChronovaApi.getDuplicates(activeScan.id).catch(() => null),
          ChronovaApi.getRecommendations(activeScan.id).catch(() => []),
          ChronovaApi.getGraph(activeScan.id).catch(() => null),
        ]);
        setStorage(storageData);
        setDuplicates(dupData);
        setRecs(recData);
        setGraph(graphData);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadDashboardData();
  }, [activeScan?.id]);

  if (!activeScan) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] text-center space-y-4">
        <div className="p-4 rounded-3xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
          <HardDrive className="w-10 h-10" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-white">No Scan Data Available</h2>
          <p className="text-sm text-slate-400 max-w-md">
            Select a workspace and execute a pipeline scan to visualize file dependencies,
            privacy classifications, and lifecycle recommendations.
          </p>
        </div>
        <button
          onClick={() => triggerScan()}
          disabled={isScanning || !activeWorkspace}
          className="px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-sm shadow-lg shadow-cyan-600/20 transition"
        >
          {isScanning ? 'Executing Initial Scan...' : 'Start Pipeline Scan'}
        </button>
      </div>
    );
  }

  const totalMb = storage ? (storage.total_size_bytes / (1024 * 1024)).toFixed(1) : '0';
  const wastedMb = duplicates ? (duplicates.total_wasted_bytes / (1024 * 1024)).toFixed(2) : '0';
  const totalDeps = graph ? graph.total_edges : 0;
  const pendingApprovals = recs.filter((r) => r.status === 'pending').length;

  const storageChartData = storage?.by_extension.slice(0, 6).map((item) => ({
    name: item.extension || 'none',
    size: Number((item.total_bytes / 1024).toFixed(1)),
  })) || [];

  const COLORS = ['#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#3b82f6'];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="glass-panel p-6 rounded-3xl border border-cyan-500/20 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-gradient-to-l from-cyan-500/10 to-transparent pointer-events-none" />
        <div className="relative z-10 max-w-2xl space-y-2">
          <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
            Intelligent File Lifecycle System
          </span>
          <h1 className="text-2xl font-bold text-white">
            Workspace: {activeWorkspace?.name}
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            Chronova analyzed {activeScan.total_files} files across {activeScan.total_directories} directories.
            Our core rule guarantees that files are never deemed obsolete based on age alone when active dependencies exist.
          </p>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Storage"
          value={`${totalMb} MB`}
          subtitle={`${activeScan.total_files} scanned files`}
          icon={HardDrive}
          color="cyan"
        />
        <StatCard
          title="Graph Dependencies"
          value={totalDeps}
          subtitle="Topological code & companion links"
          icon={Network}
          color="purple"
        />
        <StatCard
          title="Redundant Duplicates"
          value={`${wastedMb} MB`}
          subtitle={`${duplicates?.total_duplicate_files || 0} identical copies`}
          icon={Copy}
          color="amber"
        />
        <StatCard
          title="Pending Decisions"
          value={pendingApprovals}
          subtitle="Awaiting explicit user approval"
          icon={Sparkles}
          color="emerald"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Storage by Extension Chart */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">
                Storage by File Extension (KB)
              </h3>
              <p className="text-xs text-slate-400">Largest file formats detected</p>
            </div>
            <button
              onClick={() => onNavigate('storage')}
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium"
            >
              Details <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={storageChartData}>
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
                <Bar dataKey="size" fill="#06b6d4" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Lifecycle Distribution */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">
                Lifecycle Actions
              </h3>
              <button
                onClick={() => onNavigate('recommendations')}
                className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium"
              >
                Review <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-1">Recommended file actions</p>
          </div>

          <div className="space-y-3 my-auto">
            {['retain', 'archive', 'review', 'monitor'].map((act) => {
              const count = recs.filter((r) => r.action === act).length;
              const pct = recs.length > 0 ? ((count / recs.length) * 100).toFixed(0) : '0';
              const colorCls =
                act === 'retain'
                  ? 'text-emerald-400 bg-emerald-500/10'
                  : act === 'archive'
                  ? 'text-amber-400 bg-amber-500/10'
                  : act === 'review'
                  ? 'text-rose-400 bg-rose-500/10'
                  : 'text-cyan-400 bg-cyan-500/10';

              return (
                <div key={act} className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-slate-900/50">
                  <span className={`px-2 py-0.5 rounded font-semibold uppercase ${colorCls}`}>
                    {act}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-mono font-bold">{count}</span>
                    <span className="text-slate-400 text-[11px]">({pct}%)</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 text-[11px] text-slate-400">
            Explicit user approval is mandatory before any archive or restore operation.
          </div>
        </div>
      </div>
    </div>
  );
};
