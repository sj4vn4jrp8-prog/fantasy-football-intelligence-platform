import Link from "next/link";
import { notFound } from "next/navigation";
import { getExpertAccuracyProfile } from "@/knowledge-brain/expert-accuracy";

export const dynamic = "force-dynamic";

type ExpertProfilePageProps = {
  params: Promise<{
    expertId: string;
  }>;
  searchParams: Promise<{
    includeHistorical?: string;
    targetSeason?: string;
  }>;
};

type ExpertAccuracyProfile = NonNullable<
  Awaited<ReturnType<typeof getExpertAccuracyProfile>>
>;
type ExpertAccuracyRow = ExpertAccuracyProfile["expert"];

export default async function ExpertProfilePage({
  params,
  searchParams,
}: ExpertProfilePageProps) {
  const { expertId } = await params;
  const filters = await searchParams;
  const profile = await getExpertAccuracyProfile(expertId, {
    includeHistorical: filters.includeHistorical === "true",
    targetSeason: filters.targetSeason,
  });

  if (!profile) {
    notFound();
  }

  const expert = profile.expert;

  return (
    <main className="min-h-screen bg-stone-50">
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-wrap gap-3">
            <Link
              className="text-sm font-semibold text-emerald-700 hover:text-emerald-900"
              href={`/knowledge-brain/experts?targetSeason=${profile.filters.targetSeason}${profile.filters.includeHistorical ? "&includeHistorical=true" : ""}`}
            >
              Back to experts
            </Link>
            <Link
              className="text-sm font-semibold text-zinc-600 hover:text-zinc-950"
              href="/knowledge-brain"
            >
              Knowledge Brain
            </Link>
            <Link
              className="text-sm font-semibold text-zinc-600 hover:text-zinc-950"
              href="/knowledge-brain/grading"
            >
              Outcome Grading
            </Link>
          </div>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-emerald-700">
                Expert Accuracy Profile
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal text-zinc-950 sm:text-4xl">
                {expert.expertName}
              </h1>
              <p className="mt-2 text-sm font-medium text-zinc-600">
                {expert.active ? "Active" : "Inactive"}
                {expert.tags.length > 0 ? ` - ${expert.tags.join(", ")}` : ""}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <SummaryItem label="Takes" value={String(expert.takeCount)} />
              <SummaryItem
                label="Graded"
                value={String(expert.outcomeSummary.totalGraded)}
              />
              <SummaryItem
                label="Accuracy"
                value={formatAccuracyRate(expert.outcomeSummary.accuracyRate)}
              />
              <SummaryItem label="Status" value={expert.accuracyStatus} />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-5 sm:px-6 lg:px-8">
        <Card title="Freshness Scope">
          <form
            action={`/knowledge-brain/experts/${expert.expertId}`}
            className="grid gap-3 md:grid-cols-[160px_minmax(0,1fr)_auto]"
          >
            <label className="grid gap-1 text-sm font-semibold text-zinc-700">
              Target Season
              <input
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
                defaultValue={String(profile.filters.targetSeason)}
                min="2000"
                name="targetSeason"
                type="number"
              />
            </label>
            <label className="flex items-end gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-semibold text-zinc-700">
              <input
                className="h-4 w-4"
                defaultChecked={profile.filters.includeHistorical}
                name="includeHistorical"
                type="checkbox"
                value="true"
              />
              Include historical/stale content
            </label>
            <div className="flex items-end">
              <button
                className="h-10 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800"
                type="submit"
              >
                Apply
              </button>
            </div>
          </form>
        </Card>

        <section className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          <Card title="Expert Identity">
            <div className="grid gap-3">
              <SummaryItem label="Name" value={expert.expertName} />
              <SummaryItem
                label="Active"
                value={expert.active ? "Active" : "Inactive"}
              />
              <SummaryItem
                label="Channels"
                value={String(expert.channels.length)}
              />
              <p className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600">
                {expert.notes ?? "No notes saved for this expert yet."}
              </p>
            </div>
          </Card>

          <Card title="Accuracy Status">
            <div className="grid gap-3 md:grid-cols-4">
              <Metric label="Scoped Takes" value={String(expert.takeCount)} />
              <Metric
                label="Current Takes"
                value={String(expert.currentSeasonTakes)}
              />
              <Metric
                label="Awaiting Grade"
                value={String(expert.takeTracking.awaitingOutcomeGrading)}
              />
              <Metric
                label="Eligible"
                value={String(expert.takeTracking.eligibleForFutureGrading)}
              />
              <Metric
                label="Graded"
                value={String(expert.outcomeSummary.totalGraded)}
              />
              <Metric
                label="Accuracy"
                value={formatAccuracyRate(expert.outcomeSummary.accuracyRate)}
              />
              <Metric
                label="Correct"
                value={String(expert.outcomeSummary.correctCount)}
              />
              <Metric
                label="Partial"
                value={String(expert.outcomeSummary.partialCount)}
              />
              <Metric
                label="Incorrect"
                value={String(expert.outcomeSummary.incorrectCount)}
              />
              <Metric
                label="Push"
                value={String(expert.outcomeSummary.pushCount)}
              />
            </div>
            <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-4">
              <AccuracyStatusBadge label={expert.accuracyStatus} />
              <p className="mt-3 text-sm text-zinc-600">
                {expert.accuracyStatusDetail}
              </p>
            </div>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <Card title="Sentiment Breakdown">
            <BreakdownList
              items={[
                { key: "Bullish", count: expert.bullishTakes },
                { key: "Bearish", count: expert.bearishTakes },
                { key: "Neutral", count: expert.neutralTakes },
              ]}
            />
          </Card>
          <Card title="Take Type Breakdown">
            <BreakdownList items={expert.takeTypeBreakdown} />
          </Card>
          <Card title="Position Coverage">
            <BreakdownList items={expert.positionCoverage} />
          </Card>
        </section>

        <Card title="Graded Expert Takes">
          <TakeList
            emptyMessage="No takes from this expert have been manually graded yet."
            showOutcome
            takes={expert.gradedTakes}
          />
        </Card>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <Card title="Recent Takes">
            <TakeList takes={expert.recentTakes} />
          </Card>

          <div className="grid gap-4">
            <Card title="Consensus Agreement">
              {expert.consensusAgreement.rate !== null ? (
                <div className="grid gap-3">
                  <SummaryItem
                    label="Agreement Rate"
                    value={`${expert.consensusAgreement.rate}%`}
                  />
                  <SummaryItem
                    label="Aligned"
                    value={`${expert.consensusAgreement.aligned} of ${expert.consensusAgreement.eligible}`}
                  />
                </div>
              ) : (
                <EmptyState message="No strict consensus rows are available for this expert yet." />
              )}
            </Card>

            <Card title="Take Tracking">
              <div className="grid gap-3">
                <SummaryItem
                  label="Awaiting Outcome"
                  value={String(expert.takeTracking.awaitingOutcomeGrading)}
                />
                <SummaryItem
                  label="Future Eligible"
                  value={String(expert.takeTracking.eligibleForFutureGrading)}
                />
                <SummaryItem
                  label="High Conviction"
                  value={String(expert.takeTracking.highConvictionCount)}
                />
              </div>
            </Card>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <Card title="Most-Discussed Players">
            <PlayerSignalList players={expert.mostDiscussedPlayers} />
          </Card>
          <Card title="Bullish Players">
            <PlayerSignalList players={expert.bullishPlayers} tone="bullish" />
          </Card>
          <Card title="Bearish Players">
            <PlayerSignalList players={expert.bearishPlayers} tone="bearish" />
          </Card>
        </section>

        <Card title="Recent High-Conviction Takes">
          <TakeList
            emptyMessage="No high-conviction takes have been extracted yet."
            takes={expert.highConvictionTakes}
          />
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
    <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
      <p className="text-xs font-semibold uppercase text-zinc-500">{label}</p>
      <p className="mt-1 font-semibold text-zinc-950">{value}</p>
    </div>
  );
}

function BreakdownList({
  items,
}: {
  items: Array<{ key: string; count: number }>;
}) {
  if (items.length === 0) {
    return <EmptyState message="No data available yet." />;
  }

  return (
    <div className="grid gap-2">
      {items.map((item) => (
        <div
          className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3"
          key={item.key}
        >
          <p className="font-semibold text-zinc-950">
            {formatEnumLabel(item.key)}
          </p>
          <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-zinc-700">
            {item.count}
          </span>
        </div>
      ))}
    </div>
  );
}

function TakeList({
  takes,
  emptyMessage = "No recent takes are available yet.",
  showOutcome = false,
}: {
  takes: ExpertAccuracyRow["recentTakes"];
  emptyMessage?: string;
  showOutcome?: boolean;
}) {
  if (takes.length === 0) {
    return <EmptyState message={emptyMessage} />;
  }

  return (
    <div className="grid gap-3">
      {takes.map((take) => (
        <div
          className="rounded-md border border-zinc-200 bg-zinc-50 p-4"
          key={take.id}
        >
          <div className="flex flex-wrap items-center gap-2">
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
            <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-zinc-700">
              Confidence {Math.round(take.confidence * 100)}%
            </span>
            {showOutcome && take.outcome ? (
              <span className={`rounded-md px-2 py-1 text-xs font-semibold ${getGradeTone(take.outcome.grade)}`}>
                {formatEnumLabel(take.outcome.grade)}
              </span>
            ) : null}
          </div>
          <p className="mt-3 font-semibold text-zinc-950">{take.summary}</p>
          <p className="mt-1 text-sm text-zinc-600">
            {take.playerId ? (
              <Link
                className="font-semibold text-emerald-700 hover:text-emerald-900"
                href={`/knowledge-brain/players/${take.playerId}`}
              >
                {take.playerName}
              </Link>
            ) : (
              take.playerName
            )}{" "}
            - {take.position}
            {take.team ? `, ${take.team}` : ""} -{" "}
            {formatDate(take.publishedAt ?? take.createdAt)}
          </p>
          <p className="mt-2 line-clamp-3 text-sm text-zinc-600">
            {take.excerpt}
          </p>
          {showOutcome && take.outcome ? (
            <div className="mt-3 rounded-md border border-zinc-200 bg-white p-3 text-sm text-zinc-600">
              <p>
                <span className="font-semibold text-zinc-950">Outcome:</span>{" "}
                {formatEnumLabel(take.outcome.outcomeType)}
                {take.outcome.outcomeValue
                  ? ` - ${take.outcome.outcomeValue}`
                  : ""}
              </p>
              <p className="mt-1">
                Confidence {Math.round(take.outcome.confidence * 100)}%
                {take.outcome.outcomeDate
                  ? ` - ${formatDate(take.outcome.outcomeDate)}`
                  : ""}
              </p>
              {take.outcome.notes ? (
                <p className="mt-1">{take.outcome.notes}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function PlayerSignalList({
  players,
  tone = "neutral",
}: {
  players: ExpertAccuracyRow["mostDiscussedPlayers"];
  tone?: "bullish" | "bearish" | "neutral";
}) {
  if (players.length === 0) {
    return <EmptyState message="No players available yet." />;
  }

  const toneClass = {
    bullish: "border-emerald-200 bg-emerald-50",
    bearish: "border-red-200 bg-red-50",
    neutral: "border-zinc-200 bg-zinc-50",
  }[tone];

  return (
    <div className="grid gap-2">
      {players.map((player) => (
        <Link
          className={`rounded-md border p-3 transition hover:border-emerald-200 hover:bg-emerald-50 ${toneClass}`}
          href={`/knowledge-brain/players/${player.playerId}`}
          key={player.playerId}
        >
          <p className="font-semibold text-zinc-950">{player.fullName}</p>
          <p className="mt-1 text-sm text-zinc-600">
            {player.position}
            {player.team ? `, ${player.team}` : ""} - {player.mentionCount} take
            {player.mentionCount === 1 ? "" : "s"}
          </p>
        </Link>
      ))}
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

function AccuracyStatusBadge({ label }: { label: string }) {
  const tone =
    label === "Ready For Grading"
      ? "bg-emerald-100 text-emerald-800"
      : label === "Tracking"
        ? "bg-blue-100 text-blue-800"
        : label === "Graded"
          ? "bg-purple-100 text-purple-800"
          : "bg-zinc-200 text-zinc-700";

  return (
    <span className={`rounded-md px-2 py-1 text-xs font-semibold ${tone}`}>
      {label}
    </span>
  );
}

function getSentimentTone(sentiment: string) {
  if (sentiment === "BULLISH") return "bg-emerald-100 text-emerald-800";
  if (sentiment === "BEARISH") return "bg-red-100 text-red-800";

  return "bg-zinc-200 text-zinc-700";
}

function getGradeTone(grade: string) {
  if (grade === "CORRECT") return "bg-emerald-100 text-emerald-800";
  if (grade === "PARTIALLY_CORRECT") return "bg-blue-100 text-blue-800";
  if (grade === "INCORRECT") return "bg-red-100 text-red-800";
  if (grade === "PUSH") return "bg-amber-100 text-amber-900";

  return "bg-zinc-200 text-zinc-700";
}

function formatDate(value: Date | null) {
  if (!value) return "Unknown date";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

function formatAccuracyRate(value: number | null) {
  return value === null ? "--" : `${value}%`;
}

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}
