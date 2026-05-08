# UBID Platform — Technical Decision Record

## ADR-001: Frontend Framework — Next.js 14

**Decision:** Use Next.js 14 with App Router and TypeScript.

**Alternatives considered:** Plain React (Vite), Remix, Vue.js

**Rationale:**
- App Router enables server components for fast initial load on dashboard pages
- Built-in routing reduces configuration overhead in hackathon
- Strong ecosystem for shadcn/ui and Tailwind CSS
- TypeScript enforces schema contracts between frontend and backend API
- Easy deployment to Vercel or Railway

**Trade-off:** App Router learning curve is steeper than Pages Router; mitigated by clear route structure defined in Phase 0.

---

## ADR-002: Backend Framework — FastAPI

**Decision:** Use FastAPI (Python 3.11) as the backend API framework.

**Alternatives considered:** Django REST Framework, Node.js (Express/Fastify), Flask

**Rationale:**
- Async-native, which pairs well with SQLAlchemy 2.0 async
- Auto-generated OpenAPI docs (`/docs`) is a major demo asset — judges can explore the API
- Pydantic v2 validation matches exactly with the well-defined API contract
- Same Python ecosystem as Splink, scikit-learn, and pandas — no language boundary in the ML pipeline
- Fastest to scaffold route groups with dependency injection

**Trade-off:** Not as mature as Django for admin features; mitigated by building admin UI in Next.js.

---

## ADR-003: Entity Resolution Library — Splink

**Decision:** Use Splink (open-source probabilistic record linkage by UK Ministry of Justice).

**Alternatives considered:** recordlinkage (Python), dedupe.io, custom cosine similarity pipeline, Neo4j graph matching

**Rationale:**
- Purpose-built for exactly this problem (government MDM, large record matching)
- Uses DuckDB as backend — no Spark setup required for prototype scale
- Built-in EM (expectation-maximization) algorithm learns match weights from data
- Has blocking, feature generation, and comparison API all in one library
- Produces explainable probability scores — required for reviewer UI
- Can switch to Spark backend for production scale with minimal code change

**Trade-off:** More complex to set up than simple fuzzy matching; worth it because the match quality and explainability are core product differentiators.

---

## ADR-004: Primary Database — PostgreSQL 15

**Decision:** PostgreSQL as the single source of truth for all structured data.

**Alternatives considered:** MySQL, MongoDB, SQLite (demo only), CockroachDB

**Rationale:**
- `pg_trgm` extension enables fast trigram-based fuzzy name search — needed for business name search
- `tsvector`/GIN index enables full-text search on canonical names without Elasticsearch
- JSONB for flexible audit log storage and adapter configs
- Materialized views for pincode intelligence — fast without a separate analytics store
- Proven reliability; no operational surprises
- SQLAlchemy 2.0 async ORM + Alembic migrations = clean schema management

**Trade-off:** Not infinitely scalable for 40+ departments at full production load; production would add read replicas + connection pooling. Prototype scale is fine.

---

## ADR-005: Cache and Queue — Redis 7

**Decision:** Use Redis for review queue (sorted set), search cache, session management, and Celery broker.

**Alternatives considered:** RabbitMQ (queue), Memcached (cache), PostgreSQL LISTEN/NOTIFY

**Rationale:**
- One dependency serves three purposes: queue, cache, session
- Sorted set is the perfect data structure for priority-ordered review queue
- Celery + Redis is the standard Python background job pattern
- Low operational overhead for hackathon deployment

---

## ADR-006: Background Jobs — Celery

**Decision:** Use Celery with Redis broker for background workers.

**Alternatives considered:** Apache Airflow, RQ (simpler), FastAPI BackgroundTasks

**Rationale:**
- Celery supports multiple queues (ingestion, resolution, classification, retraining) with worker isolation
- Can trigger jobs via API (`admin/ingestion/trigger`) for demo purposes
- Retry logic and task status tracking built in
- FastAPI BackgroundTasks is insufficient for long-running ML jobs

---

## ADR-007: Entity Resolution Approach — Conservative Precision

**Decision:** Set auto-link threshold at 0.85 (high precision), not 0.70 (higher recall).

**Rationale:**
- Wrong merges in government identity data are more costly than missed ones
  - A wrong merge means two different businesses appear as one in official records
  - This could result in incorrect compliance decisions, notices sent to wrong party
- Missing a link (keeping two records separate) is recoverable — reviewer queue handles it
- Hackathon judges will also prefer "safe and explainable" over "aggressive but wrong"

**Implication:** More records go to reviewer queue — that's by design, not a flaw.

---

## ADR-008: UBID Anchoring Strategy — PAN-First

**Decision:** UBID format:
- `UBID-PAN-{pan}` if canonical PAN is available
- `UBID-GST-{gstin_prefix_10}` if GSTIN available but no PAN
- `UBID-{uuid4_short}` otherwise

**Rationale:**
- PAN is the strongest legal identifier for businesses in India (issued by Income Tax Dept)
- GSTIN is derived from PAN but state-specific; use as fallback
- UUID fallback for informal/unregistered businesses that may not have PAN/GSTIN
- Deterministic UBID generation from PAN means two ingestion runs produce the same UBID

**Trade-off:** Businesses without PAN/GSTIN get non-deterministic UUIDs that could change if records are re-processed. Mitigated by storing UBID as primary key once assigned.

---

## ADR-009: Auth Strategy — JWT with Role in Payload

**Decision:** JWT tokens with `role` and `department_code` claims in the payload. No session store for token validation (stateless), except for logout revocation list in Redis.

**Rationale:**
- Stateless JWT is horizontally scalable — no shared session store needed
- Role in payload means RBAC check is a local operation (no DB call per request)
- Revocation list in Redis handles logout and token invalidation
- Production replacement: OAuth2 + SAML for government SSO — JWT design is compatible

---

## ADR-010: LLM Usage — Offline Only on Synthetic Data

**Decision:** LLM calls (if any) are made only on deterministically scrambled or synthetic data. No raw business names or addresses ever sent to an external LLM API.

**Rationale:**
- Karnataka government data contains PII of business owners and individuals
- PS explicitly requires PII handling to be compliant
- LLMs are used only for: (a) name normalization assist on synthetic data during batch processing, (b) generating demo content
- For production: deploy a local LLM (Llama/Mistral) on-premises for PII-sensitive operations

**Prototype use:** No LLM dependency in the critical path. LLM could optionally assist name normalization as a post-processing step on scrambled copies.

---

## ADR-011: Deployment — Docker Compose

**Decision:** Docker Compose for hackathon deployment. All services: Next.js, FastAPI, PostgreSQL, Redis, Celery worker.

**Rationale:**
- Single `docker-compose up` brings up the entire stack
- Easy to deploy on any VPS (Railway, Render, Fly.io, DigitalOcean)
- No Kubernetes complexity for a prototype
- Production path: each service becomes a separate Kubernetes deployment

**Compose services:**
- `db` — PostgreSQL 15
- `redis` — Redis 7
- `api` — FastAPI (uvicorn)
- `worker` — Celery worker
- `frontend` — Next.js (Node.js server)
- `nginx` — Reverse proxy (optional for prod-like demo)
