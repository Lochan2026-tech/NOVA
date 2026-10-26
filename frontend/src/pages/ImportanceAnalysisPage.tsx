import React, { useEffect, useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { ChronovaApi } from '../api/client';
import { ImportanceReport, ImportanceItem } from '../api/types';
import { Award, Shield, Network, GitFork, Info, HelpCircle } from 'lucide-react';

export const ImportanceAnalysisPage: React.FC = () => {
  const { activeScan } = useWorkspace();
  const [report, setReport] = useState<ImportanceReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [tierFilter, setTierFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  useEffect(() => {
    if (!activeScan) return;
    const fetchImportance = async () => {
      try {
        setLoading(true);
        const data = await ChronovaApi.getImportance(activeScan.id);
        setReport(data);
      } catch (err) {
        console.error('Failed to load importance report:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchImportance();
  }, [activeScan?.id]);

  const filteredFiles = (report?.scored_files || []).filter((item) => {
    if (tierFilter === 'high') return item.importance_score >= 0.6;
    if (tierFilter === 'medium') return item.importance_score >= 0.35 && item.importance_score < 0.6;
    if (tierFilter === 'low') return item.importance_score < 0.35;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Award className="w-5 h-5 text-purple-400" />
          Graph-Based File Importance Scoring
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Multidimensional ranking combining NetworkX graph centrality (in-degree, PageRank, betweenness), privacy status, and project roles.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setTierFilter('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
            tierFilter === 'all'
              ? 'bg-cyan-500 text-slate-950 font-bold'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          All Scored Files ({report?.scored_files.length || 0})
        </button>
        <button
          onClick={() => setTierFilter('high')}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
            tierFilter === 'high'
              ? 'bg-purple-500 text-white font-bold'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          High Importance (&ge; 60%)
        </button>
        <button
          onClick={() => setTierFilter('medium')}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
            tierFilter === 'medium'
              ? 'bg-amber-500 text-slate-950 font-bold'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          Moderate (35% &ndash; 60%)
        </button>
        <button
          onClick={() => setTierFilter('low')}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
            tierFilter === 'low'
              ? 'bg-slate-700 text-white font-bold'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          }`}
        >
          Leaf Nodes (&lt; 35%)
        </button>
      </div>

      {/* Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-3">Rank</th>
                <th className="p-3">File Name</th>
                <th className="p-3">Inbound Deps</th>
                <th className="p-3">In-Degree Wt</th>
                <th className="p-3">PageRank Wt</th>
                <th className="p-3">Privacy Wt</th>
                <th className="p-3">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredFiles.map((item) => (
                <tr key={item.file_id} className="hover:bg-slate-900/50 transition">
                  <td className="p-3 text-slate-500 font-bold">#{item.rank}</td>
                  <td className="p-3 font-semibold text-white">
                    <div className="truncate max-w-xs" title={item.file_path}>
                      {item.file_name}
                    </div>
                    <div className="text-[10px] text-slate-500 truncate max-w-xs">
                      {item.file_path}
                    </div>
                  </td>
                  <td className="p-3 text-cyan-400 font-bold">
                    {item.factors.inbound_dependencies}
                  </td>
                  <td className="p-3 text-slate-300">
                    +{item.factors.in_degree_weight}
                  </td>
                  <td className="p-3 text-slate-300">
                    +{item.factors.pagerank_weight}
                  </td>
                  <td className="p-3 text-slate-300">
                    {item.factors.privacy_boost > 0
                      ? `+${item.factors.privacy_boost}`
                      : '0.00'}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-cyan-500 to-purple-500 h-2 rounded-full"
                          style={{ width: `${item.importance_score * 100}%` }}
                        />
                      </div>
                      <span className="text-white font-bold">
                        {(item.importance_score * 100).toFixed(0)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredFiles.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500 font-sans">
                    No files found in this category.
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
