import Link from "next/link";
import {
  DRAFT_RECOMMENDATION_TYPES,
  DRAFT_POSITIONS,
  DRAFT_STRATEGY_PROFILES,
  getDraftCommandCenterDashboard,
  type DraftBoardPlayer,
  type DraftMarketValueStatus,
  type DraftRecommendation,
  type DraftRecommendationType,
  type DraftStrategyProfile,
} from "@/decision-engine/draft-command-center";
import { formatRecommendationType } from "@/decision-engine/recommendation-explainer";

export const dynamic = "force-dynamic";

type DraftCommandCenterPageProps = {
  searchParams: Promise<{
    adpInput?: string;
    confidence?: string;
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
    strategyProfile?: string;
    targetSeason?: string;
  }>;
};

export default async function DraftCommandCenterPage({
  searchParams,
}: DraftCommandCenterPageProps) {
  const filters = await searchParams;
  const dashboard = await getDraftCommandCenterDashboard({
    adpInput: filters.adpInput,
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

  return (
    <main className="min-h-screen bg-stone-50">
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-wrap gap-3">
            <Link
              className="text-sm font-semibold text-emerald-700 hover:text-emerald-900"
              href="/"
            >
              Back to command center
            </Link>
            <Link
              className="text-sm font-semibold text-zinc-600 hover:text-zinc-950"
              href="/decision-engine"
            >
              Decision details
            </Link>
            <Link
              className="text-sm font-semibold text-zinc-600 hover:text-zinc-950"
              href="/knowledge-brain"
            >
              Knowledge Brain
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
                Draft recommendations powered by the Decision Engine. This MVP
                now considers selected league settings, draft slot, roster
                needs, already drafted positions, and strategy profile. ADP and
                live platform sync remain neutral placeholders, while manual
                draft-board state now controls who is still available.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryItem
                label="Draft Cards"
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
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <Card title="Draft Filters">
            <form
              action="/draft-command-center"
              className="grid gap-4"
            >
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
                    <option value="exclude-low">Hide low confidence</option>
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
                      <option value="ALL">All market statuses</option>
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
            <div className="grid gap-2">
              <ContextRow label="Current source" value="Manual draft board" />
              <ContextRow label="Sleeper" value="Future sync" />
              <ContextRow label="Yahoo" value="Future sync" />
              <ContextRow label="ESPN" value="Future sync" />
            </div>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              Manual draft board state uses the same available/drafted/player
              structure future platform adapters can populate. No live draft
              sync runs yet.
            </p>
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
            emptyMessage="No confidence-backed recommendations yet."
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
              <EmptyState message="No draft recommendations match the current filters. Try lowering the minimum Decision Score, showing low-confidence recommendations, or approving more current-season Knowledge Brain summaries." />
            )}
          </Card>
        </section>
      </section>
    </main>
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
  });
  const markByOtherHref = getDraftBoardHref({
    action: "draftedByOthers",
    filters,
    leagueSize,
    playerId,
  });
  const undoHref = getDraftBoardHref({
    action: "undo",
    filters,
    leagueSize,
    playerId,
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
              {recommendation.decisionScore.confidence} confidence
            </span>
            <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700">
              Trust Score: {row.trustScore ?? "N/A"}
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
          Why this recommendation?
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
              <EmptyState message="No major deterministic risk flags." />
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
            Market Context
          </h3>
          <div className="mt-2 grid gap-2">
            <ContextRow
              label="Market status"
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
          action: "undo",
          filters,
          leagueSize: null,
          playerId: player.playerId,
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

function EmptyState({ message }: { message: string }) {
  return (
    <p className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm leading-6 text-zinc-600">
      {message}
    </p>
  );
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
    HERO_RB: "Hero RB",
    SAFE_FLOOR: "Safe Floor",
    UPSIDE: "Upside",
    ZERO_RB: "Zero RB",
  };

  return labels[strategy];
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

function formatValueVsPick(value: number | null) {
  if (value === null) return "Neutral";
  if (value > 0) return `+${value}`;

  return String(value);
}

function formatMarketValueStatus(status: DraftMarketValueStatus) {
  const labels: Record<DraftMarketValueStatus, string> = {
    AVOID_AT_COST: "Avoid At Cost",
    FAIR_PRICE: "Fair Price",
    REACH: "Reach",
    SLIGHT_REACH: "Slight Reach",
    STRONG_VALUE: "Strong Value",
    UNAVAILABLE_NEUTRAL: "Unavailable / Neutral",
    VALUE: "Value",
  };

  return labels[status];
}

function getDraftBoardHref({
  action,
  filters,
  leagueSize,
  playerId,
}: {
  action: "draftedByMe" | "draftedByOthers" | "undo";
  filters: Awaited<DraftCommandCenterPageProps["searchParams"]>;
  leagueSize: number | null;
  playerId: string;
}) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") {
      params.set(key, value);
    }
  }

  const draftedByMe = new Set(parsePlayerIdParam(filters.draftedByMe));
  const draftedByOthers = new Set(parsePlayerIdParam(filters.draftedByOthers));

  draftedByMe.delete(playerId);
  draftedByOthers.delete(playerId);

  if (action === "draftedByMe") draftedByMe.add(playerId);
  if (action === "draftedByOthers") draftedByOthers.add(playerId);

  setListParam(params, "draftedByMe", Array.from(draftedByMe));
  setListParam(params, "draftedByOthers", Array.from(draftedByOthers));

  if (action !== "undo") {
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
