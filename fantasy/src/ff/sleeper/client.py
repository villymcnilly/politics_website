"""Thin, read-only client for the public Sleeper API.

Sleeper's API (api.sleeper.app/v1) is unauthenticated and has no write
endpoints -- there is no "submit waiver claim" or "propose trade" call to
make even if we wanted one. Every method here is a GET. This client does
no caching itself; that's DiskCache's job, called from repository.py, so
this class stays trivial to point at a fake transport in tests.
"""

from __future__ import annotations

import httpx

BASE_URL = "https://api.sleeper.app/v1"


class SleeperClient:
    def __init__(self, http_client: httpx.Client | None = None):
        self._client = http_client or httpx.Client(base_url=BASE_URL, timeout=15.0)
        self._owns_client = http_client is None

    def get_user(self, username_or_id: str) -> dict:
        return self._get(f"/user/{username_or_id}")

    def get_league(self, league_id: str) -> dict:
        return self._get(f"/league/{league_id}")

    def get_rosters(self, league_id: str) -> list[dict]:
        return self._get(f"/league/{league_id}/rosters")

    def get_league_users(self, league_id: str) -> list[dict]:
        return self._get(f"/league/{league_id}/users")

    def get_matchups(self, league_id: str, week: int) -> list[dict]:
        return self._get(f"/league/{league_id}/matchups/{week}")

    def get_transactions(self, league_id: str, round_: int) -> list[dict]:
        return self._get(f"/league/{league_id}/transactions/{round_}")

    def get_traded_picks(self, league_id: str) -> list[dict]:
        return self._get(f"/league/{league_id}/traded_picks")

    def get_all_players(self) -> dict:
        """The full player dump: ~5MB, every NFL player Sleeper knows about. Fetch at most once a day."""
        return self._get("/players/nfl")

    def get_trending(self, direction: str, lookback_hours: int = 24, limit: int = 25) -> list[dict]:
        if direction not in ("add", "drop"):
            raise ValueError(f"direction must be 'add' or 'drop', got {direction!r}")
        return self._get(
            f"/players/nfl/trending/{direction}",
            params={"lookback_hours": lookback_hours, "limit": limit},
        )

    def get_nfl_state(self) -> dict:
        return self._get("/state/nfl")

    def _get(self, path: str, params: dict | None = None):
        response = self._client.get(path, params=params)
        response.raise_for_status()
        return response.json()

    def close(self) -> None:
        if self._owns_client:
            self._client.close()

    def __enter__(self) -> "SleeperClient":
        return self

    def __exit__(self, *exc_info) -> None:
        self.close()
