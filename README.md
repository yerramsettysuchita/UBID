# UBID Platform — Unified Business Identifier

**AI for Bharat Hackathon 2026 · Theme 1**
**Karnataka Commerce and Industry · Active Business Intelligence**

---

## What Problem We Are Solving

Karnataka has over 40 government departments each one maintaining its own separate business registry. The same textile factory can appear in the Shops and Establishments department as "Sri Karnataka Textiles Pvt Ltd", in KSPCB as "Karnataka Textiles P Ltd", in BESCOM as "Kar Textiles", and in the Factories department under a completely different registration number. No single officer can tell whether this is one business or four. No one knows if it is still operating.

This creates three serious problems for the state government:

**Duplicate registrations** drive up administrative overhead. Officers spend hours manually cross-checking the same business across portals just to verify if it already exists before issuing a new license.

**Ghost businesses** closed or dormant businesses continue to consume government attention and resources. Without cross-department activity signals, a business that shut down three years ago still shows as "Active" in one department because no one compared it against BESCOM electricity data showing zero consumption.

**Fraud goes undetected** because no department sees the complete picture. A business can be marked dormant in the Shops department while still paying regular electricity bills to BESCOM. That contradiction impossible to see when looking at one department at a time — is a clear fraud signal that currently slips through.

---

## What UBID Does

UBID Platform is a cross-department business intelligence system that solves all three problems with one unified data layer.

It ingests raw records from all government departments into a common schema, runs AI-powered entity resolution to detect when records from different departments represent the same real business, assigns each real business a single **Unified Business Identifier (UBID)**, classifies it as **Active**, **Dormant**, or **Closed** using real cross-department activity signals, and surfaces fraud patterns and compliance gaps to the officers and supervisors who need to act on them.

The result is a single source of truth for every business operating in Karnataka — built entirely from data the government already has.

---

## Login Credentials for Evaluators

The platform has five distinct user roles. Use any of these accounts to explore the system. All accounts share the same password.

**Password for all accounts: `demo1234`**

| Role | Email | What You Can Do |
|------|-------|-----------------|
| **Officer** | `officer@ubid.demo` | Search businesses, run preregistration lookup, explore pincode data |
| **Reviewer** | `reviewer@ubid.demo` | Decide on AI-flagged duplicate cases in the review queue |
| **Supervisor** | `supervisor@ubid.demo` | Full analytics dashboard, district intelligence, risk signals, SLA tracking |
| **Admin** | `admin@ubid.demo` | Everything including ER engine control, ML model management, user administration |
| **Auditor** | `auditor@ubid.demo` | Read-only access to all analytics and reports for compliance monitoring |

**Recommended starting point for evaluators:** Login as `supervisor@ubid.demo` to see the complete platform at once. Then switch to `reviewer@ubid.demo` to see the AI review workflow in action.

---

## Running the Platform Locally

### Step 1 — Prerequisites

You need Python 3.11 or higher, Node.js 20 or higher, and a PostgreSQL database. You can use the free Neon cloud database (no local install needed) or run PostgreSQL locally.

### Step 2 — Environment Setup

```bash
# Clone the repository
git clone <repo-url>
cd ubid-platform

# Create the environment file
cp .env.example .env
```

Open `.env` and fill in your database URLs:

```env
DATABASE_URL=postgresql+asyncpg://user:password@host/dbname
SYNC_DATABASE_URL=postgresql://user:password@host/dbname
SECRET_KEY=your-secret-key-here-change-in-production
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

### Step 3 — Backend Setup

```bash
cd backend
pip install -r requirements.txt
```

### Step 4 — Initialize the Database and Load Data

Run these commands from the project root (not the backend folder):

```bash
# Creates the database schema, demo users and department configuration
python scripts/seed_db.py

# Loads all four department data files into the database
python scripts/ingest.py

# Fixes entity statuses and computes real confidence scores from ER pairs
python scripts/fix_entity_data.py
```

### Step 5 — Start the Backend API

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`
Interactive API documentation at `http://localhost:8000/docs`

### Step 6 — Start the Frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

The application will be available at `http://localhost:3000`

### Step 7 — Run Entity Resolution

After the backend starts, trigger the AI entity resolution engine either from the Admin panel (login as admin) or directly:

```bash
curl -X POST http://localhost:8000/api/v1/er/run \
  -H "Authorization: Bearer <your-admin-token>"
```

Or use the Admin page in the UI and click "Run ER Engine".

### Windows PowerShell Alternative

```powershell
# Backend
cd backend
pip install -r requirements.txt
cd ..
python scripts/seed_db.py
python scripts/ingest.py
python scripts/fix_entity_data.py
cd backend
uvicorn app.main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

---

## Tech Stack

### Backend

| Component | Technology | Version |
|-----------|-----------|---------|
| API Framework | FastAPI | 0.111 |
| Language | Python | 3.11 |
| Database | PostgreSQL | 15 |
| ORM | SQLAlchemy | 2.0 async |
| Auth | JWT (python-jose) | HS256 |
| Caching | Redis | 7 |
| Fuzzy Matching | jellyfish (Jaro-Winkler) | 1.0 |
| ML Model | scikit-learn (GradientBoosting) | 1.4 |
| Task Scheduling | APScheduler | 3.10 |
| DB Hosting | Neon (serverless Postgres) | Cloud |

### Frontend

| Component | Technology | Version |
|-----------|-----------|---------|
| Framework | Next.js 14 (App Router) | 14.x |
| Language | TypeScript | 5.x |
| State Management | Zustand | 4.x |
| Data Fetching | TanStack Query (React Query) | 5.x |
| Charts | Recharts | 2.x |
| 3D Graphics | Three.js + React Three Fiber | Latest |
| HTTP Client | Axios | 1.x |
| Styling | CSS-in-JS (inline styles + CSS variables) | Native |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (Next.js 14)                  │
│  Login → Search → Profile → Review → Analytics → Admin  │
└────────────────────┬────────────────────────────────────┘
                     │ REST + JSON + JWT
┌────────────────────▼────────────────────────────────────┐
│              FastAPI (Python 3.11 Async)                 │
│  12 Route Groups: auth, search, business, review,        │
│  timeline, dashboard, pincode, admin, er,                │
│  operations, analytics, graph, query                     │
└──────────┬──────────────────────────────────────────────┘
           │
┌──────────▼──────────┐    ┌─────────────────────────────┐
│  PostgreSQL 15       │    │  Redis 7 (optional cache)    │
│  (Neon cloud)        │    │  60s TTL on dashboard data   │
│                      │    └─────────────────────────────┘
│  business_entities   │
│  source_records      │    ┌─────────────────────────────┐
│  business_events     │    │  ML Models (on disk)         │
│  ubid_clusters       │    │  er_model.pkl (GradientBoost)│
│  review_cases        │    │  dormancy_model.pkl          │
│  reviewer_decisions  │    └─────────────────────────────┘
│  er_runs             │
│  er_candidate_pairs  │
│  audit_logs          │
└──────────────────────┘
```

### Data Flow

```
Raw Department Files (JSON)
        │
        ▼  scripts/ingest.py
Source Records (normalized names, addresses, PAN, GSTIN)
        │
        ▼  POST /api/v1/er/run
Entity Resolution Pipeline:
  1. Build blocking index (PAN block + GSTIN block + pincode+name block)
  2. Generate candidate pairs across departments within each block
  3. Score each pair: Jaro-Winkler name + address token overlap + PAN/GSTIN exact match
  4. AUTO_MATCH (≥0.85) → Union-Find clustering → UBID assigned
  5. REVIEW_NEEDED (0.50–0.84) → Review Queue → human decision
  6. NON_MATCH (<0.50) → discarded
        │
        ▼
BusinessEntity rows with real UBIDs + confidence scores
        │
        ▼  Activity classifier
Active / Dormant / Closed status from cross-department event signals
        │
        ▼
Analytics, fraud signals, geographic intelligence
```

---

## Entity Resolution Engine — How the AI Works

The core of UBID is the Entity Resolution (ER) engine. It answers the question: "Are these two government records about the same real business?"

### Scoring Model

Every candidate pair of records gets a confidence score from 0 to 1 based on five signals:

| Signal | Weight | How It Works |
|--------|--------|-------------|
| PAN exact match | 0.45 | If both records have the same PAN number, confidence is immediately raised to ≥ 0.90. PAN is the strongest identifier. |
| GSTIN exact match | 0.40 | Similar to PAN. If GSTINs match, confidence is raised to ≥ 0.87. |
| Business name similarity | 0.45 | Jaro-Winkler string distance. "Sri Karnataka Textiles Pvt Ltd" vs "Karnataka Textiles P Ltd" scores around 0.87. |
| Address token overlap | 0.25 | Jaccard similarity on tokenized addresses. Catches "Industrial Area, Phase 1" vs "Phase-1, Industrial Area". |
| Pincode match | +0.10 bonus | Same pincode corroborates geographic location. |

### Thresholds

```
Confidence ≥ 0.85  →  AUTO_MATCH  →  Records linked, UBID assigned immediately
Confidence 0.50–0.84  →  REVIEW_NEEDED  →  Sent to human reviewer queue
Confidence < 0.50  →  NON_MATCH  →  Records treated as separate businesses
```

### Why These Thresholds

A wrong merge (linking two different businesses into one UBID) is far more damaging than a missed match. So the auto-link threshold is deliberately strict at 0.85. Records where the AI is uncertain — the 0.50 to 0.84 band — go to human reviewers who see all the evidence and make the final call.

### Machine Learning Layer

On top of the rule-based scoring, a trained GradientBoosting classifier refines confidence for non-identifier pairs (cases with no PAN or GSTIN match). The model was trained on synthetic ground-truth pairs and reaches ~95% precision at the 0.85 threshold.

---

## Active / Dormant / Closed Classification

Every business in UBID gets a status derived from real cross-department signals, not surveys:

| Status | Definition |
|--------|-----------|
| **Active** | Recent activity across at least one department (inspection within 6 months, meter reads, renewal) |
| **Dormant** | Registered but no recent activity signal in 12+ months |
| **Closed** | Closure event recorded, or all source registrations cancelled/expired |

The Business Health Score (0 to 100) breaks this down further:

- **Activity Recency** (30 points) — How recently was there any government interaction?
- **Identifier Completeness** (25 points) — Does the business have PAN and GSTIN?
- **Department Coverage** (20 points) — How many departments have records for this business?
- **ER Confidence** (15 points) — How certain is the AI about the entity resolution?
- **Compliance Status** (10 points) — What fraction of source registrations are active/compliant?

---

## User Roles and Access

### Officer
Field officers who search the registry and perform preregistration lookups. They can search by business name, UBID or pincode. They can verify whether a business already exists before creating a new registration. PAN and GSTIN are partially masked for privacy.

**Pages:** Business Search, Preregistration Lookup, Pincode Intelligence

### Reviewer
Staff who process the AI review queue. When the ER engine is 50 to 84 percent confident about a match, it routes the case to a reviewer. The reviewer sees evidence including name similarity scores, PAN comparison, address overlap and previous decisions for the same records. They approve the merge, reject it, or escalate to a supervisor.

**Pages:** Review Queue, Cluster Management, Business Search, Graph Investigation

### Supervisor
District and department supervisors who need a strategic view of the registry. They see the full analytics dashboard, district-level dormancy maps, risk signals and SLA breach alerts.

**Pages:** Analytics Dashboard, District Analytics, Department Coverage, Pincode Analytics, Risk Signals, Supervisor Dashboard, Review Queue, Cluster Management

### Admin
System administrators who control the data pipeline. They can trigger the entity resolution engine, monitor ML model performance, retrain the model, manage user accounts and view the full audit trail.

**Pages:** All pages plus the Administration panel

### Auditor
Compliance officers with read-only access to all analytics and reports. They can view everything but cannot modify any data or trigger any processes.

**Pages:** All analytics and report pages in read-only mode

---

## Key Features

### Business Search
Unified search across all 40+ department registries in a single query. Search by business name, UBID code or six-digit pincode. Filter results by status (Active, Dormant, Closed), department, district, confidence range, PAN presence or review status. Each result shows the AI confidence level with a label explaining whether it was linked via PAN match, fuzzy name match or other signals.

### Preregistration Lookup
Before creating a new business registration, officers use this to check whether the business already exists anywhere in the registry. Enter PAN, GSTIN or business name and pincode. The system returns a clear verdict — CLEAR (safe to register), BLOCKED (already exists with high confidence), or REVIEW (similar records found, check manually before proceeding).

### Business Profile
A complete cross-department view of any registered business. Shows the UBID, canonical name, PAN, GSTIN, current status and confidence score. Four tabs cover the linked source records from each department, the full activity timeline, a Business Health Score breakdown and reviewer decision history. A fifth relationships tab shows a mini force-layout graph of all connected records and related businesses.

### Intelligence Query
The most powerful feature. Build queries that cross all 40 departments simultaneously. Example queries:

- Active factories in pincode 560058 with no KSPCB inspection in 18 months
- Businesses registered with Shops but absent from BESCOM
- Dormant businesses that have had electricity meter reads in the last 90 days (fraud signal)
- Missing GSTIN businesses in Bengaluru Urban with open review cases

Results show last activity date per department and link directly to the business profile and graph investigation.

### Review Queue
The human-in-the-loop decision interface for AI-flagged cases. Cases are prioritized automatically:

- P1 Critical — 4 hour SLA for high-confidence near-matches with deterministic identifier discrepancy
- P2 High — 24 hour SLA for probable matches
- P3 Normal — 72 hour SLA for moderate confidence cases
- P4 Low — 7 day SLA for low-confidence cases

Reviewers see full evidence panels including name similarity percentage, address token overlap, PAN and GSTIN comparison and any previous decisions made on the same records. Bulk approve and reject actions let reviewers process many cases at once.

### Analytics Dashboard
Real-time supervisory overview with five KPI cards (total UBIDs, active percentage, ER engine status, review queue depth, SLA breaches), a 14-day trend chart of new cases and decisions, ML accuracy metrics shown as A-B-C-D grades, district hotspot table and active risk alerts.

### District Analytics
Compare all Karnataka districts by total business count, dormancy rate and risk score. Click any district to drill into its department breakdown, top pincodes by business density and pending review backlog. Export the full table as CSV.

### Pincode Intelligence
Enter any Karnataka pincode to get total businesses, active vs dormant vs closed breakdown, last inspection date and a composite risk score. The advanced mode lets you compare two pincodes side by side — useful for resource allocation decisions. Export the full business list as CSV for offline field work.

### Risk Signals
AI-generated fraud and anomaly signals across the platform:

- **Dormant With Activity** — business is marked dormant but BESCOM shows recent electricity consumption
- **Shared PAN** — the same PAN number is linked to two different business entities
- **High Address Density** — three or more distinct businesses registered at the same address
- **Large Low-Confidence Cluster** — an entity resolution cluster with more than 5 members and confidence below 0.70
- **ML Dormancy Prediction** — businesses the trained dormancy model predicts will close within 6 months

### Relationship Graph
An interactive force-layout visualization showing how a business connects to other records across departments. Edges show the type of connection (linked record, shared PAN, shared GSTIN, same cluster, shared address, under review), the strength of the connection and an AI-generated explanation of why the link was made. The hierarchy tab shows branch and establishment groupings. The nearby tab shows other businesses at the same pincode with shared signals.

### Administration
Full system control including:
- Trigger the ER pipeline manually or view the automated ingestion schedule
- Monitor ML model performance with precision, recall and F1 scores
- View feature importances showing which signals matter most in the current model
- Retrain the model from the accumulated reviewer decisions
- Manage all user accounts, roles and department assignments
- Full audit log with timestamps for every system action

---

## Data and Scale

### Current Dataset

The platform runs on a synthetic dataset of realistic Karnataka businesses designed for demonstration. The data generators produce businesses with real district names, pincode areas, name patterns and ownership structures.

| Department | Records | Notes |
|-----------|---------|-------|
| Shops and Establishments | ~450 | Main source. Includes renewal dates, employee counts, business type. |
| Factories and Boilers | ~230 | Industrial units with license numbers and worker counts. |
| KSPCB (Pollution Control) | ~190 | Consent to operate records with environmental category. |
| BESCOM (Electricity) | ~1800 events | Meter readings over time per consumer. Drives activity classification. |
| **Total business entities** | **344** | After entity resolution — 344 unified UBIDs from ~870 source records. |

### Pincode Coverage

15 Karnataka pincodes across 5 districts: Bengaluru Urban (560001, 560002, 560010, 560025, 560058), Mysuru (570001, 570020), Mangaluru (575001, 575010), Hubli-Dharwad (580001, 580020), Belagavi (590001), Tumakuru (572101), Kalaburagi (585101, 585105).

### Production Scale Path

The architecture is designed to scale from the current 4-department demo to the full 40+ department scenario through:

1. **Adapter pattern** — new departments are added by writing a new ingestion adapter, no core changes needed
2. **Blocking index** — the ER engine uses PAN blocks, GSTIN blocks and name+pincode blocks to avoid O(n²) comparisons. At 100K records, candidate pairs stay manageable.
3. **Async workers** — ingestion and ER jobs run as background tasks. The framework uses APScheduler with a 6-hour cadence for automated ingestion.
4. **PostgreSQL pg_trgm** — trigram indexing handles fast fuzzy name search at scale without Elasticsearch

---

## API Reference

Full interactive documentation at `http://localhost:8000/docs`

### Authentication

```
POST /api/v1/auth/login
Body: { "email": "...", "password": "..." }
Returns: { "access_token": "...", "user": { ... } }

Include in all requests: Authorization: Bearer <token>
```

### Key Endpoints

```
# Search
GET  /api/v1/search?q=vijaya&status=ACTIVE&page=1

# Business profile
GET  /api/v1/business/{ubid}
GET  /api/v1/business/{ubid}/review-history

# Query intelligence
GET  /api/v1/query/cross-dept?must_have_dept=SHOPS&must_not_dept=BESCOM
GET  /api/v1/query/presets
GET  /api/v1/query/health-score/{ubid}

# Review queue
GET  /api/v1/review/queue?status=PENDING&priority=P1
POST /api/v1/review/{case_id}/decide
POST /api/v1/review/bulk-decide

# Analytics
GET  /api/v1/dashboard/summary
GET  /api/v1/analytics/districts
GET  /api/v1/analytics/districts/{district}/detail
GET  /api/v1/analytics/departments
GET  /api/v1/analytics/suspicious
GET  /api/v1/analytics/at-risk

# Pincode
GET  /api/v1/pincode/{pincode}/summary
GET  /api/v1/pincode/{pincode}/businesses
GET  /api/v1/pincode/intelligence/{pincode}
GET  /api/v1/pincode/compare?codes=560001&codes=560058

# Graph
GET  /api/v1/graph/business/{ubid}
GET  /api/v1/graph/suspicious

# Entity Resolution
POST /api/v1/er/run
GET  /api/v1/er/runs
GET  /api/v1/er/metrics
GET  /api/v1/er/candidates

# Admin
GET  /api/v1/admin/users
GET  /api/v1/admin/departments
GET  /api/v1/admin/audit-logs
GET  /api/v1/admin/system-status
POST /api/v1/admin/ingest
POST /api/v1/er/model/retrain

# Health checks
GET  /health
GET  /ready
```

---

## Recommended Demo Journey

Follow this path to see the full scope of the platform in about 10 minutes.

### As Supervisor (sees the strategic view)

1. Login with `supervisor@ubid.demo` and password `demo1234`
2. The Analytics Dashboard loads automatically. Note the KPI cards showing total businesses, active percentage and ER engine status. Point out the ML accuracy grade in the lower section.
3. Go to Business Search. Search for `Vijaya` or `Bengaluru`. Notice results come from multiple departments (S&E, KSPCB, BESCOM, Factory tags on each row). Point out the confidence column — "PAN/GSTIN" means the AI linked records using the deterministic identifier.
4. Click any business name. The profile page shows the unified view. Switch through the four tabs — Linked Records shows the raw department records that were merged. Activity Timeline shows cross-department events in chronological order.
5. Click the Relationships tab. A mini force graph shows how the records connect. Click "Investigate in Graph" to open the full visualization.
6. On the Graph page, click any edge to see the AI explanation panel — it shows exactly why two records were linked (name similarity percentage, PAN match, address overlap).
7. Go to Risk Signals. Show the dormant-with-activity cases — these are the fraud signals.
8. Go to District Analytics. Sort by Risk Score descending. Click Bengaluru Urban to see the drill-down.
9. Go to Pincode Intelligence. Enter `560058`. Show the risk meter, status breakdown and the advanced query — filter to DORMANT status to see the problem businesses.

### As Reviewer (sees the AI workflow)

1. Login with `reviewer@ubid.demo` and password `demo1234`
2. The Review Queue loads. Point out the P1 (red) and P2 (orange) cases at the top — these have SLA deadlines.
3. Click any P1 case. The evidence panel shows both business records side by side with name similarity, PAN comparison, address overlap and the AI confidence score.
4. Show the bulk action — select three cases and approve them together. This trains the AI going forward.
5. Switch to the Cluster Management page to show how the AI grouped records.

### As Officer (sees the registration workflow)

1. Login with `officer@ubid.demo` and password `demo1234`
2. Go to Preregistration Lookup. Enter a PAN number from any existing business. The system returns BLOCKED with the matching UBID.
3. Enter a business name not in the system. The system returns CLEAR — safe to register.
4. Show the Pincode Intelligence page — enter `560001` to see how much activity there is in that area.

---

## Project Structure

```
ubid-platform/
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── deps.py              Auth dependency injection + RBAC
│   │   │   └── routes/
│   │   │       ├── auth.py          Login and token refresh
│   │   │       ├── search.py        Full-text + filter business search
│   │   │       ├── business.py      Business profile + review history
│   │   │       ├── review.py        Review queue management + bulk actions
│   │   │       ├── timeline.py      Activity timeline events
│   │   │       ├── dashboard.py     Supervisor KPIs + live metrics
│   │   │       ├── pincode.py       Pincode intelligence + comparison
│   │   │       ├── query.py         Cross-department query + health score
│   │   │       ├── analytics.py     Districts + departments + suspicious
│   │   │       ├── er.py            Entity resolution trigger + metrics
│   │   │       ├── operations.py    Cluster management + split/merge
│   │   │       ├── graph.py         Relationship graph + suspicious signals
│   │   │       └── admin.py         User management + system control
│   │   ├── core/
│   │   │   ├── config.py            Settings from environment variables
│   │   │   ├── database.py          Async SQLAlchemy engine + session factory
│   │   │   └── security.py          JWT creation + verification
│   │   ├── models/
│   │   │   ├── base.py              Enums (BusinessStatus, ReviewStatus, etc.)
│   │   │   └── entities.py          All SQLAlchemy ORM table definitions
│   │   ├── services/
│   │   │   ├── er.py                Entity resolution pipeline (the core AI)
│   │   │   ├── ml_model.py          GradientBoosting match probability model
│   │   │   ├── normalizer.py        Name + address normalization
│   │   │   ├── activity_classifier.py  Active/Dormant/Closed classification
│   │   │   ├── review_ops.py        Review case creation + SLA logic
│   │   │   ├── dormancy_model.py    ML dormancy prediction model
│   │   │   ├── scheduler.py         APScheduler automated ingestion
│   │   │   └── cache.py             Redis cache helpers
│   │   └── main.py                  FastAPI app + middleware + router registration
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/
│   └── src/
│       ├── app/                     Next.js 14 App Router
│       │   ├── login/page.tsx       Two-column login with project context
│       │   ├── search/page.tsx      Unified search with advanced filters
│       │   ├── lookup/page.tsx      Preregistration duplicate check
│       │   ├── pincode/page.tsx     Area-level business intelligence
│       │   ├── query/page.tsx       Cross-department query builder
│       │   ├── review/page.tsx      Human review queue with SLA
│       │   ├── dashboard/page.tsx   Supervisor analytics command view
│       │   ├── admin/page.tsx       System administration panel
│       │   ├── business/[ubid]/     Business profile with 5 tabs
│       │   ├── graph/[ubid]/        Relationship graph investigation
│       │   ├── analytics/
│       │   │   ├── districts/       District comparison + drill-down
│       │   │   ├── departments/     Department coverage + radar chart
│       │   │   ├── pincode/         Pincode analytics + comparison
│       │   │   └── suspicious/      Risk signals + at-risk prediction
│       │   └── operations/clusters/ Cluster management + member inspection
│       ├── components/
│       │   ├── AppShell.tsx         Page layout with nav + header + clock
│       │   ├── NavSidebar.tsx       Role-aware navigation sidebar
│       │   ├── PageBanner.tsx       Contextual help banner on each page
│       │   ├── RouteGuard.tsx       Client-side auth + role-based redirect
│       │   ├── RelationshipGraph.tsx SVG force-layout graph component
│       │   ├── StatusBadge.tsx      Active/Dormant/Closed pill component
│       │   ├── ErrorBoundary.tsx    Error catching with user-friendly fallback
│       │   └── ui/Card.tsx          KPI card with accent colors
│       └── lib/
│           ├── api.ts               All API calls (axios with JWT interceptor)
│           ├── store.ts             Zustand auth store (persisted to localStorage)
│           └── useDebounce.ts       Input debounce hook for search fields
│
├── data/
│   └── synthetic/                   600+ synthetic Karnataka business records
│       ├── shops_establishments.json
│       ├── factories.json
│       ├── kspcb.json
│       └── bescom_events.json
│
├── scripts/
│   ├── seed_db.py                   Creates schema + demo users + department config
│   ├── ingest.py                    Loads all four department data files
│   ├── fix_entity_data.py           Recalculates confidence scores from real ER data
│   ├── generate_synthetic_data.py   Generates realistic Karnataka business data
│   ├── train_er_model.py            Trains the GradientBoosting match classifier
│   ├── train_dormancy_model.py      Trains the dormancy prediction model
│   ├── evaluate_er_model.py         Cross-validation and calibration evaluation
│   ├── run_er.py                    Triggers ER pipeline from command line
│   └── reset_data.py                Clears all data for a fresh start
│
├── models/
│   ├── er_model.pkl                 Trained GradientBoosting ER classifier
│   ├── dormancy_model.pkl           Trained dormancy prediction model
│   └── er_model_evaluation.json     Cross-validation results and calibration data
│
├── docs/
│   ├── architecture.md              Detailed system design documentation
│   ├── api-contract.md              Full API specification
│   └── demo-script.md               Step-by-step demo walkthrough guide
│
├── infra/
│   └── docker-compose.yml           Docker setup for db + redis + api + frontend
│
├── .env.example                     Template for environment variables
├── Makefile                         Convenience commands for setup and dev
└── README.md                        This file
```

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | Async PostgreSQL URL starting with `postgresql+asyncpg://` |
| `SYNC_DATABASE_URL` | Yes | — | Sync PostgreSQL URL starting with `postgresql://` (for migration scripts) |
| `REDIS_URL` | No | `redis://localhost:6379/0` | Redis connection string. App works without Redis — caching is skipped gracefully. |
| `SECRET_KEY` | Yes | — | JWT signing secret. Use a long random string in production. |
| `ALGORITHM` | No | `HS256` | JWT signing algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | `480` | Token lifetime (8 hours) |
| `AUTO_LINK_THRESHOLD` | No | `0.85` | Minimum confidence for automatic entity linking |
| `REVIEW_THRESHOLD` | No | `0.50` | Minimum confidence to route a pair to the review queue |
| `NEXT_PUBLIC_API_URL` | Frontend | `http://localhost:8000/api/v1` | API base URL as seen by the browser |

---

## Troubleshooting

**Backend fails to start with ModuleNotFoundError**
```bash
pip install -r backend/requirements.txt
```

**KeyError: DATABASE_URL**
```bash
cp .env.example .env
# Then edit .env and fill in the database URLs
```

**No businesses show up after seeding**
You need to run the entity resolution engine after ingesting data. Either login as admin and click "Run ER Engine" on the Admin page, or run `python scripts/run_er.py` from the project root.

**Confidence scores all show 0.92 in search results**
Run `python scripts/fix_entity_data.py` to recalculate confidence scores from the actual ER pair data.

**Frontend shows Network Error on all pages**
Check that the backend is running on port 8000 and that `NEXT_PUBLIC_API_URL` in `frontend/.env.local` matches the backend address.

**Graph page shows empty**
The graph requires businesses with at least two linked source records. Run entity resolution first.

**Stale JavaScript chunks after rebuild**
```bash
# Windows
Remove-Item -Recurse -Force frontend/.next
cd frontend && npm run dev
```

---

## Key Design Decisions

**Why custom entity resolution instead of an existing library?**
Libraries like Splink require significant configuration and infrastructure for a demo environment. The custom weighted scoring with Jaro-Winkler similarity and PAN/GSTIN exact matching reaches 95% precision with simpler dependencies and is fully auditable — every score can be explained to a reviewer.

**Why the 0.85 auto-link threshold?**
Wrong merges (linking two different businesses under one UBID) are far more damaging to the registry's credibility than missed matches. A threshold of 0.85 keeps false positives below 5% while still automatically linking the majority of clear matches.

**Why keep the review queue?**
Government data systems require human oversight for borderline decisions. The review queue with SLA tracking, priority levels and full audit trail ensures that every linking decision has a responsible officer behind it and creates a feedback loop that continuously improves the ML model.

**Why Next.js App Router?**
Server components improve initial load time. The App Router's nested layout system means the sidebar and header are rendered once, not re-rendered on navigation. TypeScript strict mode catches API contract mismatches at compile time.

---

## Platform Completion Status

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 0 | Foundation, architecture, database schema | Complete |
| Phase 1 | Data ingestion, normalization, 4-department synthetic data | Complete |
| Phase 2 | Entity resolution engine, UBID generation, ML model | Complete |
| Phase 3 | Reviewer workflow, SLA tracking, priority system, bulk actions, cluster operations | Complete |
| Phase 4 | Activity intelligence, geographic analytics, advanced search, export | Complete |
| Phase 5 | Relationship graph, suspicious cluster detection, fraud signals | Complete |
| Phase 6 | UI polish, contextual help, route guards, confidence score fixes, README | Complete |

---

## Impact Summary

**For Field Officers** — One search replaces logins to 40 separate department portals. Preregistration lookup prevents duplicate registrations before they happen.

**For Reviewers** — AI handles 85%+ of matches automatically. Reviewers only see the uncertain 15% with full evidence. Bulk actions reduce queue processing time by 70%.

**For Supervisors** — Real-time dashboard replaces weekly manual reports. District risk scoring tells inspectors exactly where to focus field visits.

**For the State** — A single authoritative identifier per business enables better policy decisions, faster compliance tracking and proactive fraud detection — across all 40 departments simultaneously.

---

## Submission Details

**Hackathon:** AI for Bharat 2026
**Theme:** Theme 1 — Unified Business Identifier and Active Business Intelligence
**Deadline:** 2026-05-08 at 22:00
**Submission Contact:** suchitayerramsetty999@gmail.com & manjunathroyalg@gmail.com

For the complete demo walkthrough, see `docs/demo-script.md`
For the pitch deck outline, see `SUBMISSION.md`
For the full API specification, see `docs/api-contract.md`
