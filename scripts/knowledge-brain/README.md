# Local Fantasy Transcript Fetcher

This folder contains a local-only companion workflow for the Fantasy Football Knowledge Brain.

It follows the same idea as the Jensen Knowledge Brain guide:

- use `yt-dlp` for YouTube search and metadata
- use `youtube-transcript-api` for available captions/transcripts
- save one Markdown file per video
- include a metadata header the app can import later
- run locally on your own computer, not from the Next.js app or a cloud server

## Why Local Only

Do not run this workflow from the deployed app, a Next.js API route, serverless function, cloud notebook, VPS, AWS, Google Colab, or similar cloud environment.

YouTube may block or throttle cloud IPs, and this app should not scrape or call YouTube from server-side web routes. The safe pattern is:

1. You run the Python script locally.
2. The script saves Markdown transcripts on your machine.
3. You paste one Markdown transcript into `/knowledge-brain/import-markdown`.
4. The app treats that Markdown as user-provided local content.

## Install Python

Install Python 3.10 or newer from [python.org](https://www.python.org/).

On Windows, check "Add Python to PATH" during install.

Verify:

```powershell
python --version
```

If Windows uses the Python launcher, this may also work:

```powershell
py --version
```

## Install Requirements

From the project root:

```powershell
cd fantasy-matchup-analyzer
python -m pip install -r scripts\knowledge-brain\requirements.txt
```

If `python` is not recognized, try:

```powershell
py -m pip install -r scripts\knowledge-brain\requirements.txt
```

## Edit Sources

Open:

```text
scripts/knowledge-brain/fantasy_sources.json
```

Edit:

- `search_terms`
- `channel_urls`
- `max_results_per_search`
- `max_results_per_channel`
- `min_duration_seconds`
- `min_upload_date`
- `max_age_days`
- `include_search_terms`
- `exclude_search_terms`
- `sleep_seconds`
- `output_dir`

The seeded channel URLs are placeholders. Replace them with real channel URLs when you are ready.

The default config starts at `2026-01-01` and excludes obvious `2023`/`2024` matches so stale fantasy advice does not enter current player intelligence by accident.

## Preview Matches

Run a dry run first:

```powershell
python scripts\knowledge-brain\fetch_fantasy_transcripts.py --dry-run
```

Dry runs print whether each discovered video was included or excluded and why.

## Fetch Transcripts

Run:

```powershell
python scripts\knowledge-brain\fetch_fantasy_transcripts.py
```

For a safer small run:

```powershell
python scripts\knowledge-brain\fetch_fantasy_transcripts.py --limit 3 --sleep-min 30 --sleep-max 60
```

The script:

- searches/list videos with `yt-dlp`
- skips videos that are already saved
- fetches available transcripts with `youtube-transcript-api`
- saves Markdown files under `scripts/knowledge-brain/transcripts/`
- pauses between requests
- logs failures to `scripts/knowledge-brain/failed_videos.jsonl`
- stops early on `IpBlocked` or `RequestBlocked` unless `--continue-on-blocked` is passed

## Output Format

Each Markdown file starts with front matter:

```markdown
---
expert: "Fantasy Footballers"
channel: "The Fantasy Footballers"
title: "Example Video Title"
date: "2026-06-01"
content_season: "2026"
runtime: "1:04:22"
runtime_seconds: 3862
url: "https://www.youtube.com/watch?v=..."
video_id: "abc123..."
source_platform: "YouTube"
fetched_at: "2026-06-23T12:00:00+00:00"
---

# Example Video Title

Transcript text...
```

## Import Into The App

1. Start the app locally.
2. Open `/knowledge-brain/import-markdown`.
3. Open a saved `.md` transcript file.
4. Copy the entire Markdown file.
5. Paste it into the form.
6. Import.

The app saves the source video, transcript, transcript segments, expert takes, player mentions, and trend signals.

## Backfill Freshness For Existing Transcripts

After running `npm run db:push` for freshness schema changes, run:

```powershell
node scripts\knowledge-brain\backfill_freshness.mjs --target-season 2026
```

This does not delete transcripts. It recomputes `contentSeason`, `freshnessLabel`, and `includeInCurrentAnalysis` so old content is preserved but excluded from current intelligence by default.

## Troubleshooting

### Missing Transcripts

Some videos do not have captions/transcripts enabled. These will be logged in `failed_videos.jsonl`.

### IP Blocks Or RequestBlocked Errors

Stop and wait before retrying. Increase `sleep_seconds` in `fantasy_sources.json`. Do not move this workflow to a cloud environment.

### No Captions

Open the video manually. If YouTube shows a transcript in the browser, you can copy it into a Markdown file manually and import it through `/knowledge-brain/import-markdown`.

### Too Many Irrelevant Videos

Tighten `search_terms`, add real `channel_urls`, increase `min_duration_seconds`, or lower `max_results_per_search`.

### Duplicate Files

The script skips any saved Markdown filename containing the video ID, so it is safe to rerun.
