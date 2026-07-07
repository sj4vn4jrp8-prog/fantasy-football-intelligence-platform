import Link from "next/link";
import { TranscriptReprocessControls } from "@/components/knowledge-brain/TranscriptReprocessControls";
import { TranscriptSummaryReviewControls } from "@/components/knowledge-brain/TranscriptSummaryReviewControls";
import { TakeReviewControls } from "@/components/knowledge-brain/TakeReviewControls";
import { getDefaultTargetSeason } from "@/knowledge-brain/freshness";
import {
  getTakeReviewQueue,
  getTranscriptSummaryReviewQueue,
} from "@/knowledge-brain/take-review";

export const dynamic = "force-dynamic";

type TranscriptReviewPageProps = {
  searchParams: Promise<{
    contentSeason?: string;
    expertId?: string;
    freshnessLabel?: string;
    q?: string;
    qualityFilter?: string;
    reviewStatus?: string;
    sentiment?: string;
    takeType?: string;
  }>;
};

export default async function TranscriptReviewPage({
  searchParams,
}: TranscriptReviewPageProps) {
  const filters = await searchParams;
  const queue = await getTakeReviewQueue({
    contentSeason: filters.contentSeason,
    expertId: filters.expertId,
    freshnessLabel: filters.freshnessLabel,
    q: filters.q,
    qualityFilter: filters.qualityFilter,
    reviewStatus: filters.reviewStatus,
    sentiment: filters.sentiment,
    takeType: filters.takeType,
  });
  const summaryQueue = await getTranscriptSummaryReviewQueue({
    contentSeason: filters.contentSeason,
    expertId: filters.expertId,
    freshnessLabel: filters.freshnessLabel,
    q: filters.q,
    qualityFilter: filters.qualityFilter,
    reviewStatus: filters.reviewStatus,
    sentiment: filters.sentiment,
    takeType: filters.takeType,
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
                Knowledge Brain Exception Queue
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal text-zinc-950 sm:text-4xl">
                Review Only What Needs a Human
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
                The deterministic quality reviewer auto-approves only clear,
                well-supported transcript player summaries. Ambiguous, thin, or
                low-confidence summaries come here first, with evidence and
                warnings attached.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <SummaryItem
                label="Needs Human Review"
                value={String(summaryQueue.counts.needsHumanReview)}
              />
              <SummaryItem
                label="Auto-approved"
                value={String(summaryQueue.counts.autoApproved)}
              />
              <SummaryItem
                label="Human Reviewed"
                value={String(summaryQueue.counts.humanReviewed)}
              />
              <SummaryItem
                label="Low Quality"
                value={String(summaryQueue.counts.lowQuality)}
              />
              <SummaryItem
                label="Draft Case Primary"
                value={String(summaryQueue.counts.evidenceQuality.primary)}
              />
              <SummaryItem
                label="Draft Case Secondary"
                value={String(summaryQueue.counts.evidenceQuality.secondary)}
              />
              <SummaryItem
                label="Caveat Only"
                value={String(summaryQueue.counts.evidenceQuality.caveatOnly)}
              />
              <SummaryItem
                label="Excluded Evidence"
                value={String(summaryQueue.counts.evidenceQuality.excluded)}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-5 sm:px-6 lg:px-8">
        <Card title="Review Filters">
          <form
            action="/knowledge-brain/review"
            className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_150px_170px_150px_160px_160px_auto]"
          >
            <label className="grid gap-1 text-sm font-semibold text-zinc-700">
              Search
              <input
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
                defaultValue={queue.filters.q ?? ""}
                name="q"
                placeholder="Player, expert, source, summary..."
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-zinc-700">
              Quality View
              <select
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
                defaultValue={summaryQueue.filters.qualityFilter}
                name="qualityFilter"
              >
                <option value="ALL">All</option>
                {summaryQueue.options.qualityFilters.map((qualityFilter) => (
                  <option key={qualityFilter} value={qualityFilter}>
                    {formatEnumLabel(qualityFilter)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold text-zinc-700">
              Status
              <select
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
                defaultValue={queue.filters.reviewStatus}
                name="reviewStatus"
              >
                <option value="ALL">All</option>
                {queue.options.reviewStatuses.map((status) => (
                  <option key={status} value={status}>
                    {formatEnumLabel(status)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold text-zinc-700">
              Expert
              <select
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
                defaultValue={queue.filters.expertId ?? ""}
                name="expertId"
              >
                <option value="">All</option>
                {queue.experts.map((expert) => (
                  <option key={expert.id} value={expert.id}>
                    {expert.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold text-zinc-700">
              Sentiment
              <select
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
                defaultValue={queue.filters.sentiment}
                name="sentiment"
              >
                <option value="ALL">All</option>
                {queue.options.sentiments.map((sentiment) => (
                  <option key={sentiment} value={sentiment}>
                    {formatEnumLabel(sentiment)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold text-zinc-700">
              Take Type
              <select
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
                defaultValue={queue.filters.takeType}
                name="takeType"
              >
                <option value="ALL">All</option>
                {queue.options.takeTypes.map((takeType) => (
                  <option key={takeType} value={takeType}>
                    {formatEnumLabel(takeType)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold text-zinc-700">
              Freshness
              <select
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
                defaultValue={queue.filters.freshnessLabel}
                name="freshnessLabel"
              >
                <option value="ALL">All</option>
                {queue.options.freshnessLabels.map((freshness) => (
                  <option key={freshness} value={freshness}>
                    {formatEnumLabel(freshness)}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-semibold text-zinc-700">
              Season
              <input
                className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950"
                defaultValue={
                  queue.filters.contentSeason ?? getDefaultTargetSeason()
                }
                min="2000"
                name="contentSeason"
                type="number"
              />
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
                href="/knowledge-brain/review"
              >
                Reset
              </Link>
            </div>
          </form>
        </Card>

        <Card title="Exception Queue: Transcript Player Summaries">
          {summaryQueue.summaries.length > 0 ? (
            <div className="grid gap-4">
              {summaryQueue.summaries.map((summary) => (
                <article
                  className="rounded-md border border-zinc-200 bg-zinc-50 p-4"
                  key={summary.id}
                >
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <ReviewBadge status={summary.reviewStatus} />
                        <ReviewOriginBadge origin={summary.reviewOrigin} />
                        <StanceBadge stance={summary.stance} />
                        <QualityScoreBadge score={summary.qualityScore} />
                        <EvidenceQualityBadge
                          label={summary.evidenceQuality.qualityLabel}
                        />
                        <EvidenceDecisionBadge
                          decision={summary.evidenceQuality.inclusionDecision}
                        />
                        {summary.needsHumanReview ? (
                          <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">
                            Needs human review
                          </span>
                        ) : null}
                        <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-zinc-700">
                          Confidence {Math.round(summary.confidence * 100)}%
                        </span>
                        <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-zinc-700">
                          {summary.mentionCount} mention
                          {summary.mentionCount === 1 ? "" : "s"}
                        </span>
                      </div>
                      <h2 className="mt-3 text-xl font-semibold text-zinc-950">
                        {summary.player.fullName}
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-zinc-700">
                        {summary.summary}
                      </p>

                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <TagList
                          emptyLabel="No primary themes detected."
                          label="Primary Themes"
                          tags={summary.primaryThemes}
                        />
                        <TagList
                          emptyLabel="No major caveats detected."
                          label="Important Caveats"
                          tags={summary.importantCaveats}
                        />
                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <TagList
                          emptyLabel="No quality warnings."
                          label="Quality Warnings"
                          tags={summary.qualityWarnings.map(formatWarningLabel)}
                        />
                        <TagList
                          emptyLabel="No quality reasons recorded."
                          label="Quality Reasons"
                          tags={summary.qualityReasons}
                        />
                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <TagList
                          emptyLabel="No evidence-quality warnings."
                          label="Draft Case Evidence Warnings"
                          tags={summary.evidenceQuality.displayWarnings}
                        />
                        <TagList
                          emptyLabel="No evidence-quality reasons recorded."
                          label="Draft Case Inclusion Reasons"
                          tags={summary.evidenceQuality.reasons}
                        />
                      </div>

                      <details className="mt-4 rounded-md border border-zinc-200 bg-white p-3 text-sm text-zinc-700">
                        <summary className="cursor-pointer font-semibold text-zinc-900">
                          Show supporting evidence ({summary.evidence.length})
                        </summary>
                        <div className="mt-3 grid gap-2">
                          {summary.evidence.length > 0 ? (
                            summary.evidence.map((evidence) => (
                              <div
                                className="rounded-md border border-zinc-200 bg-zinc-50 p-3"
                                key={evidence.id}
                              >
                                <div className="flex flex-wrap gap-2">
                                  <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-zinc-700">
                                    {formatEnumLabel(evidence.evidenceType)}
                                  </span>
                                  {evidence.expertTake ? (
                                    <>
                                      <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-zinc-700">
                                        {formatEnumLabel(
                                          evidence.expertTake.sentiment,
                                        )}
                                      </span>
                                      <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-zinc-700">
                                        {formatEnumLabel(
                                          evidence.expertTake.takeType,
                                        )}
                                      </span>
                                    </>
                                  ) : null}
                                </div>
                                <p className="mt-2 leading-6">
                                  {evidence.displayExcerpt}
                                </p>
                              </div>
                            ))
                          ) : (
                            <EmptyState message="No evidence rows were linked to this summary." />
                          )}
                        </div>
                      </details>
                    </div>

                    <div className="grid gap-2 text-sm">
                      <InfoRow label="Expert" value={summary.expert.name} />
                      <InfoRow
                        label="Player"
                        value={`${summary.player.fullName} (${summary.player.position}${
                          summary.player.team ? `, ${summary.player.team}` : ""
                        })`}
                      />
                      <InfoRow label="Source" value={summary.sourceVideo.title} />
                      <InfoRow
                        label="Publish Date"
                        value={formatDate(
                          summary.transcript.publishDate ??
                            summary.sourceVideo.publishedAt,
                        )}
                      />
                      <InfoRow
                        label="Freshness"
                        value={formatEnumLabel(summary.transcript.freshnessLabel)}
                      />
                      <InfoRow
                        label="Take Categories"
                        value={
                          summary.takeTypes.length > 0
                            ? summary.takeTypes.map(formatEnumLabel).join(", ")
                            : "None"
                        }
                      />
                      <InfoRow
                        label="Reviewed"
                        value={formatDate(summary.reviewedAt)}
                      />
                      <InfoRow
                        label="Quality Labels"
                        value={[
                          summary.evidenceQualityLabel
                            ? `Evidence ${summary.evidenceQualityLabel}`
                            : null,
                          summary.attributionQualityLabel
                            ? `Attribution ${summary.attributionQualityLabel}`
                            : null,
                          summary.summaryClarityLabel
                            ? `Clarity ${summary.summaryClarityLabel}`
                            : null,
                          summary.confidenceLabel
                            ? `Confidence ${summary.confidenceLabel}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(", ") || "Not reviewed"}
                      />
                      <InfoRow
                        label="Draft Case Use"
                        value={summary.evidenceQuality.displayDecision}
                      />
                      <InfoRow
                        label="Contributes"
                        value={
                          summary.evidenceQuality.shouldUseInPlayerThesis
                            ? "Yes"
                            : "No"
                        }
                      />
                      <InfoRow
                        label="Reviewer"
                        value={
                          summary.qualityReviewerMode
                            ? formatEnumLabel(summary.qualityReviewerMode)
                            : "Not reviewed"
                        }
                      />
                      <InfoRow
                        label="Auto-approved"
                        value={formatDate(summary.autoApprovedAt)}
                      />
                      <InfoRow
                        label="Human Override"
                        value={formatDate(summary.manuallyReviewedAt)}
                      />
                      <TranscriptReprocessControls
                        sourceTitle={summary.sourceVideo.title}
                        sourceVideoId={summary.sourceVideo.id}
                        transcriptId={summary.transcript.id}
                      />
                    </div>
                  </div>

                  <div className="mt-4 border-t border-zinc-200 pt-4">
                    <TranscriptSummaryReviewControls
                      reviewStatus={summary.reviewStatus}
                      summaryId={summary.id}
                    />
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState message="No transcript player summaries match this exception view. Switch Quality View to All or import/reprocess transcripts to generate new intelligence." />
          )}
        </Card>

        <Card title="Supporting Segment-Level Evidence">
          <p className="mb-4 text-sm leading-6 text-zinc-600">
            These are the older segment-level `ExpertTake` records. They remain
            useful as audit evidence, but transcript player summaries are now the
            primary review object.
          </p>
          {queue.takes.length > 0 ? (
            <div className="grid gap-4">
              {queue.takes.map((take) => (
                <article
                  className="rounded-md border border-zinc-200 bg-zinc-50 p-4"
                  key={take.id}
                >
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <ReviewBadge status={take.reviewStatus} />
                        <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-zinc-700">
                          {formatEnumLabel(take.sentiment)}
                        </span>
                        <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-zinc-700">
                          {formatEnumLabel(take.takeType)}
                        </span>
                        <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-zinc-700">
                          Confidence {Math.round(take.confidence * 100)}%
                        </span>
                        <EvidenceQualityBadge
                          label={take.evidenceQuality.qualityLabel}
                        />
                        <EvidenceDecisionBadge
                          decision={take.evidenceQuality.inclusionDecision}
                        />
                      </div>
                      {take.extractionWarnings.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {take.extractionWarnings.map((warning) => (
                            <WarningBadge key={warning} warning={warning} />
                          ))}
                        </div>
                      ) : null}
                      <h2 className="mt-3 text-lg font-semibold text-zinc-950">
                        {take.summary}
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-zinc-700">
                        {take.displayExcerpt}
                      </p>
                      {take.cleanedSourceSegment !== take.rawSourceSegment ? (
                        <details className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
                          <summary className="cursor-pointer font-semibold text-zinc-800">
                            Show cleaned full segment
                          </summary>
                          <p className="mt-2 leading-6">
                            {take.cleanedSourceSegment}
                          </p>
                        </details>
                      ) : null}
                      <details className="mt-3 rounded-md border border-zinc-200 bg-white p-3 text-sm text-zinc-600">
                        <summary className="cursor-pointer font-semibold text-zinc-800">
                          Show raw excerpt/source text
                        </summary>
                        <p className="mt-2 leading-6">{take.rawSourceSegment}</p>
                      </details>
                    </div>
                    <div className="grid gap-2 text-sm">
                      <InfoRow label="Expert" value={take.expert.name} />
                      <InfoRow
                        label="Player"
                        value={
                          take.player
                            ? `${take.player.fullName} (${take.player.position}${
                                take.player.team ? `, ${take.player.team}` : ""
                              })`
                            : "No player match"
                        }
                      />
                      <InfoRow
                        label="Source"
                        value={take.sourceVideo.title}
                      />
                      <InfoRow
                        label="Publish Date"
                        value={formatDate(
                          take.transcript?.publishDate ??
                            take.sourceVideo.publishedAt,
                        )}
                      />
                      <InfoRow
                        label="Freshness"
                        value={formatEnumLabel(
                          take.transcript?.freshnessLabel ?? "STALE",
                        )}
                      />
                      <InfoRow label="Created" value={formatDate(take.createdAt)} />
                      <InfoRow
                        label="Reviewed"
                        value={formatDate(take.reviewedAt)}
                      />
                      <InfoRow
                        label="Draft Case Use"
                        value={take.evidenceQuality.displayDecision}
                      />
                      <InfoRow
                        label="Evidence Warnings"
                        value={
                          take.evidenceQuality.displayWarnings.join(", ") ||
                          "None"
                        }
                      />
                      <TranscriptReprocessControls
                        sourceTitle={take.sourceVideo.title}
                        sourceVideoId={take.sourceVideo.id}
                        transcriptId={take.transcript?.id ?? null}
                      />
                    </div>
                  </div>

                  <div className="mt-4 border-t border-zinc-200 pt-4">
                    <TakeReviewControls
                      confidence={take.confidence}
                      expertTakeId={take.id}
                      playerId={take.playerId}
                      players={queue.players}
                      reviewStatus={take.reviewStatus}
                      sentiment={take.sentiment}
                      summary={take.summary}
                      takeType={take.takeType}
                    />
                  </div>
                </article>
              ))}
            </div>
          ) : queue.filters.reviewStatus === "PENDING" ? (
            <EmptyState message="No pending takes match these filters. Import a transcript to create new pending takes, or switch the status filter to review approved, dismissed, or needs-edit takes." />
          ) : queue.filters.reviewStatus === "APPROVED" ? (
            <EmptyState message="No approved takes match these filters yet. Approve reviewed takes before they influence decision intelligence." />
          ) : (
            <EmptyState message="No takes match these filters." />
          )}
        </Card>

        <Card title="Review Notes">
          <div className="grid gap-3 text-sm leading-6 text-zinc-600 md:grid-cols-2">
            <p>
              Phase 3A introduces transcript-level player summaries. The goal is
              to approve the expert&apos;s complete transcript opinion on a player,
              not dozens of tiny transcript fragments.
            </p>
            <p>
              ExpertTake records are now supporting evidence. Keep using the
              segment-level controls only when you need to inspect or correct
              the underlying parser output.
            </p>
            <p>
              Auto-approved summaries are approved by deterministic quality
              rules, not by segment-level take approval. Human actions on a
              summary are tracked separately and override the automatic status.
            </p>
            <p>
              If old extracted takes look noisy, reprocess the transcript or
              source from a take card. Reprocessing replaces unapproved extracted
              takes with the improved parser output while preserving approved
              reviewed takes.
            </p>
          </div>
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
    <div className="rounded-md border border-zinc-200 bg-white px-3 py-2">
      <p className="text-xs font-semibold uppercase text-zinc-500">{label}</p>
      <p className="mt-1 font-semibold text-zinc-950">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white px-3 py-2">
      <p className="text-xs font-semibold uppercase text-zinc-500">{label}</p>
      <p className="mt-1 font-medium text-zinc-800">{value}</p>
    </div>
  );
}

function ReviewBadge({ status }: { status: string }) {
  const tone =
    status === "APPROVED"
      ? "bg-emerald-100 text-emerald-800"
      : status === "DISMISSED"
        ? "bg-red-100 text-red-800"
        : status === "NEEDS_EDIT"
          ? "bg-amber-100 text-amber-900"
          : "bg-zinc-100 text-zinc-700";

  return (
    <span className={`rounded-md px-2 py-1 text-xs font-semibold ${tone}`}>
      {formatEnumLabel(status)}
    </span>
  );
}

function ReviewOriginBadge({ origin }: { origin: string }) {
  const tone =
    origin === "HUMAN_REVIEWED"
      ? "bg-blue-100 text-blue-800"
      : origin === "AUTO_APPROVED_DETERMINISTIC"
        ? "bg-emerald-100 text-emerald-800"
        : origin === "NEEDS_HUMAN_EDIT"
          ? "bg-amber-100 text-amber-900"
          : origin === "DISMISSED"
            ? "bg-red-100 text-red-800"
            : "bg-zinc-100 text-zinc-700";

  return (
    <span className={`rounded-md px-2 py-1 text-xs font-semibold ${tone}`}>
      {formatReviewOrigin(origin)}
    </span>
  );
}

function QualityScoreBadge({ score }: { score: number | null }) {
  const tone =
    score === null
      ? "bg-zinc-100 text-zinc-700"
      : score >= 85
        ? "bg-emerald-100 text-emerald-800"
        : score >= 70
          ? "bg-blue-100 text-blue-800"
          : score >= 55
            ? "bg-amber-100 text-amber-900"
            : "bg-red-100 text-red-800";

  return (
    <span className={`rounded-md px-2 py-1 text-xs font-semibold ${tone}`}>
      Quality {score === null ? "Not reviewed" : score}
    </span>
  );
}

function EvidenceQualityBadge({ label }: { label: string }) {
  const tone =
    label === "High Quality" || label === "Good Quality"
      ? "bg-emerald-100 text-emerald-800"
      : label === "Mixed Quality"
        ? "bg-blue-100 text-blue-800"
        : label === "Low Quality"
          ? "bg-amber-100 text-amber-900"
          : "bg-red-100 text-red-800";

  return (
    <span className={`rounded-md px-2 py-1 text-xs font-semibold ${tone}`}>
      {label}
    </span>
  );
}

function EvidenceDecisionBadge({ decision }: { decision: string }) {
  const tone =
    decision === "INCLUDE_PRIMARY"
      ? "bg-emerald-100 text-emerald-800"
      : decision === "INCLUDE_SECONDARY"
        ? "bg-blue-100 text-blue-800"
        : decision === "CAVEAT_ONLY"
          ? "bg-amber-100 text-amber-900"
          : "bg-red-100 text-red-800";

  return (
    <span className={`rounded-md px-2 py-1 text-xs font-semibold ${tone}`}>
      {formatEvidenceDecision(decision)}
    </span>
  );
}

function StanceBadge({ stance }: { stance: string }) {
  const tone =
    stance === "BULLISH"
      ? "bg-emerald-100 text-emerald-800"
      : stance === "BEARISH"
        ? "bg-red-100 text-red-800"
        : stance === "MIXED"
          ? "bg-amber-100 text-amber-900"
          : "bg-zinc-200 text-zinc-700";

  return (
    <span className={`rounded-md px-2 py-1 text-xs font-semibold ${tone}`}>
      {formatEnumLabel(stance)}
    </span>
  );
}

function WarningBadge({ warning }: { warning: string }) {
  return (
    <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">
      {formatWarningLabel(warning)}
    </span>
  );
}

function TagList({
  emptyLabel,
  label,
  tags,
}: {
  emptyLabel: string;
  label: string;
  tags: string[];
}) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase text-zinc-500">{label}</p>
      {tags.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-semibold text-zinc-700"
              key={tag}
            >
              {tag}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-zinc-500">{emptyLabel}</p>
      )}
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

function formatWarningLabel(value: string) {
  const labels: Record<string, string> = {
    AMBIGUOUS_ATTRIBUTION: "Ambiguous attribution",
    COMPARISON_HEAVY_EVIDENCE: "Comparison-heavy evidence",
    CONFLICTING_SENTIMENT: "Conflicting sentiment",
    GENERIC_OR_THIN_SUMMARY: "Generic or thin summary",
    LOW_CONFIDENCE: "Low confidence",
    LOW_EVIDENCE: "Low evidence",
    LOW_MENTION_COUNT: "Low mention count",
    MIXED_OR_CONFLICTING_STANCE: "Mixed or conflicting stance",
    MULTIPLE_PLAYERS_DETECTED: "Multiple players detected",
    COMPARISON_LANGUAGE_DETECTED: "Comparison language",
    PRIMARY_PLAYER_UNCERTAIN: "Primary player uncertain",
    SENTIMENT_MAY_APPLY_TO_ANOTHER_PLAYER: "Sentiment may apply elsewhere",
    TIMESTAMP_HEAVY_TRANSCRIPT_CLEANED: "Timestamp cleanup applied",
    SPOKEN_TIMESTAMP_CLEANUP_APPLIED: "Spoken timestamp cleanup",
    CONTEXT_ONLY_MENTION: "Context-only mention",
    COMPARISON_ONLY_MENTION: "Comparison-only mention",
    PRONOUN_HEAVY_SEGMENT: "Pronoun-heavy segment",
    NO_CLEAR_SUBJECT_OPINION_LINK: "No clear subject-opinion link",
    LOW_EXTRACTION_CONFIDENCE: "Low confidence",
    NEUTRAL_WITHOUT_CLEAR_TAKE: "Neutral without clear take",
    NO_DIRECT_TAKE_EVIDENCE: "No direct take evidence",
    STALE_OR_EXCLUDED_SOURCE: "Stale or excluded source",
    TIMESTAMP_CLEANUP_EVIDENCE: "Timestamp cleanup evidence",
    UNCLEAR_PLAYER_SUBJECT: "Unclear player subject",
  };

  return labels[value] ?? formatEnumLabel(value);
}

function formatReviewOrigin(value: string) {
  const labels: Record<string, string> = {
    AUTO_APPROVED_DETERMINISTIC: "Auto-approved",
    DISMISSED: "Dismissed",
    HUMAN_REVIEWED: "Human reviewed",
    NEEDS_HUMAN_EDIT: "Needs edit",
    PENDING_REVIEW: "Pending review",
  };

  return labels[value] ?? formatEnumLabel(value);
}

function formatEvidenceDecision(value: string) {
  const labels: Record<string, string> = {
    CAVEAT_ONLY: "Caveat only",
    EXCLUDE: "Excluded",
    INCLUDE_PRIMARY: "Primary evidence",
    INCLUDE_SECONDARY: "Secondary evidence",
  };

  return labels[value] ?? formatEnumLabel(value);
}
