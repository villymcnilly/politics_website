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
    "substance": [ { "heading", "body"?, "items": [..] } ],
    "players": [ { "name", "wants", "latest" } ],
    "timeline": [ { "date", "text", "url", "outlet" } ]  newest first,
    "open": [..]  unverified points and open questions,
    "changelog": [ { "date", "text" } ]  newest first,
    "sources": [ { "title", "url", "read": "full" | "excerpt" } ]
  } ] }
```

Do not add, rename or remove fields. Do not change a story's `id`: it is the
URL hash people link to. Do not add or remove stories unless the owner asks.
The page shows only `http://` and `https://` URLs as links, and lets only
`<b>…</b>` through as markup; everything else is shown as literal text.

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
- `sources`: add every new source used, with `read` set honestly.
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
   allowed values, dates are `YYYY-MM-DD`, timeline and changelog are newest
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
