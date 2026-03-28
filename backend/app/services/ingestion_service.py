import json
from datetime import datetime, timezone

import requests
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.sensor_reading import SensorReading
from app.schemas.sensors import SensorIngestRequest


def _parse_adafruit_value(value: str) -> dict:
    try:
        return json.loads(value)
    except Exception:
        return {}


def validate_and_normalize(payload: SensorIngestRequest, source: str) -> SensorReading:
    recorded_at = payload.recorded_at
    if recorded_at is None:
        recorded_at = datetime.now(timezone.utc)

    return SensorReading(
        recorded_at=recorded_at,
        air_temperature=float(payload.air_temperature) if payload.air_temperature is not None else 0.0,
        air_humidity=float(payload.air_humidity) if payload.air_humidity is not None else 0.0,
        soil_moisture=float(payload.soil_moisture) if payload.soil_moisture is not None else 0.0,
        light_level=float(payload.light_level) if payload.light_level is not None else 0.0,
        source=source,
        device_id=payload.device_id,
    )


def ingest_payload(db: Session, payload: SensorIngestRequest, source: str) -> SensorReading:
    row = validate_and_normalize(payload, source=source)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def poll_latest_from_adafruit() -> SensorIngestRequest | None:
    if not settings.adafruit_io_username or not settings.adafruit_io_key:
        return None

    url = (
        f"https://io.adafruit.com/api/v2/{settings.adafruit_io_username}"
        f"/feeds/{settings.adafruit_feed_key}/data/last"
    )

    r = requests.get(url, headers={"X-AIO-Key": settings.adafruit_io_key}, timeout=10)
    r.raise_for_status()
    data = r.json()

    value = data.get("value")
    if not isinstance(value, str):
        return None

    obj = _parse_adafruit_value(value)
    if not obj:
        return None

    return SensorIngestRequest(**obj)
