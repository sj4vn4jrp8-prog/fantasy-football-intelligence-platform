# Project Overview

## Purpose

This application is a fantasy football command center for analyzing leagues, rosters, scoring rules, weekly matchups, projections, expert commentary, and start/sit decisions. The current MVP focuses on a single-user workflow: import a Sleeper league, generate or import projections, calculate league-adjusted points, optimize starters, review matchup outlooks, and manually ingest expert transcript notes into a Knowledge Brain.

## Long-Term Vision

The long-term goal is a platform-agnostic fantasy football analysis system that can support multiple league hosts and multiple projection providers. The app should help fantasy managers understand not only who to start, but why a recommendation exists, how confident the system is, and where projection providers disagree.

Planned long-term capabilities include real projection provider imports, injuries, news, waiver recommendations, trade analysis, dynasty and keeper tooling, playoff schedule optimization, expert transcript trend detection, user accounts, and an AI assistant layered on top of trusted structured analysis.

## Supported League Platforms

- Sleeper: implemented for league import, teams, rosters, players, scoring settings, roster settings, and matchups.
- Yahoo: scaffolded adapter only.
- ESPN: scaffolded adapter only.
- RT Sports: scaffolded adapter only.
- MyFantasyLeague: scaffolded adapter only.

## Supported Projection Providers

- Mock Provider: implemented for local development and analysis testing.
- FantasyPros: implemented for server-side weekly NFL projection import.
- Fantasy Nerds: scaffolded provider only.
- FantasyData: scaffolded provider only.
- SportsDataIO: scaffolded provider only.

# Current Architecture

## Platform Adapter Layer

League platforms are isolated behind a platform adapter layer in `src/platforms/`. The shared adapter contract lives in `src/domain/fantasy/platform-adapter.ts`.

The implemented adapter is `SleeperAdapter` in `src/platforms/sleeper/`. Sleeper-specific client code and mappers live under `src/platforms/sleeper/`, so the rest of the app does not need to depend directly on Sleeper API response shapes.

Scaffolded adapters exist for Yahoo, ESPN, RT Sports, and MyFantasyLeague. These intentionally throw "not implemented yet" errors until auth, terms, and data mapping are designed.

## Unified Domain Model

The shared fantasy football language lives in `src/domain/fantasy/`. It defines platform-neutral concepts such as:

- `League`
- `Team`
- `Roster`
- `Player`
- `Matchup`
- `LeagueSettings`
- `ScoringSettings`
- `RosterSettings`
- `Transaction`
- `DraftData`

The domain layer is meant to describe fantasy football concepts without making Sleeper, Yahoo, ESPN, or another vendor the core shape of the app.

## Projection Provider Layer

Projection and enrichment providers are separate from league platforms. The provider contracts live in `src/domain/fantasy/projection-provider.ts` and `src/providers/projections/`.

The implemented providers are the mock projection provider and the FantasyPros weekly projection provider. Mock projections create deterministic fake weekly projections for players already imported on rosters. FantasyPros imports real weekly NFL projections server-side with `FANTASYPROS_API_KEY` and saves them into the same provider-neutral projection table. Scaffolded providers exist for Fantasy Nerds, FantasyData, and SportsDataIO.

Projection providers should eventually enrich players with projections, rankings, injuries, news, weather, schedules, and odds. They should not own league structure, teams, rosters, or matchups.

## Week-Aware Projection Architecture

Projection selection is centralized in `src/analysis/projections/selectProjection.ts`. Analysis callers pass a `ProjectionContext` containing `season`, `week`, optional `provider`, and optional projection `mode`.

The selector filters by internal `playerId`, season, and week before it considers provider preference. This prevents the optimizer, scoring engine, confidence engine, and matchup dashboard from accidentally using the latest projection from the wrong week.

Projection mode currently supports `SELECTED_PROVIDER` and `CONSENSUS`. Selected-provider mode uses one stored provider projection for each player. Consensus mode uses the consensus projection engine for optimizer candidates and weekly matchup totals.

The league detail page includes a week selector. It defaults to the most recently imported projection week, falling back to the latest available matchup week when no projections exist.

## External Identity System

The app uses internal database IDs as the source of truth. External platform and provider IDs are stored in identity tables:

- `LeagueExternalIdentity`
- `TeamExternalIdentity`
- `PlayerExternalIdentity`
- `UserExternalIdentity`

This lets one internal player or league carry multiple external IDs, such as a Sleeper ID, FantasyPros ID, FantasyData ID, or Fantasy Nerds ID. This is important for future provider matching and projection merging.

## Prisma/Supabase Persistence Layer

The persistence layer uses Prisma with PostgreSQL. The current development database is Supabase PostgreSQL.

The Prisma schema is in `prisma/schema.prisma`. The shared Prisma client is created in `src/lib/db.ts` to avoid creating too many database sessions during development.

The database stores imported leagues, teams, rostered players, matchups, scoring rules, roster settings, projections, injuries, schedules, recommendation placeholders, provider accounts, and audit logs.

## Knowledge Brain Layer

The Knowledge Brain starts at `/knowledge-brain`. It stores expert sources, source videos, manually pasted transcripts, transcript segments, deterministic expert takes, player mentions, trend signals, and ingestion runs.

Transcript source adapters live in `src/knowledge-brain/transcript-sources.ts`. `ManualTranscriptSource` is implemented. `YouTubeTranscriptSource` and `TranscriptApiSource` are scaffolded but intentionally inactive.

The deterministic analyzer lives in `src/knowledge-brain/analyzeTranscript.ts`. It matches transcript segments against existing internal `Player` records, classifies sentiment as bullish, bearish, or neutral, classifies take type with keyword rules, and stores `ExpertTake` and `PlayerMention` records.

Player intelligence aggregation lives in `src/knowledge-brain/player-intelligence.ts`. It builds player-centric profiles from mentions, expert takes, trend signals, and recency, then calculates deterministic intelligence scores.

Content freshness logic lives in `src/knowledge-brain/freshness.ts`. Source videos and transcripts store `publishDate`, `contentSeason`, `freshnessLabel`, and `includeInCurrentAnalysis`. Default player intelligence calculations use only records marked for current analysis, so old transcripts remain stored without polluting current-season decisions.

Expert consensus logic lives in `src/knowledge-brain/expert-consensus.ts`. It compares expert stances for each player, calculates expert agreement, and labels players as Strong Bullish, Bullish, Split, Bearish, Strong Bearish, or Not Enough Data. Low-sample early signals are calculated separately so small data sets can still surface useful bullish, bearish, or neutral leans without weakening strict consensus thresholds.

Expert accuracy tracking logic lives in `src/knowledge-brain/expert-accuracy.ts`. It summarizes expert take volume, sentiment tendencies, player/position coverage, take-type coverage, consensus agreement, staged accuracy readiness, and manually graded outcome counts.

Manual outcome grading logic lives in `src/knowledge-brain/expert-outcomes.ts`. It stores one outcome grade per expert take, then recalculates expert accuracy snapshots by season, position, and take type.

## Local Transcript Fetcher Workflow

The repository includes a local-only companion workflow in `scripts/knowledge-brain/`. It is designed to run from the user's own Windows machine, not from the Next.js app, API routes, serverless functions, hosted app servers, or cloud notebooks.

`fetch_fantasy_transcripts.py` reads `fantasy_sources.json`, uses `yt-dlp` for YouTube search and metadata, uses `youtube-transcript-api` for transcript retrieval, and saves Markdown transcript files with metadata front matter. The script skips already saved video IDs, pauses between requests, logs failed videos, and can be safely rerun.

The app imports these local Markdown files through `/knowledge-brain/import-markdown`. That page accepts pasted Markdown content, creates or updates the matching source video/transcript records, segments the transcript, and runs the existing deterministic analyzer. No YouTube requests are made from the app server.

The local fetcher supports `min_upload_date`, `max_age_days`, `include_search_terms`, and `exclude_search_terms`. The default source config avoids old 2023/2024 videos unless the user explicitly changes the config.

# Current Features

## League Import - Completed

Users can enter a Sleeper league ID and import league-level information into the database. The operation is idempotent, so re-importing the same league updates existing records instead of duplicating them.

## Team Import - Completed

Sleeper rosters and users are mapped into internal fantasy teams. Team external IDs are stored separately from internal team IDs.

## Roster Import - Completed

Rostered players are saved into internal roster records. Empty or new leagues are handled gracefully, and only players used by the league are saved instead of the full Sleeper player catalog.

## Matchup Import - Completed

Available Sleeper matchups are saved into the database. The league detail page can display imported matchups by week.

## League Detail Page - Completed

`/leagues/[leagueId]` displays imported league data from Prisma, including league info, roster settings, scoring rules, teams, rostered players, projections, adjusted projections, start/sit recommendations, weekly matchup dashboard, and imported matchups.

## Tabbed League Workspace - Completed

The league detail page is organized into workspace tabs: Overview, Teams & Rosters, Matchups, Projections, Start/Sit, and Settings. The route remains `/leagues/[leagueId]`, with query parameters preserving selected week, provider, tab, and projection mode.

## Platform-Agnostic Architecture - Completed

Sleeper now works as one platform adapter instead of defining the whole application model. Future platforms are scaffolded.

## External Identity System - Completed

League, team, player, and user external IDs can be stored in provider-neutral identity tables. This keeps core persistence platform-agnostic.

## Mock Projection Import - Completed

The app can generate deterministic mock projections for rostered players for a selected league and week. This enables analysis work before real provider keys are available.

## FantasyPros Projection Import - Completed

The app can import weekly NFL projections from FantasyPros for rostered players. The API key is read only from server-side environment variables. Imported rows are matched to internal players by FantasyPros external ID when available, then by normalized player name, NFL team, and position. Matched player IDs are saved to `PlayerExternalIdentity` for future imports.

## Projection Storage - Completed

The database stores provider-neutral player projections with player ID, provider, season, week, projected stats JSON, projected fantasy points, floor, median, ceiling, confidence, variance, source timestamp, and import timestamp.

## Week-Aware Projection Architecture - Completed

Projection selection is centralized and driven by selected season/week/provider context. Player projections, league-adjusted scoring, start/sit recommendations, confidence analysis, and weekly matchup projections now use the selected week instead of silently choosing the latest available projection.

## Consensus Projection Engine - Completed

The app can compare all stored provider-neutral projections for the same player, season, and week. It calculates provider count, consensus projected fantasy points, low projection, high projection, spread, provider agreement score, consensus confidence, and providers used. Single-provider consensus rows are still shown, but confidence is capped to reflect limited data.

## Consensus Projection Optimizer Mode - Completed

Start/sit recommendations and weekly matchup projections can now use consensus projections instead of a single selected provider. Consensus mode feeds the optimizer consensus projected points, low/high range, provider agreement, spread, provider count, and consensus confidence while remaining week-aware and provider-neutral.

## League-Specific Scoring Engine - Completed

The scoring engine converts projected stats into fantasy points using imported league scoring rules. Current support includes common offensive stats such as passing yards, passing touchdowns, interceptions, rushing yards, rushing touchdowns, receptions, receiving yards, receiving touchdowns, and fumbles lost when those stat keys exist in the league rules.

## Start/Sit Optimizer - Completed

The optimizer recommends starters and bench players for each fantasy team using league-adjusted projected points. It respects roster slots including QB, RB, WR, TE, FLEX, SUPER_FLEX, K, DST/DEF, and IDP when data exists.

## Weekly Matchup Dashboard - Completed

The dashboard shows imported team-vs-team matchups with actual scores when available, optimized starter projections, projected winner, projected margin, warnings for missing projections, confidence labels, and estimated win probability.

## Confidence & Variance Engine - Completed

The confidence engine calculates volatility score, upside score, downside risk, confidence percentage, risk label, recommendation strength, matchup confidence, estimated win probability, and close-matchup warnings using existing projection floor, median, ceiling, and confidence fields.

## Knowledge Brain - Initial Version Completed

The app now includes `/knowledge-brain` for expert insight tracking. It creates default experts for Fantasy Footballers, Late Round Podcast, Fantasy Flock, Underdog Fantasy, and FantasyPros. The page includes expert management, manual transcript ingestion, source status, recent transcripts, latest expert takes, most-mentioned players, bullish/bearish trend sections, uncategorized transcript review, and ingestion runs.

Manual transcript ingestion saves a source video, transcript, transcript segments, analyzer output, player mentions, and trend signals. YouTube discovery and third-party transcript APIs are scaffolded but not active.

## Player Intelligence Profiles - Completed

The Knowledge Brain now includes `/knowledge-brain/players` and `/knowledge-brain/players/[playerId]`. The directory supports search, position filtering, and NFL team filtering. Player profiles show identity, sentiment summary, expert breakdown, recent takes, trend analysis, reasons for bullishness, and reasons for bearishness.

The deterministic intelligence score uses mention frequency, bullish ratio, bearish ratio, expert count, and recent activity. Scores map to Strong Bullish, Bullish, Neutral, Bearish, or Strong Bearish labels.

## Local Markdown Transcript Import - Completed

The Knowledge Brain now includes `/knowledge-brain/import-markdown`. Users can paste a locally saved Markdown transcript with metadata front matter, and the app saves it into `SourceVideo`, `Transcript`, and `TranscriptSegment`, then runs the existing deterministic transcript analyzer.

The importer is safe to rerun for the same YouTube video ID. It replaces the previous source video and related transcript analysis records before saving the new copy.

## Bulk Markdown Transcript Import - Completed

The Knowledge Brain now includes `/knowledge-brain/import-markdown/bulk`. Users can upload multiple `.md` transcript files saved by the local fetcher. The app imports each file as user-provided local content, reuses the existing Markdown parser/analyzer, applies freshness rules, and skips duplicates by video ID or URL.

Bulk import reports total submitted, imported, skipped, failed, and per-file status. It does not call YouTube, scrape websites, or use paid APIs.

## Local YouTube Transcript Fetcher - Completed

The local companion script in `scripts/knowledge-brain/fetch_fantasy_transcripts.py` can discover fantasy football expert videos with `yt-dlp`, fetch available transcripts with `youtube-transcript-api`, and save import-ready Markdown files. It is intentionally outside the Next.js runtime.

## Content Freshness Controls - Completed

Knowledge Brain source videos and transcripts now track freshness labels: Current, Recent, Stale, Historical, and Archived. Manual transcript ingestion and Markdown transcript import calculate freshness from publish date. The dashboard, player intelligence directory, and player profiles default to current-analysis content only, with controls for target season, freshness label, and optional historical inclusion.

Existing transcripts can be backfilled safely with `scripts/knowledge-brain/backfill_freshness.mjs`. The backfill does not delete data; it recomputes freshness fields and excludes stale/historical content from current intelligence by default.

## Expert Consensus Engine - Completed

The Knowledge Brain now includes `/knowledge-brain/consensus`. It compares expert opinions by player, counts bullish, bearish, and neutral expert stances, calculates an agreement score, and labels consensus strength.

The main Knowledge Brain dashboard shows widgets for strongest consensus, most divisive players, most bullish agreement, and most bearish agreement. Player profiles include a player-level expert breakdown with each expert's mention count, bullish/bearish/neutral counts, latest take, and stance.

## Low-Sample Expert Signals - Completed

The Expert Consensus page now includes an Early Signals section for players that do not yet qualify for true consensus. The strict Not Enough Data rule remains unchanged: fewer than two experts or fewer than three total mentions cannot become true consensus.

Early Signals are grouped into Emerging Bullish Signals, Emerging Bearish Signals, and Needs More Expert Coverage. Each row shows the player, position, team, mention count, experts mentioning the player, sentiment lean, latest take, freshness label/date, and what additional evidence is needed for true consensus. Player Intelligence Profiles also show consensus readiness and early-signal status.

## Expert Accuracy Engine - Initial Version Completed

The Knowledge Brain now includes `/knowledge-brain/experts` and `/knowledge-brain/experts/[expertId]`. The Expert Directory shows active status, total takes, current-season takes, sentiment counts, player coverage, position coverage, and staged accuracy status.

Expert profiles show transcript count, take count, sentiment breakdown, take type breakdown, position coverage, recent takes, most-discussed players, bullish players, bearish players, consensus agreement rate, accuracy status, and take tracking. Take tracking shows takes awaiting future outcome grading, takes eligible for future grading, high-conviction takes, and the positions/types where each expert is most active.

Accuracy status is deterministic and scaffolded:

- Not Ready: fewer than 10 scoped takes.
- Tracking: 10 to 24 scoped takes, with no graded outcomes yet.
- Ready For Grading: 25 or more scoped takes, ready for manual outcome grading.
- Graded: one or more scoped takes have manually saved outcomes.

## Expert Take Outcome Grading - Initial Version Completed

The Knowledge Brain now includes `/knowledge-brain/grading`. This page lists takes awaiting manual grading and lets the user save an outcome type, grade, confidence, outcome value, outcome date, and notes.

Manual grading is stored in `ExpertTakeOutcome`. Saving a grade recalculates `ExpertAccuracySnapshot` rows for the expert by season, position, take type, and overall totals. Expert directory pages, expert profiles, player profiles, and the main Knowledge Brain dashboard can display graded counts, accuracy rate, correct/partial/incorrect/push counts, recently graded takes, and experts with graded accuracy.

Outcome grading is manual only. No automatic player outcome detection exists yet.

# Database Overview

## Core Tables

- `users`: reserved for future multi-user support.
- `leagues`: internal league records.
- `teams`: internal fantasy team records.
- `rosters`: rostered player membership by team and league.
- `players`: internal player records.
- `league_scoring_rules`: imported league scoring settings.
- `league_roster_settings`: imported lineup and roster slot settings.
- `matchups`: imported fantasy matchups.

## External Identity Tables

- `league_external_identities`: maps internal leagues to platform/provider IDs.
- `team_external_identities`: maps internal teams to platform/provider IDs.
- `player_external_identities`: maps internal players to platform/provider IDs.
- `user_external_identities`: reserved for future platform user IDs.

## Projection and Enrichment Tables

- `player_projections`: provider-neutral weekly projections.
- `player_weekly_stats`: future weekly stat imports.
- `injuries`: future injury imports.
- `schedules`: future NFL schedule, weather, and odds data.
- `provider_accounts`: future provider account/API key records.
- `data_source_audit_logs`: future audit trail for imported data.

## Recommendation-Related Tables

- `recommendations`: generic table for future start/sit, waiver, trade, and playoff recommendations.
- `waiver_candidates`: reserved for future waiver/free agent analysis.

## Knowledge Brain Tables

- `experts`: expert sources such as Fantasy Footballers and FantasyPros.
- `expert_channels`: channel URL placeholders and future source identifiers.
- `source_videos`: source content metadata.
- `transcripts`: saved transcript text.
- `transcript_segments`: deterministic chunks of transcript text.
- `expert_takes`: extracted player takes.
- `expert_take_outcomes`: manual grading records for expert takes.
- `expert_accuracy_snapshots`: deterministic expert accuracy summaries by season, position, and take type.
- `player_mentions`: matched player mentions from transcript segments.
- `trend_signals`: aggregate bullish, bearish, neutral, or mixed player trends.
- `brain_ingestion_runs`: audit trail for manual and scaffolded ingestion attempts.

`source_videos` and `transcripts` also store freshness metadata: publish date, content season, freshness label, and whether the record should be included in current intelligence.

# Supported Platforms

| Platform | Status | Notes |
| --- | --- | --- |
| Sleeper | Implemented | League import, settings, teams, rosters, players, and matchups are working. |
| Yahoo | Scaffolded | Adapter exists but is not implemented. |
| ESPN | Scaffolded | Adapter exists but is not implemented. |
| RT Sports | Scaffolded | Adapter exists but is not implemented. |
| MyFantasyLeague | Scaffolded | Adapter exists but is not implemented. |

# Supported Projection Providers

| Provider | Status | Notes |
| --- | --- | --- |
| Mock Provider | Implemented | Generates deterministic fake projections for rostered players. |
| FantasyPros | Implemented | Server-side weekly NFL projection import is available. |
| Fantasy Nerds | Scaffolded | Provider shell exists; no real API import yet. |
| FantasyData | Scaffolded | Provider shell exists; no real API import yet. |
| SportsDataIO | Scaffolded | Provider shell exists; no real API import yet. |

# Current Limitations

- The app is single-user only.
- Authentication is not implemented.
- Sleeper is the only implemented league platform.
- FantasyPros is the only real projection provider currently connected.
- Mock projections are useful for development, but they are not real fantasy forecasts.
- The optimizer is deterministic and simple; it does not yet account for injuries, byes, locked games, Vegas totals, weather, or depth chart changes.
- The week selector is implemented, but there is not yet a richer week comparison view.
- Confidence and win probability are heuristic estimates, not simulation outputs.
- Consensus optimizer mode uses stored projected fantasy points from providers. It does not yet blend projected stat categories into a true league-specific consensus stat line.
- FantasyPros endpoint shape can be overridden with `FANTASYPROS_BASE_URL` if the account uses a different official API base URL or templated endpoint.
- Waiver, trade, free agent, keeper, dynasty, and playoff tools are not implemented yet.
- Recommendation records are not yet persisted for start/sit output; current recommendations are calculated at page render time.
- Kicker, DST, and IDP analysis depends on provider stat keys matching the league scoring rules.
- Knowledge Brain transcript ingestion is manual only.
- Expert outcome grading is manual only; the app does not yet determine whether a take was correct automatically.
- Accuracy rates depend on user-entered grades and should be treated as tracking scaffolding until grading rules are formalized.
- YouTube discovery is available only through the local Python companion script. The deployed app/server does not call YouTube.
- The app can bulk import multiple `.md` files, but it does not import entire folders recursively.
- YouTube transcripts are not guaranteed to exist. Some videos have no captions, blocked captions, or captions unavailable to `youtube-transcript-api`.
- The seeded transcript source channel URLs are placeholders and should be edited by the user.
- Freshness labels depend on transcript/video publish date. Content with no date is marked stale and excluded from current intelligence by default.
- Archived content is schema-supported but does not yet have an edit button in the UI.
- Expert consensus is deterministic and depends on extracted take sentiment quality.
- The transcript analyzer is deterministic and keyword-based; it does not understand sarcasm, deeper context, or unresolved player nicknames yet.
- Player intelligence reasons are keyword-derived themes, not human-reviewed conclusions.

# Roadmap

## Near-Term

- Real projection providers.
- Enhanced confidence modeling.
- Provider disagreement flags in lineup tables.
- Projection variance in recommendation explanations.
- Knowledge Brain transcript review workflow.
- Formal outcome grading rubrics for start/sit, waiver, breakout, fade, injury, draft, and trade takes.
- Connect approved player intelligence to start/sit explanations.

## Mid-Term

- Trade analyzer.
- Waiver engine.
- Free agent recommendations.
- Injury integration.
- Transcript source review and approval controls.

## Long-Term

- Multi-user support.
- Authentication.
- Dynasty tools.
- Keeper tools.
- Playoff optimizer.
- Expert trend integration into start/sit explanations.
- AI assistant.

# How To Resume Development

## Required Commands

Install dependencies:

```bash
npm install
```

Run the local development server:

```bash
npm run dev
```

Validate Prisma schema:

```bash
npm run prisma:validate
```

Run lint:

```bash
npm run lint
```

Run production build:

```bash
npm run build
```

On Windows PowerShell, use `npm.cmd` if script execution policy blocks `npm`:

```bash
npm.cmd run dev
```

## Database Commands

Generate Prisma client:

```bash
npm run prisma:generate
```

Push the current Prisma schema to the development database:

```bash
npm run db:push
```

The `.env` file must include `DATABASE_URL` pointing at the Supabase PostgreSQL database.

## How To Import A League

1. Start the dev server with `npm run dev`.
2. Open the homepage.
3. Enter a Sleeper league ID in the import form.
4. Submit the import.
5. Open the linked league detail page.

## How To Generate Mock Projections

1. Open `/leagues/[leagueId]` for an imported league.
2. Find the "Mock Projection Import" section.
3. Enter the desired week.
4. Click the generate button.
5. Review Player Projections, League-Adjusted Projections, Start/Sit Recommendations, and Weekly Matchup Dashboard.
6. Use the Projection Context control to switch Projection Mode between Selected Provider and Consensus.

## How To Use Knowledge Brain

1. Run `npm run db:push` after pulling the Knowledge Brain schema changes.
2. Start the dev server with `npm run dev`.
3. Open `/knowledge-brain` or click "Open Knowledge Brain" from the homepage.
4. Review or edit the default expert cards.
5. Paste a transcript into Manual Transcript Ingestion.
6. Review recent transcripts, latest expert takes, player mentions, and trend sections.
7. Use Target Season, Freshness, and Include Historical controls to adjust the current intelligence scope.
8. Open `/knowledge-brain/players` to review player intelligence profiles.
9. Open `/knowledge-brain/grading` to manually grade extracted expert takes.

## How To Grade Expert Takes

1. Run `npm run db:push` after pulling the outcome grading schema changes.
2. Start the dev server with `npm run dev`.
3. Open `/knowledge-brain/grading`.
4. Select an outcome type and grade for a take.
5. Optionally add confidence, outcome value, outcome date, and notes.
6. Save the grade.
7. Review updated accuracy metrics on `/knowledge-brain`, `/knowledge-brain/experts`, and `/knowledge-brain/experts/[expertId]`.

## How To Backfill Knowledge Brain Freshness

After running `npm run db:push` for the freshness schema changes, run:

```bash
node scripts/knowledge-brain/backfill_freshness.mjs --target-season 2026
```

This updates existing source videos and transcripts with freshness metadata. It does not delete old transcripts.

## How To Use The Local Transcript Fetcher

Install the local Python dependencies:

```bash
python -m pip install -r scripts\knowledge-brain\requirements.txt
```

Edit source searches and channel URLs:

```bash
notepad scripts\knowledge-brain\fantasy_sources.json
```

Preview discovered videos without saving transcripts:

```bash
python scripts\knowledge-brain\fetch_fantasy_transcripts.py --dry-run
```

Fetch available transcripts locally:

```bash
python scripts\knowledge-brain\fetch_fantasy_transcripts.py
```

The script saves Markdown files under `scripts/knowledge-brain/transcripts/`. Open one of those files, copy the full Markdown content, and paste it into `/knowledge-brain/import-markdown`, or select multiple `.md` files at `/knowledge-brain/import-markdown/bulk`.

To avoid old content during local discovery, edit `scripts/knowledge-brain/fantasy_sources.json`. The default config starts at `2026-01-01` and excludes obvious 2023/2024 matches.
