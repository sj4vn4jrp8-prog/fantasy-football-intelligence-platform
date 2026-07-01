export type SummaryReviewStatus =
  | "APPROVED"
  | "PENDING"
  | "NEEDS_EDIT"
  | "DISMISSED";

export type SummaryStance = "BULLISH" | "BEARISH" | "MIXED" | "NEUTRAL";

export type QualityReviewerMode = "DETERMINISTIC" | "AI_ASSISTED" | "MANUAL";

export type QualityLabel = "Strong" | "Adequate" | "Thin" | "Weak";

export type QualityReviewInput = {
  confidence: number;
  stance: SummaryStance;
  summary: string;
  primaryThemes: string[];
  importantCaveats: string[];
  takeTypes: string[];
  comparisonPlayerIds: string[];
  mentionCount: number;
  evidenceCount: number;
  evidence: Array<{
    evidenceType: string;
    excerpt: string;
  }>;
  transcript?: {
    freshnessLabel?: string | null;
    includeInCurrentAnalysis?: boolean | null;
  } | null;
  sourceVideo?: {
    freshnessLabel?: string | null;
    includeInCurrentAnalysis?: boolean | null;
  } | null;
};

export type QualityReviewResult = {
  qualityScore: number;
  autoApprovalEligible: boolean;
  recommendedReviewStatus: SummaryReviewStatus;
  reasons: string[];
  warnings: string[];
  evidenceQualityLabel: QualityLabel;
  attributionQualityLabel: QualityLabel;
  summaryClarityLabel: QualityLabel;
  confidenceLabel: QualityLabel;
  reviewerMode: QualityReviewerMode;
};

const SEVERE_WARNINGS = new Set([
  "STALE_OR_EXCLUDED_SOURCE",
  "NO_DIRECT_TAKE_EVIDENCE",
  "LOW_CONFIDENCE",
  "GENERIC_OR_THIN_SUMMARY",
  "LOW_EVIDENCE",
  "UNCLEAR_PLAYER_SUBJECT",
]);

export function reviewTranscriptPlayerSummaryDeterministically(
  input: QualityReviewInput,
): QualityReviewResult {
  const reasons: string[] = [];
  const warnings: string[] = [];
  let score = 50;

  const sourceIncluded = isIncludedForCurrentAnalysis(input);
  const hasClearStance = input.stance === "BULLISH" || input.stance === "BEARISH";
  const hasDirectTakeEvidence = input.evidence.some(
    (evidence) => evidence.evidenceType === "EXPERT_TAKE",
  );
  const hasSubstantiveSummary = isSubstantiveSummary(input.summary);
  const hasTimestampNoise = input.evidence.some((evidence) =>
    looksTimestampHeavy(evidence.excerpt),
  );
  const hasContextOnlyWarning = includesAny(input.importantCaveats, [
    "context-only",
    "pronoun-heavy",
    "comparison",
  ]);
  const hasConflictingSentiment =
    input.stance === "MIXED" ||
    includesAny(input.importantCaveats, ["both bullish and bearish"]);

  score += clamp(input.confidence * 35, 0, 35);
  score += Math.min(14, input.evidenceCount * 4);
  score += Math.min(10, input.mentionCount * 2);
  score += hasClearStance ? 8 : input.stance === "MIXED" ? 2 : -6;
  score += hasDirectTakeEvidence ? 8 : -10;
  score += sourceIncluded ? 8 : -20;
  score += input.primaryThemes.length > 0 ? 4 : -4;
  score += input.takeTypes.length > 0 ? 4 : -2;
  score += hasSubstantiveSummary ? 6 : -16;

  if (input.evidenceCount >= 3) {
    reasons.push("Three or more evidence rows support the summary.");
  } else if (input.evidenceCount >= 2) {
    reasons.push("Multiple evidence rows support the summary.");
  } else {
    warnings.push("LOW_EVIDENCE");
    score -= 10;
  }

  if (input.mentionCount >= 2) {
    reasons.push("The player appears multiple times in the transcript.");
  } else {
    warnings.push("LOW_MENTION_COUNT");
    score -= 4;
  }

  if (hasClearStance) {
    reasons.push("The summary has a clear bullish or bearish stance.");
  } else if (input.stance === "MIXED") {
    warnings.push("MIXED_OR_CONFLICTING_STANCE");
    score -= 12;
  } else {
    warnings.push("NEUTRAL_WITHOUT_CLEAR_TAKE");
    score -= 8;
  }

  if (hasDirectTakeEvidence) {
    reasons.push("At least one extracted expert take supports the summary.");
  } else {
    warnings.push("NO_DIRECT_TAKE_EVIDENCE");
  }

  if (!sourceIncluded) {
    warnings.push("STALE_OR_EXCLUDED_SOURCE");
  }

  if (input.confidence >= 0.75) {
    reasons.push("The deterministic extraction confidence is high.");
  } else if (input.confidence < 0.55) {
    warnings.push("LOW_CONFIDENCE");
    score -= 10;
  }

  if (hasContextOnlyWarning) {
    warnings.push("AMBIGUOUS_ATTRIBUTION");
    score -= 8;
  }

  if (hasConflictingSentiment) {
    warnings.push("CONFLICTING_SENTIMENT");
  }

  if (input.comparisonPlayerIds.length > 0) {
    warnings.push("COMPARISON_HEAVY_EVIDENCE");
    score -= 4;
  }

  if (hasTimestampNoise) {
    warnings.push("TIMESTAMP_CLEANUP_EVIDENCE");
    score -= 5;
  }

  if (!hasSubstantiveSummary) {
    warnings.push("GENERIC_OR_THIN_SUMMARY");
  }

  if (!hasClearStance && !hasDirectTakeEvidence) {
    warnings.push("UNCLEAR_PLAYER_SUBJECT");
  }

  const dedupedWarnings = Array.from(new Set(warnings));
  const qualityScore = Math.round(clamp(score, 0, 100));
  const evidenceQualityLabel = getEvidenceQualityLabel(input);
  const attributionQualityLabel = getAttributionQualityLabel({
    sourceIncluded,
    hasDirectTakeEvidence,
    hasContextOnlyWarning,
    comparisonPlayerIds: input.comparisonPlayerIds,
  });
  const summaryClarityLabel = getSummaryClarityLabel({
    hasSubstantiveSummary,
    hasClearStance,
    hasConflictingSentiment,
  });
  const confidenceLabel = getConfidenceQualityLabel(input.confidence);
  const autoApprovalEligible =
    qualityScore >= 85 &&
    input.confidence >= 0.72 &&
    input.evidenceCount >= 2 &&
    input.mentionCount >= 2 &&
    hasClearStance &&
    sourceIncluded &&
    hasSubstantiveSummary &&
    hasDirectTakeEvidence &&
    !hasSevereWarning(dedupedWarnings);
  const recommendedReviewStatus = getRecommendedStatus({
    autoApprovalEligible,
    qualityScore,
    warnings: dedupedWarnings,
    hasSubstantiveSummary,
  });

  return {
    qualityScore,
    autoApprovalEligible,
    recommendedReviewStatus,
    reasons: reasons.length > 0 ? reasons : ["Summary was reviewed deterministically."],
    warnings: dedupedWarnings,
    evidenceQualityLabel,
    attributionQualityLabel,
    summaryClarityLabel,
    confidenceLabel,
    reviewerMode: "DETERMINISTIC",
  };
}

export async function reviewTranscriptPlayerSummaryWithAiHook(
  input: QualityReviewInput,
): Promise<QualityReviewResult> {
  return reviewTranscriptPlayerSummaryDeterministically(input);
}

function getRecommendedStatus({
  autoApprovalEligible,
  qualityScore,
  warnings,
  hasSubstantiveSummary,
}: {
  autoApprovalEligible: boolean;
  qualityScore: number;
  warnings: string[];
  hasSubstantiveSummary: boolean;
}): SummaryReviewStatus {
  if (autoApprovalEligible) return "APPROVED";
  if (!hasSubstantiveSummary && qualityScore < 35) return "DISMISSED";
  if (qualityScore < 55 || hasSevereWarning(warnings)) return "NEEDS_EDIT";

  return "PENDING";
}

function getEvidenceQualityLabel(input: QualityReviewInput): QualityLabel {
  if (input.evidenceCount >= 4 && input.mentionCount >= 4) return "Strong";
  if (input.evidenceCount >= 2 && input.mentionCount >= 2) return "Adequate";
  if (input.evidenceCount >= 1 || input.mentionCount >= 1) return "Thin";

  return "Weak";
}

function getAttributionQualityLabel({
  sourceIncluded,
  hasDirectTakeEvidence,
  hasContextOnlyWarning,
  comparisonPlayerIds,
}: {
  sourceIncluded: boolean;
  hasDirectTakeEvidence: boolean;
  hasContextOnlyWarning: boolean;
  comparisonPlayerIds: string[];
}): QualityLabel {
  if (!sourceIncluded || !hasDirectTakeEvidence) return "Weak";
  if (hasContextOnlyWarning || comparisonPlayerIds.length > 0) return "Thin";

  return "Strong";
}

function getSummaryClarityLabel({
  hasSubstantiveSummary,
  hasClearStance,
  hasConflictingSentiment,
}: {
  hasSubstantiveSummary: boolean;
  hasClearStance: boolean;
  hasConflictingSentiment: boolean;
}): QualityLabel {
  if (!hasSubstantiveSummary) return "Weak";
  if (hasClearStance && !hasConflictingSentiment) return "Strong";
  if (hasConflictingSentiment) return "Thin";

  return "Adequate";
}

function getConfidenceQualityLabel(confidence: number): QualityLabel {
  if (confidence >= 0.75) return "Strong";
  if (confidence >= 0.62) return "Adequate";
  if (confidence >= 0.5) return "Thin";

  return "Weak";
}

function isIncludedForCurrentAnalysis(input: QualityReviewInput) {
  const transcriptIncluded = input.transcript?.includeInCurrentAnalysis;
  const sourceIncluded = input.sourceVideo?.includeInCurrentAnalysis;
  const transcriptFreshness = input.transcript?.freshnessLabel;
  const sourceFreshness = input.sourceVideo?.freshnessLabel;

  if (transcriptIncluded === false || sourceIncluded === false) return false;
  if (transcriptFreshness === "ARCHIVED" || sourceFreshness === "ARCHIVED") {
    return false;
  }

  return true;
}

function isSubstantiveSummary(summary: string) {
  const normalized = summary.trim();

  if (normalized.length < 90) return false;
  if (!normalized.includes("based on")) return false;
  if (/^(unknown|no summary|summary unavailable)$/i.test(normalized)) return false;

  return true;
}

function looksTimestampHeavy(value: string) {
  const timestampMatches = value.match(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g) ?? [];

  return timestampMatches.length >= 3;
}

function includesAny(values: string[], needles: string[]) {
  const joined = values.join(" ").toLowerCase();

  return needles.some((needle) => joined.includes(needle));
}

function hasSevereWarning(warnings: string[]) {
  return warnings.some((warning) => SEVERE_WARNINGS.has(warning));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
