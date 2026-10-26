"""
Chronova File Scanner Service — Module 2
=========================================
Performs safe, recursive filesystem scanning, metadata extraction,
and records scan progress and results into the database.
"""

import os
import mimetypes
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from app.models import Workspace, ScanRecord, FileRecord
from app.core import settings
from app.core.security import PathValidator
from app.services.audit_service import AuditService


class FileScannerService:
    """Service for scanning filesystem directories and extracting metadata."""

    @staticmethod
    def _is_hidden(path: Path) -> bool:
        """Check if file or folder is hidden (Windows / Unix compatible)."""
        if path.name.startswith("."):
            return True
        try:
            if os.name == "nt":
                import ctypes
                attrs = ctypes.windll.kernel32.GetFileAttributesW(str(path))
                if attrs != -1 and (attrs & 2):  # FILE_ATTRIBUTE_HIDDEN = 2
                    return True
        except Exception:
            pass
        return False

    @staticmethod
    def _is_system(path: Path) -> bool:
        """Check if file has system attribute on Windows."""
        try:
            if os.name == "nt":
                import ctypes
                attrs = ctypes.windll.kernel32.GetFileAttributesW(str(path))
                if attrs != -1 and (attrs & 4):  # FILE_ATTRIBUTE_SYSTEM = 4
                    return True
        except Exception:
            pass
        return False

    @staticmethod
    def _is_readonly(path: Path) -> bool:
        """Check if file is read-only."""
        try:
            return not os.access(path, os.W_OK)
        except Exception:
            return False

    @classmethod
    async def scan_workspace(
        cls,
        session: AsyncSession,
        workspace: Workspace,
        custom_path: Optional[str] = None,
    ) -> ScanRecord:
        """
        Execute scan on workspace directory.
        Extracts metadata for all reachable files within authorized constraints.
        """
        target_dir = Path(custom_path or workspace.root_path).resolve()
        validator = PathValidator([Path(workspace.root_path)])
        validated_dir = validator.validate_path(target_dir)

        if not validated_dir.exists() or not validated_dir.is_dir():
            raise ValueError(f"Scan path is not a valid directory: {validated_dir}")

        # Create ScanRecord
        scan = ScanRecord(
            workspace_id=workspace.id,
            scan_path=str(validated_dir),
            status="running",
            started_at=datetime.now(timezone.utc),
        )
        session.add(scan)
        await session.flush()

        await AuditService.log(
            session,
            action="scan_started",
            entity_type="scan",
            entity_id=scan.id,
            details={"workspace_id": workspace.id, "scan_path": str(validated_dir)},
        )

        total_files = 0
        total_dirs = 0
        total_size = 0
        errors_count = 0
        error_details = []
        file_records: list[FileRecord] = []

        try:
            ignore_dirs = {".git", "node_modules", ".venv", "__pycache__", ".pytest_cache", "dist", ".vite", "build"}
            for root, dirs, files in os.walk(validated_dir):
                # Prune vendor, build and cache directories
                dirs[:] = [d for d in dirs if d not in ignore_dirs]
                total_dirs += len(dirs)

                for fname in files:
                    if total_files >= settings.max_scan_files:
                        break

                    file_path = Path(root) / fname
                    try:
                        stat = file_path.stat()
                        size = stat.st_size

                        # Extract MIME type
                        mime, _ = mimetypes.guess_type(str(file_path))
                        mime = mime or "application/octet-stream"

                        # Extract timestamps
                        ctime = datetime.fromtimestamp(stat.st_ctime, tz=timezone.utc)
                        mtime = datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc)
                        atime = datetime.fromtimestamp(stat.st_atime, tz=timezone.utc)

                        ext = file_path.suffix.lower()
                        is_hidden = cls._is_hidden(file_path)
                        is_sys = cls._is_system(file_path)
                        is_ro = cls._is_readonly(file_path)

                        record = FileRecord(
                            scan_id=scan.id,
                            file_path=str(file_path),
                            file_name=fname,
                            extension=ext,
                            size_bytes=size,
                            mime_type=mime,
                            created_time=ctime,
                            modified_time=mtime,
                            accessed_time=atime,
                            is_hidden=is_hidden,
                            is_system=is_sys,
                            is_readonly=is_ro,
                            parent_directory=str(file_path.parent),
                        )
                        file_records.append(record)
                        total_files += 1
                        total_size += size

                    except (PermissionError, OSError) as fe:
                        errors_count += 1
                        error_details.append(f"{file_path}: {str(fe)}")

                if total_files >= settings.max_scan_files:
                    break

            # Bulk save file records
            for rec in file_records:
                session.add(rec)

            scan.status = "completed"
            scan.total_files = total_files
            scan.files_scanned = total_files
            scan.total_directories = total_dirs
            scan.total_size_bytes = total_size
            scan.errors_count = errors_count
            scan.error_details = "\n".join(error_details[:50])
            scan.completed_at = datetime.now(timezone.utc)

            await session.flush()

            await AuditService.log(
                session,
                action="scan_completed",
                entity_type="scan",
                entity_id=scan.id,
                details={
                    "total_files": total_files,
                    "total_size_bytes": total_size,
                    "errors_count": errors_count,
                },
            )

        except Exception as e:
            scan.status = "failed"
            scan.error_details = str(e)
            scan.completed_at = datetime.now(timezone.utc)
            await session.flush()
            raise

        return scan
