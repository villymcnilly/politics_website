"""Joins across the fixture league/rosters/users/players -- the same shapes
`ff league` fetches for real, just recorded to disk instead of live.
"""

import json
from pathlib import Path

import pandas as pd
import pytest

from ff.league import find_my_roster, roster_slots, standings

FIXTURES = Path(__file__).parent / "fixtures"


def _load(name: str) -> dict | list:
    return json.loads((FIXTURES / name).read_text())


@pytest.fixture
def league():
    return _load("league.json")


@pytest.fixture
def rosters():
    return _load("rosters.json")


@pytest.fixture
def users():
    return _load("users.json")


@pytest.fixture
def players_df():
    raw = _load("players.json")
    df = pd.DataFrame.from_dict(raw, orient="index")
    return df.set_index("player_id", drop=False)


def test_find_my_roster_matches_owner_id(rosters, users):
    roster = find_my_roster(rosters, users, "vilhelm", "500000000000000001")
    assert roster["roster_id"] == 1


def test_find_my_roster_raises_for_unknown_owner(rosters, users):
    with pytest.raises(ValueError):
        find_my_roster(rosters, users, "nobody", "does-not-exist")


def test_roster_slots_orders_starters_then_bench(league, rosters, players_df):
    my_roster = rosters[0]
    slots = roster_slots(my_roster, league["roster_positions"], players_df)

    starter_slots = [s for s in slots if s.slot != "BN"]
    bench_slots = [s for s in slots if s.slot == "BN"]

    assert [s.slot for s in starter_slots] == ["QB", "RB", "RB", "WR"]
    assert [s.player_name for s in starter_slots] == [
        "Test Quarterback",
        "Test Runningback",
        "Test Runningback Two",
        "Test Receiver",
    ]
    assert [s.player_name for s in bench_slots] == ["Test Tightend"]


def test_roster_slots_renders_missing_injury_status_as_dash_not_nan(league, rosters, players_df):
    """players.json has injury_status: null for healthy players -- pandas reads that as NaN,
    which is truthy in Python, so a naive `value or "-"` would print the literal string "nan"."""
    my_roster = rosters[0]
    slots = roster_slots(my_roster, league["roster_positions"], players_df)
    healthy = next(s for s in slots if s.player_name == "Test Quarterback")
    assert healthy.injury_status == "-"


def test_standings_sorted_by_wins_then_points(rosters, users):
    df = standings(rosters, users)
    assert list(df["team"]) == ["Basement Dwellers", "rival_manager"]
    assert df.iloc[0]["fpts"] == pytest.approx(1024.42)
