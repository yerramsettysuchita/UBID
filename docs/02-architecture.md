# UBID Platform — System Architecture

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Next.js)                          │
│  Login │ Search │ Business Profile │ Review Queue │ Dashboards       │
└─────────────────────────┬───────────────────────────────────────────┘
                          │ HTTPS / REST
┌─────────────────────────▼───────────────────────────────────────────┐
│                      BACKEND API (FastAPI)                           │
│  /auth  /search  /business  /review  /timeline  /dashboard  /admin  │
│  JWT Auth │ RBAC Middleware │ Audit Logger │ Rate Limiter            │
└──────┬─────────────┬───────────────┬────────────────────────────────┘
       │             │               │
┌──────▼──────┐ ┌────▼──────┐ ┌─────▼──────────────────────────────┐
│ PostgreSQL  │ │   Redis   │ │        Background Workers           │
│             │ │           │ │  (Celery / RQ)                     │
│ - entities  │ │ - review  │ │  - Ingestion Job                   │
│ - source    │ │   queue   │ │  - Entity Resolution Job           │
│   records   │ │ - session │ │  - Activity Classification Job     │
│ - events    │ │   cache   │ │  - Retraining Job                  │
│ - review    │ │ - search  │ └────────────────┬───────────────────┘
│   cases     │ │   cache   │                  │
│ - audit log │ └───────────┘                  │
└─────────────┘                                │
                          ┌────────────────────▼───────────────────┐
                          │         Department Adapters             │
                          │                                         │
                          │  ShopsEstab  Factories  KSPCB  BESCOM  │
                          │  Adapter     Adapter    Adapter Adapter │
                          │                                         │
                          │  [Reads from synthetic JSON/CSV files]  │
                          │  [In production: REST APIs / DB views]  │
                          └─────────────────────────────────────────┘
```

---

## Component Details

### Frontend (Next.js 14 App Router)

- **Framework:** Next.js 14 with App Router and TypeScript
- **Styling:** Tailwind CSS + shadcn/ui component library
- **State:** React Query (TanStack Query) for server state; Zustand for UI state
- **Charts:** Recharts for dashboards
- **Auth:** JWT stored in httpOnly cookie; handled via Next.js middleware

**Key pages:**
- `/login` — role-aware login
- `/search` — officer search dashboard
- `/business/[ubid]` — business profile
- `/review` — reviewer queue
- `/review/[caseId]` — case detail
- `/pincode` — pincode intelligence
- `/dashboard` — supervisor analytics
- `/admin` — system administration

---

### Backend API (FastAPI)

- **Framework:** FastAPI 0.110+ with Python 3.11
- **ORM:** SQLAlchemy 2.0 (async) with Alembic migrations
- **Validation:** Pydantic v2 schemas (separate from SQLAlchemy models)
- **Auth:** python-jose for JWT, passlib for password hashing
- **RBAC:** dependency-injected role check on every protected route
- **Audit:** SQLAlchemy event listener writes audit row on every mutation
- **API docs:** Auto-generated at `/docs` and `/redoc`

**Route groups:**
```
/api/v1/auth/         login, refresh, me, logout
/api/v1/search/       query businesses
/api/v1/business/     UBID profile, linked records
/api/v1/review/       queue, case detail, decide
/api/v1/timeline/     events for a UBID
/api/v1/dashboard/    supervisor KPIs
/api/v1/pincode/      pincode intelligence queries
/api/v1/admin/        users, departments, field mappings
```

---

### Storage (PostgreSQL 15)

Primary datastore. Holds:
- `business_entities` — one row per resolved business (UBID lives here)
- `establishments` — branches/locations under a business entity
- `source_records` — raw normalized records from each department
- `identifiers` — PAN, GSTIN, department IDs per source record
- `addresses` — normalized addresses linked to source records
- `business_events` — activity events joined to UBID
- `review_cases` — ambiguous pairs awaiting human decision
- `reviewer_decisions` — log of every decision with reason
- `audit_logs` — append-only log of all API mutations
- `users`, `roles`, `permissions` — auth and RBAC tables
- `departments` — department registry with adapter config
- `field_mappings` — source field → canonical field mapping per department

**Indexing strategy:**
- B-tree on `ubid`, `pan`, `gstin`, `pincode`
- GIN index on `business_name` for full-text search (`tsvector`)
- Composite index on `(department_code, source_record_id)`

---

### Cache / Queue (Redis 7)

- **Review queue:** sorted set by confidence score (lowest first = most uncertain first)
- **Search cache:** TTL-based cache for common pincode and name queries
- **Session store:** JWT revocation list
- **Celery broker:** task queue for background jobs

---

### Background Workers (Celery + Redis)

Four worker types, each on a separate queue:

| Worker | Trigger | What it does |
|--------|---------|-------------|
| `ingestion` | Scheduled (every 15 min in demo; hourly in prod) | Runs all department adapters, normalizes records, upserts to `source_records` |
| `entity_resolution` | After ingestion completes | Generates blocking pairs, scores similarity, auto-links HIGH, queues MEDIUM |
| `activity_classifier` | After ingestion completes | Joins events to UBIDs, recomputes status, updates `business_entities.status` |
| `model_retrainer` | After 50+ new reviewer decisions | Retrains logistic regression on accumulated labelled pairs, updates model weights |

---

### Entity Resolution Engine

```
Source Records
    │
    ▼
Normalizer
  - Lowercase, strip punctuation
  - Expand abbreviations (Pvt→Private, Ltd→Limited)
  - Format PAN: uppercase, strip spaces
  - Format GSTIN: uppercase 15-char
  - Pincode: 6-digit zero-padded
    │
    ▼
Blocker
  - Key: (pincode_prefix_3, name_prefix_3)
  - Also: (pan, *) if PAN present
  - Also: (gstin, *) if GSTIN present
  - Generates candidate pairs, NOT all-vs-all
    │
    ▼
Scorer (per candidate pair)
  - name_score: Jaro-Winkler similarity
  - address_score: token overlap ratio
  - pan_match: 1.0 if exact, 0.0 otherwise
  - gstin_match: 1.0 if exact, 0.0 otherwise
  - dept_reg_match: 1.0 if same department registration number
    │
    ▼
Classifier (Logistic Regression / XGBoost)
  - Input: [name_score, address_score, pan_match, gstin_match]
  - Output: match probability 0.0–1.0
    │
    ▼
Decision
  - ≥ 0.85 → AUTO LINK (create UBID link)
  - 0.50–0.85 → REVIEW QUEUE
  - < 0.50 → KEEP SEPARATE
    │
    ▼
UBID Anchoring
  - If PAN present and trusted → UBID = "UBID-PAN-{pan}"
  - Else if GSTIN present → UBID = "UBID-GST-{gstin_prefix}"
  - Else → UBID = "UBID-{uuid4}"
```

Library: **Splink** (open-source probabilistic record linkage, DuckDB backend, no server needed)

---

### Activity Intelligence Engine

```
Event Stream (synthetic CSV / in future: Kafka)
    │
    ▼
Event Normalizer
  - Standardize event_type: INSPECTION | RENEWAL | FILING | METER_READ | CLOSURE
  - Parse event_date to UTC datetime
  - Map source_record_id → ubid via lookup table
    │
    ▼
UBID Event Store (business_events table)
    │
    ▼
Status Classifier
  - TODAY - MAX(event_date) = recency_days
  - ACTIVE:        recency_days ≤ 180
  - DORMANT:       181 ≤ recency_days ≤ 730
  - CLOSED:        recency_days > 730 OR closure_event present
  - REVIEW_NEEDED: departments disagree on status (one says active, another says closed)
    │
    ▼
Evidence Summary
  - "Active: KSPCB renewal 45 days ago, BESCOM meter read 12 days ago"
  - "Dormant: last event was S&E inspection 14 months ago"
```

---

### Search & Query Layer

- **Full-text search:** PostgreSQL `tsvector` on `business_name` + GIN index
- **Structured search:** Filter by `status`, `department`, `pincode`, `district`
- **Identifier lookup:** Exact match on `pan`, `gstin`, `ubid`, `source_record_id`
- **Result ranking:** Exact ID matches → full-text matches → fuzzy matches

---

### Auth & Security

- **Protocol:** JWT Bearer tokens, 8-hour access token, 7-day refresh token
- **Password:** bcrypt hashed, 12 rounds
- **RBAC:** Role assigned at user level; checked via FastAPI dependency
- **Audit trail:** Every POST/PUT/DELETE writes to `audit_logs` with user_id, action, timestamp, old/new values
- **PII masking:** PAN and GSTIN masked in API response for OFFICER role (show "XXXX-XXXX-XXXX")
- **Rate limiting:** 100 req/min per user via slowapi middleware

---

## What Is Real-Time vs. Batch vs. Simulated

| Feature | Mode | Notes |
|---------|------|-------|
| Business search | Real-time | Direct DB query with cache |
| Business profile | Real-time | Single UBID lookup |
| Review queue | Real-time | Redis sorted set |
| Department ingestion | Batch (15-min intervals) | Simulated in prototype |
| Entity resolution | Batch (after ingestion) | Simulated as single run in demo |
| Activity classification | Batch (after ingestion) | Simulated as single run in demo |
| Event streaming | Simulated (CSV files) | In production: Kafka topics |
| Model retraining | Batch (weekly trigger) | Triggered manually in demo |

---

## Production-Grade Path

| Prototype Choice | Production Equivalent |
|-----------------|----------------------|
| Docker Compose | Kubernetes (EKS/GKE) |
| Synthetic JSON files | REST API adapters + CDC connectors |
| Celery + Redis | Apache Airflow + Kafka |
| Splink (DuckDB) | Splink (Spark backend) for scale |
| Single PostgreSQL | PostgreSQL with read replicas + pgBouncer |
| Simple JWT | OAuth2 + LDAP/SAML (government SSO) |
| File-based field mappings | Admin UI-managed field mapping registry |
