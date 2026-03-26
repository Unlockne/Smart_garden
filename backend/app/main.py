from datetime import datetime, timezone
import os
import sqlite3
import threading
from typing import Literal

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from dotenv import load_dotenv

from dateutil.parser import isoparse
import paho.mqtt.client as mqtt


_ENV_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env"))
load_dotenv(_ENV_PATH, override=False)


class SensorLatestResponse(BaseModel):
    recorded_at: datetime
    air_temperature: float
    air_humidity: float
    soil_moisture: float
    light_level: float


class DeviceStateResponse(BaseModel):
    recorded_at: datetime
    pump_state: bool
    fan_state: bool
    light_state: bool
    mode: Literal["manual", "auto", "ai"]


class DeviceControlRequest(BaseModel):
    target_device: Literal["pump", "fan", "light"]
    action: Literal["on", "off"]
    actor_type: Literal["user", "system", "ai"] = "user"
    reason: str = "manual control from dashboard"


class SensorHistoryItem(BaseModel):
    recorded_at: datetime
    air_temperature: float | None = None
    air_humidity: float | None = None
    soil_moisture: float | None = None
    light_level: float | None = None


app = FastAPI(title="Smart Garden API", version="0.1.0")

_cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173")
_cors_origin_list = [o.strip() for o in _cors_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


DB_PATH = os.getenv("SQLITE_PATH", os.path.join(os.path.dirname(__file__), "data.db"))


def _db_connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def _db_init() -> None:
    conn = _db_connect()
    try:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS sensor_readings (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              recorded_at TEXT NOT NULL,
              air_temperature REAL,
              air_humidity REAL,
              soil_moisture REAL,
              light_level REAL,
              source TEXT
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS device_states (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              recorded_at TEXT NOT NULL,
              pump_state INTEGER NOT NULL,
              fan_state INTEGER NOT NULL,
              light_state INTEGER NOT NULL,
              mode TEXT NOT NULL
            )
            """
        )
        conn.commit()
    finally:
        conn.close()


def _db_insert_sensor(**kwargs) -> None:
    conn = _db_connect()
    try:
        conn.execute(
            """
            INSERT INTO sensor_readings (
              recorded_at, air_temperature, air_humidity, soil_moisture, light_level, source
            ) VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                kwargs.get("recorded_at"),
                kwargs.get("air_temperature"),
                kwargs.get("air_humidity"),
                kwargs.get("soil_moisture"),
                kwargs.get("light_level"),
                kwargs.get("source"),
            ),
        )
        conn.commit()
    finally:
        conn.close()


def _db_get_latest_sensor() -> sqlite3.Row | None:
    conn = _db_connect()
    try:
        cur = conn.execute(
            """
            SELECT recorded_at, air_temperature, air_humidity, soil_moisture, light_level
            FROM sensor_readings
            ORDER BY recorded_at DESC
            LIMIT 1
            """
        )
        return cur.fetchone()
    finally:
        conn.close()


def _db_get_sensor_history(limit: int) -> list[sqlite3.Row]:
    conn = _db_connect()
    try:
        cur = conn.execute(
            """
            SELECT recorded_at, air_temperature, air_humidity, soil_moisture, light_level
            FROM sensor_readings
            ORDER BY recorded_at DESC
            LIMIT ?
            """,
            (limit,),
        )
        return cur.fetchall()
    finally:
        conn.close()


def _db_get_latest_device_state() -> sqlite3.Row | None:
    conn = _db_connect()
    try:
        cur = conn.execute(
            """
            SELECT recorded_at, pump_state, fan_state, light_state, mode
            FROM device_states
            ORDER BY recorded_at DESC
            LIMIT 1
            """
        )
        return cur.fetchone()
    finally:
        conn.close()


def _db_upsert_device_state(
    *, recorded_at: str, pump_state: bool, fan_state: bool, light_state: bool, mode: str
) -> None:
    conn = _db_connect()
    try:
        conn.execute(
            """
            INSERT INTO device_states (recorded_at, pump_state, fan_state, light_state, mode)
            VALUES (?, ?, ?, ?, ?)
            """,
            (recorded_at, int(pump_state), int(fan_state), int(light_state), mode),
        )
        conn.commit()
    finally:
        conn.close()


def _env(name: str, default: str | None = None) -> str | None:
    val = os.getenv(name)
    if val is None or val == "":
        return default
    return val


MQTT_BROKER = _env("ADAFRUIT_MQTT_BROKER", "io.adafruit.com")
MQTT_PORT = int(_env("ADAFRUIT_MQTT_PORT", "1883") or "1883")
ADAFRUIT_USERNAME = _env("ADAFRUIT_IO_USERNAME")
ADAFRUIT_KEY = _env("ADAFRUIT_IO_KEY")

FEED_AIR_TEMPERATURE = _env("ADAFRUIT_FEED_AIR_TEMPERATURE", "air-temperature")
FEED_AIR_HUMIDITY = _env("ADAFRUIT_FEED_AIR_HUMIDITY", "air-humidity")
FEED_SOIL_MOISTURE = _env("ADAFRUIT_FEED_SOIL_MOISTURE", "soil-moisture")
FEED_LIGHT_LEVEL = _env("ADAFRUIT_FEED_LIGHT_LEVEL", "light-level")

FEED_PUMP_CONTROL = _env("ADAFRUIT_FEED_PUMP_CONTROL", "pump-control")
FEED_FAN_CONTROL = _env("ADAFRUIT_FEED_FAN_CONTROL", "fan-control")
FEED_LIGHT_CONTROL = _env("ADAFRUIT_FEED_LIGHT_CONTROL", "light-control")

_mqtt_client: mqtt.Client | None = None
_mqtt_thread: threading.Thread | None = None


def _topic(feed: str) -> str:
    if ADAFRUIT_USERNAME is None:
        raise RuntimeError("ADAFRUIT_IO_USERNAME is not set")
    return f"{ADAFRUIT_USERNAME}/feeds/{feed}"


def _parse_payload(payload: bytes) -> str:
    try:
        return payload.decode("utf-8").strip()
    except Exception:
        return ""


def _mqtt_on_connect(client: mqtt.Client, userdata, flags, rc):
    if rc != 0:
        return
    try:
        for feed in [
            FEED_AIR_TEMPERATURE,
            FEED_AIR_HUMIDITY,
            FEED_SOIL_MOISTURE,
            FEED_LIGHT_LEVEL,
        ]:
            if feed:
                client.subscribe(_topic(feed))
    except Exception:
        return


def _mqtt_on_message(client: mqtt.Client, userdata, msg: mqtt.MQTTMessage):
    payload = _parse_payload(msg.payload)
    if payload == "":
        return

    now = datetime.now(timezone.utc).isoformat()
    topic = (msg.topic or "").lower()

    value: float | None
    try:
        value = float(payload)
    except Exception:
        value = None

    if value is None:
        return

    latest = _db_get_latest_sensor()
    base = {
        "recorded_at": now,
        "air_temperature": float(latest["air_temperature"]) if latest and latest["air_temperature"] is not None else None,
        "air_humidity": float(latest["air_humidity"]) if latest and latest["air_humidity"] is not None else None,
        "soil_moisture": float(latest["soil_moisture"]) if latest and latest["soil_moisture"] is not None else None,
        "light_level": float(latest["light_level"]) if latest and latest["light_level"] is not None else None,
        "source": "adafruit",
    }

    if FEED_AIR_TEMPERATURE and FEED_AIR_TEMPERATURE.lower() in topic:
        base["air_temperature"] = value
    elif FEED_AIR_HUMIDITY and FEED_AIR_HUMIDITY.lower() in topic:
        base["air_humidity"] = value
    elif FEED_SOIL_MOISTURE and FEED_SOIL_MOISTURE.lower() in topic:
        base["soil_moisture"] = value
    elif FEED_LIGHT_LEVEL and FEED_LIGHT_LEVEL.lower() in topic:
        base["light_level"] = value
    else:
        return

    _db_insert_sensor(**base)


def _mqtt_start() -> None:
    global _mqtt_client, _mqtt_thread

    if ADAFRUIT_USERNAME is None or ADAFRUIT_KEY is None:
        return

    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION1, client_id=f"smart-garden-backend-{os.getpid()}")
    client.username_pw_set(ADAFRUIT_USERNAME, ADAFRUIT_KEY)
    client.on_connect = _mqtt_on_connect
    client.on_message = _mqtt_on_message
    client.connect(MQTT_BROKER or "io.adafruit.com", MQTT_PORT, keepalive=60)

    _mqtt_client = client

    def runner():
        client.loop_forever(retry_first_connection=True)

    t = threading.Thread(target=runner, daemon=True)
    _mqtt_thread = t
    t.start()


def _mqtt_publish(feed: str, value: str) -> None:
    if _mqtt_client is None:
        return
    _mqtt_client.publish(_topic(feed), payload=value, qos=0, retain=False)


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.on_event("startup")
def on_startup():
    _db_init()
    now = datetime.now(timezone.utc).isoformat()
    if _db_get_latest_device_state() is None:
        _db_upsert_device_state(
            recorded_at=now,
            pump_state=False,
            fan_state=False,
            light_state=False,
            mode="manual",
        )
    _mqtt_start()


@app.get("/api/v1/sensors/latest", response_model=SensorLatestResponse)
def get_latest_sensor():
    row = _db_get_latest_sensor()
    if row is None:
        now = datetime.now(timezone.utc)
        return SensorLatestResponse(
            recorded_at=now,
            air_temperature=30.2,
            air_humidity=68.5,
            soil_moisture=27.1,
            light_level=412.0,
        )

    recorded_at = isoparse(row["recorded_at"])
    if recorded_at.tzinfo is None:
        recorded_at = recorded_at.replace(tzinfo=timezone.utc)
    return SensorLatestResponse(
        recorded_at=recorded_at,
        air_temperature=float(row["air_temperature"] or 0.0),
        air_humidity=float(row["air_humidity"] or 0.0),
        soil_moisture=float(row["soil_moisture"] or 0.0),
        light_level=float(row["light_level"] or 0.0),
    )


@app.get("/api/v1/sensors/history", response_model=list[SensorHistoryItem])
def get_sensor_history(limit: int = 50):
    limit = max(1, min(limit, 500))
    rows = _db_get_sensor_history(limit)
    items: list[SensorHistoryItem] = []
    for row in rows:
        recorded_at = isoparse(row["recorded_at"])
        if recorded_at.tzinfo is None:
            recorded_at = recorded_at.replace(tzinfo=timezone.utc)
        items.append(
            SensorHistoryItem(
                recorded_at=recorded_at,
                air_temperature=row["air_temperature"],
                air_humidity=row["air_humidity"],
                soil_moisture=row["soil_moisture"],
                light_level=row["light_level"],
            )
        )
    return items


@app.get("/api/v1/devices/state", response_model=DeviceStateResponse)
def get_device_state():
    row = _db_get_latest_device_state()
    if row is None:
        now = datetime.now(timezone.utc)
        return DeviceStateResponse(
            recorded_at=now,
            pump_state=False,
            fan_state=False,
            light_state=True,
            mode="manual",
        )

    recorded_at = isoparse(row["recorded_at"])
    if recorded_at.tzinfo is None:
        recorded_at = recorded_at.replace(tzinfo=timezone.utc)

    return DeviceStateResponse(
        recorded_at=recorded_at,
        pump_state=bool(row["pump_state"]),
        fan_state=bool(row["fan_state"]),
        light_state=bool(row["light_state"]),
        mode=row["mode"],
    )


@app.post("/api/v1/devices/control")
def control_device(req: DeviceControlRequest):
    feed_map = {
        "pump": FEED_PUMP_CONTROL,
        "fan": FEED_FAN_CONTROL,
        "light": FEED_LIGHT_CONTROL,
    }
    feed = feed_map.get(req.target_device)
    if feed:
        _mqtt_publish(feed, "1" if req.action == "on" else "0")

    prev = _db_get_latest_device_state()
    pump_state = bool(prev["pump_state"]) if prev else False
    fan_state = bool(prev["fan_state"]) if prev else False
    light_state = bool(prev["light_state"]) if prev else False
    mode = prev["mode"] if prev else "manual"

    if req.target_device == "pump":
        pump_state = req.action == "on"
    elif req.target_device == "fan":
        fan_state = req.action == "on"
    elif req.target_device == "light":
        light_state = req.action == "on"

    _db_upsert_device_state(
        recorded_at=datetime.now(timezone.utc).isoformat(),
        pump_state=pump_state,
        fan_state=fan_state,
        light_state=light_state,
        mode=mode,
    )
    return {
        "status": "accepted",
        "target_device": req.target_device,
        "action": req.action,
        "actor_type": req.actor_type,
        "reason": req.reason,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
