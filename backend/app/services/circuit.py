import threading
import time

_breakers: list["Breaker"] = []
_breakers_lock = threading.Lock()


class Breaker:
    def __init__(self, name: str, cooldown_seconds: float) -> None:
        self.name = name
        self.cooldown_seconds = float(cooldown_seconds)
        self._lock = threading.Lock()
        self._failed_at: float | None = None
        with _breakers_lock:
            _breakers.append(self)

    def allow(self) -> bool:
        with self._lock:
            if self._failed_at is None:
                return True
            if time.monotonic() - self._failed_at < self.cooldown_seconds:
                return False
            return True

    def failure(self) -> None:
        with self._lock:
            self._failed_at = time.monotonic()

    def success(self) -> None:
        with self._lock:
            self._failed_at = None


def reset_all() -> None:
    with _breakers_lock:
        for breaker in _breakers:
            breaker.success()
