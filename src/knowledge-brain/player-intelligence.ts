import { db } from "@/lib/db";
import {
  getFreshnessOptions,
  normalizeTargetSeason,
  type ContentFreshnessLabel,
} from "@/knowledge-brain/freshness";

export type IntelligenceLabel =
  | "Strong Bullish"
  | "Bullish"
  | "Neutral"
  | "Bearish"
  | "Strong Bearish";

export type PlayerIntelligenceDirectoryFilters = {
  search?: string;
  position?: string;
  team?: string;
  targetSeason?: number | string | null;
  freshness?: string | null;
  includeHistorical?: boolean;
};

type Sentiment = "BULLISH" | "BEARISH" | "NEUTRAL";
type TrendDirection = "BULLISH" | "BEARISH" | "NEUTRAL" | "MIXED";

const BULLISH_REASON_THEMES = [
  {
    key: "breakout",
    label: "Breakout",
    keywords: ["breakout", "ceiling", "upside", "leap"],
  },
  {
    key: "opportunity",
    label: "Opportunity",
    keywords: ["opportunity", "role", "routes", "snaps", "usage"],
  },
  {
    key: "targets",
    label: "Targets",
    keywords: ["target", "targets", "receptions", "looks"],
  },
  {
    key: "workload",
    label: "Workload",
    keywords: ["workload", "touches", "carries", "volume", "bell cow"],
  },
  {
    key: "matchup",
    label: "Matchup",
    keywords: ["matchup", "defense", "coverage", "corner"],
  },
  {
    key: "offense-improvement",
    label: "Offense Improvement",
    keywords: ["offense", "quarterback", "coordinator", "pace", "scheme"],
  },
  {
    key: "adp-value",
    label: "ADP Value",
    keywords: ["adp", "value", "undervalued", "price", "discount"],
  },
] as const;

const BEARISH_REASON_THEMES = [
  {
    key: "injury",
    label: "Injury",
    keywords: ["injury", "injured", "limited", "questionable", "doubtful"],
  },
  {
    key: "committee",
    label: "Committee",
    keywords: ["committee", "split", "timeshare", "shared", "rotation"],
  },
  {
    key: "schedule",
    label: "Schedule",
    keywords: ["schedule", "tough stretch", "difficult", "road"],
  },
  {
    key: "role-uncertainty",
    label: "Role Uncertainty",
    keywords: ["role", "uncertain", "unclear", "volatile", "unknown"],
  },
  {
    key: "regression",
    label: "Regression",
    keywords: ["regression", "unsustainable", "efficiency", "touchdown rate"],
  },
  {
    key: "matchup-concerns",
    label: "Matchup Concerns",
    keywords: ["matchup", "defense", "coverage", "tough", "shadow"],
  },
] as const;

async function getPlayersWithIntelligenceData() {
  return db.player.findMany({
    where: {
      OR: [{ playerMentions: { some: {} } }, { expertTakes: { some: {} } }],
    },
    include: {
      playerMentions: {
        include: {
          sourceVideo: true,
          transcript: true,
          expertTake: {
            include: {
              expert: true,
              sourceVideo: true,
              transcript: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      expertTakes: {
        include: {
          expert: true,
          sourceVideo: true,
          transcript: true,
        },
        orderBy: { createdAt: "desc" },
      },
      trendSignals: {
        where: { trendKey: "overall" },
        take: 1,
      },
    },
    orderBy: [{ fullName: "asc" }],
  });
}

type PlayerWithIntelligenceData = Awaited<
  ReturnType<typeof getPlayersWithIntelligenceData>
>[number];

export async function getPlayerIntelligenceDirectory(
  filters: PlayerIntelligenceDirectoryFilters = {},
) {
  const intelligenceFilters = normalizeIntelligenceFilters(filters);
  const players = await getPlayersWithIntelligenceData();
  const directoryRows = players
    .map((player) =>
      buildPlayerIntelligenceSummary(
        applyIntelligenceFilters(player, intelligenceFilters),
      ),
    )
    .filter((row) => row.totalMentions > 0 || intelligenceFilters.includeHistorical);
  const positionOptions = Array.from(
    new Set(directoryRows.map((row) => row.position).filter(isNonEmptyString)),
  ).sort();
  const teamOptions = Array.from(
    new Set(directoryRows.map((row) => row.team).filter(isNonEmptyString)),
  ).sort();
  const normalizedSearch = normalizeForSearch(filters.search);
  const normalizedPosition = normalizeForSearch(filters.position);
  const normalizedTeam = normalizeForSearch(filters.team);
  const filteredRows = directoryRows.filter((row) => {
    const matchesSearch = normalizedSearch
      ? normalizeForSearch(row.fullName).includes(normalizedSearch)
      : true;
    const matchesPosition = normalizedPosition
      ? normalizeForSearch(row.position) === normalizedPosition
      : true;
    const matchesTeam = normalizedTeam
      ? normalizeForSearch(row.team ?? "") === normalizedTeam
      : true;

    return matchesSearch && matchesPosition && matchesTeam;
  });

  return {
    players: filteredRows.sort(
      (playerA, playerB) =>
        playerB.totalMentions - playerA.totalMentions ||
        playerB.intelligenceScore - playerA.intelligenceScore ||
        playerA.fullName.localeCompare(playerB.fullName),
    ),
    positionOptions,
    teamOptions,
    filters: {
      targetSeason: intelligenceFilters.targetSeason,
      freshness: intelligenceFilters.freshness,
      includeHistorical: intelligenceFilters.includeHistorical,
      freshnessOptions: getFreshnessOptions(),
    },
  };
}

export async function getPlayerIntelligenceHighlights(
  filters: PlayerIntelligenceDirectoryFilters = {},
) {
  const { players } = await getPlayerIntelligenceDirectory(filters);

  return {
    topBullishPlayers: players
      .filter((player) => player.intelligenceScore > 50)
      .sort(
        (playerA, playerB) =>
          playerB.intelligenceScore - playerA.intelligenceScore ||
          playerB.totalMentions - playerA.totalMentions,
      )
      .slice(0, 5),
    topBearishPlayers: players
      .filter((player) => player.intelligenceScore < 50)
      .sort(
        (playerA, playerB) =>
          playerA.intelligenceScore - playerB.intelligenceScore ||
          playerB.totalMentions - playerA.totalMentions,
      )
      .slice(0, 5),
    mostDiscussedPlayers: [...players]
      .sort(
        (playerA, playerB) =>
          playerB.totalMentions - playerA.totalMentions ||
          playerB.expertCount - playerA.expertCount,
      )
      .slice(0, 5),
    trendingPlayers: [...players]
      .sort(
        (playerA, playerB) =>
          getDateTime(playerB.latestMentionDate) -
            getDateTime(playerA.latestMentionDate) ||
          playerB.totalMentions - playerA.totalMentions,
      )
      .slice(0, 5),
  };
}

export async function getPlayerIntelligenceProfile(
  playerId: string,
  filters: PlayerIntelligenceDirectoryFilters = {},
) {
  const intelligenceFilters = normalizeIntelligenceFilters(filters);
  const [player, experts] = await Promise.all([
    db.player.findUnique({
      where: { id: playerId },
      include: {
        playerMentions: {
          include: {
            sourceVideo: true,
            transcript: true,
            expertTake: {
              include: {
                expert: true,
                sourceVideo: true,
                transcript: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        expertTakes: {
          include: {
            expert: true,
            sourceVideo: true,
            transcript: true,
          },
          orderBy: { createdAt: "desc" },
        },
        trendSignals: {
          where: { trendKey: "overall" },
          take: 1,
        },
      },
    }),
    db.expert.findMany({
      orderBy: { name: "asc" },
    }),
  ]);

  if (!player) return null;

  const filteredPlayer = applyIntelligenceFilters(player, intelligenceFilters);
  const summary = buildPlayerIntelligenceSummary(filteredPlayer);
  const expertBreakdown = experts.map((expert) => {
    const expertTakes = filteredPlayer.expertTakes.filter(
      (take) => take.expertId === expert.id,
    );
    const sentiment = getDominantSentiment(countSentiments(expertTakes));
    const latestTake = expertTakes[0];

    return {
      expertId: expert.id,
      expertName: expert.name,
      mentionCount: expertTakes.length,
      sentiment,
      latestTake: latestTake
        ? {
            id: latestTake.id,
            summary: latestTake.summary,
            sentiment: latestTake.sentiment,
            takeType: latestTake.takeType,
            sourceTitle: latestTake.sourceVideo.title,
            publishedAt: latestTake.sourceVideo.publishedAt,
            createdAt: latestTake.createdAt,
          }
        : null,
    };
  });
  const recentTakes = filteredPlayer.expertTakes.map((take) => {
    const freshnessRecord = getFreshnessRecord(take);

    return {
      id: take.id,
      summary: take.summary,
      excerpt: take.excerpt,
      sentiment: take.sentiment,
      takeType: take.takeType,
      expertName: take.expert.name,
      sourceTitle: take.sourceVideo.title,
      sourceUrl: take.sourceVideo.url,
      publishedAt: take.sourceVideo.publishedAt,
      createdAt: take.createdAt,
      freshnessLabel: freshnessRecord?.freshnessLabel ?? "STALE",
      includeInCurrentAnalysis:
        freshnessRecord?.includeInCurrentAnalysis ?? false,
    };
  });

  return {
    player: {
      id: player.id,
      fullName: player.fullName,
      position: player.position,
      team: player.team,
    },
    summary,
    filters: {
      targetSeason: intelligenceFilters.targetSeason,
      freshness: intelligenceFilters.freshness,
      includeHistorical: intelligenceFilters.includeHistorical,
      freshnessOptions: getFreshnessOptions(),
    },
    excludedHistoricalCount:
      player.expertTakes.length - filteredPlayer.expertTakes.length,
    sentimentPercentages: getSentimentPercentages(summary),
    expertBreakdown,
    recentTakes,
    trendAnalysis: {
      direction: summary.trendDirection,
      mentionVolume: getMentionVolumeOverTime(filteredPlayer.expertTakes),
      bullishTrend: summary.bullishCount,
      bearishTrend: summary.bearishCount,
    },
    reasonsForBullishness: getReasonThemes(
      filteredPlayer.expertTakes,
      "BULLISH",
      BULLISH_REASON_THEMES,
    ),
    reasonsForBearishness: getReasonThemes(
      filteredPlayer.expertTakes,
      "BEARISH",
      BEARISH_REASON_THEMES,
    ),
  };
}

function buildPlayerIntelligenceSummary(player: PlayerWithIntelligenceData) {
  const sentimentCounts = countSentiments(player.playerMentions);
  const totalMentions =
    sentimentCounts.bullish + sentimentCounts.bearish + sentimentCounts.neutral;
  const latestMentionDate = getLatestDate(
    player.playerMentions.map((mention) => mention.createdAt),
  );
  const expertIds = new Set(
    player.expertTakes.map((take) => take.expertId).filter(Boolean),
  );
  const trendDirection =
    getTrendDirection({
      bullishCount: sentimentCounts.bullish,
      bearishCount: sentimentCounts.bearish,
      neutralCount: sentimentCounts.neutral,
    });
  const score = calculateIntelligenceScore({
    totalMentions,
    bullishCount: sentimentCounts.bullish,
    bearishCount: sentimentCounts.bearish,
    expertCount: expertIds.size,
    latestMentionDate,
  });

  return {
    playerId: player.id,
    fullName: player.fullName,
    position: player.position,
    team: player.team,
    totalMentions,
    bullishCount: sentimentCounts.bullish,
    bearishCount: sentimentCounts.bearish,
    neutralCount: sentimentCounts.neutral,
    latestMentionDate,
    trendDirection,
    intelligenceScore: score.score,
    intelligenceLabel: score.label,
    expertCount: expertIds.size,
    excludedHistoricalCount:
      "excludedHistoricalCount" in player
        ? Number(player.excludedHistoricalCount)
        : 0,
  };
}

function applyIntelligenceFilters(
  player: PlayerWithIntelligenceData,
  filters: {
    targetSeason: number;
    freshness: "ALL" | ContentFreshnessLabel;
    includeHistorical: boolean;
  },
) {
  const playerMentions = player.playerMentions.filter((mention) =>
    contentFreshnessMatchesFilters(getFreshnessRecord(mention), filters),
  );
  const expertTakes = player.expertTakes.filter((take) =>
    contentFreshnessMatchesFilters(getFreshnessRecord(take), filters),
  );

  return {
    ...player,
    playerMentions,
    expertTakes,
    excludedHistoricalCount:
      player.playerMentions.length - playerMentions.length,
  };
}

function contentFreshnessMatchesFilters(
  content:
    | {
        contentSeason: number | null;
        freshnessLabel: string;
        includeInCurrentAnalysis: boolean;
      }
    | null
    | undefined,
  filters: {
    targetSeason: number;
    freshness: "ALL" | ContentFreshnessLabel;
    includeHistorical: boolean;
  },
) {
  if (!content) return false;

  if (!filters.includeHistorical && !content.includeInCurrentAnalysis) {
    return false;
  }

  if (
    filters.freshness !== "ALL" &&
    content.freshnessLabel !== filters.freshness
  ) {
    return false;
  }

  if (
    !filters.includeHistorical &&
    filters.freshness === "CURRENT" &&
    content.contentSeason !== filters.targetSeason
  ) {
    return false;
  }

  return true;
}

function getFreshnessRecord(record: {
  transcript?:
    | {
        contentSeason: number | null;
        freshnessLabel: string;
        includeInCurrentAnalysis: boolean;
      }
    | null;
  sourceVideo?:
    | {
        contentSeason: number | null;
        freshnessLabel: string;
        includeInCurrentAnalysis: boolean;
      }
    | null;
}) {
  return record.transcript ?? record.sourceVideo ?? null;
}

function normalizeIntelligenceFilters(filters: PlayerIntelligenceDirectoryFilters) {
  const targetSeason = normalizeTargetSeason(filters.targetSeason);
  const normalizedFreshness = String(filters.freshness ?? "ALL").toUpperCase();
  const freshnessOptions = new Set<string>(["ALL", ...getFreshnessOptions()]);

  return {
    targetSeason,
    freshness: freshnessOptions.has(normalizedFreshness)
      ? (normalizedFreshness as "ALL" | ContentFreshnessLabel)
      : ("ALL" as const),
    includeHistorical: Boolean(filters.includeHistorical),
  };
}

export function calculateIntelligenceScore({
  totalMentions,
  bullishCount,
  bearishCount,
  expertCount,
  latestMentionDate,
}: {
  totalMentions: number;
  bullishCount: number;
  bearishCount: number;
  expertCount: number;
  latestMentionDate: Date | null;
}) {
  if (totalMentions === 0) {
    return {
      score: 50,
      label: "Neutral" as IntelligenceLabel,
    };
  }

  const bullishRatio = bullishCount / totalMentions;
  const bearishRatio = bearishCount / totalMentions;
  const sentimentMargin = bullishRatio - bearishRatio;
  const sampleConfidence = Math.min(totalMentions, 8) / 8;
  const directionSign =
    sentimentMargin === 0 ? 0 : sentimentMargin > 0 ? 1 : -1;
  const mentionStrength = (Math.min(totalMentions, 20) / 20) * 7;
  const expertStrength = (Math.min(expertCount, 5) / 5) * 5;
  const recentStrength = getRecentActivityStrength(latestMentionDate);
  const rawScore =
    50 +
    sentimentMargin * 35 * sampleConfidence +
    directionSign * (mentionStrength + expertStrength + recentStrength);
  const score = clamp(Math.round(rawScore), 0, 100);

  return {
    score,
    label: getIntelligenceLabel(score),
  };
}

function countSentiments(
  items: Array<{
    sentiment: string;
  }>,
) {
  return {
    bullish: items.filter((item) => item.sentiment === "BULLISH").length,
    bearish: items.filter((item) => item.sentiment === "BEARISH").length,
    neutral: items.filter((item) => item.sentiment === "NEUTRAL").length,
  };
}

function getSentimentPercentages(summary: {
  totalMentions: number;
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
}) {
  if (summary.totalMentions === 0) {
    return {
      bullish: 0,
      bearish: 0,
      neutral: 0,
    };
  }

  return {
    bullish: Math.round((summary.bullishCount / summary.totalMentions) * 100),
    bearish: Math.round((summary.bearishCount / summary.totalMentions) * 100),
    neutral: Math.round((summary.neutralCount / summary.totalMentions) * 100),
  };
}

function getDominantSentiment(sentimentCounts: {
  bullish: number;
  bearish: number;
  neutral: number;
}) {
  if (
    sentimentCounts.bullish > sentimentCounts.bearish &&
    sentimentCounts.bullish >= sentimentCounts.neutral
  ) {
    return "BULLISH";
  }

  if (
    sentimentCounts.bearish > sentimentCounts.bullish &&
    sentimentCounts.bearish >= sentimentCounts.neutral
  ) {
    return "BEARISH";
  }

  if (sentimentCounts.bullish > 0 && sentimentCounts.bearish > 0) {
    return "MIXED";
  }

  return "NEUTRAL";
}

function getTrendDirection({
  bullishCount,
  bearishCount,
  neutralCount,
}: {
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
}): TrendDirection {
  if (bullishCount > bearishCount) return "BULLISH";
  if (bearishCount > bullishCount) return "BEARISH";
  if (bullishCount > 0 && bearishCount > 0) return "MIXED";
  if (neutralCount > 0) return "NEUTRAL";

  return "NEUTRAL";
}

function getReasonThemes<
  TTheme extends {
    key: string;
    label: string;
    keywords: readonly string[];
  },
>(
  takes: Array<{
    sentiment: string;
    takeType: string;
    summary: string;
    excerpt: string;
  }>,
  sentiment: Sentiment,
  themes: readonly TTheme[],
) {
  return themes
    .map((theme) => {
      const count = takes.filter((take) => {
        const searchableText = normalizeForSearch(
          `${take.takeType} ${take.summary} ${take.excerpt}`,
        );

        return (
          take.sentiment === sentiment &&
          theme.keywords.some((keyword) =>
            searchableText.includes(normalizeForSearch(keyword)),
          )
        );
      }).length;

      return {
        key: theme.key,
        label: theme.label,
        count,
      };
    })
    .filter((theme) => theme.count > 0)
    .sort((themeA, themeB) => themeB.count - themeA.count);
}

function getMentionVolumeOverTime(
  takes: Array<{
    createdAt: Date;
    sourceVideo: {
      publishedAt: Date | null;
    };
  }>,
) {
  const volumeByDate = new Map<string, number>();

  for (const take of takes) {
    const date = formatDateKey(take.sourceVideo.publishedAt ?? take.createdAt);
    volumeByDate.set(date, (volumeByDate.get(date) ?? 0) + 1);
  }

  return Array.from(volumeByDate.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((entryA, entryB) => entryA.date.localeCompare(entryB.date));
}

function getLatestDate(dates: Date[]) {
  const latestTime = dates.reduce(
    (latest, date) => Math.max(latest, date.getTime()),
    0,
  );

  return latestTime > 0 ? new Date(latestTime) : null;
}

function getRecentActivityStrength(latestMentionDate: Date | null) {
  if (!latestMentionDate) return 0;

  const ageInDays =
    (Date.now() - latestMentionDate.getTime()) / (1000 * 60 * 60 * 24);

  if (ageInDays <= 7) return 8;
  if (ageInDays <= 30) return 5;
  if (ageInDays <= 90) return 2;

  return 0;
}

function getIntelligenceLabel(score: number): IntelligenceLabel {
  if (score >= 75) return "Strong Bullish";
  if (score >= 60) return "Bullish";
  if (score > 40) return "Neutral";
  if (score >= 25) return "Bearish";

  return "Strong Bearish";
}

function normalizeForSearch(value?: string | null) {
  return value?.toLowerCase().trim() ?? "";
}

function isNonEmptyString(value: string | null | undefined): value is string {
  return Boolean(value);
}

function getDateTime(date: Date | null) {
  return date?.getTime() ?? 0;
}

function formatDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
