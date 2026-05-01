import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import mlflow
import mlflow.sklearn
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.metrics import (
    accuracy_score, roc_auc_score, f1_score,
    precision_score, recall_score, classification_report
)
from xgboost import XGBClassifier
import shap
import json
import pickle

from features.engineer import get_training_data

MLFLOW_DIR = "mlruns"
MODEL_DIR  = "training/saved_models"
os.makedirs(MODEL_DIR, exist_ok=True)


def prepare(df: pd.DataFrame):
    # Drop the nan tenure group rows (tenure=0 edge case)
    if "tenure_group_nan" in df.columns:
        df = df[df["tenure_group_nan"] != 1].drop(columns=["tenure_group_nan"])

    X = df.drop(columns=["churn"])
    y = df["churn"]
    return X, y


def evaluate(model, X_test, y_test) -> dict:
    y_pred  = model.predict(X_test)
    y_proba = model.predict_proba(X_test)[:, 1]
    return {
        "accuracy":  round(accuracy_score(y_test, y_pred),  4),
        "roc_auc":   round(roc_auc_score(y_test, y_proba),  4),
        "f1":        round(f1_score(y_test, y_pred),         4),
        "precision": round(precision_score(y_test, y_pred),  4),
        "recall":    round(recall_score(y_test, y_pred),     4),
    }


def run_experiment(params: dict, run_name: str):
    mlflow.set_tracking_uri(MLFLOW_DIR)
    mlflow.set_experiment("churn-prediction")

    df = get_training_data()
    X, y = prepare(df)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    # Save feature names for the API to use later
    feature_names = list(X.columns)
    with open(f"{MODEL_DIR}/feature_names.json", "w") as f:
        json.dump(feature_names, f)

    model = XGBClassifier(
        **params,
        use_label_encoder=False,
        eval_metric="logloss",
        random_state=42
    )

    # 5-fold CV on training set
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    cv_auc = cross_val_score(model, X_train, y_train, cv=cv, scoring="roc_auc")

    model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        verbose=False
    )

    metrics = evaluate(model, X_test, y_test)
    metrics["cv_auc_mean"] = round(cv_auc.mean(), 4)
    metrics["cv_auc_std"]  = round(cv_auc.std(),  4)

    # SHAP feature importance
    explainer   = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X_test)
    shap_importance = pd.DataFrame({
        "feature":    feature_names,
        "importance": np.abs(shap_values).mean(axis=0)
    }).sort_values("importance", ascending=False)

    with mlflow.start_run(run_name=run_name):
        mlflow.log_params(params)
        mlflow.log_metrics(metrics)

        # Log SHAP importance as artifact
        shap_path = f"{MODEL_DIR}/shap_importance.csv"
        shap_importance.to_csv(shap_path, index=False)
        mlflow.log_artifact(shap_path)

        mlflow.sklearn.log_model(model, "model")
        run_id = mlflow.active_run().info.run_id

    # Save model locally for API
    with open(f"{MODEL_DIR}/model.pkl", "wb") as f:
        pickle.dump(model, f)

    print(f"\nRun: {run_name}  (id: {run_id})")
    print(f"  AUC:        {metrics['roc_auc']}")
    print(f"  F1:         {metrics['f1']}")
    print(f"  CV AUC:     {metrics['cv_auc_mean']} ± {metrics['cv_auc_std']}")
    print(f"  Precision:  {metrics['precision']}")
    print(f"  Recall:     {metrics['recall']}")
    print(f"\nTop 5 features by SHAP:")
    print(shap_importance.head(5).to_string(index=False))

    return metrics, run_id


if __name__ == "__main__":
    # Run 3 experiments with different hyperparams — all tracked in MLflow
    experiments = [
        ("baseline", {
            "n_estimators": 100, "max_depth": 4,
            "learning_rate": 0.1, "subsample": 0.8
        }),
        ("deeper", {
            "n_estimators": 200, "max_depth": 6,
            "learning_rate": 0.05, "subsample": 0.8
        }),
        ("regularized", {
            "n_estimators": 150, "max_depth": 5,
            "learning_rate": 0.08, "subsample": 0.9,
            "reg_alpha": 0.1, "reg_lambda": 1.5
        }),
    ]

    results = []
    for name, params in experiments:
        print(f"\nRunning experiment: {name}")
        metrics, run_id = run_experiment(params, name)
        results.append((name, metrics["roc_auc"], run_id))

    print("\n--- Experiment summary ---")
    for name, auc, run_id in sorted(results, key=lambda x: -x[1]):
        print(f"  {name:15s}  AUC={auc}  run_id={run_id}")
    print(f"\nBest model saved → {MODEL_DIR}/model.pkl")