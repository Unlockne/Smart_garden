from datetime import datetime, timezone
 
from fastapi import Depends
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import Base, engine, get_db
from app.models.control_log import ControlLog
from app.models.device_state import DeviceState
from app.models.sensor_reading import SensorReading
from app.models.system_decision_log import SystemDecisionLog
from app.schemas.devices import (
    DeviceControlRequest,
    DeviceControlResponse,
    DeviceStateResponse,
    SystemModeRequest,
    SystemModeResponse,
)
from app.schemas.sensors import SensorIngestRequest, SensorLatestResponse, SystemStatusResponse
from app.services.adafruit_command_service import build_command, publish_command
from app.services.auto_mode_service import run_auto_if_needed
from app.services.device_state_service import get_latest_state, upsert_state
from app.services.ingestion_service import ingest_payload
from app.services.logging_service import create_control_log
from app.services.poller import poller


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
    # Ensure there's an initial device state row
    db = next(get_db())
    try:
        if get_latest_state(db) is None:
            upsert_state(db, mode="manual")
    finally:
        db.close()
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
    run_auto_if_needed(db, trigger="mock-ingest")
    return {
        "status": "inserted",
        "id": row.id,
        "recorded_at": row.recorded_at,
    }


@app.get("/api/v1/devices/state", response_model=DeviceStateResponse)
def get_device_state(db: Session = Depends(get_db)):
    state = get_latest_state(db)
    if state is None:
        state = upsert_state(db, mode="manual")

    return DeviceStateResponse(
        recorded_at=state.recorded_at,
        pump_state=state.pump_state,
        fan_state=state.fan_state,
        light_state=state.light_state,
        mode=state.mode,
    )


@app.post("/api/v1/system/mode", response_model=SystemModeResponse)
def set_system_mode(req: SystemModeRequest, db: Session = Depends(get_db)):
    upsert_state(db, mode=req.mode)
    return SystemModeResponse(success=True, mode=req.mode)


@app.post("/api/v1/devices/control", response_model=DeviceControlResponse)
def control_device(req: DeviceControlRequest, db: Session = Depends(get_db)):
    state = get_latest_state(db)
    current_mode = state.mode if state else "manual"
    if current_mode == "auto" and req.actor_type == "user":
        log = create_control_log(
            db,
            target_device=req.target_device,
            action=req.action,
            actor_type=req.actor_type,
            reason=req.reason,
            status="failed",
            note="manual control is disabled in auto mode",
        )
        return DeviceControlResponse(success=False, message="Manual control is disabled in auto mode", command_id=str(log.id))

    cmd = build_command(
        target_device=req.target_device,
        action=req.action,
        mode=current_mode,
        requested_by=req.actor_type,
        reason=req.reason,
    )

    try:
        publish_command(cmd)
        status = "success"
        note = None
        message = "Command sent successfully"
        ok = True
    except Exception as e:
        status = "failed"
        note = str(e)
        message = f"Failed to send command: {e}"
        ok = False

    log = create_control_log(
        db,
        target_device=req.target_device,
        action=req.action,
        actor_type=req.actor_type,
        reason=req.reason,
        status=status,
        note=note,
    )

    # Assume success for Week 3 demo; update state even if publish failed only when ok
    if ok:
        if req.target_device == "pump":
            upsert_state(db, pump_state=(req.action == "on"))
        elif req.target_device == "fan":
            upsert_state(db, fan_state=(req.action == "on"))
        elif req.target_device == "light":
            upsert_state(db, light_state=(req.action == "on"))

    return DeviceControlResponse(success=ok, message=message, command_id=str(log.id))


@app.get("/api/v1/logs/control")
def get_control_logs(limit: int = 10, db: Session = Depends(get_db)):
    limit = max(1, min(200, limit))
    rows = db.query(ControlLog).order_by(ControlLog.created_at.desc()).limit(limit).all()
    return [
        {
            "id": r.id,
            "created_at": r.created_at,
            "target_device": r.target_device,
            "action": r.action,
            "actor_type": r.actor_type,
            "reason": r.reason,
            "status": r.status,
            "note": r.note,
        }
        for r in rows
    ]


@app.get("/api/v1/logs/system-decisions")
def get_system_decision_logs(limit: int = 10, db: Session = Depends(get_db)):
    limit = max(1, min(200, limit))
    rows = (
        db.query(SystemDecisionLog).order_by(SystemDecisionLog.created_at.desc()).limit(limit).all()
    )
    return [
        {
            "id": r.id,
            "created_at": r.created_at,
            "mode": r.mode,
            "trigger_type": r.trigger_type,
            "sensor_snapshot": r.sensor_snapshot,
            "recommended_action": r.recommended_action,
            "executed": r.executed,
            "execution_note": r.execution_note,
        }
        for r in rows
    ]
