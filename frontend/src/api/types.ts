export interface Workspace {
  id: string;
  name: string;
  root_path: string;
  description: string;
  analysis_mode: 'metadata' | 'structural' | 'content-aware';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ScanRecord {
  id: string;
  workspace_id: string;
  scan_path: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  total_files: number;
  total_directories: number;
  total_size_bytes: number;
  files_scanned: number;
  errors_count: number;
  error_details?: string;
  started_at: string;
  completed_at?: string;
}

export interface FileRecord {
  id: string;
  scan_id: string;
  file_path: string;
  file_name: string;
  extension: string;
  size_bytes: number;
  mime_type: string;
  sha256_hash?: string;
  created_time?: string;
  modified_time?: string;
  accessed_time?: string;
  is_duplicate: boolean;
  duplicate_group_id?: string;
  privacy_level: 'public' | 'internal' | 'confidential' | 'restricted' | 'unknown';
  importance_score?: number;
  is_hidden: boolean;
  is_system: boolean;
  is_readonly: boolean;
  parent_directory: string;
}

export interface DuplicateGroup {
  group_id: string;
  sha256_hash: string;
  file_size: number;
  count: number;
  files: FileRecord[];
  wasted_bytes: number;
}

export interface DuplicateReport {
  scan_id: string;
  total_duplicate_groups: number;
  total_duplicate_files: number;
  total_wasted_bytes: number;
  groups: DuplicateGroup[];
}

export interface StorageByExtension {
  extension: string;
  count: number;
  total_bytes: number;
  percentage: number;
}

export interface StorageByDirectory {
  directory: string;
  count: number;
  total_bytes: number;
  percentage: number;
}

export interface StorageReport {
  scan_id: string;
  total_files: number;
  total_size_bytes: number;
  by_extension: StorageByExtension[];
  by_directory: StorageByDirectory[];
  largest_files: FileRecord[];
}

export interface TemporalBucket {
  category: string;
  count: number;
  total_bytes: number;
  percentage: number;
}

export interface TemporalReport {
  scan_id: string;
  total_files: number;
  analyzed_at: string;
  buckets: TemporalBucket[];
  oldest_file?: FileRecord;
  newest_file?: FileRecord;
  most_recently_modified?: FileRecord;
  average_age_days: number;
  observed_facts_summary: string;
  ai_interpretation_note: string;
}

export interface GraphNodeData {
  id: string;
  label: string;
  file_path: string;
  extension: string;
  size_bytes: number;
  privacy_level: string;
  importance_score: number;
  in_degree: number;
  out_degree: number;
  pagerank: number;
  betweenness: number;
}

export interface GraphEdgeData {
  id: string;
  source: string;
  target: string;
  type: string;
  confidence: number;
  label: string;
}

export interface DependencyGraphResponse {
  scan_id: string;
  total_nodes: number;
  total_edges: number;
  nodes: { data: GraphNodeData }[];
  edges: { data: GraphEdgeData }[];
}

export interface ImportanceFactorItem {
  inbound_dependencies: number;
  in_degree_weight: number;
  pagerank_weight: number;
  betweenness_weight: number;
  privacy_boost: number;
  config_boost: number;
  duplicate_penalty: number;
  raw_score: number;
}

export interface ImportanceItem {
  file_id: string;
  file_path: string;
  file_name: string;
  importance_score: number;
  factors: ImportanceFactorItem;
  rank: number;
}

export interface ImportanceReport {
  scan_id: string;
  total_files: number;
  scored_files: ImportanceItem[];
}

export interface LifecycleRecommendation {
  id: string;
  file_id: string;
  file_path: string;
  file_name: string;
  action: 'retain' | 'archive' | 'review' | 'monitor';
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  explanation: string;
  contributing_factors: string; // JSON
  evidence_summary: string;     // JSON
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'archived';
  created_at: string;
}

export interface ArchiveRecord {
  id: string;
  file_id: string;
  original_path: string;
  archive_path: string;
  file_size_bytes: number;
  sha256_hash?: string;
  status: 'archived' | 'restored' | 'failed';
  archived_at: string;
  restored_at?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  details: string; // JSON
  user: string;
}

export interface AskResponse {
  question: string;
  answer: string;
  confidence: number;
  sources: string[];
  suggestions: string[];
}

export interface AppSettings {
  analysis_mode: string;
  content_analysis_opt_in: boolean;
  ollama_enabled: boolean;
  ollama_model: string;
  max_file_size_mb: number;
  max_scan_files: number;
  scan_timeout_seconds: number;
}
