import Link from "next/link";
import { getDefaultTargetSeason } from "@/knowledge-brain/freshness";
import {
  getPlayerIntelligenceHistory,
  getPlayersWithSnapshotHistory,
} from "@/knowledge-brain/intelligence-snapshots";

export const dynamic = "force-dynamic";

type KnowledgeBrainHistoryPageProps = {
  searchParams: Promise<{
    playerId?: string;
    targetSeason?: string;
  }>;
};

export default async function KnowledgeBrainHistoryPage({
  searchParams,
}: KnowledgeBrainHistoryPageProps) {
  const filters = await searchParams;
  const targetSeason = Number(filters.targetSeason ?? getDefaultTargetSeason());
  const snapshotPlayers = await getPlayersWithSnapshotHistory(targetSeason);
  const selectedPlayerId =
    filters.playerId ?? snapshotPlayers.players[0]?.id ?? null;
  const history = selectedPlayerId
    ? await getPlayerIntelligenceHistory({
        playerId: selectedPlayerId,
        targetSeason,
      })
    : null;

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
              href="/knowledge-brain/trust"
            >
              Trust Engine
            </Link>
            <Link
              className="text-sm font-semibold text-zinc-600 hover:text-zinc-950"
              href="/knowledge-brain/players"
            >
              Player Intelligence
            </Link>
          </div>
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-emerald-700">
              Intelligence Time Machine
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-zinc-950 sm:text-4xl">
              Historical Knowledge Brain Snapshots
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
              Review what the platform believed about a player at each persisted
              intelligence update. Snapshots are versioned and never overwrite
              earlier history.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-5 sm:px-6 lg:px-8">
        <Card title="History Scope">
          <form
            action="/knowledge-brain/history"
            className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_auto]"
          >
            <label className="grid gap-1 text-sm font-semibold text-zinc-700">
              Player
              <select
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
                defaultValue={selectedPlayerId ?? ""}
                name="playerId"
              >
                {snapshotPlayers.players.length > 0 ? (
                  snapshotPlayers.players.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.fullName} ({player.position}
                      {player.team ? `, ${player.team}` : ""})
                    </option>
                  ))
                ) : (
                  <option value="">No snapshot history yet</option>
                )}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold text-zinc-700">
              Target Season
              <input
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
                defaultValue={String(snapshotPlayers.contentSeason)}
                min="2000"
                name="targetSeason"
                type="number"
              />
            </label>
            <div className="flex items-end gap-2">
              <button
                className="h-10 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800"
                type="submit"
              >
                View History
              </button>
            </div>
          </form>
        </Card>

        {history?.player ? (
          <>
            <Card title="Player Snapshot Summary">
              <div className="grid gap-3 md:grid-cols-4">
                <SummaryItem label="Player" value={history.player.fullName} />
                <SummaryItem
                  label="Position"
                  value={`${history.player.position}${
                    history.player.team ? `, ${history.player.team}` : ""
                  }`}
                />
                <SummaryItem
                  label="Trust Versions"
                  value={String(history.trustSnapshots.length)}
                />
                <SummaryItem
                  label="Memory Versions"
                  value={String(history.expertMemorySnapshots.length)}
                />
              </div>
            </Card>

            <Card title="Trust Score History">
              {history.trustTimeline.length > 0 ? (
                <div className="grid gap-3">
                  {history.trustTimeline.map(({ snapshot, movements }) => (
                    <TimelineCard
                      key={snapshot.id}
                      title={`Version ${snapshot.version}: Trust ${snapshot.trustScore}`}
                      subtitle={`${formatDate(snapshot.snapshotDate)} - ${formatEnumLabel(snapshot.generationType)}`}
                    >
                      <MetricGrid
                        metrics={[
                          ["Movement", movements.trustScore.label],
                          ["Confidence", movements.confidence.label],
                          ["Stance", movements.stance.label],
                          ["Evidence", movements.evidenceCount.label],
                        ]}
                      />
                      <p className="mt-3 text-sm leading-6 text-zinc-600">
                        {snapshot.explanationSummary}
                      </p>
                    </TimelineCard>
                  ))}
                </div>
              ) : (
                <EmptyState message="No player trust snapshots exist for this player and season yet." />
              )}
            </Card>

            <Card title="Player Intelligence History">
              {history.intelligenceTimeline.length > 0 ? (
                <div className="grid gap-3">
                  {history.intelligenceTimeline.map(({ snapshot, movements }) => (
                    <TimelineCard
                      key={snapshot.id}
                      title={`Version ${snapshot.version}: ${snapshot.intelligenceLabel}`}
                      subtitle={`${formatDate(snapshot.snapshotDate)} - ${formatEnumLabel(snapshot.generationType)}`}
                    >
                      <MetricGrid
                        metrics={[
                          ["Score", movements.intelligenceScore.label],
                          ["Stance", movements.stance.label],
                          ["Trend", movements.trend.label],
                          ["Mentions", movements.mentionCount.label],
                        ]}
                      />
                      <p className="mt-3 text-sm leading-6 text-zinc-600">
                        {snapshot.explanationSummary}
                      </p>
                    </TimelineCard>
                  ))}
                </div>
              ) : (
                <EmptyState message="No player intelligence snapshots exist for this player and season yet." />
              )}
            </Card>

            <Card title="Expert Memory History">
              {history.expertMemoryTimeline.length > 0 ? (
                <div className="grid gap-3">
                  {history.expertMemoryTimeline.map(({ snapshot, movements }) => (
                    <TimelineCard
                      key={snapshot.id}
                      title={`${snapshot.expert.name}: ${formatEnumLabel(snapshot.stance)}`}
                      subtitle={`Version ${snapshot.version} - ${formatDate(snapshot.snapshotDate)} - ${formatEnumLabel(snapshot.generationType)}`}
                    >
                      <MetricGrid
                        metrics={[
                          ["Conviction", movements.convictionScore.label],
                          ["Trend", movements.trend.label],
                          ["Confidence", movements.confidence.label],
                          ["Evidence", movements.evidenceCount.label],
                        ]}
                      />
                      <p className="mt-3 text-sm leading-6 text-zinc-600">
                        {snapshot.explanationSummary}
                      </p>
                    </TimelineCard>
                  ))}
                </div>
              ) : (
                <EmptyState message="No expert memory snapshots exist for this player and season yet." />
              )}
            </Card>
          </>
        ) : (
          <EmptyState message="No intelligence snapshots exist yet. Import, reprocess, or review Knowledge Brain transcripts to create versioned history." />
        )}
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

function TimelineCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <article className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <h3 className="font-semibold text-zinc-950">{title}</h3>
        <p className="text-sm text-zinc-500">{subtitle}</p>
      </div>
      <div className="mt-3">{children}</div>
    </article>
  );
}

function MetricGrid({ metrics }: { metrics: Array<[string, string]> }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map(([label, value]) => (
        <SummaryItem key={label} label={label} value={value} />
      ))}
    </div>
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

function EmptyState({ message }: { message: string }) {
  return (
    <p className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-500">
      {message}
    </p>
  );
}

function formatDate(value: Date | null | undefined) {
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
