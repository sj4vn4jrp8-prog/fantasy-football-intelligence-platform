import { getExpertConsensusDashboard } from "@/knowledge-brain/expert-consensus";
import { normalizeTargetSeason } from "@/knowledge-brain/freshness";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export type ExpertAccuracyFilters = {
  targetSeason?: number | string | null;
  includeHistorical?: boolean;
};

export type AccuracyStatus =
  | "Not Ready"
  | "Tracking"
  | "Ready For Grading"
  | "Graded";

type ConsensusRow = Awaited<
  ReturnType<typeof getExpertConsensusDashboard>
>["rows"][number];

async function getExpertAccuracyData(filters: ReturnType<typeof normalizeFilters>) {
  const transcriptWhere = buildTranscriptWhere(filters);

  return db.expert.findMany({
    include: {
      channels: {
        orderBy: { createdAt: "asc" },
      },
      sourceVideos: {
        where: {
          transcript: {
            is: transcriptWhere,
          },
        },
        include: {
          transcript: {
            select: {
              id: true,
              contentSeason: true,
              freshnessLabel: true,
              includeInCurrentAnalysis: true,
            },
          },
        },
        orderBy: { publishedAt: "desc" },
      },
      expertTakes: {
        where: {
          transcript: {
            is: transcriptWhere,
          },
        },
        include: {
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
              id: true,
              title: true,
              url: true,
              publishedAt: true,
            },
          },
          transcript: {
            select: {
              id: true,
              contentSeason: true,
              freshnessLabel: true,
              includeInCurrentAnalysis: true,
              publishDate: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      _count: {
        select: {
          expertTakes: true,
          sourceVideos: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });
}

type ExpertAccuracyData = Awaited<
  ReturnType<typeof getExpertAccuracyData>
>[number];
type ExpertTakeForAccuracy = ExpertAccuracyData["expertTakes"][number];

export async function getExpertAccuracyDirectory(
  filters: ExpertAccuracyFilters = {},
) {
  const normalizedFilters = normalizeFilters(filters);
  const [experts, consensus] = await Promise.all([
    getExpertAccuracyData(normalizedFilters),
    getExpertConsensusDashboard({
      includeHistorical: normalizedFilters.includeHistorical,
      targetSeason: normalizedFilters.targetSeason,
    }),
  ]);
  const rows = experts.map((expert) =>
    buildExpertAccuracySummary(expert, normalizedFilters, consensus.rows),
  );

  return {
    experts: rows.sort(
      (expertA, expertB) =>
        expertB.takeCount - expertA.takeCount ||
        expertA.expertName.localeCompare(expertB.expertName),
    ),
    widgets: buildExpertAccuracyWidgets(rows),
    filters: normalizedFilters,
  };
}

export async function getExpertAccuracyProfile(
  expertId: string,
  filters: ExpertAccuracyFilters = {},
) {
  const directory = await getExpertAccuracyDirectory(filters);
  const expert = directory.experts.find((row) => row.expertId === expertId);

  if (!expert) return null;

  return {
    expert,
    filters: directory.filters,
  };
}

function buildExpertAccuracySummary(
  expert: ExpertAccuracyData,
  filters: ReturnType<typeof normalizeFilters>,
  consensusRows: ConsensusRow[],
) {
  const takes = expert.expertTakes;
  const sentimentCounts = countBy(takes, (take) => take.sentiment);
  const takeTypeBreakdown = countBy(takes, (take) => take.takeType);
  const positionCoverage = countBy(
    takes.filter((take) => take.player),
    (take) => take.player?.position ?? "Unknown",
  );
  const playerIds = new Set(
    takes.map((take) => take.playerId).filter((id): id is string => Boolean(id)),
  );
  const currentSeasonTakes = takes.filter(
    (take) =>
      take.transcript?.contentSeason === filters.targetSeason &&
      take.transcript?.includeInCurrentAnalysis,
  );
  const actionableTakes = takes.filter(
    (take) => take.playerId && take.takeType !== "UNCATEGORIZED",
  );
  const highConvictionTakes = takes
    .filter((take) => take.confidence >= 0.7)
    .slice(0, 5)
    .map(formatTake);
  const accuracyStatus = getAccuracyStatus(takes.length);
  const consensusAgreement = calculateConsensusAgreement(takes, consensusRows);

  return {
    expertId: expert.id,
    expertName: expert.name,
    slug: expert.slug,
    active: expert.active,
    notes: expert.notes,
    tags: expert.tags,
    channels: expert.channels.map((channel) => ({
      id: channel.id,
      platform: channel.platform,
      name: channel.name,
      url: channel.url,
      active: channel.active,
    })),
    totalTakes: expert._count.expertTakes,
    totalTranscripts: expert._count.sourceVideos,
    transcriptCount: expert.sourceVideos.length,
    takeCount: takes.length,
    currentSeasonTakes: currentSeasonTakes.length,
    bullishTakes: getCount(sentimentCounts, "BULLISH"),
    bearishTakes: getCount(sentimentCounts, "BEARISH"),
    neutralTakes: getCount(sentimentCounts, "NEUTRAL"),
    playerCoverageCount: playerIds.size,
    positionCoverage,
    takeTypeBreakdown,
    recentTakes: takes.slice(0, 12).map(formatTake),
    highConvictionTakes,
    mostDiscussedPlayers: getPlayerSignalRows(takes),
    bullishPlayers: getPlayerSignalRows(
      takes.filter((take) => take.sentiment === "BULLISH"),
    ),
    bearishPlayers: getPlayerSignalRows(
      takes.filter((take) => take.sentiment === "BEARISH"),
    ),
    consensusAgreement,
    accuracyStatus,
    accuracyStatusDetail: getAccuracyStatusDetail(accuracyStatus, takes.length),
    takeTracking: {
      awaitingOutcomeGrading: takes.length,
      eligibleForFutureGrading: actionableTakes.length,
      highConvictionCount: highConvictionTakes.length,
      mostActivePositions: positionCoverage.slice(0, 4),
      mostActiveTakeTypes: takeTypeBreakdown.slice(0, 4),
    },
  };
}

function buildExpertAccuracyWidgets(
  experts: ReturnType<typeof buildExpertAccuracySummary>[],
) {
  return {
    mostActiveExperts: [...experts]
      .sort(
        (expertA, expertB) =>
          expertB.takeCount - expertA.takeCount ||
          expertA.expertName.localeCompare(expertB.expertName),
      )
      .slice(0, 5),
    mostBullishExperts: [...experts]
      .sort(
        (expertA, expertB) =>
          expertB.bullishTakes - expertA.bullishTakes ||
          expertB.takeCount - expertA.takeCount,
      )
      .slice(0, 5),
    mostBearishExperts: [...experts]
      .sort(
        (expertA, expertB) =>
          expertB.bearishTakes - expertA.bearishTakes ||
          expertB.takeCount - expertA.takeCount,
      )
      .slice(0, 5),
    readyForGrading: experts
      .filter((expert) => expert.accuracyStatus === "Ready For Grading")
      .sort(
        (expertA, expertB) =>
          expertB.takeTracking.eligibleForFutureGrading -
            expertA.takeTracking.eligibleForFutureGrading ||
          expertB.takeCount - expertA.takeCount,
      )
      .slice(0, 5),
  };
}

function getAccuracyStatus(takeCount: number): AccuracyStatus {
  if (takeCount < 10) return "Not Ready";
  if (takeCount >= 25) return "Ready For Grading";

  return "Tracking";
}

function getAccuracyStatusDetail(status: AccuracyStatus, takeCount: number) {
  if (status === "Not Ready") {
    return `Needs ${10 - takeCount} more take${
      10 - takeCount === 1 ? "" : "s"
    } to enter tracking.`;
  }

  if (status === "Tracking") {
    return "Enough takes to track, but no player outcomes have been graded yet.";
  }

  if (status === "Ready For Grading") {
    return "Enough takes are stored for future outcome grading once outcome data is added.";
  }

  return "Outcome grading has been calculated.";
}

function calculateConsensusAgreement(
  takes: ExpertTakeForAccuracy[],
  consensusRows: ConsensusRow[],
) {
  const consensusByPlayer = new Map(
    consensusRows
      .map((row) => [row.playerId, getConsensusDirection(row.consensusLabel)] as const)
      .filter(([, direction]) => direction),
  );
  const takesByPlayer = groupBy(
    takes.filter((take) => take.playerId && consensusByPlayer.has(take.playerId)),
    (take) => take.playerId ?? "",
  );
  let aligned = 0;
  let eligible = 0;

  for (const [playerId, playerTakes] of takesByPlayer) {
    const consensusDirection = consensusByPlayer.get(playerId);
    const expertStance = getExpertTakeStance(playerTakes);

    if (!consensusDirection) continue;

    eligible += 1;

    if (expertStance === consensusDirection) {
      aligned += 1;
    }
  }

  return {
    aligned,
    eligible,
    rate: eligible > 0 ? Math.round((aligned / eligible) * 100) : null,
  };
}

function getConsensusDirection(label: string) {
  if (label === "Strong Bullish" || label === "Bullish") return "BULLISH";
  if (label === "Strong Bearish" || label === "Bearish") return "BEARISH";

  return null;
}

function getExpertTakeStance(takes: ExpertTakeForAccuracy[]) {
  const sentimentCounts = countBy(takes, (take) => take.sentiment);
  const bullish = getCount(sentimentCounts, "BULLISH");
  const bearish = getCount(sentimentCounts, "BEARISH");
  const neutral = getCount(sentimentCounts, "NEUTRAL");

  if (bullish > bearish && bullish >= neutral) return "BULLISH";
  if (bearish > bullish && bearish >= neutral) return "BEARISH";

  return "NEUTRAL";
}

function getPlayerSignalRows(takes: ExpertTakeForAccuracy[]) {
  const playerGroups = groupBy(
    takes.filter((take) => take.player),
    (take) => take.playerId ?? "",
  );

  return Array.from(playerGroups.values())
    .map((playerTakes) => {
      const firstTake = playerTakes[0];

      return {
        playerId: firstTake.player?.id ?? "",
        fullName: firstTake.player?.fullName ?? "Unknown player",
        position: firstTake.player?.position ?? "--",
        team: firstTake.player?.team ?? null,
        mentionCount: playerTakes.length,
        latestTake: formatTake(firstTake),
      };
    })
    .sort(
      (playerA, playerB) =>
        playerB.mentionCount - playerA.mentionCount ||
        playerA.fullName.localeCompare(playerB.fullName),
    )
    .slice(0, 8);
}

function formatTake(take: ExpertTakeForAccuracy) {
  return {
    id: take.id,
    playerId: take.player?.id ?? null,
    playerName: take.player?.fullName ?? "Unknown player",
    position: take.player?.position ?? "--",
    team: take.player?.team ?? null,
    sentiment: take.sentiment,
    takeType: take.takeType,
    summary: take.summary,
    excerpt: take.excerpt,
    confidence: take.confidence,
    sourceTitle: take.sourceVideo.title,
    sourceUrl: take.sourceVideo.url,
    publishedAt: take.sourceVideo.publishedAt,
    createdAt: take.createdAt,
    freshnessLabel: take.transcript?.freshnessLabel ?? "STALE",
  };
}

function countBy<TItem>(
  items: TItem[],
  getKey: (item: TItem) => string,
) {
  const counts = new Map<string, number>();

  for (const item of items) {
    const key = getKey(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, count }))
    .sort(
      (entryA, entryB) =>
        entryB.count - entryA.count || entryA.key.localeCompare(entryB.key),
    );
}

function getCount(counts: Array<{ key: string; count: number }>, key: string) {
  return counts.find((entry) => entry.key === key)?.count ?? 0;
}

function groupBy<TItem>(
  items: TItem[],
  getKey: (item: TItem) => string,
) {
  const groups = new Map<string, TItem[]>();

  for (const item of items) {
    const key = getKey(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  return groups;
}

function buildTranscriptWhere({
  targetSeason,
  includeHistorical,
}: ReturnType<typeof normalizeFilters>): Prisma.TranscriptWhereInput {
  if (includeHistorical) return {};

  return {
    includeInCurrentAnalysis: true,
    contentSeason: targetSeason,
  };
}

function normalizeFilters(filters: ExpertAccuracyFilters) {
  return {
    targetSeason: normalizeTargetSeason(filters.targetSeason),
    includeHistorical: Boolean(filters.includeHistorical),
  };
}
