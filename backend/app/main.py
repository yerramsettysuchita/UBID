import logging
import time
import uuid

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

import asyncio

from app.api.routes import (
    admin, analytics, auth, business, dashboard, er, graph,
    operations, pincode, query, review, search, timeline,
)
from app.core.config import settings
from app.core.database import AsyncSessionLocal, engine

# ─── Logging ──────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  [%(name)s]  %(message)s",
)
logger = logging.getLogger("ubid.api")

# ─── App ──────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="UBID Platform API",
    version="1.0.0",
    description=(
        "Unified Business Identifier & Active Business Intelligence — "
        "Karnataka Commerce & Industry | AI for Bharat Hackathon Theme 1"
    ),
    docs_url="/docs",
    redoc_url="/redoc",
)

# ─── Startup: pre-warm connection pool ───────────────────────────────────────

@app.on_event("startup")
async def _startup():
    """Create tables, seed demo users, warm pool, start scheduler."""
    from app.services.scheduler import start_scheduler
    from app.core.security import hash_password
    from app.models import entities as _models  # noqa: F401 — registers all ORM models
    from app.core.database import Base
    from sqlalchemy import select
    from app.models.entities import User, Department
    from app.models.base import UserRole

    # 1. Create all tables (idempotent — skips existing tables)
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("DB schema ensured (create_all)")
    except Exception as exc:
        logger.warning("Schema creation failed (non-fatal): %s", exc)

    # 2. Seed demo users if users table is empty
    DEMO_USERS = [
        {"email": "admin@ubid.demo",      "password": "admin123",      "full_name": "Admin User",       "role": UserRole.ADMIN},
        {"email": "supervisor@ubid.demo", "password": "supervisor123",  "full_name": "Supervisor User",  "role": UserRole.SUPERVISOR},
        {"email": "reviewer@ubid.demo",   "password": "reviewer123",    "full_name": "Reviewer User",    "role": UserRole.REVIEWER},
        {"email": "officer@ubid.demo",    "password": "officer123",     "full_name": "Officer User",     "role": UserRole.OFFICER},
        {"email": "auditor@ubid.demo",    "password": "auditor123",     "full_name": "Auditor User",     "role": UserRole.AUDITOR},
    ]
    try:
        async with AsyncSessionLocal() as s:
            count = (await s.execute(select(User))).scalars().first()
            if count is None:
                for u in DEMO_USERS:
                    s.add(User(
                        email=u["email"],
                        hashed_password=hash_password(u["password"]),
                        full_name=u["full_name"],
                        role=u["role"],
                        is_active=True,
                    ))
                await s.commit()
                logger.info("Demo users seeded (5 accounts)")
    except Exception as exc:
        logger.warning("User seed failed (non-fatal): %s", exc)

    # 3. Pre-warm connection pool
    async def _ping():
        async with AsyncSessionLocal() as s:
            await s.execute(text("SELECT 1"))
    try:
        await asyncio.gather(*[_ping() for _ in range(3)])
        logger.info("DB connection pool warmed")
    except Exception as exc:
        logger.warning("Pool warmup failed (non-fatal): %s", exc)

    # 4. Start automated ingestion scheduler (every 6h)
    try:
        start_scheduler(interval_hours=6.0)
        logger.info("Background ingestion scheduler started (every 6h)")
    except Exception as exc:
        logger.warning("Scheduler startup failed (non-fatal): %s", exc)


@app.on_event("shutdown")
async def _shutdown():
    from app.services.scheduler import stop_scheduler
    stop_scheduler()


# ─── CORS ─────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Request logging middleware ───────────────────────────────────────────────

@app.middleware("http")
async def log_requests(request: Request, call_next):
    req_id = str(uuid.uuid4())[:8]
    request.state.request_id = req_id
    start = time.perf_counter()

    response = await call_next(request)

    duration_ms = round((time.perf_counter() - start) * 1000)
    logger.info(
        "%s %s %s  %dms  req=%s",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
        req_id,
    )
    response.headers["X-Request-ID"] = req_id
    return response

# ─── Exception handlers ───────────────────────────────────────────────────────

@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"error": "Validation error", "detail": exc.errors()},
    )


@app.exception_handler(Exception)
async def general_handler(request: Request, exc: Exception):
    req_id = getattr(request.state, "request_id", "?")
    logger.error("unhandled exception  req=%s  path=%s  error=%s", req_id, request.url.path, exc)
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "req_id": req_id},
    )

# ─── Routers ──────────────────────────────────────────────────────────────────

prefix = settings.api_prefix
app.include_router(auth.router,       prefix=prefix)
app.include_router(search.router,     prefix=prefix)
app.include_router(business.router,   prefix=prefix)
app.include_router(review.router,     prefix=prefix)
app.include_router(timeline.router,   prefix=prefix)
app.include_router(dashboard.router,  prefix=prefix)
app.include_router(pincode.router,    prefix=prefix)
app.include_router(admin.router,      prefix=prefix)
app.include_router(er.router,         prefix=prefix)
app.include_router(operations.router, prefix=prefix)
app.include_router(analytics.router,  prefix=prefix)
app.include_router(graph.router,      prefix=prefix)
app.include_router(query.router,      prefix=prefix)

# ─── Health / Readiness ───────────────────────────────────────────────────────

@app.get("/health", tags=["meta"])
async def health():
    """Basic liveness probe — always returns 200 if the process is up."""
    return {"status": "ok", "service": "UBID Platform API", "version": "1.0.0"}


@app.get("/ready", tags=["meta"])
async def readiness():
    """Readiness probe — verifies database connectivity."""
    db_ok = False
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        db_ok = True
    except Exception as exc:
        logger.warning("readiness check failed: %s", exc)

    status_code = 200 if db_ok else 503
    return JSONResponse(
        status_code=status_code,
        content={
            "status": "ready" if db_ok else "not_ready",
            "database": "connected" if db_ok else "disconnected",
            "service": "UBID Platform API",
            "version": "1.0.0",
        },
    )
