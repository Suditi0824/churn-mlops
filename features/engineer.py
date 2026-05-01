import pandas as pd
import numpy as np
import sqlite3
import os

RAW_PATH = "data/raw_churn.csv"
DB_PATH = "data/feature_store.db"


def load_raw() -> pd.DataFrame:
    df = pd.read_csv(RAW_PATH)
    df.columns = df.columns.str.lower().str.replace(" ", "_")
    return df


def clean(df: pd.DataFrame) -> pd.DataFrame:
    # TotalCharges has spaces instead of NaN for new customers
    df["totalcharges"] = pd.to_numeric(df["totalcharges"], errors="coerce")
    df["totalcharges"].fillna(0, inplace=True)

    # Binary encode target
    df["churn"] = (df["churn"] == "Yes").astype(int)
    return df


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    # Tenure buckets (good for explainability)
    df["tenure_group"] = pd.cut(
        df["tenure"],
        bins=[0, 12, 24, 48, 72],
        labels=["0-1yr", "1-2yr", "2-4yr", "4+yr"]
    ).astype(str)

    # Charge ratios — strong churn signal
    df["monthly_to_total_ratio"] = df["monthlycharges"] / (df["totalcharges"] + 1)
    df["avg_monthly_spend"] = df["totalcharges"] / (df["tenure"] + 1)

    # Service count (customers with more services churn less)
    service_cols = [
        "phoneservice", "multiplelines", "internetservice",
        "onlinesecurity", "onlinebackup", "deviceprotection",
        "techsupport", "streamingtv", "streamingmovies"
    ]
    df["service_count"] = df[service_cols].apply(
        lambda row: sum(v not in ["No", "No phone service", "No internet service"] for v in row),
        axis=1
    )

    # Contract risk score
    contract_map = {"Month-to-month": 3, "One year": 2, "Two year": 1}
    df["contract_risk"] = df["contract"].map(contract_map)

    # Payment method risk
    payment_map = {
        "Electronic check": 3,
        "Mailed check": 2,
        "Bank transfer (automatic)": 1,
        "Credit card (automatic)": 1
    }
    df["payment_risk"] = df["paymentmethod"].map(payment_map)

    return df


def encode(df: pd.DataFrame) -> pd.DataFrame:
    binary_cols = ["gender", "partner", "dependents", "paperlessbilling"]
    for col in binary_cols:
        df[col] = (df[col].isin(["Yes", "Male", "Female"])).astype(int)
        if col == "gender":
            df[col] = (df["gender"] == "Male").astype(int)

    # One-hot encode remaining categoricals
    cat_cols = ["multiplelines", "internetservice", "onlinesecurity",
                "onlinebackup", "deviceprotection", "techsupport",
                "streamingtv", "streamingmovies", "tenure_group"]
    df = pd.get_dummies(df, columns=cat_cols, drop_first=True)

    return df


def save_to_feature_store(df: pd.DataFrame):
    os.makedirs("data", exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    df.to_sql("features", conn, if_exists="replace", index=False)
    conn.close()
    print(f"Saved {len(df)} rows to feature store → {DB_PATH}")


def get_training_data():
    """Called by training scripts to pull features from the store."""
    conn = sqlite3.connect(DB_PATH)
    df = pd.read_sql("SELECT * FROM features", conn)
    conn.close()
    return df


if __name__ == "__main__":
    print("Loading raw data...")
    df = load_raw()
    print(f"  {len(df)} rows, {len(df.columns)} cols")

    print("Cleaning...")
    df = clean(df)

    print("Engineering features...")
    df = engineer_features(df)

    print("Encoding...")
    df = encode(df)

    # Drop columns we don't need for training
    drop_cols = ["customerid", "phoneservice", "contract", "paymentmethod"]
    df.drop(columns=[c for c in drop_cols if c in df.columns], inplace=True)

    print(f"Final shape: {df.shape}")
    print(f"Churn rate: {df['churn'].mean():.1%}")
    print(f"Features: {list(df.columns)}")

    save_to_feature_store(df)
    print("Done.")