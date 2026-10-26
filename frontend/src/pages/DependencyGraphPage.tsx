import React, { useEffect, useState } from 'react';
import { useWorkspace } from '../context/WorkspaceContext';
import { ChronovaApi } from '../api/client';
import { DependencyGraphResponse, GraphNodeData } from '../api/types';
import { CytoscapeGraph } from '../components/CytoscapeGraph';
import { Network, HelpCircle, Info, Layers, GitBranch, ArrowRight } from 'lucide-react';

export const DependencyGraphPage: React.FC = () => {
  const { activeScan } = useWorkspace();
  const [graphData, setGraphData] = useState<DependencyGraphResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState<GraphNodeData | null>(null);

  useEffect(() => {
    if (!activeScan) return;
    const fetchGraph = async () => {
      try {
        setLoading(true);
        const data = await ChronovaApi.getGraph(activeScan.id);
        setGraphData(data);
      } catch (err) {
        console.error('Failed to load dependency graph:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchGraph();
  }, [activeScan?.id]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Network className="w-5 h-5 text-cyan-400" />
            Interactive Dependency Graph Viewer
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Visualized using Cytoscape.js & NetworkX. Nodes represent workspace files; directed edges represent code imports, companion pairings, and configs.
          </p>
        </div>

        {/* Stats Pills */}
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
            <span className="text-slate-400 mr-2">Nodes:</span>
            <span className="text-white font-mono font-bold">
              {graphData?.total_nodes || 0}
            </span>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs">
            <span className="text-slate-400 mr-2">Edges:</span>
            <span className="text-cyan-400 font-mono font-bold">
              {graphData?.total_edges || 0}
            </span>
          </div>
        </div>
      </div>

      {/* Graph Area */}
      {graphData && graphData.total_nodes > 0 ? (
        <CytoscapeGraph
          graphData={graphData}
          onSelectNode={(node) => setSelectedNode(node)}
        />
      ) : (
        <div className="glass-panel p-16 rounded-2xl text-center text-slate-400">
          <Layers className="w-10 h-10 text-cyan-500 mx-auto mb-2" />
          <h3 className="text-base font-semibold text-white">No Graph Data</h3>
          <p className="text-xs text-slate-500 mt-1">
            Run a workspace scan to construct the topological dependency graph.
          </p>
        </div>
      )}

      {/* Explanatory Educational Callout */}
      <div className="glass-panel p-5 rounded-2xl border border-cyan-500/20 text-xs text-slate-300 space-y-2">
        <div className="flex items-center gap-2 text-cyan-400 font-semibold">
          <Info className="w-4 h-4" />
          <span>Graph-Theoretic Principle in Chronova</span>
        </div>
        <p className="leading-relaxed">
          In operating systems file management, relying purely on access timestamps leads to dangerous deletions of inactive library modules, header files, or utility scripts. Chronova uses directed graph topology where nodes with <strong>inbound dependencies</strong> receive an automatic protection score, preventing accidental archiving even if the file has not been touched in months or years.
        </p>
      </div>
    </div>
  );
};
