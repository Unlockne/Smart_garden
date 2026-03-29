from datetime import datetime
from typing import Literal

from pydantic import BaseModel


Mode = Literal["manual", "auto", "ai"]
TargetDevice = Literal["pump", "fan", "light"]
Action = Literal["on", "off"]
ActorType = Literal["user", "system", "ai"]


class DeviceStateResponse(BaseModel):
    recorded_at: datetime
    pump_state: bool
    fan_state: bool
    light_state: bool
    mode: Mode


class DeviceControlRequest(BaseModel):
    target_device: TargetDevice
    action: Action
    actor_type: ActorType = "user"
    reason: str = "manual control from dashboard"


class DeviceControlResponse(BaseModel):
    success: bool
    message: str
    command_id: str | None = None


class SystemModeRequest(BaseModel):
    mode: Mode


class SystemModeResponse(BaseModel):
    success: bool
    mode: Mode
