"""In-memory sliding-window rate limiter (lock-protected, per client key)."""

import threading
import time


class SlidingWindowRateLimiter:
    """Track timestamps per client key within a 60-second window."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        # {client_key: [timestamp, ...]}
        self._hits: dict[str, list[float]] = {}

    def check(self, key: str, limit_per_minute: int) -> tuple[bool, int]:
        """Return *(allowed, retry_after_seconds)*.

        *retry_after_seconds* is 0 when allowed, otherwise the number of
        seconds the client should wait before retrying.
        """
        now = time.monotonic()
        window = 60.0

        with self._lock:
            timestamps = self._hits.get(key)

            if timestamps is None:
                timestamps = []
                self._hits[key] = timestamps

            # Purge entries older than the window.
            timestamps[:] = [t for t in timestamps if now - t < window]

            # Remove the key entirely when empty (prevents unbounded memory).
            if not timestamps and len(timestamps) == 0:
                pass  # still need it for the upcoming append if allowed

            if len(timestamps) < limit_per_minute:
                timestamps.append(now)
                return True, 0

            # Denied – compute how long until the oldest entry expires.
            oldest = timestamps[0]
            retry_after = int(window - (now - oldest)) + 1
            if retry_after < 1:
                retry_after = 1

            # Clean up empty keys to keep memory bounded.
            if not timestamps:
                del self._hits[key]

            return False, retry_after


rate_limiter = SlidingWindowRateLimiter()
