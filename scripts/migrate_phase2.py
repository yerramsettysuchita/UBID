"""
Phase 2 database migration.
Creates new tables and adds new columns to existing tables.
Safe to run multiple times (idempotent).

Usage (from repo root with venv active):
    python scripts/migrate_phase2.py
"""
import asyncio, sys, ssl
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.core.config import settings
from app.core.database import Base
# Import all models so metadata is populated
import app.models.entities  # noqa: F401


def _engine():
    kwargs: dict = {"echo": False, "pool_pre_ping": True}
    url = settings.database_url
    if "neon.tech" in url or "ssl=require" in url:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        kwargs["connect_args"] = {"ssl": ctx}
    return create_async_engine(url, **kwargs)


# New columns to add to existing tables (idempotent via IF NOT EXISTS)
ALTER_STATEMENTS = [
    # business_entities
    "ALTER TABLE business_entities ADD COLUMN IF NOT EXISTS cluster_id UUID REFERENCES ubid_clusters(id)",
    "ALTER TABLE business_entities ADD COLUMN IF NOT EXISTS linked_records_count INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE business_entities ADD COLUMN IF NOT EXISTS dept_count INTEGER NOT NULL DEFAULT 0",
    # review_cases
    "ALTER TABLE review_cases ADD COLUMN IF NOT EXISTS er_run_id UUID REFERENCES er_runs(id)",
    "ALTER TABLE review_cases ADD COLUMN IF NOT EXISTS pair_key VARCHAR(64)",
    "ALTER TABLE review_cases ADD COLUMN IF NOT EXISTS evidence JSONB",
]


async def main():
    engine = _engine()

    async with engine.begin() as conn:
        # Create all new tables (checkfirst=True skips existing ones)
        await conn.run_sync(Base.metadata.create_all, checkfirst=True)
    print("OK New tables created (or already existed)")

    Sess = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with Sess() as sess:
        async with sess.begin():
            for stmt in ALTER_STATEMENTS:
                try:
                    await sess.execute(__import__("sqlalchemy", fromlist=["text"]).text(stmt))
                    print(f"  OK {stmt[:60]}…")
                except Exception as e:
                    if "already exists" in str(e).lower():
                        print(f"  - Already exists, skipping")
                    else:
                        print(f"  FAIL {e}")

    await engine.dispose()
    print("\nOK Phase 2 migration complete")
    print("  Next step: python scripts/run_er.py")


if __name__ == "__main__":
    asyncio.run(main())
