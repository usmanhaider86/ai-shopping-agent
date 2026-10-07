"""Thread-safe in-memory TTL cache (dict insertion order, threading.Lock)."""

import threading
import time
from typing import Any


class TTLCache:
    """A small thread-safe cache with per-entry TTL and a max-entry cap."""

    def __init__(self, ttl_seconds: int = 3600, max_entries: int = 200) -> None:
        self._ttl = ttl_seconds
        self._max = max_entries
        self._lock = threading.Lock()
        # {key: (value, insertion_timestamp)}
        self._store: dict[str, tuple[Any, float]] = {}

    # ── public API ────────────────────────────────────────────────

    def get(self, key: str) -> Any | None:
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            value, ts = entry
            if time.monotonic() - ts > self._ttl:
                del self._store[key]
                return None
            return value

    def set(self, key: str, value: Any) -> None:
        with self._lock:
            # Remove first so re-insert moves key to the end (insertion order).
            self._store.pop(key, None)
            self._store[key] = (value, time.monotonic())
            self._evict()

    # ── internals ─────────────────────────────────────────────────

    def _evict(self) -> None:
        """Drop oldest entries until we are at or below *max_entries*."""
        while len(self._store) > self._max:
            oldest_key = next(iter(self._store))
            del self._store[oldest_key]
