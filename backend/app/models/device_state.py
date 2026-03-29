from sqlalchemy import Boolean, Column, DateTime, Integer, String

from app.core.database import Base


class DeviceState(Base):
    __tablename__ = "device_states"

    id = Column(Integer, primary_key=True, index=True)
    recorded_at = Column(DateTime(timezone=True), nullable=False, index=True)

    pump_state = Column(Boolean, nullable=False, default=False)
    fan_state = Column(Boolean, nullable=False, default=False)
    light_state = Column(Boolean, nullable=False, default=False)

    mode = Column(String(20), nullable=False, default="manual")
