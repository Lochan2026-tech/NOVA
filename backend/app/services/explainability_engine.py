"""
Chronova Explainable AI Engine — Module 12 & 13
===============================================
Constructs transparent, verifiable factor breakdowns and natural-language
explanations for all file lifecycle recommendations.
"""

from typing import Any
from app.models import FileRecord


class ExplainabilityEngineService:
    """Service for generating structured contributing factors and evidence."""

    @classmethod
    def generate_factors_and_evidence(
        cls,
        file_record: FileRecord,
        action: str,
        risk_info: dict[str, Any],
        age_days: float,
    ) -> tuple[list[dict[str, Any]], dict[str, Any]]:
        """
        Build structured contributing factors and evidence summary.
        Returns (contributing_factors_list, evidence_summary_dict).
        """
        in_deps = risk_info.get("inbound_dependents_count", 0)
        factors = []

        # Dependency factor
        if in_deps > 0:
            factors.append({
                "factor": "Inbound Graph Dependencies",
                "weight": "+40%",
                "impact": "Protective (Retain)",
                "description": f"{in_deps} file(s) in workspace explicitly import or reference this file",
            })
        else:
            factors.append({
                "factor": "Leaf Node Topology",
                "weight": "-25%",
                "impact": "Archivable",
                "description": "No other files depend on this file in the dependency graph",
            })

        # Privacy factor
        if file_record.privacy_level in {"restricted", "confidential"}:
            factors.append({
                "factor": f"Privacy Level ({file_record.privacy_level.capitalize()})",
                "weight": "+30%",
                "impact": "Protective / Sensitive",
                "description": "File has restricted or confidential security classification",
            })

        # Duplicate factor
        if file_record.is_duplicate:
            factors.append({
                "factor": "Cryptographic Duplicate",
                "weight": "-35%",
                "impact": "Archivable",
                "description": "Identical SHA-256 copy exists elsewhere in workspace",
            })

        # Temporal factor (Explained neutrally, never treated as sole obsolescence)
        factors.append({
            "factor": "Temporal Recency",
            "weight": "+10%" if age_days < 14 else "-10%",
            "impact": "Neutral / Contextual",
            "description": f"File last active {int(age_days)} days ago (age alone is not decisive)",
        })

        evidence = {
            "file_size_bytes": file_record.size_bytes,
            "sha256_hash": file_record.sha256_hash or "uncomputed",
            "privacy_classification": file_record.privacy_level,
            "inbound_dependencies": in_deps,
            "outbound_dependencies": risk_info.get("outbound_dependencies_count", 0),
            "age_days": round(age_days, 1),
            "is_duplicate": file_record.is_duplicate,
            "risk_score": risk_info.get("risk_score", 0.0),
        }

        return factors, evidence


class NLExplainerService:
    """Service for generating rich natural language explanations."""

    @classmethod
    def generate_explanation(
        cls,
        file_name: str,
        action: str,
        risk_level: str,
        in_deps: int,
        privacy_level: str,
        is_duplicate: bool,
        age_days: float,
    ) -> str:
        """Construct human-readable natural language explanation."""
        if action == "retain":
            reasons = []
            if in_deps > 0:
                reasons.append(f"it is actively relied upon by {in_deps} dependent file(s)")
            if privacy_level in {"restricted", "confidential"}:
                reasons.append(f"it contains sensitive {privacy_level} data")
            if age_days < 30:
                reasons.append(f"it shows recent modification activity ({int(age_days)} days ago)")
            reason_str = ", and ".join(reasons) if reasons else "it holds high structural importance"
            return (
                f"Chronova recommends RETAINING '{file_name}' (Risk: {risk_level.upper()}). "
                f"Even if this file has not been modified recently, {reason_str}. "
                f"Archiving or removing it could break system integrity."
            )

        elif action == "archive":
            reasons = []
            if is_duplicate:
                reasons.append("it is a redundant duplicate with a verified identical copy")
            if in_deps == 0:
                reasons.append("no other workspace files depend on it")
            if age_days > 30:
                reasons.append(f"it has been dormant for {int(age_days)} days")
            reason_str = "; furthermore, ".join(reasons) if reasons else "it has low structural importance"
            return (
                f"Chronova recommends ARCHIVING '{file_name}' (Risk: {risk_level.upper()}). "
                f"Safe archival candidate because {reason_str}. "
                f"Archiving can recover disk space with negligible operational impact."
            )

        elif action == "review":
            return (
                f"Chronova recommends MANUAL REVIEW for '{file_name}' (Risk: {risk_level.upper()}). "
                f"This file has {privacy_level} privacy requirements, but minimal recent graph activity. "
                f"Because destructive or archival actions on sensitive files carry risk, user review is required."
            )

        else:  # monitor
            return (
                f"Chronova recommends MONITORING '{file_name}' (Risk: {risk_level.upper()}). "
                f"The file shows moderate graph centrality with uncertain dependency strength. "
                f"Continued monitoring will gather further access evidence before taking action."
            )
