from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "smart-garden-api"
    app_env: str = "development"
    api_prefix: str = "/api/v1"

    cors_origins: str = "http://localhost:5173"

    postgres_host: str | None = None
    postgres_port: int = 5432
    postgres_db: str = "smart_garden"
    postgres_user: str = "postgres"
    postgres_password: str = "postgres"

    database_url: str | None = None

    adafruit_io_username: str | None = None
    adafruit_io_key: str | None = None
    # adafruit_feed_key: str = "smart-garden-sensors"
    adafruit_feed_key: str = "dadn-temperature"
    ingestion_poll_seconds: int = 5
    enable_adafruit_polling: bool = False

    class Config:
        env_file = "backend/.env"
        extra = "ignore"


settings = Settings()
