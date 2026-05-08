# UBID Platform — Demo Scenarios

## How to Run the Demo

1. Log in as the appropriate role (credentials in `docs/03-rbac.md`)
2. Each scenario below is a complete, self-contained walkthrough
3. Scenarios 1–4 work best for the live demo pitch (3-minute window)
4. Scenarios 5–8 demonstrate depth for technical judges

---

## Scenario 1 — The Flagship: One Business, Four Departments

**Story:** A textile factory in Peenya Industrial Area is registered with four Karnataka departments. The UBID platform has resolved all four records into one unified profile.

**Login:** `officer@ubid.demo`

**Steps:**
1. Go to `/search`
2. Type "Mahalakshmi Textiles" in search bar
3. Hit Enter → result appears: `Sri Mahalakshmi Textiles Pvt Ltd | ACTIVE | 560058 | 4 departments`
4. Click the result → Business Profile loads
5. Show header: UBID chip, ACTIVE badge, 92% confidence, district "Bengaluru Urban"
6. Click "Linked Records" tab → show 4 rows: S&E, Factory License, KSPCB Consent, BESCOM Consumer
7. Click "Activity Timeline" tab → show events from all 4 departments sorted by date:
   - BESCOM meter read: 12 days ago
   - KSPCB renewal: 45 days ago
   - Factory inspection: 8 months ago
   - S&E renewal: 11 months ago
8. Point to evidence sentence: "Active — BESCOM meter read 12 days ago, KSPCB renewal 45 days ago"

**Pitch point:** "Karnataka currently has four separate records for this business in four systems with no link between them. Our engine resolved them automatically in seconds."

---

## Scenario 2 — Ambiguous Match Goes to Reviewer

**Story:** Two records look like the same business — same address, similar names — but no shared PAN/GSTIN. The engine flags it for human review instead of silently merging.

**Login:** `reviewer@ubid.demo`

**Steps:**
1. Land on `/review` (reviewer default screen)
2. Show queue: 31 pending cases, sorted by confidence ascending
3. Click the top card: confidence score 0.51 (amber)
4. Review Case Detail opens — side-by-side comparison:
   - Record A (SHOPS): "Lakshmi Steel Works" | No PAN | 560029
   - Record B (FACTORIES): "Laxmi Steel Works Private Limited" | PAN: AABCL1234M | 560029
   - Name similarity: 88% | Address overlap: 62% | PAN match: ✗ | GSTIN match: ✗
5. Engine note: "High name similarity. Moderate address overlap. No PAN/GSTIN to confirm. Routing to reviewer."
6. Reviewer types reason: "Same address. Name variation is common (Lakshmi/Laxmi). Owner name matches in address field."
7. Click "Approve Merge" → success toast: "Records merged → UBID-PAN-AABCL1234M"
8. Navigate back to business profile — now shows 2 linked records + updated confidence 0.89

**Pitch point:** "Wrong merges in government data are more costly than missed ones. We never silently merge — ambiguous cases always go to a human. And every decision is logged for audit."

---

## Scenario 3 — Dormant Factory Identified from Signal Gap

**Story:** A factory in Tumakuru was active until 18 months ago. The UBID engine classified it DORMANT because no department has recorded any activity since then.

**Login:** `officer@ubid.demo`

**Steps:**
1. Go to `/search`
2. Search: "Vasantha Engineering Works"
3. Result shows: `Vasantha Engineering Works | DORMANT | 572120 | 2 departments`
4. Click → Business Profile
5. Status badge: amber DORMANT
6. Status reason: "Dormant — last event was Factory inspection 14 months ago. No BESCOM reads in 16 months."
7. Click Activity Timeline tab → empty for last 16 months, then a cluster of events before that
8. Show Factory inspection result from 14 months ago: "Pending follow-up"
9. Officer can click "Request Manual Review" to flag for action

**Pitch point:** "Today, this factory is invisible to every department. Nobody knows it stopped operating. Our platform surfaces it automatically from real activity signals — not surveys."

---

## Scenario 4 — Pincode Intelligence Query

**Story:** A supervisor wants to see all factories in pincode 560058 that haven't had an inspection in the last 18 months.

**Login:** `supervisor@ubid.demo`

**Steps:**
1. Go to `/pincode`
2. Enter pincode: `560058`
3. KPI cards load: 234 total businesses | 178 Active | 38 Dormant | 12 Closed
4. Use Advanced Query Builder:
   - Department: FACTORIES
   - Status: All
   - No inspection since: 540 days (18 months)
5. Click "Run Query"
6. 7 results appear — all factories in 560058 with no inspection for 18+ months
7. Show table: Business Name | DORMANT/ACTIVE status | Last Inspection Date | Days since inspection
8. Point to the longest gap: "Last inspection: 22 months ago. No KSPCB renewal either."

**Pitch point:** "This query used to require calling each department separately and manually cross-referencing spreadsheets. Now it's one query — across four departments — in under two seconds."

---

## Scenario 5 — Suspicious Near-Duplicate Cluster

**Story:** Three businesses in the same pincode with nearly identical names and shared addresses are flagged as a suspicious cluster.

**Login:** `reviewer@ubid.demo`

**Steps:**
1. Go to `/review`
2. Filter: Status = ESCALATED
3. Show an escalated case: "Suspicious cluster — Prestige Real Estate Pvt Ltd / Prestige Realty Limited / Prestige Properties Pvt Ltd"
4. Open case — three records listed
5. Engine note: "Three entities share director name 'Anand S.', same address in 560001. Confidence 0.63. Escalated for supervisor decision."
6. Show the link to supervisor escalation

**Pitch point:** "The engine doesn't just merge — it also surfaces suspicious patterns. That's the foundation for fraud detection and ecosystem intelligence."

---

## Scenario 6 — Reviewer Decision Updates Business Profile

**Story:** Demonstrate that the reviewer workflow feeds back into the live business profile in real time.

**Login:** `reviewer@ubid.demo` (then switch to `officer@ubid.demo`)

**Steps:**
1. Open a PENDING review case with two unlinked records
2. Approve merge → UBID assigned
3. Switch to `officer@ubid.demo`
4. Search for the newly merged business name
5. Business profile now shows 2 linked records (previously would have shown 1)
6. Reviewer History tab shows the decision

**Pitch point:** "Reviewer decisions aren't just logged — they immediately update the live identity graph. The system gets smarter with every decision."

---

## Scenario 7 — Closed Business Detection

**Story:** A cold storage unit in Mysuru shut down 3 years ago. Its records are still in department databases, but the UBID platform classifies it as CLOSED.

**Login:** `officer@ubid.demo`

**Steps:**
1. Search "Kaveri Cold Storage Mysuru"
2. Result: `Kaveri Cold Storage Pvt Ltd | CLOSED | 570012`
3. Click → Business Profile
4. Status: red CLOSED badge
5. Status reason: "Closed — S&E registration cancelled 2023-08-01. No BESCOM activity for 36 months."
6. Timeline tab: last event was 36 months ago (closure registration cancellation)
7. Show that KSPCB record is still "Active" in source system (a data inconsistency)
8. Point out: "Status classification says CLOSED even though one source system hasn't caught up — that's exactly the kind of inconsistency this platform surfaces."

**Pitch point:** "Closed businesses still occupy space in every department's database as 'active' records. UBID surfaces the ground truth from aggregate signals."

---

## Scenario 8 — Multi-Branch Business Visibility

**Story:** A large textile conglomerate has 4 branches across Karnataka. Each branch is registered separately in Shops & Establishments, but they're all under the same legal entity.

**Login:** `supervisor@ubid.demo`

**Steps:**
1. Search by PAN: `AACCM9876P`
2. Result: `Karnataka Silk Industries Ltd | ACTIVE | Multiple locations`
3. Business Profile header: "4 establishments across Bengaluru, Mysuru, Hubli, Tumakuru"
4. Linked Records tab: 4 SHOPS records + 2 FACTORIES records + 3 KSPCB consents + monthly BESCOM reads for all 4
5. Click any establishment to see its specific address and registration details
6. Timeline shows activity from all branches merged in one view

**Pitch point:** "Today each branch is invisible to every other department. A factory inspector in Hubli doesn't know this company also operates in Mysuru. UBID makes the full picture visible."

---

## Demo Flow Recommendation (5-minute pitch)

1. **0:00–0:30** — Open problem: "Karnataka cannot answer basic questions about its businesses"
2. **0:30–1:30** — Scenario 1: Flagship multi-department lookup
3. **1:30–2:30** — Scenario 4: Pincode intelligence query
4. **2:30–3:30** — Scenario 2: Reviewer workflow (30-second version)
5. **3:30–4:30** — Scenario 3: Dormant factory surfaced automatically
6. **4:30–5:00** — Architecture diagram: "This scales to 40+ departments. New department = one adapter + field mapping."
