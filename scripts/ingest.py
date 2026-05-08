"""
Fast ingestion pipeline — bulk operations, 2 queries per department.
Run from repo root: python scripts/ingest.py
"""
import asyncio, argparse, hashlib, json, ssl, sys
from datetime import date, datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import select, update, insert
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.core.config import settings
from app.models.entities import Department, SourceRecord
from app.services.normalizer import (
    normalize_business_name, normalize_pan, normalize_gstin,
    normalize_pincode, normalize_address,
)


def _engine():
    kwargs: dict = {"echo": False, "pool_pre_ping": True}
    url = settings.database_url
    if "neon.tech" in url or "ssl=require" in url:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        kwargs["connect_args"] = {"ssl": ctx}
    return create_async_engine(url, **kwargs)


def _hash(record: dict) -> str:
    return hashlib.sha256(
        json.dumps(record, sort_keys=True, default=str).encode()
    ).hexdigest()[:32]


def _date(v) -> date | None:
    if not v:
        return None
    if isinstance(v, date):
        return v
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y"):
        try:
            return datetime.strptime(str(v), fmt).date()
        except ValueError:
            pass
    return None


# ── Adapters ─────────────────────────────────────────────────────────────────
def adapt_shops(r: dict) -> dict:
    return dict(
        source_record_id=r["record_id"],
        raw_name=r.get("business_name"),
        normalized_name=normalize_business_name(r.get("business_name", "")),
        registration_number=r.get("registration_number"),
        registration_date=_date(r.get("registration_date")),
        registration_status=r.get("registration_status"),
        owner_name=r.get("owner_name"),
        raw_address=r.get("address"),
        normalized_address=normalize_address(r.get("address")),
        pincode=normalize_pincode(r.get("pincode")),
        district=r.get("district"),
        pan=normalize_pan(r.get("pan")),
        gstin=normalize_gstin(r.get("gstin")),
        last_event_date=_date(r.get("last_inspection_date")),
    )


def adapt_factories(r: dict) -> dict:
    return dict(
        source_record_id=r["record_id"],
        raw_name=r.get("factory_name"),
        normalized_name=normalize_business_name(r.get("factory_name", "")),
        registration_number=r.get("factory_license_number"),
        registration_date=None,
        registration_status="Active" if r.get("license_valid_until") else "Unknown",
        owner_name=r.get("owner_name"),
        raw_address=r.get("address"),
        normalized_address=normalize_address(r.get("address")),
        pincode=normalize_pincode(r.get("pincode")),
        district=r.get("district"),
        pan=normalize_pan(r.get("pan")),
        gstin=normalize_gstin(r.get("gstin")),
        last_event_date=_date(r.get("last_inspection_date")),
    )


def adapt_kspcb(r: dict) -> dict:
    return dict(
        source_record_id=r["record_id"],
        raw_name=r.get("unit_name"),
        normalized_name=normalize_business_name(r.get("unit_name", "")),
        registration_number=r.get("consent_number"),
        registration_date=None,
        registration_status=r.get("compliance_status", "Unknown"),
        owner_name=None,
        raw_address=r.get("address"),
        normalized_address=normalize_address(r.get("address")),
        pincode=normalize_pincode(r.get("pincode")),
        district=r.get("district"),
        pan=normalize_pan(r.get("pan")),
        gstin=normalize_gstin(r.get("gstin")),
        last_event_date=_date(r.get("last_renewal_date")),
    )


def adapt_bescom(r: dict) -> dict:
    return dict(
        source_record_id=r["event_id"],
        raw_name=r.get("consumer_name"),
        normalized_name=normalize_business_name(r.get("consumer_name", "")),
        registration_number=r.get("consumer_number"),
        registration_date=None,
        registration_status="Active",
        owner_name=None,
        raw_address=r.get("address"),
        normalized_address=normalize_address(r.get("address")),
        pincode=normalize_pincode(r.get("pincode")),
        district=None,
        pan=normalize_pan(r.get("pan")),
        gstin=None,
        last_event_date=_date(r.get("event_date")),
    )


ADAPTERS = {
    "SHOPS":     adapt_shops,
    "FACTORIES": adapt_factories,
    "KSPCB":     adapt_kspcb,
    "BESCOM":    adapt_bescom,
}


async def ingest_dept(sess: AsyncSession, dept: Department) -> dict:
    path = Path(dept.adapter_config.get("path", ""))
    if not path.exists():
        return {"error": f"File not found: {path}"}

    adapter = ADAPTERS.get(dept.code)
    if not adapter:
        return {"error": "No adapter"}

    raw_list = json.loads(path.read_text(encoding="utf-8"))

    # ── Step 1: normalise all records in Python (no DB queries) ──────────────
    canonical_records = []
    for raw in raw_list:
        try:
            canon = adapter(raw)
            canon["department_code"] = dept.code
            canon["data_hash"] = _hash(raw)
            canonical_records.append(canon)
        except Exception as e:
            print(f"    [skip] {e}")

    if not canonical_records:
        return {"inserted": 0, "updated": 0, "skipped": 0}

    # Deduplicate within the batch (keep last occurrence per source_record_id)
    seen: dict = {}
    for r in canonical_records:
        seen[r["source_record_id"]] = r
    canonical_records = list(seen.values())

    # Batch upsert — asyncpg param limit = 32767, ~18 cols/row → max ~1800/batch
    BATCH = 200
    for i in range(0, len(canonical_records), BATCH):
        chunk = canonical_records[i : i + BATCH]
        stmt = pg_insert(SourceRecord).values(chunk)
        stmt = stmt.on_conflict_do_update(
            index_elements=["department_code", "source_record_id"],
            set_={
                col: stmt.excluded[col]
                for col in [
                    "normalized_name", "registration_status", "pan", "gstin",
                    "pincode", "district", "last_event_date", "data_hash",
                ]
            },
        )
        await sess.execute(stmt)
    await sess.flush()

    await sess.execute(
        update(Department).where(Department.id == dept.id).values(
            last_ingested_at=datetime.now(timezone.utc),
        )
    )

    return {"inserted": len(canonical_records), "updated": 0, "skipped": 0}


async def main(dept_filter: str | None):
    engine = _engine()
    Sess   = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with Sess() as sess:
        res   = await sess.execute(select(Department).where(Department.is_active == True))
        depts = res.scalars().all()
        if dept_filter:
            depts = [d for d in depts if d.code == dept_filter.upper()]

        print(f"\nIngesting {len(depts)} department(s)…\n")
        totals = dict(inserted=0, updated=0, skipped=0)

        for dept in depts:
            print(f"  [{dept.code}]  {dept.adapter_config.get('path')} …", end="", flush=True)
            summary = await ingest_dept(sess, dept)
            if "error" in summary:
                print(f"  ERROR: {summary['error']}")
            else:
                print(f"  +{summary['inserted']} inserted   ~{summary['updated']} updated   ={summary['skipped']} unchanged")
                for k in totals:
                    totals[k] += summary[k]
            await sess.commit()   # commit after each dept — safe to interrupt

    await engine.dispose()
    print(f"\n✓ Done — {totals['inserted']} inserted, {totals['updated']} updated, {totals['skipped']} unchanged")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dept", default=None)
    args = parser.parse_args()
    asyncio.run(main(args.dept))
