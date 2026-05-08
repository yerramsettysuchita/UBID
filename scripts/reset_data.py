"""
Wipes all business data tables (preserves users + departments) and re-applies
the missing unique constraint. Run this before ingest.py on a dirty database.
"""
import asyncio, sys, ssl
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))
from app.core.config import settings
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text


TRUNCATE_ORDER = [
    "er_candidate_pairs",
    "reviewer_decisions",
    "review_comments",
    "review_cases",
    "cluster_history",
    "cluster_members",
    "business_events",
    "source_records",
    "business_entities",
    "ubid_clusters",
    "er_runs",
]


async def main():
    kwargs = {"pool_pre_ping": True}
    if "neon.tech" in settings.database_url or "ssl=require" in settings.database_url:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        kwargs["connect_args"] = {"ssl": ctx}
    engine = create_async_engine(settings.database_url, **kwargs)

    async with engine.begin() as conn:
        for table in TRUNCATE_ORDER:
            # Check table exists before truncating
            exists = (await conn.execute(text(
                f"SELECT to_regclass('public.{table}')"
            ))).scalar()
            if exists:
                await conn.execute(text(f"TRUNCATE TABLE {table} CASCADE"))
                print(f"  Cleared {table}")
            else:
                print(f"  Skipped {table} (table not found)")

        # Add unique constraint if missing
        exists = (await conn.execute(text(
            "SELECT 1 FROM pg_constraint WHERE conname = 'uq_source_dept_record'"
        ))).scalar()
        if exists:
            print("Unique constraint already exists.")
        else:
            await conn.execute(text(
                "ALTER TABLE source_records "
                "ADD CONSTRAINT uq_source_dept_record "
                "UNIQUE (department_code, source_record_id)"
            ))
            print("Unique constraint added.")

    await engine.dispose()
    print("\nReset complete. Now run: python scripts/ingest.py")


if __name__ == "__main__":
    asyncio.run(main())
