# UBID Platform — Development Roadmap

## Timeline Overview

| Phase | Name | Target | Status |
|-------|------|--------|--------|
| 0 | Foundation & Architecture | Hour 0–3 | ✅ Complete |
| 1 | Ingestion + Schema + Synthetic Data | Hour 3–7 | Pending |
| 2 | Entity Resolution + UBID Generation | Hour 7–13 | Pending |
| 3 | Reviewer Workflow | Hour 13–17 | Pending |
| 4 | Activity Intelligence + Timeline + Status | Hour 17–21 | Pending |
| 5 | Dashboards + Query Workflows | Hour 21–26 | Pending |
| 6 | Polish + Deploy + Demo Assets | Hour 26–32 | Pending |

---

## Phase 0 — Foundation & Architecture (✅ Done)

**Goal:** Complete blueprint, architecture, schema, API contracts, RBAC, mock data strategy, demo scenarios, and project scaffolding before any coding begins.

**Deliverables:**
- [x] Product blueprint (`docs/00-blueprint.md`)
- [x] Roadmap (`docs/01-roadmap.md`)
- [x] System architecture (`docs/02-architecture.md`)
- [x] RBAC design (`docs/03-rbac.md`)
- [x] Canonical data model (`docs/04-data-model.md`)
- [x] PostgreSQL schema (`docs/05-schema.sql`)
- [x] API contract (`docs/06-api-contract.md`)
- [x] Frontend IA / screen map (`docs/07-frontend-ia.md`)
- [x] Synthetic data strategy (`docs/08-synthetic-data-strategy.md`)
- [x] Demo scenarios (`docs/09-demo-scenarios.md`)
- [x] Technical decision record (`docs/10-tech-decisions.md`)
- [x] Backend scaffold (FastAPI app shell)
- [x] Frontend scaffold (Next.js app shell)
- [x] Docker Compose + env example
- [x] Mock JSON data for 4 departments

---

## Phase 1 — Ingestion + Schema + Synthetic Data

**Goal:** Working data pipeline from synthetic department files into PostgreSQL canonical schema. Business records normalized and stored. No entity resolution yet.

**Tasks:**
1. Run `scripts/generate_synthetic_data.py` to produce 500+ records across 4 departments
2. Implement department adapters (one per department) that read JSON/CSV and emit canonical `SourceRecord` objects
3. Write canonical field normalization (name cleaning, pincode standardization, PAN/GSTIN formatting)
4. Seed PostgreSQL with canonical records
5. Verify seed with `SELECT COUNT(*) FROM source_records GROUP BY department_code`
6. Stand up FastAPI with health check and DB connectivity
7. Basic auth endpoints (login, token refresh, me)

**Done criteria:** All 500+ synthetic records are ingested, normalized, and stored. API returns 200 on health check. Login returns JWT.

---

## Phase 2 — Entity Resolution + UBID Generation

**Goal:** Entity resolution engine producing UBIDs. High-confidence pairs auto-linked. Medium-confidence pairs queued for review.

**Tasks:**
1. Implement blocking strategy: `(pincode_prefix, name_prefix_3)` as blocking key
2. Compute similarity features: Jaro-Winkler name, Levenshtein address, exact PAN, exact GSTIN
3. Train binary classifier on synthetic labelled pairs (use pre-labelled pairs from synthetic data strategy)
4. Assign confidence tiers: `HIGH ≥ 0.85`, `MEDIUM 0.50–0.85`, `LOW < 0.50`
5. Auto-link HIGH pairs: create `BusinessEntity` + assign UBID (PAN-anchored or UUID)
6. Push MEDIUM pairs to `review_cases` table
7. API: `GET /api/v1/business/{ubid}` and `GET /api/v1/search`
8. Wire up linked records panel: show all source records under a UBID

**Done criteria:** Every source record belongs to a UBID or is in the review queue. Search returns linked results. Entity graph is queryable.

---

## Phase 3 — Reviewer Workflow

**Goal:** Reviewers can see ambiguous cases, view evidence, and make decisions that update the entity graph.

**Tasks:**
1. `GET /api/v1/review/queue` — paginated list sorted by confidence score ascending
2. `GET /api/v1/review/{case_id}` — full case detail: both records, similarity scores, field-level diff
3. `POST /api/v1/review/{case_id}/decide` — accept merge / reject merge / escalate
4. Decision creates/updates `BusinessEntity` and `reviewer_decisions` log
5. Frontend: Review Queue screen + Case Detail screen with side-by-side record comparison
6. Role gate: only `REVIEWER` and `SUPERVISOR` roles can submit decisions
7. Audit log entry on every decision

**Done criteria:** Reviewer can process a case end-to-end in the UI. Decision is persisted and reflected in business profile.

---

## Phase 4 — Activity Intelligence + Timeline + Status Classification

**Goal:** Every UBID has an activity timeline. Status is classified from signals, not surveys.

**Tasks:**
1. Ingest activity events from synthetic event streams (inspection dates, renewal dates, meter reads)
2. Join each event to UBID via `source_record_id` → UBID lookup
3. Store events in `business_events` table
4. Implement classification rules:
   - `ACTIVE`: at least one event within 6 months
   - `DORMANT`: most recent event 7–24 months ago
   - `CLOSED`: most recent event 24+ months ago OR explicit closure signal
   - `REVIEW_NEEDED`: conflicting signals across departments
5. Generate evidence summary: which signals drove the classification
6. API: `GET /api/v1/business/{ubid}/timeline`
7. Frontend: Activity Timeline component with color-coded event dots and classification badge

**Done criteria:** Business profile shows status badge with evidence. Timeline renders sorted events with source labels.

---

## Phase 5 — Dashboards + Query Workflows

**Goal:** Officer search, supervisor analytics, and pincode intelligence are all working.

**Tasks:**
1. Officer Search: full-text + PAN/GSTIN/UBID/pincode search with filters (status, department, district)
2. Business Profile: all panels wired (header, linked records, timeline, reviewer history)
3. Pincode Intelligence Dashboard: aggregate stats by pincode — total businesses, active %, dormancy rate, recent inspections
4. Supervisor Dashboard: system-wide KPIs — total UBIDs, status distribution, review queue depth, accuracy metrics
5. Export: CSV export of search results
6. Role-based visibility: masked PAN/GSTIN for OFFICER role in raw view

**Done criteria:** All 8 screens from the frontend IA are navigable. Demo story flows work end-to-end.

---

## Phase 6 — Polish, Deploy, Demo Assets

**Goal:** Hosted demo link, clean repo, presentation assets, and demo script ready for submission.

**Tasks:**
1. Deploy Docker Compose stack on hosting (Railway, Render, or VPS)
2. Seed hosted DB with full synthetic dataset
3. Create demo accounts for each role (officer, reviewer, supervisor, admin)
4. Record 2-minute demo video walkthrough
5. Write README with architecture diagram, setup instructions, and demo link
6. Prepare pitch deck slides: problem, solution, architecture, demo screenshots, roadmap
7. Ensure all API endpoints documented (auto-generated via FastAPI /docs)
8. Final security pass: no hardcoded secrets, env vars only, no real PII anywhere

**Done criteria:** One click opens the demo. Judges can log in as any role. All 8 demo scenarios are executable.

---

## Risk Register

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Entity resolution takes too long to train | Medium | Use pre-labelled synthetic pairs; use splink defaults |
| PostgreSQL schema migration pain | Low | Design schema fully in Phase 0; use Alembic from day 1 |
| Frontend build issues in hackathon environment | Medium | Use Next.js with create-next-app; avoid complex state libs |
| Deployment fails near deadline | Low | Test deployment in Phase 5, not Phase 6 |
| Demo data looks fake/unconvincing | Medium | Use realistic Karnataka business names and pincode ranges |
