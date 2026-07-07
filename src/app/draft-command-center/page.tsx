import Link from "next/link";
import {
  DRAFT_RECOMMENDATION_TYPES,
  DRAFT_POSITIONS,
  DRAFT_STRATEGY_PROFILES,
  getDraftCommandCenterDashboard,
  type DraftBoardPlayer,
  type DraftCommandCenterDashboard,
  type DraftMarketValueStatus,
  type DraftRecommendation,
  type DraftRecommendationType,
  type DraftStrategyProfile,
} from "@/decision-engine/draft-command-center";
import { formatRecommendationType } from "@/decision-engine/recommendation-explainer";
import {
  getPlayerThesesForPlayers,
  type PlayerThesis,
} from "@/knowledge-brain/player-thesis";
import { syncSleeperDraftForCommandCenter } from "./actions";

export const dynamic = "force-dynamic";

type DraftCommandCenterPageProps = {
  searchParams: Promise<{
    adpInput?: string;
    confidence?: string;
    draftEvents?: string;
    draftSyncAt?: string;
    draftSyncImported?: string;
    draftSyncMatched?: string;
    draftSyncMode?: string;
    draftSyncProvider?: string;
    draftSyncStatus?: string;
    draftSyncUnmatched?: string;
    draftSyncUnmatchedPicks?: string;
    draftSyncWarnings?: string;
    draftedByMe?: string;
    draftedByOthers?: string;
    draftedDST?: string;
    draftedIDP?: string;
    draftedK?: string;
    draftedQB?: string;
    draftedRB?: string;
    draftedTE?: string;
    draftedWR?: string;
    draftPick?: string;
    draftRound?: string;
    includeHistorical?: string;
    includeMarketUnavailable?: string;
    lastAction?: string;
    leagueId?: string;
    marketFilter?: string;
    minValueVsPick?: string;
    minDecisionScore?: string;
    needDST?: string;
    needIDP?: string;
    needK?: string;
    needQB?: string;
    needRB?: string;
    needTE?: string;
    needWR?: string;
    position?: string;
    recommendationType?: string;
    showDrafted?: string;
    sleeperDraftId?: string;
    sleeperLeagueId?: string;
    strategyProfile?: string;
    syncMyTeamId?: string;
    targetSeason?: string;
  }>;
};

type DraftEventType = "DRAFTED_BY_ME" | "DRAFTED_BY_OTHER" | "UNDO";

type DraftSessionEvent = {
  type: DraftEventType;
  playerId: string;
  playerName: string;
  round: number;
  pick: number;
  overallPick: number;
};

type DraftSessionState = {
  leagueId: string | null;
  targetSeason: number;
  strategy: DraftStrategyProfile;
  round: number;
  pick: number;
  overallPick: number;
  draftedByMe: string[];
  draftedByOthers: string[];
  draftEvents: DraftSessionEvent[];
  lastAction: DraftSessionEvent | null;
  source: "manual" | "sleeper";
};

type DraftSyncResult = {
  imported: number;
  matched: number;
  mode: "MANUAL" | "SLEEPER";
  provider: string | null;
  status: string | null;
  syncedAt: string | null;
  unmatched: number;
  unmatchedPicks: Array<{
    pick: number;
    player: string;
    position: string | null;
    sleeperPlayerId: string | null;
    team: string | null;
  }>;
  warnings: string[];
};

export default async function DraftCommandCenterPage({
  searchParams,
}: DraftCommandCenterPageProps) {
  const filters = await searchParams;
  const dashboard = await getDraftCommandCenterDashboard({
    adpInput: filters.adpInput,
    draftSyncMode: filters.draftSyncMode,
    draftedByMe: filters.draftedByMe,
    draftedByOthers: filters.draftedByOthers,
    draftedDST: filters.draftedDST,
    draftedIDP: filters.draftedIDP,
    draftedK: filters.draftedK,
    draftedQB: filters.draftedQB,
    draftedRB: filters.draftedRB,
    draftedTE: filters.draftedTE,
    draftedWR: filters.draftedWR,
    draftPick: filters.draftPick,
    draftRound: filters.draftRound,
    includeHistorical: filters.includeHistorical === "true",
    includeLowConfidence: filters.confidence !== "exclude-low",
    includeMarketUnavailable: filters.includeMarketUnavailable,
    leagueId: filters.leagueId,
    marketFilter: filters.marketFilter,
    minValueVsPick: filters.minValueVsPick,
    minDecisionScore: filters.minDecisionScore,
    needDST: filters.needDST,
    needIDP: filters.needIDP,
    needK: filters.needK,
    needQB: filters.needQB,
    needRB: filters.needRB,
    needTE: filters.needTE,
    needWR: filters.needWR,
    position: filters.position,
    recommendationType: filters.recommendationType,
    showDrafted: filters.showDrafted,
    strategyProfile: filters.strategyProfile,
    targetSeason: filters.targetSeason,
  });
  const primaryRecommendation = dashboard.recommendations[0] ?? null;
  const supportingRecommendations = dashboard.recommendations
    .filter(
      (row) =>
        !primaryRecommendation ||
        row.recommendation.id !== primaryRecommendation.recommendation.id,
    )
    .slice(0, 5);
  const playerTheses = await getPlayerThesesForPlayers(
    dashboard.recommendations
      .slice(0, 12)
      .map((row) => row.recommendation.subject.playerId),
    {
      includeHistorical: filters.includeHistorical === "true",
      targetSeason: filters.targetSeason,
    },
  );
  const thesisByPlayerId = new Map(
    playerTheses.map((thesis) => [thesis.player.id, thesis]),
  );
  const draftSession = buildDraftSessionState({
    dashboard,
    filters,
  });
  const currentQuery = serializeSearchParams(filters);
  const syncResult = getDraftSyncResult(filters);
  const rosterNeedSummary = formatRosterNeedSummary(
    dashboard.draftContext.currentRosterNeeds,
  );
  const undoLastHref = getUndoLastPickHref({
    filters,
    lastAction: draftSession.lastAction,
  });

  return (
    <main className="min-h-screen bg-stone-50">
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-wrap gap-3">
            <Link
              className="text-sm font-semibold text-emerald-700 hover:text-emerald-900"
              href="/"
            >
              Home
            </Link>
            <Link
              className="text-sm font-semibold text-zinc-600 hover:text-zinc-950"
              href="/players"
            >
              Players
            </Link>
            <Link
              className="text-sm font-semibold text-zinc-600 hover:text-zinc-950"
              href="/intelligence-operations"
            >
              Intelligence Operations
            </Link>
          </div>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-emerald-700">
                Draft Command Center
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal text-zinc-950 sm:text-4xl">
                Who should I draft next?
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
                One clear recommendation, the reason behind it, the risks, and
                the best alternatives. League context, roster needs, strategy,
                and market value stay in the background unless you need them.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryItem
                label="Recommendations"
                value={String(dashboard.recommendations.length)}
              />
              <SummaryItem
                label="Available"
                value={String(dashboard.draftBoard.availableCount)}
              />
              <SummaryItem
                label="My Picks"
                value={String(dashboard.draftBoard.draftedByMeCount)}
              />
              <SummaryItem
                label="Other Picks"
                value={String(dashboard.draftBoard.draftedByOthersCount)}
              />
              <SummaryItem
                label="Market Matches"
                value={String(dashboard.marketContext.matchedCount)}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-5 sm:px-6 lg:px-8">
        <DraftModeHeader
          dashboard={dashboard}
          rosterNeedSummary={rosterNeedSummary}
          session={draftSession}
          syncResult={syncResult}
          undoLastHref={undoLastHref}
        />

        <DraftActionConfirmation
          lastAction={draftSession.lastAction}
          nextRecommendation={primaryRecommendation}
          undoLastHref={undoLastHref}
        />

        {primaryRecommendation ? (
          <>
            <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
              <DraftDecisionCard
                filters={filters}
                leagueSize={dashboard.draftContext.leagueSize}
                row={primaryRecommendation}
                roundPick={`${dashboard.draftBoard.currentRound}.${dashboard.draftBoard.currentPick}`}
                rosterNeed={rosterNeedSummary}
                thesis={thesisByPlayerId.get(
                  primaryRecommendation.recommendation.subject.playerId,
                )}
              />
              <CompactRosterPanel
                draftedByMe={dashboard.draftBoard.draftedByMe}
                draftedCount={dashboard.draftBoard.draftedByMeCount}
                needs={dashboard.draftContext.currentRosterNeeds}
              />
            </section>
            <DraftEventLog events={draftSession.draftEvents} />
            <SupportingRecommendationList
              filters={filters}
              leagueSize={dashboard.draftContext.leagueSize}
              recommendations={supportingRecommendations}
            />
          </>
        ) : (
          <NoDraftRecommendationsState />
        )}
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-5 sm:px-6 lg:px-8">
        <details className="rounded-md border border-zinc-200 bg-white">
          <summary className="cursor-pointer px-5 py-4 text-base font-semibold text-zinc-950">
            Advanced Draft Controls
          </summary>
          <section className="grid gap-4 border-t border-zinc-200 p-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <Card title="Draft Filters">
            <form
              action="/draft-command-center"
              className="grid gap-4"
            >
              <input
                name="draftSyncMode"
                type="hidden"
                value={filters.draftSyncMode ?? ""}
              />
              <input
                name="sleeperDraftId"
                type="hidden"
                value={filters.sleeperDraftId ?? ""}
              />
              <input
                name="syncMyTeamId"
                type="hidden"
                value={filters.syncMyTeamId ?? ""}
              />
              <input
                name="draftEvents"
                type="hidden"
                value={filters.draftEvents ?? ""}
              />
              <input
                name="draftedByMe"
                type="hidden"
                value={filters.draftedByMe ?? ""}
              />
              <input
                name="draftedByOthers"
                type="hidden"
                value={filters.draftedByOthers ?? ""}
              />
              <input
                name="lastAction"
                type="hidden"
                value={filters.lastAction ?? ""}
              />
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <label className="grid gap-1 text-sm font-semibold text-zinc-700">
                  Season
                  <input
                    className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
                    defaultValue={String(dashboard.filters.targetSeason)}
                    min="2000"
                    name="targetSeason"
                    type="number"
                  />
                </label>
                <label className="grid gap-1 text-sm font-semibold text-zinc-700">
                  League
                  <select
                    className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
                    defaultValue={dashboard.draftContext.selectedLeague?.id ?? ""}
                    name="leagueId"
                  >
                    <option value="">Neutral</option>
                    {dashboard.leagueOptions.map((league) => (
                      <option key={league.id} value={league.id}>
                        {league.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-semibold text-zinc-700">
                  Round
                  <input
                    className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
                    defaultValue={String(dashboard.draftContext.draftRound)}
                    min="1"
                    name="draftRound"
                    type="number"
                  />
                </label>
                <label className="grid gap-1 text-sm font-semibold text-zinc-700">
                  Pick
                  <input
                    className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
                    defaultValue={String(dashboard.draftContext.draftPick)}
                    min="1"
                    name="draftPick"
                    type="number"
                  />
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <label className="grid gap-1 text-sm font-semibold text-zinc-700">
                  Position
                  <select
                    className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
                    defaultValue={dashboard.filters.position ?? ""}
                    name="position"
                  >
                    <option value="">All</option>
                    {dashboard.sourceDashboard.positionOptions.map((position) => (
                      <option key={position} value={position}>
                        {position}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-semibold text-zinc-700">
                  Min Score
                  <input
                    className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
                    defaultValue={String(dashboard.filters.minDecisionScore)}
                    max="100"
                    min="0"
                    name="minDecisionScore"
                    type="number"
                  />
                </label>
                <label className="grid gap-1 text-sm font-semibold text-zinc-700">
                  Recommendation
                  <select
                    className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
                    defaultValue={dashboard.filters.recommendationType}
                    name="recommendationType"
                  >
                    {DRAFT_RECOMMENDATION_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type === "ALL" ? "All" : formatDraftType(type)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-semibold text-zinc-700">
                  Strategy
                  <select
                    className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
                    defaultValue={dashboard.draftContext.strategyProfile}
                    name="strategyProfile"
                  >
                    {DRAFT_STRATEGY_PROFILES.map((strategy) => (
                      <option key={strategy} value={strategy}>
                        {formatStrategy(strategy)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm font-semibold text-zinc-700">
                  Confidence
                  <select
                    className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
                    defaultValue={
                      dashboard.filters.includeLowConfidence
                        ? "all"
                        : "exclude-low"
                    }
                    name="confidence"
                  >
                    <option value="all">Show all</option>
                    <option value="exclude-low">
                      Hide limited confidence
                    </option>
                  </select>
                </label>
              </div>

              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
                <label className="grid gap-1 text-sm font-semibold text-zinc-700">
                  Manual ADP / Rank Input
                  <textarea
                    className="min-h-32 rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-sm text-zinc-950"
                    defaultValue={filters.adpInput ?? ""}
                    name="adpInput"
                    placeholder={"Player,ADP,Rank\nBijan Robinson,3.4,3\nJa'Marr Chase,5.1,5\nTreVeyon Henderson,74.2,71"}
                  />
                </label>
                <div className="grid gap-3">
                  <label className="grid gap-1 text-sm font-semibold text-zinc-700">
                    Market Filter
                    <select
                      className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
                      defaultValue={dashboard.filters.marketFilter}
                      name="marketFilter"
                    >
                    <option value="ALL">All draft values</option>
                      <option value="VALUES_ONLY">Values only</option>
                      <option value="HIDE_REACHES">Hide reaches</option>
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm font-semibold text-zinc-700">
                    Minimum Value Vs Pick
                    <input
                      className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
                      defaultValue={
                        dashboard.filters.minValueVsPick === null
                          ? ""
                          : String(dashboard.filters.minValueVsPick)
                      }
                      name="minValueVsPick"
                      placeholder="Example: 5"
                      type="number"
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-semibold text-zinc-700">
                    Market Unavailable
                    <select
                      className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
                      defaultValue={
                        dashboard.filters.includeMarketUnavailable
                          ? "true"
                          : "false"
                      }
                      name="includeMarketUnavailable"
                    >
                      <option value="true">Include neutral players</option>
                      <option value="false">Hide neutral players</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <PositionCountInputs
                  counts={dashboard.draftContext.currentRosterNeeds}
                  label="Roster Needs"
                  prefix="need"
                />
                <PositionCountInputs
                  counts={dashboard.draftContext.manualDraftedPositions}
                  label="Manual My Position Counts"
                  prefix="drafted"
                />
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                <label className="flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-semibold text-zinc-700">
                  <input
                    className="h-4 w-4"
                    defaultChecked={dashboard.filters.includeHistorical}
                    name="includeHistorical"
                    type="checkbox"
                    value="true"
                  />
                  Include historical/stale content
                </label>
                <label className="flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-semibold text-zinc-700">
                  <input
                    className="h-4 w-4"
                    defaultChecked={!dashboard.draftBoard.hideDraftedPlayers}
                    name="showDrafted"
                    type="checkbox"
                    value="true"
                  />
                  Show drafted players in recommendations
                </label>
              </div>
              <div className="flex items-end gap-2">
                <button
                  className="h-10 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800"
                  type="submit"
                >
                  Apply
                </button>
                <Link
                  className="inline-flex h-10 items-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
                  href="/draft-command-center"
                >
                  Reset
                </Link>
              </div>
            </form>
          </Card>

          <Card title="Active Draft Context">
            <div className="grid gap-2">
              <ContextRow
                label="League"
                value={dashboard.draftContext.selectedLeague?.name ?? "Neutral"}
              />
              <ContextRow
                label="League size"
                value={
                  dashboard.draftContext.leagueSize
                    ? `${dashboard.draftContext.leagueSize} teams`
                    : "Neutral"
                }
              />
              <ContextRow
                label="Scoring"
                value={dashboard.draftContext.scoringFormat}
              />
              <ContextRow
                label="Round / Pick"
                value={`${dashboard.draftBoard.currentRound}.${dashboard.draftBoard.currentPick}`}
              />
              <ContextRow
                label="Overall pick"
                value={String(dashboard.draftBoard.currentPickNumber)}
              />
              <ContextRow
                label="Strategy"
                value={formatStrategy(dashboard.draftContext.strategyProfile)}
              />
              <ContextRow
                label="Roster slots"
                value={
                  dashboard.draftContext.selectedLeague?.rosterSummary ??
                  "Neutral"
                }
              />
              <ContextRow
                label="ADP / market value"
                value={
                  dashboard.marketContext.source === "MANUAL"
                    ? `${dashboard.marketContext.matchedCount} matched`
                    : "Unavailable"
                }
              />
              <ContextRow
                label="Available filtering"
                value={
                  dashboard.draftBoard.hideDraftedPlayers ? "Active" : "Showing all"
                }
              />
              <ContextRow label="Position scarcity" value="Future integration" />
              <ContextRow label="Bye weeks" value="Future integration" />
            </div>
            <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950">
              Draft context now changes Decision Scores conservatively through
              roster needs, your drafted players, manual position counts,
              strategy, and selected league settings. Drafted players are hidden
              by default. ADP and live platform sync are still unavailable and
              neutral.
            </p>
          </Card>
          </section>
        </details>

        <section className="grid gap-4 xl:grid-cols-3">
          <Card title="My Drafted Team">
            <DraftBoardPlayerGroups
              emptyMessage="No players marked as drafted by you yet."
              filters={filters}
              players={dashboard.draftBoard.draftedByMe}
            />
          </Card>
          <Card title="Drafted By Others">
            <DraftedByOthersPanel
              filters={filters}
              players={dashboard.draftBoard.draftedByOthers}
            />
          </Card>
          <Card title="Live Draft Sync">
            <LiveDraftSyncPanel
              currentQuery={currentQuery}
              dashboard={dashboard}
              filters={filters}
              syncResult={syncResult}
            />
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <Card title="Unmatched ADP Rows">
            <UnmatchedMarketRows
              rows={dashboard.marketContext.unmatchedRows}
            />
          </Card>
          <Card title="ADP Provider Sync">
            <div className="grid gap-2">
              <ContextRow label="Current source" value="Manual ADP input" />
              <ContextRow label="FantasyPros" value="Future ADP sync" />
              <ContextRow label="Sleeper" value="Future market sync" />
              <ContextRow label="ESPN" value="Future market sync" />
              <ContextRow label="Yahoo" value="Future market sync" />
              <ContextRow label="Fantasy Nerds" value="Future ADP sync" />
              <ContextRow label="SportsDataIO/FantasyData" value="Future sync" />
            </div>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              Manual ADP rows use the same market value model future providers
              can populate. No paid provider calls run from this page.
            </p>
          </Card>
        </section>

        <details className="rounded-md border border-zinc-200 bg-white">
          <summary className="cursor-pointer px-5 py-4 text-base font-semibold text-zinc-950">
            More Recommendation Data
          </summary>
          <div className="grid gap-4 border-t border-zinc-200 p-5">
        <section className="grid gap-4 xl:grid-cols-4">
          <DraftWidget
            emptyMessage="No draft/value targets match the current filters."
            recommendations={dashboard.widgets.topDraftTargets}
            title="Top Draft Targets"
          />
          <DraftWidget
            emptyMessage="No value recommendations match the current filters."
            recommendations={dashboard.widgets.valueTargets}
            title="Value Watch"
          />
          <DraftWidget
            emptyMessage="No wait or avoid flags match the current filters."
            recommendations={dashboard.widgets.waitOrAvoid}
            title="Wait / Avoid"
          />
          <DraftWidget
            emptyMessage="No high-confidence recommendations match the current filters."
            recommendations={dashboard.widgets.highestConfidence}
            title="Highest Confidence"
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          <Card title="Candidate Pool">
            <div className="grid gap-2">
              <SourceCount
                label="Decision Engine candidates"
                value={dashboard.candidatePool.decisionEngineCandidates}
              />
              <SourceCount
                label="Available recommendations"
                value={dashboard.candidatePool.availableRecommendations}
              />
              <SourceCount
                label="Drafted recommendations"
                value={dashboard.candidatePool.draftedRecommendations}
              />
              <SourceCount
                label="Player Trust Profiles"
                value={dashboard.candidatePool.playerTrustProfiles}
              />
              <SourceCount
                label="Player Intelligence rows"
                value={dashboard.candidatePool.playerIntelligenceRows}
              />
              <SourceCount
                label="Approved summary players"
                value={dashboard.candidatePool.approvedSummaryPlayers}
              />
              <SourceCount
                label="Projected players"
                value={dashboard.candidatePool.projectedPlayers}
              />
              <SourceCount
                label="Imported rostered players"
                value={dashboard.candidatePool.importedRosteredPlayers}
              />
            </div>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              Recommendations currently require enough trusted intelligence to
              produce a Decision Engine card. Projection-only and imported-only
              players are counted here, but remain neutral until adapters turn
              them into recommendation inputs. Drafted recommendation cards are
              hidden by default.
            </p>
          </Card>

          <Card title="Draft Recommendation Board">
            {dashboard.recommendations.length > 0 ? (
              <div className="grid gap-4">
                {dashboard.recommendations.map((row) => (
                  <DraftRecommendationCard
                    key={row.recommendation.id}
                    filters={filters}
                    leagueSize={dashboard.draftContext.leagueSize}
                    row={row}
                  />
                ))}
              </div>
            ) : (
              <EmptyState message="No draft recommendations match the current filters. Try lowering the minimum Decision Score, showing limited-confidence recommendations, or approving more current-season player intelligence." />
            )}
          </Card>
        </section>
          </div>
        </details>
      </section>
    </main>
  );
}

function DraftModeHeader({
  dashboard,
  rosterNeedSummary,
  session,
  syncResult,
  undoLastHref,
}: {
  dashboard: DraftCommandCenterDashboard;
  rosterNeedSummary: string;
  session: DraftSessionState;
  syncResult: DraftSyncResult;
  undoLastHref: string | null;
}) {
  const leagueName = dashboard.draftContext.selectedLeague?.name ?? "Neutral league";
  const progress = getDraftProgressSummary(dashboard);
  const needs = getRosterNeedInsights({
    draftedByMe: dashboard.draftBoard.draftedByMe,
    needs: dashboard.draftContext.currentRosterNeeds,
  });

  return (
    <section className="rounded-md border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-md px-2 py-1 text-xs font-semibold ring-1 ${
                syncResult.mode === "SLEEPER"
                  ? "bg-emerald-50 text-emerald-800 ring-emerald-100"
                  : "bg-zinc-100 text-zinc-700 ring-zinc-200"
              }`}
            >
              {syncResult.mode === "SLEEPER"
                ? "Sleeper sync mode active"
                : "Manual draft mode active"}
            </span>
            <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700">
              {syncResult.status
                ? `Sync: ${formatDraftSyncStatus(syncResult.status)}`
                : "Future sync: ESPN, Yahoo"}
            </span>
            {syncResult.syncedAt ? (
              <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700">
                Last synced {formatDateTime(syncResult.syncedAt)}
              </span>
            ) : null}
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-normal text-zinc-950">
            You are on pick {session.round}.{String(session.pick).padStart(2, "0")}.
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
            Your biggest needs are {rosterNeedSummary}. Current strategy is{" "}
            {formatStrategy(session.strategy)}.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:min-w-[420px]">
          <SessionMetric label="League" value={leagueName} />
          <SessionMetric
            label="Overall Pick"
            value={String(session.overallPick)}
          />
          <SessionMetric label="Draft Progress" value={progress} />
          <SessionMetric
            label="My Picks"
            value={String(session.draftedByMe.length)}
          />
          <SessionMetric
            label="Other Picks"
            value={String(session.draftedByOthers.length)}
          />
        </div>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="grid gap-2 md:grid-cols-3">
          {needs.slice(0, 3).map((need) => (
            <p
              className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm leading-6 text-zinc-700"
              key={need}
            >
              {need}
            </p>
          ))}
        </div>
        {undoLastHref ? (
          <Link
            className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100"
            href={undoLastHref}
          >
            Undo last pick
          </Link>
        ) : null}
      </div>
    </section>
  );
}

function DraftActionConfirmation({
  lastAction,
  nextRecommendation,
  undoLastHref,
}: {
  lastAction: DraftSessionEvent | null;
  nextRecommendation: DraftRecommendation | null;
  undoLastHref: string | null;
}) {
  if (!lastAction) return null;

  const nextName = nextRecommendation?.recommendation.subject.playerName;
  const message = getDraftActionConfirmationMessage(lastAction, nextName);

  return (
    <section className="rounded-md border border-emerald-200 bg-emerald-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold leading-6 text-emerald-950">
          {message}
        </p>
        {undoLastHref && lastAction.type !== "UNDO" ? (
          <Link
            className="inline-flex h-9 items-center justify-center rounded-md border border-emerald-300 bg-white px-3 text-xs font-semibold text-emerald-900 transition hover:bg-emerald-100"
            href={undoLastHref}
          >
            Undo last pick
          </Link>
        ) : null}
      </div>
    </section>
  );
}

function LiveDraftSyncPanel({
  currentQuery,
  dashboard,
  filters,
  syncResult,
}: {
  currentQuery: string;
  dashboard: DraftCommandCenterDashboard;
  filters: Awaited<DraftCommandCenterPageProps["searchParams"]>;
  syncResult: DraftSyncResult;
}) {
  const selectedLeague = dashboard.draftContext.selectedLeague;
  const teams = selectedLeague?.teams ?? [];
  const manualModeHref = getDraftModeHref(filters, "MANUAL");

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <ContextRow
          label="Current mode"
          value={
            syncResult.mode === "SLEEPER"
              ? "Sleeper sync mode"
              : "Manual draft mode"
          }
        />
        <ContextRow
          label="Sleeper"
          value={syncResult.status ? formatDraftSyncStatus(syncResult.status) : "Ready"}
        />
        <ContextRow label="Yahoo" value="Future sync" />
        <ContextRow label="ESPN" value="Future sync" />
      </div>

      <form action={syncSleeperDraftForCommandCenter} className="grid gap-3">
        <input name="currentQuery" type="hidden" value={currentQuery} />
        <label className="grid gap-1 text-sm font-semibold text-zinc-700">
          Sleeper league
          <select
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
            defaultValue={selectedLeague?.id ?? ""}
            name="leagueId"
          >
            <option value="">Choose imported league</option>
            {dashboard.leagueOptions
              .filter((league) => league.platform === "SLEEPER")
              .map((league) => (
                <option key={league.id} value={league.id}>
                  {league.name}
                </option>
              ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold text-zinc-700">
          My Sleeper roster
          <select
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
            defaultValue={filters.syncMyTeamId ?? ""}
            name="myTeamId"
          >
            <option value="">Not selected</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold text-zinc-700">
          Sleeper draft ID
          <input
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
            defaultValue={filters.sleeperDraftId ?? ""}
            name="sleeperDraftId"
            placeholder="Optional; latest league draft if blank"
          />
        </label>
        <input
          name="targetSeason"
          type="hidden"
          value={String(dashboard.filters.targetSeason)}
        />
        <button
          className="inline-flex h-10 items-center justify-center rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800"
          type="submit"
        >
          Sync Sleeper picks
        </button>
      </form>

      {syncResult.status ? (
        <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
          <div className="grid gap-2 text-sm">
            <ContextRow label="Last status" value={formatDraftSyncStatus(syncResult.status)} />
            <ContextRow label="Picks imported" value={String(syncResult.imported)} />
            <ContextRow label="Matched players" value={String(syncResult.matched)} />
            <ContextRow label="Unmatched picks" value={String(syncResult.unmatched)} />
          </div>
          {syncResult.warnings.length > 0 ? (
            <ul className="mt-3 grid gap-2 text-sm text-amber-950">
              {syncResult.warnings.map((warning) => (
                <li
                  className="rounded-md border border-amber-200 bg-amber-50 p-2"
                  key={warning}
                >
                  {warning}
                </li>
              ))}
            </ul>
          ) : null}
          {syncResult.unmatchedPicks.length > 0 ? (
            <div className="mt-3 grid gap-2">
              <p className="text-sm font-semibold text-zinc-950">
                Unmatched picks
              </p>
              {syncResult.unmatchedPicks.map((pick) => (
                <p
                  className="rounded-md border border-zinc-200 bg-white p-2 text-sm text-zinc-600"
                  key={`${pick.pick}-${pick.sleeperPlayerId ?? pick.player}`}
                >
                  Pick {pick.pick}: {pick.player}
                  {pick.position ? `, ${pick.position}` : ""}
                  {pick.team ? `, ${pick.team}` : ""}
                  {pick.sleeperPlayerId
                    ? ` (Sleeper ${pick.sleeperPlayerId})`
                    : ""}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-sm leading-6 text-zinc-600">
          Run a manual Sleeper sync to import current draft picks. Matched picks
          remove players from recommendations through the same draft-board state
          manual mode uses.
        </p>
      )}

      {syncResult.mode === "SLEEPER" ? (
        <Link
          className="text-sm font-semibold text-zinc-700 hover:text-zinc-950"
          href={manualModeHref}
        >
          Switch back to manual mode
        </Link>
      ) : null}
    </div>
  );
}

function DraftEventLog({ events }: { events: DraftSessionEvent[] }) {
  if (events.length === 0) return null;

  return (
    <section className="rounded-md border border-zinc-200 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-950">
          Recent Draft Activity
        </h2>
        <span className="text-sm font-medium text-zinc-500">
          Latest {Math.min(events.length, 8)}
        </span>
      </div>
      <div className="mt-3 grid gap-2">
        {events.slice(0, 8).map((event, index) => (
          <p
            className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm leading-6 text-zinc-700"
            key={`${event.type}-${event.playerId}-${event.round}-${event.pick}-${index}`}
          >
            {formatDraftEvent(event)}
          </p>
        ))}
      </div>
    </section>
  );
}

function DraftDecisionCard({
  filters,
  leagueSize,
  rosterNeed,
  roundPick,
  row,
  thesis,
}: {
  filters: Awaited<DraftCommandCenterPageProps["searchParams"]>;
  leagueSize: number | null;
  rosterNeed: string;
  roundPick: string;
  row: DraftRecommendation;
  thesis?: PlayerThesis;
}) {
  const recommendation = row.recommendation;
  const playerId = recommendation.subject.playerId;
  const markByMeHref = getDraftBoardHref({
    action: "draftedByMe",
    filters,
    leagueSize,
    playerId,
    playerName: recommendation.subject.playerName,
  });
  const markByOtherHref = getDraftBoardHref({
    action: "draftedByOthers",
    filters,
    leagueSize,
    playerId,
    playerName: recommendation.subject.playerName,
  });
  const undoHref = getDraftBoardHref({
    action: "undoPlayer",
    filters,
    leagueSize,
    playerId,
    playerName: recommendation.subject.playerName,
  });
  const topReasons = getDecisionReasons(row, thesis);
  const topRisks = getDecisionRisks(row, thesis);
  const alternatives = recommendation.alternatives.slice(0, 3);
  const draftAction = getDraftAction(recommendation.subject.playerName, row);
  const confidence = getDecisionConfidence(row, thesis);
  const summary = getRecommendationSummary(row, thesis);
  const evidenceSummary = getDraftCaseEvidenceSummary(row, thesis);
  const evidenceQualityMessage = thesis
    ? getDraftEvidenceQualityMessage(thesis)
    : null;

  return (
    <article className="rounded-md border border-emerald-200 bg-white p-5 shadow-sm">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={getDraftTypeClass(row.draftRecommendationType)}>
              Recommended Pick
            </span>
            <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700">
              Pick {roundPick}
            </span>
            <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">
              Need: {rosterNeed}
            </span>
            <span className={getDraftBoardStatusClass(row.draftBoardStatus)}>
              {formatDraftBoardStatus(row.draftBoardStatus)}
            </span>
          </div>

          <h2 className="mt-4 text-4xl font-semibold tracking-normal text-zinc-950 sm:text-5xl">
            {recommendation.subject.playerName}
          </h2>
          <p className="mt-2 text-base font-medium text-zinc-600">
            {recommendation.subject.position}
            {recommendation.subject.team
              ? `, ${recommendation.subject.team}`
              : ""}
          </p>
          <section className="mt-5 rounded-md border border-emerald-100 bg-emerald-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-800">
              Draft Action
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-normal text-emerald-950">
              {draftAction}
            </p>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-emerald-900">
              {getCoachingRecommendationText(row)}
            </p>
          </section>

          {thesis ? (
            <section className="mt-4 rounded-md border border-zinc-200 bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  Draft Case
                </p>
                <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">
                  {thesis.evidenceStrength.label}
                </span>
              </div>
              <h3 className="mt-2 text-lg font-semibold text-zinc-950">
                {thesis.thesisHeadline}
              </h3>
              {evidenceQualityMessage ? (
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  {evidenceQualityMessage}
                </p>
              ) : null}
            </section>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-3">
            {row.draftBoardStatus === "AVAILABLE" ? (
              <>
                <Link
                  className="inline-flex h-12 items-center rounded-md bg-emerald-700 px-5 text-sm font-semibold text-white transition hover:bg-emerald-800"
                  href={markByMeHref}
                >
                  Draft Player
                </Link>
                <Link
                  className="inline-flex h-12 items-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
                  href={markByOtherHref}
                >
                  Drafted by another team
                </Link>
              </>
            ) : (
              <Link
                className="inline-flex h-12 items-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
                href={undoHref}
              >
                Undo drafted status
              </Link>
            )}
            <Link
              className="inline-flex h-12 items-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
              href={`/players?search=${encodeURIComponent(
                recommendation.subject.playerName,
              )}`}
            >
              Compare
            </Link>
            <a
              className="inline-flex h-12 items-center rounded-md px-4 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950"
              href="#why-this-pick"
            >
              Why?
            </a>
          </div>
        </div>

        <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Decision Score
          </p>
          <p className="mt-2 text-5xl font-semibold text-zinc-950">
            {recommendation.decisionScore.score}
          </p>
          <p className="mt-1 text-sm font-semibold text-zinc-800">
            {recommendation.decisionScore.scoreLabel}
          </p>
          <details className="mt-3 text-left">
            <summary className="cursor-pointer text-xs font-semibold text-emerald-700">
              What does this mean?
            </summary>
            <p className="mt-2 text-xs leading-5 text-zinc-600">
              Decision Score reflects how strongly the platform recommends this
              pick right now based on roster fit, expert conviction, current
              draft value, and risk.
            </p>
          </details>
        </div>
      </div>

      <section className="mt-5 rounded-md border border-sky-100 bg-sky-50 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-700">
              Confidence
            </p>
            <h3 className="mt-1 text-xl font-semibold text-sky-950">
              {confidence.label}
            </h3>
          </div>
          <span className="w-fit rounded-md bg-white px-2 py-1 text-xs font-semibold text-sky-800 ring-1 ring-sky-200">
            {confidence.shortLabel}
          </span>
        </div>
            <p className="mt-2 text-sm leading-6 text-sky-900">
              {confidence.reason}
            </p>
            {thesis ? (
              <p className="mt-2 text-sm leading-6 text-sky-900">
                {evidenceQualityMessage}
              </p>
            ) : null}
          </section>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <section id="why-this-pick" className="rounded-md bg-emerald-50 p-4">
          <h3 className="text-sm font-semibold text-emerald-950">
            Why this pick?
          </h3>
          <ul className="mt-3 grid gap-2 text-sm leading-6 text-emerald-950">
            {topReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </section>
        <section className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
          <h3 className="text-sm font-semibold text-zinc-950">Risks</h3>
          {topRisks.length > 0 ? (
            <ul className="mt-3 grid gap-2 text-sm leading-6 text-zinc-700">
              {topRisks.map((risk) => (
                <li key={risk.key}>
                  <span className="font-semibold text-zinc-900">
                    {risk.label}.
                  </span>{" "}
                  {risk.explanation}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              No major risk flags are showing, but role, health, and team
              context can still change during draft season.
            </p>
          )}
        </section>
        <section className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
          <h3 className="text-sm font-semibold text-zinc-950">
            Alternatives
          </h3>
          {alternatives.length > 0 ? (
            <div className="mt-3 grid gap-2">
              {alternatives.map((alternative) => (
                <div key={alternative.playerId}>
                  <p className="text-sm font-semibold text-zinc-950">
                    {alternative.playerName}
                    <span className="font-medium text-zinc-500">
                      {" "}
                      - {alternative.position}
                      {alternative.team ? `, ${alternative.team}` : ""}
                    </span>
                  </p>
                  <p className="mt-1 text-sm leading-6 text-zinc-600">
                    {formatAlternativeReason(alternative)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              No close alternatives are available in the current filtered
              player pool.
            </p>
          )}
        </section>
      </div>

      <div className="mt-4 grid gap-3">
        <section className="rounded-md border border-zinc-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-zinc-950">
            {thesis ? "Draft Case Summary" : "Recommendation Summary"}
          </h3>
          <p className="mt-2 text-sm leading-6 text-zinc-700">{summary}</p>
        </section>
        <details className="rounded-md border border-zinc-200 bg-white">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-zinc-800">
            More on why this pick
          </summary>
          <p className="border-t border-zinc-200 px-4 py-3 text-sm leading-6 text-zinc-700">
            {recommendation.explanation}
          </p>
        </details>
        <details className="rounded-md border border-zinc-200 bg-white">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-zinc-800">
            Show supporting evidence
          </summary>
          <div className="grid gap-3 border-t border-zinc-200 p-4 lg:grid-cols-[minmax(0,1fr)_280px]">
            <p className="text-sm leading-6 text-zinc-700">
              {evidenceSummary}
            </p>
            <div className="grid gap-2">
              {thesis ? (
                <>
                  <ContextRow
                    label="Evidence Strength"
                    value={thesis.evidenceStrength.label}
                  />
                  <ContextRow
                    label="Source Quality"
                    value={thesis.sourceQuality.qualityLabel}
                  />
                  <ContextRow
                    label="Excluded Evidence"
                    value={`${thesis.evidenceQualitySummary.excludedEvidenceCount} item${
                      thesis.evidenceQualitySummary.excludedEvidenceCount === 1
                        ? ""
                        : "s"
                    }`}
                  />
                  <ContextRow
                    label="Expert Agreement"
                    value={thesis.expertAgreementSummary}
                  />
                  <ContextRow
                    label="Latest Evidence"
                    value={formatNullableDate(thesis.latestEvidenceDate)}
                  />
                </>
              ) : null}
              <ContextRow
                label="Current Draft Value"
                value={formatMarketValueStatus(
                  row.marketValue.marketValueStatus,
                )}
              />
              <ContextRow
                label="Value vs pick"
                value={formatValueVsPick(row.marketValue.valueVsPick)}
              />
              <ContextRow
                label="Context"
                value={formatScoreAdjustment(row.scoreAdjustment)}
              />
            </div>
            {thesis && thesis.supportingEvidence.length > 0 ? (
              <div className="lg:col-span-2">
                <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                  Evidence Pointers
                </h4>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  {thesis.supportingEvidence.slice(0, 4).map((item) => (
                    <div
                      className="rounded-md border border-zinc-200 bg-zinc-50 p-3"
                      key={item.id}
                    >
                      <p className="text-sm font-semibold text-zinc-950">
                        {item.expertName}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {item.sourceTitle} - {formatNullableDate(item.publishedAt)}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-zinc-500">
                        {item.qualityLabel} -{" "}
                        {formatEvidenceDecision(item.inclusionDecision)}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-zinc-700">
                        {item.excerpt}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </details>
      </div>
    </article>
  );
}

function CompactRosterPanel({
  draftedByMe,
  draftedCount,
  needs,
}: {
  draftedByMe: DraftBoardPlayer[];
  draftedCount: number;
  needs: Record<string, number>;
}) {
  const positionCounts = DRAFT_POSITIONS.map((position) => ({
    count: draftedByMe.filter(
      (player) => normalizeDisplayPosition(player.position) === position,
    ).length,
    need: needs[position] ?? 0,
    position,
  })).filter((row) => ["QB", "RB", "WR", "TE", "K", "DST", "IDP"].includes(row.position));
  const benchCount = Math.max(0, draftedCount - 7);

  return (
    <aside className="rounded-md border border-zinc-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-zinc-950">My Roster</h2>
      <p className="mt-1 text-sm text-zinc-600">
        {draftedCount} player{draftedCount === 1 ? "" : "s"} drafted
      </p>
      <div className="mt-4 grid gap-2">
        {positionCounts.slice(0, 6).map((row) => (
          <div
            className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3"
            key={row.position}
          >
            <p className="text-sm font-semibold text-zinc-700">
              {row.position}
            </p>
            <p className="text-sm font-semibold text-zinc-950">
              {row.count}
              {row.need > 0 ? ` / need ${row.need}` : ""}
            </p>
          </div>
        ))}
        <div className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3">
          <p className="text-sm font-semibold text-zinc-700">BENCH</p>
          <p className="text-sm font-semibold text-zinc-950">{benchCount}</p>
        </div>
      </div>
    </aside>
  );
}

function SupportingRecommendationList({
  filters,
  leagueSize,
  recommendations,
}: {
  filters: Awaited<DraftCommandCenterPageProps["searchParams"]>;
  leagueSize: number | null;
  recommendations: DraftRecommendation[];
}) {
  if (recommendations.length === 0) return null;

  return (
    <section className="rounded-md border border-zinc-200 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-zinc-950">
          More Recommendations
        </h2>
        <span className="text-sm font-medium text-zinc-500">
          Top {recommendations.length}
        </span>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-5">
        {recommendations.map((row) => {
          const recommendation = row.recommendation;
          return (
            <div
              className="rounded-md border border-zinc-200 bg-zinc-50 p-3"
              key={`supporting-${recommendation.id}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-zinc-950">
                    {recommendation.subject.playerName}
                  </p>
                  <p className="text-xs font-medium text-zinc-500">
                    {recommendation.subject.position}
                    {recommendation.subject.team
                      ? `, ${recommendation.subject.team}`
                      : ""}
                  </p>
                </div>
                <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-zinc-800 ring-1 ring-zinc-200">
                  {recommendation.decisionScore.score}
                </span>
              </div>
              <p className="mt-2 text-sm font-medium text-zinc-600">
                {formatDraftType(row.draftRecommendationType)}
              </p>
              {row.draftBoardStatus === "AVAILABLE" ? (
                <Link
                  className="mt-3 inline-flex h-8 items-center rounded-md border border-zinc-300 bg-white px-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100"
                  href={getDraftBoardHref({
                    action: "draftedByMe",
                    filters,
                    leagueSize,
                    playerId: recommendation.subject.playerId,
                    playerName: recommendation.subject.playerName,
                  })}
                >
                  Draft
                </Link>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function NoDraftRecommendationsState() {
  return (
    <section className="rounded-md border border-amber-200 bg-amber-50 p-5">
      <h2 className="text-xl font-semibold text-amber-950">
        No draft recommendation is ready yet.
      </h2>
      <p className="mt-2 text-sm leading-6 text-amber-900">
        Start with the highest-impact setup step: import league settings, paste
        ADP, approve current player intelligence, expand filters, or show
        limited-confidence recommendations.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          className="inline-flex h-10 items-center rounded-md bg-amber-900 px-4 text-sm font-semibold text-white transition hover:bg-amber-950"
          href="/draft/setup"
        >
          Prepare for Draft
        </Link>
        <Link
          className="inline-flex h-10 items-center rounded-md border border-amber-300 bg-white px-4 text-sm font-semibold text-amber-900 transition hover:bg-amber-100"
          href="/intelligence-operations"
        >
          Review Intelligence
        </Link>
      </div>
    </section>
  );
}

function DraftRecommendationCard({
  filters,
  leagueSize,
  row,
}: {
  filters: Awaited<DraftCommandCenterPageProps["searchParams"]>;
  leagueSize: number | null;
  row: DraftRecommendation;
}) {
  const recommendation = row.recommendation;
  const playerId = recommendation.subject.playerId;
  const markByMeHref = getDraftBoardHref({
    action: "draftedByMe",
    filters,
    leagueSize,
    playerId,
    playerName: recommendation.subject.playerName,
  });
  const markByOtherHref = getDraftBoardHref({
    action: "draftedByOthers",
    filters,
    leagueSize,
    playerId,
    playerName: recommendation.subject.playerName,
  });
  const undoHref = getDraftBoardHref({
    action: "undoPlayer",
    filters,
    leagueSize,
    playerId,
    playerName: recommendation.subject.playerName,
  });

  return (
    <article className="rounded-md border border-zinc-200 bg-white p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={getDraftTypeClass(row.draftRecommendationType)}>
              {formatDraftType(row.draftRecommendationType)}
            </span>
            <span className="rounded-md bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-800">
              {getDecisionConfidence(row).shortLabel}
            </span>
            <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700">
              Confidence: {row.trustScore ?? "N/A"}
            </span>
            <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200">
              Context: {formatScoreAdjustment(row.scoreAdjustment)}
            </span>
            <span className={getDraftBoardStatusClass(row.draftBoardStatus)}>
              {formatDraftBoardStatus(row.draftBoardStatus)}
            </span>
            <span
              className={getMarketValueStatusClass(
                row.marketValue.marketValueStatus,
              )}
            >
              {formatMarketValueStatus(row.marketValue.marketValueStatus)}
            </span>
          </div>
          <h2 className="mt-2 text-xl font-semibold text-zinc-950">
            {recommendation.subject.playerName}
          </h2>
          <p className="mt-1 text-sm text-zinc-600">
            {recommendation.subject.position}
            {recommendation.subject.team
              ? `, ${recommendation.subject.team}`
              : ""}
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-700">
            {recommendation.recommendation}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {row.draftBoardStatus === "AVAILABLE" ? (
              <>
                <Link
                  className="inline-flex h-9 items-center rounded-md bg-emerald-700 px-3 text-xs font-semibold text-white transition hover:bg-emerald-800"
                  href={markByMeHref}
                >
                  Drafted by me
                </Link>
                <Link
                  className="inline-flex h-9 items-center rounded-md border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100"
                  href={markByOtherHref}
                >
                  Drafted by other
                </Link>
              </>
            ) : (
              <Link
                className="inline-flex h-9 items-center rounded-md border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100"
                href={undoHref}
              >
                Undo drafted status
              </Link>
            )}
          </div>
        </div>
        <div className="rounded-md border border-zinc-200 px-4 py-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Decision Score
          </p>
          <p className="mt-1 text-4xl font-semibold text-zinc-950">
            {recommendation.decisionScore.score}
          </p>
          <p className="text-xs font-medium text-zinc-500">
            Base {row.baseDecisionScore} - {recommendation.decisionScore.scoreLabel}
          </p>
        </div>
      </div>

      <section className="mt-4 rounded-md border border-emerald-100 bg-emerald-50 p-3">
        <h3 className="text-sm font-semibold text-emerald-950">
          Why this pick?
        </h3>
        <p className="mt-2 text-sm leading-6 text-emerald-950">
          {recommendation.explanation}
        </p>
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-950">
            Draft Context Effects
          </h3>
          <div className="mt-2 grid gap-2">
            {row.contextFactors.slice(0, 6).map((factor) => (
              <div
                className="rounded-md border border-zinc-200 bg-zinc-50 p-3"
                key={factor.key}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-zinc-950">
                    {factor.label}
                  </p>
                  <span className={getContextFactorClass(factor.direction)}>
                    {factor.impact === 0
                      ? "Neutral"
                      : formatScoreAdjustment(factor.impact)}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  {factor.explanation}
                </p>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-zinc-950">
            Supporting Factors
          </h3>
          <div className="mt-2 grid gap-2">
            {recommendation.supportingFactors.slice(0, 5).map((factor) => (
              <FactorRow
                detail={factor.explanation}
                key={factor.key}
                label={factor.label}
                value={factor.value}
              />
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-zinc-950">Risks</h3>
          <div className="mt-2 grid gap-2">
            {recommendation.riskFactors.length > 0 ? (
              recommendation.riskFactors.slice(0, 4).map((risk) => (
                <div
                  className="rounded-md border border-zinc-200 bg-zinc-50 p-3"
                  key={risk.key}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-zinc-950">
                      {risk.label}
                    </p>
                    <span className={getRiskClass(risk.severity)}>
                      {risk.severity}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">
                    {risk.explanation}
                  </p>
                </div>
              ))
            ) : (
              <EmptyState message="No major risk flags are showing, but keep an eye on role, health, and team context." />
            )}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-zinc-950">
            Alternatives
          </h3>
          <div className="mt-2 grid gap-2">
            {recommendation.alternatives.length > 0 ? (
              recommendation.alternatives.map((alternative) => (
                <div
                  className="rounded-md border border-zinc-200 bg-zinc-50 p-3"
                  key={alternative.playerId}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-zinc-950">
                        {alternative.playerName}
                      </p>
                      <p className="text-xs font-medium text-zinc-500">
                        {alternative.position}
                        {alternative.team ? `, ${alternative.team}` : ""}
                      </p>
                    </div>
                    <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200">
                      {alternative.decisionScore}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-zinc-600">
                    {formatRecommendationType(alternative.recommendationType)}
                  </p>
                </div>
              ))
            ) : (
              <EmptyState message="No same-position alternatives are available in this result set." />
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section>
          <h3 className="text-sm font-semibold text-zinc-950">
            Evidence Summary
          </h3>
          <p className="mt-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm leading-6 text-zinc-700">
            {recommendation.evidenceSummary}
          </p>
        </section>
        <section>
          <h3 className="text-sm font-semibold text-zinc-950">
            Current Draft Value
          </h3>
          <div className="mt-2 grid gap-2">
            <ContextRow
              label="Draft value"
              value={formatMarketValueStatus(row.marketValue.marketValueStatus)}
            />
            <ContextRow
              label="Current pick"
              value={String(row.marketValue.currentPick)}
            />
            <ContextRow
              label="Market rank"
              value={formatNullableNumber(row.marketValue.marketRank)}
            />
            <ContextRow
              label="ADP"
              value={formatNullableNumber(row.marketValue.adp)}
            />
            <ContextRow
              label="Value vs pick"
              value={formatValueVsPick(row.marketValue.valueVsPick)}
            />
            <ContextRow
              label="League fit"
              value={row.leagueFitStatus === "ACTIVE" ? "Active" : "Neutral"}
            />
            <ContextRow
              label="Roster fit"
              value={row.rosterFitStatus === "ACTIVE" ? "Active" : "Neutral"}
            />
          </div>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            {row.marketValue.explanation}
          </p>
        </section>
      </div>
    </article>
  );
}

function DraftWidget({
  emptyMessage,
  recommendations,
  title,
}: {
  emptyMessage: string;
  recommendations: DraftRecommendation[];
  title: string;
}) {
  return (
    <Card title={title}>
      {recommendations.length > 0 ? (
        <div className="grid gap-2">
          {recommendations.map((row) => (
            <div
              className="rounded-md border border-zinc-200 bg-zinc-50 p-3"
              key={`${title}-${row.recommendation.id}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-zinc-950">
                    {row.recommendation.subject.playerName}
                  </p>
                  <p className="text-xs font-medium text-zinc-500">
                    {row.recommendation.subject.position}
                    {row.recommendation.subject.team
                      ? `, ${row.recommendation.subject.team}`
                      : ""}
                  </p>
                </div>
                <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-zinc-800 ring-1 ring-zinc-200">
                  {row.recommendation.decisionScore.score}
                </span>
              </div>
              <p className="mt-2 text-sm text-zinc-600">
                {formatDraftType(row.draftRecommendationType)}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState message={emptyMessage} />
      )}
    </Card>
  );
}

function DraftBoardPlayerGroups({
  emptyMessage,
  filters,
  players,
}: {
  emptyMessage: string;
  filters: Awaited<DraftCommandCenterPageProps["searchParams"]>;
  players: DraftBoardPlayer[];
}) {
  if (players.length === 0) return <EmptyState message={emptyMessage} />;

  const groupedPlayers = DRAFT_POSITIONS.map((position) => ({
    players: players.filter(
      (player) => normalizeDisplayPosition(player.position) === position,
    ),
    position,
  })).filter((group) => group.players.length > 0);

  return (
    <div className="grid gap-3">
      {groupedPlayers.map((group) => (
        <div
          className="rounded-md border border-zinc-200 bg-zinc-50 p-3"
          key={group.position}
        >
          <p className="text-sm font-semibold text-zinc-950">
            {group.position}
          </p>
          <div className="mt-2 grid gap-2">
            {group.players.map((player) => (
              <DraftBoardPlayerRow
                filters={filters}
                key={player.playerId}
                player={player}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function DraftedByOthersPanel({
  filters,
  players,
}: {
  filters: Awaited<DraftCommandCenterPageProps["searchParams"]>;
  players: DraftBoardPlayer[];
}) {
  if (players.length === 0) {
    return <EmptyState message="No players marked as drafted by other teams yet." />;
  }

  return (
    <div className="grid gap-2">
      <p className="text-sm leading-6 text-zinc-600">
        {players.length} unavailable player{players.length === 1 ? "" : "s"} hidden from
        recommendations by default.
      </p>
      {players.slice(0, 8).map((player) => (
        <DraftBoardPlayerRow
          filters={filters}
          key={player.playerId}
          player={player}
        />
      ))}
      {players.length > 8 ? (
        <p className="text-xs font-medium text-zinc-500">
          Showing 8 of {players.length}.
        </p>
      ) : null}
    </div>
  );
}

function UnmatchedMarketRows({
  rows,
}: {
  rows: Array<{
    lineNumber: number;
    playerName: string;
    raw: string;
    reason: string;
  }>;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState message="No unmatched ADP rows. Paste ADP/rank data to see matching results." />
    );
  }

  return (
    <div className="grid gap-2">
      {rows.slice(0, 8).map((row) => (
        <div
          className="rounded-md border border-amber-200 bg-amber-50 p-3"
          key={`${row.lineNumber}-${row.raw}`}
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-semibold text-amber-950">
              Line {row.lineNumber}: {row.playerName || "Unknown player"}
            </p>
            <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-amber-900 ring-1 ring-amber-200">
              Unmatched
            </span>
          </div>
          <p className="mt-2 font-mono text-xs text-amber-900">{row.raw}</p>
          <p className="mt-2 text-sm leading-6 text-amber-950">
            {row.reason}
          </p>
        </div>
      ))}
      {rows.length > 8 ? (
        <p className="text-xs font-medium text-zinc-500">
          Showing 8 of {rows.length} unmatched rows.
        </p>
      ) : null}
    </div>
  );
}

function DraftBoardPlayerRow({
  filters,
  player,
}: {
  filters: Awaited<DraftCommandCenterPageProps["searchParams"]>;
  player: DraftBoardPlayer;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-zinc-200 bg-white p-3">
      <div>
        <p className="text-sm font-semibold text-zinc-950">
          {player.playerName}
        </p>
        <p className="text-xs font-medium text-zinc-500">
          {player.position}
          {player.team ? `, ${player.team}` : ""}
        </p>
      </div>
      <Link
        className="inline-flex h-8 shrink-0 items-center rounded-md border border-zinc-300 bg-white px-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-100"
        href={getDraftBoardHref({
          action: "undoPlayer",
          filters,
          leagueSize: null,
          playerId: player.playerId,
          playerName: player.playerName,
        })}
      >
        Undo
      </Link>
    </div>
  );
}

function FactorRow({
  detail,
  label,
  value,
}: {
  detail: string;
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-zinc-950">{label}</p>
        <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200">
          {value}
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-zinc-600">{detail}</p>
    </div>
  );
}

function ContextRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3">
      <p className="text-sm font-semibold text-zinc-700">{label}</p>
      <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200">
        {value}
      </span>
    </div>
  );
}

function PositionCountInputs({
  counts,
  label,
  prefix,
}: {
  counts: Record<string, number>;
  label: string;
  prefix: "drafted" | "need";
}) {
  return (
    <fieldset className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
      <legend className="px-1 text-sm font-semibold text-zinc-700">
        {label}
      </legend>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {DRAFT_POSITIONS.map((position) => (
          <label
            className="grid gap-1 text-xs font-semibold text-zinc-600"
            key={`${prefix}-${position}`}
          >
            {position}
            <input
              className="h-10 rounded-md border border-zinc-300 bg-white px-2 text-sm text-zinc-950"
              defaultValue={String(counts[position] ?? 0)}
              min="0"
              name={`${prefix}${position}`}
              type="number"
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function SourceCount({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3">
      <p className="text-sm font-semibold text-zinc-700">{label}</p>
      <p className="font-semibold text-zinc-950">{value}</p>
    </div>
  );
}

function Card({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-md border border-zinc-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-zinc-950">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold text-zinc-950">{value}</p>
    </div>
  );
}

function SessionMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-zinc-950">{value}</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm leading-6 text-zinc-600">
      {message}
    </p>
  );
}

function buildDraftSessionState({
  dashboard,
  filters,
}: {
  dashboard: DraftCommandCenterDashboard;
  filters: Awaited<DraftCommandCenterPageProps["searchParams"]>;
}): DraftSessionState {
  const draftEvents = parseDraftEvents(filters.draftEvents);
  const parsedLastAction = parseDraftEvent(filters.lastAction);

  return {
    draftedByMe: parsePlayerIdParam(filters.draftedByMe),
    draftedByOthers: parsePlayerIdParam(filters.draftedByOthers),
    draftEvents,
    leagueId: dashboard.draftContext.selectedLeague?.id ?? null,
    lastAction: parsedLastAction,
    overallPick: dashboard.draftBoard.currentPickNumber,
    pick: dashboard.draftBoard.currentPick,
    round: dashboard.draftBoard.currentRound,
    source: dashboard.draftBoard.source === "SLEEPER" ? "sleeper" : "manual",
    strategy: dashboard.draftContext.strategyProfile,
    targetSeason: dashboard.filters.targetSeason,
  };
}

function serializeSearchParams(
  filters: Awaited<DraftCommandCenterPageProps["searchParams"]>,
) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") {
      params.set(key, value);
    }
  }

  return params.toString();
}

function getDraftSyncResult(
  filters: Awaited<DraftCommandCenterPageProps["searchParams"]>,
): DraftSyncResult {
  return {
    imported: parseInteger(filters.draftSyncImported),
    matched: parseInteger(filters.draftSyncMatched),
    mode: filters.draftSyncMode === "SLEEPER" ? "SLEEPER" : "MANUAL",
    provider: filters.draftSyncProvider ?? null,
    status: filters.draftSyncStatus ?? null,
    syncedAt: filters.draftSyncAt ?? null,
    unmatched: parseInteger(filters.draftSyncUnmatched),
    unmatchedPicks: parseJsonArray(filters.draftSyncUnmatchedPicks).filter(
      isDraftSyncUnmatchedPick,
    ),
    warnings: parseJsonArray(filters.draftSyncWarnings).filter(
      (warning): warning is string => typeof warning === "string",
    ),
  };
}

function getDraftModeHref(
  filters: Awaited<DraftCommandCenterPageProps["searchParams"]>,
  mode: "MANUAL" | "SLEEPER",
) {
  const params = new URLSearchParams(serializeSearchParams(filters));
  params.set("draftSyncMode", mode);

  if (mode === "MANUAL") {
    params.delete("draftSyncStatus");
    params.delete("draftSyncAt");
    params.delete("draftSyncImported");
    params.delete("draftSyncMatched");
    params.delete("draftSyncUnmatched");
    params.delete("draftSyncWarnings");
    params.delete("draftSyncUnmatchedPicks");
  }

  const query = params.toString();
  return query ? `/draft-command-center?${query}` : "/draft-command-center";
}

function parseInteger(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "0", 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseJsonArray(value: string | undefined): unknown[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isDraftSyncUnmatchedPick(value: unknown): value is DraftSyncResult["unmatchedPicks"][number] {
  if (!value || typeof value !== "object") return false;

  const item = value as Partial<DraftSyncResult["unmatchedPicks"][number]>;

  return typeof item.pick === "number" && typeof item.player === "string";
}

function parseDraftEvents(value: string | undefined): DraftSessionEvent[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => normalizeDraftEvent(item))
      .filter((item): item is DraftSessionEvent => item !== null)
      .slice(0, 8);
  } catch {
    return [];
  }
}

function parseDraftEvent(value: string | undefined) {
  if (!value) return null;

  try {
    return normalizeDraftEvent(JSON.parse(value));
  } catch {
    return null;
  }
}

function normalizeDraftEvent(value: unknown): DraftSessionEvent | null {
  if (!value || typeof value !== "object") return null;

  const item = value as Partial<DraftSessionEvent>;
  if (
    item.type !== "DRAFTED_BY_ME" &&
    item.type !== "DRAFTED_BY_OTHER" &&
    item.type !== "UNDO"
  ) {
    return null;
  }

  const playerId = String(item.playerId ?? "").trim();
  const playerName = String(item.playerName ?? "").trim();

  if (!playerId || !playerName) return null;

  return {
    overallPick: Math.max(1, Number(item.overallPick) || 1),
    pick: Math.max(1, Number(item.pick) || 1),
    playerId,
    playerName,
    round: Math.max(1, Number(item.round) || 1),
    type: item.type,
  };
}

function serializeDraftEvents(events: DraftSessionEvent[]) {
  return JSON.stringify(events.slice(0, 8));
}

function serializeDraftEvent(event: DraftSessionEvent | null) {
  return event ? JSON.stringify(event) : "";
}

function getDraftActionConfirmationMessage(
  action: DraftSessionEvent,
  nextRecommendationName?: string,
) {
  const nextText = nextRecommendationName
    ? ` Your next recommendation is ${nextRecommendationName}.`
    : " Recommendation updated.";

  if (action.type === "DRAFTED_BY_ME") {
    return `Drafted ${action.playerName}.${nextText}`;
  }
  if (action.type === "DRAFTED_BY_OTHER") {
    return `${action.playerName} was taken by another team.${nextText}`;
  }

  return `Undid ${action.playerName}. Recommendation updated.`;
}

function formatDraftEvent(event: DraftSessionEvent) {
  const pick = `Pick ${event.round}.${String(event.pick).padStart(2, "0")}`;

  if (event.type === "DRAFTED_BY_ME") {
    return `${pick}: You drafted ${event.playerName}.`;
  }
  if (event.type === "DRAFTED_BY_OTHER") {
    return `${pick}: Another team drafted ${event.playerName}.`;
  }

  return `${pick}: You undid ${event.playerName}.`;
}

function getDraftProgressSummary(dashboard: DraftCommandCenterDashboard) {
  const picksMade = dashboard.draftBoard.draftedCount;
  const rosterSlots = Object.values(dashboard.draftContext.rosterSlots).reduce(
    (total, value) => total + value,
    0,
  );
  const estimatedTotal =
    dashboard.draftContext.leagueSize && rosterSlots > 0
      ? dashboard.draftContext.leagueSize * rosterSlots
      : null;

  if (estimatedTotal) {
    return `${picksMade} of about ${estimatedTotal} picks`;
  }

  return `${picksMade} picks made`;
}

function getRosterNeedInsights({
  draftedByMe,
  needs,
}: {
  draftedByMe: DraftBoardPlayer[];
  needs: Record<string, number>;
}) {
  const draftedCounts = DRAFT_POSITIONS.reduce<Record<string, number>>(
    (counts, position) => ({
      ...counts,
      [position]: draftedByMe.filter(
        (player) => normalizeDisplayPosition(player.position) === position,
      ).length,
    }),
    {},
  );
  const insights: string[] = [];

  if ((draftedCounts.QB ?? 0) === 0) {
    insights.push("You do not have a QB yet.");
  }
  for (const position of ["RB", "WR", "TE"] as const) {
    const need = needs[position] ?? 0;
    if (need > 0) {
      insights.push(`You still need ${position} help.`);
    }
  }

  const strongest = DRAFT_POSITIONS.filter((position) =>
    ["QB", "RB", "WR", "TE"].includes(position),
  )
    .map((position) => ({
      count: draftedCounts[position] ?? 0,
      position,
    }))
    .sort((a, b) => b.count - a.count)[0];

  if (strongest && strongest.count >= 2) {
    insights.push(`${strongest.position} is currently your strongest position.`);
  }

  return insights.length > 0
    ? insights
    : ["Your roster is balanced so far. Keep taking the best value."];
}

function getDraftAction(playerName: string, row: DraftRecommendation) {
  if (row.draftBoardStatus !== "AVAILABLE") {
    return `${playerName} is already marked as drafted.`;
  }

  const actions: Record<DraftRecommendationType, string> = {
    AVOID: `Do not draft ${playerName} at this price.`,
    DRAFT: `Draft ${playerName} now.`,
    REACH: `Draft ${playerName} only if you want upside here.`,
    VALUE: `Draft ${playerName} for the value.`,
    WAIT: `Wait on ${playerName} if you can.`,
  };

  return actions[row.draftRecommendationType];
}

function getCoachingRecommendationText(row: DraftRecommendation) {
  const playerName = row.recommendation.subject.playerName;

  if (row.draftRecommendationType === "AVOID") {
    return `${playerName} carries more uncertainty than the best alternatives at this spot.`;
  }
  if (row.draftRecommendationType === "WAIT") {
    return `${playerName} is worth watching, but the current pick does not force the decision yet.`;
  }
  if (row.draftRecommendationType === "REACH") {
    return `${playerName} has a path to matter, but you are paying for upside rather than discount.`;
  }
  if (
    row.marketValue.marketValueStatus === "STRONG_VALUE" ||
    row.marketValue.marketValueStatus === "VALUE"
  ) {
    return `${playerName} gives you the best available mix of player quality, roster fit, and current draft value.`;
  }

  return `${playerName} is the clearest recommendation among the players currently available.`;
}

function getDecisionConfidence(
  row: DraftRecommendation,
  thesis?: PlayerThesis,
) {
  const score = row.recommendation.decisionScore.score;
  const hasHighRisk = row.recommendation.riskFactors.some(
    (risk) => risk.severity === "High",
  );
  const hasSeveralReasons =
    row.recommendation.supportingFactors.length + row.contextFactors.length >= 3;

  if (thesis) {
    return {
      label:
        thesis.confidence.label === "Strong"
          ? "High Confidence"
          : thesis.confidence.label === "Solid"
            ? "Solid Confidence"
            : thesis.confidence.label === "Developing"
              ? "Moderate Confidence"
              : "Limited Confidence",
      reason: thesis.confidence.explanation,
      shortLabel: `${thesis.confidence.label} Case`,
    };
  }

  if (score >= 90 && !hasHighRisk) {
    return {
      label: "Elite Confidence",
      reason:
        "The strongest available signals line up, and no severe risk flag is pushing against the pick.",
      shortLabel: "Elite Confidence",
    };
  }
  if (score >= 80) {
    return {
      label: "High Confidence",
      reason: hasHighRisk
        ? "The recommendation is strong, but one meaningful risk keeps it from the top confidence tier."
        : "Several useful signals point toward the same decision.",
      shortLabel: "High Confidence",
    };
  }
  if (score >= 70 || hasSeveralReasons) {
    return {
      label: "Solid Confidence",
      reason:
        "There is a clear case for this pick, though the edge over alternatives is not overwhelming.",
      shortLabel: "Solid Confidence",
    };
  }
  if (score >= 60) {
    return {
      label: "Moderate Confidence",
      reason:
        "This is a reasonable option, but limited evidence or risk makes the decision less certain.",
      shortLabel: "Moderate Confidence",
    };
  }

  return {
    label: "Limited Confidence",
    reason:
      "The recommendation can help widen the board, but the available support is thin.",
    shortLabel: "Limited Confidence",
  };
}

function getDecisionReasons(row: DraftRecommendation, thesis?: PlayerThesis) {
  if (thesis && thesis.strongestSupportingClaims.length > 0) {
    return thesis.strongestSupportingClaims
      .slice(0, 3)
      .map((claim) => formatPlainSentence(claim.description));
  }

  const supportingReasons = row.recommendation.supportingFactors
    .slice(0, 3)
    .map((factor) => formatPlainSentence(factor.explanation || factor.label));
  const contextReasons = row.contextFactors
    .filter((factor) => factor.direction === "BOOST")
    .slice(0, 2)
    .map((factor) => formatPlainSentence(factor.explanation || factor.label));
  const marketReason =
    row.marketValue.marketValueStatus === "STRONG_VALUE" ||
    row.marketValue.marketValueStatus === "VALUE"
      ? [
          "He is still available at a better price than this pick usually requires.",
        ]
      : [];

  const reasons = [...marketReason, ...contextReasons, ...supportingReasons]
    .filter(Boolean)
    .slice(0, 3);

  return reasons.length > 0
    ? reasons
    : ["He is the strongest remaining recommendation in the current player pool."];
}

function getDecisionRisks(row: DraftRecommendation, thesis?: PlayerThesis) {
  if (thesis && thesis.strongestRisks.length > 0) {
    return thesis.strongestRisks.slice(0, 3).map((risk) => ({
      explanation: risk.description,
      key: risk.id,
      label: risk.label,
    }));
  }

  return row.recommendation.riskFactors.slice(0, 3);
}

function formatPlainSentence(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const first = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);

  return /[.!?]$/.test(first) ? first : `${first}.`;
}

function formatAlternativeReason(
  alternative: DraftRecommendation["recommendation"]["alternatives"][number],
) {
  if (alternative.reason) {
    return formatPlainSentence(alternative.reason);
  }

  const labels: Record<string, string> = {
    AVOID: "Only consider if your board changes significantly.",
    DRAFT: "Strong fallback if you want a similar all-around pick.",
    REACH: "Higher-risk option if you prefer upside.",
    VALUE: "Good value if you prefer a slightly different roster build.",
    WAIT: "Worth considering if the top recommendation feels too risky.",
  };

  return labels[alternative.recommendationType] ?? "Reasonable fallback option.";
}

function getRecommendationSummary(
  row: DraftRecommendation,
  thesis?: PlayerThesis,
) {
  if (thesis) return thesis.thesisSummary;

  const playerName = row.recommendation.subject.playerName;

  if (row.draftRecommendationType === "AVOID") {
    return `Pass on ${playerName} for now. The risk and current draft cost do not justify forcing the pick over the available alternatives.`;
  }
  if (row.draftRecommendationType === "WAIT") {
    return `Wait on ${playerName}. He belongs on the radar, but the current board does not require taking him yet.`;
  }
  if (row.draftRecommendationType === "REACH") {
    return `Draft ${playerName} only if you want the upside. He is interesting, but the price is more aggressive than ideal.`;
  }

  return `Draft ${playerName}. He provides the strongest combination of roster fit, current draft value, available evidence, and manageable risk.`;
}

function getDraftCaseEvidenceSummary(
  row: DraftRecommendation,
  thesis?: PlayerThesis,
) {
  if (!thesis) return row.recommendation.evidenceSummary;

  const warnings =
    thesis.warnings.length > 0 ? ` Watch-outs: ${thesis.warnings.join(" ")}` : "";

  return `${thesis.evidenceQualitySummary.summary} ${thesis.sourceQuality.summary} ${thesis.expertAgreementSummary}${warnings}`;
}

function getDraftEvidenceQualityMessage(thesis: PlayerThesis) {
  const excludedText =
    thesis.evidenceQualitySummary.excludedEvidenceCount > 0
      ? " Some supporting evidence was excluded due to quality concerns."
      : "";

  if (thesis.evidenceQualitySummary.qualityLabel === "High Quality") {
    return `Supported by strong recent evidence.${excludedText}`;
  }
  if (thesis.evidenceQualitySummary.qualityLabel === "Good Quality") {
    return `Supported by useful reviewed evidence.${excludedText}`;
  }
  if (thesis.evidenceQualitySummary.qualityLabel === "Mixed Quality") {
    return `Evidence is still developing, so this Draft Case should stay price-sensitive.${excludedText}`;
  }
  if (thesis.evidenceQualitySummary.qualityLabel === "Low Quality") {
    return `Draft Case is provisional because the supporting evidence is limited.${excludedText}`;
  }

  return `Draft Case is provisional because the current evidence was excluded from scoring.${excludedText}`;
}

function formatEvidenceDecision(value: string) {
  const labels: Record<string, string> = {
    CAVEAT_ONLY: "Caveat only",
    EXCLUDE: "Excluded",
    INCLUDE_PRIMARY: "Primary evidence",
    INCLUDE_SECONDARY: "Secondary evidence",
  };

  return labels[value] ?? value.toLowerCase().replace(/_/g, " ");
}

function formatRosterNeedSummary(needs: Record<string, number>) {
  const topNeeds = DRAFT_POSITIONS.filter((position) => (needs[position] ?? 0) > 0)
    .slice(0, 3)
    .join(", ");

  return topNeeds || "Best player available";
}

function formatDraftType(type: DraftRecommendationType) {
  const labels: Record<DraftRecommendationType, string> = {
    AVOID: "Avoid",
    DRAFT: "Draft",
    REACH: "Reach",
    VALUE: "Value",
    WAIT: "Wait",
  };

  return labels[type];
}

function formatStrategy(strategy: DraftStrategyProfile) {
  const labels: Record<DraftStrategyProfile, string> = {
    BALANCED: "Balanced",
    BEST_PLAYER_AVAILABLE: "Best Player Available",
    HERO_RB: "Hero RB",
    SAFE_FLOOR: "Safe Floor",
    UPSIDE: "Upside",
    ZERO_RB: "Zero RB",
  };

  return labels[strategy];
}

function formatDraftSyncStatus(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function formatScoreAdjustment(value: number) {
  if (value > 0) return `+${value}`;
  if (value < 0) return String(value);

  return "0";
}

function formatNullableNumber(value: number | null, fallback = "Unavailable") {
  if (value === null) return fallback;

  return String(value);
}

function formatNullableDate(value: Date | null) {
  if (!value) return "Unavailable";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

function formatValueVsPick(value: number | null) {
  if (value === null) return "Neutral";
  if (value > 0) return `+${value}`;

  return String(value);
}

function formatMarketValueStatus(status: DraftMarketValueStatus) {
  const labels: Record<DraftMarketValueStatus, string> = {
    AVOID_AT_COST: "Too Expensive",
    FAIR_PRICE: "Fair Price",
    REACH: "Expensive",
    SLIGHT_REACH: "Slightly Expensive",
    STRONG_VALUE: "Excellent Value",
    UNAVAILABLE_NEUTRAL: "Not Enough ADP Data",
    VALUE: "Good Value",
  };

  return labels[status];
}

function getUndoLastPickHref({
  filters,
  lastAction,
}: {
  filters: Awaited<DraftCommandCenterPageProps["searchParams"]>;
  lastAction: DraftSessionEvent | null;
}) {
  if (!lastAction || lastAction.type === "UNDO") return null;

  return getDraftBoardHref({
    action: "undoLast",
    filters,
    leagueSize: null,
    playerId: lastAction.playerId,
    playerName: lastAction.playerName,
  });
}

function getDraftBoardHref({
  action,
  filters,
  leagueSize,
  playerId,
  playerName,
}: {
  action: "draftedByMe" | "draftedByOthers" | "undoPlayer" | "undoLast";
  filters: Awaited<DraftCommandCenterPageProps["searchParams"]>;
  leagueSize: number | null;
  playerId: string;
  playerName: string;
}) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") {
      params.set(key, value);
    }
  }

  const draftedByMe = new Set(parsePlayerIdParam(filters.draftedByMe));
  const draftedByOthers = new Set(parsePlayerIdParam(filters.draftedByOthers));
  const draftEvents = parseDraftEvents(filters.draftEvents);
  const currentRound = Math.max(
    1,
    Number.parseInt(filters.draftRound ?? "1", 10) || 1,
  );
  const currentPick = Math.max(
    1,
    Number.parseInt(filters.draftPick ?? "1", 10) || 1,
  );
  const currentOverallPick = leagueSize
    ? (currentRound - 1) * leagueSize + currentPick
    : currentPick;
  const lastAction = parseDraftEvent(filters.lastAction) ?? draftEvents[0] ?? null;

  draftedByMe.delete(playerId);
  draftedByOthers.delete(playerId);

  if (action === "draftedByMe") draftedByMe.add(playerId);
  if (action === "draftedByOthers") draftedByOthers.add(playerId);
  if (action === "undoLast" && lastAction) {
    draftedByMe.delete(lastAction.playerId);
    draftedByOthers.delete(lastAction.playerId);
    params.set("draftRound", String(lastAction.round));
    params.set("draftPick", String(lastAction.pick));
  }

  setListParam(params, "draftedByMe", Array.from(draftedByMe));
  setListParam(params, "draftedByOthers", Array.from(draftedByOthers));

  const event =
    action === "draftedByMe" || action === "draftedByOthers"
      ? {
          overallPick: currentOverallPick,
          pick: currentPick,
          playerId,
          playerName,
          round: currentRound,
          type:
            action === "draftedByMe"
              ? ("DRAFTED_BY_ME" as const)
              : ("DRAFTED_BY_OTHER" as const),
        }
      : action === "undoLast" && lastAction
        ? {
            overallPick: lastAction.overallPick,
            pick: lastAction.pick,
            playerId: lastAction.playerId,
            playerName: lastAction.playerName,
            round: lastAction.round,
            type: "UNDO" as const,
          }
        : action === "undoPlayer"
          ? {
              overallPick: currentOverallPick,
              pick: currentPick,
              playerId,
              playerName,
              round: currentRound,
              type: "UNDO" as const,
            }
          : null;

  if (event) {
    const nextEvents = [event, ...draftEvents].slice(0, 8);
    params.set("draftEvents", serializeDraftEvents(nextEvents));
    params.set("lastAction", serializeDraftEvent(event));
  }

  if (action === "draftedByMe" || action === "draftedByOthers") {
    const nextPick = getNextDraftPick({
      leagueSize,
      pick: filters.draftPick,
      round: filters.draftRound,
    });

    params.set("draftRound", String(nextPick.round));
    params.set("draftPick", String(nextPick.pick));
  }

  const query = params.toString();

  return query ? `/draft-command-center?${query}` : "/draft-command-center";
}

function setListParam(
  params: URLSearchParams,
  key: string,
  values: string[],
) {
  if (values.length > 0) {
    params.set(key, values.join(","));
  } else {
    params.delete(key);
  }
}

function parsePlayerIdParam(value: string | undefined) {
  return String(value ?? "")
    .split(",")
    .map((playerId) => playerId.trim())
    .filter(Boolean);
}

function getNextDraftPick({
  leagueSize,
  pick,
  round,
}: {
  leagueSize: number | null;
  pick?: string;
  round?: string;
}) {
  const currentRound = Math.max(1, Number.parseInt(round ?? "1", 10) || 1);
  const currentPick = Math.max(1, Number.parseInt(pick ?? "1", 10) || 1);

  if (!leagueSize || leagueSize < 1) {
    return {
      pick: currentPick + 1,
      round: currentRound,
    };
  }

  if (currentPick >= leagueSize) {
    return {
      pick: 1,
      round: currentRound + 1,
    };
  }

  return {
    pick: currentPick + 1,
    round: currentRound,
  };
}

function normalizeDisplayPosition(position: string) {
  const normalizedPosition =
    position.toUpperCase() === "DEF" ? "DST" : position.toUpperCase();

  return DRAFT_POSITIONS.includes(
    normalizedPosition as (typeof DRAFT_POSITIONS)[number],
  )
    ? normalizedPosition
    : "IDP";
}

function getDraftTypeClass(type: DraftRecommendationType) {
  if (type === "DRAFT" || type === "VALUE") {
    return "rounded-md bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800";
  }
  if (type === "REACH") {
    return "rounded-md bg-sky-100 px-2 py-1 text-xs font-semibold text-sky-800";
  }
  if (type === "AVOID") {
    return "rounded-md bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-800";
  }

  return "rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900";
}

function formatDraftBoardStatus(status: DraftRecommendation["draftBoardStatus"]) {
  if (status === "DRAFTED_BY_ME") return "Drafted by me";
  if (status === "DRAFTED_BY_OTHER") return "Drafted by other";

  return "Available";
}

function getDraftBoardStatusClass(status: DraftRecommendation["draftBoardStatus"]) {
  if (status === "DRAFTED_BY_ME") {
    return "rounded-md bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800";
  }
  if (status === "DRAFTED_BY_OTHER") {
    return "rounded-md bg-zinc-200 px-2 py-1 text-xs font-semibold text-zinc-700";
  }

  return "rounded-md bg-lime-100 px-2 py-1 text-xs font-semibold text-lime-800";
}

function getMarketValueStatusClass(status: DraftMarketValueStatus) {
  if (status === "STRONG_VALUE" || status === "VALUE") {
    return "rounded-md bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800";
  }
  if (status === "FAIR_PRICE") {
    return "rounded-md bg-sky-100 px-2 py-1 text-xs font-semibold text-sky-800";
  }
  if (status === "SLIGHT_REACH" || status === "REACH") {
    return "rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900";
  }
  if (status === "AVOID_AT_COST") {
    return "rounded-md bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-800";
  }

  return "rounded-md bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700";
}

function getContextFactorClass(direction: "BOOST" | "PENALTY" | "NEUTRAL") {
  if (direction === "BOOST") {
    return "rounded-md bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800";
  }
  if (direction === "PENALTY") {
    return "rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900";
  }

  return "rounded-md bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700";
}

function getRiskClass(severity: string) {
  if (severity === "High") {
    return "rounded-md bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-800";
  }
  if (severity === "Medium") {
    return "rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900";
  }

  return "rounded-md bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700";
}
