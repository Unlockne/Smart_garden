import json
from datetime import datetime, timezone

import requests

from app.core.config import settings


def publish_command(payload: dict) -> None:
    if not settings.adafruit_io_username or not settings.adafruit_io_key:
        raise RuntimeError("Adafruit IO credentials are not configured (ADAFRUIT_IO_USERNAME/ADAFRUIT_IO_KEY)")

    url = (
        f"https://io.adafruit.com/api/v2/{settings.adafruit_io_username}"
        f"/feeds/{settings.adafruit_command_feed_key}/data"
    )

    value = json.dumps(payload)
    r = requests.post(
        url,
        headers={"X-AIO-Key": settings.adafruit_io_key, "Content-Type": "application/json"},
        json={"value": value},
        timeout=10,
    )
    r.raise_for_status()


def build_command(
    *,
    target_device: str,
    action: str,
    mode: str,
    requested_by: str,
    reason: str,
) -> dict:
    return {
        "target_device": target_device,
        "action": action,
        "mode": mode,
        "requested_by": requested_by,
        "reason": reason,
        "requested_at": datetime.now(timezone.utc).isoformat(),
    }
