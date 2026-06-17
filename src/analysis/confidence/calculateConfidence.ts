export type RiskLabel = "Low" | "Medium" | "High";

export type RecommendationStrength = "Lean" | "Start" | "Strong Start";

export type MatchupConfidenceLabel = "Low" | "Medium" | "High";

export interface ProjectionConfidenceInput {
  projectedPoints?: number | null;
  floor?: number | null;
  median?: number | null;
  ceiling?: number | null;
  confidence?: number | null;
  hasProjection?: boolean;
}

export interface ProjectionConfidenceAnalysis {
  floor: number;
  ceiling: number;
  volatilityScore: number;
  upsideScore: number;
  downsideRisk: number;
  confidencePercentage: number;
  riskLabel: RiskLabel;
  recommendationStrength: RecommendationStrength;
}

export interface MatchupConfidenceInput {
  teamAProjectedTotal: number;
  teamBProjectedTotal: number;
  teamAConfidencePercentage?: number | null;
  teamBConfidencePercentage?: number | null;
  hasOpponent?: boolean;
}

export interface MatchupConfidenceAnalysis {
  projectedMargin: number | null;
  confidenceLabel: MatchupConfidenceLabel;
  estimatedWinProbability: number | null;
  isCloseMatchup: boolean;
}

export function calculateConfidenceScore({
  projectionVariance = 0,
  injuryRisk = 0,
  providerCount = 1,
}: {
  projectionVariance?: number;
  injuryRisk?: number;
  providerCount?: number;
}) {
  const providerBonus = Math.min(0.15, Math.max(0, providerCount - 1) * 0.075);
  const variancePenalty = Math.min(0.35, projectionVariance / 40);
  const injuryPenalty = Math.min(0.4, injuryRisk);

  return (
    Math.round((0.7 + providerBonus - variancePenalty - injuryPenalty) * 100) /
    100
  );
}

export function analyzeProjectionConfidence({
  projectedPoints,
  floor,
  median,
  ceiling,
  confidence,
  hasProjection,
}: ProjectionConfidenceInput): ProjectionConfidenceAnalysis {
  const projectionExists =
    hasProjection ??
    [projectedPoints, floor, median, ceiling, confidence].some(isUsableNumber);

  if (!projectionExists) {
    return {
      floor: 0,
      ceiling: 0,
      volatilityScore: 100,
      upsideScore: 0,
      downsideRisk: 0,
      confidencePercentage: 0,
      riskLabel: "High",
      recommendationStrength: "Lean",
    };
  }

  const projected = getNumber(projectedPoints ?? median, 0);
  const inferredFloor = Math.max(0, projected * 0.75);
  const inferredCeiling = projected * 1.25;
  const safeFloor = Math.min(
    getNumber(floor, inferredFloor),
    getNumber(ceiling, inferredCeiling),
  );
  const safeCeiling = Math.max(
    getNumber(floor, inferredFloor),
    getNumber(ceiling, inferredCeiling),
  );
  const spread = safeCeiling - safeFloor;
  const volatilityScore = round(
    clamp((spread / Math.max(projected, 1)) * 50, 0, 100),
  );
  const upsideScore = round(Math.max(0, safeCeiling - projected));
  const downsideRisk = round(Math.max(0, projected - safeFloor));
  const confidencePercentage = round(
    getConfidencePercentage(confidence, volatilityScore),
  );
  const riskLabel = getRiskLabel(volatilityScore, confidencePercentage);

  return {
    floor: round(safeFloor),
    ceiling: round(safeCeiling),
    volatilityScore,
    upsideScore,
    downsideRisk,
    confidencePercentage,
    riskLabel,
    recommendationStrength: getRecommendationStrength(
      projected,
      confidencePercentage,
      riskLabel,
    ),
  };
}

export function analyzeMatchupConfidence({
  teamAProjectedTotal,
  teamBProjectedTotal,
  teamAConfidencePercentage,
  teamBConfidencePercentage,
  hasOpponent = true,
}: MatchupConfidenceInput): MatchupConfidenceAnalysis {
  if (!hasOpponent) {
    return {
      projectedMargin: null,
      confidenceLabel: "Low",
      estimatedWinProbability: null,
      isCloseMatchup: false,
    };
  }

  const projectedMargin = round(
    Math.abs(teamAProjectedTotal - teamBProjectedTotal),
  );
  const averageConfidence = getAverageConfidence([
    teamAConfidencePercentage,
    teamBConfidencePercentage,
  ]);
  const marginComponent = clamp(projectedMargin * 6, 0, 35);
  const estimatedWinProbability = round(
    clamp(50 + marginComponent * (averageConfidence / 100), 50, 92),
  );

  return {
    projectedMargin,
    confidenceLabel: getMatchupConfidenceLabel(
      projectedMargin,
      estimatedWinProbability,
    ),
    estimatedWinProbability,
    isCloseMatchup: projectedMargin < 5,
  };
}

function getConfidencePercentage(
  confidence: number | null | undefined,
  volatilityScore: number,
) {
  if (isUsableNumber(confidence)) {
    return clamp(confidence <= 1 ? confidence * 100 : confidence, 0, 100);
  }

  return clamp(85 - volatilityScore * 0.45, 35, 85);
}

function getRiskLabel(
  volatilityScore: number,
  confidencePercentage: number,
): RiskLabel {
  if (volatilityScore <= 30 && confidencePercentage >= 70) return "Low";
  if (volatilityScore <= 60 && confidencePercentage >= 50) return "Medium";

  return "High";
}

function getRecommendationStrength(
  projectedPoints: number,
  confidencePercentage: number,
  riskLabel: RiskLabel,
): RecommendationStrength {
  if (
    projectedPoints >= 12 &&
    confidencePercentage >= 70 &&
    riskLabel !== "High"
  ) {
    return "Strong Start";
  }

  if (projectedPoints >= 6 && confidencePercentage >= 50) {
    return "Start";
  }

  return "Lean";
}

function getAverageConfidence(values: Array<number | null | undefined>) {
  const usableValues = values
    .filter(isUsableNumber)
    .map((value) => (value <= 1 ? value * 100 : value));

  if (usableValues.length === 0) return 50;

  return (
    usableValues.reduce((sum, value) => sum + value, 0) / usableValues.length
  );
}

function getMatchupConfidenceLabel(
  projectedMargin: number,
  estimatedWinProbability: number,
): MatchupConfidenceLabel {
  if (projectedMargin >= 10 && estimatedWinProbability >= 72) return "High";
  if (projectedMargin >= 5 && estimatedWinProbability >= 60) return "Medium";

  return "Low";
}

function getNumber(value: number | null | undefined, fallback: number) {
  return isUsableNumber(value) ? value : fallback;
}

function isUsableNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}
