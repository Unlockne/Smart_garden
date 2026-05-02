from app.observers.base import SensorObserver
from app.observers.events import SensorReadingEvent
from app.services.auto_mode_service import run_auto_if_needed


class AutoModeObserver(SensorObserver):
    """Concrete observer phản ứng với sự kiện cảm biến mới bằng cách
    kích hoạt logic auto mode (bơm nước, quạt, đèn theo ngưỡng).
    """

    def on_sensor_reading(self, event: SensorReadingEvent) -> None:
        run_auto_if_needed(event.db, trigger=event.trigger)
