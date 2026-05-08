"""
Seed: creates schema, inserts demo users and departments.
Run from repo root: python scripts/seed_db.py
"""
import asyncio, sys, ssl
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

import bcrypt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.core.config import settings
from app.core.database import Base
from app.models.entities import Department, User

HASH = bcrypt.hashpw(b"demo1234", bcrypt.gensalt(12)).decode()

USERS = [
    dict(email="officer@ubid.demo",    full_name="Ravi Kumar",    role="OFFICER",    dept="SHOPS"),
    dict(email="reviewer@ubid.demo",   full_name="Priya Nair",    role="REVIEWER",   dept=None),
    dict(email="supervisor@ubid.demo", full_name="Suresh Babu",   role="SUPERVISOR", dept=None),
    dict(email="admin@ubid.demo",      full_name="Admin User",    role="ADMIN",      dept=None),
    dict(email="auditor@ubid.demo",    full_name="Audit Officer", role="AUDITOR",    dept=None),
]

DEPTS = [
    dict(code="SHOPS",     name="Shops and Establishments (Labour Dept)",
         cfg={"path": "data/synthetic/shops_establishments.json"}),
    dict(code="FACTORIES", name="Factories Act Licensing (Labour Dept)",
         cfg={"path": "data/synthetic/factories.json"}),
    dict(code="KSPCB",     name="Karnataka State Pollution Control Board",
         cfg={"path": "data/synthetic/kspcb.json"}),
    dict(code="BESCOM",    name="BESCOM Electricity Consumer Records",
         cfg={"path": "data/synthetic/bescom_events.json"}),
]


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

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("[OK] Schema created")

    Sess = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with Sess() as sess:
        existing_depts = {r[0] for r in (await sess.execute(select(Department.code))).all()}
        for d in DEPTS:
            if d["code"] not in existing_depts:
                sess.add(Department(
                    code=d["code"], name=d["name"],
                    adapter_type="JSON_FILE", adapter_config=d["cfg"],
                ))
        await sess.flush()

        existing_emails = {r[0] for r in (await sess.execute(select(User.email))).all()}
        for u in USERS:
            if u["email"] not in existing_emails:
                sess.add(User(
                    email=u["email"], hashed_password=HASH,
                    full_name=u["full_name"], role=u["role"],
                    department_code=u["dept"],
                ))
        await sess.commit()

    await engine.dispose()
    print("[OK] Departments and users seeded\n")
    print("Demo accounts  (password: demo1234)")
    for u in USERS:
        print(f"  {u['role']:12s}  {u['email']}")


if __name__ == "__main__":
    asyncio.run(main())
