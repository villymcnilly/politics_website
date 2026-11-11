# Bulletin: daily update

Standing instruction for the weekday morning update of Bulletin
(`bulletin.html`) in `villymcnilly/politics_website`. A run that is told
"follow BULLETIN_UPDATE.md" does everything below, in order.

Bulletin is a page of standing background briefs on running news stories. Each
brief is written out in full and meant to be read cold by someone who has not
followed the story. It is not a list of links. The content lives in
`bulletin.json` in the repo root. The site deploys to Netlify when `main`
changes, so a commit of `bulletin.json` to `main` is the publication.

## 1. Before you start

1. Work from the latest `main`. Read `bulletin.json`.
2. Today's date and all times are Europe/Copenhagen.
3. The only file a run may change is `bulletin.json`. Not `bulletin.html`, not
   `index.html`, not this file, nothing else.

## 2. Data shape – keep it exactly

```
{ "updated_at": ISO time with Copenhagen offset,
  "stories": [ {
    "id", "title",
    "kind": "short" | "long",
    "status": "active" | "closed",
    "status_line": one sentence,
    "last_moved": "YYYY-MM-DD" (last real development, not last run),
    "latest": { "date": "YYYY-MM-DD", "paragraphs": [..] },
    "delta": what changed since the previous run,
    "substance": [ { "heading", "body"?, "items"?: [..], "charts"?: [..] } ],
    "players": [ { "name", "wants", "latest" } ],
    "timeline": [ { "date", "text", "url", "outlet" } ]  newest first,
    "open": [..]  unverified points and open questions,
    "changelog": [ { "date", "text" } ]  newest first,
    "sources": [ { "title", "url", "read": "full" | "excerpt" } ],
    "notes": [ { "term", "aliases": [..], "kind", "title", "text",
                 "url"?, "outlet"? } ]
  } ] }
```

Do not add, rename or remove fields. Do not change a story's `id`: it is the
URL hash people link to. Do not add or remove stories unless the owner asks.
The page shows only `http://` and `https://` URLs as links, and lets only
`<b>…</b>` through as markup; everything else is shown as literal text.

### Substance: write it out, and show the numbers

`substance` is the part of the brief that explains the story, and it should be
written out, not summarised. Each block has a `heading` and, as a rule:

- `body`: two to four paragraphs of running prose, separated by a blank line
  (`\n\n`). Explain how the pieces fit together, who said what and when, and
  what the numbers mean – so that someone who has not followed the story can
  follow it. This is where the length goes. Attribute assessments.
- `items`: only for lists that really are lists (a set of measures, a set of
  names). Never as a substitute for prose.
- `charts`: zero or more diagrams (below).

Aim for four to six blocks per story. Keep the older blocks when the facts have
not changed; edit only what has.

### Charts (`charts`)

A chart is drawn from numbers that are in the sources – never from estimates
presented as data. Anything you calculate yourself (a difference, a share) must
be labelled as your own calculation in the label or the caption. Every chart has
`type`, `title`, optional `unit`, `data`, and a `caption` that carries the
`[n]` source references.

- `"bars"`: `data: [ { "label", "value", "tone"?, "hl"? } ]`. Optional `dec`
  (decimals) and `max`. For comparisons: polls, amounts, thresholds.
- `"change"`: `data: [ { "label", "from", "to", "unit"? } ]`. Before and after.
- `"dots"`: `data: [ { "label", "count", "tone"? } ]`. One dot per person or
  seat, grouped by category – votes, delegations, parliamentary groups.
- `"stack"`: `data: [ { "label", "value", "tone"? } ]`. How a total is made up.
- `"matrix"`: `columns: [..]`, `data: [ { "label", "cells": [ "text" |
  { "t", "tone"? } ] } ]`. Who stands where. `tone` in cells: `yes`, `mid`, `no`.

`tone` for bars, dots and stacks is `a`, `b`, `c` or `d` (four fixed colours);
leave it out for the neutral grey. Use colour to separate categories, not to
decorate. Add a chart only where it shows something the prose cannot show as
fast; one to three per story is plenty. When a number changes, change the
chart in the same run.

`[3]` or `[3, 5]` in running text points to that story's `sources`, counted
from 1. The page shows it as a small raised number; hovering shows the source in
the margin, clicking opens it. Because the numbers are positions in the list:

- **Only ever append to `sources`.** Never reorder or delete an entry – every
  `[n]` in the story would then point at the wrong source.
- Put the reference after the sentence or clause it supports, after the full
  stop. Use it in `latest`, `delta`, `substance`, `players` and `open`. The
  timeline already carries its own link, and the changelog needs none.
- Cite what you actually used for that claim. An `excerpt` source may be cited,
  but the claim still belongs in `open` if it rests on the excerpt alone.

### Notes (`notes`)

Each note is a small box that appears in the right margin when the reader
hovers a word (below the word on narrower screens, as a sheet on phones). The
page finds the words itself: wherever `term` or one of the `aliases` occurs in
the story's text, the first occurrence in each paragraph or list item gets the
note. Nothing is marked up in the text.

- `term`, `aliases`: the exact spellings as they occur in the text, case
  included ("Søren Gade", alias "Gade"). A trailing genitive `s` is matched
  automatically. Longer terms win over shorter ones.
- `kind`: `"person"`, `"fakta"`, `"begreb"`, `"organisation"` or `"sted"`.
- `title`: the heading of the box. `text`: two to four sentences.
- `url` + `outlet`: where the note's facts come from, when it is a reference
  work or another source that is not in `sources`.
- People: a short bio – born, current role, the one or two earlier posts that
  matter here, and their part in the story. Every person named in `latest`
  should have one. Take bios from a reference work (lex.dk) or from the
  articles, never from memory alone for anything that can have changed.
- Facts and concepts: laws, bodies, technical terms, places – what a reader who
  has not followed the story would need explained.
- Keep notes current: when a person's role changes, change the note. Remove a
  note when its term no longer occurs anywhere in the story.

## 3. Research – for each story with status "active"

Stories with status "closed" are left untouched.

- Search for developments since the newest changelog date. Do several searches,
  with different wording. Search in Danish for Danish stories.
- Read primary and readable sources in full: ministries, Folketinget, party and
  organisation statements, international institutions, readable news articles.
- If a site refuses automated access, leave it. Never go around a block with a
  cache, a mirror, an archive copy or another fetch method. Use what the search
  excerpt shows, mark that source `"read": "excerpt"`, and put anything
  important that rests only on an excerpt or a paywalled article in `open` as
  unverified.
- A host that is simply not on the cloud environment's list of allowed domains
  is something else: the page does not refuse, the session just cannot reach it
  (the name does not resolve). That is our own setting, not a block. If the
  reading tool fails that way but the page answers a plain request from the
  session, read it that way. If the host cannot be reached at all, mark the
  source `excerpt` and name the host in the report, so it can be added.

## 4. Updating a story

- `latest.paragraphs`: rewrite. 2–4 paragraphs on where the story stands today,
  readable by someone who has not followed it. Set `latest.date` to today.
- `delta`: one or two sentences on what is new since the previous run. If
  nothing: `"Intet nyt siden sidst."`
- `substance` and `players`: edit only where facts changed.
- `timeline`: add new dated entries at the top, each with `url` and `outlet`.
  Never delete or rewrite old entries, except to correct a factual error – and
  then say so in the changelog.
- `open`: remove what is now answered, add what is new.
- `sources`: add every new source used, at the end of the list, with `read`
  set honestly. A source that is now read in full may have `read` changed.
- Source references: every factual sentence that is new or rewritten gets its
  `[n]`.
- `notes`: add notes for new people and new terms; update the ones whose facts
  changed.
- `changelog`: one entry at the top per run saying what changed, or
  `"Ingen ændringer."` Keep the 30 newest entries.
- `status_line`: one sentence.
- `last_moved`: changes only when something real happened in the story. A run
  that finds nothing new does not change it.

### A story with empty `latest.paragraphs`

Write it from scratch: all sections, with a timeline going back to where the
current chapter of the story began. Set `last_moved` to the date of the latest
real development.

For the Ukraine story (`ukraine-europa`): cover the European developments and,
under its own `substance` heading, how Danish outlets have covered them.

### When a short story ends

When a story of kind "short" reaches its end – a deal is signed, the matter is
settled or dead – write the final state and set `status` to `"closed"`.

## 5. Writing

- Danish.
- First person where a voice is needed ("jeg har ikke kunnet bekræfte").
- En dashes (–), never em dashes.
- Claims only as firm as the source supports. Assessments are attributed to
  whoever made them.
- Paraphrase. No quotes longer than a few words.
- Only `<b>` as markup.
- Check every number against its source before saving.

## 6. Publishing

1. Set `updated_at` to the current time as ISO with the Copenhagen offset
   (`+01:00` in winter, `+02:00` in summer).
2. Check that `bulletin.json` parses as JSON and keeps the shape in section 2:
   every story still has every field, `kind`, `status` and `read` hold only the
   allowed values, every `[n]` points at an existing source, every chart has a known `type` and numeric values, every note has
   `term`, `kind`, `title` and `text`, dates are `YYYY-MM-DD`, timeline and changelog are newest
   first, and no changelog has more than 30 entries.
3. Check that no other file is changed.
4. Commit `bulletin.json` directly to `main` with the message
   `Bulletin: opdatering YYYY-MM-DD` (today's date) and push. No branch and no
   pull request for the daily update.
5. If the check in step 2 fails, or the push to `main` is refused, do not
   publish a half-finished file and do not push anywhere else. Say so in the
   report.

## 7. Report

Finish with a short report in Danish:

- whether the site was updated,
- one line per story on what moved, or that nothing did,
- anything that could not be verified.
