# UBID Platform — Canonical Data Model

## Identity Layer Hierarchy

```
BUSINESS ENTITY (UBID)
  ├── has many ESTABLISHMENTS (branches / locations)
  │     └── has many SOURCE RECORDS (one per department registration)
  │           ├── has many IDENTIFIERS (PAN, GSTIN, dept reg numbers)
  │           └── has many ADDRESSES
  ├── has many BUSINESS EVENTS (activity signals)
  ├── has many REVIEW CASES (ambiguous match decisions)
  └── has one STATUS CLASSIFICATION
```

**Key design decision:** UBID is assigned at the **business entity level** (the legal entity / company). A business may have multiple establishments (branches). Each establishment may have multiple source records across departments. Entity resolution happens between source records to identify which ones belong to the same business.

---

## Core Entities

### 1. BusinessEntity

Represents the resolved, canonical identity of a real-world business.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Internal primary key |
| `ubid` | VARCHAR(50) | Unique Business Identifier (PAN-anchored or UUID-based) |
| `canonical_name` | VARCHAR(500) | Normalized business name (best available) |
| `canonical_pan` | VARCHAR(10) | PAN if known |
| `canonical_gstin` | VARCHAR(15) | Primary GSTIN if known |
| `status` | ENUM | `ACTIVE`, `DORMANT`, `CLOSED`, `REVIEW_NEEDED` |
| `status_reason` | TEXT | Human-readable evidence for status |
| `status_last_updated` | TIMESTAMP | When status was last recomputed |
| `confidence_score` | DECIMAL(4,3) | Overall linkage confidence 0–1 |
| `primary_pincode` | VARCHAR(6) | Primary location pincode |
| `district` | VARCHAR(100) | Karnataka district |
| `created_at` | TIMESTAMP | When UBID was first created |
| `updated_at` | TIMESTAMP | Last modification |
| `is_active` | BOOLEAN | Soft delete flag |

---

### 2. Establishment

Represents a physical location / branch of a business entity.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Internal primary key |
| `business_entity_id` | UUID FK → BusinessEntity | Parent business |
| `name` | VARCHAR(500) | Establishment name |
| `pincode` | VARCHAR(6) | Location pincode |
| `address_line` | TEXT | Full address |
| `district` | VARCHAR(100) | Karnataka district |
| `latitude` | DECIMAL(10,7) | Geocoded lat (if available) |
| `longitude` | DECIMAL(10,7) | Geocoded lon (if available) |
| `created_at` | TIMESTAMP | |

---

### 3. SourceRecord

A single registration record from one department, normalized into canonical format. This is the raw input unit for entity resolution.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Internal primary key |
| `business_entity_id` | UUID FK → BusinessEntity | Set after entity resolution |
| `establishment_id` | UUID FK → Establishment | Set after entity resolution |
| `department_code` | VARCHAR(20) | `SHOPS`, `FACTORIES`, `KSPCB`, `BESCOM` |
| `source_record_id` | VARCHAR(100) | The ID from the source system |
| `raw_name` | VARCHAR(500) | Original name from source |
| `normalized_name` | VARCHAR(500) | After normalization |
| `registration_number` | VARCHAR(100) | Department-specific reg number |
| `registration_date` | DATE | |
| `registration_status` | VARCHAR(50) | Status in source system (active/expired/cancelled) |
| `owner_name` | VARCHAR(300) | Proprietor/director name |
| `raw_address` | TEXT | Original address |
| `normalized_address` | TEXT | After normalization |
| `pincode` | VARCHAR(6) | Extracted/normalized pincode |
| `district` | VARCHAR(100) | Extracted district |
| `pan` | VARCHAR(10) | PAN if available in source |
| `gstin` | VARCHAR(15) | GSTIN if available in source |
| `last_event_date` | DATE | Most recent activity event date |
| `ingested_at` | TIMESTAMP | When this record was ingested |
| `data_hash` | VARCHAR(64) | SHA-256 of source fields for change detection |
| `resolution_status` | ENUM | `PENDING`, `LINKED`, `IN_REVIEW`, `UNLINKED` |

---

### 4. Identifier

Flexible key-value store for all identifiers attached to a source record.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | |
| `source_record_id` | UUID FK → SourceRecord | |
| `identifier_type` | ENUM | `PAN`, `GSTIN`, `SHOPS_REG`, `FACTORY_LIC`, `KSPCB_CONSENT`, `BESCOM_CONSUMER`, `UDYAM`, `IEC`, `OTHER` |
| `identifier_value` | VARCHAR(100) | The actual identifier value |
| `is_verified` | BOOLEAN | Whether confirmed by source system |
| `created_at` | TIMESTAMP | |

---

### 5. Address

Normalized address record, potentially geocoded.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | |
| `source_record_id` | UUID FK → SourceRecord | |
| `address_type` | ENUM | `REGISTERED`, `OPERATIONAL`, `COMMUNICATION` |
| `line1` | VARCHAR(300) | |
| `line2` | VARCHAR(300) | |
| `city` | VARCHAR(100) | |
| `district` | VARCHAR(100) | |
| `state` | VARCHAR(50) | Default: Karnataka |
| `pincode` | VARCHAR(6) | |
| `latitude` | DECIMAL(10,7) | |
| `longitude` | DECIMAL(10,7) | |
| `normalized_full` | TEXT | Concatenated normalized address for matching |

---

### 6. BusinessEvent

An activity signal event attached to a UBID.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | |
| `business_entity_id` | UUID FK → BusinessEntity | |
| `source_record_id` | UUID FK → SourceRecord | Which dept record generated this event |
| `department_code` | VARCHAR(20) | Source department |
| `event_type` | ENUM | `INSPECTION`, `RENEWAL`, `FILING`, `METER_READ`, `NOTICE`, `CLOSURE`, `REGISTRATION`, `COMPLAINT` |
| `event_date` | DATE | When the event occurred |
| `event_description` | TEXT | Optional description |
| `event_outcome` | VARCHAR(100) | e.g., `PASSED`, `FAILED`, `PENDING` |
| `source_event_id` | VARCHAR(100) | ID from source system |
| `ingested_at` | TIMESTAMP | |

---

### 7. ReviewCase

An ambiguous record pair flagged for human review.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | |
| `record_a_id` | UUID FK → SourceRecord | First candidate record |
| `record_b_id` | UUID FK → SourceRecord | Second candidate record |
| `confidence_score` | DECIMAL(4,3) | Similarity score (0–1); lower = more uncertain |
| `name_score` | DECIMAL(4,3) | Jaro-Winkler name similarity |
| `address_score` | DECIMAL(4,3) | Address token overlap |
| `pan_match` | BOOLEAN | PAN exact match |
| `gstin_match` | BOOLEAN | GSTIN exact match |
| `status` | ENUM | `PENDING`, `APPROVED`, `REJECTED`, `ESCALATED`, `RESOLVED` |
| `priority` | INTEGER | Higher = review sooner (based on business impact) |
| `assigned_to` | UUID FK → User | If assigned to specific reviewer |
| `created_at` | TIMESTAMP | |
| `resolved_at` | TIMESTAMP | |

---

### 8. ReviewerDecision

Log of every decision made on a ReviewCase.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | |
| `review_case_id` | UUID FK → ReviewCase | |
| `reviewer_id` | UUID FK → User | |
| `decision` | ENUM | `APPROVED_MERGE`, `REJECTED_MERGE`, `ESCALATED`, `RESOLVED_MERGE`, `RESOLVED_SEPARATE` |
| `reason` | TEXT | Free-text reason |
| `resulting_ubid` | VARCHAR(50) | UBID created/modified if merge approved |
| `decided_at` | TIMESTAMP | |
| `confidence_agreement` | BOOLEAN | Whether reviewer agreed with engine confidence |

---

### 9. AuditLog

Append-only log of all system mutations.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | |
| `user_id` | UUID FK → User | Actor (null for system jobs) |
| `action` | VARCHAR(100) | e.g., `REVIEW_APPROVE`, `ENTITY_CREATE`, `USER_CREATE` |
| `entity_type` | VARCHAR(50) | Table/entity affected |
| `entity_id` | UUID | Primary key of affected row |
| `old_value` | JSONB | State before change |
| `new_value` | JSONB | State after change |
| `ip_address` | INET | Request IP |
| `user_agent` | TEXT | |
| `created_at` | TIMESTAMP | |

---

### 10. User / Role

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | |
| `email` | VARCHAR(255) | Unique login email |
| `hashed_password` | VARCHAR(255) | bcrypt hash |
| `full_name` | VARCHAR(200) | |
| `role` | ENUM | `OFFICER`, `REVIEWER`, `SUPERVISOR`, `ADMIN`, `AUDITOR` |
| `department_code` | VARCHAR(20) | Department this user belongs to (nullable) |
| `is_active` | BOOLEAN | |
| `last_login_at` | TIMESTAMP | |
| `created_at` | TIMESTAMP | |

---

### 11. Department

Registry of all connected departments and their adapter configuration.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | |
| `code` | VARCHAR(20) | `SHOPS`, `FACTORIES`, `KSPCB`, `BESCOM` |
| `name` | VARCHAR(200) | Full department name |
| `adapter_type` | ENUM | `JSON_FILE`, `CSV_FILE`, `REST_API`, `DB_VIEW` |
| `adapter_config` | JSONB | Connection details (path, URL, creds reference) |
| `field_mapping_version` | INTEGER | Current field mapping schema version |
| `last_ingested_at` | TIMESTAMP | |
| `record_count` | INTEGER | Number of source records |
| `is_active` | BOOLEAN | |

---

### 12. PincodeIntelligenceView (Materialized View)

Pre-aggregated view for pincode-level intelligence queries.

| Field | Type | Description |
|-------|------|-------------|
| `pincode` | VARCHAR(6) | |
| `district` | VARCHAR(100) | |
| `total_businesses` | INTEGER | |
| `active_count` | INTEGER | |
| `dormant_count` | INTEGER | |
| `closed_count` | INTEGER | |
| `review_needed_count` | INTEGER | |
| `last_inspection_date` | DATE | Most recent inspection in pincode |
| `avg_compliance_score` | DECIMAL(4,3) | |
| `refreshed_at` | TIMESTAMP | |

---

## Entity Relationship Summary

```
User ────────────────── ReviewerDecision
  │                          │
  └── assigned_to ─────── ReviewCase ──── SourceRecord ──── Identifier
                                │              │                │
                         BusinessEntity   Address          BusinessEvent
                              │
                         Establishment
                              │
                         SourceRecord
```
