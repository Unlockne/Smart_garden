from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.sensor_reading import SensorReading
from app.services.adafruit_command_service import build_command, publish_command
from app.services.device_state_service import get_latest_state, upsert_state
from app.services.logging_service import create_control_log, create_system_decision_log


def _decide(sensor: SensorReading, state) -> list[tuple[str, str, str]]:
    actions: list[tuple[str, str, str]] = []

    if sensor.soil_moisture < settings.auto_soil_on and not state.pump_state:
        actions.append(("pump", "on", "auto mode: soil_moisture below threshold"))
    elif sensor.soil_moisture >= settings.auto_soil_off and state.pump_state:
        actions.append(("pump", "off", "auto mode: soil_moisture above threshold"))

    if sensor.air_temperature > settings.auto_temp_on and not state.fan_state:
        actions.append(("fan", "on", "auto mode: air_temperature above threshold"))
    elif sensor.air_temperature <= settings.auto_temp_off and state.fan_state:
        actions.append(("fan", "off", "auto mode: air_temperature below threshold"))

    if sensor.light_level < settings.auto_light_on and not state.light_state:
        actions.append(("light", "on", "auto mode: light_level below threshold"))
    elif sensor.light_level >= settings.auto_light_off and state.light_state:
        actions.append(("light", "off", "auto mode: light_level above threshold"))

    return actions


def run_auto_if_needed(db: Session, *, trigger: str) -> None:
    if not settings.enable_auto_mode:
        return

    state = get_latest_state(db)
    if state is None:
        state = upsert_state(db, mode="manual")

    if state.mode != "auto":
        return

    sensor = db.query(SensorReading).order_by(SensorReading.recorded_at.desc()).first()
    if sensor is None:
        return

    actions = _decide(sensor, state)
    snapshot = {
        "recorded_at": sensor.recorded_at.isoformat(),
        "air_temperature": sensor.air_temperature,
        "air_humidity": sensor.air_humidity,
        "soil_moisture": sensor.soil_moisture,
        "light_level": sensor.light_level,
        "device_id": sensor.device_id,
        "source": sensor.source,
    }

    for target_device, action, reason in actions:
        recommended_action = f"{target_device}:{action}"
        try:
            cmd = build_command(
                target_device=target_device,
                action=action,
                mode="auto",
                requested_by="system",
                reason=reason,
            )
            publish_command(cmd)
            create_system_decision_log(
                db,
                mode="auto",
                trigger_type=trigger,
                sensor_snapshot=snapshot,
                recommended_action=recommended_action,
                executed=True,
                execution_note="published",
            )
            create_control_log(
                db,
                target_device=target_device,
                action=action,
                actor_type="system",
                reason=reason,
                status="success",
            )

            if target_device == "pump":
                state = upsert_state(db, pump_state=(action == "on"))
            elif target_device == "fan":
                state = upsert_state(db, fan_state=(action == "on"))
            elif target_device == "light":
                state = upsert_state(db, light_state=(action == "on"))
        except Exception as e:
            create_system_decision_log(
                db,
                mode="auto",
                trigger_type=trigger,
                sensor_snapshot=snapshot,
                recommended_action=recommended_action,
                executed=False,
                execution_note=str(e),
            )
            create_control_log(
                db,
                target_device=target_device,
                action=action,
                actor_type="system",
                reason=reason,
                status="failed",
                note=str(e),
            )
