"""Generate synthetic data for 6 new Karnataka government departments."""
import json
import random
from pathlib import Path
from datetime import date, timedelta

random.seed(42)

DATA_DIR = Path(r"c:\Users\DELL\Downloads\AI for Bharat\ubid-platform\data\synthetic")

shops = json.loads((DATA_DIR / "shops_establishments.json").read_text())
real_businesses = [
    {
        "name": s["business_name"],
        "pan": s.get("pan", ""),
        "gstin": s.get("gstin", ""),
        "address": s["address"],
        "pincode": s["pincode"],
        "district": s["district"],
        "owner": s.get("owner_name", ""),
    }
    for s in shops[:300]
]

DISTRICTS = [
    "Bengaluru Urban", "Mysuru", "Tumakuru", "Belagavi", "Dharwad",
    "Mangaluru", "Ballari", "Kalaburagi", "Shivamogga", "Hubballi",
    "Davangere", "Bidar", "Raichur", "Vijayapura", "Chikkamagaluru",
]
PINCODES = ["560001", "560025", "560058", "570001", "572101", "580001",
            "590001", "577001", "585101", "586101", "583101", "577501"]


def rand_date(start="2019-01-01", end="2026-01-01"):
    s = date.fromisoformat(start)
    e = date.fromisoformat(end)
    return str(s + timedelta(days=random.randint(0, (e - s).days)))


def rand_pan():
    alpha = "ABCDEFGHJKLMNPQRSTUVWXYZ"
    return "".join(random.choices(alpha, k=5)) + str(random.randint(1000, 9999)) + random.choice(alpha)


def rand_mobile():
    return f"9{random.randint(100000000, 999999999)}"


def pick(lst):
    return random.choice(lst)


# ── 1. BBMP ─────────────────────────────────────────────────────────────────
bbmp = []
for b in random.sample(real_businesses, 80):
    bbmp.append({
        "record_id": f"BBMP-{random.randint(100000, 999999)}",
        "establishment_name": b["name"],
        "owner_name": b["owner"],
        "ward_number": random.randint(1, 198),
        "license_number": f"BBMP/LIC/{random.randint(2019,2024)}/{random.randint(10000,99999)}",
        "license_type": pick(["Commercial", "Industrial", "Retail", "Wholesale", "Service"]),
        "issue_date": rand_date("2019-01-01", "2024-06-01"),
        "valid_until": rand_date("2025-01-01", "2027-12-31"),
        "address": b["address"],
        "pincode": b["pincode"],
        "district": "Bengaluru Urban",
        "pan": b["pan"],
        "gstin": b["gstin"],
        "status": pick(["Active", "Active", "Active", "Expired", "Suspended"]),
        "trade_category": pick(["Food", "Textile", "Electronics", "Auto Parts", "Chemicals", "General"]),
    })
for i in range(120):
    pin = pick(["560001", "560025", "560058", "560029", "560076"])
    bbmp.append({
        "record_id": f"BBMP-{random.randint(100000, 999999)}",
        "establishment_name": pick(["Sri ", "Shree ", "Karnataka ", "New "]) + pick(["Traders", "Enterprises", "Industries", "Works"]),
        "owner_name": pick(["Rajan K", "Suresh M", "Priya N", "Anand R", "Kavitha S"]),
        "ward_number": random.randint(1, 198),
        "license_number": f"BBMP/LIC/{random.randint(2019,2024)}/{random.randint(10000,99999)}",
        "license_type": pick(["Commercial", "Retail", "Service"]),
        "issue_date": rand_date("2019-01-01", "2024-06-01"),
        "valid_until": rand_date("2025-01-01", "2027-12-31"),
        "address": f"No.{random.randint(1,500)}, {pick(['MG Road','Brigade Road','Jayanagar','Koramangala','Whitefield'])}, Bengaluru - {pin}",
        "pincode": pin,
        "district": "Bengaluru Urban",
        "pan": rand_pan(),
        "gstin": "",
        "status": pick(["Active", "Active", "Active", "Dormant"]),
        "trade_category": pick(["Food", "Textile", "Electronics", "Auto Parts", "General"]),
    })
(DATA_DIR / "bbmp.json").write_text(json.dumps(bbmp, indent=2))
print(f"BBMP: {len(bbmp)} records")

# ── 2. PROFESSIONAL TAX ──────────────────────────────────────────────────────
pt = []
for b in random.sample(real_businesses, 100):
    pt.append({
        "record_id": f"PT-{random.randint(100000, 999999)}",
        "business_name": b["name"],
        "proprietor_name": b["owner"],
        "pt_enrolment_number": f"PT/ENR/{random.randint(2015,2024)}/{random.randint(100000,999999)}",
        "enrolment_date": rand_date("2015-01-01", "2024-01-01"),
        "employee_count": random.randint(1, 500),
        "monthly_pt_amount": pick([200, 500, 1000, 2500]),
        "address": b["address"],
        "pincode": b["pincode"],
        "district": b["district"],
        "pan": b["pan"],
        "gstin": b["gstin"],
        "status": pick(["Active", "Active", "Active", "Defaulter"]),
        "last_payment_date": rand_date("2025-01-01", "2026-04-01"),
    })
for i in range(80):
    dist = pick(DISTRICTS)
    pin = pick(PINCODES)
    pt.append({
        "record_id": f"PT-{random.randint(100000, 999999)}",
        "business_name": pick(["Global ", "National ", "KS ", "BM "]) + pick(["Solutions", "Corp", "Ltd", "Associates"]),
        "proprietor_name": pick(["M Krishnaswamy", "B Nagaraj", "S Venkatesh", "R Patel"]),
        "pt_enrolment_number": f"PT/ENR/{random.randint(2015,2024)}/{random.randint(100000,999999)}",
        "enrolment_date": rand_date("2015-01-01", "2024-01-01"),
        "employee_count": random.randint(1, 200),
        "monthly_pt_amount": pick([200, 500, 1000]),
        "address": f"No.{random.randint(1,300)}, {dist} - {pin}",
        "pincode": pin,
        "district": dist,
        "pan": rand_pan(),
        "gstin": "",
        "status": pick(["Active", "Active", "Defaulter"]),
        "last_payment_date": rand_date("2024-01-01", "2026-03-01"),
    })
(DATA_DIR / "professional_tax.json").write_text(json.dumps(pt, indent=2))
print(f"Professional Tax: {len(pt)} records")

# ── 3. HESCOM ────────────────────────────────────────────────────────────────
hescom = []
for i in range(160):
    dist = pick(["Dharwad", "Gadag", "Haveri", "Uttara Kannada", "Belagavi"])
    pin = pick(["580001", "580003", "582101", "581301", "590001"])
    b = pick(real_businesses[:100]) if i < 50 else None
    hescom.append({
        "event_id": f"HESC-{random.randint(1000000, 9999999)}",
        "consumer_number": f"HESCOM/{random.randint(100000, 999999)}",
        "consumer_name": b["name"] if b else pick(["Hubli Steel", "Dharwad Textiles", "Gadag Agro"]) + f" {i}",
        "address": b["address"] if b else f"No.{random.randint(1,200)}, {dist} - {pin}",
        "pincode": b["pincode"] if b else pin,
        "district": dist,
        "pan": b["pan"] if b else "",
        "event_type": pick(["METER_READ", "PAYMENT", "DISCONNECTION", "RECONNECTION", "NEW_CONNECTION"]),
        "event_date": rand_date("2024-01-01", "2026-05-01"),
        "units_consumed": random.randint(0, 50000),
        "bill_amount": random.randint(0, 500000),
        "connection_type": pick(["Commercial", "Industrial", "Domestic"]),
    })
(DATA_DIR / "hescom.json").write_text(json.dumps(hescom, indent=2))
print(f"HESCOM: {len(hescom)} records")

# ── 4. LABOUR DEPT ───────────────────────────────────────────────────────────
labour = []
for b in random.sample(real_businesses, 70):
    labour.append({
        "record_id": f"LAB-{random.randint(100000, 999999)}",
        "establishment_name": b["name"],
        "principal_employer": b["owner"],
        "registration_number": f"LAB/REG/{random.randint(2018,2024)}/{random.randint(10000,99999)}",
        "registration_date": rand_date("2018-01-01", "2024-01-01"),
        "max_workmen": random.randint(10, 500),
        "nature_of_work": pick(["Manufacturing", "Construction", "Maintenance", "Security", "IT Services"]),
        "address": b["address"],
        "pincode": b["pincode"],
        "district": b["district"],
        "pan": b["pan"],
        "mobile": rand_mobile(),
        "status": pick(["Active", "Active", "Active", "Cancelled"]),
        "last_renewal_date": rand_date("2023-01-01", "2026-01-01"),
    })
for i in range(60):
    dist = pick(DISTRICTS)
    pin = pick(PINCODES)
    labour.append({
        "record_id": f"LAB-{random.randint(100000, 999999)}",
        "establishment_name": pick(["Security Services", "Facility Mgmt", "Tech Support"]) + f" {i}",
        "principal_employer": pick(["K Reddy", "N Sharma", "S Rao"]),
        "registration_number": f"LAB/REG/{random.randint(2018,2024)}/{random.randint(10000,99999)}",
        "registration_date": rand_date("2018-01-01", "2024-01-01"),
        "max_workmen": random.randint(5, 100),
        "nature_of_work": pick(["Security", "Cleaning", "Construction"]),
        "address": f"No.{random.randint(1,400)}, {dist} - {pin}",
        "pincode": pin,
        "district": dist,
        "pan": "",
        "mobile": rand_mobile(),
        "status": pick(["Active", "Cancelled"]),
        "last_renewal_date": rand_date("2023-01-01", "2025-12-01"),
    })
(DATA_DIR / "labour_dept.json").write_text(json.dumps(labour, indent=2))
print(f"Labour Dept: {len(labour)} records")

# ── 5. FOOD SAFETY (FSSAI) ───────────────────────────────────────────────────
food = []
for b in random.sample(real_businesses, 60):
    food.append({
        "record_id": f"FSSAI-{random.randint(10000000000000, 99999999999999)}",
        "fbo_name": b["name"],
        "proprietor": b["owner"],
        "license_number": f"11{random.randint(100000000000, 999999999999)}",
        "license_type": pick(["Central License", "State License", "Registration"]),
        "category": pick(["Manufacturer", "Retailer", "Distributor", "Restaurant", "Catering"]),
        "issue_date": rand_date("2019-01-01", "2024-01-01"),
        "expiry_date": rand_date("2025-01-01", "2028-01-01"),
        "address": b["address"],
        "pincode": b["pincode"],
        "district": b["district"],
        "pan": b["pan"],
        "mobile": rand_mobile(),
        "status": pick(["Active", "Active", "Active", "Suspended", "Expired"]),
        "last_inspection_date": rand_date("2024-01-01", "2026-04-01"),
        "inspection_grade": pick(["A", "A", "B", "B", "C"]),
    })
for i in range(80):
    dist = pick(DISTRICTS)
    pin = pick(PINCODES)
    food.append({
        "record_id": f"FSSAI-{random.randint(10000000000000, 99999999999999)}",
        "fbo_name": pick(["Fresh ", "Pure ", "Golden ", "Green "]) + pick(["Foods", "Bakery", "Kitchen", "Dairy"]) + f" {i}",
        "proprietor": pick(["P Gowda", "M Naik", "S Hegde", "R Pai"]),
        "license_number": f"11{random.randint(100000000000, 999999999999)}",
        "license_type": "State License",
        "category": pick(["Restaurant", "Retailer", "Manufacturer"]),
        "issue_date": rand_date("2019-01-01", "2024-01-01"),
        "expiry_date": rand_date("2025-01-01", "2028-01-01"),
        "address": f"No.{random.randint(1,300)}, {dist} - {pin}",
        "pincode": pin,
        "district": dist,
        "pan": "",
        "mobile": rand_mobile(),
        "status": pick(["Active", "Active", "Expired"]),
        "last_inspection_date": rand_date("2024-01-01", "2026-04-01"),
        "inspection_grade": pick(["A", "B", "C"]),
    })
(DATA_DIR / "food_safety.json").write_text(json.dumps(food, indent=2))
print(f"Food Safety: {len(food)} records")

# ── 6. MSME — Udyam Registration ────────────────────────────────────────────
msme = []
for b in random.sample(real_businesses, 90):
    msme.append({
        "record_id": f"MSME-{random.randint(100000, 999999)}",
        "udyam_number": f"UDYAM-KA-{random.randint(10,99)}-{random.randint(1000000,9999999)}",
        "enterprise_name": b["name"],
        "owner_name": b["owner"],
        "category": pick(["Micro", "Small", "Medium"]),
        "major_activity": pick(["Manufacturing", "Services", "Trading"]),
        "investment_plant": random.randint(100000, 50000000),
        "turnover": random.randint(500000, 250000000),
        "registration_date": rand_date("2020-07-01", "2025-01-01"),
        "address": b["address"],
        "pincode": b["pincode"],
        "district": b["district"],
        "pan": b["pan"],
        "gstin": b["gstin"],
        "mobile": rand_mobile(),
        "status": pick(["Active", "Active", "Active", "Cancelled"]),
    })
for i in range(80):
    dist = pick(DISTRICTS)
    pin = pick(PINCODES)
    msme.append({
        "record_id": f"MSME-{random.randint(100000, 999999)}",
        "udyam_number": f"UDYAM-KA-{random.randint(10,99)}-{random.randint(1000000,9999999)}",
        "enterprise_name": pick(["Precision ", "Advanced ", "Karnataka ", "Classic "]) + pick(["Tech", "Fabricators", "Plastics", "Garments"]),
        "owner_name": pick(["B Lingaiah", "K Murthy", "S Patil", "R Nair"]),
        "category": pick(["Micro", "Small"]),
        "major_activity": pick(["Manufacturing", "Services"]),
        "investment_plant": random.randint(100000, 10000000),
        "turnover": random.randint(500000, 50000000),
        "registration_date": rand_date("2020-07-01", "2025-01-01"),
        "address": f"No.{random.randint(1,500)}, Industrial Area, {dist} - {pin}",
        "pincode": pin,
        "district": dist,
        "pan": rand_pan(),
        "gstin": "",
        "mobile": rand_mobile(),
        "status": pick(["Active", "Active", "Active"]),
    })
(DATA_DIR / "msme.json").write_text(json.dumps(msme, indent=2))
print(f"MSME: {len(msme)} records")

print("\nAll 6 department files generated successfully!")
