from __future__ import annotations

import json
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.ai_decision_log import AIDecisionLog
from app.models.plant_profile import PlantProfile
from app.models.sensor_reading import SensorReading

# Map class name trong ml/models/labels.json -> plant_key trong PlantProfile (seed)
ML_CLASS_TO_PLANT_KEY: dict[str, str] = {
    "Succulents": "aloe",
    "LeafyPlant": "basil",
    "FloweringPlant": "fern",
}


def _seed_profiles_if_empty(db: Session) -> None:
    exists = db.query(PlantProfile).first()
    if exists is not None:
        return

    now = datetime.now(timezone.utc)
    defaults: list[tuple[str, str, dict]] = [
        (
            "basil",
            "Húng quế (Basil)",
            {
                "soil_moisture_min": 35.0,
                "soil_moisture_max": 70.0,
                "temp_min": 18.0,
                "temp_max": 32.0,
                "light_min": 200.0,
                "notes": "Profile MVP (seed). Điều chỉnh theo thực nghiệm.",
            },
        ),
        (
            "aloe",
            "Nha đam (Aloe vera)",
            {
                "soil_moisture_min": 15.0,
                "soil_moisture_max": 45.0,
                "temp_min": 15.0,
                "temp_max": 35.0,
                "light_min": 250.0,
                "notes": "Profile MVP (seed).",
            },
        ),
        (
            "fern",
            "Dương xỉ (Fern)",
            {
                "soil_moisture_min": 45.0,
                "soil_moisture_max": 85.0,
                "temp_min": 16.0,
                "temp_max": 30.0,
                "light_min": 100.0,
                "notes": "Profile MVP (seed).",
            },
        ),
    ]

    for plant_key, display_name, profile in defaults:
        db.add(
            PlantProfile(
                created_at=now,
                plant_key=plant_key,
                display_name=display_name,
                profile_json=PlantProfile.profile_to_text(profile),
            )
        )
    db.commit()


def ensure_ai_seed(db: Session) -> None:
    _seed_profiles_if_empty(db)


def get_profile(db: Session, *, plant_key: str) -> PlantProfile | None:
    return db.query(PlantProfile).filter(PlantProfile.plant_key == plant_key).first()


def classify_from_image_bytes(db: Session, *, image_bytes: bytes, device_id: str | None) -> dict:
    """Inference Keras + map sang plant_key / display_name / candidates (method=keras)."""
    from app.services.plant_classifier_service import predict_image

    if not settings.enable_ml_inference:
        raise RuntimeError("ML inference is disabled (enable_ml_inference=false)")

    ensure_ai_seed(db)
    raw = predict_image(
        image_bytes,
        model_path=settings.ml_model_path,
        labels_path=settings.ml_labels_path,
    )
    predicted_class = raw["predicted_plant"]
    plant_key = ML_CLASS_TO_PLANT_KEY.get(predicted_class, "unknown")
    row = get_profile(db, plant_key=plant_key) if plant_key != "unknown" else None
    display_name = row.display_name if row else ("Unknown" if plant_key == "unknown" else predicted_class)

    probs: dict[str, float] = raw["all_probabilities"]
    sorted_names = sorted(probs.keys(), key=lambda n: probs[n], reverse=True)[:3]
    candidates: list[dict] = []
    for name in sorted_names:
        pk = ML_CLASS_TO_PLANT_KEY.get(name, "unknown")
        prof = get_profile(db, plant_key=pk) if pk != "unknown" else None
        candidates.append(
            {
                "plant_key": pk,
                "display_name": prof.display_name if prof else name,
                "confidence": float(probs[name]),
            }
        )

    return {
        "plant_key": plant_key,
        "display_name": display_name,
        "confidence": float(raw["confidence"]),
        "method": "keras",
        "candidates": candidates,
        "predicted_class": predicted_class,
        "plant_group": raw["plant_group"],
        "all_probabilities": raw["all_probabilities"],
    }


def classify_fallback(db: Session, *, hint: str | None) -> tuple[str, str, float, list[dict]]:
    ensure_ai_seed(db)
    hint_norm = (hint or "").strip().lower()

    candidates: list[PlantProfile] = db.query(PlantProfile).order_by(PlantProfile.plant_key.asc()).all()
    if not candidates:
        return ("unknown", "Unknown", 0.0, [])

    chosen: PlantProfile | None = None
    if hint_norm:
        for c in candidates:
            if hint_norm in c.plant_key.lower() or hint_norm in c.display_name.lower():
                chosen = c
                break

    if chosen is None:
        chosen = candidates[0]

    serialized_candidates = [
        {"plant_key": c.plant_key, "display_name": c.display_name, "confidence": 0.34} for c in candidates[:3]
    ]
    return (chosen.plant_key, chosen.display_name, 0.34, serialized_candidates)


def _latest_sensor(db: Session) -> SensorReading | None:
    return db.query(SensorReading).order_by(SensorReading.recorded_at.desc()).first()


def recommend_actions(*, profile: dict, sensor: dict) -> list[dict]:
    actions: list[dict] = []

    soil = sensor.get("soil_moisture")
    temp = sensor.get("air_temperature")

    soil_min = profile.get("soil_moisture_min")
    soil_max = profile.get("soil_moisture_max")
    temp_max = profile.get("temp_max")

    if soil is not None and soil_min is not None and soil < float(soil_min):
        actions.append({"target_device": "pump", "action": "on", "reason": "ai: soil_moisture below plant minimum"})
    if soil is not None and soil_max is not None and soil > float(soil_max):
        actions.append({"target_device": "pump", "action": "off", "reason": "ai: soil_moisture above plant maximum"})

    if temp is not None and temp_max is not None and temp > float(temp_max):
        actions.append({"target_device": "fan", "action": "on", "reason": "ai: temperature above plant maximum"})

    return actions


def safety_check(*, profile: dict, sensor: dict, actions: list[dict]) -> tuple[bool, str | None]:
    # MVP safety rules: avoid pumping when soil moisture already high,
    # and avoid conflicting actions (pump on + off).
    soil = sensor.get("soil_moisture")
    soil_max = profile.get("soil_moisture_max")

    wants_pump_on = any(a["target_device"] == "pump" and a["action"] == "on" for a in actions)
    wants_pump_off = any(a["target_device"] == "pump" and a["action"] == "off" for a in actions)
    if wants_pump_on and wants_pump_off:
        return (False, "conflicting pump actions")

    if wants_pump_on and soil is not None and soil_max is not None and soil >= float(soil_max):
        return (False, "blocked: soil moisture already above maximum")

    return (True, None)


def create_ai_log(
    db: Session,
    *,
    device_id: str | None,
    step: str,
    input_obj: dict,
    output_obj: dict,
    safety_passed: bool,
    safety_reason: str | None = None,
    executed: bool = False,
    execution_note: str | None = None,
) -> AIDecisionLog:
    row = AIDecisionLog(
        created_at=datetime.now(timezone.utc),
        device_id=device_id,
        mode="ai",
        step=step,
        input_json=AIDecisionLog.json_to_text(input_obj),
        output_json=AIDecisionLog.json_to_text(output_obj),
        safety_passed=safety_passed,
        safety_reason=safety_reason,
        executed=executed,
        execution_note=execution_note,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def sensor_to_snapshot(sensor: SensorReading) -> dict:
    return {
        "recorded_at": sensor.recorded_at,
        "air_temperature": sensor.air_temperature,
        "air_humidity": sensor.air_humidity,
        "soil_moisture": sensor.soil_moisture,
        "light_level": sensor.light_level,
        "device_id": sensor.device_id,
    }


def parse_profile_json(row: PlantProfile) -> dict:
    try:
        return json.loads(row.profile_json)
    except Exception:
        return {}

