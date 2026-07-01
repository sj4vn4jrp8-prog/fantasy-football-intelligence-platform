import { generateIntelligenceSnapshotsForPlayers } from "@/knowledge-brain/intelligence-snapshots";
import { reviewTranscriptPlayerSummaryDeterministically } from "@/knowledge-brain/quality-reviewer";
import { trimExcerpt } from "@/knowledge-brain/transcript-extraction";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

const REPLACEABLE_REVIEW_STATUSES = [
  "PENDING",
  "NEEDS_EDIT",
  "DISMISSED",
] as const;

const MAX_EVIDENCE_PER_SUMMARY = 8;

const MENTION_SUMMARY_INCLUDE = {
  player: {
    select: {
      id: true,
      fullName: true,
      position: true,
      team: true,
    },
  },
  expertTake: {
    select: {
      id: true,
      sourceSegmentId: true,
    },
  },
} satisfies Prisma.PlayerMentionInclude;

const TAKE_SUMMARY_INCLUDE = {
  player: {
    select: {
      id: true,
      fullName: true,
      position: true,
      team: true,
    },
  },
  sourceSegment: {
    select: {
      id: true,
    },
  },
} satisfies Prisma.ExpertTakeInclude;

type MentionForSummary = Prisma.PlayerMentionGetPayload<{
  include: typeof MENTION_SUMMARY_INCLUDE;
}>;

type TakeForSummary = Prisma.ExpertTakeGetPayload<{
  include: typeof TAKE_SUMMARY_INCLUDE;
}>;

export async function regenerateTranscriptPlayerSummaries(transcriptId: string) {
  const transcript = await db.transcript.findUnique({
    where: { id: transcriptId },
    include: {
      sourceVideo: {
        select: {
          expertId: true,
          id: true,
          freshnessLabel: true,
          includeInCurrentAnalysis: true,
        },
      },
    },
  });

  if (!transcript) {
    throw new Error("Transcript was not found for summary generation.");
  }

  await db.transcriptPlayerSummary.deleteMany({
    where: {
      transcriptId,
      reviewStatus: {
        in: [...REPLACEABLE_REVIEW_STATUSES],
      },
    },
  });

  const [mentions, takes, approvedSummaryPlayerIds] = await Promise.all([
    db.playerMention.findMany({
      where: { transcriptId },
      include: MENTION_SUMMARY_INCLUDE,
      orderBy: { createdAt: "asc" },
    }),
    db.expertTake.findMany({
      where: { transcriptId },
      include: TAKE_SUMMARY_INCLUDE,
      orderBy: { createdAt: "asc" },
    }),
    db.transcriptPlayerSummary.findMany({
      where: {
        transcriptId,
        reviewStatus: "APPROVED",
      },
      select: {
        playerId: true,
      },
    }),
  ]);
  const approvedPlayers = new Set(
    approvedSummaryPlayerIds.map((summary) => summary.playerId),
  );
  const summaries = groupTranscriptEvidenceByPlayer({
    mentions,
    takes,
  });
  let summariesCreated = 0;
  let approvedSummariesPreserved = 0;
  let autoApprovedSummaries = 0;
  let summariesNeedingHumanReview = 0;

  for (const summary of summaries) {
    if (approvedPlayers.has(summary.player.id)) {
      approvedSummariesPreserved += 1;
      continue;
    }

    const qualityReview = reviewTranscriptPlayerSummaryDeterministically({
      confidence: summary.confidence,
      stance: summary.stance,
      summary: summary.summary,
      primaryThemes: summary.primaryThemes,
      importantCaveats: summary.importantCaveats,
      takeTypes: summary.takeTypes,
      comparisonPlayerIds: summary.comparisonPlayerIds,
      mentionCount: summary.mentionCount,
      evidenceCount: summary.evidence.length,
      evidence: summary.evidence.map((evidence) => ({
        evidenceType: evidence.evidenceType,
        excerpt: evidence.excerpt,
      })),
      transcript: {
        freshnessLabel: transcript.freshnessLabel,
        includeInCurrentAnalysis: transcript.includeInCurrentAnalysis,
      },
      sourceVideo: {
        freshnessLabel: transcript.sourceVideo.freshnessLabel,
        includeInCurrentAnalysis: transcript.sourceVideo.includeInCurrentAnalysis,
      },
    });
    const reviewedAt =
      qualityReview.recommendedReviewStatus === "APPROVED" ? new Date() : null;

    await db.transcriptPlayerSummary.create({
      data: {
        transcriptId,
        sourceVideoId: transcript.sourceVideoId,
        expertId: transcript.sourceVideo.expertId,
        playerId: summary.player.id,
        stance: summary.stance,
        confidence: summary.confidence,
        summary: summary.summary,
        primaryThemes: summary.primaryThemes,
        importantCaveats: summary.importantCaveats,
        takeTypes: summary.takeTypes,
        comparisonPlayerIds: summary.comparisonPlayerIds,
        mentionCount: summary.mentionCount,
        evidenceCount: summary.evidence.length,
        reviewStatus: qualityReview.recommendedReviewStatus,
        reviewedAt,
        qualityScore: qualityReview.qualityScore,
        qualityReviewerMode: qualityReview.reviewerMode,
        qualityReasons: qualityReview.reasons,
        qualityWarnings: qualityReview.warnings,
        evidenceQualityLabel: qualityReview.evidenceQualityLabel,
        attributionQualityLabel: qualityReview.attributionQualityLabel,
        summaryClarityLabel: qualityReview.summaryClarityLabel,
        confidenceLabel: qualityReview.confidenceLabel,
        qualityReviewedAt: new Date(),
        autoApprovedAt: qualityReview.autoApprovalEligible ? reviewedAt : null,
        evidence: {
          create: summary.evidence.map((evidence) => ({
            expertTakeId: evidence.expertTakeId,
            playerMentionId: evidence.playerMentionId,
            transcriptSegmentId: evidence.transcriptSegmentId,
            evidenceType: evidence.evidenceType,
            excerpt: evidence.excerpt,
          })),
        },
      },
    });
    summariesCreated += 1;

    if (qualityReview.autoApprovalEligible) {
      autoApprovedSummaries += 1;
    } else {
      summariesNeedingHumanReview += 1;
    }
  }

  await generateIntelligenceSnapshotsForPlayers({
    playerIds: summaries.map((summary) => summary.player.id),
    expertIds: [transcript.sourceVideo.expertId],
    contentSeason: transcript.contentSeason,
    generationType:
      autoApprovedSummaries > 0 ? "AUTO_APPROVAL" : "QUALITY_REVIEW",
    reason: "Transcript player summaries generated after deterministic quality review.",
  });

  return {
    transcriptId,
    summariesCreated,
    approvedSummariesPreserved,
    autoApprovedSummaries,
    summariesNeedingHumanReview,
    playersDiscussed: summaries.length,
  };
}

function groupTranscriptEvidenceByPlayer({
  mentions,
  takes,
}: {
  mentions: MentionForSummary[];
  takes: TakeForSummary[];
}) {
  const grouped = new Map<
    string,
    {
      player: {
        id: string;
        fullName: string;
        position: string;
        team: string | null;
      };
      mentions: MentionForSummary[];
      takes: TakeForSummary[];
    }
  >();

  for (const mention of mentions) {
    const existing = grouped.get(mention.playerId);

    grouped.set(mention.playerId, {
      player: mention.player,
      mentions: [...(existing?.mentions ?? []), mention],
      takes: existing?.takes ?? [],
    });
  }

  for (const take of takes) {
    if (!take.player) continue;

    const existing = grouped.get(take.player.id);

    grouped.set(take.player.id, {
      player: take.player,
      mentions: existing?.mentions ?? [],
      takes: [...(existing?.takes ?? []), take],
    });
  }

  const allMentionedPlayerIds = new Set(
    Array.from(grouped.keys()).filter(Boolean),
  );

  return Array.from(grouped.values())
    .map((group) =>
      buildTranscriptPlayerSummary({
        ...group,
        allMentionedPlayerIds,
      }),
    )
    .sort(
      (summaryA, summaryB) =>
        summaryB.mentionCount - summaryA.mentionCount ||
        summaryA.player.fullName.localeCompare(summaryB.player.fullName),
    );
}

function buildTranscriptPlayerSummary({
  player,
  mentions,
  takes,
  allMentionedPlayerIds,
}: {
  player: {
    id: string;
    fullName: string;
    position: string;
    team: string | null;
  };
  mentions: MentionForSummary[];
  takes: TakeForSummary[];
  allMentionedPlayerIds: Set<string>;
}) {
  const stance = calculateTranscriptStance(takes);
  const takeTypes = getTakeTypes(takes);
  const primaryThemes = getPrimaryThemes({
    stance,
    takes,
    mentions,
    takeTypes,
  });
  const importantCaveats = getImportantCaveats({
    stance,
    takes,
    mentions,
  });
  const evidence = getSummaryEvidence({
    mentions,
    takes,
  });
  const confidence = calculateSummaryConfidence({
    stance,
    takes,
    mentions,
    evidenceCount: evidence.length,
  });
  const comparisonPlayerIds = getComparisonPlayerIds({
    playerId: player.id,
    allMentionedPlayerIds,
    mentions,
  });

  return {
    player,
    stance,
    confidence,
    summary: buildSummaryText({
      player,
      stance,
      mentionCount: mentions.length,
      takeCount: takes.length,
      primaryThemes,
      importantCaveats,
    }),
    primaryThemes,
    importantCaveats,
    takeTypes,
    comparisonPlayerIds,
    mentionCount: mentions.length,
    evidence,
  };
}

function calculateTranscriptStance(
  takes: TakeForSummary[],
) {
  const bullishCount = takes.filter((take) => take.sentiment === "BULLISH")
    .length;
  const bearishCount = takes.filter((take) => take.sentiment === "BEARISH")
    .length;

  if (bullishCount > 0 && bearishCount > 0) {
    if (bullishCount >= bearishCount * 1.5) return "BULLISH" as const;
    if (bearishCount >= bullishCount * 1.5) return "BEARISH" as const;
    return "MIXED" as const;
  }

  if (bullishCount > 0) return "BULLISH" as const;
  if (bearishCount > 0) return "BEARISH" as const;

  return "NEUTRAL" as const;
}

function calculateSummaryConfidence({
  stance,
  takes,
  mentions,
  evidenceCount,
}: {
  stance: "BULLISH" | "BEARISH" | "MIXED" | "NEUTRAL";
  takes: TakeForSummary[];
  mentions: MentionForSummary[];
  evidenceCount: number;
}) {
  let confidence = 0.38;

  if (mentions.length >= 2) confidence += 0.08;
  if (mentions.length >= 5) confidence += 0.08;
  if (takes.length >= 1) confidence += 0.12;
  if (takes.length >= 3) confidence += 0.08;
  if (evidenceCount >= 3) confidence += 0.06;
  if (stance === "MIXED") confidence -= 0.08;
  if (stance === "NEUTRAL" && takes.length === 0) confidence -= 0.08;

  return Math.max(0.2, Math.min(0.9, Math.round(confidence * 100) / 100));
}

function getTakeTypes(
  takes: TakeForSummary[],
) {
  return Array.from(
    new Set(
      takes
        .map((take) => take.takeType)
        .filter((takeType) => takeType !== "UNCATEGORIZED"),
    ),
  );
}

function getPrimaryThemes({
  stance,
  takes,
  mentions,
  takeTypes,
}: {
  stance: "BULLISH" | "BEARISH" | "MIXED" | "NEUTRAL";
  takes: TakeForSummary[];
  mentions: MentionForSummary[];
  takeTypes: string[];
}) {
  const themes = new Set<string>();

  if (stance === "BULLISH") themes.add("Positive transcript stance");
  if (stance === "BEARISH") themes.add("Negative transcript stance");
  if (stance === "MIXED") themes.add("Mixed transcript stance");
  if (stance === "NEUTRAL") themes.add("Mentioned without a clear stance");

  takeTypes.forEach((takeType) => themes.add(formatEnumLabel(takeType)));

  if (mentions.length > takes.length) {
    themes.add("Transcript context");
  }

  return Array.from(themes).slice(0, 6);
}

function getImportantCaveats({
  stance,
  takes,
  mentions,
}: {
  stance: "BULLISH" | "BEARISH" | "MIXED" | "NEUTRAL";
  takes: TakeForSummary[];
  mentions: MentionForSummary[];
}) {
  const caveats = new Set<string>();
  const mentionContext = mentions
    .map((mention) => mention.context ?? "")
    .join(" ")
    .toLowerCase();

  if (takes.length === 0) {
    caveats.add("No eligible segment-level take was extracted for this player.");
  }

  if (stance === "MIXED") {
    caveats.add("Transcript contains both bullish and bearish evidence.");
  }

  if (mentionContext.includes("context only")) {
    caveats.add("Some evidence is context-only rather than a direct opinion.");
  }

  if (mentionContext.includes("comparison")) {
    caveats.add("Some evidence comes from player comparisons.");
  }

  if (mentionContext.includes("pronoun")) {
    caveats.add("Some evidence came from pronoun-heavy transcript segments.");
  }

  return Array.from(caveats).slice(0, 5);
}

function getSummaryEvidence({
  mentions,
  takes,
}: {
  mentions: MentionForSummary[];
  takes: TakeForSummary[];
}) {
  const evidence = [
    ...takes.map((take) => ({
      expertTakeId: take.id,
      playerMentionId: null,
      transcriptSegmentId: take.sourceSegment?.id ?? null,
      evidenceType: "EXPERT_TAKE",
      excerpt: trimExcerpt(take.excerpt),
    })),
    ...mentions
      .filter((mention) => !mention.expertTakeId)
      .map((mention) => ({
        expertTakeId: null,
        playerMentionId: mention.id,
        transcriptSegmentId: mention.expertTake?.sourceSegmentId ?? null,
        evidenceType: "PLAYER_MENTION",
        excerpt: trimExcerpt(mention.context ?? mention.mentionText),
      })),
  ];

  return evidence.slice(0, MAX_EVIDENCE_PER_SUMMARY);
}

function getComparisonPlayerIds({
  playerId,
  allMentionedPlayerIds,
  mentions,
}: {
  playerId: string;
  allMentionedPlayerIds: Set<string>;
  mentions: MentionForSummary[];
}) {
  const hasComparisonEvidence = mentions.some((mention) =>
    (mention.context ?? "").toLowerCase().includes("comparison"),
  );

  if (!hasComparisonEvidence) return [];

  return Array.from(allMentionedPlayerIds)
    .filter((mentionedPlayerId) => mentionedPlayerId !== playerId)
    .slice(0, 8);
}

function buildSummaryText({
  player,
  stance,
  mentionCount,
  takeCount,
  primaryThemes,
  importantCaveats,
}: {
  player: {
    fullName: string;
  };
  stance: "BULLISH" | "BEARISH" | "MIXED" | "NEUTRAL";
  mentionCount: number;
  takeCount: number;
  primaryThemes: string[];
  importantCaveats: string[];
}) {
  const stanceLabel = formatEnumLabel(stance);
  const evidenceText =
    takeCount > 0
      ? `${takeCount} extracted take${takeCount === 1 ? "" : "s"} and ${mentionCount} total mention${mentionCount === 1 ? "" : "s"}`
      : `${mentionCount} mention${mentionCount === 1 ? "" : "s"} and no direct extracted take`;
  const themeText =
    primaryThemes.length > 0 ? ` Themes: ${primaryThemes.join(", ")}.` : "";
  const caveatText =
    importantCaveats.length > 0
      ? ` Caveats: ${importantCaveats.join(" ")}`
      : "";

  return `${player.fullName} has a ${stanceLabel} transcript-level stance based on ${evidenceText}.${themeText}${caveatText}`;
}

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}
