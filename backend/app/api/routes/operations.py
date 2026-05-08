"""Phase 3: operations metrics, cluster management, reviewer workload."""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_role
from app.core.database import get_db
from app.models.base import ClusterAction, ClusterStatus, PriorityLevel, ReviewStatus
from app.models.entities import (
    AuditLog, BusinessEntity, ClusterHistory, ClusterMember, ReviewCase,
    ReviewerDecision, SourceRecord, UBIDCluster, User,
)

router = APIRouter(prefix="/operations", tags=["operations"])


# ── /operations/metrics ───────────────────────────────────────────────────────

@router.get("/metrics")
async def get_operations_metrics(
    current_user: User = Depends(require_role("SUPERVISOR", "ADMIN", "AUDITOR")),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)

    # SLA breaches — PENDING cases past their deadline
    sla_breach_r = await db.execute(
        select(func.count(ReviewCase.id)).where(
            ReviewCase.status == ReviewStatus.PENDING,
            ReviewCase.sla_deadline != None,
            ReviewCase.sla_deadline < now,
        )
    )
    sla_breach_count = sla_breach_r.scalar_one()

    # Priority breakdown
    priority_rows = await db.execute(
        select(ReviewCase.priority_level, func.count(ReviewCase.id))
        .where(ReviewCase.status == ReviewStatus.PENDING)
        .group_by(ReviewCase.priority_level)
    )
    priority_dist: dict[str, int] = {}
    for lvl, cnt in priority_rows:
        priority_dist[lvl or "P3"] = cnt

    # Reviewer workload (top 10 assigned reviewers)
    workload_rows = await db.execute(
        select(ReviewCase.assigned_reviewer_id, func.count(ReviewCase.id))
        .where(
            ReviewCase.status == ReviewStatus.PENDING,
            ReviewCase.assigned_reviewer_id != None,
        )
        .group_by(ReviewCase.assigned_reviewer_id)
        .order_by(func.count(ReviewCase.id).desc())
        .limit(10)
    )
    workload_raw = workload_rows.all()

    # Batch-fetch reviewer names for workload
    reviewer_ids = [r[0] for r in workload_raw]
    users_map: dict = {}
    if reviewer_ids:
        usr_r = await db.execute(select(User).where(User.id.in_(reviewer_ids)))
        users_map = {u.id: u for u in usr_r.scalars().all()}
    workload = [
        {"reviewer_id": str(rid), "reviewer_name": users_map.get(rid, None) and users_map[rid].full_name or "Unknown", "pending_cases": cnt}
        for rid, cnt in workload_raw
    ]

    # Combine pending/escalated + cluster counts in one pass
    status_counts_r = await db.execute(
        select(ReviewCase.status, func.count(ReviewCase.id))
        .where(ReviewCase.status.in_([ReviewStatus.PENDING, ReviewStatus.ESCALATED]))
        .group_by(ReviewCase.status)
    )
    status_counts = {s.value: c for s, c in status_counts_r}

    cluster_counts_r = await db.execute(
        select(UBIDCluster.status, func.count(UBIDCluster.id))
        .group_by(UBIDCluster.status)
    )
    cluster_counts = {str(s): c for s, c in cluster_counts_r}

    # Recent decisions — batch-fetch reviewer names
    recent_r = await db.execute(
        select(ReviewerDecision)
        .order_by(ReviewerDecision.decided_at.desc())
        .limit(10)
    )
    recent_list = recent_r.scalars().all()
    dec_reviewer_ids = {d.reviewer_id for d in recent_list}
    if dec_reviewer_ids - set(users_map.keys()):
        extra_r = await db.execute(select(User).where(User.id.in_(dec_reviewer_ids)))
        for u in extra_r.scalars().all():
            users_map[u.id] = u
    recent_decisions = [
        {
            "decision_id": str(d.id),
            "case_id": str(d.review_case_id),
            "decision": d.decision.value,
            "reviewer": users_map[d.reviewer_id].full_name if d.reviewer_id in users_map else "Unknown",
            "decided_at": d.decided_at.isoformat(),
            "resulting_ubid": d.resulting_ubid,
        }
        for d in recent_list
    ]

    return {
        "sla_breach_count": sla_breach_count,
        "priority_distribution": priority_dist,
        "reviewer_workload": workload,
        "total_pending": status_counts.get("PENDING", 0),
        "total_escalated": status_counts.get("ESCALATED", 0),
        "recent_decisions": recent_decisions,
        "cluster_stats": {
            "total": sum(cluster_counts.values()),
            "active": cluster_counts.get("ACTIVE", 0),
        },
    }


# ── /operations/clusters ──────────────────────────────────────────────────────

@router.get("/clusters")
async def list_clusters(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: str | None = Query(None, alias="status"),
    current_user: User = Depends(require_role("SUPERVISOR", "ADMIN", "AUDITOR", "REVIEWER")),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(UBIDCluster).order_by(UBIDCluster.created_at.desc())
    if status_filter:
        stmt = stmt.where(UBIDCluster.status == status_filter)

    count_r = await db.execute(select(func.count()).select_from(stmt.subquery()))
    total = count_r.scalar_one()

    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    clusters = result.scalars().all()

    return {
        "total": total,
        "results": [_format_cluster(c) for c in clusters],
    }


@router.get("/clusters/{cluster_id}")
async def get_cluster(
    cluster_id: uuid.UUID,
    current_user: User = Depends(require_role("SUPERVISOR", "ADMIN", "AUDITOR", "REVIEWER")),
    db: AsyncSession = Depends(get_db),
):
    cluster = await db.get(UBIDCluster, cluster_id)
    if not cluster:
        raise HTTPException(status_code=404, detail="Cluster not found")

    members_r = await db.execute(
        select(ClusterMember).where(ClusterMember.cluster_id == cluster_id)
    )
    members = members_r.scalars().all()
    member_details = []
    for m in members:
        rec = await db.get(SourceRecord, m.source_record_id)
        member_details.append({
            "source_record_id": str(m.source_record_id),
            "department_code": rec.department_code if rec else None,
            "normalized_name": rec.normalized_name if rec else None,
            "pan": rec.pan if rec else None,
            "gstin": rec.gstin if rec else None,
            "pincode": rec.pincode if rec else None,
            "added_at": m.added_at.isoformat(),
        })

    history_r = await db.execute(
        select(ClusterHistory)
        .where(ClusterHistory.cluster_id == cluster_id)
        .order_by(ClusterHistory.created_at.desc())
        .limit(20)
    )
    history = []
    for h in history_r.scalars().all():
        actor = await db.get(User, h.performed_by) if h.performed_by else None
        history.append({
            "action": h.action.value,
            "performed_by": actor.full_name if actor else "System",
            "note": h.note,
            "created_at": h.created_at.isoformat(),
        })

    return {
        **_format_cluster(cluster),
        "members": member_details,
        "history": history,
    }


# ── cluster split ─────────────────────────────────────────────────────────────

class SplitRequest(BaseModel):
    group_a_record_ids: list[str]
    group_b_record_ids: list[str]
    reason: str


@router.post("/clusters/{cluster_id}/split")
async def split_cluster(
    cluster_id: uuid.UUID,
    body: SplitRequest,
    current_user: User = Depends(require_role("SUPERVISOR", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    cluster = await db.get(UBIDCluster, cluster_id)
    if not cluster:
        raise HTTPException(status_code=404, detail="Cluster not found")
    if cluster.status != ClusterStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Only ACTIVE clusters can be split")

    before_state = _format_cluster(cluster)

    # Mark old cluster as SPLIT
    cluster.status = ClusterStatus.SPLIT

    # Create two new child clusters
    new_clusters = []
    for i, group_ids in enumerate([body.group_a_record_ids, body.group_b_record_ids], 1):
        child_ubid = f"{cluster.ubid}-S{i}" if cluster.ubid else f"UBID-SPLIT-{str(uuid.uuid4())[:8].upper()}"
        child = UBIDCluster(
            cluster_key=f"split-{cluster_id}-{i}",
            ubid=child_ubid,
            status=ClusterStatus.ACTIVE,
            er_run_id=cluster.er_run_id,
            canonical_name=cluster.canonical_name,
            canonical_pan=cluster.canonical_pan if i == 1 else None,
            canonical_gstin=cluster.canonical_gstin if i == 1 else None,
            primary_pincode=cluster.primary_pincode,
            district=cluster.district,
            member_count=len(group_ids),
            confidence_score=cluster.confidence_score,
        )
        db.add(child)
        await db.flush()

        for rid_str in group_ids:
            rid = uuid.UUID(rid_str)
            member = ClusterMember(
                cluster_id=child.id,
                source_record_id=rid,
                er_run_id=cluster.er_run_id,
            )
            db.add(member)
            rec = await db.get(SourceRecord, rid)
            if rec:
                rec.resolution_status = "LINKED"  # type: ignore[assignment]

        new_clusters.append(child_ubid)

    # Cluster history entry
    hist = ClusterHistory(
        cluster_id=cluster_id,
        action=ClusterAction.SPLIT,
        performed_by=current_user.id,
        before_state=before_state,
        after_state={"split_into": new_clusters, "reason": body.reason},
        note=body.reason,
    )
    db.add(hist)

    audit = AuditLog(
        user_id=current_user.id,
        action="CLUSTER_SPLIT",
        entity_type="ubid_cluster",
        entity_id=cluster_id,
        old_value=before_state,
        new_value={"split_into": new_clusters},
    )
    db.add(audit)

    await db.commit()
    return {"message": f"Cluster split into {new_clusters}", "original_cluster_id": str(cluster_id)}


# ── cluster merge ─────────────────────────────────────────────────────────────

class MergeRequest(BaseModel):
    target_cluster_id: str
    reason: str


@router.post("/clusters/{cluster_id}/merge")
async def merge_clusters(
    cluster_id: uuid.UUID,
    body: MergeRequest,
    current_user: User = Depends(require_role("SUPERVISOR", "ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    source = await db.get(UBIDCluster, cluster_id)
    target = await db.get(UBIDCluster, uuid.UUID(body.target_cluster_id))

    if not source or not target:
        raise HTTPException(status_code=404, detail="One or both clusters not found")
    if source.status != ClusterStatus.ACTIVE or target.status != ClusterStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Both clusters must be ACTIVE to merge")

    before_source = _format_cluster(source)
    before_target = _format_cluster(target)

    # Move all members of source into target
    members_r = await db.execute(
        select(ClusterMember).where(ClusterMember.cluster_id == cluster_id)
    )
    moved = 0
    for m in members_r.scalars().all():
        m.cluster_id = target.id
        moved += 1

    target.member_count = (target.member_count or 0) + moved
    source.status = ClusterStatus.MERGED

    # History on both
    for cid, before in [(cluster_id, before_source), (target.id, before_target)]:
        hist = ClusterHistory(
            cluster_id=cid,
            action=ClusterAction.MERGED,
            performed_by=current_user.id,
            before_state=before,
            after_state={"merged_with": str(target.id), "reason": body.reason},
            note=body.reason,
        )
        db.add(hist)

    audit = AuditLog(
        user_id=current_user.id,
        action="CLUSTER_MERGE",
        entity_type="ubid_cluster",
        entity_id=cluster_id,
        old_value=before_source,
        new_value={"merged_into": str(target.id)},
    )
    db.add(audit)

    await db.commit()
    return {
        "message": f"Merged cluster {cluster_id} into {target.id}",
        "target_ubid": target.ubid,
        "members_moved": moved,
    }


# ── helpers ───────────────────────────────────────────────────────────────────

def _format_cluster(c: UBIDCluster) -> dict:
    return {
        "cluster_id": str(c.id),
        "ubid": c.ubid,
        "status": c.status.value,
        "canonical_name": c.canonical_name,
        "canonical_pan": c.canonical_pan,
        "canonical_gstin": c.canonical_gstin,
        "primary_pincode": c.primary_pincode,
        "district": c.district,
        "member_count": c.member_count,
        "dept_count": c.dept_count,
        "confidence_score": float(c.confidence_score),
        "created_at": c.created_at.isoformat(),
    }
