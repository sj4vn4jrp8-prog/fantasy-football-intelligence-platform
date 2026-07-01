import { calculateDecisionScore } from "@/decision-engine/decision-score";
import {
  buildRecommendationText,
  buildRecommendationTitle,
  explainRecommendation,
  summarizeEvidence,
} from "@/decision-engine/recommendation-explainer";
import {
  analyzeDecisionRisk,
  buildDecisionWarnings,
} from "@/decision-engine/risk-analysis";
import type {
  DecisionRecommendation,
  DecisionRecommendationType,
  RecommendationAlternative,
  RecommendationEvidence,
  SupportingFactor,
} from "@/decision-engine/decision-types";
import type { getExpertConsensusDashboard } from "@/knowledge-brain/expert-consensus";
import type { ExpertPlayerMemory } from "@/knowledge-brain/expert-memory";
import type { getPlayerIntelligenceDirectory } from "@/knowledge-brain/player-intelligence";
import type { PlayerTrustProfile } from "@/knowledge-brain/trust-engine";
import type { getWeightedConsensusDashboard } from "@/knowledge-brain/weighted-consensus";

type PlayerIntelligenceRow = Awaited<
  ReturnType<typeof getPlayerIntelligenceDirectory>
>["players"][number];
type ConsensusRow = Awaited<
  ReturnType<typeof getExpertConsensusDashboard>
>["rows"][number];
type WeightedConsensusRow = Awaited<
  ReturnType<typeof getWeightedConsensusDashboard>
>["rows"][number];

export type RecommendationBuilderInput = {
  targetSeason: number;
  trustProfile: PlayerTrustProfile;
  playerIntelligence?: PlayerIntelligenceRow | null;
  expertMemories?: ExpertPlayerMemory[];
  consensus?: ConsensusRow | null;
  weightedConsensus?: WeightedConsensusRow | null;
};

const NEGATIVE_RECOMMENDATIONS = new Set<DecisionRecommendationType>([
  "AVOID",
  "SELL",
  "SIT",
]);

const CAUTION_RECOMMENDATIONS = new Set<DecisionRecommendationType>([
  "WAIT",
  "HOLD",
  "WAIVER_HOLD",
]);

export function buildDecisionRecommendation(
  input: RecommendationBuilderInput,
): DecisionRecommendation {
  const recommendationType = determineRecommendationType(input);
  const riskFactors = analyzeDecisionRisk({
    consensusAgreementScore: getConsensusAgreementScore({
      recommendationType,
      consensus: input.consensus,
      weightedConsensus: input.weightedConsensus,
    }),
    disagreementWarnings: input.trustProfile.disagreementWarnings,
    evidenceCount: input.trustProfile.evidenceCount,
    expertCount:
      input.weightedConsensus?.totalExperts ??
      input.consensus?.totalExperts ??
      input.playerIntelligence?.expertCount ??
      input.trustProfile.topSupportingExperts.length,
    expertMemoryWarnings: input.trustProfile.expertMemorySignal.warnings,
    lowSampleWarnings: input.trustProfile.lowSampleWarnings,
    qualityWarnings: input.trustProfile.qualityReviewSignal.warnings,
    snapshotDirection: input.trustProfile.snapshotMovementSignal.direction,
    trustScore: input.trustProfile.playerTrustScore,
  });
  const decisionScore = calculateDecisionScore({
    confidenceScore: getConfidenceScore(input),
    consensusAgreementScore: getConsensusAgreementScore({
      recommendationType,
      consensus: input.consensus,
      weightedConsensus: input.weightedConsensus,
    }),
    evidenceQualityScore: input.trustProfile.qualityReviewSignal.score,
    expertMemoryScore: getExpertMemoryDecisionScore({
      memories: input.expertMemories ?? [],
      recommendationType,
      fallbackScore: input.trustProfile.expertMemorySignal.score,
    }),
    playerIntelligenceScore: getPlayerIntelligenceDecisionScore({
      recommendationType,
      score: input.playerIntelligence?.intelligenceScore,
    }),
    recommendationType,
    riskFactors,
    trustScore: input.trustProfile.playerTrustScore,
    placeholderSignals: {
      adp: 50,
      injuryData: 50,
      leagueFit: 50,
      positionScarcity: 50,
      rosterFit: 50,
    },
  });
  const supportingFactors = buildSupportingFactors({
    ...input,
    recommendationType,
  });
  const evidence = buildEvidence(input);
  const recommendation: DecisionRecommendation = {
    id: [
      "decision",
      input.targetSeason,
      recommendationType.toLowerCase(),
      input.trustProfile.playerId,
    ].join(":"),
    alternatives: [],
    context: {
      mode: "DEVELOPMENT_PREVIEW",
      source: "DECISION_ENGINE",
      targetSeason: input.targetSeason,
    },
    decisionScore,
    evidence,
    evidenceSummary: summarizeEvidence(evidence),
    explanation: "",
    generatedAt: new Date(),
    recommendation: buildRecommendationText({
      playerName: input.trustProfile.playerName,
      recommendationType,
    }),
    riskFactors,
    subject: {
      playerId: input.trustProfile.playerId,
      playerName: input.trustProfile.playerName,
      position: input.trustProfile.position,
      team: input.trustProfile.team,
    },
    supportingFactors,
    title: buildRecommendationTitle({
      playerName: input.trustProfile.playerName,
      recommendationType,
    }),
    type: recommendationType,
    warnings: buildDecisionWarnings(riskFactors),
  };

  return {
    ...recommendation,
    explanation: explainRecommendation({
      alternatives: [],
      decisionScore,
      recommendationType,
      riskFactors,
      supportingFactors,
    }),
  };
}

export function attachRecommendationAlternatives(
  recommendations: DecisionRecommendation[],
) {
  return recommendations.map((recommendation) => {
    const alternatives = getRecommendationAlternatives(
      recommendation,
      recommendations,
    );

    return {
      ...recommendation,
      alternatives,
      explanation: explainRecommendation({
        alternatives,
        decisionScore: recommendation.decisionScore,
        recommendationType: recommendation.type,
        riskFactors: recommendation.riskFactors,
        supportingFactors: recommendation.supportingFactors,
      }),
    };
  });
}

function determineRecommendationType({
  consensus,
  expertMemories = [],
  playerIntelligence,
  trustProfile,
  weightedConsensus,
}: RecommendationBuilderInput): DecisionRecommendationType {
  const bullishSignals = [
    trustProfile.stanceSummary === "Bullish",
    playerIntelligence?.intelligenceLabel.includes("Bullish") ?? false,
    consensus?.consensusLabel.includes("Bullish") ?? false,
    weightedConsensus?.weightedConsensusLabel.includes("Bullish") ?? false,
    expertMemories.some((memory) => memory.memory.currentStance === "BULLISH"),
    trustProfile.snapshotMovementSignal.direction === "UP",
  ].filter(Boolean).length;
  const bearishSignals = [
    trustProfile.stanceSummary === "Bearish",
    playerIntelligence?.intelligenceLabel.includes("Bearish") ?? false,
    consensus?.consensusLabel.includes("Bearish") ?? false,
    weightedConsensus?.weightedConsensusLabel.includes("Bearish") ?? false,
    expertMemories.some((memory) => memory.memory.currentStance === "BEARISH"),
    trustProfile.snapshotMovementSignal.direction === "DOWN",
  ].filter(Boolean).length;
  const isDivisive =
    trustProfile.stanceSummary === "Mixed" ||
    trustProfile.disagreementWarnings.length > 0 ||
    consensus?.consensusLabel === "Split" ||
    weightedConsensus?.weightedConsensusLabel === "Mixed / Divisive";
  const lowSample =
    trustProfile.lowSampleWarnings.length > 0 ||
    (consensus ? consensus.totalExperts < 2 || consensus.totalMentions < 3 : true);

  if (bearishSignals >= 3 && trustProfile.playerTrustScore >= 55) {
    return "AVOID";
  }
  if (bearishSignals > bullishSignals && trustProfile.playerTrustScore < 55) {
    return "WAIT";
  }
  if (bullishSignals >= 4 && trustProfile.playerTrustScore >= 72 && !isDivisive) {
    return "DRAFT";
  }
  if (bullishSignals >= 3 && trustProfile.playerTrustScore >= 58) {
    return "VALUE";
  }
  if (isDivisive || lowSample) {
    return "WAIT";
  }
  if (trustProfile.playerTrustScore >= 55) {
    return "HOLD";
  }

  return "WAIT";
}

function buildSupportingFactors({
  consensus,
  expertMemories = [],
  playerIntelligence,
  recommendationType,
  trustProfile,
  weightedConsensus,
}: RecommendationBuilderInput & {
  recommendationType: DecisionRecommendationType;
}): SupportingFactor[] {
  const factors: SupportingFactor[] = [
    {
      key: "trust-score",
      label: "Trust Score",
      value: trustProfile.playerTrustScore,
      direction: trustProfile.playerTrustScore >= 60 ? "POSITIVE" : "NEUTRAL",
      explanation: `Trust Score is ${trustProfile.playerTrustScore}, with ${trustProfile.confidenceLabel.toLowerCase()} confidence and ${trustProfile.sampleSizeLabel.toLowerCase()}.`,
    },
    {
      key: "evidence-quality",
      label: "Evidence Quality",
      value: trustProfile.qualityReviewSignal.score,
      direction:
        trustProfile.qualityReviewSignal.score >= 65 ? "POSITIVE" : "NEUTRAL",
      explanation: trustProfile.qualityReviewSignal.explanation,
    },
    {
      key: "future-context-placeholders",
      label: "Future Context",
      value: "Neutral",
      direction: "NEUTRAL",
      explanation:
        "ADP, league scoring, roster construction, position scarcity, bye weeks, user preferences, and injury data are reserved as neutral future inputs.",
    },
  ];

  if (playerIntelligence) {
    factors.push({
      key: "player-intelligence",
      label: "Player Intelligence",
      value: playerIntelligence.intelligenceLabel,
      direction: recommendationAlignsWithLabel(
        recommendationType,
        playerIntelligence.intelligenceLabel,
      )
        ? "POSITIVE"
        : "NEUTRAL",
      explanation: `${playerIntelligence.fullName} has ${playerIntelligence.totalMentions} current mention signal(s), ${playerIntelligence.expertCount} expert(s), and a ${playerIntelligence.intelligenceLabel.toLowerCase()} intelligence label.`,
    });
  }

  if (weightedConsensus) {
    factors.push({
      key: "weighted-consensus",
      label: "Weighted Consensus",
      value: weightedConsensus.weightedConsensusLabel,
      direction: recommendationAlignsWithLabel(
        recommendationType,
        weightedConsensus.weightedConsensusLabel,
      )
        ? "POSITIVE"
        : "NEUTRAL",
      explanation: `${weightedConsensus.totalExperts} expert(s) contribute to weighted consensus with ${weightedConsensus.weightedAgreementScore}% weighted agreement.`,
    });
  } else if (consensus) {
    factors.push({
      key: "raw-consensus",
      label: "Raw Consensus",
      value: consensus.consensusLabel,
      direction: recommendationAlignsWithLabel(
        recommendationType,
        consensus.consensusLabel,
      )
        ? "POSITIVE"
        : "NEUTRAL",
      explanation: `${consensus.totalExperts} expert(s) contribute to raw consensus with ${consensus.agreementScore}% agreement.`,
    });
  }

  if (expertMemories.length > 0) {
    const strongestMemory = [...expertMemories].sort(
      (memoryA, memoryB) =>
        memoryB.memory.convictionScore - memoryA.memory.convictionScore,
    )[0];

    factors.push({
      key: "expert-memory",
      label: "Expert Memory",
      value: strongestMemory.memory.opinionTrend,
      direction: recommendationAlignsWithStance(
        recommendationType,
        strongestMemory.memory.currentStance,
      )
        ? "POSITIVE"
        : "NEUTRAL",
      explanation: `${strongestMemory.expertName} has a ${strongestMemory.memory.convictionLabel.toLowerCase()} conviction memory on ${strongestMemory.playerName}: ${strongestMemory.memory.opinionTrend}.`,
    });
  }

  if (trustProfile.snapshotMovementSignal.direction !== "NO_HISTORY") {
    factors.push({
      key: "snapshot-movement",
      label: "Snapshot Movement",
      value: trustProfile.snapshotMovementSignal.label,
      direction:
        trustProfile.snapshotMovementSignal.direction === "UP"
          ? "POSITIVE"
          : "NEUTRAL",
      explanation: trustProfile.snapshotMovementSignal.explanation,
    });
  }

  return factors;
}

function buildEvidence({
  consensus,
  trustProfile,
  weightedConsensus,
}: RecommendationBuilderInput): RecommendationEvidence[] {
  const evidence: RecommendationEvidence[] = [];

  trustProfile.evidencePointers.slice(0, 4).forEach((pointer) => {
    evidence.push({
      label: pointer.expertName,
      publishedAt: pointer.publishedAt,
      source: pointer.sourceTitle,
      summary: pointer.excerpt,
    });
  });

  trustProfile.topSupportingExperts.slice(0, 3).forEach((expert) => {
    evidence.push({
      label: `${expert.expertName} ${expert.stance.toLowerCase()}`,
      source: "Player Trust Profile",
      summary: expert.latestSummary,
    });
  });

  if (weightedConsensus?.latestTake) {
    evidence.push({
      label: weightedConsensus.latestTake.expertName,
      publishedAt: weightedConsensus.latestTake.publishDate,
      source: weightedConsensus.latestTake.sourceTitle,
      summary: weightedConsensus.latestTake.summary,
      url: weightedConsensus.latestTake.sourceUrl,
    });
  } else if (consensus?.latestTake) {
    evidence.push({
      label: consensus.latestTake.expertName,
      publishedAt: consensus.latestTake.publishDate,
      source: consensus.latestTake.sourceTitle,
      summary: consensus.latestTake.summary,
      url: consensus.latestTake.sourceUrl,
    });
  }

  return dedupeEvidence(evidence).slice(0, 8);
}

function getRecommendationAlternatives(
  recommendation: DecisionRecommendation,
  recommendations: DecisionRecommendation[],
): RecommendationAlternative[] {
  return recommendations
    .filter((candidate) => candidate.subject.playerId !== recommendation.subject.playerId)
    .filter((candidate) => candidate.subject.position === recommendation.subject.position)
    .filter(
      (candidate) =>
        candidate.type === recommendation.type ||
        (isPositiveRecommendation(candidate.type) &&
          isPositiveRecommendation(recommendation.type)),
    )
    .sort(
      (candidateA, candidateB) =>
        candidateB.decisionScore.score - candidateA.decisionScore.score,
    )
    .slice(0, 3)
    .map((candidate) => ({
      decisionScore: candidate.decisionScore.score,
      playerId: candidate.subject.playerId,
      playerName: candidate.subject.playerName,
      position: candidate.subject.position,
      recommendationType: candidate.type,
      reason: `${candidate.subject.playerName} is another ${candidate.subject.position} with a ${candidate.decisionScore.score} Decision Score.`,
      team: candidate.subject.team,
    }));
}

function getPlayerIntelligenceDecisionScore({
  recommendationType,
  score,
}: {
  recommendationType: DecisionRecommendationType;
  score?: number;
}) {
  const normalizedScore = score ?? 50;

  if (NEGATIVE_RECOMMENDATIONS.has(recommendationType)) {
    return 100 - normalizedScore;
  }
  if (CAUTION_RECOMMENDATIONS.has(recommendationType)) {
    return Math.max(50, Math.abs(normalizedScore - 50) + 50);
  }

  return normalizedScore;
}

function getExpertMemoryDecisionScore({
  fallbackScore,
  memories,
  recommendationType,
}: {
  fallbackScore: number;
  memories: ExpertPlayerMemory[];
  recommendationType: DecisionRecommendationType;
}) {
  if (memories.length === 0) return fallbackScore || 50;

  return average(
    memories.map((memory) => {
      if (
        recommendationAlignsWithStance(
          recommendationType,
          memory.memory.currentStance,
        )
      ) {
        return memory.memory.convictionScore;
      }
      if (memory.memory.currentStance === "MIXED") return 52;
      if (memory.memory.currentStance === "NEUTRAL") return 50;

      return Math.max(25, 100 - memory.memory.convictionScore);
    }),
  );
}

function getConsensusAgreementScore({
  consensus,
  recommendationType,
  weightedConsensus,
}: {
  consensus?: ConsensusRow | null;
  recommendationType: DecisionRecommendationType;
  weightedConsensus?: WeightedConsensusRow | null;
}) {
  if (weightedConsensus) {
    if (
      recommendationAlignsWithLabel(
        recommendationType,
        weightedConsensus.weightedConsensusLabel,
      )
    ) {
      return weightedConsensus.weightedAgreementScore;
    }
    if (weightedConsensus.weightedConsensusLabel === "Mixed / Divisive") {
      return CAUTION_RECOMMENDATIONS.has(recommendationType) ? 68 : 42;
    }
    if (weightedConsensus.weightedConsensusLabel === "Not Enough Trusted Data") {
      return 45;
    }

    return Math.max(35, 100 - weightedConsensus.weightedAgreementScore);
  }

  if (consensus) {
    if (recommendationAlignsWithLabel(recommendationType, consensus.consensusLabel)) {
      return consensus.agreementScore;
    }
    if (consensus.consensusLabel === "Split") {
      return CAUTION_RECOMMENDATIONS.has(recommendationType) ? 68 : 42;
    }
    if (consensus.consensusLabel === "Not Enough Data") {
      return 45;
    }

    return Math.max(35, 100 - consensus.agreementScore);
  }

  return 50;
}

function getConfidenceScore({
  trustProfile,
  weightedConsensus,
}: RecommendationBuilderInput) {
  const labelScore =
    trustProfile.confidenceLabel === "High"
      ? 82
      : trustProfile.confidenceLabel === "Medium"
        ? 64
        : 42;
  const evidenceBonus = Math.min(12, trustProfile.evidenceCount * 2);
  const weightedConfidenceBonus = weightedConsensus
    ? Math.round(weightedConsensus.trustWeightedConfidence * 0.12)
    : 0;

  return clamp(labelScore + evidenceBonus + weightedConfidenceBonus, 0, 100);
}

function recommendationAlignsWithLabel(
  recommendationType: DecisionRecommendationType,
  label: string,
) {
  if (NEGATIVE_RECOMMENDATIONS.has(recommendationType)) {
    return label.includes("Bearish") || label.includes("Avoid");
  }
  if (CAUTION_RECOMMENDATIONS.has(recommendationType)) {
    return (
      label.includes("Split") ||
      label.includes("Mixed") ||
      label.includes("Not Enough") ||
      label.includes("Neutral")
    );
  }

  return label.includes("Bullish") || label.includes("Trusted Bullish");
}

function recommendationAlignsWithStance(
  recommendationType: DecisionRecommendationType,
  stance: "BULLISH" | "BEARISH" | "MIXED" | "NEUTRAL",
) {
  if (NEGATIVE_RECOMMENDATIONS.has(recommendationType)) {
    return stance === "BEARISH";
  }
  if (CAUTION_RECOMMENDATIONS.has(recommendationType)) {
    return stance === "MIXED" || stance === "NEUTRAL";
  }

  return stance === "BULLISH";
}

function isPositiveRecommendation(recommendationType: DecisionRecommendationType) {
  return (
    !NEGATIVE_RECOMMENDATIONS.has(recommendationType) &&
    !CAUTION_RECOMMENDATIONS.has(recommendationType)
  );
}

function dedupeEvidence(evidence: RecommendationEvidence[]) {
  const seen = new Set<string>();

  return evidence.filter((item) => {
    const key = [item.source, item.label, item.summary].join(":");
    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

function average(values: number[]) {
  if (values.length === 0) return 50;

  return Math.round(
    values.reduce((total, value) => total + value, 0) / values.length,
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
