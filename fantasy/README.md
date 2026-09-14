# ff -- Sleeper fantasy football advisor

A local, read-only CLI for one Sleeper league. It fetches your league's
actual state and public NFL data, computes everything in tested Python, and
prints a markdown brief. It never submits anything to Sleeper -- you read
the brief and act in the app yourself.

## Setup

Requires Python 3.12 and [uv](https://docs.astral.sh/uv/).

```bash
cd fantasy
uv sync
cp config.example.toml config.toml
```

Edit `config.toml`:

```toml
league_id = "..."   # from sleeper.com/leagues/<this>/team
username = "..."    # your Sleeper username (not your email)
```

`config.toml` is gitignored -- it's tied to your account, and this happens
to live inside a public repo. CLI flags and `FF_LEAGUE_ID` /
`FF_SLEEPER_USERNAME` / `FF_CACHE_DIR` / `FF_SEASON` env vars override it,
in that order.

## Usage

```bash
uv run ff league     # scoring rules, roster positions, your roster, standings
```

`ff lineup`, `ff waivers`, and `ff trades` land in later phases (see
`CLAUDE.md`).

## Weekly cadence

- **Tuesday** (after waivers process): `ff waivers` for ranked claims and
  suggested FAAB bids.
- **Sunday morning** (before kickoffs): `ff lineup` for start/sit calls and
  which starters are injury/role risks.
- **Any time**: `ff league` for standings, `ff trades` for surplus/deficit
  and concrete offers.

## Data and caching

Everything fetched from Sleeper (`api.sleeper.app`, unauthenticated,
read-only) and nflverse (`nfl-data-py`) is cached to `./cache/` as JSON or
parquet. The full player dump refreshes at most once a day, per Sleeper's
own guidance; league/roster/matchup data refreshes every few minutes. `cache/`
is gitignored -- delete it any time to force a refresh.

## Tests

```bash
uv run pytest
```

Tests never touch the network -- they run against recorded fixtures in
`tests/fixtures/` and `httpx.MockTransport`. The scoring test in
`test_scoring.py` recomputes a completed week from a recorded Sleeper
matchup and checks it against Sleeper's own reported score.

## Design constraints

See `CLAUDE.md` for the full list (read-only Sleeper access, all arithmetic
in tested Python, no invented player data, mandatory caching). Worth
repeating here: if a brief says "no data" or "unclear," that's the tool
declining to guess -- not a bug.
