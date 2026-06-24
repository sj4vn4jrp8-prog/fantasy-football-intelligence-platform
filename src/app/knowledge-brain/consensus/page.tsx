import Link from "next/link";
import { getExpertConsensusDashboard } from "@/knowledge-brain/expert-consensus";

export const dynamic = "force-dynamic";

type ExpertConsensusDashboard = Awaited<
  ReturnType<typeof getExpertConsensusDashboard>
>;
type ConsensusRow = ExpertConsensusDashboard["rows"][number];

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
            <div className="grid gap-3 sm:grid-cols-2">
              <SummaryItem label="Players" value={String(dashboard.rows.length)} />
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
          <div className="grid gap-3 text-sm text-zinc-600 md:grid-cols-3">
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
              <h3 className="font-semibold text-zinc-950">True Consensus</h3>
              <p className="mt-1">
                Requires at least two experts and at least three total mentions.
                The strict consensus labels below keep that threshold intact.
              </p>
            </div>
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
              <h3 className="font-semibold text-zinc-950">Early Signal</h3>
              <p className="mt-1">
                A player can show a bullish, bearish, or neutral lean before
                qualifying for consensus. Treat these as watch-list clues, not
                settled agreement.
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

        <Card title="Expert Consensus">
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
          <span className="font-semibold text-zinc-800">Mentions:</span>{" "}
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

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}
