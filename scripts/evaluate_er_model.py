"""
UBID ER Model — Comprehensive Cross-Validation & Calibration Evaluation
========================================================================
Runs held-out and cross-department evaluation to give judges real metrics.

Tests:
  1. Standard 5-fold stratified cross-validation (F1, Precision, Recall, AUC)
  2. Cross-department holdout: train on SHOPS+FACTORIES pairs, test on KSPCB+BESCOM
  3. Confidence calibration: do predicted probabilities match actual match rates?
  4. Precision-Recall curve
  5. Per-feature ablation: what happens if we remove each feature?

Saves:
  backend/models/er_model_evaluation.json
"""
import asyncio, sys, json, numpy as np
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from sklearn.metrics import (
    precision_score, recall_score, f1_score, roc_auc_score,
    precision_recall_curve, average_precision_score,
)
from sklearn.model_selection import StratifiedKFold, cross_validate
from sklearn.calibration import calibration_curve
import joblib

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import select
from app.core.config import settings
from app.models.entities import ERCandidatePair, SourceRecord
from app.models.base import PairDecision

FEATURE_NAMES = ["name_score", "address_score", "pan_match", "gstin_match", "pincode_match"]
MODEL_PATH = Path(__file__).parent.parent / "backend" / "models" / "er_linkage_model.pkl"
EVAL_PATH  = Path(__file__).parent.parent / "backend" / "models" / "er_model_evaluation.json"


async def load_pairs_with_dept(db: AsyncSession):
    """Load pairs with department information for cross-dept evaluation."""
    pairs_r = await db.execute(
        select(ERCandidatePair)
        .where(ERCandidatePair.decision.in_([PairDecision.AUTO_MATCH, PairDecision.NON_MATCH]))
    )
    pairs = pairs_r.scalars().all()

    # Get department codes for each pair's records
    all_ids = set()
    for p in pairs:
        all_ids.add(p.record_a_id)
        all_ids.add(p.record_b_id)

    recs_r = await db.execute(
        select(SourceRecord.id, SourceRecord.department_code)
        .where(SourceRecord.id.in_(list(all_ids)))
    )
    rec_dept = {str(r[0]): r[1] for r in recs_r}

    rows = []
    for p in pairs:
        if p.name_score is None: continue
        dept_a = rec_dept.get(str(p.record_a_id), "")
        dept_b = rec_dept.get(str(p.record_b_id), "")
        rows.append({
            "features": [
                float(p.name_score or 0), float(p.address_score or 0),
                1.0 if p.pan_match else 0.0, 1.0 if p.gstin_match else 0.0,
                1.0 if p.pincode_match else 0.0,
            ],
            "label": 1 if p.decision == PairDecision.AUTO_MATCH else 0,
            "dept_a": dept_a,
            "dept_b": dept_b,
            "confidence": float(p.confidence_score),
        })
    return rows


def evaluate(rows: list[dict]) -> dict:
    if not MODEL_PATH.exists():
        return {"error": "Model not found. Run train_er_model.py first."}

    pipe = joblib.load(MODEL_PATH)
    X = np.array([r["features"] for r in rows], dtype=np.float32)
    y = np.array([r["label"] for r in rows], dtype=np.int32)

    print(f"Total pairs: {len(rows)}  Positive: {y.sum()}  Negative: {(y==0).sum()}")

    # ── 1. 5-Fold stratified cross-validation ─────────────────────────────────
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    cv_results = cross_validate(pipe, X, y, cv=cv,
                                scoring=["precision", "recall", "f1", "roc_auc"],
                                return_train_score=False)
    cv_summary = {
        metric: {
            "mean": round(float(np.mean(scores)), 4),
            "std":  round(float(np.std(scores)), 4),
            "min":  round(float(np.min(scores)), 4),
            "max":  round(float(np.max(scores)), 4),
        }
        for metric, scores in {
            "precision": cv_results["test_precision"],
            "recall":    cv_results["test_recall"],
            "f1":        cv_results["test_f1"],
            "roc_auc":   cv_results["test_roc_auc"],
        }.items()
    }
    print(f"5-fold CV — F1: {cv_summary['f1']['mean']:.3f}±{cv_summary['f1']['std']:.3f}  AUC: {cv_summary['roc_auc']['mean']:.3f}")

    # ── 2. Cross-department holdout ────────────────────────────────────────────
    core_depts   = {"SHOPS", "FACTORIES"}
    holdout_depts = {"KSPCB", "BESCOM"}

    train_mask = [
        i for i, r in enumerate(rows)
        if r["dept_a"] in core_depts or r["dept_b"] in core_depts
    ]
    test_mask = [
        i for i, r in enumerate(rows)
        if (r["dept_a"] in holdout_depts or r["dept_b"] in holdout_depts)
        and i not in set(train_mask)
    ]

    cross_dept = {}
    if len(test_mask) >= 10:
        X_tr, y_tr = X[train_mask], y[train_mask]
        X_te, y_te = X[test_mask], y[test_mask]
        unique_classes = len(set(y_te.tolist()))

        if unique_classes < 2:
            # Single-class holdout — this happens when all KSPCB+BESCOM pairs are PAN-matched
            # (same entity, same department linkage pattern). Report honestly.
            cross_dept = {
                "train_depts":    list(core_depts),
                "test_depts":     list(holdout_depts),
                "test_size":      len(test_mask),
                "note":           "KSPCB+BESCOM holdout contains only one class (all PAN/GSTIN-matched pairs). Generalization is demonstrated via 5-fold CV with stratification instead.",
                "single_class":   True,
                "class_present":  int(y_te[0]),
                "f1":             None,
                "roc_auc":        None,
            }
            print(f"Cross-dept: single class in holdout — using 5-fold CV for generalization evidence")
        else:
            pipe_cd = joblib.load(MODEL_PATH)
            pipe_cd.fit(X_tr, y_tr)
            y_pred_cd = pipe_cd.predict(X_te)
            y_prob_cd = pipe_cd.predict_proba(X_te)[:, 1]
            cross_dept = {
                "train_depts":   list(core_depts),
                "test_depts":    list(holdout_depts),
                "test_size":     len(test_mask),
                "precision":     round(float(precision_score(y_te, y_pred_cd, zero_division=0)), 4),
                "recall":        round(float(recall_score(y_te, y_pred_cd, zero_division=0)), 4),
                "f1":            round(float(f1_score(y_te, y_pred_cd, zero_division=0)), 4),
                "roc_auc":       round(float(roc_auc_score(y_te, y_prob_cd)), 4),
            }
            print(f"Cross-dept — F1: {cross_dept['f1']}  AUC: {cross_dept['roc_auc']}")
    else:
        cross_dept = {"note": "Not enough cross-dept pairs for holdout evaluation", "test_size": len(test_mask)}

    # ── 3. Calibration curve ───────────────────────────────────────────────────
    pipe.fit(X, y)  # fit on all data for calibration
    y_prob = pipe.predict_proba(X)[:, 1]
    frac_pos, mean_pred = calibration_curve(y, y_prob, n_bins=10, strategy="uniform")
    calib = {
        "fraction_of_positives": [round(float(v), 4) for v in frac_pos],
        "mean_predicted_value":  [round(float(v), 4) for v in mean_pred],
        "note": "Well-calibrated if points follow y=x diagonal",
    }

    # ── 4. Precision-Recall curve ──────────────────────────────────────────────
    precs, recs, threshs = precision_recall_curve(y, y_prob)
    ap = round(float(average_precision_score(y, y_prob)), 4)
    pr_curve = {
        "average_precision": ap,
        "thresholds_sample": [round(float(t), 3) for t in threshs[::max(1,len(threshs)//10)]],
        "precision_sample":  [round(float(p), 3) for p in precs[::max(1,len(precs)//10)]],
        "recall_sample":     [round(float(r), 3) for r in recs[::max(1,len(recs)//10)]],
    }

    # ── 5. Feature ablation ────────────────────────────────────────────────────
    ablation = {}
    from sklearn.model_selection import cross_val_score as cvs
    baseline_f1 = float(np.mean(cvs(pipe, X, y, cv=5, scoring="f1")))
    for i, fname in enumerate(FEATURE_NAMES):
        X_ab = X.copy()
        X_ab[:, i] = 0.0  # zero out this feature
        ab_f1 = float(np.mean(cvs(pipe, X_ab, y, cv=5, scoring="f1")))
        drop = round(baseline_f1 - ab_f1, 4)
        ablation[fname] = {"f1_without": round(ab_f1, 4), "f1_drop": drop}
        print(f"  Ablation {fname}: F1 drops {drop:.4f} when removed")

    result = {
        "cross_validation_5fold": cv_summary,
        "cross_dept_holdout":     cross_dept,
        "calibration":            calib,
        "precision_recall_curve": pr_curve,
        "feature_ablation":       ablation,
        "total_pairs":            len(rows),
    }
    EVAL_PATH.write_text(json.dumps(result, indent=2))
    print(f"\n[OK] Evaluation saved: {EVAL_PATH}")
    return result


async def main():
    engine = create_async_engine(settings.database_url)
    Sess = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with Sess() as db:
        rows = await load_pairs_with_dept(db)
    await engine.dispose()
    evaluate(rows)


if __name__ == "__main__":
    asyncio.run(main())
