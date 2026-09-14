"""SleeperClient against httpx.MockTransport -- no real request ever leaves
the process. This also documents the exact paths the client hits, so a
change to the URL scheme shows up as a diff here.
"""

import json

import httpx
import pytest

from ff.sleeper.client import SleeperClient

FIXTURE_LEAGUE = {"league_id": "1", "name": "Test League", "roster_positions": [], "scoring_settings": {}}


def make_client(handler) -> SleeperClient:
    transport = httpx.MockTransport(handler)
    http_client = httpx.Client(base_url="https://api.sleeper.app/v1", transport=transport)
    return SleeperClient(http_client=http_client)


def test_get_league_hits_expected_path():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        return httpx.Response(200, json=FIXTURE_LEAGUE)

    client = make_client(handler)
    result = client.get_league("1")

    assert seen["url"] == "https://api.sleeper.app/v1/league/1"
    assert result == FIXTURE_LEAGUE


def test_get_trending_sends_query_params_and_validates_direction():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/v1/players/nfl/trending/add"
        assert dict(request.url.params) == {"lookback_hours": "24", "limit": "25"}
        return httpx.Response(200, json=[{"player_id": "4046", "count": 12}])

    client = make_client(handler)
    result = client.get_trending("add")
    assert result == [{"player_id": "4046", "count": 12}]

    with pytest.raises(ValueError):
        client.get_trending("sideways")


def test_non_200_response_raises():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404, json={"error": "not found"})

    client = make_client(handler)
    with pytest.raises(httpx.HTTPStatusError):
        client.get_league("does-not-exist")


def test_get_all_players_returns_raw_dump():
    dump = {"4046": {"full_name": "Test Player"}}

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/v1/players/nfl"
        return httpx.Response(200, content=json.dumps(dump))

    client = make_client(handler)
    assert client.get_all_players() == dump
