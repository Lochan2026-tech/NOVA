import React, { useEffect, useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { ChronovaApi } from '../api/client';
import { LifecycleRecommendation } from '../api/types';
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Archive,
  Info,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { ConfirmModal } from '../components/ConfirmModal';

export const RecommendationsPage: React.FC = () => {
  const { activeScan } = useWorkspace();
  const [recs, setRecs] = useState<LifecycleRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionFilter, setActionFilter] = useState<'all' | 'retain' | 'archive' | 'review' | 'monitor'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'archived'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');

  // Approval modal state
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    rec: LifecycleRecommendation | null;
    actionType: 'approve' | 'reject';
  }>({
    isOpen: false,
    rec: null,
    actionType: 'approve',
  });

  const loadRecs = async () => {
    if (!activeScan) return;
    try {
      setLoading(true);
      const data = await ChronovaApi.getRecommendations(activeScan.id);
      setRecs(data);
    } catch (err) {
      console.error('Failed to load recommendations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecs();
  }, [activeScan?.id]);

  const handleApprovalConfirm = async (reason?: string) => {
    if (!modalState.rec) return;
    try {
      await ChronovaApi.approveRecommendation(
        modalState.rec.id,
        modalState.actionType,
        reason,
        'user'
      );
      setModalState({ isOpen: false, rec: null, actionType: 'approve' });
      await loadRecs();
    } catch (err: any) {
      alert(`Decision failed: ${err.message || 'Error updating recommendation'}`);
    }
  };

  const handleExecuteArchive = async (rec: LifecycleRecommendation) => {
    try {
      await ChronovaApi.archiveFile(rec.file_id, rec.id, 'user');
      setActionSuccessMsg(`File '${rec.file_name}' successfully archived with SHA-256 verification.`);
      await loadRecs();
      setTimeout(() => setActionSuccessMsg(''), 4000);
    } catch (err: any) {
      alert(`Archival failed: ${err.response?.data?.detail || err.message}`);
    }
  };

  const filteredRecs = recs.filter((r) => {
    if (actionFilter !== 'all' && r.action !== actionFilter) return false;
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-cyan-400" />
          Explainable AI Lifecycle Recommendation Center
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Review transparent, evidence-backed recommendations. Potentially destructive operations strictly require explicit user approval.
        </p>
      </div>

      {actionSuccessMsg && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Action Filter */}
        <div className="flex items-center gap-2">
          {(['all', 'retain', 'archive', 'review', 'monitor'] as const).map((act) => (
            <button
              key={act}
              onClick={() => setActionFilter(act)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium uppercase transition ${
                actionFilter === act
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {act}
            </button>
          ))}
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          {(['all', 'pending', 'approved', 'rejected', 'archived'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium capitalize transition ${
                statusFilter === st
                  ? 'bg-purple-500 text-white font-bold'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Recommendations Cards List */}
      <div className="space-y-4">
        {filteredRecs.map((rec) => {
          const isExpanded = expandedId === rec.id;
          let factors: any[] = [];
          let evidence: Record<string, any> = {};
          try {
            factors = JSON.parse(rec.contributing_factors || '[]');
          } catch {}
          try {
            evidence = JSON.parse(rec.evidence_summary || '{}');
          } catch {}

          const actionColor =
            rec.action === 'retain'
              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
              : rec.action === 'archive'
              ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
              : rec.action === 'review'
              ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
              : 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';

          const riskColor =
            rec.risk_level === 'critical'
              ? 'text-rose-400 bg-rose-500/10'
              : rec.risk_level === 'high'
              ? 'text-amber-400 bg-amber-500/10'
              : rec.risk_level === 'medium'
              ? 'text-cyan-400 bg-cyan-500/10'
              : 'text-slate-400 bg-slate-800';

          return (
            <div
              key={rec.id}
              className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4 hover:border-slate-700 transition"
            >
              {/* Header Line */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold uppercase border ${actionColor}`}
                  >
                    {rec.action}
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-white font-mono">
                      {rec.file_name}
                    </h3>
                    <p className="text-[11px] text-slate-400 font-mono truncate max-w-lg" title={rec.file_path}>
                      {rec.file_path}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <span className={`px-2 py-0.5 rounded uppercase font-semibold ${riskColor}`}>
                    Risk: {rec.risk_level}
                  </span>
                  <span className="text-slate-400 font-mono">
                    Confidence: {(rec.confidence * 100).toFixed(0)}%
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-medium capitalize ${
                      rec.status === 'approved'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : rec.status === 'rejected'
                        ? 'bg-rose-500/20 text-rose-400'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {rec.status}
                  </span>
                </div>
              </div>

              {/* Natural Language Explanation Box */}
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-200 leading-relaxed flex items-start gap-2.5">
                <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <p>{rec.explanation}</p>
              </div>

              {/* Contributing Factors Accordion */}
              <div>
                <button
                  onClick={() => setExpandedId(isExpanded ? null : rec.id)}
                  className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-medium"
                >
                  <span>Contributing Factors Breakdown ({factors.length})</span>
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {isExpanded && (
                  <div className="mt-3 p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2 text-xs">
                    {factors.map((f, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between py-1 border-b border-slate-800 last:border-b-0"
                      >
                        <div>
                          <span className="font-semibold text-white mr-2">{f.factor}:</span>
                          <span className="text-slate-400">{f.description}</span>
                        </div>
                        <span className="text-cyan-400 font-mono font-bold">{f.weight}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Decision Actions Bar */}
              {rec.status === 'pending' && (
                <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800/60">
                  <button
                    onClick={() =>
                      setModalState({
                        isOpen: true,
                        rec,
                        actionType: 'reject',
                      })
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-medium transition"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Reject Action</span>
                  </button>
                  <button
                    onClick={() =>
                      setModalState({
                        isOpen: true,
                        rec,
                        actionType: 'approve',
                      })
                    }
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 transition"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approve Recommendation</span>
                  </button>
                </div>
              )}

              {rec.status === 'approved' && rec.action === 'archive' && (
                <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800/60">
                  <span className="text-[11px] text-emerald-400 flex items-center gap-1 mr-auto">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Approved by user</span>
                  </span>
                  <button
                    onClick={() => handleExecuteArchive(rec)}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-lg shadow-amber-600/20 transition"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    <span>Execute Safe Archival</span>
                  </button>
                </div>
              )}

              {rec.status === 'archived' && (
                <div className="flex items-center justify-end pt-2 border-t border-slate-800/60">
                  <span className="text-[11px] text-amber-400 flex items-center gap-1">
                    <Archive className="w-3.5 h-3.5" />
                    <span>File safely archived with cryptographic verification</span>
                  </span>
                </div>
              )}
            </div>
          );
        })}

        {filteredRecs.length === 0 && (
          <div className="glass-panel p-12 text-center text-slate-500 rounded-2xl">
            No recommendations match the selected filters.
          </div>
        )}
      </div>

      {/* User Decision Modal */}
      <ConfirmModal
        isOpen={modalState.isOpen}
        title={modalState.actionType === 'approve' ? 'Approve File Recommendation' : 'Reject File Recommendation'}
        message={`Are you sure you want to ${modalState.actionType} the recommended action '${modalState.rec?.action}' for '${modalState.rec?.file_name}'?`}
        confirmLabel={modalState.actionType === 'approve' ? 'Approve' : 'Reject'}
        isDestructive={modalState.actionType === 'reject'}
        requireReason={modalState.actionType === 'reject'}
        onConfirm={handleApprovalConfirm}
        onCancel={() => setModalState({ isOpen: false, rec: null, actionType: 'approve' })}
      />
    </div>
  );
};
