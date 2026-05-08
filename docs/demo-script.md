# UBID Platform — Judge Demo Script

**Time budget:** ~8 minutes  
**All accounts use password:** `demo1234`  
**Start URL:** `http://localhost:3000`

---

## Step 1 — Login as Supervisor (30 sec)

Open `http://localhost:3000`. You land on the login screen.

- Email: `supervisor@ubid.demo`
- Password: `demo1234`

**Talking point:** "This is a multi-role system — officers search and raise flags, reviewers adjudicate entity resolution, supervisors see the full picture. We'll start at the top."

---

## Step 2 — Analytics Dashboard (60 sec)

After login you land on the **Supervisor Dashboard**.

Point out:
- **Top KPI strip** — Total businesses, active %, dormant %, ER match rate. These are derived from real cross-department signals, not surveys.
- **Trend chart** — Review cases opened vs. decisions resolved over the last 14 days.
- **Hotspot Districts** — Bengaluru Urban typically tops the list. Click "Drill down →" to jump to district analytics.
- **SLA breach alerts** — Any P1 cases overdue surface here.

**Talking point:** "A supervisor can see the health of the entire registry in one view — coverage, throughput, and geographic risk — without touching a spreadsheet."

---

## Step 3 — Business Search (45 sec)

Navigate to **Search** in the sidebar.

1. Type `Vijaya` and press Enter. Multiple results appear from different departments (SHOPS, KSPCB, BESCOM).
2. Open **Advanced Filters** — show the department dropdown (select `SHOPS`), confidence slider, Has PAN / Has GSTIN toggles.
3. The active filter count badge updates. Clear filters.
4. Search `560001` (pincode) — shows businesses in that pincode.

**Talking point:** "Officers can search by name, pincode, registration number, or identifier. The confidence score tells them how certain we are that two registrations are the same entity."

---

## Step 4 — Business Profile (60 sec)

Click any result to open its **Business Profile**.

Point out:
- **UBID badge** at the top — the permanent identifier that survives re-ingestion from any department.
- **Status badge** — Active / Dormant / Closed, derived from cross-department event signals.
- **Linked Source Records** panel — shows which departments have a record for this entity, with per-record confidence scores.
- **Activity Timeline** tab — inspection events, renewal events, meter readings, filings, all stitched together chronologically across departments.
- **Reviewer History** tab — every merge/split decision is on record with timestamp and reviewer name.

**Talking point:** "Before UBID, an officer had to log into BBMP, S&E, KSPCB, and BESCOM separately. Now one screen shows everything — and the status is computed from real activity, not a self-declaration."

---

## Step 5 — Relationships Tab + Graph Entry (45 sec)

Still on the business profile — click the **Relationships** tab.

Point out:
- **Mini force graph** — nodes are linked businesses, edges are labelled with relationship type.
- **Insight cards** — any suspicious signals for this entity (shared address, shared PAN) surface here.
- Click **"Investigate in Graph →"** button in the hero or the tab.

This opens the full Graph Investigation page.

---

## Step 6 — Graph Investigation Page (60 sec)

You are now on `/graph/[ubid]`.

1. **Graph tab** — SVG force layout. The subject entity is the center node. Click any node to highlight its edges and see the explanation panel on the right.
2. Click an edge — the panel shows: edge type, strength (0–1), deterministic vs. inferred, and a plain-language explanation ("Both records share PAN AAACB1234F — deterministic identity signal").
3. Use the **edge type filter chips** at the top to show only `SHARED_PAN` edges or only `SAME_CLUSTER` edges.
4. Switch to **Branch Hierarchy** tab — establishments grouped by department.
5. Switch to **Nearby Entities** tab — businesses in the same pincode with shared-signal flags.

**Talking point:** "Every relationship has an explanation. Officers know exactly why two businesses were linked — it's not a black box."

---

## Step 7 — Review Queue (60 sec)

Log out (top-right) and log in as `reviewer@ubid.demo` / `demo1234`.

Navigate to **Review Queue**.

Point out:
- **Priority tabs** — P1 (4h SLA), P2 (24h), P3 (72h), P4 (7d). SLA countdown timers are live.
- Open a P1 case. The case detail shows: candidate pair side-by-side, confidence breakdown (name score, address score, identifier score), evidence table.
- **Bulk actions** — select multiple cases, click Approve / Reject / Defer.
- **Threaded comments** — reviewers can leave notes that are part of the audit trail.

**Talking point:** "Human reviewers only see cases that need judgement — auto-linked at ≥ 0.85 confidence, queued for review between 0.50 and 0.85. SLA timers ensure no case sits too long."

---

## Step 8 — Pincode Intelligence (45 sec)

Navigate to **Analytics → Pincode Intel** in the sidebar.

1. Enter `560001` and hit Enter.
2. Show: **Risk meter**, active/dormant/closed status split, department coverage breakdown.
3. Click **Compare** — add a second pincode (`560034`) to compare side by side.
4. Click **Export CSV** — downloads the pincode data.

**Talking point:** "Local commissioners can pull a pincode report instantly — business count, status distribution, risk score — and export it for field teams."

---

## Step 9 — Suspicious Clusters (30 sec)

Navigate to **Suspicious Clusters** in the sidebar (supervisor/admin only).

Point out:
- **Severity filter tabs** — Critical / High / Medium.
- Signal cards: High Address Density, Shared PAN Across Entities, Dormant + Recent Activity, Large Cluster Low Confidence.
- Each card shows affected entities with clickable links.
- Click **"Investigate in Graph →"** on any signal card to jump directly to the graph investigation view.

**Talking point:** "The platform proactively surfaces risk patterns — address farms, PAN duplication, dormant businesses that suddenly show activity. Officers don't need to hunt for these."

---

## Step 10 — District Analytics (30 sec)

Navigate to **Analytics → Districts**.

Point out:
- **Sortable table** — sort by business count, active rate, or risk score.
- **Stacked bar charts** — active/dormant/closed split per district, visually comparable.
- Click any district row to drill into its breakdown.

**Wrap-up talking point:** "UBID gives Karnataka a single source of truth for business registrations. The architecture scales from the 4 pilot departments shown here to all 40+ government departments, with the same ingestion adapters, the same entity resolution pipeline, and the same role-based intelligence layer."

---

## Quick Reset (if demo breaks)

```bash
# Re-run ER if graph is empty
POST http://localhost:8000/api/v1/er/run

# Re-seed from scratch
python scripts/seed_db.py && python scripts/ingest.py
# then POST /api/v1/er/run
```

If the frontend shows a blank page, check `frontend/.env.local` — `NEXT_PUBLIC_API_URL` must point to `http://localhost:8000/api/v1`.

---

## Credentials Summary

| Role | Email | Password | Start Page |
|------|-------|----------|------------|
| Supervisor | `supervisor@ubid.demo` | `demo1234` | Dashboard |
| Reviewer | `reviewer@ubid.demo` | `demo1234` | Review Queue |
| Officer | `officer@ubid.demo` | `demo1234` | Search |
| Admin | `admin@ubid.demo` | `demo1234` | Admin Panel |
| Auditor | `auditor@ubid.demo` | `demo1234` | Analytics |
