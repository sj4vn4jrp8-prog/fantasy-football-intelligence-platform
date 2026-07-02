import { getPlayerExpertConsensusBreakdown } from "@/knowledge-brain/expert-consensus";
import { getExpertMemoriesForPlayer } from "@/knowledge-brain/expert-memory";
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
  confidence: number;
  excerpt: string;
};

export type PlayerThesisClaim = {
  id: string;
  label: string;
  description: string;
  strength: "Strong" | "Moderate" | "Limited";
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
  const evidence = [
    ...summaries.map(mapSummaryToEvidence),
    ...approvedFallbackTakes.map(mapTakeToEvidence),
  ].sort(sortEvidenceByDate);
  const evidenceCount = summaries.reduce(
    (sum, summary) => sum + Math.max(1, summary.evidenceCount),
    0,
  ) + approvedFallbackTakes.length;
  const sourceCount = countSources(evidence);
  const latestEvidenceDate = getLatestDate(
    evidence.map((item) => item.publishedAt),
  );
  const sourceBreakdown = buildSourceBreakdown(summaries, approvedFallbackTakes);
  const currentStance = getCurrentStance({
    trustProfile,
    consensusLabel: consensus.row?.consensusLabel,
    weightedConsensusLabel: weightedConsensus.row?.weightedConsensusLabel,
    summaries,
    fallbackTakes: approvedFallbackTakes,
  });
  const trendDirection = getTrendDirection({
    memoryTrends: memories.map((memory) => memory.memory.opinionTrend),
    snapshotDirection: trustProfile?.snapshotMovementSignal.direction,
  });
  const strongestSupportingClaims = buildSupportingClaims(summaries, evidence);
  const strongestRisks = buildRisks({
    summaries,
    fallbackTakes: approvedFallbackTakes,
    evidence,
    trustProfile,
  });
  const confidence = buildConfidence({
    trustProfile,
    summaries,
    fallbackTakes: approvedFallbackTakes,
    evidenceCount,
    sourceCount,
    consensusLabel: consensus.row?.consensusLabel,
    latestEvidenceDate,
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
    agreementSummary: expertAgreementSummary,
  });
  const thesisHeadline = buildThesisHeadline({
    playerName: player.fullName,
    stance: currentStance,
    posture: draftRecommendationPosture,
    trendDirection,
  });
  const thesisSummary = buildThesisSummary({
    playerName: player.fullName,
    stance: currentStance,
    posture: draftRecommendationPosture,
    topClaim: strongestSupportingClaims[0] ?? null,
    topRisk: strongestRisks[0] ?? null,
    expertAgreementSummary,
    confidence,
  });
  const warnings = dedupeStrings([
    ...confidence.warnings,
    ...getThesisWarnings({
      evidenceCount,
      sourceCount,
      summaries,
      consensusLabel: consensus.row?.consensusLabel,
      latestEvidenceDate,
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

function mapSummaryToEvidence(summary: ThesisSummary): PlayerThesisEvidence {
  return {
    id: summary.id,
    sourceType: "TRANSCRIPT_PLAYER_SUMMARY",
    expertName: summary.expert.name,
    sourceTitle: summary.sourceVideo.title,
    sourceUrl: summary.sourceVideo.url,
    publishedAt: summary.transcript.publishDate ?? summary.sourceVideo.publishedAt,
    stance: summary.stance,
    qualityScore: summary.qualityScore ?? null,
    confidence: summary.confidence,
    excerpt:
      summary.evidence[0]?.excerpt ??
      summary.summary,
  };
}

function mapTakeToEvidence(take: ThesisFallbackTake): PlayerThesisEvidence {
  return {
    id: take.id,
    sourceType: "EXPERT_TAKE_FALLBACK",
    expertName: take.expert.name,
    sourceTitle: take.sourceVideo.title,
    sourceUrl: take.sourceVideo.url,
    publishedAt: take.transcript?.publishDate ?? take.sourceVideo.publishedAt,
    stance: take.sentiment,
    qualityScore: null,
    confidence: take.confidence,
    excerpt: take.excerpt || take.summary,
  };
}

function buildSupportingClaims(
  summaries: ThesisSummary[],
  evidence: PlayerThesisEvidence[],
): PlayerThesisClaim[] {
  const claimEvidence = summaries
    .filter((summary) => summary.stance === "BULLISH" || summary.stance === "MIXED")
    .flatMap((summary) =>
      getHighQualityThemes(summary.primaryThemes, summary).map((theme) => ({
        theme,
        summary,
        evidence: mapSummaryToEvidence(summary),
      })),
    );
  const claims = buildThemeClaims(claimEvidence).slice(0, 4);

  if (claims.length > 0) return claims;

  const fallbackEvidence = evidence
    .filter((item) => item.stance === "BULLISH" || item.stance === "MIXED")
    .slice(0, 2);

  return fallbackEvidence.map((item) => ({
    id: `support-${item.id}`,
    label: "Positive expert support",
    description: item.excerpt,
    strength: item.confidence >= 0.75 ? "Moderate" : "Limited",
    evidenceCount: 1,
    sourceCount: 1,
    qualityScore: Math.round(item.confidence * 100),
    supportingEvidence: [item],
  }));
}

function buildThemeClaims(items: ThemeEvidence[]): PlayerThesisClaim[] {
  const byTheme = groupBy(items, (item) => normalizeKey(item.theme));

  return Array.from(byTheme.entries())
    .map(([key, themeItems]) => {
      const supportingEvidence = themeItems
        .map((item) => item.evidence)
        .sort(sortEvidenceByDate)
        .slice(0, 3);
      const qualityScore = averageQuality(themeItems.map((item) => item.summary));

      return {
        id: `claim-${key}`,
        label: formatThemeLabel(themeItems[0]?.theme ?? key),
        description: buildClaimDescription(themeItems[0]?.theme ?? key, themeItems),
        strength: getClaimStrength({
          evidenceCount: themeItems.length,
          sourceCount: countSources(supportingEvidence),
          qualityScore,
        }),
        evidenceCount: themeItems.length,
        sourceCount: countSources(supportingEvidence),
        qualityScore,
        supportingEvidence,
      } satisfies PlayerThesisClaim;
    })
    .sort(
      (claimA, claimB) =>
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
}: {
  summaries: ThesisSummary[];
  fallbackTakes: ThesisFallbackTake[];
  evidence: PlayerThesisEvidence[];
  trustProfile: PlayerTrustProfile | null;
}): PlayerThesisRisk[] {
  const caveatItems = summaries.flatMap((summary) =>
    summary.importantCaveats.map((theme) => ({
      theme,
      summary,
      evidence: mapSummaryToEvidence(summary),
    })),
  );
  const bearishItems = summaries
    .filter((summary) => summary.stance === "BEARISH")
    .flatMap((summary) =>
      [...summary.primaryThemes, "bearish expert concern"].map((theme) => ({
        theme,
        summary,
        evidence: mapSummaryToEvidence(summary),
      })),
    );
  const themeRisks = buildThemeRisks([...caveatItems, ...bearishItems]);
  const fallbackRisks = fallbackTakes
    .filter((take) => take.sentiment === "BEARISH")
    .slice(0, 2)
    .map((take) => {
      const item = mapTakeToEvidence(take);

      return {
        id: `risk-${take.id}`,
        label: "Bearish expert concern",
        description: item.excerpt,
        severity: take.confidence >= 0.7 ? "Medium" : "Low",
        evidenceCount: 1,
        sourceCount: 1,
        supportingEvidence: [item],
      } satisfies PlayerThesisRisk;
    });
  const warningRisks =
    trustProfile?.disagreementWarnings.slice(0, 1).map((warning, index) => ({
      id: `risk-trust-warning-${index}`,
      label: "Expert disagreement",
      description: warning,
      severity: "Medium" as const,
      evidenceCount: trustProfile.evidenceCount,
      sourceCount: trustProfile.topSupportingExperts.length,
      supportingEvidence: evidence.slice(0, 2),
    })) ?? [];

  return [...themeRisks, ...fallbackRisks, ...warningRisks].slice(0, 4);
}

function buildThemeRisks(items: ThemeEvidence[]): PlayerThesisRisk[] {
  const byTheme = groupBy(items, (item) => normalizeKey(item.theme));

  return Array.from(byTheme.entries())
    .map(([key, themeItems]) => {
      const supportingEvidence = themeItems
        .map((item) => item.evidence)
        .sort(sortEvidenceByDate)
        .slice(0, 3);
      const qualityScore = averageQuality(themeItems.map((item) => item.summary));

      return {
        id: `risk-${key}`,
        label: formatThemeLabel(themeItems[0]?.theme ?? key),
        description: buildRiskDescription(themeItems[0]?.theme ?? key, themeItems),
        severity:
          themeItems.length >= 3 || qualityScore >= 80
            ? "High"
            : themeItems.length >= 2 || qualityScore >= 65
              ? "Medium"
              : "Low",
        evidenceCount: themeItems.length,
        sourceCount: countSources(supportingEvidence),
        supportingEvidence,
      } satisfies PlayerThesisRisk;
    })
    .sort(
      (riskA, riskB) =>
        getRiskScore(riskB.severity) - getRiskScore(riskA.severity) ||
        riskB.evidenceCount - riskA.evidenceCount,
    );
}

function getHighQualityThemes(themes: string[], summary: ThesisSummary) {
  if (!isHighQualitySummary(summary)) return [];

  return themes.filter((theme) => theme.trim().length > 0).slice(0, 5);
}

function isHighQualitySummary(summary: ThesisSummary) {
  const qualityScore = summary.qualityScore ?? Math.round(summary.confidence * 100);
  const attributionLabel = summary.attributionQualityLabel?.toLowerCase() ?? "";

  return (
    summary.reviewStatus === "APPROVED" &&
    qualityScore >= 60 &&
    summary.confidence >= 0.5 &&
    !attributionLabel.includes("low")
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
}: {
  trustProfile: PlayerTrustProfile | null;
  summaries: ThesisSummary[];
  fallbackTakes: ThesisFallbackTake[];
  evidenceCount: number;
  sourceCount: number;
  consensusLabel?: string | null;
  latestEvidenceDate: Date | null;
}): PlayerThesisConfidence {
  const averageSummaryQuality = averageQuality(summaries);
  const fallbackPenalty = fallbackTakes.length > 0 && summaries.length === 0 ? 12 : 0;
  const sourceScore = Math.min(20, sourceCount * 6);
  const evidenceScore = Math.min(20, evidenceCount * 3);
  const trustScore = trustProfile?.playerTrustScore ?? 50;
  const qualityScore = summaries.length > 0 ? averageSummaryQuality : 55;
  const recencyScore = getRecencyScore(latestEvidenceDate);
  const disagreementPenalty =
    consensusLabel === "Split" || consensusLabel === "Not Enough Data" ? 8 : 0;
  const score = clamp(
    Math.round(
      trustScore * 0.35 +
        qualityScore * 0.25 +
        sourceScore +
        evidenceScore +
        recencyScore -
        fallbackPenalty -
        disagreementPenalty,
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
  });

  return {
    label,
    score,
    explanation: `${label} recommendation confidence from ${evidenceCount} approved evidence item${
      evidenceCount === 1 ? "" : "s"
    }, ${sourceCount} source${sourceCount === 1 ? "" : "s"}, trust score ${
      trustProfile?.playerTrustScore ?? "not yet available"
    }, and current-season recency.`,
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
}: {
  summaries: ThesisSummary[];
  fallbackTakes: ThesisFallbackTake[];
  evidenceCount: number;
  sourceCount: number;
  consensusLabel?: string | null;
  latestEvidenceDate: Date | null;
  label: PlayerThesisConfidenceLabel;
}) {
  const warnings: string[] = [];
  const hasLowAttribution = summaries.some((summary) =>
    (summary.attributionQualityLabel ?? "").toLowerCase().includes("low"),
  );
  const onlyFallback = fallbackTakes.length > 0 && summaries.length === 0;

  if (evidenceCount < 3 || sourceCount < 2) {
    warnings.push("Limited approved evidence.");
  }
  if (consensusLabel === "Split") {
    warnings.push("Expert opinion is mixed.");
  }
  if (isOlderThanDays(latestEvidenceDate, 30)) {
    warnings.push("Recent intelligence is sparse.");
  }
  if (hasLowAttribution || onlyFallback) {
    warnings.push("Transcript attribution confidence is low.");
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
}: {
  evidenceCount: number;
  sourceCount: number;
  summaries: ThesisSummary[];
  consensusLabel?: string | null;
  latestEvidenceDate: Date | null;
}) {
  const warnings: string[] = [];

  if (evidenceCount < 3 || sourceCount < 2) {
    warnings.push("Limited approved evidence.");
  }
  if (consensusLabel === "Split") {
    warnings.push("Expert opinion is mixed.");
  }
  if (isOlderThanDays(latestEvidenceDate, 30)) {
    warnings.push("Recent intelligence is sparse.");
  }
  if (
    summaries.some((summary) =>
      (summary.attributionQualityLabel ?? "").toLowerCase().includes("low"),
    )
  ) {
    warnings.push("Transcript attribution confidence is low.");
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
}: {
  stance: PlayerThesisStance;
  confidence: PlayerThesisConfidence;
  trustScore: number | null;
  agreementSummary: string;
}): PlayerThesisPosture {
  if (stance === "Bullish" && confidence.score >= 75) return "Draft Target";
  if (stance === "Bullish") return "Value Target";
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
}: {
  playerName: string;
  stance: PlayerThesisStance;
  posture: PlayerThesisPosture;
  trendDirection: PlayerThesisTrend;
}) {
  if (stance === "Bullish") {
    return `${playerName} has a ${posture.toLowerCase()} case${
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
  expertAgreementSummary,
  confidence,
}: {
  playerName: string;
  stance: PlayerThesisStance;
  posture: PlayerThesisPosture;
  topClaim: PlayerThesisClaim | null;
  topRisk: PlayerThesisRisk | null;
  expertAgreementSummary: string;
  confidence: PlayerThesisConfidence;
}) {
  const claimText = topClaim
    ? `The strongest support is ${topClaim.label.toLowerCase()}.`
    : "The current support is still thin.";
  const riskText = topRisk
    ? `The main concern is ${topRisk.label.toLowerCase()}.`
    : "No single dominant risk has emerged from approved evidence.";

  return `${playerName} currently grades as ${stance.toLowerCase()} with a ${posture.toLowerCase()} posture. ${claimText} ${riskText} ${expertAgreementSummary} Recommendation confidence is ${confidence.label.toLowerCase()}.`;
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

function buildClaimDescription(theme: string, items: ThemeEvidence[]) {
  const experts = Array.from(new Set(items.map((item) => item.summary.expert.name)));
  const expertText =
    experts.length === 1
      ? experts[0]
      : `${experts.length} expert sources`;

  return `${expertText} connected this player to ${formatThemeLabel(
    theme,
  ).toLowerCase()} in approved current-scope evidence.`;
}

function buildRiskDescription(theme: string, items: ThemeEvidence[]) {
  const experts = Array.from(new Set(items.map((item) => item.summary.expert.name)));
  const expertText =
    experts.length === 1
      ? experts[0]
      : `${experts.length} expert sources`;

  return `${expertText} flagged ${formatThemeLabel(
    theme,
  ).toLowerCase()} as a caveat or downside factor.`;
}

function formatThemeLabel(theme: string) {
  const normalizedTheme = theme.trim().replace(/[-_]+/g, " ");

  if (!normalizedTheme) return "General expert support";

  return normalizedTheme
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function getClaimStrength({
  evidenceCount,
  sourceCount,
  qualityScore,
}: {
  evidenceCount: number;
  sourceCount: number;
  qualityScore: number;
}): PlayerThesisClaim["strength"] {
  if (evidenceCount >= 3 && sourceCount >= 2 && qualityScore >= 75) {
    return "Strong";
  }
  if (evidenceCount >= 2 || qualityScore >= 65) return "Moderate";

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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
