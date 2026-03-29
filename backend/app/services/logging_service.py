from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.control_log import ControlLog
from app.models.system_decision_log import SystemDecisionLog


def create_control_log(
    db: Session,
    *,
    target_device: str,
    action: str,
    actor_type: str,
    reason: str,
    status: str,
    note: str | None = None,
) -> ControlLog:
    row = ControlLog(
        created_at=datetime.now(timezone.utc),
        target_device=target_device,
        action=action,
        actor_type=actor_type,
        reason=reason,
        status=status,
        note=note,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def create_system_decision_log(
    db: Session,
    *,
    mode: str,
    trigger_type: str,
    sensor_snapshot: dict,
    recommended_action: str,
    executed: bool,
    execution_note: str | None = None,
) -> SystemDecisionLog:
    row = SystemDecisionLog(
        created_at=datetime.now(timezone.utc),
        mode=mode,
        trigger_type=trigger_type,
        sensor_snapshot=SystemDecisionLog.snapshot_to_text(sensor_snapshot),
        recommended_action=recommended_action,
        executed=executed,
        execution_note=execution_note,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row
