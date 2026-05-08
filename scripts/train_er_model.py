"""
UBID Entity Resolution — ML Model Trainer
==========================================
Trains a GradientBoostingClassifier on features extracted from scored
ER candidate pairs in the database:

  Features (5):
    name_score      — Jaro-Winkler string similarity (0-1)
    address_score   — Token overlap similarity (0-1)
    pan_match       — PAN exact match (0/1)
    gstin_match     — GSTIN exact match (0/1)
    pincode_match   — Pincode exact match (0/1)

  Labels:
    1 = AUTO_MATCH (confirmed match by ER engine)
    0 = NON_MATCH  (confirmed non-match)
    Also adds reviewer-confirmed labels from reviewer_decisions table.

Saves:
    backend/models/er_linkage_model.pkl  — trained model + scaler + metrics
    backend/models/er_model_meta.json    — feature importances, accuracy, F1

Usage:
    python scripts/train_er_model.py
"""
import asyncio, sys, json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

import numpy as np
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import classification_report, precision_score, recall_score, f1_score
from sklearn.pipeline import Pipeline
import joblib

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import select
from app.core.config import settings
from app.models.entities import ERCandidatePair, ReviewCase, ReviewerDecision
from app.models.base import PairDecision, ReviewDecision

FEATURE_NAMES = ["name_score", "address_score", "pan_match", "gstin_match", "pincode_match"]
MODEL_PATH = Path(__file__).parent.parent / "backend" / "models" / "er_linkage_model.pkl"
META_PATH  = Path(__file__).parent.parent / "backend" / "models" / "er_model_meta.json"


async def load_training_data(db: AsyncSession):
    """Extract labeled feature vectors from the database."""
    X, y = [], []

    # ── 1. Labeled pairs from ER engine ──────────────────────────────────────
    pairs_r = await db.execute(
        select(ERCandidatePair)
        .where(ERCandidatePair.decision.in_([PairDecision.AUTO_MATCH, PairDecision.NON_MATCH]))
    )
    pairs = pairs_r.scalars().all()
    print(f"  ER labeled pairs: {len(pairs)}")

    auto_count = non_count = 0
    for p in pairs:
        if p.name_score is None:
            continue
        features = [
            float(p.name_score or 0),
            float(p.address_score or 0),
            1.0 if p.pan_match else 0.0,
            1.0 if p.gstin_match else 0.0,
            1.0 if p.pincode_match else 0.0,
        ]
        label = 1 if p.decision == PairDecision.AUTO_MATCH else 0
        X.append(features)
        y.append(label)
        if label == 1: auto_count += 1
        else: non_count += 1

    print(f"  Auto-match (positive): {auto_count}  Non-match (negative): {non_count}")

    # ── 2. Reviewer-confirmed labels (gold standard) ─────────────────────────
    decisions_r = await db.execute(
        select(ReviewerDecision)
        .where(ReviewerDecision.decision.in_([ReviewDecision.APPROVED_MERGE, ReviewDecision.REJECTED_MERGE]))
    )
    reviewer_count = 0
    for dec in decisions_r.scalars().all():
        # Find corresponding review case → find corresponding ER pair
        case = await db.get(ReviewCase, dec.review_case_id)
        if not case or not case.pair_key:
            continue
        pair_r = await db.execute(
            select(ERCandidatePair).where(ERCandidatePair.pair_key == case.pair_key)
        )
        pair = pair_r.scalar_one_or_none()
        if not pair or pair.name_score is None:
            continue
        features = [
            float(pair.name_score or 0),
            float(pair.address_score or 0),
            1.0 if pair.pan_match else 0.0,
            1.0 if pair.gstin_match else 0.0,
            1.0 if pair.pincode_match else 0.0,
        ]
        label = 1 if dec.decision == ReviewDecision.APPROVED_MERGE else 0
        X.append(features)
        y.append(label)
        reviewer_count += 1

    print(f"  Reviewer-confirmed labels: {reviewer_count}")

    # ── 3. High-confidence REVIEW_NEEDED pairs → soft positives ─────────────
    # Pairs with confidence 0.75+ are very likely genuine matches (name-only path).
    # Including these teaches the ML model to recognise name-only matches.
    soft_pos_r = await db.execute(
        select(ERCandidatePair)
        .where(ERCandidatePair.decision == PairDecision.REVIEW_NEEDED)
        .where(ERCandidatePair.confidence_score >= 0.75)
        .where(ERCandidatePair.pan_match == False)
        .where(ERCandidatePair.gstin_match == False)
    )
    soft_pos = 0
    for p in soft_pos_r.scalars().all():
        if p.name_score is None: continue
        X.append([
            float(p.name_score or 0), float(p.address_score or 0),
            0.0, 0.0, 1.0 if p.pincode_match else 0.0,
        ])
        y.append(1)   # high-confidence borderline → treat as positive
        soft_pos += 1

    # ── 4. Low-confidence REVIEW_NEEDED pairs → soft negatives ───────────────
    # Pairs with confidence < 0.55 and no identifiers are likely non-matches
    soft_neg_r = await db.execute(
        select(ERCandidatePair)
        .where(ERCandidatePair.decision == PairDecision.REVIEW_NEEDED)
        .where(ERCandidatePair.confidence_score < 0.55)
        .where(ERCandidatePair.pan_match == False)
        .where(ERCandidatePair.gstin_match == False)
    )
    soft_neg = 0
    for p in soft_neg_r.scalars().all():
        if p.name_score is None: continue
        X.append([
            float(p.name_score or 0), float(p.address_score or 0),
            0.0, 0.0, 1.0 if p.pincode_match else 0.0,
        ])
        y.append(0)
        soft_neg += 1

    print(f"  Soft positives (high-conf name-only review): {soft_pos}")
    print(f"  Soft negatives (low-conf review pairs): {soft_neg}")
    return np.array(X, dtype=np.float32), np.array(y, dtype=np.int32)


def train_model(X: np.ndarray, y: np.ndarray) -> dict:
    """Train a gradient boosting classifier with cross-validation."""
    print(f"\nTraining on {len(X)} examples: {y.sum()} positive, {(y==0).sum()} negative")

    if len(X) < 20:
        raise ValueError("Not enough training data. Run ER pipeline first.")

    # Logistic Regression is fast and interpretable — great for demo
    # GradientBoosting is more powerful for production
    log_pipe = Pipeline([
        ("scaler", StandardScaler()),
        ("clf",   LogisticRegression(C=1.0, class_weight="balanced", max_iter=500, random_state=42)),
    ])

    gb_pipe = Pipeline([
        ("scaler", StandardScaler()),
        ("clf",   GradientBoostingClassifier(
            n_estimators=150, max_depth=3, learning_rate=0.1,
            min_samples_leaf=5, random_state=42,
        )),
    ])

    # Train both, pick the better one
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    best_model, best_f1 = None, -1.0
    model_names = []
    for name, pipe in [("LogisticRegression", log_pipe), ("GradientBoosting", gb_pipe)]:
        pipe.fit(X_train, y_train)
        y_pred = pipe.predict(X_test)
        f1 = f1_score(y_test, y_pred, zero_division=0)
        prec = precision_score(y_test, y_pred, zero_division=0)
        rec  = recall_score(y_test, y_pred, zero_division=0)
        cv_f1 = cross_val_score(pipe, X, y, cv=min(5, len(X)//10+1), scoring="f1").mean()
        print(f"\n  [{name}]  precision={prec:.3f}  recall={rec:.3f}  F1={f1:.3f}  cv_F1={cv_f1:.3f}")
        model_names.append({"name": name, "precision": round(prec, 4), "recall": round(rec, 4), "f1": round(f1, 4), "cv_f1": round(cv_f1, 4)})
        if f1 > best_f1:
            best_f1 = f1
            best_model = pipe
            best_name = name

    print(f"\n  Best model: {best_name} (F1={best_f1:.3f})")
    print("\n" + classification_report(y_test, best_model.predict(X_test), target_names=["Non-Match", "Match"]))  # type: ignore

    # Final metrics
    y_pred_final = best_model.predict(X_test)  # type: ignore
    meta = {
        "model_type":          best_name,
        "training_samples":    len(X),
        "positive_samples":    int(y.sum()),
        "negative_samples":    int((y == 0).sum()),
        "test_size":           len(X_test),
        "precision":           round(float(precision_score(y_test, y_pred_final, zero_division=0)), 4),
        "recall":              round(float(recall_score(y_test, y_pred_final, zero_division=0)), 4),
        "f1_score":            round(float(f1_score(y_test, y_pred_final, zero_division=0)), 4),
        "feature_names":       FEATURE_NAMES,
        "feature_importances": _get_importances(best_model),  # type: ignore
        "model_comparison":    model_names,
    }
    return {"model": best_model, "meta": meta}


def _get_importances(pipe: Pipeline) -> dict:
    clf = pipe.named_steps["clf"]
    if hasattr(clf, "feature_importances_"):
        imp = clf.feature_importances_
    elif hasattr(clf, "coef_"):
        imp = abs(clf.coef_[0])
        imp = imp / imp.sum()
    else:
        return {}
    return {name: round(float(v), 4) for name, v in zip(FEATURE_NAMES, imp)}


async def main():
    engine = create_async_engine(settings.database_url, pool_pre_ping=True)
    Sess = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    print("Loading training data from database…")
    async with Sess() as db:
        X, y = await load_training_data(db)
    await engine.dispose()

    if len(X) == 0:
        print("ERROR: No training data found. Run ER pipeline first.")
        return

    result = train_model(X, y)

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(result["model"], MODEL_PATH)
    META_PATH.write_text(json.dumps(result["meta"], indent=2))

    print(f"\n[OK] Model saved: {MODEL_PATH}")
    print(f"[OK] Metadata  : {META_PATH}")
    print(f"\n  precision={result['meta']['precision']}  recall={result['meta']['recall']}  F1={result['meta']['f1_score']}")


if __name__ == "__main__":
    asyncio.run(main())
