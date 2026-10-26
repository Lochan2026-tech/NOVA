"""
Chronova API Routes
===================
All FastAPI REST API route definitions for file lifecycle management,
graph analysis, privacy classification, explainable recommendations,
safe archival, restoration, and audit logging.
"""

from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload

from app.db import get_session
from app.models import (
    Workspace, ScanRecord, FileRecord, Dependency,
    LifecycleRecommendation, ArchiveRecord, AuditLog, PrivacySetting,
)
from app.schemas import (
    HealthResponse, MessageResponse, ErrorResponse,
    WorkspaceCreate, WorkspaceResponse, WorkspaceListResponse,
    ScanRequest, ScanResponse, ScanListResponse,
    FileResponse, FileListResponse,
    DuplicateReport, StorageReport, TemporalReport,
    DependencyResponse, DependencyGraphResponse,
    ImportanceReport, RecommendationResponse, RecommendationListResponse,
    ApprovalRequest, ApprovalResponse,
    ArchiveCreate, ArchiveResponse, ArchiveListResponse,
    RestoreRequest, RestoreResponse,
    AuditLogResponse, AuditLogListResponse,
    AskChronovaRequest, AskChronovaResponse,
    SettingsResponse, SettingsUpdate,
)
from app.core import settings
from app.core.security import SecurityError
from app.services.audit_service import AuditService
from app.services.file_scanner import FileScannerService
from app.services.duplicate_detector import DuplicateDetectorService
from app.services.storage_analyzer import StorageAnalyzerService
from app.services.temporal_analyzer import TemporalAnalyzerService
from app.services.privacy_engine import PrivacyEngineService
from app.services.dependency_detector import DependencyDetectorService
from app.services.graph_service import GraphService
from app.services.importance_scorer import ImportanceScorerService
from app.services.lifecycle_engine import LifecycleEngineService
from app.services.approval_service import ApprovalService
from app.services.archive_service import ArchiveService
from app.services.restore_service import RestoreService
from app.services.ask_chronova import AskChronovaService

router = APIRouter()


# ── Health ─────────────────────────────────────────────────────────────

@router.get("/health", response_model=HealthResponse, tags=["System"])
async def health_check(session: AsyncSession = Depends(get_session)):
    """Check system health, database connectivity, and loaded modules."""
    db_status = "connected"
    try:
        await session.execute(select(func.count()).select_from(Workspace.__table__))
    except Exception:
        db_status = "disconnected"

    modules = [
        "file_scanner",
        "duplicate_detector",
        "storage_analyzer",
        "temporal_analyzer",
        "privacy_engine",
        "dependency_detector",
        "graph_service",
        "importance_scorer",
        "lifecycle_engine",
        "risk_assessor",
        "explainability_engine",
        "approval_service",
        "archive_service",
        "restore_service",
        "ask_chronova",
        "audit_logger",
    ]

    return HealthResponse(
        status="ok",
        app_name=settings.app_name,
        version=settings.app_version,
        timestamp=datetime.now(timezone.utc),
        database=db_status,
        modules_loaded=modules,
    )


# ── Workspaces ─────────────────────────────────────────────────────────

@router.post("/workspaces", response_model=WorkspaceResponse, tags=["Workspaces"])
async def create_workspace(
    data: WorkspaceCreate,
    session: AsyncSession = Depends(get_session),
):
    """Create a new workspace for file lifecycle analysis."""
    root = Path(data.root_path).resolve()
    if not root.exists():
        raise HTTPException(status_code=400, detail=f"Path does not exist: {root}")
    if not root.is_dir():
        raise HTTPException(status_code=400, detail=f"Path is not a directory: {root}")

    # Check for duplicate path
    existing = await session.execute(
        select(Workspace).where(Workspace.root_path == str(root))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Workspace with this path already exists")

    workspace = Workspace(
        name=data.name,
        root_path=str(root),
        description=data.description,
        analysis_mode=data.analysis_mode,
    )
    session.add(workspace)
    await session.flush()

    await AuditService.log(
        session, "workspace_created",
        entity_type="workspace", entity_id=workspace.id,
        details={"name": data.name, "root_path": str(root)},
    )

    return workspace


@router.get("/workspaces", response_model=WorkspaceListResponse, tags=["Workspaces"])
async def list_workspaces(session: AsyncSession = Depends(get_session)):
    """List all configured workspaces."""
    result = await session.execute(
        select(Workspace).order_by(Workspace.created_at.desc())
    )
    workspaces = list(result.scalars().all())
    return WorkspaceListResponse(workspaces=workspaces, total=len(workspaces))


@router.get("/workspaces/{workspace_id}", response_model=WorkspaceResponse, tags=["Workspaces"])
async def get_workspace(workspace_id: str, session: AsyncSession = Depends(get_session)):
    """Get workspace details by ID."""
    result = await session.execute(
        select(Workspace).where(Workspace.id == workspace_id)
    )
    workspace = result.scalar_one_or_none()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return workspace


@router.delete("/workspaces/{workspace_id}", response_model=MessageResponse, tags=["Workspaces"])
async def delete_workspace(workspace_id: str, session: AsyncSession = Depends(get_session)):
    """Delete a workspace and cascade delete its records."""
    result = await session.execute(
        select(Workspace).where(Workspace.id == workspace_id)
    )
    workspace = result.scalar_one_or_none()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    await AuditService.log(
        session, "workspace_deleted",
        entity_type="workspace", entity_id=workspace_id,
        details={"name": workspace.name},
    )

    await session.delete(workspace)
    return MessageResponse(message="Workspace deleted successfully")


# ── Scans & Full Pipeline ──────────────────────────────────────────────

@router.post("/scans", response_model=ScanResponse, tags=["Scans"])
async def create_and_run_scan(
    data: ScanRequest,
    session: AsyncSession = Depends(get_session),
):
    """
    Execute full Chronova scanning and analysis pipeline:
    Scan -> Duplicates -> Privacy -> Dependencies -> Graph -> Importance -> Recommendations.
    """
    ws_res = await session.execute(
        select(Workspace).where(Workspace.id == data.workspace_id)
    )
    workspace = ws_res.scalar_one_or_none()
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")

    # 1. Run filesystem scanner
    try:
        scan = await FileScannerService.scan_workspace(
            session, workspace, custom_path=data.scan_path
        )
    except (ValueError, SecurityError) as e:
        raise HTTPException(status_code=400, detail=str(e))

    # 2. Run duplicate detection
    await DuplicateDetectorService.detect_duplicates_for_scan(session, scan.id)

    # 3. Run privacy classification
    await PrivacyEngineService.classify_scan_files(
        session,
        scan.id,
        mode=workspace.analysis_mode,
        opt_in_content=settings.content_analysis_opt_in,
    )

    # 4. Discover file relationships & dependencies
    await DependencyDetectorService.detect_dependencies_for_scan(session, scan.id)

    # 5. Compute graph-based importance scores
    await ImportanceScorerService.compute_importance_scores(session, scan.id)

    # 6. Generate explainable lifecycle recommendations
    await LifecycleEngineService.generate_recommendations(session, scan.id)

    return scan


@router.get("/scans", response_model=ScanListResponse, tags=["Scans"])
async def list_scans(
    workspace_id: Optional[str] = Query(None),
    session: AsyncSession = Depends(get_session),
):
    """List historical scan executions."""
    query = select(ScanRecord).order_by(ScanRecord.started_at.desc())
    if workspace_id:
        query = query.where(ScanRecord.workspace_id == workspace_id)
    result = await session.execute(query)
    scans = list(result.scalars().all())
    return ScanListResponse(scans=scans, total=len(scans))


@router.get("/scans/{scan_id}", response_model=ScanResponse, tags=["Scans"])
async def get_scan(scan_id: str, session: AsyncSession = Depends(get_session)):
    """Get scan status and metrics by ID."""
    result = await session.execute(
        select(ScanRecord).where(ScanRecord.id == scan_id)
    )
    scan = result.scalar_one_or_none()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    return scan


# ── Files ──────────────────────────────────────────────────────────────

@router.get("/files", response_model=FileListResponse, tags=["Files"])
async def list_files(
    scan_id: Optional[str] = Query(None),
    extension: Optional[str] = Query(None),
    privacy_level: Optional[str] = Query(None),
    is_duplicate: Optional[bool] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_session),
):
    """List scanned file records with filtering and pagination."""
    query = select(FileRecord)
    if scan_id:
        query = query.where(FileRecord.scan_id == scan_id)
    if extension:
        query = query.where(FileRecord.extension == extension)
    if privacy_level:
        query = query.where(FileRecord.privacy_level == privacy_level)
    if is_duplicate is not None:
        query = query.where(FileRecord.is_duplicate == is_duplicate)

    count_query = select(func.count()).select_from(query.subquery())
    total_result = await session.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(FileRecord.file_path).offset(offset).limit(limit)
    result = await session.execute(query)
    files = list(result.scalars().all())

    return FileListResponse(files=files, total=total)


@router.get("/files/{file_id}", response_model=FileResponse, tags=["Files"])
async def get_file(file_id: str, session: AsyncSession = Depends(get_session)):
    """Get specific file metadata and score by ID."""
    result = await session.execute(
        select(FileRecord).where(FileRecord.id == file_id)
    )
    file = result.scalar_one_or_none()
    if not file:
        raise HTTPException(status_code=404, detail="File not found")
    return file


# ── Duplicate Detection ────────────────────────────────────────────────

@router.get("/scans/{scan_id}/duplicates", response_model=DuplicateReport, tags=["Duplicates"])
async def get_duplicates_report(scan_id: str, session: AsyncSession = Depends(get_session)):
    """Retrieve SHA-256 duplicate report for a scan."""
    return await DuplicateDetectorService.detect_duplicates_for_scan(session, scan_id)


# ── Storage Analysis ───────────────────────────────────────────────────

@router.get("/scans/{scan_id}/storage", response_model=StorageReport, tags=["Storage"])
async def get_storage_report(scan_id: str, session: AsyncSession = Depends(get_session)):
    """Get storage breakdown by extension, directory, and top files."""
    return await StorageAnalyzerService.analyze_scan_storage(session, scan_id)


# ── Temporal Analysis ──────────────────────────────────────────────────

@router.get("/scans/{scan_id}/temporal", response_model=TemporalReport, tags=["Temporal"])
async def get_temporal_report(scan_id: str, session: AsyncSession = Depends(get_session)):
    """Get temporal distribution distinguishing facts from heuristics."""
    return await TemporalAnalyzerService.analyze_scan_temporal(session, scan_id)


# ── Dependency Graph ───────────────────────────────────────────────────

@router.get("/scans/{scan_id}/graph", response_model=DependencyGraphResponse, tags=["Graph"])
async def get_dependency_graph(scan_id: str, session: AsyncSession = Depends(get_session)):
    """Get Cytoscape.js compatible graph with node metrics and edges."""
    return await GraphService.get_cytoscape_graph(session, scan_id)


# ── Importance Scoring ─────────────────────────────────────────────────

@router.get("/scans/{scan_id}/importance", response_model=ImportanceReport, tags=["Importance"])
async def get_importance_report(scan_id: str, session: AsyncSession = Depends(get_session)):
    """Get ranked file importance scores and topological weights."""
    return await ImportanceScorerService.compute_importance_scores(session, scan_id)


# ── Lifecycle Recommendations ──────────────────────────────────────────

@router.get("/scans/{scan_id}/recommendations", response_model=RecommendationListResponse, tags=["Recommendations"])
async def list_recommendations(
    scan_id: str,
    status: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    session: AsyncSession = Depends(get_session),
):
    """List explainable recommendations for files in a scan."""
    query = (
        select(LifecycleRecommendation)
        .options(selectinload(LifecycleRecommendation.file))
        .where(LifecycleRecommendation.scan_id == scan_id)
    )
    if status:
        query = query.where(LifecycleRecommendation.status == status)
    if action:
        query = query.where(LifecycleRecommendation.action == action)

    result = await session.execute(query.order_by(LifecycleRecommendation.created_at.desc()))
    recs = list(result.scalars().all())

    response_items = []
    for r in recs:
        f_name = r.file.file_name if r.file else "unknown"
        f_path = r.file.file_path if r.file else "unknown"
        response_items.append(
            RecommendationResponse(
                id=r.id,
                file_id=r.file_id,
                file_path=f_path,
                file_name=f_name,
                action=r.action,
                risk_level=r.risk_level,
                confidence=r.confidence,
                explanation=r.explanation,
                contributing_factors=r.contributing_factors,
                evidence_summary=r.evidence_summary,
                status=r.status,
                created_at=r.created_at,
            )
        )

    return RecommendationListResponse(recommendations=response_items, total=len(response_items))


@router.post("/recommendations/approve", response_model=ApprovalResponse, tags=["Recommendations"])
async def approve_recommendation(
    req: ApprovalRequest,
    session: AsyncSession = Depends(get_session),
):
    """Explicit user approval or rejection of a lifecycle action."""
    try:
        return await ApprovalService.process_approval(session, req)
    except ValueError as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail=str(e))
        raise HTTPException(status_code=400, detail=str(e))


# ── Archiving ──────────────────────────────────────────────────────────

@router.post("/archives", response_model=ArchiveResponse, tags=["Archives"])
async def archive_file(
    data: ArchiveCreate,
    session: AsyncSession = Depends(get_session),
):
    """Safely archive a file with SHA-256 verification."""
    try:
        arc = await ArchiveService.archive_file(
            session=session,
            file_id=data.file_id,
            recommendation_id=data.recommendation_id,
            user=data.user,
        )
        return arc
    except (ValueError, FileNotFoundError) as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Archival failed: {str(e)}")


@router.get("/archives", response_model=ArchiveListResponse, tags=["Archives"])
async def list_archives(session: AsyncSession = Depends(get_session)):
    """List all archived files."""
    result = await session.execute(
        select(ArchiveRecord).order_by(ArchiveRecord.archived_at.desc())
    )
    archives = list(result.scalars().all())
    return ArchiveListResponse(archives=archives, total=len(archives))


@router.post("/archives/restore", response_model=RestoreResponse, tags=["Archives"])
async def restore_file(
    req: RestoreRequest,
    session: AsyncSession = Depends(get_session),
):
    """Restore an archived file with overwrite protection and integrity verification."""
    try:
        arc = await RestoreService.restore_file(
            session=session,
            archive_id=req.archive_id,
            custom_restore_path=req.restore_path,
        )
        return RestoreResponse(
            archive_id=arc.id,
            restored_path=req.restore_path or arc.original_path,
            status=arc.status,
            message="File successfully restored and integrity verified.",
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/archives/{archive_id}/undo", response_model=RestoreResponse, tags=["Archives"])
async def undo_archive(
    archive_id: str,
    session: AsyncSession = Depends(get_session),
):
    """Undo archive operation (restores file to original location)."""
    return await restore_file(RestoreRequest(archive_id=archive_id), session=session)


# ── Ask Chronova & What-If ─────────────────────────────────────────────

@router.post("/ask", response_model=AskChronovaResponse, tags=["AI Assistance"])
async def ask_chronova(
    req: AskChronovaRequest,
    session: AsyncSession = Depends(get_session),
):
    """Ask natural language question or execute what-if simulation."""
    return await AskChronovaService.answer_query(session, req)


# ── Audit Logs ─────────────────────────────────────────────────────────

@router.get("/audit-logs", response_model=AuditLogListResponse, tags=["Audit"])
async def list_audit_logs(
    action: Optional[str] = Query(None),
    entity_type: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(get_session),
):
    """List audit events for operations traceability."""
    logs, total = await AuditService.get_logs(
        session, action=action, entity_type=entity_type,
        limit=limit, offset=offset,
    )
    return AuditLogListResponse(logs=logs, total=total)


# ── Settings ───────────────────────────────────────────────────────────

@router.get("/settings", response_model=SettingsResponse, tags=["Settings"])
async def get_settings():
    """Get application configuration."""
    return SettingsResponse(
        analysis_mode=settings.default_analysis_mode,
        content_analysis_opt_in=settings.content_analysis_opt_in,
        ollama_enabled=settings.ollama_enabled,
        ollama_model=settings.ollama_model,
        max_file_size_mb=settings.max_file_size_mb,
        max_scan_files=settings.max_scan_files,
        scan_timeout_seconds=settings.scan_timeout_seconds,
    )


@router.patch("/settings", response_model=SettingsResponse, tags=["Settings"])
async def update_settings(
    update: SettingsUpdate,
    session: AsyncSession = Depends(get_session),
):
    """Update application settings."""
    if update.analysis_mode is not None:
        settings.default_analysis_mode = update.analysis_mode
    if update.content_analysis_opt_in is not None:
        settings.content_analysis_opt_in = update.content_analysis_opt_in
    if update.ollama_enabled is not None:
        settings.ollama_enabled = update.ollama_enabled
    if update.ollama_model is not None:
        settings.ollama_model = update.ollama_model
    if update.max_file_size_mb is not None:
        settings.max_file_size_mb = update.max_file_size_mb
    if update.max_scan_files is not None:
        settings.max_scan_files = update.max_scan_files
    if update.scan_timeout_seconds is not None:
        settings.scan_timeout_seconds = update.scan_timeout_seconds

    await AuditService.log(
        session, "settings_updated",
        details=update.model_dump(exclude_unset=True),
    )

    return await get_settings()
