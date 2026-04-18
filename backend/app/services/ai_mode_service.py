import json
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.ai_decision_log import AIDecisionLog
from app.models.sensor_reading import SensorReading
from app.services.adafruit_command_service import build_command, publish_command
from app.services.ai_service import create_ai_log, get_profile, parse_profile_json, recommend_actions, safety_check
from app.services.device_state_service import get_latest_state, upsert_state
from app.services.logging_service import create_control_log


def _json_safe(obj):
    if isinstance(obj, datetime):
        return obj.isoformat()
    if isinstance(obj, dict):
        return {k: _json_safe(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_json_safe(v) for v in obj]
    return obj


def _latest_selected_plant_key(db: Session) -> str | None:
    rows = db.query(AIDecisionLog).order_by(AIDecisionLog.created_at.desc()).limit(50).all()
    for row in rows:
        if row.step not in {"classify", "recommend"}:
            continue
        try:
            payload = json.loads(row.output_json) if row.output_json else {}
        except Exception:
            payload = {}
        if not isinstance(payload, dict):
            continue
        key = payload.get("plant_key")
        if isinstance(key, str) and key.strip():
            return key.strip()
    return None


def _latest_sensor_snapshot(db: Session) -> dict | None:
    sensor = db.query(SensorReading).order_by(SensorReading.recorded_at.desc()).first()
    if sensor is None:
        return None
    return {
        "recorded_at": sensor.recorded_at,
        "air_temperature": sensor.air_temperature,
        "air_humidity": sensor.air_humidity,
        "soil_moisture": sensor.soil_moisture,
        "light_level": sensor.light_level,
        "device_id": sensor.device_id,
    }


def run_ai_if_needed(db: Session, *, trigger: str) -> None:
    state = get_latest_state(db)
    if state is None:
        state = upsert_state(db, mode="manual")

    if state.mode != "ai":
        return

    plant_key = _latest_selected_plant_key(db)
    if not plant_key:
        return

    row = get_profile(db, plant_key=plant_key)
    sensor_snapshot = _latest_sensor_snapshot(db)
    if sensor_snapshot is None:
        return

    if row is None:
        create_ai_log(
            db,
            device_id="ai-daemon",
            step="recommend",
            input_obj={"plant_key": plant_key, "trigger": trigger, "sensor": _json_safe(sensor_snapshot)},
            output_obj={
                "plant_key": plant_key,
                "display_name": "Unknown",
                "sensor_used": _json_safe(sensor_snapshot),
                "actions": [],
                "safety_passed": False,
                "safety_reason": "unknown plant_key",
            },
            safety_passed=False,
            safety_reason="unknown plant_key",
        )
        return

    profile = parse_profile_json(row)
    actions = recommend_actions(profile=profile, sensor=sensor_snapshot)
    ok, reason = safety_check(profile=profile, sensor=sensor_snapshot, actions=actions)

    recommend_out = {
        "plant_key": row.plant_key,
        "display_name": row.display_name,
        "sensor_used": _json_safe(sensor_snapshot),
        "actions": actions,
        "safety_passed": ok,
        "safety_reason": reason,
    }
    create_ai_log(
        db,
        device_id="ai-daemon",
        step="recommend",
        input_obj={"plant_key": plant_key, "trigger": trigger, "sensor": _json_safe(sensor_snapshot)},
        output_obj=recommend_out,
        safety_passed=ok,
        safety_reason=reason,
    )

    if not ok or not actions:
        create_ai_log(
            db,
            device_id="ai-daemon",
            step="apply",
            input_obj={"plant_key": plant_key, "actions": actions, "trigger": trigger},
            output_obj={
                "success": False,
                "message": reason or "No actions generated",
                "command_ids": [],
            },
            safety_passed=ok,
            safety_reason=reason or "no actions",
            executed=False,
            execution_note="blocked" if not ok else "no-op",
        )
        return

    command_ids: list[str] = []
    overall_ok = True
    notes: list[str] = []
    for action in actions:
        target_device = action["target_device"]
        cmd_action = action["action"]
        cmd_reason = action["reason"]
        try:
            cmd = build_command(
                target_device=target_device,
                action=cmd_action,
                mode="ai",
                requested_by="ai",
                reason=cmd_reason,
            )
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
            target_device=target_device,
            action=cmd_action,
            actor_type="ai",
            reason=cmd_reason,
            status=status,
            note=note,
        )
        command_ids.append(str(log.id))

        if ok_cmd:
            if target_device == "pump":
                upsert_state(db, pump_state=(cmd_action == "on"))
            elif target_device == "fan":
                upsert_state(db, fan_state=(cmd_action == "on"))
            elif target_device == "light":
                upsert_state(db, light_state=(cmd_action == "on"))

    create_ai_log(
        db,
        device_id="ai-daemon",
        step="apply",
        input_obj={"plant_key": plant_key, "actions": actions, "trigger": trigger},
        output_obj={
            "success": overall_ok,
            "message": "Applied AI actions" if overall_ok else ("Applied with errors: " + "; ".join(notes)),
            "command_ids": command_ids,
        },
        safety_passed=True,
        executed=True,
        execution_note="published" if overall_ok else "partial",
    )
