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

export type ConsensusOpinionSource =
  | "TRANSCRIPT_PLAYER_SUMMARY"
  | "EXPERT_TAKE_FALLBACK";

export type ConsensusOpinionSignal = {
  id: string;
  expertId: string;
  playerId: string;
  sourceVideoId: string;
  sourceType: ConsensusOpinionSource;
  stance: ExpertStance;
  confidence: number;
  summary: string;
  excerpt: string;
  takeType: string;
  evidenceCount: number;
  opinionSignalCount: number;
  createdAt: Date;
  publishedAt: Date | null;
  publishDate: Date | null;
  freshnessLabel: string;
  expert: {
    id: string;
    name: string;
  };
  player: {
    id: string;
    fullName: string;
    position: string;
    team: string | null;
  };
  sourceVideo: {
    title: string;
    url: string | null;
    publishedAt: Date | null;
  };
};

const CONSENSUS_SUMMARY_INCLUDE = {
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
      id: true,
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
  evidence: {
    take: 3,
    orderBy: {
      createdAt: "asc",
    },
  },
} satisfies Prisma.TranscriptPlayerSummaryInclude;

const CONSENSUS_TAKE_INCLUDE = {
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
      id: true,
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
} satisfies Prisma.ExpertTakeInclude;

type TranscriptSummaryForConsensus = Prisma.TranscriptPlayerSummaryGetPayload<{
  include: typeof CONSENSUS_SUMMARY_INCLUDE;
}>;

type ExpertTakeForConsensus = Prisma.ExpertTakeGetPayload<{
  include: typeof CONSENSUS_TAKE_INCLUDE;
}>;

export async function getExpertConsensusDashboard(
  filters: ExpertConsensusFilters = {},
) {
  const normalizedFilters = normalizeConsensusFilters(filters);
  const opinionSignals = await getConsensusOpinionSignals(normalizedFilters);
  const rows = buildConsensusRows(opinionSignals)
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
  const opinionSignals = await getConsensusOpinionSignals(
    normalizedFilters,
    playerId,
  );
  const row = buildConsensusRows(opinionSignals)[0];

  return {
    row,
    experts: row?.expertBreakdown ?? [],
  };
}

export async function getConsensusOpinionSignals(
  filters: ReturnType<typeof normalizeConsensusFilters>,
  playerId?: string,
): Promise<ConsensusOpinionSignal[]> {
  const transcriptWhere = buildTranscriptWhere(filters);
  const [summaries, fallbackTakes] = await Promise.all([
    db.transcriptPlayerSummary.findMany({
      where: {
        playerId,
        reviewStatus: "APPROVED",
        transcript: {
          is: transcriptWhere,
        },
      },
      include: CONSENSUS_SUMMARY_INCLUDE,
      orderBy: [{ createdAt: "desc" }],
    }),
    db.expertTake.findMany({
      where: {
        playerId: playerId ?? { not: null },
        reviewStatus: "APPROVED",
        transcript: {
          is: transcriptWhere,
        },
      },
      include: CONSENSUS_TAKE_INCLUDE,
      orderBy: [{ createdAt: "desc" }],
    }),
  ]);
  const summaryExpertPlayerKeys = new Set(
    summaries.map((summary) => getExpertPlayerKey(summary.expertId, summary.playerId)),
  );
  const summarySignals = summaries.map(mapSummaryToOpinionSignal);
  const fallbackSignals = mapFallbackTakesToOpinionSignals(
    fallbackTakes.filter((take) => take.player),
  ).filter(
    (signal) =>
      !summaryExpertPlayerKeys.has(
        getExpertPlayerKey(signal.expertId, signal.playerId),
      ),
  );

  return [...summarySignals, ...fallbackSignals].sort(sortOpinionSignals);
}

function buildConsensusRows(opinionSignals: ConsensusOpinionSignal[]) {
  const signalsByPlayer = new Map<string, ConsensusOpinionSignal[]>();

  for (const signal of opinionSignals) {
    signalsByPlayer.set(signal.playerId, [
      ...(signalsByPlayer.get(signal.playerId) ?? []),
      signal,
    ]);
  }

  return Array.from(signalsByPlayer.values()).map(buildPlayerConsensusRow);
}

function buildPlayerConsensusRow(opinionSignals: ConsensusOpinionSignal[]) {
  const player = opinionSignals[0]?.player;

  if (!player) {
    throw new Error("Cannot build expert consensus without a player.");
  }

  const expertBreakdown = buildExpertBreakdown(opinionSignals);
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
  const totalMentions = opinionSignals.reduce(
    (sum, signal) => sum + signal.opinionSignalCount,
    0,
  );
  const totalEvidenceCount = opinionSignals.reduce(
    (sum, signal) => sum + Math.max(1, signal.evidenceCount),
    0,
  );
  const summarySignalCount = opinionSignals.filter(
    (signal) => signal.sourceType === "TRANSCRIPT_PLAYER_SUMMARY",
  ).length;
  const fallbackSignalCount = opinionSignals.length - summarySignalCount;
  const latestTakeDate = getLatestDate(
    opinionSignals.map((signal) => signal.publishDate ?? signal.createdAt),
  );
  const latestSignal = opinionSignals[0];
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
    totalEvidenceCount,
    summarySignalCount,
    fallbackSignalCount,
    bullishExperts,
    bearishExperts,
    neutralExperts,
    consensusLabel,
    agreementScore,
    latestTakeDate,
    latestTake: latestSignal
      ? {
          id: latestSignal.id,
          summary: latestSignal.summary,
          excerpt: latestSignal.excerpt,
          sentiment: latestSignal.stance,
          takeType: latestSignal.takeType,
          expertName: latestSignal.expert.name,
          sourceTitle: latestSignal.sourceVideo.title,
          sourceUrl: latestSignal.sourceVideo.url,
          publishedAt: latestSignal.sourceVideo.publishedAt,
          createdAt: latestSignal.createdAt,
          freshnessLabel: latestSignal.freshnessLabel,
          publishDate: latestSignal.publishDate ?? latestSignal.publishedAt,
          sourceType: latestSignal.sourceType,
          evidenceCount: latestSignal.evidenceCount,
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

function buildExpertBreakdown(opinionSignals: ConsensusOpinionSignal[]) {
  const signalsByExpert = new Map<string, ConsensusOpinionSignal[]>();

  for (const signal of opinionSignals) {
    signalsByExpert.set(signal.expertId, [
      ...(signalsByExpert.get(signal.expertId) ?? []),
      signal,
    ]);
  }

  return Array.from(signalsByExpert.values())
    .map((expertSignals) => {
      const latestSignal = expertSignals[0];
      const bullishCount = expertSignals.filter(
        (signal) => signal.stance === "BULLISH",
      ).length;
      const bearishCount = expertSignals.filter(
        (signal) => signal.stance === "BEARISH",
      ).length;
      const neutralCount = expertSignals.filter(
        (signal) => signal.stance === "NEUTRAL" || signal.stance === "MIXED",
      ).length;
      const stance = getExpertStance({
        bullishCount,
        bearishCount,
        neutralCount,
      });
      const evidenceCount = expertSignals.reduce(
        (sum, signal) => sum + Math.max(1, signal.evidenceCount),
        0,
      );

      return {
        expertId: latestSignal.expert.id,
        expertName: latestSignal.expert.name,
        mentionCount: expertSignals.length,
        evidenceCount,
        summarySignalCount: expertSignals.filter(
          (signal) => signal.sourceType === "TRANSCRIPT_PLAYER_SUMMARY",
        ).length,
        fallbackSignalCount: expertSignals.filter(
          (signal) => signal.sourceType === "EXPERT_TAKE_FALLBACK",
        ).length,
        bullishCount,
        bearishCount,
        neutralCount,
        stance,
        latestTake: {
          id: latestSignal.id,
          summary: latestSignal.summary,
          excerpt: latestSignal.excerpt,
          sentiment: latestSignal.stance,
          takeType: latestSignal.takeType,
          sourceTitle: latestSignal.sourceVideo.title,
          sourceUrl: latestSignal.sourceVideo.url,
          publishedAt: latestSignal.sourceVideo.publishedAt,
          createdAt: latestSignal.createdAt,
          sourceType: latestSignal.sourceType,
          evidenceCount: latestSignal.evidenceCount,
        },
      };
    })
    .sort(
      (expertA, expertB) =>
        expertB.mentionCount - expertA.mentionCount ||
        expertB.evidenceCount - expertA.evidenceCount ||
        expertA.expertName.localeCompare(expertB.expertName),
    );
}

function mapSummaryToOpinionSignal(
  summary: TranscriptSummaryForConsensus,
): ConsensusOpinionSignal {
  return {
    id: summary.id,
    expertId: summary.expertId,
    playerId: summary.playerId,
    sourceVideoId: summary.sourceVideoId,
    sourceType: "TRANSCRIPT_PLAYER_SUMMARY",
    stance: summary.stance,
    confidence: summary.confidence,
    summary: summary.summary,
    excerpt: summary.evidence[0]?.excerpt ?? summary.summary,
    takeType: summary.takeTypes[0] ?? "SUMMARY",
    evidenceCount: Math.max(1, summary.evidenceCount),
    opinionSignalCount: 1,
    createdAt: summary.createdAt,
    publishedAt: summary.sourceVideo.publishedAt,
    publishDate: summary.transcript?.publishDate ?? summary.sourceVideo.publishedAt,
    freshnessLabel: summary.transcript?.freshnessLabel ?? "STALE",
    expert: summary.expert,
    player: summary.player,
    sourceVideo: summary.sourceVideo,
  };
}

function mapFallbackTakesToOpinionSignals(
  takes: ExpertTakeForConsensus[],
): ConsensusOpinionSignal[] {
  const groups = new Map<string, ExpertTakeForConsensus[]>();

  for (const take of takes) {
    if (!take.player) continue;

    const key = [
      take.expertId,
      take.player.id,
      take.sourceVideoId,
      take.transcriptId ?? "no-transcript",
    ].join(":");
    groups.set(key, [...(groups.get(key) ?? []), take]);
  }

  return Array.from(groups.values()).map((groupedTakes) => {
    const latestTake = groupedTakes.sort(sortTakesByRecency)[0];
    const player = latestTake.player;

    if (!player) {
      throw new Error("Cannot build fallback consensus signal without a player.");
    }

    const stanceCounts = countStances(
      groupedTakes.map((take) => ({ stance: take.sentiment })),
    );

    return {
      id: `fallback:${latestTake.expertId}:${player.id}:${latestTake.sourceVideoId}:${latestTake.transcriptId ?? "no-transcript"}`,
      expertId: latestTake.expertId,
      playerId: player.id,
      sourceVideoId: latestTake.sourceVideoId,
      sourceType: "EXPERT_TAKE_FALLBACK",
      stance: getInternalStance(stanceCounts),
      confidence: average(groupedTakes.map((take) => take.confidence)),
      summary: latestTake.summary,
      excerpt: latestTake.excerpt,
      takeType: latestTake.takeType,
      evidenceCount: groupedTakes.length,
      opinionSignalCount: 1,
      createdAt: latestTake.createdAt,
      publishedAt: latestTake.sourceVideo.publishedAt,
      publishDate:
        latestTake.transcript?.publishDate ?? latestTake.sourceVideo.publishedAt,
      freshnessLabel: latestTake.transcript?.freshnessLabel ?? "STALE",
      expert: latestTake.expert,
      player,
      sourceVideo: latestTake.sourceVideo,
    };
  });
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
  const missingSignals = Math.max(0, 3 - totalMentions);
  const reasonParts = [];

  if (missingExperts > 0) {
    reasonParts.push(
      `${missingExperts} more expert${missingExperts === 1 ? "" : "s"}`,
    );
  }

  if (missingSignals > 0) {
    reasonParts.push(
      `${missingSignals} more opinion signal${missingSignals === 1 ? "" : "s"}`,
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

function getExpertPlayerKey(expertId: string, playerId: string) {
  return `${expertId}:${playerId}`;
}

function sortOpinionSignals(
  signalA: ConsensusOpinionSignal,
  signalB: ConsensusOpinionSignal,
) {
  return (
    getDateTime(signalB.publishDate ?? signalB.createdAt) -
      getDateTime(signalA.publishDate ?? signalA.createdAt) ||
    signalA.id.localeCompare(signalB.id)
  );
}

function sortTakesByRecency(
  takeA: ExpertTakeForConsensus,
  takeB: ExpertTakeForConsensus,
) {
  return (
    getDateTime(takeB.transcript?.publishDate ?? takeB.sourceVideo.publishedAt ?? takeB.createdAt) -
      getDateTime(takeA.transcript?.publishDate ?? takeA.sourceVideo.publishedAt ?? takeA.createdAt) ||
    takeA.id.localeCompare(takeB.id)
  );
}

function countStances(items: Array<{ stance: string }>) {
  return {
    bullish: items.filter((item) => item.stance === "BULLISH").length,
    bearish: items.filter((item) => item.stance === "BEARISH").length,
    mixed: items.filter((item) => item.stance === "MIXED").length,
    neutral: items.filter((item) => item.stance === "NEUTRAL").length,
  };
}

function getInternalStance(
  counts: ReturnType<typeof countStances>,
): ExpertStance {
  if (counts.bullish === counts.bearish && counts.bullish > 0) return "MIXED";
  if (counts.bullish > counts.bearish && counts.bullish >= counts.neutral) {
    return "BULLISH";
  }
  if (counts.bearish > counts.bullish && counts.bearish >= counts.neutral) {
    return "BEARISH";
  }
  if (counts.mixed > 0 && counts.bullish + counts.bearish > 0) return "MIXED";

  return "NEUTRAL";
}

function normalizeOptionalString(value?: string | null) {
  const trimmed = value?.trim();

  return trimmed ? trimmed : undefined;
}

function getLatestDate(dates: Array<Date | null>) {
  const latestTime = dates.reduce(
    (latest, date) => Math.max(latest, date?.getTime() ?? 0),
    0,
  );

  return latestTime > 0 ? new Date(latestTime) : null;
}

function getDateTime(value: Date | null) {
  return value?.getTime() ?? 0;
}

function average(values: number[]) {
  if (values.length === 0) return 0;

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function isNonEmptyString(value: string | null | undefined): value is string {
  return Boolean(value);
}
