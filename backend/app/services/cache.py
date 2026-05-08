"""
Redis Cache Layer — tries real Redis first, auto-falls back to fakeredis.
fakeredis is a pure-Python in-memory Redis compatible store — no external
process required. When real Redis IS running, it uses that instead.

Priority:
  1. Real Redis at REDIS_URL (best — survives restarts)
  2. fakeredis in-memory (great for demo — works with zero setup)
  3. No-op (if both fail — app still works, just not cached)
"""
from __future__ import annotations

import json
import logging
from typing import Any

logger = logging.getLogger("ubid.cache")

_client = None
_available = False
_backend = "none"    # "redis" | "fakeredis" | "none"
_initialized = False  # set after first real connection attempt


async def _init_client():
    """Try real Redis first; auto-fall back to fakeredis if connection fails."""
    global _client, _available, _backend, _initialized
    if _initialized:
        return

    _initialized = True

    # ── 1. Try real Redis ─────────────────────────────────────────────────────
    try:
        from app.core.config import settings
        import redis.asyncio as aioredis

        candidate = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=0.5,
            socket_timeout=0.5,
        )
        await candidate.ping()   # Actually test the connection
        _client = candidate
        _available = True
        _backend = "redis"
        logger.info("Redis cache connected: %s", settings.redis_url)
        return
    except Exception:
        pass   # Fall through to fakeredis

    # ── 2. Fall back to fakeredis (in-memory, zero setup) ─────────────────────
    try:
        import fakeredis.aioredis as fake

        _client = fake.FakeRedis(decode_responses=True)
        _available = True
        _backend = "fakeredis"
        logger.info("fakeredis in-memory cache active (no external Redis needed)")
    except Exception as exc:
        logger.info("No cache available — running without cache (%s)", exc)
        _available = False
        _backend = "none"


async def cache_get(key: str) -> Any | None:
    await _init_client()
    try:
        if not _client: return None
        raw = await _client.get(key)
        return json.loads(raw) if raw else None
    except Exception:
        return None


async def cache_set(key: str, value: Any, ttl: int = 120) -> bool:
    await _init_client()
    try:
        if not _client: return False
        await _client.setex(key, ttl, json.dumps(value, default=str))
        return True
    except Exception:
        return False


async def cache_delete(key: str) -> None:
    await _init_client()
    try:
        if _client: await _client.delete(key)
    except Exception:
        pass


async def cache_delete_prefix(prefix: str) -> None:
    await _init_client()
    try:
        if not _client: return
        keys = await _client.keys(f"{prefix}*")
        if keys: await _client.delete(*keys)
    except Exception:
        pass


async def get_cache_status() -> dict:
    await _init_client()
    notes = {
        "redis":    "Real Redis connected — distributed cache active",
        "fakeredis": "In-memory cache active via fakeredis — zero setup required",
        "none":     "No cache — app runs correctly without it",
    }
    return {
        "redis_available": _available,
        "backend":         _backend,
        "note":            notes.get(_backend, ""),
    }
