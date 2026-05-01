from app.observers.base import SensorObserver
from app.observers.events import SensorReadingEvent
from app.services.ai_mode_service import run_ai_if_needed


class AIModeObserver(SensorObserver):
    """Concrete observer phản ứng với sự kiện cảm biến mới bằng cách
    kích hoạt logic AI mode (đề xuất và thực thi hành động từ mô hình AI).
    """

    def on_sensor_reading(self, event: SensorReadingEvent) -> None:
        run_ai_if_needed(event.db, trigger=event.trigger)
