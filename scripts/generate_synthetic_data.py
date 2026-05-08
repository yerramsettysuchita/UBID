"""
UBID Platform — Synthetic Data Generator v2
Generates 1500+ realistic Karnataka business records concentrated in 15 pincodes
so pincode intelligence pages show rich data.

Usage: python scripts/generate_synthetic_data.py
"""
import json, random, uuid
from datetime import date, timedelta
from pathlib import Path

SEED = 99
rng  = random.Random(SEED)

# ── 15 focused pincodes (30-60 businesses each for rich pincode intel) ────────
PINCODES = {
    "560001": "Bengaluru Urban",
    "560002": "Bengaluru Urban",
    "560010": "Bengaluru Urban",
    "560025": "Bengaluru Urban",
    "560058": "Bengaluru Urban",
    "570001": "Mysuru",
    "570020": "Mysuru",
    "575001": "Mangaluru",
    "575010": "Mangaluru",
    "580001": "Hubli-Dharwad",
    "580020": "Hubli-Dharwad",
    "590001": "Belagavi",
    "572101": "Tumakuru",
    "585101": "Kalaburagi",
    "585105": "Kalaburagi",
}
PINCODE_LIST = list(PINCODES.keys())

# ── Business name components ───────────────────────────────────────────────────
PREFIXES = [
    "Sri","Shri","Sree","Karnataka","Cauvery","Nandi","Deccan","Tunga",
    "Sharavathi","Mahanadi","Kaveri","Godavari","Mysore","Bangalore",
    "South India","Indian","National","Royal","Golden","New",
]
INDUSTRY = [
    "Textiles","Steel","Granites","Auto Parts","Chemicals","Pharma",
    "Engineering","Cold Storage","Food Processing","Packaging","Plastics",
    "Electronics","Hotels","Restaurants","Clinics","Pharmacies","Traders",
    "Exporters","Importers","Agencies","Solutions","Services","Builders",
    "Constructions","Fabricators","Industries","Enterprises","Associates",
]
SUFFIXES = [
    "Pvt Ltd","Private Limited","Limited","Enterprises","Works",
    "Industries","LLP","& Co","Trading","Group","Corporation",
]
ABBREVS = {
    "Private Limited": ["Pvt Ltd","P Ltd","Pvt. Ltd."],
    "Limited":         ["Ltd","Ltd."],
    "Industries":      ["Indus","Ind."],
    "Enterprises":     ["Entp","Entrp.","Enterp"],
    "Engineering":     ["Engg","Eng."],
}
OWNERS_F = ["Ramaiah","Suresh","Priya","Anand","Kavitha","Mahesh","Vasantha",
            "Geetha","Ravi","Shankar","Lakshmi","Narayan","Kumari","Sridhar",
            "Manjunath","Deepa","Vinod","Rekha","Prakash","Sunita","Harish"]
OWNERS_L = ["K","S","Gowda","Reddy","Sharma","Rao","Naidu","Hegde","Nair",
            "Pillai","Kumar","Shetty","Kamath","Patil","Kulkarni","Joshi"]

TODAY = date.today()


def pick_pincode() -> tuple[str,str]:
    pc = rng.choice(PINCODE_LIST)
    return pc, PINCODES[pc]


def make_name() -> str:
    return f"{rng.choice(PREFIXES)} {rng.choice(INDUSTRY)} {rng.choice(SUFFIXES)}"


def abbreviate(name: str) -> str:
    for full, variants in ABBREVS.items():
        if full in name:
            return name.replace(full, rng.choice(variants), 1)
    # Also randomly change word order slightly
    parts = name.split()
    if len(parts) >= 3 and rng.random() > 0.6:
        parts[0], parts[1] = parts[1], parts[0]
    return " ".join(parts)


def make_pan() -> str:
    alpha = "ABCDEFGHJKLMNPQRSTUVWXYZ"
    return "".join(rng.choices(alpha,k=5)) + "".join(rng.choices("0123456789",k=4)) + rng.choice(alpha)


def make_gstin(pan: str) -> str:
    return f"29{pan}1Z{rng.choice('ABCDEFGHXYZ')}"


def rand_date(start: date, end: date) -> str:
    delta = max((end - start).days, 1)
    return (start + timedelta(days=rng.randint(0, delta))).isoformat()


def make_owner() -> str:
    return f"{rng.choice(OWNERS_F)} {rng.choice(OWNERS_L)}."


def make_address(district: str, pincode: str) -> str:
    no   = rng.randint(1, 500)
    area = rng.choice(["Industrial Area","Industrial Estate","KIADB Area",
                        "Phase 1","Phase 2","KSSIDC Layout","Main Road",
                        "Nagar","Extension","Cross"])
    return f"No.{no}, {area}, {district} - {pincode}"


# ── Business entity ────────────────────────────────────────────────────────────
class Business:
    def __init__(self, scenario: str = "active"):
        self.scenario   = scenario
        self.base_name  = make_name()
        self.pan        = make_pan() if rng.random() > 0.12 else None
        self.gstin      = make_gstin(self.pan) if self.pan and rng.random() > 0.25 else None
        self.pincode, self.district = pick_pincode()
        self.owner      = make_owner()
        self.reg_year   = rng.randint(2010, 2023)

    def shops_status(self) -> str:
        return {"active":"Active","dormant":"Active","closed":"Cancelled"}.get(self.scenario,"Active")

    def reg_status_str(self) -> str:
        return "Compliant" if self.scenario == "active" else "Expired"

    def last_event_date(self) -> str:
        if self.scenario == "closed":
            return rand_date(date(2019,1,1), date(2022,6,1))
        if self.scenario == "dormant":
            return rand_date(date(2022,7,1), date(2023,12,31))
        return rand_date(date(2024,6,1), TODAY)

    def insp_date(self) -> str:
        return self.last_event_date()


# ── Department emitters ────────────────────────────────────────────────────────
def _uid(prefix: str) -> str:
    return f"{prefix}-{rng.randint(10000,999999)}"


def emit_shops(b: Business, variant: bool = False) -> dict:
    name = abbreviate(b.base_name) if variant else b.base_name
    return {
        "record_id":            _uid("SE"),
        "business_name":        name,
        "owner_name":           b.owner,
        "registration_number":  f"S&E/{b.district[:3].upper()}/{b.reg_year}/{rng.randint(1000,99999)}",
        "registration_date":    rand_date(date(b.reg_year,1,1), date(b.reg_year,12,31)),
        "registration_status":  b.shops_status(),
        "renewal_date":         rand_date(date(2025,1,1), date(2027,12,31)) if b.shops_status()=="Active" else None,
        "address":              make_address(b.district, b.pincode),
        "pincode":              b.pincode,
        "district":             b.district,
        "pan":                  b.pan,
        "gstin":                b.gstin,
        "employee_count":       rng.randint(3, 500),
        "nature_of_business":   rng.choice(["Manufacturing","Trading","Services","Retail","Wholesale"]),
        "last_inspection_date": b.insp_date(),
    }


def emit_factory(b: Business, variant: bool = False) -> dict | None:
    if rng.random() > 0.52:
        return None
    name = abbreviate(b.base_name) if variant else b.base_name
    return {
        "record_id":              _uid("FACT"),
        "factory_name":           name,
        "factory_license_number": f"KA/{b.district[:3].upper()}/F/{b.reg_year}/{rng.randint(100,9999)}",
        "license_valid_until":    rand_date(date(2025,1,1), date(2028,12,31)),
        "owner_name":             b.owner,
        "address":                make_address(b.district, b.pincode),
        "pincode":                b.pincode,
        "district":               b.district,
        "pan":                    b.pan,
        "gstin":                  None,
        "nature_of_activity":     "Manufacturing",
        "worker_count":           rng.randint(10, 400),
        "last_inspection_date":   b.insp_date(),
        "inspection_result":      rng.choice(["Satisfactory","Minor deficiencies","Compliant","Pending"]),
    }


def emit_kspcb(b: Business, variant: bool = False) -> dict | None:
    if rng.random() > 0.42:
        return None
    name = abbreviate(b.base_name) if variant else b.base_name
    return {
        "record_id":           _uid("KSPCB"),
        "unit_name":           name,
        "consent_number":      f"KSPCB/{b.district[:3].upper()}/CTO/{b.reg_year}/{rng.randint(1000,99999)}",
        "consent_valid_until": rand_date(date(2024,1,1), date(2028,12,31)),
        "address":             make_address(b.district, b.pincode),
        "pincode":             b.pincode,
        "district":            b.district,
        "pan":                 None,
        "gstin":               b.gstin,
        "category":            rng.choice(["Green","Orange","Red"]),
        "industry_type":       "Manufacturing",
        "last_renewal_date":   b.last_event_date(),
        "compliance_status":   b.reg_status_str(),
    }


def emit_bescom(b: Business) -> list[dict]:
    counts = {"active": rng.randint(10,18), "dormant": rng.randint(3,8), "closed": rng.randint(1,3)}
    n      = counts[b.scenario]
    offset = {"active": -180, "dormant": -730, "closed": -1460}[b.scenario]
    start  = TODAY + timedelta(days=offset)
    consumer = _uid("CONS")
    events = []
    for i in range(n):
        ev = start + timedelta(days=30*i)
        if ev > TODAY:
            break
        events.append({
            "event_id":        _uid("BESCOM"),
            "consumer_number": consumer,
            "consumer_name":   b.base_name[:40],
            "address":         make_address(b.district, b.pincode),
            "pincode":         b.pincode,
            "pan":             b.pan,
            "event_type":      "METER_READ",
            "event_date":      ev.isoformat(),
            "units_consumed":  rng.randint(50, 8000),
            "bill_amount":     rng.randint(500, 80000),
            "payment_status":  rng.choice(["Paid","Paid","Paid","Pending"]),
        })
    if b.scenario == "closed" and events:
        events.append({
            "event_id":        _uid("BESCOM"),
            "consumer_number": consumer,
            "consumer_name":   b.base_name[:40],
            "address":         make_address(b.district, b.pincode),
            "pincode":         b.pincode,
            "pan":             b.pan,
            "event_type":      "CLOSURE",
            "event_date":      (TODAY + timedelta(days=offset+30*(n+1))).isoformat(),
            "units_consumed":  0, "bill_amount": 0, "payment_status": "N/A",
        })
    return events


# ── Main generator ─────────────────────────────────────────────────────────────
def generate():
    out = Path("data/synthetic")
    out.mkdir(parents=True, exist_ok=True)

    shops_all, fact_all, kspcb_all, bescom_all = [], [], [], []

    def add(b: Business, name_var: bool = False):
        shops_all.append(emit_shops(b, variant=name_var))
        f = emit_factory(b, variant=name_var)
        if f: fact_all.append(f)
        k = emit_kspcb(b, variant=name_var)
        if k: kspcb_all.append(k)
        bescom_all.extend(emit_bescom(b))

    # Scenario A: 200 clean active businesses across all depts
    for b in [Business("active") for _ in range(200)]:
        add(b)

    # Scenario B: 80 name-variant pairs (same biz, different spelling — ER challenge)
    for _ in range(80):
        b = Business("active")
        add(b, name_var=False)
        # second record with abbreviation in another dept
        b2 = Business("active")
        b2.pan, b2.gstin, b2.pincode, b2.district, b2.owner = b.pan, b.gstin, b.pincode, b.district, b.owner
        b2.base_name = abbreviate(b.base_name)
        shops_all.append(emit_shops(b2, variant=True))

    # Scenario C: 60 dormant businesses
    for b in [Business("dormant") for _ in range(60)]:
        add(b)

    # Scenario D: 40 closed businesses
    for b in [Business("closed") for _ in range(40)]:
        shops_all.append(emit_shops(b))
        bescom_all.extend(emit_bescom(b))

    # Scenario E: 30 no-PAN/GSTIN businesses (identifier-less)
    for _ in range(30):
        b = Business("active")
        b.pan, b.gstin = None, None
        add(b)

    # Scenario F: 15 multi-branch (same PAN, diff pincodes — tests ER)
    for _ in range(15):
        b = Business("active")
        for _ in range(rng.randint(2, 4)):
            br = Business("active")
            br.pan, br.gstin, br.owner = b.pan, b.gstin, b.owner
            br.base_name = b.base_name
            shops_all.append(emit_shops(br))
            fact_all.append(emit_factory(br) or emit_factory(br) or emit_factory(br))
            bescom_all.extend(emit_bescom(br))

    # Clean None from factories list
    fact_all = [f for f in fact_all if f is not None]

    # ── Deduplicate by primary key ─────────────────────────────────────────────
    def dedup(records: list[dict], key: str) -> list[dict]:
        seen, out = set(), []
        for r in records:
            if r[key] not in seen:
                seen.add(r[key])
                out.append(r)
        return out

    shops_all  = dedup(shops_all,  "record_id")
    fact_all   = dedup(fact_all,   "record_id")
    kspcb_all  = dedup(kspcb_all,  "record_id")
    bescom_all = dedup(bescom_all, "event_id")

    # ── Write ──────────────────────────────────────────────────────────────────
    files = [
        ("shops_establishments.json", shops_all),
        ("factories.json",            fact_all),
        ("kspcb.json",                kspcb_all),
        ("bescom_events.json",        bescom_all),
    ]
    for fname, records in files:
        (out / fname).write_text(
            json.dumps(records, indent=2, default=str), encoding="utf-8"
        )
        print(f"  {fname:<36} {len(records):>5} records")

    total = sum(len(r) for _, r in files)
    print(f"\n  Total source records: {total}")
    print(f"  Pincodes in use: {len(set(r.get('pincode','') for r in shops_all))}")


if __name__ == "__main__":
    generate()
