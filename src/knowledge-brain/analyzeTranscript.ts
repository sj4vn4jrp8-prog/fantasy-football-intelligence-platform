import { db } from "@/lib/db";
import { regenerateTranscriptPlayerSummaries } from "@/knowledge-brain/transcript-intelligence";
import {
  analyzeSegmentPlayerContext,
  normalizeForMatching,
  trimExcerpt,
  type SegmentExtractionContext,
  type SegmentPlayerMention,
  type TranscriptPlayerCandidate,
} from "@/knowledge-brain/transcript-extraction";

type AnalyzeSavedTranscriptInput = {
  expertId: string;
  sourceVideoId: string;
  transcriptId: string;
};

type KeywordRule<TValue extends string> = {
  value: TValue;
  keywords: string[];
};

const BULLISH_KEYWORDS = [
  "buy",
  "breakout",
  "league winner",
  "love",
  "smash",
  "sleeper",
  "start",
  "stash",
  "target",
  "undervalued",
  "upside",
];

const BEARISH_KEYWORDS = [
  "avoid",
  "bench",
  "bust",
  "concern",
  "downgrade",
  "fade",
  "limited",
  "overvalued",
  "risky",
  "sell",
  "sit",
];

const TAKE_TYPE_RULES: Array<
  KeywordRule<
    | "START_SIT"
    | "WAIVER"
    | "TRADE"
    | "DRAFT"
    | "INJURY"
    | "MATCHUP"
    | "BREAKOUT"
    | "FADE"
    | "SLEEPER"
  >
> = [
  {
    value: "INJURY",
    keywords: ["injury", "injured", "limited", "questionable", "doubtful"],
  },
  {
    value: "WAIVER",
    keywords: ["waiver", "add", "pickup", "pick up", "free agent"],
  },
  {
    value: "TRADE",
    keywords: ["trade", "buy low", "sell high", "sell"],
  },
  {
    value: "DRAFT",
    keywords: ["draft", "adp", "round", "auction"],
  },
  {
    value: "START_SIT",
    keywords: ["start", "sit", "bench", "lineup"],
  },
  {
    value: "MATCHUP",
    keywords: ["matchup", "defense", "schedule", "corner", "coverage"],
  },
  {
    value: "BREAKOUT",
    keywords: ["breakout", "emerge", "ceiling", "upside"],
  },
  {
    value: "FADE",
    keywords: ["fade", "avoid", "overvalued", "bust"],
  },
  {
    value: "SLEEPER",
    keywords: ["sleeper", "stash", "deep league", "undervalued"],
  },
];

export function segmentTranscriptText(rawText: string) {
  const paragraphs = rawText
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const sourceParts = paragraphs.length > 0 ? paragraphs : [rawText.trim()];
  const segments: string[] = [];

  for (const part of sourceParts) {
    if (part.length <= 700) {
      segments.push(part);
      continue;
    }

    const sentences = part
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter(Boolean);
    let current = "";

    for (const sentence of sentences) {
      if (`${current} ${sentence}`.trim().length > 700 && current) {
        segments.push(current);
        current = sentence;
      } else {
        current = `${current} ${sentence}`.trim();
      }
    }

    if (current) {
      segments.push(current);
    }
  }

  return segments;
}

export async function analyzeSavedTranscript({
  expertId,
  sourceVideoId,
  transcriptId,
}: AnalyzeSavedTranscriptInput) {
  const transcript = await db.transcript.findUnique({
    where: { id: transcriptId },
    include: {
      segments: {
        orderBy: { index: "asc" },
      },
    },
  });

  if (!transcript) {
    throw new Error("Transcript was not found for analysis.");
  }

  const players = await db.player.findMany({
    select: {
      id: true,
      firstName: true,
      lastName: true,
      fullName: true,
      position: true,
      team: true,
    },
  });
  let takesCreated = 0;
  const mentionedPlayerIds = new Set<string>();

  for (const segment of transcript.segments) {
    const segmentContext = analyzeSegmentPlayerContext({
      text: segment.text,
      players,
    });
    const targetMentions = getTakeTargetMentions(segmentContext);

    for (const mention of segmentContext.mentions) {
      mentionedPlayerIds.add(mention.player.id);
    }

    for (const targetMention of targetMentions) {
      const player = targetMention.player;
      const sentimentResult = classifySentiment(segmentContext.cleanedText);
      const sentiment = sentimentResult.sentiment;
      const takeType = classifyTakeType(segmentContext.cleanedText);
      const summary = buildTakeSummary({
        player,
        sentiment,
        takeType,
        segmentContext,
      });
      const confidence = calculateTakeConfidence({
        sentiment,
        takeType,
        sentimentResult,
        segmentContext,
      });
      const take = await db.expertTake.create({
        data: {
          expertId,
          sourceVideoId,
          transcriptId,
          sourceSegmentId: segment.id,
          playerId: player.id,
          sentiment,
          takeType,
          summary,
          excerpt: trimExcerpt(segmentContext.cleanedText),
          confidence,
          reviewStatus: "PENDING",
        },
      });

      await createPlayerMention({
        expertTakeId: take.id,
        transcriptId,
        sourceVideoId,
        player,
        sentiment,
        takeType,
        context: trimExcerpt(segmentContext.cleanedText),
      });

      takesCreated += 1;
    }

    await createNonPrimaryPlayerMentions({
      transcriptId,
      sourceVideoId,
      targetMentions,
      segmentContext,
    });
  }

  await db.transcript.update({
    where: { id: transcriptId },
    data: { analyzedAt: new Date() },
  });

  await refreshTrendSignals(Array.from(mentionedPlayerIds));
  const transcriptIntelligence = await regenerateTranscriptPlayerSummaries(
    transcriptId,
  );

  return {
    takesCreated,
    playersMentioned: mentionedPlayerIds.size,
    playerSummariesCreated: transcriptIntelligence.summariesCreated,
    approvedPlayerSummariesPreserved:
      transcriptIntelligence.approvedSummariesPreserved,
    autoApprovedPlayerSummaries: transcriptIntelligence.autoApprovedSummaries,
    playerSummariesNeedingHumanReview:
      transcriptIntelligence.summariesNeedingHumanReview,
  };
}

function getTakeTargetMentions(segmentContext: SegmentExtractionContext) {
  if (segmentContext.mentions.length === 0) return [];

  const primaryMentions = segmentContext.mentions.filter(
    (mention) => mention.role === "PRIMARY_SUBJECT" && mention.eligibleForTake,
  );

  if (segmentContext.comparisonLanguageDetected) {
    return primaryMentions.slice(0, 1);
  }

  return primaryMentions;
}

async function createPlayerMention({
  expertTakeId,
  transcriptId,
  sourceVideoId,
  player,
  sentiment,
  takeType,
  context,
}: {
  expertTakeId: string;
  transcriptId: string;
  sourceVideoId: string;
  player: TranscriptPlayerCandidate;
  sentiment: "BULLISH" | "BEARISH" | "NEUTRAL";
  takeType:
    | "START_SIT"
    | "WAIVER"
    | "TRADE"
    | "DRAFT"
    | "INJURY"
    | "MATCHUP"
    | "BREAKOUT"
    | "FADE"
    | "SLEEPER"
    | "UNCATEGORIZED";
  context: string;
}) {
  await db.playerMention.create({
    data: {
      expertTakeId,
      transcriptId,
      sourceVideoId,
      playerId: player.id,
      mentionText: player.fullName,
      normalizedName: normalizeForMatching(player.fullName),
      sentiment,
      takeType,
      context,
    },
  });
}

async function createNonPrimaryPlayerMentions({
  transcriptId,
  sourceVideoId,
  targetMentions,
  segmentContext,
}: {
  transcriptId: string;
  sourceVideoId: string;
  targetMentions: SegmentPlayerMention[];
  segmentContext: SegmentExtractionContext;
}) {
  const targetPlayerIds = new Set(
    targetMentions.map((mention) => mention.player.id),
  );
  const nonPrimaryMentions = segmentContext.mentions.filter(
    (mention) => !targetPlayerIds.has(mention.player.id),
  );

  for (const mention of nonPrimaryMentions) {
    await db.playerMention.create({
      data: {
        transcriptId,
        sourceVideoId,
        playerId: mention.player.id,
        mentionText: mention.player.fullName,
        normalizedName: normalizeForMatching(mention.player.fullName),
        sentiment: "NEUTRAL",
        takeType: "UNCATEGORIZED",
        context: `${getMentionAuditPrefix(mention)} ${trimExcerpt(
          segmentContext.cleanedText,
        )}`,
      },
    });
  }
}

function getMentionAuditPrefix(mention: SegmentPlayerMention) {
  const labels = [
    formatEnumLabel(mention.role),
    ...mention.eligibilityReasons
      .filter((reason) => reason !== "SUBJECT_OPINION_LINK")
      .map(formatEnumLabel),
  ];

  return `[${Array.from(new Set(labels)).join(" / ")}]`;
}

function classifySentiment(text: string) {
  const normalizedText = normalizeForMatching(text);
  const bullishScore = countKeywordHits(normalizedText, BULLISH_KEYWORDS);
  const bearishScore = countKeywordHits(normalizedText, BEARISH_KEYWORDS);

  if (bullishScore > bearishScore) {
    return {
      sentiment: "BULLISH" as const,
      bullishScore,
      bearishScore,
      conflictingSentiment: bearishScore > 0,
    };
  }

  if (bearishScore > bullishScore) {
    return {
      sentiment: "BEARISH" as const,
      bullishScore,
      bearishScore,
      conflictingSentiment: bullishScore > 0,
    };
  }

  return {
    sentiment: "NEUTRAL" as const,
    bullishScore,
    bearishScore,
    conflictingSentiment: bullishScore > 0 && bearishScore > 0,
  };
}

function classifyTakeType(text: string) {
  const normalizedText = normalizeForMatching(text);
  const matchedRule = TAKE_TYPE_RULES.find((rule) =>
    rule.keywords.some((keyword) =>
      normalizedText.includes(normalizeForMatching(keyword)),
    ),
  );

  return matchedRule?.value ?? "UNCATEGORIZED";
}

function countKeywordHits(text: string, keywords: string[]) {
  return keywords.filter((keyword) =>
    text.includes(normalizeForMatching(keyword)),
  ).length;
}

function buildTakeSummary({
  player,
  sentiment,
  takeType,
  segmentContext,
}: {
  player: TranscriptPlayerCandidate;
  sentiment: string;
  takeType: string;
  segmentContext: SegmentExtractionContext;
}) {
  const baseSummary = `${player.fullName} was classified as ${formatEnumLabel(
    sentiment,
  )} for ${formatEnumLabel(takeType)}.`;

  if (segmentContext.primaryPlayerUncertain) {
    return `${baseSummary} Review warning: primary player is uncertain in a multi-player comparison.`;
  }

  if (segmentContext.pronounHeavy) {
    return `${baseSummary} Review warning: pronoun-heavy segment needs review.`;
  }

  if (
    segmentContext.warnings.includes("NO_CLEAR_SUBJECT_OPINION_LINK") ||
    !segmentContext.mentions.some((mention) => mention.eligibleForTake)
  ) {
    return `${baseSummary} Review warning: subject-opinion link is weak.`;
  }

  if (segmentContext.comparisonLanguageDetected) {
    return `${baseSummary} Review warning: comparison language was detected.`;
  }

  if (segmentContext.mentions.length > 1) {
    return `${baseSummary} Review warning: multiple players were detected.`;
  }

  return baseSummary;
}

function calculateTakeConfidence({
  sentiment,
  takeType,
  sentimentResult,
  segmentContext,
}: {
  sentiment: string;
  takeType: string;
  sentimentResult: ReturnType<typeof classifySentiment>;
  segmentContext: SegmentExtractionContext;
}) {
  let confidence = 0.45;

  if (sentiment !== "NEUTRAL") confidence += 0.2;
  if (takeType !== "UNCATEGORIZED") confidence += 0.15;
  if (segmentContext.mentions.length > 1) confidence -= 0.12;
  if (segmentContext.comparisonLanguageDetected) confidence -= 0.12;
  if (segmentContext.primaryPlayerUncertain) confidence -= 0.18;
  if (segmentContext.pronounHeavy) confidence -= 0.12;
  if (segmentContext.spokenTimestampCleanupApplied) confidence -= 0.03;
  if (sentimentResult.conflictingSentiment) confidence -= 0.12;
  if (segmentContext.timestampHeavy) confidence -= 0.04;

  return Math.max(0.2, Math.min(0.85, Math.round(confidence * 100) / 100));
}

export async function refreshTrendSignals(playerIds: string[]) {
  for (const playerId of playerIds) {
    const mentions = await db.playerMention.findMany({
      where: {
        playerId,
        transcript: {
          is: {
            includeInCurrentAnalysis: true,
          },
        },
        expertTake: {
          is: {
            reviewStatus: "APPROVED",
          },
        },
      },
      include: {
        expertTake: {
          select: {
            expertId: true,
          },
        },
        player: {
          select: {
            fullName: true,
          },
        },
      },
    });

    if (mentions.length === 0) continue;

    const bullishCount = mentions.filter(
      (mention) => mention.sentiment === "BULLISH",
    ).length;
    const bearishCount = mentions.filter(
      (mention) => mention.sentiment === "BEARISH",
    ).length;
    const direction = getTrendDirection({ bullishCount, bearishCount });
    const expertIds = new Set(
      mentions
        .map((mention) => mention.expertTake?.expertId)
        .filter((expertId): expertId is string => Boolean(expertId)),
    );
    const signalStrength =
      mentions.length > 0
        ? Math.round(
            (Math.abs(bullishCount - bearishCount) / mentions.length) * 100,
          ) / 100
        : 0;
    const playerName = mentions[0]?.player.fullName ?? "Player";

    await db.trendSignal.upsert({
      where: {
        playerId_trendKey: {
          playerId,
          trendKey: "overall",
        },
      },
      create: {
        playerId,
        trendKey: "overall",
        direction,
        signalStrength,
        mentionCount: mentions.length,
        expertCount: expertIds.size,
        summary: `${playerName} has ${mentions.length} expert mention${
          mentions.length === 1 ? "" : "s"
        } with a ${formatEnumLabel(direction)} trend.`,
      },
      update: {
        direction,
        signalStrength,
        mentionCount: mentions.length,
        expertCount: expertIds.size,
        summary: `${playerName} has ${mentions.length} expert mention${
          mentions.length === 1 ? "" : "s"
        } with a ${formatEnumLabel(direction)} trend.`,
      },
    });
  }
}

function getTrendDirection({
  bullishCount,
  bearishCount,
}: {
  bullishCount: number;
  bearishCount: number;
}) {
  if (bullishCount > bearishCount) return "BULLISH";
  if (bearishCount > bullishCount) return "BEARISH";
  if (bullishCount > 0 && bearishCount > 0) return "MIXED";

  return "NEUTRAL";
}

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}
