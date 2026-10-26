import React, { createContext, useContext, useState, useEffect } from 'react';
import { ChronovaApi } from '../api/client';
import { Workspace, ScanRecord } from '../api/types';

interface WorkspaceContextType {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  setActiveWorkspace: (ws: Workspace | null) => void;
  scans: ScanRecord[];
  activeScan: ScanRecord | null;
  setActiveScan: (s: ScanRecord | null) => void;
  isLoading: boolean;
  isScanning: boolean;
  refreshWorkspaces: () => Promise<void>;
  refreshScans: () => Promise<void>;
  triggerScan: (customPath?: string) => Promise<ScanRecord | null>;
  systemHealthy: boolean;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [activeScan, setActiveScan] = useState<ScanRecord | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [systemHealthy, setSystemHealthy] = useState<boolean>(true);

  // Load workspaces on initial mount
  const refreshWorkspaces = async () => {
    try {
      setIsLoading(true);
      const list = await ChronovaApi.getWorkspaces();
      setWorkspaces(list);
      if (list.length > 0) {
        const savedId = localStorage.getItem('chronova_active_ws');
        const savedWs = list.find((w) => w.id === savedId);
        const chronovaWs = list.find((w) => w.name.toLowerCase().includes('chronova') || w.root_path.toLowerCase().endsWith('chronova'));
        const target = savedWs || chronovaWs || list[0];
        setActiveWorkspace(target);
      }
      setSystemHealthy(true);
    } catch (err) {
      console.error('Failed to load workspaces:', err);
      setSystemHealthy(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Load scans when active workspace changes
  const refreshScans = async () => {
    if (!activeWorkspace) {
      setScans([]);
      setActiveScan(null);
      return;
    }
    try {
      const scanList = await ChronovaApi.getScans(activeWorkspace.id);
      setScans(scanList);
      if (scanList.length > 0) {
        setActiveScan(scanList[0]);
      } else {
        setActiveScan(null);
      }
    } catch (err) {
      console.error('Failed to load scans:', err);
    }
  };

  useEffect(() => {
    refreshWorkspaces();
  }, []);

  useEffect(() => {
    if (activeWorkspace) {
      refreshScans();
    }
  }, [activeWorkspace?.id]);

  const triggerScan = async (customPath?: string): Promise<ScanRecord | null> => {
    if (!activeWorkspace) return null;
    try {
      setIsScanning(true);
      const newScan = await ChronovaApi.startScan(activeWorkspace.id, customPath);
      await refreshScans();
      setActiveScan(newScan);
      return newScan;
    } catch (err) {
      console.error('Scan execution failed:', err);
      throw err;
    } finally {
      setIsScanning(false);
    }
  };

  const handleSetActiveWorkspace = (ws: Workspace | null) => {
    setActiveWorkspace(ws);
    if (ws) {
      localStorage.setItem('chronova_active_ws', ws.id);
    } else {
      localStorage.removeItem('chronova_active_ws');
    }
  };

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        activeWorkspace,
        setActiveWorkspace: handleSetActiveWorkspace,
        scans,
        activeScan,
        setActiveScan,
        isLoading,
        isScanning,
        refreshWorkspaces,
        refreshScans,
        triggerScan,
        systemHealthy,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};
