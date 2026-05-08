# UBID Platform — API Contract

Base URL: `https://api.ubid.demo/api/v1`
Auth: `Authorization: Bearer <jwt_token>` on all protected routes
Content-Type: `application/json`

---

## Authentication

### POST /auth/login
```json
Request:
{ "email": "officer@ubid.demo", "password": "demo1234" }

Response 200:
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "expires_in": 28800,
  "user": {
    "id": "uuid",
    "email": "officer@ubid.demo",
    "full_name": "Ravi Kumar",
    "role": "OFFICER",
    "department_code": "SHOPS"
  }
}

Error 401:
{ "detail": "Invalid credentials" }
```

### POST /auth/refresh
```json
Request:
{ "refresh_token": "eyJ..." }

Response 200:
{ "access_token": "eyJ...", "expires_in": 28800 }
```

### GET /auth/me  [protected]
```json
Response 200:
{
  "id": "uuid",
  "email": "officer@ubid.demo",
  "full_name": "Ravi Kumar",
  "role": "OFFICER",
  "department_code": "SHOPS"
}
```

### POST /auth/logout  [protected]
```json
Response 200:
{ "message": "Logged out successfully" }
```

---

## Business Search

### GET /search  [protected: all roles]
Query params:
- `q` — free-text (name, partial name)
- `ubid` — exact UBID
- `pan` — exact PAN
- `gstin` — exact GSTIN
- `pincode` — 6-digit pincode
- `district` — district name
- `status` — ACTIVE | DORMANT | CLOSED | REVIEW_NEEDED
- `department` — SHOPS | FACTORIES | KSPCB | BESCOM
- `page` — default 1
- `page_size` — default 20, max 100

```json
Response 200:
{
  "total": 142,
  "page": 1,
  "page_size": 20,
  "results": [
    {
      "ubid": "UBID-PAN-AQCPK1234K",
      "canonical_name": "Sri Mahalakshmi Textile Mills Private Limited",
      "status": "ACTIVE",
      "status_reason": "BESCOM meter read 12 days ago; KSPCB renewal 45 days ago",
      "primary_pincode": "560058",
      "district": "Bengaluru Urban",
      "confidence_score": 0.923,
      "department_count": 3,
      "last_event_date": "2026-04-25"
    }
  ]
}
```

Note: PAN/GSTIN masked for OFFICER role — `"canonical_pan": "AQCPK****K"`

---

## Business Profile

### GET /business/{ubid}  [protected: all roles]
```json
Response 200:
{
  "ubid": "UBID-PAN-AQCPK1234K",
  "canonical_name": "Sri Mahalakshmi Textile Mills Private Limited",
  "canonical_pan": "AQCPK1234K",        // masked for OFFICER
  "canonical_gstin": "29AQCPK1234K1ZX", // masked for OFFICER
  "status": "ACTIVE",
  "status_reason": "BESCOM meter read 12 days ago; KSPCB renewal 45 days ago",
  "status_last_updated": "2026-05-01T10:00:00Z",
  "confidence_score": 0.923,
  "primary_pincode": "560058",
  "district": "Bengaluru Urban",
  "created_at": "2026-04-01T08:00:00Z",
  "department_coverage": ["SHOPS", "FACTORIES", "KSPCB", "BESCOM"],
  "linked_records": [
    {
      "source_record_id": "uuid",
      "department_code": "SHOPS",
      "department_name": "Shops and Establishments",
      "registration_number": "S&E/BLR/2019/12345",
      "registration_status": "Active",
      "registration_date": "2019-03-15",
      "normalized_name": "Sri Mahalakshmi Textile Mills Pvt Ltd",
      "pincode": "560058"
    }
  ],
  "recent_events": [
    {
      "event_type": "METER_READ",
      "event_date": "2026-04-25",
      "department_code": "BESCOM",
      "event_description": "Monthly meter reading completed"
    }
  ],
  "review_history": []
}
```

### GET /business/{ubid}/linked-records  [protected: all roles]
Returns full list of source records (paginated).

### GET /business/{ubid}/events  [protected: all roles]
Returns all events for the UBID.

---

## Activity Timeline

### GET /timeline/{ubid}  [protected: all roles]
Query params: `from_date`, `to_date`, `event_type`, `department`

```json
Response 200:
{
  "ubid": "UBID-PAN-AQCPK1234K",
  "status": "ACTIVE",
  "status_reason": "BESCOM meter read 12 days ago",
  "events": [
    {
      "id": "uuid",
      "event_type": "METER_READ",
      "event_date": "2026-04-25",
      "department_code": "BESCOM",
      "department_name": "BESCOM",
      "event_description": "Monthly meter reading - 1450 units",
      "event_outcome": "COMPLETED",
      "days_ago": 12
    },
    {
      "id": "uuid",
      "event_type": "RENEWAL",
      "event_date": "2026-03-10",
      "department_code": "KSPCB",
      "department_name": "Karnataka State Pollution Control Board",
      "event_description": "Consent to Operate renewed",
      "event_outcome": "APPROVED",
      "days_ago": 58
    }
  ],
  "classification_evidence": {
    "recency_days": 12,
    "signal_count": 7,
    "departments_with_recent_signal": ["BESCOM", "KSPCB"],
    "oldest_signal_days": 180
  }
}
```

---

## Review Queue

### GET /review/queue  [protected: REVIEWER, SUPERVISOR, AUDITOR]
Query params: `status` (default PENDING), `page`, `page_size`

```json
Response 200:
{
  "total": 47,
  "pending_count": 31,
  "escalated_count": 4,
  "results": [
    {
      "case_id": "uuid",
      "confidence_score": 0.51,
      "name_score": 0.88,
      "address_score": 0.62,
      "pan_match": false,
      "gstin_match": false,
      "status": "PENDING",
      "priority": 72,
      "record_a": {
        "department_code": "SHOPS",
        "normalized_name": "Lakshmi Steel Works",
        "pincode": "560029",
        "registration_number": "S&E/BLR/2018/04521"
      },
      "record_b": {
        "department_code": "FACTORIES",
        "normalized_name": "Laxmi Steel Works Private Limited",
        "pincode": "560029",
        "registration_number": "FACT/BLR/2017/00892"
      },
      "created_at": "2026-05-01T08:00:00Z"
    }
  ]
}
```

### GET /review/{case_id}  [protected: REVIEWER, SUPERVISOR, AUDITOR]
```json
Response 200:
{
  "case_id": "uuid",
  "confidence_score": 0.51,
  "name_score": 0.88,
  "address_score": 0.62,
  "pan_match": false,
  "gstin_match": false,
  "status": "PENDING",
  "evidence": {
    "name_comparison": {
      "record_a": "Lakshmi Steel Works",
      "record_b": "Laxmi Steel Works Private Limited",
      "similarity": 0.88,
      "method": "Jaro-Winkler"
    },
    "address_comparison": {
      "record_a": "14, Industrial Area, Peenya, Bengaluru 560029",
      "record_b": "14/A, Peenya Industrial Area, Bangalore 560029",
      "overlap_score": 0.62
    },
    "identifier_comparison": {
      "pan": { "record_a": null, "record_b": "AABCL1234M", "match": false },
      "gstin": { "record_a": null, "record_b": "29AABCL1234M1Z5", "match": false }
    }
  },
  "record_a": { /* full SourceRecord */ },
  "record_b": { /* full SourceRecord */ },
  "decision_history": []
}
```

### POST /review/{case_id}/decide  [protected: REVIEWER, SUPERVISOR]
```json
Request:
{
  "decision": "APPROVED_MERGE",   // or REJECTED_MERGE | ESCALATED
  "reason": "Same address, name variation is common abbreviation. Owner name matches.",
  "confidence_agreement": true
}

Response 200:
{
  "case_id": "uuid",
  "decision": "APPROVED_MERGE",
  "resulting_ubid": "UBID-PAN-AABCL1234M",
  "message": "Records merged. UBID UBID-PAN-AABCL1234M updated."
}

Error 403:
{ "detail": "Insufficient permissions" }
```

---

## Dashboard

### GET /dashboard/summary  [protected: SUPERVISOR, ADMIN, AUDITOR]
```json
Response 200:
{
  "total_ubids": 1842,
  "status_breakdown": {
    "ACTIVE": 1204,
    "DORMANT": 387,
    "CLOSED": 142,
    "REVIEW_NEEDED": 109
  },
  "review_queue": {
    "pending": 31,
    "escalated": 4,
    "resolved_today": 12
  },
  "department_coverage": {
    "SHOPS": 1200,
    "FACTORIES": 487,
    "KSPCB": 392,
    "BESCOM": 1104
  },
  "accuracy_metrics": {
    "auto_link_rate": 0.73,
    "false_merge_rate": 0.02,
    "reviewer_agreement_rate": 0.91
  },
  "last_ingestion": "2026-05-07T06:00:00Z"
}
```

---

## Pincode Intelligence

### GET /pincode/{pincode}  [protected: all roles]
```json
Response 200:
{
  "pincode": "560058",
  "district": "Bengaluru Urban",
  "total_businesses": 234,
  "active_count": 178,
  "dormant_count": 38,
  "closed_count": 12,
  "review_needed_count": 6,
  "last_inspection_date": "2026-04-30",
  "refreshed_at": "2026-05-07T04:00:00Z"
}
```

### GET /pincode/query  [protected: all roles]
Complex cross-department query endpoint.

Query params:
- `pincode` or `district`
- `status`
- `department`
- `no_inspection_since_days` — e.g., 540 for "no inspection in 18 months"
- `page`, `page_size`

```json
Response 200:
{
  "query": "Factories in pincode 560058 with no inspection in 18 months",
  "total": 7,
  "results": [
    {
      "ubid": "UBID-FACT-BLR-00892",
      "canonical_name": "Laxmi Steel Works Private Limited",
      "status": "DORMANT",
      "last_inspection_date": "2024-08-12",
      "days_since_inspection": 633,
      "departments": ["FACTORIES", "KSPCB"]
    }
  ]
}
```

---

## Admin Endpoints

### GET /admin/users  [protected: ADMIN]
### POST /admin/users  [protected: ADMIN]
### PUT /admin/users/{user_id}  [protected: ADMIN]
### GET /admin/departments  [protected: ADMIN]
### POST /admin/ingestion/trigger  [protected: ADMIN]
Triggers the ingestion + entity resolution + activity classification pipeline.

### GET /admin/audit-logs  [protected: ADMIN, AUDITOR]
Query params: `user_id`, `action`, `entity_type`, `from_date`, `to_date`, `page`

---

## Error Response Format

All errors follow:
```json
{
  "detail": "Human-readable error message",
  "error_code": "MACHINE_CODE",
  "timestamp": "2026-05-07T10:00:00Z"
}
```

Common HTTP status codes:
- `200` — Success
- `201` — Created
- `400` — Bad request / validation error
- `401` — Not authenticated
- `403` — Forbidden (wrong role)
- `404` — Resource not found
- `422` — Unprocessable entity (Pydantic validation)
- `429` — Rate limit exceeded
- `500` — Internal server error
