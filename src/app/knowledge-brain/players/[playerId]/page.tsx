import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlayerExpertConsensusBreakdown } from "@/knowledge-brain/expert-consensus";
import { getPlayerIntelligenceProfile } from "@/knowledge-brain/player-intelligence";

export const dynamic = "force-dynamic";

type PlayerIntelligenceProfilePageProps = {
  params: Promise<{
    playerId: string;
  }>;
  searchParams: Promise<{
    freshness?: string;
    includeHistorical?: string;
    targetSeason?: string;
  }>;
};

export default async function PlayerIntelligenceProfilePage({
  params,
  searchParams,
}: PlayerIntelligenceProfilePageProps) {
  const { playerId } = await params;
  const filters = await searchParams;
  const profile = await getPlayerIntelligenceProfile(playerId, {
    freshness: filters.freshness,
    includeHistorical: filters.includeHistorical === "true",
    targetSeason: filters.targetSeason,
  });
  const expertConsensus = await getPlayerExpertConsensusBreakdown({
    playerId,
    includeHistorical: filters.includeHistorical === "true",
    targetSeason: filters.targetSeason,
  });

  if (!profile) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-stone-50">
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-wrap gap-3">
            <Link
              className="text-sm font-semibold text-emerald-700 hover:text-emerald-900"
              href={`/knowledge-brain/players?targetSeason=${profile.filters.targetSeason}&freshness=${profile.filters.freshness}${profile.filters.includeHistorical ? "&includeHistorical=true" : ""}`}
            >
              Back to player directory
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
                Player Intelligence Profile
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal text-zinc-950 sm:text-4xl">
                {profile.player.fullName}
              </h1>
              <p className="mt-2 text-sm font-medium text-zinc-600">
                {profile.player.position}
                {profile.player.team ? `, ${profile.player.team}` : ""}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <SummaryItem
                label="Score"
                value={`${profile.summary.intelligenceScore}`}
              />
              <SummaryItem
                label="Label"
                value={profile.summary.intelligenceLabel}
              />
              <SummaryItem
                label="Trend"
                value={formatEnumLabel(profile.summary.trendDirection)}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-5 sm:px-6 lg:px-8">
        <Card title="Freshness Scope">
          <form
            action={`/knowledge-brain/players/${profile.player.id}`}
            className="grid gap-3 md:grid-cols-[160px_180px_minmax(0,1fr)_auto]"
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
            <label className="grid gap-1 text-sm font-semibold text-zinc-700">
              Freshness
              <select
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
                defaultValue={profile.filters.freshness}
                name="freshness"
              >
                <option value="ALL">All included</option>
                {profile.filters.freshnessOptions.map((freshness) => (
                  <option key={freshness} value={freshness}>
                    {formatEnumLabel(freshness)}
                  </option>
                ))}
              </select>
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
          <p className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600">
            This profile is using{" "}
            {profile.filters.includeHistorical
              ? "all matching historical data"
              : "current-analysis content only"}
            . Target season: {profile.filters.targetSeason}.
          </p>
          {!profile.filters.includeHistorical &&
          profile.excludedHistoricalCount > 0 ? (
            <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
              {profile.excludedHistoricalCount} stale, historical, or archived
              take{profile.excludedHistoricalCount === 1 ? "" : "s"} are
              preserved but excluded from this profile.
            </p>
          ) : null}
        </Card>

        <section className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          <Card title="Identity">
            <div className="grid gap-3">
              <SummaryItem label="Player" value={profile.player.fullName} />
              <SummaryItem label="Position" value={profile.player.position} />
              <SummaryItem label="NFL Team" value={profile.player.team ?? "--"} />
            </div>
          </Card>

          <Card title="Sentiment Summary">
            <div className="grid gap-3 md:grid-cols-4">
              <Metric
                label="Total Mentions"
                value={String(profile.summary.totalMentions)}
              />
              <Metric
                label="Bullish"
                value={`${profile.summary.bullishCount} (${profile.sentimentPercentages.bullish}%)`}
                tone="bullish"
              />
              <Metric
                label="Bearish"
                value={`${profile.summary.bearishCount} (${profile.sentimentPercentages.bearish}%)`}
                tone="bearish"
              />
              <Metric
                label="Neutral"
                value={`${profile.summary.neutralCount} (${profile.sentimentPercentages.neutral}%)`}
              />
            </div>
            <div className="mt-4 grid gap-2">
              <SentimentBar
                label="Bullish"
                percent={profile.sentimentPercentages.bullish}
                tone="bullish"
              />
              <SentimentBar
                label="Bearish"
                percent={profile.sentimentPercentages.bearish}
                tone="bearish"
              />
              <SentimentBar
                label="Neutral"
                percent={profile.sentimentPercentages.neutral}
              />
            </div>
          </Card>
        </section>

        <Card title="Consensus Readiness">
          {expertConsensus.row ? (
            <div className="grid gap-3 md:grid-cols-[260px_minmax(0,1fr)]">
              <div className="grid gap-3">
                <SummaryItem
                  label="Consensus Status"
                  value={expertConsensus.row.consensusLabel}
                />
                <SummaryItem
                  label="Expert Coverage"
                  value={`${expertConsensus.row.totalExperts} expert${
                    expertConsensus.row.totalExperts === 1 ? "" : "s"
                  }, ${expertConsensus.row.totalMentions} mention${
                    expertConsensus.row.totalMentions === 1 ? "" : "s"
                  }`}
                />
              </div>
              <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4">
                {expertConsensus.row.earlySignal ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-md px-2 py-1 text-xs font-semibold ${getSignalTone(
                          expertConsensus.row.earlySignal.sentimentLean,
                        )}`}
                      >
                        Early Signal:{" "}
                        {expertConsensus.row.earlySignal.sentimentLean}
                      </span>
                      <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-zinc-700">
                        Not Enough Data
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-zinc-600">
                      {expertConsensus.row.earlySignal.reason}
                    </p>
                    <p className="mt-2 text-sm text-zinc-600">
                      Add current-season takes from another expert or more
                      mentions from existing experts to promote this from an
                      early signal into true consensus.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-md px-2 py-1 text-xs font-semibold ${getSentimentTone(
                          expertConsensus.row.consensusLabel,
                        )}`}
                      >
                        {expertConsensus.row.consensusLabel}
                      </span>
                      <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-zinc-700">
                        {expertConsensus.row.agreementScore}% agreement
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-zinc-600">
                      This player has enough current expert coverage for the
                      strict consensus rules.
                    </p>
                  </>
                )}
              </div>
            </div>
          ) : (
            <EmptyState message="No current expert takes have been extracted for consensus yet." />
          )}
        </Card>

        <Card title="Expert Breakdown">
          {expertConsensus.experts.length > 0 ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {expertConsensus.experts.map((expert) => (
                <div
                  className="rounded-md border border-zinc-200 bg-zinc-50 p-4"
                  key={expert.expertId}
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <Link
                        className="font-semibold text-emerald-700 hover:text-emerald-900"
                        href={`/knowledge-brain/experts/${expert.expertId}?targetSeason=${profile.filters.targetSeason}${profile.filters.includeHistorical ? "&includeHistorical=true" : ""}`}
                      >
                        {expert.expertName}
                      </Link>
                      <p className="text-sm text-zinc-600">
                        {expert.mentionCount} mention
                        {expert.mentionCount === 1 ? "" : "s"}
                      </p>
                    </div>
                    <span
                      className={`rounded-md px-2 py-1 text-xs font-semibold ${getSentimentTone(
                        expert.stance,
                      )}`}
                    >
                      {formatEnumLabel(expert.stance)}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <Metric
                      label="Bullish"
                      value={String(expert.bullishCount)}
                      tone="bullish"
                    />
                    <Metric
                      label="Bearish"
                      value={String(expert.bearishCount)}
                      tone="bearish"
                    />
                    <Metric
                      label="Neutral"
                      value={String(expert.neutralCount)}
                    />
                  </div>
                  {expert.latestTake ? (
                    <div className="mt-3 rounded-md border border-zinc-200 bg-white p-3 text-sm">
                      <p className="font-semibold text-zinc-950">
                        {expert.latestTake.summary}
                      </p>
                      <p className="mt-1 text-zinc-600">
                        {expert.latestTake.sourceTitle} -{" "}
                        {formatDate(
                          expert.latestTake.publishedAt ??
                            expert.latestTake.createdAt,
                        )}
                      </p>
                    </div>
                  ) : (
                    <div className="mt-3">
                      <EmptyState message="No takes from this expert yet." />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="No experts have current consensus takes for this player yet." />
          )}
        </Card>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_380px]">
          <Card title="Recent Takes">
            {profile.recentTakes.length > 0 ? (
              <div className="grid gap-3">
                {profile.recentTakes.map((take) => (
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
                      <span
                        className={`rounded-md px-2 py-1 text-xs font-semibold ${getFreshnessTone(
                          take.freshnessLabel,
                        )}`}
                      >
                        {formatEnumLabel(take.freshnessLabel)}
                      </span>
                    </div>
                    <p className="mt-3 font-semibold text-zinc-950">
                      {take.summary}
                    </p>
                    <p className="mt-1 text-sm text-zinc-600">
                      {take.expertName} - {take.sourceTitle} -{" "}
                      {formatDate(take.publishedAt ?? take.createdAt)}
                    </p>
                    <p className="mt-3 text-sm text-zinc-600">{take.excerpt}</p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState message="No recent takes have been extracted for this player." />
            )}
          </Card>

          <Card title="Trend Analysis">
            <div className="grid gap-3">
              <Metric
                label="Trend Direction"
                value={formatEnumLabel(profile.trendAnalysis.direction)}
              />
              <Metric
                label="Bullish Trend"
                value={String(profile.trendAnalysis.bullishTrend)}
                tone="bullish"
              />
              <Metric
                label="Bearish Trend"
                value={String(profile.trendAnalysis.bearishTrend)}
                tone="bearish"
              />
            </div>
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-zinc-950">
                Mention Volume Over Time
              </h3>
              {profile.trendAnalysis.mentionVolume.length > 0 ? (
                <div className="mt-3 grid gap-2">
                  {profile.trendAnalysis.mentionVolume.map((entry) => (
                    <div
                      className="grid grid-cols-[110px_minmax(0,1fr)_40px] items-center gap-2 text-sm"
                      key={entry.date}
                    >
                      <span className="font-medium text-zinc-600">
                        {entry.date}
                      </span>
                      <div className="h-2 rounded-full bg-zinc-100">
                        <div
                          className="h-2 rounded-full bg-emerald-600"
                          style={{
                            width: `${Math.min(entry.count * 20, 100)}%`,
                          }}
                        />
                      </div>
                      <span className="text-right font-semibold text-zinc-950">
                        {entry.count}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3">
                  <EmptyState message="No mention volume is available yet." />
                </div>
              )}
            </div>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <Card title="Reasons For Bullishness">
            <ReasonList
              emptyMessage="No bullish themes have been detected yet."
              reasons={profile.reasonsForBullishness}
              tone="bullish"
            />
          </Card>
          <Card title="Reasons For Bearishness">
            <ReasonList
              emptyMessage="No bearish themes have been detected yet."
              reasons={profile.reasonsForBearishness}
              tone="bearish"
            />
          </Card>
        </section>
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

function Metric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "bullish" | "bearish" | "neutral";
}) {
  const toneClass = {
    bullish: "border-emerald-200 bg-emerald-50 text-emerald-800",
    bearish: "border-red-200 bg-red-50 text-red-800",
    neutral: "border-zinc-200 bg-zinc-50 text-zinc-950",
  }[tone];

  return (
    <div className={`rounded-md border px-3 py-2 ${toneClass}`}>
      <p className="text-xs font-semibold uppercase opacity-80">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function SentimentBar({
  label,
  percent,
  tone = "neutral",
}: {
  label: string;
  percent: number;
  tone?: "bullish" | "bearish" | "neutral";
}) {
  const toneClass = {
    bullish: "bg-emerald-600",
    bearish: "bg-red-600",
    neutral: "bg-zinc-500",
  }[tone];

  return (
    <div>
      <div className="flex items-center justify-between text-xs font-semibold uppercase text-zinc-500">
        <span>{label}</span>
        <span>{percent}%</span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-zinc-100">
        <div
          className={`h-2 rounded-full ${toneClass}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function ReasonList({
  reasons,
  emptyMessage,
  tone,
}: {
  reasons: Array<{
    key: string;
    label: string;
    count: number;
  }>;
  emptyMessage: string;
  tone: "bullish" | "bearish";
}) {
  if (reasons.length === 0) {
    return <EmptyState message={emptyMessage} />;
  }

  return (
    <div className="grid gap-2">
      {reasons.map((reason) => (
        <div
          className={`rounded-md border p-3 ${
            tone === "bullish"
              ? "border-emerald-200 bg-emerald-50"
              : "border-red-200 bg-red-50"
          }`}
          key={reason.key}
        >
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold text-zinc-950">{reason.label}</p>
            <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-zinc-700">
              {reason.count}
            </span>
          </div>
        </div>
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

function getSentimentTone(sentiment: string) {
  if (sentiment === "BULLISH") return "bg-emerald-100 text-emerald-800";
  if (sentiment === "BEARISH") return "bg-red-100 text-red-800";
  if (sentiment.includes("Bullish")) return "bg-emerald-100 text-emerald-800";
  if (sentiment.includes("Bearish")) return "bg-red-100 text-red-800";
  if (sentiment === "MIXED") return "bg-amber-100 text-amber-900";

  return "bg-zinc-200 text-zinc-700";
}

function getSignalTone(signal: string) {
  if (signal === "Bullish") return "bg-emerald-100 text-emerald-800";
  if (signal === "Bearish") return "bg-red-100 text-red-800";

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
    .map((part) => `${part.charAt(0)}${part.slice(1)}`)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}
