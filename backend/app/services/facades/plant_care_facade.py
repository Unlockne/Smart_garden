from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.sensor_reading import SensorReading
from app.schemas.ai import (
    AIApplyRequest,
    AIApplyResponse,
    AIClassifyResponse,
    AIRecommendRequest,
    AIRecommendResponse,
    SensorSnapshot,
)
from app.services.adafruit_command_service import build_command, publish_command
from app.services.ai_service import (
    classify_from_image_bytes,
    create_ai_log,
    ensure_ai_seed,
    get_profile,
    parse_profile_json,
    recommend_actions,
    safety_check,
    sensor_to_snapshot,
)
from app.services.device_state_service import get_latest_state, upsert_state
from app.services.logging_service import create_control_log


class PlantCareFacade:
    """Facade che toàn bộ orchestration của AI/plant pipeline.

    Route chỉ cần gọi một method — facade tự gọi các service
    theo đúng thứ tự: validate mode → lấy profile → sensor →
    recommend → safety check → publish → log.
    """

    def classify(
        self,
        db: Session,
        *,
        image_bytes: bytes,
        device_id: str | None,
        filename: str | None,
    ) -> AIClassifyResponse:
        out = classify_from_image_bytes(db, image_bytes=image_bytes, device_id=device_id)
        create_ai_log(
            db,
            device_id=device_id,
            step="classify",
            input_obj={"filename": filename, "device_id": device_id},
            output_obj=out,
            safety_passed=True,
        )
        return AIClassifyResponse(**out)

    def recommend(self, db: Session, req: AIRecommendRequest) -> AIRecommendResponse:
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

    def apply(self, db: Session, req: AIApplyRequest) -> AIApplyResponse:
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


plant_facade = PlantCareFacade()
