"""Cache-through access to Sleeper league data.

Everything a CLI command needs comes through here rather than straight from
SleeperClient, so freshness rules live in one place instead of being
re-decided at every call site.

TTLs are a judgment call, not something Sleeper specifies beyond "don't
call /players/nfl more than once a day": league settings essentially never
change mid-season, rosters/users/matchups move during the week so a short
TTL keeps `ff league` snappy without serving hours-stale data, and the
player dump gets the full day Sleeper asks for.
"""

from __future__ import annotations

import pandas as pd

from ff.cache import DiskCache
from ff.sleeper.client import SleeperClient

LEAGUE_SETTINGS_TTL = 60 * 60  # 1 hour: name, scoring_settings, roster_positions
ROSTER_TTL = 5 * 60  # 5 minutes: rosters, users, matchups, transactions
PLAYERS_TTL = 24 * 60 * 60  # 1 day, per Sleeper's guidance for /players/nfl

# Columns kept from the ~5MB player dump. Sleeper returns dozens of fields
# per player (college, birth date, injury body part, ...); we only display
# and match on these, so the parquet cache stays small.
PLAYER_COLUMNS = [
    "player_id",
    "full_name",
    "position",
    "team",
    "status",
    "injury_status",
    "years_exp",
]


class SleeperRepository:
    def __init__(self, client: SleeperClient, cache: DiskCache):
        self._client = client
        self._cache = cache

    def user(self, username_or_id: str) -> dict:
        # Not cached: called once per invocation to resolve --username, and
        # caching it under the raw input string would create a stale entry
        # per distinct spelling a user tries.
        return self._client.get_user(username_or_id)

    def league(self, league_id: str) -> dict:
        return self._cache.get_or_fetch_json(
            f"league_{league_id}",
            LEAGUE_SETTINGS_TTL,
            lambda: self._client.get_league(league_id),
        )

    def rosters(self, league_id: str) -> list[dict]:
        return self._cache.get_or_fetch_json(
            f"rosters_{league_id}",
            ROSTER_TTL,
            lambda: self._client.get_rosters(league_id),
        )

    def league_users(self, league_id: str) -> list[dict]:
        return self._cache.get_or_fetch_json(
            f"users_{league_id}",
            ROSTER_TTL,
            lambda: self._client.get_league_users(league_id),
        )

    def matchups(self, league_id: str, week: int) -> list[dict]:
        return self._cache.get_or_fetch_json(
            f"matchups_{league_id}_wk{week}",
            ROSTER_TTL,
            lambda: self._client.get_matchups(league_id, week),
        )

    def transactions(self, league_id: str, round_: int) -> list[dict]:
        return self._cache.get_or_fetch_json(
            f"transactions_{league_id}_r{round_}",
            ROSTER_TTL,
            lambda: self._client.get_transactions(league_id, round_),
        )

    def players(self) -> pd.DataFrame:
        """The player dump as a DataFrame indexed by player_id, trimmed to PLAYER_COLUMNS."""

        def fetch() -> pd.DataFrame:
            raw = self._client.get_all_players()
            df = pd.DataFrame.from_dict(raw, orient="index")
            df["player_id"] = df.index
            present = [c for c in PLAYER_COLUMNS if c in df.columns]
            return df[present].reset_index(drop=True)

        df = self._cache.get_or_fetch_parquet("players_nfl", PLAYERS_TTL, fetch)
        return df.set_index("player_id", drop=False)

    def trending(self, direction: str, lookback_hours: int = 24, limit: int = 25) -> list[dict]:
        return self._cache.get_or_fetch_json(
            f"trending_{direction}_{lookback_hours}h",
            ROSTER_TTL,
            lambda: self._client.get_trending(direction, lookback_hours, limit),
        )

    def nfl_state(self) -> dict:
        return self._cache.get_or_fetch_json(
            "nfl_state",
            ROSTER_TTL,
            lambda: self._client.get_nfl_state(),
        )
