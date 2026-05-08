"""Phase 5 — Graph Intelligence & Suspicious Cluster Detection"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, or_, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db
from app.models.base import BusinessStatus, ReviewStatus
from app.models.entities import (
    BusinessEntity, BusinessEvent, ClusterMember, ReviewCase, SourceRecord,
)

router = APIRouter(prefix="/graph", tags=["graph"])

DEPT_COLORS = {
    "SHOPS": "#4f46e5", "FACTORIES": "#f59e0b",
    "KSPCB": "#16a34a", "BESCOM": "#8b5cf6",
}

SEV_ORDER = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}


def _node(nid: str, ntype: str, label: str, **meta) -> dict:
    return {"id": nid, "type": ntype, "label": label, **meta}


def _edge(src: str, tgt: str, etype: str, label: str,
          strength: float = 0.8, deterministic: bool = True, why: str = "") -> dict:
    return {
        "source": src, "target": tgt, "type": etype, "label": label,
        "strength": strength, "deterministic": deterministic,
        "why_it_matters": why,
    }


# ─── business relationship graph ──────────────────────────────────────────────

@router.get("/business/{ubid}")
async def get_business_graph(ubid: str, db: AsyncSession = Depends(get_db)):
    subj = (await db.execute(
        select(BusinessEntity).where(BusinessEntity.ubid == ubid)
    )).scalar_one_or_none()
    if not subj:
        return {"error": "Business not found", "nodes": [], "edges": [], "suspicious_signals": []}

    nodes: list[dict] = []
    edges: list[dict] = []
    seen: set[str] = set()

    def add_node(n: dict) -> None:
        if n["id"] not in seen:
            nodes.append(n)
            seen.add(n["id"])

    subj_id = f"biz-{subj.ubid}"
    add_node(_node(
        subj_id, "BUSINESS", subj.canonical_name,
        status=subj.status.value,
        confidence=float(subj.confidence_score),
        pincode=subj.primary_pincode,
        district=subj.district,
        pan=subj.canonical_pan,
        gstin=subj.canonical_gstin,
        is_subject=True,
    ))

    # Source records
    recs = (await db.execute(
        select(SourceRecord).where(SourceRecord.business_entity_id == subj.id).limit(12)
    )).scalars().all()

    for rec in recs:
        rid = f"sr-{rec.id}"
        add_node(_node(
            rid, "SOURCE_RECORD",
            f"{rec.department_code}·{(rec.registration_number or rec.source_record_id)[:10]}",
            dept=rec.department_code,
            color=DEPT_COLORS.get(rec.department_code, "#94a3b8"),
            address=rec.raw_address, owner=rec.owner_name,
            pincode=rec.pincode, pan=rec.pan, gstin=rec.gstin,
            reg_num=rec.registration_number,
            reg_status=rec.registration_status,
        ))
        edges.append(_edge(
            subj_id, rid, "LINKED_RECORD",
            f"Registered with {rec.department_code}",
            strength=1.0, deterministic=True,
            why=f"Source record in {rec.department_code} department — deterministic link",
        ))

    # PAN siblings
    if subj.canonical_pan:
        for sib in (await db.execute(
            select(BusinessEntity)
            .where(BusinessEntity.canonical_pan == subj.canonical_pan)
            .where(BusinessEntity.id != subj.id)
            .limit(4)
        )).scalars().all():
            sid = f"biz-{sib.ubid}"
            add_node(_node(sid, "BUSINESS", sib.canonical_name,
                           status=sib.status.value,
                           confidence=float(sib.confidence_score),
                           pincode=sib.primary_pincode, is_subject=False))
            edges.append(_edge(
                subj_id, sid, "SHARED_PAN",
                f"Same PAN: {subj.canonical_pan}",
                strength=0.95, deterministic=True,
                why=f"Both share PAN {subj.canonical_pan} — potential same legal entity or branch relationship",
            ))

    # GSTIN siblings
    if subj.canonical_gstin:
        for sib in (await db.execute(
            select(BusinessEntity)
            .where(BusinessEntity.canonical_gstin == subj.canonical_gstin)
            .where(BusinessEntity.id != subj.id)
            .limit(3)
        )).scalars().all():
            sid = f"biz-{sib.ubid}"
            add_node(_node(sid, "BUSINESS", sib.canonical_name,
                           status=sib.status.value,
                           confidence=float(sib.confidence_score),
                           pincode=sib.primary_pincode, is_subject=False))
            edges.append(_edge(
                subj_id, sid, "SHARED_GSTIN",
                f"Same GSTIN: {subj.canonical_gstin}",
                strength=0.9, deterministic=True,
                why=f"Both share GSTIN {subj.canonical_gstin}",
            ))

    # Cluster siblings
    if subj.cluster_id:
        cm_rows = (await db.execute(
            select(ClusterMember)
            .where(ClusterMember.cluster_id == subj.cluster_id)
            .limit(10)
        )).scalars().all()
        cluster_rec_ids = [m.source_record_id for m in cm_rows]
        if cluster_rec_ids:
            cluster_recs = (await db.execute(
                select(SourceRecord)
                .where(SourceRecord.id.in_(cluster_rec_ids))
                .where(SourceRecord.business_entity_id != subj.id)
                .where(SourceRecord.business_entity_id.isnot(None))
                .limit(6)
            )).scalars().all()
            biz_ids = list({r.business_entity_id for r in cluster_recs})
            if biz_ids:
                for cb in (await db.execute(
                    select(BusinessEntity).where(BusinessEntity.id.in_(biz_ids))
                )).scalars().all():
                    cbid = f"biz-{cb.ubid}"
                    add_node(_node(cbid, "BUSINESS", cb.canonical_name,
                                   status=cb.status.value,
                                   confidence=float(cb.confidence_score),
                                   pincode=cb.primary_pincode, is_subject=False))
                    edges.append(_edge(
                        subj_id, cbid, "SAME_CLUSTER",
                        "Same identity cluster",
                        strength=0.7, deterministic=False,
                        why="Grouped by entity resolution engine as potential same business",
                    ))

    # Address neighbors
    for rec in recs[:3]:
        if not rec.normalized_address:
            continue
        addr_recs = (await db.execute(
            select(SourceRecord)
            .where(SourceRecord.normalized_address == rec.normalized_address)
            .where(SourceRecord.business_entity_id != subj.id)
            .where(SourceRecord.business_entity_id.isnot(None))
            .limit(4)
        )).scalars().all()
        addr_biz_ids = list({r.business_entity_id for r in addr_recs})
        if addr_biz_ids:
            for ab in (await db.execute(
                select(BusinessEntity).where(BusinessEntity.id.in_(addr_biz_ids[:3]))
            )).scalars().all():
                abid = f"biz-{ab.ubid}"
                add_node(_node(abid, "BUSINESS", ab.canonical_name,
                               status=ab.status.value,
                               confidence=float(ab.confidence_score),
                               pincode=ab.primary_pincode, is_subject=False))
                edges.append(_edge(
                    subj_id, abid, "SHARED_ADDRESS",
                    "Same registered address",
                    strength=0.6, deterministic=True,
                    why="Source records share the same normalized address — may be branch or co-located business",
                ))
            break

    # Open review cases
    rec_ids = [r.id for r in recs]
    if rec_ids:
        for case in (await db.execute(
            select(ReviewCase)
            .where(or_(
                ReviewCase.record_a_id.in_(rec_ids),
                ReviewCase.record_b_id.in_(rec_ids),
            ))
            .where(ReviewCase.status == ReviewStatus.PENDING)
            .limit(4)
        )).scalars().all():
            cid = f"case-{case.id}"
            add_node(_node(
                cid, "REVIEW_CASE", f"Review·{str(case.id)[:8]}",
                status="PENDING",
                priority=case.priority_level,
                confidence=float(case.confidence_score),
                pan_match=case.pan_match,
                gstin_match=case.gstin_match,
            ))
            edges.append(_edge(
                subj_id, cid, "HAS_REVIEW",
                f"Under review (P{case.priority_level})",
                strength=0.5, deterministic=True,
                why="Open identity review case — requires human decision",
            ))

    suspicious = await _entity_signals(db, subj, recs)

    return {
        "subject": {
            "ubid": subj.ubid, "name": subj.canonical_name,
            "status": subj.status.value, "district": subj.district,
            "pincode": subj.primary_pincode,
        },
        "nodes": nodes,
        "edges": edges,
        "suspicious_signals": suspicious,
        "summary": {
            "total_nodes": len(nodes),
            "total_edges": len(edges),
            "dept_coverage": list({r.department_code for r in recs}),
            "has_suspicious": len(suspicious) > 0,
        },
    }


# ─── per-entity suspicious signals ───────────────────────────────────────────

async def _entity_signals(db: AsyncSession, entity: BusinessEntity,
                           recs: list[SourceRecord]) -> list[dict]:
    signals: list[dict] = []

    # Dormant with recent events
    if entity.status == BusinessStatus.DORMANT:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=90)).date()
        cnt = (await db.execute(
            select(func.count()).where(
                BusinessEvent.business_entity_id == entity.id,
                BusinessEvent.event_date >= cutoff,
            )
        )).scalar_one() or 0
        if cnt:
            signals.append({
                "id": f"dormant-{entity.id}",
                "type": "DORMANT_WITH_ACTIVITY",
                "severity": "MEDIUM",
                "title": "Dormant status but recent activity",
                "description": f"{cnt} events recorded in last 90 days despite DORMANT classification.",
                "evidence": {"recent_event_count": cnt},
                "recommended_action": "Verify current operational status with source departments",
            })

    # High address density
    for rec in recs[:3]:
        if not rec.normalized_address:
            continue
        addr_cnt = (await db.execute(
            select(func.count(SourceRecord.business_entity_id.distinct()))
            .where(SourceRecord.normalized_address == rec.normalized_address)
            .where(SourceRecord.business_entity_id.isnot(None))
        )).scalar_one() or 0
        if addr_cnt >= 4:
            sev = "HIGH" if addr_cnt >= 8 else "MEDIUM"
            signals.append({
                "id": f"addr-density-{rec.id}",
                "type": "HIGH_ADDRESS_DENSITY",
                "severity": sev,
                "title": f"Address shared with {addr_cnt} businesses",
                "description": f"Registered address used by {addr_cnt} distinct entities.",
                "evidence": {"address": rec.raw_address, "entity_count": addr_cnt},
                "recommended_action": "Investigate if businesses are branches or separate entities",
            })
            break

    # Multi-dept low confidence
    dept_cnt = len({r.department_code for r in recs})
    if dept_cnt >= 3 and float(entity.confidence_score) < 0.70:
        signals.append({
            "id": f"lowconf-multidept-{entity.id}",
            "type": "LOW_CONFIDENCE_MULTI_DEPT",
            "severity": "MEDIUM",
            "title": f"Spans {dept_cnt} departments with {float(entity.confidence_score):.0%} confidence",
            "description": "Low confidence across multiple departments — linkages may be incorrect.",
            "evidence": {"dept_count": dept_cnt, "confidence": float(entity.confidence_score)},
            "recommended_action": "Review whether all source records belong to the same entity",
        })

    # Multiple open review cases
    rec_ids = [r.id for r in recs]
    if rec_ids:
        open_cnt = (await db.execute(
            select(func.count()).where(
                or_(
                    ReviewCase.record_a_id.in_(rec_ids),
                    ReviewCase.record_b_id.in_(rec_ids),
                ),
                ReviewCase.status == ReviewStatus.PENDING,
            )
        )).scalar_one() or 0
        if open_cnt >= 2:
            signals.append({
                "id": f"multi-review-{entity.id}",
                "type": "MULTIPLE_OPEN_REVIEWS",
                "severity": "HIGH",
                "title": f"{open_cnt} open identity review cases",
                "description": "Multiple unresolved review cases indicate uncertain identity linkage.",
                "evidence": {"open_review_count": open_cnt},
                "recommended_action": "Prioritise review queue processing for this entity",
            })

    return signals


# ─── platform-wide suspicious signals ────────────────────────────────────────

@router.get("/suspicious")
async def get_suspicious_signals(
    page: int = 1, limit: int = 20, severity: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    signals: list[dict] = []

    # 1. Addresses shared by ≥2 business entities
    addr_rows = (await db.execute(text("""
        SELECT normalized_address, COUNT(DISTINCT business_entity_id) AS cnt
        FROM source_records
        WHERE normalized_address IS NOT NULL AND business_entity_id IS NOT NULL
        GROUP BY normalized_address
        HAVING COUNT(DISTINCT business_entity_id) >= 2
        ORDER BY cnt DESC
        LIMIT 20
    """))).fetchall()

    for row in addr_rows:
        if not row.normalized_address:
            continue
        sample_recs = (await db.execute(
            select(SourceRecord)
            .where(SourceRecord.normalized_address == row.normalized_address)
            .where(SourceRecord.business_entity_id.isnot(None))
            .limit(4)
        )).scalars().all()
        biz_ids = list({r.business_entity_id for r in sample_recs})
        bizs = (await db.execute(
            select(BusinessEntity).where(BusinessEntity.id.in_(biz_ids[:3]))
        )).scalars().all()
        sev = "CRITICAL" if row.cnt >= 8 else "HIGH" if row.cnt >= 5 else "MEDIUM"
        signals.append({
            "id": f"shared-addr-{abs(hash(str(row.normalized_address))) % 1000000}",
            "type": "SHARED_ADDRESS",
            "severity": sev,
            "title": f"{row.cnt} businesses at same address",
            "description": str(row.normalized_address)[:100],
            "entities_involved": [
                {"ubid": b.ubid, "name": b.canonical_name, "status": b.status.value}
                for b in bizs
            ],
            "total_entities": row.cnt,
            "evidence": {"address": str(row.normalized_address), "entity_count": row.cnt},
            "recommended_action": "Verify if these are branches of the same entity",
        })

    # 2. PAN appearing on multiple business entities
    pan_rows = (await db.execute(text("""
        SELECT canonical_pan, COUNT(*) AS cnt
        FROM business_entities
        WHERE canonical_pan IS NOT NULL
        GROUP BY canonical_pan
        HAVING COUNT(*) >= 2
        ORDER BY cnt DESC
        LIMIT 10
    """))).fetchall()

    for row in pan_rows:
        bizs = (await db.execute(
            select(BusinessEntity)
            .where(BusinessEntity.canonical_pan == row.canonical_pan)
            .limit(4)
        )).scalars().all()
        signals.append({
            "id": f"shared-pan-{row.canonical_pan}",
            "type": "SHARED_PAN",
            "severity": "HIGH",
            "title": f"PAN {row.canonical_pan} linked to {row.cnt} entities",
            "description": f"Same PAN across {row.cnt} distinct entities — potential merger candidate.",
            "entities_involved": [
                {"ubid": b.ubid, "name": b.canonical_name, "status": b.status.value}
                for b in bizs
            ],
            "total_entities": row.cnt,
            "evidence": {"pan": row.canonical_pan, "entity_count": row.cnt},
            "recommended_action": "Review for cluster merge — these may be the same legal entity",
        })

    # 3. Dormant entities with recent events
    cutoff = (datetime.now(timezone.utc) - timedelta(days=90)).date()
    dormant_active = (await db.execute(
        select(BusinessEntity)
        .join(BusinessEvent, BusinessEvent.business_entity_id == BusinessEntity.id)
        .where(BusinessEntity.status == BusinessStatus.DORMANT)
        .where(BusinessEvent.event_date >= cutoff)
        .group_by(BusinessEntity.id)
        .having(func.count(BusinessEvent.id) > 0)
        .limit(10)
    )).scalars().all()

    for biz in dormant_active:
        signals.append({
            "id": f"dormant-active-{biz.id}",
            "type": "DORMANT_WITH_ACTIVITY",
            "severity": "MEDIUM",
            "title": f"Dormant business with recent activity",
            "description": f"{biz.canonical_name[:60]} — marked DORMANT but has events in last 90 days.",
            "entities_involved": [
                {"ubid": biz.ubid, "name": biz.canonical_name, "status": biz.status.value}
            ],
            "total_entities": 1,
            "evidence": {"ubid": biz.ubid, "pincode": biz.primary_pincode},
            "recommended_action": "Re-evaluate business status — may need reclassification to ACTIVE",
        })

    # 4. Large clusters with low confidence
    for biz in (await db.execute(
        select(BusinessEntity)
        .where(BusinessEntity.linked_records_count >= 4)
        .where(BusinessEntity.confidence_score < 0.75)
        .order_by(BusinessEntity.linked_records_count.desc())
        .limit(8)
    )).scalars().all():
        signals.append({
            "id": f"large-lowconf-{biz.id}",
            "type": "LARGE_CLUSTER_LOW_CONFIDENCE",
            "severity": "MEDIUM",
            "title": f"Large cluster ({biz.linked_records_count} records) with low confidence",
            "description": f"{biz.canonical_name[:60]} — confidence {float(biz.confidence_score):.0%}",
            "entities_involved": [
                {"ubid": biz.ubid, "name": biz.canonical_name, "status": biz.status.value}
            ],
            "total_entities": biz.linked_records_count,
            "evidence": {
                "linked_records": biz.linked_records_count,
                "confidence": float(biz.confidence_score),
            },
            "recommended_action": "Manual review to confirm all records belong to this entity",
        })

    # 5. Entities with multiple open review cases (≥3)
    multi_review_rows = (await db.execute(text("""
        SELECT sr.business_entity_id, COUNT(DISTINCT rc.id) AS case_cnt
        FROM review_cases rc
        JOIN source_records sr ON (rc.record_a_id = sr.id OR rc.record_b_id = sr.id)
        WHERE rc.status = 'PENDING' AND sr.business_entity_id IS NOT NULL
        GROUP BY sr.business_entity_id
        HAVING COUNT(DISTINCT rc.id) >= 3
        ORDER BY case_cnt DESC
        LIMIT 10
    """))).fetchall()

    for row in multi_review_rows:
        biz = (await db.execute(
            select(BusinessEntity).where(BusinessEntity.id == row.business_entity_id)
        )).scalar_one_or_none()
        if not biz:
            continue
        signals.append({
            "id": f"multi-review-{biz.id}",
            "type": "MULTIPLE_OPEN_REVIEWS",
            "severity": "HIGH" if row.case_cnt >= 5 else "MEDIUM",
            "title": f"{row.case_cnt} open review cases",
            "description": f"{biz.canonical_name[:60]} has {row.case_cnt} unresolved identity review cases.",
            "entities_involved": [{"ubid": biz.ubid, "name": biz.canonical_name, "status": biz.status.value}],
            "total_entities": 1,
            "evidence": {"open_cases": row.case_cnt},
            "recommended_action": "Prioritise review queue processing to resolve identity linkage",
        })

    # 6. Closed businesses with recent review cases (resurrection signal)
    closed_review = (await db.execute(
        select(BusinessEntity)
        .where(BusinessEntity.status == BusinessStatus.CLOSED)
        .join(SourceRecord, SourceRecord.business_entity_id == BusinessEntity.id)
        .join(ReviewCase, or_(ReviewCase.record_a_id == SourceRecord.id, ReviewCase.record_b_id == SourceRecord.id))
        .where(ReviewCase.status == ReviewStatus.PENDING)
        .group_by(BusinessEntity.id)
        .limit(8)
    )).scalars().all()

    for biz in closed_review:
        signals.append({
            "id": f"closed-review-{biz.id}",
            "type": "LOW_CONFIDENCE_MULTI_DEPT",
            "severity": "HIGH",
            "title": f"Closed business with open review cases",
            "description": f"{biz.canonical_name[:60]} — marked CLOSED but has unresolved identity cases.",
            "entities_involved": [{"ubid": biz.ubid, "name": biz.canonical_name, "status": biz.status.value}],
            "total_entities": 1,
            "evidence": {"status": "CLOSED"},
            "recommended_action": "Verify if business has restarted operations under a different registration",
        })

    # 7. Dormant businesses spanning 3+ departments (suspicious breadth)
    dormant_multi = (await db.execute(
        select(BusinessEntity)
        .where(BusinessEntity.status == BusinessStatus.DORMANT)
        .where(BusinessEntity.dept_count >= 3)
        .order_by(BusinessEntity.dept_count.desc())
        .limit(10)
    )).scalars().all()

    for biz in dormant_multi:
        signals.append({
            "id": f"dormant-multi-{biz.id}",
            "type": "DORMANT_WITH_ACTIVITY",
            "severity": "MEDIUM",
            "title": f"Dormant business across {biz.dept_count} departments",
            "description": f"{biz.canonical_name[:60]} — dormant but registered in {biz.dept_count} departments.",
            "entities_involved": [{"ubid": biz.ubid, "name": biz.canonical_name, "status": biz.status.value}],
            "total_entities": biz.dept_count,
            "evidence": {"dept_count": biz.dept_count, "districts": biz.district},
            "recommended_action": "Cross-verify dormancy status with all source departments",
        })

    if severity:
        signals = [s for s in signals if s["severity"] == severity.upper()]

    # Deduplicate by id
    seen_ids: set = set()
    unique_signals = []
    for s in signals:
        if s["id"] not in seen_ids:
            unique_signals.append(s)
            seen_ids.add(s["id"])
    signals = unique_signals

    signals.sort(key=lambda s: SEV_ORDER.get(s["severity"], 99))

    total = len(signals)
    offset = (page - 1) * limit
    return {
        "signals": signals[offset: offset + limit],
        "total": total,
        "page": page,
        "pages": max(1, (total + limit - 1) // limit),
        "severity_counts": {
            "CRITICAL": sum(1 for s in signals if s["severity"] == "CRITICAL"),
            "HIGH": sum(1 for s in signals if s["severity"] == "HIGH"),
            "MEDIUM": sum(1 for s in signals if s["severity"] == "MEDIUM"),
        },
    }


# ─── nearby businesses ────────────────────────────────────────────────────────

@router.get("/business/{ubid}/nearby")
async def get_nearby_businesses(ubid: str, limit: int = 10, db: AsyncSession = Depends(get_db)):
    subj = (await db.execute(
        select(BusinessEntity).where(BusinessEntity.ubid == ubid)
    )).scalar_one_or_none()
    if not subj:
        return {"subject_ubid": ubid, "nearby": []}

    if not subj.primary_pincode:
        return {"subject_ubid": ubid, "nearby": []}

    same_pc = (await db.execute(
        select(BusinessEntity)
        .where(BusinessEntity.primary_pincode == subj.primary_pincode)
        .where(BusinessEntity.id != subj.id)
        .order_by(BusinessEntity.confidence_score.desc())
        .limit(limit)
    )).scalars().all()

    subj_recs = (await db.execute(
        select(SourceRecord).where(SourceRecord.business_entity_id == subj.id)
    )).scalars().all()
    subj_pans = {r.pan for r in subj_recs if r.pan}
    subj_addrs = {r.normalized_address for r in subj_recs if r.normalized_address}

    nearby: list[dict] = []
    for biz in same_pc:
        biz_recs = (await db.execute(
            select(SourceRecord).where(SourceRecord.business_entity_id == biz.id).limit(6)
        )).scalars().all()
        shared: list[str] = []
        if biz.canonical_pan and biz.canonical_pan == subj.canonical_pan:
            shared.append("same_pan")
        if biz.canonical_gstin and biz.canonical_gstin == subj.canonical_gstin:
            shared.append("same_gstin")
        biz_addrs = {r.normalized_address for r in biz_recs if r.normalized_address}
        if subj_addrs & biz_addrs:
            shared.append("shared_address")
        biz_pans = {r.pan for r in biz_recs if r.pan}
        if subj_pans & biz_pans:
            shared.append("pan_overlap")
        nearby.append({
            "ubid": biz.ubid, "name": biz.canonical_name,
            "status": biz.status.value,
            "confidence": float(biz.confidence_score),
            "district": biz.district, "pincode": biz.primary_pincode,
            "distance_type": "same_pincode",
            "shared_signals": shared,
            "dept_count": biz.dept_count,
        })

    return {"subject_ubid": ubid, "subject_name": subj.canonical_name, "nearby": nearby}


# ─── branch / establishment hierarchy ────────────────────────────────────────

@router.get("/business/{ubid}/hierarchy")
async def get_business_hierarchy(ubid: str, db: AsyncSession = Depends(get_db)):
    subj = (await db.execute(
        select(BusinessEntity).where(BusinessEntity.ubid == ubid)
    )).scalar_one_or_none()
    if not subj:
        return {"root": None, "establishments": [], "potential_branches": []}

    recs = (await db.execute(
        select(SourceRecord).where(SourceRecord.business_entity_id == subj.id)
    )).scalars().all()

    by_dept: dict[str, list[dict]] = {}
    for rec in recs:
        by_dept.setdefault(rec.department_code, []).append({
            "source_record_id": str(rec.id),
            "dept": rec.department_code,
            "registration_number": rec.registration_number,
            "raw_address": rec.raw_address,
            "pincode": rec.pincode,
            "owner_name": rec.owner_name,
            "registration_status": rec.registration_status,
            "last_event_date": (
                rec.last_event_date.isoformat() if rec.last_event_date else None
            ),
        })

    establishments = [
        {"dept": dept, "records": recs_list}
        for dept, recs_list in by_dept.items()
    ]

    potential_branches: list[dict] = []
    seen_ubids: set[str] = set()

    if subj.canonical_pan:
        for sib in (await db.execute(
            select(BusinessEntity)
            .where(BusinessEntity.canonical_pan == subj.canonical_pan)
            .where(BusinessEntity.id != subj.id)
            .limit(6)
        )).scalars().all():
            if sib.ubid not in seen_ubids:
                potential_branches.append({
                    "ubid": sib.ubid, "name": sib.canonical_name,
                    "status": sib.status.value, "signal": "same_pan",
                    "confidence": float(sib.confidence_score),
                    "district": sib.district, "pincode": sib.primary_pincode,
                })
                seen_ubids.add(sib.ubid)

    for rec in recs[:2]:
        if not rec.normalized_address:
            continue
        addr_recs = (await db.execute(
            select(SourceRecord)
            .where(SourceRecord.normalized_address == rec.normalized_address)
            .where(SourceRecord.business_entity_id != subj.id)
            .where(SourceRecord.business_entity_id.isnot(None))
            .limit(4)
        )).scalars().all()
        biz_ids = list({r.business_entity_id for r in addr_recs})
        if biz_ids:
            for ab in (await db.execute(
                select(BusinessEntity).where(BusinessEntity.id.in_(biz_ids[:3]))
            )).scalars().all():
                if ab.ubid not in seen_ubids:
                    potential_branches.append({
                        "ubid": ab.ubid, "name": ab.canonical_name,
                        "status": ab.status.value, "signal": "shared_address",
                        "confidence": float(ab.confidence_score),
                        "district": ab.district, "pincode": ab.primary_pincode,
                    })
                    seen_ubids.add(ab.ubid)
        break

    return {
        "root": {
            "ubid": subj.ubid, "name": subj.canonical_name,
            "status": subj.status.value,
            "pan": subj.canonical_pan, "gstin": subj.canonical_gstin,
            "district": subj.district, "pincode": subj.primary_pincode,
            "dept_count": subj.dept_count,
            "linked_records_count": subj.linked_records_count,
        },
        "establishments": establishments,
        "potential_branches": potential_branches,
        "summary": {
            "total_establishments": len(recs),
            "dept_coverage": list(by_dept.keys()),
            "has_branches": len(potential_branches) > 0,
        },
    }
