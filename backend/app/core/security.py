"""
Chronova Security Utilities
============================
Path validation, directory authorization, and safety checks.
"""

import os
from pathlib import Path
from typing import Optional


class SecurityError(Exception):
    """Raised when a security violation is detected."""
    pass


class PathValidator:
    """Validates and sanitizes file paths to prevent path traversal attacks."""

    def __init__(self, authorized_directories: Optional[list[Path]] = None):
        self._authorized_dirs: list[Path] = []
        if authorized_directories:
            for d in authorized_directories:
                self._authorized_dirs.append(d.resolve())

    def add_authorized_directory(self, directory: Path) -> None:
        """Add a directory to the authorized list."""
        resolved = directory.resolve()
        if resolved not in self._authorized_dirs:
            self._authorized_dirs.append(resolved)

    def remove_authorized_directory(self, directory: Path) -> None:
        """Remove a directory from the authorized list."""
        resolved = directory.resolve()
        if resolved in self._authorized_dirs:
            self._authorized_dirs.remove(resolved)

    @property
    def authorized_directories(self) -> list[Path]:
        return list(self._authorized_dirs)

    def validate_path(self, path: str | Path) -> Path:
        """
        Validate a path is safe and within authorized directories.

        Raises SecurityError if the path is:
        - A path traversal attempt
        - Outside authorized directories
        - Contains null bytes or suspicious patterns
        """
        path_str = str(path)

        # Check for null bytes
        if "\x00" in path_str:
            raise SecurityError("Path contains null bytes")

        # Resolve the path
        try:
            resolved = Path(path_str).resolve()
        except (ValueError, OSError) as e:
            raise SecurityError(f"Invalid path: {e}")

        # Check against authorized directories
        if self._authorized_dirs:
            is_authorized = any(
                self._is_subpath(resolved, auth_dir)
                for auth_dir in self._authorized_dirs
            )
            if not is_authorized:
                raise SecurityError(
                    f"Path '{resolved}' is not within any authorized directory"
                )

        return resolved

    def is_safe_path(self, path: str | Path) -> bool:
        """Check if a path is safe without raising exceptions."""
        try:
            self.validate_path(path)
            return True
        except SecurityError:
            return False

    @staticmethod
    def _is_subpath(path: Path, parent: Path) -> bool:
        """Check if path is a subpath of parent."""
        try:
            path.relative_to(parent)
            return True
        except ValueError:
            return False

    @staticmethod
    def prevent_overwrite(target: Path) -> None:
        """Raise if target file already exists, preventing accidental overwrites."""
        if target.exists():
            raise SecurityError(
                f"File '{target}' already exists. Overwrite prevented."
            )


# Global validator instance
path_validator = PathValidator()
