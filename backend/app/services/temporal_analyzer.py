"""
Chronova Temporal Analyzer Service — Module 5
=============================================
Analyzes file timestamps (creation, modification, access), groups into
temporal activity tiers, and ensures that file age alone is never treated
as evidence of obsolescence or unimportance.
"""

from datetime import datetime, timezone, timedelta
from typing import Optional
from collections import defaultdict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models import FileRecord
from app.schemas import TemporalReport, TemporalBucket, FileResponse


class TemporalAnalyzerService:
    """Service for file activity analysis and temporal distribution."""

    @classmethod
    async def analyze_scan_temporal(
        cls,
        session: AsyncSession,
        scan_id: str,
    ) -> TemporalReport:
        """
        Analyze temporal distribution of files in a scan.
        Distinguishes observed file system facts from estimated lifecycle heuristics.
        """
        result = await session.execute(
            select(FileRecord).where(FileRecord.scan_id == scan_id)
        )
        files = list(result.scalars().all())

        now = datetime.now(timezone.utc)
        total_files = len(files)

        bucket_defs = [
            ("< 7 days", 0, 7),
            ("7-30 days", 7, 30),
            ("30-90 days", 30, 90),
            ("90-365 days", 90, 365),
            ("> 1 year", 365, 99999),
        ]

        bucket_counts = {name: 0 for name, _, _ in bucket_defs}
        bucket_sizes = {name: 0 for name, _, _ in bucket_defs}

        oldest_file: Optional[FileRecord] = None
        newest_file: Optional[FileRecord] = None
        most_recent_mod: Optional[FileRecord] = None

        total_age_days = 0.0

        def _ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
            """Ensure a datetime is timezone-aware (UTC)."""
            if dt is None:
                return None
            return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt

        for f in files:
            # Use mtime as primary activity indicator, or created_time if mtime is None
            ref_time = f.modified_time or f.created_time or now
            if ref_time.tzinfo is None:
                ref_time = ref_time.replace(tzinfo=timezone.utc)

            age = max(0.0, (now - ref_time).total_seconds() / 86400.0)
            total_age_days += age

            # Assign to bucket
            assigned = False
            for name, min_d, max_d in bucket_defs:
                if min_d <= age < max_d:
                    bucket_counts[name] += 1
                    bucket_sizes[name] += f.size_bytes
                    assigned = True
                    break
            if not assigned:
                bucket_counts["> 1 year"] += 1
                bucket_sizes["> 1 year"] += f.size_bytes

            # Check extrema (oldest, newest by created_time; most recent by modified_time)
            if f.created_time:
                c_time = _ensure_utc(f.created_time)
                oldest_c = _ensure_utc(oldest_file.created_time) if oldest_file else None
                newest_c = _ensure_utc(newest_file.created_time) if newest_file else None
                if oldest_file is None or (oldest_c is not None and c_time < oldest_c):
                    oldest_file = f
                if newest_file is None or (newest_c is not None and c_time > newest_c):
                    newest_file = f

            if f.modified_time:
                m_time = _ensure_utc(f.modified_time)
                recent_m = _ensure_utc(most_recent_mod.modified_time) if most_recent_mod else None
                if most_recent_mod is None or (recent_m is not None and m_time > recent_m):
                    most_recent_mod = f

        buckets = [
            TemporalBucket(
                category=name,
                count=bucket_counts[name],
                total_bytes=bucket_sizes[name],
                percentage=round((bucket_counts[name] / total_files * 100), 2) if total_files > 0 else 0.0,
            )
            for name, _, _ in bucket_defs
        ]

        avg_age = round(total_age_days / total_files, 1) if total_files > 0 else 0.0

        return TemporalReport(
            scan_id=scan_id,
            total_files=total_files,
            analyzed_at=now,
            buckets=buckets,
            oldest_file=FileResponse.model_validate(oldest_file) if oldest_file else None,
            newest_file=FileResponse.model_validate(newest_file) if newest_file else None,
            most_recently_modified=FileResponse.model_validate(most_recent_mod) if most_recent_mod else None,
            average_age_days=avg_age,
            observed_facts_summary=(
                f"Observed {total_files} files with average modification age of {avg_age} days. "
                f"{bucket_counts.get('< 7 days', 0)} files modified within the past week."
            ),
            ai_interpretation_note=(
                "Chronova Core Directive: File age alone does NOT determine importance. "
                "Even dormant files are protected if they possess inbound graph dependencies, "
                "configuration authority, or restricted privacy classification."
            ),
        )
