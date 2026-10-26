"""
Chronova Lifecycle Decision Engine — Module 10
==============================================
Synthesizes dependency topology, privacy constraints, duplicate analysis,
and temporal metrics into safe, explainable lifecycle recommendations.
"""

import json
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.models import FileRecord, LifecycleRecommendation
from app.schemas import RecommendationResponse
from app.services.graph_service import GraphService
from app.services.risk_assessor import RiskAssessorService
from app.services.explainability_engine import ExplainabilityEngineService, NLExplainerService
from app.services.audit_service import AuditService


class LifecycleEngineService:
    """Service for computing explainable file lifecycle actions."""

    @classmethod
    async def generate_recommendations(
        cls,
        session: AsyncSession,
        scan_id: str,
    ) -> list[LifecycleRecommendation]:
        """
        Evaluate all files in a scan and persist lifecycle recommendations.
        Clear old recommendations for this scan first.
        """
        G, file_map, _ = await GraphService.build_networkx_graph(session, scan_id)

        # Clear existing recommendations for this scan
        await session.execute(
            delete(LifecycleRecommendation).where(LifecycleRecommendation.scan_id == scan_id)
        )

        recommendations: list[LifecycleRecommendation] = []
        now = datetime.now(timezone.utc)

        for node_id, file_record in file_map.items():
            # Assess risk
            risk_info = RiskAssessorService.assess_risk(file_record, G)
            in_deps = risk_info.get("inbound_dependents_count", 0)

            # Calculate age
            ref_time = file_record.modified_time or file_record.created_time or now
            if ref_time.tzinfo is None:
                ref_time = ref_time.replace(tzinfo=timezone.utc)
            age_days = max(0.0, (now - ref_time).total_seconds() / 86400.0)

            score = file_record.importance_score or 0.20

            # ── DECISION LOGIC ──
            # Rule 1: Files with inbound dependencies or high importance MUST be retained
            if in_deps > 0 or score >= 0.50:
                action = "retain"
                confidence = 0.95
            # Rule 2: Secondary duplicate copies can be safely archived
            elif file_record.is_duplicate:
                action = "archive"
                confidence = 0.92
            # Rule 3: Highly sensitive files with low graph activity require human review
            elif file_record.privacy_level in {"restricted", "confidential"} and age_days > 45:
                action = "review"
                confidence = 0.85
            # Rule 4: Isolated leaf files with low importance and no inbound links
            elif in_deps == 0 and score < 0.35 and age_days > 30:
                action = "archive"
                confidence = 0.88
            # Rule 5: Default to monitor or retain
            elif score >= 0.30:
                action = "retain"
                confidence = 0.75
            else:
                action = "monitor"
                confidence = 0.70

            # Generate factors & explanations
            factors, evidence = ExplainabilityEngineService.generate_factors_and_evidence(
                file_record=file_record,
                action=action,
                risk_info=risk_info,
                age_days=age_days,
            )

            explanation = NLExplainerService.generate_explanation(
                file_name=file_record.file_name,
                action=action,
                risk_level=risk_info["risk_level"],
                in_deps=in_deps,
                privacy_level=file_record.privacy_level,
                is_duplicate=file_record.is_duplicate,
                age_days=age_days,
            )

            rec = LifecycleRecommendation(
                file_id=file_record.id,
                scan_id=scan_id,
                action=action,
                risk_level=risk_info["risk_level"],
                confidence=confidence,
                explanation=explanation,
                contributing_factors=json.dumps(factors),
                evidence_summary=json.dumps(evidence),
                status="pending",
                created_at=now,
            )
            session.add(rec)
            recommendations.append(rec)

        await session.flush()

        await AuditService.log(
            session,
            action="recommendations_generated",
            entity_type="scan",
            entity_id=scan_id,
            details={"total_recommendations": len(recommendations)},
        )

        return recommendations
