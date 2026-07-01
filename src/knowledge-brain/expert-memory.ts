import { normalizeTargetSeason } from "@/knowledge-brain/freshness";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export type ExpertOpinionTrend =
  | "Increasing Bullishness"
  | "Decreasing Bullishness"
  | "Increasing Bearishness"
  | "Decreasing Bearishness"
  | "Stable Bullish"
  | "Stable Bearish"
  | "Stable Neutral"
  | "Mixed / Volatile"
  | "Not Enough Data";

export type ExpertConvictionLabel = "Low" | "Medium" | "High" | "Very High";

export type ExpertMemoryEvidenceSource =
  | "TRANSCRIPT_PLAYER_SUMMARY"
  | "EXPERT_TAKE_FALLBACK";

export type ExpertConvictionSignal = {
  key: string;
  label: string;
  value: string | number;
  score: number;
  explanation: string;
};

export type ExpertMemoryEvidence = {
  source: ExpertMemoryEvidenceSource;
  sourceTitle: string;
  sourceUrl: string | null;
  excerpt: string;
};

export type ExpertPlayerOpinionPoint = {
  id: string;
  expertId: string;
  expertName: string;
  playerId: string;
  playerName: string;
  position: string;
  team: string | null;
  sourceTitle: string;
  sourceUrl: string | null;
  publishDate: Date | null;
  contentSeason: number | null;
  stance: "BULLISH" | "BEARISH" | "MIXED" | "NEUTRAL";
  confidence: number;
  keyThemes: string[];
  caveats: string[];
  mentionCount: number;
  evidenceCount: number;
  summary: string;
  evidence: ExpertMemoryEvidence[];
  sourceType: ExpertMemoryEvidenceSource;
};

export type ExpertMemoryTimeline = {
  points: ExpertPlayerOpinionPoint[];
  firstPoint: ExpertPlayerOpinionPoint | null;
  latestPoint: ExpertPlayerOpinionPoint | null;
};

export type ExpertMemorySummary = {
  currentStance: "BULLISH" | "BEARISH" | "MIXED" | "NEUTRAL";
  opinionTrend: ExpertOpinionTrend;
  convictionScore: number;
  convictionLabel: ExpertConvictionLabel;
  explanationBullets: string[];
  warnings: string[];
  signals: ExpertConvictionSignal[];
};

export type ExpertPlayerMemory = {
  expertId: string;
  expertName: string;
  playerId: string;
  playerName: string;
  position: string;
  team: string | null;
  timeline: ExpertMemoryTimeline;
  memory: ExpertMemorySummary;
};

export type ExpertMemoryFilters = {
  targetSeason?: number | string | null;
  includeHistorical?: boolean;
  expertId?: string | null;
  playerId?: string | null;
};

type NormalizedExpertMemoryFilters = ReturnType<typeof normalizeMemoryFilters>;

const SUMMARY_MEMORY_INCLUDE = {
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
    take: 3,
    orderBy: {
      createdAt: "asc",
    },
  },
} satisfies Prisma.TranscriptPlayerSummaryInclude;

const TAKE_MEMORY_INCLUDE = {
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

type SummaryForMemory = Prisma.TranscriptPlayerSummaryGetPayload<{
  include: typeof SUMMARY_MEMORY_INCLUDE;
}>;

type TakeForMemory = Prisma.ExpertTakeGetPayload<{
  include: typeof TAKE_MEMORY_INCLUDE;
}>;

export async function getExpertMemoryDashboard(
  filters: ExpertMemoryFilters = {},
) {
  const normalizedFilters = normalizeMemoryFilters(filters);
  const memories = await getExpertPlayerMemories(normalizedFilters);

  return {
    filters: normalizedFilters,
    memories,
    widgets: {
      increasingBullish: memories
        .filter(
          (memory) =>
            memory.memory.opinionTrend === "Increasing Bullishness" ||
            memory.memory.opinionTrend === "Stable Bullish",
        )
        .sort(sortByConviction)
        .slice(0, 8),
      increasingBearish: memories
        .filter(
          (memory) =>
            memory.memory.opinionTrend === "Increasing Bearishness" ||
            memory.memory.opinionTrend === "Stable Bearish",
        )
        .sort(sortByConviction)
        .slice(0, 8),
      volatileOpinions: memories
        .filter((memory) => memory.memory.opinionTrend === "Mixed / Volatile")
        .sort(sortByTimelineLength)
        .slice(0, 8),
      highestConviction: [...memories].sort(sortByConviction).slice(0, 8),
    },
  };
}

export async function getExpertPlayerMemories(
  filters: ExpertMemoryFilters | NormalizedExpertMemoryFilters = {},
) {
  const normalizedFilters =
    "targetSeason" in filters && typeof filters.targetSeason === "number"
      ? (filters as NormalizedExpertMemoryFilters)
      : normalizeMemoryFilters(filters);
  const [summaries, fallbackTakes] = await Promise.all([
    getApprovedTranscriptSummaries(normalizedFilters),
    getApprovedFallbackTakes(normalizedFilters),
  ]);
  const summaryKeys = new Set(
    summaries.map((summary) => getMemoryKey(summary.expertId, summary.playerId)),
  );
  const summaryPoints = summaries.map(mapSummaryToOpinionPoint);
  const fallbackPoints = fallbackTakes
    .filter((take) => take.player)
    .filter((take) => !summaryKeys.has(getMemoryKey(take.expertId, take.playerId ?? "")))
    .map(mapTakeToOpinionPoint);

  return buildMemoriesFromPoints([...summaryPoints, ...fallbackPoints]);
}

export async function getExpertMemoriesForExpert(
  expertId: string,
  filters: ExpertMemoryFilters = {},
) {
  return getExpertPlayerMemories({
    ...filters,
    expertId,
  });
}

export async function getExpertMemoriesForPlayer(
  playerId: string,
  filters: ExpertMemoryFilters = {},
) {
  return getExpertPlayerMemories({
    ...filters,
    playerId,
  });
}

export function calculateMemoryTrustSignal(memories: ExpertPlayerMemory[]) {
  if (memories.length === 0) {
    return {
      score: 50,
      label: "No expert memory yet",
      explanation:
        "No approved expert-player memory timelines are available in this scope.",
      warnings: ["Expert Memory has no approved timeline evidence yet."],
    };
  }

  const averageConviction = average(
    memories.map((memory) => memory.memory.convictionScore),
  );
  const stableCount = memories.filter((memory) =>
    memory.memory.opinionTrend.startsWith("Stable"),
  ).length;
  const volatileCount = memories.filter(
    (memory) => memory.memory.opinionTrend === "Mixed / Volatile",
  ).length;
  const multiPointCount = memories.filter(
    (memory) => memory.timeline.points.length >= 2,
  ).length;
  const stabilityBonus = (stableCount / memories.length) * 10;
  const volatilityPenalty = (volatileCount / memories.length) * 15;
  const sampleBonus = Math.min(10, multiPointCount * 2);
  const score = clamp(
    Math.round(averageConviction + stabilityBonus + sampleBonus - volatilityPenalty),
    0,
    100,
  );

  return {
    score,
    label: `${getConvictionLabel(score)} memory signal`,
    explanation: `${memories.length} expert-player memor${
      memories.length === 1 ? "y" : "ies"
    } average ${Math.round(averageConviction)} conviction with ${stableCount} stable and ${volatileCount} volatile timeline${
      volatileCount === 1 ? "" : "s"
    }.`,
    warnings:
      multiPointCount === 0
        ? ["Most Expert Memory records have only one timeline point."]
        : [],
  };
}

function getApprovedTranscriptSummaries(
  filters: NormalizedExpertMemoryFilters,
) {
  return db.transcriptPlayerSummary.findMany({
    where: {
      reviewStatus: "APPROVED",
      expertId: filters.expertId,
      playerId: filters.playerId,
      transcript: {
        is: buildTranscriptWhere(filters),
      },
    },
    include: SUMMARY_MEMORY_INCLUDE,
    orderBy: [{ createdAt: "asc" }],
  });
}

function getApprovedFallbackTakes(filters: NormalizedExpertMemoryFilters) {
  return db.expertTake.findMany({
    where: {
      reviewStatus: "APPROVED",
      playerId: filters.playerId ? filters.playerId : { not: null },
      expertId: filters.expertId,
      transcript: {
        is: buildTranscriptWhere(filters),
      },
    },
    include: TAKE_MEMORY_INCLUDE,
    orderBy: [{ createdAt: "asc" }],
  });
}

function buildMemoriesFromPoints(points: ExpertPlayerOpinionPoint[]) {
  const groups = new Map<string, ExpertPlayerOpinionPoint[]>();

  for (const point of points) {
    const key = getMemoryKey(point.expertId, point.playerId);
    groups.set(key, [...(groups.get(key) ?? []), point]);
  }

  return Array.from(groups.values())
    .map((groupPoints) => {
      const sortedPoints = [...groupPoints].sort(sortOpinionPoints);
      const latestPoint = sortedPoints[sortedPoints.length - 1];
      const timeline = {
        points: sortedPoints,
        firstPoint: sortedPoints[0] ?? null,
        latestPoint: latestPoint ?? null,
      };

      return {
        expertId: latestPoint.expertId,
        expertName: latestPoint.expertName,
        playerId: latestPoint.playerId,
        playerName: latestPoint.playerName,
        position: latestPoint.position,
        team: latestPoint.team,
        timeline,
        memory: buildMemorySummary(timeline),
      };
    })
    .sort(
      (memoryA, memoryB) =>
        memoryB.memory.convictionScore - memoryA.memory.convictionScore ||
        getDateTime(memoryB.timeline.latestPoint?.publishDate) -
          getDateTime(memoryA.timeline.latestPoint?.publishDate) ||
        memoryA.expertName.localeCompare(memoryB.expertName) ||
        memoryA.playerName.localeCompare(memoryB.playerName),
    );
}

function buildMemorySummary(
  timeline: ExpertMemoryTimeline,
): ExpertMemorySummary {
  const points = timeline.points;
  const currentStance = timeline.latestPoint?.stance ?? "NEUTRAL";
  const opinionTrend = calculateOpinionTrend(points);
  const conviction = calculateConvictionSignal(points, opinionTrend);

  return {
    currentStance,
    opinionTrend,
    convictionScore: conviction.score,
    convictionLabel: conviction.label,
    explanationBullets: [
      `${points.length} approved opinion point${
        points.length === 1 ? "" : "s"
      } in this expert-player timeline.`,
      `Current stance is ${formatEnumLabel(currentStance)} with a ${opinionTrend.toLowerCase()} trend.`,
      `Average confidence is ${Math.round(
        average(points.map((point) => point.confidence * 100)),
      )}%.`,
      ...conviction.explanationBullets,
    ],
    warnings: conviction.warnings,
    signals: conviction.signals,
  };
}

function calculateOpinionTrend(
  points: ExpertPlayerOpinionPoint[],
): ExpertOpinionTrend {
  if (points.length < 2) return "Not Enough Data";

  const firstPoint = points[0];
  const latestPoint = points[points.length - 1];
  const firstScore = getStanceScore(firstPoint.stance) * firstPoint.confidence;
  const latestScore = getStanceScore(latestPoint.stance) * latestPoint.confidence;
  const movement = latestScore - firstScore;
  const stanceTransitions = countStanceTransitions(points);
  const stanceCounts = countStances(points);
  const hasBullishAndBearish = stanceCounts.bullish > 0 && stanceCounts.bearish > 0;
  const isVolatile =
    (hasBullishAndBearish && stanceTransitions >= 2) ||
    (points.length >= 3 && stanceCounts.mixed > 0 && stanceTransitions >= 2);

  if (isVolatile) return "Mixed / Volatile";
  if (movement >= 0.35 && latestScore > 0) return "Increasing Bullishness";
  if (movement <= -0.35 && latestScore < 0) return "Increasing Bearishness";
  if (movement <= -0.25 && firstScore > 0) return "Decreasing Bullishness";
  if (movement >= 0.25 && firstScore < 0) return "Decreasing Bearishness";

  const dominantStance = getDominantStance(stanceCounts);

  if (dominantStance === "BULLISH") return "Stable Bullish";
  if (dominantStance === "BEARISH") return "Stable Bearish";

  return "Stable Neutral";
}

function calculateConvictionSignal(
  points: ExpertPlayerOpinionPoint[],
  trend: ExpertOpinionTrend,
) {
  const averageConfidence = average(points.map((point) => point.confidence * 100));
  const recency = getRecencyScore(points[points.length - 1]?.publishDate ?? null);
  const stanceConsistency = getStanceConsistency(points);
  const themeConsistency = getThemeConsistency(points);
  const confidenceTrend = getConfidenceTrendScore(points);
  const mentionVolume = Math.min(
    100,
    points.reduce((total, point) => total + Math.max(1, point.mentionCount), 0) *
      8,
  );
  const sampleScore = Math.min(100, points.length * 25);
  const volatilityPenalty = trend === "Mixed / Volatile" ? 12 : 0;
  const score = clamp(
    Math.round(
      sampleScore * 0.18 +
        averageConfidence * 0.22 +
        stanceConsistency * 0.18 +
        recency * 0.14 +
        themeConsistency * 0.1 +
        confidenceTrend * 0.08 +
        mentionVolume * 0.1 -
        volatilityPenalty,
    ),
    0,
    100,
  );
  const warnings = [];

  if (points.length < 2) {
    warnings.push("Only one approved opinion point exists for this expert-player pair.");
  }
  if (trend === "Mixed / Volatile") {
    warnings.push("This expert's stance has moved across conflicting directions.");
  }
  if (averageConfidence < 55) {
    warnings.push("Average summary confidence is modest.");
  }

  return {
    score,
    label: getConvictionLabel(score),
    explanationBullets: [
      `Stance consistency contributes ${Math.round(stanceConsistency)} out of 100.`,
      `Mention volume contributes ${Math.round(mentionVolume)} out of 100.`,
      `Recency contributes ${Math.round(recency)} out of 100.`,
    ],
    warnings,
    signals: [
      {
        key: "sampleSize",
        label: "Timeline points",
        value: points.length,
        score: sampleScore,
        explanation: "More approved timeline points make memory more reliable.",
      },
      {
        key: "averageConfidence",
        label: "Average confidence",
        value: `${Math.round(averageConfidence)}%`,
        score: averageConfidence,
        explanation:
          "Uses transcript summary confidence or approved take confidence.",
      },
      {
        key: "stanceConsistency",
        label: "Stance consistency",
        value: `${Math.round(stanceConsistency)}%`,
        score: stanceConsistency,
        explanation:
          "Measures how consistently the expert has held the same stance.",
      },
      {
        key: "themeConsistency",
        label: "Theme consistency",
        value: `${Math.round(themeConsistency)}%`,
        score: themeConsistency,
        explanation:
          "Rewards repeated themes across transcript-level summaries.",
      },
      {
        key: "confidenceTrend",
        label: "Confidence trend",
        value: `${Math.round(confidenceTrend)}%`,
        score: confidenceTrend,
        explanation:
          "Rewards conviction that is stable or increasing across the timeline.",
      },
    ],
  };
}

function mapSummaryToOpinionPoint(
  summary: SummaryForMemory,
): ExpertPlayerOpinionPoint {
  return {
    id: summary.id,
    expertId: summary.expertId,
    expertName: summary.expert.name,
    playerId: summary.playerId,
    playerName: summary.player.fullName,
    position: summary.player.position,
    team: summary.player.team,
    sourceTitle: summary.sourceVideo.title,
    sourceUrl: summary.sourceVideo.url,
    publishDate:
      summary.transcript?.publishDate ?? summary.sourceVideo.publishedAt,
    contentSeason: summary.transcript?.contentSeason ?? null,
    stance: summary.stance,
    confidence: summary.confidence,
    keyThemes: summary.primaryThemes,
    caveats: summary.importantCaveats,
    mentionCount: summary.mentionCount,
    evidenceCount: summary.evidenceCount,
    summary: summary.summary,
    evidence: summary.evidence.map((evidence) => ({
      source: "TRANSCRIPT_PLAYER_SUMMARY",
      sourceTitle: summary.sourceVideo.title,
      sourceUrl: summary.sourceVideo.url,
      excerpt: evidence.excerpt,
    })),
    sourceType: "TRANSCRIPT_PLAYER_SUMMARY",
  };
}

function mapTakeToOpinionPoint(take: TakeForMemory): ExpertPlayerOpinionPoint {
  const player = take.player;

  if (!player) {
    throw new Error("Cannot build Expert Memory fallback without a player.");
  }

  return {
    id: take.id,
    expertId: take.expertId,
    expertName: take.expert.name,
    playerId: player.id,
    playerName: player.fullName,
    position: player.position,
    team: player.team,
    sourceTitle: take.sourceVideo.title,
    sourceUrl: take.sourceVideo.url,
    publishDate: take.transcript?.publishDate ?? take.sourceVideo.publishedAt,
    contentSeason: take.transcript?.contentSeason ?? null,
    stance: take.sentiment,
    confidence: take.confidence,
    keyThemes:
      take.takeType === "UNCATEGORIZED" ? [] : [formatEnumLabel(take.takeType)],
    caveats: ["Fallback memory point from approved segment-level take."],
    mentionCount: 1,
    evidenceCount: 1,
    summary: take.summary,
    evidence: [
      {
        source: "EXPERT_TAKE_FALLBACK",
        sourceTitle: take.sourceVideo.title,
        sourceUrl: take.sourceVideo.url,
        excerpt: take.excerpt,
      },
    ],
    sourceType: "EXPERT_TAKE_FALLBACK",
  };
}

function buildTranscriptWhere({
  targetSeason,
  includeHistorical,
}: NormalizedExpertMemoryFilters): Prisma.TranscriptWhereInput {
  if (includeHistorical) return {};

  return {
    contentSeason: targetSeason,
    includeInCurrentAnalysis: true,
  };
}

function normalizeMemoryFilters(filters: ExpertMemoryFilters) {
  return {
    targetSeason: normalizeTargetSeason(filters.targetSeason),
    includeHistorical: Boolean(filters.includeHistorical),
    expertId: normalizeOptionalId(filters.expertId),
    playerId: normalizeOptionalId(filters.playerId),
  };
}

function normalizeOptionalId(value?: string | null) {
  const trimmedValue = value?.trim();

  return trimmedValue ? trimmedValue : undefined;
}

function getMemoryKey(expertId: string, playerId: string) {
  return `${expertId}:${playerId}`;
}

function sortOpinionPoints(
  pointA: ExpertPlayerOpinionPoint,
  pointB: ExpertPlayerOpinionPoint,
) {
  return (
    getDateTime(pointA.publishDate) - getDateTime(pointB.publishDate) ||
    pointA.id.localeCompare(pointB.id)
  );
}

function sortByConviction(
  memoryA: ExpertPlayerMemory,
  memoryB: ExpertPlayerMemory,
) {
  return (
    memoryB.memory.convictionScore - memoryA.memory.convictionScore ||
    memoryB.timeline.points.length - memoryA.timeline.points.length ||
    memoryA.expertName.localeCompare(memoryB.expertName)
  );
}

function sortByTimelineLength(
  memoryA: ExpertPlayerMemory,
  memoryB: ExpertPlayerMemory,
) {
  return (
    memoryB.timeline.points.length - memoryA.timeline.points.length ||
    memoryB.memory.convictionScore - memoryA.memory.convictionScore
  );
}

function getStanceScore(stance: string) {
  if (stance === "BULLISH") return 1;
  if (stance === "BEARISH") return -1;

  return 0;
}

function countStanceTransitions(points: ExpertPlayerOpinionPoint[]) {
  let transitions = 0;

  for (let index = 1; index < points.length; index += 1) {
    if (points[index - 1].stance !== points[index].stance) {
      transitions += 1;
    }
  }

  return transitions;
}

function countStances(points: Array<{ stance: string }>) {
  return {
    bullish: points.filter((point) => point.stance === "BULLISH").length,
    bearish: points.filter((point) => point.stance === "BEARISH").length,
    mixed: points.filter((point) => point.stance === "MIXED").length,
    neutral: points.filter((point) => point.stance === "NEUTRAL").length,
  };
}

function getDominantStance(counts: ReturnType<typeof countStances>) {
  if (counts.bullish > counts.bearish && counts.bullish >= counts.neutral) {
    return "BULLISH";
  }
  if (counts.bearish > counts.bullish && counts.bearish >= counts.neutral) {
    return "BEARISH";
  }
  if (counts.mixed > counts.bullish && counts.mixed > counts.bearish) {
    return "MIXED";
  }

  return "NEUTRAL";
}

function getStanceConsistency(points: ExpertPlayerOpinionPoint[]) {
  if (points.length === 0) return 0;

  const counts = countStances(points);
  const majority = Math.max(
    counts.bullish,
    counts.bearish,
    counts.mixed,
    counts.neutral,
  );

  return (majority / points.length) * 100;
}

function getThemeConsistency(points: ExpertPlayerOpinionPoint[]) {
  const themeCounts = new Map<string, number>();

  for (const point of points) {
    for (const theme of point.keyThemes) {
      const normalizedTheme = theme.toLowerCase();
      themeCounts.set(normalizedTheme, (themeCounts.get(normalizedTheme) ?? 0) + 1);
    }
  }

  if (themeCounts.size === 0 || points.length <= 1) return 50;

  const repeatedThemes = Array.from(themeCounts.values()).filter(
    (count) => count >= 2,
  ).length;

  return clamp(50 + repeatedThemes * 15, 0, 100);
}

function getConfidenceTrendScore(points: ExpertPlayerOpinionPoint[]) {
  if (points.length < 2) return 50;

  const firstConfidence = points[0].confidence;
  const latestConfidence = points[points.length - 1].confidence;
  const movement = latestConfidence - firstConfidence;

  return clamp(50 + movement * 100, 0, 100);
}

function getRecencyScore(date: Date | null) {
  if (!date) return 20;

  const ageInDays =
    (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);

  if (ageInDays <= 14) return 100;
  if (ageInDays <= 45) return 85;
  if (ageInDays <= 90) return 65;
  if (ageInDays <= 180) return 40;

  return 20;
}

function getConvictionLabel(score: number): ExpertConvictionLabel {
  if (score >= 85) return "Very High";
  if (score >= 65) return "High";
  if (score >= 40) return "Medium";

  return "Low";
}

function average(values: number[]) {
  if (values.length === 0) return 0;

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function getDateTime(date: Date | null | undefined) {
  return date?.getTime() ?? 0;
}

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
