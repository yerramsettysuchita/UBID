"""
UBID Entity Resolution — ML Model Wrapper
==========================================
Loads the trained GradientBoosting / LogisticRegression model and provides
a predict_match_proba() function for use in the ER scoring pipeline.

Hybrid approach:
  - PAN / GSTIN exact match → deterministic confidence (rule-based, very high)
  - Name-only probabilistic match → ML model probability
  - Fallback to rule-based weights if model file not found
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import joblib

_MODEL_PATH = Path(__file__).parent.parent.parent / "models" / "er_linkage_model.pkl"
_META_PATH  = Path(__file__).parent.parent.parent / "models" / "er_model_meta.json"

_pipeline = None   # sklearn Pipeline (scaler + classifier)
_meta: dict = {}
_loaded = False


def load_model() -> bool:
    """Load model from disk. Call once at startup. Returns True if successful."""
    global _pipeline, _meta, _loaded
    if not _MODEL_PATH.exists():
        return False
    try:
        _pipeline = joblib.load(_MODEL_PATH)
        _meta = json.loads(_META_PATH.read_text()) if _META_PATH.exists() else {}
        _loaded = True
        return True
    except Exception as exc:
        print(f"[ml_model] WARNING: Failed to load model: {exc}")
        _loaded = False
        return False


def is_loaded() -> bool:
    return _loaded


def get_meta() -> dict:
    return _meta


def predict_match_proba(
    name_score: float,
    address_score: float,
    pan_match: bool,
    gstin_match: bool,
    pincode_match: bool,
) -> float | None:
    """
    Return probability of match (0-1) from the ML model.
    Returns None if model not loaded (caller falls back to rule-based scoring).
    """
    if not _loaded or _pipeline is None:
        return None
    try:
        import numpy as np
        feat = np.array([[
            float(name_score),
            float(address_score),
            1.0 if pan_match else 0.0,
            1.0 if gstin_match else 0.0,
            1.0 if pincode_match else 0.0,
        ]], dtype=np.float32)
        prob = float(_pipeline.predict_proba(feat)[0][1])
        return round(prob, 4)
    except Exception:
        return None


def retrain_model(X, y) -> dict:
    """
    Retrain model in-memory from updated (X, y) arrays and persist.
    Returns new metadata dict.
    """
    from sklearn.ensemble import GradientBoostingClassifier
    from sklearn.linear_model import LogisticRegression
    from sklearn.preprocessing import StandardScaler
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import precision_score, recall_score, f1_score
    from sklearn.pipeline import Pipeline
    import numpy as np

    global _pipeline, _meta, _loaded

    if len(X) < 20:
        raise ValueError("Not enough training data for retraining.")

    X = np.array(X, dtype=np.float32)
    y = np.array(y, dtype=np.int32)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42,
        stratify=y if min(y.sum(), (y==0).sum()) > 5 else None
    )

    pipe = Pipeline([
        ("scaler", StandardScaler()),
        ("clf", GradientBoostingClassifier(n_estimators=100, max_depth=3, random_state=42)),
    ])
    pipe.fit(X_train, y_train)
    y_pred = pipe.predict(X_test)

    prec = round(float(precision_score(y_test, y_pred, zero_division=0)), 4)
    rec  = round(float(recall_score(y_test, y_pred, zero_division=0)), 4)
    f1   = round(float(f1_score(y_test, y_pred, zero_division=0)), 4)

    clf = pipe.named_steps["clf"]
    imp = dict(zip(
        ["name_score","address_score","pan_match","gstin_match","pincode_match"],
        [round(float(v), 4) for v in clf.feature_importances_]
    ))

    new_meta = {
        "model_type":          "GradientBoosting",
        "training_samples":    len(X),
        "positive_samples":    int(y.sum()),
        "negative_samples":    int((y == 0).sum()),
        "test_size":           len(X_test),
        "precision":           prec,
        "recall":              rec,
        "f1_score":            f1,
        "feature_names":       list(imp.keys()),
        "feature_importances": imp,
    }

    _MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipe, _MODEL_PATH)
    _META_PATH.write_text(json.dumps(new_meta, indent=2))

    _pipeline = pipe
    _meta = new_meta
    _loaded = True

    return new_meta


# Load model at import time
load_model()
