"""
Add performance indexes to speed up hot query paths.
Safe to run multiple times — uses IF NOT EXISTS.
"""
import asyncio, sys, ssl
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))
from app.core.config import settings
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

INDEXES = [
    # source_records — hit by search dept-filter, analytics dept coverage, ER pipeline
    "CREATE INDEX IF NOT EXISTS ix_sr_business_entity_id   ON source_records (business_entity_id)",
    "CREATE INDEX IF NOT EXISTS ix_sr_department_code      ON source_records (department_code)",
    "CREATE INDEX IF NOT EXISTS ix_sr_resolution_status    ON source_records (resolution_status)",
    "CREATE INDEX IF NOT EXISTS ix_sr_pincode              ON source_records (pincode)",
    # review_cases — hit by review queue, review detail, bulk-decide
    "CREATE INDEX IF NOT EXISTS ix_rc_status               ON review_cases (status)",
    "CREATE INDEX IF NOT EXISTS ix_rc_record_a_id          ON review_cases (record_a_id)",
    "CREATE INDEX IF NOT EXISTS ix_rc_record_b_id          ON review_cases (record_b_id)",
    "CREATE INDEX IF NOT EXISTS ix_rc_priority_level       ON review_cases (priority_level)",
    # business_entities — hit by search, analytics, dashboard
    "CREATE INDEX IF NOT EXISTS ix_be_primary_pincode      ON business_entities (primary_pincode)",
    "CREATE INDEX IF NOT EXISTS ix_be_district             ON business_entities (district)",
    "CREATE INDEX IF NOT EXISTS ix_be_status               ON business_entities (status)",
    # reviewer_decisions — hit by review history, case detail
    "CREATE INDEX IF NOT EXISTS ix_rd_review_case_id       ON reviewer_decisions (review_case_id)",
    # er_candidate_pairs — hit by ER pipeline idempotency check
    "CREATE INDEX IF NOT EXISTS ix_ecp_er_run_id           ON er_candidate_pairs (er_run_id)",
]


async def main():
    kwargs: dict = {"pool_pre_ping": True}
    if "neon.tech" in settings.database_url or "ssl=require" in settings.database_url:
        import ssl as _ssl
        ctx = _ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = _ssl.CERT_NONE
        kwargs["connect_args"] = {"ssl": ctx}

    engine = create_async_engine(settings.database_url, **kwargs)
    async with engine.begin() as conn:
        for ddl in INDEXES:
            await conn.execute(text(ddl))
            name = ddl.split("ix_")[1].split(" ")[0]
            print(f"  [OK] ix_{name}")

    await engine.dispose()
    print("\nAll indexes applied.")


if __name__ == "__main__":
    asyncio.run(main())
