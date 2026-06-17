# Fantasy Matchup Analyzer Architecture

## Domain Model

The shared fantasy football language lives in `src/domain/fantasy/`.

This layer defines platform-agnostic models such as `League`, `Team`, `Roster`, `Player`, `Matchup`, `LeagueSettings`, `ScoringSettings`, `RosterSettings`, `Transaction`, and `DraftData`.

Vendor IDs should live in `externalIds` or `platform...Id` fields. Sleeper, Yahoo, ESPN, RT Sports, and MyFantasyLeague should not become the core model shape.

## Persistence Model

The database uses internal IDs as the source of truth for app records. A `League.id`, `FantasyTeam.id`, `Player.id`, or `User.id` is the stable internal ID used by relationships inside the app.

External platform and provider IDs live in identity tables:

- `LeagueExternalIdentity`
- `TeamExternalIdentity`
- `PlayerExternalIdentity`
- `UserExternalIdentity`

Each identity row stores the internal entity ID, `provider`, `externalId`, optional `metadata`, `createdAt`, and `updatedAt`. This lets one internal player or league carry IDs from Sleeper, Yahoo, ESPN, RT Sports, MyFantasyLeague, FantasyPros, Fantasy Nerds, FantasyData, or SportsDataIO without adding provider-specific columns to the core entity table.

For example, an internal player might have:

- `SLEEPER: 4034`
- `FANTASYPROS: some-fantasypros-id`
- `FANTASY_NERDS: some-fantasy-nerds-id`
- `FANTASYDATA: some-fantasydata-id`

The app should join through identity tables when importing, matching, or displaying external IDs.

## Platform Adapter Layer

Platform adapters convert a league platform's API shape into the unified domain model.

The shared interface is `FantasyPlatformAdapter` in `src/domain/fantasy/platform-adapter.ts`.

Current implementation:

- `src/platforms/sleeper/SleeperAdapter`

Future scaffolds:

- `src/platforms/yahoo/YahooAdapter`
- `src/platforms/espn/ESPNAdapter`
- `src/platforms/rtsports/RTSportsAdapter`
- `src/platforms/myfantasyleague/MyFantasyLeagueAdapter`

The future adapters intentionally throw "not implemented yet" errors until their auth, API terms, and data mapping are designed.

## Projection Provider Layer

Projection and enrichment providers are separate from league platforms.

The shared interface is `ProjectionProvider` in `src/domain/fantasy/projection-provider.ts`.

Scaffolded providers:

- `src/providers/projections/FantasyNerdsProvider`
- `src/providers/projections/SportsDataIOProvider`
- `src/providers/projections/FantasyDataProvider`

These providers are for projections, rankings, injuries, news, and similar enrichment data. They should not own league structure, rosters, teams, or matchups.

## Current Import Flow

The Sleeper import endpoint still lives at `/api/sleeper/import-league` because it is the Sleeper-specific user action.

The flow is:

1. `SleeperAdapter` fetches league data from Sleeper.
2. Sleeper mappers convert API responses into unified domain models.
3. `saveLeagueImport` resolves or creates internal league, team, and player records.
4. External Sleeper IDs are written to identity tables.
5. The league detail page reads from Prisma, not from Sleeper directly.

The Prisma schema no longer uses Sleeper-specific columns as core persistence keys. Sleeper is now just one provider value in the identity tables.

## Player Matching Across Providers

Player matching should happen in layers:

1. First match on exact external identity, such as `SLEEPER:4034` or `FANTASYDATA:12345`.
2. If a premium provider supplies a crosswalk ID, write that ID to `PlayerExternalIdentity` for the existing internal player.
3. If no identity match exists, use conservative fallback matching: full name, NFL team, and position.
4. If the fallback is ambiguous, create a separate player record and surface the disagreement later instead of silently merging.

Sleeper owns roster membership for imported leagues. Projection providers such as FantasyPros, Fantasy Nerds, and FantasyData enrich players through `PlayerExternalIdentity` rows, not by replacing the internal player ID.

## Adding A New Fantasy Platform Later

1. Implement the adapter in `src/platforms/<platform>/`.
2. Keep API-specific response types inside that platform folder.
3. Map all API responses into `src/domain/fantasy` models.
4. Add any required auth flow separately from the domain models.
5. Write platform IDs to the relevant external identity table.

## Adding A New Projection Provider Later

1. Implement `ProjectionProvider` in `src/providers/projections/`.
2. Keep provider API keys server-side only.
3. Normalize provider records before saving or merging.
4. Store source provider and timestamp on imported data.
5. Preserve provider disagreement so projection variance and confidence can be shown later.
