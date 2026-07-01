import { getExpertConsensusDashboard } from "@/knowledge-brain/expert-consensus";
import {
  calculateMemoryTrustSignal,
  getExpertPlayerMemories,
  type ExpertPlayerMemory,
} from "@/knowledge-brain/expert-memory";
import { normalizeTargetSeason } from "@/knowledge-brain/freshness";
import {
  calculateExpertTrustWeight,
  getWeightedConsensusDashboard,
} from "@/knowledge-brain/weighted-consensus";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export type TrustConfidenceLabel = "Low" | "Medium" | "High";

export type TrustSampleSizeLabel =
  | "No graded outcomes"
  | "Thin sample"
  | "Developing sample"
  | "Useful sample";

export type TrustDirection =
  | "POSITIVE"
  | "NEGATIVE"
  | "NEUTRAL"
  | "WARNING";

export type TrustSignal = {
  key: string;
  label: string;
  value: string | number;
  direction: TrustDirection;
  explanation: string;
};

export type ExpertTrustDimension = {
  key:
    | "historicalAccuracy"
    | "recentAccuracy"
    | "positionExpertise"
    | "takeTypeExpertise"
    | "consensusAgreement"
    | "gradedSampleSize"
    | "currentSeasonActivity"
    | "expertMemory"
    | "qualityReview";
  label: string;
  score: number;
  weight: number;
  weightedPoints: number;
  explanation: string;
  signals: TrustSignal[];
};

export type TrustPreferenceAdjustments = {
  preferredExpertAdjustment: number;
  ignoredExpertAdjustment: number;
  riskToleranceAdjustment: number;
  draftPhilosophyAdjustment: number;
};

export type TrustScoreInput = {
  dimensions: ExpertTrustDimension[];
  preferenceAdjustments?: Partial<TrustPreferenceAdjustments>;
  maxScoreCap?: number;
};

export type TrustScoreBreakdown = {
  dimensions: ExpertTrustDimension[];
  preferenceAdjustments: TrustPreferenceAdjustments;
  totalBeforeAdjustments: number;
  adjustmentTotal: number;
  maxScoreCap: number;
  finalScore: number;
};

export type TrustScoreResult = {
  score: number;
  confidenceLabel: TrustConfidenceLabel;
  sampleSizeLabel: TrustSampleSizeLabel;
  breakdown: TrustScoreBreakdown;
  signals: TrustSignal[];
  explanationBullets: string[];
  warnings: string[];
};

export type ExpertTrustProfile = {
  expertId: string;
  expertName: string;
  slug: string;
  active: boolean;
  overallTrustScore: number;
  confidenceLabel: TrustConfidenceLabel;
  sampleSizeLabel: TrustSampleSizeLabel;
  dimensions: ExpertTrustDimension[];
  breakdown: TrustScoreBreakdown;
  explanationBullets: string[];
  warnings: string[];
  signals: TrustSignal[];
  weightedConsensusSignal: {
    weight: number;
    source: string;
    explanation: string;
  };
  expertMemorySignal: {
    score: number;
    label: string;
    explanation: string;
    warnings: string[];
  };
  qualityReviewSignal: SummaryQualitySignal;
  evidence: {
    scopedTakes: number;
    currentSeasonTakes: number;
    approvedTranscriptSummaries: number;
    transcriptCount: number;
    gradedOutcomes: number;
    accuracyRate: number | null;
    consensusAgreementRate: number | null;
    expertMemoryCount: number;
    volatileMemoryCount: number;
    averageSummaryQualityScore: number | null;
    autoApprovedTranscriptSummaries: number;
    humanReviewedTranscriptSummaries: number;
    summaryQualityWarnings: number;
    positionCoverage: Array<{ key: string; count: number }>;
    takeTypeCoverage: Array<{ key: string; count: number }>;
    latestActivityDate: Date | null;
  };
};

export type PlayerTrustProfile = {
  playerId: string;
  playerName: string;
  position: string;
  team: string | null;
  playerTrustScore: number;
  confidenceLabel: TrustConfidenceLabel;
  sampleSizeLabel: TrustSampleSizeLabel;
  stanceSummary: "Bullish" | "Bearish" | "Mixed" | "Neutral";
  evidenceCount: number;
  latestEvidenceDate: Date | null;
  breakdown: TrustScoreBreakdown;
  topSupportingExperts: Array<{
    expertId: string;
    expertName: string;
    stance: "BULLISH" | "BEARISH" | "MIXED" | "NEUTRAL";
    trustScore: number;
    evidenceCount: number;
    latestSummary: string;
  }>;
  disagreementWarnings: string[];
  lowSampleWarnings: string[];
  evidencePointers: Array<{
    sourceTitle: string;
    expertName: string;
    publishedAt: Date | null;
    excerpt: string;
  }>;
  signals: TrustSignal[];
  expertMemorySignal: {
    score: number;
    label: string;
    explanation: string;
    warnings: string[];
  };
  qualityReviewSignal: SummaryQualitySignal;
  snapshotMovementSignal: TrustSnapshotMovementSignal;
};

export type TrustEngineFilters = {
  targetSeason?: number | string | null;
  includeHistorical?: boolean;
};

type NormalizedTrustFilters = ReturnType<typeof normalizeTrustFilters>;

type SummaryQualitySignal = {
  score: number;
  label: string;
  averageQualityScore: number | null;
  autoApprovedCount: number;
  humanReviewedCount: number;
  warningCount: number;
  explanation: string;
  warnings: string[];
};

export type TrustSnapshotMovementSignal = {
  label: string;
  previousTrustScore: number | null;
  latestTrustScore: number | null;
  trustScoreChange: number | null;
  direction: "UP" | "DOWN" | "UNCHANGED" | "NEW" | "NO_HISTORY";
  confidenceMovement: string;
  evidenceMovement: string;
  snapshotCount: number;
  latestSnapshotDate: Date | null;
  explanation: string;
};

const NEUTRAL_PREFERENCE_ADJUSTMENTS: TrustPreferenceAdjustments = {
  preferredExpertAdjustment: 0,
  ignoredExpertAdjustment: 0,
  riskToleranceAdjustment: 0,
  draftPhilosophyAdjustment: 0,
};

const EXPERT_TRUST_INCLUDE = {
  sourceVideos: {
    include: {
      transcript: {
        select: {
          id: true,
          contentSeason: true,
          includeInCurrentAnalysis: true,
          freshnessLabel: true,
        },
      },
    },
    orderBy: {
      publishedAt: "desc",
    },
  },
  expertTakes: {
    where: {
      reviewStatus: "APPROVED",
    },
    include: {
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
          title: true,
          publishedAt: true,
        },
      },
      transcript: {
        select: {
          contentSeason: true,
          includeInCurrentAnalysis: true,
          freshnessLabel: true,
        },
      },
      outcome: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  },
  transcriptPlayerSummaries: {
    where: {
      reviewStatus: "APPROVED",
    },
    include: {
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
          title: true,
          publishedAt: true,
        },
      },
      transcript: {
        select: {
          contentSeason: true,
          includeInCurrentAnalysis: true,
          freshnessLabel: true,
        },
      },
      evidence: {
        take: 3,
        orderBy: {
          createdAt: "asc",
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  },
  accuracySnapshots: true,
} satisfies Prisma.ExpertInclude;

const PLAYER_TRUST_INCLUDE = {
  transcriptPlayerSummaries: {
    where: {
      reviewStatus: "APPROVED",
    },
    include: {
      expert: {
        select: {
          id: true,
          name: true,
        },
      },
      sourceVideo: {
        select: {
          title: true,
          publishedAt: true,
        },
      },
      transcript: {
        select: {
          contentSeason: true,
          includeInCurrentAnalysis: true,
          freshnessLabel: true,
        },
      },
      evidence: {
        take: 3,
        orderBy: {
          createdAt: "asc",
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  },
  expertTakes: {
    where: {
      reviewStatus: "APPROVED",
    },
    include: {
      expert: {
        select: {
          id: true,
          name: true,
        },
      },
      sourceVideo: {
        select: {
          title: true,
          publishedAt: true,
        },
      },
      transcript: {
        select: {
          contentSeason: true,
          includeInCurrentAnalysis: true,
          freshnessLabel: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  },
} satisfies Prisma.PlayerInclude;

type ExpertTrustData = Prisma.ExpertGetPayload<{
  include: typeof EXPERT_TRUST_INCLUDE;
}>;

type PlayerTrustData = Prisma.PlayerGetPayload<{
  include: typeof PLAYER_TRUST_INCLUDE;
}>;

type ConsensusRow = Awaited<
  ReturnType<typeof getExpertConsensusDashboard>
>["rows"][number];

type WeightedConsensusRow = Awaited<
  ReturnType<typeof getWeightedConsensusDashboard>
>["rows"][number];

export async function getTrustEngineDashboard(
  filters: TrustEngineFilters = {},
) {
  const normalizedFilters = normalizeTrustFilters(filters);
  const [expertProfiles, playerProfiles] = await Promise.all([
    getExpertTrustProfiles(normalizedFilters),
    getPlayerTrustProfiles(normalizedFilters),
  ]);

  return {
    filters: normalizedFilters,
    expertProfiles,
    playerProfiles,
    widgets: {
      topTrustedExperts: expertProfiles
        .filter((profile) => profile.overallTrustScore > 0)
        .sort(
          (profileA, profileB) =>
            profileB.overallTrustScore - profileA.overallTrustScore ||
            profileB.evidence.gradedOutcomes - profileA.evidence.gradedOutcomes,
        )
        .slice(0, 5),
      lowSampleExperts: expertProfiles
        .filter((profile) => profile.confidenceLabel === "Low")
        .sort(
          (profileA, profileB) =>
            profileB.overallTrustScore - profileA.overallTrustScore,
        )
        .slice(0, 5),
      strongestPlayerTrust: playerProfiles
        .sort(
          (profileA, profileB) =>
            profileB.playerTrustScore - profileA.playerTrustScore ||
            profileB.topSupportingExperts.length -
              profileA.topSupportingExperts.length,
        )
        .slice(0, 5),
      mostQuestionablePlayerTrust: playerProfiles
        .filter(
          (profile) =>
            profile.disagreementWarnings.length > 0 ||
            profile.lowSampleWarnings.length > 0,
        )
        .sort(
          (profileA, profileB) =>
            profileA.playerTrustScore - profileB.playerTrustScore,
        )
        .slice(0, 5),
    },
  };
}

export async function getExpertTrustProfiles(
  filters: TrustEngineFilters | NormalizedTrustFilters = {},
) {
  const normalizedFilters =
    "targetSeason" in filters && typeof filters.targetSeason === "number"
      ? (filters as NormalizedTrustFilters)
      : normalizeTrustFilters(filters);
  const [experts, consensus, expertMemories] = await Promise.all([
    getExpertTrustData(normalizedFilters),
    getExpertConsensusDashboard({
      includeHistorical: normalizedFilters.includeHistorical,
      targetSeason: normalizedFilters.targetSeason,
    }),
    getExpertPlayerMemories(normalizedFilters),
  ]);
  const expertMemoriesByExpertId = groupBy(
    expertMemories,
    (memory) => memory.expertId,
  );

  return experts.map((expert) =>
    buildExpertTrustProfile({
      expert: applyExpertFreshnessFilters(expert, normalizedFilters),
      consensusRows: consensus.rows,
      filters: normalizedFilters,
      expertMemories: expertMemoriesByExpertId.get(expert.id) ?? [],
    }),
  );
}

export async function getExpertTrustProfile(
  expertId: string,
  filters: TrustEngineFilters = {},
) {
  const profiles = await getExpertTrustProfiles(filters);

  return profiles.find((profile) => profile.expertId === expertId) ?? null;
}

export async function getPlayerTrustProfiles(
  filters: TrustEngineFilters | NormalizedTrustFilters = {},
) {
  const normalizedFilters =
    "targetSeason" in filters && typeof filters.targetSeason === "number"
      ? (filters as NormalizedTrustFilters)
      : normalizeTrustFilters(filters);
  const [players, expertProfiles, rawConsensus, weightedConsensus, memories] =
    await Promise.all([
      getPlayerTrustData(normalizedFilters),
      getExpertTrustProfiles(normalizedFilters),
      getExpertConsensusDashboard({
        includeHistorical: normalizedFilters.includeHistorical,
        targetSeason: normalizedFilters.targetSeason,
      }),
      getWeightedConsensusDashboard({
        includeHistorical: normalizedFilters.includeHistorical,
        targetSeason: normalizedFilters.targetSeason,
      }),
      getExpertPlayerMemories(normalizedFilters),
    ]);
  const expertTrustById = new Map(
    expertProfiles.map((profile) => [profile.expertId, profile]),
  );
  const rawConsensusByPlayerId = new Map(
    rawConsensus.rows.map((row) => [row.playerId, row]),
  );
  const weightedConsensusByPlayerId = new Map(
    weightedConsensus.rows.map((row) => [row.playerId, row]),
  );
  const memoriesByPlayerId = groupBy(memories, (memory) => memory.playerId);
  const snapshotMovementByPlayerId = await getPlayerTrustSnapshotMovementMap({
    contentSeason: normalizedFilters.targetSeason,
    playerIds: players.map((player) => player.id),
  });

  return players
    .map((player) =>
      buildPlayerTrustProfile({
        player: applyPlayerFreshnessFilters(player, normalizedFilters),
        expertTrustById,
        rawConsensus: rawConsensusByPlayerId.get(player.id) ?? null,
        weightedConsensus: weightedConsensusByPlayerId.get(player.id) ?? null,
        expertMemories: memoriesByPlayerId.get(player.id) ?? [],
        snapshotMovement:
          snapshotMovementByPlayerId.get(player.id) ??
          getEmptyTrustSnapshotMovementSignal(),
      }),
    )
    .filter((profile): profile is PlayerTrustProfile => Boolean(profile));
}

export async function getPlayerTrustProfile(
  playerId: string,
  filters: TrustEngineFilters = {},
) {
  const profiles = await getPlayerTrustProfiles(filters);

  return profiles.find((profile) => profile.playerId === playerId) ?? null;
}

export function calculateTrustScore(input: TrustScoreInput): TrustScoreResult {
  const weightTotal = input.dimensions.reduce(
    (total, dimension) => total + dimension.weight,
    0,
  );
  const totalBeforeAdjustments =
    weightTotal > 0
      ? input.dimensions.reduce(
          (total, dimension) => total + dimension.score * dimension.weight,
          0,
        ) / weightTotal
      : 0;
  const preferenceAdjustments = {
    ...NEUTRAL_PREFERENCE_ADJUSTMENTS,
    ...input.preferenceAdjustments,
  };
  const adjustmentTotal =
    preferenceAdjustments.preferredExpertAdjustment +
    preferenceAdjustments.ignoredExpertAdjustment +
    preferenceAdjustments.riskToleranceAdjustment +
    preferenceAdjustments.draftPhilosophyAdjustment;
  const maxScoreCap = input.maxScoreCap ?? 100;
  const finalScore = clamp(
    Math.round(totalBeforeAdjustments + adjustmentTotal),
    0,
    maxScoreCap,
  );
  const dimensions = input.dimensions.map((dimension) => ({
    ...dimension,
    weightedPoints: roundToOne(dimension.score * dimension.weight),
  }));

  return {
    score: finalScore,
    confidenceLabel: "Low",
    sampleSizeLabel: "No graded outcomes",
    breakdown: {
      dimensions,
      preferenceAdjustments,
      totalBeforeAdjustments: roundToOne(totalBeforeAdjustments),
      adjustmentTotal,
      maxScoreCap,
      finalScore,
    },
    signals: dimensions.flatMap((dimension) => dimension.signals),
    explanationBullets: [],
    warnings: [],
  };
}

function getExpertTrustData(filters: NormalizedTrustFilters) {
  const transcriptWhere = buildTranscriptWhere(filters);

  return db.expert.findMany({
    include: {
      ...EXPERT_TRUST_INCLUDE,
      sourceVideos: {
        ...EXPERT_TRUST_INCLUDE.sourceVideos,
        where: {
          transcript: {
            is: transcriptWhere,
          },
        },
      },
      expertTakes: {
        ...EXPERT_TRUST_INCLUDE.expertTakes,
        where: {
          reviewStatus: "APPROVED",
          transcript: {
            is: transcriptWhere,
          },
        },
      },
      transcriptPlayerSummaries: {
        ...EXPERT_TRUST_INCLUDE.transcriptPlayerSummaries,
        where: {
          reviewStatus: "APPROVED",
          transcript: {
            is: transcriptWhere,
          },
        },
      },
      accuracySnapshots: {
        where: {
          season: filters.targetSeason,
        },
      },
    },
    orderBy: { name: "asc" },
  });
}

function getPlayerTrustData(filters: NormalizedTrustFilters) {
  const transcriptWhere = buildTranscriptWhere(filters);

  return db.player.findMany({
    where: {
      OR: [
        {
          transcriptPlayerSummaries: {
            some: {
              reviewStatus: "APPROVED",
              transcript: {
                is: transcriptWhere,
              },
            },
          },
        },
        {
          expertTakes: {
            some: {
              reviewStatus: "APPROVED",
              transcript: {
                is: transcriptWhere,
              },
            },
          },
        },
      ],
    },
    include: {
      ...PLAYER_TRUST_INCLUDE,
      transcriptPlayerSummaries: {
        ...PLAYER_TRUST_INCLUDE.transcriptPlayerSummaries,
        where: {
          reviewStatus: "APPROVED",
          transcript: {
            is: transcriptWhere,
          },
        },
      },
      expertTakes: {
        ...PLAYER_TRUST_INCLUDE.expertTakes,
        where: {
          reviewStatus: "APPROVED",
          transcript: {
            is: transcriptWhere,
          },
        },
      },
    },
    orderBy: { fullName: "asc" },
  });
}

function buildExpertTrustProfile({
  expert,
  consensusRows,
  filters,
  expertMemories,
}: {
  expert: ExpertTrustData;
  consensusRows: ConsensusRow[];
  filters: NormalizedTrustFilters;
  expertMemories: ExpertPlayerMemory[];
}): ExpertTrustProfile {
  const snapshots = expert.accuracySnapshots;
  const overallSnapshot = snapshots.find(
    (snapshot) => snapshot.position === "ALL" && snapshot.takeType === "ALL",
  );
  const outcomeCounts = countExpertOutcomes(expert);
  const totalGraded = overallSnapshot?.totalGraded ?? outcomeCounts.totalGraded;
  const accuracyRate =
    overallSnapshot && overallSnapshot.totalGraded > 0
      ? overallSnapshot.accuracyRate
      : outcomeCounts.accuracyRate;
  const currentSeasonTakes = expert.expertTakes.filter(
    (take) =>
      take.transcript?.contentSeason === filters.targetSeason &&
      take.transcript.includeInCurrentAnalysis,
  ).length;
  const approvedSummaryCount = expert.transcriptPlayerSummaries.length;
  const consensusAgreement = calculateExpertConsensusAgreement(
    expert.id,
    consensusRows,
  );
  const positionCoverage = countBy(
    expert.expertTakes.filter((take) => take.player),
    (take) => take.player?.position ?? "Unknown",
  );
  const takeTypeCoverage = countBy(expert.expertTakes, (take) => take.takeType);
  const latestActivityDate = getLatestDate([
    ...expert.expertTakes.map((take) => take.sourceVideo.publishedAt ?? take.createdAt),
    ...expert.transcriptPlayerSummaries.map(
      (summary) => summary.sourceVideo.publishedAt ?? summary.createdAt,
    ),
    ...expert.sourceVideos.map((source) => source.publishedAt ?? source.createdAt),
  ]);
  const expertMemorySignal = calculateMemoryTrustSignal(expertMemories);
  const volatileMemoryCount = expertMemories.filter(
    (memory) => memory.memory.opinionTrend === "Mixed / Volatile",
  ).length;
  const qualityReviewSignal = calculateSummaryQualitySignal(
    expert.transcriptPlayerSummaries,
  );
  const dimensions = buildExpertTrustDimensions({
    accuracyRate,
    totalGraded,
    currentSeasonTakes,
    approvedSummaryCount,
    transcriptCount: expert.sourceVideos.length,
    consensusAgreementRate: consensusAgreement.rate,
    expertMemorySignal,
    expertMemoryCount: expertMemories.length,
    volatileMemoryCount,
    qualityReviewSignal,
    positionCoverage,
    takeTypeCoverage,
    latestActivityDate,
  });
  const scoreCap = getExpertScoreCap(totalGraded, expert.expertTakes.length);
  const trustScore = calculateTrustScore({
    dimensions,
    maxScoreCap: scoreCap,
  });
  const confidenceLabel = getTrustConfidenceLabel({
    totalGraded,
    evidenceCount: expert.expertTakes.length + approvedSummaryCount,
    expertCount: 1,
  });
  const sampleSizeLabel = getSampleSizeLabel(totalGraded);
  const warnings = buildExpertTrustWarnings({
    totalGraded,
    scoreCap,
    approvedSummaryCount,
    consensusAgreementRate: consensusAgreement.rate,
    qualityReviewSignal,
  });
  const weightedConsensusSignal = calculateExpertTrustWeight({
    expertId: expert.id,
    accuracyRate,
    totalGraded,
  });

  return {
    expertId: expert.id,
    expertName: expert.name,
    slug: expert.slug,
    active: expert.active,
    overallTrustScore: trustScore.score,
    confidenceLabel,
    sampleSizeLabel,
    dimensions: trustScore.breakdown.dimensions,
    breakdown: trustScore.breakdown,
    explanationBullets: [
      `${expert.name} has ${expert.expertTakes.length} approved scoped take${
        expert.expertTakes.length === 1 ? "" : "s"
      } and ${approvedSummaryCount} approved transcript player summar${
        approvedSummaryCount === 1 ? "y" : "ies"
      } in this view.`,
      totalGraded > 0
        ? `${totalGraded} manually graded outcome${
            totalGraded === 1 ? "" : "s"
          } produce a ${formatPercent(accuracyRate)} historical accuracy signal.`
        : "No manually graded outcomes are available yet, so accuracy remains provisional.",
      consensusAgreement.rate === null
        ? "No strict consensus agreement signal is available yet."
        : `The expert aligns with strict consensus on ${consensusAgreement.aligned} of ${consensusAgreement.eligible} eligible player stance${consensusAgreement.eligible === 1 ? "" : "s"}.`,
      qualityReviewSignal.explanation,
    ],
    warnings,
    signals: trustScore.signals,
    weightedConsensusSignal: {
      weight: weightedConsensusSignal.weight,
      source: weightedConsensusSignal.source,
      explanation: weightedConsensusSignal.explanation,
    },
    evidence: {
      scopedTakes: expert.expertTakes.length,
      currentSeasonTakes,
      approvedTranscriptSummaries: approvedSummaryCount,
      transcriptCount: expert.sourceVideos.length,
      gradedOutcomes: totalGraded,
      accuracyRate,
      consensusAgreementRate: consensusAgreement.rate,
      expertMemoryCount: expertMemories.length,
      volatileMemoryCount,
      averageSummaryQualityScore: qualityReviewSignal.averageQualityScore,
      autoApprovedTranscriptSummaries: qualityReviewSignal.autoApprovedCount,
      humanReviewedTranscriptSummaries: qualityReviewSignal.humanReviewedCount,
      summaryQualityWarnings: qualityReviewSignal.warningCount,
      positionCoverage,
      takeTypeCoverage,
      latestActivityDate,
    },
    expertMemorySignal,
    qualityReviewSignal,
  };
}

function buildExpertTrustDimensions({
  accuracyRate,
  totalGraded,
  currentSeasonTakes,
  approvedSummaryCount,
  transcriptCount,
  consensusAgreementRate,
  expertMemorySignal,
  expertMemoryCount,
  volatileMemoryCount,
  qualityReviewSignal,
  positionCoverage,
  takeTypeCoverage,
  latestActivityDate,
}: {
  accuracyRate: number | null;
  totalGraded: number;
  currentSeasonTakes: number;
  approvedSummaryCount: number;
  transcriptCount: number;
  consensusAgreementRate: number | null;
  expertMemorySignal: ReturnType<typeof calculateMemoryTrustSignal>;
  expertMemoryCount: number;
  volatileMemoryCount: number;
  qualityReviewSignal: SummaryQualitySignal;
  positionCoverage: Array<{ key: string; count: number }>;
  takeTypeCoverage: Array<{ key: string; count: number }>;
  latestActivityDate: Date | null;
}): ExpertTrustDimension[] {
  const historicalAccuracyScore =
    totalGraded > 0 && accuracyRate !== null ? accuracyRate : 50;
  const recentActivityScore = calculateRecentActivityScore({
    currentSeasonTakes,
    approvedSummaryCount,
    transcriptCount,
    latestActivityDate,
  });
  const consensusScore = consensusAgreementRate ?? 50;

  return [
    makeDimension({
      key: "historicalAccuracy",
      label: "Historical accuracy",
      score: historicalAccuracyScore,
      weight: 0.3,
      explanation:
        totalGraded > 0
          ? "Uses manually graded outcome accuracy."
          : "No graded outcomes yet, so this dimension stays neutral.",
      signals: [
        {
          key: "gradedAccuracy",
          label: "Graded accuracy",
          value: totalGraded > 0 ? `${formatPercent(accuracyRate)}` : "None",
          direction: totalGraded > 0 ? "POSITIVE" : "WARNING",
          explanation:
            "Manual outcome grades are the strongest current trust signal.",
        },
      ],
    }),
    makeDimension({
      key: "recentAccuracy",
      label: "Recent accuracy",
      score: totalGraded >= 5 ? historicalAccuracyScore : 50,
      weight: 0.1,
      explanation:
        totalGraded >= 5
          ? "Uses current-season graded accuracy until a richer recent window exists."
          : "Recent accuracy is neutral until more graded outcomes exist.",
      signals: [
        {
          key: "recentAccuracyReadiness",
          label: "Recent accuracy readiness",
          value: totalGraded,
          direction: totalGraded >= 5 ? "POSITIVE" : "WARNING",
          explanation:
            "A future version can split recent accuracy from all-time accuracy once grading volume grows.",
        },
      ],
    }),
    makeDimension({
      key: "positionExpertise",
      label: "Position expertise",
      score: Math.min(100, positionCoverage.length * 18 + currentSeasonTakes * 2),
      weight: 0.1,
      explanation:
        "Rewards position coverage without claiming the expert is best at a position yet.",
      signals: positionCoverage.slice(0, 4).map((position) => ({
        key: `position-${position.key}`,
        label: formatEnumLabel(position.key),
        value: position.count,
        direction: "NEUTRAL" as const,
        explanation: "Approved scoped takes for this position.",
      })),
    }),
    makeDimension({
      key: "takeTypeExpertise",
      label: "Take-type expertise",
      score: Math.min(100, takeTypeCoverage.length * 16 + currentSeasonTakes),
      weight: 0.1,
      explanation:
        "Rewards breadth across take types while rubrics are still being formalized.",
      signals: takeTypeCoverage.slice(0, 4).map((takeType) => ({
        key: `take-type-${takeType.key}`,
        label: formatEnumLabel(takeType.key),
        value: takeType.count,
        direction: "NEUTRAL" as const,
        explanation: "Approved scoped takes for this take type.",
      })),
    }),
    makeDimension({
      key: "consensusAgreement",
      label: "Consensus agreement",
      score: consensusScore,
      weight: 0.15,
      explanation:
        consensusAgreementRate === null
          ? "No strict consensus comparison is available yet."
          : "Compares this expert's player stance against raw expert consensus.",
      signals: [
        {
          key: "consensusAgreementRate",
          label: "Agreement rate",
          value:
            consensusAgreementRate === null ? "Not available" : `${consensusScore}%`,
          direction: consensusAgreementRate === null ? "WARNING" : "POSITIVE",
          explanation:
            "Agreement is useful context, but disagreement is not automatically bad.",
        },
      ],
    }),
    makeDimension({
      key: "gradedSampleSize",
      label: "Graded sample size",
      score: Math.min(100, (totalGraded / 20) * 100),
      weight: 0.15,
      explanation:
        "Prevents thin grading samples from creating overconfident trust scores.",
      signals: [
        {
          key: "gradedOutcomeCount",
          label: "Graded outcomes",
          value: totalGraded,
          direction: totalGraded >= 10 ? "POSITIVE" : "WARNING",
          explanation:
            "Trust confidence stays limited until more outcomes are graded.",
        },
      ],
    }),
    makeDimension({
      key: "currentSeasonActivity",
      label: "Current-season activity",
      score: recentActivityScore,
      weight: 0.1,
      explanation:
        "Rewards current-season transcripts, summaries, and takes so stale expertise does not dominate.",
      signals: [
        {
          key: "currentSeasonTakes",
          label: "Current-season takes",
          value: currentSeasonTakes,
          direction: currentSeasonTakes > 0 ? "POSITIVE" : "WARNING",
          explanation: "Approved takes in the current scoped season.",
        },
        {
          key: "approvedSummaries",
          label: "Approved summaries",
          value: approvedSummaryCount,
          direction: approvedSummaryCount > 0 ? "POSITIVE" : "WARNING",
          explanation:
            "Transcript player summaries are the preferred future intelligence unit.",
        },
      ],
    }),
    makeDimension({
      key: "expertMemory",
      label: "Expert Memory",
      score: expertMemorySignal.score,
      weight: 0.12,
      explanation:
        "Uses expert-player opinion timelines to measure conviction, stability, volatility, and memory sample size.",
      signals: [
        {
          key: "expertMemoryCount",
          label: "Memory timelines",
          value: expertMemoryCount,
          direction: expertMemoryCount > 0 ? "POSITIVE" : "WARNING",
          explanation:
            "Each timeline tracks one expert's opinion on one player over time.",
        },
        {
          key: "volatileMemoryCount",
          label: "Volatile timelines",
          value: volatileMemoryCount,
          direction: volatileMemoryCount > 0 ? "WARNING" : "NEUTRAL",
          explanation:
            "Volatile expert-player memory can lower trust confidence until evidence stabilizes.",
        },
        {
          key: "expertMemorySignal",
          label: "Memory signal",
          value: expertMemorySignal.label,
          direction: expertMemorySignal.score >= 60 ? "POSITIVE" : "WARNING",
          explanation: expertMemorySignal.explanation,
        },
      ],
    }),
    makeDimension({
      key: "qualityReview",
      label: "Quality review",
      score: qualityReviewSignal.score,
      weight: 0.12,
      explanation:
        "Uses deterministic summary quality, human review, auto-approval, and exception warnings as a trust signal.",
      signals: [
        {
          key: "averageSummaryQuality",
          label: "Average summary quality",
          value:
            qualityReviewSignal.averageQualityScore === null
              ? "No summaries"
              : qualityReviewSignal.averageQualityScore,
          direction:
            qualityReviewSignal.averageQualityScore === null
              ? "WARNING"
              : qualityReviewSignal.averageQualityScore >= 70
                ? "POSITIVE"
                : "WARNING",
          explanation:
            "Quality score is stored on transcript player summaries during analysis.",
        },
        {
          key: "humanReviewedSummaries",
          label: "Human-reviewed summaries",
          value: qualityReviewSignal.humanReviewedCount,
          direction:
            qualityReviewSignal.humanReviewedCount > 0 ? "POSITIVE" : "NEUTRAL",
          explanation:
            "Manual review is treated as a higher-confidence trust signal than auto-approval.",
        },
        {
          key: "autoApprovedSummaries",
          label: "Auto-approved summaries",
          value: qualityReviewSignal.autoApprovedCount,
          direction:
            qualityReviewSignal.autoApprovedCount > 0 ? "POSITIVE" : "NEUTRAL",
          explanation:
            "Deterministic auto-approval is useful but slightly discounted until a human reviews it.",
        },
        {
          key: "summaryQualityWarnings",
          label: "Quality warnings",
          value: qualityReviewSignal.warningCount,
          direction:
            qualityReviewSignal.warningCount > 0 ? "WARNING" : "POSITIVE",
          explanation:
            "Warnings keep low-quality or ambiguous summaries from inflating trust.",
        },
      ],
    }),
  ];
}

function buildPlayerTrustProfile({
  player,
  expertTrustById,
  rawConsensus,
  weightedConsensus,
  expertMemories,
  snapshotMovement,
}: {
  player: PlayerTrustData;
  expertTrustById: Map<string, ExpertTrustProfile>;
  rawConsensus: ConsensusRow | null;
  weightedConsensus: WeightedConsensusRow | null;
  expertMemories: ExpertPlayerMemory[];
  snapshotMovement: TrustSnapshotMovementSignal;
}): PlayerTrustProfile | null {
  const hasSummaries = player.transcriptPlayerSummaries.length > 0;
  const evidenceItems = hasSummaries
    ? player.transcriptPlayerSummaries.map((summary) => ({
        expertId: summary.expertId,
        expertName: summary.expert.name,
        stance: summary.stance,
        confidence: summary.confidence,
        evidenceCount: Math.max(1, summary.evidenceCount),
        summary: summary.summary,
        sourceTitle: summary.sourceVideo.title,
        publishedAt: summary.sourceVideo.publishedAt,
        excerpt: summary.evidence[0]?.excerpt ?? summary.summary,
        createdAt: summary.createdAt,
        qualityScore: summary.qualityScore,
        autoApprovedAt: summary.autoApprovedAt,
        manuallyReviewedAt: summary.manuallyReviewedAt,
        qualityWarnings: summary.qualityWarnings,
      }))
    : player.expertTakes.map((take) => ({
        expertId: take.expertId,
        expertName: take.expert.name,
        stance: take.sentiment,
        confidence: take.confidence,
        evidenceCount: 1,
        summary: take.summary,
        sourceTitle: take.sourceVideo.title,
        publishedAt: take.sourceVideo.publishedAt,
        excerpt: take.excerpt,
        createdAt: take.createdAt,
        qualityScore: null,
        autoApprovedAt: null,
        manuallyReviewedAt: null,
        qualityWarnings: [],
      }));

  if (evidenceItems.length === 0) return null;

  const expertIds = new Set(evidenceItems.map((item) => item.expertId));
  const stanceCounts = countStances(evidenceItems);
  const stanceSummary = getPlayerStanceSummary(stanceCounts);
  const averageEvidenceConfidence = average(
    evidenceItems.map((item) => item.confidence * 100),
  );
  const averageExpertTrust = average(
    Array.from(expertIds)
      .map((expertId) => expertTrustById.get(expertId)?.overallTrustScore)
      .filter((score): score is number => typeof score === "number"),
  );
  const latestActivityDate = getLatestDate(
    evidenceItems.map((item) => item.publishedAt ?? item.createdAt),
  );
  const agreementScore =
    weightedConsensus?.weightedAgreementScore ??
    rawConsensus?.agreementScore ??
    calculateLocalAgreementScore(stanceCounts);
  const weightedConsensusSignal =
    weightedConsensus?.trustWeightedConfidence ?? agreementScore;
  const expertMemorySignal = calculateMemoryTrustSignal(expertMemories);
  const qualityReviewSignal = calculateSummaryQualitySignal(evidenceItems);
  const volatileMemoryCount = expertMemories.filter(
    (memory) => memory.memory.opinionTrend === "Mixed / Volatile",
  ).length;
  const sampleSizeScore = Math.min(
    100,
    expertIds.size * 20 + evidenceItems.length * 8,
  );
  const dimensions = [
    makeDimension({
      key: "historicalAccuracy",
      label: "Expert trust",
      score: averageExpertTrust || 50,
      weight: 0.25,
      explanation:
        "Average Trust Engine score of experts contributing player evidence.",
      signals: [
        {
          key: "averageExpertTrust",
          label: "Average expert trust",
          value: averageExpertTrust ? Math.round(averageExpertTrust) : "Neutral",
          direction: averageExpertTrust ? "POSITIVE" : "WARNING",
          explanation:
            "Future personalization can raise or lower individual experts.",
        },
      ],
    }),
    makeDimension({
      key: "consensusAgreement",
      label: "Expert agreement",
      score: agreementScore,
      weight: 0.2,
      explanation:
        "Uses weighted consensus agreement when available, then raw consensus, then local stance agreement.",
      signals: [
        {
          key: "agreementScore",
          label: "Agreement",
          value: `${agreementScore}%`,
          direction: agreementScore >= 60 ? "POSITIVE" : "WARNING",
          explanation:
            "Low agreement means the intelligence may be divisive even if the player has many mentions.",
        },
      ],
    }),
    makeDimension({
      key: "currentSeasonActivity",
      label: "Recency",
      score: getRecentSignalScore(latestActivityDate),
      weight: 0.15,
      explanation:
        "Rewards newer transcript intelligence inside the selected freshness scope.",
      signals: [
        {
          key: "latestActivity",
          label: "Latest evidence",
          value: latestActivityDate ? formatDate(latestActivityDate) : "None",
          direction: latestActivityDate ? "POSITIVE" : "WARNING",
          explanation:
            "Fresh evidence is more useful for current fantasy decisions.",
        },
      ],
    }),
    makeDimension({
      key: "gradedSampleSize",
      label: "Evidence sample",
      score: sampleSizeScore,
      weight: 0.15,
      explanation:
        "Rewards multiple expert sources and multiple transcript evidence points.",
      signals: [
        {
          key: "expertCount",
          label: "Experts",
          value: expertIds.size,
          direction: expertIds.size >= 2 ? "POSITIVE" : "WARNING",
          explanation:
            "Player trust is stronger when more than one expert contributes.",
        },
      ],
    }),
    makeDimension({
      key: "takeTypeExpertise",
      label: "Evidence quality",
      score: averageEvidenceConfidence || 50,
      weight: 0.15,
      explanation:
        "Uses transcript summary confidence or approved take confidence.",
      signals: [
        {
          key: "evidenceConfidence",
          label: "Evidence confidence",
          value: averageEvidenceConfidence
            ? `${Math.round(averageEvidenceConfidence)}%`
            : "Neutral",
          direction: averageEvidenceConfidence >= 60 ? "POSITIVE" : "WARNING",
          explanation:
            "Confidence comes from deterministic extraction and transcript summary aggregation.",
        },
      ],
    }),
    makeDimension({
      key: "qualityReview",
      label: "Quality review",
      score: qualityReviewSignal.score,
      weight: 0.1,
      explanation:
        "Uses summary quality scores, manual review, auto-approval, and quality warnings for the player evidence set.",
      signals: [
        {
          key: "playerSummaryQuality",
          label: "Summary quality",
          value:
            qualityReviewSignal.averageQualityScore === null
              ? "No summaries"
              : qualityReviewSignal.averageQualityScore,
          direction:
            qualityReviewSignal.score >= 70 ? "POSITIVE" : "WARNING",
          explanation:
            "Human-reviewed summaries carry stronger trust than auto-approved summaries.",
        },
        {
          key: "playerQualityWarnings",
          label: "Quality warnings",
          value: qualityReviewSignal.warningCount,
          direction:
            qualityReviewSignal.warningCount > 0 ? "WARNING" : "POSITIVE",
          explanation:
            "Warnings mark ambiguous or low-evidence player intelligence.",
        },
      ],
    }),
    makeDimension({
      key: "recentAccuracy",
      label: "Weighted consensus signal",
      score: weightedConsensusSignal,
      weight: 0.1,
      explanation:
        "Weighted consensus remains an internal signal feeding the broader Trust Score.",
      signals: [
        {
          key: "weightedConsensus",
          label: "Weighted consensus",
          value: weightedConsensus
            ? weightedConsensus.weightedConsensusLabel
            : "Not available",
          direction: weightedConsensus ? "POSITIVE" : "WARNING",
          explanation:
            "This is no longer the final user-facing concept; it supports Trust Score.",
        },
      ],
    }),
    makeDimension({
      key: "expertMemory",
      label: "Expert Memory",
      score: expertMemorySignal.score,
      weight: 0.12,
      explanation:
        "Uses expert-player memory timelines for conviction, stance movement, and opinion volatility.",
      signals: [
        {
          key: "playerMemoryTimelineCount",
          label: "Memory timelines",
          value: expertMemories.length,
          direction: expertMemories.length > 0 ? "POSITIVE" : "WARNING",
          explanation:
            "Each timeline represents one expert's history on this player.",
        },
        {
          key: "playerVolatileMemoryCount",
          label: "Volatile timelines",
          value: volatileMemoryCount,
          direction: volatileMemoryCount > 0 ? "WARNING" : "NEUTRAL",
          explanation:
            "Volatile opinion movement should make player intelligence less certain.",
        },
        {
          key: "playerMemorySignal",
          label: "Memory signal",
          value: expertMemorySignal.label,
          direction: expertMemorySignal.score >= 60 ? "POSITIVE" : "WARNING",
          explanation: expertMemorySignal.explanation,
        },
      ],
    }),
  ];
  const scoreCap =
    expertIds.size < 2 || evidenceItems.length < 3
      ? 68
      : expertIds.size < 3
        ? 82
        : 100;
  const trustScore = calculateTrustScore({
    dimensions,
    maxScoreCap: scoreCap,
  });
  const confidenceLabel = getTrustConfidenceLabel({
    totalGraded: Array.from(expertIds).reduce(
      (total, expertId) =>
        total + (expertTrustById.get(expertId)?.evidence.gradedOutcomes ?? 0),
      0,
    ),
    evidenceCount: evidenceItems.length,
    expertCount: expertIds.size,
  });
  const lowSampleWarnings = [];
  const disagreementWarnings = [];

  if (expertIds.size < 2) {
    lowSampleWarnings.push("Only one expert has approved evidence for this player.");
  }
  if (evidenceItems.length < 3) {
    lowSampleWarnings.push("Fewer than three evidence points support this player profile.");
  }
  if (stanceCounts.bullish > 0 && stanceCounts.bearish > 0) {
    disagreementWarnings.push(
      "Approved evidence contains both bullish and bearish stances.",
    );
  }
  if (weightedConsensus?.weightedConsensusLabel === "Mixed / Divisive") {
    disagreementWarnings.push("Weighted consensus marks this player as divisive.");
  }
  disagreementWarnings.push(...expertMemorySignal.warnings);
  disagreementWarnings.push(...qualityReviewSignal.warnings);

  return {
    playerId: player.id,
    playerName: player.fullName,
    position: player.position,
    team: player.team,
    playerTrustScore: trustScore.score,
    confidenceLabel,
    sampleSizeLabel: getSampleSizeLabel(
      Array.from(expertIds).reduce(
        (total, expertId) =>
          total + (expertTrustById.get(expertId)?.evidence.gradedOutcomes ?? 0),
        0,
      ),
    ),
    stanceSummary,
    evidenceCount: evidenceItems.reduce(
      (total, item) => total + Math.max(1, item.evidenceCount),
      0,
    ),
    latestEvidenceDate: latestActivityDate,
    breakdown: trustScore.breakdown,
    topSupportingExperts: buildTopSupportingExperts({
      evidenceItems,
      expertTrustById,
    }),
    disagreementWarnings,
    lowSampleWarnings,
    evidencePointers: evidenceItems.slice(0, 5).map((item) => ({
      sourceTitle: item.sourceTitle,
      expertName: item.expertName,
      publishedAt: item.publishedAt,
      excerpt: item.excerpt,
    })),
    signals: trustScore.signals,
    expertMemorySignal,
    qualityReviewSignal,
    snapshotMovementSignal: snapshotMovement,
  };
}

function makeDimension(input: Omit<ExpertTrustDimension, "weightedPoints">) {
  return {
    ...input,
    score: clamp(Math.round(input.score), 0, 100),
    weightedPoints: roundToOne(input.score * input.weight),
  };
}

function calculateExpertConsensusAgreement(
  expertId: string,
  consensusRows: ConsensusRow[],
) {
  let aligned = 0;
  let eligible = 0;

  for (const row of consensusRows) {
    const consensusDirection = getConsensusDirection(row.consensusLabel);
    const expert = row.expertBreakdown.find(
      (breakdown) => breakdown.expertId === expertId,
    );

    if (!consensusDirection || !expert) continue;

    eligible += 1;

    if (expert.stance === consensusDirection) {
      aligned += 1;
    }
  }

  return {
    aligned,
    eligible,
    rate: eligible > 0 ? Math.round((aligned / eligible) * 100) : null,
  };
}

function getConsensusDirection(label: string) {
  if (label === "Strong Bullish" || label === "Bullish") return "BULLISH";
  if (label === "Strong Bearish" || label === "Bearish") return "BEARISH";

  return null;
}

function countExpertOutcomes(expert: ExpertTrustData) {
  const outcomes = expert.expertTakes
    .map((take) => take.outcome?.grade)
    .filter((grade) => grade && grade !== "NEEDS_REVIEW");
  const correct = outcomes.filter((grade) => grade === "CORRECT").length;
  const partial = outcomes.filter((grade) => grade === "PARTIALLY_CORRECT")
    .length;
  const incorrect = outcomes.filter((grade) => grade === "INCORRECT").length;
  const denominator = correct + partial + incorrect;

  return {
    totalGraded: outcomes.length,
    accuracyRate:
      denominator > 0
        ? Math.round(((correct + partial * 0.5) / denominator) * 100)
        : null,
  };
}

function calculateSummaryQualitySignal(
  summaries: Array<{
    qualityScore: number | null;
    autoApprovedAt: Date | null;
    manuallyReviewedAt: Date | null;
    qualityWarnings: string[];
  }>,
): SummaryQualitySignal {
  const qualityScores = summaries
    .map((summary) => summary.qualityScore)
    .filter((score): score is number => typeof score === "number");
  const averageQualityScore =
    qualityScores.length > 0 ? Math.round(average(qualityScores)) : null;
  const autoApprovedCount = summaries.filter(
    (summary) => summary.autoApprovedAt,
  ).length;
  const humanReviewedCount = summaries.filter(
    (summary) => summary.manuallyReviewedAt,
  ).length;
  const warningCount = summaries.reduce(
    (total, summary) => total + summary.qualityWarnings.length,
    0,
  );
  let score = averageQualityScore ?? (summaries.length > 0 ? 55 : 50);

  if (humanReviewedCount > 0) {
    score += Math.min(10, humanReviewedCount * 4);
  }

  if (autoApprovedCount > 0 && humanReviewedCount === 0) {
    score -= 5;
  }

  if (warningCount > 0) {
    score -= Math.min(18, warningCount * 3);
  }

  const finalScore = clamp(Math.round(score), 0, 100);
  const warnings: string[] = [];

  if (summaries.length === 0) {
    warnings.push("No approved transcript summary quality signal is available.");
  }
  if (averageQualityScore !== null && averageQualityScore < 65) {
    warnings.push("Approved transcript summaries have low quality scores.");
  }
  if (autoApprovedCount > 0 && humanReviewedCount === 0) {
    warnings.push(
      "Approved summaries are deterministic auto-approvals until a human reviews them.",
    );
  }
  if (warningCount > 0) {
    warnings.push("Approved summaries still contain quality warnings.");
  }

  return {
    score: finalScore,
    label:
      finalScore >= 80
        ? "Strong quality"
        : finalScore >= 65
          ? "Usable quality"
          : finalScore >= 50
            ? "Thin quality"
            : "Weak quality",
    averageQualityScore,
    autoApprovedCount,
    humanReviewedCount,
    warningCount,
    explanation:
      averageQualityScore === null
        ? "No reviewed transcript summary quality score is available yet."
        : `Transcript summary quality averages ${averageQualityScore}, with ${humanReviewedCount} human-reviewed and ${autoApprovedCount} auto-approved summar${
            autoApprovedCount === 1 ? "y" : "ies"
          }.`,
    warnings,
  };
}

async function getPlayerTrustSnapshotMovementMap({
  contentSeason,
  playerIds,
}: {
  contentSeason: number;
  playerIds: string[];
}) {
  const snapshots = await db.playerTrustSnapshot.findMany({
    where: {
      contentSeason,
      playerId: {
        in: playerIds,
      },
    },
    orderBy: [{ playerId: "asc" }, { version: "desc" }],
  });
  const snapshotsByPlayerId = groupBy(snapshots, (snapshot) => snapshot.playerId);
  const movementByPlayerId = new Map<string, TrustSnapshotMovementSignal>();

  for (const [playerId, playerSnapshots] of snapshotsByPlayerId) {
    const [latest, previous] = playerSnapshots;

    movementByPlayerId.set(
      playerId,
      latest
        ? buildTrustSnapshotMovementSignal({ latest, previous })
        : getEmptyTrustSnapshotMovementSignal(),
    );
  }

  return movementByPlayerId;
}

function buildTrustSnapshotMovementSignal({
  latest,
  previous,
}: {
  latest: {
    confidenceLabel: string;
    evidenceCount: number;
    snapshotDate: Date;
    trustScore: number;
  };
  previous?: {
    confidenceLabel: string;
    evidenceCount: number;
    trustScore: number;
  };
}): TrustSnapshotMovementSignal {
  if (!previous) {
    return {
      label: "New trust history",
      previousTrustScore: null,
      latestTrustScore: latest.trustScore,
      trustScoreChange: null,
      direction: "NEW",
      confidenceMovement: `New confidence: ${latest.confidenceLabel}`,
      evidenceMovement: `New evidence count: ${latest.evidenceCount}`,
      snapshotCount: 1,
      latestSnapshotDate: latest.snapshotDate,
      explanation:
        "Only one persisted Trust snapshot exists for this player in the selected season.",
    };
  }

  const trustScoreChange = latest.trustScore - previous.trustScore;

  return {
    label:
      trustScoreChange > 0
        ? `Trust increased by ${trustScoreChange}`
        : trustScoreChange < 0
          ? `Trust decreased by ${Math.abs(trustScoreChange)}`
          : "Trust unchanged",
    previousTrustScore: previous.trustScore,
    latestTrustScore: latest.trustScore,
    trustScoreChange,
    direction:
      trustScoreChange > 0
        ? "UP"
        : trustScoreChange < 0
          ? "DOWN"
          : "UNCHANGED",
    confidenceMovement:
      previous.confidenceLabel === latest.confidenceLabel
        ? `Confidence stayed ${latest.confidenceLabel}`
        : `Confidence moved from ${previous.confidenceLabel} to ${latest.confidenceLabel}`,
    evidenceMovement:
      previous.evidenceCount === latest.evidenceCount
        ? `Evidence stayed at ${latest.evidenceCount}`
        : `Evidence moved from ${previous.evidenceCount} to ${latest.evidenceCount}`,
    snapshotCount: 2,
    latestSnapshotDate: latest.snapshotDate,
    explanation:
      "Movement compares the two latest persisted Player Trust snapshots for this season.",
  };
}

function getEmptyTrustSnapshotMovementSignal(): TrustSnapshotMovementSignal {
  return {
    label: "No trust history yet",
    previousTrustScore: null,
    latestTrustScore: null,
    trustScoreChange: null,
    direction: "NO_HISTORY",
    confidenceMovement: "No historical confidence snapshot yet.",
    evidenceMovement: "No historical evidence snapshot yet.",
    snapshotCount: 0,
    latestSnapshotDate: null,
    explanation:
      "Generate or review transcript intelligence to create persisted Trust snapshots.",
  };
}

function buildExpertTrustWarnings({
  totalGraded,
  scoreCap,
  approvedSummaryCount,
  consensusAgreementRate,
  qualityReviewSignal,
}: {
  totalGraded: number;
  scoreCap: number;
  approvedSummaryCount: number;
  consensusAgreementRate: number | null;
  qualityReviewSignal: SummaryQualitySignal;
}) {
  const warnings = [];

  if (totalGraded === 0) {
    warnings.push("Trust score is provisional because no outcomes are graded yet.");
  } else if (totalGraded < 5) {
    warnings.push("Trust score is capped because the graded sample is thin.");
  }

  if (approvedSummaryCount === 0) {
    warnings.push(
      "No approved transcript player summaries are available yet; older take evidence may dominate.",
    );
  }

  if (scoreCap < 100) {
    warnings.push(`Low sample size caps the maximum score at ${scoreCap}.`);
  }

  if (consensusAgreementRate !== null && consensusAgreementRate < 45) {
    warnings.push(
      "This expert often differs from current raw consensus; review evidence before relying on the score.",
    );
  }

  warnings.push(...qualityReviewSignal.warnings);

  return warnings;
}

function buildTopSupportingExperts({
  evidenceItems,
  expertTrustById,
}: {
  evidenceItems: Array<{
    expertId: string;
    expertName: string;
    stance: "BULLISH" | "BEARISH" | "MIXED" | "NEUTRAL";
    summary: string;
  }>;
  expertTrustById: Map<string, ExpertTrustProfile>;
}) {
  const evidenceByExpert = groupBy(evidenceItems, (item) => item.expertId);

  return Array.from(evidenceByExpert.values())
    .map((items) => {
      const latestItem = items[0];
      const stances = countStances(items);

      return {
        expertId: latestItem.expertId,
        expertName: latestItem.expertName,
        stance: getInternalStance(stances),
        trustScore:
          expertTrustById.get(latestItem.expertId)?.overallTrustScore ?? 50,
        evidenceCount: items.length,
        latestSummary: latestItem.summary,
      };
    })
    .sort(
      (expertA, expertB) =>
        expertB.trustScore - expertA.trustScore ||
        expertB.evidenceCount - expertA.evidenceCount ||
        expertA.expertName.localeCompare(expertB.expertName),
    )
    .slice(0, 5);
}

function countStances(
  items: Array<{
    stance: string;
  }>,
) {
  return {
    bullish: items.filter((item) => item.stance === "BULLISH").length,
    bearish: items.filter((item) => item.stance === "BEARISH").length,
    mixed: items.filter((item) => item.stance === "MIXED").length,
    neutral: items.filter((item) => item.stance === "NEUTRAL").length,
  };
}

function getPlayerStanceSummary(counts: ReturnType<typeof countStances>) {
  if (counts.bullish > counts.bearish && counts.bullish >= counts.neutral) {
    return "Bullish";
  }
  if (counts.bearish > counts.bullish && counts.bearish >= counts.neutral) {
    return "Bearish";
  }
  if (counts.bullish > 0 && counts.bearish > 0) return "Mixed";

  return "Neutral";
}

function getInternalStance(
  counts: ReturnType<typeof countStances>,
): "BULLISH" | "BEARISH" | "MIXED" | "NEUTRAL" {
  if (counts.bullish > counts.bearish && counts.bullish >= counts.neutral) {
    return "BULLISH";
  }
  if (counts.bearish > counts.bullish && counts.bearish >= counts.neutral) {
    return "BEARISH";
  }
  if (counts.bullish > 0 && counts.bearish > 0) return "MIXED";

  return "NEUTRAL";
}

function calculateLocalAgreementScore(counts: ReturnType<typeof countStances>) {
  const total = counts.bullish + counts.bearish + counts.neutral + counts.mixed;

  if (total === 0) return 0;

  return Math.round(
    (Math.max(counts.bullish, counts.bearish, counts.neutral, counts.mixed) /
      total) *
      100,
  );
}

function calculateRecentActivityScore({
  currentSeasonTakes,
  approvedSummaryCount,
  transcriptCount,
  latestActivityDate,
}: {
  currentSeasonTakes: number;
  approvedSummaryCount: number;
  transcriptCount: number;
  latestActivityDate: Date | null;
}) {
  return clamp(
    currentSeasonTakes * 5 +
      approvedSummaryCount * 6 +
      transcriptCount * 4 +
      getRecentSignalScore(latestActivityDate) * 0.35,
    0,
    100,
  );
}

function getRecentSignalScore(date: Date | null) {
  if (!date) return 0;

  const ageInDays =
    (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);

  if (ageInDays <= 14) return 100;
  if (ageInDays <= 45) return 80;
  if (ageInDays <= 90) return 60;
  if (ageInDays <= 180) return 35;

  return 15;
}

function getExpertScoreCap(totalGraded: number, approvedTakeCount: number) {
  if (totalGraded === 0) return approvedTakeCount >= 25 ? 68 : 62;
  if (totalGraded < 5) return 72;
  if (totalGraded < 10) return 82;

  return 100;
}

function getTrustConfidenceLabel({
  totalGraded,
  evidenceCount,
  expertCount,
}: {
  totalGraded: number;
  evidenceCount: number;
  expertCount: number;
}): TrustConfidenceLabel {
  if (totalGraded >= 15 && evidenceCount >= 20 && expertCount >= 1) {
    return "High";
  }
  if (totalGraded >= 5 || (evidenceCount >= 10 && expertCount >= 2)) {
    return "Medium";
  }

  return "Low";
}

function getSampleSizeLabel(totalGraded: number): TrustSampleSizeLabel {
  if (totalGraded === 0) return "No graded outcomes";
  if (totalGraded < 5) return "Thin sample";
  if (totalGraded < 15) return "Developing sample";

  return "Useful sample";
}

function applyExpertFreshnessFilters(
  expert: ExpertTrustData,
  filters: NormalizedTrustFilters,
): ExpertTrustData {
  return {
    ...expert,
    sourceVideos: expert.sourceVideos.filter((sourceVideo) =>
      contentMatchesFilters(sourceVideo.transcript, filters),
    ),
    expertTakes: expert.expertTakes.filter((take) =>
      contentMatchesFilters(take.transcript, filters),
    ),
    transcriptPlayerSummaries: expert.transcriptPlayerSummaries.filter(
      (summary) => contentMatchesFilters(summary.transcript, filters),
    ),
  };
}

function applyPlayerFreshnessFilters(
  player: PlayerTrustData,
  filters: NormalizedTrustFilters,
): PlayerTrustData {
  return {
    ...player,
    expertTakes: player.expertTakes.filter((take) =>
      contentMatchesFilters(take.transcript, filters),
    ),
    transcriptPlayerSummaries: player.transcriptPlayerSummaries.filter(
      (summary) => contentMatchesFilters(summary.transcript, filters),
    ),
  };
}

function contentMatchesFilters(
  content:
    | {
        contentSeason: number | null;
        includeInCurrentAnalysis: boolean;
      }
    | null,
  filters: NormalizedTrustFilters,
) {
  if (!content) return false;
  if (filters.includeHistorical) return true;

  return (
    content.includeInCurrentAnalysis &&
    content.contentSeason === filters.targetSeason
  );
}

function buildTranscriptWhere({
  targetSeason,
  includeHistorical,
}: NormalizedTrustFilters): Prisma.TranscriptWhereInput {
  if (includeHistorical) return {};

  return {
    includeInCurrentAnalysis: true,
    contentSeason: targetSeason,
  };
}

function normalizeTrustFilters(filters: TrustEngineFilters) {
  return {
    targetSeason: normalizeTargetSeason(filters.targetSeason),
    includeHistorical: Boolean(filters.includeHistorical),
  };
}

function countBy<TItem>(items: TItem[], getKey: (item: TItem) => string) {
  const counts = new Map<string, number>();

  for (const item of items) {
    const key = getKey(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, count }))
    .sort(
      (entryA, entryB) =>
        entryB.count - entryA.count || entryA.key.localeCompare(entryB.key),
    );
}

function groupBy<TItem>(items: TItem[], getKey: (item: TItem) => string) {
  const groups = new Map<string, TItem[]>();

  for (const item of items) {
    const key = getKey(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  return groups;
}

function getLatestDate(dates: Array<Date | null | undefined>) {
  const latestTime = dates.reduce(
    (latest, date) => Math.max(latest, date?.getTime() ?? 0),
    0,
  );

  return latestTime > 0 ? new Date(latestTime) : null;
}

function average(values: number[]) {
  if (values.length === 0) return 0;

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function formatPercent(value: number | null) {
  return value === null ? "0%" : `${Math.round(value)}%`;
}

function formatDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundToOne(value: number) {
  return Math.round(value * 10) / 10;
}
