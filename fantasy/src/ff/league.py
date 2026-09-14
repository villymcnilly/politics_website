"""Joins Sleeper's separate league/roster/user/player payloads into the
shapes `ff league` displays. No scoring or projection math lives here --
just matching IDs across endpoints, which is why it isn't unit-tested the
way scoring.py is (there's no numeric claim to get wrong).
"""

from __future__ import annotations

from dataclasses import dataclass

import pandas as pd


@dataclass
class RosterSlot:
    slot: str
    player_id: str | None
    player_name: str
    position: str
    team: str
    injury_status: str


def find_my_roster(rosters: list[dict], users: list[dict], username_or_id: str, resolved_user_id: str) -> dict:
    """The roster whose owner_id matches the Sleeper user we resolved from --username."""
    for roster in rosters:
        if roster.get("owner_id") == resolved_user_id:
            return roster
    raise ValueError(
        f"No roster in this league is owned by {username_or_id!r} (user_id {resolved_user_id!r}). "
        f"Double-check --league-id and --username point at the same league."
    )


def roster_slots(roster: dict, roster_positions: list[str], players: pd.DataFrame) -> list[RosterSlot]:
    """Slot-by-slot view of one roster: starters in roster_positions order, then bench."""
    starters = roster.get("starters") or []
    all_players = roster.get("players") or []
    starter_slot_labels = [p for p in roster_positions if p != "BN"]

    rows: list[RosterSlot] = []
    for slot, player_id in zip(starter_slot_labels, starters):
        rows.append(_slot_row(slot, player_id, players))

    bench_ids = [p for p in all_players if p not in starters]
    for player_id in bench_ids:
        rows.append(_slot_row("BN", player_id, players))

    return rows


def _clean(value, default: str) -> str:
    """pandas reads JSON null as NaN, which is truthy in Python -- `value or default` alone lets it through."""
    if value is None or pd.isna(value):
        return default
    return value


def _slot_row(slot: str, player_id: str, players: pd.DataFrame) -> RosterSlot:
    if player_id in ("0", None) or player_id not in players.index:
        return RosterSlot(slot=slot, player_id=player_id, player_name="(empty)", position="-", team="-", injury_status="-")
    row = players.loc[player_id]
    return RosterSlot(
        slot=slot,
        player_id=player_id,
        player_name=_clean(row.get("full_name"), player_id),
        position=_clean(row.get("position"), "-"),
        team=_clean(row.get("team"), "FA"),
        injury_status=_clean(row.get("injury_status"), "-"),
    )


def standings(rosters: list[dict], users: list[dict]) -> pd.DataFrame:
    """Standings straight from Sleeper's own reported win/loss/points -- no arithmetic of ours."""
    user_by_id = {u["user_id"]: u for u in users}

    rows = []
    for roster in rosters:
        settings = roster.get("settings", {})
        owner = user_by_id.get(roster.get("owner_id"), {})
        team_name = (owner.get("metadata") or {}).get("team_name") or owner.get("display_name") or "Unknown"
        fpts = settings.get("fpts", 0) + settings.get("fpts_decimal", 0) / 100
        fpts_against = settings.get("fpts_against", 0) + settings.get("fpts_against_decimal", 0) / 100
        rows.append(
            {
                "team": team_name,
                "wins": settings.get("wins", 0),
                "losses": settings.get("losses", 0),
                "ties": settings.get("ties", 0),
                "fpts": round(fpts, 2),
                "fpts_against": round(fpts_against, 2),
            }
        )

    df = pd.DataFrame(rows)
    return df.sort_values(["wins", "fpts"], ascending=[False, False]).reset_index(drop=True)
