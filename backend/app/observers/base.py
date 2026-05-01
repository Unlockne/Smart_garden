from abc import ABC, abstractmethod

from app.observers.events import SensorReadingEvent


class SensorObserver(ABC):
    """Interface bắt buộc cho tất cả các concrete observer lắng nghe sự kiện cảm biến."""

    @abstractmethod
    def on_sensor_reading(self, event: SensorReadingEvent) -> None:
        """Được gọi khi có dữ liệu cảm biến mới được lưu vào hệ thống.

        Args:
            event: Đối tượng SensorReadingEvent chứa db session, trigger và sensor_id.
        """
        ...
