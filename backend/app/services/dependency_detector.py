"""
Chronova Dependency Detection Service — Module 7
=================================================
Discovers structural and semantic dependencies between files:
code imports, companion pairs, configuration references, and duplicate copies.
"""

import json
import re
from pathlib import Path
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.models import FileRecord, Dependency
from app.services.audit_service import AuditService


class DependencyDetectorService:
    """Service for discovering and extracting file relationships."""

    # Regex patterns for imports
    PY_IMPORT_REGEX = re.compile(r"^(?:from|import)\s+([a-zA-Z0-9_\.]+)", re.MULTILINE)
    JS_IMPORT_REGEX = re.compile(r"(?:import|from|require\()\s*['\"]([^'\"]+)['\"]", re.MULTILINE)
    C_INCLUDE_REGEX = re.compile(r'#include\s*["<]([^">]+)[">]', re.MULTILINE)

    @classmethod
    async def detect_dependencies_for_scan(
        cls,
        session: AsyncSession,
        scan_id: str,
    ) -> list[Dependency]:
        """
        Detect all file relationships across files in a scan.
        Clear previous dependencies for this scan and persist fresh detections.
        """
        # Fetch all files in scan
        result = await session.execute(
            select(FileRecord).where(FileRecord.scan_id == scan_id)
        )
        files = list(result.scalars().all())

        # Build path and filename indexes
        path_to_file: dict[str, FileRecord] = {f.file_path: f for f in files}
        norm_to_file: dict[str, FileRecord] = {
            Path(f.file_path).as_posix().lower(): f for f in files
        }
        stem_to_files: dict[str, list[FileRecord]] = {}
        for f in files:
            stem = Path(f.file_name).stem.lower()
            stem_to_files.setdefault(stem, []).append(f)

        # Clear existing dependencies for this scan
        await session.execute(
            delete(Dependency).where(Dependency.scan_id == scan_id)
        )

        detected_deps: list[Dependency] = []
        seen_pairs: set[tuple[str, str, str]] = set()

        def add_dep(src_id: str, tgt_id: str, rel_type: str, conf: float, ev: dict):
            if src_id == tgt_id:
                return
            key = (src_id, tgt_id, rel_type)
            if key in seen_pairs:
                return
            seen_pairs.add(key)
            dep = Dependency(
                scan_id=scan_id,
                source_file_id=src_id,
                target_file_id=tgt_id,
                relationship_type=rel_type,
                confidence=conf,
                evidence=json.dumps(ev),
            )
            detected_deps.append(dep)
            session.add(dep)

        # 1. Companion files (e.g., test files, header/source, styles)
        for f in files:
            path = Path(f.file_path)
            stem = path.stem.lower()
            ext = f.extension.lower()

            # Test companion: test_foo.py -> foo.py
            if stem.startswith("test_") or stem.endswith("_test"):
                target_stem = stem.replace("test_", "").replace("_test", "")
                if target_stem in stem_to_files:
                    for target_f in stem_to_files[target_stem]:
                        if target_f.id != f.id:
                            add_dep(
                                src_id=f.id,
                                tgt_id=target_f.id,
                                rel_type="test-for",
                                conf=0.95,
                                ev={"reason": "Filename matches test naming convention for target module"},
                            )

            # C/C++ Companion: foo.c -> foo.h
            if ext in {".c", ".cpp"}:
                if stem in stem_to_files:
                    for target_f in stem_to_files[stem]:
                        if target_f.extension.lower() in {".h", ".hpp"}:
                            add_dep(
                                src_id=f.id,
                                tgt_id=target_f.id,
                                rel_type="companion-header",
                                conf=0.98,
                                ev={"reason": "Source and header companion pairing"},
                            )

            # Style companion: Foo.tsx -> Foo.css
            if ext in {".tsx", ".jsx", ".vue"}:
                if stem in stem_to_files:
                    for target_f in stem_to_files[stem]:
                        if target_f.extension.lower() in {".css", ".scss", ".module.css"}:
                            add_dep(
                                src_id=f.id,
                                tgt_id=target_f.id,
                                rel_type="companion-style",
                                conf=0.90,
                                ev={"reason": "Component and stylesheet pairing"},
                            )

        # 2. Duplicate relationships
        dup_groups: dict[str, list[FileRecord]] = {}
        for f in files:
            if f.is_duplicate and f.duplicate_group_id:
                dup_groups.setdefault(f.duplicate_group_id, []).append(f)

        for group in dup_groups.values():
            if len(group) >= 2:
                primary = group[0]
                for copy in group[1:]:
                    add_dep(
                        src_id=copy.id,
                        tgt_id=primary.id,
                        rel_type="duplicate-of",
                        conf=1.0,
                        ev={"reason": "Identical SHA-256 cryptographic checksum"},
                    )

        # 3. Code Imports and File References (parse safely up to 32KB)
        for f in files:
            ext = f.extension.lower()
            f_path = Path(f.file_path)
            if not f_path.is_file():
                continue

            # Read sample content
            content = ""
            try:
                with open(f_path, "r", encoding="utf-8", errors="ignore") as fp:
                    content = fp.read(32768)
            except Exception:
                continue

            # Python imports
            if ext == ".py":
                for match in cls.PY_IMPORT_REGEX.finditer(content):
                    full_mod = match.group(1).lower()
                    parts = [p for p in full_mod.split(".") if p]
                    # Check parts in reverse (most specific module first)
                    for part in reversed(parts):
                        if part in stem_to_files:
                            for target_f in stem_to_files[part]:
                                if target_f.id != f.id and target_f.extension.lower() == ".py":
                                    add_dep(
                                        src_id=f.id,
                                        tgt_id=target_f.id,
                                        rel_type="imports",
                                        conf=0.92,
                                        ev={"module": part, "statement": match.group(0)},
                                    )
                            break

                # Also check 'from X import Y' where Y or X is a module
                for from_match in re.finditer(r"from\s+([a-zA-Z0-9_\.]+)\s+import\s+([a-zA-Z0-9_,\s]+)", content):
                    mod_parent = from_match.group(1).split(".")[-1].lower()
                    imported_names = [n.strip().lower() for n in from_match.group(2).split(",") if n.strip()]
                    if mod_parent in stem_to_files:
                        for target_f in stem_to_files[mod_parent]:
                            if target_f.id != f.id:
                                add_dep(
                                    src_id=f.id,
                                    tgt_id=target_f.id,
                                    rel_type="imports",
                                    conf=0.90,
                                    ev={"module": mod_parent, "statement": from_match.group(0)[:60]},
                                )
                    for name in imported_names:
                        if name in stem_to_files:
                            for target_f in stem_to_files[name]:
                                if target_f.id != f.id:
                                    add_dep(
                                        src_id=f.id,
                                        tgt_id=target_f.id,
                                        rel_type="imports",
                                        conf=0.90,
                                        ev={"module": name, "statement": from_match.group(0)[:60]},
                                    )

            # JS / TS imports
            elif ext in {".js", ".jsx", ".ts", ".tsx"}:
                for match in cls.JS_IMPORT_REGEX.finditer(content):
                    import_path = match.group(1)
                    matched_target = False
                    if import_path.startswith("."):
                        resolved = (f_path.parent / import_path).resolve().as_posix().lower()
                        for candidate_ext in ["", ".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx", "/index.js"]:
                            check_path = resolved + candidate_ext
                            if check_path in norm_to_file:
                                target_f = norm_to_file[check_path]
                                add_dep(
                                    src_id=f.id,
                                    tgt_id=target_f.id,
                                    rel_type="imports",
                                    conf=0.95,
                                    ev={"import_path": import_path, "statement": match.group(0)},
                                )
                                matched_target = True
                                break

                    # Match by stem fallback
                    if not matched_target:
                        stem_import = Path(import_path).stem.lower()
                        if stem_import in stem_to_files:
                            for target_f in stem_to_files[stem_import]:
                                if target_f.id != f.id and target_f.extension.lower() in {".ts", ".tsx", ".js", ".jsx", ".css"}:
                                    add_dep(
                                        src_id=f.id,
                                        tgt_id=target_f.id,
                                        rel_type="imports",
                                        conf=0.88,
                                        ev={"import_path": import_path},
                                    )

            # HTML references
            elif ext in {".html", ".htm"}:
                href_src = re.findall(r'(?:src|href)=["\']([^"\']+)["\']', content)
                for ref in href_src:
                    if not ref.startswith("http") and not ref.startswith("//"):
                        resolved = (f_path.parent / ref).resolve().as_posix().lower()
                        if resolved in norm_to_file:
                            target_f = norm_to_file[resolved]
                            add_dep(
                                src_id=f.id,
                                tgt_id=target_f.id,
                                rel_type="references",
                                conf=0.90,
                                ev={"reference": ref},
                            )

            # Project configs (e.g. package.json, tsconfig.json, pytest.ini)
            fname_lower = f.file_name.lower()
            if fname_lower in {"package.json", "tsconfig.json", "vite.config.ts"}:
                # Connect specifically to primary application entry points
                for other_f in files:
                    if other_f.id != f.id and other_f.file_name.lower() in {
                        "main.py", "main.ts", "main.tsx", "index.html", "index.ts", "app.tsx", "app.py"
                    }:
                        add_dep(
                            src_id=f.id,
                            tgt_id=other_f.id,
                            rel_type="config-for",
                            conf=0.85,
                            ev={"config": f.file_name, "target": other_f.file_name},
                        )
            elif fname_lower in {"pytest.ini", "pyproject.toml"}:
                # Connect to test suites
                for other_f in files:
                    if other_f.id != f.id and (other_f.file_name.startswith("test_") or other_f.file_name.endswith("_test.py")):
                        add_dep(
                            src_id=f.id,
                            tgt_id=other_f.id,
                            rel_type="config-for",
                            conf=0.80,
                            ev={"config": f.file_name, "target": other_f.file_name},
                        )

        await session.flush()

        await AuditService.log(
            session,
            action="dependency_detection_completed",
            entity_type="scan",
            entity_id=scan_id,
            details={"dependencies_discovered": len(detected_deps)},
        )

        return detected_deps
