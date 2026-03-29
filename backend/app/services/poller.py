import threading
import time

from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.services.auto_mode_service import run_auto_if_needed
from app.services.ingestion_service import ingest_payload, poll_latest_from_adafruit


class IngestionPoller:
    def __init__(self):
        self._thread: threading.Thread | None = None
        self._stop = threading.Event()
        self.running = False

    def start(self):
        if self._thread is not None:
            return
        if not settings.enable_adafruit_polling:
            return

        self._thread = threading.Thread(target=self._run, name="adafruit-poller", daemon=True)
        self._thread.start()

    def stop(self):
        self._stop.set()
        self.running = False

    def _run(self):
        self.running = True
        while not self._stop.is_set():
            try:
                payload = poll_latest_from_adafruit()
                if payload is not None:
                    db: Session = SessionLocal()
                    try:
                        ingest_payload(db, payload, source="adafruit")
                        run_auto_if_needed(db, trigger="ingest")
                    finally:
                        db.close()
            except Exception as e:
                print(f"Poller Error: {e}")

            time.sleep(max(1, settings.ingestion_poll_seconds))


poller = IngestionPoller()
