"""Disk cache for Sleeper API responses.

Everything ff fetches gets written to ./cache/ before it's used. Each JSON
entry is wrapped with the time it was fetched, so freshness is just a file
read plus a subtraction -- no database, no extra dependency. The one large
payload (the full player dump) is cached as parquet instead of JSON because
it's ~5MB and pandas reads it back far faster than json.loads on that size.

Sleeper asks that /players/nfl be fetched at most once a day; the TTLs
callers pass in are how that promise gets kept.
"""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Callable, TypeVar

import pandas as pd

T = TypeVar("T")


class DiskCache:
    def __init__(self, root: Path):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)

    def get_or_fetch_json(self, key: str, ttl_seconds: float, fetch: Callable[[], T]) -> T:
        """Return the cached value for `key` if it's younger than ttl_seconds, else fetch and store it."""
        path = self._json_path(key)
        cached = self._read_json(path)
        if cached is not None and time.time() - cached["fetched_at"] < ttl_seconds:
            return cached["data"]

        data = fetch()
        path.write_text(json.dumps({"fetched_at": time.time(), "data": data}))
        return data

    def get_or_fetch_parquet(
        self, key: str, ttl_seconds: float, fetch: Callable[[], pd.DataFrame]
    ) -> pd.DataFrame:
        """Same contract as get_or_fetch_json, but for a DataFrame stored as parquet."""
        data_path = self.root / f"{key}.parquet"
        meta_path = self.root / f"{key}.meta.json"
        meta = self._read_json(meta_path)
        if data_path.exists() and meta is not None and time.time() - meta["fetched_at"] < ttl_seconds:
            return pd.read_parquet(data_path)

        df = fetch()
        df.to_parquet(data_path)
        meta_path.write_text(json.dumps({"fetched_at": time.time()}))
        return df

    def age_seconds(self, key: str) -> float | None:
        """Seconds since `key` was last fetched, or None if it was never cached. Used to label output as stale."""
        cached = self._read_json(self._json_path(key))
        if cached is not None:
            return time.time() - cached["fetched_at"]
        meta = self._read_json(self.root / f"{key}.meta.json")
        if meta is not None:
            return time.time() - meta["fetched_at"]
        return None

    def _json_path(self, key: str) -> Path:
        return self.root / f"{key}.json"

    @staticmethod
    def _read_json(path: Path) -> dict | None:
        if not path.exists():
            return None
        return json.loads(path.read_text())
