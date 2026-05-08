"""One-shot: adds the missing unique constraint to source_records."""
import asyncio, sys, ssl
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))
from app.core.config import settings
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text


async def main():
    kwargs = {"pool_pre_ping": True}
    if "neon.tech" in settings.database_url or "ssl=require" in settings.database_url:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        kwargs["connect_args"] = {"ssl": ctx}
    engine = create_async_engine(settings.database_url, **kwargs)

    async with engine.begin() as conn:
        # Count rows before
        total = (await conn.execute(text("SELECT COUNT(*) FROM source_records"))).scalar()
        print(f"Rows before cleanup: {total}")

        # Delete duplicate rows — keep only the row with the smallest ctid per (dept, record_id)
        await conn.execute(text("""
            DELETE FROM source_records a
            USING source_records b
            WHERE a.ctid > b.ctid
              AND a.department_code = b.department_code
              AND a.source_record_id = b.source_record_id
        """))

        total2 = (await conn.execute(text("SELECT COUNT(*) FROM source_records"))).scalar()
        print(f"Rows after dedup: {total2} (removed {total - total2})")

        # Now add the constraint
        exists = await conn.execute(text(
            "SELECT 1 FROM pg_constraint WHERE conname = 'uq_source_dept_record'"
        ))
        if exists.scalar():
            print("Constraint already exists.")
        else:
            await conn.execute(text(
                "ALTER TABLE source_records "
                "ADD CONSTRAINT uq_source_dept_record "
                "UNIQUE (department_code, source_record_id)"
            ))
            print("Constraint added OK.")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
