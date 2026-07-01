import {
  getConsensusOpinionSignals,
  type ConsensusOpinionSignal,
  type ExpertStance,
} from "@/knowledge-brain/expert-consensus";
import { normalizeTargetSeason } from "@/knowledge-brain/freshness";
import { db } from "@/lib/db";

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

type WeightedStance = "BULLISH" | "BEARISH" | "NEUTRAL";

type ExpertAccuracySnapshotForWeight = {
  expertId: string;
  totalGraded: number;
  accuracyRate: number;
};

export async function getWeightedConsensusDashboard(
  filters: WeightedConsensusFilters = {},
) {
  const normalizedFilters = normalizeWeightedConsensusFilters(filters);
  const [opinionSignals, snapshots] = await Promise.all([
    getConsensusOpinionSignals(normalizedFilters),
    getTrustSnapshots(normalizedFilters.targetSeason),
  ]);
  const trustWeights = buildTrustWeightMap(snapshots);
  const rows = buildWeightedConsensusRows(opinionSignals, trustWeights)
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
  const [opinionSignals, snapshots] = await Promise.all([
    getConsensusOpinionSignals(normalizedFilters, playerId),
    getTrustSnapshots(normalizedFilters.targetSeason),
  ]);
  const trustWeights = buildTrustWeightMap(snapshots);
  const row = buildWeightedConsensusRows(opinionSignals, trustWeights)[0] ?? null;

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
  opinionSignals: ConsensusOpinionSignal[],
  trustWeights: Map<string, ExpertTrustWeight>,
) {
  const signalsByPlayer = new Map<string, ConsensusOpinionSignal[]>();

  for (const signal of opinionSignals) {
    signalsByPlayer.set(signal.playerId, [
      ...(signalsByPlayer.get(signal.playerId) ?? []),
      signal,
    ]);
  }

  return Array.from(signalsByPlayer.values()).map((playerSignals) =>
    buildPlayerWeightedConsensusRow(playerSignals, trustWeights),
  );
}

function buildPlayerWeightedConsensusRow(
  opinionSignals: ConsensusOpinionSignal[],
  trustWeights: Map<string, ExpertTrustWeight>,
) {
  const player = opinionSignals[0]?.player;

  if (!player) {
    throw new Error("Cannot build weighted consensus without a player.");
  }

  const expertContributions = buildExpertContributions(
    opinionSignals,
    trustWeights,
  );
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
  const totalMentions = opinionSignals.reduce(
    (sum, signal) => sum + signal.opinionSignalCount,
    0,
  );
  const totalEvidenceCount = opinionSignals.reduce(
    (sum, signal) => sum + Math.max(1, signal.evidenceCount),
    0,
  );
  const summarySignalCount = opinionSignals.filter(
    (signal) => signal.sourceType === "TRANSCRIPT_PLAYER_SUMMARY",
  ).length;
  const fallbackSignalCount = opinionSignals.length - summarySignalCount;
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
  const latestSignal = opinionSignals[0] ?? null;
  const latestTakeDate = getLatestDate(
    opinionSignals.map((signal) => signal.publishDate ?? signal.createdAt),
  );
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
    totalEvidenceCount,
    summarySignalCount,
    fallbackSignalCount,
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
    latestTake: latestSignal
      ? {
          id: latestSignal.id,
          summary: latestSignal.summary,
          excerpt: latestSignal.excerpt,
          sentiment: latestSignal.stance,
          takeType: latestSignal.takeType,
          expertName: latestSignal.expert.name,
          sourceTitle: latestSignal.sourceVideo.title,
          sourceUrl: latestSignal.sourceVideo.url,
          publishedAt: latestSignal.sourceVideo.publishedAt,
          createdAt: latestSignal.createdAt,
          freshnessLabel: latestSignal.freshnessLabel,
          publishDate: latestSignal.publishDate ?? latestSignal.publishedAt,
          sourceType: latestSignal.sourceType,
          evidenceCount: latestSignal.evidenceCount,
        }
      : null,
    hasAdjustedWeights,
  };
}

function buildExpertContributions(
  opinionSignals: ConsensusOpinionSignal[],
  trustWeights: Map<string, ExpertTrustWeight>,
) {
  const signalsByExpert = new Map<string, ConsensusOpinionSignal[]>();

  for (const signal of opinionSignals) {
    signalsByExpert.set(signal.expertId, [
      ...(signalsByExpert.get(signal.expertId) ?? []),
      signal,
    ]);
  }

  return Array.from(signalsByExpert.values())
    .map((expertSignals) => {
      const latestSignal = expertSignals[0];
      const bullishCount = expertSignals.filter(
        (signal) => signal.stance === "BULLISH",
      ).length;
      const bearishCount = expertSignals.filter(
        (signal) => signal.stance === "BEARISH",
      ).length;
      const neutralCount = expertSignals.filter(
        (signal) => signal.stance === "NEUTRAL" || signal.stance === "MIXED",
      ).length;
      const stance = getExpertStance({
        bullishCount,
        bearishCount,
        neutralCount,
      });
      const weightedStance = getWeightedStance(stance);
      const trustWeight =
        trustWeights.get(latestSignal.expert.id) ??
        calculateExpertTrustWeight({
          expertId: latestSignal.expert.id,
          accuracyRate: null,
          totalGraded: 0,
        });
      const evidenceCount = expertSignals.reduce(
        (sum, signal) => sum + Math.max(1, signal.evidenceCount),
        0,
      );

      return {
        expertId: latestSignal.expert.id,
        expertName: latestSignal.expert.name,
        mentionCount: expertSignals.length,
        evidenceCount,
        summarySignalCount: expertSignals.filter(
          (signal) => signal.sourceType === "TRANSCRIPT_PLAYER_SUMMARY",
        ).length,
        fallbackSignalCount: expertSignals.filter(
          (signal) => signal.sourceType === "EXPERT_TAKE_FALLBACK",
        ).length,
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
          id: latestSignal.id,
          summary: latestSignal.summary,
          excerpt: latestSignal.excerpt,
          sentiment: latestSignal.stance,
          takeType: latestSignal.takeType,
          sourceTitle: latestSignal.sourceVideo.title,
          sourceUrl: latestSignal.sourceVideo.url,
          publishedAt: latestSignal.sourceVideo.publishedAt,
          createdAt: latestSignal.createdAt,
          sourceType: latestSignal.sourceType,
          evidenceCount: latestSignal.evidenceCount,
        },
      };
    })
    .sort(
      (expertA, expertB) =>
        expertB.trustWeight - expertA.trustWeight ||
        expertB.mentionCount - expertA.mentionCount ||
        expertB.evidenceCount - expertA.evidenceCount ||
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

function normalizeWeightedConsensusFilters(filters: WeightedConsensusFilters) {
  return {
    targetSeason: normalizeTargetSeason(filters.targetSeason),
    includeHistorical: Boolean(filters.includeHistorical),
    position: normalizeOptionalString(filters.position),
    team: normalizeOptionalString(filters.team),
    consensusLabel: undefined,
  };
}

function normalizeOptionalString(value?: string | null) {
  const trimmed = value?.trim();

  return trimmed ? trimmed : undefined;
}

function getLatestDate(dates: Array<Date | null>) {
  const latestTime = dates.reduce(
    (latest, date) => Math.max(latest, date?.getTime() ?? 0),
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
