import React, { useState } from 'react';
import { WorkspaceProvider, useWorkspace } from './context/WorkspaceContext';
import { Sidebar, PageId } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardPage } from './pages/DashboardPage';
import { FileScannerPage } from './pages/FileScannerPage';
import { FileExplorerPage } from './pages/FileExplorerPage';
import { DuplicateDetectorPage } from './pages/DuplicateDetectorPage';
import { StorageAnalyzerPage } from './pages/StorageAnalyzerPage';
import { DependencyGraphPage } from './pages/DependencyGraphPage';
import { ImportanceAnalysisPage } from './pages/ImportanceAnalysisPage';
import { RecommendationsPage } from './pages/RecommendationsPage';
import { AskChronovaPage } from './pages/AskChronovaPage';
import { ArchiveManagerPage } from './pages/ArchiveManagerPage';
import { RestoreUndoPage } from './pages/RestoreUndoPage';
import { ActivityTimelinePage } from './pages/ActivityTimelinePage';
import { PrivacyCenterPage } from './pages/PrivacyCenterPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { SettingsPage } from './pages/SettingsPage';
import { FolderPlus, X } from 'lucide-react';
import { ChronovaApi } from './api/client';

function AppContent() {
  const [currentPage, setCurrentPage] = useState<PageId>('dashboard');
  const [isNewWsModalOpen, setIsNewWsModalOpen] = useState(false);
  const [wsName, setWsName] = useState('');
  const [wsPath, setWsPath] = useState('');
  const [wsDesc, setWsDesc] = useState('');
  const [wsError, setWsError] = useState<string | null>(null);
  const [isCreatingWs, setIsCreatingWs] = useState(false);
  const { refreshWorkspaces } = useWorkspace();

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wsName.trim() || !wsPath.trim()) return;
    setWsError(null);
    setIsCreatingWs(true);
    try {
      await ChronovaApi.createWorkspace({
        name: wsName.trim(),
        root_path: wsPath.trim(),
        description: wsDesc.trim(),
      });
      setWsName('');
      setWsPath('');
      setWsDesc('');
      setWsError(null);
      setIsNewWsModalOpen(false);
      await refreshWorkspaces();
    } catch (err: any) {
      const detail = err.response?.data?.detail || err.message || 'Error creating workspace';
      if (err.response?.status === 409 || (typeof detail === 'string' && detail.toLowerCase().includes('already exists'))) {
        setWsError(`Workspace with path "${wsPath}" already exists. You can select it directly from the workspace dropdown in the top header bar.`);
      } else {
        setWsError(detail);
      }
    } finally {
      setIsCreatingWs(false);
    }
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardPage onNavigate={setCurrentPage} />;
      case 'scanner':
        return <FileScannerPage />;
      case 'explorer':
        return <FileExplorerPage />;
      case 'duplicates':
        return <DuplicateDetectorPage />;
      case 'storage':
        return <StorageAnalyzerPage />;
      case 'graph':
        return <DependencyGraphPage />;
      case 'importance':
        return <ImportanceAnalysisPage />;
      case 'recommendations':
        return <RecommendationsPage />;
      case 'ask':
        return <AskChronovaPage />;
      case 'archives':
        return <ArchiveManagerPage />;
      case 'restore':
        return <RestoreUndoPage />;
      case 'timeline':
        return <ActivityTimelinePage />;
      case 'privacy':
        return <PrivacyCenterPage />;
      case 'audit':
        return <AuditLogsPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardPage onNavigate={setCurrentPage} />;
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Sidebar Navigation */}
      <Sidebar currentPage={currentPage} onSelectPage={setCurrentPage} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <Header onNewWorkspaceModal={() => setIsNewWsModalOpen(true)} />

        <main className="flex-1 overflow-y-auto p-6 bg-slate-950/50">
          <div className="max-w-7xl mx-auto">{renderPage()}</div>
        </main>
      </div>

      {/* New Workspace Modal */}
      {isNewWsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-slate-700 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-semibold text-white">Create New Workspace</h3>
              </div>
              <button
                onClick={() => setIsNewWsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {wsError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs leading-relaxed">
                <p className="font-semibold mb-0.5">Could not create workspace</p>
                <p>{wsError}</p>
              </div>
            )}

            <form onSubmit={handleCreateWorkspace} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Workspace Name *</label>
                <input
                  type="text"
                  value={wsName}
                  onChange={(e) => {
                    setWsName(e.target.value);
                    if (wsError) setWsError(null);
                  }}
                  placeholder="e.g. Chronova Core"
                  required
                  className="w-full bg-slate-900 border border-slate-700 text-white p-2.5 rounded-xl text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Directory Root Path *</label>
                <input
                  type="text"
                  value={wsPath}
                  onChange={(e) => {
                    setWsPath(e.target.value);
                    if (wsError) setWsError(null);
                  }}
                  placeholder="e.g. C:\Users\gorij\OneDrive\Documents\Chronova"
                  required
                  className="w-full bg-slate-900 border border-slate-700 text-white p-2.5 rounded-xl font-mono text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Description (Optional)</label>
                <input
                  type="text"
                  value={wsDesc}
                  onChange={(e) => setWsDesc(e.target.value)}
                  placeholder="e.g. Project files"
                  className="w-full bg-slate-900 border border-slate-700 text-white p-2.5 rounded-xl text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsNewWsModalOpen(false);
                    setWsError(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingWs}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-semibold shadow-lg shadow-cyan-600/20 transition flex items-center gap-1.5"
                >
                  {isCreatingWs ? 'Creating...' : 'Create Workspace'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <WorkspaceProvider>
      <AppContent />
    </WorkspaceProvider>
  );
}
