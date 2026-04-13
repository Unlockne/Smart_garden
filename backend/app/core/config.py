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
    adafruit_feed_key: str = "smart-garden-sensors"
    adafruit_command_feed_key: str = "smart-garden-commands"
    ingestion_poll_seconds: int = 5
    enable_adafruit_polling: bool = False

    enable_auto_mode: bool = True
    auto_soil_on: float = 30
    auto_soil_off: float = 40
    auto_temp_on: float = 32
    auto_temp_off: float = 30
    auto_light_on: float = 20
    auto_light_off: float = 40

    class Config:
        env_file = "backend/.env"
        extra = "ignore"


settings = Settings()
