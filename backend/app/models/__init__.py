"""
Chronova Database Models
========================
SQLAlchemy ORM models for all Chronova entities.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    Index,
)
from sqlalchemy.orm import relationship

from app.db import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _new_id() -> str:
    return str(uuid.uuid4())


# ── Workspace ──────────────────────────────────────────────────────────

class Workspace(Base):
    __tablename__ = "workspaces"

    id = Column(String, primary_key=True, default=_new_id)
    name = Column(String(255), nullable=False)
    root_path = Column(String(1024), nullable=False, unique=True)
    description = Column(Text, default="")
    analysis_mode = Column(String(32), default="metadata")  # metadata | structural | content-aware
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=_utcnow)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    scans = relationship("ScanRecord", back_populates="workspace", cascade="all, delete-orphan")


# ── Scan Record ────────────────────────────────────────────────────────

class ScanRecord(Base):
    __tablename__ = "scan_records"

    id = Column(String, primary_key=True, default=_new_id)
    workspace_id = Column(String, ForeignKey("workspaces.id"), nullable=False)
    scan_path = Column(String(1024), nullable=False)
    status = Column(String(32), default="pending")  # pending | running | completed | failed
    total_files = Column(Integer, default=0)
    total_directories = Column(Integer, default=0)
    total_size_bytes = Column(Integer, default=0)
    files_scanned = Column(Integer, default=0)
    errors_count = Column(Integer, default=0)
    error_details = Column(Text, default="")
    started_at = Column(DateTime, default=_utcnow)
    completed_at = Column(DateTime, nullable=True)

    workspace = relationship("Workspace", back_populates="scans")
    files = relationship("FileRecord", back_populates="scan", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_scan_workspace", "workspace_id"),
    )


# ── File Record ────────────────────────────────────────────────────────

class FileRecord(Base):
    __tablename__ = "file_records"

    id = Column(String, primary_key=True, default=_new_id)
    scan_id = Column(String, ForeignKey("scan_records.id"), nullable=False)
    file_path = Column(String(1024), nullable=False)
    file_name = Column(String(255), nullable=False)
    extension = Column(String(32), default="")
    size_bytes = Column(Integer, default=0)
    mime_type = Column(String(128), default="")
    sha256_hash = Column(String(64), nullable=True)

    # Timestamps from file system
    created_time = Column(DateTime, nullable=True)
    modified_time = Column(DateTime, nullable=True)
    accessed_time = Column(DateTime, nullable=True)

    # Analysis results
    is_duplicate = Column(Boolean, default=False)
    duplicate_group_id = Column(String, nullable=True)
    privacy_level = Column(String(32), default="unknown")  # public | internal | confidential | restricted | unknown
    importance_score = Column(Float, nullable=True)

    # Metadata
    is_hidden = Column(Boolean, default=False)
    is_system = Column(Boolean, default=False)
    is_readonly = Column(Boolean, default=False)
    parent_directory = Column(String(1024), default="")

    scan = relationship("ScanRecord", back_populates="files")

    __table_args__ = (
        Index("ix_file_scan", "scan_id"),
        Index("ix_file_hash", "sha256_hash"),
        Index("ix_file_path", "file_path"),
        Index("ix_file_extension", "extension"),
    )


# ── Dependency ─────────────────────────────────────────────────────────

class Dependency(Base):
    __tablename__ = "dependencies"

    id = Column(String, primary_key=True, default=_new_id)
    scan_id = Column(String, ForeignKey("scan_records.id"), nullable=False)
    source_file_id = Column(String, ForeignKey("file_records.id"), nullable=False)
    target_file_id = Column(String, ForeignKey("file_records.id"), nullable=False)
    relationship_type = Column(String(64), nullable=False)
    # e.g.: imports, includes, references, parent-child, config-for, companion, duplicate-of
    confidence = Column(Float, default=0.5)
    evidence = Column(Text, default="")  # JSON string describing how the dependency was detected
    detected_at = Column(DateTime, default=_utcnow)

    source_file = relationship("FileRecord", foreign_keys=[source_file_id])
    target_file = relationship("FileRecord", foreign_keys=[target_file_id])

    __table_args__ = (
        Index("ix_dep_source", "source_file_id"),
        Index("ix_dep_target", "target_file_id"),
        Index("ix_dep_scan", "scan_id"),
    )


# ── Lifecycle Recommendation ──────────────────────────────────────────

class LifecycleRecommendation(Base):
    __tablename__ = "lifecycle_recommendations"

    id = Column(String, primary_key=True, default=_new_id)
    file_id = Column(String, ForeignKey("file_records.id"), nullable=False)
    scan_id = Column(String, ForeignKey("scan_records.id"), nullable=False)
    action = Column(String(32), nullable=False)  # retain | archive | review | monitor
    risk_level = Column(String(16), default="low")  # low | medium | high | critical
    confidence = Column(Float, default=0.5)
    explanation = Column(Text, default="")  # Human-readable explanation
    contributing_factors = Column(Text, default="")  # JSON: list of factor objects
    evidence_summary = Column(Text, default="")  # JSON: evidence details

    # Approval workflow
    status = Column(String(32), default="pending")  # pending | approved | rejected | expired
    approved_by = Column(String(128), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    rejection_reason = Column(Text, nullable=True)

    created_at = Column(DateTime, default=_utcnow)
    expires_at = Column(DateTime, nullable=True)

    file = relationship("FileRecord", foreign_keys=[file_id])

    __table_args__ = (
        Index("ix_rec_file", "file_id"),
        Index("ix_rec_status", "status"),
        Index("ix_rec_scan", "scan_id"),
    )


# ── Archive Record ────────────────────────────────────────────────────

class ArchiveRecord(Base):
    __tablename__ = "archive_records"

    id = Column(String, primary_key=True, default=_new_id)
    file_id = Column(String, ForeignKey("file_records.id"), nullable=False)
    recommendation_id = Column(String, ForeignKey("lifecycle_recommendations.id"), nullable=True)
    original_path = Column(String(1024), nullable=False)
    archive_path = Column(String(1024), nullable=False)
    file_size_bytes = Column(Integer, default=0)
    sha256_hash = Column(String(64), nullable=True)
    status = Column(String(32), default="archived")  # archived | restored | failed
    archived_at = Column(DateTime, default=_utcnow)
    restored_at = Column(DateTime, nullable=True)
    archived_by = Column(String(128), default="system")

    file = relationship("FileRecord", foreign_keys=[file_id])

    __table_args__ = (
        Index("ix_archive_file", "file_id"),
        Index("ix_archive_status", "status"),
    )


# ── Audit Log ─────────────────────────────────────────────────────────

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, default=_new_id)
    timestamp = Column(DateTime, default=_utcnow, index=True)
    action = Column(String(64), nullable=False)
    # e.g.: scan_started, scan_completed, file_archived, file_restored,
    #        recommendation_approved, recommendation_rejected, settings_changed
    entity_type = Column(String(64), nullable=True)  # workspace | scan | file | recommendation | archive
    entity_id = Column(String, nullable=True)
    details = Column(Text, default="")  # JSON with action-specific details
    user = Column(String(128), default="system")
    ip_address = Column(String(45), nullable=True)

    __table_args__ = (
        Index("ix_audit_action", "action"),
        Index("ix_audit_entity", "entity_type", "entity_id"),
    )


# ── Privacy Setting ───────────────────────────────────────────────────

class PrivacySetting(Base):
    __tablename__ = "privacy_settings"

    id = Column(String, primary_key=True, default=_new_id)
    workspace_id = Column(String, ForeignKey("workspaces.id"), nullable=True)
    setting_key = Column(String(128), nullable=False)
    setting_value = Column(Text, default="")
    description = Column(Text, default="")
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow)

    __table_args__ = (
        Index("ix_privacy_key", "setting_key"),
    )
