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
from app.models.ai_decision_log import AIDecisionLog
from app.models.plant_profile import PlantProfile
from app.schemas.ai import (
    AIApplyRequest,
    AIApplyResponse,
    AIClassifyResponse,
    AIRecommendRequest, 
    AIRecommendResponse,
    PlantProfileResponse,
    SensorSnapshot,
)
from app.schemas.devices import (
    DeviceControlRequest,
    DeviceControlResponse,
    DeviceStateResponse,
    SystemModeRequest,
    SystemModeResponse,
)
from app.schemas.sensors import SensorIngestRequest, SensorLatestResponse, SystemStatusResponse
from app.services.ai_service import ensure_ai_seed
from app.observers import sensor_publisher, AutoModeObserver, AIModeObserver
from app.observers.events import SensorReadingEvent
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

    # Đăng ký các observer vào publisher (Observer Pattern)
    sensor_publisher.subscribe(AutoModeObserver())
    sensor_publisher.subscribe(AIModeObserver())

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
    sensor_publisher.notify(SensorReadingEvent(db=db, trigger="mock-ingest", sensor_id=row.id))
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


@app.post("/api/v1/ai/classify/image", response_model=AIClassifyResponse)
async def ai_classify_image(
    file: UploadFile = File(...),
    device_id: str | None = Form(None),
    db: Session = Depends(get_db),
):
    name = (file.filename or "").lower()
    if not name.endswith((".png", ".jpg", ".jpeg", ".webp")):
        raise HTTPException(
            status_code=400,
            detail="Định dạng file không được hỗ trợ (png, jpg, jpeg, webp)",
        )
    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="File ảnh rỗng")

    try:
        out = classify_from_image_bytes(db, image_bytes=image_bytes, device_id=device_id)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    create_ai_log(
        db,
        device_id=device_id,
        step="classify",
        input_obj={"filename": file.filename, "device_id": device_id},
        output_obj=out,
        safety_passed=True,
    )
    return AIClassifyResponse(**out)


@app.post("/api/v1/ai/recommend", response_model=AIRecommendResponse)
def ai_recommend(req: AIRecommendRequest, db: Session = Depends(get_db)):
    ensure_ai_seed(db)
    state = get_latest_state(db)
    current_mode = state.mode if state else "manual"
    if current_mode != "ai":
        row = get_profile(db, plant_key=req.plant_key)
        out = {
            "plant_key": req.plant_key,
            "display_name": row.display_name if row else "Unknown",
            "sensor_used": SensorSnapshot().model_dump(),
            "actions": [],
            "safety_passed": False,
            "safety_reason": "AI recommend requires system mode=ai",
        }
        create_ai_log(
            db,
            device_id=req.device_id,
            step="recommend",
            input_obj=req.model_dump(),
            output_obj=out,
            safety_passed=False,
            safety_reason="not in ai mode",
        )
        return AIRecommendResponse(**out)

    row = get_profile(db, plant_key=req.plant_key)
    if row is None:
        out = {
            "plant_key": req.plant_key,
            "display_name": "Unknown",
            "sensor_used": SensorSnapshot().model_dump(),
            "actions": [],
            "safety_passed": False,
            "safety_reason": "unknown plant_key",
        }
        create_ai_log(
            db,
            device_id=req.device_id,
            step="recommend",
            input_obj=req.model_dump(),
            output_obj=out,
            safety_passed=False,
            safety_reason="unknown plant_key",
        )
        return AIRecommendResponse(**out)

    profile = parse_profile_json(row)

    if req.sensor is not None:
        sensor_used = req.sensor.model_dump()
    else:
        latest = db.query(SensorReading).order_by(SensorReading.recorded_at.desc()).first()
        sensor_used = sensor_to_snapshot(latest) if latest else SensorSnapshot().model_dump()

    actions = recommend_actions(profile=profile, sensor=sensor_used)
    ok, reason = safety_check(profile=profile, sensor=sensor_used, actions=actions)

    out = {
        "plant_key": row.plant_key,
        "display_name": row.display_name,
        "sensor_used": sensor_used,
        "actions": actions,
        "safety_passed": ok,
        "safety_reason": reason,
    }
    create_ai_log(
        db,
        device_id=req.device_id,
        step="recommend",
        input_obj=req.model_dump(),
        output_obj=out,
        safety_passed=ok,
        safety_reason=reason,
    )
    return AIRecommendResponse(**out)


@app.get("/api/v1/ai/profile/{plant_key}", response_model=PlantProfileResponse)
def ai_profile(plant_key: str, db: Session = Depends(get_db)):
    ensure_ai_seed(db)
    row = get_profile(db, plant_key=plant_key)
    if row is None:
        raise HTTPException(status_code=404, detail=f"Plant profile not found: {plant_key}")
    profile = parse_profile_json(row)
    return PlantProfileResponse(
        plant_key=row.plant_key,
        display_name=row.display_name,
        profile=profile,
    )


@app.post("/api/v1/ai/apply", response_model=AIApplyResponse)
def ai_apply(req: AIApplyRequest, db: Session = Depends(get_db)):
    state = get_latest_state(db)
    current_mode = state.mode if state else "manual"
    if current_mode != "ai":
        out = {"success": False, "message": "AI apply is only allowed in ai mode", "command_ids": []}
        create_ai_log(
            db,
            device_id=req.device_id,
            step="apply",
            input_obj=req.model_dump(),
            output_obj=out,
            safety_passed=False,
            safety_reason="not in ai mode",
            executed=False,
            execution_note="blocked",
        )
        return AIApplyResponse(**out)

    row = get_profile(db, plant_key=req.plant_key)
    profile = parse_profile_json(row) if row else {}

    # Safety gate again at apply time
    latest = db.query(SensorReading).order_by(SensorReading.recorded_at.desc()).first()
    sensor_used = sensor_to_snapshot(latest) if latest else {}
    actions = [a.model_dump() for a in req.actions]
    ok, reason = safety_check(profile=profile, sensor=sensor_used, actions=actions)
    if not ok:
        out = {"success": False, "message": f"Blocked by safety: {reason}", "command_ids": []}
        create_ai_log(
            db,
            device_id=req.device_id,
            step="apply",
            input_obj=req.model_dump(),
            output_obj=out,
            safety_passed=False,
            safety_reason=reason,
            executed=False,
            execution_note="blocked",
        )
        return AIApplyResponse(**out)

    command_ids: list[str] = []
    overall_ok = True
    notes: list[str] = []
    for a in actions:
        cmd = build_command(
            target_device=a["target_device"],
            action=a["action"],
            mode="ai",
            requested_by="ai",
            reason=req.reason,
        )
        try:
            publish_command(cmd)
            status = "success"
            note = None
            ok_cmd = True
        except Exception as e:
            status = "failed"
            note = str(e)
            ok_cmd = False
            overall_ok = False
            notes.append(note)

        log = create_control_log(
            db,
            target_device=a["target_device"],
            action=a["action"],
            actor_type="ai",
            reason=req.reason,
            status=status,
            note=note,
        )
        command_ids.append(str(log.id))

        # Update state only when publish succeeded
        if ok_cmd:
            if a["target_device"] == "pump":
                upsert_state(db, pump_state=(a["action"] == "on"))
            elif a["target_device"] == "fan":
                upsert_state(db, fan_state=(a["action"] == "on"))
            elif a["target_device"] == "light":
                upsert_state(db, light_state=(a["action"] == "on"))

    out = {
        "success": overall_ok,
        "message": "Applied AI actions" if overall_ok else ("Applied with errors: " + "; ".join(notes)),
        "command_ids": command_ids,
    }
    create_ai_log(
        db,
        device_id=req.device_id,
        step="apply",
        input_obj=req.model_dump(),
        output_obj=out,
        safety_passed=True,
        executed=True,
        execution_note="published" if overall_ok else "partial",
    )
    return AIApplyResponse(**out)


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
