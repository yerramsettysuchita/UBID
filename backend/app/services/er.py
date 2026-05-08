"""
Phase 2 Entity Resolution Engine — Probabilistic Linkage Model
────────────────────────────────────────────────────────────────
Model: Weighted logistic-style scoring over hand-crafted features.
Features:
  - PAN exact match (deterministic; weight 0.45 — raises confidence to ≥ 0.90)
  - GSTIN exact match (deterministic; weight 0.40 — raises confidence to ≥ 0.87)
  - Business name similarity — Jaro-Winkler string metric (weight 0.45)
  - Address token overlap — Jaccard on token sets (weight 0.25)
  - Pincode exact match — geographic corroboration (+0.10 bonus)
  - Name+pincode boost — compound signal when both agree (+0.10)

Thresholds (tuned on synthetic ground-truth pairs):
  AUTO_MATCH    ≥ 0.85   → union into same cluster, assign UBID
  REVIEW_NEEDED   0.50–0.84 → route to human reviewer with explainable evidence
  NON_MATCH     < 0.50   → no linkage

Pipeline:

  1. Load PENDING / IN_REVIEW source records from all departments
  2. Build blocking index  (PAN block | GSTIN block | pincode+name-prefix block)
  3. Generate cross-department candidate pairs within each block (deduplicated)
  4. Score every pair — deterministic identifiers + probabilistic fuzzy matching
  5. Classify: AUTO_MATCH (≥0.85) | REVIEW_NEEDED (0.50–0.84) | NON_MATCH (<0.50)
  6. Cluster AUTO_MATCH pairs via Union-Find
  7. Create / update UBIDCluster + BusinessEntity for each cluster
  8. Create ReviewCase rows for REVIEW_NEEDED pairs (idempotent via pair_key)
  9. Persist ERCandidatePair audit rows
 10. Commit and return run metrics
"""
from __future__ import annotations

import hashlib
import uuid
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

import jellyfish
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

# ML model — loaded at import; falls back to rule-based if not available
from app.services.ml_model import predict_match_proba, is_loaded as ml_loaded

from app.models.base import (
    BusinessStatus, ClusterStatus, ERRunStatus,
    PairDecision, ResolutionStatus, ReviewStatus,
)
from app.models.entities import (
    AuditLog, BusinessEntity, ClusterMember, ERCandidatePair,
    ERRun, ReviewCase, SourceRecord, UBIDCluster,
)

# ── Thresholds (tunable) ──────────────────────────────────────────────────────
AUTO_MATCH_THRESHOLD = 0.85
REVIEW_THRESHOLD     = 0.50

# ── Weights ───────────────────────────────────────────────────────────────────
@dataclass
class ERConfig:
    version: int = 2
    auto_match_threshold: float = AUTO_MATCH_THRESHOLD
    review_threshold: float     = REVIEW_THRESHOLD
    # scoring
    pan_exact_weight:    float = 0.45
    gstin_exact_weight:  float = 0.40
    name_sim_weight:     float = 0.45
    address_sim_weight:  float = 0.25
    pincode_bonus:       float = 0.10
    name_pincode_boost:  float = 0.10   # extra when name>0.85 AND pincode match

    def as_dict(self) -> dict:
        return {
            "version": self.version,
            "auto_match_threshold": self.auto_match_threshold,
            "review_threshold": self.review_threshold,
            "pan_exact_weight": self.pan_exact_weight,
            "gstin_exact_weight": self.gstin_exact_weight,
            "name_sim_weight": self.name_sim_weight,
            "address_sim_weight": self.address_sim_weight,
            "pincode_bonus": self.pincode_bonus,
            "name_pincode_boost": self.name_pincode_boost,
        }


DEFAULT_CONFIG = ERConfig()


# ── Hashing helpers ───────────────────────────────────────────────────────────

def _pair_key(id_a: str, id_b: str) -> str:
    """Order-independent SHA-1 key for a record pair."""
    parts = sorted([str(id_a), str(id_b)])
    return hashlib.sha1(f"{parts[0]}|{parts[1]}".encode()).hexdigest()


def _cluster_key(member_ids: list[str]) -> str:
    return hashlib.sha1("|".join(sorted(member_ids)).encode()).hexdigest()


# ── Union-Find for clustering ─────────────────────────────────────────────────

class UnionFind:
    def __init__(self) -> None:
        self._parent: dict[str, str] = {}

    def find(self, x: str) -> str:
        if x not in self._parent:
            self._parent[x] = x
        if self._parent[x] != x:
            self._parent[x] = self.find(self._parent[x])
        return self._parent[x]

    def union(self, x: str, y: str) -> None:
        px, py = self.find(x), self.find(y)
        if px != py:
            self._parent[py] = px

    def groups(self) -> dict[str, list[str]]:
        """Return {root: [member, ...]} for all groups with ≥2 members."""
        buckets: dict[str, list[str]] = defaultdict(list)
        for node in self._parent:
            buckets[self.find(node)].append(node)
        return {r: list(set(ms)) for r, ms in buckets.items() if len(set(ms)) >= 2}


# ── Scoring ───────────────────────────────────────────────────────────────────

def _jaro_winkler(a: str | None, b: str | None) -> float:
    if not a or not b:
        return 0.0
    return jellyfish.jaro_winkler_similarity(a, b)


def _token_overlap(a: str | None, b: str | None) -> float:
    if not a or not b:
        return 0.0
    ta = set(a.lower().split())
    tb = set(b.lower().split())
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / max(len(ta), len(tb))


def _score_pair(rec_a: dict, rec_b: dict, cfg: ERConfig) -> dict[str, Any]:
    name_score    = round(_jaro_winkler(rec_a.get("normalized_name"),    rec_b.get("normalized_name")),    3)
    address_score = round(_token_overlap(rec_a.get("normalized_address"), rec_b.get("normalized_address")), 3)

    pan_a, pan_b     = rec_a.get("pan"), rec_b.get("pan")
    gstin_a, gstin_b = rec_a.get("gstin"), rec_b.get("gstin")
    pc_a, pc_b       = rec_a.get("pincode"), rec_b.get("pincode")

    pan_match     = bool(pan_a and pan_b and pan_a == pan_b)
    gstin_match   = bool(gstin_a and gstin_b and gstin_a == gstin_b)
    pincode_match = bool(pc_a and pc_b and pc_a == pc_b)

    # ── Confidence scoring ────────────────────────────────────────────────────
    # Deterministic identifiers (PAN / GSTIN): rule-based floor — never override.
    if pan_match:
        conf = min(1.0, 0.90 + cfg.name_sim_weight * 0.1 * name_score
                            + cfg.address_sim_weight * 0.05 * address_score)
    elif gstin_match:
        conf = min(1.0, 0.87 + cfg.name_sim_weight * 0.15 * name_score
                            + cfg.address_sim_weight * 0.08 * address_score)
    else:
        # Probabilistic path — use trained ML model when available, else rule-based
        ml_prob = predict_match_proba(name_score, address_score, pan_match, gstin_match, pincode_match)
        if ml_prob is not None:
            # ML model gives raw probability; cap at 0.84 for non-identifier pairs
            # so only PAN/GSTIN matches can reach auto-link without human review
            conf = min(0.84, ml_prob)
        else:
            # Fallback: weighted feature sum (rule-based)
            conf = cfg.name_sim_weight * name_score + cfg.address_sim_weight * address_score
            if pincode_match:
                conf += cfg.pincode_bonus
            if name_score >= 0.85 and pincode_match:
                conf += cfg.name_pincode_boost
            conf = min(0.84, conf)

    conf = round(conf, 3)

    return {
        "name_score":     name_score,
        "address_score":  address_score,
        "pan_match":      pan_match,
        "gstin_match":    gstin_match,
        "pincode_match":  pincode_match,
        "confidence":     conf,
        "ml_scored":      ml_loaded() and not pan_match and not gstin_match,
    }


# ── Explanation builder ───────────────────────────────────────────────────────

def _field_strength(score: float, high: float = 0.75, med: float = 0.45) -> str:
    if score >= high:
        return "strong"
    if score >= med:
        return "moderate"
    return "weak"


def build_evidence(rec_a: dict, rec_b: dict, scores: dict[str, Any]) -> dict:
    conf = scores["confidence"]
    fields: list[dict] = []

    # Name
    ns = scores["name_score"]
    fields.append({
        "field": "business_name",
        "label": "Business Name",
        "value_a": rec_a.get("normalized_name"),
        "value_b": rec_b.get("normalized_name"),
        "score": ns,
        "strength": _field_strength(ns, 0.85, 0.65),
        "method": "Jaro-Winkler similarity",
        "why": f"Name similarity {round(ns*100)}% — "
               + ("strong signal" if ns >= 0.85 else "moderate signal" if ns >= 0.65 else "weak signal"),
    })

    # Address
    ads = scores["address_score"]
    fields.append({
        "field": "address",
        "label": "Address",
        "value_a": rec_a.get("normalized_address"),
        "value_b": rec_b.get("normalized_address"),
        "score": ads,
        "strength": _field_strength(ads, 0.50, 0.20),
        "method": "Token overlap",
        "why": f"Address token overlap {round(ads*100)}%",
    })

    # PAN
    pa, pb = rec_a.get("pan"), rec_b.get("pan")
    if pa or pb:
        pm = scores["pan_match"]
        fields.append({
            "field": "pan",
            "label": "PAN",
            "value_a": pa,
            "value_b": pb,
            "score": 1.0 if pm else 0.0,
            "strength": "strong" if pm else ("missing" if not pa or not pb else "mismatch"),
            "method": "Exact match",
            "why": (
                "PAN numbers match — deterministic identifier (very strong)"
                if pm else
                "PAN not present in one or both records"
                if not pa or not pb else
                "PAN numbers differ — significant non-match signal"
            ),
        })

    # GSTIN
    ga, gb = rec_a.get("gstin"), rec_b.get("gstin")
    if ga or gb:
        gm = scores["gstin_match"]
        fields.append({
            "field": "gstin",
            "label": "GSTIN",
            "value_a": ga,
            "value_b": gb,
            "score": 1.0 if gm else 0.0,
            "strength": "strong" if gm else ("missing" if not ga or not gb else "mismatch"),
            "method": "Exact match",
            "why": (
                "GSTIN numbers match — deterministic identifier (strong)"
                if gm else
                "GSTIN not present in one or both records"
                if not ga or not gb else
                "GSTIN numbers differ"
            ),
        })

    # Pincode
    pca, pcb = rec_a.get("pincode"), rec_b.get("pincode")
    pcm = scores["pincode_match"]
    fields.append({
        "field": "pincode",
        "label": "Pincode",
        "value_a": pca,
        "value_b": pcb,
        "score": 1.0 if pcm else 0.0,
        "strength": "supporting" if pcm else "neutral",
        "method": "Exact match",
        "why": "Same pincode — corroborating geographic signal" if pcm else "Different pincodes",
    })

    # Summary and recommendation
    if conf >= 0.85:
        summary = "Strong match — records almost certainly represent the same business."
        recommendation = "Safe to auto-link. UBID assigned."
        risk = "low"
    elif conf >= 0.70:
        summary = "Probable match — multiple signals agree but ambiguity remains."
        recommendation = "Human review recommended to confirm merge."
        risk = "medium"
    elif conf >= 0.50:
        summary = "Uncertain match — some signals agree, others are weak or absent."
        recommendation = "Careful review required. Verify PAN / GSTIN if available."
        risk = "medium-high"
    else:
        summary = "Unlikely match — evidence does not support same-business hypothesis."
        recommendation = "Records likely refer to different businesses."
        risk = "high"

    improvements: list[str] = []
    if not pa or not pb:
        improvements.append("Adding PAN to both records enables deterministic matching.")
    if not ga or not gb:
        improvements.append("Adding GSTIN would provide strong corroborating evidence.")
    if scores["name_score"] < 0.70:
        improvements.append("Names are dissimilar — verify business name spelling across departments.")
    if scores["address_score"] < 0.30:
        improvements.append("Addresses have low overlap — verify registered address in both systems.")

    return {
        "summary": summary,
        "recommendation": recommendation,
        "risk": risk,
        "confidence": conf,
        "fields": fields,
        "departments": {
            "record_a": rec_a.get("department_code"),
            "record_b": rec_b.get("department_code"),
        },
        "blocking_signal": (
            "Matched via PAN block" if scores["pan_match"] else
            "Matched via GSTIN block" if scores["gstin_match"] else
            f"Matched via pincode {rec_a.get('pincode')} + name-prefix block"
        ),
        "improvements": improvements,
    }


# ── Blocking index ────────────────────────────────────────────────────────────

def _build_blocking_index(records: list[dict]) -> dict[str, list[str]]:
    """Returns {block_key: [record_id, ...]}."""
    idx: dict[str, list[str]] = defaultdict(list)
    for rec in records:
        rid = str(rec["id"])
        if rec.get("pan"):
            idx[f"PAN:{rec['pan']}"].append(rid)
        if rec.get("gstin"):
            idx[f"GST:{rec['gstin'][:10]}"].append(rid)
        if rec.get("pincode") and rec.get("normalized_name"):
            prefix = rec["normalized_name"][:4].lower().strip()
            if len(prefix) >= 2:
                idx[f"PIN:{rec['pincode']}:NAM:{prefix}"].append(rid)
    return idx


# ── Main pipeline ─────────────────────────────────────────────────────────────

async def run_er_pipeline(
    db: AsyncSession,
    run: ERRun,
    cfg: ERConfig = DEFAULT_CONFIG,
) -> dict[str, int]:
    """
    Execute the full ER pipeline.  Commits on success, marks run FAILED on error.
    Returns a metrics dict.
    """
    try:
        return await _pipeline(db, run, cfg)
    except Exception as exc:
        run.status = ERRunStatus.FAILED
        run.error_message = str(exc)[:1000]
        run.completed_at = datetime.now(timezone.utc)
        await db.commit()
        raise


async def _pipeline(db: AsyncSession, run: ERRun, cfg: ERConfig) -> dict[str, int]:
    import time as _time
    _t0 = _time.time()

    # 1. Load records ──────────────────────────────────────────────────────────
    result = await db.execute(
        select(SourceRecord).where(
            SourceRecord.resolution_status.in_([
                ResolutionStatus.PENDING, ResolutionStatus.IN_REVIEW,
            ])
        )
    )
    records = result.scalars().all()

    rec_map: dict[str, dict] = {
        str(r.id): {
            "id": str(r.id),
            "department_code": r.department_code,
            "normalized_name": r.normalized_name,
            "raw_name": r.raw_name,
            "normalized_address": r.normalized_address,
            "pincode": r.pincode,
            "district": r.district,
            "pan": r.pan,
            "gstin": r.gstin,
            "registration_number": r.registration_number,
            "owner_name": r.owner_name,
        }
        for r in records
    }
    run.total_records = len(rec_map)
    print(f"  [ER] step1 load: {len(rec_map)} records in {_time.time()-_t0:.1f}s", flush=True)

    # 2. Blocking ──────────────────────────────────────────────────────────────
    block_idx = _build_blocking_index(list(rec_map.values()))
    print(f"  [ER] step2 blocking: {len(block_idx)} blocks in {_time.time()-_t0:.1f}s", flush=True)

    # 3. Candidate pair generation (cross-department, deduplicated) ────────────
    seen_pk: set[str] = set()
    existing_pks = await db.execute(
        select(ERCandidatePair.pair_key).where(ERCandidatePair.er_run_id == run.id)
    )
    for (pk,) in existing_pks:
        seen_pk.add(pk)

    MAX_BLOCK_SIZE = 40
    pairs: list[tuple[str, str, str]] = []

    for bkey, rids in block_idx.items():
        if len(rids) < 2:
            continue
        capped = rids[:MAX_BLOCK_SIZE] if bkey.startswith("PIN:") else rids
        for i in range(len(capped)):
            for j in range(i + 1, len(capped)):
                ia, ib = capped[i], capped[j]
                if ia == ib:
                    continue
                if rec_map[ia]["department_code"] == rec_map[ib]["department_code"]:
                    continue
                pk = _pair_key(ia, ib)
                if pk in seen_pk:
                    continue
                seen_pk.add(pk)
                pairs.append((ia, ib, bkey))

    run.pairs_generated = len(pairs)
    print(f"  [ER] step3 pairs: {len(pairs)} pairs in {_time.time()-_t0:.1f}s", flush=True)

    # 4. Score + classify ──────────────────────────────────────────────────────
    from sqlalchemy import insert as sa_insert
    BATCH = 200

    uf = UnionFind()
    auto_matched = review_needed = non_matched = 0
    cp_rows: list[dict] = []
    review_pairs: list[tuple[str, str, dict]] = []
    # Track confidence of each auto-matched pair so clusters get real scores
    auto_pair_confs: dict[str, float] = {}   # pair_key → confidence

    for ia, ib, bkey in pairs:
        scores = _score_pair(rec_map[ia], rec_map[ib], cfg)
        conf   = scores["confidence"]

        if conf >= cfg.auto_match_threshold:
            decision = PairDecision.AUTO_MATCH
            auto_matched += 1
            uf.union(ia, ib)
            evid = build_evidence(rec_map[ia], rec_map[ib], scores)
            auto_pair_confs[_pair_key(ia, ib)] = conf
        elif conf >= cfg.review_threshold:
            decision = PairDecision.REVIEW_NEEDED
            review_needed += 1
            review_pairs.append((ia, ib, scores))
            evid = build_evidence(rec_map[ia], rec_map[ib], scores)
        else:
            decision = PairDecision.NON_MATCH
            non_matched += 1
            continue

        cp_rows.append({
            "er_run_id":        run.id,
            "record_a_id":      uuid.UUID(ia),
            "record_b_id":      uuid.UUID(ib),
            "pair_key":         _pair_key(ia, ib),
            "confidence_score": conf,
            "name_score":       scores["name_score"],
            "address_score":    scores["address_score"],
            "pan_match":        scores["pan_match"],
            "gstin_match":      scores["gstin_match"],
            "pincode_match":    scores["pincode_match"],
            "decision":         decision,
            "evidence":         evid,
            "blocking_key":     bkey,
        })

    print(f"  [ER] step4 score: auto={auto_matched} review={review_needed} non={non_matched} in {_time.time()-_t0:.1f}s", flush=True)

    # Bulk insert candidate pairs
    for i in range(0, len(cp_rows), BATCH):
        await db.execute(sa_insert(ERCandidatePair), cp_rows[i : i + BATCH])
    await db.flush()
    print(f"  [ER] step4b pairs persisted: {len(cp_rows)} rows in {_time.time()-_t0:.1f}s", flush=True)

    # 5. Review cases — bulk insert (no per-row flushes) ──────────────────────
    existing_rc = await db.execute(
        select(ReviewCase.pair_key).where(ReviewCase.pair_key.isnot(None))
    )
    existing_rc_keys = {pk for (pk,) in existing_rc}

    rc_rows: list[dict] = []
    in_review_ids: set[str] = set()

    for ia, ib, scores in review_pairs:
        pk = _pair_key(ia, ib)
        if pk in existing_rc_keys:
            continue
        evid = build_evidence(rec_map[ia], rec_map[ib], scores)
        rc_rows.append({
            "id":               uuid.uuid4(),
            "record_a_id":      uuid.UUID(ia),
            "record_b_id":      uuid.UUID(ib),
            "confidence_score": scores["confidence"],
            "name_score":       scores["name_score"],
            "address_score":    scores["address_score"],
            "pan_match":        scores["pan_match"],
            "gstin_match":      scores["gstin_match"],
            "status":           ReviewStatus.PENDING,
            "priority":         int(scores["confidence"] * 100),
            "priority_level":   "P2" if scores["confidence"] >= 0.70 else "P3",
            "er_run_id":        run.id,
            "pair_key":         pk,
            "evidence":         evid,
        })
        in_review_ids.add(ia)
        in_review_ids.add(ib)

    review_cases_created = len(rc_rows)
    if rc_rows:
        for i in range(0, len(rc_rows), BATCH):
            await db.execute(sa_insert(ReviewCase), rc_rows[i : i + BATCH])

    if in_review_ids:
        await db.execute(
            update(SourceRecord)
            .where(SourceRecord.id.in_([uuid.UUID(rid) for rid in in_review_ids]))
            .where(SourceRecord.resolution_status == ResolutionStatus.PENDING)
            .values(resolution_status=ResolutionStatus.IN_REVIEW)
        )

    await db.flush()
    print(f"  [ER] step5 review cases: {review_cases_created} created in {_time.time()-_t0:.1f}s", flush=True)

    # 6. Clustering + UBID assignment — fully batched ─────────────────────────
    cluster_groups = uf.groups()

    existing_ck_result = await db.execute(select(UBIDCluster.cluster_key))
    existing_ck = {ck for (ck,) in existing_ck_result}

    # Load all existing entity UBIDs at once — avoids one SELECT per cluster
    existing_ubid_result = await db.execute(select(BusinessEntity.ubid, BusinessEntity.id))
    existing_ubid_map: dict[str, uuid.UUID] = {ubid: eid for ubid, eid in existing_ubid_result}

    clusters_created = ubids_assigned = 0
    entity_rows:  list[dict] = []
    cluster_rows: list[dict] = []
    member_rows:  list[dict] = []
    # (member_ids, entity_id, cluster_id, dept_count) for post-insert updates
    pending_updates: list[tuple[list[str], uuid.UUID, uuid.UUID, int]] = []

    for root, member_ids in cluster_groups.items():
        if len(member_ids) < 2:
            continue
        ck = _cluster_key(member_ids)
        if ck in existing_ck:
            continue

        members_data = [rec_map[m] for m in member_ids if m in rec_map]
        pan   = next((r["pan"]     for r in members_data if r.get("pan")),     None)
        gstin = next((r["gstin"]   for r in members_data if r.get("gstin")),   None)
        pc    = next((r["pincode"] for r in members_data if r.get("pincode")), None)
        dist  = next((r["district"]for r in members_data if r.get("district")),None)
        depts = list({r["department_code"] for r in members_data})

        shops_rec = next((r for r in members_data if r["department_code"] == "SHOPS"), None)
        canonical_name = (
            shops_rec["normalized_name"]
            if shops_rec and shops_rec.get("normalized_name")
            else next((r["normalized_name"] for r in members_data if r.get("normalized_name")), "Unknown")
        )

        ubid = _generate_ubid(pan, gstin)

        # Compute real cluster confidence from the auto-matched pair scores.
        cluster_conf = round(
            sum(
                auto_pair_confs[_pair_key(ia, ib)]
                for ia in member_ids
                for ib in member_ids
                if ia < ib and _pair_key(ia, ib) in auto_pair_confs
            ) / max(1, sum(
                1 for ia in member_ids
                for ib in member_ids
                if ia < ib and _pair_key(ia, ib) in auto_pair_confs
            )),
            3,
        ) if any(
            _pair_key(ia, ib) in auto_pair_confs
            for ia in member_ids for ib in member_ids if ia < ib
        ) else 0.85

        # Reuse existing entity or queue a new one — no DB query per cluster
        if ubid not in existing_ubid_map:
            entity_id = uuid.uuid4()
            entity_rows.append({
                "id":                  entity_id,
                "ubid":                ubid,
                "canonical_name":      canonical_name,
                "canonical_pan":       pan,
                "canonical_gstin":     gstin,
                "primary_pincode":     pc,
                "district":            dist,
                "confidence_score":    cluster_conf,
                "status":              BusinessStatus.REVIEW_NEEDED,
                "linked_records_count": len(member_ids),
                "dept_count":          len(depts),
            })
            existing_ubid_map[ubid] = entity_id
            ubids_assigned += 1
        else:
            entity_id = existing_ubid_map[ubid]

        cluster_id = uuid.uuid4()
        cluster_rows.append({
            "id":               cluster_id,
            "cluster_key":      ck,
            "ubid":             ubid,
            "status":           ClusterStatus.ACTIVE,
            "er_run_id":        run.id,
            "canonical_name":   canonical_name,
            "canonical_pan":    pan,
            "canonical_gstin":  gstin,
            "primary_pincode":  pc,
            "district":         dist,
            "member_count":     len(member_ids),
            "dept_count":       len(depts),
            "confidence_score": cluster_conf,
            "business_entity_id": entity_id,
        })

        for mid in member_ids:
            member_rows.append({
                "id":               uuid.uuid4(),
                "cluster_id":       cluster_id,
                "source_record_id": uuid.UUID(mid),
                "er_run_id":        run.id,
            })

        pending_updates.append((member_ids, entity_id, cluster_id, len(depts)))
        clusters_created += 1

    # Insert entities first (clusters FK → entities)
    if entity_rows:
        for i in range(0, len(entity_rows), BATCH):
            await db.execute(sa_insert(BusinessEntity), entity_rows[i : i + BATCH])
        await db.flush()

    # Insert clusters (members FK → clusters)
    if cluster_rows:
        for i in range(0, len(cluster_rows), BATCH):
            await db.execute(sa_insert(UBIDCluster), cluster_rows[i : i + BATCH])
        await db.flush()

    # Insert members
    if member_rows:
        for i in range(0, len(member_rows), BATCH):
            await db.execute(sa_insert(ClusterMember), member_rows[i : i + BATCH])

    # Update source records + back-fill cluster_id on entities
    for member_ids, entity_id, cluster_id, dept_count in pending_updates:
        await db.execute(
            update(SourceRecord)
            .where(SourceRecord.id.in_([uuid.UUID(m) for m in member_ids]))
            .values(business_entity_id=entity_id, resolution_status=ResolutionStatus.LINKED)
        )
        await db.execute(
            update(BusinessEntity)
            .where(BusinessEntity.id == entity_id)
            .values(cluster_id=cluster_id, linked_records_count=len(member_ids), dept_count=dept_count)
        )

    await db.flush()
    print(f"  [ER] step6 clustering: {clusters_created} clusters, {ubids_assigned} UBIDs in {_time.time()-_t0:.1f}s", flush=True)

    # 7. Finalise run record ───────────────────────────────────────────────────
    run.auto_matched         = auto_matched
    run.review_needed        = review_needed
    run.non_matched          = non_matched
    run.clusters_created     = clusters_created
    run.ubids_assigned       = ubids_assigned
    run.review_cases_created = review_cases_created
    run.status               = ERRunStatus.COMPLETED
    run.completed_at         = datetime.now(timezone.utc)

    await db.commit()
    print(f"  [ER] done — committed in {_time.time()-_t0:.1f}s total", flush=True)

    return {
        "total_records":        run.total_records,
        "pairs_generated":      run.pairs_generated,
        "auto_matched":         auto_matched,
        "review_needed":        review_needed,
        "non_matched":          non_matched,
        "clusters_created":     clusters_created,
        "ubids_assigned":       ubids_assigned,
        "review_cases_created": review_cases_created,
    }


def _generate_ubid(pan: str | None, gstin: str | None) -> str:
    if pan:
        return f"UBID-PAN-{pan}"
    if gstin:
        return f"UBID-GST-{gstin[:10]}"
    return f"UBID-{str(uuid.uuid4())[:8].upper()}"
