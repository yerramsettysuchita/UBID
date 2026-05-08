"""Phase 3 reviewer workflow: queue, detail, decide, bulk-decide, assign, note, prioritize."""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_role
from app.core.database import get_db
from app.models.base import ReviewDecision, ReviewStatus
from app.models.entities import (
    AuditLog, BusinessEntity, ReviewCase, ReviewComment,
    ReviewerDecision, SourceRecord, User,
)
from app.services.review_ops import (
    compute_priority, compute_sla_deadline, prioritise_all_pending, resolve_approved_merge,
)

router = APIRouter(prefix="/review", tags=["review"])

# Priority display metadata
PRIORITY_META = {
    "P1": {"label": "Critical", "sla": "4 h"},
    "P2": {"label": "High",     "sla": "24 h"},
    "P3": {"label": "Normal",   "sla": "3 d"},
    "P4": {"label": "Low",      "sla": "7 d"},
}


# ── Schemas ───────────────────────────────────────────────────────────────────

class DecideRequest(BaseModel):
    decision: str
    reason: str
    confidence_agreement: bool | None = None


class BulkDecideRequest(BaseModel):
    case_ids: list[str]
    decision: str
    reason: str


class AssignRequest(BaseModel):
    reviewer_id: str


class NoteRequest(BaseModel):
    comment: str


# ── Review queue ──────────────────────────────────────────────────────────────

@router.get("/queue")
async def get_review_queue(
    status_filter: str = Query("PENDING", alias="status"),
    priority: str | None = Query(None),
    assigned_to_me: bool = Query(False),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_role("REVIEWER", "SUPERVISOR", "AUDITOR")),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(ReviewCase)
    if status_filter:
        stmt = stmt.where(ReviewCase.status == status_filter)
    if priority:
        stmt = stmt.where(ReviewCase.priority_level == priority)
    if assigned_to_me:
        stmt = stmt.where(ReviewCase.assigned_reviewer_id == current_user.id)

    count_result = await db.execute(select(func.count()).select_from(stmt.subquery()))
    total = count_result.scalar_one()

    pending_r = await db.execute(
        select(func.count(ReviewCase.id)).where(ReviewCase.status == ReviewStatus.PENDING)
    )
    escalated_r = await db.execute(
        select(func.count(ReviewCase.id)).where(ReviewCase.status == ReviewStatus.ESCALATED)
    )

    # Order: P1 first, then by confidence ASC (most ambiguous first)
    stmt = (
        stmt.order_by(ReviewCase.priority_level.asc(), ReviewCase.confidence_score.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(stmt)
    cases = result.scalars().all()

    # Batch-fetch all source records + assignees in 2 queries instead of 3×N
    record_ids: set = set()
    assignee_ids: set = set()
    for case in cases:
        record_ids.add(case.record_a_id)
        record_ids.add(case.record_b_id)
        if case.assigned_reviewer_id:
            assignee_ids.add(case.assigned_reviewer_id)

    records_by_id: dict = {}
    if record_ids:
        rec_r = await db.execute(select(SourceRecord).where(SourceRecord.id.in_(record_ids)))
        records_by_id = {r.id: r for r in rec_r.scalars().all()}

    users_by_id: dict = {}
    if assignee_ids:
        usr_r = await db.execute(select(User).where(User.id.in_(assignee_ids)))
        users_by_id = {u.id: u for u in usr_r.scalars().all()}

    now = datetime.now(timezone.utc)
    items = []
    for case in cases:
        record_a = records_by_id.get(case.record_a_id)
        record_b = records_by_id.get(case.record_b_id)
        assignee = users_by_id.get(case.assigned_reviewer_id) if case.assigned_reviewer_id else None

        sla_breach = (
            case.sla_deadline is not None and case.sla_deadline < now
            and case.status == ReviewStatus.PENDING
        )
        sla_hours_left: float | None = None
        if case.sla_deadline and case.status == ReviewStatus.PENDING:
            delta = (case.sla_deadline - now).total_seconds()
            sla_hours_left = round(delta / 3600, 1)

        items.append({
            "case_id": str(case.id),
            "confidence_score": float(case.confidence_score),
            "name_score": float(case.name_score) if case.name_score else None,
            "address_score": float(case.address_score) if case.address_score else None,
            "pan_match": case.pan_match,
            "gstin_match": case.gstin_match,
            "status": case.status.value,
            "priority_level": case.priority_level or "P3",
            "priority_label": PRIORITY_META.get(case.priority_level or "P3", {}).get("label", "Normal"),
            "sla_deadline": case.sla_deadline.isoformat() if case.sla_deadline else None,
            "sla_hours_left": sla_hours_left,
            "sla_breach": sla_breach,
            "assigned_to": assignee.full_name if assignee else None,
            "assigned_reviewer_id": str(case.assigned_reviewer_id) if case.assigned_reviewer_id else None,
            "created_at": case.created_at.isoformat(),
            "record_a": {
                "department_code": record_a.department_code if record_a else None,
                "normalized_name": record_a.normalized_name if record_a else None,
                "pincode": record_a.pincode if record_a else None,
                "registration_number": record_a.registration_number if record_a else None,
            },
            "record_b": {
                "department_code": record_b.department_code if record_b else None,
                "normalized_name": record_b.normalized_name if record_b else None,
                "pincode": record_b.pincode if record_b else None,
                "registration_number": record_b.registration_number if record_b else None,
            },
        })

    return {
        "total": total,
        "pending_count": pending_r.scalar_one(),
        "escalated_count": escalated_r.scalar_one(),
        "results": items,
    }


# ── Single case detail ────────────────────────────────────────────────────────

@router.get("/{case_id}")
async def get_review_case(
    case_id: uuid.UUID,
    current_user: User = Depends(require_role("REVIEWER", "SUPERVISOR", "AUDITOR")),
    db: AsyncSession = Depends(get_db),
):
    case = await db.get(ReviewCase, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Review case not found")

    record_a = await db.get(SourceRecord, case.record_a_id)
    record_b = await db.get(SourceRecord, case.record_b_id)

    # Load comments + decisions — batch-fetch all users in one query
    comments_r = await db.execute(
        select(ReviewComment)
        .where(ReviewComment.review_case_id == case_id)
        .order_by(ReviewComment.created_at.asc())
    )
    comments_list = comments_r.scalars().all()

    decisions_r = await db.execute(
        select(ReviewerDecision)
        .where(ReviewerDecision.review_case_id == case_id)
        .order_by(ReviewerDecision.decided_at.desc())
    )
    decisions_list = decisions_r.scalars().all()

    all_user_ids = {c.user_id for c in comments_list} | {d.reviewer_id for d in decisions_list}
    if case.assigned_reviewer_id:
        all_user_ids.add(case.assigned_reviewer_id)
    users_by_id: dict = {}
    if all_user_ids:
        usr_r = await db.execute(select(User).where(User.id.in_(all_user_ids)))
        users_by_id = {u.id: u for u in usr_r.scalars().all()}

    comments = [
        {
            "id": str(c.id),
            "comment": c.comment,
            "author": users_by_id.get(c.user_id, None) and users_by_id[c.user_id].full_name or "Unknown",
            "created_at": c.created_at.isoformat(),
        }
        for c in comments_list
    ]
    decision_history = [
        {
            "decision": d.decision.value,
            "reason": d.reason,
            "reviewer": users_by_id[d.reviewer_id].full_name if d.reviewer_id in users_by_id else "Unknown",
            "resulting_ubid": d.resulting_ubid,
            "decided_at": d.decided_at.isoformat(),
        }
        for d in decisions_list
    ]
    assignee = users_by_id.get(case.assigned_reviewer_id) if case.assigned_reviewer_id else None

    now = datetime.now(timezone.utc)
    sla_hours_left: float | None = None
    if case.sla_deadline and case.status == ReviewStatus.PENDING:
        sla_hours_left = round((case.sla_deadline - now).total_seconds() / 3600, 1)

    return {
        "case_id": str(case.id),
        "confidence_score": float(case.confidence_score),
        "name_score": float(case.name_score) if case.name_score else None,
        "address_score": float(case.address_score) if case.address_score else None,
        "pan_match": case.pan_match,
        "gstin_match": case.gstin_match,
        "status": case.status.value,
        "priority_level": case.priority_level or "P3",
        "priority_label": PRIORITY_META.get(case.priority_level or "P3", {}).get("label", "Normal"),
        "sla_deadline": case.sla_deadline.isoformat() if case.sla_deadline else None,
        "sla_hours_left": sla_hours_left,
        "sla_breach": case.sla_deadline is not None and case.sla_deadline < now,
        "assigned_to": assignee.full_name if assignee else None,
        "assigned_reviewer_id": str(case.assigned_reviewer_id) if case.assigned_reviewer_id else None,
        # Phase 2 JSONB evidence — used directly by the frontend EvidencePanel
        "evidence": case.evidence,
        "record_a": _format_source_record(record_a),
        "record_b": _format_source_record(record_b),
        "comments": comments,
        "decision_history": decision_history,
        "created_at": case.created_at.isoformat(),
        "resolved_at": case.resolved_at.isoformat() if case.resolved_at else None,
    }


# ── Decide (single) ───────────────────────────────────────────────────────────

@router.post("/{case_id}/decide")
async def decide_review_case(
    case_id: uuid.UUID,
    body: DecideRequest,
    current_user: User = Depends(require_role("REVIEWER", "SUPERVISOR")),
    db: AsyncSession = Depends(get_db),
):
    case = await db.get(ReviewCase, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Review case not found")
    if case.status not in (ReviewStatus.PENDING, ReviewStatus.ESCALATED):
        raise HTTPException(status_code=400, detail="Case is already resolved")

    decision = ReviewDecision(body.decision)
    resulting_ubid = None

    if decision == ReviewDecision.APPROVED_MERGE:
        resulting_ubid = await resolve_approved_merge(db, case, decision, current_user.id, body.reason)
        case.status = ReviewStatus.APPROVED
    elif decision == ReviewDecision.REJECTED_MERGE:
        case.status = ReviewStatus.REJECTED
    else:
        case.status = ReviewStatus.ESCALATED

    case.resolved_at = datetime.now(timezone.utc)

    db.add(ReviewerDecision(
        review_case_id=case.id,
        reviewer_id=current_user.id,
        decision=decision,
        reason=body.reason,
        resulting_ubid=resulting_ubid,
        confidence_agreement=body.confidence_agreement,
    ))
    db.add(AuditLog(
        user_id=current_user.id,
        action=f"REVIEW_{decision.value}",
        entity_type="review_case",
        entity_id=case.id,
        new_value={"decision": decision.value, "resulting_ubid": resulting_ubid},
    ))
    await db.commit()

    return {
        "case_id": str(case_id),
        "decision": decision.value,
        "resulting_ubid": resulting_ubid,
        "message": f"Decision recorded.{f' UBID {resulting_ubid} updated.' if resulting_ubid else ' Records kept separate.'}",
    }


# ── Bulk decide ───────────────────────────────────────────────────────────────

@router.post("/bulk-decide")
async def bulk_decide(
    body: BulkDecideRequest,
    current_user: User = Depends(require_role("REVIEWER", "SUPERVISOR")),
    db: AsyncSession = Depends(get_db),
):
    decision = ReviewDecision(body.decision)
    processed, skipped = 0, 0

    # Batch-fetch all cases in one query
    case_uuids = [uuid.UUID(c) for c in body.case_ids]
    bulk_r = await db.execute(select(ReviewCase).where(ReviewCase.id.in_(case_uuids)))
    cases_map = {c.id: c for c in bulk_r.scalars().all()}

    for cid_str in body.case_ids:
        cid = uuid.UUID(cid_str)
        case = cases_map.get(cid)
        if not case or case.status not in (ReviewStatus.PENDING, ReviewStatus.ESCALATED):
            skipped += 1
            continue

        resulting_ubid = None
        if decision == ReviewDecision.APPROVED_MERGE:
            resulting_ubid = await resolve_approved_merge(db, case, decision, current_user.id, body.reason)
            case.status = ReviewStatus.APPROVED
        elif decision == ReviewDecision.REJECTED_MERGE:
            case.status = ReviewStatus.REJECTED
        else:
            case.status = ReviewStatus.ESCALATED

        case.resolved_at = datetime.now(timezone.utc)
        db.add(ReviewerDecision(
            review_case_id=case.id,
            reviewer_id=current_user.id,
            decision=decision,
            reason=body.reason,
            resulting_ubid=resulting_ubid,
        ))
        processed += 1

    db.add(AuditLog(
        user_id=current_user.id,
        action=f"BULK_{decision.value}",
        entity_type="review_case",
        entity_id=None,
        new_value={"case_ids": body.case_ids, "decision": decision.value, "processed": processed},
    ))
    await db.commit()

    return {"processed": processed, "skipped": skipped, "decision": decision.value}


# ── Assign ────────────────────────────────────────────────────────────────────

@router.post("/{case_id}/assign")
async def assign_case(
    case_id: uuid.UUID,
    body: AssignRequest,
    current_user: User = Depends(require_role("SUPERVISOR", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    case = await db.get(ReviewCase, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Review case not found")

    reviewer = await db.get(User, uuid.UUID(body.reviewer_id))
    if not reviewer:
        raise HTTPException(status_code=404, detail="Reviewer not found")

    case.assigned_reviewer_id = reviewer.id
    case.assigned_at = datetime.now(timezone.utc)

    db.add(AuditLog(
        user_id=current_user.id,
        action="CASE_ASSIGNED",
        entity_type="review_case",
        entity_id=case_id,
        new_value={"assigned_to": str(reviewer.id), "reviewer_name": reviewer.full_name},
    ))
    await db.commit()

    return {"case_id": str(case_id), "assigned_to": reviewer.full_name, "message": "Case assigned."}


# ── Note / comment ────────────────────────────────────────────────────────────

@router.post("/{case_id}/note")
async def add_note(
    case_id: uuid.UUID,
    body: NoteRequest,
    current_user: User = Depends(require_role("REVIEWER", "SUPERVISOR", "AUDITOR")),
    db: AsyncSession = Depends(get_db),
):
    case = await db.get(ReviewCase, case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Review case not found")

    comment = ReviewComment(
        review_case_id=case_id,
        user_id=current_user.id,
        comment=body.comment,
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)

    return {
        "comment_id": str(comment.id),
        "comment": comment.comment,
        "author": current_user.full_name,
        "created_at": comment.created_at.isoformat(),
    }


# ── Prioritize all pending ────────────────────────────────────────────────────

@router.post("/prioritize")
async def run_prioritization(
    current_user: User = Depends(require_role("SUPERVISOR", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    updated = await prioritise_all_pending(db)
    return {"updated": updated, "message": f"Priority and SLA updated for {updated} cases."}


# ── Reviewers list (for assignment dropdown) ──────────────────────────────────

@router.get("/reviewers/list")
async def list_reviewers(
    current_user: User = Depends(require_role("SUPERVISOR", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).where(
            User.is_active == True,
            User.role.in_(["REVIEWER", "SUPERVISOR"]),
        )
    )
    users = result.scalars().all()
    return [{"id": str(u.id), "full_name": u.full_name, "role": u.role.value} for u in users]


# ── helpers ───────────────────────────────────────────────────────────────────

def _format_source_record(record: SourceRecord | None) -> dict | None:
    if not record:
        return None
    return {
        "id": str(record.id),
        "department_code": record.department_code,
        "source_record_id": record.source_record_id,
        "normalized_name": record.normalized_name,
        "raw_name": record.raw_name,
        "registration_number": record.registration_number,
        "registration_status": record.registration_status,
        "owner_name": record.owner_name,
        "normalized_address": record.normalized_address,
        "pincode": record.pincode,
        "district": record.district,
        "pan": record.pan,
        "gstin": record.gstin,
    }
