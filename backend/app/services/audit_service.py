"""
Chronova Audit Service
======================
Records all important operations for accountability and traceability.
"""

import json
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.models import AuditLog


class AuditService:
    """Service for creating and querying audit log entries."""

    @staticmethod
    async def log(
        session: AsyncSession,
        action: str,
        entity_type: Optional[str] = None,
        entity_id: Optional[str] = None,
        details: Optional[dict] = None,
        user: str = "system",
    ) -> AuditLog:
        """Record an audit event."""
        entry = AuditLog(
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            details=json.dumps(details or {}),
            user=user,
            timestamp=datetime.now(timezone.utc),
        )
        session.add(entry)
        await session.flush()
        return entry

    @staticmethod
    async def get_logs(
        session: AsyncSession,
        action: Optional[str] = None,
        entity_type: Optional[str] = None,
        entity_id: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[AuditLog], int]:
        """Query audit logs with optional filters."""
        query = select(AuditLog)

        if action:
            query = query.where(AuditLog.action == action)
        if entity_type:
            query = query.where(AuditLog.entity_type == entity_type)
        if entity_id:
            query = query.where(AuditLog.entity_id == entity_id)

        # Count total
        from sqlalchemy import func
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await session.execute(count_query)
        total = total_result.scalar() or 0

        # Fetch page
        query = query.order_by(desc(AuditLog.timestamp)).offset(offset).limit(limit)
        result = await session.execute(query)
        logs = list(result.scalars().all())

        return logs, total
