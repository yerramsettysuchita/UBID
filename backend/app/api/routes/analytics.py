"""Phase 4: analytics, pincode intelligence, district/department coverage, trends."""
from __future__ import annotations

import csv
import io
import json
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import case, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.base import BusinessStatus, ERRunStatus, EventType, PairDecision, ResolutionStatus, ReviewStatus
from app.models.entities import (
    BusinessEntity, BusinessEvent, Department, ERCandidatePair, ERRun,
    ReviewCase, ReviewerDecision, SourceRecord, UBIDCluster, User,
)

router = APIRouter(prefix="/analytics", tags=["analytics"])


# ── helpers ───────────────────────────────────────────────────────────────────

def _status_split(entities: list) -> dict:
    counts: dict[str, int] = {s.value: 0 for s in BusinessStatus}
    for e in entities:
        counts[e.status.value] = counts.get(e.status.value, 0) + 1
    return counts


async def _dept_split_for_entities(db: AsyncSession, entity_ids: list) -> dict[str, int]:
    if not entity_ids:
        return {}
    rows = await db.execute(
        select(SourceRecord.department_code, func.count(SourceRecord.id))
        .where(SourceRecord.business_entity_id.in_(entity_ids))
        .group_by(SourceRecord.department_code)
    )
    return {r[0]: r[1] for r in rows}


async def _pending_review_count_for_entities(db: AsyncSession, entity_ids: list) -> int:
    if not entity_ids:
        return 0
    rec_r = await db.execute(
        select(SourceRecord.id).where(SourceRecord.business_entity_id.in_(entity_ids))
    )
    rec_ids = [r[0] for r in rec_r]
    if not rec_ids:
        return 0
    from sqlalchemy import or_
    cnt_r = await db.execute(
        select(func.count(ReviewCase.id)).where(
            ReviewCase.status.in_([ReviewStatus.PENDING, ReviewStatus.ESCALATED]),
            or_(
                ReviewCase.record_a_id.in_(rec_ids),
                ReviewCase.record_b_id.in_(rec_ids),
            ),
        )
    )
    return cnt_r.scalar_one()


# ── 1. Pincode full intelligence ──────────────────────────────────────────────

@router.get("/pincode/{code}")
async def pincode_intelligence(
    code: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    entities_r = await db.execute(
        select(BusinessEntity).where(
            BusinessEntity.primary_pincode == code,
            BusinessEntity.is_active == True,
        )
    )
    entities = entities_r.scalars().all()

    total = len(entities)
    if total == 0:
        return {"pincode": code, "total_businesses": 0, "message": "No businesses found for this pincode."}

    status_split = _status_split(entities)
    entity_ids = [e.id for e in entities]
    dept_split = await _dept_split_for_entities(db, entity_ids)
    pending_review = await _pending_review_count_for_entities(db, entity_ids)

    # Recent events
    events_r = await db.execute(
        select(BusinessEvent)
        .where(BusinessEvent.business_entity_id.in_(entity_ids))
        .order_by(BusinessEvent.event_date.desc())
        .limit(10)
    )
    recent_events = [
        {
            "event_type": e.event_type.value,
            "event_date": str(e.event_date),
            "department_code": e.department_code,
            "event_description": e.event_description,
        }
        for e in events_r.scalars().all()
    ]

    # Top businesses by confidence
    top_businesses = sorted(entities, key=lambda e: float(e.confidence_score), reverse=True)[:5]

    # Districts represented
    districts = list({e.district for e in entities if e.district})

    # Dormancy rate
    dormant_rate = round(status_split.get("DORMANT", 0) / total * 100, 1) if total else 0
    active_rate = round(status_split.get("ACTIVE", 0) / total * 100, 1) if total else 0

    # Risk score (0-100): high dormant + high review + low active = risky
    risk_score = min(100, round(
        dormant_rate * 0.4 +
        (status_split.get("REVIEW_NEEDED", 0) / total * 100) * 0.3 +
        (pending_review / max(total, 1) * 100) * 0.3
    ))

    return {
        "pincode": code,
        "districts": districts,
        "total_businesses": total,
        "status_split": status_split,
        "active_rate_pct": active_rate,
        "dormant_rate_pct": dormant_rate,
        "risk_score": risk_score,
        "dept_split": dept_split,
        "pending_review_cases": pending_review,
        "recent_events": recent_events,
        "top_businesses": [
            {
                "ubid": e.ubid,
                "canonical_name": e.canonical_name,
                "status": e.status.value,
                "confidence_score": float(e.confidence_score),
            }
            for e in top_businesses
        ],
    }


@router.get("/pincode/{code}/businesses")
async def pincode_businesses(
    code: str,
    status: str | None = Query(None),
    department: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(BusinessEntity).where(
        BusinessEntity.primary_pincode == code,
        BusinessEntity.is_active == True,
    )
    if status:
        stmt = stmt.where(BusinessEntity.status == status)

    if department:
        sub = select(SourceRecord.business_entity_id).where(
            SourceRecord.department_code == department,
            SourceRecord.business_entity_id != None,
        ).scalar_subquery()
        stmt = stmt.where(BusinessEntity.id.in_(sub))

    count_r = await db.execute(select(func.count()).select_from(stmt.subquery()))
    total = count_r.scalar_one()

    stmt = stmt.order_by(BusinessEntity.status.asc(), BusinessEntity.canonical_name.asc())
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    entities = result.scalars().all()

    return {
        "total": total,
        "pincode": code,
        "results": [
            {
                "ubid": e.ubid,
                "canonical_name": e.canonical_name,
                "status": e.status.value,
                "district": e.district,
                "confidence_score": float(e.confidence_score),
            }
            for e in entities
        ],
    }


@router.get("/pincode/{code}/compare/{other_code}")
async def compare_pincodes(
    code: str,
    other_code: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    async def _summary(pincode: str) -> dict:
        r = await db.execute(
            select(BusinessEntity).where(
                BusinessEntity.primary_pincode == pincode,
                BusinessEntity.is_active == True,
            )
        )
        ents = r.scalars().all()
        n = len(ents)
        if n == 0:
            return {"pincode": pincode, "total": 0}
        split = _status_split(ents)
        eids = [e.id for e in ents]
        dept = await _dept_split_for_entities(db, eids)
        pr = await _pending_review_count_for_entities(db, eids)
        return {
            "pincode": pincode,
            "total": n,
            "status_split": split,
            "active_rate_pct": round(split.get("ACTIVE", 0) / n * 100, 1),
            "dormant_rate_pct": round(split.get("DORMANT", 0) / n * 100, 1),
            "dept_split": dept,
            "pending_review_cases": pr,
        }

    a, b = await _summary(code), await _summary(other_code)
    return {"pincode_a": a, "pincode_b": b}


# ── 2. District analytics ─────────────────────────────────────────────────────

@router.get("/districts")
async def list_districts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = await db.execute(
        select(
            BusinessEntity.district,
            func.count(BusinessEntity.id).label("total"),
            func.sum(case((BusinessEntity.status == BusinessStatus.ACTIVE, 1), else_=0)).label("active"),
            func.sum(case((BusinessEntity.status == BusinessStatus.DORMANT, 1), else_=0)).label("dormant"),
            func.sum(case((BusinessEntity.status == BusinessStatus.CLOSED, 1), else_=0)).label("closed"),
            func.sum(case((BusinessEntity.status == BusinessStatus.REVIEW_NEEDED, 1), else_=0)).label("review_needed"),
        )
        .where(BusinessEntity.is_active == True, BusinessEntity.district != None)
        .group_by(BusinessEntity.district)
        .order_by(func.count(BusinessEntity.id).desc())
    )
    districts = []
    for r in rows:
        n = r[1] or 1
        dormant_rate = round((r[3] or 0) / n * 100, 1)
        # mini risk: dormant-heavy + review-heavy = risky
        risk = min(100, round(dormant_rate * 0.5 + ((r[4] or 0) / n * 100) * 0.5))
        districts.append({
            "district": r[0],
            "total": r[1],
            "active": r[2] or 0,
            "dormant": r[3] or 0,
            "closed": r[4] or 0,
            "review_needed": r[5] or 0,
            "active_rate_pct": round((r[2] or 0) / n * 100, 1),
            "dormant_rate_pct": dormant_rate,
            "risk_score": risk,
        })
    return {"districts": districts, "total_districts": len(districts)}


@router.get("/districts/{name}")
async def district_detail(
    name: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    entities_r = await db.execute(
        select(BusinessEntity).where(
            BusinessEntity.district.ilike(f"%{name}%"),
            BusinessEntity.is_active == True,
        )
    )
    entities = entities_r.scalars().all()
    if not entities:
        raise HTTPException(status_code=404, detail="District not found")

    total = len(entities)
    status_split = _status_split(entities)
    entity_ids = [e.id for e in entities]
    dept_split = await _dept_split_for_entities(db, entity_ids)
    pending_review = await _pending_review_count_for_entities(db, entity_ids)

    # Pincodes in this district
    pincode_rows = await db.execute(
        select(BusinessEntity.primary_pincode, func.count(BusinessEntity.id))
        .where(
            BusinessEntity.district.ilike(f"%{name}%"),
            BusinessEntity.is_active == True,
            BusinessEntity.primary_pincode != None,
        )
        .group_by(BusinessEntity.primary_pincode)
        .order_by(func.count(BusinessEntity.id).desc())
    )
    pincodes = [{"pincode": r[0], "count": r[1]} for r in pincode_rows]

    return {
        "district": name,
        "total_businesses": total,
        "status_split": status_split,
        "active_rate_pct": round(status_split.get("ACTIVE", 0) / total * 100, 1),
        "dormant_rate_pct": round(status_split.get("DORMANT", 0) / total * 100, 1),
        "dept_split": dept_split,
        "pending_review_cases": pending_review,
        "pincodes": pincodes[:15],
    }


# ── 3. Supervisory overview ───────────────────────────────────────────────────

@router.get("/overview")
async def supervisor_overview(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)

    # Business totals
    total_r = await db.execute(select(func.count(BusinessEntity.id)).where(BusinessEntity.is_active == True))
    total = total_r.scalar_one()

    status_rows = await db.execute(
        select(BusinessEntity.status, func.count(BusinessEntity.id))
        .where(BusinessEntity.is_active == True)
        .group_by(BusinessEntity.status)
    )
    status_dist = {r[0].value: r[1] for r in status_rows}

    # Review metrics
    pending_r = await db.execute(
        select(func.count(ReviewCase.id)).where(ReviewCase.status == ReviewStatus.PENDING)
    )
    sla_breach_r = await db.execute(
        select(func.count(ReviewCase.id)).where(
            ReviewCase.status == ReviewStatus.PENDING,
            ReviewCase.sla_deadline != None,
            ReviewCase.sla_deadline < now,
        )
    )
    p1_r = await db.execute(
        select(func.count(ReviewCase.id)).where(
            ReviewCase.status == ReviewStatus.PENDING,
            ReviewCase.priority_level == "P1",
        )
    )

    # Cluster stats
    cluster_r = await db.execute(
        select(func.count(UBIDCluster.id)).where(UBIDCluster.status == "ACTIVE")
    )

    # ER latest
    er_r = await db.execute(
        select(ERRun).where(ERRun.status == ERRunStatus.COMPLETED).order_by(ERRun.completed_at.desc()).limit(1)
    )
    latest_er = er_r.scalar_one_or_none()

    # Top 5 hotspot districts (by REVIEW_NEEDED)
    hotspot_rows = await db.execute(
        select(BusinessEntity.district, func.count(BusinessEntity.id))
        .where(BusinessEntity.is_active == True, BusinessEntity.status == BusinessStatus.REVIEW_NEEDED)
        .group_by(BusinessEntity.district)
        .order_by(func.count(BusinessEntity.id).desc())
        .limit(5)
    )
    hotspots = [{"district": r[0], "review_needed": r[1]} for r in hotspot_rows]

    # Top 5 pincodes by business count
    top_pincodes_rows = await db.execute(
        select(BusinessEntity.primary_pincode, func.count(BusinessEntity.id))
        .where(BusinessEntity.is_active == True, BusinessEntity.primary_pincode != None)
        .group_by(BusinessEntity.primary_pincode)
        .order_by(func.count(BusinessEntity.id).desc())
        .limit(8)
    )
    top_pincodes = [{"pincode": r[0], "count": r[1]} for r in top_pincodes_rows]

    return {
        "total_businesses": total,
        "status_distribution": status_dist,
        "active_rate_pct": round(status_dist.get("ACTIVE", 0) / max(total, 1) * 100, 1),
        "review_metrics": {
            "pending": pending_r.scalar_one(),
            "sla_breaches": sla_breach_r.scalar_one(),
            "p1_critical": p1_r.scalar_one(),
        },
        "cluster_stats": {
            "active_clusters": cluster_r.scalar_one(),
        },
        "er_latest": {
            "run_key": latest_er.run_key if latest_er else None,
            "auto_matched": latest_er.auto_matched if latest_er else 0,
            "clusters_created": latest_er.clusters_created if latest_er else 0,
        } if latest_er else None,
        "hotspot_districts": hotspots,
        "top_pincodes": top_pincodes,
    }


# ── 4. Trends (derived from timestamps) ──────────────────────────────────────

@router.get("/trends")
async def analytics_trends(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Review cases created per day (last 14 days)
    cutoff = datetime.now(timezone.utc) - timedelta(days=14)
    cases_rows = await db.execute(
        select(
            func.date_trunc("day", ReviewCase.created_at).label("day"),
            func.count(ReviewCase.id),
        )
        .where(ReviewCase.created_at >= cutoff)
        .group_by(text("day"))
        .order_by(text("day"))
    )
    cases_trend = [{"day": str(r[0])[:10], "count": r[1]} for r in cases_rows]

    # Decisions per day (last 14 days)
    dec_rows = await db.execute(
        select(
            func.date_trunc("day", ReviewerDecision.decided_at).label("day"),
            func.count(ReviewerDecision.id),
        )
        .where(ReviewerDecision.decided_at >= cutoff)
        .group_by(text("day"))
        .order_by(text("day"))
    )
    decisions_trend = [{"day": str(r[0])[:10], "count": r[1]} for r in dec_rows]

    # ER runs over time
    er_rows = await db.execute(
        select(ERRun)
        .where(ERRun.status == ERRunStatus.COMPLETED)
        .order_by(ERRun.completed_at.asc())
        .limit(10)
    )
    er_trend = [
        {
            "run_key": r.run_key,
            "date": r.completed_at.strftime("%Y-%m-%d") if r.completed_at else None,
            "auto_matched": r.auto_matched,
            "review_needed": r.review_needed,
            "clusters_created": r.clusters_created,
        }
        for r in er_rows.scalars().all()
    ]

    # Business events: inspections per day last 30 days
    event_cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    ev_rows = await db.execute(
        select(
            BusinessEvent.event_type,
            func.count(BusinessEvent.id),
        )
        .group_by(BusinessEvent.event_type)
        .order_by(func.count(BusinessEvent.id).desc())
    )
    event_type_dist = [{"event_type": r[0].value, "count": r[1]} for r in ev_rows]

    return {
        "review_cases_created_trend": cases_trend,
        "decisions_trend": decisions_trend,
        "er_runs_trend": er_trend,
        "event_type_distribution": event_type_dist,
    }


# ── 5. Department coverage intelligence ──────────────────────────────────────

@router.get("/departments")
async def department_coverage(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import or_

    depts_r = await db.execute(select(Department).where(Department.is_active == True))
    depts = depts_r.scalars().all()
    dept_codes = [d.code for d in depts]

    # Query 1: all per-dept counts in one aggregation
    count_rows = await db.execute(
        select(
            SourceRecord.department_code,
            func.count(SourceRecord.id).label("total"),
            func.sum(case((SourceRecord.resolution_status == ResolutionStatus.LINKED, 1), else_=0)).label("linked"),
            func.count(SourceRecord.pan).label("pan_count"),
            func.count(SourceRecord.gstin).label("gstin_count"),
        )
        .where(SourceRecord.department_code.in_(dept_codes))
        .group_by(SourceRecord.department_code)
    )
    dept_stats: dict[str, dict] = {}
    for r in count_rows:
        dept_stats[r[0]] = {"total": r[1] or 0, "linked": r[2] or 0, "pan": r[3] or 0, "gstin": r[4] or 0}

    # Query 2: all record IDs per dept (for review case matching)
    all_rec_rows = await db.execute(
        select(SourceRecord.department_code, SourceRecord.id)
        .where(SourceRecord.department_code.in_(dept_codes))
    )
    dept_record_ids: dict[str, list] = {c: [] for c in dept_codes}
    for dcode, rid in all_rec_rows:
        dept_record_ids[dcode].append(rid)

    # Query 3: all review cases touching any record across all depts
    dept_review_count: dict[str, int] = {c: 0 for c in dept_codes}
    all_rec_ids = [rid for rids in dept_record_ids.values() for rid in rids]
    if all_rec_ids:
        review_rows = await db.execute(
            select(ReviewCase.record_a_id, ReviewCase.record_b_id)
            .where(or_(ReviewCase.record_a_id.in_(all_rec_ids), ReviewCase.record_b_id.in_(all_rec_ids)))
        )
        rec_to_dept = {rid: dcode for dcode, rids in dept_record_ids.items() for rid in rids}
        seen: dict[str, set] = {c: set() for c in dept_codes}
        for ra, rb in review_rows:
            for rid in (ra, rb):
                dcode = rec_to_dept.get(rid)
                if dcode:
                    seen[dcode].add(rid)
        dept_review_count = {c: len(v) for c, v in seen.items()}

    result = []
    for dept in depts:
        s = dept_stats.get(dept.code, {"total": 0, "linked": 0, "pan": 0, "gstin": 0})
        total_records = s["total"]
        linked = s["linked"]
        pan_count = s["pan"]
        gstin_count = s["gstin"]
        review_count = dept_review_count.get(dept.code, 0)
        unlinked = total_records - linked
        result.append({
            "code": dept.code,
            "name": dept.name,
            "total_records": total_records,
            "linked_records": linked,
            "unlinked_records": unlinked,
            "match_rate_pct": round(linked / max(total_records, 1) * 100, 1),
            "review_cases": review_count,
            "review_rate_pct": round(review_count / max(total_records, 1) * 100, 1),
            "pan_coverage_pct": round(pan_count / max(total_records, 1) * 100, 1),
            "gstin_coverage_pct": round(gstin_count / max(total_records, 1) * 100, 1),
            "identifier_rate_pct": round((pan_count + gstin_count) / max(total_records, 1) / 2 * 100, 1),
            "last_ingested_at": dept.last_ingested_at.isoformat() if dept.last_ingested_at else None,
        })

    return {"departments": result}


# ── 6. Risk highlights ────────────────────────────────────────────────────────

@router.get("/risks")
async def risk_highlights(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)

    # High-dormancy pincodes
    dormant_pincodes_r = await db.execute(
        select(BusinessEntity.primary_pincode, func.count(BusinessEntity.id))
        .where(
            BusinessEntity.is_active == True,
            BusinessEntity.status == BusinessStatus.DORMANT,
            BusinessEntity.primary_pincode != None,
        )
        .group_by(BusinessEntity.primary_pincode)
        .order_by(func.count(BusinessEntity.id).desc())
        .limit(5)
    )
    dormant_pincodes = [{"pincode": r[0], "dormant_count": r[1]} for r in dormant_pincodes_r]

    # Unresolved duplicates (review_needed entities)
    unresolved_r = await db.execute(
        select(func.count(BusinessEntity.id)).where(
            BusinessEntity.is_active == True,
            BusinessEntity.status == BusinessStatus.REVIEW_NEEDED,
        )
    )

    # Old pending cases (>7 days)
    old_cutoff = now - timedelta(days=7)
    old_cases_r = await db.execute(
        select(func.count(ReviewCase.id)).where(
            ReviewCase.status == ReviewStatus.PENDING,
            ReviewCase.created_at < old_cutoff,
        )
    )

    # SLA breaches
    sla_r = await db.execute(
        select(func.count(ReviewCase.id)).where(
            ReviewCase.status == ReviewStatus.PENDING,
            ReviewCase.sla_deadline != None,
            ReviewCase.sla_deadline < now,
        )
    )

    # Districts with most REVIEW_NEEDED
    risky_districts_r = await db.execute(
        select(BusinessEntity.district, func.count(BusinessEntity.id))
        .where(
            BusinessEntity.is_active == True,
            BusinessEntity.status == BusinessStatus.REVIEW_NEEDED,
            BusinessEntity.district != None,
        )
        .group_by(BusinessEntity.district)
        .order_by(func.count(BusinessEntity.id).desc())
        .limit(5)
    )
    risky_districts = [{"district": r[0], "review_needed": r[1]} for r in risky_districts_r]

    return {
        "unresolved_entity_count": unresolved_r.scalar_one(),
        "old_pending_cases": old_cases_r.scalar_one(),
        "sla_breach_count": sla_r.scalar_one(),
        "high_dormancy_pincodes": dormant_pincodes,
        "high_risk_districts": risky_districts,
    }


# ── 7. Export ─────────────────────────────────────────────────────────────────

@router.get("/export/pincode/{code}")
async def export_pincode_csv(
    code: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    entities_r = await db.execute(
        select(BusinessEntity).where(
            BusinessEntity.primary_pincode == code,
            BusinessEntity.is_active == True,
        )
    )
    entities = entities_r.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["UBID", "Business Name", "Status", "District", "Pincode", "Confidence %"])
    for e in entities:
        writer.writerow([
            e.ubid,
            e.canonical_name,
            e.status.value,
            e.district or "",
            e.primary_pincode or "",
            f"{round(float(e.confidence_score) * 100)}%",
        ])
    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=pincode_{code}.csv"},
    )


@router.get("/export/districts")
async def export_districts_csv(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = await db.execute(
        select(
            BusinessEntity.district,
            func.count(BusinessEntity.id),
            func.sum(case((BusinessEntity.status == BusinessStatus.ACTIVE, 1), else_=0)),
            func.sum(case((BusinessEntity.status == BusinessStatus.DORMANT, 1), else_=0)),
            func.sum(case((BusinessEntity.status == BusinessStatus.REVIEW_NEEDED, 1), else_=0)),
        )
        .where(BusinessEntity.is_active == True, BusinessEntity.district != None)
        .group_by(BusinessEntity.district)
        .order_by(func.count(BusinessEntity.id).desc())
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["District", "Total", "Active", "Dormant", "Review Needed", "Dormant Rate %"])
    for r in rows:
        n = r[1] or 1
        writer.writerow([r[0], r[1], r[2] or 0, r[3] or 0, r[4] or 0, round((r[3] or 0) / n * 100, 1)])
    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=districts_summary.csv"},
    )
