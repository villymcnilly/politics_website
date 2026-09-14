"""End-to-end: fixture HTTP responses in, rendered markdown brief out.
No real request leaves the process -- this is what proves `ff league`
works before ever pointing it at a live league.
"""

import json
from pathlib import Path

import httpx
import pytest

from ff import config
from ff.cache import DiskCache
from ff.cli import _build_league_brief
from ff.sleeper.client import SleeperClient
from ff.sleeper.repository import SleeperRepository

FIXTURES = Path(__file__).parent / "fixtures"


def _load(name: str):
    return json.loads((FIXTURES / name).read_text())


def _fixture_handler(request: httpx.Request) -> httpx.Response:
    path = request.url.path
    routes = {
        "/v1/league/1000000000000000001": "league.json",
        "/v1/league/1000000000000000001/rosters": "rosters.json",
        "/v1/league/1000000000000000001/users": "users.json",
        "/v1/players/nfl": "players.json",
    }
    if path == "/v1/user/vilhelm":
        return httpx.Response(200, json={"user_id": "500000000000000001", "username": "vilhelm"})
    if path in routes:
        return httpx.Response(200, json=_load(routes[path]))
    raise AssertionError(f"unexpected request to {path}")


@pytest.fixture
def repo(tmp_path):
    transport = httpx.MockTransport(_fixture_handler)
    http_client = httpx.Client(base_url="https://api.sleeper.app/v1", transport=transport)
    client = SleeperClient(http_client=http_client)
    cache = DiskCache(tmp_path)
    return SleeperRepository(client, cache)


def test_league_brief_end_to_end(repo, capsys):
    cfg = config.FFConfig(
        league_id="1000000000000000001",
        username="vilhelm",
        cache_dir=Path("unused"),
        season="2026",
    )

    brief = _build_league_brief(repo, cfg)
    print(brief)  # visible with `pytest -s`, useful for eyeballing the real output

    assert "The Basement Brawl -- 2026" in brief
    assert "Basement Dwellers" in brief
    assert "Test Quarterback" in brief
    assert "| pass_td | 4 |" in brief
    assert "rival_manager" in brief
