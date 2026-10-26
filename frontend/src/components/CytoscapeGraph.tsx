import React, { useEffect, useRef, useState, useMemo } from 'react';
import cytoscape, { Core, NodeSingular } from 'cytoscape';
import dagre from 'cytoscape-dagre';
import { DependencyGraphResponse, GraphNodeData } from '../api/types';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Shield,
  Layers,
  ArrowRight,
  Info,
  X,
  Filter,
  Eye,
  EyeOff,
  GitFork,
  Network,
  Share2,
} from 'lucide-react';

// Register Dagre extension
try {
  cytoscape.use(dagre);
} catch (e) {
  // Already registered
}

interface CytoscapeGraphProps {
  graphData: DependencyGraphResponse;
  onSelectNode?: (nodeData: GraphNodeData) => void;
}

type LayoutType = 'dagre-tb' | 'dagre-lr' | 'concentric' | 'cose' | 'breadthfirst';

export const CytoscapeGraph: React.FC<CytoscapeGraphProps> = ({
  graphData,
  onSelectNode,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);

  const [selectedNode, setSelectedNode] = useState<GraphNodeData | null>(null);
  const [layoutName, setLayoutName] = useState<LayoutType>('dagre-tb');
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlyConnected, setShowOnlyConnected] = useState<boolean>(true);
  const [relationshipFilter, setRelationshipFilter] = useState<string>('all');

  // Filter elements based on options
  const filteredElements = useMemo(() => {
    if (!graphData) return [];

    // Find nodes with at least one edge
    const connectedNodeIds = new Set<string>();
    graphData.edges.forEach((e) => {
      if (relationshipFilter === 'all' || e.data.type === relationshipFilter) {
        connectedNodeIds.add(e.data.source);
        connectedNodeIds.add(e.data.target);
      }
    });

    const nodes = graphData.nodes
      .filter((n) => {
        if (showOnlyConnected && !connectedNodeIds.has(n.data.id)) {
          return false;
        }
        return true;
      })
      .map((n) => {
        const fname = n.data.label.toLowerCase();
        let shape = 'round-rectangle';
        if (fname.startsWith('test_') || fname.endsWith('_test.py')) {
          shape = 'diamond';
        } else if (fname in { 'main.py': 1, 'app.tsx': 1, 'index.html': 1, 'main.tsx': 1 }) {
          shape = 'round-hexagon';
        } else if (fname in { 'package.json': 1, 'tsconfig.json': 1, 'vite.config.ts': 1, 'pytest.ini': 1 }) {
          shape = 'round-tag';
        }

        return {
          group: 'nodes' as const,
          data: {
            ...n.data,
            nodeShape: shape,
          },
        };
      });

    const activeNodeIds = new Set(nodes.map((n) => n.data.id));

    const edges = graphData.edges
      .filter((e) => {
        if (!activeNodeIds.has(e.data.source) || !activeNodeIds.has(e.data.target)) {
          return false;
        }
        if (relationshipFilter !== 'all' && e.data.type !== relationshipFilter) {
          return false;
        }
        return true;
      })
      .map((e) => ({
        group: 'edges' as const,
        data: e.data,
      }));

    return [...nodes, ...edges];
  }, [graphData, showOnlyConnected, relationshipFilter]);

  // Construct Cytoscape layout options
  const getLayoutConfig = (name: LayoutType) => {
    switch (name) {
      case 'dagre-tb':
        return {
          name: 'dagre',
          rankDir: 'TB',
          nodeSep: 65,
          rankSep: 110,
          edgeSep: 35,
          padding: 60,
          animate: true,
          animationDuration: 400,
        };
      case 'dagre-lr':
        return {
          name: 'dagre',
          rankDir: 'LR',
          nodeSep: 55,
          rankSep: 140,
          edgeSep: 30,
          padding: 60,
          animate: true,
          animationDuration: 400,
        };
      case 'concentric':
        return {
          name: 'concentric',
          concentric: (node: any) => {
            const inDeg = node.data('in_degree') || 0;
            const imp = node.data('importance_score') || 0;
            return Math.round(inDeg * 12 + imp * 25);
          },
          levelWidth: () => 4,
          minNodeSpacing: 65,
          padding: 60,
          animate: true,
          animationDuration: 400,
        };
      case 'cose':
        return {
          name: 'cose',
          animate: true,
          animationDuration: 600,
          refresh: 20,
          nodeRepulsion: () => 22000,
          idealEdgeLength: () => 140,
          edgeElasticity: () => 80,
          nestingFactor: 1.2,
          gravity: 0.15,
          numIter: 1000,
          coolingFactor: 0.95,
          minTemp: 1.0,
          componentSpacing: 120,
          padding: 60,
        };
      case 'breadthfirst':
        return {
          name: 'breadthfirst',
          directed: true,
          spacingFactor: 1.75,
          padding: 60,
          animate: true,
          animationDuration: 400,
        };
      default:
        return { name: 'dagre', rankDir: 'TB', padding: 60 };
    }
  };

  // Initialize and update Cytoscape
  useEffect(() => {
    if (!containerRef.current) return;

    if (cyRef.current) {
      cyRef.current.destroy();
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements: filteredElements,
      style: [
        // Base Node Style
        {
          selector: 'node',
          style: {
            label: 'data(label)',
            color: '#f8fafc',
            'font-size': '11px',
            'font-family': 'JetBrains Mono, monospace',
            'font-weight': 600,
            'text-valign': 'bottom',
            'text-margin-y': 7,
            'text-background-color': '#090d16',
            'text-background-opacity': 0.9,
            'text-background-padding': '4px',
            'text-background-shape': 'roundrectangle',
            'text-border-width': 1,
            'text-border-color': '#334155',
            shape: 'round-rectangle',
            width: 'mapData(importance_score, 0, 1, 36, 62)',
            height: 'mapData(importance_score, 0, 1, 36, 62)',
            'background-color': '#0284c7',
            'border-width': 2,
            'border-color': '#38bdf8',
            'transition-property': 'background-color, border-color, width, height, opacity',
            'transition-duration': 0.2,
          },
        },
        // Shapes by role
        {
          selector: 'node[nodeShape = "diamond"]',
          style: { shape: 'diamond' },
        },
        {
          selector: 'node[nodeShape = "round-hexagon"]',
          style: { shape: 'round-hexagon' },
        },
        {
          selector: 'node[nodeShape = "round-tag"]',
          style: { shape: 'round-tag' },
        },
        // Privacy Level Colors
        {
          selector: 'node[privacy_level = "restricted"]',
          style: {
            'background-color': '#e11d48',
            'border-color': '#fb7185',
          },
        },
        {
          selector: 'node[privacy_level = "confidential"]',
          style: {
            'background-color': '#d97706',
            'border-color': '#fbbf24',
          },
        },
        {
          selector: 'node[privacy_level = "public"]',
          style: {
            'background-color': '#059669',
            'border-color': '#34d399',
          },
        },
        {
          selector: 'node[privacy_level = "internal"]',
          style: {
            'background-color': '#7c3aed',
            'border-color': '#a78bfa',
          },
        },
        // High In-Degree Core Depended Nodes
        {
          selector: 'node[in_degree > 1]',
          style: {
            'border-width': 3.5,
            'border-color': '#38bdf8',
          },
        },
        // Base Edge Style
        {
          selector: 'edge',
          style: {
            width: 2,
            'line-color': '#475569',
            'target-arrow-color': '#94a3b8',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'arrow-scale': 1.1,
            opacity: 0.75,
            'transition-property': 'line-color, target-arrow-color, width, opacity',
            'transition-duration': 0.2,
          },
        },
        // Imports Edge Style
        {
          selector: 'edge[type = "imports"]',
          style: {
            'line-color': '#0284c7',
            'target-arrow-color': '#38bdf8',
            width: 2.2,
          },
        },
        // Test companion Edge Style
        {
          selector: 'edge[type = "test-for"]',
          style: {
            'line-style': 'dashed',
            'line-color': '#a855f7',
            'target-arrow-color': '#c084fc',
            width: 2,
          },
        },
        // Companion pairing Edge Style
        {
          selector: 'edge[type ^= "companion"]',
          style: {
            'line-color': '#10b981',
            'target-arrow-color': '#34d399',
            width: 2,
          },
        },
        // Config Edge Style
        {
          selector: 'edge[type = "config-for"]',
          style: {
            'line-color': '#6366f1',
            'target-arrow-color': '#818cf8',
            width: 1.8,
          },
        },
        // Duplicate Edge Style
        {
          selector: 'edge[type = "duplicate-of"]',
          style: {
            'line-style': 'dotted',
            'line-color': '#f59e0b',
            'target-arrow-color': '#fbbf24',
            width: 2.2,
          },
        },
        // Selected / Highlighted Node State
        {
          selector: 'node:selected',
          style: {
            'border-width': 4.5,
            'border-color': '#ffffff',
          },
        },
        // Neighborhood Dimming Class
        {
          selector: '.faded',
          style: {
            opacity: 0.15,
          },
        },
        // Neighborhood Active Highlight Class
        {
          selector: '.highlighted',
          style: {
            opacity: 1,
            'border-color': '#ffffff',
            'line-color': '#38bdf8',
            'target-arrow-color': '#38bdf8',
            width: 3.5,
          },
        },
      ],
      layout: getLayoutConfig(layoutName),
    });

    // Tap node handler with Neighborhood Isolation
    cy.on('tap', 'node', (evt) => {
      const node = evt.target as NodeSingular;
      const nodeData = node.data() as GraphNodeData;
      setSelectedNode(nodeData);
      if (onSelectNode) onSelectNode(nodeData);

      // Neighborhood focus: dim all, illuminate selected & neighbors
      cy.elements().removeClass('highlighted').addClass('faded');
      node.removeClass('faded').addClass('highlighted');
      node.neighborhood().removeClass('faded').addClass('highlighted');
    });

    // Tap background handler: reset highlights
    cy.on('tap', (evt) => {
      if (evt.target === cy) {
        setSelectedNode(null);
        cy.elements().removeClass('faded').removeClass('highlighted');
      }
    });

    cyRef.current = cy;

    return () => {
      cy.destroy();
    };
  }, [filteredElements, layoutName]);

  // Search filter
  useEffect(() => {
    if (!cyRef.current) return;
    const cy = cyRef.current;
    if (!searchTerm.trim()) {
      cy.elements().removeClass('faded').removeClass('highlighted');
      return;
    }

    const matched = cy.nodes().filter((ele) => {
      return (ele.data('label') || '').toLowerCase().includes(searchTerm.toLowerCase());
    });

    cy.elements().addClass('faded').removeClass('highlighted');
    matched.removeClass('faded').addClass('highlighted');
    matched.connectedEdges().removeClass('faded').addClass('highlighted');

    if (matched.length === 1) {
      cy.animate({
        center: { eles: matched },
        zoom: 1.3,
        duration: 350,
      });
    }
  }, [searchTerm]);

  const handleZoomIn = () => cyRef.current?.zoom(cyRef.current.zoom() * 1.25);
  const handleZoomOut = () => cyRef.current?.zoom(cyRef.current.zoom() * 0.8);
  const handleFit = () => cyRef.current?.fit(undefined, 50);
  const handleCenter = () => cyRef.current?.center();
  const handleResetLayout = () => {
    if (!cyRef.current) return;
    const layout = cyRef.current.layout(getLayoutConfig(layoutName));
    layout.run();
  };

  // Compute upstream & downstream for selected node
  const dependentsList = useMemo(() => {
    if (!selectedNode || !graphData) return [];
    return graphData.edges
      .filter((e) => e.data.target === selectedNode.id)
      .map((e) => {
        const srcNode = graphData.nodes.find((n) => n.data.id === e.data.source);
        return {
          name: srcNode?.data.label || e.data.source,
          type: e.data.type,
        };
      });
  }, [selectedNode, graphData]);

  const dependenciesList = useMemo(() => {
    if (!selectedNode || !graphData) return [];
    return graphData.edges
      .filter((e) => e.data.source === selectedNode.id)
      .map((e) => {
        const tgtNode = graphData.nodes.find((n) => n.data.id === e.data.target);
        return {
          name: tgtNode?.data.label || e.data.target,
          type: e.data.type,
        };
      });
  }, [selectedNode, graphData]);

  return (
    <div className="relative w-full h-[650px] rounded-3xl overflow-hidden glass-panel border border-slate-800 shadow-2xl">
      {/* Top Controls Toolbar */}
      <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2 bg-slate-900/95 backdrop-blur-md p-2 rounded-2xl border border-slate-700/80 shadow-2xl">
        {/* Search */}
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search file node..."
          className="bg-slate-950 border border-slate-700/80 text-xs text-white px-3 py-1.5 rounded-xl focus:outline-none focus:border-cyan-500 w-44"
        />

        <div className="h-4 w-px bg-slate-700 mx-1" />

        {/* Layout Presets */}
        <select
          value={layoutName}
          onChange={(e) => setLayoutName(e.target.value as LayoutType)}
          className="bg-slate-950 border border-slate-700/80 text-xs text-cyan-300 font-semibold px-2.5 py-1.5 rounded-xl focus:outline-none focus:border-cyan-500"
        >
          <option value="dagre-tb">Top-to-Bottom Tree (Dagre)</option>
          <option value="dagre-lr">Left-to-Right Flow (Dagre)</option>
          <option value="concentric">Importance Rings (Concentric)</option>
          <option value="cose">Force-Directed Repulsion (CoSE)</option>
          <option value="breadthfirst">Breadthfirst Tree</option>
        </select>

        {/* Relationship Filter */}
        <select
          value={relationshipFilter}
          onChange={(e) => setRelationshipFilter(e.target.value)}
          className="bg-slate-950 border border-slate-700/80 text-xs text-slate-300 px-2.5 py-1.5 rounded-xl focus:outline-none focus:border-cyan-500"
        >
          <option value="all">All Edge Types</option>
          <option value="imports">Code Imports</option>
          <option value="test-for">Test Companions</option>
          <option value="duplicate-of">Duplicates</option>
          <option value="config-for">Configurations</option>
        </select>

        {/* Connected Only Toggle */}
        <button
          onClick={() => setShowOnlyConnected(!showOnlyConnected)}
          title={showOnlyConnected ? 'Showing Connected Dependencies Only' : 'Showing All Files'}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
            showOnlyConnected
              ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
              : 'bg-slate-950 border-slate-700 text-slate-400 hover:text-white'
          }`}
        >
          {showOnlyConnected ? <Eye className="w-3.5 h-3.5 text-cyan-400" /> : <EyeOff className="w-3.5 h-3.5" />}
          <span>{showOnlyConnected ? 'Connected Only' : 'All Files'}</span>
        </button>

        <div className="h-4 w-px bg-slate-700 mx-1" />

        {/* Zoom & Fit Actions */}
        <button
          onClick={handleZoomIn}
          title="Zoom In"
          className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={handleZoomOut}
          title="Zoom Out"
          className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={handleFit}
          title="Fit Graph to Viewport"
          className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <button
          onClick={handleResetLayout}
          title="Re-run Layout Algorithm"
          className="p-1.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Bottom Legend Bar */}
      <div className="absolute bottom-4 left-4 z-10 bg-slate-900/90 backdrop-blur-md p-3 rounded-2xl border border-slate-700/80 shadow-2xl text-xs flex flex-wrap items-center gap-4">
        <span className="text-slate-400 font-medium">Node Privacy:</span>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-rose-500/30" />
          <span className="text-slate-300">Restricted</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-amber-500/30" />
          <span className="text-slate-300">Confidential</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-purple-500 ring-2 ring-purple-500/30" />
          <span className="text-slate-300">Internal</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/30" />
          <span className="text-slate-300">Public</span>
        </div>

        <div className="h-4 w-px bg-slate-700 mx-1" />

        <span className="text-slate-400 font-medium">Edges:</span>
        <div className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-cyan-400 inline-block" />
          <span className="text-slate-300 text-[11px]">Imports</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-purple-400 border-t border-dashed inline-block" />
          <span className="text-slate-300 text-[11px]">Test-For</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-amber-400 border-t border-dotted inline-block" />
          <span className="text-slate-300 text-[11px]">Duplicate</span>
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="w-full h-full bg-slate-950/70" />

      {/* Node Details & Neighborhood Inspector Drawer */}
      {selectedNode && (
        <div className="absolute top-4 right-4 z-20 w-88 bg-slate-900/95 backdrop-blur-md p-5 rounded-3xl border border-slate-700 shadow-2xl space-y-4 animate-in slide-in-from-right duration-200 max-h-[600px] overflow-y-auto">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <h4 className="text-sm font-semibold text-white truncate max-w-[220px]" title={selectedNode.label}>
                {selectedNode.label}
              </h4>
            </div>
            <button
              onClick={() => {
                setSelectedNode(null);
                cyRef.current?.elements().removeClass('faded').removeClass('highlighted');
              }}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
              <span className="text-slate-400 text-[10px] block">Inbound Dependents</span>
              <span className="text-base font-bold text-cyan-400 font-mono">
                {selectedNode.in_degree} files
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800">
              <span className="text-slate-400 text-[10px] block">Importance Score</span>
              <span className="text-base font-bold text-purple-400 font-mono">
                {(selectedNode.importance_score * 100).toFixed(0)}%
              </span>
            </div>
          </div>

          {/* Metadata Table */}
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="text-slate-400">Full Path:</span>
              <span className="text-slate-200 font-mono truncate max-w-[170px]" title={selectedNode.file_path}>
                {selectedNode.file_path}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="text-slate-400">File Size:</span>
              <span className="text-slate-200 font-mono">
                {(selectedNode.size_bytes / 1024).toFixed(1)} KB
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="text-slate-400">Privacy Classification:</span>
              <span
                className={`px-2 py-0.5 rounded uppercase font-semibold text-[10px] ${
                  selectedNode.privacy_level === 'restricted'
                    ? 'bg-rose-500/20 text-rose-400'
                    : selectedNode.privacy_level === 'confidential'
                    ? 'bg-amber-500/20 text-amber-400'
                    : selectedNode.privacy_level === 'public'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-purple-500/20 text-purple-400'
                }`}
              >
                {selectedNode.privacy_level}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800">
              <span className="text-slate-400">PageRank Centrality:</span>
              <span className="text-slate-200 font-mono">{selectedNode.pagerank.toFixed(4)}</span>
            </div>
          </div>

          {/* Upstream Dependents Section */}
          <div className="space-y-1.5 pt-1">
            <span className="text-xs font-semibold text-cyan-400 flex items-center gap-1.5">
              <GitFork className="w-3.5 h-3.5" />
              Depended Upon By ({dependentsList.length}):
            </span>
            {dependentsList.length > 0 ? (
              <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                {dependentsList.map((dep, idx) => (
                  <div
                    key={idx}
                    className="p-1.5 rounded-lg bg-slate-950/70 border border-slate-800 text-[11px] font-mono flex items-center justify-between text-slate-300"
                  >
                    <span className="truncate max-w-[170px]" title={dep.name}>{dep.name}</span>
                    <span className="text-[10px] text-cyan-400 font-sans uppercase font-medium">{dep.type}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 italic">No files depend on this module (Leaf node).</p>
            )}
          </div>

          {/* Downstream Dependencies Section */}
          <div className="space-y-1.5 pt-1">
            <span className="text-xs font-semibold text-purple-400 flex items-center gap-1.5">
              <ArrowRight className="w-3.5 h-3.5" />
              Imports / Relies Upon ({dependenciesList.length}):
            </span>
            {dependenciesList.length > 0 ? (
              <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                {dependenciesList.map((dep, idx) => (
                  <div
                    key={idx}
                    className="p-1.5 rounded-lg bg-slate-950/70 border border-slate-800 text-[11px] font-mono flex items-center justify-between text-slate-300"
                  >
                    <span className="truncate max-w-[170px]" title={dep.name}>{dep.name}</span>
                    <span className="text-[10px] text-purple-400 font-sans uppercase font-medium">{dep.type}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 italic">This file has no outbound dependencies.</p>
            )}
          </div>

          {/* Protection Directive */}
          <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 text-[11px] leading-relaxed">
            {selectedNode.in_degree > 0 ? (
              <span className="text-amber-300">
                <strong>High Impact Component:</strong> {selectedNode.in_degree} other workspace file(s) directly rely on this file. Archiving or deleting it would create runtime import failures.
              </span>
            ) : (
              <span className="text-slate-400">
                <strong>Isolated Component:</strong> 0 other files rely on this file. Archival carries minimal dependency break risk.
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
