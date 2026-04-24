from datetime import datetime, timezone

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import Base, engine, get_db
from app.models.control_log import ControlLog
from app.models.ai_decision_log import AIDecisionLog
from app.models.sensor_reading import SensorReading
from app.models.system_decision_log import SystemDecisionLog
from app.schemas.ai import AIApplyRequest, AIRecommendRequest
from app.schemas.devices import DeviceControlRequest, SystemModeRequest
from app.schemas.sensors import SensorIngestRequest, SensorLatestResponse, SystemStatusResponse
from app.services.ai_service import ensure_ai_seed
from app.services.auto_mode_service import run_auto_if_needed
from app.services.ai_mode_service import run_ai_if_needed
from app.services.device_state_service import get_latest_state, upsert_state
from app.services.ingestion_service import ingest_payload
from app.services.plant_classifier_service import ml_runtime_status
from app.services.poller import poller
from app.services.facades.device_facade import device_facade
from app.services.facades.plant_care_facade import plant_facade


app = FastAPI(title="Smart Garden API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)
    db = next(get_db())
    try:
        if get_latest_state(db) is None:
            upsert_state(db, mode="manual")
        ensure_ai_seed(db)
    finally:
        db.close()
    poller.start()


@app.on_event("shutdown")
def on_shutdown():
    poller.stop()


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        database = "connected"
    except Exception:
        database = "disconnected"

    return {
        "status": "ok",
        "database": database,
        "ingestion": "running" if poller.running else "stopped",
        "ml": ml_runtime_status(
            model_path=settings.ml_model_path,
            labels_path=settings.ml_labels_path,
            enabled=settings.enable_ml_inference,
        ),
    }


# ---------------------------------------------------------------------------
# Sensors
# ---------------------------------------------------------------------------

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
    rows = db.query(SensorReading).order_by(SensorReading.recorded_at.desc()).limit(limit).all()
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


# ---------------------------------------------------------------------------
# System
# ---------------------------------------------------------------------------

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
    run_ai_if_needed(db, trigger="mock-ingest")
    return {"status": "inserted", "id": row.id, "recorded_at": row.recorded_at}


# ---------------------------------------------------------------------------
# Devices  →  DeviceFacade
# ---------------------------------------------------------------------------

@app.get("/api/v1/devices/state")
def get_device_state(db: Session = Depends(get_db)):
    return device_facade.get_state(db)


@app.post("/api/v1/system/mode")
def set_system_mode(req: SystemModeRequest, db: Session = Depends(get_db)):
    return device_facade.set_mode(db, req)


@app.post("/api/v1/devices/control")
def control_device(req: DeviceControlRequest, db: Session = Depends(get_db)):
    return device_facade.control(db, req)


# ---------------------------------------------------------------------------
# AI  →  PlantCareFacade
# ---------------------------------------------------------------------------

@app.post("/api/v1/ai/classify/image")
async def ai_classify_image(
    file: UploadFile = File(...),
    device_id: str | None = Form(None),
    db: Session = Depends(get_db),
):
    name = (file.filename or "").lower()
    if not name.endswith((".png", ".jpg", ".jpeg", ".webp")):
        raise HTTPException(status_code=400, detail="Định dạng file không được hỗ trợ (png, jpg, jpeg, webp)")
    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="File ảnh rỗng")

    try:
        return plant_facade.classify(db, image_bytes=image_bytes, device_id=device_id, filename=file.filename)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@app.post("/api/v1/ai/recommend")
def ai_recommend(req: AIRecommendRequest, db: Session = Depends(get_db)):
    return plant_facade.recommend(db, req)


@app.post("/api/v1/ai/apply")
def ai_apply(req: AIApplyRequest, db: Session = Depends(get_db)):
    return plant_facade.apply(db, req)


# ---------------------------------------------------------------------------
# Logs
# ---------------------------------------------------------------------------

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
    rows = db.query(SystemDecisionLog).order_by(SystemDecisionLog.created_at.desc()).limit(limit).all()
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


@app.get("/api/v1/ai/decisions")
def ai_decisions(limit: int = 20, db: Session = Depends(get_db)):
    limit = max(1, min(200, limit))
    rows = db.query(AIDecisionLog).order_by(AIDecisionLog.created_at.desc()).limit(limit).all()
    return [
        {
            "id": r.id,
            "created_at": r.created_at,
            "device_id": r.device_id,
            "mode": r.mode,
            "step": r.step,
            "input_json": r.input_json,
            "output_json": r.output_json,
            "safety_passed": r.safety_passed,
            "safety_reason": r.safety_reason,
            "executed": r.executed,
            "execution_note": r.execution_note,
        }
        for r in rows
    ]
