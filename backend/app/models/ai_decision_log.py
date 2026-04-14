import json

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text

from app.core.database import Base


class AIDecisionLog(Base):
    __tablename__ = "ai_decision_logs"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, index=True)

    device_id = Column(String(100), nullable=True, index=True)
    mode = Column(String(20), nullable=False, default="ai")
    step = Column(String(40), nullable=False)  # classify/profile/recommend/safety/apply

    input_json = Column(Text, nullable=False)
    output_json = Column(Text, nullable=False)

    safety_passed = Column(Boolean, nullable=False, default=False)
    safety_reason = Column(Text, nullable=True)

    executed = Column(Boolean, nullable=False, default=False)
    execution_note = Column(Text, nullable=True)

    @staticmethod
    def json_to_text(obj: dict) -> str:
        # Support datetime and other non-JSON-native values in logs.
        return json.dumps(obj, ensure_ascii=False, default=str)

