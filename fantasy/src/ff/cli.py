"""Entry point for the `ff` command.

ff is read-only end to end: it fetches, computes, and prints a brief. It
never calls a Sleeper write endpoint (there are none) and never submits
anything on your behalf -- you read the brief and act in the Sleeper app.
"""

from __future__ import annotations

from pathlib import Path

import httpx
import typer

from ff import config
from ff.cache import DiskCache
from ff.league import find_my_roster, roster_slots, standings
from ff.render import render_league_brief
from ff.sleeper.client import SleeperClient
from ff.sleeper.repository import SleeperRepository

app = typer.Typer(help="Advisory tools for a Sleeper fantasy league. Every command only reads and prints.")


@app.callback()
def main() -> None:
    """Forces subcommand-style invocation (`ff league`) -- Typer collapses a
    single-command app into a bare script otherwise, which would break once
    lineup/waivers/trades are added in later phases."""


@app.command()
def league(
    league_id: str = typer.Option(None, envvar="FF_LEAGUE_ID", help="Sleeper league ID from the league URL."),
    username: str = typer.Option(None, envvar="FF_SLEEPER_USERNAME", help="Your Sleeper username."),
    cache_dir: str = typer.Option(None, envvar="FF_CACHE_DIR"),
    season: str = typer.Option(None, envvar="FF_SEASON"),
) -> None:
    """Print scoring rules, roster positions, your roster, and standings."""
    try:
        cfg = config.resolve(league_id, username, cache_dir, season)
    except ValueError as exc:
        typer.echo(str(exc), err=True)
        raise typer.Exit(code=1)

    cache = DiskCache(Path(cfg.cache_dir))
    try:
        with SleeperClient() as client:
            repo = SleeperRepository(client, cache)
            brief = _build_league_brief(repo, cfg)
    except httpx.HTTPStatusError as exc:
        typer.echo(f"Sleeper API request failed: {exc}", err=True)
        raise typer.Exit(code=1)
    except ValueError as exc:
        typer.echo(str(exc), err=True)
        raise typer.Exit(code=1)

    typer.echo(brief)


def _build_league_brief(repo: SleeperRepository, cfg: config.FFConfig) -> str:
    league_data = repo.league(cfg.league_id)
    rosters_data = repo.rosters(cfg.league_id)
    users_data = repo.league_users(cfg.league_id)
    players_df = repo.players()

    sleeper_user = repo.user(cfg.username)
    my_roster = find_my_roster(rosters_data, users_data, cfg.username, sleeper_user["user_id"])
    my_slots = roster_slots(my_roster, league_data.get("roster_positions", []), players_df)
    standings_df = standings(rosters_data, users_data)

    user_by_id = {u["user_id"]: u for u in users_data}
    owner = user_by_id.get(my_roster.get("owner_id"), {})
    team_name = (owner.get("metadata") or {}).get("team_name") or owner.get("display_name") or cfg.username

    return render_league_brief(league_data, my_slots, standings_df, team_name)


if __name__ == "__main__":
    app()
