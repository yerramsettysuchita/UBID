from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings


def _engine_kwargs() -> dict:
    kwargs: dict = {
        "echo": settings.debug,
        "pool_pre_ping": True,
        "pool_size": 10,          # keep 10 warm connections ready
        "max_overflow": 20,       # allow up to 30 total under burst
        "pool_recycle": 300,      # recycle connections every 5 min (Neon idle timeout ~5 min)
        "pool_timeout": 30,
    }
    # Neon / cloud PostgreSQL needs SSL
    if "neon.tech" in settings.database_url or "ssl=require" in settings.database_url:
        import ssl
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        kwargs["connect_args"] = {"ssl": ctx}
    return kwargs


engine = create_async_engine(settings.database_url, **_engine_kwargs())

AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
