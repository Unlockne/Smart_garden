from datetime import datetime

from pydantic import BaseModel


class SensorIngestRequest(BaseModel):
    air_temperature: float | None = None
    air_humidity: float | None = None
    soil_moisture: float | None = None
    light_level: float | None = None
    device_id: str | None = None
    recorded_at: datetime | None = None


class SensorLatestResponse(BaseModel):
    recorded_at: datetime
    air_temperature: float
    air_humidity: float
    soil_moisture: float
    light_level: float
    device_id: str | None = None
    source: str


class SystemStatusResponse(BaseModel):
    last_ingested_at: datetime | None
    total_records: int
    latest_device_id: str | None
