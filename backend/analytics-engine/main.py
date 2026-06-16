"""
AURORA Analytics Engine (M2)
FastAPI service that reads HDFS Parquet data and exposes REST endpoints
for frontend dashboard analytics.

Run: uvicorn main:app --host 0.0.0.0 --port 4001
"""

import os
import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd

from reader import (
    read_tps_by_kecamatan,
    read_tps_by_waste_type,
    read_critical_tps,
    read_event_type_distribution,
)

app = FastAPI(
    title="AURORA Analytics Engine",
    version="1.0.0",
    description="Analytics API for TPS volume data from HDFS/Parquet",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def table_to_json(table) -> list[dict]:
    """Convert PyArrow table to list of dicts, handling timestamps."""
    if table is None:
        return []
    df = table.to_pandas()
    # Convert timestamp columns to ISO format
    for col in df.columns:
        if pd.api.types.is_datetime64_any_dtype(df[col]):
            df[col] = df[col].dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    return json.loads(df.to_json(orient="records", force_ascii=False))


@app.get("/health")
def health():
    return {"status": "ok", "service": "aurora-analytics-engine", "version": "1.0.0"}


@app.get("/summary/tps-by-kecamatan")
def tps_by_kecamatan(minutes: int = Query(default=60, ge=10, le=1440)):
    """Get TPS volume aggregated by kecamatan for the last N minutes."""
    try:
        df = read_tps_by_kecamatan()
        if df is None:
            return {"data": [], "source": "hdfs_unavailable"}
        records = table_to_json(df)
        # Filter recent windows
        now = datetime.now(timezone.utc)
        recent = [
            r for r in records
            if r.get("window", {}).get("start", "")
        ]
        return {"data": recent[-20:], "count": len(recent)}
    except Exception as e:
        return {"error": str(e), "source": "fallback", "data": []}


@app.get("/summary/waste-types")
def waste_type_distribution(minutes: int = Query(default=60, ge=10, le=1440)):
    """Get waste type distribution for the last N minutes."""
    try:
        df = read_tps_by_waste_type()
        if df is None:
            return {"data": [], "source": "hdfs_unavailable"}
        records = table_to_json(df)
        return {"data": records[-30:], "count": len(records[-30:])}
    except Exception as e:
        return {"error": str(e), "source": "fallback", "data": []}


@app.get("/summary/critical-tps")
def critical_tps(limit: int = Query(default=20, ge=1, le=100)):
    """Get list of critical TPS (fill_level >= 0.9)."""
    try:
        df = read_critical_tps()
        if df is None:
            return {"data": [], "source": "hdfs_unavailable"}
        records = table_to_json(df)
        # Get latest per TPS
        latest_map = {}
        for r in records:
            code = r.get("tps_code", "")
            if code not in latest_map or r.get("timestamp", "") > latest_map[code].get("timestamp", ""):
                latest_map[code] = r
        return {"data": list(latest_map.values())[:limit], "count": len(latest_map)}
    except Exception as e:
        return {"error": str(e), "source": "fallback", "data": []}


@app.get("/summary/event-types")
def event_type_distribution(minutes: int = Query(default=60, ge=10, le=1440)):
    """Get event type distribution (PUBLIC vs SCHEDULED vs COLLECTED)."""
    try:
        df = read_event_type_distribution()
        if df is None:
            return {"data": [], "source": "hdfs_unavailable"}
        records = table_to_json(df)
        return {"data": records[-20:], "count": len(records[-20:])}
    except Exception as e:
        return {"error": str(e), "source": "fallback", "data": []}


@app.get("/summary/overview")
def overview():
    """Get overview summary from all available data sources."""
    result = {}
    try:
        df_kec = read_tps_by_kecamatan()
        if df_kec is not None:
            recs = table_to_json(df_kec)
            if recs:
                result["latest_kecamatan"] = recs[-1]
    except Exception:
        pass
    try:
        df_crit = read_critical_tps()
        if df_crit is not None:
            recs = table_to_json(df_crit)
            result["critical_count"] = len(recs)
    except Exception:
        pass
    try:
        df_waste = read_tps_by_waste_type()
        if df_waste is not None:
            recs = table_to_json(df_waste)
            result["waste_type_count"] = len(recs[-30:])
    except Exception:
        pass
    return result if result else {"status": "waiting_for_data"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("ANALYTICS_PORT", "4001"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
