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
  "front": {
    "image": { "url", "alt", "caption", "credit", "source_url" } | null,
    "paragraphs": [..]  two or three,
    "markets": { "text", "note", "source_title", "source_url" }
  },
  "stories": [ {
    "id", "title",
    "kind": "short" | "long",
    "status": "active" | "closed",
    "status_line": one sentence,
    "last_moved": "YYYY-MM-DD" (last real development, not last run),
    "latest": { "date": "YYYY-MM-DD", "paragraphs": [..] },
    "delta": what changed since the previous run,
    "substance": [ { "heading", "body"?, "items"?: [..], "charts"?: [..] } ],
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
`<b>…</b>` through as markup; everything else is shown as literal text. On the
page every section of a brief is folded shut until the reader opens it.

### Sources: only good ones

Use a source only if it is one of these:

- primary: ministries, Folketinget and other authorities, parties' and
  organisations' own statements, courts, international institutions;
- news media with an editorial desk: DR, TV 2, the national papers, Ritzau and
  their international counterparts (Euronews, CNN, NPR, and so on);
- reference works (Lex) for biographies and concepts.

Not: tabloids and gossip weeklies, aggregators and rewrite sites, campaign
sites, anonymous blogs, social media, and pages that only repeat another
outlet. If a fact is only found there, do not use it – look for the same wire
story in a good outlet (a Ritzau report often runs in Kristeligt Dagblad or on
dr.dk), or leave the claim out, or put it in `open` as unverified. An opinion
piece is a source for what its author thinks, never for facts.

**Whenever there is doubt about something, say so in the text** ("jeg har ikke
kunnet bekræfte", "ifølge unavngivne kilder") and list it under `open`. Do not
smooth it over.

### Source references in the text

`[3]` or `[3, 5]` in running text points to that story's `sources`, counted
from 1. The page shows it as a small raised number; hovering shows the source in
the margin, clicking opens it. Because the numbers are positions in the list:

- **Append new sources at the end.** Never reorder or delete an entry on a
  daily run – every `[n]` in the story would then point at the wrong source.
  If a source has to go (it was not good enough), renumber every `[n]` in that
  story in the same run, and say so in the changelog.
- Put the reference after the sentence or clause it supports, after the full
  stop. Use it in `latest`, `delta`, `substance` and `open`. The timeline
  already carries its own link, and the changelog needs none.
- Cite what you actually used for that claim. An `excerpt` source may be cited,
  but the claim still belongs in `open` if it rests on the excerpt alone.

### Substance: write it out

`substance` is the part of the brief that explains the story, and it should be
written out, not summarised. Each block has a `heading` and, as a rule:

- `body`: two to four paragraphs of running prose, separated by a blank line
  (`\n\n`). Explain how the pieces fit together, who said what and when, and
  what the numbers mean – so that someone who has not followed the story can
  follow it. This is where the length goes. Attribute assessments.
- `items`: only for lists that really are lists (a set of measures, a set of
  names). Never as a substitute for prose.
- `charts`: normally none (below).

Aim for four to six blocks per story. Keep the older blocks when the facts have
not changed; edit only what has.

### Charts (`charts`) – if in doubt, leave it out

The default is no chart. Add one only when a reader would otherwise have to
hold many numbers or positions in their head, and the comparison is the point.
Never to decorate, never to restate what a paragraph already says, never to
dress up a figure that has one or two numbers. Zero or one per story is normal;
a story with a chart on every block is wrong.

A chart is drawn only from numbers or facts that are in good sources – never
from estimates presented as data. Anything you calculate yourself must be
labelled as such in the label or the caption. Every chart has `type`, `title`,
optional `unit`, `data`, and a `caption` that carries the `[n]` references.

- `"bars"`: `data: [ { "label", "value", "tone"?, "hl"? } ]`; optional `dec`
  (decimals) and `max`.
- `"change"`: `data: [ { "label", "from", "to", "unit"? } ]`.
- `"dots"`: `data: [ { "label", "count", "tone"? } ]`; one dot per person.
- `"stack"`: `data: [ { "label", "value", "tone"? } ]`; how a total is made up.
- `"matrix"`: `columns: [..]`, `data: [ { "label", "cells": [ "text" |
  { "t", "tone"? } ] } ]`; `tone` in cells: `yes`, `mid`, `no`.

`tone` for bars, dots and stacks is `a`, `b`, `c` or `d`; leave it out for
neutral grey. When a number changes, change the chart in the same run.

### Notes (`notes`) – few

A note is a small box in the right margin when the reader hovers a word (under
the word on narrower screens, a sheet on phones). Keep them few: **at most four
per story**, and only where a reader who has not followed the story would be
stuck without it. The page finds the words itself: the first occurrence of
`term` or one of the `aliases` in the story's text gets the note, once per
brief. Nothing is marked up in the text.

- `term`, `aliases`: the exact spellings as they occur in the text, case
  included. A trailing genitive `s` is matched automatically.
- `kind`: `"person"`, `"fakta"`, `"begreb"`, `"organisation"` or `"sted"`.
- `title`: the heading of the box. `text`: two to four sentences.
- `url` + `outlet`: where the note's facts come from, when it is a reference
  work or a source that is not in `sources`.
- Prefer notes on laws, bodies and terms. A person gets a note only if their
  role is essential to the story and not clear from the text – two or three per
  story at most, never every name. Take bios from Lex or from the articles.
- Keep notes current, and remove a note when its term no longer occurs.

### The front page (`front`)

The first thing a reader sees. Rewrite it every run.

- `paragraphs`: two or three, in plain Danish, summing up what has moved in the
  active stories since the last run and what we are following next (the next
  meeting, vote, deadline or decision). Say plainly if nothing moved. No `[n]`
  references here – the detail and the sources are in the stories. Anything
  uncertain is said to be uncertain.
- `markets`: exactly two sentences on the state of the markets, with figures,
  taken from a named good source read in full that day. Say in `note` what the
  figures are (for example a morning report, not closing prices). If no good
  source for the day can be read, write that instead of guessing.
- `image`: one picture from an article read that day, which fits the biggest
  story of the day. `caption` follows the source's own caption and says what
  and when; `credit` is the photographer and agency as the source gives them,
  plus the outlet; `source_url` is the article. Describe the picture in `alt`.
  The page links to the picture on the source's own server – never download an
  image or commit it. The rights stay with the photographer and agency, so only
  take a picture the source credits, and prefer one marked as free to use. Check
  that the address really returns an image before using it. If none fits, or it
  cannot be checked, set `image` to `null` and say so in the report.

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
- `substance`: edit only where facts changed; new facts that fit an existing block go in its `body`.
- `timeline`: add new dated entries at the top, each with `url` and `outlet`.
  Never delete or rewrite old entries, except to correct a factual error – and
  then say so in the changelog.
- `open`: remove what is now answered, add what is new.
- `sources`: add every new source used, at the end of the list, with `read`
  set honestly (only sources that meet the standard in section 2). A source
  that is now read in full may have `read` changed.
- Source references: every factual sentence that is new or rewritten gets its
  `[n]`.
- `notes`: change only if a fact changed or a term is new – and keep the limit
  of four.
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
   every story still has every field and `front` is complete, `kind`, `status`
   and `read` hold only the allowed values, every `[n]` points at an existing
   source, every chart has a known `type` and numeric values, every story has at
   most four notes and every note has `term`, `kind`, `title` and `text`,
   `front.markets.text` is two sentences, dates are `YYYY-MM-DD`, timeline and
   changelog are newest first, and no changelog has more than 30 entries.
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
- what the front page image is and where it comes from – or why there is none,
- anything that could not be verified, and hosts that could not be reached.
