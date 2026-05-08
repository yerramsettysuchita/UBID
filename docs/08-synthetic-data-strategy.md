# UBID Platform — Synthetic Data Strategy

## Goals

The synthetic dataset must:
1. Be realistic enough to convince judges this is a real government system
2. Cover all entity resolution scenarios the engine must handle
3. Support all 8 demo scenarios end-to-end
4. Contain no real PII (invented names, real Karnataka pincode ranges, plausible identifiers)

## Volume Targets

| Department | Records | Clean | Duplicates | Ambiguous | Missing IDs |
|-----------|---------|-------|------------|-----------|-------------|
| Shops & Establishments | 600 | 360 | 60 | 120 | 60 |
| Factories | 250 | 150 | 30 | 50 | 20 |
| KSPCB | 200 | 120 | 25 | 40 | 15 |
| BESCOM Events | 800 | — | — | — | — |
| **Total records** | **1,850** | | | | |

---

## Karnataka Pincode Ranges Used

| District | Pincode Range |
|---------|--------------|
| Bengaluru Urban | 560001–560100 |
| Bengaluru Rural | 562100–562160 |
| Mysuru | 570001–570030 |
| Hubli-Dharwad | 580001–580032 |
| Mangaluru | 575001–575030 |
| Belagavi | 590001–590020 |
| Tumakuru | 572101–572140 |
| Kalaburagi | 585101–585120 |

---

## Realistic Business Name Patterns

Karnataka business names follow these patterns:
- `{deity/auspicious word} {industry} {Pvt Ltd / LLP / Enterprises / Works}`
- Examples: "Sri Venkateshwara Granites Pvt Ltd", "Cauvery Steel Fabrication Works", "Nandi Industries Limited"

Abbreviation variants to include (for resolution testing):
- `Private Limited` / `Pvt Ltd` / `P Ltd`
- `Limited` / `Ltd`
- `Industries` / `Indus`
- `Enterprises` / `Entp` / `Entrp`
- `Manufacturing` / `Mfg`
- `Brothers` / `Bros`
- Name prefix variations: `Sri` / `Shri` / omitted

---

## Scenario Categories in Synthetic Data

### Category A — Clean Records (easy auto-link)
Records that clearly match across departments:
- Same PAN + same GSTIN + nearly identical name
- Expected confidence: ≥ 0.92
- Engine should AUTO-LINK these
- Count: ~180 clean pairs

Example:
```
SHOPS: "Sri Mahalakshmi Textiles Pvt Ltd" | PAN: AQCPK1234K | 560058
FACTORIES: "Sri Mahalakshmi Textiles Private Limited" | PAN: AQCPK1234K | 560058
→ AUTO-LINK → UBID: UBID-PAN-AQCPK1234K
```

### Category B — Name Variation Only (medium confidence)
Same business, different name spellings. No PAN/GSTIN available in one record:
- Jaro-Winkler ≥ 0.80, same pincode, address overlap ≥ 0.50
- Expected confidence: 0.55–0.80
- Engine routes to REVIEWER
- Count: ~60 pairs

Example:
```
SHOPS:     "Lakshmi Steel Works" | No PAN | 560029
FACTORIES: "Laxmi Steel Works Private Limited" | PAN: AABCL1234M | 560029
→ REVIEW QUEUE (reviewer approves merge)
```

### Category C — Same PAN, Different Names (potential branch or name change)
PAN matches but names differ significantly:
- Expected confidence: 0.65–0.85 depending on address
- Routes to review for human judgment
- Count: ~30 pairs

Example:
```
SHOPS:  "Karunakara Traders" | PAN: BDCPK5678L | 560045
KSPCB:  "Karunakara Cold Storage" | PAN: BDCPK5678L | 560045
→ REVIEW: Same owner, possibly different business arms
```

### Category D — Near-Duplicate Clusters (suspicious / potential fraud)
3–4 records with very similar names and nearby pincodes:
- Could be subsidiaries or shell entities
- Expected confidence: 0.50–0.65
- Routes to escalation review
- Count: ~15 clusters

Example:
```
"Prestige Real Estate Pvt Ltd" | 560001
"Prestige Realty Limited" | 560001
"Prestige Properties Pvt Ltd" | 560002
→ ESCALATED: Suspicious cluster — share director name, similar addresses
```

### Category E — Dormant Factories
Factories with last event date > 18 months ago:
- S&E renewal expired, no BESCOM meter reads in 18+ months
- Status: DORMANT
- Count: 25 records

### Category F — Closed Businesses
Businesses with explicit closure signal or >3 year gap:
- Closure event in one department, no events elsewhere
- Status: CLOSED
- Count: 15 records

### Category G — Missing PAN/GSTIN
Records with neither PAN nor GSTIN (very common in smaller shops):
- Address and name are only match signals
- Harder to resolve — more go to review queue
- Count: ~75 records

### Category H — Multi-Branch Business
One legal entity with 3+ establishments in different pincodes:
- Same PAN, same GSTIN, different addresses
- Each branch has BESCOM consumer number, some have factory license
- Count: 8 multi-branch businesses (3–5 branches each)

### Category I — Activity-Rich Active Business
High-frequency events: monthly BESCOM reads, quarterly KSPCB checks, annual S&E renewals:
- Used in demo Story 1 to show a "fully alive" business
- Count: 12 businesses with 10+ events each

### Category J — Unlinked Events
BESCOM events where consumer number doesn't resolve to any source record:
- Could be residential meter or unregistered business
- Flagged as "unlinked events"
- Count: 50 events

---

## PAN / GSTIN Generation Rules

Synthetic PAN format: `[A-Z]{5}[0-9]{4}[A-Z]{1}` (valid format, not real PANs)
- Prefix: `AQCPK`, `AABCL`, `BDCPK`, `CCPDK`, `AACCM` (randomly chosen)

Synthetic GSTIN format: `29[PAN]1Z[A-Z0-9]` (Karnataka state code = 29)
- Example: `29AQCPK1234K1ZX`

All generated identifiers are clearly synthetic (not real-world valid) but format-correct.

---

## Event Types by Department

| Department | Event Types | Frequency |
|-----------|------------|-----------|
| SHOPS | REGISTRATION, RENEWAL (annual), INSPECTION | Annual + ad hoc |
| FACTORIES | REGISTRATION, INSPECTION (semi-annual), FILING | Semi-annual |
| KSPCB | REGISTRATION, RENEWAL (annual), NOTICE, INSPECTION | Annual + quarterly |
| BESCOM | METER_READ (monthly), COMPLAINT, CLOSURE | Monthly |

---

## Demo Story Data Alignment

| Demo Story | Required Data |
|-----------|--------------|
| Story 1: Business across all 4 depts | 1 UBID linked to SHOPS + FACTORIES + KSPCB + BESCOM |
| Story 2: Ambiguous merge → reviewer | 1 review case with confidence 0.51–0.65 |
| Story 3: Dormant factory | 1 factory with last event 14+ months ago |
| Story 4: Pincode query | 7+ factories in 560058 with no inspection in 18 months |
| Story 5: Suspicious cluster | 3 near-duplicate businesses in 560001 |
| Story 6: Review → profile update | Review case that resolves to new UBID |
| Story 7: Closed business | 1 business with explicit closure event in SHOPS |
| Story 8: Multi-branch visibility | 1 business with 4 establishments in different pincodes |

---

## File Format — Department Source Records

### shops_establishments.json
```json
[
  {
    "record_id": "SE-BLR-2019-12345",
    "business_name": "Sri Mahalakshmi Textiles Pvt Ltd",
    "owner_name": "Ramaiah K.",
    "registration_number": "S&E/BLR/2019/12345",
    "registration_date": "2019-03-15",
    "registration_status": "Active",
    "renewal_date": "2026-03-15",
    "address": "14, 3rd Cross, Peenya Industrial Area, Bengaluru",
    "pincode": "560058",
    "district": "Bengaluru Urban",
    "pan": "AQCPK1234K",
    "gstin": "29AQCPK1234K1ZX",
    "employee_count": 48,
    "nature_of_business": "Textile Manufacturing",
    "last_inspection_date": "2025-11-20"
  }
]
```

### factories.json
```json
[
  {
    "record_id": "FACT-BLR-2017-00892",
    "factory_name": "Sri Mahalakshmi Textiles Private Limited",
    "factory_license_number": "KA/BLR/F/2017/00892",
    "license_valid_until": "2027-03-31",
    "owner_name": "Ramaiah Krishnamurthy",
    "address": "14, Peenya Industrial Area, Bengaluru - 560058",
    "pincode": "560058",
    "district": "Bengaluru Urban",
    "pan": "AQCPK1234K",
    "gstin": null,
    "nature_of_activity": "Textile Processing",
    "worker_count": 52,
    "last_inspection_date": "2025-09-15",
    "inspection_result": "Satisfactory"
  }
]
```

### kspcb.json
```json
[
  {
    "record_id": "KSPCB-BLR-2020-04521",
    "unit_name": "Sri Mahalakshmi Textiles Pvt. Ltd",
    "consent_number": "KSPCB/BLR/CTO/2020/04521",
    "consent_valid_until": "2026-12-31",
    "address": "14/3, Peenya Industrial Area, Bangalore 560058",
    "pincode": "560058",
    "pan": null,
    "gstin": "29AQCPK1234K1ZX",
    "category": "Orange",
    "industry_type": "Textile Dyeing",
    "last_renewal_date": "2025-12-20",
    "compliance_status": "Compliant"
  }
]
```

### bescom_events.json
```json
[
  {
    "event_id": "BESCOM-EVT-2026-045231",
    "consumer_number": "BLR-IND-2019-78234",
    "consumer_name": "Sri Mahalakshmi Textiles",
    "address": "14, Peenya Industrial Layout, Bangalore",
    "pincode": "560058",
    "event_type": "METER_READ",
    "event_date": "2026-04-25",
    "units_consumed": 1450,
    "bill_amount": 14210,
    "payment_status": "Paid"
  }
]
```

---

## Synthetic Data Generation Script

Location: `scripts/generate_synthetic_data.py`

The script:
1. Generates base business profiles (name, PAN, GSTIN, address)
2. Emits each business record in 1–4 department formats with controlled variations
3. Applies abbreviation/spelling mutations for Category B scenarios
4. Generates event streams for each business
5. Outputs all 4 JSON files to `data/synthetic/`

Run: `python scripts/generate_synthetic_data.py --seed 42 --output data/synthetic/`
