export type EvidenceQualityScore = number;

export type EvidenceQualityLabel =
  | "High Quality"
  | "Good Quality"
  | "Mixed Quality"
  | "Low Quality"
  | "Excluded";

export type EvidenceInclusionDecision =
  | "INCLUDE_PRIMARY"
  | "INCLUDE_SECONDARY"
  | "CAVEAT_ONLY"
  | "EXCLUDE";

export type EvidenceQualityWarning =
  | "NOT_APPROVED"
  | "SOURCE_EXCLUDED"
  | "STALE_SOURCE"
  | "ARCHIVED_SOURCE"
  | "LOW_ATTRIBUTION_CONFIDENCE"
  | "WEAK_SUMMARY_QUALITY"
  | "LOW_CONFIDENCE"
  | "LOW_EVIDENCE"
  | "CONFLICTING_EVIDENCE"
  | "TRANSCRIPT_ARTIFACT"
  | "AMBIGUOUS_PLAYER_SUBJECT"
  | "LOW_EXPERT_TRUST"
  | "AUTO_APPROVED_ONLY"
  | "FALLBACK_TAKE_ONLY";

export type EvidenceQualityInput = {
  id: string;
  evidenceType: "TRANSCRIPT_PLAYER_SUMMARY" | "EXPERT_TAKE_FALLBACK";
  reviewStatus?: string | null;
  confidence?: number | null;
  qualityScore?: number | null;
  qualityWarnings?: string[];
  qualityReasons?: string[];
  evidenceQualityLabel?: string | null;
  attributionQualityLabel?: string | null;
  summaryClarityLabel?: string | null;
  confidenceLabel?: string | null;
  evidenceCount?: number | null;
  mentionCount?: number | null;
  publishDate?: Date | null;
  sourcePublishedAt?: Date | null;
  freshnessLabel?: string | null;
  sourceFreshnessLabel?: string | null;
  includeInCurrentAnalysis?: boolean | null;
  sourceIncludeInCurrentAnalysis?: boolean | null;
  autoApprovedAt?: Date | null;
  manuallyReviewedAt?: Date | null;
  expertTrustScore?: number | null;
  sourceCount?: number | null;
};

export type EvidenceAuditTrail = {
  evidenceId: string;
  evidenceType: EvidenceQualityInput["evidenceType"];
  qualityScore: EvidenceQualityScore;
  qualityLabel: EvidenceQualityLabel;
  inclusionDecision: EvidenceInclusionDecision;
  warnings: EvidenceQualityWarning[];
  reasons: string[];
  shouldUseInPlayerThesis: boolean;
  canSupportPrimaryClaim: boolean;
  canSupportRisk: boolean;
  canAppearAsSupportingEvidence: boolean;
};

export type EvidenceQualitySummary = {
  includedEvidenceCount: number;
  primaryEvidenceCount: number;
  secondaryEvidenceCount: number;
  caveatOnlyEvidenceCount: number;
  limitedEvidenceCount: number;
  excludedEvidenceCount: number;
  averageQualityScore: number | null;
  qualityLabel: EvidenceQualityLabel;
  topWarnings: EvidenceQualityWarning[];
  summary: string;
};

export type SourceQualitySignal = {
  totalApprovedEvidence: number;
  autoApprovedCount: number;
  manuallyReviewedCount: number;
  averageQualityScore: number | null;
  staleEvidenceCount: number;
  excludedEvidenceCount: number;
  topWarnings: EvidenceQualityWarning[];
  qualityLabel: EvidenceQualityLabel;
  summary: string;
};

const SEVERE_WARNING_MAP: Record<string, EvidenceQualityWarning> = {
  AMBIGUOUS_ATTRIBUTION: "LOW_ATTRIBUTION_CONFIDENCE",
  COMPARISON_HEAVY_EVIDENCE: "AMBIGUOUS_PLAYER_SUBJECT",
  CONFLICTING_SENTIMENT: "CONFLICTING_EVIDENCE",
  GENERIC_OR_THIN_SUMMARY: "WEAK_SUMMARY_QUALITY",
  LOW_CONFIDENCE: "LOW_CONFIDENCE",
  LOW_EVIDENCE: "LOW_EVIDENCE",
  MIXED_OR_CONFLICTING_STANCE: "CONFLICTING_EVIDENCE",
  NO_CLEAR_SUBJECT_OPINION_LINK: "AMBIGUOUS_PLAYER_SUBJECT",
  NO_DIRECT_TAKE_EVIDENCE: "AMBIGUOUS_PLAYER_SUBJECT",
  PRIMARY_PLAYER_UNCERTAIN: "AMBIGUOUS_PLAYER_SUBJECT",
  PRONOUN_HEAVY_SEGMENT: "AMBIGUOUS_PLAYER_SUBJECT",
  SENTIMENT_MAY_APPLY_TO_ANOTHER_PLAYER: "AMBIGUOUS_PLAYER_SUBJECT",
  STALE_OR_EXCLUDED_SOURCE: "STALE_SOURCE",
  TIMESTAMP_CLEANUP_EVIDENCE: "TRANSCRIPT_ARTIFACT",
  TIMESTAMP_HEAVY_TRANSCRIPT_CLEANED: "TRANSCRIPT_ARTIFACT",
  UNCLEAR_PLAYER_SUBJECT: "AMBIGUOUS_PLAYER_SUBJECT",
};

const HARD_EXCLUSION_WARNINGS = new Set<EvidenceQualityWarning>([
  "NOT_APPROVED",
  "SOURCE_EXCLUDED",
  "ARCHIVED_SOURCE",
]);

const PRIMARY_BLOCKING_WARNINGS = new Set<EvidenceQualityWarning>([
  "AMBIGUOUS_PLAYER_SUBJECT",
  "CONFLICTING_EVIDENCE",
  "LOW_ATTRIBUTION_CONFIDENCE",
  "LOW_CONFIDENCE",
  "LOW_EVIDENCE",
  "STALE_SOURCE",
  "TRANSCRIPT_ARTIFACT",
  "WEAK_SUMMARY_QUALITY",
]);

export function evaluateEvidenceQuality(
  input: EvidenceQualityInput,
): EvidenceAuditTrail {
  const warnings = new Set<EvidenceQualityWarning>();
  const reasons: string[] = [];
  const reviewStatus = input.reviewStatus ?? "PENDING";
  const evidenceDate = input.publishDate ?? input.sourcePublishedAt ?? null;
  const freshnessLabel =
    input.freshnessLabel ?? input.sourceFreshnessLabel ?? null;
  const transcriptIncluded = input.includeInCurrentAnalysis;
  const sourceIncluded = input.sourceIncludeInCurrentAnalysis;
  const approved = reviewStatus === "APPROVED";
  const baseScore =
    typeof input.qualityScore === "number"
      ? input.qualityScore
      : Math.round((input.confidence ?? 0.5) * 100);
  let score = baseScore;

  if (!approved) {
    warnings.add("NOT_APPROVED");
    reasons.push("Evidence is not approved for decision use.");
  } else {
    reasons.push("Evidence has been approved for review workflow use.");
  }

  if (transcriptIncluded === false || sourceIncluded === false) {
    warnings.add("SOURCE_EXCLUDED");
    reasons.push("The transcript or source is excluded from current analysis.");
    score -= 35;
  }

  if (freshnessLabel === "ARCHIVED") {
    warnings.add("ARCHIVED_SOURCE");
    reasons.push("The source is archived and should not influence current draft decisions.");
    score -= 40;
  } else if (freshnessLabel === "STALE" || freshnessLabel === "HISTORICAL") {
    warnings.add("STALE_SOURCE");
    reasons.push("The source is stale or historical for the selected season.");
    score -= 18;
  } else if (freshnessLabel === "CURRENT" || freshnessLabel === "RECENT") {
    reasons.push("The source is fresh enough for the selected season.");
  }

  if (isOlderThanDays(evidenceDate, 90)) {
    warnings.add("STALE_SOURCE");
    score -= 8;
  }

  for (const warning of input.qualityWarnings ?? []) {
    const mappedWarning = SEVERE_WARNING_MAP[warning];

    if (mappedWarning) {
      warnings.add(mappedWarning);
    }
  }

  if (input.attributionQualityLabel?.toLowerCase().includes("weak")) {
    warnings.add("LOW_ATTRIBUTION_CONFIDENCE");
    score -= 18;
  }

  if (input.evidenceQualityLabel?.toLowerCase().includes("weak")) {
    warnings.add("WEAK_SUMMARY_QUALITY");
    score -= 14;
  }

  if (input.summaryClarityLabel?.toLowerCase().includes("weak")) {
    warnings.add("WEAK_SUMMARY_QUALITY");
    score -= 12;
  }

  if ((input.confidence ?? 0.5) < 0.55) {
    warnings.add("LOW_CONFIDENCE");
    score -= 12;
  }

  if ((input.evidenceCount ?? 0) < 2) {
    warnings.add("LOW_EVIDENCE");
    score -= 8;
  }

  if ((input.expertTrustScore ?? 50) < 40) {
    warnings.add("LOW_EXPERT_TRUST");
    score -= 8;
  }

  if (input.autoApprovedAt && !input.manuallyReviewedAt) {
    warnings.add("AUTO_APPROVED_ONLY");
    score -= 4;
  }

  if (input.evidenceType === "EXPERT_TAKE_FALLBACK") {
    warnings.add("FALLBACK_TAKE_ONLY");
    score -= 10;
  }

  if ((input.qualityWarnings ?? []).length > 0) {
    reasons.push("Quality reviewer warnings are attached.");
  }

  if ((input.qualityReasons ?? []).length > 0) {
    reasons.push(...(input.qualityReasons ?? []).slice(0, 3));
  }

  const qualityScore = clamp(Math.round(score), 0, 100);
  const warningList = Array.from(warnings);
  const inclusionDecision = getInclusionDecision({
    approved,
    freshnessLabel,
    qualityScore,
    warnings: warningList,
  });
  const qualityLabel = getEvidenceQualityLabel(qualityScore, inclusionDecision);
  const shouldUseInPlayerThesis = inclusionDecision !== "EXCLUDE";
  const canSupportPrimaryClaim = inclusionDecision === "INCLUDE_PRIMARY";
  const canSupportRisk = inclusionDecision !== "EXCLUDE";
  const canAppearAsSupportingEvidence =
    inclusionDecision === "INCLUDE_PRIMARY" ||
    inclusionDecision === "INCLUDE_SECONDARY";

  if (inclusionDecision === "INCLUDE_PRIMARY") {
    reasons.unshift("Evidence is strong enough to support a primary Draft Case claim.");
  } else if (inclusionDecision === "INCLUDE_SECONDARY") {
    reasons.unshift("Evidence can support the Draft Case, but should not be the headline reason.");
  } else if (inclusionDecision === "CAVEAT_ONLY") {
    reasons.unshift("Evidence is useful only as a caveat, warning, or secondary context.");
  } else {
    reasons.unshift("Evidence is excluded from Draft Case scoring.");
  }

  return {
    evidenceId: input.id,
    evidenceType: input.evidenceType,
    qualityScore,
    qualityLabel,
    inclusionDecision,
    warnings: warningList,
    reasons: dedupeStrings(reasons),
    shouldUseInPlayerThesis,
    canSupportPrimaryClaim,
    canSupportRisk,
    canAppearAsSupportingEvidence,
  };
}

export function calculateEvidenceQualitySummary(
  evaluations: EvidenceAuditTrail[],
): EvidenceQualitySummary {
  const included = evaluations.filter((item) => item.shouldUseInPlayerThesis);
  const primary = evaluations.filter(
    (item) => item.inclusionDecision === "INCLUDE_PRIMARY",
  );
  const secondary = evaluations.filter(
    (item) => item.inclusionDecision === "INCLUDE_SECONDARY",
  );
  const caveatOnly = evaluations.filter(
    (item) => item.inclusionDecision === "CAVEAT_ONLY",
  );
  const excluded = evaluations.filter(
    (item) => item.inclusionDecision === "EXCLUDE",
  );
  const limited = evaluations.filter(
    (item) =>
      item.qualityLabel === "Mixed Quality" ||
      item.qualityLabel === "Low Quality" ||
      item.inclusionDecision === "CAVEAT_ONLY",
  );
  const averageQualityScore =
    evaluations.length > 0
      ? Math.round(average(evaluations.map((item) => item.qualityScore)))
      : null;
  const qualityLabel = getSummaryQualityLabel({
    averageQualityScore,
    excludedCount: excluded.length,
    includedCount: included.length,
    primaryCount: primary.length,
    totalCount: evaluations.length,
  });
  const topWarnings = getTopWarnings(evaluations);

  return {
    includedEvidenceCount: included.length,
    primaryEvidenceCount: primary.length,
    secondaryEvidenceCount: secondary.length,
    caveatOnlyEvidenceCount: caveatOnly.length,
    limitedEvidenceCount: limited.length,
    excludedEvidenceCount: excluded.length,
    averageQualityScore,
    qualityLabel,
    topWarnings,
    summary: buildEvidenceQualitySummaryText({
      averageQualityScore,
      excludedCount: excluded.length,
      includedCount: included.length,
      limitedCount: limited.length,
      primaryCount: primary.length,
      qualityLabel,
      totalCount: evaluations.length,
    }),
  };
}

export function calculateSourceQualitySignal(
  inputs: EvidenceQualityInput[],
  evaluations: EvidenceAuditTrail[],
): SourceQualitySignal {
  const approvedInputs = inputs.filter((input) => input.reviewStatus === "APPROVED");
  const averageQualityScore =
    evaluations.length > 0
      ? Math.round(average(evaluations.map((item) => item.qualityScore)))
      : null;
  const staleEvidenceCount = inputs.filter((input) =>
    ["STALE", "HISTORICAL", "ARCHIVED"].includes(
      input.freshnessLabel ?? input.sourceFreshnessLabel ?? "",
    ),
  ).length;
  const excludedEvidenceCount = evaluations.filter(
    (item) => item.inclusionDecision === "EXCLUDE",
  ).length;
  const qualityLabel = getSummaryQualityLabel({
    averageQualityScore,
    excludedCount: excludedEvidenceCount,
    includedCount: evaluations.length - excludedEvidenceCount,
    primaryCount: evaluations.filter(
      (item) => item.inclusionDecision === "INCLUDE_PRIMARY",
    ).length,
    totalCount: evaluations.length,
  });

  return {
    totalApprovedEvidence: approvedInputs.length,
    autoApprovedCount: inputs.filter((input) => input.autoApprovedAt).length,
    manuallyReviewedCount: inputs.filter((input) => input.manuallyReviewedAt)
      .length,
    averageQualityScore,
    staleEvidenceCount,
    excludedEvidenceCount,
    topWarnings: getTopWarnings(evaluations),
    qualityLabel,
    summary: buildSourceQualitySummaryText({
      approvedCount: approvedInputs.length,
      averageQualityScore,
      excludedEvidenceCount,
      manuallyReviewedCount: inputs.filter((input) => input.manuallyReviewedAt)
        .length,
      qualityLabel,
      staleEvidenceCount,
    }),
  };
}

export function formatEvidenceInclusionDecision(
  decision: EvidenceInclusionDecision,
) {
  const labels: Record<EvidenceInclusionDecision, string> = {
    CAVEAT_ONLY: "Caveat only",
    EXCLUDE: "Excluded",
    INCLUDE_PRIMARY: "Primary Draft Case evidence",
    INCLUDE_SECONDARY: "Secondary Draft Case evidence",
  };

  return labels[decision];
}

export function formatEvidenceQualityWarning(warning: EvidenceQualityWarning) {
  const labels: Record<EvidenceQualityWarning, string> = {
    AMBIGUOUS_PLAYER_SUBJECT: "Ambiguous player subject",
    ARCHIVED_SOURCE: "Archived source",
    AUTO_APPROVED_ONLY: "Auto-approved only",
    CONFLICTING_EVIDENCE: "Conflicting evidence",
    FALLBACK_TAKE_ONLY: "Fallback take only",
    LOW_ATTRIBUTION_CONFIDENCE: "Low attribution confidence",
    LOW_CONFIDENCE: "Low confidence",
    LOW_EVIDENCE: "Low evidence",
    LOW_EXPERT_TRUST: "Low expert trust",
    NOT_APPROVED: "Not approved",
    SOURCE_EXCLUDED: "Source excluded",
    STALE_SOURCE: "Stale source",
    TRANSCRIPT_ARTIFACT: "Transcript artifact",
    WEAK_SUMMARY_QUALITY: "Weak summary quality",
  };

  return labels[warning];
}

function getInclusionDecision({
  approved,
  freshnessLabel,
  qualityScore,
  warnings,
}: {
  approved: boolean;
  freshnessLabel: string | null;
  qualityScore: number;
  warnings: EvidenceQualityWarning[];
}): EvidenceInclusionDecision {
  if (!approved) return "EXCLUDE";
  if (warnings.some((warning) => HARD_EXCLUSION_WARNINGS.has(warning))) {
    return "EXCLUDE";
  }
  if (qualityScore < 45) return "EXCLUDE";
  if (qualityScore < 58) return "CAVEAT_ONLY";
  if (
    freshnessLabel === "STALE" ||
    freshnessLabel === "HISTORICAL" ||
    warnings.includes("LOW_EXPERT_TRUST")
  ) {
    return "CAVEAT_ONLY";
  }
  if (
    qualityScore < 72 ||
    warnings.some((warning) => PRIMARY_BLOCKING_WARNINGS.has(warning))
  ) {
    return "INCLUDE_SECONDARY";
  }

  return "INCLUDE_PRIMARY";
}

function getEvidenceQualityLabel(
  score: number,
  decision: EvidenceInclusionDecision,
): EvidenceQualityLabel {
  if (decision === "EXCLUDE") return "Excluded";
  if (score >= 82 && decision === "INCLUDE_PRIMARY") return "High Quality";
  if (score >= 68) return "Good Quality";
  if (score >= 52) return "Mixed Quality";

  return "Low Quality";
}

function getSummaryQualityLabel({
  averageQualityScore,
  excludedCount,
  includedCount,
  primaryCount,
  totalCount,
}: {
  averageQualityScore: number | null;
  excludedCount: number;
  includedCount: number;
  primaryCount: number;
  totalCount: number;
}): EvidenceQualityLabel {
  if (totalCount === 0 || includedCount === 0) return "Excluded";
  if (
    averageQualityScore !== null &&
    averageQualityScore >= 82 &&
    primaryCount >= 2 &&
    excludedCount === 0
  ) {
    return "High Quality";
  }
  if (
    averageQualityScore !== null &&
    averageQualityScore >= 68 &&
    excludedCount <= includedCount
  ) {
    return "Good Quality";
  }
  if (averageQualityScore !== null && averageQualityScore >= 52) {
    return "Mixed Quality";
  }

  return "Low Quality";
}

function buildEvidenceQualitySummaryText({
  averageQualityScore,
  excludedCount,
  includedCount,
  limitedCount,
  primaryCount,
  qualityLabel,
  totalCount,
}: {
  averageQualityScore: number | null;
  excludedCount: number;
  includedCount: number;
  limitedCount: number;
  primaryCount: number;
  qualityLabel: EvidenceQualityLabel;
  totalCount: number;
}) {
  if (totalCount === 0) {
    return "No approved evidence has been evaluated for this Draft Case yet.";
  }
  if (qualityLabel === "High Quality") {
    return `Supported by strong recent evidence. ${primaryCount} item${
      primaryCount === 1 ? "" : "s"
    } can support primary claims.`;
  }
  if (qualityLabel === "Good Quality") {
    return `Supported by usable evidence. ${includedCount} item${
      includedCount === 1 ? "" : "s"
    } can inform the Draft Case.`;
  }
  if (qualityLabel === "Mixed Quality") {
    return `Evidence is still developing. ${limitedCount} item${
      limitedCount === 1 ? "" : "s"
    } should be treated as limited or secondary context.`;
  }
  if (qualityLabel === "Low Quality") {
    return `Draft Case is provisional. Average evidence quality is ${
      averageQualityScore ?? 0
    }/100.`;
  }

  return `Evidence is excluded from Draft Case scoring. ${excludedCount} item${
    excludedCount === 1 ? "" : "s"
  } failed quality or freshness checks.`;
}

function buildSourceQualitySummaryText({
  approvedCount,
  averageQualityScore,
  excludedEvidenceCount,
  manuallyReviewedCount,
  qualityLabel,
  staleEvidenceCount,
}: {
  approvedCount: number;
  averageQualityScore: number | null;
  excludedEvidenceCount: number;
  manuallyReviewedCount: number;
  qualityLabel: EvidenceQualityLabel;
  staleEvidenceCount: number;
}) {
  if (approvedCount === 0) {
    return "No approved source evidence is available yet.";
  }

  const reviewText =
    manuallyReviewedCount > 0
      ? `${manuallyReviewedCount} human-reviewed item${
          manuallyReviewedCount === 1 ? "" : "s"
        }`
      : "no human-reviewed items yet";
  const qualityText =
    averageQualityScore === null
      ? "no average quality score"
      : `${averageQualityScore}/100 average quality`;
  const concernText =
    excludedEvidenceCount > 0 || staleEvidenceCount > 0
      ? ` ${excludedEvidenceCount} excluded and ${staleEvidenceCount} stale item${
          staleEvidenceCount === 1 ? "" : "s"
        } are tracked.`
      : "";

  return `${qualityLabel} source quality from ${approvedCount} approved item${
    approvedCount === 1 ? "" : "s"
  }, ${reviewText}, and ${qualityText}.${concernText}`.trim();
}

function getTopWarnings(evaluations: EvidenceAuditTrail[]) {
  const counts = new Map<EvidenceQualityWarning, number>();

  for (const evaluation of evaluations) {
    for (const warning of evaluation.warnings) {
      counts.set(warning, (counts.get(warning) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .sort((warningA, warningB) => warningB[1] - warningA[1])
    .slice(0, 4)
    .map(([warning]) => warning);
}

function isOlderThanDays(value: Date | null, days: number) {
  if (!value) return true;

  return Date.now() - value.getTime() > days * 24 * 60 * 60 * 1000;
}

function average(values: number[]) {
  if (values.length === 0) return 0;

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function dedupeStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
