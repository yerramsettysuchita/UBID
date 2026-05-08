"""
Celery task definitions.
Phase 0: stubs only — implementations go in Phase 1 and 2.
"""
from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "ubid_workers",
    broker=settings.redis_url,
    backend=settings.redis_url,
)

celery_app.conf.task_routes = {
    "app.workers.tasks.run_ingestion": {"queue": "ingestion"},
    "app.workers.tasks.run_entity_resolution": {"queue": "resolution"},
    "app.workers.tasks.run_activity_classification": {"queue": "classification"},
    "app.workers.tasks.run_model_retraining": {"queue": "retraining"},
}


@celery_app.task(name="app.workers.tasks.run_ingestion")
def run_ingestion(department_code: str | None = None) -> dict:
    """Ingest records from department adapters and upsert into source_records."""
    return {"status": "queued", "department": department_code or "all"}


@celery_app.task(name="app.workers.tasks.run_entity_resolution")
def run_entity_resolution() -> dict:
    """Run blocking, scoring, and UBID assignment for all PENDING source records."""
    return {"status": "queued"}


@celery_app.task(name="app.workers.tasks.run_activity_classification")
def run_activity_classification() -> dict:
    """Recompute status for all business entities based on event signals."""
    return {"status": "queued"}


@celery_app.task(name="app.workers.tasks.run_model_retraining")
def run_model_retraining() -> dict:
    """Retrain linkage classifier using accumulated reviewer decisions."""
    return {"status": "queued"}
