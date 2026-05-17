from dataclasses import dataclass

from sqlalchemy.orm import Session


@dataclass
class SensorReadingEvent:
    """Data object chứa thông tin của một sự kiện 'có dữ liệu cảm biến mới'.

    Attributes:
        db: SQLAlchemy session để observer có thể truy vấn thêm nếu cần.
        trigger: Nguồn phát sự kiện, ví dụ "ingest" | "mock-ingest".
        sensor_id: ID của bản ghi SensorReading vừa được lưu vào DB.
            Truyền ID thay vì toàn bộ object để tránh detached-instance error
            trong môi trường đa luồng.
    """

    db: Session
    trigger: str
    sensor_id: int
