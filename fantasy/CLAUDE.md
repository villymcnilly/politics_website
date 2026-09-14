# ff -- fantasy football advisory CLI

Scoped to this directory (`fantasy/`). This is a personal tool living inside
an unrelated repo (`politics_website`); nothing here touches the site build.

## What this is

A local CLI that reads Sleeper league state + public NFL data and prints
three markdown briefs: `ff lineup`, `ff waivers`, `ff trades`. It never
executes anything -- the user reads the brief and acts in the Sleeper app.

## Hard constraints (do not relax these without being asked)

1. **Sleeper is read-only.** `api.sleeper.app` has no write/POST endpoints
   we use or should ever try to use. Never attempt to automate a waiver
   claim, trade, or lineup change, and never touch the user's logged-in
   Sleeper session (cookies, browser automation, etc.). This tool only
   recommends.

2. **All arithmetic is Python, tested.** Scoring, opportunity metrics,
   replacement level, value, FAAB sizing: deterministic functions with unit
   tests (see `tests/`). An LLM's role, when one is involved (phase 4+), is
   limited to reading free text (beat reports, injury language) and
   drafting prose -- never computing a number that ends up in a brief.

3. **No player names, stats, or rankings from training data.** Every number
   in an output must trace back to a fetched row (Sleeper or nflverse). If
   a metric can't be computed from fetched data, the brief says "no data",
   never a guess dressed up as an answer.

4. **Cache everything; tests never hit the network.**
   - `/players/nfl` (the ~5MB full player dump): at most once per 24h.
   - League/roster/user/matchup data: short TTL (see `ROSTER_TTL` in
     `sleeper/repository.py`), not fetched on every call.
   - All tests use `httpx.MockTransport` or fixtures under `tests/fixtures/`.
     If a test needs live data, it's testing the wrong thing -- fix the test,
     don't relax this rule.

## Layout

```
src/ff/
  cache.py              generic disk cache (JSON + parquet), TTL-based
  scoring.py            points(stat_line, scoring_settings) -- pure, tested
  league.py             joins league/roster/user/player payloads
  render.py             markdown rendering, no data fetching
  config.py             league_id/username/cache_dir resolution
  cli.py                typer entry point, wires the above together
  sleeper/
    client.py           thin GET-only wrapper over api.sleeper.app/v1
    repository.py       cache-through access built on client.py
tests/
  fixtures/             recorded Sleeper-shaped JSON, hand-verified by hand
  test_scoring.py       recomputes a completed week, checks vs Sleeper's
                         own reported score (tolerance 0.1)
  test_integration.py   full pipeline against a mock transport -- the
                         closest thing to "run it for real" without network
```

## Sleeper API notes (undocumented from this environment -- verify against
docs.sleeper.com if something doesn't match reality)

Base URL `https://api.sleeper.app/v1`. Endpoints in use:
`/user/<username_or_id>`, `/league/<id>`, `/league/<id>/rosters`,
`/league/<id>/users`, `/league/<id>/matchups/<week>`,
`/league/<id>/transactions/<round>`, `/league/<id>/traded_picks`,
`/players/nfl`, `/players/nfl/trending/<add|drop>`, `/state/nfl`.

`scoring_settings` is a flat `{stat_key: points_per_occurrence}` dict --
never assume standard/half-PPR, always read it from the league. Sleeper
does not appear to publicly document a raw per-player weekly stat-line
endpoint; weekly stat lines for projections/opportunity metrics come from
`nfl-data-py` (phase 2+), not Sleeper.

`nfl_data_py` is upstream-deprecated in favor of `nflreadpy` (same
maintainer, similar API). Still in use here per explicit instruction;
flag to the user before migrating.

## Development

```
uv sync              # install deps
uv run pytest        # run tests (offline, always)
uv run ff league     # requires config.toml or FF_LEAGUE_ID/FF_SLEEPER_USERNAME
```

## Build phases

1. Sleeper client + cache + `ff league` (scoring rules, roster positions,
   roster, standings). **Done.**
2. nflverse ingest + `ff lineup`.
3. `ff waivers` + `ff trades`.
4. Optional text-signal enrichment (beat-writer RSS, depth-chart freshness)
   that degrades gracefully when absent. Not before phase 1-3 are solid.
