"""Package observers — Observer Design Pattern cho sự kiện cảm biến.

Exports chính:
    sensor_publisher  — Singleton SensorEventPublisher dùng chung toàn app.
    AutoModeObserver  — Concrete observer kích hoạt logic auto mode.
    AIModeObserver    — Concrete observer kích hoạt logic AI mode.
"""

from app.observers.publisher import sensor_publisher
from app.observers.auto_mode_observer import AutoModeObserver
from app.observers.ai_mode_observer import AIModeObserver

__all__ = ["sensor_publisher", "AutoModeObserver", "AIModeObserver"]
