import type {
  DecisionRecommendationType,
  DecisionScore,
  RecommendationAlternative,
  RecommendationEvidence,
  RiskFactor,
  SupportingFactor,
} from "@/decision-engine/decision-types";

export function buildRecommendationTitle({
  playerName,
  recommendationType,
}: {
  playerName: string;
  recommendationType: DecisionRecommendationType;
}) {
  return `${formatRecommendationType(recommendationType)} ${playerName}`;
}

export function buildRecommendationText({
  playerName,
  recommendationType,
}: {
  playerName: string;
  recommendationType: DecisionRecommendationType;
}) {
  if (recommendationType === "AVOID") {
    return `Avoid ${playerName} at current uncertainty.`;
  }
  if (recommendationType === "WAIT") {
    return `Wait on ${playerName} unless the price falls.`;
  }
  if (recommendationType === "HOLD") {
    return `Hold ${playerName} until the signal strengthens.`;
  }
  if (recommendationType === "VALUE") {
    return `${playerName} profiles as a value target.`;
  }

  return `${formatRecommendationType(recommendationType)} ${playerName}.`;
}

export function explainRecommendation({
  alternatives,
  decisionScore,
  recommendationType,
  riskFactors,
  supportingFactors,
}: {
  alternatives: RecommendationAlternative[];
  decisionScore: DecisionScore;
  recommendationType: DecisionRecommendationType;
  riskFactors: RiskFactor[];
  supportingFactors: SupportingFactor[];
}) {
  const supportText =
    supportingFactors.length > 0
      ? supportingFactors
          .slice(0, 4)
          .map((factor) => factor.explanation)
          .join(" ")
      : "The available intelligence does not create a strong positive edge yet.";
  const riskText =
    riskFactors.length > 0
      ? ` Main risk: ${riskFactors[0].explanation}`
      : " No major deterministic risk flags are present.";
  const alternativeText =
    alternatives.length > 0
      ? ` Reasonable alternatives: ${alternatives
          .slice(0, 3)
          .map((alternative) => alternative.playerName)
          .join(", ")}.`
      : "";

  return `${formatRecommendationType(
    recommendationType,
  )} recommendation with a Decision Score of ${decisionScore.score}. ${supportText}${riskText}${alternativeText}`;
}

export function summarizeEvidence(evidence: RecommendationEvidence[]) {
  if (evidence.length === 0) {
    return "No supporting evidence is available yet.";
  }

  return evidence
    .slice(0, 3)
    .map((item) => `${item.label}: ${item.summary}`)
    .join(" ");
}

export function formatRecommendationType(value: DecisionRecommendationType) {
  const labels: Record<DecisionRecommendationType, string> = {
    AVOID: "Avoid",
    BUY: "Buy",
    DRAFT: "Draft",
    HOLD: "Hold",
    REACH: "Reach",
    SELL: "Sell",
    SIT: "Sit",
    START: "Start",
    VALUE: "Value",
    WAIT: "Wait",
    WAIVER_ADD: "Waiver Add",
    WAIVER_HOLD: "Waiver Hold",
  };

  return labels[value];
}
