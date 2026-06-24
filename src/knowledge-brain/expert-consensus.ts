import { db } from "@/lib/db";
import { normalizeTargetSeason } from "@/knowledge-brain/freshness";
import type { Prisma } from "@/generated/prisma/client";

export type ExpertStance =
  | "BULLISH"
  | "BEARISH"
  | "NEUTRAL"
  | "MIXED";

export type ConsensusLabel =
  | "Strong Bullish"
  | "Bullish"
  | "Split"
  | "Bearish"
  | "Strong Bearish"
  | "Not Enough Data";

export type ExpertConsensusFilters = {
  targetSeason?: number | string | null;
  includeHistorical?: boolean;
  position?: string | null;
  team?: string | null;
  consensusLabel?: string | null;
};

type ExpertTakeForConsensus = {
  id: string;
  expertId: string;
  sentiment: string;
  summary: string;
  excerpt: string;
  takeType: string;
  createdAt: Date;
  expert: {
    id: string;
    name: string;
  };
  player: {
    id: string;
    fullName: string;
    position: string;
    team: string | null;
  } | null;
  sourceVideo: {
    title: string;
    url: string | null;
    publishedAt: Date | null;
  };
  transcript: {
    includeInCurrentAnalysis: boolean;
    contentSeason: number | null;
    freshnessLabel: string;
    publishDate: Date | null;
  } | null;
};

export async function getExpertConsensusDashboard(
  filters: ExpertConsensusFilters = {},
) {
  const normalizedFilters = normalizeConsensusFilters(filters);
  const takes = await db.expertTake.findMany({
    where: {
      playerId: { not: null },
      transcript: {
        is: buildTranscriptWhere(normalizedFilters),
      },
    },
    include: {
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
          includeInCurrentAnalysis: true,
          contentSeason: true,
          freshnessLabel: true,
          publishDate: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  const rows = buildConsensusRows(takes)
    .filter((row) =>
      normalizedFilters.position
        ? row.position.toLowerCase() === normalizedFilters.position.toLowerCase()
        : true,
    )
    .filter((row) =>
      normalizedFilters.team
        ? (row.team ?? "").toLowerCase() === normalizedFilters.team.toLowerCase()
        : true,
    )
    .filter((row) =>
      normalizedFilters.consensusLabel
        ? row.consensusLabel === normalizedFilters.consensusLabel
        : true,
    );
  const positionOptions = Array.from(
    new Set(rows.map((row) => row.position).filter(Boolean)),
  ).sort();
  const teamOptions = Array.from(
    new Set(rows.map((row) => row.team).filter(isNonEmptyString)),
  ).sort();

  return {
    rows: rows.sort(sortConsensusRows),
    positionOptions,
    teamOptions,
    consensusLabelOptions: getConsensusLabelOptions(),
    filters: normalizedFilters,
    widgets: buildConsensusWidgets(rows),
    earlySignals: buildEarlySignalGroups(rows),
  };
}

export async function getPlayerExpertConsensusBreakdown({
  playerId,
  targetSeason,
  includeHistorical,
}: {
  playerId: string;
  targetSeason?: number | string | null;
  includeHistorical?: boolean;
}) {
  const normalizedFilters = normalizeConsensusFilters({
    targetSeason,
    includeHistorical,
  });
  const takes = await db.expertTake.findMany({
    where: {
      playerId,
      transcript: {
        is: buildTranscriptWhere(normalizedFilters),
      },
    },
    include: {
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
          includeInCurrentAnalysis: true,
          contentSeason: true,
          freshnessLabel: true,
          publishDate: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  const row = buildConsensusRows(takes)[0];

  return {
    row,
    experts: row?.expertBreakdown ?? [],
  };
}

function buildConsensusRows(takes: ExpertTakeForConsensus[]) {
  const takesByPlayer = new Map<string, ExpertTakeForConsensus[]>();

  for (const take of takes) {
    if (!take.player) continue;

    const existingTakes = takesByPlayer.get(take.player.id) ?? [];
    existingTakes.push(take);
    takesByPlayer.set(take.player.id, existingTakes);
  }

  return Array.from(takesByPlayer.values()).map(buildPlayerConsensusRow);
}

function buildPlayerConsensusRow(takes: ExpertTakeForConsensus[]) {
  const player = takes[0]?.player;

  if (!player) {
    throw new Error("Cannot build expert consensus without a player.");
  }

  const expertBreakdown = buildExpertBreakdown(takes);
  const bullishExperts = expertBreakdown.filter(
    (expert) => expert.stance === "BULLISH",
  ).length;
  const bearishExperts = expertBreakdown.filter(
    (expert) => expert.stance === "BEARISH",
  ).length;
  const neutralExperts = expertBreakdown.filter(
    (expert) => expert.stance === "NEUTRAL",
  ).length;
  const totalExperts = expertBreakdown.length;
  const totalMentions = expertBreakdown.reduce(
    (sum, expert) => sum + expert.mentionCount,
    0,
  );
  const latestTakeDate = getLatestDate(takes.map((take) => take.createdAt));
  const latestTake = takes[0];
  const bullishMentions = expertBreakdown.reduce(
    (sum, expert) => sum + expert.bullishCount,
    0,
  );
  const bearishMentions = expertBreakdown.reduce(
    (sum, expert) => sum + expert.bearishCount,
    0,
  );
  const neutralMentions = expertBreakdown.reduce(
    (sum, expert) => sum + expert.neutralCount,
    0,
  );
  const majority = getMajorityStance({
    bullishExperts,
    bearishExperts,
    neutralExperts,
  });
  const majorityCount =
    majority === "BULLISH"
      ? bullishExperts
      : majority === "BEARISH"
        ? bearishExperts
        : neutralExperts;
  const agreementScore =
    totalExperts > 0 ? Math.round((majorityCount / totalExperts) * 100) : 0;
  const consensusLabel = getConsensusLabel({
    totalExperts,
    totalMentions,
    bullishExperts,
    bearishExperts,
    majority,
    agreementScore,
  });

  return {
    playerId: player.id,
    playerName: player.fullName,
    position: player.position,
    team: player.team,
    totalExperts,
    totalMentions,
    bullishExperts,
    bearishExperts,
    neutralExperts,
    consensusLabel,
    agreementScore,
    latestTakeDate,
    latestTake: latestTake
      ? {
          id: latestTake.id,
          summary: latestTake.summary,
          excerpt: latestTake.excerpt,
          sentiment: latestTake.sentiment,
          takeType: latestTake.takeType,
          expertName: latestTake.expert.name,
          sourceTitle: latestTake.sourceVideo.title,
          sourceUrl: latestTake.sourceVideo.url,
          publishedAt: latestTake.sourceVideo.publishedAt,
          createdAt: latestTake.createdAt,
          freshnessLabel: latestTake.transcript?.freshnessLabel ?? "STALE",
          publishDate:
            latestTake.transcript?.publishDate ??
            latestTake.sourceVideo.publishedAt,
        }
      : null,
    earlySignal: getEarlySignal({
      totalExperts,
      totalMentions,
      bullishMentions,
      bearishMentions,
      neutralMentions,
    }),
    expertBreakdown,
  };
}

function buildExpertBreakdown(takes: ExpertTakeForConsensus[]) {
  const takesByExpert = new Map<string, ExpertTakeForConsensus[]>();

  for (const take of takes) {
    const existingTakes = takesByExpert.get(take.expertId) ?? [];
    existingTakes.push(take);
    takesByExpert.set(take.expertId, existingTakes);
  }

  return Array.from(takesByExpert.values())
    .map((expertTakes) => {
      const latestTake = expertTakes[0];
      const bullishCount = expertTakes.filter(
        (take) => take.sentiment === "BULLISH",
      ).length;
      const bearishCount = expertTakes.filter(
        (take) => take.sentiment === "BEARISH",
      ).length;
      const neutralCount = expertTakes.filter(
        (take) => take.sentiment === "NEUTRAL",
      ).length;
      const stance = getExpertStance({
        bullishCount,
        bearishCount,
        neutralCount,
      });

      return {
        expertId: latestTake.expert.id,
        expertName: latestTake.expert.name,
        mentionCount: expertTakes.length,
        bullishCount,
        bearishCount,
        neutralCount,
        stance,
        latestTake: {
          id: latestTake.id,
          summary: latestTake.summary,
          excerpt: latestTake.excerpt,
          sentiment: latestTake.sentiment,
          takeType: latestTake.takeType,
          sourceTitle: latestTake.sourceVideo.title,
          sourceUrl: latestTake.sourceVideo.url,
          publishedAt: latestTake.sourceVideo.publishedAt,
          createdAt: latestTake.createdAt,
        },
      };
    })
    .sort(
      (expertA, expertB) =>
        expertB.mentionCount - expertA.mentionCount ||
        expertA.expertName.localeCompare(expertB.expertName),
    );
}

function getExpertStance({
  bullishCount,
  bearishCount,
  neutralCount,
}: {
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
}): ExpertStance {
  if (bullishCount === bearishCount && bullishCount > 0) return "MIXED";
  if (bullishCount > bearishCount && bullishCount >= neutralCount) {
    return "BULLISH";
  }
  if (bearishCount > bullishCount && bearishCount >= neutralCount) {
    return "BEARISH";
  }

  return "NEUTRAL";
}

function getMajorityStance({
  bullishExperts,
  bearishExperts,
  neutralExperts,
}: {
  bullishExperts: number;
  bearishExperts: number;
  neutralExperts: number;
}) {
  if (bullishExperts >= bearishExperts && bullishExperts >= neutralExperts) {
    return "BULLISH" as const;
  }
  if (bearishExperts >= bullishExperts && bearishExperts >= neutralExperts) {
    return "BEARISH" as const;
  }

  return "NEUTRAL" as const;
}

function getConsensusLabel({
  totalExperts,
  totalMentions,
  bullishExperts,
  bearishExperts,
  majority,
  agreementScore,
}: {
  totalExperts: number;
  totalMentions: number;
  bullishExperts: number;
  bearishExperts: number;
  majority: "BULLISH" | "BEARISH" | "NEUTRAL";
  agreementScore: number;
}): ConsensusLabel {
  if (totalExperts < 2 || totalMentions < 3) return "Not Enough Data";

  const bullishBearishSpread = Math.abs(bullishExperts - bearishExperts);

  if (bullishExperts > 0 && bearishExperts > 0 && bullishBearishSpread <= 1) {
    return "Split";
  }

  if (agreementScore < 50 || majority === "NEUTRAL") return "Split";

  if (majority === "BULLISH") {
    return agreementScore >= 75 ? "Strong Bullish" : "Bullish";
  }

  return agreementScore >= 75 ? "Strong Bearish" : "Bearish";
}

function getEarlySignal({
  totalExperts,
  totalMentions,
  bullishMentions,
  bearishMentions,
  neutralMentions,
}: {
  totalExperts: number;
  totalMentions: number;
  bullishMentions: number;
  bearishMentions: number;
  neutralMentions: number;
}) {
  if (totalExperts >= 2 && totalMentions >= 3) {
    return null;
  }

  const sentimentLean = getSentimentLean({
    bullishMentions,
    bearishMentions,
    neutralMentions,
  });
  const missingExperts = Math.max(0, 2 - totalExperts);
  const missingMentions = Math.max(0, 3 - totalMentions);
  const reasonParts = [];

  if (missingExperts > 0) {
    reasonParts.push(
      `${missingExperts} more expert${missingExperts === 1 ? "" : "s"}`,
    );
  }

  if (missingMentions > 0) {
    reasonParts.push(
      `${missingMentions} more mention${missingMentions === 1 ? "" : "s"}`,
    );
  }

  return {
    sentimentLean,
    reason:
      reasonParts.length > 0
        ? `Needs ${reasonParts.join(" and ")} for true consensus.`
        : "Needs broader agreement before true consensus.",
  };
}

function getSentimentLean({
  bullishMentions,
  bearishMentions,
  neutralMentions,
}: {
  bullishMentions: number;
  bearishMentions: number;
  neutralMentions: number;
}) {
  if (bullishMentions > bearishMentions && bullishMentions >= neutralMentions) {
    return "Bullish" as const;
  }

  if (bearishMentions > bullishMentions && bearishMentions >= neutralMentions) {
    return "Bearish" as const;
  }

  return "Neutral" as const;
}

function buildEarlySignalGroups(rows: ReturnType<typeof buildConsensusRows>) {
  const earlySignalRows = rows
    .filter((row) => row.consensusLabel === "Not Enough Data" && row.earlySignal)
    .sort(sortEarlySignalRows);

  return {
    all: earlySignalRows,
    emergingBullish: earlySignalRows.filter(
      (row) => row.earlySignal?.sentimentLean === "Bullish",
    ),
    emergingBearish: earlySignalRows.filter(
      (row) => row.earlySignal?.sentimentLean === "Bearish",
    ),
    needsMoreExpertCoverage: earlySignalRows.filter(
      (row) => row.earlySignal?.sentimentLean === "Neutral",
    ),
  };
}

function sortEarlySignalRows(
  rowA: ReturnType<typeof buildPlayerConsensusRow>,
  rowB: ReturnType<typeof buildPlayerConsensusRow>,
) {
  return (
    rowB.totalMentions - rowA.totalMentions ||
    rowB.totalExperts - rowA.totalExperts ||
    getDateTime(rowB.latestTakeDate) - getDateTime(rowA.latestTakeDate) ||
    rowA.playerName.localeCompare(rowB.playerName)
  );
}

function buildConsensusWidgets(rows: ReturnType<typeof buildConsensusRows>) {
  const enoughDataRows = rows.filter(
    (row) => row.consensusLabel !== "Not Enough Data",
  );

  return {
    strongestConsensus: [...enoughDataRows]
      .sort(
        (rowA, rowB) =>
          rowB.agreementScore - rowA.agreementScore ||
          rowB.totalExperts - rowA.totalExperts,
      )
      .slice(0, 5),
    mostDivisivePlayers: [...rows]
      .filter((row) => row.consensusLabel === "Split")
      .sort(
        (rowA, rowB) =>
          rowB.totalExperts - rowA.totalExperts ||
          rowB.totalMentions - rowA.totalMentions,
      )
      .slice(0, 5),
    mostBullishAgreement: [...rows]
      .filter(
        (row) =>
          row.consensusLabel === "Strong Bullish" ||
          row.consensusLabel === "Bullish",
      )
      .sort(
        (rowA, rowB) =>
          rowB.agreementScore - rowA.agreementScore ||
          rowB.bullishExperts - rowA.bullishExperts,
      )
      .slice(0, 5),
    mostBearishAgreement: [...rows]
      .filter(
        (row) =>
          row.consensusLabel === "Strong Bearish" ||
          row.consensusLabel === "Bearish",
      )
      .sort(
        (rowA, rowB) =>
          rowB.agreementScore - rowA.agreementScore ||
          rowB.bearishExperts - rowA.bearishExperts,
      )
      .slice(0, 5),
  };
}

function sortConsensusRows(
  rowA: ReturnType<typeof buildPlayerConsensusRow>,
  rowB: ReturnType<typeof buildPlayerConsensusRow>,
) {
  return (
    rowB.totalExperts - rowA.totalExperts ||
    rowB.agreementScore - rowA.agreementScore ||
    getDateTime(rowB.latestTakeDate) - getDateTime(rowA.latestTakeDate) ||
    rowA.playerName.localeCompare(rowB.playerName)
  );
}

function buildTranscriptWhere(
  filters: ReturnType<typeof normalizeConsensusFilters>,
): Prisma.TranscriptWhereInput {
  const where: Prisma.TranscriptWhereInput = {};

  if (!filters.includeHistorical) {
    where.includeInCurrentAnalysis = true;
    where.contentSeason = filters.targetSeason;
  }

  return where;
}

function normalizeConsensusFilters(filters: ExpertConsensusFilters) {
  const targetSeason = normalizeTargetSeason(filters.targetSeason);
  const consensusLabel = normalizeConsensusLabel(filters.consensusLabel);

  return {
    targetSeason,
    includeHistorical: Boolean(filters.includeHistorical),
    position: normalizeOptionalString(filters.position),
    team: normalizeOptionalString(filters.team),
    consensusLabel,
  };
}

function normalizeConsensusLabel(value?: string | null) {
  const normalizedValue = normalizeOptionalString(value);

  if (!normalizedValue) return undefined;

  return getConsensusLabelOptions().find(
    (label) => label.toLowerCase() === normalizedValue.toLowerCase(),
  );
}

export function getConsensusLabelOptions() {
  return [
    "Strong Bullish",
    "Bullish",
    "Split",
    "Bearish",
    "Strong Bearish",
    "Not Enough Data",
  ] as const;
}

function normalizeOptionalString(value?: string | null) {
  const trimmed = value?.trim();

  return trimmed ? trimmed : undefined;
}

function getLatestDate(dates: Date[]) {
  const latestTime = dates.reduce(
    (latest, date) => Math.max(latest, date.getTime()),
    0,
  );

  return latestTime > 0 ? new Date(latestTime) : null;
}

function getDateTime(value: Date | null) {
  return value?.getTime() ?? 0;
}

function isNonEmptyString(value: string | null | undefined): value is string {
  return Boolean(value);
}
