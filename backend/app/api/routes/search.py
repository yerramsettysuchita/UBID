"""Phase 4 enhanced search: department, confidence, date, review-state, SLA filters."""
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.base import ReviewStatus, UserRole
from app.models.entities import BusinessEntity, ReviewCase, SourceRecord, User

router = APIRouter(prefix="/search", tags=["search"])

OFFICER_PAN_MASK  = lambda pan:  pan[:5] + "****" + pan[-1] if pan else None
OFFICER_GSTIN_MASK = lambda g: g[:7] + "****" if g else None


def _mask_for_role(entity: BusinessEntity, role: UserRole) -> dict:
    pan   = entity.canonical_pan
    gstin = entity.canonical_gstin
    if role == UserRole.OFFICER:
        pan   = OFFICER_PAN_MASK(pan)
        gstin = OFFICER_GSTIN_MASK(gstin)
    return {
        "ubid":             entity.ubid,
        "canonical_name":   entity.canonical_name,
        "canonical_pan":    pan,
        "canonical_gstin":  gstin,
        "status":           entity.status.value,
        "status_reason":    entity.status_reason,
        "primary_pincode":  entity.primary_pincode,
        "district":         entity.district,
        "confidence_score": float(entity.confidence_score),
    }


@router.get("")
async def search_businesses(
    q:               str | None  = Query(None, description="Free-text search"),
    ubid:            str | None  = Query(None),
    pan:             str | None  = Query(None),
    gstin:           str | None  = Query(None),
    pincode:         str | None  = Query(None),
    district:        str | None  = Query(None),
    status:          str | None  = Query(None),
    # Phase 4 new filters
    department:      str | None  = Query(None, description="Filter by source department code"),
    confidence_min:  float | None = Query(None, ge=0.0, le=1.0),
    confidence_max:  float | None = Query(None, ge=0.0, le=1.0),
    has_pan:         bool | None  = Query(None),
    has_gstin:       bool | None  = Query(None),
    has_review:      bool | None  = Query(None, description="Only show businesses with open review cases"),
    page:            int  = Query(1, ge=1),
    page_size:       int  = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(BusinessEntity).where(BusinessEntity.is_active == True)

    if ubid:
        stmt = stmt.where(BusinessEntity.ubid == ubid)
    if pan:
        stmt = stmt.where(BusinessEntity.canonical_pan == pan.upper())
    if gstin:
        stmt = stmt.where(BusinessEntity.canonical_gstin == gstin.upper())
    if pincode:
        stmt = stmt.where(BusinessEntity.primary_pincode == pincode)
    if district:
        stmt = stmt.where(BusinessEntity.district.ilike(f"%{district}%"))
    if status:
        stmt = stmt.where(BusinessEntity.status == status)
    if q:
        q_clean = q.strip()
        q_conditions = [
            BusinessEntity.canonical_name.ilike(f"%{q_clean}%"),
            BusinessEntity.ubid.ilike(f"%{q_clean}%"),
        ]
        if q_clean.isdigit() and len(q_clean) == 6:
            q_conditions.append(BusinessEntity.primary_pincode == q_clean)
        stmt = stmt.where(or_(*q_conditions))
    if confidence_min is not None:
        stmt = stmt.where(BusinessEntity.confidence_score >= confidence_min)
    if confidence_max is not None:
        stmt = stmt.where(BusinessEntity.confidence_score <= confidence_max)
    if has_pan is True:
        stmt = stmt.where(BusinessEntity.canonical_pan != None)
    if has_pan is False:
        stmt = stmt.where(BusinessEntity.canonical_pan == None)
    if has_gstin is True:
        stmt = stmt.where(BusinessEntity.canonical_gstin != None)
    if has_gstin is False:
        stmt = stmt.where(BusinessEntity.canonical_gstin == None)

    # Department filter — join through source_records
    if department:
        sub = (
            select(SourceRecord.business_entity_id)
            .where(
                SourceRecord.department_code == department,
                SourceRecord.business_entity_id != None,
            )
            .scalar_subquery()
        )
        stmt = stmt.where(BusinessEntity.id.in_(sub))

    # Open review cases filter — fast non-correlated subquery via JOIN
    if has_review is True:
        open_entity_ids = (
            select(SourceRecord.business_entity_id)
            .join(ReviewCase, or_(
                ReviewCase.record_a_id == SourceRecord.id,
                ReviewCase.record_b_id == SourceRecord.id,
            ))
            .where(
                ReviewCase.status.in_([ReviewStatus.PENDING, ReviewStatus.ESCALATED]),
                SourceRecord.business_entity_id.isnot(None),
            )
            .distinct()
        )
        stmt = stmt.where(BusinessEntity.id.in_(open_entity_ids))

    count_r = await db.execute(select(func.count()).select_from(stmt.subquery()))
    total = count_r.scalar_one()

    stmt = stmt.order_by(BusinessEntity.confidence_score.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    entities = result.scalars().all()

    # Batch-fetch department_coverage for all entities in one query
    entity_ids = [e.id for e in entities]
    dept_map: dict = {}
    if entity_ids:
        dept_rows = await db.execute(
            select(SourceRecord.business_entity_id, SourceRecord.department_code)
            .where(SourceRecord.business_entity_id.in_(entity_ids))
            .distinct()
        )
        for bid, dcode in dept_rows:
            dept_map.setdefault(bid, []).append(dcode)

    items = []
    for e in entities:
        row = _mask_for_role(e, current_user.role)
        row["department_coverage"] = dept_map.get(e.id, [])
        items.append(row)

    return {
        "total":     total,
        "page":      page,
        "page_size": page_size,
        "results":   items,
    }
