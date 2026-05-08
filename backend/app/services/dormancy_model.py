"""Dormancy Prediction Model — wrapper for the trained GradientBoosting classifier."""
from __future__ import annotations
import json
from pathlib import Path
from datetime import date, timedelta

import joblib
import numpy as np

_MODEL_PATH = Path(__file__).parent.parent.parent / "models" / "dormancy_model.pkl"
_META_PATH  = Path(__file__).parent.parent.parent / "models" / "dormancy_model_meta.json"

_pipeline = None
_meta: dict = {}
_loaded = False

TODAY = date.today()
CUT_6M  = TODAY - timedelta(days=180)
CUT_12M = TODAY - timedelta(days=365)


def load_model() -> bool:
    global _pipeline, _meta, _loaded
    if not _MODEL_PATH.exists():
        return False
    try:
        _pipeline = joblib.load(_MODEL_PATH)
        _meta = json.loads(_META_PATH.read_text()) if _META_PATH.exists() else {}
        _loaded = True
        return True
    except Exception as exc:
        print(f"[dormancy_model] WARNING: {exc}")
        return False


def is_loaded() -> bool:
    return _loaded


def get_meta() -> dict:
    return _meta


def predict_dormancy_risk(
    days_since_last_event: float,
    events_last_6m: int,
    events_6_12m: int,
    dept_count: int,
    has_bescom_6m: bool,
    has_inspection_6m: bool,
    confidence_score: float,
) -> dict | None:
    """Return dormancy risk probability + tier."""
    if not _loaded or _pipeline is None:
        return None
    try:
        trend = min(events_last_6m / max(events_6_12m, 1), 5.0)
        feat = np.array([[
            float(min(days_since_last_event, 3650)),
            float(events_last_6m),
            float(events_6_12m),
            float(trend),
            float(dept_count),
            1.0 if has_bescom_6m else 0.0,
            1.0 if has_inspection_6m else 0.0,
            float(confidence_score),
        ]], dtype=np.float32)
        prob = float(_pipeline.predict_proba(feat)[0][1])
        if prob >= 0.70:   tier, color = "HIGH RISK",   "#dc2626"
        elif prob >= 0.40: tier, color = "MEDIUM RISK", "#d97706"
        else:              tier, color = "LOW RISK",    "#16a34a"
        return {"probability": round(prob, 4), "tier": tier, "color": color}
    except Exception:
        return None


load_model()
