import json

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text

from app.core.database import Base


class SystemDecisionLog(Base):
    __tablename__ = "system_decision_logs"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, index=True)

    mode = Column(String(20), nullable=False)
    trigger_type = Column(String(50), nullable=False)
    sensor_snapshot = Column(Text, nullable=False)
    recommended_action = Column(String(100), nullable=False)

    executed = Column(Boolean, nullable=False, default=False)
    execution_note = Column(Text, nullable=True)

    @staticmethod
    def snapshot_to_text(snapshot: dict) -> str:
        return json.dumps(snapshot, ensure_ascii=False)
