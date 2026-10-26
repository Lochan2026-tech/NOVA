import React from 'react';
import {
  LayoutDashboard,
  FolderTree,
  Scan,
  Copy,
  PieChart,
  Network,
  Award,
  Sparkles,
  MessageSquareCode,
  Archive,
  Undo2,
  Clock,
  ShieldAlert,
  History,
  Settings,
  Flame,
} from 'lucide-react';

export type PageId =
  | 'dashboard'
  | 'explorer'
  | 'scanner'
  | 'duplicates'
  | 'storage'
  | 'graph'
  | 'importance'
  | 'recommendations'
  | 'ask'
  | 'archives'
  | 'restore'
  | 'timeline'
  | 'privacy'
  | 'audit'
  | 'settings';

interface SidebarProps {
  currentPage: PageId;
  onSelectPage: (page: PageId) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, onSelectPage }) => {
  const navSections = [
    {
      group: 'OVERVIEW',
      items: [
        { id: 'dashboard' as PageId, label: 'Dashboard', icon: LayoutDashboard },
        { id: 'scanner' as PageId, label: 'File Scanner', icon: Scan },
      ],
    },
    {
      group: 'FILE SYSTEM & DISK',
      items: [
        { id: 'explorer' as PageId, label: 'File Explorer', icon: FolderTree },
        { id: 'duplicates' as PageId, label: 'Duplicate Detector', icon: Copy },
        { id: 'storage' as PageId, label: 'Storage Analyzer', icon: PieChart },
        { id: 'timeline' as PageId, label: 'Activity Timeline', icon: Clock },
      ],
    },
    {
      group: 'GRAPH & INTELLIGENCE',
      items: [
        { id: 'graph' as PageId, label: 'Dependency Graph', icon: Network },
        { id: 'importance' as PageId, label: 'Importance Scoring', icon: Award },
        { id: 'ask' as PageId, label: 'Ask Chronova', icon: MessageSquareCode },
      ],
    },
    {
      group: 'LIFECYCLE & PROTECTION',
      items: [
        { id: 'recommendations' as PageId, label: 'Recommendations', icon: Sparkles },
        { id: 'archives' as PageId, label: 'Archive Manager', icon: Archive },
        { id: 'restore' as PageId, label: 'Restore & Undo', icon: Undo2 },
      ],
    },
    {
      group: 'GOVERNANCE & CONFIG',
      items: [
        { id: 'privacy' as PageId, label: 'Privacy Center', icon: ShieldAlert },
        { id: 'audit' as PageId, label: 'Audit Logs', icon: History },
        { id: 'settings' as PageId, label: 'Settings', icon: Settings },
      ],
    },
  ];

  return (
    <aside className="w-64 bg-slate-950 border-r border-slate-800/80 flex flex-col h-screen select-none">
      {/* Brand Header */}
      <div className="h-16 flex items-center gap-3 px-5 border-b border-slate-800/80">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
          <Flame className="w-5 h-5 text-white" />
        </div>
        <div>
          <span className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
            Chronova
            <span className="text-[10px] uppercase font-semibold text-cyan-400 bg-cyan-500/10 px-1.5 py-0.2 rounded border border-cyan-500/20">
              v1.0
            </span>
          </span>
          <p className="text-[10px] text-slate-400 font-mono">Explainable Lifecycle</p>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {navSections.map((sec) => (
          <div key={sec.group}>
            <span className="px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-2">
              {sec.group}
            </span>
            <div className="space-y-0.5">
              {sec.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectPage(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 text-left ${
                      isActive
                        ? 'bg-gradient-to-r from-cyan-500/15 to-purple-500/10 text-cyan-300 border border-cyan-500/30 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 ${
                        isActive ? 'text-cyan-400' : 'text-slate-400'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/40">
        <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400">
          <p className="font-medium text-slate-300">Privacy Safeguard Active</p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Zero cloud telemetry. Local processing only.
          </p>
        </div>
      </div>
    </aside>
  );
};
