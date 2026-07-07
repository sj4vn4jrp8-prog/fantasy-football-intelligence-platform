import { refreshTrendSignals } from "@/knowledge-brain/analyzeTranscript";
import {
  evaluateEvidenceQuality,
  formatEvidenceInclusionDecision,
  formatEvidenceQualityWarning,
} from "@/knowledge-brain/evidence-quality";
import { generateIntelligenceSnapshotsForPlayers } from "@/knowledge-brain/intelligence-snapshots";
import { normalizeTargetSeason } from "@/knowledge-brain/freshness";
import {
  cleanTranscriptDisplayText,
  getReviewExtractionWarnings,
  trimExcerpt,
} from "@/knowledge-brain/transcript-extraction";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export type TakeReviewFilters = {
  contentSeason?: number | string | null;
  expertId?: string | null;
  freshnessLabel?: string | null;
  q?: string | null;
  qualityFilter?: string | null;
  reviewStatus?: string | null;
  sentiment?: string | null;
  takeType?: string | null;
};

export type UpdateExpertTakeReviewInput = {
  expertTakeId: string;
  reviewStatus: string;
  playerId?: string | null;
  sentiment?: string | null;
  takeType?: string | null;
  summary?: string | null;
  confidence?: number | string | null;
};

export type UpdateTranscriptPlayerSummaryReviewInput = {
  summaryId: string;
  reviewStatus: string;
};

const REVIEW_STATUSES = [
  "PENDING",
  "APPROVED",
  "DISMISSED",
  "NEEDS_EDIT",
] as const;
type ReviewStatus = (typeof REVIEW_STATUSES)[number];

const SENTIMENTS = ["BULLISH", "BEARISH", "NEUTRAL"] as const;
type Sentiment = (typeof SENTIMENTS)[number];

const TAKE_TYPES = [
  "START_SIT",
  "WAIVER",
  "TRADE",
  "DRAFT",
  "INJURY",
  "MATCHUP",
  "BREAKOUT",
  "FADE",
  "SLEEPER",
  "UNCATEGORIZED",
] as const;
type TakeType = (typeof TAKE_TYPES)[number];

const FRESHNESS_LABELS = [
  "CURRENT",
  "RECENT",
  "STALE",
  "HISTORICAL",
  "ARCHIVED",
] as const;

const QUALITY_FILTERS = [
  "NEEDS_HUMAN_REVIEW",
  "AUTO_APPROVED",
  "LOW_QUALITY",
  "AMBIGUOUS_ATTRIBUTION",
  "LOW_EVIDENCE",
  "CONFLICTING_SENTIMENT",
  "RECENTLY_PROCESSED",
] as const;
type QualityFilter = (typeof QUALITY_FILTERS)[number];

const REVIEW_QUEUE_INCLUDE = {
  expert: {
    select: {
      id: true,
      name: true,
    },
  },
  player: {
    select: {
      id: true,
      fullName: true,
      position: true,
      team: true,
    },
  },
  sourceVideo: {
    select: {
      id: true,
      title: true,
      url: true,
      publishedAt: true,
      freshnessLabel: true,
      includeInCurrentAnalysis: true,
    },
  },
  transcript: {
    select: {
      id: true,
      contentSeason: true,
      freshnessLabel: true,
      includeInCurrentAnalysis: true,
      publishDate: true,
    },
  },
  sourceSegment: {
    select: {
      text: true,
    },
  },
} satisfies Prisma.ExpertTakeInclude;

type TakeForReviewQueue = Prisma.ExpertTakeGetPayload<{
  include: typeof REVIEW_QUEUE_INCLUDE;
}>;

const SUMMARY_REVIEW_QUEUE_INCLUDE = {
  expert: {
    select: {
      id: true,
      name: true,
    },
  },
  player: {
    select: {
      id: true,
      fullName: true,
      position: true,
      team: true,
    },
  },
  sourceVideo: {
    select: {
      id: true,
      title: true,
      url: true,
      publishedAt: true,
      freshnessLabel: true,
      includeInCurrentAnalysis: true,
    },
  },
  transcript: {
    select: {
      id: true,
      contentSeason: true,
      freshnessLabel: true,
      includeInCurrentAnalysis: true,
      publishDate: true,
    },
  },
  evidence: {
    include: {
      expertTake: {
        select: {
          id: true,
          sentiment: true,
          takeType: true,
          reviewStatus: true,
          confidence: true,
        },
      },
      playerMention: {
        select: {
          id: true,
          context: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.TranscriptPlayerSummaryInclude;

type SummaryForReviewQueue = Prisma.TranscriptPlayerSummaryGetPayload<{
  include: typeof SUMMARY_REVIEW_QUEUE_INCLUDE;
}>;

export async function getTakeReviewQueue(filters: TakeReviewFilters = {}) {
  const normalizedFilters = normalizeReviewFilters(filters);
  const where = buildReviewWhere(normalizedFilters);
  const [
    takes,
    experts,
    players,
    pendingCount,
    approvedCount,
    needsEditCount,
    dismissedCount,
  ] = await Promise.all([
    db.expertTake.findMany({
      where,
      include: REVIEW_QUEUE_INCLUDE,
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.expert.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
      },
    }),
    db.player.findMany({
      orderBy: [{ fullName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        fullName: true,
        position: true,
        team: true,
      },
    }),
    db.expertTake.count({ where: { reviewStatus: "PENDING" } }),
    db.expertTake.count({ where: { reviewStatus: "APPROVED" } }),
    db.expertTake.count({ where: { reviewStatus: "NEEDS_EDIT" } }),
    db.expertTake.count({ where: { reviewStatus: "DISMISSED" } }),
  ]);

  return {
    filters: normalizedFilters,
    takes: takes.map((take) => enrichTakeForReview(take, players)),
    experts,
    players,
    options: {
      reviewStatuses: REVIEW_STATUSES,
      sentiments: SENTIMENTS,
      takeTypes: TAKE_TYPES,
      freshnessLabels: FRESHNESS_LABELS,
    },
    counts: {
      pending: pendingCount,
      approved: approvedCount,
      needsEdit: needsEditCount,
      dismissed: dismissedCount,
      matching: takes.length,
    },
  };
}

export async function getTranscriptSummaryReviewQueue(
  filters: TakeReviewFilters = {},
) {
  const normalizedFilters = normalizeReviewFilters(filters);
  const where = buildSummaryReviewWhere(normalizedFilters);
  const [
    summaries,
    pendingCount,
    approvedCount,
    needsEditCount,
    dismissedCount,
    needsHumanReviewCount,
    autoApprovedCount,
    humanReviewedCount,
    lowQualityCount,
  ] = await Promise.all([
    db.transcriptPlayerSummary.findMany({
      where,
      include: SUMMARY_REVIEW_QUEUE_INCLUDE,
      orderBy: [{ reviewStatus: "desc" }, { qualityScore: "asc" }, { createdAt: "desc" }],
      take: 100,
    }),
    db.transcriptPlayerSummary.count({ where: { reviewStatus: "PENDING" } }),
    db.transcriptPlayerSummary.count({ where: { reviewStatus: "APPROVED" } }),
    db.transcriptPlayerSummary.count({
      where: { reviewStatus: "NEEDS_EDIT" },
    }),
    db.transcriptPlayerSummary.count({
      where: { reviewStatus: "DISMISSED" },
    }),
    db.transcriptPlayerSummary.count({
      where: getNeedsHumanReviewWhere(),
    }),
    db.transcriptPlayerSummary.count({
      where: { autoApprovedAt: { not: null } },
    }),
    db.transcriptPlayerSummary.count({
      where: { manuallyReviewedAt: { not: null } },
    }),
    db.transcriptPlayerSummary.count({
      where: { qualityScore: { lt: 60 } },
    }),
  ]);
  const enrichedSummaries = summaries
    .map(enrichSummaryForReview)
    .sort(sortSummaryForExceptionQueue);
  const evidenceQualityCounts = {
    primary: enrichedSummaries.filter(
      (summary) =>
        summary.evidenceQuality.inclusionDecision === "INCLUDE_PRIMARY",
    ).length,
    secondary: enrichedSummaries.filter(
      (summary) =>
        summary.evidenceQuality.inclusionDecision === "INCLUDE_SECONDARY",
    ).length,
    caveatOnly: enrichedSummaries.filter(
      (summary) => summary.evidenceQuality.inclusionDecision === "CAVEAT_ONLY",
    ).length,
    excluded: enrichedSummaries.filter(
      (summary) => summary.evidenceQuality.inclusionDecision === "EXCLUDE",
    ).length,
  };

  return {
    filters: normalizedFilters,
    summaries: enrichedSummaries,
    options: {
      qualityFilters: QUALITY_FILTERS,
      reviewStatuses: REVIEW_STATUSES,
    },
    counts: {
      pending: pendingCount,
      approved: approvedCount,
      needsEdit: needsEditCount,
      dismissed: dismissedCount,
      needsHumanReview: needsHumanReviewCount,
      autoApproved: autoApprovedCount,
      humanReviewed: humanReviewedCount,
      lowQuality: lowQualityCount,
      matching: summaries.length,
      evidenceQuality: evidenceQualityCounts,
    },
  };
}

function enrichSummaryForReview(summary: SummaryForReviewQueue) {
  const needsHumanReview = summaryNeedsHumanReview(summary);
  const evidenceQuality = evaluateEvidenceQuality({
    id: summary.id,
    evidenceType: "TRANSCRIPT_PLAYER_SUMMARY",
    reviewStatus: summary.reviewStatus,
    confidence: summary.confidence,
    qualityScore: summary.qualityScore,
    qualityWarnings: summary.qualityWarnings,
    qualityReasons: summary.qualityReasons,
    evidenceQualityLabel: summary.evidenceQualityLabel,
    attributionQualityLabel: summary.attributionQualityLabel,
    summaryClarityLabel: summary.summaryClarityLabel,
    confidenceLabel: summary.confidenceLabel,
    evidenceCount: summary.evidenceCount,
    mentionCount: summary.mentionCount,
    publishDate: summary.transcript.publishDate,
    sourcePublishedAt: summary.sourceVideo.publishedAt,
    freshnessLabel: summary.transcript.freshnessLabel,
    sourceFreshnessLabel: summary.sourceVideo.freshnessLabel,
    includeInCurrentAnalysis: summary.transcript.includeInCurrentAnalysis,
    sourceIncludeInCurrentAnalysis: summary.sourceVideo.includeInCurrentAnalysis,
    autoApprovedAt: summary.autoApprovedAt,
    manuallyReviewedAt: summary.manuallyReviewedAt,
  });

  return {
    ...summary,
    needsHumanReview,
    reviewOrigin: getSummaryReviewOrigin(summary),
    evidenceQuality: {
      ...evidenceQuality,
      displayDecision: formatEvidenceInclusionDecision(
        evidenceQuality.inclusionDecision,
      ),
      displayWarnings: evidenceQuality.warnings.map(formatEvidenceQualityWarning),
    },
    evidence: summary.evidence.map((evidence) => ({
      ...evidence,
      displayExcerpt: trimExcerpt(evidence.excerpt),
    })),
  };
}

function enrichTakeForReview(
  take: TakeForReviewQueue,
  players: Array<{
    id: string;
    firstName: string | null;
    lastName: string | null;
    fullName: string;
    position: string;
    team: string | null;
  }>,
) {
  const rawSourceText = take.sourceSegment?.text ?? take.excerpt;
  const cleaned = cleanTranscriptDisplayText(rawSourceText);
  const evidenceQuality = evaluateEvidenceQuality({
    id: take.id,
    evidenceType: "EXPERT_TAKE_FALLBACK",
    reviewStatus: take.reviewStatus,
    confidence: take.confidence,
    evidenceCount: 1,
    mentionCount: 1,
    publishDate: take.transcript?.publishDate,
    sourcePublishedAt: take.sourceVideo.publishedAt,
    freshnessLabel: take.transcript?.freshnessLabel,
    sourceFreshnessLabel: take.sourceVideo.freshnessLabel,
    includeInCurrentAnalysis: take.transcript?.includeInCurrentAnalysis,
    sourceIncludeInCurrentAnalysis: take.sourceVideo.includeInCurrentAnalysis,
  });

  return {
    ...take,
    displayExcerpt: trimExcerpt(cleaned.text),
    cleanedSourceSegment: cleaned.text,
    rawExcerpt: take.excerpt,
    rawSourceSegment: rawSourceText,
    evidenceQuality: {
      ...evidenceQuality,
      displayDecision: formatEvidenceInclusionDecision(
        evidenceQuality.inclusionDecision,
      ),
      displayWarnings: evidenceQuality.warnings.map(formatEvidenceQualityWarning),
    },
    extractionWarnings: getReviewExtractionWarnings({
      confidence: take.confidence,
      playerId: take.playerId,
      sourceText: rawSourceText,
      players,
    }),
  };
}

export async function updateExpertTakeReview(input: UpdateExpertTakeReviewInput) {
  const normalizedInput = normalizeReviewUpdateInput(input);
  const existingTake = await db.expertTake.findUnique({
    where: { id: normalizedInput.expertTakeId },
    include: {
      player: {
        select: {
          id: true,
        },
      },
      sourceVideo: {
        select: {
          id: true,
        },
      },
      transcript: {
        select: {
          id: true,
          contentSeason: true,
        },
      },
    },
  });

  if (!existingTake) {
    throw new Error("Expert take was not found.");
  }

  const player =
    normalizedInput.playerId === null
      ? null
      : normalizedInput.playerId
        ? await db.player.findUnique({
            where: { id: normalizedInput.playerId },
            select: {
              id: true,
              fullName: true,
            },
          })
        : undefined;

  if (normalizedInput.playerId && !player) {
    throw new Error("Selected player was not found.");
  }

  const updatedTake = await db.expertTake.update({
    where: { id: normalizedInput.expertTakeId },
    data: {
      reviewStatus: normalizedInput.reviewStatus,
      reviewedAt:
        normalizedInput.reviewStatus === "PENDING" ? null : new Date(),
      playerId:
        normalizedInput.playerId === undefined
          ? undefined
          : normalizedInput.playerId,
      sentiment: normalizedInput.sentiment,
      takeType: normalizedInput.takeType,
      summary: normalizedInput.summary,
      confidence: normalizedInput.confidence,
    },
    include: {
      player: {
        select: {
          id: true,
          fullName: true,
        },
      },
    },
  });

  if (normalizedInput.playerId !== undefined) {
    await syncPlayerMentionForTake({
      takeId: updatedTake.id,
      sourceVideoId: existingTake.sourceVideoId,
      transcriptId: existingTake.transcriptId,
      player: updatedTake.player,
      context: updatedTake.excerpt,
      sentiment: updatedTake.sentiment,
      takeType: updatedTake.takeType,
    });
  } else {
    await db.playerMention.updateMany({
      where: { expertTakeId: updatedTake.id },
      data: {
        sentiment: updatedTake.sentiment,
        takeType: updatedTake.takeType,
        context: updatedTake.excerpt,
      },
    });
  }

  const playerIdsToRefresh = Array.from(
    new Set(
      [existingTake.playerId, updatedTake.playerId].filter(
        (playerId): playerId is string => Boolean(playerId),
      ),
    ),
  );

  await refreshTrendSignals(playerIdsToRefresh);
  await generateIntelligenceSnapshotsForPlayers({
    playerIds: playerIdsToRefresh,
    expertIds: [updatedTake.expertId],
    contentSeason: existingTake.transcript?.contentSeason,
    generationType: "MANUAL_REVIEW",
    reason: "Segment-level expert take review changed.",
  });

  return {
    expertTakeId: updatedTake.id,
    reviewStatus: updatedTake.reviewStatus,
  };
}

export async function updateTranscriptPlayerSummaryReview(
  input: UpdateTranscriptPlayerSummaryReviewInput,
) {
  const summaryId = requireString(input.summaryId, "Summary ID is required.");
  const reviewStatus = normalizeReviewStatus(input.reviewStatus);
  const updatedSummary = await db.transcriptPlayerSummary.update({
    where: { id: summaryId },
    data: {
      reviewStatus,
      reviewedAt: reviewStatus === "PENDING" ? null : new Date(),
      manuallyReviewedAt: new Date(),
    },
    select: {
      id: true,
      expertId: true,
      playerId: true,
      reviewStatus: true,
      transcript: {
        select: {
          contentSeason: true,
        },
      },
    },
  });
  await generateIntelligenceSnapshotsForPlayers({
    playerIds: [updatedSummary.playerId],
    expertIds: [updatedSummary.expertId],
    contentSeason: updatedSummary.transcript.contentSeason,
    generationType: "MANUAL_REVIEW",
    reason: "Transcript player summary review changed.",
  });

  return {
    summaryId: updatedSummary.id,
    reviewStatus: updatedSummary.reviewStatus,
  };
}

async function syncPlayerMentionForTake({
  takeId,
  sourceVideoId,
  transcriptId,
  player,
  context,
  sentiment,
  takeType,
}: {
  takeId: string;
  sourceVideoId: string;
  transcriptId: string | null;
  player: { id: string; fullName: string } | null;
  context: string;
  sentiment: Sentiment;
  takeType: TakeType;
}) {
  if (!player) {
    await db.playerMention.deleteMany({
      where: { expertTakeId: takeId },
    });
    return;
  }

  const existingMention = await db.playerMention.findFirst({
    where: { expertTakeId: takeId },
    select: { id: true },
  });
  const data = {
    transcriptId,
    sourceVideoId,
    playerId: player.id,
    mentionText: player.fullName,
    normalizedName: normalizeForMatching(player.fullName),
    sentiment,
    takeType,
    context,
  };

  if (existingMention) {
    await db.playerMention.updateMany({
      where: { expertTakeId: takeId },
      data,
    });
    return;
  }

  await db.playerMention.create({
    data: {
      expertTakeId: takeId,
      ...data,
    },
  });
}

function buildReviewWhere(
  filters: ReturnType<typeof normalizeReviewFilters>,
): Prisma.ExpertTakeWhereInput {
  const where: Prisma.ExpertTakeWhereInput = {};

  if (filters.reviewStatus !== "ALL") {
    where.reviewStatus = filters.reviewStatus;
  }

  if (filters.expertId) {
    where.expertId = filters.expertId;
  }

  if (filters.sentiment !== "ALL") {
    where.sentiment = filters.sentiment;
  }

  if (filters.takeType !== "ALL") {
    where.takeType = filters.takeType;
  }

  const transcriptWhere: Prisma.TranscriptWhereInput = {};

  if (filters.freshnessLabel !== "ALL") {
    transcriptWhere.freshnessLabel = filters.freshnessLabel;
  }

  if (filters.contentSeason) {
    transcriptWhere.contentSeason = filters.contentSeason;
  }

  if (Object.keys(transcriptWhere).length > 0) {
    where.transcript = { is: transcriptWhere };
  }

  if (filters.q) {
    where.OR = [
      { summary: { contains: filters.q, mode: "insensitive" } },
      { excerpt: { contains: filters.q, mode: "insensitive" } },
      {
        expert: {
          is: { name: { contains: filters.q, mode: "insensitive" } },
        },
      },
      {
        sourceVideo: {
          is: { title: { contains: filters.q, mode: "insensitive" } },
        },
      },
      {
        player: {
          is: { fullName: { contains: filters.q, mode: "insensitive" } },
        },
      },
    ];
  }

  return where;
}

function buildSummaryReviewWhere(
  filters: ReturnType<typeof normalizeReviewFilters>,
): Prisma.TranscriptPlayerSummaryWhereInput {
  const where: Prisma.TranscriptPlayerSummaryWhereInput = {};
  const andFilters: Prisma.TranscriptPlayerSummaryWhereInput[] = [];

  if (filters.reviewStatus !== "ALL") {
    where.reviewStatus = filters.reviewStatus;
  }

  if (filters.expertId) {
    where.expertId = filters.expertId;
  }

  const transcriptWhere: Prisma.TranscriptWhereInput = {};

  if (filters.freshnessLabel !== "ALL") {
    transcriptWhere.freshnessLabel = filters.freshnessLabel;
  }

  if (filters.contentSeason) {
    transcriptWhere.contentSeason = filters.contentSeason;
  }

  if (Object.keys(transcriptWhere).length > 0) {
    where.transcript = { is: transcriptWhere };
  }

  const qualityWhere = buildSummaryQualityWhere(filters.qualityFilter);

  if (qualityWhere) {
    andFilters.push(qualityWhere);
  }

  if (filters.q) {
    andFilters.push({
      OR: [
        { summary: { contains: filters.q, mode: "insensitive" } },
        {
          expert: {
            is: { name: { contains: filters.q, mode: "insensitive" } },
          },
        },
        {
          sourceVideo: {
            is: { title: { contains: filters.q, mode: "insensitive" } },
          },
        },
        {
          player: {
            is: { fullName: { contains: filters.q, mode: "insensitive" } },
          },
        },
      ],
    });
  }

  if (andFilters.length > 0) {
    where.AND = andFilters;
  }

  return where;
}

function buildSummaryQualityWhere(
  qualityFilter: QualityFilter | "ALL",
): Prisma.TranscriptPlayerSummaryWhereInput | null {
  if (qualityFilter === "ALL") return null;
  if (qualityFilter === "NEEDS_HUMAN_REVIEW") return getNeedsHumanReviewWhere();
  if (qualityFilter === "AUTO_APPROVED") {
    return { autoApprovedAt: { not: null } };
  }
  if (qualityFilter === "LOW_QUALITY") {
    return { qualityScore: { lt: 60 } };
  }
  if (qualityFilter === "AMBIGUOUS_ATTRIBUTION") {
    return { qualityWarnings: { has: "AMBIGUOUS_ATTRIBUTION" } };
  }
  if (qualityFilter === "LOW_EVIDENCE") {
    return {
      OR: [
        { evidenceCount: { lt: 2 } },
        { qualityWarnings: { has: "LOW_EVIDENCE" } },
      ],
    };
  }
  if (qualityFilter === "CONFLICTING_SENTIMENT") {
    return {
      OR: [
        { stance: "MIXED" },
        { qualityWarnings: { has: "CONFLICTING_SENTIMENT" } },
        { qualityWarnings: { has: "MIXED_OR_CONFLICTING_STANCE" } },
      ],
    };
  }
  if (qualityFilter === "RECENTLY_PROCESSED") {
    return {
      qualityReviewedAt: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
    };
  }

  return null;
}

function getNeedsHumanReviewWhere(): Prisma.TranscriptPlayerSummaryWhereInput {
  return {
    OR: [
      { reviewStatus: "PENDING" },
      { reviewStatus: "NEEDS_EDIT" },
      { qualityScore: null },
      { qualityScore: { lt: 70 } },
      { qualityWarnings: { has: "AMBIGUOUS_ATTRIBUTION" } },
      { qualityWarnings: { has: "CONFLICTING_SENTIMENT" } },
      { qualityWarnings: { has: "MIXED_OR_CONFLICTING_STANCE" } },
    ],
  };
}

function summaryNeedsHumanReview(summary: SummaryForReviewQueue) {
  return (
    summary.reviewStatus === "PENDING" ||
    summary.reviewStatus === "NEEDS_EDIT" ||
    summary.qualityScore === null ||
    (summary.qualityScore ?? 100) < 70 ||
    summary.qualityWarnings.includes("AMBIGUOUS_ATTRIBUTION") ||
    summary.qualityWarnings.includes("CONFLICTING_SENTIMENT") ||
    summary.qualityWarnings.includes("MIXED_OR_CONFLICTING_STANCE")
  );
}

function getSummaryReviewOrigin(summary: SummaryForReviewQueue) {
  if (summary.manuallyReviewedAt) return "HUMAN_REVIEWED";
  if (summary.autoApprovedAt) return "AUTO_APPROVED_DETERMINISTIC";
  if (summary.reviewStatus === "NEEDS_EDIT") return "NEEDS_HUMAN_EDIT";
  if (summary.reviewStatus === "DISMISSED") return "DISMISSED";

  return "PENDING_REVIEW";
}

function sortSummaryForExceptionQueue(
  summaryA: ReturnType<typeof enrichSummaryForReview>,
  summaryB: ReturnType<typeof enrichSummaryForReview>,
) {
  const priorityDifference =
    getSummaryExceptionPriority(summaryB) - getSummaryExceptionPriority(summaryA);

  if (priorityDifference !== 0) return priorityDifference;

  return (
    (summaryA.qualityScore ?? 101) - (summaryB.qualityScore ?? 101) ||
    summaryB.mentionCount - summaryA.mentionCount ||
    summaryB.createdAt.getTime() - summaryA.createdAt.getTime()
  );
}

function getSummaryExceptionPriority(summary: {
  needsHumanReview: boolean;
  reviewStatus: string;
  qualityScore: number | null;
  qualityWarnings: string[];
}) {
  if (summary.reviewStatus === "NEEDS_EDIT") return 5;
  if (summary.needsHumanReview) return 4;
  if ((summary.qualityScore ?? 100) < 60) return 3;
  if (summary.qualityWarnings.length > 0) return 2;

  return 1;
}

function normalizeReviewFilters(filters: TakeReviewFilters) {
  return {
    reviewStatus: normalizeOption(filters.reviewStatus, REVIEW_STATUSES, "ALL"),
    expertId: normalizeOptionalString(filters.expertId),
    q: normalizeOptionalString(filters.q),
    qualityFilter: normalizeOption(
      filters.qualityFilter,
      QUALITY_FILTERS,
      "NEEDS_HUMAN_REVIEW",
    ),
    sentiment: normalizeOption(filters.sentiment, SENTIMENTS, "ALL"),
    takeType: normalizeOption(filters.takeType, TAKE_TYPES, "ALL"),
    freshnessLabel: normalizeOption(
      filters.freshnessLabel,
      FRESHNESS_LABELS,
      "ALL",
    ),
    contentSeason: normalizeSeasonFilter(filters.contentSeason),
  };
}

function normalizeReviewUpdateInput(input: UpdateExpertTakeReviewInput) {
  const expertTakeId = normalizeOptionalString(input.expertTakeId);

  if (!expertTakeId) {
    throw new Error("Expert take ID is required.");
  }

  return {
    expertTakeId,
    reviewStatus: normalizeReviewStatus(input.reviewStatus),
    playerId:
      input.playerId === undefined
        ? undefined
        : normalizeOptionalString(input.playerId),
    sentiment:
      input.sentiment === undefined
        ? undefined
        : normalizeSentiment(input.sentiment),
    takeType:
      input.takeType === undefined
        ? undefined
        : normalizeTakeType(input.takeType),
    summary:
      input.summary === undefined
        ? undefined
        : requireString(input.summary, "Summary is required."),
    confidence:
      input.confidence === undefined
        ? undefined
        : normalizeConfidence(input.confidence),
  };
}

function normalizeOption<TValue extends string>(
  value: string | null | undefined,
  options: readonly TValue[],
  fallback: TValue | "ALL",
) {
  const normalizedValue = String(value ?? "").trim().toUpperCase();

  if (fallback === "ALL" && normalizedValue === "ALL") return "ALL";

  return options.find((option) => option === normalizedValue) ?? fallback;
}

function normalizeReviewStatus(value: string | null | undefined): ReviewStatus {
  const normalizedValue = String(value ?? "").trim().toUpperCase();

  return (
    REVIEW_STATUSES.find((option) => option === normalizedValue) ?? "PENDING"
  );
}

function normalizeSentiment(value: string | null | undefined): Sentiment {
  const normalizedValue = String(value ?? "").trim().toUpperCase();

  return SENTIMENTS.find((option) => option === normalizedValue) ?? "NEUTRAL";
}

function normalizeTakeType(value: string | null | undefined): TakeType {
  const normalizedValue = String(value ?? "").trim().toUpperCase();

  return (
    TAKE_TYPES.find((option) => option === normalizedValue) ?? "UNCATEGORIZED"
  );
}

function normalizeSeasonFilter(value: number | string | null | undefined) {
  const trimmedValue = String(value ?? "").trim();

  if (!trimmedValue) return undefined;

  return normalizeTargetSeason(trimmedValue);
}

function normalizeOptionalString(value: string | null | undefined) {
  const trimmedValue = String(value ?? "").trim();

  return trimmedValue ? trimmedValue : null;
}

function requireString(value: string | null | undefined, message: string) {
  const trimmedValue = normalizeOptionalString(value);

  if (!trimmedValue) throw new Error(message);

  return trimmedValue;
}

function normalizeConfidence(value: number | string | null | undefined) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) return 0.5;

  return Math.max(0, Math.min(1, parsedValue));
}

function normalizeForMatching(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
