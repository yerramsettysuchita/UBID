from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.entities import BusinessEntity, BusinessEvent, SourceRecord, User

router = APIRouter(prefix="/pincode", tags=["pincode"])


@router.get("/query")
async def query_pincode_businesses(
    pincode: str | None = Query(None),
    district: str | None = Query(None),
    status: str | None = Query(None),
    department: str | None = Query(None),
    no_inspection_since_days: int | None = Query(None, description="Filter: no inspection in N days"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(BusinessEntity).where(BusinessEntity.is_active == True)

    if pincode:
        stmt = stmt.where(BusinessEntity.primary_pincode == pincode)
    if district:
        stmt = stmt.where(BusinessEntity.district.ilike(f"%{district}%"))
    if status:
        stmt = stmt.where(BusinessEntity.status == status)

    count_result = await db.execute(select(func.count()).select_from(stmt.subquery()))
    total = count_result.scalar_one()

    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    entities = result.scalars().all()

    return {
        "total": total,
        "pincode": pincode,
        "district": district,
        "results": [
            {
                "ubid": e.ubid,
                "canonical_name": e.canonical_name,
                "status": e.status.value,
                "primary_pincode": e.primary_pincode,
                "district": e.district,
                "status_reason": e.status_reason,
            }
            for e in entities
        ],
    }


@router.get("/{pincode}")
async def get_pincode_summary(
    pincode: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.models.base import BusinessStatus

    result = await db.execute(
        select(BusinessEntity).where(
            BusinessEntity.primary_pincode == pincode,
            BusinessEntity.is_active == True,
        )
    )
    entities = result.scalars().all()

    total = len(entities)
    active = sum(1 for e in entities if e.status == BusinessStatus.ACTIVE)
    dormant = sum(1 for e in entities if e.status == BusinessStatus.DORMANT)
    closed = sum(1 for e in entities if e.status == BusinessStatus.CLOSED)
    review_needed = sum(1 for e in entities if e.status == BusinessStatus.REVIEW_NEEDED)

    entity_ids = [e.id for e in entities]
    last_inspection = None
    if entity_ids:
        insp_result = await db.execute(
            select(func.max(BusinessEvent.event_date)).where(
                BusinessEvent.business_entity_id.in_(entity_ids),
                BusinessEvent.event_type == "INSPECTION",
            )
        )
        last_inspection = insp_result.scalar_one()

    return {
        "pincode": pincode,
        "total_businesses": total,
        "active_count": active,
        "dormant_count": dormant,
        "closed_count": closed,
        "review_needed_count": review_needed,
        "last_inspection_date": str(last_inspection) if last_inspection else None,
    }
