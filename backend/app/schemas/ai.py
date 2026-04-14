from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.devices import Action, TargetDevice


class PlantCandidate(BaseModel):
    plant_key: str
    display_name: str
    confidence: float = Field(ge=0.0, le=1.0)


class AIClassifyRequest(BaseModel):
    device_id: str | None = None
    image_url: str | None = None
    hint: str | None = None  # optional text hint from user (e.g. "basil")


class AIClassifyResponse(BaseModel):
    plant_key: str
    display_name: str
    confidence: float = Field(ge=0.0, le=1.0)
    method: Literal["fallback", "keras"] = "fallback"
    message: str | None = None
    candidates: list[PlantCandidate] = []
    predicted_class: str | None = None  # tên lớp từ model (labels.json)
    plant_group: str | None = None  # ví dụ succulent, flowering
    all_probabilities: dict[str, float] | None = None


class PlantProfileResponse(BaseModel):
    plant_key: str
    display_name: str
    profile: dict


class SensorSnapshot(BaseModel):
    recorded_at: datetime | None = None
    air_temperature: float | None = None
    air_humidity: float | None = None
    soil_moisture: float | None = None
    light_level: float | None = None
    device_id: str | None = None


class RecommendationAction(BaseModel):
    target_device: TargetDevice
    action: Action
    reason: str


class AIRecommendRequest(BaseModel):
    plant_key: str
    device_id: str | None = None
    sensor: SensorSnapshot | None = None  # optional override; if empty, backend uses latest sensor


class AIRecommendResponse(BaseModel):
    plant_key: str
    display_name: str
    sensor_used: SensorSnapshot
    actions: list[RecommendationAction]
    safety_passed: bool
    safety_reason: str | None = None


class AIApplyRequest(BaseModel):
    plant_key: str
    device_id: str | None = None
    actions: list[RecommendationAction]
    reason: str = "ai recommendation"


class AIApplyResponse(BaseModel):
    success: bool
    message: str
    command_ids: list[str] = []

