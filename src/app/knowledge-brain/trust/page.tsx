import Link from "next/link";
import { getExpertMemoryDashboard } from "@/knowledge-brain/expert-memory";
import { getTrustEngineDashboard } from "@/knowledge-brain/trust-engine";

export const dynamic = "force-dynamic";

type TrustEnginePageProps = {
  searchParams: Promise<{
    includeHistorical?: string;
    targetSeason?: string;
  }>;
};

type TrustDashboard = Awaited<ReturnType<typeof getTrustEngineDashboard>>;
type MemoryDashboard = Awaited<ReturnType<typeof getExpertMemoryDashboard>>;
type ExpertTrustProfile = TrustDashboard["expertProfiles"][number];
type PlayerTrustProfile = TrustDashboard["playerProfiles"][number];
type ExpertPlayerMemory = MemoryDashboard["memories"][number];

export default async function TrustEnginePage({
  searchParams,
}: TrustEnginePageProps) {
  const filters = await searchParams;
  const dashboard = await getTrustEngineDashboard({
    includeHistorical: filters.includeHistorical === "true",
    targetSeason: filters.targetSeason,
  });
  const expertMemory = await getExpertMemoryDashboard({
    includeHistorical: filters.includeHistorical === "true",
    targetSeason: filters.targetSeason,
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
              href="/knowledge-brain/experts"
            >
              Expert Accuracy
            </Link>
            <Link
              className="text-sm font-semibold text-zinc-600 hover:text-zinc-950"
              href="/knowledge-brain/consensus"
            >
              Expert Consensus
            </Link>
            <Link
              className="text-sm font-semibold text-zinc-600 hover:text-zinc-950"
              href="/knowledge-brain/history"
            >
              Time Machine
            </Link>
          </div>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-emerald-700">
                Trust Engine
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal text-zinc-950 sm:text-4xl">
                Trust Score Foundation
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
                Trust Score is the future user-facing layer. Weighted consensus
                remains an internal signal, while this page explains why the
                platform trusts an expert or a player intelligence profile.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <SummaryItem
                label="Experts"
                value={String(dashboard.expertProfiles.length)}
              />
              <SummaryItem
                label="Players"
                value={String(dashboard.playerProfiles.length)}
              />
              <SummaryItem
                label="Memory"
                value={String(expertMemory.memories.length)}
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
        <Card title="Trust Scope">
          <form
            action="/knowledge-brain/trust"
            className="grid gap-3 md:grid-cols-[160px_minmax(0,1fr)_auto]"
          >
            <label className="grid gap-1 text-sm font-semibold text-zinc-700">
              Target Season
              <input
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
                defaultValue={String(dashboard.filters.targetSeason)}
                min="2000"
                name="targetSeason"
                type="number"
              />
            </label>
            <label className="flex items-end gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-semibold text-zinc-700">
              <input
                className="h-4 w-4"
                defaultChecked={dashboard.filters.includeHistorical}
                name="includeHistorical"
                type="checkbox"
                value="true"
              />
              Include historical/stale content
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
                href="/knowledge-brain/trust"
              >
                Reset
              </Link>
            </div>
          </form>
        </Card>

        <section className="grid gap-4 xl:grid-cols-4">
          <ExpertTrustWidget
            emptyMessage="No trusted expert profiles yet."
            experts={dashboard.widgets.topTrustedExperts}
            title="Top Trust Scores"
          />
          <ExpertTrustWidget
            emptyMessage="No low-sample experts yet."
            experts={dashboard.widgets.lowSampleExperts}
            title="Low-Sample Watch"
          />
          <PlayerTrustWidget
            emptyMessage="No player trust profiles yet."
            players={dashboard.widgets.strongestPlayerTrust}
            title="Strongest Player Trust"
          />
          <PlayerTrustWidget
            emptyMessage="No questionable player profiles yet."
            players={dashboard.widgets.mostQuestionablePlayerTrust}
            title="Needs Evidence"
          />
        </section>

        <Card title="Expert Memory">
          {expertMemory.memories.length > 0 ? (
            <div className="grid gap-4">
              <section className="grid gap-3 xl:grid-cols-4">
                <MemoryWidget
                  emptyMessage="No bullish memory signals yet."
                  memories={expertMemory.widgets.increasingBullish}
                  title="Bullish Movement"
                />
                <MemoryWidget
                  emptyMessage="No bearish memory signals yet."
                  memories={expertMemory.widgets.increasingBearish}
                  title="Bearish Movement"
                />
                <MemoryWidget
                  emptyMessage="No volatile memory timelines yet."
                  memories={expertMemory.widgets.volatileOpinions}
                  title="Volatile Opinions"
                />
                <MemoryWidget
                  emptyMessage="No high-conviction memory timelines yet."
                  memories={expertMemory.widgets.highestConviction}
                  title="Highest Conviction"
                />
              </section>
              <div className="grid gap-3 lg:grid-cols-2">
                {expertMemory.memories.slice(0, 10).map((memory) => (
                  <ExpertMemoryCard
                    key={`${memory.expertId}-${memory.playerId}`}
                    memory={memory}
                  />
                ))}
              </div>
            </div>
          ) : (
            <EmptyState message="No approved expert-player memory timelines are available yet. Approve transcript player summaries or reviewed takes to create memory signals." />
          )}
        </Card>

        <Card title="Expert Trust Profiles">
          {dashboard.expertProfiles.length > 0 ? (
            <div className="grid gap-4">
              {dashboard.expertProfiles.map((profile) => (
                <ExpertTrustCard key={profile.expertId} profile={profile} />
              ))}
            </div>
          ) : (
            <EmptyState message="No expert trust profiles are available yet." />
          )}
        </Card>

        <Card title="Player Trust Samples">
          {dashboard.playerProfiles.length > 0 ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {dashboard.playerProfiles.slice(0, 12).map((profile) => (
                <PlayerTrustCard key={profile.playerId} profile={profile} />
              ))}
            </div>
          ) : (
            <EmptyState message="No approved player intelligence is available for trust scoring yet." />
          )}
        </Card>
      </section>
    </main>
  );
}

function ExpertMemoryCard({ memory }: { memory: ExpertPlayerMemory }) {
  const latestPoint = memory.timeline.latestPoint;

  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-semibold text-zinc-950">
            <Link
              className="text-emerald-700 hover:text-emerald-900"
              href={`/knowledge-brain/experts/${memory.expertId}`}
            >
              {memory.expertName}
            </Link>{" "}
            on{" "}
            <Link
              className="text-emerald-700 hover:text-emerald-900"
              href={`/knowledge-brain/players/${memory.playerId}`}
            >
              {memory.playerName}
            </Link>
          </p>
          <p className="mt-1 text-sm text-zinc-600">
            {memory.position}
            {memory.team ? `, ${memory.team}` : ""} -{" "}
            {memory.timeline.points.length} timeline point
            {memory.timeline.points.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <MemoryTrendBadge label={memory.memory.opinionTrend} />
          <ConvictionBadge label={memory.memory.convictionLabel} />
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <Metric
          label="Conviction"
          value={String(memory.memory.convictionScore)}
        />
        <Metric
          label="Current Stance"
          value={formatEnumLabel(memory.memory.currentStance)}
        />
        <Metric label="Latest" value={formatDate(latestPoint?.publishDate)} />
      </div>

      <div className="mt-3 rounded-md border border-zinc-200 bg-white p-3 text-sm text-zinc-600">
        <p className="font-semibold text-zinc-950">
          {latestPoint?.summary ?? "No latest summary available."}
        </p>
        {latestPoint ? (
          <p className="mt-1">
            {latestPoint.sourceTitle} - Confidence{" "}
            {Math.round(latestPoint.confidence * 100)}%
          </p>
        ) : null}
      </div>

      <ul className="mt-3 grid gap-1 text-sm text-zinc-600">
        {memory.memory.explanationBullets.slice(0, 3).map((bullet) => (
          <li key={bullet}>{bullet}</li>
        ))}
      </ul>
      {memory.memory.warnings.length > 0 ? (
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-sm text-amber-950">
          {memory.memory.warnings[0]}
        </p>
      ) : null}
    </div>
  );
}

function MemoryWidget({
  title,
  memories,
  emptyMessage,
}: {
  title: string;
  memories: ExpertPlayerMemory[];
  emptyMessage: string;
}) {
  return (
    <section className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
      <h3 className="font-semibold text-zinc-950">{title}</h3>
      {memories.length > 0 ? (
        <div className="mt-3 grid gap-2">
          {memories.slice(0, 4).map((memory) => (
            <Link
              className="rounded-md border border-zinc-200 bg-white p-3 transition hover:border-emerald-200 hover:bg-emerald-50"
              href={`/knowledge-brain/players/${memory.playerId}`}
              key={`${memory.expertId}-${memory.playerId}`}
            >
              <p className="font-semibold text-zinc-950">
                {memory.playerName}
              </p>
              <p className="mt-1 text-sm text-zinc-600">
                {memory.expertName} - {memory.memory.convictionScore} conviction
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-3">
          <EmptyState message={emptyMessage} />
        </div>
      )}
    </section>
  );
}

function ExpertTrustCard({ profile }: { profile: ExpertTrustProfile }) {
  return (
    <article className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <Link
            className="text-lg font-semibold text-emerald-700 hover:text-emerald-900"
            href={`/knowledge-brain/experts/${profile.expertId}`}
          >
            {profile.expertName}
          </Link>
          <div className="mt-2 flex flex-wrap gap-2">
            <TrustBadge label={profile.confidenceLabel} />
            <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-zinc-700">
              {profile.sampleSizeLabel}
            </span>
            <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-zinc-700">
              Weighted signal {profile.weightedConsensusSignal.weight.toFixed(2)}
              x
            </span>
          </div>
        </div>
        <div className="rounded-md border border-zinc-200 bg-white px-4 py-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Trust Score
          </p>
          <p className="mt-1 text-2xl font-semibold text-zinc-950">
            {profile.overallTrustScore}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <Metric label="Scoped Takes" value={String(profile.evidence.scopedTakes)} />
        <Metric
          label="Summaries"
          value={String(profile.evidence.approvedTranscriptSummaries)}
        />
        <Metric
          label="Summary Quality"
          value={
            profile.evidence.averageSummaryQualityScore === null
              ? "--"
              : String(profile.evidence.averageSummaryQualityScore)
          }
        />
        <Metric
          label="Human Reviewed"
          value={String(profile.evidence.humanReviewedTranscriptSummaries)}
        />
        <Metric
          label="Auto-approved"
          value={String(profile.evidence.autoApprovedTranscriptSummaries)}
        />
        <Metric
          label="Graded"
          value={String(profile.evidence.gradedOutcomes)}
        />
        <Metric
          label="Accuracy"
          value={
            profile.evidence.accuracyRate === null
              ? "--"
              : `${Math.round(profile.evidence.accuracyRate)}%`
          }
        />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-md border border-zinc-200 bg-white p-3">
          <h3 className="font-semibold text-zinc-950">Why This Score Exists</h3>
          <ul className="mt-2 grid gap-2 text-sm text-zinc-600">
            {profile.explanationBullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-md border border-zinc-200 bg-white p-3">
          <h3 className="font-semibold text-zinc-950">Warnings</h3>
          {profile.warnings.length > 0 ? (
            <ul className="mt-2 grid gap-2 text-sm text-amber-950">
              {profile.warnings.map((warning) => (
                <li
                  className="rounded-md border border-amber-200 bg-amber-50 p-2"
                  key={warning}
                >
                  {warning}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-zinc-600">
              No major trust warnings in this scope.
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {profile.dimensions.map((dimension) => (
          <div
            className="rounded-md border border-zinc-200 bg-white p-3"
            key={dimension.key}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="font-semibold text-zinc-950">{dimension.label}</p>
              <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700">
                {dimension.score}
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-zinc-600">
              {dimension.explanation}
            </p>
          </div>
        ))}
      </div>
    </article>
  );
}

function PlayerTrustCard({ profile }: { profile: PlayerTrustProfile }) {
  return (
    <Link
      className="rounded-md border border-zinc-200 bg-zinc-50 p-4 transition hover:border-emerald-200 hover:bg-emerald-50"
      href={`/knowledge-brain/players/${profile.playerId}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-zinc-950">{profile.playerName}</p>
          <p className="mt-1 text-sm text-zinc-600">
            {profile.position}
            {profile.team ? `, ${profile.team}` : ""}
          </p>
        </div>
        <div className="rounded-md bg-white px-3 py-2 text-center">
          <p className="text-xs font-semibold uppercase text-zinc-500">Trust</p>
          <p className="font-semibold text-zinc-950">
            {profile.playerTrustScore}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <StanceBadge label={profile.stanceSummary} />
        <TrustBadge label={profile.confidenceLabel} />
        <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-zinc-700">
          {profile.sampleSizeLabel}
        </span>
        <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-zinc-700">
          {profile.snapshotMovementSignal.label}
        </span>
      </div>
      {profile.topSupportingExperts.length > 0 ? (
        <p className="mt-3 text-sm text-zinc-600">
          Top support:{" "}
          {profile.topSupportingExperts
            .slice(0, 3)
            .map(
              (expert) =>
                `${expert.expertName} (${expert.trustScore}, ${formatEnumLabel(
                  expert.stance,
                )})`,
            )
            .join(", ")}
        </p>
      ) : null}
      {[...profile.disagreementWarnings, ...profile.lowSampleWarnings].length >
      0 ? (
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2 text-sm text-amber-950">
          {[...profile.disagreementWarnings, ...profile.lowSampleWarnings][0]}
        </p>
      ) : null}
    </Link>
  );
}

function ExpertTrustWidget({
  title,
  experts,
  emptyMessage,
}: {
  title: string;
  experts: ExpertTrustProfile[];
  emptyMessage: string;
}) {
  return (
    <Card title={title}>
      {experts.length > 0 ? (
        <div className="grid gap-2">
          {experts.map((expert) => (
            <Link
              className="rounded-md border border-zinc-200 bg-zinc-50 p-3 transition hover:border-emerald-200 hover:bg-emerald-50"
              href={`/knowledge-brain/experts/${expert.expertId}`}
              key={expert.expertId}
            >
              <p className="font-semibold text-zinc-950">{expert.expertName}</p>
              <p className="mt-1 text-sm text-zinc-600">
                Trust {expert.overallTrustScore} - {expert.confidenceLabel}
              </p>
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
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState message={emptyMessage} />
      )}
    </Card>
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white px-3 py-2">
      <p className="text-xs font-semibold uppercase text-zinc-500">{label}</p>
      <p className="mt-1 font-semibold text-zinc-950">{value}</p>
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

function TrustBadge({ label }: { label: string }) {
  const tone =
    label === "High"
      ? "bg-emerald-100 text-emerald-800"
      : label === "Medium"
        ? "bg-blue-100 text-blue-800"
        : "bg-amber-100 text-amber-900";

  return (
    <span className={`rounded-md px-2 py-1 text-xs font-semibold ${tone}`}>
      {label} Confidence
    </span>
  );
}

function MemoryTrendBadge({ label }: { label: string }) {
  const tone =
    label.includes("Bullish")
      ? "bg-emerald-100 text-emerald-800"
      : label.includes("Bearish")
        ? "bg-red-100 text-red-800"
        : label.includes("Volatile")
          ? "bg-amber-100 text-amber-900"
          : "bg-zinc-200 text-zinc-700";

  return (
    <span className={`rounded-md px-2 py-1 text-xs font-semibold ${tone}`}>
      {label}
    </span>
  );
}

function ConvictionBadge({ label }: { label: string }) {
  const tone =
    label === "Very High" || label === "High"
      ? "bg-emerald-100 text-emerald-800"
      : label === "Medium"
        ? "bg-blue-100 text-blue-800"
        : "bg-amber-100 text-amber-900";

  return (
    <span className={`rounded-md px-2 py-1 text-xs font-semibold ${tone}`}>
      {label} Conviction
    </span>
  );
}

function StanceBadge({ label }: { label: string }) {
  const tone =
    label === "Bullish"
      ? "bg-emerald-100 text-emerald-800"
      : label === "Bearish"
        ? "bg-red-100 text-red-800"
        : label === "Mixed"
          ? "bg-amber-100 text-amber-900"
          : "bg-zinc-200 text-zinc-700";

  return (
    <span className={`rounded-md px-2 py-1 text-xs font-semibold ${tone}`}>
      {label}
    </span>
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
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}
