import Link from "next/link";
import { notFound } from "next/navigation";
import {
  analyzeMatchupConfidence,
  analyzeProjectionConfidence,
  type ProjectionConfidenceAnalysis,
} from "@/analysis/confidence/calculateConfidence";
import {
  optimizeLineup,
  type LineupOptimizationResult,
  type OptimizerCandidate,
} from "@/analysis/optimizer/optimizeLineup";
import type { RosterSettingsInput } from "@/analysis/optimizer/rosterConstraints";
import { calculateConsensusProjection } from "@/analysis/projections/calculateConsensusProjection";
import {
  selectProjection,
  type ProjectionContext,
  type ProjectionMode,
  type SelectableProjection,
} from "@/analysis/projections/selectProjection";
import { calculateFantasyPoints } from "@/analysis/scoring/calculateFantasyPoints";
import { FantasyProsProjectionImportForm } from "@/components/league/FantasyProsProjectionImportForm";
import { MockProjectionImportForm } from "@/components/league/MockProjectionImportForm";
import type { LeagueScoringRule } from "@/domain/fantasy";
import { db } from "@/lib/db";
import { getProjectionProviderStatuses } from "@/providers/projections/provider-status";

export const dynamic = "force-dynamic";

type LeagueDetailPageProps = {
  params: Promise<{
    leagueId: string;
  }>;
  searchParams: Promise<{
    mode?: string;
    provider?: string;
    tab?: string;
    week?: string;
  }>;
};

type TeamStartSitRecommendation = {
  team: {
    id: string;
    name: string;
  };
  result: LineupOptimizationResult;
  lineupConfidence: ProjectionConfidenceAnalysis;
  projectionMode: ProjectionMode;
  consensusLimitedPlayerCount: number;
  rosteredPlayerCount: number;
  projectedPlayerCount: number;
};

type RosteredProjection = SelectableProjection & {
  projectedStats: unknown;
  projectedFantasyPoints: number | null;
  median: number | null;
  floor: number | null;
  ceiling: number | null;
  confidence: number | null;
  importedAt?: Date | null;
};

type RosteredPlayerForProjection = OptimizerCandidate["player"] & {
  externalIdentities?: Array<{
    externalId: string;
  }>;
  projections: RosteredProjection[];
};

const rosterSettingLabels = [
  ["QB", "qb"],
  ["RB", "rb"],
  ["WR", "wr"],
  ["TE", "te"],
  ["FLEX", "flex"],
  ["Superflex", "superflex"],
  ["K", "k"],
  ["DST", "dst"],
  ["IDP", "idp"],
  ["Bench", "bench"],
  ["IR", "ir"],
  ["Taxi", "taxi"],
  ["Keepers", "keeperSlots"],
] as const;

const rosterStatusOrder = {
  STARTER: 0,
  BENCH: 1,
  IR: 2,
  TAXI: 3,
};

const leagueWorkspaceTabs = [
  { id: "overview", label: "Overview" },
  { id: "teams", label: "Teams & Rosters" },
  { id: "matchups", label: "Matchups" },
  { id: "projections", label: "Projections" },
  { id: "start-sit", label: "Start/Sit" },
  { id: "settings", label: "Settings" },
] as const;

type LeagueWorkspaceTabId = (typeof leagueWorkspaceTabs)[number]["id"];

export default async function LeagueDetailPage({
  params,
  searchParams,
}: LeagueDetailPageProps) {
  const { leagueId } = await params;
  const projectionSearchParams = await searchParams;
  const league = await db.league.findFirst({
    where: {
      OR: [
        { id: leagueId },
        {
          externalIdentities: {
            some: {
              externalId: leagueId,
            },
          },
        },
      ],
    },
    include: {
      externalIdentities: true,
      rosterSettings: true,
      scoringRules: {
        orderBy: [{ position: "asc" }, { statKey: "asc" }],
      },
      teams: {
        include: {
          externalIdentities: true,
          rosterPlayers: {
            include: {
              player: {
                include: {
                  externalIdentities: true,
                  projections: {
                    orderBy: [{ week: "asc" }, { provider: "asc" }],
                  },
                },
              },
            },
          },
        },
        orderBy: { name: "asc" },
      },
      matchups: {
        include: {
          teamA: true,
          teamB: true,
        },
        orderBy: [{ week: "asc" }, { teamAScore: "desc" }],
      },
    },
  });

  if (!league) {
    notFound();
  }

  const projectionOptions = getProjectionOptions(league.teams, league.matchups);
  const selectedTab = getSelectedTab(projectionSearchParams.tab);
  const selectedWeek = getSelectedWeek(
    projectionSearchParams.week,
    projectionOptions.defaultWeek,
  );
  const selectedProvider = getSelectedProvider(
    projectionSearchParams.provider,
    projectionOptions.providerOptions,
  );
  const selectedProjectionMode = getSelectedProjectionMode(
    projectionSearchParams.mode,
  );
  const projectionContext: ProjectionContext = {
    season: league.season,
    week: selectedWeek,
    provider: selectedProvider,
    mode: selectedProjectionMode,
  };
  const selectedWeekMatchups = league.matchups.filter(
    (matchup) => matchup.week === selectedWeek,
  );
  const matchupsByWeek = groupMatchupsByWeek(selectedWeekMatchups);
  const projections = getRosteredPlayerProjections(
    league.teams,
    projectionContext,
  );
  const consensusProjections = getConsensusProjections(
    league.teams,
    projectionContext,
  );
  const leagueAdjustedProjections = getLeagueAdjustedProjections(
    projections,
    league.scoringRules,
  );
  const startSitRecommendations = getStartSitRecommendations(
    league.teams,
    league.rosterSettings,
    league.scoringRules,
    projectionContext,
  );
  const weeklyMatchupDashboard = getWeeklyMatchupDashboard(
    selectedWeekMatchups,
    startSitRecommendations,
  );
  const projectionProviderStatuses = getProjectionProviderStatuses();
  const isConsensusLimitedBySingleProvider =
    selectedProjectionMode === "CONSENSUS" &&
    consensusProjections.length > 0 &&
    consensusProjections.every(
      ({ consensus }) => consensus.limitedBySingleProvider,
    );

  return (
    <main className="min-h-screen bg-stone-50">
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
          <Link
            className="text-sm font-semibold text-emerald-700 hover:text-emerald-900"
            href="/"
          >
            Back to import
          </Link>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-emerald-700">
                League detail
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal text-zinc-950 sm:text-4xl">
                {league.name}
              </h1>
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <SummaryItem label="Season" value={String(league.season)} />
              <SummaryItem label="Week" value={String(selectedWeek)} />
              <SummaryItem label="Platform" value={league.platform} />
              <SummaryItem
                label="Imported"
                value={formatDate(league.importedAt)}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-5 sm:px-6 lg:px-8">
        <LeagueWorkspaceTabs
          leagueId={league.id}
          selectedProjectionMode={selectedProjectionMode}
          selectedProvider={selectedProvider}
          selectedTab={selectedTab}
          selectedWeek={selectedWeek}
        />

        {selectedTab === "overview" ? (
          <div className="grid gap-4">
            <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              <Card title="League Snapshot">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <SummaryItem label="League" value={league.name} />
                  <SummaryItem label="Season" value={String(league.season)} />
                  <SummaryItem label="Platform" value={league.platform} />
                  <SummaryItem label="Teams" value={String(league.teams.length)} />
                  <SummaryItem
                    label="Mode"
                    value={getProjectionModeDisplayName(selectedProjectionMode)}
                  />
                </div>
                <p className="mt-4 text-sm text-zinc-600">
                  Use the workspace tabs to review imported rosters, matchup
                  projections, lineup recommendations, and league settings
                  without leaving this league page.
                </p>
              </Card>

              <Card title="Roster Settings Summary">
                {league.rosterSettings ? (
                  <div className="grid grid-cols-2 gap-2">
                    {rosterSettingLabels.slice(0, 8).map(([label, key]) => (
                      <div
                        className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2"
                        key={key}
                      >
                        <p className="text-xs font-medium text-zinc-500">
                          {label}
                        </p>
                        <p className="mt-1 text-lg font-semibold text-zinc-950">
                          {league.rosterSettings?.[key] ?? 0}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState message="No roster settings were imported for this league." />
                )}
              </Card>
            </section>

            <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <Card title="Projection Context">
                <ProjectionContextForm
                  availableWeeks={projectionOptions.availableWeeks}
                  leagueId={league.id}
                  providerOptions={projectionOptions.providerOptions}
                  selectedProjectionMode={selectedProjectionMode}
                  selectedProvider={selectedProvider}
                  selectedTab={selectedTab}
                  selectedWeek={selectedWeek}
                />
                {isConsensusLimitedBySingleProvider ? (
                  <div className="mt-4">
                    <WarningState message="Consensus is based on one provider only." />
                  </div>
                ) : null}
              </Card>

              <Card title="Mock Projection Import">
                <MockProjectionImportForm
                  defaultWeek={selectedWeek}
                  leagueId={league.id}
                />
              </Card>

              <Card title="FantasyPros Projection Import">
                <FantasyProsProjectionImportForm
                  defaultWeek={selectedWeek}
                  leagueId={league.id}
                />
              </Card>
            </section>
          </div>
        ) : null}

        {selectedTab === "settings" ? (
        <section className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <Card title="Roster Settings">
            {league.rosterSettings ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-2">
                {rosterSettingLabels.map(([label, key]) => (
                  <div
                    className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2"
                    key={key}
                  >
                    <p className="text-xs font-medium text-zinc-500">{label}</p>
                    <p className="mt-1 text-lg font-semibold text-zinc-950">
                      {league.rosterSettings?.[key] ?? 0}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState message="No roster settings were imported for this league." />
            )}
          </Card>

          <Card title="Scoring Rules">
            {league.scoringRules.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
                      <th className="py-2 pr-4 font-semibold">Stat</th>
                      <th className="py-2 pr-4 font-semibold">Points</th>
                      <th className="py-2 pr-4 font-semibold">Position</th>
                      <th className="py-2 font-semibold">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {league.scoringRules.map((rule) => (
                      <tr className="border-b border-zinc-100" key={rule.id}>
                        <td className="py-2 pr-4 font-semibold text-zinc-950">
                          {rule.statKey}
                        </td>
                        <td className="py-2 pr-4 text-zinc-700">
                          {formatPoints(rule.points)}
                        </td>
                        <td className="py-2 pr-4 text-zinc-700">
                          {rule.position ?? "ALL"}
                        </td>
                        <td className="py-2 text-zinc-600">
                          {rule.description ?? "Imported from league platform"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState message="No scoring rules were found for this league." />
            )}
          </Card>

          <Card title="Provider Status">
            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-1">
              {projectionProviderStatuses.map((provider) => (
                <ProviderStatusCard
                  detail={provider.detail}
                  key={provider.name}
                  name={provider.name}
                  status={provider.status}
                />
              ))}
            </div>
          </Card>
        </section>
        ) : null}

        {selectedTab === "teams" ? (
        <Card title="Teams And Rosters">
          {league.teams.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {league.teams.map((team) => {
                const rosterPlayers = [...team.rosterPlayers].sort(
                  (a, b) =>
                    rosterStatusOrder[a.status] - rosterStatusOrder[b.status] ||
                    a.player.position.localeCompare(b.player.position) ||
                    getBestPlayerDisplayName(a.player).localeCompare(
                      getBestPlayerDisplayName(b.player),
                    ),
                );

                return (
                  <div
                    className="rounded-md border border-zinc-200 bg-white p-4"
                    key={team.id}
                  >
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="font-semibold text-zinc-950">
                          {team.name}
                        </h3>
                        <p className="text-sm text-zinc-500">
                          Platform roster{" "}
                          {getExternalIdentityValue(
                            team.externalIdentities,
                            league.platform,
                          ) ?? "unknown"}
                        </p>
                      </div>
                      <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700">
                        {rosterPlayers.length} players
                      </span>
                    </div>

                    {rosterPlayers.length > 0 ? (
                      <div className="mt-4 grid gap-2">
                        {rosterPlayers.map((rosterPlayer) => {
                          const playerName = getBestPlayerDisplayName(
                            rosterPlayer.player,
                          );

                          return (
                            <div
                              className="grid grid-cols-[58px_minmax(0,1fr)_76px] items-center gap-3 rounded-md border border-zinc-100 bg-zinc-50 px-3 py-2 text-sm"
                              key={rosterPlayer.id}
                            >
                              <span className="font-semibold text-zinc-950">
                                {rosterPlayer.player.position}
                              </span>
                              <span className="truncate text-zinc-700">
                                {playerName}
                                {rosterPlayer.player.team
                                  ? `, ${rosterPlayer.player.team}`
                                  : ""}
                              </span>
                              <span className="text-right text-xs font-semibold text-zinc-500">
                                {rosterPlayer.status}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <EmptyState message="No rostered players found for this team." />
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState message="No teams found. Import a league first." />
          )}
        </Card>
        ) : null}

        {selectedTab === "projections" ? (
        <>
        <Card title="Mock Projection Import">
          <MockProjectionImportForm
            defaultWeek={selectedWeek}
            leagueId={league.id}
          />
        </Card>

        <Card title="FantasyPros Projection Import">
          <FantasyProsProjectionImportForm
            defaultWeek={selectedWeek}
            leagueId={league.id}
          />
        </Card>

        <Card title="Projection Context">
          <ProjectionContextForm
            availableWeeks={projectionOptions.availableWeeks}
            leagueId={league.id}
            providerOptions={projectionOptions.providerOptions}
            selectedProjectionMode={selectedProjectionMode}
            selectedProvider={selectedProvider}
            selectedTab={selectedTab}
            selectedWeek={selectedWeek}
          />
          {isConsensusLimitedBySingleProvider ? (
            <div className="mt-4">
              <WarningState message="Consensus is based on one provider only." />
            </div>
          ) : null}
          {projections.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                message={`No projections found for ${league.season} week ${selectedWeek}${
                  selectedProvider ? ` from ${selectedProvider}` : ""
                }. Generate mock projections for this week or choose a different week.`}
              />
            </div>
          ) : null}
          {selectedProjectionMode === "SELECTED_PROVIDER" &&
          projectionOptions.providerOptions.length > 1 &&
          !selectedProvider ? (
            <p className="mt-3 text-sm text-zinc-600">
              Multiple providers are available for this league. Auto provider
              mode selects one provider per player using the app provider
              preference without crossing seasons or weeks.
            </p>
          ) : null}
        </Card>

        <Card title="Consensus Projections">
          {consensusProjections.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
                    <th className="py-2 pr-4 font-semibold">Player</th>
                    <th className="py-2 pr-4 font-semibold">Pos</th>
                    <th className="py-2 pr-4 font-semibold">Team</th>
                    <th className="py-2 pr-4 font-semibold">Providers</th>
                    <th className="py-2 pr-4 font-semibold">Consensus</th>
                    <th className="py-2 pr-4 font-semibold">Low</th>
                    <th className="py-2 pr-4 font-semibold">High</th>
                    <th className="py-2 pr-4 font-semibold">Spread</th>
                    <th className="py-2 pr-4 font-semibold">Agreement</th>
                    <th className="py-2 pr-4 font-semibold">Confidence</th>
                    <th className="py-2 font-semibold">Providers Used</th>
                  </tr>
                </thead>
                <tbody>
                  {consensusProjections.map(({ player, consensus }) => (
                    <tr className="border-b border-zinc-100" key={player.id}>
                      <td className="py-2 pr-4 font-semibold text-zinc-950">
                        {getBestPlayerDisplayName(player)}
                      </td>
                      <td className="py-2 pr-4 text-zinc-700">
                        {player.position}
                      </td>
                      <td className="py-2 pr-4 text-zinc-700">
                        {player.team ?? "--"}
                      </td>
                      <td className="py-2 pr-4 text-zinc-700">
                        {consensus.providerCount}
                      </td>
                      <td className="py-2 pr-4 font-semibold text-zinc-950">
                        {formatProjectionNumber(
                          consensus.consensusProjectedFantasyPoints,
                        )}
                      </td>
                      <td className="py-2 pr-4 text-zinc-700">
                        {formatProjectionNumber(consensus.minProjection)}
                      </td>
                      <td className="py-2 pr-4 text-zinc-700">
                        {formatProjectionNumber(consensus.maxProjection)}
                      </td>
                      <td className="py-2 pr-4 text-zinc-700">
                        {formatProjectionNumber(consensus.projectionSpread)}
                      </td>
                      <td className="py-2 pr-4 text-zinc-700">
                        {formatConsensusScore(
                          consensus.providerAgreementScore,
                        )}
                      </td>
                      <td className="py-2 pr-4 text-zinc-700">
                        {formatConsensusScore(consensus.consensusConfidence)}
                        {consensus.limitedBySingleProvider ? " limited" : ""}
                      </td>
                      <td className="py-2 text-zinc-700">
                        {consensus.providers.join(", ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              message={`No consensus projections found for week ${selectedWeek}. Consensus requires at least one provider projection for the selected week.`}
            />
          )}
        </Card>

        <Card title="Player Projections">
          {projections.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
                    <th className="py-2 pr-4 font-semibold">Player</th>
                    <th className="py-2 pr-4 font-semibold">Pos</th>
                    <th className="py-2 pr-4 font-semibold">Team</th>
                    <th className="py-2 pr-4 font-semibold">Provider</th>
                    <th className="py-2 pr-4 font-semibold">Week</th>
                    <th className="py-2 pr-4 font-semibold">Proj</th>
                    <th className="py-2 pr-4 font-semibold">Floor</th>
                    <th className="py-2 pr-4 font-semibold">Ceiling</th>
                    <th className="py-2 font-semibold">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {projections.map(({ player, projection }) => (
                    <tr
                      className="border-b border-zinc-100"
                      key={projection.id}
                    >
                      <td className="py-2 pr-4 font-semibold text-zinc-950">
                        {getBestPlayerDisplayName(player)}
                      </td>
                      <td className="py-2 pr-4 text-zinc-700">
                        {player.position}
                      </td>
                      <td className="py-2 pr-4 text-zinc-700">
                        {player.team ?? "--"}
                      </td>
                      <td className="py-2 pr-4 text-zinc-700">
                        {projection.provider}
                      </td>
                      <td className="py-2 pr-4 text-zinc-700">
                        {projection.week}
                      </td>
                      <td className="py-2 pr-4 font-semibold text-zinc-950">
                        {formatProjectionNumber(
                          projection.projectedFantasyPoints,
                        )}
                      </td>
                      <td className="py-2 pr-4 text-zinc-700">
                        {formatProjectionNumber(projection.floor)}
                      </td>
                      <td className="py-2 pr-4 text-zinc-700">
                        {formatProjectionNumber(projection.ceiling)}
                      </td>
                      <td className="py-2 text-zinc-700">
                        {formatConfidence(projection.confidence)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              message={`No projections found for week ${selectedWeek}. Generate mock projections for this week or choose a different imported week.`}
            />
          )}
        </Card>

        <Card title="League-Adjusted Projections">
          {leagueAdjustedProjections.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
                    <th className="py-2 pr-4 font-semibold">Player</th>
                    <th className="py-2 pr-4 font-semibold">Pos</th>
                    <th className="py-2 pr-4 font-semibold">Team</th>
                    <th className="py-2 pr-4 font-semibold">Provider</th>
                    <th className="py-2 pr-4 font-semibold">Raw Proj</th>
                    <th className="py-2 pr-4 font-semibold">League Adj</th>
                    <th className="py-2 pr-4 font-semibold">Floor</th>
                    <th className="py-2 pr-4 font-semibold">Ceiling</th>
                    <th className="py-2 pr-4 font-semibold">Confidence</th>
                    <th className="py-2 pr-4 font-semibold">Risk</th>
                    <th className="py-2 font-semibold">Diff</th>
                  </tr>
                </thead>
                <tbody>
                  {leagueAdjustedProjections.map(
                    ({
                      player,
                      projection,
                      adjustedPoints,
                      confidence,
                      difference,
                    }) => (
                      <tr
                        className="border-b border-zinc-100"
                        key={projection.id}
                      >
                        <td className="py-2 pr-4 font-semibold text-zinc-950">
                          {getBestPlayerDisplayName(player)}
                        </td>
                        <td className="py-2 pr-4 text-zinc-700">
                          {player.position}
                        </td>
                        <td className="py-2 pr-4 text-zinc-700">
                          {player.team ?? "--"}
                        </td>
                        <td className="py-2 pr-4 text-zinc-700">
                          {projection.provider}
                        </td>
                        <td className="py-2 pr-4 text-zinc-700">
                          {formatProjectionNumber(
                            projection.projectedFantasyPoints,
                          )}
                        </td>
                        <td className="py-2 pr-4 font-semibold text-zinc-950">
                          {formatProjectionNumber(adjustedPoints)}
                        </td>
                        <td className="py-2 pr-4 text-zinc-700">
                          {formatProjectionNumber(confidence.floor)}
                        </td>
                        <td className="py-2 pr-4 text-zinc-700">
                          {formatProjectionNumber(confidence.ceiling)}
                        </td>
                        <td className="py-2 pr-4 text-zinc-700">
                          {formatConfidencePercentage(
                            confidence.confidencePercentage,
                          )}
                        </td>
                        <td className="py-2 pr-4 font-semibold text-zinc-700">
                          {confidence.riskLabel}
                        </td>
                        <td className="py-2 font-semibold text-zinc-700">
                          {formatProjectionDifference(difference)}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              message={`No week ${selectedWeek} projections found yet. League-adjusted projections need a projection for the selected week.`}
            />
          )}
        </Card>
        </>
        ) : null}

        {selectedTab === "matchups" ? (
        <>
        <Card title="Weekly Matchup Dashboard">
          <p className="mb-4 text-sm text-zinc-600">
            Projected totals use {getProjectionModeDisplayName(selectedProjectionMode).toLowerCase()} optimized starters.
          </p>
          {weeklyMatchupDashboard.length > 0 ? (
            <div className="grid gap-4">
              {weeklyMatchupDashboard.map(([week, matchups]) => (
                <section
                  className="rounded-md border border-zinc-200 bg-white p-4"
                  key={week}
                >
                  <h3 className="font-semibold text-zinc-950">Week {week}</h3>
                  <div className="mt-3 grid gap-3">
                    {matchups.map((matchup) => (
                      <div
                        className="rounded-md border border-zinc-100 bg-zinc-50 p-3"
                        key={matchup.id}
                      >
                        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_64px_minmax(0,1fr)_190px] lg:items-center">
                          <MatchupDashboardTeam
                            actualScore={matchup.teamA.actualScore}
                            name={matchup.teamA.name}
                            projectedTotal={matchup.teamA.projectedTotal}
                          />
                          <span className="text-center text-xs font-semibold uppercase text-zinc-500">
                            vs
                          </span>
                          <MatchupDashboardTeam
                            actualScore={matchup.teamB.actualScore}
                            alignRight
                            name={matchup.teamB.name}
                            projectedTotal={matchup.teamB.projectedTotal}
                          />
                          <div className="rounded-md border border-zinc-200 bg-white px-3 py-2 lg:text-right">
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                              Projected Winner
                            </p>
                            <p className="mt-1 font-semibold text-zinc-950">
                              {matchup.projectedWinner}
                            </p>
                            <p className="mt-1 text-sm text-zinc-600">
                              Margin:{" "}
                              {matchup.projectedMargin === null
                                ? "--"
                                : formatProjectionNumber(
                                    matchup.projectedMargin,
                                  )}
                            </p>
                            <p className="mt-1 text-sm text-zinc-600">
                              Confidence: {matchup.confidenceLabel}
                            </p>
                            <p className="mt-1 text-sm text-zinc-600">
                              Win probability:{" "}
                              {matchup.estimatedWinProbability === null
                                ? "--"
                                : formatConfidencePercentage(
                                    matchup.estimatedWinProbability,
                                  )}
                            </p>
                          </div>
                        </div>
                        {matchup.warnings.length > 0 ? (
                          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                            {matchup.warnings.join(" ")}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <EmptyState
              message={`No imported matchups found for week ${selectedWeek}. Choose another week or re-import the league after matchups are available.`}
            />
          )}
        </Card>
        </>
        ) : null}

        {selectedTab === "start-sit" ? (
        <Card title="Start/Sit Recommendations">
          <p className="mb-4 text-sm text-zinc-600">
            Recommendations use {getProjectionModeDisplayName(selectedProjectionMode).toLowerCase()} projections.
          </p>
          {startSitRecommendations.length > 0 ? (
            <div className="grid gap-4">
              {startSitRecommendations.map(({ team, result }) => (
                <section
                  className="rounded-md border border-zinc-200 bg-white p-4"
                  key={team.id}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="font-semibold text-zinc-950">
                        {team.name}
                      </h3>
                      <p className="mt-1 text-sm text-zinc-600">
                        {result.explanation}
                      </p>
                    </div>
                    <div className="rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 sm:text-right">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">
                        Starter Total
                      </p>
                      <p className="mt-1 text-lg font-semibold text-emerald-950">
                        {formatProjectionNumber(result.projectedTotal)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <RecommendationList
                      emptyMessage="No recommended starters yet. Check roster settings and projections."
                      items={result.starters.map((starter) => ({
                        id: `${starter.slot.id}-${starter.player.id}`,
                        label: starter.slot.label,
                        player: starter.player,
                        points: starter.adjustedPoints,
                        projectionSpread: starter.projectionSpread,
                        confidence: getCandidateConfidenceAnalysis(starter),
                      }))}
                      title="Recommended Starters"
                    />
                    <RecommendationList
                      emptyMessage="No bench players remain after filling starter slots."
                      items={result.bench.map((benchPlayer) => ({
                        id: benchPlayer.player.id,
                        label: benchPlayer.player.position,
                        player: benchPlayer.player,
                        points: benchPlayer.adjustedPoints,
                        projectionSpread: benchPlayer.projectionSpread,
                        confidence: getCandidateConfidenceAnalysis(benchPlayer),
                      }))}
                      title="Recommended Bench"
                    />
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <EmptyState message="No teams found. Import a league before generating start/sit recommendations." />
          )}
        </Card>
        ) : null}

        {selectedTab === "matchups" ? (
        <Card title="Imported Matchups">
          {matchupsByWeek.length > 0 ? (
            <div className="grid gap-4">
              {matchupsByWeek.map(([week, matchups]) => (
                <section
                  className="rounded-md border border-zinc-200 bg-white p-4"
                  key={week}
                >
                  <h3 className="font-semibold text-zinc-950">Week {week}</h3>
                  <div className="mt-3 grid gap-2">
                    {matchups.map((matchup) => (
                      <div
                        className="grid gap-2 rounded-md border border-zinc-100 bg-zinc-50 px-3 py-2 text-sm sm:grid-cols-[minmax(0,1fr)_80px_minmax(0,1fr)] sm:items-center"
                        key={matchup.id}
                      >
                        <MatchupTeam
                          name={matchup.teamA.name}
                          score={matchup.teamAScore}
                        />
                        <span className="text-center text-xs font-semibold uppercase text-zinc-500">
                          vs
                        </span>
                        {matchup.teamB ? (
                          <MatchupTeam
                            alignRight
                            name={matchup.teamB.name}
                            score={matchup.teamBScore}
                          />
                        ) : (
                          <p className="text-zinc-500 sm:text-right">
                            No opponent saved
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <EmptyState
              message={`No imported matchups found for week ${selectedWeek}.`}
            />
          )}
        </Card>
        ) : null}
      </section>
    </main>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border border-zinc-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-zinc-950">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600">
      {message}
    </div>
  );
}

function WarningState({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      {message}
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-zinc-950">{value}</p>
    </div>
  );
}

function LeagueWorkspaceTabs({
  leagueId,
  selectedProjectionMode,
  selectedProvider,
  selectedTab,
  selectedWeek,
}: {
  leagueId: string;
  selectedProjectionMode: ProjectionMode;
  selectedProvider?: string;
  selectedTab: LeagueWorkspaceTabId;
  selectedWeek: number;
}) {
  return (
    <nav
      aria-label="League workspace sections"
      className="overflow-x-auto rounded-md border border-zinc-200 bg-white p-1"
    >
      <div className="flex min-w-max gap-1">
        {leagueWorkspaceTabs.map((tab) => {
          const isActive = tab.id === selectedTab;

          return (
            <Link
              aria-current={isActive ? "page" : undefined}
              className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                isActive
                  ? "bg-emerald-700 text-white"
                  : "text-zinc-700 hover:bg-zinc-100"
              }`}
              href={buildLeagueWorkspaceHref({
                leagueId,
                mode: selectedProjectionMode,
                provider: selectedProvider,
                tab: tab.id,
                week: selectedWeek,
              })}
              key={tab.id}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function ProviderStatusCard({
  name,
  status,
  detail,
}: {
  name: string;
  status: string;
  detail: string;
}) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold text-zinc-950">{name}</p>
        <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-zinc-700">
          {status}
        </span>
      </div>
      <p className="mt-2 text-sm text-zinc-600">{detail}</p>
    </div>
  );
}

function ProjectionContextForm({
  availableWeeks,
  leagueId,
  providerOptions,
  selectedProjectionMode,
  selectedProvider,
  selectedTab,
  selectedWeek,
}: {
  availableWeeks: number[];
  leagueId: string;
  providerOptions: string[];
  selectedProjectionMode: ProjectionMode;
  selectedProvider?: string;
  selectedTab: LeagueWorkspaceTabId;
  selectedWeek: number;
}) {
  const weekOptions = availableWeeks.includes(selectedWeek)
    ? availableWeeks
    : [...availableWeeks, selectedWeek].sort((weekA, weekB) => weekA - weekB);

  return (
    <form
      action={`/leagues/${leagueId}`}
      className="grid gap-3 md:grid-cols-[180px_160px_220px_auto] md:items-end"
    >
      <input name="tab" type="hidden" value={selectedTab} />
      <label className="grid gap-1 text-sm font-semibold text-zinc-700">
        Projection Mode
        <select
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
          defaultValue={selectedProjectionMode}
          name="mode"
        >
          <option value="SELECTED_PROVIDER">Selected Provider</option>
          <option value="CONSENSUS">Consensus</option>
        </select>
      </label>
      <label className="grid gap-1 text-sm font-semibold text-zinc-700">
        Week
        <select
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
          defaultValue={String(selectedWeek)}
          name="week"
        >
          {weekOptions.length > 0 ? (
            weekOptions.map((week) => (
              <option key={week} value={week}>
                Week {week}
              </option>
            ))
          ) : (
            <option value={selectedWeek}>Week {selectedWeek}</option>
          )}
        </select>
      </label>
      <label className="grid gap-1 text-sm font-semibold text-zinc-700">
        Provider
        <select
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
          defaultValue={selectedProvider ?? ""}
          name="provider"
        >
          <option value="">Auto provider</option>
          {providerOptions.map((provider) => (
            <option key={provider} value={provider}>
              {provider}
            </option>
          ))}
        </select>
      </label>
      <button
        className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
        type="submit"
      >
        Apply
      </button>
    </form>
  );
}

function MatchupTeam({
  name,
  score,
  alignRight = false,
}: {
  name: string;
  score: number | null;
  alignRight?: boolean;
}) {
  return (
    <div className={alignRight ? "sm:text-right" : ""}>
      <p className="font-semibold text-zinc-950">{name}</p>
      <p className="text-zinc-600">{score === null ? "--" : score.toFixed(2)}</p>
    </div>
  );
}

function MatchupDashboardTeam({
  name,
  actualScore,
  projectedTotal,
  alignRight = false,
}: {
  name: string;
  actualScore: number | null;
  projectedTotal: number;
  alignRight?: boolean;
}) {
  return (
    <div className={alignRight ? "lg:text-right" : ""}>
      <p className="font-semibold text-zinc-950">{name}</p>
      <div className="mt-1 grid gap-1 text-sm text-zinc-600 sm:grid-cols-2 lg:grid-cols-1">
        <p>Actual: {actualScore === null ? "--" : actualScore.toFixed(2)}</p>
        <p>Optimized projection: {formatProjectionNumber(projectedTotal)}</p>
      </div>
    </div>
  );
}

function RecommendationList({
  title,
  items,
  emptyMessage,
}: {
  title: string;
  items: Array<{
    id: string;
    label: string;
    player: OptimizerCandidate["player"];
    points: number;
    projectionSpread?: number | null;
    confidence: ProjectionConfidenceAnalysis;
  }>;
  emptyMessage: string;
}) {
  return (
    <div className="rounded-md border border-zinc-100 bg-zinc-50 p-3">
      <h4 className="text-sm font-semibold text-zinc-950">{title}</h4>
      {items.length > 0 ? (
        <div className="mt-3 grid gap-2">
          {items.map((item) => (
            <div
              className="grid gap-3 rounded-md border border-zinc-100 bg-white px-3 py-2 text-sm xl:grid-cols-[82px_minmax(0,1fr)_minmax(300px,0.8fr)] xl:items-center"
              key={item.id}
            >
              <span className="font-semibold text-zinc-950">
                {item.label}
              </span>
              <span className="min-w-0 text-zinc-700">
                <span className="block truncate font-medium">
                  {getBestPlayerDisplayName(item.player)}
                </span>
                <span className="block truncate text-xs text-zinc-500">
                  {item.player.position}
                  {item.player.team ? `, ${item.player.team}` : ""}
                </span>
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs text-zinc-600 sm:grid-cols-6">
                <ProjectionMetric
                  label="Proj"
                  value={formatProjectionNumber(item.points)}
                />
                <ProjectionMetric
                  label="Floor"
                  value={formatProjectionNumber(item.confidence.floor)}
                />
                <ProjectionMetric
                  label="Ceiling"
                  value={formatProjectionNumber(item.confidence.ceiling)}
                />
                <ProjectionMetric
                  label="Conf"
                  value={formatConfidencePercentage(
                    item.confidence.confidencePercentage,
                  )}
                />
                <ProjectionMetric
                  label="Risk"
                  value={item.confidence.riskLabel}
                />
                {typeof item.projectionSpread === "number" ? (
                  <ProjectionMetric
                    label="Spread"
                    value={formatProjectionNumber(item.projectionSpread)}
                  />
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3">
          <EmptyState message={emptyMessage} />
        </div>
      )}
    </div>
  );
}

function ProjectionMetric({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-md border border-zinc-100 bg-zinc-50 px-2 py-1">
      <span className="block text-[11px] font-semibold uppercase text-zinc-500">
        {label}
      </span>
      <span className="block font-semibold text-zinc-950">{value}</span>
    </span>
  );
}

function groupMatchupsByWeek<
  T extends {
    week: number;
  },
>(matchups: T[]) {
  const grouped = new Map<number, T[]>();

  for (const matchup of matchups) {
    grouped.set(matchup.week, [...(grouped.get(matchup.week) ?? []), matchup]);
  }

  return Array.from(grouped.entries()).sort(([weekA], [weekB]) => weekA - weekB);
}

function getProjectionOptions(
  teams: Array<{
    rosterPlayers: Array<{
      player: {
        projections: Array<{
          week: number;
          provider: string;
          importedAt?: Date | null;
        }>;
      };
    }>;
  }>,
  matchups: Array<{
    week: number;
  }>,
) {
  const weekSet = new Set<number>();
  const providerSet = new Set<string>();
  const projectionImports: Array<{
    week: number;
    importedAt?: Date | null;
  }> = [];

  for (const team of teams) {
    for (const rosterPlayer of team.rosterPlayers) {
      for (const projection of rosterPlayer.player.projections) {
        weekSet.add(projection.week);
        providerSet.add(projection.provider);
        projectionImports.push({
          week: projection.week,
          importedAt: projection.importedAt,
        });
      }
    }
  }

  for (const matchup of matchups) {
    weekSet.add(matchup.week);
  }

  const mostRecentlyImportedProjectionWeek = projectionImports.sort(
    (projectionA, projectionB) =>
      getTimestamp(projectionB.importedAt) - getTimestamp(projectionA.importedAt) ||
      projectionB.week - projectionA.week,
  )[0]?.week;
  const latestAvailableWeek =
    Array.from(weekSet).sort((weekA, weekB) => weekB - weekA)[0] ?? 1;

  return {
    availableWeeks: Array.from(weekSet).sort((weekA, weekB) => weekA - weekB),
    providerOptions: Array.from(providerSet).sort(),
    defaultWeek: mostRecentlyImportedProjectionWeek ?? latestAvailableWeek,
  };
}

function getSelectedWeek(value: string | undefined, defaultWeek: number) {
  const parsedWeek = Number(value);

  if (Number.isInteger(parsedWeek) && parsedWeek > 0) {
    return parsedWeek;
  }

  return defaultWeek;
}

function getSelectedProvider(
  value: string | undefined,
  providerOptions: string[],
) {
  if (!value) return undefined;

  return providerOptions.includes(value) ? value : undefined;
}

function getSelectedProjectionMode(value: string | undefined): ProjectionMode {
  return value === "CONSENSUS" ? "CONSENSUS" : "SELECTED_PROVIDER";
}

function getProjectionMode(context: ProjectionContext): ProjectionMode {
  return context.mode ?? "SELECTED_PROVIDER";
}

function getProjectionModeRecommendationSentence(context: ProjectionContext) {
  if (getProjectionMode(context) === "CONSENSUS") {
    return "Based on consensus projections.";
  }

  if (context.provider) {
    return `Based on selected provider projections from ${context.provider}.`;
  }

  return "Based on selected provider projections using provider preference.";
}

function getProjectionModeDisplayName(mode: ProjectionMode) {
  return mode === "CONSENSUS" ? "Consensus" : "Selected Provider";
}

function getSelectedTab(value: string | undefined): LeagueWorkspaceTabId {
  const validTab = leagueWorkspaceTabs.find((tab) => tab.id === value);

  return validTab?.id ?? "overview";
}

function buildLeagueWorkspaceHref({
  leagueId,
  mode,
  provider,
  tab,
  week,
}: {
  leagueId: string;
  mode: ProjectionMode;
  provider?: string;
  tab: LeagueWorkspaceTabId;
  week: number;
}) {
  const params = new URLSearchParams({
    mode,
    tab,
    week: String(week),
  });

  if (provider) {
    params.set("provider", provider);
  }

  return `/leagues/${leagueId}?${params.toString()}`;
}

function getRosteredPlayerProjections(
  teams: Array<{
    rosterPlayers: Array<{
      player: RosteredPlayerForProjection;
    }>;
  }>,
  projectionContext: ProjectionContext,
) {
  const projections = new Map<
    string,
    {
      player: Omit<RosteredPlayerForProjection, "projections">;
      projection: RosteredProjection;
    }
  >();

  for (const team of teams) {
    for (const rosterPlayer of team.rosterPlayers) {
      const projection = selectProjection({
        projections: rosterPlayer.player.projections,
        playerId: rosterPlayer.player.id,
        context: projectionContext,
      });

      if (projection) {
        projections.set(`${rosterPlayer.player.id}:${projection.id}`, {
          player: rosterPlayer.player,
          projection,
        });
      }
    }
  }

  return Array.from(projections.values()).sort(
    (a, b) =>
      (b.projection.projectedFantasyPoints ?? 0) -
        (a.projection.projectedFantasyPoints ?? 0) ||
      getBestPlayerDisplayName(a.player).localeCompare(
        getBestPlayerDisplayName(b.player),
      ),
  );
}

function getConsensusProjections(
  teams: Array<{
    rosterPlayers: Array<{
      player: RosteredPlayerForProjection;
    }>;
  }>,
  projectionContext: ProjectionContext,
) {
  const consensusByPlayer = new Map<
    string,
    {
      player: Omit<RosteredPlayerForProjection, "projections">;
      consensus: NonNullable<ReturnType<typeof calculateConsensusProjection>>;
    }
  >();

  for (const team of teams) {
    for (const rosterPlayer of team.rosterPlayers) {
      const consensus = calculateConsensusProjection({
        projections: rosterPlayer.player.projections,
        playerId: rosterPlayer.player.id,
        context: projectionContext,
      });

      if (!consensus) continue;

      consensusByPlayer.set(rosterPlayer.player.id, {
        player: rosterPlayer.player,
        consensus,
      });
    }
  }

  return Array.from(consensusByPlayer.values()).sort(
    (a, b) =>
      b.consensus.consensusProjectedFantasyPoints -
        a.consensus.consensusProjectedFantasyPoints ||
      getBestPlayerDisplayName(a.player).localeCompare(
        getBestPlayerDisplayName(b.player),
      ),
  );
}

function getLeagueAdjustedProjections(
  projections: ReturnType<typeof getRosteredPlayerProjections>,
  scoringRules: Array<{
    statKey: string;
    points: number;
    position: string | null;
    description: string | null;
  }>,
) {
  const normalizedRules = normalizeScoringRules(scoringRules);

  return projections.map(({ player, projection }) => {
    const adjustedPoints = calculateFantasyPoints({
      projectedStats: projection.projectedStats,
      rules: normalizedRules,
      position: player.position,
    }).fantasyPoints;
    const rawProjectedPoints = projection.projectedFantasyPoints ?? 0;
    const confidence = getAdjustedProjectionConfidence({
      adjustedPoints,
      projection,
    });

    return {
      player,
      projection,
      adjustedPoints,
      confidence,
      difference: roundProjection(adjustedPoints - rawProjectedPoints),
    };
  });
}

function getAdjustedProjectionConfidence({
  adjustedPoints,
  projection,
}: {
  adjustedPoints: number;
  projection:
    | {
        projectedFantasyPoints: number | null;
        median?: number | null;
        floor?: number | null;
        ceiling?: number | null;
        confidence?: number | null;
      }
    | undefined;
}) {
  if (!projection) {
    return analyzeProjectionConfidence({
      projectedPoints: adjustedPoints,
      hasProjection: false,
    });
  }

  const rawBasis =
    projection.projectedFantasyPoints ?? projection.median ?? adjustedPoints;
  const scale = rawBasis > 0 ? adjustedPoints / rawBasis : 1;
  const adjustedFloor =
    typeof projection.floor === "number"
      ? roundProjection(projection.floor * scale)
      : null;
  const adjustedCeiling =
    typeof projection.ceiling === "number"
      ? roundProjection(projection.ceiling * scale)
      : null;

  return analyzeProjectionConfidence({
    projectedPoints: adjustedPoints,
    floor: adjustedFloor,
    median: adjustedPoints,
    ceiling: adjustedCeiling,
    confidence: projection.confidence,
    hasProjection: true,
  });
}

function getWeeklyMatchupDashboard(
  matchups: Array<{
    id: string;
    week: number;
    teamAId: string;
    teamBId: string | null;
    teamAScore: number | null;
    teamBScore: number | null;
    teamA: {
      id: string;
      name: string;
    };
    teamB: {
      id: string;
      name: string;
    } | null;
  }>,
  startSitRecommendations: TeamStartSitRecommendation[],
) {
  const recommendationsByTeamId = new Map(
    startSitRecommendations.map((recommendation) => [
      recommendation.team.id,
      recommendation,
    ]),
  );

  const dashboardRows = matchups.map((matchup) => {
    const teamARecommendation = recommendationsByTeamId.get(matchup.teamAId);
    const teamBRecommendation = matchup.teamBId
      ? recommendationsByTeamId.get(matchup.teamBId)
      : undefined;
    const teamAProjectedTotal =
      teamARecommendation?.result.projectedTotal ?? 0;
    const teamBProjectedTotal =
      teamBRecommendation?.result.projectedTotal ?? 0;
    const matchupConfidence = analyzeMatchupConfidence({
      teamAProjectedTotal,
      teamBProjectedTotal,
      teamAConfidencePercentage:
        teamARecommendation?.lineupConfidence.confidencePercentage,
      teamBConfidencePercentage:
        teamBRecommendation?.lineupConfidence.confidencePercentage,
      hasOpponent: Boolean(matchup.teamB),
    });
    const projectedWinner = getProjectedWinner({
      teamAName: matchup.teamA.name,
      teamBName: matchup.teamB?.name ?? "No opponent saved",
      teamAProjectedTotal,
      teamBProjectedTotal,
      hasOpponent: Boolean(matchup.teamB),
    });

    return {
      id: matchup.id,
      week: matchup.week,
      teamA: {
        name: matchup.teamA.name,
        actualScore: matchup.teamAScore,
        projectedTotal: teamAProjectedTotal,
      },
      teamB: {
        name: matchup.teamB?.name ?? "No opponent saved",
        actualScore: matchup.teamBScore,
        projectedTotal: teamBProjectedTotal,
      },
      projectedWinner,
      projectedMargin: matchupConfidence.projectedMargin,
      confidenceLabel: matchupConfidence.confidenceLabel,
      estimatedWinProbability: matchupConfidence.estimatedWinProbability,
      warnings: getMatchupProjectionWarnings({
        teamAName: matchup.teamA.name,
        teamARecommendation,
        teamBName: matchup.teamB?.name,
        teamBRecommendation,
        hasOpponent: Boolean(matchup.teamB),
        matchupConfidence,
      }),
    };
  });

  return groupMatchupsByWeek(dashboardRows);
}

function getProjectedWinner({
  teamAName,
  teamBName,
  teamAProjectedTotal,
  teamBProjectedTotal,
  hasOpponent,
}: {
  teamAName: string;
  teamBName: string;
  teamAProjectedTotal: number;
  teamBProjectedTotal: number;
  hasOpponent: boolean;
}) {
  if (!hasOpponent) return "No opponent saved";
  if (teamAProjectedTotal === teamBProjectedTotal) return "Projected tie";

  return teamAProjectedTotal > teamBProjectedTotal ? teamAName : teamBName;
}

function getMatchupProjectionWarnings({
  teamAName,
  teamARecommendation,
  teamBName,
  teamBRecommendation,
  hasOpponent,
  matchupConfidence,
}: {
  teamAName: string;
  teamARecommendation?: TeamStartSitRecommendation;
  teamBName?: string;
  teamBRecommendation?: TeamStartSitRecommendation;
  hasOpponent: boolean;
  matchupConfidence: ReturnType<typeof analyzeMatchupConfidence>;
}) {
  const warnings: string[] = [];

  appendProjectionWarning(warnings, teamAName, teamARecommendation);

  if (hasOpponent && teamBName) {
    appendProjectionWarning(warnings, teamBName, teamBRecommendation);
  } else {
    warnings.push("No opponent was saved for this matchup.");
  }

  if (matchupConfidence.isCloseMatchup) {
    warnings.push(
      `Close matchup: the projected margin is only ${formatProjectionNumber(
        matchupConfidence.projectedMargin,
      )} points.`,
    );
  }

  return warnings;
}

function appendProjectionWarning(
  warnings: string[],
  teamName: string,
  recommendation?: TeamStartSitRecommendation,
) {
  if (!recommendation) {
    warnings.push(
      `No roster data was found for ${teamName}; its optimized projection is shown as 0.`,
    );
    return;
  }

  const missingProjectionCount =
    recommendation.rosteredPlayerCount - recommendation.projectedPlayerCount;

  if (missingProjectionCount > 0) {
    warnings.push(
      `${teamName} has ${missingProjectionCount} rostered player${
        missingProjectionCount === 1 ? "" : "s"
      } without projections; those players are counted as 0.`,
    );
  }

  if (
    recommendation.projectionMode === "CONSENSUS" &&
    recommendation.consensusLimitedPlayerCount > 0
  ) {
    warnings.push(
      `Consensus is based on one provider only for ${recommendation.consensusLimitedPlayerCount} projected player${
        recommendation.consensusLimitedPlayerCount === 1 ? "" : "s"
      } on ${teamName}.`,
    );
  }
}

function getStartSitRecommendations(
  teams: Array<{
    id: string;
    name: string;
    rosterPlayers: Array<{
      player: RosteredPlayerForProjection;
    }>;
  }>,
  rosterSettings: RosterSettingsInput | null,
  scoringRules: Array<{
    statKey: string;
    points: number;
    position: string | null;
    description: string | null;
  }>,
  projectionContext: ProjectionContext,
): TeamStartSitRecommendation[] {
  const normalizedRules = normalizeScoringRules(scoringRules);

  return teams.map((team) => {
    let projectedPlayerCount = 0;
    const candidates = team.rosterPlayers.map(({ player }) => {
      const projectionInput = getOptimizerProjectionInput({
        player,
        projectionContext,
        normalizedRules,
      });

      if (projectionInput.hasProjection) {
        projectedPlayerCount += 1;
      }

      return {
        player,
        ...projectionInput,
      };
    });
    const result = optimizeLineup(candidates, rosterSettings);
    const lineupConfidence = getLineupConfidence(result.starters);
    const consensusLimitedPlayerCount = candidates.filter(
      (candidate) => candidate.limitedBySingleProvider,
    ).length;

    return {
      team: {
        id: team.id,
        name: team.name,
      },
      result: {
        ...result,
        explanation: buildStartSitConfidenceExplanation(
          result.explanation,
          lineupConfidence,
          projectionContext,
          consensusLimitedPlayerCount,
        ),
      },
      lineupConfidence,
      projectionMode: getProjectionMode(projectionContext),
      consensusLimitedPlayerCount,
      rosteredPlayerCount: team.rosterPlayers.length,
      projectedPlayerCount,
    };
  });
}

function getOptimizerProjectionInput({
  player,
  projectionContext,
  normalizedRules,
}: {
  player: RosteredPlayerForProjection;
  projectionContext: ProjectionContext;
  normalizedRules: LeagueScoringRule[];
}): Omit<OptimizerCandidate, "player"> {
  if (getProjectionMode(projectionContext) === "CONSENSUS") {
    const consensus = calculateConsensusProjection({
      projections: player.projections,
      playerId: player.id,
      context: projectionContext,
    });

    if (!consensus) {
      return getMissingOptimizerProjectionInput("CONSENSUS");
    }

    return {
      projectedPoints: consensus.consensusProjectedFantasyPoints,
      projectedFloor: consensus.minProjection,
      projectedCeiling: consensus.maxProjection,
      confidence: consensus.consensusConfidence,
      hasProjection: true,
      rawProjectedPoints: consensus.consensusProjectedFantasyPoints,
      projectionMode: "CONSENSUS",
      projectionSpread: consensus.projectionSpread,
      providerAgreementScore: consensus.providerAgreementScore,
      providerCount: consensus.providerCount,
      limitedBySingleProvider: consensus.limitedBySingleProvider,
      projection: {
        projectedFantasyPoints: consensus.consensusProjectedFantasyPoints,
        median: consensus.consensusProjectedFantasyPoints,
        floor: consensus.minProjection,
        ceiling: consensus.maxProjection,
        confidence: consensus.consensusConfidence,
      },
    };
  }

  const projection = selectProjection({
    projections: player.projections,
    playerId: player.id,
    context: projectionContext,
  });

  if (!projection) {
    return getMissingOptimizerProjectionInput("SELECTED_PROVIDER");
  }

  const projectedPoints = calculateFantasyPoints({
    projectedStats: projection.projectedStats,
    rules: normalizedRules,
    position: player.position,
  }).fantasyPoints;
  const adjustedConfidence = getAdjustedProjectionConfidence({
    adjustedPoints: projectedPoints,
    projection,
  });

  return {
    projectedPoints,
    projectedFloor: adjustedConfidence.floor,
    projectedCeiling: adjustedConfidence.ceiling,
    confidence: projection.confidence ?? null,
    hasProjection: true,
    rawProjectedPoints: projection.projectedFantasyPoints ?? 0,
    projectionMode: "SELECTED_PROVIDER",
    projection: {
      projectedFantasyPoints: projection.projectedFantasyPoints,
      median: projection.median,
      floor: projection.floor,
      ceiling: projection.ceiling,
      confidence: projection.confidence,
    },
  };
}

function getMissingOptimizerProjectionInput(
  projectionMode: ProjectionMode,
): Omit<OptimizerCandidate, "player"> {
  return {
    projectedPoints: 0,
    projectedFloor: 0,
    projectedCeiling: 0,
    confidence: null,
    hasProjection: false,
    rawProjectedPoints: 0,
    projectionMode,
  };
}

function getCandidateConfidenceAnalysis(candidate: {
  adjustedPoints: number;
  projectedFloor?: number | null;
  projectedCeiling?: number | null;
  confidence?: number | null;
  hasProjection?: boolean;
}) {
  return analyzeProjectionConfidence({
    projectedPoints: candidate.adjustedPoints,
    floor: candidate.projectedFloor,
    median: candidate.adjustedPoints,
    ceiling: candidate.projectedCeiling,
    confidence: candidate.confidence,
    hasProjection: candidate.hasProjection,
  });
}

function getLineupConfidence(
  starters: Array<{
    adjustedPoints: number;
    projectedFloor?: number | null;
    projectedCeiling?: number | null;
    confidence?: number | null;
    hasProjection?: boolean;
  }>,
) {
  if (starters.length === 0) {
    return analyzeProjectionConfidence({
      projectedPoints: 0,
      hasProjection: false,
    });
  }

  const starterConfidence = starters.map(getCandidateConfidenceAnalysis);
  const projectedPoints = roundProjection(
    starters.reduce((sum, starter) => sum + starter.adjustedPoints, 0),
  );
  const floor = roundProjection(
    starterConfidence.reduce((sum, confidence) => sum + confidence.floor, 0),
  );
  const ceiling = roundProjection(
    starterConfidence.reduce((sum, confidence) => sum + confidence.ceiling, 0),
  );
  const confidence = roundProjection(
    starterConfidence.reduce(
      (sum, confidenceAnalysis) =>
        sum + confidenceAnalysis.confidencePercentage,
      0,
    ) / starterConfidence.length,
  );

  return analyzeProjectionConfidence({
    projectedPoints,
    floor,
    median: projectedPoints,
    ceiling,
    confidence,
    hasProjection: starters.some((starter) => starter.hasProjection),
  });
}

function buildStartSitConfidenceExplanation(
  baseExplanation: string,
  lineupConfidence: ProjectionConfidenceAnalysis,
  projectionContext: ProjectionContext,
  consensusLimitedPlayerCount: number,
) {
  const sentences = [
    getProjectionModeRecommendationSentence(projectionContext),
    baseExplanation,
  ];

  if (lineupConfidence.confidencePercentage > 0) {
    sentences.push(
      `Starter group confidence is ${formatConfidencePercentage(
        lineupConfidence.confidencePercentage,
      )} with ${lineupConfidence.riskLabel.toLowerCase()} risk and ${lineupConfidence.recommendationStrength.toLowerCase()} strength.`,
    );
  }

  if (
    getProjectionMode(projectionContext) === "CONSENSUS" &&
    consensusLimitedPlayerCount > 0
  ) {
    sentences.push(
      `Consensus is based on one provider only for ${consensusLimitedPlayerCount} projected player${
        consensusLimitedPlayerCount === 1 ? "" : "s"
      }.`,
    );
  }

  return sentences.join(" ");
}

function normalizeScoringRules(
  scoringRules: Array<{
    statKey: string;
    points: number;
    position: string | null;
    description: string | null;
  }>,
): LeagueScoringRule[] {
  return scoringRules.map((rule) => ({
    statKey: rule.statKey,
    points: rule.points,
    position: (rule.position ?? "ALL") as LeagueScoringRule["position"],
    description: rule.description ?? undefined,
  }));
}

function getBestPlayerDisplayName(player: {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  fullName: string;
  externalIdentities?: Array<{
    externalId: string;
  }>;
}) {
  const fullName = sanitizePlayerDisplayPart(player.fullName);

  if (fullName) {
    return fullName;
  }

  const firstLast = [player.firstName, player.lastName]
    .map(sanitizePlayerDisplayPart)
    .filter(Boolean)
    .join(" ");

  return firstLast || player.externalIdentities?.[0]?.externalId || player.id;
}

function getExternalIdentityValue(
  identities: Array<{
    provider: string;
    externalId: string;
  }>,
  preferredProvider: string,
) {
  return (
    identities.find((identity) => identity.provider === preferredProvider)
      ?.externalId ?? identities[0]?.externalId
  );
}

function sanitizePlayerDisplayPart(value?: string | null) {
  if (!value) return undefined;

  const trimmed = value.trim();

  if (!trimmed || trimmed.toLowerCase() === "unknown") {
    return undefined;
  }

  return trimmed;
}

function formatDate(value: Date | null) {
  if (!value) return "Not recorded";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

function getTimestamp(value?: Date | null) {
  return value instanceof Date ? value.getTime() : 0;
}

function formatPoints(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function formatProjectionNumber(value: number | null) {
  return typeof value === "number" ? value.toFixed(2) : "--";
}

function formatConfidence(value: number | null) {
  return typeof value === "number" ? `${Math.round(value * 100)}%` : "--";
}

function formatConfidencePercentage(value: number | null) {
  return typeof value === "number" ? `${Math.round(value)}%` : "--";
}

function formatConsensusScore(value: number | null) {
  return typeof value === "number" ? `${Math.round(value)}%` : "--";
}

function formatProjectionDifference(value: number) {
  if (value === 0) return "0.00";

  return `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
}

function roundProjection(value: number) {
  return Math.round(value * 100) / 100;
}
