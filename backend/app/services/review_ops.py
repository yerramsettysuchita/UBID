"""Phase 3: reviewer workflow helpers — priority scoring, SLA, assignment, re-resolution."""
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import ClusterAction, ClusterStatus, PriorityLevel, ReviewDecision, ReviewStatus
from app.models.entities import (
    AuditLog, BusinessEntity, ClusterHistory, ClusterMember, ReviewCase,
    ReviewComment, ReviewerDecision, SourceRecord, UBIDCluster,
)


# ── Priority scoring ──────────────────────────────────────────────────────────

def compute_priority(case: ReviewCase, rec_a: SourceRecord, rec_b: SourceRecord) -> str:
    score = 0
    conf = float(case.confidence_score)

    # Near auto-match threshold is most actionable
    if 0.75 <= conf < 0.85:
        score += 3
    elif 0.60 <= conf < 0.75:
        score += 2
    elif conf < 0.60:
        score += 1

    # Identifier signals
    if case.pan_match:
        score += 3
    if case.gstin_match:
        score += 2

    # Cross-department match is higher value
    if rec_a.department_code != rec_b.department_code:
        score += 2

    # FACTORIES records have regulatory importance
    depts = {rec_a.department_code, rec_b.department_code}
    if "FACTORIES" in depts:
        score += 1
    if "KSPCB" in depts:
        score += 1

    if score >= 8:
        return PriorityLevel.P1.value
    if score >= 5:
        return PriorityLevel.P2.value
    if score >= 2:
        return PriorityLevel.P3.value
    return PriorityLevel.P4.value


SLA_DELTAS = {
    PriorityLevel.P1.value: timedelta(hours=4),
    PriorityLevel.P2.value: timedelta(hours=24),
    PriorityLevel.P3.value: timedelta(days=3),
    PriorityLevel.P4.value: timedelta(days=7),
}


def compute_sla_deadline(priority: str) -> datetime:
    return datetime.now(timezone.utc) + SLA_DELTAS.get(priority, timedelta(days=3))


# ── Batch prioritise all PENDING cases ───────────────────────────────────────

async def prioritise_all_pending(db: AsyncSession) -> int:
    result = await db.execute(
        select(ReviewCase).where(ReviewCase.status == ReviewStatus.PENDING)
    )
    cases = result.scalars().all()

    updated = 0
    for case in cases:
        rec_a = await db.get(SourceRecord, case.record_a_id)
        rec_b = await db.get(SourceRecord, case.record_b_id)
        if not rec_a or not rec_b:
            continue
        p = compute_priority(case, rec_a, rec_b)
        if case.priority_level != p or case.sla_deadline is None:
            case.priority_level = p
            case.sla_deadline = compute_sla_deadline(p)
            updated += 1

    await db.commit()
    return updated


# ── Re-resolution after APPROVED_MERGE ───────────────────────────────────────

async def resolve_approved_merge(
    db: AsyncSession,
    case: ReviewCase,
    decision: ReviewDecision,
    reviewer_id: uuid.UUID,
    reason: str,
) -> str | None:
    """Link both source records to a BusinessEntity and update cluster. Returns resulting_ubid."""
    if decision != ReviewDecision.APPROVED_MERGE:
        return None

    rec_a = await db.get(SourceRecord, case.record_a_id)
    rec_b = await db.get(SourceRecord, case.record_b_id)
    if not rec_a or not rec_b:
        return None

    pan = rec_a.pan or rec_b.pan
    gstin = rec_a.gstin or rec_b.gstin

    if pan:
        ubid = f"UBID-PAN-{pan}"
    elif gstin:
        ubid = f"UBID-GST-{gstin[:10]}"
    else:
        ubid = f"UBID-{str(uuid.uuid4())[:8].upper()}"

    # Upsert BusinessEntity
    entity_r = await db.execute(select(BusinessEntity).where(BusinessEntity.ubid == ubid))
    entity = entity_r.scalar_one_or_none()
    if not entity:
        entity = BusinessEntity(
            ubid=ubid,
            canonical_name=rec_a.normalized_name or rec_b.normalized_name or "Unknown",
            canonical_pan=pan,
            canonical_gstin=gstin,
            primary_pincode=rec_a.pincode or rec_b.pincode,
            district=rec_a.district or rec_b.district,
            confidence_score=float(case.confidence_score),
        )
        db.add(entity)
        await db.flush()

    for rec in [rec_a, rec_b]:
        if rec:
            rec.business_entity_id = entity.id
            rec.resolution_status = "LINKED"  # type: ignore[assignment]

    entity.linked_records_count = (entity.linked_records_count or 0) + 2
    depts = {r.department_code for r in [rec_a, rec_b] if r}
    entity.dept_count = len(depts)

    # Try to associate with an existing cluster
    cluster_r = await db.execute(
        select(UBIDCluster).where(UBIDCluster.ubid == ubid)
    )
    cluster = cluster_r.scalar_one_or_none()
    if cluster:
        before = {"member_count": cluster.member_count, "status": cluster.status.value}
        cluster.member_count = (cluster.member_count or 0) + 2
        cluster.status = ClusterStatus.ACTIVE
        hist = ClusterHistory(
            cluster_id=cluster.id,
            action=ClusterAction.MEMBER_ADDED,
            performed_by=reviewer_id,
            before_state=before,
            after_state={"member_count": cluster.member_count, "status": ClusterStatus.ACTIVE.value},
            note=f"Reviewer merge approved: {reason[:200]}",
        )
        db.add(hist)

    return ubid
