---
name: fantasy
description: Run and interpret the `ff` fantasy football advisory CLI (in fantasy/) for the user's Sleeper league. Use when the user asks about their fantasy lineup, waivers/FAAB, trades, or league standings, or mentions Sleeper fantasy football.
---

# Fantasy football advisory (`ff`)

`ff` lives in `fantasy/` and is a separate uv project from the rest of this
repo. It's read-only: it prints markdown briefs, it never submits anything
to Sleeper. Read `fantasy/CLAUDE.md` for the full constraints before editing
its code.

## Which command to run when

| User asks about... | Run | Weekly cadence |
|---|---|---|
| league settings, standings, "what's my roster" | `ff league` | any time |
| who to start, bench risk | `ff lineup` (phase 2) | Sunday morning, before kickoffs |
| waiver claims, FAAB bids | `ff waivers` (phase 2/3) | Tuesday, after waivers process |
| trade targets, buy-low/sell-high | `ff trades` (phase 3) | any time, weekly check-in is fine |

Always run from `fantasy/`: `cd fantasy && uv run ff <command>`.

## Reading the output

- Every table cell traces back to a fetched value (Sleeper or nflverse) --
  if you see "no data," that's the tool declining to guess, not a bug to
  paper over.
- There are no invented confidence percentages. "Unclear" in the bullets
  means the underlying signals disagree; report that to the user rather
  than picking a side for them.
- FAAB bids and start/sit calls come with their reasoning in the bullets
  below the table -- surface that reasoning when relaying the brief, not
  just the number/verdict.
- The user executes every recommendation themselves in the Sleeper app.
  Never suggest that this tool (or you) can submit a claim, propose a
  trade, or change a lineup -- there is no write path, by design.

## Before running

`ff` needs `fantasy/config.toml` (copy from `config.example.toml`) or the
`FF_LEAGUE_ID` / `FF_SLEEPER_USERNAME` env vars set. If neither is present,
tell the user rather than guessing at IDs.

## If asked to extend it

Check `fantasy/CLAUDE.md`'s build-phase list first -- work happens in order
(league -> lineup -> waivers/trades -> text-signal enrichment), and phase 4
(scraping beat writers, depth charts) is explicitly deferred and optional.
