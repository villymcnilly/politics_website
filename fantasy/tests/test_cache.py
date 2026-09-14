"""DiskCache: fetches once, serves from disk within TTL, refetches after
expiry. No network involved -- `fetch` here is just a counter, standing in
for what would otherwise be a SleeperClient call.
"""

import time

import pandas as pd

from ff.cache import DiskCache


def test_json_cache_hit_avoids_refetch(tmp_path):
    cache = DiskCache(tmp_path)
    calls = {"n": 0}

    def fetch():
        calls["n"] += 1
        return {"value": calls["n"]}

    first = cache.get_or_fetch_json("key", ttl_seconds=60, fetch=fetch)
    second = cache.get_or_fetch_json("key", ttl_seconds=60, fetch=fetch)

    assert first == {"value": 1}
    assert second == {"value": 1}
    assert calls["n"] == 1


def test_json_cache_refetches_after_ttl_expires(tmp_path):
    cache = DiskCache(tmp_path)
    calls = {"n": 0}

    def fetch():
        calls["n"] += 1
        return calls["n"]

    cache.get_or_fetch_json("key", ttl_seconds=0.05, fetch=fetch)
    time.sleep(0.1)
    cache.get_or_fetch_json("key", ttl_seconds=0.05, fetch=fetch)

    assert calls["n"] == 2


def test_parquet_cache_round_trips_a_dataframe(tmp_path):
    cache = DiskCache(tmp_path)
    calls = {"n": 0}

    def fetch():
        calls["n"] += 1
        return pd.DataFrame({"a": [1, 2], "b": ["x", "y"]})

    first = cache.get_or_fetch_parquet("players", ttl_seconds=60, fetch=fetch)
    second = cache.get_or_fetch_parquet("players", ttl_seconds=60, fetch=fetch)

    pd.testing.assert_frame_equal(first, second)
    assert calls["n"] == 1


def test_age_seconds_is_none_for_unknown_key(tmp_path):
    cache = DiskCache(tmp_path)
    assert cache.age_seconds("nope") is None
