"""
Chronova Safe File Archiving Service — Module 16
================================================
Performs reversible, cryptographic checksum-verified file archiving.
Never permanently deletes files; preserves complete metadata and contents.
"""

import os
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models import FileRecord, LifecycleRecommendation, ArchiveRecord
from app.core import settings
from app.core.security import PathValidator
from app.services.duplicate_detector import DuplicateDetectorService
from app.services.audit_service import AuditService


class ArchiveService:
    """Service for safe, checksummed file archiving."""

    @classmethod
    async def archive_file(
        cls,
        session: AsyncSession,
        file_id: str,
        recommendation_id: Optional[str] = None,
        user: str = "system",
    ) -> ArchiveRecord:
        """Archive a file to the secure Chronova archive store."""
        f_res = await session.execute(
            select(FileRecord).where(FileRecord.id == file_id)
        )
        file_rec = f_res.scalar_one_or_none()
        if not file_rec:
            raise ValueError(f"File record not found: {file_id}")

        source_path = Path(file_rec.file_path).resolve()
        if not source_path.exists():
            raise FileNotFoundError(f"Source file does not exist on disk: {source_path}")

        # Compute source checksum
        src_hash = DuplicateDetectorService.calculate_sha256(source_path)

        # Prepare archive destination
        now = datetime.now(timezone.utc)
        subfolder = now.strftime("%Y%m%d_%H%M%S")
        dest_dir = settings.archive_dir / subfolder
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest_path = dest_dir / source_path.name

        # Ensure no clash
        counter = 1
        while dest_path.exists():
            dest_path = dest_dir / f"{source_path.stem}_{counter}{source_path.suffix}"
            counter += 1

        # Copy and verify
        shutil.copy2(source_path, dest_path)
        dest_hash = DuplicateDetectorService.calculate_sha256(dest_path)
        if src_hash != dest_hash:
            dest_path.unlink(missing_ok=True)
            raise IOError("SHA-256 verification failed during archival transfer!")

        # Remove original safely (handling Windows read-only flags)
        try:
            source_path.unlink()
        except PermissionError:
            import stat
            os.chmod(source_path, stat.S_IWRITE)
            source_path.unlink()

        # Update recommendation status if associated
        if recommendation_id:
            rec_res = await session.execute(
                select(LifecycleRecommendation).where(LifecycleRecommendation.id == recommendation_id)
            )
            rec_obj = rec_res.scalar_one_or_none()
            if rec_obj:
                rec_obj.status = "archived"
        else:
            rec_res = await session.execute(
                select(LifecycleRecommendation).where(LifecycleRecommendation.file_id == file_rec.id)
            )
            rec_obj = rec_res.scalar_one_or_none()
            if rec_obj:
                rec_obj.status = "archived"

        # Create ArchiveRecord
        arc = ArchiveRecord(
            file_id=file_rec.id,
            recommendation_id=recommendation_id,
            original_path=str(source_path),
            archive_path=str(dest_path),
            file_size_bytes=file_rec.size_bytes,
            sha256_hash=dest_hash,
            status="archived",
            archived_at=now,
            archived_by=user,
        )
        session.add(arc)
        await session.flush()

        await AuditService.log(
            session,
            action="file_archived",
            entity_type="archive",
            entity_id=arc.id,
            details={
                "file_name": source_path.name,
                "original_path": str(source_path),
                "archive_path": str(dest_path),
                "size_bytes": file_rec.size_bytes,
                "sha256": dest_hash,
            },
            user=user,
        )

        return arc
