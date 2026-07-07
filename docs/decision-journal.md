# Decision Journal

## 2026-07-07 - Sleeper Draft Sync Feeds Provider-Neutral Draft State

Decision: Add Sleeper live draft sync as the first implementation of a provider-neutral live draft model. Sleeper picks normalize into `LiveDraftState` and feed the existing Draft Command Center `draftedByMe` / `draftedByOthers` availability path instead of creating Sleeper-specific recommendation logic.

Why: The Decision Engine should not care whether a pick came from a manual click, Sleeper, Yahoo, ESPN, or another future source. The user-facing win is simple: drafted players disappear and the next recommendation appears.

Implication: Future ESPN/Yahoo sync should implement the same live draft types and populate the same draft-board state. Persistent draft sessions can later replace query-string state without changing recommendation scoring.

## 2026-07-07 - Player Research Leads With Draft Action

Decision: Redesign player research around the question "Should I draft this player?" The player profile now leads with Draft Case, draft verdict, draft-day importance, risks, and alternatives, while Trust Engine, consensus, source quality, transcript evidence, and diagnostics remain available through progressive disclosure.

Why: Player research should help a fantasy manager make a draft-room decision quickly. The previous profile preserved the right intelligence but still led with internal Knowledge Brain concepts. The better long-term interface is recommendation first, evidence second, diagnostics third.

Implication: Future player research work should improve draft value, alternatives, and confidence before adding more visible raw evidence. Technical intelligence should remain available, but not dominate the first screen.

## 2026-07-07 - Evidence Quality Gates Draft Case Claims

Decision: Add a computed Evidence Quality layer before Player Thesis/Draft Case generation. Approved evidence now receives an inclusion decision: primary evidence, secondary evidence, caveat-only evidence, or excluded evidence.

Why: The Draft Case is only trustworthy if weak, stale, ambiguous, or low-quality transcript evidence cannot silently become a headline reason to draft a player. The product should show users a clear Draft Case while giving admins a way to inspect excluded evidence and quality warnings.

Implication: Draft-facing pages should keep using simple language such as strong evidence, developing evidence, or provisional Draft Case. Review/admin pages should show source quality, quality warnings, inclusion reasons, and excluded evidence. Thresholds remain deterministic and should be calibrated against real reviewed transcripts and draft outcomes before persistence is added.

## 2026-07-03 - Draft Case Calibration Prioritizes Evidence Strength

Decision: Calibrate Player Thesis/Draft Case generation around Evidence Strength, stricter claim ranking, stricter risk ranking, and weak-evidence fallback copy.

Why: A Draft Case should feel like an analyst's current player thesis, not a transcript summary. If evidence is thin, stale, or low trust, the system should say so plainly rather than forcing a confident reason to draft the player.

Implication: Draft-facing recommendation copy can now use clearer labels such as Strong Evidence, Moderate Evidence, Limited Evidence, Thin Evidence, and Provisional. Future work should validate these thresholds against real draft decisions and outcomes before treating Draft Case confidence as fully calibrated.

## 2026-07-01 - Player Thesis Becomes The Draft Case Layer

Decision: Add a computed Player Thesis layer that turns approved player evidence into a concise Draft Case before that information appears in player profiles or the Draft Command Center Decision Card.

Why: The product should not jump from transcript summaries directly into recommendations. The better long-term architecture is evidence, reviewed player summary, trust and memory, player thesis, then recommendation. This keeps explanations coherent while preserving evidence and disagreement underneath.

Implication: Future decision tools should consume Draft Case language for user-facing reasons, risks, confidence, and evidence summaries when available. Raw transcript summaries, weighted consensus, Trust Engine details, and ExpertTake evidence remain audit layers, not primary copy.

## 2026-07-01 - Manual Draft Session State Guides The Draft Flow

Decision: The Draft Command Center now derives a manual `DraftSessionState` from query parameters and uses it to show Draft Mode, pick progress, recent draft activity, action confirmations, and one-step undo.

Why: Sprint 5 needed the Draft page to feel like a guided loop without prematurely adding database-backed draft sessions or live platform sync. Query-string state keeps the MVP simple while giving the UI a clear session model that can later be persisted or populated by Sleeper, ESPN, or Yahoo draft adapters.

Implication: Future persistent draft sessions should keep this session shape: league, season, strategy, round, pick, overall pick, drafted players, events, last action, and source. Live sync should feed the same Decision Card flow instead of creating a separate draft-room experience.

## 2026-07-01 - Draft Recommendation Becomes A Trust-First Decision Card

Decision: The top Draft Command Center recommendation is now presented as a Decision Card: recommended pick, draft action, Decision Score, confidence, why the pick makes sense, risks, alternatives, and a short recommendation summary.

Why: The Draft page should reduce uncertainty within seconds. The previous recommendation-first layout had the correct data, but still exposed too much engine-flavored language. Sprint 4 keeps the underlying Decision Engine intact while rewriting the visible experience in natural coaching language.

Implication: Future draft improvements should feed the Decision Card before adding new visible widgets. Provider-backed ADP, live draft sync, position scarcity, bye weeks, and injury data should improve Decision Score, confidence, reasons, risks, and alternatives without crowding the first screen.

## 2026-06-30 - Public Navigation And Intelligence Operations Split

Decision: The public product navigation is Home, Draft, Players, and Settings. Internal intelligence surfaces are grouped under `/intelligence-operations`.

Why: Milestone 2A prioritizes making the application feel like a fantasy football draft coach instead of an intelligence operations console. Draft should be the flagship experience, with player research and settings nearby. Knowledge Brain, Trust Engine, Consensus, Review Queue, History, Decision Engine, transcript tools, experts, and grading remain valuable, but they are supporting systems rather than primary customer navigation.

Implication: Future user-facing work should route users toward draft decisions first, then progressively disclose evidence. New admin or raw-intelligence tools should be linked from Intelligence Operations unless they directly help the normal draft workflow.

## 2026-06-30 - Home Becomes Draft Readiness

Decision: The Home page should act as a calm draft launch point, not a navigation hub. It now emphasizes Start Draft, Prepare for Draft, View Players, recent league context, and Draft Readiness.

Why: Milestone 2A Sprint 2 is about helping the user answer "Am I ready to draft?" The product should reduce uncertainty before exposing more tools. A small readiness checklist gives the user an immediate sense of what is connected, what needs attention, and what to do next.

Implication: Future Home work should improve readiness quality and the pre-draft workflow before adding more dashboard sections. Internal or diagnostic links should stay secondary or live under Intelligence Operations.

## 2026-06-30 - Draft Setup Uses Temporary Workflow State

Decision: `/draft/setup` passes strategy and ADP choices forward through query parameters instead of adding persistence.

Why: This sprint establishes the preparation workflow without changing the database. The existing Draft Command Center already consumes strategy and ADP query parameters, so reusing that path keeps the implementation simple and avoids premature schema design for draft sessions and user preferences.

Implication: A future guided draft wizard or draft session model should replace temporary query-state once resume, persistence, and live draft sync are designed.

## 2026-07-01 - Draft Command Center Becomes Recommendation-First

Decision: The Draft Command Center v2 layout makes one recommended pick dominate the page. Filters, ADP input, context diagnostics, candidate-pool details, and deeper evidence remain available, but they are behind progressive disclosure.

Why: The flagship draft experience should answer "Who should I draft next?" in under 10 seconds. The existing page had the right intelligence but still felt like an analytics dashboard. The v2 layout keeps the data but changes the information hierarchy to recommendation, reasons, risks, alternatives, and Draft Player action first.

Implication: Future Draft work should preserve this hierarchy. New provider-backed ADP, live draft sync, position scarcity, injury, or bye-week inputs should feed the recommendation and explanation without taking over the first screen.
