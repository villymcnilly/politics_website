"""Where ff gets your league ID, Sleeper username, and cache location.

Precedence, highest first: CLI flag > environment variable > fantasy/config.toml.
config.toml is gitignored -- a league ID isn't a secret, but it's tied to
your account, and this project happens to live inside a public repo.
Copy config.example.toml to config.toml and fill in your values to avoid
typing flags every week.
"""

from __future__ import annotations

import tomllib
from dataclasses import dataclass
from pathlib import Path

CONFIG_PATH = Path(__file__).parent.parent.parent / "config.toml"


@dataclass
class FFConfig:
    league_id: str
    username: str
    cache_dir: Path
    season: str


def _load_toml() -> dict:
    if CONFIG_PATH.exists():
        return tomllib.loads(CONFIG_PATH.read_text())
    return {}


def resolve(
    league_id: str | None,
    username: str | None,
    cache_dir: str | None,
    season: str | None,
) -> FFConfig:
    """Merge CLI flags over env vars over config.toml, then require the essentials."""
    file_values = _load_toml()

    league_id = league_id or file_values.get("league_id")
    username = username or file_values.get("username")
    cache_dir = cache_dir or file_values.get("cache_dir") or "cache"
    season = season or file_values.get("season") or "2026"

    missing = [name for name, value in [("league_id", league_id), ("username", username)] if not value]
    if missing:
        raise ValueError(
            f"Missing required setting(s): {', '.join(missing)}. "
            f"Pass them as flags, set FF_LEAGUE_ID/FF_SLEEPER_USERNAME, "
            f"or fill in {CONFIG_PATH}."
        )

    return FFConfig(
        league_id=league_id,
        username=username,
        cache_dir=Path(cache_dir),
        season=season,
    )
