import { getPlayerExpertConsensusBreakdown } from "@/knowledge-brain/expert-consensus";
import { getExpertMemoriesForPlayer } from "@/knowledge-brain/expert-memory";
import {
  calculateEvidenceQualitySummary,
  calculateSourceQualitySignal,
  evaluateEvidenceQuality,
  type EvidenceAuditTrail,
  type EvidenceQualitySummary,
  type SourceQualitySignal,
} from "@/knowledge-brain/evidence-quality";
import { normalizeTargetSeason } from "@/knowledge-brain/freshness";
import {
  getPlayerTrustProfile,
  type PlayerTrustProfile,
} from "@/knowledge-brain/trust-engine";
import { getPlayerWeightedConsensusBreakdown } from "@/knowledge-brain/weighted-consensus";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export type PlayerThesisStance = "Bullish" | "Bearish" | "Mixed" | "Neutral";

export type PlayerThesisPosture =
  | "Draft Target"
  | "Value Target"
  | "Proceed Carefully"
  | "Monitor"
  | "Discount Only"
  | "Avoid At Cost";

export type PlayerThesisConfidenceLabel =
  | "Strong"
  | "Solid"
  | "Developing"
  | "Limited";

export type PlayerThesisEvidenceStrengthLabel =
  | "Strong Evidence"
  | "Moderate Evidence"
  | "Limited Evidence"
  | "Thin Evidence"
  | "Provisional";

export type PlayerThesisTrend =
  | "Rising"
  | "Falling"
  | "Stable"
  | "Mixed"
  | "Insufficient Data";

export type PlayerThesisEvidence = {
  id: string;
  sourceType: "TRANSCRIPT_PLAYER_SUMMARY" | "EXPERT_TAKE_FALLBACK";
  expertName: string;
  sourceTitle: string;
  sourceUrl: string | null;
  publishedAt: Date | null;
  stance: string;
  qualityScore: number | null;
  qualityLabel: string;
  inclusionDecision: string;
  qualityWarnings: string[];
  qualityReasons: string[];
  confidence: number;
  excerpt: string;
};

export type PlayerThesisEvidenceStrength = {
  label: PlayerThesisEvidenceStrengthLabel;
  score: number;
  explanation: string;
  factors: string[];
};

export type PlayerThesisClaim = {
  id: string;
  label: string;
  description: string;
  strength: "Strong" | "Moderate" | "Limited";
  rankingScore: number;
  selectionReason: string;
  evidenceCount: number;
  sourceCount: number;
  qualityScore: number;
  supportingEvidence: PlayerThesisEvidence[];
};

export type PlayerThesisRisk = {
  id: string;
  label: string;
  description: string;
  severity: "High" | "Medium" | "Low";
  rankingScore: number;
  selectionReason: string;
  evidenceCount: number;
  sourceCount: number;
  supportingEvidence: PlayerThesisEvidence[];
};

export type PlayerThesisConfidence = {
  label: PlayerThesisConfidenceLabel;
  score: number;
  explanation: string;
  warnings: string[];
};

export type PlayerThesisSourceBreakdown = {
  expertId: string;
  expertName: string;
  stance: string;
  evidenceCount: number;
  latestEvidenceDate: Date | null;
};

export type PlayerThesis = {
  player: {
    id: string;
    name: string;
    position: string;
    team: string | null;
  };
  currentStance: PlayerThesisStance;
  draftRecommendationPosture: PlayerThesisPosture;
  thesisHeadline: string;
  thesisSummary: string;
  strongestSupportingClaims: PlayerThesisClaim[];
  strongestRisks: PlayerThesisRisk[];
  expertAgreementSummary: string;
  confidence: PlayerThesisConfidence;
  evidenceStrength: PlayerThesisEvidenceStrength;
  evidenceQualitySummary: EvidenceQualitySummary;
  sourceQuality: SourceQualitySignal;
  draftDayImpact: string;
  evidenceCount: number;
  sourceCount: number;
  latestEvidenceDate: Date | null;
  trendDirection: PlayerThesisTrend;
  sourceBreakdown: PlayerThesisSourceBreakdown[];
  supportingEvidence: PlayerThesisEvidence[];
  warnings: string[];
};

export type PlayerThesisFilters = {
  targetSeason?: number | string | null;
  includeHistorical?: boolean;
};

type NormalizedPlayerThesisFilters = {
  targetSeason: number;
  includeHistorical: boolean;
};

const THESIS_SUMMARY_INCLUDE = {
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
      contentSeason: true,
      includeInCurrentAnalysis: true,
      freshnessLabel: true,
      publishDate: true,
    },
  },
  evidence: {
    take: 4,
    orderBy: {
      createdAt: "asc",
    },
  },
} satisfies Prisma.TranscriptPlayerSummaryInclude;

const THESIS_TAKE_INCLUDE = {
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
      contentSeason: true,
      includeInCurrentAnalysis: true,
      freshnessLabel: true,
      publishDate: true,
    },
  },
} satisfies Prisma.ExpertTakeInclude;

type ThesisSummary = Prisma.TranscriptPlayerSummaryGetPayload<{
  include: typeof THESIS_SUMMARY_INCLUDE;
}>;

type ThesisFallbackTake = Prisma.ExpertTakeGetPayload<{
  include: typeof THESIS_TAKE_INCLUDE;
}>;

type ThemeEvidence = {
  theme: string;
  summary: ThesisSummary;
  evidence: PlayerThesisEvidence;
};

type ExpertTrustMap = Map<string, number>;

type RankingSignalInput = {
  evidenceCount: number;
  sourceCount: number;
  qualityScore: number;
  expertTrustScore: number;
  recencyScore: number;
  draftRelevanceScore: number;
};

const VAGUE_THEME_KEYS = new Set([
  "analysis",
  "bullish",
  "bearish",
  "fantasy",
  "general",
  "misc",
  "neutral",
  "news",
  "note",
  "player",
  "positive",
  "negative",
  "take",
  "uncategorized",
  "unknown",
]);

const DRAFT_RELEVANT_THEME_PATTERNS = [
  {
    label: "Role And Workload",
    keywords: [
      "bellcow",
      "committee",
      "depth",
      "opportunity",
      "role",
      "snap",
      "touch",
      "usage",
      "volume",
      "workload",
    ],
    score: 24,
  },
  {
    label: "Upside",
    keywords: [
      "athletic",
      "big play",
      "breakout",
      "ceiling",
      "explosive",
      "league winner",
      "sleeper",
      "upside",
    ],
    score: 22,
  },
  {
    label: "Draft Value",
    keywords: [
      "adp",
      "bargain",
      "cost",
      "discount",
      "price",
      "round",
      "undervalued",
      "value",
    ],
    score: 22,
  },
  {
    label: "Passing Game Role",
    keywords: [
      "catch",
      "reception",
      "route",
      "target",
      "receiving",
      "slot",
    ],
    score: 18,
  },
  {
    label: "Scoring Environment",
    keywords: [
      "offense",
      "quarterback",
      "red zone",
      "scheme",
      "scoring",
      "team environment",
      "touchdown",
    ],
    score: 16,
  },
  {
    label: "Safety",
    keywords: ["floor", "safe", "stability", "stable", "reliable"],
    score: 14,
  },
];

const RISK_THEME_PATTERNS = [
  {
    label: "Role Uncertainty",
    keywords: [
      "committee",
      "competition",
      "depth",
      "role",
      "split",
      "touch",
      "uncertain",
      "uncertainty",
      "usage",
      "workload",
    ],
  },
  {
    label: "Health Or Availability",
    keywords: [
      "availability",
      "health",
      "injury",
      "miss",
      "questionable",
      "recover",
    ],
  },
  {
    label: "Draft Cost Risk",
    keywords: ["adp", "cost", "expensive", "overpriced", "price", "reach"],
  },
  {
    label: "Volatility",
    keywords: ["boom", "bust", "volatile", "volatility", "risky", "variance"],
  },
];

export async function getPlayerThesis(
  playerId: string,
  filters: PlayerThesisFilters = {},
) {
  const normalizedFilters = normalizePlayerThesisFilters(filters);
  const transcriptWhere = buildTranscriptWhere(normalizedFilters);
  const [
    player,
    summaries,
    fallbackTakes,
    trustProfile,
    consensus,
    weightedConsensus,
    memories,
  ] = await Promise.all([
    db.player.findUnique({
      where: { id: playerId },
      select: {
        id: true,
        fullName: true,
        position: true,
        team: true,
      },
    }),
    db.transcriptPlayerSummary.findMany({
      where: {
        playerId,
        reviewStatus: "APPROVED",
        transcript: {
          is: transcriptWhere,
        },
      },
      include: THESIS_SUMMARY_INCLUDE,
      orderBy: [{ createdAt: "desc" }],
    }),
    db.expertTake.findMany({
      where: {
        playerId,
        reviewStatus: "APPROVED",
        transcript: {
          is: transcriptWhere,
        },
      },
      include: THESIS_TAKE_INCLUDE,
      orderBy: [{ createdAt: "desc" }],
    }),
    getPlayerTrustProfile(playerId, normalizedFilters),
    getPlayerExpertConsensusBreakdown({
      playerId,
      ...normalizedFilters,
    }),
    getPlayerWeightedConsensusBreakdown({
      playerId,
      ...normalizedFilters,
    }),
    getExpertMemoriesForPlayer(playerId, normalizedFilters),
  ]);

  if (!player) return null;

  const summaryKeys = new Set(
    summaries.map((summary) => `${summary.expertId}:${summary.playerId}`),
  );
  const approvedFallbackTakes = fallbackTakes.filter(
    (take) => !summaryKeys.has(`${take.expertId}:${take.playerId ?? ""}`),
  );
  const expertTrustById = buildExpertTrustMap(trustProfile);
  const summaryEvaluations = summaries.map((summary) => ({
    evaluation: evaluateEvidenceQuality(
      buildSummaryEvidenceQualityInput(
        summary,
        getExpertTrustScore(summary.expertId, expertTrustById),
      ),
    ),
    summary,
  }));
  const fallbackTakeEvaluations = approvedFallbackTakes.map((take) => ({
    evaluation: evaluateEvidenceQuality(
      buildTakeEvidenceQualityInput(
        take,
        getExpertTrustScore(take.expertId, expertTrustById),
      ),
    ),
    take,
  }));
  const summaryEvaluationById = new Map(
    summaryEvaluations.map(({ evaluation, summary }) => [summary.id, evaluation]),
  );
  const takeEvaluationById = new Map(
    fallbackTakeEvaluations.map(({ evaluation, take }) => [take.id, evaluation]),
  );
  const thesisSummaries = summaryEvaluations
    .filter(({ evaluation }) => evaluation.shouldUseInPlayerThesis)
    .map(({ summary }) => summary);
  const primaryClaimSummaries = summaryEvaluations
    .filter(({ evaluation }) => evaluation.canSupportPrimaryClaim)
    .map(({ summary }) => summary);
  const thesisFallbackTakes = fallbackTakeEvaluations
    .filter(({ evaluation }) => evaluation.shouldUseInPlayerThesis)
    .map(({ take }) => take);
  const allEvidenceEvaluations = [
    ...summaryEvaluations.map(({ evaluation }) => evaluation),
    ...fallbackTakeEvaluations.map(({ evaluation }) => evaluation),
  ];
  const allEvidenceInputs = [
    ...summaries.map((summary) =>
      buildSummaryEvidenceQualityInput(
        summary,
        getExpertTrustScore(summary.expertId, expertTrustById),
      ),
    ),
    ...approvedFallbackTakes.map((take) =>
      buildTakeEvidenceQualityInput(
        take,
        getExpertTrustScore(take.expertId, expertTrustById),
      ),
    ),
  ];
  const evidenceQualitySummary =
    calculateEvidenceQualitySummary(allEvidenceEvaluations);
  const sourceQuality = calculateSourceQualitySignal(
    allEvidenceInputs,
    allEvidenceEvaluations,
  );
  const evidence = [
    ...thesisSummaries
      .filter(
        (summary) =>
          summaryEvaluationById.get(summary.id)?.canAppearAsSupportingEvidence,
      )
      .map((summary) =>
        mapSummaryToEvidence(summary, summaryEvaluationById.get(summary.id)),
      ),
    ...thesisFallbackTakes
      .filter(
        (take) => takeEvaluationById.get(take.id)?.canAppearAsSupportingEvidence,
      )
      .map((take) => mapTakeToEvidence(take, takeEvaluationById.get(take.id))),
  ].sort(sortEvidenceByDate);
  const evidenceCount = thesisSummaries.reduce(
    (sum, summary) => sum + Math.max(1, summary.evidenceCount),
    0,
  ) + thesisFallbackTakes.length;
  const sourceCount = countSources(evidence);
  const latestEvidenceDate = getLatestDate(
    evidence.map((item) => item.publishedAt),
  );
  const sourceBreakdown = buildSourceBreakdown(thesisSummaries, thesisFallbackTakes);
  const evidenceStrength = calculateEvidenceStrength({
    summaries: thesisSummaries,
    fallbackTakes: thesisFallbackTakes,
    evidenceCount,
    sourceCount,
    latestEvidenceDate,
    evidenceQualitySummary,
  });
  const currentStance = getCurrentStance({
    trustProfile,
    consensusLabel: consensus.row?.consensusLabel,
    weightedConsensusLabel: weightedConsensus.row?.weightedConsensusLabel,
    summaries: thesisSummaries,
    fallbackTakes: thesisFallbackTakes,
  });
  const trendDirection = getTrendDirection({
    memoryTrends: memories.map((memory) => memory.memory.opinionTrend),
    snapshotDirection: trustProfile?.snapshotMovementSignal.direction,
  });
  const strongestSupportingClaims = buildSupportingClaims({
    summaries: primaryClaimSummaries,
    evidence,
    expertTrustById,
    evidenceStrength,
    summaryEvaluationById,
  });
  const strongestRisks = buildRisks({
    summaries: thesisSummaries,
    fallbackTakes: thesisFallbackTakes,
    evidence,
    trustProfile,
    expertTrustById,
    evidenceStrength,
    latestEvidenceDate,
    consensusLabel: consensus.row?.consensusLabel,
    memoryTrends: memories.map((memory) => memory.memory.opinionTrend),
    summaryEvaluationById,
    takeEvaluationById,
  });
  const confidence = buildConfidence({
    trustProfile,
    summaries: thesisSummaries,
    fallbackTakes: thesisFallbackTakes,
    evidenceCount,
    sourceCount,
    consensusLabel: consensus.row?.consensusLabel,
    latestEvidenceDate,
    evidenceStrength,
    evidenceQualitySummary,
  });
  const expertAgreementSummary = buildExpertAgreementSummary({
    consensusRow: consensus.row,
    weightedRow: weightedConsensus.row,
    sourceCount,
  });
  const draftRecommendationPosture = getDraftRecommendationPosture({
    stance: currentStance,
    confidence,
    trustScore: trustProfile?.playerTrustScore ?? null,
    evidenceStrength,
  });
  const thesisHeadline = buildThesisHeadline({
    playerName: player.fullName,
    stance: currentStance,
    posture: draftRecommendationPosture,
    trendDirection,
    topClaim: strongestSupportingClaims[0] ?? null,
    evidenceStrength,
  });
  const thesisSummary = buildThesisSummary({
    playerName: player.fullName,
    stance: currentStance,
    posture: draftRecommendationPosture,
    topClaim: strongestSupportingClaims[0] ?? null,
    topRisk: strongestRisks[0] ?? null,
    confidence,
    evidenceStrength,
  });
  const draftDayImpact = buildDraftDayImpact({
    playerName: player.fullName,
    posture: draftRecommendationPosture,
    evidenceStrength,
    topClaim: strongestSupportingClaims[0] ?? null,
    topRisk: strongestRisks[0] ?? null,
  });
  const warnings = dedupeStrings([
    ...confidence.warnings,
    ...getThesisWarnings({
      evidenceCount,
      sourceCount,
      summaries: thesisSummaries,
      consensusLabel: consensus.row?.consensusLabel,
      latestEvidenceDate,
      evidenceStrength,
      evidenceQualitySummary,
    }),
  ]);

  return {
    player: {
      id: player.id,
      name: player.fullName,
      position: player.position,
      team: player.team,
    },
    currentStance,
    draftRecommendationPosture,
    thesisHeadline,
    thesisSummary,
    strongestSupportingClaims,
    strongestRisks,
    expertAgreementSummary,
    confidence: {
      ...confidence,
      warnings,
    },
    evidenceStrength,
    evidenceQualitySummary,
    sourceQuality,
    draftDayImpact,
    evidenceCount,
    sourceCount,
    latestEvidenceDate,
    trendDirection,
    sourceBreakdown,
    supportingEvidence: evidence.slice(0, 8),
    warnings,
  } satisfies PlayerThesis;
}

export async function getPlayerThesesForPlayers(
  playerIds: string[],
  filters: PlayerThesisFilters = {},
) {
  const uniquePlayerIds = Array.from(new Set(playerIds.filter(Boolean)));
  const theses = await Promise.all(
    uniquePlayerIds.map((playerId) => getPlayerThesis(playerId, filters)),
  );

  return theses.filter((thesis): thesis is PlayerThesis => Boolean(thesis));
}

function normalizePlayerThesisFilters(
  filters: PlayerThesisFilters,
): NormalizedPlayerThesisFilters {
  return {
    targetSeason: normalizeTargetSeason(filters.targetSeason),
    includeHistorical: Boolean(filters.includeHistorical),
  };
}

function buildTranscriptWhere(
  filters: NormalizedPlayerThesisFilters,
): Prisma.TranscriptWhereInput {
  if (filters.includeHistorical) return {};

  return {
    contentSeason: filters.targetSeason,
    includeInCurrentAnalysis: true,
  };
}

function mapSummaryToEvidence(
  summary: ThesisSummary,
  evaluation?: EvidenceAuditTrail,
): PlayerThesisEvidence {
  return {
    id: summary.id,
    sourceType: "TRANSCRIPT_PLAYER_SUMMARY",
    expertName: summary.expert.name,
    sourceTitle: summary.sourceVideo.title,
    sourceUrl: summary.sourceVideo.url,
    publishedAt: summary.transcript.publishDate ?? summary.sourceVideo.publishedAt,
    stance: summary.stance,
    qualityScore: summary.qualityScore ?? null,
    qualityLabel: evaluation?.qualityLabel ?? "Mixed Quality",
    inclusionDecision: evaluation?.inclusionDecision ?? "INCLUDE_SECONDARY",
    qualityWarnings: evaluation?.warnings ?? [],
    qualityReasons: evaluation?.reasons ?? [],
    confidence: summary.confidence,
    excerpt:
      summary.evidence[0]?.excerpt ??
      summary.summary,
  };
}

function mapTakeToEvidence(
  take: ThesisFallbackTake,
  evaluation?: EvidenceAuditTrail,
): PlayerThesisEvidence {
  return {
    id: take.id,
    sourceType: "EXPERT_TAKE_FALLBACK",
    expertName: take.expert.name,
    sourceTitle: take.sourceVideo.title,
    sourceUrl: take.sourceVideo.url,
    publishedAt: take.transcript?.publishDate ?? take.sourceVideo.publishedAt,
    stance: take.sentiment,
    qualityScore: null,
    qualityLabel: evaluation?.qualityLabel ?? "Mixed Quality",
    inclusionDecision: evaluation?.inclusionDecision ?? "INCLUDE_SECONDARY",
    qualityWarnings: evaluation?.warnings ?? [],
    qualityReasons: evaluation?.reasons ?? [],
    confidence: take.confidence,
    excerpt: take.excerpt || take.summary,
  };
}

function buildSummaryEvidenceQualityInput(
  summary: ThesisSummary,
  expertTrustScore: number,
) {
  return {
    id: summary.id,
    evidenceType: "TRANSCRIPT_PLAYER_SUMMARY" as const,
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
    expertTrustScore,
  };
}

function buildTakeEvidenceQualityInput(
  take: ThesisFallbackTake,
  expertTrustScore: number,
) {
  return {
    id: take.id,
    evidenceType: "EXPERT_TAKE_FALLBACK" as const,
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
    expertTrustScore,
  };
}

function buildSupportingClaims({
  summaries,
  evidence,
  expertTrustById,
  evidenceStrength,
  summaryEvaluationById,
}: {
  summaries: ThesisSummary[];
  evidence: PlayerThesisEvidence[];
  expertTrustById: ExpertTrustMap;
  evidenceStrength: PlayerThesisEvidenceStrength;
  summaryEvaluationById: Map<string, EvidenceAuditTrail>;
}): PlayerThesisClaim[] {
  const claimEvidence = summaries
    .filter((summary) => summary.stance === "BULLISH" || summary.stance === "MIXED")
    .flatMap((summary) =>
      getHighQualityThemes(
        summary.primaryThemes,
        summary,
        summaryEvaluationById.get(summary.id),
      ).map((theme) => ({
        theme,
        summary,
        evidence: mapSummaryToEvidence(
          summary,
          summaryEvaluationById.get(summary.id),
        ),
      })),
    );
  const claims = buildThemeClaims(claimEvidence, expertTrustById)
    .filter((claim) => claim.rankingScore >= 52)
    .slice(0, 5);

  if (claims.length > 0) return claims;

  if (isWeakEvidence(evidenceStrength)) return [];

  const fallbackEvidence = evidence
    .filter((item) => item.stance === "BULLISH" || item.stance === "MIXED")
    .filter((item) => item.inclusionDecision === "INCLUDE_PRIMARY")
    .filter((item) => (item.qualityScore ?? Math.round(item.confidence * 100)) >= 65)
    .slice(0, 2);

  return fallbackEvidence.map((item) => ({
    id: `support-${item.id}`,
    label: "Positive Expert Read",
    description:
      "There is a positive expert read, but the case needs more supporting evidence before it should drive a draft pick by itself.",
    strength: item.confidence >= 0.75 ? "Moderate" : "Limited",
    rankingScore: Math.round(item.confidence * 70),
    selectionReason: "Fallback positive evidence because no repeated draft-relevant theme qualified.",
    evidenceCount: 1,
    sourceCount: 1,
    qualityScore: Math.round(item.confidence * 100),
    supportingEvidence: [item],
  }));
}

function buildThemeClaims(
  items: ThemeEvidence[],
  expertTrustById: ExpertTrustMap,
): PlayerThesisClaim[] {
  const byTheme = groupBy(items, (item) => normalizeKey(item.theme));

  return Array.from(byTheme.entries())
    .map(([key, themeItems]) => {
      const supportingEvidence = themeItems
        .map((item) => item.evidence)
        .sort(sortEvidenceByDate)
        .slice(0, 3);
      const qualityScore = averageQuality(themeItems.map((item) => item.summary));
      const sourceCount = countThemeSources(themeItems);
      const expertTrustScore = average(
        themeItems.map((item) =>
          getExpertTrustScore(item.summary.expertId, expertTrustById),
        ),
      );
      const recencyScore = getRecencyScore(
        getLatestDate(
          themeItems.map(
            (item) =>
              item.summary.transcript.publishDate ??
              item.summary.sourceVideo.publishedAt,
          ),
        ),
      );
      const draftRelevanceScore = getDraftRelevanceScore(
        themeItems[0]?.theme ?? key,
      );
      const rankingScore = calculateRankingScore({
        evidenceCount: themeItems.length,
        sourceCount,
        qualityScore,
        expertTrustScore,
        recencyScore,
        draftRelevanceScore,
      });

      return {
        id: `claim-${key}`,
        label: getDraftThemeLabel(themeItems[0]?.theme ?? key),
        description: buildClaimDescription(themeItems[0]?.theme ?? key, themeItems),
        strength: getClaimStrength({
          evidenceCount: themeItems.length,
          sourceCount,
          qualityScore,
          rankingScore,
        }),
        rankingScore,
        selectionReason: buildClaimSelectionReason({
          qualityScore,
          expertTrustScore,
          sourceCount,
          evidenceCount: themeItems.length,
          recencyScore,
          draftRelevanceScore,
        }),
        evidenceCount: themeItems.length,
        sourceCount,
        qualityScore,
        supportingEvidence,
      } satisfies PlayerThesisClaim;
    })
    .sort(
      (claimA, claimB) =>
        claimB.rankingScore - claimA.rankingScore ||
        getStrengthScore(claimB.strength) - getStrengthScore(claimA.strength) ||
        claimB.evidenceCount - claimA.evidenceCount ||
        claimB.qualityScore - claimA.qualityScore,
    );
}

function buildRisks({
  summaries,
  fallbackTakes,
  evidence,
  trustProfile,
  expertTrustById,
  evidenceStrength,
  latestEvidenceDate,
  consensusLabel,
  memoryTrends,
  summaryEvaluationById,
  takeEvaluationById,
}: {
  summaries: ThesisSummary[];
  fallbackTakes: ThesisFallbackTake[];
  evidence: PlayerThesisEvidence[];
  trustProfile: PlayerTrustProfile | null;
  expertTrustById: ExpertTrustMap;
  evidenceStrength: PlayerThesisEvidenceStrength;
  latestEvidenceDate: Date | null;
  consensusLabel?: string | null;
  memoryTrends: string[];
  summaryEvaluationById: Map<string, EvidenceAuditTrail>;
  takeEvaluationById: Map<string, EvidenceAuditTrail>;
}): PlayerThesisRisk[] {
  const caveatItems = summaries.flatMap((summary) =>
    summary.importantCaveats.map((theme) => ({
      theme,
      summary,
      evidence: mapSummaryToEvidence(
        summary,
        summaryEvaluationById.get(summary.id),
      ),
    })),
  );
  const bearishItems = summaries
    .filter((summary) => summary.stance === "BEARISH")
    .flatMap((summary) =>
      [...summary.primaryThemes, "bearish expert concern"].map((theme) => ({
        theme,
        summary,
        evidence: mapSummaryToEvidence(
          summary,
          summaryEvaluationById.get(summary.id),
        ),
      })),
    );
  const themeRisks = buildThemeRisks(
    [...caveatItems, ...bearishItems],
    expertTrustById,
  );
  const fallbackRisks = fallbackTakes
    .filter((take) => take.sentiment === "BEARISH")
    .filter((take) => takeEvaluationById.get(take.id)?.canSupportRisk)
    .slice(0, 2)
    .map((take) => {
      const item = mapTakeToEvidence(take, takeEvaluationById.get(take.id));

      return {
        id: `risk-${take.id}`,
        label: "Bearish expert concern",
        description:
          "At least one reviewed expert read is negative, so the pick should be discounted unless the board value is obvious.",
        severity: take.confidence >= 0.7 ? "Medium" : "Low",
        rankingScore: Math.round(take.confidence * 60),
        selectionReason: "Approved fallback bearish take.",
        evidenceCount: 1,
        sourceCount: 1,
        supportingEvidence: [item],
      } satisfies PlayerThesisRisk;
    });
  const warningRisks =
    trustProfile?.disagreementWarnings.slice(0, 1).map((warning, index) => ({
      id: `risk-trust-warning-${index}`,
      label: "Expert disagreement",
      description:
        "The expert read is split enough that this should not be treated as an automatic pick.",
      severity: "Medium" as const,
      rankingScore: 68,
      selectionReason: warning,
      evidenceCount: trustProfile.evidenceCount,
      sourceCount: trustProfile.topSupportingExperts.length,
      supportingEvidence: evidence.slice(0, 2),
    })) ?? [];
  const evidenceRisks = buildEvidenceQualityRisks({
    evidenceStrength,
    evidence,
    latestEvidenceDate,
    consensusLabel,
    memoryTrends,
  });

  return dedupeRisks([...themeRisks, ...fallbackRisks, ...warningRisks, ...evidenceRisks])
    .sort(
      (riskA, riskB) =>
        riskB.rankingScore - riskA.rankingScore ||
        getRiskScore(riskB.severity) - getRiskScore(riskA.severity),
    )
    .slice(0, 4);
}

function buildThemeRisks(
  items: ThemeEvidence[],
  expertTrustById: ExpertTrustMap,
): PlayerThesisRisk[] {
  const byTheme = groupBy(items, (item) => normalizeKey(item.theme));

  return Array.from(byTheme.entries())
    .map(([key, themeItems]) => {
      const supportingEvidence = themeItems
        .map((item) => item.evidence)
        .sort(sortEvidenceByDate)
        .slice(0, 3);
      const qualityScore = averageQuality(themeItems.map((item) => item.summary));
      const sourceCount = countThemeSources(themeItems);
      const expertTrustScore = average(
        themeItems.map((item) =>
          getExpertTrustScore(item.summary.expertId, expertTrustById),
        ),
      );
      const recencyScore = getRecencyScore(
        getLatestDate(
          themeItems.map(
            (item) =>
              item.summary.transcript.publishDate ??
              item.summary.sourceVideo.publishedAt,
          ),
        ),
      );
      const riskRelevanceScore = Math.max(
        12,
        getRiskThemeLabel(themeItems[0]?.theme ?? key).label !==
          formatThemeLabel(themeItems[0]?.theme ?? key)
          ? 22
          : getDraftRelevanceScore(themeItems[0]?.theme ?? key),
      );
      const rankingScore = calculateRankingScore({
        evidenceCount: themeItems.length,
        sourceCount,
        qualityScore,
        expertTrustScore,
        recencyScore,
        draftRelevanceScore: riskRelevanceScore,
      });
      const severity = getRiskSeverity({
        evidenceCount: themeItems.length,
        qualityScore,
        rankingScore,
        sourceCount,
      });

      return {
        id: `risk-${key}`,
        label: getRiskThemeLabel(themeItems[0]?.theme ?? key).label,
        description: buildRiskDescription(themeItems[0]?.theme ?? key, themeItems),
        severity,
        rankingScore,
        selectionReason: buildRiskSelectionReason({
          evidenceCount: themeItems.length,
          sourceCount,
          qualityScore,
          expertTrustScore,
          recencyScore,
        }),
        evidenceCount: themeItems.length,
        sourceCount,
        supportingEvidence,
      } satisfies PlayerThesisRisk;
    })
    .sort(
      (riskA, riskB) =>
        riskB.rankingScore - riskA.rankingScore ||
        getRiskScore(riskB.severity) - getRiskScore(riskA.severity) ||
        riskB.evidenceCount - riskA.evidenceCount,
    );
}

function getHighQualityThemes(
  themes: string[],
  summary: ThesisSummary,
  evaluation?: EvidenceAuditTrail,
) {
  if (!isHighQualitySummary(summary, evaluation)) return [];

  return themes
    .map((theme) => theme.trim())
    .filter((theme) => theme.length > 0)
    .filter((theme) => !isVagueTheme(theme))
    .filter((theme) => getDraftRelevanceScore(theme) >= 8)
    .slice(0, 5);
}

function isHighQualitySummary(
  summary: ThesisSummary,
  evaluation?: EvidenceAuditTrail,
) {
  const qualityScore = summary.qualityScore ?? Math.round(summary.confidence * 100);
  const attributionLabel = summary.attributionQualityLabel?.toLowerCase() ?? "";
  const evidenceLabel = summary.evidenceQualityLabel?.toLowerCase() ?? "";

  return (
    summary.reviewStatus === "APPROVED" &&
    (evaluation?.canSupportPrimaryClaim ?? true) &&
    qualityScore >= 65 &&
    summary.confidence >= 0.55 &&
    !attributionLabel.includes("low") &&
    !evidenceLabel.includes("low")
  );
}

function getCurrentStance({
  trustProfile,
  consensusLabel,
  weightedConsensusLabel,
  summaries,
  fallbackTakes,
}: {
  trustProfile: PlayerTrustProfile | null;
  consensusLabel?: string | null;
  weightedConsensusLabel?: string | null;
  summaries: ThesisSummary[];
  fallbackTakes: ThesisFallbackTake[];
}): PlayerThesisStance {
  if (trustProfile) return trustProfile.stanceSummary;

  const label = weightedConsensusLabel ?? consensusLabel ?? "";

  if (label.includes("Bullish")) return "Bullish";
  if (label.includes("Bearish")) return "Bearish";
  if (label.includes("Mixed") || label.includes("Split")) return "Mixed";

  const counts = countStances([
    ...summaries.map((summary) => summary.stance),
    ...fallbackTakes.map((take) => take.sentiment),
  ]);

  if (counts.bullish > counts.bearish && counts.bullish > counts.neutral) {
    return "Bullish";
  }
  if (counts.bearish > counts.bullish && counts.bearish > counts.neutral) {
    return "Bearish";
  }
  if (counts.bullish > 0 && counts.bearish > 0) return "Mixed";

  return "Neutral";
}

function buildConfidence({
  trustProfile,
  summaries,
  fallbackTakes,
  evidenceCount,
  sourceCount,
  consensusLabel,
  latestEvidenceDate,
  evidenceStrength,
  evidenceQualitySummary,
}: {
  trustProfile: PlayerTrustProfile | null;
  summaries: ThesisSummary[];
  fallbackTakes: ThesisFallbackTake[];
  evidenceCount: number;
  sourceCount: number;
  consensusLabel?: string | null;
  latestEvidenceDate: Date | null;
  evidenceStrength: PlayerThesisEvidenceStrength;
  evidenceQualitySummary: EvidenceQualitySummary;
}): PlayerThesisConfidence {
  const averageSummaryQuality = averageQuality(summaries);
  const fallbackPenalty = fallbackTakes.length > 0 && summaries.length === 0 ? 18 : 0;
  const sourceScore = Math.min(18, sourceCount * 5);
  const evidenceScore = Math.min(16, evidenceCount * 2.5);
  const trustScore = trustProfile?.playerTrustScore ?? 50;
  const qualityScore = summaries.length > 0 ? averageSummaryQuality : 55;
  const recencyScore = getRecencyScore(latestEvidenceDate);
  const disagreementPenalty =
    consensusLabel === "Split" || consensusLabel === "Not Enough Data" ? 10 : 0;
  const evidenceStrengthPenalty = isWeakEvidence(evidenceStrength) ? 16 : 0;
  const evidenceQualityPenalty =
    evidenceQualitySummary.qualityLabel === "Excluded"
      ? 28
      : evidenceQualitySummary.qualityLabel === "Low Quality"
        ? 20
        : evidenceQualitySummary.qualityLabel === "Mixed Quality"
          ? 10
          : 0;
  const score = clamp(
    Math.round(
      trustScore * 0.35 +
        qualityScore * 0.25 +
        sourceScore +
        evidenceScore +
        recencyScore -
        fallbackPenalty -
        disagreementPenalty -
        evidenceStrengthPenalty -
        evidenceQualityPenalty,
    ),
    0,
    100,
  );
  const label = getConfidenceLabel(score);
  const warnings = getConfidenceWarnings({
    summaries,
    fallbackTakes,
    evidenceCount,
    sourceCount,
    consensusLabel,
    latestEvidenceDate,
    label,
    evidenceStrength,
    evidenceQualitySummary,
  });

  return {
    label,
    score,
    explanation: buildConfidenceExplanation({
      label,
      evidenceStrength,
      evidenceCount,
      sourceCount,
      trustScore: trustProfile?.playerTrustScore ?? null,
      evidenceQualitySummary,
    }),
    warnings,
  };
}

function getConfidenceWarnings({
  summaries,
  fallbackTakes,
  evidenceCount,
  sourceCount,
  consensusLabel,
  latestEvidenceDate,
  label,
  evidenceStrength,
  evidenceQualitySummary,
}: {
  summaries: ThesisSummary[];
  fallbackTakes: ThesisFallbackTake[];
  evidenceCount: number;
  sourceCount: number;
  consensusLabel?: string | null;
  latestEvidenceDate: Date | null;
  label: PlayerThesisConfidenceLabel;
  evidenceStrength: PlayerThesisEvidenceStrength;
  evidenceQualitySummary: EvidenceQualitySummary;
}) {
  const warnings: string[] = [];
  const hasLowAttribution = summaries.some((summary) =>
    (summary.attributionQualityLabel ?? "").toLowerCase().includes("low"),
  );
  const onlyFallback = fallbackTakes.length > 0 && summaries.length === 0;

  if (evidenceCount < 3 || sourceCount < 2) {
    warnings.push("Limited reviewed evidence.");
  }
  if (consensusLabel === "Split") {
    warnings.push("Expert opinion is mixed.");
  }
  if (isOlderThanDays(latestEvidenceDate, 30)) {
    warnings.push("Recent draft intelligence is sparse.");
  }
  if (hasLowAttribution || onlyFallback) {
    warnings.push("Source attribution confidence is not strong enough to lean on by itself.");
  }
  if (isWeakEvidence(evidenceStrength)) {
    warnings.push(`${evidenceStrength.label}: treat this as a watch-list signal, not a standalone reason to draft.`);
  }
  if (evidenceQualitySummary.excludedEvidenceCount > 0) {
    warnings.push(
      `${evidenceQualitySummary.excludedEvidenceCount} evidence item${
        evidenceQualitySummary.excludedEvidenceCount === 1 ? "" : "s"
      } excluded due to quality or freshness concerns.`,
    );
  }
  if (
    evidenceQualitySummary.qualityLabel === "Mixed Quality" ||
    evidenceQualitySummary.qualityLabel === "Low Quality"
  ) {
    warnings.push(`${evidenceQualitySummary.qualityLabel}: evidence should be treated cautiously.`);
  }
  if (label === "Limited" || evidenceCount < 3) {
    warnings.push("This draft case is provisional.");
  }

  return warnings;
}

function getThesisWarnings({
  evidenceCount,
  sourceCount,
  summaries,
  consensusLabel,
  latestEvidenceDate,
  evidenceStrength,
  evidenceQualitySummary,
}: {
  evidenceCount: number;
  sourceCount: number;
  summaries: ThesisSummary[];
  consensusLabel?: string | null;
  latestEvidenceDate: Date | null;
  evidenceStrength: PlayerThesisEvidenceStrength;
  evidenceQualitySummary: EvidenceQualitySummary;
}) {
  const warnings: string[] = [];

  if (evidenceCount < 3 || sourceCount < 2) {
    warnings.push("Limited reviewed evidence.");
  }
  if (consensusLabel === "Split") {
    warnings.push("Expert opinion is mixed.");
  }
  if (isOlderThanDays(latestEvidenceDate, 30)) {
    warnings.push("Recent draft intelligence is sparse.");
  }
  if (
    summaries.some((summary) =>
      (summary.attributionQualityLabel ?? "").toLowerCase().includes("low"),
    )
  ) {
    warnings.push("Source attribution confidence is not strong enough to lean on by itself.");
  }
  if (isWeakEvidence(evidenceStrength)) {
    warnings.push(`${evidenceStrength.label}: treat this as a watch-list signal, not a standalone reason to draft.`);
  }
  if (evidenceQualitySummary.excludedEvidenceCount > 0) {
    warnings.push(
      `${evidenceQualitySummary.excludedEvidenceCount} evidence item${
        evidenceQualitySummary.excludedEvidenceCount === 1 ? "" : "s"
      } was excluded from this Draft Case.`,
    );
  }
  if (evidenceQualitySummary.caveatOnlyEvidenceCount > 0) {
    warnings.push(
      `${evidenceQualitySummary.caveatOnlyEvidenceCount} evidence item${
        evidenceQualitySummary.caveatOnlyEvidenceCount === 1 ? "" : "s"
      } can only support caveats or secondary context.`,
    );
  }
  if (evidenceCount < 3) {
    warnings.push("This draft case is provisional.");
  }

  return warnings;
}

function buildExpertAgreementSummary({
  consensusRow,
  weightedRow,
  sourceCount,
}: {
  consensusRow: Awaited<ReturnType<typeof getPlayerExpertConsensusBreakdown>>["row"];
  weightedRow: Awaited<ReturnType<typeof getPlayerWeightedConsensusBreakdown>>["row"];
  sourceCount: number;
}) {
  if (weightedRow) {
    return `${weightedRow.totalExperts} expert${
      weightedRow.totalExperts === 1 ? "" : "s"
    } contribute to the current read. The trusted view is ${
      weightedRow.weightedConsensusLabel
    } with ${weightedRow.weightedAgreementScore}% agreement.`;
  }

  if (consensusRow) {
    return `${consensusRow.totalExperts} expert${
      consensusRow.totalExperts === 1 ? "" : "s"
    } contribute to the current read. The current view is ${
      consensusRow.consensusLabel
    } with ${consensusRow.agreementScore}% agreement.`;
  }

  return sourceCount > 0
    ? `${sourceCount} source${sourceCount === 1 ? "" : "s"} support a provisional read, but expert agreement is not established yet.`
    : "No approved expert agreement is available in the selected scope yet.";
}

function getDraftRecommendationPosture({
  stance,
  confidence,
  trustScore,
  evidenceStrength,
}: {
  stance: PlayerThesisStance;
  confidence: PlayerThesisConfidence;
  trustScore: number | null;
  evidenceStrength: PlayerThesisEvidenceStrength;
}): PlayerThesisPosture {
  if (isWeakEvidence(evidenceStrength)) {
    if (stance === "Bearish") return "Discount Only";
    if (stance === "Mixed") return "Proceed Carefully";
    return "Monitor";
  }

  if (stance === "Bullish" && confidence.score >= 75) return "Draft Target";
  if (stance === "Bullish" && (trustScore ?? 50) >= 55) return "Value Target";
  if (stance === "Bearish" && (trustScore ?? 50) < 45) return "Avoid At Cost";
  if (stance === "Bearish") return "Discount Only";
  if (stance === "Mixed") return "Proceed Carefully";

  return "Monitor";
}

function buildThesisHeadline({
  playerName,
  stance,
  posture,
  trendDirection,
  topClaim,
  evidenceStrength,
}: {
  playerName: string;
  stance: PlayerThesisStance;
  posture: PlayerThesisPosture;
  trendDirection: PlayerThesisTrend;
  topClaim: PlayerThesisClaim | null;
  evidenceStrength: PlayerThesisEvidenceStrength;
}) {
  if (isWeakEvidence(evidenceStrength)) {
    return `${playerName}'s draft case is still developing.`;
  }

  const claimText = topClaim ? ` around ${topClaim.label.toLowerCase()}` : "";

  if (stance === "Bullish") {
    return `${playerName} has a ${posture.toLowerCase()} case${claimText}${
      trendDirection === "Rising" ? " with rising expert support" : ""
    }.`;
  }
  if (stance === "Bearish") {
    return `${playerName} carries enough risk to require a discount.`;
  }
  if (stance === "Mixed") {
    return `${playerName} has a split draft case that depends on price.`;
  }

  return `${playerName} is a monitor candidate until stronger evidence arrives.`;
}

function buildThesisSummary({
  playerName,
  stance,
  posture,
  topClaim,
  topRisk,
  confidence,
  evidenceStrength,
}: {
  playerName: string;
  stance: PlayerThesisStance;
  posture: PlayerThesisPosture;
  topClaim: PlayerThesisClaim | null;
  topRisk: PlayerThesisRisk | null;
  confidence: PlayerThesisConfidence;
  evidenceStrength: PlayerThesisEvidenceStrength;
}) {
  if (isWeakEvidence(evidenceStrength)) {
    return `The current draft case for ${playerName} is still developing. There is not enough strong reviewed evidence yet to make him more than a watch-list or price-dependent option.`;
  }

  const claimText = topClaim
    ? `${topClaim.label.toLowerCase()} is the clearest reason to consider him.`
    : "The pro-draft case is not built around one clear strength yet.";
  const riskText = topRisk
    ? `The main reason to pause is ${topRisk.label.toLowerCase()}.`
    : "There is not a major reviewed downside flag yet.";
  const stanceText = getDraftStancePhrase(stance, posture);
  const confidenceText =
    confidence.label === "Strong" || confidence.label === "Solid"
      ? "strong enough to influence a draft decision"
      : "useful, but not strong enough to be the only reason for the pick";

  return `${playerName} is ${stanceText}. ${claimText} ${riskText} The evidence is ${evidenceStrength.label.toLowerCase()}, so the case is ${confidenceText}.`;
}

function buildDraftDayImpact({
  playerName,
  posture,
  evidenceStrength,
  topClaim,
  topRisk,
}: {
  playerName: string;
  posture: PlayerThesisPosture;
  evidenceStrength: PlayerThesisEvidenceStrength;
  topClaim: PlayerThesisClaim | null;
  topRisk: PlayerThesisRisk | null;
}) {
  if (isWeakEvidence(evidenceStrength)) {
    return `Use ${playerName} as a watch-list name. The current evidence is not strong enough to break ties unless the draft price falls or your roster need is specific.`;
  }

  if (posture === "Draft Target" || posture === "Value Target") {
    return `${playerName} can be used as a tie-breaker or target when the board fits. ${
      topClaim
        ? `${topClaim.label} is the main reason the pick can beat cost.`
        : "The case is positive, but still needs a clearer primary driver."
    } ${topRisk ? `Do not ignore ${topRisk.label.toLowerCase()}.` : ""}`.trim();
  }

  if (posture === "Discount Only" || posture === "Avoid At Cost") {
    return `${playerName} should only be considered if the price falls. ${
      topRisk
        ? `${topRisk.label} is the main reason to avoid forcing the pick.`
        : "The downside case is stronger than the current upside case."
    }`;
  }

  return `${playerName} is a context-dependent pick. Let roster need, available alternatives, and price decide whether the case matters on draft day.`;
}

function getTrendDirection({
  memoryTrends,
  snapshotDirection,
}: {
  memoryTrends: string[];
  snapshotDirection?: string;
}): PlayerThesisTrend {
  if (snapshotDirection === "UP") return "Rising";
  if (snapshotDirection === "DOWN") return "Falling";

  const rising = memoryTrends.filter((trend) =>
    trend.toLowerCase().includes("increasing bullishness"),
  ).length;
  const falling = memoryTrends.filter(
    (trend) =>
      trend.toLowerCase().includes("increasing bearishness") ||
      trend.toLowerCase().includes("decreasing bullishness"),
  ).length;
  const mixed = memoryTrends.filter((trend) =>
    trend.toLowerCase().includes("mixed"),
  ).length;

  if (rising > falling && rising > 0) return "Rising";
  if (falling > rising && falling > 0) return "Falling";
  if (mixed > 0 || (rising > 0 && falling > 0)) return "Mixed";
  if (memoryTrends.some((trend) => trend.toLowerCase().includes("stable"))) {
    return "Stable";
  }

  return "Insufficient Data";
}

function buildSourceBreakdown(
  summaries: ThesisSummary[],
  fallbackTakes: ThesisFallbackTake[],
): PlayerThesisSourceBreakdown[] {
  const items = [
    ...summaries.map((summary) => ({
      expertId: summary.expertId,
      expertName: summary.expert.name,
      stance: summary.stance,
      evidenceCount: Math.max(1, summary.evidenceCount),
      latestEvidenceDate:
        summary.transcript.publishDate ?? summary.sourceVideo.publishedAt,
    })),
    ...fallbackTakes.map((take) => ({
      expertId: take.expertId,
      expertName: take.expert.name,
      stance: take.sentiment,
      evidenceCount: 1,
      latestEvidenceDate: take.transcript?.publishDate ?? take.sourceVideo.publishedAt,
    })),
  ];
  const grouped = groupBy(items, (item) => item.expertId);

  return Array.from(grouped.values())
    .map((expertItems) => {
      const latest = expertItems.sort(
        (itemA, itemB) =>
          getDateTime(itemB.latestEvidenceDate) -
          getDateTime(itemA.latestEvidenceDate),
      )[0];

      return {
        expertId: latest.expertId,
        expertName: latest.expertName,
        stance: latest.stance,
        evidenceCount: expertItems.reduce(
          (sum, item) => sum + item.evidenceCount,
          0,
        ),
        latestEvidenceDate: latest.latestEvidenceDate,
      };
    })
    .sort(
      (expertA, expertB) =>
        expertB.evidenceCount - expertA.evidenceCount ||
        getDateTime(expertB.latestEvidenceDate) -
          getDateTime(expertA.latestEvidenceDate),
    );
}

function calculateEvidenceStrength({
  summaries,
  fallbackTakes,
  evidenceCount,
  sourceCount,
  latestEvidenceDate,
  evidenceQualitySummary,
}: {
  summaries: ThesisSummary[];
  fallbackTakes: ThesisFallbackTake[];
  evidenceCount: number;
  sourceCount: number;
  latestEvidenceDate: Date | null;
  evidenceQualitySummary: EvidenceQualitySummary;
}): PlayerThesisEvidenceStrength {
  const qualityScore =
    summaries.length > 0
      ? averageQuality(summaries)
      : fallbackTakes.length > 0
        ? Math.round(
            average(fallbackTakes.map((take) => Math.round(take.confidence * 100))),
          )
        : 0;
  const sourceScore = Math.min(24, sourceCount * 8);
  const evidenceScore = Math.min(22, evidenceCount * 3);
  const recencyScore = getRecencyScore(latestEvidenceDate);
  const summaryCoverageScore =
    summaries.length > 0 ? Math.min(16, summaries.length * 4) : 0;
  const fallbackPenalty = summaries.length === 0 && fallbackTakes.length > 0 ? 12 : 0;
  const excludedPenalty = Math.min(
    18,
    evidenceQualitySummary.excludedEvidenceCount * 6,
  );
  const limitedPenalty = Math.min(
    10,
    evidenceQualitySummary.limitedEvidenceCount * 3,
  );
  const score = clamp(
    Math.round(
      qualityScore * 0.32 +
        sourceScore +
        evidenceScore +
        recencyScore +
        summaryCoverageScore -
        fallbackPenalty -
        excludedPenalty -
        limitedPenalty,
    ),
    0,
    100,
  );
  const label = getEvidenceStrengthLabel({
    score,
    sourceCount,
    evidenceCount,
    qualityScore,
    latestEvidenceDate,
    evidenceQualitySummary,
  });
  const factors = [
    `${evidenceCount} reviewed evidence item${evidenceCount === 1 ? "" : "s"}`,
    `${sourceCount} source${sourceCount === 1 ? "" : "s"}`,
    qualityScore > 0 ? `${qualityScore}/100 average quality` : "no quality score yet",
    latestEvidenceDate
      ? `latest update ${formatShortDate(latestEvidenceDate)}`
      : "no recent dated evidence",
  ];

  return {
    label,
    score,
    explanation: buildEvidenceStrengthExplanation({
      label,
      evidenceCount,
      sourceCount,
      qualityScore,
    latestEvidenceDate,
    evidenceQualitySummary,
  }),
    factors,
  };
}

function getEvidenceStrengthLabel({
  score,
  sourceCount,
  evidenceCount,
  qualityScore,
  latestEvidenceDate,
  evidenceQualitySummary,
}: {
  score: number;
  sourceCount: number;
  evidenceCount: number;
  qualityScore: number;
  latestEvidenceDate: Date | null;
  evidenceQualitySummary: EvidenceQualitySummary;
}): PlayerThesisEvidenceStrengthLabel {
  if (evidenceCount === 0 || sourceCount === 0) return "Provisional";
  if (
    evidenceQualitySummary.qualityLabel === "Excluded" ||
    evidenceQualitySummary.qualityLabel === "Low Quality"
  ) {
    return "Provisional";
  }
  if (evidenceQualitySummary.excludedEvidenceCount >= evidenceCount) {
    return "Provisional";
  }
  if (sourceCount < 2 && evidenceCount < 3) return "Thin Evidence";
  if (isOlderThanDays(latestEvidenceDate, 60)) return "Limited Evidence";
  if (score >= 80 && sourceCount >= 3 && qualityScore >= 78) {
    return "Strong Evidence";
  }
  if (score >= 65 && sourceCount >= 2 && qualityScore >= 68) {
    return "Moderate Evidence";
  }
  if (score >= 48) return "Limited Evidence";
  if (score >= 30) return "Thin Evidence";

  return "Provisional";
}

function buildEvidenceStrengthExplanation({
  label,
  evidenceCount,
  sourceCount,
  qualityScore,
  latestEvidenceDate,
  evidenceQualitySummary,
}: {
  label: PlayerThesisEvidenceStrengthLabel;
  evidenceCount: number;
  sourceCount: number;
  qualityScore: number;
  latestEvidenceDate: Date | null;
  evidenceQualitySummary: EvidenceQualitySummary;
}) {
  const exclusionText =
    evidenceQualitySummary.excludedEvidenceCount > 0
      ? ` ${evidenceQualitySummary.excludedEvidenceCount} evidence item${
          evidenceQualitySummary.excludedEvidenceCount === 1 ? "" : "s"
        } were excluded because of source or quality concerns.`
      : "";

  if (label === "Strong Evidence") {
    return `Multiple reviewed sources, useful quality, and recent evidence support using this draft case as a real decision input.${exclusionText}`;
  }
  if (label === "Moderate Evidence") {
    return `The case has enough reviewed support to matter, but it still needs price, roster fit, and alternatives to confirm the pick.${exclusionText}`;
  }
  if (label === "Limited Evidence") {
    return `There is some useful support, but the case is not strong enough to override price or roster context.${exclusionText}`;
  }
  if (label === "Thin Evidence") {
    return `The case is based on a small or narrow evidence set, so use it as a watch-list signal.${exclusionText}`;
  }

  const dateText = latestEvidenceDate ? ` Latest evidence: ${formatShortDate(latestEvidenceDate)}.` : "";

  return `There is not enough reviewed evidence yet to make a strong draft recommendation. Evidence: ${evidenceCount} item${evidenceCount === 1 ? "" : "s"} from ${sourceCount} source${sourceCount === 1 ? "" : "s"} with ${qualityScore}/100 average quality.${dateText}${exclusionText}`;
}

function isWeakEvidence(evidenceStrength: PlayerThesisEvidenceStrength) {
  return (
    evidenceStrength.label === "Thin Evidence" ||
    evidenceStrength.label === "Provisional"
  );
}

function buildExpertTrustMap(trustProfile: PlayerTrustProfile | null): ExpertTrustMap {
  return new Map(
    trustProfile?.topSupportingExperts.map((expert) => [
      expert.expertId,
      expert.trustScore,
    ]) ?? [],
  );
}

function getExpertTrustScore(expertId: string, expertTrustById: ExpertTrustMap) {
  return expertTrustById.get(expertId) ?? 50;
}

function calculateRankingScore({
  evidenceCount,
  sourceCount,
  qualityScore,
  expertTrustScore,
  recencyScore,
  draftRelevanceScore,
}: RankingSignalInput) {
  const repeatedSupportScore = Math.min(18, evidenceCount * 4 + sourceCount * 5);

  return clamp(
    Math.round(
      qualityScore * 0.3 +
        expertTrustScore * 0.22 +
        recencyScore * 0.6 +
        repeatedSupportScore +
        draftRelevanceScore,
    ),
    0,
    100,
  );
}

function buildClaimSelectionReason({
  qualityScore,
  expertTrustScore,
  sourceCount,
  evidenceCount,
  recencyScore,
  draftRelevanceScore,
}: RankingSignalInput) {
  return `Ranked by ${qualityScore}/100 quality, ${Math.round(
    expertTrustScore,
  )}/100 expert trust, ${evidenceCount} evidence item${
    evidenceCount === 1 ? "" : "s"
  }, ${sourceCount} source${sourceCount === 1 ? "" : "s"}, ${
    recencyScore > 0 ? "recent evidence" : "limited recency"
  }, and ${draftRelevanceScore}/24 draft relevance.`;
}

function buildRiskSelectionReason({
  qualityScore,
  expertTrustScore,
  sourceCount,
  evidenceCount,
  recencyScore,
}: Omit<RankingSignalInput, "draftRelevanceScore">) {
  return `Ranked by repeated caveats, ${qualityScore}/100 quality, ${Math.round(
    expertTrustScore,
  )}/100 expert trust, ${evidenceCount} evidence item${
    evidenceCount === 1 ? "" : "s"
  }, ${sourceCount} source${sourceCount === 1 ? "" : "s"}, and ${
    recencyScore > 0 ? "recent support" : "limited recency"
  }.`;
}

function buildEvidenceQualityRisks({
  evidenceStrength,
  evidence,
  latestEvidenceDate,
  consensusLabel,
  memoryTrends,
}: {
  evidenceStrength: PlayerThesisEvidenceStrength;
  evidence: PlayerThesisEvidence[];
  latestEvidenceDate: Date | null;
  consensusLabel?: string | null;
  memoryTrends: string[];
}): PlayerThesisRisk[] {
  const risks: PlayerThesisRisk[] = [];

  if (isWeakEvidence(evidenceStrength)) {
    risks.push({
      id: "risk-thin-evidence",
      label: evidenceStrength.label,
      description:
        "The evidence base is not strong enough to make this a standalone draft recommendation yet.",
      severity: evidenceStrength.label === "Provisional" ? "High" : "Medium",
      rankingScore: evidenceStrength.label === "Provisional" ? 88 : 74,
      selectionReason: evidenceStrength.explanation,
      evidenceCount: evidence.length,
      sourceCount: countSources(evidence),
      supportingEvidence: evidence.slice(0, 2),
    });
  }

  if (consensusLabel === "Split") {
    risks.push({
      id: "risk-split-opinion",
      label: "Split Expert Read",
      description:
        "Expert opinion is divided, so the draft case should be used with more caution than a clean consensus target.",
      severity: "Medium",
      rankingScore: 72,
      selectionReason: "Consensus label is Split.",
      evidenceCount: evidence.length,
      sourceCount: countSources(evidence),
      supportingEvidence: evidence.slice(0, 2),
    });
  }

  if (isOlderThanDays(latestEvidenceDate, 30)) {
    risks.push({
      id: "risk-stale-evidence",
      label: "Recent Evidence Is Sparse",
      description:
        "The draft market can move quickly. Without fresher intelligence, this case should not override current price or roster fit.",
      severity: "Medium",
      rankingScore: 66,
      selectionReason: "Latest evidence is older than 30 days or undated.",
      evidenceCount: evidence.length,
      sourceCount: countSources(evidence),
      supportingEvidence: evidence.slice(0, 2),
    });
  }

  if (memoryTrends.some((trend) => trend === "Mixed / Volatile")) {
    risks.push({
      id: "risk-volatile-memory",
      label: "Volatile Expert History",
      description:
        "Expert opinion has moved around, so this is a less stable read than the headline case may suggest.",
      severity: "Medium",
      rankingScore: 64,
      selectionReason: "Expert Memory includes mixed or volatile opinion movement.",
      evidenceCount: evidence.length,
      sourceCount: countSources(evidence),
      supportingEvidence: evidence.slice(0, 2),
    });
  }

  return risks;
}

function buildClaimDescription(theme: string, items: ThemeEvidence[]) {
  const sourceCount = countThemeSources(items);
  const label = getDraftThemeLabel(theme);
  const repeatedSupport =
    sourceCount >= 2
      ? `${sourceCount} reviewed sources point to it`
      : "one reviewed source points to it";

  if (label === "Role And Workload") {
    return `The path to usable volume is the main draft appeal, and ${repeatedSupport}. Volume is the piece most likely to turn the pick into weekly points.`;
  }
  if (label === "Upside") {
    return `The appeal is ceiling. If the role breaks right, this profile can beat draft cost rather than merely hold value.`;
  }
  if (label === "Draft Value") {
    return `The draft-day edge is price. The current read suggests the player may be more useful than the market cost implies.`;
  }
  if (label === "Passing Game Role") {
    return `The receiving role matters because targets and routes can create a steadier weekly floor, especially in PPR formats.`;
  }
  if (label === "Scoring Environment") {
    return `The surrounding offense gives the pick a better path to useful scoring chances and weekly usability.`;
  }
  if (label === "Safety") {
    return `The case leans on stability rather than pure upside, which matters when the draft board calls for a lower-risk pick.`;
  }

  return `${label} is the clearest pro-draft signal, and ${repeatedSupport}.`;
}

function buildRiskDescription(theme: string, items: ThemeEvidence[]) {
  const risk = getRiskThemeLabel(theme);
  const sourceCount = countThemeSources(items);
  const repeatedSupport =
    sourceCount >= 2
      ? `${sourceCount} reviewed sources flagged it`
      : "one reviewed source flagged it";

  if (risk.label === "Role Uncertainty") {
    return `The main concern is whether the role is stable enough to justify the pick. ${repeatedSupport}, so avoid treating the volume as guaranteed.`;
  }
  if (risk.label === "Health Or Availability") {
    return `Availability is part of the downside case. ${repeatedSupport}, so the pick needs a price that accounts for health risk.`;
  }
  if (risk.label === "Draft Cost Risk") {
    return `The risk is paying for the best-case outcome. ${repeatedSupport}, so price discipline matters.`;
  }
  if (risk.label === "Volatility") {
    return `The profile may be less stable week to week than the headline case suggests. ${repeatedSupport}.`;
  }

  return `${risk.label} is the clearest caveat, and ${repeatedSupport}.`;
}

function formatThemeLabel(theme: string) {
  const normalizedTheme = theme.trim().replace(/[-_]+/g, " ");

  if (!normalizedTheme) return "General expert support";

  return normalizedTheme
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function getDraftThemeLabel(theme: string) {
  const normalizedTheme = theme.toLowerCase();
  const match = DRAFT_RELEVANT_THEME_PATTERNS.find((pattern) =>
    pattern.keywords.some((keyword) => normalizedTheme.includes(keyword)),
  );

  return match?.label ?? formatThemeLabel(theme);
}

function getRiskThemeLabel(theme: string) {
  const normalizedTheme = theme.toLowerCase();
  const match = RISK_THEME_PATTERNS.find((pattern) =>
    pattern.keywords.some((keyword) => normalizedTheme.includes(keyword)),
  );

  return {
    label: match?.label ?? formatThemeLabel(theme),
    matched: Boolean(match),
  };
}

function getDraftRelevanceScore(theme: string) {
  const normalizedTheme = theme.toLowerCase();
  const match = DRAFT_RELEVANT_THEME_PATTERNS.find((pattern) =>
    pattern.keywords.some((keyword) => normalizedTheme.includes(keyword)),
  );

  return match?.score ?? (isVagueTheme(theme) ? 0 : 8);
}

function isVagueTheme(theme: string) {
  const key = normalizeKey(theme);

  return (
    VAGUE_THEME_KEYS.has(key) ||
    key.length < 3 ||
    key.startsWith("general-") ||
    key.includes("misc")
  );
}

function getRiskSeverity({
  evidenceCount,
  qualityScore,
  rankingScore,
  sourceCount,
}: {
  evidenceCount: number;
  qualityScore: number;
  rankingScore: number;
  sourceCount: number;
}): PlayerThesisRisk["severity"] {
  if (
    rankingScore >= 78 ||
    (evidenceCount >= 3 && sourceCount >= 2 && qualityScore >= 75)
  ) {
    return "High";
  }
  if (rankingScore >= 58 || evidenceCount >= 2 || qualityScore >= 65) {
    return "Medium";
  }

  return "Low";
}

function buildConfidenceExplanation({
  label,
  evidenceStrength,
  evidenceQualitySummary,
  evidenceCount,
  sourceCount,
  trustScore,
}: {
  label: PlayerThesisConfidenceLabel;
  evidenceStrength: PlayerThesisEvidenceStrength;
  evidenceQualitySummary: EvidenceQualitySummary;
  evidenceCount: number;
  sourceCount: number;
  trustScore: number | null;
}) {
  const qualityText =
    evidenceQualitySummary.excludedEvidenceCount > 0
      ? ` Some evidence was excluded due to quality or freshness concerns.`
      : evidenceQualitySummary.qualityLabel === "Mixed Quality" ||
          evidenceQualitySummary.qualityLabel === "Low Quality"
        ? ` Evidence quality is ${evidenceQualitySummary.qualityLabel.toLowerCase()}, so this case stays cautious.`
        : "";

  if (isWeakEvidence(evidenceStrength)) {
    return `${label} recommendation confidence because the evidence base is ${evidenceStrength.label.toLowerCase()}. Treat this as a developing read until more reviewed sources support it.${qualityText}`;
  }

  return `${label} recommendation confidence from ${evidenceStrength.label.toLowerCase()}, ${evidenceCount} reviewed evidence item${
    evidenceCount === 1 ? "" : "s"
  }, ${sourceCount} source${sourceCount === 1 ? "" : "s"}, and ${
    trustScore === null ? "limited trust history" : `${trustScore}/100 player trust`
  }.${qualityText}`;
}

function getDraftStancePhrase(
  stance: PlayerThesisStance,
  posture: PlayerThesisPosture,
) {
  if (posture === "Draft Target") return "a draft target";
  if (posture === "Value Target") return "a value target";
  if (posture === "Proceed Carefully") return "a price-sensitive pick";
  if (posture === "Discount Only") return "a discount-only option";
  if (posture === "Avoid At Cost") return "a player to avoid at current cost";

  if (stance === "Bullish") return "a player to monitor as a possible value";
  if (stance === "Bearish") return "a player to approach carefully";

  return "a watch-list player";
}

function getClaimStrength({
  evidenceCount,
  sourceCount,
  qualityScore,
  rankingScore,
}: {
  evidenceCount: number;
  sourceCount: number;
  qualityScore: number;
  rankingScore: number;
}): PlayerThesisClaim["strength"] {
  if (evidenceCount >= 3 && sourceCount >= 2 && qualityScore >= 75 && rankingScore >= 75) {
    return "Strong";
  }
  if ((evidenceCount >= 2 && sourceCount >= 2) || rankingScore >= 60) {
    return "Moderate";
  }

  return "Limited";
}

function getStrengthScore(strength: PlayerThesisClaim["strength"]) {
  return {
    Strong: 3,
    Moderate: 2,
    Limited: 1,
  }[strength];
}

function getRiskScore(severity: PlayerThesisRisk["severity"]) {
  return {
    High: 3,
    Medium: 2,
    Low: 1,
  }[severity];
}

function getConfidenceLabel(score: number): PlayerThesisConfidenceLabel {
  if (score >= 80) return "Strong";
  if (score >= 65) return "Solid";
  if (score >= 50) return "Developing";

  return "Limited";
}

function averageQuality(summaries: ThesisSummary[]) {
  if (summaries.length === 0) return 0;

  return Math.round(
    summaries.reduce(
      (sum, summary) =>
        sum + (summary.qualityScore ?? Math.round(summary.confidence * 100)),
      0,
    ) / summaries.length,
  );
}

function average(values: number[]) {
  if (values.length === 0) return 0;

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function countThemeSources(items: ThemeEvidence[]) {
  return new Set(
    items.map(
      (item) => `${item.summary.expertId}:${item.summary.sourceVideo.id}`,
    ),
  ).size;
}

function getRecencyScore(value: Date | null) {
  if (!value) return 0;

  const daysOld = Math.max(
    0,
    Math.floor((Date.now() - value.getTime()) / (1000 * 60 * 60 * 24)),
  );

  if (daysOld <= 14) return 15;
  if (daysOld <= 30) return 10;
  if (daysOld <= 60) return 5;

  return 0;
}

function isOlderThanDays(value: Date | null, days: number) {
  if (!value) return true;

  return Date.now() - value.getTime() > days * 24 * 60 * 60 * 1000;
}

function countStances(values: string[]) {
  return values.reduce(
    (counts, value) => {
      if (value === "BULLISH") counts.bullish += 1;
      else if (value === "BEARISH") counts.bearish += 1;
      else counts.neutral += 1;

      return counts;
    },
    { bearish: 0, bullish: 0, neutral: 0 },
  );
}

function countSources(evidence: PlayerThesisEvidence[]) {
  return new Set(evidence.map((item) => `${item.expertName}:${item.sourceTitle}`))
    .size;
}

function sortEvidenceByDate(
  itemA: PlayerThesisEvidence,
  itemB: PlayerThesisEvidence,
) {
  return getDateTime(itemB.publishedAt) - getDateTime(itemA.publishedAt);
}

function getLatestDate(values: Array<Date | null>) {
  const timestamps = values
    .map((value) => value?.getTime() ?? 0)
    .filter((value) => value > 0);

  if (timestamps.length === 0) return null;

  return new Date(Math.max(...timestamps));
}

function getDateTime(value: Date | null) {
  return value?.getTime() ?? 0;
}

function formatShortDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") || "general";
}

function groupBy<T>(
  items: T[],
  getKey: (item: T) => string,
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();

  for (const item of items) {
    const key = getKey(item);
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }

  return grouped;
}

function dedupeStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function dedupeRisks(risks: PlayerThesisRisk[]) {
  const seen = new Set<string>();
  const deduped: PlayerThesisRisk[] = [];

  for (const risk of risks) {
    const key = normalizeKey(risk.label);

    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(risk);
  }

  return deduped;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
