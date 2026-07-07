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

## Product Navigation And Information Architecture

The app now uses a simplified public navigation model: Home, Draft, Players, and Settings.

This is the first sprint of the Great Simplification. The public experience is meant to feel like a fantasy football draft coach instead of an intelligence operations console. Draft is the flagship workflow, Players is the research surface, and Settings is the future home for preferences and integrations.

The Home page now behaves as a calm draft launch point. It emphasizes Start Draft, Prepare for Draft, View Players, recent league context, and Draft Readiness instead of presenting a broad developer-style tool hub.

`/draft/setup` is the first preparation workflow. It lets the user choose a league, select a draft strategy, paste manual ADP/rank rows, and review placeholder draft preferences for QB timing, TE timing, risk tolerance, rookie preference, stack preference, and auto-hide injured players.

Internal systems are preserved behind `/intelligence-operations`. That admin/power-user area links to Knowledge Brain, Recommendation Confidence, Expert Agreement, Review Queue, History, Decision Engine, Experts, Player Compare, transcript tools, quality review, and grading tools.

The underlying intelligence remains intact. The user-facing interface follows the Iceberg Principle: show draft recommendation, Decision Score, confidence, why, risks, and alternatives first; keep Decision Engine, Trust Engine, Knowledge Brain, Expert Memory, Transcript Intelligence, Quality Reviewer, Snapshots, and Consensus available below the surface.

## Knowledge Brain Layer

The Knowledge Brain starts at `/knowledge-brain`. It stores expert sources, source videos, manually pasted transcripts, transcript segments, transcript-level player summaries, deterministic expert takes, player mentions, trend signals, and ingestion runs.

Transcript source adapters live in `src/knowledge-brain/transcript-sources.ts`. `ManualTranscriptSource` is implemented. `YouTubeTranscriptSource` and `TranscriptApiSource` are scaffolded but intentionally inactive.

The deterministic analyzer lives in `src/knowledge-brain/analyzeTranscript.ts`. It matches transcript segments against existing internal `Player` records, classifies sentiment as bullish, bearish, or neutral, classifies take type with keyword rules, and stores `ExpertTake` and `PlayerMention` records as supporting evidence.

Transcript intelligence aggregation lives in `src/knowledge-brain/transcript-intelligence.ts`. It aggregates all evidence for each player across a full transcript into one transcript-level player summary with stance, confidence, themes, caveats, mention count, take categories, comparison player IDs, and linked evidence.

Expert Memory lives in `src/knowledge-brain/expert-memory.ts`. It builds expert-player opinion timelines from approved transcript player summaries first, with approved segment-level takes as fallback. It calculates current stance, opinion trend, conviction score, conviction label, evidence pointers, explanation bullets, and warnings.

Transcript extraction helpers live in `src/knowledge-brain/transcript-extraction.ts`. They clean transcript display text without overwriting raw transcript evidence, strip repeated line-level timestamps from review snippets, detect comparison language, classify player mentions as primary subjects, comparison/context mentions, or unclear mentions, and produce deterministic extraction warnings for review.

Player intelligence aggregation lives in `src/knowledge-brain/player-intelligence.ts`. It builds player-centric profiles from mentions, expert takes, trend signals, and recency, then calculates deterministic intelligence scores.

Content freshness logic lives in `src/knowledge-brain/freshness.ts`. Source videos and transcripts store `publishDate`, `contentSeason`, `freshnessLabel`, and `includeInCurrentAnalysis`. Default player intelligence calculations use only records marked for current analysis, so old transcripts remain stored without polluting current-season decisions.

Expert consensus logic lives in `src/knowledge-brain/expert-consensus.ts`. It compares expert stances for each player, calculates expert agreement, and labels players as Strong Bullish, Bullish, Split, Bearish, Strong Bearish, or Not Enough Data. Consensus now uses approved transcript player summaries first, with approved expert takes only as fallback evidence. Low-sample early signals are calculated separately so small data sets can still surface useful bullish, bearish, or neutral leans without weakening strict consensus thresholds.

Expert accuracy tracking logic lives in `src/knowledge-brain/expert-accuracy.ts`. It summarizes expert take volume, sentiment tendencies, player/position coverage, take-type coverage, consensus agreement, staged accuracy readiness, and manually graded outcome counts.

Manual outcome grading logic lives in `src/knowledge-brain/expert-outcomes.ts`. It stores one outcome grade per expert take, then recalculates expert accuracy snapshots by season, position, and take type.

Weighted consensus logic lives in `src/knowledge-brain/weighted-consensus.ts`. It uses the same summary-first opinion signal stream as raw consensus, then applies available manual accuracy snapshots to calculate expert trust weights and trusted player consensus labels.

Trust Engine logic lives in `src/knowledge-brain/trust-engine.ts`. It turns accuracy, transcript summaries, approved take evidence, Expert Memory, summary-first consensus, summary-first weighted consensus, recency, sample size, and future preference placeholders into explainable Expert Trust Profiles and Player Trust Profiles. Trust Score is the user-facing concept; weighted consensus remains an internal signal.

Player Thesis logic lives in `src/knowledge-brain/player-thesis.ts`. It composes approved player summaries, approved fallback takes, Expert Memory, Trust Score, summary-first consensus, trusted consensus, and snapshot movement into a concise draft-facing case. It produces the recommendation posture, headline, summary, key reasons, key risks, expert agreement, confidence, evidence strength, evidence count, source count, trend direction, draft-day impact, and evidence pointers. The UI presents this as Draft Case, Why this player, What supports this recommendation, and What could go wrong.

Intelligence Snapshot logic lives in `src/knowledge-brain/intelligence-snapshots.ts`. It persists compact versioned snapshots for Expert Memory, Player Trust, and Player Intelligence so the platform can remember how beliefs changed over time instead of only recalculating the current state.

Trust Score is now the primary user-facing Knowledge Brain trust concept. Player profiles, player compare, the consensus page, Brain Search, and the Knowledge Brain dashboard surface Trust Score / Trust Profile language first, while raw consensus and weighted consensus remain visible as supporting signals.

Brain Search logic lives in `src/knowledge-brain/brain-search.ts`. The first Ask assistant is retrieval-driven and deterministic: it classifies supported question patterns, searches stored Knowledge Brain data, and returns direct answers with relevant players, trust context, Expert Memory signals, summary-first consensus rows, summary-first weighted consensus rows, expert takes, and transcript/source citations. No AI provider, YouTube call, paid fantasy provider, or web scraping is required.

Transcript review logic lives in `src/knowledge-brain/take-review.ts`. Extracted expert takes now move through a human review status before they influence decision intelligence. Review statuses are Pending, Approved, Dismissed, and Needs Edit. Decision-oriented Knowledge Brain readers use Approved takes by default, while `/knowledge-brain/review` remains the admin/audit surface for all statuses.

Phase 3A shifts the primary review object from tiny segment takes to transcript-level player summaries. ExpertTake remains stored and reviewable, but it is now supporting evidence beneath each summary. Player Intelligence begins preferring approved transcript summaries when available, with approved segment takes as a fallback for older data.

## Decision Engine Layer

The Decision Engine foundation lives in `src/decision-engine/`. It converts trusted Knowledge Brain intelligence into reusable fantasy recommendation objects without creating a full Draft Assistant, Waiver tool, Trade Analyzer, or Start/Sit product page yet.

Decision Score is separate from Trust Score. Trust Score measures reliability of the underlying intelligence. Decision Score measures strength of a specific recommendation.

The current Decision Engine consumes Player Trust Profiles, Expert Memory, Player Intelligence, raw consensus, weighted consensus, confidence, evidence quality, risk signals, and snapshot movement. The Draft Command Center now adds a draft-specific context layer for selected league settings, roster needs, already drafted positions, draft round/pick, and strategy profile. ADP, live draft availability, position scarcity, bye weeks, and injury data remain neutral placeholders.

The first developer preview page is `/decision-engine`. It shows recommendation type, Decision Score, confidence, strength, supporting factors, risks, warnings, evidence, and alternatives. It is read-only and does not persist recommendation rows.

## Draft Command Center Layer

The Draft Command Center MVP lives at `/draft-command-center`, with `/draft` as the simple product-facing entry route. It is the first user-facing product surface powered by the Decision Engine.

The page consumes `DecisionRecommendation` objects and presents them as draft-facing actions: Draft, Value, Wait, Avoid, or Reach. It shows the recommended player, Decision Score, confidence, Trust Score as supporting evidence, supporting factors, risk factors, alternatives, and evidence summary.

The MVP candidate pool starts with players that can produce Decision Engine recommendations, usually players with Player Trust Profiles and related Knowledge Brain intelligence. The page also reports adjacent candidate counts for approved transcript summaries, projected players, and imported rostered players, but those players remain neutral unless the Decision Engine can produce a recommendation for them.

Draft context is transparent and conservative. Imported league settings can supply league size, scoring format, roster requirements, superflex/2QB signals, and TE premium signals. Manual controls supply round, pick, roster needs, already drafted positions, strategy profile, draft-board state, and manual ADP/rank market data. The manual draft board tracks players drafted by the user and players drafted by other teams so recommendations can focus on the remaining available player pool. Manual ADP/rank rows let the Draft Command Center identify values, fair-price picks, reaches, and avoid-at-cost candidates.

## Local Transcript Fetcher Workflow

The repository includes a local-only companion workflow in `scripts/knowledge-brain/`. It is designed to run from the user's own Windows machine, not from the Next.js app, API routes, serverless functions, hosted app servers, or cloud notebooks.

`fetch_fantasy_transcripts.py` reads `fantasy_sources.json`, uses `yt-dlp` for YouTube search and metadata, uses `youtube-transcript-api` for transcript retrieval, and saves Markdown transcript files with metadata front matter. The script skips already saved video IDs, pauses between requests, logs failed videos, and can be safely rerun.

The app imports these local Markdown files through `/knowledge-brain/import-markdown`. That page accepts pasted Markdown content, creates or updates the matching source video/transcript records, segments the transcript, and runs the existing deterministic analyzer. No YouTube requests are made from the app server.

The local fetcher supports `min_upload_date`, `max_age_days`, `include_search_terms`, and `exclude_search_terms`. The default source config avoids old 2023/2024 videos unless the user explicitly changes the config.

# Current Features

## Simplified Product Navigation - Completed

The public navigation is now Home, Draft, Players, and Settings. Home explains the product quickly, Draft is the primary call to action, Players links to the existing player intelligence directory, and Settings provides a lightweight placeholder for preferences and integrations.

## Intelligence Operations Area - Completed

`/intelligence-operations` is the admin/power-user area for the systems that power recommendations. It keeps Knowledge Brain, Recommendation Confidence, Expert Agreement, Review Queue, History, Decision Engine, Experts, Player Compare, transcript import, quality review, and grading tools accessible without making them primary user navigation.

## Home Draft Readiness - Initial Version Completed

The Home page now answers "Am I ready to draft?" with a Draft Readiness card. It checks whether a league exists, shows ADP and strategy as attention items when not supplied, marks the manual draft board as ready, and gives an overall Ready or Needs Attention status.

## Draft Setup Workflow - Initial Version Completed

`/draft/setup` now provides a lightweight preparation workflow with League, Strategy, ADP, and Draft Preferences sections. The strategy choices are Balanced, Upside, Hero RB, Zero RB, Safe Floor, and Best Player Available. Setup choices flow into `/draft` through query parameters, while deeper persistence and preference scoring remain future work.

## Draft Command Center v2 Simplification - Initial Version Completed

The Draft page now uses a recommendation-first layout. The top of `/draft` and `/draft-command-center` is dominated by one recommended pick with round/pick context, roster need, player name, position/team, Decision Score, confidence, recommendation type, top reasons, risks, alternatives, and a primary Draft Player action.

Advanced draft controls, ADP input, active draft context, recommendation diagnostics, and candidate-pool details remain available behind progressive disclosure. Supporting recommendations are limited to a small secondary list below the hero card. The compact My Roster panel supports the recommendation without dominating the screen.

## Decision Card And Trust Experience - Initial Version Completed

The primary Draft page recommendation now presents as a Decision Card instead of an analytics hero. It leads with the recommended pick, a plain-English draft action, Decision Score, confidence, why the pick makes sense, honest risks, alternatives, and a short recommendation summary.

Recommendation copy now uses coaching language such as Confidence and Current Draft Value instead of exposing implementation terms. The Decision Score includes a concise explanation, confidence labels use Elite, High, Solid, Moderate, and Limited tiers, and supporting evidence remains available through progressive disclosure.

## Player Thesis Foundation - Initial Version Completed

The app now includes a computed Player Thesis layer in `src/knowledge-brain/player-thesis.ts`. It shifts user-facing decision explanation from "raw transcript summary to recommendation" toward "approved evidence to player draft case to recommendation."

The layer uses approved transcript player summaries first, with approved `ExpertTake` rows only as fallback evidence when needed. It excludes pending, dismissed, and needs-edit records. It scores evidence quality using review status, summary quality, confidence, attribution quality, recency, repeated support, source count, expert trust, draft relevance, and expert agreement.

Player profile pages now include a Draft Case section with headline, concise summary, key reasons, key risks, confidence, latest evidence, source breakdown, warnings, and expandable evidence pointers. The Draft Command Center Decision Card can use thesis content for why the pick, risks, recommendation summary, and supporting evidence while keeping the old Decision Engine explanation as fallback.

## Player Thesis Calibration - Initial Version Completed

The Draft Case layer now ranks claims and risks more selectively. Top claims are limited to the best draft-relevant themes, with vague themes filtered out before they can become major reasons. Ranking considers quality score, expert trust, evidence count, source count, recency, repeated support, and draft relevance.

Risks now rank repeated caveats, expert disagreement, weak evidence, stale evidence, volatile Expert Memory, and common draft-day risk themes such as role uncertainty, health/availability, price risk, and volatility. Weak evidence now produces cautious fallback copy instead of forcing a confident recommendation.

The thesis now includes Evidence Strength labels: Strong Evidence, Moderate Evidence, Limited Evidence, Thin Evidence, and Provisional. The Draft Command Center shows the Draft Case headline and Evidence Strength on the Decision Card. Player profiles show Evidence Strength, confidence explanation, why the case matters for draft day, top claims, top risks, and collapsed selection diagnostics.

## Evidence Review And Source Quality Controls - Initial Version Completed

The app now includes a computed Evidence Quality layer in `src/knowledge-brain/evidence-quality.ts`. It evaluates approved transcript player summaries and approved fallback expert takes before they influence Draft Cases.

Each evidence item receives a quality score, quality label, inclusion decision, warnings, reasons, and Draft Case eligibility. High-quality and good evidence can support primary Draft Case claims. Mixed evidence can support secondary context or caveats. Low-quality evidence cannot become a headline claim. Excluded evidence does not influence thesis scoring, but remains visible to admins.

Player profiles now show source quality, included evidence count, excluded evidence count, and concise evidence-quality warnings. The Draft Command Center uses simple coaching language such as strong evidence, developing evidence, or provisional Draft Case instead of exposing audit internals. The Review Queue now shows Evidence Quality labels, inclusion decisions, reasons, warnings, and whether each summary or fallback take contributes to Draft Case use.

## Player Research Experience - Initial Version Completed

`/knowledge-brain/players/[playerId]` now behaves more like a draft research page than an intelligence audit page. The first visible sections answer "Should I draft him?", show the current Draft Case, explain why the information matters on draft day, surface key reasons and risks, and provide same-position alternatives plus a link into Player Compare.

The profile still preserves Trust Profile, Expert Memory, sentiment, consensus, weighted consensus, graded takes, recent takes, trend analysis, reasons, source quality, and transcript evidence, but these details are now grouped behind progressive disclosure so they support the draft decision without overwhelming the first screen.

`/knowledge-brain/players` now functions as a Player Research Board. It shows player, position/team, Draft Case headline, draft posture, confidence, evidence strength, latest mention date, mention count, and a quick research link. It also adds draft posture, evidence strength, and confidence filters on top of the existing search, position, team, season, freshness, and historical controls.

## Draft Flow And Session UX - Initial Version Completed

The Draft page now has a compact Draft Mode header that shows manual draft mode, league, round, pick, overall pick, strategy, current roster need, draft progress, and simple roster guidance.

Manual draft actions now behave more like a guided draft loop. Drafting the recommended player or marking a player as taken by another team updates the drafted lists, advances the pick, removes unavailable players from default recommendations, shows a clear confirmation with the next recommendation, and records the action in a recent draft activity log.

The page now derives a query-string backed `DraftSessionState` with league ID, season, strategy, round, pick, overall pick, drafted players, draft events, last action, and manual source. One-step undo is available from the header and confirmation after the latest manual action. State is still not persisted in the database.

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

## Weighted Consensus Engine - Completed

The Knowledge Brain now calculates trust-weighted expert consensus in addition to raw consensus. Raw consensus continues to count experts equally, but both raw and weighted consensus now use the same summary-first opinion signal stream.

Weighted consensus uses `ExpertAccuracySnapshot` records from manual outcome grading. Experts with no graded outcomes use a default 1.00 trust weight. Experts with graded accuracy use:

```text
trust weight = clamp(0.5, 1.5, 0.5 + accuracy rate)
```

For example, 80% accuracy becomes a 1.30 weight, 50% accuracy becomes 1.00, and 30% accuracy becomes 0.80.

The `/knowledge-brain/consensus` page now shows raw consensus and weighted consensus side by side, including weighted bullish/bearish/neutral scores, weighted agreement, trust-weighted confidence, and top weighted experts. Weighted consensus remains available, but it is now positioned as an internal Trust Engine signal rather than the final user-facing decision layer.

## Summary-First Consensus Internals - Initial Version Completed

Raw consensus and weighted consensus now prefer approved `TranscriptPlayerSummary` records. Approved segment-level `ExpertTake` records are used only as fallback evidence when an expert/player pair has no approved transcript summaries in the selected scope.

The shared consensus opinion stream prevents micro-take overcounting:

- One approved transcript player summary counts as one expert/source/player opinion signal.
- Fallback approved takes are collapsed by expert, source video, transcript, and player into one fallback opinion signal.
- Evidence count remains available for auditability and confidence context.
- Pending, Needs Edit, and Dismissed summaries or takes do not affect trusted consensus.

Weighted consensus still applies expert accuracy/trust weights, but those weights now apply to summary-first opinion signals. Trust Score continues to be the user-facing concept.

## Trust Engine Foundation - Initial Version Completed

The Knowledge Brain now includes `/knowledge-brain/trust`. This page displays deterministic Expert Trust Profiles and first-pass Player Trust Profiles.

Expert Trust Profiles include:

- Overall trust score from 0 to 100.
- Confidence label.
- Sample-size label.
- Dimension breakdown for historical accuracy, recent accuracy readiness, position expertise, take-type expertise, consensus agreement, graded sample size, and current-season activity.
- Explanation bullets.
- Low-sample and data-quality warnings.
- Weighted-consensus trust weight as an internal signal.

Player Trust Profiles include:

- Player trust score from 0 to 100.
- Stance summary.
- Supporting experts with their trust scores.
- Evidence pointers back to transcript summaries or approved takes.
- Disagreement warnings.
- Low-sample warnings.

Trust Score is not yet a lineup recommendation score. It measures how trustworthy the intelligence around an expert or player appears based on currently available evidence. Future preference adjustments are scaffolded as neutral placeholders: preferred expert, ignored expert, risk tolerance, and draft philosophy.

## Expert Memory Foundation - Initial Version Completed

The Knowledge Brain now calculates Expert Memory as a computed intelligence layer. Expert Memory tracks how one expert's opinion on one player moves over time.

Expert Memory uses approved `TranscriptPlayerSummary` records first. If no approved transcript summaries exist for an expert/player pair, it can fall back to approved `ExpertTake` records so older reviewed evidence still contributes.

Each memory timeline includes:

- Expert.
- Player.
- Source title and URL.
- Publish date.
- Content season.
- Stance.
- Confidence.
- Themes.
- Caveats.
- Mention count.
- Evidence count.
- Evidence excerpts.

Opinion trend labels are deterministic: Increasing Bullishness, Decreasing Bullishness, Increasing Bearishness, Decreasing Bearishness, Stable Bullish, Stable Bearish, Stable Neutral, Mixed / Volatile, and Not Enough Data.

Conviction scoring returns a 0 to 100 score and Low, Medium, High, or Very High label. The first formula uses timeline sample size, average confidence, stance consistency, recency, theme consistency, confidence movement, mention volume, and a volatility penalty.

The `/knowledge-brain/trust` page now includes Expert Memory widgets and timeline cards. The Trust Engine consumes Expert Memory through a separate `expertMemory` trust dimension for both expert trust profiles and player trust profiles.

## Brain Search Assistant - Initial Version Completed

The Knowledge Brain now includes `/knowledge-brain/ask`. Users can ask natural-language questions such as what experts think about a player, who experts are bullish or bearish on, which players are divisive, who has strong weighted consensus, and what the latest takes are.

The first version is deterministic. It uses stored player intelligence, expert consensus, weighted consensus, expert takes, expert accuracy context, transcripts, source videos, and freshness filters. The answer panel includes a direct answer, relevant players, consensus or weighted consensus rows, supporting expert takes, and source references with transcript title, expert, publish date, and freshness label.

The page includes quick prompt buttons and controls for target season and historical content. Future AI answer generation can be added behind the retrieval layer, but no AI API key is currently required.

## Transcript Review Queue - Initial Version Completed

The Knowledge Brain now includes `/knowledge-brain/review`. Newly extracted expert takes default to Pending. The review queue lets the user inspect source evidence, edit player match, sentiment, take type, summary, and confidence, then Approve, Dismiss, mark Needs Edit, or return a take to Pending.

Approved takes are trusted. Pending, Dismissed, and Needs Edit takes remain stored and visible in the review queue, but they do not influence player intelligence, raw expert consensus, weighted consensus, Brain Search answers, or expert accuracy calculations by default.

The review page supports filtering by review status, expert, search text, sentiment, take type, freshness label, and content season. Source evidence remains visible through expert/source metadata, publish date, freshness label, extracted excerpt, and full transcript segment context when available.

## Improved Transcript Extraction - Initial Version Completed

The deterministic transcript analyzer now cleans display excerpts, detects comparison-heavy language, and tries to identify the primary player subject before creating ExpertTake records. In clear comparison segments such as "prefer Player A over Player B" or "Player A is ahead of Player B," the analyzer creates a pending take for the likely primary subject instead of creating identical full takes for every mentioned player.

Comparison and context players are still preserved as PlayerMention evidence where possible, but they are not attached as trusted ExpertTake subjects unless the segment supports that. Ambiguous multi-player segments are lower confidence and flagged for human review.

The review queue now shows warning badges for multiple players, comparison language, uncertain primary subject, possible sentiment leakage, timestamp cleanup, and low confidence. Cleaned transcript excerpts are shown first, with raw source text still available for audit.

## Stricter Extraction Guardrails - Initial Version Completed

The extractor now uses a stricter "better to miss than misattribute" policy before creating `ExpertTake` rows. A player mention must have a deterministic subject-opinion link before it can become a take. Examples include direct patterns like "I like Player," "Player is a value," "Player is a fade," "Player should score more," "this benefits Player," or "I prefer Player over another player."

Context-only and comparison-only mentions are preserved as `PlayerMention` audit evidence without creating fake Neutral Uncategorized takes. Examples include "since Player showed up," "with Player in town," "behind Player," "reminds me of Player," or "like Player last year."

The cleaner also removes spoken timestamp phrases such as "44 minutes, 42 seconds," "1 hour, 2 minutes, 3 seconds," and "44 mins 42 secs" from display excerpts while preserving raw transcript text. It also repairs timestamp-related smashed joins such as "secondsAnd" and malformed compact timestamps such as "33:1433 minutes, 14 seconds" before removing the timestamp phrase.

Pronoun-heavy, multi-player segments are treated conservatively. If the extractor cannot link the explicit player name to nearby opinion language, it creates mention-only evidence instead of a pending take. The review queue now surfaces warnings for context-only mentions, comparison-only mentions, pronoun-heavy segments, missing subject-opinion links, spoken timestamp cleanup, low confidence, multiple players, and uncertain primary subjects.

## Transcript Intelligence Engine - Initial Version Completed

The Knowledge Brain now creates transcript-level player summaries after transcript analysis. Each summary represents the expert's overall transcript-level stance on a player instead of exposing dozens of disconnected segment blurbs as the main review unit.

Each `TranscriptPlayerSummary` stores:

- Overall stance: Bullish, Bearish, Mixed, or Neutral.
- Confidence.
- Primary themes.
- Important caveats.
- Mention count.
- Take categories.
- Comparison player IDs.
- Review status.
- Quality score, deterministic reviewer mode, quality reasons, quality warnings, and quality labels.
- Auto-approved timestamp and manual human-review timestamp.
- Linked supporting evidence.

`TranscriptPlayerSummaryEvidence` links summaries back to `ExpertTake`, `PlayerMention`, and transcript segment evidence when available. This preserves proof without making the reviewer approve every fragment first.

`/knowledge-brain/review` now emphasizes transcript player summaries first. The older segment-level `ExpertTake` queue remains visible as supporting evidence and correction tooling. Approving a player summary is the intended Phase 3A workflow.

Player Intelligence now prefers approved transcript summaries when they exist for a player, while falling back to approved segment-level takes for older data that has not yet been regenerated.

## AI Quality Reviewer and Exception Queue - Initial Version Completed

The Knowledge Brain now has an AI-ready deterministic quality reviewer in `src/knowledge-brain/quality-reviewer.ts`. It evaluates generated `TranscriptPlayerSummary` records and stores a quality score, evidence quality label, attribution quality label, summary clarity label, confidence label, quality reasons, quality warnings, and reviewer mode.

The reviewer can conservatively auto-approve high-quality transcript player summaries. Auto-approval requires a quality score of at least 85, high summary confidence, meaningful evidence count, meaningful mention count, a clear bullish or bearish stance, current-analysis freshness, direct take evidence, and no severe warnings.

`/knowledge-brain/review` now functions as an exception queue. It prioritizes summaries needing human review and includes filters for needs human review, auto-approved, low quality, ambiguous attribution, low evidence, conflicting sentiment, and recently processed summaries.

Manual review remains available for all summary statuses. A human can approve an auto-approved summary, downgrade it to pending or needs edit, dismiss it, or confirm it. Manual review is tracked separately from deterministic auto-approval.

The Trust Engine now includes quality review as a trust signal. Human-reviewed summaries receive stronger review confidence than deterministic auto-approvals, and quality warnings can reduce trust so low-quality auto-approved data does not inflate scores.

## Transcript Reprocessing - Initial Version Completed

The review queue can now reprocess an existing transcript or source video with the current deterministic analyzer. This is intended for old extracted takes created before the improved Phase 2B parser.

Reprocessing is safe by default:

- Approved takes are preserved.
- Approved transcript player summaries are preserved.
- Approved take outcomes are preserved.
- Pending, Needs Edit, and Dismissed extracted takes for the selected transcript/source are replaced.
- Pending, Needs Edit, and Dismissed transcript player summaries for the selected transcript/source are replaced.
- Orphan context/comparison mentions from the selected transcript are recreated.
- New extracted takes are created as Pending. New transcript player summaries pass through the deterministic quality reviewer, so strong summaries can auto-approve and uncertain summaries remain Pending or Needs Edit.

Each reprocessing run creates a `BrainIngestionRun` audit entry with the scope, transcript/source IDs, old unapproved take count, recreated take count, transcript summary counts, duplicate pending cleanup count, and confirmation that approved evidence was preserved.

## Trust Score UX Migration - Initial Version Completed

The Knowledge Brain now presents Trust Score as the primary user-facing measure on major intelligence surfaces:

- Player profiles show a Trust Profile section with player Trust Score, confidence label, current stance, Trust breakdown, top supporting experts, disagreement warnings, low-sample warnings, evidence count, latest evidence date, and evidence pointers.
- Player Compare includes Trust Score, trust confidence, Trust breakdown highlights, Expert Memory trend, and a trusted-support edge summary.
- The Consensus page explains raw consensus, weighted consensus, and Trust Score as separate layers. Trust Score profiles are shown above weighted consensus tables.
- Brain Search deterministic answers now include Trust Context and Expert Memory Signals when relevant.
- The Knowledge Brain dashboard now highlights strongest trusted player signals, high-trust split evidence, rising Expert Memory, and low-trust warnings.

Weighted consensus was not removed. It remains an auditable internal signal feeding the Trust Engine.

## Intelligence Snapshots & Time Machine - Initial Version Completed

The Knowledge Brain now persists historical intelligence snapshots instead of thinking only in terms of current state.

Snapshot tables include:

- `ExpertMemorySnapshot`
- `PlayerTrustSnapshot`
- `PlayerIntelligenceSnapshot`

Each snapshot stores compact point-in-time intelligence such as content season, stance, trend, confidence, trust score, conviction score, intelligence score, evidence count, explanation summary, generation type, generated timestamp, and version.

Snapshots are versioned and append-only. A meaningful update creates the next version for that player/expert/season scope instead of overwriting prior rows.

Snapshot generation now runs after transcript summary generation, deterministic quality review, auto-approval, transcript/source reprocessing, manual summary review, manual take review, and manual outcome grading.

The first Time Machine UI is available at `/knowledge-brain/history`. It supports player and target-season selection, then shows Trust Score history, Player Intelligence history, and Expert Memory history with movement labels for score, stance, confidence, conviction, trend, and evidence count.

The Trust Engine now exposes a player snapshot movement signal from persisted `PlayerTrustSnapshot` rows. The signal is visible but conservative; it does not yet change Trust Score weights.

## Decision Engine Foundation - Initial Version Completed

The app now includes a reusable Decision Engine foundation in `src/decision-engine/` and a developer preview page at `/decision-engine`.

The engine creates typed recommendation objects for categories such as Draft, Avoid, Reach, Wait, Value, Buy, Sell, Hold, Start, Sit, Waiver Add, and Waiver Hold. The current preview mostly emits Draft, Value, Avoid, Wait, and Hold because draft price, waiver context, lineup context, and trade context are not connected yet.

Each recommendation includes:

- Recommendation type.
- Decision Score.
- Confidence.
- Recommendation strength.
- Supporting factors.
- Risk factors.
- Warnings.
- Evidence summary.
- Source evidence.
- Same-position alternatives when available.

Decision Score uses Trust Score, Expert Memory, Player Intelligence, consensus agreement, confidence, evidence quality, deterministic risks, and neutral future placeholders. It is not the same as Trust Score: Trust Score measures reliability, while Decision Score measures recommendation strength.

## Draft Command Center MVP - Initial Version Completed

The app now includes `/draft-command-center`, the first user-facing decision product powered by the Decision Engine.

The page answers "Who should I draft next, and why?" with a draft recommendation board. It uses existing `DecisionRecommendation` objects and maps them into draft-facing categories: Draft, Value, Wait, Avoid, and Reach.

The MVP includes:

- Top draft target widgets.
- Value watch.
- Wait/Avoid warnings.
- Highest-confidence recommendations.
- Imported league selector.
- Active draft context panel.
- Round and pick controls.
- Manual roster needs by position.
- Manual already-drafted position counts.
- Manual draft board actions: drafted by me, drafted by other, and undo.
- Available-player filtering that hides drafted players by default.
- My Drafted Team panel.
- Drafted By Others panel.
- Future Live Draft Sync placeholder for Sleeper, Yahoo, and ESPN.
- Manual ADP/rank textarea.
- Market value filters.
- Unmatched ADP rows section.
- Future ADP Provider Sync placeholder.
- Strategy profile controls: Balanced, Upside, Safe Floor, Hero RB, and Zero RB.
- Position filter.
- Minimum Decision Score filter.
- Recommendation type filter.
- Target season filter.
- Include/exclude low-confidence control.
- Current/historical content control.
- League/ADP/roster/scoring context disclosure.

Each recommendation card shows Decision Score as the headline metric, confidence, Trust Score as supporting evidence, market status, supporting factors, draft context effects, risks, alternatives, and evidence summary. The draft context can boost roster needs, penalize overfilled positions, adjust for selected draft strategy, add small scoring-fit signals for PPR, half-PPR, standard, TE premium, and superflex/2QB leagues, explain whether a player is still in the available pool, and adjust for manual market value. Real live draft sync, provider-backed ADP, position scarcity, bye weeks, and injury data remain future integrations.

## Draft Context Inputs - Initial Version Completed

The Draft Command Center now builds a reusable draft context object from imported league data and manual controls.

The context includes:

- Selected imported league.
- League size.
- Scoring format.
- Roster slot requirements.
- Draft round.
- Draft pick.
- Current roster needs.
- Already drafted positions.
- Target season.
- Strategy profile.
- Neutral ADP placeholder.

The first scoring pass is intentionally conservative. Roster needs can add a small boost, overfilled positions can receive a small penalty, Hero RB and Zero RB can modify early-round position fit, Safe Floor can reward lower-risk cards, Upside can tolerate volatility, and selected league scoring can add small position-specific fit signals. All context effects are shown on the card instead of hidden inside the score.

## Manual Draft Board State - Initial Version Completed

The Draft Command Center now has a lightweight manual draft board.

The board can represent:

- Available players.
- Players drafted by the user.
- Players drafted by other teams.
- Current round.
- Current pick.
- Overall pick number.
- Draft source, currently `MANUAL`.

Users can mark a recommendation card as drafted by them, mark it as drafted by another team, or undo the drafted status. Drafted players are hidden from recommendation widgets and the recommendation board by default. A "show drafted players" control can reveal them for review with an unavailable-player context penalty.

Players marked as drafted by the user are grouped in the My Drafted Team panel and feed roster construction scoring. For example, drafting multiple WRs can reduce future WR priority, while having no RBs can keep RB need boosted. Players drafted by other teams are tracked separately and only affect availability, not the user's roster construction.

The board state is currently stored in URL query parameters rather than persisted in Prisma. This keeps the MVP simple and makes the state easy to reset, while preserving the same conceptual shape that future Sleeper/Yahoo/ESPN live draft sync can populate.

## Manual ADP / Market Value Input - Initial Version Completed

The Draft Command Center now accepts manual ADP/rank data.

Supported input examples:

```text
Player,ADP,Rank
Bijan Robinson,3.4,3
Ja'Marr Chase,5.1,5
TreVeyon Henderson,74.2,71
```

Simple rows also work:

```text
Bijan Robinson,3
Ja'Marr Chase,5
TreVeyon Henderson,71
```

The matcher uses conservative exact normalized player-name matching. If team or position columns are supplied, those must also match. Unmatched rows are shown clearly so the user knows which market rows did not influence recommendations.

Matched rows calculate value-vs-pick from the current overall pick. Market statuses are:

- Strong Value.
- Value.
- Fair Price.
- Slight Reach.
- Reach.
- Avoid At Cost.
- Unavailable / Neutral.

Market value changes Decision Score conservatively. Strong values get a meaningful boost, values get a moderate boost, fair-price picks are near neutral, reaches receive penalties, and unavailable market data remains neutral. ADP alone cannot fully override trusted player intelligence because total draft-context adjustments are capped.

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

The Phase 5A Decision Engine currently generates recommendation objects in memory and does not write to these tables yet.

## Knowledge Brain Tables

- `experts`: expert sources such as Fantasy Footballers and FantasyPros.
- `expert_channels`: channel URL placeholders and future source identifiers.
- `source_videos`: source content metadata.
- `transcripts`: saved transcript text.
- `transcript_segments`: deterministic chunks of transcript text.
- `expert_takes`: extracted player takes.
- `expert_takes.reviewStatus`: human review status controlling whether a take is trusted by decision intelligence.
- `transcript_player_summaries`: transcript-level player intelligence summaries, review status, deterministic quality review metadata, auto-approval timestamp, and manual review timestamp.
- `transcript_player_summary_evidence`: links player summaries to supporting takes, mentions, and segments.
- `expert_take_outcomes`: manual grading records for expert takes.
- `expert_accuracy_snapshots`: deterministic expert accuracy summaries by season, position, and take type.
- `expert_memory_snapshots`: versioned expert-player memory history.
- `player_trust_snapshots`: versioned player Trust Score history.
- `player_intelligence_snapshots`: versioned player intelligence history.
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
- Newly imported Knowledge Brain player summaries are quality-reviewed deterministically. Strong summaries can auto-approve, but ambiguous or low-quality summaries still require human review before they influence summary-first decision intelligence.
- Deterministic transcript extraction is stricter but still heuristic; nuanced player nicknames, long pronoun chains, and complex debates can require human correction in the review queue.
- Transcript reprocessing preserves approved takes by default, but it does not yet include a broad bulk-reprocess-all workflow.
- Quality review is deterministic only. The AI reviewer hook exists architecturally, but no AI provider is connected yet.
- Auto-approval is intentionally conservative and should be calibrated against real transcript volume before powering user-facing fantasy recommendations.
- Expert outcome grading is manual only; the app does not yet determine whether a take was correct automatically.
- Accuracy rates depend on user-entered grades and should be treated as tracking scaffolding until grading rules are formalized.
- Weighted consensus depends on manual grading volume. With no graded outcomes, it intentionally matches raw consensus because all experts use the default 1.00 trust weight.
- Trust Engine scores are deterministic and provisional. They are useful for explainability, but they still depend on manual grades, approved summaries, and the current quality of extracted evidence.
- Player Thesis is deterministic and computed at request time. It now uses calibrated claim/risk ranking and Evidence Strength labels, but it still depends on approved transcript summaries, source freshness, and future validation against real fantasy outcomes.
- Evidence Quality decisions are deterministic and computed at request time. They reduce weak evidence influence, but thresholds still need calibration against reviewed transcript volume and real draft outcomes.
- Player Research alternatives are currently same-position Knowledge Brain alternatives, not true ADP/rank/tier alternatives. Current Draft Value is not connected on the player profile yet.
- Expert Memory can now be persisted as snapshots after meaningful updates, but existing historical records need new ingestion/review/reprocess events or a future backfill to populate old history.
- Snapshot generation is synchronous for now. If transcript volume grows, it should move to a background job.
- Snapshot rows store compact summaries and source IDs, not full duplicated transcript evidence.
- Expert Memory trend labels are heuristic and deterministic; they should be reviewed against real transcript volume before powering decisions.
- Trust Engine player profiles are not yet deeply integrated into Brain Search, Start/Sit, Waivers, Trades, or Draft Assistant workflows.
- Trust Score is now visible in Brain Search and Knowledge Brain pages, but it is not yet connected to league lineup recommendations, waivers, trades, draft tools, or playoff tools.
- Decision Engine recommendations are not persisted and do not yet include provider-backed ADP, position scarcity, bye weeks, injury data, waiver availability, trade partner context, or full user preferences.
- The Draft Command Center is an MVP, not a live draft room. It can accept manual round/pick, roster needs, drafted position counts, strategy profile, manual drafted-player state, and manual ADP/rank data, but it does not yet sync directly with a live platform draft room or paid market provider.
- The Draft Command Center v2 layout is a simplification pass, not a full live draft room. Advanced controls are still form-based and some diagnostic language remains inside collapsed sections for auditability.
- The new Settings page is a placeholder. It does not yet persist preferences, draft strategy defaults, or integration settings.
- `/draft` and `/players` are simplified aliases that redirect to existing implementation routes rather than separate rewritten experiences.
- `/draft/setup` is a workflow scaffold. Strategy and ADP can flow into the draft page, but draft preferences are not persisted or scored yet.
- Projection-only and imported-only players are counted in the Draft Command Center candidate pool, but they do not become draft recommendations until Decision Engine input adapters are added for those sources.
- YouTube discovery is available only through the local Python companion script. The deployed app/server does not call YouTube.
- The app can bulk import multiple `.md` files, but it does not import entire folders recursively.
- YouTube transcripts are not guaranteed to exist. Some videos have no captions, blocked captions, or captions unavailable to `youtube-transcript-api`.
- The seeded transcript source channel URLs are placeholders and should be edited by the user.
- Freshness labels depend on transcript/video publish date. Content with no date is marked stale and excluded from current intelligence by default.
- Archived content is schema-supported but does not yet have an edit button in the UI.
- Expert consensus is deterministic and depends on extracted take sentiment quality.
- The transcript analyzer is deterministic and keyword-based; it intentionally skips ambiguous mentions when no subject-opinion link is found.
- The transcript analyzer now detects common context and comparison patterns, but nuanced rankings and multi-player discussions may still need review before approval.
- Expert accuracy is still primarily attached to `ExpertTake` outcomes. Consensus and weighted consensus are summary-first, but outcome grading remains take-level until summary-level grading is designed.
- Player intelligence reasons are still keyword-derived themes, not fully human-written conclusions.

# Roadmap

## Near-Term

- Real projection providers.
- Enhanced confidence modeling.
- Provider disagreement flags in lineup tables.
- Projection variance in recommendation explanations.
- Expanded Knowledge Brain review workflow with bulk actions and richer correction tools.
- Calibrate deterministic quality review thresholds against real imported transcripts.
- Add quality review QA reports for auto-approved, low-evidence, ambiguous, and conflicting summaries.
- Add snapshot backfill tooling for existing transcripts and reviewed summaries.
- Add richer Time Machine filtering by expert, generation type, and date range.
- Broader migration of expert accuracy and grading views from segment takes toward summary-aware reporting.
- Integrate Trust Engine output into Brain Search, player profiles, player compare, and future decision tools.
- Continue migrating decision surfaces to consume Trust Engine outputs before raw consensus or weighted consensus.
- Continue migrating decision surfaces to consume Player Thesis/Draft Case output for user-facing explanations while keeping raw evidence available through progressive disclosure.
- Connect Player Research to provider-backed ADP, rankings, tiers, and draft-room availability so "Should I draft him?" can include true market value and better alternatives.
- Integrate Expert Memory into expert profile and player profile drilldowns.
- Add persisted Expert Memory snapshots if request-time computation becomes too slow.
- Use Expert Memory in Draft Assistant and future Decision Intelligence explanations.
- Add provider-backed ADP, positional scarcity, bye weeks, and injury status to the Draft Command Center.
- Add live draft sync through platform adapters using the same manual draft board state shape.
- Bulk transcript reprocessing for filtered review queues after more review controls are in place.
- Formal outcome grading rubrics for start/sit, waiver, breakout, fade, injury, draft, and trade takes.
- Weighted consensus calibration after more graded outcomes exist.
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
10. Open `/knowledge-brain/review` to work the exception queue, inspect auto-approved summaries, manually override summary status, or reprocess extracted evidence.
11. Open `/knowledge-brain/history` to inspect versioned Trust, Player Intelligence, and Expert Memory snapshots.
12. Open `/decision-engine` to inspect current read-only recommendation objects built from Trust Score, Expert Memory, Player Intelligence, consensus, evidence quality, and risk signals.
13. Open `/draft/setup` to prepare for a draft by selecting a league, choosing a strategy, pasting ADP/rank rows, and reviewing draft preference placeholders.
14. Open a player profile from `/knowledge-brain/players` to review the Draft Case built from approved evidence, including key reasons, key risks, confidence, and expandable evidence.
15. Open `/draft` or `/draft-command-center` to use the first draft-facing recommendation board powered by the Decision Engine. Select an imported league when available, then adjust round, pick, roster needs, drafted positions, strategy profile, and pasted ADP/rank rows to see conservative context effects. Use "Drafted by me" and "Drafted by other" on recommendation cards to remove unavailable players from the default board.
16. Open `/intelligence-operations` when you need the admin/power-user routes for Knowledge Brain, Recommendation Confidence, Expert Agreement, review, history, transcript import, experts, grading, or the Decision Engine developer preview.

## How To Reprocess Old Extracted Takes

1. Start the dev server with `npm run dev`.
2. Open `/knowledge-brain/review`.
3. Find a take from the transcript/source that should be re-extracted.
4. Click "Reprocess Transcript" or "Reprocess Source".
5. Confirm the browser prompt.
6. Review the new Pending takes created by the improved extractor.

Reprocessing replaces only unapproved extracted takes and summaries: Pending, Needs Edit, and Dismissed. Approved reviewed takes, approved summaries, and manually graded outcomes remain untouched. Newly generated summaries pass through deterministic quality review, so some may auto-approve while uncertain ones remain in the exception queue.

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
