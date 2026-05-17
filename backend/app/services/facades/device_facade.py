from __future__ import annotations

from sqlalchemy.orm import Session

from app.schemas.devices import (
    DeviceControlRequest,
    DeviceControlResponse,
    DeviceStateResponse,
    SystemModeRequest,
    SystemModeResponse,
)
from app.services.adafruit_command_service import build_command, publish_command
from app.services.device_state_service import get_latest_state, upsert_state
from app.services.logging_service import create_control_log


class DeviceFacade:
    """Facade che toàn bộ orchestration của device control.

    Route chỉ cần gọi một method — facade tự xử lý: check mode →
    build command → publish IoT → log → update state.
    """

    def get_state(self, db: Session) -> DeviceStateResponse:
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

    def set_mode(self, db: Session, req: SystemModeRequest) -> SystemModeResponse:
        upsert_state(db, mode=req.mode)
        return SystemModeResponse(success=True, mode=req.mode)

    def control(self, db: Session, req: DeviceControlRequest) -> DeviceControlResponse:
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
            return DeviceControlResponse(
                success=False,
                message="Manual control is disabled in auto mode",
                command_id=str(log.id),
            )

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

        if ok:
            if req.target_device == "pump":
                upsert_state(db, pump_state=(req.action == "on"))
            elif req.target_device == "fan":
                upsert_state(db, fan_state=(req.action == "on"))
            elif req.target_device == "light":
                upsert_state(db, light_state=(req.action == "on"))

        return DeviceControlResponse(success=ok, message=message, command_id=str(log.id))


device_facade = DeviceFacade()
