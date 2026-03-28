from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import settings


def _build_db_url() -> str:
    if settings.database_url:
        return settings.database_url

    if settings.postgres_host:
        return (
            "postgresql+psycopg2://"
            f"{settings.postgres_user}:{settings.postgres_password}"
            f"@{settings.postgres_host}:{settings.postgres_port}/{settings.postgres_db}"
        )

    return "sqlite:///./smart_garden.db"


DATABASE_URL = _build_db_url()

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
