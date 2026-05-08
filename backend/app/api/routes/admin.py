from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_role
from app.core.database import get_db
from app.models.entities import AuditLog, Department, SourceRecord, User
from app.services.scheduler import get_job_status, trigger_now
from app.services.cache import get_cache_status

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/departments")
async def list_departments(
    current_user: User = Depends(require_role("ADMIN", "AUDITOR")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Department).where(Department.is_active == True))
    depts = result.scalars().all()
    return [
        {
            "id": str(d.id), "code": d.code, "name": d.name,
            "adapter_type": d.adapter_type,
            "last_ingested_at": d.last_ingested_at,
            "record_count": d.record_count,
            "is_active": d.is_active,
        }
        for d in depts
    ]


@router.get("/users")
async def list_users(
    current_user: User = Depends(require_role("ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.is_active == True))
    users = result.scalars().all()
    return [
        {"id": str(u.id), "email": u.email, "full_name": u.full_name,
         "role": u.role.value, "department_code": u.department_code,
         "last_login_at": u.last_login_at}
        for u in users
    ]


@router.get("/audit-logs")
async def list_audit_logs(
    page: int = 1,
    current_user: User = Depends(require_role("ADMIN", "AUDITOR")),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(AuditLog).order_by(AuditLog.created_at.desc()).offset((page - 1) * 50).limit(50)
    result = await db.execute(stmt)
    logs = result.scalars().all()
    return [
        {"id": str(l.id), "action": l.action, "entity_type": l.entity_type,
         "user_id": str(l.user_id) if l.user_id else None,
         "created_at": l.created_at}
        for l in logs
    ]


@router.get("/system/status")
async def system_status(
    current_user: User = Depends(require_role("ADMIN", "AUDITOR")),
):
    """Return system status: scheduler, cache, ML models."""
    from app.services import ml_model, dormancy_model
    cache = await get_cache_status()
    sched = get_job_status()
    return {
        "scheduler":    sched,
        "cache":        cache,
        "er_model":     {"loaded": ml_model.is_loaded(), "type": ml_model.get_meta().get("model_type"), "f1": ml_model.get_meta().get("f1_score")},
        "dormancy_model": {"loaded": dormancy_model.is_loaded(), "type": dormancy_model.get_meta().get("model_type"), "f1": dormancy_model.get_meta().get("f1_score")},
    }


@router.get("/scheduler/status")
async def scheduler_status(
    current_user: User = Depends(require_role("ADMIN", "AUDITOR")),
):
    """Return APScheduler status and recent ingestion run history."""
    return get_job_status()


@router.post("/ingestion/trigger")
async def trigger_ingestion(
    current_user: User = Depends(require_role("ADMIN")),
):
    """Immediately trigger a data ingestion run outside the schedule."""
    import asyncio
    asyncio.create_task(trigger_now())
    return {"status": "triggered", "message": "Ingestion job queued. Check /admin/scheduler/status for progress."}
