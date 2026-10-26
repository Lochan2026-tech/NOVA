"""
Chronova Storage Analyzer Service — Module 4
============================================
Analyzes disk space distribution by file extension, folder hierarchy,
and identifies the largest files in the scanned workspace.
"""

from collections import defaultdict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models import FileRecord
from app.schemas import (
    StorageReport,
    StorageByExtension,
    StorageByDirectory,
    FileResponse,
)


class StorageAnalyzerService:
    """Service for analyzing disk space usage patterns."""

    @classmethod
    async def analyze_scan_storage(
        cls,
        session: AsyncSession,
        scan_id: str,
        top_files_count: int = 15,
    ) -> StorageReport:
        """Calculate storage breakdown by extension, directory, and top files."""
        result = await session.execute(
            select(FileRecord).where(FileRecord.scan_id == scan_id)
        )
        files = list(result.scalars().all())

        total_files = len(files)
        total_size = sum(f.size_bytes for f in files)

        # Storage by extension
        ext_counts: dict[str, int] = defaultdict(int)
        ext_sizes: dict[str, int] = defaultdict(int)

        # Storage by parent directory
        dir_counts: dict[str, int] = defaultdict(int)
        dir_sizes: dict[str, int] = defaultdict(int)

        for f in files:
            ext = f.extension or "(none)"
            ext_counts[ext] += 1
            ext_sizes[ext] += f.size_bytes

            pdir = f.parent_directory or "root"
            dir_counts[pdir] += 1
            dir_sizes[pdir] += f.size_bytes

        # Convert to schema items
        by_ext = [
            StorageByExtension(
                extension=k,
                count=ext_counts[k],
                total_bytes=ext_sizes[k],
                percentage=round((ext_sizes[k] / total_size * 100), 2) if total_size > 0 else 0.0,
            )
            for k in sorted(ext_sizes.keys(), key=lambda x: ext_sizes[x], reverse=True)
        ]

        by_dir = [
            StorageByDirectory(
                directory=k,
                count=dir_counts[k],
                total_bytes=dir_sizes[k],
                percentage=round((dir_sizes[k] / total_size * 100), 2) if total_size > 0 else 0.0,
            )
            for k in sorted(dir_sizes.keys(), key=lambda x: dir_sizes[x], reverse=True)[:25]
        ]

        # Top largest files
        sorted_files = sorted(files, key=lambda f: f.size_bytes, reverse=True)
        largest_files = [
            FileResponse.model_validate(f)
            for f in sorted_files[:top_files_count]
        ]

        return StorageReport(
            scan_id=scan_id,
            total_files=total_files,
            total_size_bytes=total_size,
            by_extension=by_ext,
            by_directory=by_dir,
            largest_files=largest_files,
        )
