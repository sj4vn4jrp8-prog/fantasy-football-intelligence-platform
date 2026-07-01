import type {
  DecisionRecommendationType,
  DecisionScore,
  DecisionScoreComponent,
  RecommendationConfidence,
  RecommendationStrength,
  RiskFactor,
} from "@/decision-engine/decision-types";

export type DecisionScoreInput = {
  recommendationType: DecisionRecommendationType;
  trustScore: number;
  playerIntelligenceScore: number;
  expertMemoryScore: number;
  consensusAgreementScore: number;
  evidenceQualityScore: number;
  confidenceScore: number;
  riskFactors: RiskFactor[];
  placeholderSignals?: {
    adp?: number | null;
    leagueFit?: number | null;
    rosterFit?: number | null;
    positionScarcity?: number | null;
    injuryData?: number | null;
  };
};

const COMPONENT_WEIGHTS = {
  trustScore: 0.26,
  playerIntelligence: 0.18,
  expertMemory: 0.14,
  consensusAgreement: 0.12,
  evidenceQuality: 0.12,
  confidence: 0.08,
  futureContext: 0.1,
};

export function calculateDecisionScore(input: DecisionScoreInput): DecisionScore {
  const futureContextScore = average([
    input.placeholderSignals?.adp ?? 50,
    input.placeholderSignals?.leagueFit ?? 50,
    input.placeholderSignals?.rosterFit ?? 50,
    input.placeholderSignals?.positionScarcity ?? 50,
    input.placeholderSignals?.injuryData ?? 50,
  ]);
  const components: DecisionScoreComponent[] = [
    makeComponent({
      key: "trustScore",
      label: "Trust Score",
      rawValue: input.trustScore,
      weight: COMPONENT_WEIGHTS.trustScore,
      explanation:
        "Trust Score measures how reliable the underlying intelligence appears.",
    }),
    makeComponent({
      key: "playerIntelligence",
      label: "Player Intelligence",
      rawValue: input.playerIntelligenceScore,
      weight: COMPONENT_WEIGHTS.playerIntelligence,
      explanation:
        "Player Intelligence measures the direction and strength of expert discussion.",
    }),
    makeComponent({
      key: "expertMemory",
      label: "Expert Memory",
      rawValue: input.expertMemoryScore,
      weight: COMPONENT_WEIGHTS.expertMemory,
      explanation:
        "Expert Memory rewards stable or strengthening conviction over time.",
    }),
    makeComponent({
      key: "consensusAgreement",
      label: "Expert Agreement",
      rawValue: input.consensusAgreementScore,
      weight: COMPONENT_WEIGHTS.consensusAgreement,
      explanation:
        "Expert agreement raises recommendation strength when multiple sources align.",
    }),
    makeComponent({
      key: "evidenceQuality",
      label: "Evidence Quality",
      rawValue: input.evidenceQualityScore,
      weight: COMPONENT_WEIGHTS.evidenceQuality,
      explanation:
        "Evidence quality protects the recommendation from thin or ambiguous inputs.",
    }),
    makeComponent({
      key: "confidence",
      label: "Confidence",
      rawValue: input.confidenceScore,
      weight: COMPONENT_WEIGHTS.confidence,
      explanation:
        "Confidence combines sample size, extraction confidence, and trust confidence.",
    }),
    makeComponent({
      key: "futureContext",
      label: "Future Context",
      rawValue: futureContextScore,
      weight: COMPONENT_WEIGHTS.futureContext,
      explanation:
        "ADP, league fit, roster fit, positional scarcity, and injury data are neutral placeholders until future command centers provide them.",
    }),
  ];
  const riskPenalty = calculateRiskPenalty(input.riskFactors);
  const rawScore =
    components.reduce((total, component) => total + component.weightedValue, 0) -
    riskPenalty;
  const score = clamp(Math.round(rawScore), 0, 100);

  return {
    score,
    confidence: getDecisionConfidence({
      confidenceScore: input.confidenceScore,
      riskFactors: input.riskFactors,
      score,
    }),
    strength: getRecommendationStrength({
      recommendationType: input.recommendationType,
      riskFactors: input.riskFactors,
      score,
    }),
    scoreLabel: getDecisionScoreLabel(score),
    components,
  };
}

function makeComponent({
  key,
  label,
  rawValue,
  weight,
  explanation,
}: {
  key: string;
  label: string;
  rawValue: number;
  weight: number;
  explanation: string;
}): DecisionScoreComponent {
  const normalizedValue = clamp(Math.round(rawValue), 0, 100);

  return {
    key,
    label,
    rawValue: normalizedValue,
    weight,
    weightedValue: normalizedValue * weight,
    explanation,
  };
}

function calculateRiskPenalty(riskFactors: RiskFactor[]) {
  return riskFactors.reduce((total, risk) => {
    if (risk.severity === "High") return total + 10;
    if (risk.severity === "Medium") return total + 6;

    return total + 2;
  }, 0);
}

function getDecisionConfidence({
  confidenceScore,
  riskFactors,
  score,
}: {
  confidenceScore: number;
  riskFactors: RiskFactor[];
  score: number;
}): RecommendationConfidence {
  const highRiskCount = riskFactors.filter((risk) => risk.severity === "High")
    .length;

  if (score >= 75 && confidenceScore >= 70 && highRiskCount === 0) return "High";
  if (score >= 55 && confidenceScore >= 50 && highRiskCount <= 1) return "Medium";

  return "Low";
}

function getRecommendationStrength({
  recommendationType,
  riskFactors,
  score,
}: {
  recommendationType: DecisionRecommendationType;
  riskFactors: RiskFactor[];
  score: number;
}): RecommendationStrength {
  if (recommendationType === "AVOID" || recommendationType === "SIT") {
    return score >= 70 ? "Avoid" : "Watch";
  }

  const highRiskCount = riskFactors.filter((risk) => risk.severity === "High")
    .length;

  if (score >= 85 && highRiskCount === 0) return "Strong Recommend";
  if (score >= 72) return "Recommend";
  if (score >= 58) return "Lean";

  return "Watch";
}

function getDecisionScoreLabel(score: number) {
  if (score >= 85) return "Strong decision edge";
  if (score >= 72) return "Positive decision edge";
  if (score >= 58) return "Lean positive";
  if (score >= 42) return "Unclear edge";

  return "Negative decision edge";
}

function average(values: number[]) {
  if (values.length === 0) return 50;

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
