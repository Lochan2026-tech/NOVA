"""
Chronova Restore and Undo Service — Module 17
============================================
Enables full recovery and undo for archived files with integrity checks
and accidental overwrite prevention.
"""

import os
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models import ArchiveRecord, FileRecord, LifecycleRecommendation
from app.core.security import PathValidator, SecurityError
from app.services.duplicate_detector import DuplicateDetectorService
from app.services.audit_service import AuditService


class RestoreService:
    """Service for restoring archived files and undoing operations."""

    @classmethod
    async def restore_file(
        cls,
        session: AsyncSession,
        archive_id: str,
        custom_restore_path: Optional[str] = None,
        user: str = "system",
    ) -> ArchiveRecord:
        """Restore an archived file back to disk."""
        res = await session.execute(
            select(ArchiveRecord).where(ArchiveRecord.id == archive_id)
        )
        arc = res.scalar_one_or_none()
        if not arc:
            raise ValueError(f"Archive record not found: {archive_id}")

        if arc.status == "restored":
            raise ValueError("File is already restored")

        archived_file = Path(arc.archive_path).resolve()
        if not archived_file.exists():
            raise FileNotFoundError(f"Archived backup file missing: {archived_file}")

        target_path = Path(custom_restore_path or arc.original_path).resolve()

        # Prevent accidental overwrite
        PathValidator.prevent_overwrite(target_path)

        # Ensure target parent directory exists
        target_path.parent.mkdir(parents=True, exist_ok=True)

        # Restore file
        shutil.copy2(archived_file, target_path)

        # Verify integrity
        restored_hash = DuplicateDetectorService.calculate_sha256(target_path)
        if arc.sha256_hash and restored_hash != arc.sha256_hash:
            target_path.unlink(missing_ok=True)
            raise IOError("Integrity check failed: Restored file checksum does not match original archive!")

        # Remove archive copy safely (handling Windows read-only flags)
        try:
            archived_file.unlink(missing_ok=True)
        except PermissionError:
            import stat
            os.chmod(archived_file, stat.S_IWRITE)
            archived_file.unlink(missing_ok=True)

        # Update recommendation status back if applicable
        if arc.recommendation_id:
            rec_res = await session.execute(
                select(LifecycleRecommendation).where(LifecycleRecommendation.id == arc.recommendation_id)
            )
            rec_obj = rec_res.scalar_one_or_none()
            if rec_obj and rec_obj.status == "archived":
                rec_obj.status = "approved"
        else:
            rec_res = await session.execute(
                select(LifecycleRecommendation).where(LifecycleRecommendation.file_id == arc.file_id)
            )
            rec_obj = rec_res.scalar_one_or_none()
            if rec_obj and rec_obj.status == "archived":
                rec_obj.status = "approved"

        # Update record
        arc.status = "restored"
        arc.restored_at = datetime.now(timezone.utc)
        await session.flush()

        await AuditService.log(
            session,
            action="file_restored",
            entity_type="archive",
            entity_id=arc.id,
            details={
                "restored_path": str(target_path),
                "original_path": arc.original_path,
                "sha256": restored_hash,
            },
            user=user,
        )

        return arc
