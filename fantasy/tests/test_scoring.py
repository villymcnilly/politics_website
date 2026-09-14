"""Recomputes a completed week from recorded Sleeper data and checks that
`points()` matches Sleeper's own reported score within 0.1 -- the tolerance
the task asked for, in case a future stat category rounds internally.
"""

import json
from pathlib import Path

from ff.scoring import points

FIXTURES = Path(__file__).parent / "fixtures"


def _load(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text())


def test_points_matches_sleeper_reported_score_for_completed_week():
    league = _load("league.json")
    matchup = _load("matchup_week5.json")

    scoring_settings = league["scoring_settings"]
    stat_lines = matchup["stat_lines"]
    players_points = matchup["matchup"]["players_points"]

    for player_id, stat_line in stat_lines.items():
        computed = points(stat_line, scoring_settings)
        reported = players_points[player_id]
        assert abs(computed - reported) < 0.1, (
            f"player {player_id}: computed {computed} vs Sleeper-reported {reported}"
        )

    total_computed = sum(points(stat_lines[pid], scoring_settings) for pid in matchup["matchup"]["players_points"])
    assert abs(total_computed - matchup["matchup"]["points"]) < 0.1


def test_points_ignores_stats_the_league_does_not_score():
    stat_line = {"pass_yd": 100, "two_pt_pass": 1}
    scoring_settings = {"pass_yd": 0.04}
    assert points(stat_line, scoring_settings) == 4.0


def test_points_on_empty_stat_line_is_zero():
    assert points({}, {"pass_yd": 0.04, "pass_td": 4}) == 0.0
