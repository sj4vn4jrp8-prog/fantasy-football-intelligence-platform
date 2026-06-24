import { normalizeTargetSeason } from "@/knowledge-brain/freshness";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export type WeightedConsensusLabel =
  | "Strong Trusted Bullish"
  | "Trusted Bullish"
  | "Mixed / Divisive"
  | "Trusted Bearish"
  | "Strong Trusted Bearish"
  | "Not Enough Trusted Data";

export type WeightedConsensusFilters = {
  targetSeason?: number | string | null;
  includeHistorical?: boolean;
  position?: string | null;
  team?: string | null;
};

export type TrustWeightSource =
  | "DEFAULT"
  | "TRACKING_DEFAULT"
  | "GRADED_ACCURACY";

export type ExpertTrustWeight = {
  expertId?: string;
  accuracyRate: number | null;
  totalGraded: number;
  weight: number;
  source: TrustWeightSource;
  explanation: string;
};

type ExpertStance = "BULLISH" | "BEARISH" | "NEUTRAL" | "MIXED";
type WeightedStance = "BULLISH" | "BEARISH" | "NEUTRAL";

const WEIGHTED_CONSENSUS_TAKE_INCLUDE = {
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
      title: true,
      url: true,
      publishedAt: true,
    },
  },
  transcript: {
    select: {
      includeInCurrentAnalysis: true,
      contentSeason: true,
      freshnessLabel: true,
      publishDate: true,
    },
  },
} satisfies Prisma.ExpertTakeInclude;

type ExpertTakeForWeightedConsensus = Prisma.ExpertTakeGetPayload<{
  include: typeof WEIGHTED_CONSENSUS_TAKE_INCLUDE;
}>;

type ExpertAccuracySnapshotForWeight = {
  expertId: string;
  totalGraded: number;
  accuracyRate: number;
};

export async function getWeightedConsensusDashboard(
  filters: WeightedConsensusFilters = {},
) {
  const normalizedFilters = normalizeWeightedConsensusFilters(filters);
  const [takes, snapshots] = await Promise.all([
    db.expertTake.findMany({
      where: {
        playerId: { not: null },
        transcript: {
          is: buildTranscriptWhere(normalizedFilters),
        },
      },
      include: WEIGHTED_CONSENSUS_TAKE_INCLUDE,
      orderBy: { createdAt: "desc" },
    }),
    getTrustSnapshots(normalizedFilters.targetSeason),
  ]);
  const trustWeights = buildTrustWeightMap(snapshots);
  const rows = buildWeightedConsensusRows(takes, trustWeights)
    .filter((row) =>
      normalizedFilters.position
        ? row.position.toLowerCase() === normalizedFilters.position.toLowerCase()
        : true,
    )
    .filter((row) =>
      normalizedFilters.team
        ? (row.team ?? "").toLowerCase() === normalizedFilters.team.toLowerCase()
        : true,
    );
  const positionOptions = Array.from(
    new Set(rows.map((row) => row.position).filter(Boolean)),
  ).sort();
  const teamOptions = Array.from(
    new Set(rows.map((row) => row.team).filter(isNonEmptyString)),
  ).sort();

  return {
    rows: rows.sort(sortWeightedConsensusRows),
    positionOptions,
    teamOptions,
    filters: normalizedFilters,
    hasAdjustedWeights: rows.some((row) => row.hasAdjustedWeights),
    gradedExpertCount: countGradedExperts(rows),
    defaultWeightNotice:
      rows.some((row) => row.hasAdjustedWeights)
        ? null
        : "Weighted consensus currently matches raw consensus because all experts are using the default 1.00 trust weight.",
    widgets: buildWeightedConsensusWidgets(rows),
  };
}

export async function getPlayerWeightedConsensusBreakdown({
  playerId,
  targetSeason,
  includeHistorical,
}: {
  playerId: string;
  targetSeason?: number | string | null;
  includeHistorical?: boolean;
}) {
  const normalizedFilters = normalizeWeightedConsensusFilters({
    targetSeason,
    includeHistorical,
  });
  const [takes, snapshots] = await Promise.all([
    db.expertTake.findMany({
      where: {
        playerId,
        transcript: {
          is: buildTranscriptWhere(normalizedFilters),
        },
      },
      include: WEIGHTED_CONSENSUS_TAKE_INCLUDE,
      orderBy: { createdAt: "desc" },
    }),
    getTrustSnapshots(normalizedFilters.targetSeason),
  ]);
  const trustWeights = buildTrustWeightMap(snapshots);
  const row = buildWeightedConsensusRows(takes, trustWeights)[0] ?? null;

  return {
    row,
    experts: row?.expertContributions ?? [],
    filters: normalizedFilters,
    defaultWeightNotice:
      row && !row.hasAdjustedWeights
        ? "Weighted consensus currently matches raw consensus because all contributing experts are using the default 1.00 trust weight."
        : null,
  };
}

export function calculateExpertTrustWeight({
  expertId,
  accuracyRate,
  totalGraded,
}: {
  expertId?: string;
  accuracyRate: number | null | undefined;
  totalGraded: number | null | undefined;
}): ExpertTrustWeight {
  const normalizedTotalGraded = Number(totalGraded ?? 0);

  if (normalizedTotalGraded <= 0 || accuracyRate === null || accuracyRate === undefined) {
    return {
      expertId,
      accuracyRate: null,
      totalGraded: normalizedTotalGraded,
      weight: 1,
      source: "DEFAULT",
      explanation:
        "No graded outcomes are available yet, so this expert uses the default 1.00 trust weight.",
    };
  }

  const normalizedAccuracyRate =
    accuracyRate > 1 ? accuracyRate / 100 : accuracyRate;
  const weight = roundToTwo(
    clamp(0.5, 1.5, 0.5 + normalizedAccuracyRate),
  );

  return {
    expertId,
    accuracyRate: roundToOne(normalizedAccuracyRate * 100),
    totalGraded: normalizedTotalGraded,
    weight,
    source: "GRADED_ACCURACY",
    explanation: `${roundToOne(
      normalizedAccuracyRate * 100,
    )}% graded accuracy maps to a ${weight.toFixed(
      2,
    )} trust weight using clamp(0.5, 1.5, 0.5 + accuracy).`,
  };
}

async function getTrustSnapshots(season: number) {
  return db.expertAccuracySnapshot.findMany({
    where: {
      season,
      position: "ALL",
      takeType: "ALL",
      totalGraded: {
        gt: 0,
      },
    },
    select: {
      expertId: true,
      totalGraded: true,
      accuracyRate: true,
    },
  });
}

function buildTrustWeightMap(snapshots: ExpertAccuracySnapshotForWeight[]) {
  return new Map(
    snapshots.map((snapshot) => [
      snapshot.expertId,
      calculateExpertTrustWeight(snapshot),
    ]),
  );
}

function buildWeightedConsensusRows(
  takes: ExpertTakeForWeightedConsensus[],
  trustWeights: Map<string, ExpertTrustWeight>,
) {
  const takesByPlayer = new Map<string, ExpertTakeForWeightedConsensus[]>();

  for (const take of takes) {
    if (!take.player) continue;

    takesByPlayer.set(take.player.id, [
      ...(takesByPlayer.get(take.player.id) ?? []),
      take,
    ]);
  }

  return Array.from(takesByPlayer.values()).map((playerTakes) =>
    buildPlayerWeightedConsensusRow(playerTakes, trustWeights),
  );
}

function buildPlayerWeightedConsensusRow(
  takes: ExpertTakeForWeightedConsensus[],
  trustWeights: Map<string, ExpertTrustWeight>,
) {
  const player = takes[0]?.player;

  if (!player) {
    throw new Error("Cannot build weighted consensus without a player.");
  }

  const expertContributions = buildExpertContributions(takes, trustWeights);
  const rawBullishExperts = expertContributions.filter(
    (expert) => expert.stance === "BULLISH",
  ).length;
  const rawBearishExperts = expertContributions.filter(
    (expert) => expert.stance === "BEARISH",
  ).length;
  const rawNeutralExperts = expertContributions.filter(
    (expert) => expert.weightedStance === "NEUTRAL",
  ).length;
  const totalExperts = expertContributions.length;
  const totalMentions = expertContributions.reduce(
    (sum, expert) => sum + expert.mentionCount,
    0,
  );
  const weightedBullishScore = sumWeightsByStance(
    expertContributions,
    "BULLISH",
  );
  const weightedBearishScore = sumWeightsByStance(
    expertContributions,
    "BEARISH",
  );
  const weightedNeutralScore = sumWeightsByStance(
    expertContributions,
    "NEUTRAL",
  );
  const totalWeightedScore =
    weightedBullishScore + weightedBearishScore + weightedNeutralScore;
  const weightedMajority = getWeightedMajorityStance({
    weightedBullishScore,
    weightedBearishScore,
    weightedNeutralScore,
  });
  const majorityScore =
    weightedMajority === "BULLISH"
      ? weightedBullishScore
      : weightedMajority === "BEARISH"
        ? weightedBearishScore
        : weightedNeutralScore;
  const weightedAgreementScore =
    totalWeightedScore > 0
      ? Math.round((majorityScore / totalWeightedScore) * 100)
      : 0;
  const weightedConsensusLabel = getWeightedConsensusLabel({
    totalExperts,
    totalMentions,
    weightedBullishScore,
    weightedBearishScore,
    weightedMajority,
    weightedAgreementScore,
  });
  const rawConsensusLabel = getRawConsensusLabel({
    totalExperts,
    totalMentions,
    rawBullishExperts,
    rawBearishExperts,
    rawNeutralExperts,
  });
  const latestTake = takes[0] ?? null;
  const latestTakeDate = getLatestDate(takes.map((take) => take.createdAt));
  const hasAdjustedWeights = expertContributions.some(
    (expert) => expert.trustWeight !== 1,
  );

  return {
    playerId: player.id,
    playerName: player.fullName,
    position: player.position,
    team: player.team,
    totalExperts,
    totalMentions,
    rawBullishExperts,
    rawBearishExperts,
    rawNeutralExperts,
    rawConsensusLabel,
    weightedBullishScore: roundToTwo(weightedBullishScore),
    weightedBearishScore: roundToTwo(weightedBearishScore),
    weightedNeutralScore: roundToTwo(weightedNeutralScore),
    weightedConsensusLabel,
    weightedAgreementScore,
    trustWeightedConfidence: calculateTrustWeightedConfidence({
      weightedAgreementScore,
      totalExperts,
      gradedExpertCount: expertContributions.filter(
        (expert) => expert.totalGraded > 0,
      ).length,
    }),
    topWeightedExperts: [...expertContributions]
      .sort(
        (expertA, expertB) =>
          expertB.trustWeight - expertA.trustWeight ||
          expertB.mentionCount - expertA.mentionCount ||
          expertA.expertName.localeCompare(expertB.expertName),
      )
      .slice(0, 3),
    expertContributions,
    latestTakeDate,
    latestTake: latestTake
      ? {
          id: latestTake.id,
          summary: latestTake.summary,
          excerpt: latestTake.excerpt,
          sentiment: latestTake.sentiment,
          takeType: latestTake.takeType,
          expertName: latestTake.expert.name,
          sourceTitle: latestTake.sourceVideo.title,
          sourceUrl: latestTake.sourceVideo.url,
          publishedAt: latestTake.sourceVideo.publishedAt,
          createdAt: latestTake.createdAt,
          freshnessLabel: latestTake.transcript?.freshnessLabel ?? "STALE",
          publishDate:
            latestTake.transcript?.publishDate ??
            latestTake.sourceVideo.publishedAt,
        }
      : null,
    hasAdjustedWeights,
  };
}

function buildExpertContributions(
  takes: ExpertTakeForWeightedConsensus[],
  trustWeights: Map<string, ExpertTrustWeight>,
) {
  const takesByExpert = new Map<string, ExpertTakeForWeightedConsensus[]>();

  for (const take of takes) {
    takesByExpert.set(take.expertId, [
      ...(takesByExpert.get(take.expertId) ?? []),
      take,
    ]);
  }

  return Array.from(takesByExpert.values())
    .map((expertTakes) => {
      const latestTake = expertTakes[0];
      const bullishCount = expertTakes.filter(
        (take) => take.sentiment === "BULLISH",
      ).length;
      const bearishCount = expertTakes.filter(
        (take) => take.sentiment === "BEARISH",
      ).length;
      const neutralCount = expertTakes.filter(
        (take) => take.sentiment === "NEUTRAL",
      ).length;
      const stance = getExpertStance({
        bullishCount,
        bearishCount,
        neutralCount,
      });
      const weightedStance = getWeightedStance(stance);
      const trustWeight =
        trustWeights.get(latestTake.expert.id) ??
        calculateExpertTrustWeight({
          expertId: latestTake.expert.id,
          accuracyRate: null,
          totalGraded: 0,
        });

      return {
        expertId: latestTake.expert.id,
        expertName: latestTake.expert.name,
        mentionCount: expertTakes.length,
        bullishCount,
        bearishCount,
        neutralCount,
        stance,
        weightedStance,
        accuracyRate: trustWeight.accuracyRate,
        totalGraded: trustWeight.totalGraded,
        trustWeight: trustWeight.weight,
        trustWeightSource: trustWeight.source,
        trustWeightExplanation: trustWeight.explanation,
        contributionScore: trustWeight.weight,
        latestTake: {
          id: latestTake.id,
          summary: latestTake.summary,
          excerpt: latestTake.excerpt,
          sentiment: latestTake.sentiment,
          takeType: latestTake.takeType,
          sourceTitle: latestTake.sourceVideo.title,
          sourceUrl: latestTake.sourceVideo.url,
          publishedAt: latestTake.sourceVideo.publishedAt,
          createdAt: latestTake.createdAt,
        },
      };
    })
    .sort(
      (expertA, expertB) =>
        expertB.trustWeight - expertA.trustWeight ||
        expertB.mentionCount - expertA.mentionCount ||
        expertA.expertName.localeCompare(expertB.expertName),
    );
}

function getExpertStance({
  bullishCount,
  bearishCount,
  neutralCount,
}: {
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
}): ExpertStance {
  if (bullishCount === bearishCount && bullishCount > 0) return "MIXED";
  if (bullishCount > bearishCount && bullishCount >= neutralCount) {
    return "BULLISH";
  }
  if (bearishCount > bullishCount && bearishCount >= neutralCount) {
    return "BEARISH";
  }

  return "NEUTRAL";
}

function getWeightedStance(stance: ExpertStance): WeightedStance {
  if (stance === "BULLISH") return "BULLISH";
  if (stance === "BEARISH") return "BEARISH";

  return "NEUTRAL";
}

function sumWeightsByStance(
  expertContributions: ReturnType<typeof buildExpertContributions>,
  stance: WeightedStance,
) {
  return expertContributions
    .filter((expert) => expert.weightedStance === stance)
    .reduce((sum, expert) => sum + expert.contributionScore, 0);
}

function getWeightedMajorityStance({
  weightedBullishScore,
  weightedBearishScore,
  weightedNeutralScore,
}: {
  weightedBullishScore: number;
  weightedBearishScore: number;
  weightedNeutralScore: number;
}): WeightedStance {
  if (
    weightedBullishScore >= weightedBearishScore &&
    weightedBullishScore >= weightedNeutralScore
  ) {
    return "BULLISH";
  }
  if (
    weightedBearishScore >= weightedBullishScore &&
    weightedBearishScore >= weightedNeutralScore
  ) {
    return "BEARISH";
  }

  return "NEUTRAL";
}

function getWeightedConsensusLabel({
  totalExperts,
  totalMentions,
  weightedBullishScore,
  weightedBearishScore,
  weightedMajority,
  weightedAgreementScore,
}: {
  totalExperts: number;
  totalMentions: number;
  weightedBullishScore: number;
  weightedBearishScore: number;
  weightedMajority: WeightedStance;
  weightedAgreementScore: number;
}): WeightedConsensusLabel {
  if (totalExperts < 2 || totalMentions < 3) {
    return "Not Enough Trusted Data";
  }

  const bullishBearishSpread = Math.abs(
    weightedBullishScore - weightedBearishScore,
  );

  if (
    weightedBullishScore > 0 &&
    weightedBearishScore > 0 &&
    bullishBearishSpread <= 0.5
  ) {
    return "Mixed / Divisive";
  }

  if (weightedAgreementScore < 50 || weightedMajority === "NEUTRAL") {
    return "Mixed / Divisive";
  }

  if (weightedMajority === "BULLISH") {
    return weightedAgreementScore >= 75
      ? "Strong Trusted Bullish"
      : "Trusted Bullish";
  }

  return weightedAgreementScore >= 75
    ? "Strong Trusted Bearish"
    : "Trusted Bearish";
}

function getRawConsensusLabel({
  totalExperts,
  totalMentions,
  rawBullishExperts,
  rawBearishExperts,
  rawNeutralExperts,
}: {
  totalExperts: number;
  totalMentions: number;
  rawBullishExperts: number;
  rawBearishExperts: number;
  rawNeutralExperts: number;
}) {
  if (totalExperts < 2 || totalMentions < 3) return "Not Enough Data";

  const majority =
    rawBullishExperts >= rawBearishExperts &&
    rawBullishExperts >= rawNeutralExperts
      ? "BULLISH"
      : rawBearishExperts >= rawBullishExperts &&
          rawBearishExperts >= rawNeutralExperts
        ? "BEARISH"
        : "NEUTRAL";
  const majorityCount =
    majority === "BULLISH"
      ? rawBullishExperts
      : majority === "BEARISH"
        ? rawBearishExperts
        : rawNeutralExperts;
  const agreementScore =
    totalExperts > 0 ? Math.round((majorityCount / totalExperts) * 100) : 0;
  const bullishBearishSpread = Math.abs(rawBullishExperts - rawBearishExperts);

  if (
    rawBullishExperts > 0 &&
    rawBearishExperts > 0 &&
    bullishBearishSpread <= 1
  ) {
    return "Split";
  }

  if (agreementScore < 50 || majority === "NEUTRAL") return "Split";

  if (majority === "BULLISH") {
    return agreementScore >= 75 ? "Strong Bullish" : "Bullish";
  }

  return agreementScore >= 75 ? "Strong Bearish" : "Bearish";
}

function calculateTrustWeightedConfidence({
  weightedAgreementScore,
  totalExperts,
  gradedExpertCount,
}: {
  weightedAgreementScore: number;
  totalExperts: number;
  gradedExpertCount: number;
}) {
  if (totalExperts === 0) return 0;

  const sampleFactor = Math.min(1, totalExperts / 3);
  const trustEvidenceFactor =
    gradedExpertCount > 0 ? 0.85 + 0.15 * (gradedExpertCount / totalExperts) : 1;

  return Math.round(
    weightedAgreementScore * sampleFactor * trustEvidenceFactor,
  );
}

function buildWeightedConsensusWidgets(
  rows: ReturnType<typeof buildWeightedConsensusRows>,
) {
  const trustedRows = rows.filter(
    (row) => row.weightedConsensusLabel !== "Not Enough Trusted Data",
  );

  return {
    strongestTrustedConsensus: [...trustedRows]
      .sort(
        (rowA, rowB) =>
          rowB.weightedAgreementScore - rowA.weightedAgreementScore ||
          rowB.trustWeightedConfidence - rowA.trustWeightedConfidence,
      )
      .slice(0, 5),
    mostTrustedBullish: [...trustedRows]
      .filter((row) => row.weightedConsensusLabel.includes("Bullish"))
      .sort(
        (rowA, rowB) =>
          rowB.weightedBullishScore - rowA.weightedBullishScore ||
          rowB.weightedAgreementScore - rowA.weightedAgreementScore,
      )
      .slice(0, 5),
    mostTrustedBearish: [...trustedRows]
      .filter((row) => row.weightedConsensusLabel.includes("Bearish"))
      .sort(
        (rowA, rowB) =>
          rowB.weightedBearishScore - rowA.weightedBearishScore ||
          rowB.weightedAgreementScore - rowA.weightedAgreementScore,
      )
      .slice(0, 5),
    mostDivisiveWeighted: [...rows]
      .filter((row) => row.weightedConsensusLabel === "Mixed / Divisive")
      .sort(
        (rowA, rowB) =>
          rowB.totalExperts - rowA.totalExperts ||
          rowB.totalMentions - rowA.totalMentions,
      )
      .slice(0, 5),
  };
}

function sortWeightedConsensusRows(
  rowA: ReturnType<typeof buildPlayerWeightedConsensusRow>,
  rowB: ReturnType<typeof buildPlayerWeightedConsensusRow>,
) {
  return (
    rowB.totalExperts - rowA.totalExperts ||
    rowB.trustWeightedConfidence - rowA.trustWeightedConfidence ||
    rowB.weightedAgreementScore - rowA.weightedAgreementScore ||
    getDateTime(rowB.latestTakeDate) - getDateTime(rowA.latestTakeDate) ||
    rowA.playerName.localeCompare(rowB.playerName)
  );
}

function countGradedExperts(rows: ReturnType<typeof buildWeightedConsensusRows>) {
  const expertIds = new Set<string>();

  for (const row of rows) {
    for (const expert of row.expertContributions) {
      if (expert.totalGraded > 0) {
        expertIds.add(expert.expertId);
      }
    }
  }

  return expertIds.size;
}

function buildTranscriptWhere(
  filters: ReturnType<typeof normalizeWeightedConsensusFilters>,
): Prisma.TranscriptWhereInput {
  const where: Prisma.TranscriptWhereInput = {};

  if (!filters.includeHistorical) {
    where.includeInCurrentAnalysis = true;
    where.contentSeason = filters.targetSeason;
  }

  return where;
}

function normalizeWeightedConsensusFilters(filters: WeightedConsensusFilters) {
  return {
    targetSeason: normalizeTargetSeason(filters.targetSeason),
    includeHistorical: Boolean(filters.includeHistorical),
    position: normalizeOptionalString(filters.position),
    team: normalizeOptionalString(filters.team),
  };
}

function normalizeOptionalString(value?: string | null) {
  const trimmed = value?.trim();

  return trimmed ? trimmed : undefined;
}

function getLatestDate(dates: Date[]) {
  const latestTime = dates.reduce(
    (latest, date) => Math.max(latest, date.getTime()),
    0,
  );

  return latestTime > 0 ? new Date(latestTime) : null;
}

function getDateTime(value: Date | null) {
  return value?.getTime() ?? 0;
}

function isNonEmptyString(value: string | null | undefined): value is string {
  return Boolean(value);
}

function clamp(min: number, max: number, value: number) {
  return Math.min(max, Math.max(min, value));
}

function roundToOne(value: number) {
  return Math.round(value * 10) / 10;
}

function roundToTwo(value: number) {
  return Math.round(value * 100) / 100;
}
