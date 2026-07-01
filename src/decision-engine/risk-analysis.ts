import type { RiskFactor } from "@/decision-engine/decision-types";

export type DecisionRiskInput = {
  disagreementWarnings: string[];
  lowSampleWarnings: string[];
  expertMemoryWarnings: string[];
  qualityWarnings: string[];
  trustScore: number;
  evidenceCount: number;
  expertCount: number;
  consensusAgreementScore: number;
  snapshotDirection?: "UP" | "DOWN" | "UNCHANGED" | "NEW" | "NO_HISTORY";
};

export function analyzeDecisionRisk(input: DecisionRiskInput): RiskFactor[] {
  const risks: RiskFactor[] = [];

  if (input.evidenceCount < 3 || input.expertCount < 2) {
    risks.push({
      key: "small-sample",
      label: "Small evidence sample",
      value: `${input.evidenceCount} evidence point${input.evidenceCount === 1 ? "" : "s"}, ${input.expertCount} expert${input.expertCount === 1 ? "" : "s"}`,
      direction: "RISK",
      severity: input.evidenceCount < 2 || input.expertCount < 2 ? "High" : "Medium",
      explanation:
        "The recommendation can be wrong if the player has not been discussed by enough reliable sources yet.",
    });
  }

  if (input.consensusAgreementScore < 55) {
    risks.push({
      key: "expert-disagreement",
      label: "Expert disagreement",
      value: `${input.consensusAgreementScore}% agreement`,
      direction: "RISK",
      severity: input.consensusAgreementScore < 45 ? "High" : "Medium",
      explanation:
        "The recommendation can be wrong if the expert market remains split or the apparent edge is not broadly supported.",
    });
  }

  if (input.trustScore < 55) {
    risks.push({
      key: "low-trust",
      label: "Low trust foundation",
      value: input.trustScore,
      direction: "RISK",
      severity: input.trustScore < 45 ? "High" : "Medium",
      explanation:
        "The recommendation is fragile because the underlying Trust Score is not strong yet.",
    });
  }

  if (input.expertMemoryWarnings.length > 0) {
    risks.push({
      key: "volatile-memory",
      label: "Volatile expert memory",
      value: input.expertMemoryWarnings.length,
      direction: "RISK",
      severity: "Medium",
      explanation:
        input.expertMemoryWarnings[0] ??
        "Expert Memory has warnings that can make this recommendation less stable.",
    });
  }

  if (input.qualityWarnings.length > 0) {
    risks.push({
      key: "evidence-quality-warning",
      label: "Evidence quality warning",
      value: input.qualityWarnings.length,
      direction: "RISK",
      severity: input.qualityWarnings.length >= 3 ? "High" : "Medium",
      explanation:
        input.qualityWarnings[0] ??
        "Quality review warnings can reduce confidence in this recommendation.",
    });
  }

  if (input.snapshotDirection === "DOWN") {
    risks.push({
      key: "declining-trust",
      label: "Declining trust movement",
      value: "Down",
      direction: "RISK",
      severity: "Medium",
      explanation:
        "Recent persisted Trust snapshots indicate the player signal has weakened.",
    });
  }

  input.disagreementWarnings.slice(0, 2).forEach((warning, index) => {
    risks.push({
      key: `disagreement-warning-${index + 1}`,
      label: "Disagreement warning",
      value: "Warning",
      direction: "RISK",
      severity: "Medium",
      explanation: warning,
    });
  });

  input.lowSampleWarnings.slice(0, 2).forEach((warning, index) => {
    risks.push({
      key: `low-sample-warning-${index + 1}`,
      label: "Low-sample warning",
      value: "Warning",
      direction: "RISK",
      severity: "Medium",
      explanation: warning,
    });
  });

  return dedupeRisks(risks).slice(0, 6);
}

export function buildDecisionWarnings(riskFactors: RiskFactor[]) {
  return riskFactors
    .filter((risk) => risk.severity !== "Low")
    .map((risk) => ({
      key: risk.key,
      label: risk.label,
      severity: risk.severity,
      message: risk.explanation,
    }));
}

function dedupeRisks(risks: RiskFactor[]) {
  const seen = new Set<string>();

  return risks.filter((risk) => {
    if (seen.has(risk.key)) return false;

    seen.add(risk.key);
    return true;
  });
}
