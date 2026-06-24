import Link from "next/link";
import { getExpertAccuracyDirectory } from "@/knowledge-brain/expert-accuracy";

export const dynamic = "force-dynamic";

type ExpertDirectoryPageProps = {
  searchParams: Promise<{
    includeHistorical?: string;
    targetSeason?: string;
  }>;
};

type ExpertAccuracyDirectory = Awaited<
  ReturnType<typeof getExpertAccuracyDirectory>
>;
type ExpertAccuracyRow = ExpertAccuracyDirectory["experts"][number];

export default async function ExpertDirectoryPage({
  searchParams,
}: ExpertDirectoryPageProps) {
  const filters = await searchParams;
  const directory = await getExpertAccuracyDirectory({
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
              href="/knowledge-brain/consensus"
            >
              Expert Consensus
            </Link>
          </div>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-emerald-700">
                Expert Accuracy
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal text-zinc-950 sm:text-4xl">
                Expert Directory
              </h1>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <SummaryItem
                label="Experts"
                value={String(directory.experts.length)}
              />
              <SummaryItem
                label="Ready"
                value={String(directory.widgets.readyForGrading.length)}
              />
              <SummaryItem
                label="Season"
                value={String(directory.filters.targetSeason)}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-5 sm:px-6 lg:px-8">
        <Card title="Filters">
          <form
            action="/knowledge-brain/experts"
            className="grid gap-3 md:grid-cols-[160px_minmax(0,1fr)_auto]"
          >
            <label className="grid gap-1 text-sm font-semibold text-zinc-700">
              Target Season
              <input
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
                defaultValue={String(directory.filters.targetSeason)}
                min="2000"
                name="targetSeason"
                type="number"
              />
            </label>
            <label className="flex items-end gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm font-semibold text-zinc-700">
              <input
                className="h-4 w-4"
                defaultChecked={directory.filters.includeHistorical}
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
                href="/knowledge-brain/experts"
              >
                Reset
              </Link>
            </div>
          </form>
        </Card>

        <section className="grid gap-4 xl:grid-cols-4">
          <ExpertWidget
            emptyMessage="No active experts yet."
            experts={directory.widgets.mostActiveExperts}
            title="Most Active Experts"
          />
          <ExpertWidget
            emptyMessage="No bullish takes yet."
            experts={directory.widgets.mostBullishExperts}
            metric="bullish"
            title="Most Bullish Takes"
          />
          <ExpertWidget
            emptyMessage="No bearish takes yet."
            experts={directory.widgets.mostBearishExperts}
            metric="bearish"
            title="Most Bearish Takes"
          />
          <ExpertWidget
            emptyMessage="No experts are ready for grading yet."
            experts={directory.widgets.readyForGrading}
            metric="eligible"
            title="Ready For Accuracy Grading"
          />
        </section>

        <Card title="Expert Directory">
          {directory.experts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-xs uppercase text-zinc-500">
                    <th className="py-2 pr-4 font-semibold">Expert</th>
                    <th className="py-2 pr-4 font-semibold">Active</th>
                    <th className="py-2 pr-4 font-semibold">Total Takes</th>
                    <th className="py-2 pr-4 font-semibold">Current</th>
                    <th className="py-2 pr-4 font-semibold">Bullish</th>
                    <th className="py-2 pr-4 font-semibold">Bearish</th>
                    <th className="py-2 pr-4 font-semibold">Neutral</th>
                    <th className="py-2 pr-4 font-semibold">Players</th>
                    <th className="py-2 pr-4 font-semibold">Positions</th>
                    <th className="py-2 font-semibold">Accuracy Status</th>
                  </tr>
                </thead>
                <tbody>
                  {directory.experts.map((expert) => (
                    <tr className="border-b border-zinc-100" key={expert.expertId}>
                      <td className="py-3 pr-4 font-semibold">
                        <Link
                          className="text-emerald-700 hover:text-emerald-900"
                          href={getExpertProfileHref(expert, directory.filters)}
                        >
                          {expert.expertName}
                        </Link>
                      </td>
                      <td className="py-3 pr-4">
                        <StatusBadge
                          label={expert.active ? "Active" : "Inactive"}
                        />
                      </td>
                      <td className="py-3 pr-4 text-zinc-700">
                        {expert.totalTakes}
                      </td>
                      <td className="py-3 pr-4 text-zinc-700">
                        {expert.currentSeasonTakes}
                      </td>
                      <td className="py-3 pr-4 text-emerald-700">
                        {expert.bullishTakes}
                      </td>
                      <td className="py-3 pr-4 text-red-700">
                        {expert.bearishTakes}
                      </td>
                      <td className="py-3 pr-4 text-zinc-700">
                        {expert.neutralTakes}
                      </td>
                      <td className="py-3 pr-4 text-zinc-700">
                        {expert.playerCoverageCount}
                      </td>
                      <td className="py-3 pr-4 text-zinc-700">
                        {formatCoverage(expert.positionCoverage)}
                      </td>
                      <td className="py-3">
                        <AccuracyStatusBadge label={expert.accuracyStatus} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState message="No experts are available yet." />
          )}
        </Card>

        <Card title="Take Tracking">
          {directory.experts.length > 0 ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {directory.experts.map((expert) => (
                <TakeTrackingCard
                  expert={expert}
                  filters={directory.filters}
                  key={expert.expertId}
                />
              ))}
            </div>
          ) : (
            <EmptyState message="No expert takes are available for tracking yet." />
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

function ExpertWidget({
  title,
  experts,
  emptyMessage,
  metric = "takes",
}: {
  title: string;
  experts: ExpertAccuracyRow[];
  emptyMessage: string;
  metric?: "takes" | "bullish" | "bearish" | "eligible";
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
                {getWidgetMetric(expert, metric)}
              </p>
              <div className="mt-2">
                <AccuracyStatusBadge label={expert.accuracyStatus} />
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

function TakeTrackingCard({
  expert,
  filters,
}: {
  expert: ExpertAccuracyRow;
  filters: ExpertAccuracyDirectory["filters"];
}) {
  return (
    <Link
      className="rounded-md border border-zinc-200 bg-zinc-50 p-4 transition hover:border-emerald-200 hover:bg-emerald-50"
      href={getExpertProfileHref(expert, filters)}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-semibold text-zinc-950">{expert.expertName}</p>
          <p className="mt-1 text-sm text-zinc-600">
            {expert.accuracyStatusDetail}
          </p>
        </div>
        <AccuracyStatusBadge label={expert.accuracyStatus} />
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <Metric
          label="Awaiting Grade"
          value={String(expert.takeTracking.awaitingOutcomeGrading)}
        />
        <Metric
          label="Eligible"
          value={String(expert.takeTracking.eligibleForFutureGrading)}
        />
        <Metric
          label="High Conviction"
          value={String(expert.takeTracking.highConvictionCount)}
        />
      </div>
      <p className="mt-3 text-sm text-zinc-600">
        Active positions: {formatCoverage(expert.takeTracking.mostActivePositions)}
      </p>
      <p className="mt-1 text-sm text-zinc-600">
        Active take types: {formatCoverage(expert.takeTracking.mostActiveTakeTypes)}
      </p>
    </Link>
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

function StatusBadge({ label }: { label: string }) {
  const tone =
    label === "Active"
      ? "bg-emerald-100 text-emerald-800"
      : "bg-zinc-200 text-zinc-700";

  return (
    <span className={`rounded-md px-2 py-1 text-xs font-semibold ${tone}`}>
      {label}
    </span>
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

function getWidgetMetric(
  expert: ExpertAccuracyRow,
  metric: "takes" | "bullish" | "bearish" | "eligible",
) {
  if (metric === "bullish") {
    return `${expert.bullishTakes} bullish take${
      expert.bullishTakes === 1 ? "" : "s"
    }`;
  }

  if (metric === "bearish") {
    return `${expert.bearishTakes} bearish take${
      expert.bearishTakes === 1 ? "" : "s"
    }`;
  }

  if (metric === "eligible") {
    return `${expert.takeTracking.eligibleForFutureGrading} eligible take${
      expert.takeTracking.eligibleForFutureGrading === 1 ? "" : "s"
    }`;
  }

  return `${expert.takeCount} scoped take${expert.takeCount === 1 ? "" : "s"}`;
}

function getExpertProfileHref(
  expert: ExpertAccuracyRow,
  filters: ExpertAccuracyDirectory["filters"],
) {
  return `/knowledge-brain/experts/${expert.expertId}?targetSeason=${
    filters.targetSeason
  }${filters.includeHistorical ? "&includeHistorical=true" : ""}`;
}

function formatCoverage(items: Array<{ key: string; count: number }>) {
  if (items.length === 0) return "--";

  return items
    .slice(0, 4)
    .map((item) => `${formatEnumLabel(item.key)} ${item.count}`)
    .join(", ");
}

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}
