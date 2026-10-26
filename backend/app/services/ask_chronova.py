"""
Chronova Ask Chronova & What-If Simulation Service — Module 14
==============================================================
Provides natural language querying, graph-based what-if impact simulation,
and optional local Ollama LLM integration with local deterministic fallback.
"""

import json
import re
from pathlib import Path
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import httpx

from app.models import FileRecord, Dependency, LifecycleRecommendation
from app.schemas import AskChronovaRequest, AskChronovaResponse
from app.services.graph_service import GraphService
from app.core import settings


class AskChronovaService:
    """Service for workspace Q&A and what-if consequence simulation."""

    @classmethod
    async def answer_query(
        cls,
        session: AsyncSession,
        req: AskChronovaRequest,
    ) -> AskChronovaResponse:
        """
        Processes natural language question.
        Executes what-if graph simulation or deterministic analysis.
        Attempts local Ollama synthesis if enabled, otherwise provides local response.
        """
        question = req.question.strip()
        q_lower = question.lower()
        scan_id = req.scan_id

        # If scan_id not provided, find the most recent scan
        if not scan_id:
            from app.models import ScanRecord
            recent_scan = await session.execute(
                select(ScanRecord).order_by(ScanRecord.started_at.desc()).limit(1)
            )
            s = recent_scan.scalar_one_or_none()
            if s:
                scan_id = s.id

        if not scan_id:
            return AskChronovaResponse(
                question=question,
                answer="No active scan data found. Please run a scan on a workspace first to enable Chronova AI analysis.",
                confidence=0.5,
                sources=[],
                suggestions=["Start a new scan in the File Scanner page."],
            )

        # 1. Check for What-If simulation query
        # e.g., "what happens if I archive/delete/remove <filename>?", "what if helper.py is deleted?"
        what_if_match = re.search(
            r"(?:what happens if|what if|can i archive|simulate|impact of (?:archiving|removing|deleting)?)\s+(?:i\s+|we\s+)?(?:archive|remove|delete)?\s*([a-zA-Z0-9_\-\.]+)",
            q_lower,
        )
        target_name = what_if_match.group(1) if what_if_match else None

        f_res = await session.execute(
            select(FileRecord).where(FileRecord.scan_id == scan_id)
        )
        all_files = list(f_res.scalars().all())

        matched_file: Optional[FileRecord] = None

        # Priority A: Exact filename or stem match from regex extraction
        if target_name:
            t = target_name.strip().lower()
            for f in all_files:
                if f.file_name.lower() == t or Path(f.file_name).stem.lower() == t:
                    matched_file = f
                    break

        # Priority B: Search query text with longest filename first to avoid substring false positives
        if not matched_file:
            sorted_files = sorted(all_files, key=lambda x: len(x.file_name), reverse=True)
            for f in sorted_files:
                fname_lower = f.file_name.lower()
                boundary_pat = r"(?:^|[\s\"'`/\\])" + re.escape(fname_lower) + r"(?:$|[\s\"'`\?!,])"
                if re.search(boundary_pat, q_lower) or fname_lower in q_lower:
                    matched_file = f
                    break

        # What-If impact simulation
        if matched_file and (
            "what if" in q_lower
            or "what happens" in q_lower
            or "archive" in q_lower
            or "delete" in q_lower
            or "remove" in q_lower
            or "impact" in q_lower
            or target_name is not None
        ):
            G, file_map, _ = await GraphService.build_networkx_graph(session, scan_id)

            # Inbound nodes (files that depend on matched_file)
            in_edges = list(G.in_edges(matched_file.id))
            in_dependents = [file_map[src].file_name for src, _ in in_edges if src in file_map]

            entry_point_names = {
                "main.py", "main.ts", "main.tsx", "app.py", "app.tsx", "index.html",
                "index.ts", "package.json", "tsconfig.json", "pyproject.toml",
            }
            is_entry_point = matched_file.file_name.lower() in entry_point_names

            if in_dependents:
                answer = (
                    f"[HIGH RISK IMPACT] Archiving or removing `{matched_file.file_name}` "
                    f"would directly break **{len(in_dependents)} dependent file(s)**:\n"
                    + "\n".join([f"  - `{name}`" for name in in_dependents[:10]]) + "\n\n"
                    f"**Recommendation**: Chronova strongly advises **RETAINING** this file. "
                    f"Its graph centrality score is {matched_file.importance_score or 0.5:.2f}."
                )
                suggestions = [
                    f"Inspect inbound dependencies for {matched_file.file_name} in the Graph Viewer",
                    "Keep the file in workspace to prevent runtime import failures",
                ]
            elif is_entry_point:
                answer = (
                    f"[HIGH CAUTION ENTRY POINT] `{matched_file.file_name}` is an essential "
                    f"application entry point or primary configuration file.\n\n"
                    f"Although no other local code files import it directly, "
                    f"removing it may prevent the workspace application from launching or building.\n\n"
                    f"- File size: {matched_file.size_bytes:,} bytes\n"
                    f"- Privacy: {matched_file.privacy_level}\n\n"
                    f"**Recommendation**: Chronova advises **RETAINING** this foundational file."
                )
                suggestions = [
                    f"Check {matched_file.file_name} role in Architecture Overview",
                    "Keep entry points and config files retained",
                ]
            else:
                answer = (
                    f"[SAFE CANDIDATE] `{matched_file.file_name}` is a leaf node "
                    f"with **0 inbound dependencies**. No other files in the workspace import or reference it.\n\n"
                    f"- File size: {matched_file.size_bytes:,} bytes\n"
                    f"- Privacy: {matched_file.privacy_level}\n"
                    f"- Archiving will safely reclaim storage without breaking project code."
                )
                suggestions = [
                    f"Submit {matched_file.file_name} for User Approval in Recommendation Center",
                    "Verify file contents before confirming archive action",
                ]

            return AskChronovaResponse(
                question=question,
                answer=answer,
                confidence=0.95,
                sources=[matched_file.file_path],
                suggestions=suggestions,
            )

        # 2. General Query Handling (Duplicates, High Risk, Summary)
        if "duplicate" in q_lower:
            dup_files = [f for f in all_files if f.is_duplicate]
            wasted = sum(f.size_bytes for f in dup_files)
            answer = (
                f"Chronova detected **{len(dup_files)} duplicate files** across the workspace, "
                f"consuming approximately **{wasted / (1024*1024):.2f} MB** of redundant space.\n"
                f"You can review duplicate groups and approve archiving redundant copies in the Duplicate Detector."
            )
            return AskChronovaResponse(
                question=question,
                answer=answer,
                confidence=0.92,
                sources=["SHA-256 Duplicate Detector"],
                suggestions=["Navigate to Duplicate Detector", "Review Lifecycle Recommendations"],
            )

        if "high risk" in q_lower or "risk" in q_lower:
            high_risk = [f for f in all_files if (f.importance_score or 0) > 0.6]
            answer = (
                f"There are **{len(high_risk)} high-importance / protected files** in this workspace. "
                f"These files have heavy inbound graph references, root configuration roles, or restricted credentials."
            )
            return AskChronovaResponse(
                question=question,
                answer=answer,
                confidence=0.90,
                sources=["Graph Topological Analysis"],
                suggestions=["Inspect Dependency Graph", "Filter File Explorer by Importance"],
            )

        # 3. Optional Local Ollama Synthesis (if reachable)
        if settings.ollama_enabled:
            try:
                async with httpx.AsyncClient(timeout=4.0) as client:
                    resp = await client.post(
                        "http://localhost:11434/api/generate",
                        json={
                            "model": settings.ollama_model,
                            "prompt": f"System: You are Chronova, an explainable file lifecycle assistant.\nUser: {question}",
                            "stream": False,
                        },
                    )
                    if resp.status_code == 200:
                        ollama_text = resp.json().get("response", "")
                        return AskChronovaResponse(
                            question=question,
                            answer=ollama_text,
                            confidence=0.85,
                            sources=["Ollama Local LLM"],
                            suggestions=["Ask a what-if simulation query", "Check file dependencies"],
                        )
            except Exception:
                pass  # Fall back smoothly

        # Default local contextual summary
        total_size_mb = sum(f.size_bytes for f in all_files) / (1024 * 1024)
        answer = (
            f"**Chronova Workspace Analysis Summary**:\n"
            f"• Analyzed Files: {len(all_files)}\n"
            f"• Total Storage: {total_size_mb:.2f} MB\n"
            f"• Explainable AI Rule: Files are never archived based solely on age.\n\n"
            f"Try asking: *'What happens if I archive <filename>?'* or *'Show me duplicate files'*."
        )

        return AskChronovaResponse(
            question=question,
            answer=answer,
            confidence=0.88,
            sources=["Chronova Local Intelligence"],
            suggestions=[
                "What happens if I archive main.py?",
                "Which files are duplicates?",
                "Show me high-risk dependencies",
            ],
        )
