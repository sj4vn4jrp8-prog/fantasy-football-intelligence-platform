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

## Product Navigation Layer

The public application navigation follows the Iceberg Principle. Normal users see only the workflow surfaces needed to draft well:

- Home
- Draft
- Players
- Settings

The internal intelligence systems remain available, but they are grouped behind `/intelligence-operations`. This page links to Knowledge Brain, Recommendation Confidence, Expert Agreement, Review Queue, History, Decision Engine, Experts, Player Compare, transcript import, quality review, and grading tools.

This split preserves the underlying Knowledge Brain, Trust Engine, Consensus, Expert Memory, and Decision Engine routes while keeping the primary product focused on answering "Who should I draft next?"

The Home page is now a focused draft launch surface rather than a navigation hub. It shows current draft status, a primary Start Draft action, a Prepare for Draft action, recent league context, and a Draft Readiness card. The readiness card uses existing league data when available and conservative placeholders for ADP, strategy, and draft board setup.

The first preparation workflow lives at `/draft/setup`. It establishes the setup path for League, Strategy, ADP, and Draft Preferences. Strategy and ADP choices are passed forward through query parameters to the existing `/draft` route. Draft preferences are visible placeholders for future Decision Engine inputs and are not persisted yet.

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

## Knowledge Brain Transcript Intelligence Pipeline

Knowledge Brain transcript ingestion preserves the raw transcript text in the database. Display cleanup and extraction heuristics are layered on top of that raw evidence instead of overwriting it.

The Phase 3A pipeline is:

1. Manual or Markdown ingestion saves `SourceVideo`, `Transcript`, and `TranscriptSegment` records.
2. `src/knowledge-brain/analyzeTranscript.ts` analyzes transcript segments and creates deterministic `ExpertTake` and `PlayerMention` evidence.
3. `src/knowledge-brain/transcript-extraction.ts` cleans display excerpts, strips line-level timestamps, removes spoken timestamp phrases, detects comparison/context language, and classifies detected player mentions as primary subject, comparison, context, opponent, or unclear.
4. The extractor applies subject-opinion linkage before a mention can become a take. Direct links include patterns such as "I like Player," "Player is a value," "Player is a fade," "Player should score," "this benefits Player," or "I prefer Player over another player."
5. Context-only and comparison-only players remain as `PlayerMention` evidence without becoming trusted take subjects. This includes phrases such as "since Player showed up," "with Player in town," "behind Player," "reminds me of Player," and "like Player last year."
6. Pronoun-heavy multi-player segments are handled conservatively. If the explicit player name cannot be linked to nearby opinion language, the analyzer skips `ExpertTake` creation and records mention-only evidence.
7. `src/knowledge-brain/transcript-intelligence.ts` groups all evidence for each player across the transcript and creates one `TranscriptPlayerSummary` per player.
8. Each summary stores overall stance, confidence, primary themes, important caveats, mention count, take categories, comparison player IDs, review status, quality review metadata, and linked supporting evidence.
9. `src/knowledge-brain/quality-reviewer.ts` evaluates each generated summary in deterministic reviewer mode. Clear, high-quality summaries can be auto-approved conservatively; ambiguous or low-quality summaries go to the exception queue.
10. `/knowledge-brain/review` shows transcript player summaries first, with quality score, auto-approval/human-review status, warnings, reasons, and expandable evidence from `ExpertTake`, `PlayerMention`, and transcript segments underneath.

The intended review workflow is now transcript -> player summary -> evidence. The reviewer approves the coherent player summary instead of approving dozens of small segment blurbs.

`ExpertTake` is still important, but it is no longer the long-term primary intelligence object. It now acts as supporting evidence, correction data, and the current attachment point for manual outcome grading. `PlayerMention` keeps context-only, comparison-only, and audit mentions visible even when no direct take should be created.

Approved-summary gating is the decision boundary for trusted player opinion. Player intelligence, raw consensus, weighted consensus, Expert Memory, Trust Engine, and Brain Search now prefer approved transcript summaries when available, with approved `ExpertTake` rows as fallback for older records that have not yet been regenerated.

Raw consensus and weighted consensus use a shared summary-first opinion signal stream. One approved `TranscriptPlayerSummary` counts as one expert/source/player opinion signal. If no approved summary exists for an expert/player pair, approved fallback `ExpertTake` rows are collapsed by expert, source video, transcript, and player into one fallback opinion signal. This prevents a long transcript with many segment fragments from becoming dozens of independent expert votes. Evidence count can still support confidence and auditability, but it does not inflate expert vote count.

The extraction policy intentionally prefers missing a marginal take over assigning a take to the wrong player. Raw transcript/source text is never overwritten by cleanup.

## Knowledge Brain AI Quality Reviewer Foundation

The AI Quality Reviewer foundation lives in `src/knowledge-brain/quality-reviewer.ts`. It is AI-ready but deterministic today. No external AI provider is required.

The reviewer evaluates each generated `TranscriptPlayerSummary` and stores:

- `qualityScore`: 0 to 100.
- `qualityReviewerMode`: currently `DETERMINISTIC`.
- `qualityReasons` and `qualityWarnings`.
- Evidence, attribution, summary clarity, and confidence labels.
- `autoApprovedAt` when deterministic auto-approval succeeds.
- `manuallyReviewedAt` when a user overrides or confirms the automatic status.

Auto-approval is intentionally conservative. A summary must score at least 85, have high extraction confidence, have meaningful evidence and mention counts, have a clear bullish or bearish stance, be included in current analysis, have direct take evidence, and avoid severe warnings.

The reviewer does not auto-approve segment-level `ExpertTake` rows. Those remain supporting evidence and manual grading anchors.

`/knowledge-brain/review` now behaves as an exception queue. The default view prioritizes summaries that are pending, need edit, have low quality scores, have ambiguous attribution, have low evidence, or contain conflicting sentiment. Auto-approved summaries remain inspectable through filters.

Manual review overrides the automatic reviewer status. Human-reviewed summaries are tracked separately from deterministic auto-approvals so the Trust Engine can treat human review as a stronger trust signal.

## Knowledge Brain Trust Engine

The Trust Engine lives in `src/knowledge-brain/trust-engine.ts`. It is the foundation for moving from extracted information to trusted decision intelligence.

The intended long-term architecture is:

1. Transcript Intelligence.
2. Expert Memory.
3. Trust Engine.
4. Player Intelligence.
5. League Intelligence.
6. Decision Intelligence.

Trust Score is the user-facing concept. It should answer why the user is seeing a recommendation, why the system trusts it, and what would change that trust. Weighted consensus still exists, but it is now treated as an internal signal feeding Trust Score rather than the final user-facing concept.

Phase 4C makes that architecture visible in the product. Player profiles, player compare, consensus, Brain Search, and the Knowledge Brain dashboard now surface Trust Score / Trust Profile as the primary user-facing language. Raw consensus remains the "what experts say" layer. Weighted consensus remains an internal trust-weighted signal. Expert Memory remains the opinion-history layer that explains whether expert conviction is rising, stable, falling, or volatile.

Phase 4D aligns the internals with that product language. Raw consensus and weighted consensus now consume approved transcript player summaries first. Weighted consensus still applies expert accuracy/trust weights, but those weights are applied to summary-first opinion signals rather than raw segment-level takes.

The first Trust Engine pass is deterministic. It creates:

- `ExpertTrustProfile`: expert-level trust score, confidence label, sample-size label, dimension breakdown, warnings, explanation bullets, weighted-consensus signal, and evidence counts.
- `PlayerTrustProfile`: player-level trust score for the intelligence around a player, stance summary, supporting experts, disagreement warnings, low-sample warnings, evidence pointers, and score breakdown.
- Reusable trust scoring types such as `TrustSignal`, `TrustScoreInput`, `TrustScoreResult`, `TrustScoreBreakdown`, and `ExpertTrustDimension`.

Expert trust currently considers historical accuracy, recent accuracy readiness, position coverage, take-type coverage, raw consensus agreement, graded sample size, and current-season activity. Thin graded samples cap confidence and can cap maximum score so the app does not overstate trust before enough outcomes are graded.

Player trust currently considers approved transcript player summaries first, approved expert takes as fallback evidence, raw consensus, weighted consensus, contributing expert trust scores, agreement/disagreement, recency, evidence confidence, and sample size. This is not a start/sit recommendation score; it is a trust score for the quality and reliability of the player intelligence.

Player-facing decision surfaces should increasingly consume `PlayerTrustProfile` rather than reading raw consensus or weighted consensus directly. Weighted consensus should remain available for auditability, but user-facing copy should describe it as one Trust Engine input.

Phase 4F adds persisted intelligence snapshots. The Trust Engine can now expose historical player trust movement from stored `PlayerTrustSnapshot` rows without changing the core deterministic score weights yet. This gives future decision tools a stable interface for questions such as whether trust is increasing, confidence is improving, or an opinion has suddenly reversed.

The Trust Engine includes neutral placeholder preference adjustments for future personalization:

- `preferredExpertAdjustment`
- `ignoredExpertAdjustment`
- `riskToleranceAdjustment`
- `draftPhilosophyAdjustment`

These default to zero until user preference infrastructure exists.

## Knowledge Brain Player Thesis Layer

The Player Thesis layer lives in `src/knowledge-brain/player-thesis.ts`. It is the bridge from approved evidence to draft-facing reasoning.

The layer composes existing trusted intelligence instead of introducing another persistence model. Inputs are approved `TranscriptPlayerSummary` records, approved `ExpertTake` fallback evidence only when a summary does not exist for an expert/player pair, Expert Memory, Player Trust Profiles, summary-first consensus, summary-first weighted consensus, and intelligence snapshot movement signals.

Pending, dismissed, and needs-edit transcript summaries or takes are not eligible thesis evidence. Weak evidence can still become a caveat or warning, but it should not be promoted into a primary claim.

The thesis object produces:

- Current player stance.
- Draft recommendation posture.
- Draft-facing headline and summary.
- Strongest supporting claims.
- Strongest risks.
- Expert agreement summary.
- Recommendation confidence.
- Evidence count, source count, latest evidence date, trend direction, source breakdown, and evidence pointers.

Milestone 2A Sprint 8 adds a computed Evidence Quality layer in `src/knowledge-brain/evidence-quality.ts`. This layer evaluates approved transcript player summaries and approved fallback expert takes before Player Thesis uses them. It produces a quality score, quality label, inclusion decision, warnings, reasons, source quality signal, and audit trail.

Evidence inclusion decisions are:

- Primary Draft Case evidence.
- Secondary Draft Case evidence.
- Caveat-only evidence.
- Excluded evidence.

High and good evidence can support primary Draft Case claims. Mixed evidence can support secondary context or caveats. Low-quality evidence cannot become a headline reason. Excluded evidence does not support thesis scoring, claims, or user-facing evidence pointers, but remains visible in the Knowledge Brain review queue with reasons.

The product should not expose "Player Thesis" as user-facing language. Draft pages should use labels such as Draft Case, Why this player, What supports this recommendation, What could go wrong, Evidence, Expert Agreement, and Recommendation Confidence.

This creates the preferred long-term flow:

1. Evidence.
2. Reviewed transcript player summary.
3. Expert Memory and Trust Score.
4. Player Thesis.
5. Decision Engine recommendation.
6. Draft Command Center presentation.

## Knowledge Brain Intelligence Snapshots

The Intelligence Snapshot layer lives in `src/knowledge-brain/intelligence-snapshots.ts`.

It persists compact, versioned historical records instead of recalculating every historical state from raw evidence. Snapshot rows never overwrite older versions.

Snapshot tables:

- `ExpertMemorySnapshot`: expert-player memory at a point in time, including stance, trend, conviction score, confidence, evidence count, source summary IDs, source take IDs, generation type, and version.
- `PlayerTrustSnapshot`: player Trust Score at a point in time, including trust score, stance summary, confidence label, sample-size label, evidence count, expert count, warnings, generation type, and version.
- `PlayerIntelligenceSnapshot`: player intelligence at a point in time, including intelligence score, label, trend, mention counts, expert count, sentiment counts, generation type, and version.

Snapshot generation is currently triggered after:

1. Transcript ingestion and transcript summary generation.
2. Deterministic quality review and auto-approval.
3. Transcript/source reprocessing.
4. Manual review of transcript player summaries.
5. Manual review of segment-level expert takes.
6. Manual outcome grading that changes expert accuracy inputs.

Generation types are stored with `IntelligenceSnapshotGenerationType`, including `INGESTION`, `REPROCESSING`, `MANUAL_REVIEW`, `AUTO_APPROVAL`, `QUALITY_REVIEW`, `SCHEDULED`, and `MANUAL_BACKFILL`.

The snapshot service calculates the next version per player/expert/season scope, then inserts a new row. It does not update old history. Evidence is referenced through existing IDs and compact metadata rather than duplicating transcript text.

## Decision Engine Foundation

The Decision Engine foundation lives in `src/decision-engine/`.

It is the bridge between trusted Knowledge Brain intelligence and future fantasy actions. The long-term question is not only "what do experts think?" but "what should the user do with that information?"

The first pass is intentionally reusable and deterministic. It does not create Draft Assistant, Trade Analyzer, Waiver, or Start/Sit pages yet. Instead it creates typed recommendation objects that those future tools can consume.

Core files:

- `decision-types.ts`: shared recommendation, score, factor, evidence, warning, risk, confidence, and alternative types.
- `decision-score.ts`: deterministic Decision Score calculation.
- `risk-analysis.ts`: deterministic risk and warning calculation.
- `recommendation-builder.ts`: converts Player Trust Profiles plus Knowledge Brain context into recommendation objects.
- `recommendation-explainer.ts`: creates plain-English recommendation text and evidence summaries.
- `decision-engine.ts`: assembles a developer dashboard from current Knowledge Brain inputs.
- `draft-command-center.ts`: adapts Decision Engine recommendation objects into draft-facing cards and applies conservative draft context inputs.

Decision Score is deliberately separate from Trust Score:

- Trust Score measures reliability of the underlying intelligence.
- Decision Score measures strength of a specific recommendation.

Decision Score currently consumes:

- Player Trust Score.
- Expert Memory.
- Player Intelligence.
- Raw and weighted consensus agreement.
- Conviction/confidence signals.
- Evidence quality.
- Risk signals.
- Snapshot movement.

Future inputs are represented as neutral placeholders until their source systems exist:

- ADP.
- League scoring.
- Roster construction.
- Position scarcity.
- Bye weeks.
- User preferences.
- Injury data.

Supported recommendation categories are Draft, Avoid, Reach, Wait, Value, Buy, Sell, Hold, Start, Sit, Waiver Add, and Waiver Hold. The current developer preview will mostly emit Draft, Value, Avoid, Wait, and Hold because league context, draft price, waiver context, and lineup context are not connected yet.

The developer preview page is `/decision-engine`. It displays generated recommendation objects, score components, supporting factors, risks, evidence, alternatives, and source counts. It is a read-only inspection surface, not a finished fantasy workflow.

## Draft Command Center MVP

The first user-facing consumer of the Decision Engine lives at `/draft-command-center`, with `/draft` as the simplified product-facing entry route.

The Draft Command Center asks a product-level question: "Who should I draft next, and why?" It consumes `DecisionRecommendation` objects from the Decision Engine instead of creating a separate draft scoring system.

The v2 Draft Command Center presentation layer is recommendation-first. The top recommendation is rendered as the dominant hero card with Decision Score, confidence, draft action, reasons, risks, alternatives, and Draft Player action. Advanced filters, ADP input, context diagnostics, source counts, and detailed evidence remain available through progressive disclosure instead of being the default screen.

Milestone 2A Sprint 6 lets the Decision Card consume the Player Thesis layer when available. The card still receives the normal Decision Engine recommendation, but thesis content can replace generic summary, reason, risk, and evidence copy with a cleaner draft case built from approved evidence. If a thesis is unavailable, the existing Decision Engine explanation remains the fallback.

The MVP view maps Decision Engine recommendation types into draft-facing actions:

- Draft.
- Value.
- Wait.
- Avoid.
- Reach.

Each card shows the recommended player, Decision Score, confidence, Trust Score as supporting evidence, supporting factors, risk factors, alternatives, and evidence summary.

The candidate pool currently starts with players that can produce Decision Engine recommendations, which means players with Player Trust Profiles and related Knowledge Brain intelligence. The page also reports how many players exist in adjacent pools such as approved transcript summaries, projections, and imported rosters. Projection-only and imported-only players remain neutral until a future adapter can turn them into full Decision Engine inputs.

Draft context is explicit and conservative in the UI:

- Imported league context: active when a league is selected.
- League size: active when imported teams exist.
- Scoring format: active for broad standard, PPR, half-PPR, TE premium, and superflex/2QB signals.
- Roster slot requirements: active when imported roster settings exist.
- Draft round and pick: manual inputs.
- Current roster needs: manual inputs, defaulting from selected roster slots minus drafted position counts.
- Already drafted positions: manual inputs.
- Strategy profile: Balanced, Upside, Safe Floor, Hero RB, or Zero RB.
- Manual draft board state: active for drafted by me, drafted by others, and available-player filtering.
- Manual ADP and market value: active when the user pastes ADP/rank rows.
- Position scarcity: future integration.
- Bye weeks: future integration.
- Injury data: future integration.

The draft context layer adjusts the display recommendation score conservatively and shows each effect on the card. It can boost positions matching roster needs, penalize positions that are already overfilled, apply small strategy-profile adjustments, add small scoring-fit boosts, and apply manual market-value adjustments. Players marked as drafted by the user or another team become unavailable. Drafted players are hidden from recommendations by default, but can be shown with an unavailable penalty for review.

Manual draft board state is intentionally URL/query-string based for now. It stores player IDs for drafted-by-me and drafted-by-others lists, then derives available-player status at request time. This avoids premature persistence while preserving a reusable state shape that future `FantasyPlatformAdapter.getDraftData` implementations can populate from Sleeper, Yahoo, ESPN, or other draft rooms.

Milestone 2A Sprint 5 adds a clearer manual Draft Session UX on top of that query-string state. The page now derives a `DraftSessionState` presentation model with league ID, target season, strategy, round, pick, overall pick, drafted-by-me IDs, drafted-by-others IDs, recent draft events, the last action, and `source: manual`. This model is not persisted yet, but it mirrors the shape future persistent sessions and live draft sync should write.

The Draft page now treats each manual draft action as an event. Drafting a player or marking a player taken by another team advances the pick, removes the player from available recommendations, records a compact event, and shows a confirmation with the next recommendation. A one-step undo restores the latest manual action and records the undo in the activity log.

Future Sleeper, ESPN, and Yahoo live sync should populate the same drafted player lists and event stream instead of bypassing the Decision Card flow.

Manual market value state is also URL/query-string based for now. The user can paste CSV-style rows such as `Player,ADP,Rank` or simple rows such as `Player,Rank`. The parser matches only exact normalized player names, with optional team and position support when supplied. Matched rows calculate value-vs-pick from the current overall pick and assign market statuses: Strong Value, Value, Fair Price, Slight Reach, Reach, Avoid At Cost, or Unavailable / Neutral. Unmatched rows stay visible instead of being silently discarded.

This keeps the MVP useful without overstating precision. Future live draft, provider-backed ADP, injury, bye-week, and positional scarcity modules should feed draft-specific factors into the Decision Engine rather than bypassing it.

The first Time Machine UI lives at `/knowledge-brain/history`. It lets the user choose a player and target season, then shows Trust Score history, Player Intelligence history, and Expert Memory history as simple timeline cards.

Timeline helpers calculate movement between versions:

- Previous value.
- Current value.
- Numeric score change.
- Direction: up, down, unchanged, changed, new.
- Confidence movement.
- Evidence growth.

Future Draft Assistant and Decision Intelligence flows should use this snapshot layer to explain whether an expert/player signal is stable, strengthening, weakening, or reversing over time.

## Knowledge Brain Expert Memory

Expert Memory lives in `src/knowledge-brain/expert-memory.ts`. It is the layer between Transcript Intelligence and Trust Engine.

Expert Memory answers:

1. What does this expert currently think about this player?
2. Has that opinion changed over time?
3. Is conviction increasing, decreasing, stable, or volatile?
4. What evidence supports that movement?

The preferred input is approved `TranscriptPlayerSummary` data. Pending, dismissed, and needs-edit summaries are not trusted memory. If an expert-player pair has no approved transcript summaries, Expert Memory can fall back to approved `ExpertTake` records so older reviewed data remains useful.

Each `ExpertPlayerMemory` contains a chronological timeline of `ExpertPlayerOpinionPoint` records. Each point stores source title, source URL, publish date, content season, stance, confidence, themes, caveats, mention count, evidence count, summary text, and evidence excerpts.

Opinion trends are deterministic labels:

- Increasing Bullishness
- Decreasing Bullishness
- Increasing Bearishness
- Decreasing Bearishness
- Stable Bullish
- Stable Bearish
- Stable Neutral
- Mixed / Volatile
- Not Enough Data

Trend calculation uses stance movement, confidence movement, stance transitions, and whether the timeline contains conflicting bullish/bearish evidence.

Expert Memory also calculates conviction:

- Conviction score: 0 to 100.
- Conviction label: Low, Medium, High, or Very High.
- Signals for timeline sample size, average confidence, stance consistency, theme consistency, confidence trend, recency, and mention volume.
- Warnings for one-point timelines, volatility, and modest confidence.

The Trust Engine consumes Expert Memory through a separate `expertMemory` trust dimension. Expert Memory is not hidden inside accuracy or consensus. This keeps future decision explanations able to say whether a recommendation is trusted because expert conviction is stable, rising, falling, or volatile.

## Knowledge Brain Reprocessing

Older transcript analysis can be reprocessed from `/knowledge-brain/review` through the server-side reprocessing workflow in `src/knowledge-brain/reprocess-transcripts.ts`.

The reprocessor deliberately calls the same deterministic analyzer used by ingestion, rather than duplicating extraction logic. It supports transcript scope and source-video scope.

Safe default behavior:

1. Preserve Approved takes.
2. Preserve manually graded outcomes attached to Approved takes.
3. Preserve Approved transcript player summaries.
4. Delete and replace Pending, Needs Edit, and Dismissed extracted takes for the selected transcript/source.
5. Delete and replace Pending, Needs Edit, and Dismissed transcript player summaries for the selected transcript/source.
6. Delete orphan comparison/context player mentions for that transcript before recreating them.
7. Recreate eligible new takes as Pending and recreate transcript summaries through the quality reviewer. Strong summaries may auto-approve, while uncertain summaries become Pending or Needs Edit.
8. Write a `BrainIngestionRun` audit row with counts and scope metadata.

This gives the user a way to replace old parser artifacts with stricter extraction output without deleting trusted reviewed intelligence.
