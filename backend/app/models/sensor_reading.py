from sqlalchemy import Column, DateTime, Float, Integer, String

from app.core.database import Base


class SensorReading(Base):
    __tablename__ = "sensor_readings"

    id = Column(Integer, primary_key=True, index=True)
    recorded_at = Column(DateTime(timezone=True), nullable=False, index=True)

    air_temperature = Column(Float, nullable=True)
    air_humidity = Column(Float, nullable=True)    
    soil_moisture = Column(Float, nullable=True)   
    light_level = Column(Float, nullable=True)     

    source = Column(String(50), nullable=False, default="device")
    device_id = Column(String(100), nullable=True)
