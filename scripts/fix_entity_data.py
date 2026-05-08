"""
Fixes two data quality issues in business_entities:
1. All entities have status=REVIEW_NEEDED — derive real status from source records
2. All entities have confidence=0.92 — derive from actual ER pair scores

Status logic:
  All source records Active/Compliant          → ACTIVE
  Any Cancelled/Expired but majority Active    → DORMANT
  All/majority Cancelled/Expired               → CLOSED
  No clear signal                              → REVIEW_NEEDED
"""
import asyncio, sys, ssl
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import select, update, func
from app.core.config import settings
from app.models.entities import BusinessEntity, SourceRecord, ERCandidatePair, ClusterMember, UBIDCluster
from app.models.base import BusinessStatus, PairDecision

ACTIVE_STATUSES   = {"Active", "Compliant", "active", "compliant"}
INACTIVE_STATUSES = {"Cancelled", "Expired", "cancelled", "expired", "Inactive"}


def _derive_status(reg_statuses: list[str]) -> BusinessStatus:
    if not reg_statuses:
        return BusinessStatus.REVIEW_NEEDED
    active   = sum(1 for s in reg_statuses if s in ACTIVE_STATUSES)
    inactive = sum(1 for s in reg_statuses if s in INACTIVE_STATUSES)
    total    = len(reg_statuses)
    if inactive == 0:
        return BusinessStatus.ACTIVE
    if active == 0:
        return BusinessStatus.CLOSED
    if active / total >= 0.6:
        return BusinessStatus.DORMANT
    return BusinessStatus.CLOSED


async def main():
    kwargs: dict = {"pool_pre_ping": True}
    if "neon.tech" in settings.database_url or "ssl=require" in settings.database_url:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        kwargs["connect_args"] = {"ssl": ctx}

    engine = create_async_engine(settings.database_url, **kwargs)
    Sess = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with Sess() as db:
        # ── Load all entities ────────────────────────────────────────────────
        ents_r = await db.execute(select(BusinessEntity))
        entities = ents_r.scalars().all()
        print(f"Entities to fix: {len(entities)}")

        # ── Load all source records grouped by business_entity_id ────────────
        sr_r = await db.execute(
            select(SourceRecord.business_entity_id, SourceRecord.registration_status)
            .where(SourceRecord.business_entity_id.isnot(None))
        )
        sr_map: dict = {}
        for eid, reg_status in sr_r:
            sr_map.setdefault(eid, []).append(reg_status or "")

        # ── Load min confidence per cluster from ER pairs ────────────────────
        # Get cluster_id → [confidence scores of AUTO_MATCH pairs for members]
        members_r = await db.execute(
            select(ClusterMember.cluster_id, ClusterMember.source_record_id)
        )
        cluster_records: dict = {}
        for cid, rid in members_r:
            cluster_records.setdefault(str(cid), set()).add(str(rid))

        pairs_r = await db.execute(
            select(ERCandidatePair.record_a_id, ERCandidatePair.record_b_id, ERCandidatePair.confidence_score)
            .where(ERCandidatePair.decision == PairDecision.AUTO_MATCH)
        )
        # Build record_id → [confidence scores]
        record_conf: dict = {}
        for ra, rb, conf in pairs_r:
            for rid in (str(ra), str(rb)):
                record_conf.setdefault(rid, []).append(float(conf))

        # cluster_id → avg confidence of member records
        cluster_conf: dict = {}
        for cid, rids in cluster_records.items():
            scores = [s for rid in rids for s in record_conf.get(rid, [])]
            cluster_conf[cid] = round(sum(scores) / len(scores), 3) if scores else 0.92

        # Load cluster_id per entity
        clusters_r = await db.execute(select(UBIDCluster.id, UBIDCluster.business_entity_id))
        cluster_for_entity: dict = {}
        for cid, beid in clusters_r:
            if beid:
                cluster_for_entity[str(beid)] = str(cid)

        # ── Apply fixes ───────────────────────────────────────────────────────
        status_counts: dict = {}
        updated = 0

        for entity in entities:
            reg_statuses = sr_map.get(entity.id, [])
            new_status   = _derive_status(reg_statuses)
            cid          = cluster_for_entity.get(str(entity.id))
            new_conf     = cluster_conf.get(cid, 0.92) if cid else 0.92

            status_counts[new_status.value] = status_counts.get(new_status.value, 0) + 1

            if entity.status != new_status or float(entity.confidence_score) != new_conf:
                entity.status           = new_status
                entity.confidence_score = new_conf
                updated += 1

        await db.commit()
        print(f"\nUpdated {updated} entities")
        print("\nNew status distribution:")
        for s, c in sorted(status_counts.items()):
            print(f"  {s}: {c}")

    await engine.dispose()
    print("\nDone.")


if __name__ == "__main__":
    asyncio.run(main())
