from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.device_state import DeviceState


def get_latest_state(db: Session) -> DeviceState | None:
    return db.query(DeviceState).order_by(DeviceState.recorded_at.desc()).first()


def upsert_state(
    db: Session,
    *,
    pump_state: bool | None = None,
    fan_state: bool | None = None,
    light_state: bool | None = None,
    mode: str | None = None,
) -> DeviceState:
    latest = get_latest_state(db)

    new_state = DeviceState(
        recorded_at=datetime.now(timezone.utc),
        pump_state=(pump_state if pump_state is not None else (latest.pump_state if latest else False)),
        fan_state=(fan_state if fan_state is not None else (latest.fan_state if latest else False)),
        light_state=(light_state if light_state is not None else (latest.light_state if latest else False)),
        mode=(mode if mode is not None else (latest.mode if latest else "manual")),
    )

    db.add(new_state)
    db.commit()
    db.refresh(new_state)
    return new_state
