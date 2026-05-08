import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.base import UserRole
from app.models.entities import (
    BusinessEntity, BusinessEvent, ReviewCase, ReviewerDecision, SourceRecord, User,
)

router = APIRouter(prefix="/business", tags=["business"])


def _mask_pan(pan: str | None, role: UserRole) -> str | None:
    if pan and role == UserRole.OFFICER:
        return pan[:5] + "****" + pan[-1]
    return pan


def _mask_gstin(gstin: str | None, role: UserRole) -> str | None:
    if gstin and role == UserRole.OFFICER:
        return gstin[:7] + "****"
    return gstin


@router.get("/{ubid}")
async def get_business_profile(
    ubid: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BusinessEntity)
        .where(BusinessEntity.ubid == ubid, BusinessEntity.is_active == True)
        .options(selectinload(BusinessEntity.source_records))
        .options(selectinload(BusinessEntity.events))
    )
    entity = result.scalar_one_or_none()
    if not entity:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")

    dept_coverage = list({r.department_code for r in entity.source_records})
    recent_events = sorted(entity.events, key=lambda e: e.event_date, reverse=True)[:5]

    return {
        "ubid": entity.ubid,
        "canonical_name": entity.canonical_name,
        "canonical_pan": _mask_pan(entity.canonical_pan, current_user.role),
        "canonical_gstin": _mask_gstin(entity.canonical_gstin, current_user.role),
        "status": entity.status.value,
        "status_reason": entity.status_reason,
        "status_last_updated": entity.status_last_updated,
        "confidence_score": float(entity.confidence_score),
        "primary_pincode": entity.primary_pincode,
        "district": entity.district,
        "created_at": entity.created_at,
        "department_coverage": dept_coverage,
        "linked_records": [
            {
                "source_record_id": str(r.id),
                "department_code": r.department_code,
                "registration_number": r.registration_number,
                "registration_status": r.registration_status,
                "registration_date": r.registration_date,
                "normalized_name": r.normalized_name,
                "pincode": r.pincode,
                "owner_name": r.owner_name,
            }
            for r in entity.source_records
        ],
        "recent_events": [
            {
                "event_type": e.event_type.value,
                "event_date": str(e.event_date),
                "department_code": e.department_code,
                "event_description": e.event_description,
                "event_outcome": e.event_outcome,
            }
            for e in recent_events
        ],
    }


@router.get("/{ubid}/review-history")
async def get_review_history(
    ubid: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    entity_r = await db.execute(
        select(BusinessEntity).where(BusinessEntity.ubid == ubid)
    )
    entity = entity_r.scalar_one_or_none()
    if not entity:
        raise HTTPException(status_code=404, detail="Business not found")

    # Find source records linked to this entity
    records_r = await db.execute(
        select(SourceRecord).where(SourceRecord.business_entity_id == entity.id)
    )
    record_ids = [r.id for r in records_r.scalars().all()]

    if not record_ids:
        return {"ubid": ubid, "review_cases": []}

    # Find review cases where either record_a or record_b belongs to this entity
    from sqlalchemy import or_
    cases_r = await db.execute(
        select(ReviewCase).where(
            or_(
                ReviewCase.record_a_id.in_(record_ids),
                ReviewCase.record_b_id.in_(record_ids),
            )
        ).order_by(ReviewCase.created_at.desc()).limit(50)
    )
    cases = cases_r.scalars().all()

    # Batch-fetch all decisions for all cases + batch-fetch reviewers
    case_ids_list = [c.id for c in cases]
    latest_decisions: dict = {}
    users_by_id: dict = {}
    if case_ids_list:
        all_dec_r = await db.execute(
            select(ReviewerDecision)
            .where(ReviewerDecision.review_case_id.in_(case_ids_list))
            .order_by(ReviewerDecision.decided_at.desc())
        )
        for d in all_dec_r.scalars().all():
            if d.review_case_id not in latest_decisions:
                latest_decisions[d.review_case_id] = d
        reviewer_ids = {d.reviewer_id for d in latest_decisions.values()}
        if reviewer_ids:
            usr_r = await db.execute(select(User).where(User.id.in_(reviewer_ids)))
            users_by_id = {u.id: u for u in usr_r.scalars().all()}

    result = []
    for case in cases:
        latest_decision = latest_decisions.get(case.id)
        reviewer = users_by_id.get(latest_decision.reviewer_id) if latest_decision else None

        result.append({
            "case_id": str(case.id),
            "confidence_score": float(case.confidence_score),
            "status": case.status.value,
            "priority_level": case.priority_level or "P3",
            "created_at": case.created_at.isoformat(),
            "resolved_at": case.resolved_at.isoformat() if case.resolved_at else None,
            "decision": latest_decision.decision.value if latest_decision else None,
            "reviewer": reviewer.full_name if reviewer else None,
            "reason": latest_decision.reason if latest_decision else None,
            "resulting_ubid": latest_decision.resulting_ubid if latest_decision else None,
        })

    return {"ubid": ubid, "review_cases": result}


@router.get("/{ubid}/linked-records")
async def get_linked_records(
    ubid: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(BusinessEntity)
        .where(BusinessEntity.ubid == ubid)
        .options(selectinload(BusinessEntity.source_records))
    )
    entity = result.scalar_one_or_none()
    if not entity:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")

    return {
        "ubid": ubid,
        "records": [
            {
                "id": str(r.id),
                "department_code": r.department_code,
                "source_record_id": r.source_record_id,
                "registration_number": r.registration_number,
                "normalized_name": r.normalized_name,
                "registration_status": r.registration_status,
                "pincode": r.pincode,
                "district": r.district,
                "ingested_at": r.ingested_at,
            }
            for r in entity.source_records
        ],
    }
