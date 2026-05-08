# UBID Platform — Product Blueprint

## Problem Statement Interpretation

Karnataka has 40+ department systems (Shops & Establishments, Factories, Labour, KSPCB, BESCOM, etc.) that each maintain their own business records independently. There is no shared primary key across these systems — meaning the government cannot answer basic questions like:

- "How many active factories are registered in Bengaluru Urban district?"
- "Is this business compliant across all departments it is registered with?"
- "Which businesses have gone dormant in the last 12 months?"

The UBID platform solves this by creating a **non-invasive identity resolution layer** that sits on top of existing systems, links records referring to the same real-world business, assigns a Unique Business Identifier (UBID), and classifies each business as Active / Dormant / Closed using real activity signals.

---

## Target Users

| Role | Description |
|------|-------------|
| Department Officer | Field or desk officer in a department (Factories, Labour, KSPCB, etc.) who needs to look up a business and see its cross-department footprint |
| Data Reviewer / Steward | Specialist who resolves ambiguous record matches flagged by the engine |
| Supervisor / Commissioner | Senior officer who needs dashboards and aggregate intelligence — e.g., dormancy rates, compliance gaps |
| System Administrator | Platform admin who manages user accounts, department adapters, and field mappings |
| Auditor | Read-only user who reviews all decisions, logs, and reviewer actions for accountability |

---

## Key Workflows

### Workflow 1 — Business Lookup
Officer enters any of: UBID, PAN, GSTIN, department record ID, business name, or pincode → system returns matched business profile with linked department records and activity status.

### Workflow 2 — Automated Entity Resolution
Background job ingests new records from department adapters → normalizes fields → blocks candidate pairs → scores similarity → auto-links high-confidence pairs → routes medium-confidence pairs to reviewer queue.

### Workflow 3 — Reviewer Decision
Reviewer sees candidate pair with evidence (name similarity, address overlap, PAN/GSTIN match) → approves merge, rejects merge, or flags for escalation → decision is logged and fed back into model.

### Workflow 4 — Activity Classification
Event stream (inspections, renewals, filings, meter reads) is joined to UBID → engine classifies business as Active / Dormant / Closed based on recency and diversity of signals → classification shown on business profile with evidence trail.

### Workflow 5 — Pincode Intelligence
Supervisor queries: "Show all factories in pincode 560058 with no inspection in 18 months" → system executes cross-department query and returns filtered list with confidence indicators.

---

## Department Scope for Prototype

The prototype implements exactly **4 departments**. The architecture is designed to add any additional department by creating a new adapter + field mapping without changing core logic.

| Department | Record Type | Key Identifiers | Event Signals |
|-----------|------------|-----------------|---------------|
| Shops & Establishments (S&E) | Registration record | S&E reg number, PAN, GSTIN | Renewal date, inspection date |
| Factories Act | Factory license | Factory license number, PAN | Inspection visits, compliance filings |
| KSPCB (Pollution Control) | Consent to Operate | KSPCB consent number, GSTIN | Consent renewal, NOC date |
| BESCOM (Electricity) | Consumer account | Consumer number | Meter reading date, bill paid date |

---

## Scale-Up Plan: 4 → 40+ Departments

The architecture uses a **department adapter pattern**. Each department is represented as:
1. An **Adapter** — reads data from the source (API, DB view, CSV upload) and emits canonical records
2. A **Field Mapping** — stored in DB, maps source fields to canonical schema
3. An **Event Source** — streams activity events in the standard event schema

To add a new department:
- Write one adapter class (~150 lines Python)
- Create field mapping in admin UI (no code deployment)
- Point event stream at new source

**Planned Phase 2 departments:** Trade License, GST filings, ESI/PF, Building Occupancy Certificate, Fire NOC, Drug License, Food Safety (FSSAI), Pollution consent (Air/Water separate), MSME Udyam, Import Export Code (IEC).

---

## Key Assumptions

1. Department systems are read-only accessible — no writes back to source systems ever.
2. PAN and GSTIN are the strongest match keys when present; many records will lack them.
3. Synthetic/scrambled data is used for the prototype — no real citizen or business PII.
4. The prototype runs on a single server (Docker Compose); production would use managed cloud services.
5. Reviewer decisions represent ground truth and are used to retrain matching models.
6. A business entity can have multiple establishments (branches); UBID is assigned at the business level.

---

## Constraints

- **No modification of source systems** — read-only adapters only
- **PII must never reach LLM APIs** — all AI calls use scrambled or synthetic data
- **Wrong merges are worse than missed merges** — precision over recall in auto-linking
- **Prototype must be demo-ready in under 24 hours of coding** — scope is tightly controlled
- **All decisions must be explainable** — no silent black-box merges

---

## Non-Goals for Prototype Phase

- Full integration with real department systems (we use synthetic data)
- Writing data back to any department system
- Real-time streaming (we simulate batch ingestion)
- Mobile app
- Multilingual UI (English only for prototype)
- PKI-based auth (simple JWT for prototype)
- All 40+ departments (only 4 in prototype)
- Production-grade HA/failover
