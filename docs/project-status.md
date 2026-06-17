# Project Overview

## Purpose

This application is a fantasy football command center for analyzing leagues, rosters, scoring rules, weekly matchups, projections, and start/sit decisions. The current MVP focuses on a single-user workflow: import a Sleeper league, generate mock projections, calculate league-adjusted points, optimize starters, and review matchup outlooks.

## Long-Term Vision

The long-term goal is a platform-agnostic fantasy football analysis system that can support multiple league hosts and multiple projection providers. The app should help fantasy managers understand not only who to start, but why a recommendation exists, how confident the system is, and where projection providers disagree.

Planned long-term capabilities include real projection provider imports, injuries, news, waiver recommendations, trade analysis, dynasty and keeper tooling, playoff schedule optimization, user accounts, and an AI assistant layered on top of trusted structured analysis.

## Supported League Platforms

- Sleeper: implemented for league import, teams, rosters, players, scoring settings, roster settings, and matchups.
- Yahoo: scaffolded adapter only.
- ESPN: scaffolded adapter only.
- RT Sports: scaffolded adapter only.
- MyFantasyLeague: scaffolded adapter only.

## Supported Projection Providers

- Mock Provider: implemented for local development and analysis testing.
- FantasyPros: scaffolded provider foundation and environment variable support.
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

The implemented provider is the mock projection provider. It creates deterministic fake weekly projections for players already imported on rosters. Scaffolded providers exist for FantasyPros, Fantasy Nerds, FantasyData, and SportsDataIO.

Projection providers should eventually enrich players with projections, rankings, injuries, news, weather, schedules, and odds. They should not own league structure, teams, rosters, or matchups.

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

## Platform-Agnostic Architecture - Completed

Sleeper now works as one platform adapter instead of defining the whole application model. Future platforms are scaffolded.

## External Identity System - Completed

League, team, player, and user external IDs can be stored in provider-neutral identity tables. This keeps core persistence platform-agnostic.

## Mock Projection Import - Completed

The app can generate deterministic mock projections for rostered players for a selected league and week. This enables analysis work before real provider keys are available.

## Projection Storage - Completed

The database stores provider-neutral player projections with player ID, provider, season, week, projected stats JSON, projected fantasy points, floor, median, ceiling, confidence, variance, source timestamp, and import timestamp.

## League-Specific Scoring Engine - Completed

The scoring engine converts projected stats into fantasy points using imported league scoring rules. Current support includes common offensive stats such as passing yards, passing touchdowns, interceptions, rushing yards, rushing touchdowns, receptions, receiving yards, receiving touchdowns, and fumbles lost when those stat keys exist in the league rules.

## Start/Sit Optimizer - Completed

The optimizer recommends starters and bench players for each fantasy team using league-adjusted projected points. It respects roster slots including QB, RB, WR, TE, FLEX, SUPER_FLEX, K, DST/DEF, and IDP when data exists.

## Weekly Matchup Dashboard - Completed

The dashboard shows imported team-vs-team matchups with actual scores when available, optimized starter projections, projected winner, projected margin, warnings for missing projections, confidence labels, and estimated win probability.

## Confidence & Variance Engine - Completed

The confidence engine calculates volatility score, upside score, downside risk, confidence percentage, risk label, recommendation strength, matchup confidence, estimated win probability, and close-matchup warnings using existing projection floor, median, ceiling, and confidence fields.

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
| FantasyPros | Scaffolded | Environment support exists; no real API import yet. |
| Fantasy Nerds | Scaffolded | Provider shell exists; no real API import yet. |
| FantasyData | Scaffolded | Provider shell exists; no real API import yet. |
| SportsDataIO | Scaffolded | Provider shell exists; no real API import yet. |

# Current Limitations

- The app is single-user only.
- Authentication is not implemented.
- Sleeper is the only implemented league platform.
- Real projection providers are not connected yet.
- Mock projections are useful for development, but they are not real fantasy forecasts.
- The optimizer is deterministic and simple; it does not yet account for injuries, byes, locked games, Vegas totals, weather, or depth chart changes.
- The weekly matchup dashboard currently uses the preferred/latest available projection per player, not a dedicated week selector for every view.
- Confidence and win probability are heuristic estimates, not simulation outputs.
- Projection variance across multiple real providers is scaffolded but not fully used in the UI yet.
- Waiver, trade, free agent, keeper, dynasty, and playoff tools are not implemented yet.
- Recommendation records are not yet persisted for start/sit output; current recommendations are calculated at page render time.
- Kicker, DST, and IDP analysis depends on provider stat keys matching the league scoring rules.

# Roadmap

## Near-Term

- Real projection providers.
- Enhanced confidence modeling.
- Consensus projections.
- Projection variance.

## Mid-Term

- Trade analyzer.
- Waiver engine.
- Free agent recommendations.
- Injury integration.

## Long-Term

- Multi-user support.
- Authentication.
- Dynasty tools.
- Keeper tools.
- Playoff optimizer.
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
