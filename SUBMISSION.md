# Submission Checklist — AI for Bharat, Theme 1

**Hackathon:** AI for Bharat  
**Theme:** Theme 1 — Unified Business Identifier & Active Business Intelligence  
**Team:** [Your team name]  
**Deadline:** 2026-05-08 22:00  

---

## Submission Artifacts

| Artifact | Status | Notes |
|----------|--------|-------|
| GitHub repo link | [ ] | Ensure repo is public before submitting |
| Demo video (3–5 min) | [ ] | Follow [`docs/demo-script.md`](docs/demo-script.md) |
| Live demo URL | [ ] | Or Loom walkthrough if no public deployment |
| Presentation / pitch deck | [ ] | 5–8 slides: problem, solution, architecture, demo, impact |
| Team details | [ ] | Names, emails, institution/org |

---

## Pre-Submission Technical Checklist

### Backend
- [ ] `POST /api/v1/er/run` completes without error on a fresh seed
- [ ] `/health` returns `{"status": "ok"}`
- [ ] `/ready` returns `{"status": "ready", "database": "connected"}`
- [ ] `/docs` (Swagger) loads all 12 route groups
- [ ] Auth: all 5 demo accounts login successfully
- [ ] Search: returns results for "Vijaya", "Bengaluru", "560001"
- [ ] Graph: `/api/v1/graph/business/{ubid}` returns nodes + edges
- [ ] Suspicious: `/api/v1/graph/suspicious` returns ≥1 signal
- [ ] Review queue: `/api/v1/review/queue` returns P1/P2 cases

### Frontend
- [ ] Login page renders, auth redirects work for all 5 roles
- [ ] Supervisor dashboard: KPIs load, trend chart renders, no console errors
- [ ] Search page: results display, advanced filters filter correctly
- [ ] Business profile: all 4 tabs load (Overview / Timeline / Reviews / Relationships)
- [ ] Graph investigation page: nodes/edges render, edge panel opens on click
- [ ] Review queue: SLA timers display, bulk action buttons present
- [ ] Pincode intel: risk meter + status split render for 560001
- [ ] Suspicious clusters page: signal cards render with "Investigate in Graph" links
- [ ] Districts analytics: sortable table + chart render
- [ ] No TypeScript build errors: `npm run build` exits 0

### Data
- [ ] seed_db.py runs cleanly on a fresh database
- [ ] ingest.py loads all 4 department files (SHOPS, FACTORIES, KSPCB, BESCOM)
- [ ] After ER run: ≥50 UBID clusters created
- [ ] At least one business has ≥2 linked source records (cross-department match)

---

## Environment Setup Verification

```bash
# Backend
cd backend
python -m py_compile app/main.py app/api/routes/graph.py   # no output = OK

# Frontend
cd frontend
npm run build   # must exit 0

# Seed + ER
python scripts/seed_db.py
python scripts/ingest.py
# POST http://localhost:8000/api/v1/er/run
```

---

## Demo Video Script Summary

See full script: [`docs/demo-script.md`](docs/demo-script.md)

1. Login → supervisor@ubid.demo
2. Analytics Dashboard — KPIs, trend chart, hotspot districts
3. Business Search → "Vijaya" → advanced filters demo
4. Business Profile — UBID, linked records, activity timeline
5. Relationships tab → mini graph → "Investigate in Graph"
6. Graph page — nodes, edges, explainability panel, filter chips
7. Review Queue → reviewer@ubid.demo — P1 cases, SLA, bulk actions
8. Pincode Intel → 560001 — risk meter, CSV export
9. Suspicious Clusters — severity filters, investigate in graph
10. District Analytics — sortable table, drill-down

---

## Pitch Deck Outline (5–8 slides)

1. **Problem** — 40+ Karnataka departments, each with a siloed registry; same business has different IDs everywhere; no one knows if it's still operating
2. **Solution** — UBID: one identifier per business, derived from cross-department entity resolution; Active/Dormant/Closed status from real signals
3. **Architecture** — FastAPI + PostgreSQL + Next.js 14; entity resolution pipeline; role-based intelligence layer
4. **Demo Screenshots** — Dashboard, Business Profile, Relationship Graph, Review Queue
5. **Impact** — Officers save lookup time; supervisors see registry health in one view; suspicious patterns surface proactively
6. **Scale Path** — 4 pilot departments → 40+; adapter pattern; async workers for production ingestion volumes
7. **Team** — Names, roles, contact

---

## Contact

**Team name:** [Fill in]  
**Primary contact:** [Name, email]  
**Submission email:** ramadeviyerramsetty78@gmail.com  
