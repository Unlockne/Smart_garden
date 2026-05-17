from app.observers.base import SensorObserver
from app.observers.events import SensorReadingEvent


class SensorEventPublisher:
    """Subject trong Observer Pattern — quản lý danh sách observer và phát sự kiện.

    Thread-safety note:
        Danh sách observer chỉ được đăng ký một lần duy nhất tại thời điểm
        startup (read-only sau đó), nên không cần threading.Lock. Nếu sau này
        cần subscribe/unsubscribe động, hãy thêm lock vào subscribe() và
        unsubscribe().
    """

    def __init__(self):
        self._observers: list[SensorObserver] = []

    def subscribe(self, observer: SensorObserver) -> None:
        """Đăng ký một observer vào danh sách nhận sự kiện."""
        self._observers.append(observer)

    def unsubscribe(self, observer: SensorObserver) -> None:
        """Huỷ đăng ký một observer khỏi danh sách."""
        self._observers.remove(observer)

    def notify(self, event: SensorReadingEvent) -> None:
        """Phát sự kiện đến tất cả observer đã đăng ký.

        Lỗi từ từng observer được bắt riêng lẻ để đảm bảo một observer lỗi
        không làm dừng các observer còn lại.
        """
        for obs in self._observers:
            try:
                obs.on_sensor_reading(event)
            except Exception as e:
                print(f"[Observer Error] {type(obs).__name__}: {e}")


# Singleton dùng chung trong toàn bộ ứng dụng
sensor_publisher = SensorEventPublisher()
