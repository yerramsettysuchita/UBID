"""
Populate business_events from source records so the Activity Timeline tab works.
Maps each source record's last_event_date → a BusinessEvent on its linked entity.
"""
import asyncio, sys, uuid
from pathlib import Path
from datetime import date

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import select, insert as sa_insert
from app.core.config import settings
from app.models.entities import BusinessEntity, BusinessEvent, SourceRecord
from app.models.base import EventType

DEPT_EVENT_MAP = {
    "SHOPS":     EventType.INSPECTION,
    "FACTORIES": EventType.INSPECTION,
    "KSPCB":     EventType.RENEWAL,
    "BESCOM":    EventType.METER_READ,
}

DEPT_DESC_MAP = {
    "SHOPS":     "Annual shops & establishment inspection",
    "FACTORIES": "Factory licence compliance inspection",
    "KSPCB":     "Pollution consent renewal",
    "BESCOM":    "Electricity meter reading",
}


async def main():
    engine = create_async_engine(settings.database_url, pool_pre_ping=True)
    Sess   = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with Sess() as db:
        # Load all linked source records with a last_event_date
        rows = await db.execute(
            select(SourceRecord)
            .where(SourceRecord.business_entity_id.isnot(None))
            .where(SourceRecord.last_event_date.isnot(None))
        )
        records = rows.scalars().all()
        print(f"Source records with events: {len(records)}")

        # Check existing events
        existing = (await db.execute(
            select(BusinessEvent.source_record_id)
        )).scalars().all()
        existing_set = set(existing)

        event_rows = []
        for rec in records:
            if rec.id in existing_set:
                continue
            event_type = DEPT_EVENT_MAP.get(rec.department_code, EventType.INSPECTION)
            desc = DEPT_DESC_MAP.get(rec.department_code, "Department event")

            event_rows.append({
                "id": uuid.uuid4(),
                "business_entity_id": rec.business_entity_id,
                "source_record_id":   rec.id,
                "department_code":    rec.department_code,
                "event_type":         event_type,
                "event_date":         rec.last_event_date,
                "event_description":  desc,
                "event_outcome":      rec.registration_status or "Recorded",
                "source_event_id":    rec.source_record_id,
            })

        if not event_rows:
            print("No new events to insert.")
            await engine.dispose()
            return

        BATCH = 500
        inserted = 0
        for i in range(0, len(event_rows), BATCH):
            await db.execute(sa_insert(BusinessEvent), event_rows[i : i + BATCH])
            inserted += len(event_rows[i : i + BATCH])

        await db.commit()
        print(f"Inserted {inserted} business events")

        # Verify a sample
        total = (await db.execute(
            select(BusinessEvent.id)
        )).scalars().all()
        print(f"Total events in DB: {len(total)}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
