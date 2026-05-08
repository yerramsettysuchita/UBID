"""Insert 6 new Karnataka departments directly into the database."""
import uuid
import psycopg2
import json
from pathlib import Path

DATA_DIR = r"c:\Users\DELL\Downloads\AI for Bharat\ubid-platform\data\synthetic"

CONN_STR = "postgresql://ubid:ubid123@localhost:5432/ubid_db"

NEW_DEPTS = [
    {
        "code": "BBMP",
        "name": "Bruhat Bengaluru Mahanagara Palike",
        "file": "bbmp.json",
        "name_field": "establishment_name",
    },
    {
        "code": "PROF_TAX",
        "name": "Professional Tax Department Karnataka",
        "file": "professional_tax.json",
        "name_field": "business_name",
    },
    {
        "code": "HESCOM",
        "name": "HESCOM Electricity Consumer Records",
        "file": "hescom.json",
        "name_field": "consumer_name",
    },
    {
        "code": "LABOUR",
        "name": "Labour Department Karnataka",
        "file": "labour_dept.json",
        "name_field": "establishment_name",
    },
    {
        "code": "FOOD_SAFETY",
        "name": "Food Safety and Standards Authority",
        "file": "food_safety.json",
        "name_field": "fbo_name",
    },
    {
        "code": "MSME",
        "name": "MSME Udyam Registration",
        "file": "msme.json",
        "name_field": "enterprise_name",
    },
]

conn = psycopg2.connect(CONN_STR)
cur = conn.cursor()

# Check existing dept codes
cur.execute("SELECT code FROM departments")
existing = {r[0] for r in cur.fetchall()}
print(f"Existing: {existing}")

inserted = 0
for d in NEW_DEPTS:
    if d["code"] in existing:
        print(f"  SKIP {d['code']} (already exists)")
        continue

    file_path = str(Path(DATA_DIR) / d["file"])
    adapter_config = json.dumps({
        "path": file_path,
        "name_field": d["name_field"],
        "address_field": "address",
        "pan_field": "pan",
        "gstin_field": "gstin",
        "pincode_field": "pincode",
    })

    dept_id = str(uuid.uuid4())
    cur.execute(
        """
        INSERT INTO departments (id, code, name, is_active, adapter_config, created_at, updated_at)
        VALUES (%s, %s, %s, true, %s::jsonb, NOW(), NOW())
        """,
        (dept_id, d["code"], d["name"], adapter_config),
    )
    print(f"  INSERTED {d['code']} — {d['name']}")
    inserted += 1

conn.commit()
cur.close()
conn.close()

print(f"\nDone. {inserted} new departments added.")
