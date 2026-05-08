"""
CLI runner for the Phase 2 Entity Resolution pipeline.

Usage (from repo root with venv active):
    python scripts/run_er.py

Loads config from .env, connects to the DB, and runs the full ER pipeline.
Prints a summary metrics table on completion.
"""
import asyncio, sys, ssl
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.core.config import settings
from app.models.base import ERRunStatus
from app.models.entities import ERRun
from app.services.er import DEFAULT_CONFIG, run_er_pipeline


def _engine():
    kwargs: dict = {"echo": False, "pool_pre_ping": True}
    url = settings.database_url
    if "neon.tech" in url or "ssl=require" in url:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        kwargs["connect_args"] = {"ssl": ctx}
    return create_async_engine(url, **kwargs)


async def main():
    engine = _engine()
    Sess = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    run_key = f"cli-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}"
    cfg = DEFAULT_CONFIG

    print(f"\nUBID Entity Resolution — Phase 2")
    print(f"  Run key    : {run_key}")
    print(f"  Config v{cfg.version} : auto>={cfg.auto_match_threshold}  review>={cfg.review_threshold}")
    print(f"  Weights    : PAN={cfg.pan_exact_weight}  GSTIN={cfg.gstin_exact_weight}  name={cfg.name_sim_weight}  addr={cfg.address_sim_weight}")
    print()

    async with Sess() as sess:
        run = ERRun(
            run_key=run_key,
            status=ERRunStatus.RUNNING,
            config_version=cfg.version,
            config_snapshot=cfg.as_dict(),
        )
        sess.add(run)
        await sess.flush()
        await sess.refresh(run)

        print("Running pipeline…")
        metrics = await run_er_pipeline(sess, run, cfg)

    await engine.dispose()

    print("\n-- Results --------------------------------------")
    for k, v in metrics.items():
        print(f"  {k:<28} {v:>6}")

    total_p = metrics["pairs_generated"] or 1
    print(f"\n  auto-link rate   {metrics['auto_matched']/total_p*100:>5.1f}%")
    print(f"  review rate      {metrics['review_needed']/total_p*100:>5.1f}%")
    print(f"  non-match rate   {metrics['non_matched']/total_p*100:>5.1f}%")
    print("\nOK Done — review queue populated, UBIDs assigned.")


if __name__ == "__main__":
    asyncio.run(main())
