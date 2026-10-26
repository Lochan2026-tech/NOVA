"""
Chronova Risk Assessment Service — Module 11
============================================
Evaluates operational risk associated with potential file lifecycle actions.
Computes dependency impact risk, privacy exposure risk, and overall risk tier.
"""

from typing import Any
import networkx as nx
from app.models import FileRecord


class RiskAssessorService:
    """Service for assessing risks of modifying or archiving files."""

    @classmethod
    def assess_risk(
        cls,
        file_record: FileRecord,
        graph: nx.DiGraph,
    ) -> dict[str, Any]:
        """
        Assess risk of archiving or modifying a specific file.
        Returns risk_level (low, medium, high, critical), risk_score (0.0 to 1.0),
        and list of risk indicators.
        """
        in_degree = graph.in_degree(file_record.id) if file_record.id in graph else 0
        out_degree = graph.out_degree(file_record.id) if file_record.id in graph else 0

        risk_indicators = []
        score = 0.0

        # 1. Dependency Break Risk (CRITICAL)
        if in_degree > 3:
            score += 0.50
            risk_indicators.append(f"High dependency impact: {in_degree} files rely directly on this file")
        elif in_degree > 0:
            score += 0.35
            risk_indicators.append(f"Direct dependency impact: {in_degree} file(s) rely on this file")

        # 2. Privacy Risk
        if file_record.privacy_level == "restricted":
            score += 0.30
            risk_indicators.append("Restricted privacy classification (contains credentials, keys, or secrets)")
        elif file_record.privacy_level == "confidential":
            score += 0.20
            risk_indicators.append("Confidential business or personal privacy classification")

        # 3. System / Readonly Protection
        if file_record.is_system or file_record.is_readonly:
            score += 0.25
            risk_indicators.append("OS system or read-only attribute protection flag")

        # 4. Duplicate Mitigation (Lowers risk of archiving if duplicate copy exists)
        if file_record.is_duplicate and file_record.duplicate_group_id:
            score = max(0.05, score - 0.25)
            risk_indicators.append("Duplicate mitigation: Identical copy exists in workspace")

        # Normalize score
        final_score = round(min(1.0, max(0.05, score)), 2)

        # Categorize
        if final_score >= 0.70 or in_degree > 3:
            level = "critical"
        elif final_score >= 0.45 or in_degree > 0:
            level = "high"
        elif final_score >= 0.25:
            level = "medium"
        else:
            level = "low"

        return {
            "risk_level": level,
            "risk_score": final_score,
            "inbound_dependents_count": in_degree,
            "outbound_dependencies_count": out_degree,
            "risk_indicators": risk_indicators,
        }
