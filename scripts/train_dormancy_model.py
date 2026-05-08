"""
UBID Platform — Dormancy Prediction Model
==========================================
Trains a second ML model that predicts which ACTIVE businesses
are at risk of going DORMANT based on activity patterns.

Features (8):
  days_since_last_event     — Recency signal
  events_last_6m            — Recent activity frequency
  events_6_12m              — Older activity frequency
  trend_ratio               — recent/older ratio (< 1 = declining)
  dept_count                — Department breadth
  has_bescom_6m             — BESCOM still active? (operational signal)
  has_inspection_6m         — Recent government inspection?
  confidence_score          — Entity resolution confidence

Labels:
  1 = DORMANT or CLOSED (went inactive)
  0 = ACTIVE with recent events (healthy)

Usage:
  python scripts/train_dormancy_model.py
"""
import asyncio, sys, json
from pathlib import Path
from datetime import date, timedelta

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

import numpy as np
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.metrics import (
    classification_report, precision_score, recall_score, f1_score,
    roc_auc_score, precision_recall_curve, average_precision_score,
)
from sklearn.calibration import calibration_curve, CalibratedClassifierCV
from sklearn.pipeline import Pipeline
import joblib

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import select, func
from app.core.config import settings
from app.models.entities import BusinessEntity, BusinessEvent
from app.models.base import BusinessStatus

FEATURE_NAMES = [
    "days_since_last_event", "events_last_6m", "events_6_12m",
    "trend_ratio", "dept_count", "has_bescom_6m",
    "has_inspection_6m", "confidence_score",
]

MODEL_PATH = Path(__file__).parent.parent / "backend" / "models" / "dormancy_model.pkl"
META_PATH  = Path(__file__).parent.parent / "backend" / "models" / "dormancy_model_meta.json"

TODAY = date.today()
CUT_6M  = TODAY - timedelta(days=180)
CUT_12M = TODAY - timedelta(days=365)


async def extract_features(db: AsyncSession):
    X, y, ubids = [], [], []

    entities = (await db.execute(
        select(BusinessEntity).where(BusinessEntity.is_active == True)
    )).scalars().all()

    print(f"  Entities: {len(entities)}")

    # Load all events at once
    events_r = await db.execute(
        select(BusinessEvent.business_entity_id, BusinessEvent.event_date,
               BusinessEvent.department_code, BusinessEvent.event_type)
        .where(BusinessEvent.business_entity_id.isnot(None))
    )
    entity_events: dict = {}
    for eid, edate, dept, etype in events_r:
        entity_events.setdefault(str(eid), []).append((edate, dept, str(etype)))

    for e in entities:
        eid = str(e.id)
        evs = entity_events.get(eid, [])

        # Feature extraction
        dates = [d for d, _, _ in evs if d]
        if dates:
            latest = max(dates)
            days_since = (TODAY - latest).days
        else:
            days_since = 9999

        evs_6m  = sum(1 for d, _, _ in evs if d and d >= CUT_6M)
        evs_12m = sum(1 for d, _, _ in evs if d and CUT_12M <= d < CUT_6M)
        trend   = (evs_6m / max(evs_12m, 1))
        trend_r = min(trend, 5.0)  # cap at 5x

        has_bescom_6m   = any(dept == "BESCOM" and d and d >= CUT_6M for d, dept, _ in evs)
        has_inspect_6m  = any(etype == "EventType.INSPECTION" and d and d >= CUT_6M for d, _, etype in evs)

        features = [
            float(min(days_since, 3650)),
            float(evs_6m),
            float(evs_12m),
            float(trend_r),
            float(e.dept_count or 1),
            1.0 if has_bescom_6m else 0.0,
            1.0 if has_inspect_6m else 0.0,
            float(e.confidence_score or 0),
        ]

        label = 1 if e.status in (BusinessStatus.DORMANT, BusinessStatus.CLOSED) else 0

        X.append(features)
        y.append(label)
        ubids.append(e.ubid)

    return np.array(X, dtype=np.float32), np.array(y, dtype=np.int32), ubids


def train(X: np.ndarray, y: np.ndarray) -> dict:
    pos, neg = y.sum(), (y == 0).sum()
    print(f"\n  Training on {len(X)} entities: {pos} dormant/closed, {neg} active")

    if min(pos, neg) < 5:
        raise ValueError("Need at least 5 examples per class")

    X_tr, X_te, y_tr, y_te = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=42
    )

    models = {
        "GradientBoosting": Pipeline([
            ("scaler", StandardScaler()),
            ("clf", GradientBoostingClassifier(n_estimators=200, max_depth=3, learning_rate=0.08, random_state=42)),
        ]),
        "RandomForest": Pipeline([
            ("scaler", StandardScaler()),
            ("clf", RandomForestClassifier(n_estimators=150, max_depth=5, class_weight="balanced", random_state=42)),
        ]),
        "LogisticRegression": Pipeline([
            ("scaler", StandardScaler()),
            ("clf", LogisticRegression(C=0.5, class_weight="balanced", max_iter=1000, random_state=42)),
        ]),
    }

    comparison = []
    best_pipe, best_f1, best_name = None, -1.0, ""
    for name, pipe in models.items():
        pipe.fit(X_tr, y_tr)
        y_pred = pipe.predict(X_te)
        y_prob = pipe.predict_proba(X_te)[:, 1]
        prec = round(float(precision_score(y_te, y_pred, zero_division=0)), 4)
        rec  = round(float(recall_score(y_te, y_pred, zero_division=0)), 4)
        f1   = round(float(f1_score(y_te, y_pred, zero_division=0)), 4)
        auc  = round(float(roc_auc_score(y_te, y_prob)), 4)
        cv_f1 = round(cross_val_score(pipe, X, y, cv=min(5, pos), scoring="f1").mean(), 4)
        print(f"  [{name}] P={prec} R={rec} F1={f1} AUC={auc} cv_F1={cv_f1}")
        comparison.append({"name": name, "precision": prec, "recall": rec, "f1": f1, "roc_auc": auc, "cv_f1": cv_f1})
        if f1 > best_f1:
            best_f1, best_pipe, best_name = f1, pipe, name

    print(f"\n  Best: {best_name} (F1={best_f1})")
    print(classification_report(y_te, best_pipe.predict(X_te), target_names=["Active", "Dormant"]))  # type: ignore

    y_pred_best = best_pipe.predict(X_te)  # type: ignore
    y_prob_best = best_pipe.predict_proba(X_te)[:, 1]  # type: ignore

    # Feature importances
    clf = best_pipe.named_steps["clf"]  # type: ignore
    if hasattr(clf, "feature_importances_"):
        imp = dict(zip(FEATURE_NAMES, [round(float(v),4) for v in clf.feature_importances_]))
    elif hasattr(clf, "coef_"):
        abs_coef = abs(clf.coef_[0])
        imp = dict(zip(FEATURE_NAMES, [round(float(v)/sum(abs_coef),4) for v in abs_coef]))
    else:
        imp = {}

    # Calibration data for the UI
    frac_pos, mean_pred = calibration_curve(y_te, y_prob_best, n_bins=5, strategy="uniform")
    ap = round(float(average_precision_score(y_te, y_prob_best)), 4)

    meta = {
        "model_type":           best_name,
        "task":                 "dormancy_prediction",
        "training_samples":     len(X),
        "positive_samples":     int(pos),
        "negative_samples":     int(neg),
        "test_size":            len(X_te),
        "precision":            round(float(precision_score(y_te, y_pred_best, zero_division=0)), 4),
        "recall":               round(float(recall_score(y_te, y_pred_best, zero_division=0)), 4),
        "f1_score":             round(float(f1_score(y_te, y_pred_best, zero_division=0)), 4),
        "roc_auc":              round(float(roc_auc_score(y_te, y_prob_best)), 4),
        "average_precision":    ap,
        "feature_names":        FEATURE_NAMES,
        "feature_importances":  imp,
        "model_comparison":     comparison,
        "calibration": {
            "fraction_of_positives": [round(float(v),3) for v in frac_pos],
            "mean_predicted_value":  [round(float(v),3) for v in mean_pred],
        },
    }
    return {"model": best_pipe, "meta": meta}


async def main():
    engine = create_async_engine(settings.database_url)
    Sess = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    print("Extracting features for dormancy prediction…")
    async with Sess() as db:
        X, y, ubids = await extract_features(db)
    await engine.dispose()

    result = train(X, y)

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(result["model"], MODEL_PATH)
    META_PATH.write_text(json.dumps(result["meta"], indent=2))

    print(f"\n[OK] Dormancy model saved: {MODEL_PATH}")
    print(f"  F1={result['meta']['f1_score']}  AUC={result['meta']['roc_auc']}  AP={result['meta']['average_precision']}")


if __name__ == "__main__":
    asyncio.run(main())
