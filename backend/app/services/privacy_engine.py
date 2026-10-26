"""
Chronova Privacy Classification Engine — Module 6
==================================================
Classifies files into privacy categories (public, internal, confidential,
restricted, unknown) supporting metadata-only, structural, and opt-in
content-aware analysis modes.
"""

import re
from pathlib import Path
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models import FileRecord
from app.core import settings


class PrivacyEngineService:
    """Service for privacy classification and policy enforcement."""

    RESTRICTED_PATTERNS = [
        r"\.env($|\..*)",
        r".*id_rsa.*",
        r".*\.pem$",
        r".*\.key$",
        r".*\.keystore$",
        r".*secret.*",
        r".*credential.*",
        r".*password.*",
        r".*token.*\.json$",
    ]

    CONFIDENTIAL_PATTERNS = [
        r".*salary.*",
        r".*invoice.*",
        r".*financial.*",
        r".*(?:^|[-_./])tax(?:[-_./]|$).*",
        r".*contract.*",
        r".*agreement.*",
        r".*employee.*",
        r".*patient.*",
        r".*(?:^|[-_./])nda(?:[-_./]|$).*",
    ]

    PUBLIC_PATTERNS = [
        r"^readme(\..*)?$",
        r"^license(\..*)?$",
        r"^contributing(\..*)?$",
        r"^changelog(\..*)?$",
        r".*\.md$",
        r".*\.svg$",
        r".*\.png$",
        r".*\.jpg$",
        r".*\.ico$",
    ]

    INTERNAL_EXTENSIONS = {
        ".py", ".ts", ".tsx", ".js", ".jsx", ".rs", ".go", ".java",
        ".c", ".cpp", ".h", ".hpp", ".cs", ".sql", ".sh", ".ps1",
        ".json", ".yaml", ".yml", ".toml", ".ini", ".cfg",
    }

    # Content signatures for opt-in content-aware mode
    SENSITIVE_CONTENT_SIGNATURES = [
        (re.compile(rb"-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----"), "restricted", "Private key header detected"),
        (re.compile(rb"(aws_access_key_id|aws_secret_access_key)\s*="), "restricted", "AWS credentials detected"),
        (re.compile(rb"(password|passwd|api_key|secret_key)\s*[:=]\s*['\"][^'\"]{6,}['\"]", re.IGNORECASE), "confidential", "Hardcoded credential detected"),
    ]

    @classmethod
    def classify_file(
        cls,
        file_path: str,
        mode: str = "metadata",
        opt_in_content: bool = False,
    ) -> tuple[str, str]:
        """
        Classify file privacy level.
        Returns (privacy_level, explanation).
        """
        path = Path(file_path)
        name_lower = path.name.lower()
        ext_lower = path.suffix.lower()

        # 1. Metadata check for Restricted
        for pat in cls.RESTRICTED_PATTERNS:
            if re.match(pat, name_lower):
                return "restricted", f"Matches sensitive pattern '{pat}' (credentials, key, or env file)"

        # 2. Metadata check for Confidential
        for pat in cls.CONFIDENTIAL_PATTERNS:
            if re.match(pat, name_lower):
                return "confidential", f"Matches financial or proprietary business term in filename '{pat}'"

        # 3. Opt-in Content Inspection (only if opt-in is enabled AND mode == content-aware)
        if mode == "content-aware" and opt_in_content and path.is_file():
            try:
                # Read up to 8KB securely
                with open(path, "rb") as f:
                    sample = f.read(8192)
                    for regex, level, note in cls.SENSITIVE_CONTENT_SIGNATURES:
                        if regex.search(sample):
                            return level, f"Content-aware inspection: {note}"
            except Exception:
                pass

        # 4. Public pattern check
        for pat in cls.PUBLIC_PATTERNS:
            if re.match(pat, name_lower):
                return "public", "Identified as documentation, open license, or public display asset"

        # 5. Internal code / config files
        if ext_lower in cls.INTERNAL_EXTENSIONS:
            return "internal", f"Identified as internal project codebase or configuration file ({ext_lower})"

        return "unknown", "No explicit privacy markers detected; treated with default precautions"

    @classmethod
    async def classify_scan_files(
        cls,
        session: AsyncSession,
        scan_id: str,
        mode: str = "metadata",
        opt_in_content: bool = False,
    ) -> dict[str, int]:
        """Classify all files in a scan and persist results."""
        result = await session.execute(
            select(FileRecord).where(FileRecord.scan_id == scan_id)
        )
        files = list(result.scalars().all())

        counts = {"public": 0, "internal": 0, "confidential": 0, "restricted": 0, "unknown": 0}

        for f in files:
            level, _ = cls.classify_file(f.file_path, mode=mode, opt_in_content=opt_in_content)
            f.privacy_level = level
            counts[level] = counts.get(level, 0) + 1

        await session.flush()
        return counts
