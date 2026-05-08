import re
import unicodedata


_ABBREV_MAP = {
    r"\bpvt\b": "private",
    r"\bp\.?\s*ltd\.?\b": "limited",
    r"\bltd\.?\b": "limited",
    r"\bllp\b": "llp",
    r"\bentp\.?\b": "enterprises",
    r"\bentrp\.?\b": "enterprises",
    r"\bindus\.?\b": "industries",
    r"\bmfg\.?\b": "manufacturing",
    r"\bbros\.?\b": "brothers",
    r"\bco\.?\b": "company",
    r"\bcorp\.?\b": "corporation",
    r"\binte?r?n?\.?\b": "international",
}


def normalize_business_name(name: str) -> str:
    if not name:
        return ""
    text = name.lower().strip()
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^\w\s]", " ", text)
    for pattern, replacement in _ABBREV_MAP.items():
        text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def normalize_pan(pan: str | None) -> str | None:
    if not pan:
        return None
    return re.sub(r"\s+", "", pan.strip().upper())


def normalize_gstin(gstin: str | None) -> str | None:
    if not gstin:
        return None
    return re.sub(r"\s+", "", gstin.strip().upper())


def normalize_pincode(pincode: str | None) -> str | None:
    if not pincode:
        return None
    digits = re.sub(r"\D", "", str(pincode))
    return digits.zfill(6) if len(digits) <= 6 else digits[:6]


def normalize_address(address: str | None) -> str | None:
    if not address:
        return None
    text = address.lower().strip()
    text = re.sub(r"[^\w\s,/-]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text
