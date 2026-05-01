import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import pickle, json, sqlite3
import pandas as pd
import numpy as np
from datetime import datetime

app = FastAPI(title="Churn Prediction API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_PATH        = "training/saved_models/model.pkl"
FEATURE_NAMES_PATH = "training/saved_models/feature_names.json"
PREDICTIONS_DB    = "data/predictions_log.db"

# Load model + feature names at startup
with open(MODEL_PATH, "rb") as f:
    model = pickle.load(f)
with open(FEATURE_NAMES_PATH) as f:
    FEATURE_NAMES = json.load(f)

def init_predictions_db():
    conn = sqlite3.connect(PREDICTIONS_DB)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS predictions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT,
            customer_id TEXT,
            churn_probability REAL,
            churn_prediction INTEGER,
            monthly_charges REAL,
            tenure INTEGER,
            contract_risk INTEGER
        )
    """)
    conn.commit()
    conn.close()

init_predictions_db()


class CustomerInput(BaseModel):
    customer_id: str = Field(default="CUST-001")
    gender: int = Field(ge=0, le=1, description="0=Female, 1=Male")
    senior_citizen: int = Field(ge=0, le=1)
    partner: int = Field(ge=0, le=1)
    dependents: int = Field(ge=0, le=1)
    tenure: int = Field(ge=0, le=72)
    paperless_billing: int = Field(ge=0, le=1)
    monthly_charges: float = Field(ge=0)
    total_charges: float = Field(ge=0)
    service_count: int = Field(ge=0, le=9)
    contract_risk: int = Field(ge=1, le=3, description="1=Two year, 2=One year, 3=Month-to-month")
    payment_risk: int = Field(ge=1, le=3, description="1=Auto, 2=Mailed check, 3=Electronic check")


def build_feature_vector(c: CustomerInput) -> pd.DataFrame:
    monthly_to_total = c.monthly_charges / (c.total_charges + 1)
    avg_monthly      = c.total_charges / (c.tenure + 1)

    # Tenure group one-hot
    if c.tenure <= 12:
        tg = {"1-2yr": 0, "2-4yr": 0, "4+yr": 0}
    elif c.tenure <= 24:
        tg = {"1-2yr": 1, "2-4yr": 0, "4+yr": 0}
    elif c.tenure <= 48:
        tg = {"1-2yr": 0, "2-4yr": 1, "4+yr": 0}
    else:
        tg = {"1-2yr": 0, "2-4yr": 0, "4+yr": 1}

    row = {
        "gender":                        c.gender,
        "seniorcitizen":                 c.senior_citizen,
        "partner":                       c.partner,
        "dependents":                    c.dependents,
        "tenure":                        c.tenure,
        "paperlessbilling":              c.paperless_billing,
        "monthlycharges":                c.monthly_charges,
        "totalcharges":                  c.total_charges,
        "monthly_to_total_ratio":        monthly_to_total,
        "avg_monthly_spend":             avg_monthly,
        "service_count":                 c.service_count,
        "contract_risk":                 c.contract_risk,
        "payment_risk":                  c.payment_risk,
        # Fill all dummy columns with 0 — API takes simplified input
        "multiplelines_No phone service": 0,
        "multiplelines_Yes":              0,
        "internetservice_Fiber optic":    0,
        "internetservice_No":             0,
        "onlinesecurity_No internet service": 0,
        "onlinesecurity_Yes":             0,
        "onlinebackup_No internet service":   0,
        "onlinebackup_Yes":               0,
        "deviceprotection_No internet service": 0,
        "deviceprotection_Yes":           0,
        "techsupport_No internet service":    0,
        "techsupport_Yes":                0,
        "streamingtv_No internet service":    0,
        "streamingtv_Yes":                0,
        "streamingmovies_No internet service": 0,
        "streamingmovies_Yes":            0,
        "tenure_group_1-2yr":             tg["1-2yr"],
        "tenure_group_2-4yr":             tg["2-4yr"],
        "tenure_group_4+yr":              tg["4+yr"],
    }
    return pd.DataFrame([row])[FEATURE_NAMES]


def log_prediction(customer_id, prob, pred, monthly, tenure, contract_risk):
    conn = sqlite3.connect(PREDICTIONS_DB)
    conn.execute("""
        INSERT INTO predictions
        (timestamp, customer_id, churn_probability, churn_prediction,
         monthly_charges, tenure, contract_risk)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (datetime.utcnow().isoformat(), customer_id, prob, pred,
          monthly, tenure, contract_risk))
    conn.commit()
    conn.close()


@app.get("/health")
def health():
    return {"status": "ok", "model": "xgboost-churn-baseline", "version": "1.0.0"}


@app.post("/predict")
def predict(customer: CustomerInput):
    try:
        X    = build_feature_vector(customer)
        prob = float(model.predict_proba(X)[0][1])
        pred = int(prob >= 0.5)

        risk = "high" if prob >= 0.7 else "medium" if prob >= 0.4 else "low"

        log_prediction(
            customer.customer_id, prob, pred,
            customer.monthly_charges, customer.tenure, customer.contract_risk
        )

        return {
            "customer_id":       customer.customer_id,
            "churn_probability": round(prob, 4),
            "churn_prediction":  pred,
            "risk_level":        risk,
            "timestamp":         datetime.utcnow().isoformat(),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/metrics")
def metrics():
    conn  = sqlite3.connect(PREDICTIONS_DB)
    df    = pd.read_sql("SELECT * FROM predictions", conn)
    conn.close()

    if df.empty:
        return {"total_predictions": 0}

    return {
        "total_predictions": len(df),
        "churn_rate":        round(df["churn_prediction"].mean(), 4),
        "avg_probability":   round(df["churn_probability"].mean(), 4),
        "high_risk_count":   int((df["churn_probability"] >= 0.7).sum()),
        "recent_predictions": df.tail(10)[
            ["timestamp", "customer_id", "churn_probability", "risk_level" if "risk_level" in df.columns else "churn_prediction"]
        ].to_dict(orient="records")
    }


@app.get("/models")
def list_models():
    return {
        "active_model": "xgboost-baseline",
        "auc":          0.8342,
        "f1":           0.5931,
        "cv_auc":       "0.8439 ± 0.0051",
        "trained_on":   "Telco churn dataset (7043 rows)",
        "features":     len(FEATURE_NAMES),
        "top_features": ["contract_risk", "monthly_to_total_ratio",
                         "internetservice_Fiber optic", "monthlycharges",
                         "avg_monthly_spend"],
    }