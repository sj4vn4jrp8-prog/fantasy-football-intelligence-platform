# Next Priority

## Recommended Next Feature

Add persistent draft sessions, improve Sleeper draft sync refresh, and add provider-backed ADP to the Draft Command Center while backfilling Intelligence Snapshots in parallel.

The app can now save manual transcripts, bulk import locally fetched Markdown transcripts, filter stale content out of current intelligence, clean transcript excerpts for review, remove spoken timestamp artifacts, detect common comparison/context language, require subject-opinion linkage before creating takes, deterministically extract player mentions with primary/comparison/context awareness, aggregate transcript-level player summaries, build expert-player memory timelines, reprocess older unapproved extracted takes, review player summaries with expandable evidence, aggregate approved summaries into player intelligence profiles, compare expert consensus, surface low-sample early signals, track expert accuracy readiness, manually grade approved expert take outcomes, calculate weighted consensus from expert accuracy, generate deterministic Trust Engine profiles, persist versioned Intelligence Snapshots, compose approved evidence into calibrated player-level Draft Cases, browse player history through `/knowledge-brain/history`, answer deterministic natural-language questions through `/knowledge-brain/ask`, inspect read-only Decision Engine recommendations through `/decision-engine`, and use the draft-facing recommendation board through `/draft-command-center` with imported league context, manual roster needs, drafted-position counts, draft round/pick, strategy profile controls, manual drafted-by-me/drafted-by-others state, available-player filtering, manual ADP/rank market value input, a recommendation-first v2 layout, a trust-first Decision Card, calibrated thesis-aware draft reasoning, and a guided manual Draft Session UX.

The public product navigation has also been simplified to Home, Draft, Players, and Settings, with `/intelligence-operations` serving as the admin/power-user hub for Knowledge Brain, Recommendation Confidence, Expert Agreement, Review Queue, History, Decision Engine, Experts, Player Compare, transcript tools, quality review, and grading. Home now focuses on draft readiness, and `/draft/setup` establishes the first preparation flow for league context, strategy, ADP, and preference placeholders.

Phase 4C made Trust Score user-facing across player profiles, player compare, consensus, Brain Search, and the Knowledge Brain dashboard. Phase 4D migrated raw consensus and weighted consensus internals to approved transcript summaries first, with approved expert takes as fallback. Phase 4E adds deterministic AI-ready quality review and an exception queue so human review becomes the exception, not the whole workflow. Phase 4F adds persisted Intelligence Snapshots and the first Time Machine page. Phase 5A adds the first reusable Decision Engine foundation. Phase 5B adds the first Draft Command Center MVP. Phase 5C adds draft context inputs. Phase 5D adds manual draft board state and available-player filtering. Phase 5E adds manual ADP/rank market value input. Milestone 2A Sprint 4 turns the top recommendation into a trust-first Decision Card with coaching language, clearer confidence, honest risks, actionable alternatives, and a short recommendation summary. Milestone 2A Sprint 5 adds a guided Draft Mode header, action confirmations, one-step undo, draft activity log, and a query-string backed manual Draft Session State. Milestone 2A Sprint 6 adds the Player Thesis foundation so approved evidence can become a concise Draft Case before it becomes recommendation copy. Milestone 2A Sprint 7 calibrates Draft Case claim ranking, risk ranking, Evidence Strength labels, weak-evidence fallback copy, and draft-facing UI usage. Milestone 2A Sprint 8 adds Evidence Quality and Source Quality controls so weak, stale, ambiguous, or excluded transcript evidence cannot silently become a Draft Case headline reason. Milestone 2A Sprint 9 turns player profiles and the player directory into draft-facing research surfaces that lead with "Should I draft him?", Draft Case, evidence strength, risks, and alternatives before exposing audit details. Milestone 2A Sprint 10 adds the first provider-neutral live draft sync foundation with Sleeper manual sync feeding the existing available-player pool. The next useful step is to persist draft sessions, improve Sleeper sync refresh/state handling, and replace manual market placeholders with provider-backed ADP, position scarcity, bye-week, and injury context.

## Why It Matters

The Knowledge Brain should preserve expert disagreement without pretending the first parser is perfect. Transcript-level summaries make review feel like approving a complete analyst opinion about a player, while the underlying `ExpertTake` and `PlayerMention` records remain available as proof.

This creates a cleaner foundation for connecting expert consensus and expert accuracy to fantasy decisions. The local fetcher can bring in volume, transcript cleaning makes review readable, transcript summaries reduce fragmented low-context cards, the quality reviewer keeps humans focused on exceptions, Expert Memory tracks opinion movement over time, Intelligence Snapshots preserve what the app believed at each update, freshness controls prevent stale-season pollution, early signals keep small data sets useful, consensus shows where experts agree or split, manual grading starts the accuracy record, weighted consensus becomes an internal signal, Trust Score becomes the user-facing trust concept, Brain Search makes the stored knowledge easier to use, and the Decision Engine starts translating trusted intelligence into action-oriented recommendations.

## Suggested Implementation Order

1. Add persistent draft sessions.

   The Draft page now has manual and Sleeper-synced query-state, but state still lives in URL parameters. Persist draft session, synced draft ID, selected roster, drafted-player state, draft events, selected league, strategy, ADP source, and draft preferences so the user can resume a draft.

2. Improve Sleeper draft sync refresh.

   Add clearer draft selection, refresh timestamps, true draft order/snake pick handling where possible, and optional polling or refresh shortcuts while keeping manual mode as the fallback.

3. Add provider-backed ADP and market context to the Draft Command Center.

   Add an ADP source/import path so Decision Score can use refreshable market price instead of pasted manual rows. Keep manual ADP input as the fallback and audit surface.

4. Add platform live draft sync beyond Sleeper.

   Populate the existing manual draft session state and event log from platform adapter draft data, starting with Sleeper if safe and available. Manual state should remain the fallback.

5. Add Decision Engine input adapters.

   Keep Knowledge Brain intelligence, league data, projection data, and draft data as separate inputs. Convert each into neutral `DecisionFactor`, `SupportingFactor`, or `RiskFactor` objects before scoring.

6. Add position scarcity factors.

   Feed positional scarcity, tier drops, and bye-week exposure into the Decision Engine as draft-specific factors. Basic manual roster construction inputs already exist.

7. Add snapshot backfill tooling.

   Create a safe script or admin action that generates `MANUAL_BACKFILL` snapshots for already-reviewed transcript summaries, current player trust profiles, and existing Expert Memory timelines.

8. Calibrate deterministic quality review thresholds.

   Review a batch of auto-approved and exception summaries, then tune quality score weights, severe warnings, and auto-approval thresholds before relying on the reviewer at larger transcript volume.

9. Add snapshot QA reports.

   Show how many snapshots were created by ingestion, quality review, manual review, reprocessing, grading, and backfill.

10. Add quality review QA reports.

   Summarize how many summaries were auto-approved, low-quality, ambiguous, low-evidence, conflicting, or recently processed after imports and reprocessing.

11. Add summary-aware expert accuracy reporting.

   Keep manual outcome grading attached to `ExpertTake` for now, but distinguish reviewed transcript summaries from raw extracted fragments in expert profiles and accuracy readiness.

12. Add Expert Memory to expert profiles.

   Show players each expert is increasingly bullish on, increasingly bearish on, volatile on, and highest conviction about.

13. Expand Expert Memory snapshot visualizations.

   Add expert/date filters, generation type filters, and clearer opinion reversal detection to `/knowledge-brain/history`.

14. Migrate Brain Search evidence ranking.

   Return transcript player summaries as the direct answer layer, then show `ExpertTake` excerpts and mentions as citations underneath.

15. Add Trust Score and Draft Case to future decision tools.

   Use `PlayerTrustProfile` and Player Thesis/Draft Case output inside future start/sit explanations, waiver recommendations, trade analysis, and draft assistant views so user decisions consume trusted evidence summaries instead of raw consensus directly.

16. Add bulk summary review actions.

   Select multiple transcript player summaries and approve, dismiss, or mark Needs Edit in one pass.

17. Add filtered bulk reprocessing.

   Reprocess all transcripts represented in the current review filters while preserving approved takes and approved summaries by default.

18. Improve player rematching.

   Add search-first player reassignment for transcript summaries and surface ambiguous player matches.

19. Add extraction QA reports.

   Summarize how many pending summaries were flagged for mixed stance, context-only evidence, comparison-heavy evidence, pronoun-heavy segments, timestamp cleanup, missing direct take evidence, or low confidence after each import.

20. Add review notes.

   Let the user record why a transcript player summary was dismissed or edited.

21. Formalize outcome grading rubrics.

   Define how starts, sits, waiver calls, breakout calls, fades, injury takes, draft values, and trade takes should be judged before relying on accuracy leaderboards.

22. Calibrate Trust Engine and Expert Memory weights.

   Revisit trust score caps, memory conviction weights, dimension weights, minimum sample sizes, and whether position-specific or take-type-specific accuracy should affect player-level trust once more outcomes are graded.

23. Add grading queue filters.

   Filter by expert, player, take type, sentiment, publish date, and freshness label so manual grading is manageable at volume.

24. Add source freshness edit controls.

   Let the user manually archive, re-include, or correct publish dates for individual source videos when metadata is missing or wrong.

25. Plan transcript source integration.

   Keep YouTube discovery local-only. Confirm terms, source availability, attribution, and rate limits before considering any server-side source integration.

## Architecture Notes

- Do not scrape YouTube pages from the Next.js app or deployed server.
- Keep `scripts/knowledge-brain/fetch_fantasy_transcripts.py` as a local companion workflow only.
- Keep source adapters behind `TranscriptSource`.
- Keep manual ingestion as the reliable baseline.
- Keep `/knowledge-brain/import-markdown` as the safe bridge between local transcript files and database ingestion.
- Keep current player intelligence filtered by `includeInCurrentAnalysis` by default.
- Preserve historical transcripts; archive or exclude them instead of deleting them.
- Keep expert consensus deterministic until extracted takes have human review controls.
- Keep strict consensus thresholds separate from low-sample early signals.
- Keep manual outcome grading separate from automatic outcome detection.
- Keep expert accuracy metrics clearly labeled as user-graded until grading rubrics are formalized.
- Keep raw consensus separate from weighted consensus so trust weighting never hides disagreement.
- Keep raw and weighted consensus summary-first. Approved `TranscriptPlayerSummary` records are the primary opinion unit; approved `ExpertTake` rows are fallback evidence only.
- Prevent micro-take overcounting by treating one expert/source/player summary as one opinion signal.
- Treat weighted consensus as an internal signal, not the final user-facing concept.
- Treat Trust Score as the user-facing trust/explainability layer.
- Treat Player Thesis as the draft-case composition layer between approved evidence and user-facing recommendation copy.
- Use Draft Case, Why this player, What supports this recommendation, and What could go wrong as UI labels instead of exposing the Player Thesis implementation term.
- Keep Player Research draft-action first: verdict, why it matters, risks, alternatives, then evidence and diagnostics.
- Treat same-position alternatives on player profiles as provisional until ADP, rankings, tiers, and draft-room availability are connected.
- Keep Evidence Strength visible anywhere Draft Case copy influences a recommendation, especially when evidence is Limited, Thin, or Provisional.
- Keep Evidence Quality as the gate before Evidence Strength. Excluded evidence should remain visible in admin review, but should not support Draft Case claims or draft recommendation copy.
- Keep source quality controls computed until the thresholds are calibrated. Avoid adding persistence until there is a clear need for auditing historical inclusion decisions.
- Keep player-facing pages focused on Trust Score first, then expose raw consensus and weighted consensus as supporting audit layers.
- Treat Expert Memory as the opinion-history layer between transcript summaries and Trust Engine.
- Use approved transcript summaries first for Expert Memory, with approved takes only as fallback.
- Treat Intelligence Snapshots as append-only historical memory.
- Do not duplicate full transcript evidence into snapshots; store compact summaries, source IDs, and metadata.
- Use snapshot movement as an explainability signal before making it a scoring weight.
- Keep `/knowledge-brain/history` as the Time Machine surface for player/expert opinion changes.
- Keep `/decision-engine` as a developer preview until a real consumer page supplies draft, waiver, trade, lineup, or league-specific context.
- Keep `/draft-command-center` focused on answering "Who should I draft next, and why?" without becoming a full live draft room too early.
- Keep live draft sync provider-neutral. Sleeper, Yahoo, and ESPN should normalize into the same `LiveDraftState` and existing draft-board availability path.
- Keep manual draft mode available even when provider sync exists.
- Keep the Draft page recommendation-first. The hero recommendation should stay above controls, ADP input, diagnostic widgets, and raw evidence.
- Keep public navigation focused on Home, Draft, Players, and Settings. Keep Intelligence Operations as the place for admin and raw intelligence workflows.
- Keep Home as a calm draft readiness surface. Avoid turning it back into a tool directory.
- Keep `/draft/setup` focused on preparation steps that reduce draft-day uncertainty.
- Keep Decision Score separate from Trust Score. Trust Score measures evidence reliability; Decision Score measures action strength.
- Keep Decision Engine future inputs neutral until provider-backed ADP, platform-synced draft availability, injury, bye-week, and deeper preference sources exist; disclose those placeholders clearly in the Draft Command Center.
- Do not persist Decision Engine recommendations until refresh rules, invalidation, and explanation versioning are designed.
- Keep Trust Engine deterministic first; AI can explain or augment later.
- Keep the AI Quality Reviewer deterministic until an AI provider is explicitly added.
- Treat auto-approved summaries as useful but lower certainty than human-reviewed summaries.
- Keep `/knowledge-brain/review` exception-first: pending, needs-edit, low-quality, ambiguous, and conflicting summaries should appear before clean auto-approvals.
- Keep Trust Engine preference adjustments neutral until user preference infrastructure exists.
- Keep Brain Search retrieval-first, with citations and source evidence visible.
- Do not add AI answer generation until source-review controls exist.
- Treat `TranscriptPlayerSummary` as the primary reviewed opinion object.
- Keep `ExpertTake` as supporting evidence beneath summaries, not the long-term top-level intelligence unit.
- Continue matching expert takes to internal `Player` IDs.
- Do not connect transcript intelligence to lineup recommendations until summary review status is broadly usable.
- Preserve raw transcript text while showing cleaned display excerpts in review surfaces.
- Treat deterministic comparison detection as a review aid, not a replacement for human approval.
- Reprocess old parser output from `/knowledge-brain/review` before approving questionable takes.
- Preserve approved reviewed takes and approved player summaries during reprocessing unless a future destructive workflow is explicitly designed.
- Prefer missing a marginal take over creating a misattributed player take.
- Keep context-only and comparison-only mentions as audit evidence unless the explicit player is clearly tied to opinion language.
