"""
Cross-Department Intelligence Query Engine
==========================================
Implements the exact use case from the UBID spec:
  "Active factories in pin code 560058 with no inspection in 18 months"

Exposes a powerful compound query interface that joins across departments,
entities, events, and review cases — the kind of query that's impossible
without a UBID layer on top of siloed systems.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, case, func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.base import BusinessStatus, EventType, ReviewStatus
from app.services import dormancy_model as dm
from app.models.entities import (
    BusinessEntity, BusinessEvent, ReviewCase, SourceRecord, User,
)

router = APIRouter(prefix="/query", tags=["intelligence-query"])

# ─── UBID Pre-Registration Lookup ─────────────────────────────────────────────

@router.post("/lookup")
async def ubid_lookup(
    business_name: str = "",
    pan:           str | None = None,
    gstin:         str | None = None,
    pincode:       str | None = None,
    address:       str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Pre-registration deduplication check.
    Before creating a new business record, officers call this to check
    whether the business already has a UBID in the system.

    Returns:
      - definite_match: business definitely exists (PAN/GSTIN hit)
      - probable_matches: fuzzy matches worth reviewing
      - safe_to_register: True if no matches found
    """
    import jellyfish

    def _jw(a: str, b: str) -> float:
        if not a or not b: return 0.0
        return jellyfish.jaro_winkler_similarity(a.lower(), b.lower())

    pan_clean   = pan.upper().strip()   if pan   else None
    gstin_clean = gstin.upper().strip() if gstin else None

    results: list[dict] = []

    # ── 1. Exact PAN match (deterministic) ────────────────────────────────────
    if pan_clean:
        pan_hits = (await db.execute(
            select(BusinessEntity).where(BusinessEntity.canonical_pan == pan_clean)
        )).scalars().all()
        for e in pan_hits:
            results.append({
                "ubid":            e.ubid,
                "canonical_name":  e.canonical_name,
                "status":          e.status.value,
                "district":        e.district,
                "primary_pincode": e.primary_pincode,
                "match_type":      "DEFINITE_PAN",
                "confidence":      0.99,
                "reason":          f"PAN {pan_clean} already registered under UBID {e.ubid}",
                "pan":             e.canonical_pan,
                "gstin":           e.canonical_gstin,
            })

    # ── 2. Exact GSTIN match (deterministic) ──────────────────────────────────
    if gstin_clean and not results:
        gstin_hits = (await db.execute(
            select(BusinessEntity).where(BusinessEntity.canonical_gstin == gstin_clean)
        )).scalars().all()
        for e in gstin_hits:
            results.append({
                "ubid":            e.ubid,
                "canonical_name":  e.canonical_name,
                "status":          e.status.value,
                "district":        e.district,
                "primary_pincode": e.primary_pincode,
                "match_type":      "DEFINITE_GSTIN",
                "confidence":      0.97,
                "reason":          f"GSTIN {gstin_clean} already registered under UBID {e.ubid}",
                "pan":             e.canonical_pan,
                "gstin":           e.canonical_gstin,
            })

    # ── 3. Fuzzy name match within same pincode ────────────────────────────────
    if business_name and not results:
        scope_stmt = select(BusinessEntity).where(BusinessEntity.is_active == True)
        if pincode:
            scope_stmt = scope_stmt.where(BusinessEntity.primary_pincode == pincode)

        candidate_entities = (await db.execute(scope_stmt.limit(500))).scalars().all()

        scored = []
        name_norm = business_name.lower().strip()
        for e in candidate_entities:
            if not e.canonical_name: continue
            name_sim = _jw(name_norm, e.canonical_name.lower())
            if name_sim >= 0.80:
                scored.append((name_sim, e))

        scored.sort(key=lambda x: x[0], reverse=True)
        for sim, e in scored[:5]:
            results.append({
                "ubid":            e.ubid,
                "canonical_name":  e.canonical_name,
                "status":          e.status.value,
                "district":        e.district,
                "primary_pincode": e.primary_pincode,
                "match_type":      "PROBABLE_NAME",
                "confidence":      round(sim, 3),
                "reason":          f"Name similarity {round(sim*100)}% — {e.canonical_name}",
                "pan":             e.canonical_pan,
                "gstin":           e.canonical_gstin,
            })

    definite = [r for r in results if r["match_type"].startswith("DEFINITE")]
    probable = [r for r in results if r["match_type"] == "PROBABLE_NAME"]
    safe_to_register = len(definite) == 0 and len(probable) == 0

    return {
        "query": {"business_name": business_name, "pan": pan_clean, "gstin": gstin_clean, "pincode": pincode},
        "definite_matches":  definite,
        "probable_matches":  probable,
        "safe_to_register":  safe_to_register,
        "recommendation": (
            "BLOCK — business already has a UBID. Retrieve the existing UBID instead of creating a new record."
            if definite else
            "REVIEW — similar businesses found. Verify with the listed UBIDs before registering."
            if probable else
            "CLEAR — no existing UBID found. Safe to proceed with new registration."
        ),
        "total_matches": len(results),
    }


def _days_ago(days: int) -> date:
    return (datetime.now(timezone.utc) - timedelta(days=days)).date()


# ─── Main cross-department query endpoint ─────────────────────────────────────

@router.get("/cross-dept")
async def cross_dept_query(
    # Geographic filters
    pincode:        str | None  = Query(None),
    district:       str | None  = Query(None),

    # Status filters
    status:         str | None  = Query(None, description="ACTIVE | DORMANT | CLOSED | REVIEW_NEEDED"),

    # Department presence filters (businesses registered with these depts)
    must_have_dept:  list[str]  = Query(default=[], description="e.g. FACTORIES,KSPCB"),
    must_not_dept:   list[str]  = Query(default=[], description="Businesses absent from these depts"),

    # Activity / event recency filters
    no_event_since_days: int | None = Query(None, description="No events in last N days (dormancy signal)"),
    has_event_since_days: int | None= Query(None, description="Has event in last N days (active signal)"),
    event_dept:          str | None = Query(None, description="Filter events to specific dept"),
    event_type:          str | None = Query(None, description="INSPECTION | RENEWAL | METER_READ | CLOSURE"),

    # Identifier quality
    missing_pan:    bool | None = Query(None, description="True = PAN not on any linked record"),
    missing_gstin:  bool | None = Query(None, description="True = GSTIN not on any linked record"),

    # Review signals
    has_open_review: bool | None = Query(None),

    # Result controls
    min_dept_count: int  = Query(1, ge=1, description="Must span at least N departments"),
    page:           int  = Query(1, ge=1),
    page_size:      int  = Query(25, ge=1, le=100),

    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Cross-department intelligence query — the core UBID use case.

    Example queries:
      • Active KSPCB-registered businesses in 560058 with no inspection in 18 months
        → status=ACTIVE&must_have_dept=KSPCB&pincode=560058&no_event_since_days=540
      • Factories in Bengaluru with BESCOM but no KSPCB registration
        → district=Bengaluru&must_have_dept=FACTORIES&must_have_dept=BESCOM&must_not_dept=KSPCB
      • Dormant businesses that still have active BESCOM meter readings
        → status=DORMANT&has_event_since_days=90&event_dept=BESCOM
    """
    stmt = select(BusinessEntity).where(BusinessEntity.is_active == True)

    # ── Geographic ────────────────────────────────────────────────────────────
    if pincode:
        stmt = stmt.where(BusinessEntity.primary_pincode == pincode)
    if district:
        stmt = stmt.where(BusinessEntity.district.ilike(f"%{district}%"))

    # ── Status ────────────────────────────────────────────────────────────────
    if status:
        stmt = stmt.where(BusinessEntity.status == status)

    # ── Department presence (via source_records) ──────────────────────────────
    for dept in must_have_dept:
        sub = select(SourceRecord.business_entity_id).where(
            SourceRecord.department_code == dept,
            SourceRecord.business_entity_id.isnot(None),
        ).distinct()
        stmt = stmt.where(BusinessEntity.id.in_(sub))

    for dept in must_not_dept:
        sub = select(SourceRecord.business_entity_id).where(
            SourceRecord.department_code == dept,
            SourceRecord.business_entity_id.isnot(None),
        ).distinct()
        stmt = stmt.where(BusinessEntity.id.notin_(sub))

    # ── Minimum department span ───────────────────────────────────────────────
    if min_dept_count > 1:
        dept_cnt_sub = (
            select(SourceRecord.business_entity_id)
            .where(SourceRecord.business_entity_id.isnot(None))
            .group_by(SourceRecord.business_entity_id)
            .having(func.count(SourceRecord.department_code.distinct()) >= min_dept_count)
        )
        stmt = stmt.where(BusinessEntity.id.in_(dept_cnt_sub))

    # ── Event recency filters ─────────────────────────────────────────────────
    if no_event_since_days is not None:
        # No events from this dept/type in the last N days
        cutoff = _days_ago(no_event_since_days)
        recent_sub = select(BusinessEvent.business_entity_id).where(
            BusinessEvent.event_date >= cutoff,
            *(
                [BusinessEvent.department_code == event_dept] if event_dept else []
            ),
            *(
                [BusinessEvent.event_type == event_type] if event_type else []
            ),
        ).distinct()
        stmt = stmt.where(BusinessEntity.id.notin_(recent_sub))

    if has_event_since_days is not None:
        cutoff = _days_ago(has_event_since_days)
        active_sub = select(BusinessEvent.business_entity_id).where(
            BusinessEvent.event_date >= cutoff,
            *(
                [BusinessEvent.department_code == event_dept] if event_dept else []
            ),
        ).distinct()
        stmt = stmt.where(BusinessEntity.id.in_(active_sub))

    # ── Identifier quality ────────────────────────────────────────────────────
    if missing_pan is True:
        pan_sub = select(SourceRecord.business_entity_id).where(
            SourceRecord.pan.isnot(None),
            SourceRecord.business_entity_id.isnot(None),
        ).distinct()
        stmt = stmt.where(BusinessEntity.id.notin_(pan_sub))

    if missing_gstin is True:
        gstin_sub = select(SourceRecord.business_entity_id).where(
            SourceRecord.gstin.isnot(None),
            SourceRecord.business_entity_id.isnot(None),
        ).distinct()
        stmt = stmt.where(BusinessEntity.id.notin_(gstin_sub))

    # ── Open review cases filter ──────────────────────────────────────────────
    if has_open_review is True:
        rec_ids_sub = select(SourceRecord.id).where(
            SourceRecord.business_entity_id == BusinessEntity.id
        ).correlate(BusinessEntity)
        review_sub = (
            select(ReviewCase.id)
            .where(
                ReviewCase.status.in_([ReviewStatus.PENDING, ReviewStatus.ESCALATED]),
                or_(
                    ReviewCase.record_a_id.in_(rec_ids_sub),
                    ReviewCase.record_b_id.in_(rec_ids_sub),
                ),
            )
        )
        stmt = stmt.where(review_sub.exists())

    # ── Count + paginate ──────────────────────────────────────────────────────
    count_r = await db.execute(select(func.count()).select_from(stmt.subquery()))
    total = count_r.scalar_one()

    stmt = stmt.order_by(
        BusinessEntity.status.asc(),
        BusinessEntity.confidence_score.desc(),
    ).offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(stmt)
    entities = result.scalars().all()

    # ── Enrich results with last-event dates per entity ───────────────────────
    entity_ids = [e.id for e in entities]
    last_events: dict = {}
    dept_coverage: dict = {}

    if entity_ids:
        ev_rows = await db.execute(
            select(
                BusinessEvent.business_entity_id,
                BusinessEvent.department_code,
                func.max(BusinessEvent.event_date).label("last_event"),
            )
            .where(BusinessEvent.business_entity_id.in_(entity_ids))
            .group_by(BusinessEvent.business_entity_id, BusinessEvent.department_code)
        )
        for eid, dept, last in ev_rows:
            last_events.setdefault(eid, {})[dept] = str(last) if last else None

        dc_rows = await db.execute(
            select(SourceRecord.business_entity_id, SourceRecord.department_code)
            .where(SourceRecord.business_entity_id.in_(entity_ids))
            .distinct()
        )
        for eid, dept in dc_rows:
            dept_coverage.setdefault(eid, []).append(dept)

    results = []
    today = date.today()
    for e in entities:
        lev = last_events.get(e.id, {})
        overall_last = max((v for v in lev.values() if v), default=None)
        days_since = (today - date.fromisoformat(overall_last)).days if overall_last else None
        results.append({
            "ubid":              e.ubid,
            "canonical_name":    e.canonical_name,
            "status":            e.status.value,
            "confidence_score":  float(e.confidence_score),
            "district":          e.district,
            "primary_pincode":   e.primary_pincode,
            "department_coverage": dept_coverage.get(e.id, []),
            "last_event_by_dept": lev,
            "days_since_last_event": days_since,
            "canonical_pan":     e.canonical_pan,
            "canonical_gstin":   e.canonical_gstin,
        })

    return {
        "total":       total,
        "page":        page,
        "page_size":   page_size,
        "query_applied": {
            "pincode": pincode, "district": district, "status": status,
            "must_have_dept": must_have_dept, "must_not_dept": must_not_dept,
            "no_event_since_days": no_event_since_days,
            "has_event_since_days": has_event_since_days,
            "event_dept": event_dept, "min_dept_count": min_dept_count,
            "missing_pan": missing_pan, "missing_gstin": missing_gstin,
        },
        "results": results,
    }


# ─── Preset query templates ───────────────────────────────────────────────────

@router.get("/presets")
async def list_query_presets(current_user: User = Depends(get_current_user)):
    """Return example cross-department queries for the UI query builder."""
    return {
        "presets": [
            {
                "name":        "Dormant factories with recent BESCOM activity",
                "description": "Businesses marked DORMANT but still consuming electricity — resurrection signal",
                "params": {"status": "DORMANT", "must_have_dept": ["FACTORIES"], "has_event_since_days": 90, "event_dept": "BESCOM"},
                "insight":     "These businesses may have restarted operations without updating registrations",
            },
            {
                "name":        "KSPCB-registered but no inspection in 18 months",
                "description": "Pollution-board registered units with no compliance inspection recently",
                "params": {"must_have_dept": ["KSPCB"], "no_event_since_days": 540, "event_dept": "KSPCB"},
                "insight":     "May indicate lapsed compliance or shut-down units still holding valid consent",
            },
            {
                "name":        "Multi-dept businesses missing PAN",
                "description": "Businesses spanning 2+ departments with no tax identifier — data quality gap",
                "params": {"min_dept_count": 2, "missing_pan": True},
                "insight":     "Critical gap — these businesses cannot be reliably linked to tax records",
            },
            {
                "name":        "Active businesses with open identity reviews",
                "description": "Operational businesses still pending identity resolution decision",
                "params": {"status": "ACTIVE", "has_open_review": True},
                "insight":     "Review these first — identity ambiguity affects active taxpayers",
            },
            {
                "name":        "Factories in Bengaluru with BESCOM but no KSPCB",
                "description": "Manufacturing units consuming electricity but not registered with pollution board",
                "params": {"district": "Bengaluru Urban", "must_have_dept": ["FACTORIES", "BESCOM"], "must_not_dept": ["KSPCB"]},
                "insight":     "Potential KSPCB registration gap — environmental compliance risk",
            },
            {
                "name":        "Closed businesses still appearing in active department records",
                "description": "Entities classified CLOSED but source records still show active status",
                "params": {"status": "CLOSED", "must_have_dept": ["SHOPS"]},
                "insight":     "Source department records may need reconciliation with UBID closure signal",
            },
        ]
    }


# ─── Business health score ─────────────────────────────────────────────────────

@router.get("/health-score/{ubid}")
async def get_business_health_score(
    ubid: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Compute a composite Business Health Score (0-100) for a UBID.
    Factors: activity recency, identifier completeness, compliance signals,
    identity resolution confidence, department coverage breadth.
    """
    entity = (await db.execute(
        select(BusinessEntity).where(BusinessEntity.ubid == ubid)
    )).scalar_one_or_none()

    if not entity:
        return {"error": "Business not found"}

    records = (await db.execute(
        select(SourceRecord).where(SourceRecord.business_entity_id == entity.id)
    )).scalars().all()

    events = (await db.execute(
        select(BusinessEvent)
        .where(BusinessEvent.business_entity_id == entity.id)
        .order_by(BusinessEvent.event_date.desc())
        .limit(50)
    )).scalars().all()

    today = date.today()

    # ── Factor 1: Activity recency (0-30 pts) ─────────────────────────────────
    if events:
        latest = max(e.event_date for e in events if e.event_date)
        days_since = (today - latest).days if latest else 9999
        if days_since <= 30:   activity_score = 30
        elif days_since <= 90: activity_score = 25
        elif days_since <= 180: activity_score = 18
        elif days_since <= 365: activity_score = 10
        elif days_since <= 730: activity_score = 4
        else:                  activity_score = 0
    else:
        days_since = None
        activity_score = 0

    # ── Factor 2: Identifier completeness (0-25 pts) ─────────────────────────
    has_pan   = any(r.pan   for r in records)
    has_gstin = any(r.gstin for r in records)
    id_score  = 15 * has_pan + 10 * has_gstin

    # ── Factor 3: Department coverage breadth (0-20 pts) ─────────────────────
    depts = {r.department_code for r in records}
    dept_score = min(20, len(depts) * 5)

    # ── Factor 4: Entity resolution confidence (0-15 pts) ────────────────────
    conf_pct   = float(entity.confidence_score)
    conf_score = round(conf_pct * 15)

    # ── Factor 5: Compliance signals (0-10 pts) ───────────────────────────────
    # Negative: any source record is Cancelled/Expired → deduct; positive: all Active/Compliant
    active_records = sum(1 for r in records if r.registration_status in {"Active", "Compliant"})
    total_records  = len(records)
    compliance_score = round((active_records / max(total_records, 1)) * 10)

    total_score = activity_score + id_score + dept_score + conf_score + compliance_score
    total_score = max(0, min(100, total_score))

    # ── Health tier ───────────────────────────────────────────────────────────
    if total_score >= 80:   tier, tier_color = "Healthy",  "#16a34a"
    elif total_score >= 60: tier, tier_color = "Moderate", "#d97706"
    elif total_score >= 40: tier, tier_color = "At Risk",  "#f97316"
    else:                   tier, tier_color = "Critical", "#dc2626"

    return {
        "ubid":          ubid,
        "canonical_name": entity.canonical_name,
        "health_score":  total_score,
        "health_tier":   tier,
        "tier_color":    tier_color,
        "breakdown": {
            "activity_recency":     {"score": activity_score, "max": 30, "detail": f"{days_since} days since last event" if days_since else "No events"},
            "identifier_complete":  {"score": id_score,       "max": 25, "detail": f"PAN: {'✓' if has_pan else '✗'} · GSTIN: {'✓' if has_gstin else '✗'}"},
            "dept_coverage":        {"score": dept_score,     "max": 20, "detail": f"{len(depts)} department(s): {', '.join(sorted(depts))}"},
            "er_confidence":        {"score": conf_score,     "max": 15, "detail": f"{round(conf_pct*100)}% match confidence"},
            "compliance_status":    {"score": compliance_score,"max": 10, "detail": f"{active_records}/{total_records} records active/compliant"},
        },
        "risk_flags": _compute_risk_flags(entity, records, events, today),
        "recommendations": _compute_recommendations(entity, records, has_pan, has_gstin, days_since, depts),
    }


def _compute_risk_flags(entity: BusinessEntity, records: list, events: list, today: date) -> list[dict]:
    flags = []
    if entity.status == BusinessStatus.DORMANT:
        flags.append({"type": "STATUS", "severity": "MEDIUM", "message": "Business is classified as DORMANT"})
    if entity.status == BusinessStatus.CLOSED:
        flags.append({"type": "STATUS", "severity": "HIGH", "message": "Business is CLOSED — verify all source records"})
    if not any(r.pan for r in records):
        flags.append({"type": "IDENTIFIER", "severity": "HIGH", "message": "No PAN number on any linked record"})
    if not any(r.gstin for r in records):
        flags.append({"type": "IDENTIFIER", "severity": "MEDIUM", "message": "No GSTIN on any linked record"})
    if events:
        latest = max((e.event_date for e in events if e.event_date), default=None)
        if latest and (today - latest).days > 365:
            flags.append({"type": "ACTIVITY", "severity": "HIGH", "message": f"No government interaction in {(today-latest).days} days"})
    cancelled = [r for r in records if r.registration_status in {"Cancelled", "Expired"}]
    if cancelled:
        flags.append({"type": "COMPLIANCE", "severity": "MEDIUM", "message": f"{len(cancelled)} registration(s) cancelled/expired"})
    return flags


@router.get("/dormancy-risk/{ubid}")
async def get_dormancy_risk(
    ubid: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Predict dormancy probability for a business using the trained ML model."""
    entity = (await db.execute(
        select(BusinessEntity).where(BusinessEntity.ubid == ubid)
    )).scalar_one_or_none()
    if not entity:
        return {"error": "Business not found"}

    events = (await db.execute(
        select(BusinessEvent)
        .where(BusinessEvent.business_entity_id == entity.id)
        .order_by(BusinessEvent.event_date.desc())
    )).scalars().all()

    today = _days_ago(0)
    cut_6m  = _days_ago(180)
    cut_12m = _days_ago(365)

    dates = [e.event_date for e in events if e.event_date]
    days_since = (today - max(dates)).days if dates else 9999

    evs_6m  = sum(1 for e in events if e.event_date and e.event_date >= cut_6m)
    evs_12m = sum(1 for e in events if e.event_date and cut_12m <= e.event_date < cut_6m)
    has_bescom_6m   = any(e.department_code == "BESCOM" and e.event_date and e.event_date >= cut_6m for e in events)
    has_inspect_6m  = any(e.event_type == EventType.INSPECTION and e.event_date and e.event_date >= cut_6m for e in events)

    risk = dm.predict_dormancy_risk(
        days_since_last_event=days_since,
        events_last_6m=evs_6m,
        events_6_12m=evs_12m,
        dept_count=entity.dept_count or 1,
        has_bescom_6m=has_bescom_6m,
        has_inspection_6m=has_inspect_6m,
        confidence_score=float(entity.confidence_score),
    )

    return {
        "ubid":             ubid,
        "canonical_name":   entity.canonical_name,
        "current_status":   entity.status.value,
        "dormancy_risk":    risk,
        "ml_available":     dm.is_loaded(),
        "signals": {
            "days_since_last_event": days_since,
            "events_last_6m":        evs_6m,
            "events_6_12m":          evs_12m,
            "has_bescom_6m":         has_bescom_6m,
            "has_inspection_6m":     has_inspect_6m,
            "dept_count":            entity.dept_count,
        },
    }


@router.get("/at-risk-businesses")
async def get_at_risk_businesses(
    threshold: float = Query(0.6, ge=0.0, le=1.0),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return ACTIVE businesses most at risk of going dormant."""
    if not dm.is_loaded():
        return {"error": "Dormancy model not trained. Run scripts/train_dormancy_model.py"}

    active_ents = (await db.execute(
        select(BusinessEntity)
        .where(BusinessEntity.status == BusinessStatus.ACTIVE)
        .where(BusinessEntity.is_active == True)
    )).scalars().all()

    # Load events for all active entities at once
    ent_ids = [e.id for e in active_ents]
    events_r = await db.execute(
        select(BusinessEvent.business_entity_id, BusinessEvent.event_date,
               BusinessEvent.department_code, BusinessEvent.event_type)
        .where(BusinessEvent.business_entity_id.in_(ent_ids))
    )
    emap: dict = {}
    for eid, edate, dept, etype in events_r:
        emap.setdefault(str(eid), []).append((edate, dept, etype))

    today = _days_ago(0)
    cut_6m  = _days_ago(180)
    cut_12m = _days_ago(365)

    at_risk = []
    for e in active_ents:
        evs = emap.get(str(e.id), [])
        dates = [d for d, _, _ in evs if d]
        days_since = (today - max(dates)).days if dates else 9999
        evs_6m  = sum(1 for d, _, _ in evs if d and d >= cut_6m)
        evs_12m = sum(1 for d, _, _ in evs if d and cut_12m <= d < cut_6m)
        has_bescom_6m  = any(dept == "BESCOM" and d and d >= cut_6m for d, dept, _ in evs)
        has_inspect_6m = any(str(etype) == "EventType.INSPECTION" and d and d >= cut_6m for d, _, etype in evs)

        risk = dm.predict_dormancy_risk(
            days_since_last_event=days_since,
            events_last_6m=evs_6m, events_6_12m=evs_12m,
            dept_count=e.dept_count or 1,
            has_bescom_6m=has_bescom_6m, has_inspection_6m=has_inspect_6m,
            confidence_score=float(e.confidence_score),
        )
        if risk and risk["probability"] >= threshold:
            at_risk.append({
                "ubid": e.ubid, "canonical_name": e.canonical_name,
                "district": e.district, "primary_pincode": e.primary_pincode,
                "dormancy_probability": risk["probability"],
                "risk_tier": risk["tier"], "tier_color": risk["color"],
                "days_since_last_event": days_since,
                "dept_count": e.dept_count,
            })

    at_risk.sort(key=lambda x: x["dormancy_probability"], reverse=True)
    return {
        "threshold": threshold,
        "total_active": len(active_ents),
        "at_risk_count": len(at_risk),
        "businesses": at_risk[:limit],
    }


def _compute_recommendations(entity, records, has_pan, has_gstin, days_since, depts):
    recs = []
    if not has_pan:
        recs.append("Obtain and link PAN number from source departments for reliable identity matching")
    if not has_gstin:
        recs.append("Verify GSTIN registration — required for businesses with turnover above threshold")
    if days_since and days_since > 365:
        recs.append("Schedule field verification — no government interaction detected in over a year")
    if len(depts) == 1:
        recs.append("Single department coverage — cross-reference with other department systems")
    if entity.status == BusinessStatus.DORMANT:
        recs.append("Conduct activity verification — BESCOM meter readings may indicate operations continue")
    return recs
