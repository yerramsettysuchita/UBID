"""
Entity resolution service.

Blocking strategy: (pincode_prefix_3, name_prefix_3) + (pan, *) + (gstin_prefix_8, *)
Scoring: Jaro-Winkler name + token address overlap + exact PAN/GSTIN match
Decision: >= 0.85 auto-link | 0.50-0.85 review queue | < 0.50 separate
"""
import uuid
from dataclasses import dataclass

import jellyfish


@dataclass
class CandidatePair:
    record_a_id: str
    record_b_id: str
    name_score: float
    address_score: float
    pan_match: bool
    gstin_match: bool
    confidence: float


def jaro_winkler_score(a: str | None, b: str | None) -> float:
    if not a or not b:
        return 0.0
    return jellyfish.jaro_winkler_similarity(a, b)


def token_overlap_score(a: str | None, b: str | None) -> float:
    if not a or not b:
        return 0.0
    tokens_a = set(a.lower().split())
    tokens_b = set(b.lower().split())
    if not tokens_a or not tokens_b:
        return 0.0
    intersection = tokens_a & tokens_b
    return len(intersection) / max(len(tokens_a), len(tokens_b))


def compute_confidence(
    name_score: float,
    address_score: float,
    pan_match: bool,
    gstin_match: bool,
) -> float:
    # Weight matrix (empirically tuned; retraining adjusts these)
    # PAN/GSTIN exact match dominates
    if pan_match or gstin_match:
        base = 0.75
    else:
        base = 0.0

    weighted = (
        base
        + 0.30 * name_score
        + 0.15 * address_score
        + 0.25 * float(pan_match)
        + 0.25 * float(gstin_match)
    )
    return min(1.0, round(weighted, 3))


def score_pair(record_a: dict, record_b: dict) -> CandidatePair:
    name_score = jaro_winkler_score(
        record_a.get("normalized_name"), record_b.get("normalized_name")
    )
    address_score = token_overlap_score(
        record_a.get("normalized_address"), record_b.get("normalized_address")
    )
    pan_match = bool(
        record_a.get("pan")
        and record_b.get("pan")
        and record_a["pan"] == record_b["pan"]
    )
    gstin_match = bool(
        record_a.get("gstin")
        and record_b.get("gstin")
        and record_a["gstin"] == record_b["gstin"]
    )

    confidence = compute_confidence(name_score, address_score, pan_match, gstin_match)

    return CandidatePair(
        record_a_id=record_a["id"],
        record_b_id=record_b["id"],
        name_score=name_score,
        address_score=address_score,
        pan_match=pan_match,
        gstin_match=gstin_match,
        confidence=confidence,
    )


def generate_ubid(pan: str | None, gstin: str | None) -> str:
    if pan:
        return f"UBID-PAN-{pan}"
    if gstin:
        return f"UBID-GST-{gstin[:10]}"
    return f"UBID-{str(uuid.uuid4())[:8].upper()}"


AUTO_LINK_THRESHOLD = 0.85
REVIEW_THRESHOLD = 0.50
