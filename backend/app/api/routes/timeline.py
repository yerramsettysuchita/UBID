from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.entities import BusinessEntity, BusinessEvent, User

router = APIRouter(prefix="/timeline", tags=["timeline"])


@router.get("/{ubid}")
async def get_timeline(
    ubid: str,
    department: str | None = Query(None),
    event_type: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BusinessEntity).where(BusinessEntity.ubid == ubid, BusinessEntity.is_active == True)
    )
    entity = result.scalar_one_or_none()
    if not entity:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")

    stmt = select(BusinessEvent).where(BusinessEvent.business_entity_id == entity.id)
    if department:
        stmt = stmt.where(BusinessEvent.department_code == department)
    if event_type:
        stmt = stmt.where(BusinessEvent.event_type == event_type)
    stmt = stmt.order_by(BusinessEvent.event_date.desc())

    events_result = await db.execute(stmt)
    events = events_result.scalars().all()

    today = date.today()
    event_list = []
    for evt in events:
        days_ago = (today - evt.event_date).days if evt.event_date else None
        event_list.append({
            "id": str(evt.id),
            "event_type": evt.event_type.value,
            "event_date": str(evt.event_date),
            "department_code": evt.department_code,
            "event_description": evt.event_description,
            "event_outcome": evt.event_outcome,
            "days_ago": days_ago,
        })

    recency_days = None
    if events:
        latest = max(e.event_date for e in events if e.event_date)
        recency_days = (today - latest).days

    return {
        "ubid": ubid,
        "status": entity.status.value,
        "status_reason": entity.status_reason,
        "events": event_list,
        "classification_evidence": {
            "recency_days": recency_days,
            "signal_count": len(events),
            "departments_with_signals": list({e.department_code for e in events}),
        },
    }
