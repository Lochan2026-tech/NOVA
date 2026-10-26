"""
Chronova Pydantic Schemas
=========================
Request/response schemas for the API layer.
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


# ── Health ─────────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str = "ok"
    app_name: str = "Chronova"
    version: str = "1.0.0"
    timestamp: datetime
    database: str = "connected"
    modules_loaded: list[str] = []


# ── Workspace ──────────────────────────────────────────────────────────

class WorkspaceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    root_path: str = Field(..., min_length=1)
    description: str = ""
    analysis_mode: str = Field(default="metadata", pattern="^(metadata|structural|content-aware)$")


class WorkspaceResponse(BaseModel):
    id: str
    name: str
    root_path: str
    description: str
    analysis_mode: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WorkspaceListResponse(BaseModel):
    workspaces: list[WorkspaceResponse]
    total: int


# ── Scan ───────────────────────────────────────────────────────────────

class ScanRequest(BaseModel):
    workspace_id: str
    scan_path: Optional[str] = None  # If None, uses workspace root_path


class ScanResponse(BaseModel):
    id: str
    workspace_id: str
    scan_path: str
    status: str
    total_files: int
    total_directories: int
    total_size_bytes: int
    files_scanned: int
    errors_count: int
    started_at: datetime
    completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ScanListResponse(BaseModel):
    scans: list[ScanResponse]
    total: int


# ── File ───────────────────────────────────────────────────────────────

class FileResponse(BaseModel):
    id: str
    scan_id: str
    file_path: str
    file_name: str
    extension: str
    size_bytes: int
    mime_type: str
    sha256_hash: Optional[str] = None
    created_time: Optional[datetime] = None
    modified_time: Optional[datetime] = None
    accessed_time: Optional[datetime] = None
    is_duplicate: bool
    duplicate_group_id: Optional[str] = None
    privacy_level: str
    importance_score: Optional[float] = None
    is_hidden: bool
    is_system: bool
    is_readonly: bool
    parent_directory: str

    model_config = {"from_attributes": True}


class FileListResponse(BaseModel):
    files: list[FileResponse]
    total: int


# ── Duplicate ──────────────────────────────────────────────────────────

class DuplicateGroup(BaseModel):
    group_id: str
    sha256_hash: str
    file_size: int
    count: int
    files: list[FileResponse]
    wasted_bytes: int


class DuplicateReport(BaseModel):
    scan_id: str
    total_duplicate_groups: int
    total_duplicate_files: int
    total_wasted_bytes: int
    groups: list[DuplicateGroup]


# ── Storage ────────────────────────────────────────────────────────────

class StorageByExtension(BaseModel):
    extension: str
    count: int
    total_bytes: int
    percentage: float


class StorageByDirectory(BaseModel):
    directory: str
    count: int
    total_bytes: int
    percentage: float


class StorageReport(BaseModel):
    scan_id: str
    total_files: int
    total_size_bytes: int
    by_extension: list[StorageByExtension]
    by_directory: list[StorageByDirectory]
    largest_files: list[FileResponse]


# ── Temporal ───────────────────────────────────────────────────────────

class TemporalBucket(BaseModel):
    category: str  # e.g., "< 7 days", "7-30 days", "30-90 days", "90-365 days", "> 1 year"
    count: int
    total_bytes: int
    percentage: float


class TemporalReport(BaseModel):
    scan_id: str
    total_files: int
    analyzed_at: datetime
    buckets: list[TemporalBucket]
    oldest_file: Optional[FileResponse] = None
    newest_file: Optional[FileResponse] = None
    most_recently_modified: Optional[FileResponse] = None
    average_age_days: float
    observed_facts_summary: str
    ai_interpretation_note: str


class DependencyResponse(BaseModel):
    id: str
    source_file_id: str
    target_file_id: str
    relationship_type: str
    confidence: float
    evidence: str
    detected_at: datetime

    model_config = {"from_attributes": True}


class DependencyGraphResponse(BaseModel):
    scan_id: str
    total_nodes: int
    total_edges: int
    nodes: list[dict]  # [{id, label, file_path, importance, ...}]
    edges: list[dict]  # [{source, target, type, confidence, ...}]


# ── Importance ─────────────────────────────────────────────────────────

class ImportanceResponse(BaseModel):
    file_id: str
    file_path: str
    file_name: str
    importance_score: float
    factors: dict  # Contributing factors with weights
    rank: int


class ImportanceReport(BaseModel):
    scan_id: str
    total_files: int
    scored_files: list[ImportanceResponse]


# ── Lifecycle Recommendation ──────────────────────────────────────────

class RecommendationResponse(BaseModel):
    id: str
    file_id: str
    file_path: str
    file_name: str
    action: str
    risk_level: str
    confidence: float
    explanation: str
    contributing_factors: str
    evidence_summary: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class RecommendationListResponse(BaseModel):
    recommendations: list[RecommendationResponse]
    total: int


class ApprovalRequest(BaseModel):
    recommendation_id: str
    action: str = Field(..., pattern="^(approve|reject)$")
    reason: Optional[str] = None
    approved_by: str = "user"


class ApprovalResponse(BaseModel):
    recommendation_id: str
    status: str
    message: str


# ── Archive ────────────────────────────────────────────────────────────

class ArchiveCreate(BaseModel):
    file_id: str
    recommendation_id: Optional[str] = None
    user: str = "user"


class ArchiveResponse(BaseModel):
    id: str
    file_id: str
    original_path: str
    archive_path: str
    file_size_bytes: int
    sha256_hash: Optional[str] = None
    status: str
    archived_at: datetime
    restored_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ArchiveListResponse(BaseModel):
    archives: list[ArchiveResponse]
    total: int


class RestoreRequest(BaseModel):
    archive_id: str
    restore_path: Optional[str] = None  # If None, restores to original path


class RestoreResponse(BaseModel):
    archive_id: str
    restored_path: str
    status: str
    message: str


# ── Audit Log ─────────────────────────────────────────────────────────

class AuditLogResponse(BaseModel):
    id: str
    timestamp: datetime
    action: str
    entity_type: Optional[str] = None
    entity_id: Optional[str] = None
    details: str
    user: str

    model_config = {"from_attributes": True}


class AuditLogListResponse(BaseModel):
    logs: list[AuditLogResponse]
    total: int


# ── Ask Chronova ──────────────────────────────────────────────────────

class AskChronovaRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    scan_id: Optional[str] = None
    context: Optional[dict] = None


class AskChronovaResponse(BaseModel):
    question: str
    answer: str
    confidence: float
    sources: list[str] = []
    suggestions: list[str] = []


# ── Settings ──────────────────────────────────────────────────────────

class SettingsResponse(BaseModel):
    analysis_mode: str
    content_analysis_opt_in: bool
    ollama_enabled: bool
    ollama_model: str
    max_file_size_mb: int
    max_scan_files: int
    scan_timeout_seconds: int


class SettingsUpdate(BaseModel):
    analysis_mode: Optional[str] = None
    content_analysis_opt_in: Optional[bool] = None
    ollama_enabled: Optional[bool] = None
    ollama_model: Optional[str] = None
    max_file_size_mb: Optional[int] = None
    max_scan_files: Optional[int] = None
    scan_timeout_seconds: Optional[int] = None


# ── Generic ───────────────────────────────────────────────────────────

class MessageResponse(BaseModel):
    message: str
    success: bool = True


class ErrorResponse(BaseModel):
    detail: str
    error_code: Optional[str] = None
