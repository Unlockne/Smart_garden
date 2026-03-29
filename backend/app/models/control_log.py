from sqlalchemy import Column, DateTime, Integer, String, Text

from app.core.database import Base


class ControlLog(Base):
    __tablename__ = "control_logs"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, index=True)

    target_device = Column(String(20), nullable=False)
    action = Column(String(10), nullable=False)

    actor_type = Column(String(20), nullable=False)
    reason = Column(Text, nullable=True)

    status = Column(String(20), nullable=False, default="pending")
    note = Column(Text, nullable=True)
