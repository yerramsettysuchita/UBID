# UBID Platform — Frontend Information Architecture

## Navigation Structure

```
/login
/search                  ← Officer default landing
/business/[ubid]
  └── /linked-records    ← tab
  └── /timeline          ← tab
/review                  ← Reviewer landing
/review/[caseId]
/pincode                 ← Pincode intelligence
/dashboard               ← Supervisor landing
/admin
  └── /users
  └── /departments
  └── /audit
```

Role-based redirect on login:
- OFFICER → `/search`
- REVIEWER → `/review`
- SUPERVISOR → `/dashboard`
- ADMIN → `/admin`
- AUDITOR → `/audit`

---

## Screen 1 — Login (`/login`)

**Purpose:** Authenticate users; redirect by role.

**Components:**
- UBID platform logo + Karnataka Govt branding
- Email input
- Password input
- Login button (primary)
- Error message area

**Actions:** Submit credentials → JWT → redirect by role

**Data:** POST `/auth/login`

---

## Screen 2 — Officer Search Dashboard (`/search`)

**Purpose:** Primary lookup interface for department officers. Find any business by any identifier.

**Layout:** Header + search bar (full-width) + results table

**Components:**
- **Search Bar:** Large text input with placeholder "Search by name, UBID, PAN, GSTIN, pincode..."
- **Filter Row:** Status dropdown (All/Active/Dormant/Closed/Review Needed) | Department multi-select | District dropdown | Pincode field
- **Results Table:**
  - Columns: Business Name | Status Badge | UBID | Pincode | District | Dept Coverage | Last Event | Actions
  - Status badges: green/ACTIVE, amber/DORMANT, red/CLOSED, grey/REVIEW NEEDED
  - Department coverage shown as icon row (Shops/Factories/KSPCB/BESCOM checkmarks)
  - Click row → Business Profile
- **Result count:** "Showing 20 of 142 results"
- **Export CSV** button (REVIEWER+ only)

**Actions:**
- Type in search box → debounced query → update results
- Apply filter → refine results
- Click result row → navigate to `/business/{ubid}`

**Data:** `GET /api/v1/search?q=...&status=...`

---

## Screen 3 — Business Profile (`/business/[ubid]`)

**Purpose:** Full 360° view of a resolved business entity.

**Layout:** Header card + 3-tab body

### Header Card
- Business name (large, canonical)
- UBID chip (copyable)
- Status badge (color-coded)
- Status reason text (greyed)
- PAN chip (masked for OFFICER)
- GSTIN chip (masked for OFFICER)
- District + Pincode
- Confidence score meter (e.g., 92%)
- Department coverage icons
- "Request Manual Review" button (all roles)

### Tab 1 — Linked Records
- Table: Department | Registration Number | Status | Registration Date | Owner | Address | Last Event
- Each row expandable to show full source record detail
- Department icon on each row

### Tab 2 — Activity Timeline
- Vertical timeline with color-coded event dots by department
- Event card: type label + date + description + outcome badge
- Timeline header: classification badge + evidence sentence
- Filter by department | event type | date range
- Empty state: "No activity events linked to this business yet"

### Tab 3 — Reviewer History
- Table of past review decisions (only visible if any)
- Columns: Decision | Reviewer | Date | Reason | Resulting UBID

**Data:**
- `GET /api/v1/business/{ubid}`
- `GET /api/v1/timeline/{ubid}`

---

## Screen 4 — Review Queue (`/review`)

**Purpose:** Reviewer's work queue of ambiguous match cases.

**Layout:** Stats row + filter bar + case cards list

**Components:**
- **Stats Row:** Total Pending | Escalated | Resolved Today | My Assigned
- **Filter Bar:** Status | Department pair | Confidence range | Assigned to me toggle
- **Case Cards:** Each card shows:
  - Confidence score (large, with color: red < 0.60, amber 0.60–0.75, green > 0.75)
  - Two business name snippets side by side
  - Similarity chips: Name similarity % | Address overlap % | PAN match ✓/✗ | GSTIN match ✓/✗
  - Department badges for each record
  - Created date
  - "Review Now" button → navigates to case detail
- Sort: lowest confidence first (most uncertain → most important to resolve)

**Data:** `GET /api/v1/review/queue`

---

## Screen 5 — Review Case Detail (`/review/[caseId]`)

**Purpose:** Reviewer sees full evidence for one candidate pair and makes a decision.

**Layout:** Evidence panel (top) + decision panel (bottom)

### Evidence Panel
- **Side-by-side comparison table:**

| Field | Record A (Dept) | Record B (Dept) | Match |
|-------|----------------|----------------|-------|
| Name | Lakshmi Steel Works | Laxmi Steel Works Pvt Ltd | 88% |
| Address | 14, Industrial Area, Peenya | 14/A, Peenya Industrial Area | 62% |
| Pincode | 560029 | 560029 | ✅ |
| PAN | — | AABCL1234M | ❌ |
| GSTIN | — | 29AABCL1234M1Z5 | ❌ |
| Registration | S&E/BLR/2018/04521 | FACT/BLR/2017/00892 | ❌ |

- **Confidence meter:** 0.51 — amber warning
- **Engine reasoning:** "Name similarity is high. Address overlap moderate. No shared PAN/GSTIN to confirm. Routing to reviewer."

### Decision Panel
- Reason text area (required)
- Three buttons:
  - ✅ **Approve Merge** (green) — links records into one UBID
  - ❌ **Reject Merge** (red) — keeps records separate
  - ⚠️ **Escalate** (amber) — send to Supervisor
- "I agree with engine confidence" checkbox

**Data:**
- `GET /api/v1/review/{caseId}`
- `POST /api/v1/review/{caseId}/decide`

---

## Screen 6 — Pincode Intelligence Dashboard (`/pincode`)

**Purpose:** Geographical intelligence — search by pincode or district to understand business landscape.

**Layout:** Search bar + KPI cards + filtered list + optional map placeholder

**Components:**
- **Pincode / District search**
- **KPI Cards:** Total businesses | Active | Dormant | Closed | Last Inspection Date
- **Advanced Query Builder:**
  - Department filter
  - Status filter
  - "No inspection since X days" slider
  - "Run Query" button
- **Results Table:** Business Name | Status | Last Event | Departments | UBID link
- **Map Placeholder:** "Map visualization coming in Phase 2" (with pincode marker placeholders)

**Example query:** "Show factories in 560058 with no inspection in 18 months" → 7 results

**Data:**
- `GET /api/v1/pincode/{pincode}`
- `GET /api/v1/pincode/query`

---

## Screen 7 — Supervisor Analytics Dashboard (`/dashboard`)

**Purpose:** System-wide KPIs and operational health for senior officers.

**Layout:** 4-col KPI row + 2-col chart row + tables row

**Components:**
- **KPI Row:**
  - Total Businesses (UBID count)
  - Active %
  - Review Queue Depth
  - Auto-Link Rate
- **Charts:**
  - Donut: Status distribution (Active/Dormant/Closed/Review Needed)
  - Bar: Department coverage (records per department)
  - Line: Review cases resolved over time (7-day window)
  - Bar: Top 10 districts by business count
- **Tables:**
  - Top 10 dormancy clusters by district
  - Recent reviewer decisions (last 20)
  - Departments with lowest coverage

**Data:** `GET /api/v1/dashboard/summary`

---

## Screen 8 — Admin Settings (`/admin`)

**Purpose:** System administration — users, departments, and audit logs.

### Sub-screen: Users (`/admin/users`)
- Table: Name | Email | Role | Department | Status | Last Login | Actions
- "Add User" modal: email, name, role, department
- Deactivate toggle per user

### Sub-screen: Departments (`/admin/departments`)
- Table: Code | Name | Adapter Type | Last Ingested | Record Count | Status
- "Trigger Ingestion" button per department
- Adapter config editor (JSON)

### Sub-screen: Audit Log (`/admin/audit`)
- Filter: User | Action | Date range
- Table: Timestamp | User | Action | Entity | Change summary
- Expand row to see old/new value diff

**Data:** `/api/v1/admin/*`

---

## Shared Components

| Component | Description |
|-----------|-------------|
| `StatusBadge` | Color-coded pill: ACTIVE (green), DORMANT (amber), CLOSED (red), REVIEW_NEEDED (grey) |
| `DeptIcon` | Small icon per department (Shops, Factories, KSPCB, BESCOM) |
| `ConfidenceMeter` | Percentage bar with color threshold |
| `UBIDChip` | Copyable monospace UBID pill |
| `MaskedField` | Shows masked PAN/GSTIN with unlock icon for authorized roles |
| `TimelineEvent` | Single event card on the timeline |
| `NavSidebar` | Role-aware left sidebar navigation |
| `PageHeader` | Page title + breadcrumbs + actions |
| `DataTable` | Sortable, paginated table with loading skeleton |
| `EmptyState` | Illustrated empty state with action prompt |
| `ErrorBanner` | API error display with retry button |

---

## Responsive Design Notes

- Desktop-first (government officers use desktop workstations)
- Min supported width: 1280px
- Tables collapse to card view on tablet (for supervisor on mobile)
- No mobile-first requirement for prototype — judges will view on desktop
