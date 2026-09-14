"""Deterministic fantasy scoring. The only place points get computed.

Sleeper stores a league's scoring rules as a flat dict of stat key -> value
per occurrence, e.g. {"pass_yd": 0.04, "pass_td": 4, "rec": 0.5}. Applying it
to a player's stat line is a dot product. There is no judgment call in this
function -- which is exactly why it's a tested function and not something
an LLM is asked to eyeball.
"""

from __future__ import annotations


def points(stat_line: dict[str, float], scoring_settings: dict[str, float]) -> float:
    """Fantasy points for one player-week under one league's scoring rules.

    A stat category present in stat_line but absent from scoring_settings
    contributes 0 (the league doesn't score it) rather than raising --
    Sleeper's stat feed carries far more categories than most leagues score.
    """
    return sum(scoring_settings.get(stat, 0.0) * value for stat, value in stat_line.items())
