from datetime import datetime, timezone
from typing import Literal

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


class SensorLatestResponse(BaseModel):
    recorded_at: datetime
    air_temperature: float
    air_humidity: float
    soil_moisture: float
    light_level: float


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
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/api/v1/sensors/latest", response_model=SensorLatestResponse)
def get_latest_sensor():
    now = datetime.now(timezone.utc)
    return SensorLatestResponse(
        recorded_at=now,
        air_temperature=30.2,
        air_humidity=68.5,
        soil_moisture=27.1,
        light_level=412.0,
    )


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
