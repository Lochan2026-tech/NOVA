"""
Chronova User Approval Workflow — Module 15
===========================================
Ensures that potentially destructive or archival actions require explicit
human approval. Manages recommendation review, approval, and rejection.
"""

from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models import LifecycleRecommendation
from app.schemas import ApprovalRequest, ApprovalResponse
from app.services.audit_service import AuditService


class ApprovalService:
    """Service for handling explicit user approvals for lifecycle recommendations."""

    @classmethod
    async def process_approval(
        cls,
        session: AsyncSession,
        req: ApprovalRequest,
    ) -> ApprovalResponse:
        """Approve or reject a lifecycle recommendation."""
        result = await session.execute(
            select(LifecycleRecommendation).where(LifecycleRecommendation.id == req.recommendation_id)
        )
        rec = result.scalar_one_or_none()
        if not rec:
            raise ValueError(f"Recommendation not found: {req.recommendation_id}")

        now = datetime.now(timezone.utc)

        if req.action == "approve":
            rec.status = "approved"
            rec.approved_by = req.approved_by
            rec.approved_at = now
            msg = f"Recommendation for action '{rec.action}' successfully approved."
            audit_action = "recommendation_approved"
        elif req.action == "reject":
            rec.status = "rejected"
            rec.rejection_reason = req.reason or "Rejected by user"
            msg = f"Recommendation for action '{rec.action}' rejected."
            audit_action = "recommendation_rejected"
        else:
            raise ValueError(f"Invalid approval action: {req.action}")

        await session.flush()

        await AuditService.log(
            session,
            action=audit_action,
            entity_type="recommendation",
            entity_id=rec.id,
            details={
                "file_id": rec.file_id,
                "action": rec.action,
                "status": rec.status,
                "approved_by": req.approved_by,
                "reason": req.reason,
            },
            user=req.approved_by,
        )

        return ApprovalResponse(
            recommendation_id=rec.id,
            status=rec.status,
            message=msg,
        )
