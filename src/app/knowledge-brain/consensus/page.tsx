import Link from "next/link";
import { getExpertConsensusDashboard } from "@/knowledge-brain/expert-consensus";
import { getTrustEngineDashboard } from "@/knowledge-brain/trust-engine";
import { getWeightedConsensusDashboard } from "@/knowledge-brain/weighted-consensus";

export const dynamic = "force-dynamic";

type ExpertConsensusDashboard = Awaited<
  ReturnType<typeof getExpertConsensusDashboard>
>;
type ConsensusRow = ExpertConsensusDashboard["rows"][number];
type WeightedConsensusDashboard = Awaited<
  ReturnType<typeof getWeightedConsensusDashboard>
>;
type WeightedConsensusRow = WeightedConsensusDashboard["rows"][number];
type TrustDashboard = Awaited<ReturnType<typeof getTrustEngineDashboard>>;
type PlayerTrustProfile = TrustDashboard["playerProfiles"][number];

type ExpertConsensusPageProps = {
  searchParams: Promise<{
    consensusLabel?: string;
    includeHistorical?: string;
    position?: string;
    targetSeason?: string;
    team?: string;
  }>;
};

export default async function ExpertConsensusPage({
  searchParams,
}: ExpertConsensusPageProps) {
  const filters = await searchParams;
  const dashboard = await getExpertConsensusDashboard({
    consensusLabel: filters.consensusLabel,
    includeHistorical: filters.includeHistorical === "true",
    position: filters.position,
    targetSeason: filters.targetSeason,
    team: filters.team,
  });
  const weightedDashboard = await getWeightedConsensusDashboard({
    includeHistorical: filters.includeHistorical === "true",
    position: filters.position,
    targetSeason: filters.targetSeason,
    team: filters.team,
  });
  const trustDashboard = await getTrustEngineDashboard({
    includeHistorical: filters.includeHistorical === "true",
    targetSeason: filters.targetSeason,
  });
  const trustRows = filterTrustRows(trustDashboard.playerProfiles, {
    position: filters.position,
    team: filters.team,
  });

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
              Player Intelligence
            </Link>
            <Link
              className="text-sm font-semibold text-zinc-600 hover:text-zinc-950"
              href="/knowledge-brain/trust"
            >
              Trust Engine
            </Link>
          </div>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-emerald-700">
                Expert Consensus
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal text-zinc-950 sm:text-4xl">
                Player Opinion Matrix
              </h1>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <SummaryItem label="Players" value={String(dashboard.rows.length)} />
              <SummaryItem
                label="Weighted"
                value={String(weightedDashboard.rows.length)}
              />
              <SummaryItem
                label="Trust Profiles"
                value={String(trustRows.length)}
              />
              <SummaryItem
                label="Season"
                value={String(dashboard.filters.targetSeason)}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-5 sm:px-6 lg:px-8">
        <Card title="Filters">
          <form
            action="/knowledge-brain/consensus"
            className="grid gap-3 md:grid-cols-[120px_140px_140px_180px_minmax(0,1fr)_auto]"
          >
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
              Position
              <select
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
                defaultValue={dashboard.filters.position ?? ""}
                name="position"
              >
                <option value="">All</option>
                {dashboard.positionOptions.map((position) => (
                  <option key={position} value={position}>
                    {position}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold text-zinc-700">
              NFL Team
              <select
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
                defaultValue={dashboard.filters.team ?? ""}
                name="team"
              >
                <option value="">All</option>
                {dashboard.teamOptions.map((team) => (
                  <option key={team} value={team}>
                    {team}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold text-zinc-700">
              Consensus
              <select
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
                defaultValue={dashboard.filters.consensusLabel ?? ""}
                name="consensusLabel"
              >
                <option value="">All</option>
                {dashboard.consensusLabelOptions.map((label) => (
                  <option key={label} value={label}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-end gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-semibold text-zinc-700">
              <input
                className="h-4 w-4"
                defaultChecked={dashboard.filters.includeHistorical}
                name="includeHistorical"
                type="checkbox"
                value="true"
              />
              Historical
            </label>
            <div className="flex items-end gap-2">
              <button
                className="h-10 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800"
                type="submit"
              >
                Apply
              </button>
              <Link
                className="inline-flex h-10 items-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
                href="/knowledge-brain/consensus"
              >
                Reset
              </Link>
            </div>
          </form>
        </Card>

        <Card title="Consensus Guide">
          <div className="grid gap-3 text-sm text-zinc-600 md:grid-cols-4">
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
              <h3 className="font-semibold text-zinc-950">Trust Score</h3>
              <p className="mt-1">
                The user-facing measure that blends expert reliability,
                evidence depth, disagreement, freshness, and Expert Memory.
              </p>
            </div>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
              <h3 className="font-semibold text-zinc-950">True Consensus</h3>
              <p className="mt-1">
                Raw consensus shows what experts say. It requires at least two
                experts and at least three opinion signals.
              </p>
            </div>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
              <h3 className="font-semibold text-zinc-950">Weighted Consensus</h3>
              <p className="mt-1">
                Weighted consensus remains an internal Trust Engine signal. It
                should explain part of Trust Score, not replace it.
              </p>
            </div>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
              <h3 className="font-semibold text-zinc-950">Early Signal</h3>
              <p className="mt-1">
                Requires at least two experts and at least three opinion signals.
                Low-sample signals stay separate so small samples are useful but
                not overstated.
              </p>
            </div>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
              <h3 className="font-semibold text-zinc-950">Freshness</h3>
              <p className="mt-1">
                Current views exclude stale, historical, and archived content by
                default. Use the historical toggle when you want all matching
                transcript evidence.
              </p>
            </div>
          </div>
        </Card>

        <section className="grid gap-4 xl:grid-cols-4">
          <PlayerTrustWidget
            emptyMessage="No trusted player signals yet."
            players={trustRows
              .slice()
              .sort(
                (playerA, playerB) =>
                  playerB.playerTrustScore - playerA.playerTrustScore ||
                  playerB.evidenceCount - playerA.evidenceCount,
              )
              .slice(0, 5)}
            title="Strongest Trust Scores"
          />
          <PlayerTrustWidget
            emptyMessage="No high-trust split rows yet."
            players={trustRows
              .filter(
                (player) =>
                  player.playerTrustScore >= 55 &&
                  player.disagreementWarnings.length > 0,
              )
              .sort(
                (playerA, playerB) =>
                  playerB.playerTrustScore - playerA.playerTrustScore,
              )
              .slice(0, 5)}
            title="Trusted But Split"
          />
          <PlayerTrustWidget
            emptyMessage="No low-confidence profiles yet."
            players={trustRows
              .filter((player) => player.confidenceLabel === "Low")
              .sort(
                (playerA, playerB) =>
                  playerB.playerTrustScore - playerA.playerTrustScore,
              )
              .slice(0, 5)}
            title="Low-Confidence Trust"
          />
          <PlayerTrustWidget
            emptyMessage="No Expert Memory signals yet."
            players={trustRows
              .filter(
                (player) =>
                  player.expertMemorySignal.label !== "No expert memory yet",
              )
              .sort(
                (playerA, playerB) =>
                  playerB.expertMemorySignal.score -
                  playerA.expertMemorySignal.score,
              )
              .slice(0, 5)}
            title="Expert Memory Support"
          />
        </section>

        <Card title="Trust Score Profiles">
          {trustRows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
                    <th className="py-2 pr-4 font-semibold">Player</th>
                    <th className="py-2 pr-4 font-semibold">Pos</th>
                    <th className="py-2 pr-4 font-semibold">Team</th>
                    <th className="py-2 pr-4 font-semibold">Trust Score</th>
                    <th className="py-2 pr-4 font-semibold">Confidence</th>
                    <th className="py-2 pr-4 font-semibold">Stance</th>
                    <th className="py-2 pr-4 font-semibold">Evidence</th>
                    <th className="py-2 pr-4 font-semibold">Latest</th>
                    <th className="py-2 font-semibold">Warnings</th>
                  </tr>
                </thead>
                <tbody>
                  {trustRows
                    .slice()
                    .sort(
                      (playerA, playerB) =>
                        playerB.playerTrustScore - playerA.playerTrustScore,
                    )
                    .map((profile) => (
                      <tr
                        className="border-b border-zinc-100"
                        key={profile.playerId}
                      >
                        <td className="py-3 pr-4 font-semibold">
                          <Link
                            className="text-emerald-700 hover:text-emerald-900"
                            href={`/knowledge-brain/players/${profile.playerId}?targetSeason=${trustDashboard.filters.targetSeason}${trustDashboard.filters.includeHistorical ? "&includeHistorical=true" : ""}`}
                          >
                            {profile.playerName}
                          </Link>
                        </td>
                        <td className="py-3 pr-4 text-zinc-700">
                          {profile.position}
                        </td>
                        <td className="py-3 pr-4 text-zinc-700">
                          {profile.team ?? "--"}
                        </td>
                        <td className="py-3 pr-4 font-semibold text-zinc-950">
                          {profile.playerTrustScore}
                        </td>
                        <td className="py-3 pr-4">
                          <TrustBadge label={profile.confidenceLabel} />
                        </td>
                        <td className="py-3 pr-4">
                          <ConsensusBadge label={profile.stanceSummary} />
                        </td>
                        <td className="py-3 pr-4 text-zinc-700">
                          {profile.evidenceCount}
                        </td>
                        <td className="py-3 pr-4 text-zinc-700">
                          {formatDate(profile.latestEvidenceDate)}
                        </td>
                        <td className="py-3 text-zinc-700">
                          {[
                            ...profile.lowSampleWarnings,
                            ...profile.disagreementWarnings,
                          ][0] ?? "No major warning"}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState message="No Trust Score profiles match those filters yet." />
          )}
        </Card>

        <section className="grid gap-4 xl:grid-cols-4">
          <ConsensusWidget
            emptyMessage="No consensus rows yet."
            rows={dashboard.widgets.strongestConsensus}
            title="Strongest Expert Consensus"
          />
          <ConsensusWidget
            emptyMessage="No split players yet."
            rows={dashboard.widgets.mostDivisivePlayers}
            title="Most Divisive Players"
          />
          <ConsensusWidget
            emptyMessage="No bullish agreement yet."
            rows={dashboard.widgets.mostBullishAgreement}
            title="Most Bullish Expert Agreement"
          />
          <ConsensusWidget
            emptyMessage="No bearish agreement yet."
            rows={dashboard.widgets.mostBearishAgreement}
            title="Most Bearish Expert Agreement"
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-4">
          <WeightedConsensusWidget
            emptyMessage="No trusted consensus rows yet."
            rows={weightedDashboard.widgets.strongestTrustedConsensus}
            title="Strongest Trusted Consensus"
          />
          <WeightedConsensusWidget
            emptyMessage="No trusted bullish rows yet."
            rows={weightedDashboard.widgets.mostTrustedBullish}
            title="Trusted Bullish"
          />
          <WeightedConsensusWidget
            emptyMessage="No trusted bearish rows yet."
            rows={weightedDashboard.widgets.mostTrustedBearish}
            title="Trusted Bearish"
          />
          <WeightedConsensusWidget
            emptyMessage="No weighted divisive rows yet."
            rows={weightedDashboard.widgets.mostDivisiveWeighted}
            title="Weighted Divisive"
          />
        </section>

        <Card title="Weighted Consensus">
          {weightedDashboard.defaultWeightNotice ? (
            <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
              {weightedDashboard.defaultWeightNotice}
            </p>
          ) : (
            <p className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
              {weightedDashboard.gradedExpertCount} expert
              {weightedDashboard.gradedExpertCount === 1 ? "" : "s"} have
              graded accuracy contributing to trust weights for this season.
            </p>
          )}
          {weightedDashboard.rows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1320px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
                    <th className="py-2 pr-4 font-semibold">Player</th>
                    <th className="py-2 pr-4 font-semibold">Pos</th>
                    <th className="py-2 pr-4 font-semibold">Team</th>
                    <th className="py-2 pr-4 font-semibold">Raw</th>
                    <th className="py-2 pr-4 font-semibold">Weighted</th>
                    <th className="py-2 pr-4 font-semibold">Experts</th>
                    <th className="py-2 pr-4 font-semibold">Bullish Wt</th>
                    <th className="py-2 pr-4 font-semibold">Bearish Wt</th>
                    <th className="py-2 pr-4 font-semibold">Neutral Wt</th>
                    <th className="py-2 pr-4 font-semibold">Agreement</th>
                    <th className="py-2 pr-4 font-semibold">Confidence</th>
                    <th className="py-2 font-semibold">Top Weighted Experts</th>
                  </tr>
                </thead>
                <tbody>
                  {weightedDashboard.rows.map((row) => (
                    <tr className="border-b border-zinc-100" key={row.playerId}>
                      <td className="py-3 pr-4 font-semibold">
                        <Link
                          className="text-emerald-700 hover:text-emerald-900"
                          href={`/knowledge-brain/players/${row.playerId}?targetSeason=${weightedDashboard.filters.targetSeason}${weightedDashboard.filters.includeHistorical ? "&includeHistorical=true" : ""}`}
                        >
                          {row.playerName}
                        </Link>
                      </td>
                      <td className="py-3 pr-4 text-zinc-700">{row.position}</td>
                      <td className="py-3 pr-4 text-zinc-700">
                        {row.team ?? "--"}
                      </td>
                      <td className="py-3 pr-4">
                        <ConsensusBadge label={row.rawConsensusLabel} />
                      </td>
                      <td className="py-3 pr-4">
                        <WeightedConsensusBadge
                          label={row.weightedConsensusLabel}
                        />
                      </td>
                      <td className="py-3 pr-4 text-zinc-700">
                        {row.totalExperts}
                      </td>
                      <td className="py-3 pr-4 text-emerald-700">
                        {formatScore(row.weightedBullishScore)}
                      </td>
                      <td className="py-3 pr-4 text-red-700">
                        {formatScore(row.weightedBearishScore)}
                      </td>
                      <td className="py-3 pr-4 text-zinc-700">
                        {formatScore(row.weightedNeutralScore)}
                      </td>
                      <td className="py-3 pr-4 text-zinc-700">
                        {row.weightedAgreementScore}%
                      </td>
                      <td className="py-3 pr-4 text-zinc-700">
                        {row.trustWeightedConfidence}%
                      </td>
                      <td className="py-3 text-zinc-700">
                        {formatTopWeightedExperts(row)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState message="No weighted consensus rows match those filters yet." />
          )}
        </Card>

        <Card title="Early Signals">
          {dashboard.earlySignals.all.length > 0 ? (
            <div className="grid gap-4">
              <EarlySignalSection
                emptyMessage="No low-sample bullish leans match these filters."
                rows={dashboard.earlySignals.emergingBullish}
                title="Emerging Bullish Signals"
              />
              <EarlySignalSection
                emptyMessage="No low-sample bearish leans match these filters."
                rows={dashboard.earlySignals.emergingBearish}
                title="Emerging Bearish Signals"
              />
              <EarlySignalSection
                emptyMessage="No neutral low-sample rows need more coverage right now."
                rows={dashboard.earlySignals.needsMoreExpertCoverage}
                title="Needs More Expert Coverage"
              />
            </div>
          ) : (
            <EmptyState message="No low-sample early signals match these filters yet." />
          )}
        </Card>

        <Card title="Raw Expert Consensus">
          {dashboard.rows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
                    <th className="py-2 pr-4 font-semibold">Player</th>
                    <th className="py-2 pr-4 font-semibold">Pos</th>
                    <th className="py-2 pr-4 font-semibold">Team</th>
                    <th className="py-2 pr-4 font-semibold">Experts</th>
                    <th className="py-2 pr-4 font-semibold">Bullish</th>
                    <th className="py-2 pr-4 font-semibold">Bearish</th>
                    <th className="py-2 pr-4 font-semibold">Neutral</th>
                    <th className="py-2 pr-4 font-semibold">Consensus</th>
                    <th className="py-2 pr-4 font-semibold">Agreement</th>
                    <th className="py-2 font-semibold">Latest</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.rows.map((row) => (
                    <tr className="border-b border-zinc-100" key={row.playerId}>
                      <td className="py-3 pr-4 font-semibold">
                        <Link
                          className="text-emerald-700 hover:text-emerald-900"
                          href={`/knowledge-brain/players/${row.playerId}?targetSeason=${dashboard.filters.targetSeason}${dashboard.filters.includeHistorical ? "&includeHistorical=true" : ""}`}
                        >
                          {row.playerName}
                        </Link>
                      </td>
                      <td className="py-3 pr-4 text-zinc-700">{row.position}</td>
                      <td className="py-3 pr-4 text-zinc-700">
                        {row.team ?? "--"}
                      </td>
                      <td className="py-3 pr-4 text-zinc-700">
                        {row.totalExperts}
                      </td>
                      <td className="py-3 pr-4 text-emerald-700">
                        {row.bullishExperts}
                      </td>
                      <td className="py-3 pr-4 text-red-700">
                        {row.bearishExperts}
                      </td>
                      <td className="py-3 pr-4 text-zinc-700">
                        {row.neutralExperts}
                      </td>
                      <td className="py-3 pr-4">
                        <ConsensusBadge label={row.consensusLabel} />
                      </td>
                      <td className="py-3 pr-4 text-zinc-700">
                        {row.agreementScore}%
                      </td>
                      <td className="py-3 text-zinc-700">
                        {formatDate(row.latestTakeDate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState message="No expert consensus rows match those filters yet." />
          )}
        </Card>
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

function ConsensusWidget({
  title,
  rows,
  emptyMessage,
}: {
  title: string;
  rows: Array<{
    playerId: string;
    playerName: string;
    position: string;
    team: string | null;
    consensusLabel: string;
    agreementScore: number;
    totalExperts: number;
  }>;
  emptyMessage: string;
}) {
  return (
    <Card title={title}>
      {rows.length > 0 ? (
        <div className="grid gap-2">
          {rows.map((row) => (
            <Link
              className="rounded-md border border-zinc-200 bg-zinc-50 p-3 transition hover:border-emerald-200 hover:bg-emerald-50"
              href={`/knowledge-brain/players/${row.playerId}`}
              key={row.playerId}
            >
              <p className="font-semibold text-zinc-950">{row.playerName}</p>
              <p className="mt-1 text-sm text-zinc-600">
                {row.position}
                {row.team ? `, ${row.team}` : ""} - {row.totalExperts} expert
                {row.totalExperts === 1 ? "" : "s"}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <ConsensusBadge label={row.consensusLabel} />
                <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-zinc-700">
                  {row.agreementScore}%
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState message={emptyMessage} />
      )}
    </Card>
  );
}

function WeightedConsensusWidget({
  title,
  rows,
  emptyMessage,
}: {
  title: string;
  rows: WeightedConsensusRow[];
  emptyMessage: string;
}) {
  return (
    <Card title={title}>
      {rows.length > 0 ? (
        <div className="grid gap-2">
          {rows.map((row) => (
            <Link
              className="rounded-md border border-zinc-200 bg-zinc-50 p-3 transition hover:border-emerald-200 hover:bg-emerald-50"
              href={`/knowledge-brain/players/${row.playerId}`}
              key={row.playerId}
            >
              <p className="font-semibold text-zinc-950">{row.playerName}</p>
              <p className="mt-1 text-sm text-zinc-600">
                {row.position}
                {row.team ? `, ${row.team}` : ""} - {row.totalExperts} expert
                {row.totalExperts === 1 ? "" : "s"}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <WeightedConsensusBadge label={row.weightedConsensusLabel} />
                <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-zinc-700">
                  {row.weightedAgreementScore}%
                </span>
                <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-zinc-700">
                  Confidence {row.trustWeightedConfidence}%
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState message={emptyMessage} />
      )}
    </Card>
  );
}

function PlayerTrustWidget({
  title,
  players,
  emptyMessage,
}: {
  title: string;
  players: PlayerTrustProfile[];
  emptyMessage: string;
}) {
  return (
    <Card title={title}>
      {players.length > 0 ? (
        <div className="grid gap-2">
          {players.map((player) => (
            <Link
              className="rounded-md border border-zinc-200 bg-zinc-50 p-3 transition hover:border-emerald-200 hover:bg-emerald-50"
              href={`/knowledge-brain/players/${player.playerId}`}
              key={player.playerId}
            >
              <p className="font-semibold text-zinc-950">{player.playerName}</p>
              <p className="mt-1 text-sm text-zinc-600">
                {player.position}
                {player.team ? `, ${player.team}` : ""} - Trust{" "}
                {player.playerTrustScore}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <TrustBadge label={player.confidenceLabel} />
                <ConsensusBadge label={player.stanceSummary} />
                <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-zinc-700">
                  Evidence {player.evidenceCount}
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState message={emptyMessage} />
      )}
    </Card>
  );
}

function EarlySignalSection({
  title,
  rows,
  emptyMessage,
}: {
  title: string;
  rows: ConsensusRow[];
  emptyMessage: string;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-semibold text-zinc-950">{title}</h3>
        <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-600">
          {rows.length}
        </span>
      </div>
      {rows.length > 0 ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {rows.map((row) => (
            <EarlySignalCard key={row.playerId} row={row} />
          ))}
        </div>
      ) : (
        <EmptyState message={emptyMessage} />
      )}
    </section>
  );
}

function EarlySignalCard({ row }: { row: ConsensusRow }) {
  const earlySignal = row.earlySignal;
  const latestTake = row.latestTake;
  const experts = row.expertBreakdown
    .map((expert) => expert.expertName)
    .join(", ");

  return (
    <Link
      className="rounded-md border border-zinc-200 bg-zinc-50 p-4 transition hover:border-emerald-200 hover:bg-emerald-50"
      href={`/knowledge-brain/players/${row.playerId}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-semibold text-zinc-950">{row.playerName}</p>
          <p className="mt-1 text-sm text-zinc-600">
            {row.position}
            {row.team ? `, ${row.team}` : ""}
          </p>
        </div>
        {earlySignal ? <SignalBadge label={earlySignal.sentimentLean} /> : null}
      </div>

      <div className="mt-3 grid gap-2 text-sm text-zinc-600">
        <p>
          <span className="font-semibold text-zinc-800">Opinion Signals:</span>{" "}
          {row.totalMentions}
        </p>
        <p>
          <span className="font-semibold text-zinc-800">Experts:</span>{" "}
          {experts || "--"}
        </p>
        {latestTake ? (
          <>
            <p>
              <span className="font-semibold text-zinc-800">Latest:</span>{" "}
              {latestTake.summary}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-md px-2 py-1 text-xs font-semibold ${getFreshnessTone(
                  latestTake.freshnessLabel,
                )}`}
              >
                {formatEnumLabel(latestTake.freshnessLabel)}
              </span>
              <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-zinc-700">
                {formatDate(
                  latestTake.publishDate ??
                    latestTake.publishedAt ??
                    latestTake.createdAt,
                )}
              </span>
            </div>
          </>
        ) : null}
        {earlySignal ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-amber-950">
            {earlySignal.reason}
          </p>
        ) : null}
      </div>
    </Link>
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

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600">
      {message}
    </div>
  );
}

function ConsensusBadge({ label }: { label: string }) {
  const tone =
    label.includes("Bullish")
      ? "bg-emerald-100 text-emerald-800"
      : label.includes("Bearish")
        ? "bg-red-100 text-red-800"
        : label === "Split"
          ? "bg-amber-100 text-amber-900"
          : "bg-zinc-200 text-zinc-700";

  return (
    <span className={`rounded-md px-2 py-1 text-xs font-semibold ${tone}`}>
      {label}
    </span>
  );
}

function WeightedConsensusBadge({ label }: { label: string }) {
  const tone =
    label.includes("Bullish")
      ? "bg-emerald-100 text-emerald-800"
      : label.includes("Bearish")
        ? "bg-red-100 text-red-800"
        : label === "Mixed / Divisive"
          ? "bg-amber-100 text-amber-900"
          : "bg-zinc-200 text-zinc-700";

  return (
    <span className={`rounded-md px-2 py-1 text-xs font-semibold ${tone}`}>
      {label}
    </span>
  );
}

function TrustBadge({ label }: { label: string }) {
  const tone =
    label === "High"
      ? "bg-emerald-100 text-emerald-800"
      : label === "Medium"
        ? "bg-blue-100 text-blue-800"
        : "bg-amber-100 text-amber-900";

  return (
    <span className={`rounded-md px-2 py-1 text-xs font-semibold ${tone}`}>
      {label}
    </span>
  );
}

function SignalBadge({ label }: { label: string }) {
  const tone =
    label === "Bullish"
      ? "bg-emerald-100 text-emerald-800"
      : label === "Bearish"
        ? "bg-red-100 text-red-800"
        : "bg-zinc-200 text-zinc-700";

  return (
    <span className={`rounded-md px-2 py-1 text-xs font-semibold ${tone}`}>
      {label} Lean
    </span>
  );
}

function getFreshnessTone(freshness: string) {
  if (freshness === "CURRENT" || freshness === "RECENT") {
    return "bg-emerald-100 text-emerald-800";
  }

  if (freshness === "ARCHIVED") return "bg-zinc-200 text-zinc-700";

  return "bg-amber-100 text-amber-900";
}

function formatDate(value: Date | null) {
  if (!value) return "--";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

function formatScore(value: number) {
  return value.toFixed(2).replace(/\.00$/, "");
}

function formatTopWeightedExperts(row: WeightedConsensusRow) {
  if (row.topWeightedExperts.length === 0) return "--";

  return row.topWeightedExperts
    .map(
      (expert) =>
        `${expert.expertName} ${expert.trustWeight.toFixed(2)}x ${formatEnumLabel(
          expert.weightedStance,
        )}`,
    )
    .join(", ");
}

function filterTrustRows(
  rows: PlayerTrustProfile[],
  filters: {
    position?: string;
    team?: string;
  },
) {
  return rows
    .filter((row) =>
      filters.position
        ? row.position.toLowerCase() === filters.position.toLowerCase()
        : true,
    )
    .filter((row) =>
      filters.team
        ? (row.team ?? "").toLowerCase() === filters.team.toLowerCase()
        : true,
    );
}

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}
