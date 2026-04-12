import json

from sqlalchemy import Column, DateTime, Integer, String, Text

from app.core.database import Base


class PlantProfile(Base):
    __tablename__ = "plant_profiles"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, index=True)

    plant_key = Column(String(80), nullable=False, unique=True, index=True)
    display_name = Column(String(120), nullable=False)

    profile_json = Column(Text, nullable=False)

    @staticmethod
    def profile_to_text(profile: dict) -> str:
        return json.dumps(profile, ensure_ascii=False)

