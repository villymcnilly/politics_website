"""Markdown rendering for briefs. Plain text out, no emoji, no ASCII art --
this is meant to be read once a week, not admired.
"""

from __future__ import annotations

import pandas as pd

from ff.league import RosterSlot


def render_league_brief(
    league: dict,
    roster_slots_: list[RosterSlot],
    standings_df: pd.DataFrame,
    team_name: str,
) -> str:
    lines: list[str] = []

    lines.append(f"# {league.get('name', 'League')} -- {league.get('season')}")
    lines.append("")
    lines.append(f"Scoring type and roster shape as configured in Sleeper. Team: {team_name}.")
    lines.append("")

    lines.append("## Scoring settings")
    lines.append("")
    lines.append(_scoring_table(league.get("scoring_settings", {})))
    lines.append("")

    lines.append("## Roster positions")
    lines.append("")
    lines.append(", ".join(league.get("roster_positions", [])))
    lines.append("")

    lines.append("## My roster")
    lines.append("")
    lines.append(_roster_table(roster_slots_))
    lines.append("")

    lines.append("## Standings")
    lines.append("")
    lines.append(_standings_table(standings_df))

    return "\n".join(lines)


def _scoring_table(scoring_settings: dict[str, float]) -> str:
    if not scoring_settings:
        return "no data"
    header = "| stat | points |\n|---|---|"
    rows = [f"| {stat} | {value} |" for stat, value in sorted(scoring_settings.items())]
    return "\n".join([header, *rows])


def _roster_table(slots: list[RosterSlot]) -> str:
    if not slots:
        return "no data"
    header = "| slot | player | pos | team | injury |\n|---|---|---|---|---|"
    rows = [
        f"| {s.slot} | {s.player_name} | {s.position} | {s.team} | {s.injury_status} |"
        for s in slots
    ]
    return "\n".join([header, *rows])


def _standings_table(standings_df: pd.DataFrame) -> str:
    if standings_df.empty:
        return "no data"
    header = "| rank | team | W | L | T | PF | PA |\n|---|---|---|---|---|---|---|"
    rows = [
        f"| {i + 1} | {r.team} | {r.wins} | {r.losses} | {r.ties} | {r.fpts} | {r.fpts_against} |"
        for i, r in enumerate(standings_df.itertuples())
    ]
    return "\n".join([header, *rows])
