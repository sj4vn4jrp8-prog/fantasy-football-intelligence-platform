import Link from "next/link";
import { getPlayerExpertConsensusBreakdown } from "@/knowledge-brain/expert-consensus";
import { getExpertMemoriesForPlayer } from "@/knowledge-brain/expert-memory";
import { getDefaultTargetSeason } from "@/knowledge-brain/freshness";
import {
  getPlayerIntelligenceDirectory,
  getPlayerIntelligenceProfile,
} from "@/knowledge-brain/player-intelligence";
import { getPlayerTrustProfile } from "@/knowledge-brain/trust-engine";
import { getPlayerWeightedConsensusBreakdown } from "@/knowledge-brain/weighted-consensus";

export const dynamic = "force-dynamic";

type PlayerComparePageProps = {
  searchParams: Promise<{
    includeHistorical?: string;
    playerA?: string;
    playerB?: string;
    targetSeason?: string;
  }>;
};

type CompareProfile = NonNullable<
  Awaited<ReturnType<typeof getPlayerIntelligenceProfile>>
>;
type RawConsensus = Awaited<
  ReturnType<typeof getPlayerExpertConsensusBreakdown>
>["row"];
type WeightedConsensus = Awaited<
  ReturnType<typeof getPlayerWeightedConsensusBreakdown>
>["row"];
type PlayerTrust = Awaited<ReturnType<typeof getPlayerTrustProfile>>;
type ExpertMemory = Awaited<ReturnType<typeof getExpertMemoriesForPlayer>>[number];

type PlayerCompareData = {
  profile: CompareProfile;
  rawConsensus: RawConsensus;
  weightedConsensus: WeightedConsensus;
  trustProfile: PlayerTrust;
  expertMemories: ExpertMemory[];
};

export default async function PlayerComparePage({
  searchParams,
}: PlayerComparePageProps) {
  const params = await searchParams;
  const targetSeason = params.targetSeason ?? String(getDefaultTargetSeason());
  const includeHistorical = params.includeHistorical === "true";
  const directory = await getPlayerIntelligenceDirectory({
    targetSeason,
    includeHistorical,
  });
  const selectedPlayerA = params.playerA ?? "";
  const selectedPlayerB = params.playerB ?? "";
  const [playerA, playerB] = await Promise.all([
    selectedPlayerA
      ? getCompareData(selectedPlayerA, { targetSeason, includeHistorical })
      : null,
    selectedPlayerB
      ? getCompareData(selectedPlayerB, { targetSeason, includeHistorical })
      : null,
  ]);
  const edgeRows = playerA && playerB ? buildEdgeRows(playerA, playerB) : [];

  return (
    <main className="min-h-screen bg-stone-50">
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-wrap gap-3">
            <Link
              className="text-sm font-semibold text-emerald-700 hover:text-emerald-900"
              href="/knowledge-brain"
            >
              Back to Knowledge Brain
            </Link>
            <Link
              className="text-sm font-semibold text-zinc-600 hover:text-zinc-950"
              href="/knowledge-brain/players"
            >
              Player Directory
            </Link>
          </div>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-emerald-700">
                Player Compare
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal text-zinc-950 sm:text-4xl">
                Knowledge Brain Player Compare
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
                Compare two players using stored transcript intelligence, expert
                sentiment, raw consensus, weighted consensus, and freshness-aware
                current-season context.
              </p>
            </div>
            <SummaryItem label="Available Players" value={String(directory.players.length)} />
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-5 sm:px-6 lg:px-8">
        <Card title="Compare Players">
          <form
            action="/knowledge-brain/player-compare"
            className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_140px_minmax(0,190px)_auto]"
          >
            <PlayerSelect
              label="Player A"
              name="playerA"
              players={directory.players}
              value={selectedPlayerA}
            />
            <PlayerSelect
              label="Player B"
              name="playerB"
              players={directory.players}
              value={selectedPlayerB}
            />
            <label className="grid gap-1 text-sm font-semibold text-zinc-700">
              Target Season
              <input
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
                defaultValue={targetSeason}
                min="2000"
                name="targetSeason"
                type="number"
              />
            </label>
            <label className="flex items-end gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-semibold text-zinc-700">
              <input
                className="h-4 w-4"
                defaultChecked={includeHistorical}
                name="includeHistorical"
                type="checkbox"
                value="true"
              />
              Include historical
            </label>
            <div className="flex items-end">
              <button
                className="h-10 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800"
                type="submit"
              >
                Compare
              </button>
            </div>
          </form>
        </Card>

        {!selectedPlayerA || !selectedPlayerB ? (
          <EmptyState message="Choose two players to compare their Knowledge Brain intelligence side by side." />
        ) : null}

        {selectedPlayerA === selectedPlayerB && selectedPlayerA ? (
          <EmptyState message="Choose two different players for a meaningful comparison." />
        ) : null}

        {selectedPlayerA && !playerA ? (
          <EmptyState message="Player A could not be loaded for the selected scope." />
        ) : null}

        {selectedPlayerB && !playerB ? (
          <EmptyState message="Player B could not be loaded for the selected scope." />
        ) : null}

            {playerA && playerB && selectedPlayerA !== selectedPlayerB ? (
          <>
            <TrustEdgeSummary playerA={playerA} playerB={playerB} />

            <section className="grid gap-4 xl:grid-cols-2">
              <PlayerColumn data={playerA} sideLabel="Player A" />
              <PlayerColumn data={playerB} sideLabel="Player B" />
            </section>

            <Card title="Edge Summary">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
                      <th className="py-2 pr-4 font-semibold">Category</th>
                      <th className="py-2 pr-4 font-semibold">
                        {playerA.profile.player.fullName}
                      </th>
                      <th className="py-2 pr-4 font-semibold">
                        {playerB.profile.player.fullName}
                      </th>
                      <th className="py-2 font-semibold">Edge</th>
                    </tr>
                  </thead>
                  <tbody>
                    {edgeRows.map((row) => (
                      <tr className="border-b border-zinc-100" key={row.label}>
                        <td className="py-3 pr-4 font-semibold text-zinc-950">
                          {row.label}
                        </td>
                        <td className="py-3 pr-4 text-zinc-700">{row.aValue}</td>
                        <td className="py-3 pr-4 text-zinc-700">{row.bValue}</td>
                        <td className="py-3">
                          <span
                            className={`rounded-md px-2 py-1 text-xs font-semibold ${
                              row.edge === "Even"
                                ? "bg-zinc-100 text-zinc-700"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {row.edge}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <section className="grid gap-4 xl:grid-cols-2">
              <ThemesCard
                bearishThemes={playerA.profile.reasonsForBearishness}
                bullishThemes={playerA.profile.reasonsForBullishness}
                playerName={playerA.profile.player.fullName}
              />
              <ThemesCard
                bearishThemes={playerB.profile.reasonsForBearishness}
                bullishThemes={playerB.profile.reasonsForBullishness}
                playerName={playerB.profile.player.fullName}
              />
            </section>

            <section className="grid gap-4 xl:grid-cols-2">
              <RecentTakesCard data={playerA} />
              <RecentTakesCard data={playerB} />
            </section>

            <Card title="Expert Coverage Comparison">
              <div className="grid gap-3 md:grid-cols-2">
                <CoveragePanel data={playerA} />
                <CoveragePanel data={playerB} />
              </div>
            </Card>
          </>
        ) : null}
      </section>
    </main>
  );
}

async function getCompareData(
  playerId: string,
  filters: {
    targetSeason: string;
    includeHistorical: boolean;
  },
): Promise<PlayerCompareData | null> {
  const [profile, rawConsensus, weightedConsensus] = await Promise.all([
    getPlayerIntelligenceProfile(playerId, filters),
    getPlayerExpertConsensusBreakdown({
      playerId,
      ...filters,
    }),
    getPlayerWeightedConsensusBreakdown({
      playerId,
      ...filters,
    }),
  ]);
  const [trustProfile, expertMemories] = await Promise.all([
    getPlayerTrustProfile(playerId, filters),
    getExpertMemoriesForPlayer(playerId, filters),
  ]);

  if (!profile) return null;

  return {
    profile,
    rawConsensus: rawConsensus.row ?? null,
    weightedConsensus: weightedConsensus.row ?? null,
    trustProfile,
    expertMemories,
  };
}

function PlayerSelect({
  label,
  name,
  players,
  value,
}: {
  label: string;
  name: string;
  players: Array<{
    playerId: string;
    fullName: string;
    position: string;
    team: string | null;
  }>;
  value: string;
}) {
  return (
    <label className="grid gap-1 text-sm font-semibold text-zinc-700">
      {label}
      <select
        className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
        defaultValue={value}
        name={name}
      >
        <option value="">Select player</option>
        {players.map((player) => (
          <option key={player.playerId} value={player.playerId}>
            {player.fullName} - {player.position}
            {player.team ? `, ${player.team}` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

function PlayerColumn({
  data,
  sideLabel,
}: {
  data: PlayerCompareData;
  sideLabel: string;
}) {
  const { profile, rawConsensus, weightedConsensus, trustProfile, expertMemories } = data;
  const topMemory = getTopMemory(expertMemories);

  return (
    <Card title={`${sideLabel}: ${profile.player.fullName}`}>
      <div className="grid gap-4">
        <div>
          <p className="text-sm font-medium text-zinc-600">
            {profile.player.position}
            {profile.player.team ? `, ${profile.player.team}` : ""}
          </p>
          <Link
            className="mt-2 inline-flex text-sm font-semibold text-emerald-700 hover:text-emerald-900"
            href={`/knowledge-brain/players/${profile.player.id}?targetSeason=${profile.filters.targetSeason}${profile.filters.includeHistorical ? "&includeHistorical=true" : ""}`}
          >
            Open full profile
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Metric
            label="Trust Score"
            tone={getTrustTone(trustProfile?.playerTrustScore ?? 0)}
            value={trustProfile ? String(trustProfile.playerTrustScore) : "--"}
          />
          <Metric
            label="Trust Confidence"
            value={trustProfile?.confidenceLabel ?? "No profile"}
          />
          <Metric label="Mentions" value={String(profile.summary.totalMentions)} />
          <Metric label="Experts" value={String(profile.summary.expertCount)} />
          <Metric
            label="Bullish"
            tone="bullish"
            value={String(profile.summary.bullishCount)}
          />
          <Metric
            label="Bearish"
            tone="bearish"
            value={String(profile.summary.bearishCount)}
          />
          <Metric label="Neutral" value={String(profile.summary.neutralCount)} />
          <Metric
            label="Intelligence Score"
            value={`${profile.summary.intelligenceScore} - ${profile.summary.intelligenceLabel}`}
          />
        </div>

        <div className="grid gap-3">
          <SummaryItem
            label="Trust Stance"
            value={trustProfile?.stanceSummary ?? "No trust stance"}
          />
          <SummaryItem
            label="Expert Memory Trend"
            value={topMemory?.memory.opinionTrend ?? "No memory trend"}
          />
          <SummaryItem
            label="Raw Consensus"
            value={rawConsensus?.consensusLabel ?? "No consensus"}
          />
          <SummaryItem
            label="Weighted Consensus"
            value={weightedConsensus?.weightedConsensusLabel ?? "No weighted row"}
          />
          <SummaryItem
            label="Latest Take"
            value={formatDate(profile.summary.latestMentionDate)}
          />
        </div>

        {trustProfile ? (
          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
            <p className="text-sm font-semibold text-zinc-950">
              Trust Breakdown Highlights
            </p>
            <div className="mt-2 grid gap-2">
              {trustProfile.breakdown.dimensions.slice(0, 3).map((dimension) => (
                <div
                  className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
                  key={dimension.key}
                >
                  <span className="font-medium text-zinc-800">
                    {dimension.label}
                  </span>
                  <span className="font-semibold text-zinc-950">
                    {dimension.score}
                  </span>
                </div>
              ))}
            </div>
            {[...trustProfile.lowSampleWarnings, ...trustProfile.disagreementWarnings]
              .slice(0, 2)
              .map((warning) => (
                <p
                  className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-sm text-amber-950"
                  key={warning}
                >
                  {warning}
                </p>
              ))}
          </div>
        ) : (
          <EmptyState message="No Trust Profile is available for this player yet." />
        )}

        {weightedConsensus ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric
              label="Weighted Bullish"
              tone="bullish"
              value={formatNumber(weightedConsensus.weightedBullishScore)}
            />
            <Metric
              label="Weighted Bearish"
              tone="bearish"
              value={formatNumber(weightedConsensus.weightedBearishScore)}
            />
            <Metric
              label="Weighted Neutral"
              value={formatNumber(weightedConsensus.weightedNeutralScore)}
            />
          </div>
        ) : (
          <EmptyState message="No weighted consensus row is available for this player yet." />
        )}

        {!profile.filters.includeHistorical && profile.excludedHistoricalCount > 0 ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            {profile.excludedHistoricalCount} stale, historical, or archived
            take{profile.excludedHistoricalCount === 1 ? "" : "s"} excluded.
          </p>
        ) : null}

        {rawConsensus?.earlySignal ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            Early signal only: {rawConsensus.earlySignal.reason}
          </p>
        ) : null}
      </div>
    </Card>
  );
}

function TrustEdgeSummary({
  playerA,
  playerB,
}: {
  playerA: PlayerCompareData;
  playerB: PlayerCompareData;
}) {
  const trustA = playerA.trustProfile?.playerTrustScore ?? 0;
  const trustB = playerB.trustProfile?.playerTrustScore ?? 0;
  const edge =
    trustA === trustB
      ? "Even"
      : trustA > trustB
        ? playerA.profile.player.fullName
        : playerB.profile.player.fullName;
  const stronger =
    trustA === trustB
      ? null
      : trustA > trustB
        ? playerA
        : playerB;

  return (
    <Card title="Trusted Support Edge">
      <div className="grid gap-3 md:grid-cols-[220px_220px_minmax(0,1fr)]">
        <SummaryItem
          label={playerA.profile.player.fullName}
          value={
            playerA.trustProfile
              ? `Trust ${playerA.trustProfile.playerTrustScore} - ${playerA.trustProfile.confidenceLabel}`
              : "No trust profile"
          }
        />
        <SummaryItem
          label={playerB.profile.player.fullName}
          value={
            playerB.trustProfile
              ? `Trust ${playerB.trustProfile.playerTrustScore} - ${playerB.trustProfile.confidenceLabel}`
              : "No trust profile"
          }
        />
        <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
          <p className="text-xs font-semibold uppercase text-zinc-500">
            Stronger Trusted Support
          </p>
          <p className="mt-1 font-semibold text-zinc-950">{edge}</p>
          <p className="mt-2 text-sm text-zinc-600">
            {stronger?.trustProfile
              ? `${stronger.profile.player.fullName} has the stronger Trust Score because the current Trust Engine blend gives more support to ${stronger.trustProfile.breakdown.dimensions
                  .slice()
                  .sort((a, b) => b.score - a.score)[0]?.label.toLowerCase() ?? "its evidence profile"}.`
              : "Neither player has enough approved evidence to create a clear trust edge yet."}
          </p>
        </div>
      </div>
    </Card>
  );
}

function ThemesCard({
  playerName,
  bullishThemes,
  bearishThemes,
}: {
  playerName: string;
  bullishThemes: Array<{ key: string; label: string; count: number }>;
  bearishThemes: Array<{ key: string; label: string; count: number }>;
}) {
  return (
    <Card title={`${playerName}: Themes & Concerns`}>
      <div className="grid gap-4 md:grid-cols-2">
        <ThemeList
          emptyMessage="No bullish themes found."
          themes={bullishThemes}
          title="Bullish Themes"
          tone="bullish"
        />
        <ThemeList
          emptyMessage="No bearish concerns found."
          themes={bearishThemes}
          title="Bearish Concerns"
          tone="bearish"
        />
      </div>
    </Card>
  );
}

function ThemeList({
  title,
  themes,
  emptyMessage,
  tone,
}: {
  title: string;
  themes: Array<{ key: string; label: string; count: number }>;
  emptyMessage: string;
  tone: "bullish" | "bearish";
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-zinc-950">{title}</h3>
      {themes.length > 0 ? (
        <div className="mt-2 grid gap-2">
          {themes.map((theme) => (
            <div
              className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
              key={theme.key}
            >
              <span className="font-medium text-zinc-800">{theme.label}</span>
              <span
                className={`rounded-md px-2 py-1 text-xs font-semibold ${
                  tone === "bullish"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {theme.count}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-2">
          <EmptyState message={emptyMessage} />
        </div>
      )}
    </div>
  );
}

function RecentTakesCard({ data }: { data: PlayerCompareData }) {
  const takes = data.profile.recentTakes.slice(0, 5);

  return (
    <Card title={`${data.profile.player.fullName}: Recent Takes`}>
      {takes.length > 0 ? (
        <div className="grid gap-3">
          {takes.map((take) => (
            <div
              className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm"
              key={take.id}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-zinc-950">
                  {take.expertName}
                </span>
                <span
                  className={`rounded-md px-2 py-1 text-xs font-semibold ${getSentimentTone(
                    take.sentiment,
                  )}`}
                >
                  {formatEnumLabel(take.sentiment)}
                </span>
                <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-zinc-700">
                  {formatEnumLabel(take.takeType)}
                </span>
              </div>
              <p className="mt-2 font-semibold text-zinc-950">{take.summary}</p>
              <p className="mt-1 text-zinc-600">{take.excerpt}</p>
              <p className="mt-2 text-xs text-zinc-500">
                {take.sourceTitle} - {formatDate(take.publishedAt ?? take.createdAt)}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState message="No recent takes found for this player." />
      )}
    </Card>
  );
}

function CoveragePanel({ data }: { data: PlayerCompareData }) {
  const expertsWithMentions = data.profile.expertBreakdown.filter(
    (expert) => expert.mentionCount > 0,
  );

  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
      <h3 className="font-semibold text-zinc-950">
        {data.profile.player.fullName}
      </h3>
      <p className="mt-1 text-sm text-zinc-600">
        {expertsWithMentions.length} expert
        {expertsWithMentions.length === 1 ? "" : "s"} with extracted takes.
      </p>
      {expertsWithMentions.length > 0 ? (
        <div className="mt-3 grid gap-2">
          {expertsWithMentions.map((expert) => (
            <div
              className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
              key={expert.expertId}
            >
              <span className="font-medium text-zinc-800">
                {expert.expertName}
              </span>
              <span className="text-zinc-600">
                {expert.mentionCount} mention
                {expert.mentionCount === 1 ? "" : "s"} -{" "}
                {formatEnumLabel(expert.sentiment)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3">
          <EmptyState message="No expert coverage in the selected scope." />
        </div>
      )}
    </div>
  );
}

function buildEdgeRows(playerA: PlayerCompareData, playerB: PlayerCompareData) {
  const nameA = playerA.profile.player.fullName;
  const nameB = playerB.profile.player.fullName;
  const summaryA = playerA.profile.summary;
  const summaryB = playerB.profile.summary;
  const weightedA = playerA.weightedConsensus;
  const weightedB = playerB.weightedConsensus;

  return [
    buildHigherIsBetterEdge("Trust Score", nameA, nameB, {
      a: playerA.trustProfile?.playerTrustScore ?? 0,
      b: playerB.trustProfile?.playerTrustScore ?? 0,
      format: String,
    }),
    buildHigherIsBetterEdge("Trust Evidence Count", nameA, nameB, {
      a: playerA.trustProfile?.evidenceCount ?? 0,
      b: playerB.trustProfile?.evidenceCount ?? 0,
      format: String,
    }),
    buildHigherIsBetterEdge("Intelligence Score", nameA, nameB, {
      a: summaryA.intelligenceScore,
      b: summaryB.intelligenceScore,
      format: String,
    }),
    buildHigherIsBetterEdge("Raw Mention Volume", nameA, nameB, {
      a: summaryA.totalMentions,
      b: summaryB.totalMentions,
      format: String,
    }),
    buildHigherIsBetterEdge("Expert Coverage", nameA, nameB, {
      a: summaryA.expertCount,
      b: summaryB.expertCount,
      format: String,
    }),
    buildHigherIsBetterEdge("Bullish Mentions", nameA, nameB, {
      a: summaryA.bullishCount,
      b: summaryB.bullishCount,
      format: String,
    }),
    buildLowerIsBetterEdge("Bearish Mentions", nameA, nameB, {
      a: summaryA.bearishCount,
      b: summaryB.bearishCount,
      format: String,
    }),
    buildHigherIsBetterEdge("Weighted Bullish Score", nameA, nameB, {
      a: weightedA?.weightedBullishScore ?? 0,
      b: weightedB?.weightedBullishScore ?? 0,
      format: formatNumber,
    }),
    buildLowerIsBetterEdge("Weighted Bearish Score", nameA, nameB, {
      a: weightedA?.weightedBearishScore ?? 0,
      b: weightedB?.weightedBearishScore ?? 0,
      format: formatNumber,
    }),
    buildHigherIsBetterEdge("Weighted Confidence", nameA, nameB, {
      a: weightedA?.trustWeightedConfidence ?? 0,
      b: weightedB?.trustWeightedConfidence ?? 0,
      format: (value) => `${value}%`,
    }),
    buildHigherIsBetterEdge("Latest Take Recency", nameA, nameB, {
      a: getDateTime(summaryA.latestMentionDate),
      b: getDateTime(summaryB.latestMentionDate),
      format: (value) => (value > 0 ? formatDate(new Date(value)) : "--"),
    }),
  ];
}

function getTopMemory(memories: ExpertMemory[]) {
  return memories
    .slice()
    .sort(
      (memoryA, memoryB) =>
        memoryB.memory.convictionScore - memoryA.memory.convictionScore ||
        memoryB.timeline.points.length - memoryA.timeline.points.length,
    )[0];
}

function getTrustTone(score: number): "bullish" | "bearish" | undefined {
  if (score >= 70) return "bullish";
  if (score > 0 && score < 45) return "bearish";

  return undefined;
}

function buildHigherIsBetterEdge(
  label: string,
  nameA: string,
  nameB: string,
  values: {
    a: number;
    b: number;
    format: (value: number) => string;
  },
) {
  return {
    label,
    aValue: values.format(values.a),
    bValue: values.format(values.b),
    edge: values.a === values.b ? "Even" : values.a > values.b ? nameA : nameB,
  };
}

function buildLowerIsBetterEdge(
  label: string,
  nameA: string,
  nameB: string,
  values: {
    a: number;
    b: number;
    format: (value: number) => string;
  },
) {
  return {
    label,
    aValue: values.format(values.a),
    bValue: values.format(values.b),
    edge: values.a === values.b ? "Even" : values.a < values.b ? nameA : nameB,
  };
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

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white px-3 py-2">
      <p className="text-xs font-semibold uppercase text-zinc-500">{label}</p>
      <p className="mt-1 font-semibold text-zinc-950">{value}</p>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "bullish" | "bearish";
}) {
  const toneClass =
    tone === "bullish"
      ? "text-emerald-700"
      : tone === "bearish"
        ? "text-red-700"
        : "text-zinc-950";

  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
      <p className="text-xs font-semibold uppercase text-zinc-500">{label}</p>
      <p className={`mt-1 font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="rounded-md border border-dashed border-zinc-300 bg-white p-4 text-sm text-zinc-500">
      {message}
    </p>
  );
}

function formatDate(value: Date | null) {
  if (!value) return "--";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatNumber(value: number) {
  return value.toFixed(2).replace(/\.00$/, "");
}

function getDateTime(value: Date | null) {
  return value ? value.getTime() : 0;
}

function getSentimentTone(value: string) {
  if (value.includes("BULLISH") || value.includes("Bullish")) {
    return "bg-emerald-100 text-emerald-800";
  }

  if (value.includes("BEARISH") || value.includes("Bearish")) {
    return "bg-red-100 text-red-800";
  }

  return "bg-zinc-100 text-zinc-700";
}
