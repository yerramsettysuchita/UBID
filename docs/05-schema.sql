-- UBID Platform — PostgreSQL Schema
-- Version: 1.0 | Phase 0
-- Run: psql -U ubid_user -d ubid_db -f schema.sql

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- trigram search on names

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('OFFICER', 'REVIEWER', 'SUPERVISOR', 'ADMIN', 'AUDITOR');

CREATE TYPE business_status AS ENUM ('ACTIVE', 'DORMANT', 'CLOSED', 'REVIEW_NEEDED');

CREATE TYPE resolution_status AS ENUM ('PENDING', 'LINKED', 'IN_REVIEW', 'UNLINKED');

CREATE TYPE identifier_type AS ENUM (
    'PAN', 'GSTIN', 'SHOPS_REG', 'FACTORY_LIC', 'KSPCB_CONSENT',
    'BESCOM_CONSUMER', 'UDYAM', 'IEC', 'OTHER'
);

CREATE TYPE address_type AS ENUM ('REGISTERED', 'OPERATIONAL', 'COMMUNICATION');

CREATE TYPE event_type AS ENUM (
    'INSPECTION', 'RENEWAL', 'FILING', 'METER_READ',
    'NOTICE', 'CLOSURE', 'REGISTRATION', 'COMPLAINT'
);

CREATE TYPE review_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'ESCALATED', 'RESOLVED');

CREATE TYPE review_decision AS ENUM (
    'APPROVED_MERGE', 'REJECTED_MERGE', 'ESCALATED',
    'RESOLVED_MERGE', 'RESOLVED_SEPARATE'
);

CREATE TYPE adapter_type AS ENUM ('JSON_FILE', 'CSV_FILE', 'REST_API', 'DB_VIEW');

-- ============================================================
-- DEPARTMENTS
-- ============================================================

CREATE TABLE departments (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code                    VARCHAR(20) UNIQUE NOT NULL,   -- SHOPS, FACTORIES, KSPCB, BESCOM
    name                    VARCHAR(200) NOT NULL,
    adapter_type            adapter_type NOT NULL DEFAULT 'JSON_FILE',
    adapter_config          JSONB NOT NULL DEFAULT '{}',
    field_mapping_version   INTEGER NOT NULL DEFAULT 1,
    last_ingested_at        TIMESTAMP,
    record_count            INTEGER NOT NULL DEFAULT 0,
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- USERS
-- ============================================================

CREATE TABLE users (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email               VARCHAR(255) UNIQUE NOT NULL,
    hashed_password     VARCHAR(255) NOT NULL,
    full_name           VARCHAR(200) NOT NULL,
    role                user_role NOT NULL,
    department_code     VARCHAR(20) REFERENCES departments(code),
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at       TIMESTAMP,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- ============================================================
-- BUSINESS ENTITIES (UBID table)
-- ============================================================

CREATE TABLE business_entities (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ubid                    VARCHAR(50) UNIQUE NOT NULL,
    canonical_name          VARCHAR(500) NOT NULL,
    canonical_name_tsv      TSVECTOR,                      -- full-text search vector
    canonical_pan           VARCHAR(10),
    canonical_gstin         VARCHAR(15),
    status                  business_status NOT NULL DEFAULT 'REVIEW_NEEDED',
    status_reason           TEXT,
    status_last_updated     TIMESTAMP,
    confidence_score        DECIMAL(4,3) NOT NULL DEFAULT 0.0,
    primary_pincode         VARCHAR(6),
    district                VARCHAR(100),
    is_active               BOOLEAN NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_be_ubid ON business_entities(ubid);
CREATE INDEX idx_be_pan ON business_entities(canonical_pan);
CREATE INDEX idx_be_gstin ON business_entities(canonical_gstin);
CREATE INDEX idx_be_status ON business_entities(status);
CREATE INDEX idx_be_pincode ON business_entities(primary_pincode);
CREATE INDEX idx_be_district ON business_entities(district);
CREATE INDEX idx_be_name_tsv ON business_entities USING GIN(canonical_name_tsv);
CREATE INDEX idx_be_name_trgm ON business_entities USING GIN(canonical_name gin_trgm_ops);

-- Auto-update tsvector on insert/update
CREATE OR REPLACE FUNCTION update_business_name_tsv()
RETURNS TRIGGER AS $$
BEGIN
    NEW.canonical_name_tsv := to_tsvector('english', NEW.canonical_name);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_be_name_tsv
    BEFORE INSERT OR UPDATE ON business_entities
    FOR EACH ROW EXECUTE FUNCTION update_business_name_tsv();

-- ============================================================
-- ESTABLISHMENTS (branches)
-- ============================================================

CREATE TABLE establishments (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_entity_id  UUID NOT NULL REFERENCES business_entities(id),
    name                VARCHAR(500),
    pincode             VARCHAR(6),
    address_line        TEXT,
    district            VARCHAR(100),
    latitude            DECIMAL(10,7),
    longitude           DECIMAL(10,7),
    created_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_est_entity ON establishments(business_entity_id);
CREATE INDEX idx_est_pincode ON establishments(pincode);

-- ============================================================
-- SOURCE RECORDS
-- ============================================================

CREATE TABLE source_records (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_entity_id  UUID REFERENCES business_entities(id),      -- null until resolved
    establishment_id    UUID REFERENCES establishments(id),          -- null until resolved
    department_code     VARCHAR(20) NOT NULL REFERENCES departments(code),
    source_record_id    VARCHAR(100) NOT NULL,                       -- ID from source system
    raw_name            VARCHAR(500),
    normalized_name     VARCHAR(500),
    registration_number VARCHAR(100),
    registration_date   DATE,
    registration_status VARCHAR(50),
    owner_name          VARCHAR(300),
    raw_address         TEXT,
    normalized_address  TEXT,
    pincode             VARCHAR(6),
    district            VARCHAR(100),
    pan                 VARCHAR(10),                                  -- searchable (not masked here)
    gstin               VARCHAR(15),
    last_event_date     DATE,
    ingested_at         TIMESTAMP NOT NULL DEFAULT NOW(),
    data_hash           VARCHAR(64),                                  -- SHA-256 for change detection
    resolution_status   resolution_status NOT NULL DEFAULT 'PENDING',
    UNIQUE(department_code, source_record_id)
);

CREATE INDEX idx_sr_dept ON source_records(department_code);
CREATE INDEX idx_sr_entity ON source_records(business_entity_id);
CREATE INDEX idx_sr_pan ON source_records(pan);
CREATE INDEX idx_sr_gstin ON source_records(gstin);
CREATE INDEX idx_sr_pincode ON source_records(pincode);
CREATE INDEX idx_sr_resolution ON source_records(resolution_status);
CREATE INDEX idx_sr_name_trgm ON source_records USING GIN(normalized_name gin_trgm_ops);

-- ============================================================
-- IDENTIFIERS
-- ============================================================

CREATE TABLE identifiers (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_record_id    UUID NOT NULL REFERENCES source_records(id),
    identifier_type     identifier_type NOT NULL,
    identifier_value    VARCHAR(100) NOT NULL,
    is_verified         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ident_record ON identifiers(source_record_id);
CREATE INDEX idx_ident_type_value ON identifiers(identifier_type, identifier_value);

-- ============================================================
-- ADDRESSES
-- ============================================================

CREATE TABLE addresses (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_record_id    UUID NOT NULL REFERENCES source_records(id),
    address_type        address_type NOT NULL DEFAULT 'REGISTERED',
    line1               VARCHAR(300),
    line2               VARCHAR(300),
    city                VARCHAR(100),
    district            VARCHAR(100),
    state               VARCHAR(50) NOT NULL DEFAULT 'Karnataka',
    pincode             VARCHAR(6),
    latitude            DECIMAL(10,7),
    longitude           DECIMAL(10,7),
    normalized_full     TEXT                                           -- for matching
);

CREATE INDEX idx_addr_record ON addresses(source_record_id);
CREATE INDEX idx_addr_pincode ON addresses(pincode);

-- ============================================================
-- BUSINESS EVENTS (activity signals)
-- ============================================================

CREATE TABLE business_events (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_entity_id  UUID NOT NULL REFERENCES business_entities(id),
    source_record_id    UUID REFERENCES source_records(id),
    department_code     VARCHAR(20) NOT NULL,
    event_type          event_type NOT NULL,
    event_date          DATE NOT NULL,
    event_description   TEXT,
    event_outcome       VARCHAR(100),
    source_event_id     VARCHAR(100),
    ingested_at         TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_evt_entity ON business_events(business_entity_id);
CREATE INDEX idx_evt_dept ON business_events(department_code);
CREATE INDEX idx_evt_date ON business_events(event_date DESC);
CREATE INDEX idx_evt_type ON business_events(event_type);

-- ============================================================
-- REVIEW CASES
-- ============================================================

CREATE TABLE review_cases (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    record_a_id         UUID NOT NULL REFERENCES source_records(id),
    record_b_id         UUID NOT NULL REFERENCES source_records(id),
    confidence_score    DECIMAL(4,3) NOT NULL,
    name_score          DECIMAL(4,3),
    address_score       DECIMAL(4,3),
    pan_match           BOOLEAN,
    gstin_match         BOOLEAN,
    status              review_status NOT NULL DEFAULT 'PENDING',
    priority            INTEGER NOT NULL DEFAULT 50,                  -- 0–100, higher reviewed first
    assigned_to         UUID REFERENCES users(id),
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    resolved_at         TIMESTAMP,
    CHECK (record_a_id <> record_b_id)
);

CREATE INDEX idx_rc_status ON review_cases(status);
CREATE INDEX idx_rc_confidence ON review_cases(confidence_score);
CREATE INDEX idx_rc_priority ON review_cases(priority DESC);
CREATE INDEX idx_rc_assigned ON review_cases(assigned_to);
-- Prevent duplicate pairs (both directions)
CREATE UNIQUE INDEX idx_rc_pair ON review_cases(
    LEAST(record_a_id, record_b_id),
    GREATEST(record_a_id, record_b_id)
);

-- ============================================================
-- REVIEWER DECISIONS
-- ============================================================

CREATE TABLE reviewer_decisions (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    review_case_id          UUID NOT NULL REFERENCES review_cases(id),
    reviewer_id             UUID NOT NULL REFERENCES users(id),
    decision                review_decision NOT NULL,
    reason                  TEXT,
    resulting_ubid          VARCHAR(50),
    confidence_agreement    BOOLEAN,
    decided_at              TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rd_case ON reviewer_decisions(review_case_id);
CREATE INDEX idx_rd_reviewer ON reviewer_decisions(reviewer_id);
CREATE INDEX idx_rd_decided_at ON reviewer_decisions(decided_at DESC);

-- ============================================================
-- AUDIT LOGS (append-only)
-- ============================================================

CREATE TABLE audit_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID REFERENCES users(id),               -- null for system jobs
    action          VARCHAR(100) NOT NULL,
    entity_type     VARCHAR(50),
    entity_id       UUID,
    old_value       JSONB,
    new_value       JSONB,
    ip_address      INET,
    user_agent      TEXT,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_al_user ON audit_logs(user_id);
CREATE INDEX idx_al_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_al_created ON audit_logs(created_at DESC);
CREATE INDEX idx_al_action ON audit_logs(action);

-- ============================================================
-- PINCODE INTELLIGENCE (materialized view)
-- ============================================================

CREATE MATERIALIZED VIEW pincode_intelligence AS
SELECT
    sr.pincode,
    sr.district,
    COUNT(DISTINCT be.id)                                               AS total_businesses,
    COUNT(DISTINCT be.id) FILTER (WHERE be.status = 'ACTIVE')          AS active_count,
    COUNT(DISTINCT be.id) FILTER (WHERE be.status = 'DORMANT')         AS dormant_count,
    COUNT(DISTINCT be.id) FILTER (WHERE be.status = 'CLOSED')          AS closed_count,
    COUNT(DISTINCT be.id) FILTER (WHERE be.status = 'REVIEW_NEEDED')   AS review_needed_count,
    MAX(evt.event_date) FILTER (WHERE evt.event_type = 'INSPECTION')   AS last_inspection_date,
    NOW()                                                               AS refreshed_at
FROM source_records sr
JOIN business_entities be ON be.id = sr.business_entity_id
LEFT JOIN business_events evt ON evt.business_entity_id = be.id
WHERE sr.pincode IS NOT NULL
GROUP BY sr.pincode, sr.district;

CREATE UNIQUE INDEX idx_pi_pincode ON pincode_intelligence(pincode);
CREATE INDEX idx_pi_district ON pincode_intelligence(district);

-- Refresh command (run after each ingestion + classification cycle):
-- REFRESH MATERIALIZED VIEW CONCURRENTLY pincode_intelligence;

-- ============================================================
-- SEED DATA — Departments
-- ============================================================

INSERT INTO departments (code, name, adapter_type, adapter_config) VALUES
('SHOPS',     'Shops and Establishments (Labour Dept)',       'JSON_FILE', '{"path": "data/synthetic/shops_establishments.json"}'),
('FACTORIES', 'Factories Act Licensing (Labour Dept)',         'JSON_FILE', '{"path": "data/synthetic/factories.json"}'),
('KSPCB',     'Karnataka State Pollution Control Board',       'JSON_FILE', '{"path": "data/synthetic/kspcb.json"}'),
('BESCOM',    'BESCOM Electricity Consumer Records',           'JSON_FILE', '{"path": "data/synthetic/bescom_events.json"}');

-- ============================================================
-- SEED DATA — Demo Users (passwords = demo1234, bcrypt hash)
-- ============================================================
-- Actual hashes generated during Phase 1 seed script
-- Placeholder format shown here:
INSERT INTO users (email, hashed_password, full_name, role, department_code) VALUES
('officer@ubid.demo',    '$2b$12$PLACEHOLDER_HASH_OFFICER',    'Ravi Kumar',       'OFFICER',    'SHOPS'),
('reviewer@ubid.demo',   '$2b$12$PLACEHOLDER_HASH_REVIEWER',   'Priya Nair',       'REVIEWER',   NULL),
('supervisor@ubid.demo', '$2b$12$PLACEHOLDER_HASH_SUPERVISOR',  'Suresh Babu',      'SUPERVISOR', NULL),
('admin@ubid.demo',      '$2b$12$PLACEHOLDER_HASH_ADMIN',       'Admin User',       'ADMIN',      NULL),
('auditor@ubid.demo',    '$2b$12$PLACEHOLDER_HASH_AUDITOR',     'Audit Officer',    'AUDITOR',    NULL);
