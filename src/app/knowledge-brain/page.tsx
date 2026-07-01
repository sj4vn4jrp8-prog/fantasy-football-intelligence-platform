import Link from "next/link";
import { ExpertManagementPanel } from "@/components/knowledge-brain/ExpertManagementPanel";
import { FindTranscriptsButton } from "@/components/knowledge-brain/FindTranscriptsButton";
import { ManualTranscriptForm } from "@/components/knowledge-brain/ManualTranscriptForm";
import { getExpertAccuracyDirectory } from "@/knowledge-brain/expert-accuracy";
import { getExpertConsensusDashboard } from "@/knowledge-brain/expert-consensus";
import { getExpertMemoryDashboard } from "@/knowledge-brain/expert-memory";
import {
  getExpertsWithGradedAccuracy,
  getRecentlyGradedTakes,
} from "@/knowledge-brain/expert-outcomes";
import { getTrustEngineDashboard } from "@/knowledge-brain/trust-engine";
import { getKnowledgeBrainDashboard } from "@/lib/knowledge-brain";

export const dynamic = "force-dynamic";

type KnowledgeBrainPageProps = {
  searchParams: Promise<{
    freshness?: string;
    includeHistorical?: string;
    targetSeason?: string;
  }>;
};

export default async function KnowledgeBrainPage({
  searchParams,
}: KnowledgeBrainPageProps) {
  const filters = await searchParams;
  const dashboard = await getKnowledgeBrainDashboard({
    freshness: filters.freshness,
    includeHistorical: filters.includeHistorical === "true",
    targetSeason: filters.targetSeason,
  });
  const consensus = await getExpertConsensusDashboard({
    includeHistorical: filters.includeHistorical === "true",
    targetSeason: filters.targetSeason,
  });
  const trustDashboard = await getTrustEngineDashboard({
    includeHistorical: filters.includeHistorical === "true",
    targetSeason: filters.targetSeason,
  });
  const expertMemory = await getExpertMemoryDashboard({
    includeHistorical: filters.includeHistorical === "true",
    targetSeason: filters.targetSeason,
  });
  const expertAccuracy = await getExpertAccuracyDirectory({
    includeHistorical: filters.includeHistorical === "true",
    targetSeason: filters.targetSeason,
  });
  const recentlyGradedTakes = await getRecentlyGradedTakes(5);
  const expertsWithGradedAccuracy = await getExpertsWithGradedAccuracy(5);
  const expertOptions = dashboard.experts.map((expert) => ({
    id: expert.id,
    name: expert.name,
    active: expert.active,
  }));
  const expertManagementItems = dashboard.experts.map((expert) => ({
    id: expert.id,
    name: expert.name,
    active: expert.active,
    notes: expert.notes,
    tags: expert.tags,
    channels: expert.channels.map((channel) => ({
      id: channel.id,
      url: channel.url,
    })),
    _count: expert._count,
  }));

  return (
    <main className="min-h-screen bg-stone-50">
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
          <Link
            className="text-sm font-semibold text-emerald-700 hover:text-emerald-900"
            href="/"
          >
            Back to command center
          </Link>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-emerald-700">
                Knowledge Brain
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal text-zinc-950 sm:text-4xl">
                Expert Insight Command Center
              </h1>
            </div>
            <div className="grid gap-3">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-12">
                <Link
                  className="inline-flex h-10 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
                  href="/knowledge-brain/ask"
                >
                  Ask the Brain
                </Link>
                <Link
                  className="inline-flex h-10 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
                  href="/knowledge-brain/review"
                >
                  Review Intelligence
                </Link>
                <Link
                  className="inline-flex h-10 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
                  href="/knowledge-brain/trust"
                >
                  Trust Engine
                </Link>
                <Link
                  className="inline-flex h-10 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
                  href="/decision-engine"
                >
                  Decision Engine
                </Link>
                <Link
                  className="inline-flex h-10 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
                  href="/knowledge-brain/history"
                >
                  Time Machine
                </Link>
                <Link
                  className="inline-flex h-10 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100"
                  href="/knowledge-brain/player-compare"
                >
                  Compare Players
                </Link>
                <Link
                  className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50"
                  href="/knowledge-brain/players"
                >
                  Open Player Intelligence
                </Link>
                <Link
                  className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50"
                  href="/knowledge-brain/import-markdown"
                >
                  Import Markdown Transcript
                </Link>
                <Link
                  className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50"
                  href="/knowledge-brain/import-markdown/bulk"
                >
                  Bulk Import
                </Link>
                <Link
                  className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50"
                  href="/knowledge-brain/consensus"
                >
                  Expert Consensus
                </Link>
                <Link
                  className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50"
                  href="/knowledge-brain/experts"
                >
                  Expert Accuracy
                </Link>
                <Link
                  className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50"
                  href="/knowledge-brain/experts/manage"
                >
                  Manage Experts
                </Link>
                <Link
                  className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50"
                  href="/knowledge-brain/grading"
                >
                  Grade Takes
                </Link>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <SummaryItem
                  label="Experts"
                  value={String(dashboard.experts.length)}
                />
                <SummaryItem
                  label="Included Transcripts"
                  value={String(dashboard.transcriptStats.includedTranscripts)}
                />
                <SummaryItem
                  label="Total Transcripts"
                  value={String(dashboard.transcriptStats.totalTranscripts)}
                />
                <SummaryItem
                  label="Latest Takes"
                  value={String(dashboard.latestExpertTakes.length)}
                />
                <SummaryItem
                  label="Excluded Old"
                  value={String(
                    dashboard.transcriptStats.excludedOldHistoricalTranscripts,
                  )}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-5 sm:px-6 lg:px-8">
        <Card title="Freshness Controls">
          <form
            action="/knowledge-brain"
            className="grid gap-3 md:grid-cols-[160px_180px_minmax(0,1fr)_auto]"
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
            <label className="grid gap-1 text-sm font-semibold text-zinc-700">
              Freshness
              <select
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
                defaultValue={dashboard.filters.freshness}
                name="freshness"
              >
                <option value="ALL">All included</option>
                {dashboard.filters.freshnessOptions.map((freshness) => (
                  <option key={freshness} value={freshness}>
                    {formatEnumLabel(freshness)}
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
                href="/knowledge-brain"
              >
                Reset
              </Link>
            </div>
          </form>
          {!dashboard.filters.includeHistorical &&
          dashboard.transcriptStats.excludedOldHistoricalTranscripts > 0 ? (
            <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
              {dashboard.transcriptStats.excludedOldHistoricalTranscripts} stale,
              historical, or archived transcript
              {dashboard.transcriptStats.excludedOldHistoricalTranscripts === 1
                ? ""
                : "s"}{" "}
              are preserved but excluded from current intelligence.
            </p>
          ) : null}
        </Card>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_380px]">
          <Card title="Manual Transcript Ingestion">
            <ManualTranscriptForm experts={expertOptions} />
          </Card>

          <div className="grid gap-4">
            <Card title="Transcript Sources">
              <div className="grid gap-3">
                {dashboard.sourceStatuses.map((source) => (
                  <div
                    className="rounded-md border border-zinc-200 bg-zinc-50 p-3"
                    key={source.source}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-zinc-950">
                        {formatEnumLabel(source.source)}
                      </p>
                      <span
                        className={`rounded-md px-2 py-1 text-xs font-semibold ${
                          source.active
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-900"
                        }`}
                      >
                        {source.active ? "Active" : "Scaffolded"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-zinc-600">
                      {source.message}
                    </p>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Discovery">
              <div className="grid gap-3">
                <FindTranscriptsButton />
                <Link
                  className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50"
                  href="/knowledge-brain/import-markdown"
                >
                  Import local Markdown
                </Link>
                <Link
                  className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50"
                  href="/knowledge-brain/import-markdown/bulk"
                >
                  Bulk import files
                </Link>
                <Link
                  className="inline-flex h-10 items-center justify-center rounded-md border border-amber-300 bg-amber-50 px-4 text-sm font-semibold text-amber-950 transition hover:bg-amber-100"
                  href="/knowledge-brain/review"
                >
                  Review summaries or reprocess
                </Link>
              </div>
            </Card>
          </div>
        </section>

        <Card title="Expert Management">
          <ExpertManagementPanel experts={expertManagementItems} />
        </Card>

        <section className="grid gap-4 xl:grid-cols-4">
          <ExpertAccuracyHighlightCard
            emptyMessage="No expert takes yet."
            experts={expertAccuracy.widgets.mostActiveExperts}
            title="Most Active Experts"
          />
          <ExpertAccuracyHighlightCard
            emptyMessage="No bullish expert takes yet."
            experts={expertAccuracy.widgets.mostBullishExperts}
            metric="bullish"
            title="Experts With Most Bullish Takes"
          />
          <ExpertAccuracyHighlightCard
            emptyMessage="No bearish expert takes yet."
            experts={expertAccuracy.widgets.mostBearishExperts}
            metric="bearish"
            title="Experts With Most Bearish Takes"
          />
          <ExpertAccuracyHighlightCard
            emptyMessage="No experts are ready for grading yet."
            experts={expertAccuracy.widgets.readyForGrading}
            metric="eligible"
            title="Experts Ready For Accuracy Grading"
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <RecentlyGradedTakesCard outcomes={recentlyGradedTakes} />
          <GradedAccuracyCard experts={expertsWithGradedAccuracy} />
        </section>

        <section className="grid gap-4 xl:grid-cols-4">
          <TrustHighlightCard
            emptyMessage="No player trust profiles yet."
            players={trustDashboard.widgets.strongestPlayerTrust}
            title="Strongest Trusted Player Signals"
          />
          <TrustHighlightCard
            emptyMessage="No high-trust split signals yet."
            players={trustDashboard.playerProfiles
              .filter(
                (profile) =>
                  profile.playerTrustScore >= 55 &&
                  profile.disagreementWarnings.length > 0,
              )
              .sort(
                (profileA, profileB) =>
                  profileB.playerTrustScore - profileA.playerTrustScore,
              )
              .slice(0, 5)}
            title="High Trust, Split Evidence"
          />
          <MemoryHighlightCard
            emptyMessage="No rising Expert Memory yet."
            memories={[
              ...expertMemory.widgets.increasingBullish,
              ...expertMemory.widgets.increasingBearish,
            ]
              .sort(
                (memoryA, memoryB) =>
                  memoryB.memory.convictionScore -
                  memoryA.memory.convictionScore,
              )
              .slice(0, 5)}
            title="Rising Expert Memory"
          />
          <TrustHighlightCard
            emptyMessage="No low-trust warnings yet."
            players={trustDashboard.widgets.mostQuestionablePlayerTrust}
            title="Low-Trust Warnings"
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-4">
          <ConsensusHighlightCard
            emptyMessage="No consensus rows yet."
            rows={consensus.widgets.strongestConsensus}
            title="Strongest Expert Consensus"
          />
          <ConsensusHighlightCard
            emptyMessage="No split players yet."
            rows={consensus.widgets.mostDivisivePlayers}
            title="Most Divisive Players"
          />
          <ConsensusHighlightCard
            emptyMessage="No bullish agreement yet."
            rows={consensus.widgets.mostBullishAgreement}
            title="Most Bullish Expert Agreement"
          />
          <ConsensusHighlightCard
            emptyMessage="No bearish agreement yet."
            rows={consensus.widgets.mostBearishAgreement}
            title="Most Bearish Expert Agreement"
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-4">
          <IntelligenceHighlightCard
            emptyMessage="No bullish intelligence yet."
            players={dashboard.playerIntelligenceHighlights.topBullishPlayers}
            title="Top Bullish Players"
          />
          <IntelligenceHighlightCard
            emptyMessage="No bearish intelligence yet."
            players={dashboard.playerIntelligenceHighlights.topBearishPlayers}
            title="Top Bearish Players"
          />
          <IntelligenceHighlightCard
            description="Counts how many unique experts have discussed the player."
            emptyMessage="No discussed players yet."
            players={dashboard.playerIntelligenceHighlights.mostDiscussedPlayers}
            title="Most Covered Players (Expert Coverage)"
          />
          <IntelligenceHighlightCard
            emptyMessage="No recent player trends yet."
            players={dashboard.playerIntelligenceHighlights.trendingPlayers}
            title="Trending Players"
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <Card title="Most Mentioned Players (Raw Mentions)">
            <p className="mb-3 text-sm text-zinc-600">
              Counts every player mention across all transcripts.
            </p>
            {dashboard.mostMentionedPlayers.length > 0 ? (
              <div className="grid gap-2">
                {dashboard.mostMentionedPlayers.map(({ player, count }) => (
                  <PlayerSignalRow
                    detail={`${count} mention${count === 1 ? "" : "s"}`}
                    key={player.id}
                    player={player}
                  />
                ))}
              </div>
            ) : (
              <EmptyState message="No player mentions have been extracted yet." />
            )}
          </Card>

          <Card title="Bullish Players">
            {dashboard.bullishPlayers.length > 0 ? (
              <div className="grid gap-2">
                {dashboard.bullishPlayers.map((signal) => (
                  <PlayerSignalRow
                    detail={`${signal.totalMentions} mention${
                      signal.totalMentions === 1 ? "" : "s"
                    }, ${signal.expertCount} expert${
                      signal.expertCount === 1 ? "" : "s"
                    }`}
                    key={signal.playerId}
                    player={signal}
                    tone="bullish"
                  />
                ))}
              </div>
            ) : (
              <EmptyState message="No bullish player trends yet." />
            )}
          </Card>

          <Card title="Bearish Players">
            {dashboard.bearishPlayers.length > 0 ? (
              <div className="grid gap-2">
                {dashboard.bearishPlayers.map((signal) => (
                  <PlayerSignalRow
                    detail={`${signal.totalMentions} mention${
                      signal.totalMentions === 1 ? "" : "s"
                    }, ${signal.expertCount} expert${
                      signal.expertCount === 1 ? "" : "s"
                    }`}
                    key={signal.playerId}
                    player={signal}
                    tone="bearish"
                  />
                ))}
              </div>
            ) : (
              <EmptyState message="No bearish player trends yet." />
            )}
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <Card title="Recent Transcripts">
            {dashboard.recentTranscripts.length > 0 ? (
              <div className="grid gap-3">
                {dashboard.recentTranscripts.map((transcript) => (
                  <div
                    className="rounded-md border border-zinc-200 bg-zinc-50 p-3"
                    key={transcript.id}
                  >
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-semibold text-zinc-950">
                          {transcript.sourceVideo.title}
                        </p>
                        <p className="text-sm text-zinc-600">
                          {transcript.sourceVideo.expert.name}
                        </p>
                      </div>
                      <span className="text-xs font-semibold uppercase text-zinc-500">
                        {formatDate(transcript.createdAt)}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <FreshnessBadge
                        label={transcript.freshnessLabel}
                        included={transcript.includeInCurrentAnalysis}
                      />
                      {transcript.contentSeason ? (
                        <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-zinc-700">
                          Season {transcript.contentSeason}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-zinc-600 sm:grid-cols-3">
                      <Metric label="Words" value={String(transcript.wordCount)} />
                      <Metric
                        label="Segments"
                        value={String(transcript._count.segments)}
                      />
                      <Metric
                        label="Takes"
                        value={String(transcript._count.expertTakes)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState message="No transcripts saved yet." />
            )}
          </Card>

          <Card title="Latest Expert Takes">
            {dashboard.latestExpertTakes.length > 0 ? (
              <div className="grid gap-3">
                {dashboard.latestExpertTakes.map((take) => (
                  <div
                    className="rounded-md border border-zinc-200 bg-zinc-50 p-3"
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
                    </div>
                    <p className="mt-2 font-semibold text-zinc-950">
                      {take.summary}
                    </p>
                    <p className="mt-1 text-sm text-zinc-600">
                      {take.expert.name}
                      {take.player ? ` - ${take.player.position}` : ""}
                      {take.player?.team ? `, ${take.player.team}` : ""}
                    </p>
                    <p className="mt-2 line-clamp-3 text-sm text-zinc-600">
                      {take.excerpt}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState message="No expert takes extracted yet." />
            )}
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <Card title="Uncategorized Transcripts Needing Review">
            {dashboard.uncategorizedTranscripts.length > 0 ? (
              <div className="grid gap-3">
                {dashboard.uncategorizedTranscripts.map((transcript) => (
                  <div
                    className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"
                    key={transcript.id}
                  >
                    <p className="font-semibold">
                      {transcript.sourceVideo.title}
                    </p>
                    <p className="mt-1">
                      {transcript.sourceVideo.expert.name} -{" "}
                      {transcript._count.expertTakes} extracted take
                      {transcript._count.expertTakes === 1 ? "" : "s"}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState message="No uncategorized transcripts are waiting for review." />
            )}
          </Card>

          <Card title="Recent Ingestion Runs">
            {dashboard.ingestionRuns.length > 0 ? (
              <div className="grid gap-2">
                {dashboard.ingestionRuns.map((run) => (
                  <div
                    className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm"
                    key={run.id}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-zinc-950">
                        {formatEnumLabel(run.source)}
                      </p>
                      <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-zinc-700">
                        {formatEnumLabel(run.status)}
                      </span>
                    </div>
                    <p className="mt-2 text-zinc-600">
                      {run.message ?? "No message recorded."}
                    </p>
                    <p className="mt-1 text-xs font-semibold uppercase text-zinc-500">
                      {formatDate(run.startedAt)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState message="No ingestion runs recorded yet." />
            )}
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

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600">
      {message}
    </div>
  );
}

function FreshnessBadge({
  label,
  included,
}: {
  label: string;
  included: boolean;
}) {
  const tone =
    label === "CURRENT" || label === "RECENT"
      ? "bg-emerald-100 text-emerald-800"
      : label === "ARCHIVED"
        ? "bg-zinc-200 text-zinc-700"
        : "bg-amber-100 text-amber-900";

  return (
    <span className={`rounded-md px-2 py-1 text-xs font-semibold ${tone}`}>
      {formatEnumLabel(label)}
      {included ? "" : " excluded"}
    </span>
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

function IntelligenceHighlightCard({
  title,
  description,
  players,
  emptyMessage,
}: {
  title: string;
  description?: string;
  players: Array<{
    playerId: string;
    fullName: string;
    position: string;
    team: string | null;
    totalMentions: number;
    intelligenceScore: number;
    intelligenceLabel: string;
    trendDirection: string;
  }>;
  emptyMessage: string;
}) {
  return (
    <Card title={title}>
      {description ? (
        <p className="mb-3 text-sm text-zinc-600">{description}</p>
      ) : null}
      {players.length > 0 ? (
        <div className="grid gap-2">
          {players.map((player) => (
            <Link
              className="rounded-md border border-zinc-200 bg-zinc-50 p-3 transition hover:border-emerald-200 hover:bg-emerald-50"
              href={`/knowledge-brain/players/${player.playerId}`}
              key={player.playerId}
            >
              <p className="font-semibold text-zinc-950">{player.fullName}</p>
              <p className="mt-1 text-sm text-zinc-600">
                {player.position}
                {player.team ? `, ${player.team}` : ""} - {player.totalMentions} mention
                {player.totalMentions === 1 ? "" : "s"}
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-md bg-white px-2 py-1 text-zinc-700">
                  Score {player.intelligenceScore}
                </span>
                <span className="rounded-md bg-white px-2 py-1 text-zinc-700">
                  {player.intelligenceLabel}
                </span>
                <span className="rounded-md bg-white px-2 py-1 text-zinc-700">
                  {formatEnumLabel(player.trendDirection)}
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

function ConsensusHighlightCard({
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
              <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                <span className={`rounded-md px-2 py-1 ${getConsensusTone(row.consensusLabel)}`}>
                  {row.consensusLabel}
                </span>
                <span className="rounded-md bg-white px-2 py-1 text-zinc-700">
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

function TrustHighlightCard({
  title,
  players,
  emptyMessage,
}: {
  title: string;
  players: Awaited<
    ReturnType<typeof getTrustEngineDashboard>
  >["playerProfiles"];
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
              <p className="font-semibold text-zinc-950">
                {player.playerName}
              </p>
              <p className="mt-1 text-sm text-zinc-600">
                {player.position}
                {player.team ? `, ${player.team}` : ""} - Trust{" "}
                {player.playerTrustScore} ({player.confidenceLabel})
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-md bg-white px-2 py-1 text-zinc-700">
                  {player.stanceSummary}
                </span>
                <span className="rounded-md bg-white px-2 py-1 text-zinc-700">
                  Evidence {player.evidenceCount}
                </span>
              </div>
              {[...player.lowSampleWarnings, ...player.disagreementWarnings][0] ? (
                <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-sm text-amber-950">
                  {[...player.lowSampleWarnings, ...player.disagreementWarnings][0]}
                </p>
              ) : null}
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState message={emptyMessage} />
      )}
    </Card>
  );
}

function MemoryHighlightCard({
  title,
  memories,
  emptyMessage,
}: {
  title: string;
  memories: Awaited<
    ReturnType<typeof getExpertMemoryDashboard>
  >["memories"];
  emptyMessage: string;
}) {
  return (
    <Card title={title}>
      {memories.length > 0 ? (
        <div className="grid gap-2">
          {memories.map((memory) => (
            <Link
              className="rounded-md border border-zinc-200 bg-zinc-50 p-3 transition hover:border-emerald-200 hover:bg-emerald-50"
              href={`/knowledge-brain/players/${memory.playerId}`}
              key={`${memory.expertId}-${memory.playerId}`}
            >
              <p className="font-semibold text-zinc-950">
                {memory.playerName}
              </p>
              <p className="mt-1 text-sm text-zinc-600">
                {memory.expertName} - {memory.memory.opinionTrend}
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-md bg-white px-2 py-1 text-zinc-700">
                  Conviction {memory.memory.convictionScore}
                </span>
                <span className="rounded-md bg-white px-2 py-1 text-zinc-700">
                  {memory.memory.convictionLabel}
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

function ExpertAccuracyHighlightCard({
  title,
  experts,
  emptyMessage,
  metric = "takes",
}: {
  title: string;
  experts: Array<{
    expertId: string;
    expertName: string;
    takeCount: number;
    bullishTakes: number;
    bearishTakes: number;
    accuracyStatus: string;
    takeTracking: {
      eligibleForFutureGrading: number;
    };
  }>;
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
                {getExpertAccuracyMetric(expert, metric)}
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-md bg-white px-2 py-1 text-zinc-700">
                  {expert.accuracyStatus}
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

function RecentlyGradedTakesCard({
  outcomes,
}: {
  outcomes: Awaited<ReturnType<typeof getRecentlyGradedTakes>>;
}) {
  return (
    <Card title="Recently Graded Takes">
      {outcomes.length > 0 ? (
        <div className="grid gap-2">
          {outcomes.map((outcome) => (
            <Link
              className="rounded-md border border-zinc-200 bg-zinc-50 p-3 transition hover:border-emerald-200 hover:bg-emerald-50"
              href={`/knowledge-brain/experts/${outcome.expertId}`}
              key={outcome.id}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-md px-2 py-1 text-xs font-semibold ${getGradeTone(
                    outcome.grade,
                  )}`}
                >
                  {formatEnumLabel(outcome.grade)}
                </span>
                <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-zinc-700">
                  {formatEnumLabel(outcome.outcomeType)}
                </span>
              </div>
              <p className="mt-2 font-semibold text-zinc-950">
                {outcome.summary}
              </p>
              <p className="mt-1 text-sm text-zinc-600">
                {outcome.expertName} - {outcome.playerName} -{" "}
                {formatDate(outcome.updatedAt)}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState message="No expert takes have been graded yet." />
      )}
    </Card>
  );
}

function GradedAccuracyCard({
  experts,
}: {
  experts: Awaited<ReturnType<typeof getExpertsWithGradedAccuracy>>;
}) {
  return (
    <Card title="Experts With Graded Accuracy">
      {experts.length > 0 ? (
        <div className="grid gap-2">
          {experts.map((expert) => (
            <Link
              className="rounded-md border border-zinc-200 bg-zinc-50 p-3 transition hover:border-emerald-200 hover:bg-emerald-50"
              href={`/knowledge-brain/experts/${expert.expertId}`}
              key={`${expert.expertId}-${expert.season}`}
            >
              <p className="font-semibold text-zinc-950">
                {expert.expertName}
              </p>
              <p className="mt-1 text-sm text-zinc-600">
                {expert.accuracyRate}% accuracy on {expert.totalGraded} graded
                take{expert.totalGraded === 1 ? "" : "s"} in {expert.season}
              </p>
              <p className="mt-2 text-xs font-semibold uppercase text-zinc-500">
                Correct {expert.correctCount}, Partial {expert.partialCount},
                Incorrect {expert.incorrectCount}, Push {expert.pushCount}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState message="No expert accuracy snapshots have been calculated yet." />
      )}
    </Card>
  );
}

function PlayerSignalRow({
  player,
  detail,
  tone = "neutral",
}: {
  player: {
    fullName: string;
    position: string;
    team: string | null;
  } | null;
  detail: string;
  tone?: "bullish" | "bearish" | "neutral";
}) {
  const toneClass = {
    bullish: "border-emerald-200 bg-emerald-50",
    bearish: "border-red-200 bg-red-50",
    neutral: "border-zinc-200 bg-zinc-50",
  }[tone];

  return (
    <div className={`rounded-md border p-3 ${toneClass}`}>
      <p className="font-semibold text-zinc-950">
        {player?.fullName ?? "Unknown player"}
      </p>
      <p className="mt-1 text-sm text-zinc-600">
        {player?.position ?? "--"}
        {player?.team ? `, ${player.team}` : ""} - {detail}
      </p>
    </div>
  );
}

function getExpertAccuracyMetric(
  expert: {
    takeCount: number;
    bullishTakes: number;
    bearishTakes: number;
    takeTracking: {
      eligibleForFutureGrading: number;
    };
  },
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

function getSentimentTone(sentiment: string) {
  if (sentiment === "BULLISH") return "bg-emerald-100 text-emerald-800";
  if (sentiment === "BEARISH") return "bg-red-100 text-red-800";

  return "bg-zinc-200 text-zinc-700";
}

function getConsensusTone(label: string) {
  if (label.includes("Bullish")) return "bg-emerald-100 text-emerald-800";
  if (label.includes("Bearish")) return "bg-red-100 text-red-800";
  if (label === "Split") return "bg-amber-100 text-amber-900";

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

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}
