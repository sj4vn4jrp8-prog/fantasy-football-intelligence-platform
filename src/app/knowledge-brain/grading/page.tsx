import Link from "next/link";
import { TakeOutcomeGradeForm } from "@/components/knowledge-brain/TakeOutcomeGradeForm";
import { getOutcomeGradingDashboard } from "@/knowledge-brain/expert-outcomes";

export const dynamic = "force-dynamic";

type GradingPageProps = {
  searchParams: Promise<{
    includeHistorical?: string;
    targetSeason?: string;
  }>;
};

type GradingDashboard = Awaited<ReturnType<typeof getOutcomeGradingDashboard>>;

export default async function KnowledgeBrainGradingPage({
  searchParams,
}: GradingPageProps) {
  const filters = await searchParams;
  const dashboard = await getOutcomeGradingDashboard({
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
          </div>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-emerald-700">
                Outcome Grading
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal text-zinc-950 sm:text-4xl">
                Manual Expert Take Grading
              </h1>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <SummaryItem
                label="Awaiting"
                value={String(dashboard.takesAwaitingGrading.length)}
              />
              <SummaryItem
                label="Recently Graded"
                value={String(dashboard.recentlyGradedTakes.length)}
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
            action="/knowledge-brain/grading"
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
                href="/knowledge-brain/grading"
              >
                Reset
              </Link>
            </div>
          </form>
        </Card>

        <section className="grid gap-4 xl:grid-cols-2">
          <Card title="Recently Graded Takes">
            <RecentlyGradedList outcomes={dashboard.recentlyGradedTakes} />
          </Card>
          <Card title="Experts With Graded Accuracy">
            <GradedExpertList experts={dashboard.expertsWithGradedAccuracy} />
          </Card>
        </section>

        <Card title="Takes Awaiting Grading">
          {dashboard.takesAwaitingGrading.length > 0 ? (
            <div className="grid gap-4">
              {dashboard.takesAwaitingGrading.map((take) => (
                <div
                  className="rounded-md border border-zinc-200 bg-zinc-50 p-4"
                  key={take.id}
                >
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_520px]">
                    <div>
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
                        <span
                          className={`rounded-md px-2 py-1 text-xs font-semibold ${getFreshnessTone(
                            take.freshnessLabel,
                          )}`}
                        >
                          {formatEnumLabel(take.freshnessLabel)}
                        </span>
                      </div>
                      <h2 className="mt-3 text-lg font-semibold text-zinc-950">
                        {take.summary}
                      </h2>
                      <p className="mt-2 text-sm text-zinc-600">
                        <Link
                          className="font-semibold text-emerald-700 hover:text-emerald-900"
                          href={`/knowledge-brain/experts/${take.expertId}`}
                        >
                          {take.expertName}
                        </Link>{" "}
                        -{" "}
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
                        {take.team ? `, ${take.team}` : ""}
                      </p>
                      <p className="mt-2 text-sm text-zinc-600">
                        {take.sourceTitle} -{" "}
                        {formatDate(take.publishDate ?? take.publishedAt)}
                      </p>
                      <p className="mt-3 text-sm text-zinc-600">{take.excerpt}</p>
                    </div>
                    <div className="rounded-md border border-zinc-200 bg-white p-4">
                      <TakeOutcomeGradeForm
                        expertTakeId={take.id}
                        gradeOptions={dashboard.gradeOptions}
                        outcomeTypeOptions={dashboard.outcomeTypeOptions}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="No current takes are awaiting manual grading." />
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

function RecentlyGradedList({
  outcomes,
}: {
  outcomes: GradingDashboard["recentlyGradedTakes"];
}) {
  if (outcomes.length === 0) {
    return <EmptyState message="No takes have been manually graded yet." />;
  }

  return (
    <div className="grid gap-3">
      {outcomes.map((outcome) => (
        <div
          className="rounded-md border border-zinc-200 bg-zinc-50 p-3"
          key={outcome.id}
        >
          <div className="flex flex-wrap items-center gap-2">
            <GradeBadge label={outcome.grade} />
            <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-zinc-700">
              {formatEnumLabel(outcome.outcomeType)}
            </span>
          </div>
          <p className="mt-2 font-semibold text-zinc-950">{outcome.summary}</p>
          <p className="mt-1 text-sm text-zinc-600">
            {outcome.expertName} - {outcome.playerName} -{" "}
            {formatDate(outcome.updatedAt)}
          </p>
        </div>
      ))}
    </div>
  );
}

function GradedExpertList({
  experts,
}: {
  experts: GradingDashboard["expertsWithGradedAccuracy"];
}) {
  if (experts.length === 0) {
    return <EmptyState message="No expert accuracy snapshots exist yet." />;
  }

  return (
    <div className="grid gap-3">
      {experts.map((expert) => (
        <Link
          className="rounded-md border border-zinc-200 bg-zinc-50 p-3 transition hover:border-emerald-200 hover:bg-emerald-50"
          href={`/knowledge-brain/experts/${expert.expertId}`}
          key={`${expert.expertId}-${expert.season}`}
        >
          <p className="font-semibold text-zinc-950">{expert.expertName}</p>
          <p className="mt-1 text-sm text-zinc-600">
            {expert.accuracyRate}% on {expert.totalGraded} graded take
            {expert.totalGraded === 1 ? "" : "s"} in {expert.season}
          </p>
          <p className="mt-1 text-xs font-semibold uppercase text-zinc-500">
            Correct {expert.correctCount}, Partial {expert.partialCount},
            Incorrect {expert.incorrectCount}, Push {expert.pushCount}
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

function GradeBadge({ label }: { label: string }) {
  const tone =
    label === "CORRECT"
      ? "bg-emerald-100 text-emerald-800"
      : label === "PARTIALLY_CORRECT"
        ? "bg-blue-100 text-blue-800"
        : label === "INCORRECT"
          ? "bg-red-100 text-red-800"
          : label === "PUSH"
            ? "bg-amber-100 text-amber-900"
            : "bg-zinc-200 text-zinc-700";

  return (
    <span className={`rounded-md px-2 py-1 text-xs font-semibold ${tone}`}>
      {formatEnumLabel(label)}
    </span>
  );
}

function getSentimentTone(sentiment: string) {
  if (sentiment === "BULLISH") return "bg-emerald-100 text-emerald-800";
  if (sentiment === "BEARISH") return "bg-red-100 text-red-800";

  return "bg-zinc-200 text-zinc-700";
}

function getFreshnessTone(freshness: string) {
  if (freshness === "CURRENT" || freshness === "RECENT") {
    return "bg-emerald-100 text-emerald-800";
  }

  if (freshness === "ARCHIVED") return "bg-zinc-200 text-zinc-700";

  return "bg-amber-100 text-amber-900";
}

function formatDate(value: Date | null) {
  if (!value) return "Unknown date";

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
