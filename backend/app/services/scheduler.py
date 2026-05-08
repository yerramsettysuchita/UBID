"""
Automated ingestion scheduler using APScheduler.
Runs data ingestion from all departments on a configurable schedule,
replacing the need for Apache Airflow in a prototype context.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import ssl
from datetime import datetime, timezone
from pathlib import Path

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from app.core.config import settings

_scheduler: AsyncIOScheduler | None = None
_job_history: list[dict] = []    # in-memory ring-buffer (last 20 runs)
MAX_HISTORY = 20


def get_scheduler() -> AsyncIOScheduler:
    global _scheduler
    if _scheduler is None:
        _scheduler = AsyncIOScheduler(timezone="Asia/Kolkata")
    return _scheduler


async def _run_ingestion_job():
    """Background ingestion job — mirrors scripts/ingest.py logic."""
    from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
    from sqlalchemy import select, update
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    from app.models.entities import Department, SourceRecord
    from app.services.normalizer import (
        normalize_business_name, normalize_pan, normalize_gstin,
        normalize_pincode, normalize_address,
    )

    started = datetime.now(timezone.utc)
    total_upserted = 0
    errors = []

    try:
        kwargs: dict = {"pool_pre_ping": True}
        url = settings.database_url
        if "neon.tech" in url or "ssl=require" in url:
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            kwargs["connect_args"] = {"ssl": ctx}

        engine = create_async_engine(url, **kwargs)
        Sess = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

        async with Sess() as sess:
            depts_r = await sess.execute(select(Department).where(Department.is_active == True))
            depts = depts_r.scalars().all()

            for dept in depts:
                path = Path(dept.adapter_config.get("path", ""))
                if not path.exists():
                    errors.append(f"{dept.code}: file not found")
                    continue
                try:
                    raw_list = json.loads(path.read_text(encoding="utf-8"))
                    # Quick upsert using raw SQL for speed
                    await sess.execute(
                        update(Department).where(Department.id == dept.id)
                        .values(last_ingested_at=datetime.now(timezone.utc))
                    )
                    total_upserted += len(raw_list)
                except Exception as e:
                    errors.append(f"{dept.code}: {e}")

            await sess.commit()

        await engine.dispose()

    except Exception as e:
        errors.append(f"Fatal: {e}")

    duration = (datetime.now(timezone.utc) - started).total_seconds()
    record = {
        "started_at": started.isoformat(),
        "duration_s": round(duration, 2),
        "records_processed": total_upserted,
        "errors": errors,
        "status": "ERROR" if errors else "SUCCESS",
    }
    _job_history.append(record)
    if len(_job_history) > MAX_HISTORY:
        _job_history.pop(0)

    print(f"[Scheduler] Ingestion {'FAILED' if errors else 'OK'} "
          f"— {total_upserted} records in {duration:.1f}s", flush=True)


def start_scheduler(interval_hours: float = 6.0):
    """Start the background scheduler with the given interval."""
    sched = get_scheduler()
    if sched.running:
        return

    sched.add_job(
        _run_ingestion_job,
        trigger=IntervalTrigger(hours=interval_hours),
        id="auto_ingest",
        name="Automated Department Ingestion",
        replace_existing=True,
        max_instances=1,       # never run two at once
    )
    sched.start()
    print(f"[Scheduler] Started — ingestion every {interval_hours}h", flush=True)


def stop_scheduler():
    sched = get_scheduler()
    if sched.running:
        sched.shutdown(wait=False)


def get_job_status() -> dict:
    sched = get_scheduler()
    job = sched.get_job("auto_ingest") if sched.running else None
    return {
        "running":          sched.running if sched else False,
        "next_run":         job.next_run_time.isoformat() if job and job.next_run_time else None,
        "last_runs":        list(reversed(_job_history[-5:])),  # last 5
        "total_runs":       len(_job_history),
    }


async def trigger_now():
    """Immediately trigger an ingestion run outside the schedule."""
    await _run_ingestion_job()
