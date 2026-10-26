"""
Chronova Duplicate Detection Service — Module 3
================================================
Calculates SHA-256 cryptographic hashes for files, discovers duplicate content,
associates duplicate groups, and computes recoverable storage savings.
"""

import hashlib
from pathlib import Path
from typing import Optional
from collections import defaultdict

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.models import FileRecord, ScanRecord
from app.schemas import DuplicateReport, DuplicateGroup, FileResponse
from app.services.audit_service import AuditService


class DuplicateDetectorService:
    """Service for cryptographic duplicate detection using SHA-256."""

    CHUNK_SIZE = 65536  # 64 KB

    @classmethod
    def calculate_sha256(cls, file_path: str | Path) -> Optional[str]:
        """Compute SHA-256 hash in chunked streaming mode to preserve memory."""
        path = Path(file_path)
        if not path.is_file():
            return None
        hasher = hashlib.sha256()
        try:
            with open(path, "rb") as f:
                while chunk := f.read(cls.CHUNK_SIZE):
                    hasher.update(chunk)
            return hasher.hexdigest()
        except (PermissionError, OSError):
            return None

    @classmethod
    async def detect_duplicates_for_scan(
        cls,
        session: AsyncSession,
        scan_id: str,
    ) -> DuplicateReport:
        """
        Process all files in a scan, calculate missing SHA-256 hashes,
        detect duplicates, update records, and generate report.
        """
        result = await session.execute(
            select(FileRecord).where(FileRecord.scan_id == scan_id)
        )
        files = list(result.scalars().all())

        # Calculate hashes where missing
        for f in files:
            if not f.sha256_hash:
                h = cls.calculate_sha256(f.file_path)
                if h:
                    f.sha256_hash = h

        # Group by hash (ignoring None or empty hash)
        hash_map: dict[str, list[FileRecord]] = defaultdict(list)
        for f in files:
            if f.sha256_hash and f.size_bytes > 0:
                hash_map[f.sha256_hash].append(f)

        duplicate_groups: list[DuplicateGroup] = []
        total_dup_files = 0
        total_wasted_bytes = 0

        for h, group_files in hash_map.items():
            if len(group_files) > 1:
                group_id = f"dup_{h[:12]}"
                file_size = group_files[0].size_bytes
                count = len(group_files)
                wasted = (count - 1) * file_size

                for gf in group_files:
                    gf.is_duplicate = True
                    gf.duplicate_group_id = group_id

                duplicate_groups.append(
                    DuplicateGroup(
                        group_id=group_id,
                        sha256_hash=h,
                        file_size=file_size,
                        count=count,
                        files=[FileResponse.model_validate(gf) for gf in group_files],
                        wasted_bytes=wasted,
                    )
                )
                total_dup_files += count
                total_wasted_bytes += wasted

        await session.flush()

        await AuditService.log(
            session,
            action="duplicate_detection_completed",
            entity_type="scan",
            entity_id=scan_id,
            details={
                "duplicate_groups_count": len(duplicate_groups),
                "total_duplicate_files": total_dup_files,
                "total_wasted_bytes": total_wasted_bytes,
            },
        )

        return DuplicateReport(
            scan_id=scan_id,
            total_duplicate_groups=len(duplicate_groups),
            total_duplicate_files=total_dup_files,
            total_wasted_bytes=total_wasted_bytes,
            groups=duplicate_groups,
        )
