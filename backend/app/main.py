from datetime import datetime, timezone
from typing import Literal

from fastapi import FastAPI
from fastapi import Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import Base, engine, get_db
from app.models.sensor_reading import SensorReading
from app.schemas.sensors import SensorIngestRequest, SensorLatestResponse, SystemStatusResponse
from app.services.ingestion_service import ingest_payload
from app.services.poller import poller


class DeviceStateResponse(BaseModel):
    recorded_at: datetime
    pump_state: bool
    fan_state: bool
    light_state: bool
    mode: Literal["manual", "auto", "ai"]


class DeviceControlRequest(BaseModel):
    target_device: Literal["pump", "fan", "light"]
    action: Literal["on", "off"]
    actor_type: Literal["user", "system", "ai"] = "user"
    reason: str = "manual control from dashboard"


app = FastAPI(title="Smart Garden API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    poller.start()


@app.on_event("shutdown")
def on_shutdown():
    poller.stop()


@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    database = "disconnected"
    try:
        db.execute(text("SELECT 1"))
        database = "connected"
    except Exception:
        database = "disconnected"

    return {
        "status": "ok",
        "database": database,
        "ingestion": "running" if poller.running else "stopped",
    }


@app.get("/api/v1/sensors/latest", response_model=SensorLatestResponse)
def get_latest_sensor(db: Session = Depends(get_db)):
    row = db.query(SensorReading).order_by(SensorReading.recorded_at.desc()).first()
    if row is None:
        now = datetime.now(timezone.utc)
        return SensorLatestResponse(
            recorded_at=now,
            air_temperature=30.2,
            air_humidity=68.5,
            soil_moisture=27.1,
            light_level=412.0,
            device_id=None,
            source="mock",
        )

    return SensorLatestResponse(
        recorded_at=row.recorded_at,
        air_temperature=row.air_temperature,
        air_humidity=row.air_humidity,
        soil_moisture=row.soil_moisture,
        light_level=row.light_level,
        device_id=row.device_id,
        source=row.source,
    )


@app.get("/api/v1/sensors/history")
def get_sensor_history(limit: int = 20, db: Session = Depends(get_db)):
    limit = max(1, min(200, limit))
    rows = (
        db.query(SensorReading)
        .order_by(SensorReading.recorded_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "recorded_at": r.recorded_at,
            "air_temperature": r.air_temperature,
            "air_humidity": r.air_humidity,
            "soil_moisture": r.soil_moisture,
            "light_level": r.light_level,
            "device_id": r.device_id,
            "source": r.source,
        }
        for r in rows
    ]


@app.get("/api/v1/system/status", response_model=SystemStatusResponse)
def system_status(db: Session = Depends(get_db)):
    total = db.query(SensorReading).count()
    latest = db.query(SensorReading).order_by(SensorReading.recorded_at.desc()).first()
    return SystemStatusResponse(
        last_ingested_at=latest.recorded_at if latest else None,
        total_records=total,
        latest_device_id=latest.device_id if latest else None,
    )


@app.post("/api/v1/internal/mock-ingest")
def internal_mock_ingest(req: SensorIngestRequest, db: Session = Depends(get_db)):
    row = ingest_payload(db, req, source="mock")
    return {
        "status": "inserted",
        "id": row.id,
        "recorded_at": row.recorded_at,
    }


@app.get("/api/v1/devices/state", response_model=DeviceStateResponse)
def get_device_state():
    now = datetime.now(timezone.utc)
    return DeviceStateResponse(
        recorded_at=now,
        pump_state=False,
        fan_state=False,
        light_state=True,
        mode="manual",
    )


@app.post("/api/v1/devices/control")
def control_device(req: DeviceControlRequest):
    return {
        "status": "accepted",
        "target_device": req.target_device,
        "action": req.action,
        "actor_type": req.actor_type,
        "reason": req.reason,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
