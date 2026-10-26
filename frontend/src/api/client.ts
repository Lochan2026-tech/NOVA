import axios from 'axios';
import {
  Workspace,
  ScanRecord,
  FileRecord,
  DuplicateReport,
  StorageReport,
  TemporalReport,
  DependencyGraphResponse,
  ImportanceReport,
  LifecycleRecommendation,
  ArchiveRecord,
  AuditLog,
  AskResponse,
  AppSettings,
} from './types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const ChronovaApi = {
  // Health
  getHealth: async () => (await api.get('/health')).data,

  // Workspaces
  getWorkspaces: async (): Promise<Workspace[]> => {
    const res = await api.get('/workspaces');
    return res.data.workspaces || [];
  },
  createWorkspace: async (data: { name: string; root_path: string; description?: string; analysis_mode?: string }): Promise<Workspace> => {
    const res = await api.post('/workspaces', data);
    return res.data;
  },
  deleteWorkspace: async (id: string) => {
    return (await api.delete(`/workspaces/${id}`)).data;
  },

  // Scans
  startScan: async (workspaceId: string, customPath?: string): Promise<ScanRecord> => {
    const res = await api.post('/scans', { workspace_id: workspaceId, scan_path: customPath });
    return res.data;
  },
  getScans: async (workspaceId?: string): Promise<ScanRecord[]> => {
    const res = await api.get('/scans', { params: { workspace_id: workspaceId } });
    return res.data.scans || [];
  },
  getScan: async (id: string): Promise<ScanRecord> => {
    return (await api.get(`/scans/${id}`)).data;
  },

  // Files
  getFiles: async (scanId?: string, limit = 200, offset = 0, extension?: string, privacyLevel?: string): Promise<{ files: FileRecord[]; total: number }> => {
    const res = await api.get('/files', { params: { scan_id: scanId, limit, offset, extension, privacy_level: privacyLevel } });
    return res.data;
  },
  getFile: async (id: string): Promise<FileRecord> => {
    return (await api.get(`/files/${id}`)).data;
  },

  // Analysis Reports
  getDuplicates: async (scanId: string): Promise<DuplicateReport> => {
    return (await api.get(`/scans/${scanId}/duplicates`)).data;
  },
  getStorage: async (scanId: string): Promise<StorageReport> => {
    return (await api.get(`/scans/${scanId}/storage`)).data;
  },
  getTemporal: async (scanId: string): Promise<TemporalReport> => {
    return (await api.get(`/scans/${scanId}/temporal`)).data;
  },
  getGraph: async (scanId: string): Promise<DependencyGraphResponse> => {
    return (await api.get(`/scans/${scanId}/graph`)).data;
  },
  getImportance: async (scanId: string): Promise<ImportanceReport> => {
    return (await api.get(`/scans/${scanId}/importance`)).data;
  },

  // Recommendations & Approvals
  getRecommendations: async (scanId: string, status?: string): Promise<LifecycleRecommendation[]> => {
    const res = await api.get(`/scans/${scanId}/recommendations`, { params: { status } });
    return res.data.recommendations || [];
  },
  approveRecommendation: async (recommendationId: string, action: 'approve' | 'reject', reason?: string, approvedBy = 'user') => {
    return (await api.post('/recommendations/approve', {
      recommendation_id: recommendationId,
      action,
      reason,
      approved_by: approvedBy,
    })).data;
  },

  // Archiving & Restoration
  archiveFile: async (fileId: string, recommendationId?: string, user = 'user'): Promise<ArchiveRecord> => {
    return (await api.post('/archives', {
      file_id: fileId,
      recommendation_id: recommendationId,
      user,
    })).data;
  },
  getArchives: async (): Promise<ArchiveRecord[]> => {
    const res = await api.get('/archives');
    return res.data.archives || [];
  },
  restoreArchive: async (archiveId: string, restorePath?: string) => {
    return (await api.post('/archives/restore', { archive_id: archiveId, restore_path: restorePath })).data;
  },
  undoArchive: async (archiveId: string) => {
    return (await api.post(`/archives/${archiveId}/undo`)).data;
  },

  // AI Assistance (Ask Chronova)
  askChronova: async (question: string, scanId?: string): Promise<AskResponse> => {
    return (await api.post('/ask', { question, scan_id: scanId })).data;
  },

  // Audit Logs
  getAuditLogs: async (limit = 100, offset = 0, action?: string): Promise<{ logs: AuditLog[]; total: number }> => {
    const res = await api.get('/audit-logs', { params: { limit, offset, action } });
    return res.data;
  },

  // Settings
  getSettings: async (): Promise<AppSettings> => {
    return (await api.get('/settings')).data;
  },
  updateSettings: async (settingsUpdate: Partial<AppSettings>): Promise<AppSettings> => {
    return (await api.patch('/settings', settingsUpdate)).data;
  },
};
