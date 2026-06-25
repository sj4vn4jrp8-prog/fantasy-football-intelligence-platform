import { getExpertAccuracyDirectory } from "@/knowledge-brain/expert-accuracy";
import { getExpertConsensusDashboard } from "@/knowledge-brain/expert-consensus";
import { normalizeTargetSeason } from "@/knowledge-brain/freshness";
import { getPlayerIntelligenceDirectory } from "@/knowledge-brain/player-intelligence";
import { getWeightedConsensusDashboard } from "@/knowledge-brain/weighted-consensus";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

export type BrainSearchRequest = {
  question: string;
  targetSeason?: number | string | null;
  includeHistorical?: boolean;
};

export type BrainSearchAnswer = {
  question: string;
  queryType: BrainSearchQueryType;
  directAnswer: string;
  relevantPlayers: BrainSearchPlayer[];
  consensusRows: BrainSearchConsensusRow[];
  weightedConsensusRows: BrainSearchWeightedConsensusRow[];
  topExpertTakes: BrainSearchTake[];
  citations: BrainSearchCitation[];
  limitedDataNote: string | null;
  filters: {
    targetSeason: number;
    includeHistorical: boolean;
  };
  ai: {
    mode: "DETERMINISTIC";
    providerConfigured: false;
    note: string;
  };
};

type BrainSearchQueryType =
  | "PLAYER_OPINION"
  | "PLAYER_EXPERTS_BULLISH"
  | "BULLISH_PLAYERS"
  | "BEARISH_PLAYERS"
  | "DIVISIVE_PLAYERS"
  | "WEIGHTED_CONSENSUS"
  | "LATEST_TAKES"
  | "UNKNOWN";

type BrainSearchPlayer = {
  playerId: string;
  fullName: string;
  position: string;
  team: string | null;
  totalMentions: number;
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  expertCount: number;
  intelligenceScore: number;
  intelligenceLabel: string;
};

type BrainSearchConsensusRow = {
  playerId: string;
  playerName: string;
  position: string;
  team: string | null;
  totalExperts: number;
  bullishExperts: number;
  bearishExperts: number;
  neutralExperts: number;
  consensusLabel: string;
  agreementScore: number;
};

type BrainSearchWeightedConsensusRow = {
  playerId: string;
  playerName: string;
  position: string;
  team: string | null;
  rawConsensusLabel: string;
  weightedConsensusLabel: string;
  totalExperts: number;
  weightedBullishScore: number;
  weightedBearishScore: number;
  weightedNeutralScore: number;
  weightedAgreementScore: number;
  trustWeightedConfidence: number;
};

type BrainSearchTake = {
  id: string;
  playerId: string | null;
  playerName: string | null;
  sentiment: string;
  takeType: string;
  summary: string;
  excerpt: string;
  confidence: number;
  expertName: string;
  sourceTitle: string;
  sourceUrl: string | null;
  publishDate: string | null;
  freshnessLabel: string;
};

type BrainSearchCitation = {
  takeId: string;
  expertName: string;
  sourceTitle: string;
  sourceUrl: string | null;
  publishDate: string | null;
  freshnessLabel: string;
};

type ExpertTakeForBrainSearch = Prisma.ExpertTakeGetPayload<{
  include: typeof BRAIN_SEARCH_TAKE_INCLUDE;
}>;

const BRAIN_SEARCH_TAKE_INCLUDE = {
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
      publishDate: true,
      contentSeason: true,
      freshnessLabel: true,
      includeInCurrentAnalysis: true,
    },
  },
} satisfies Prisma.ExpertTakeInclude;

export async function answerKnowledgeBrainQuestion(
  request: BrainSearchRequest,
): Promise<BrainSearchAnswer> {
  const normalizedQuestion = request.question.trim();

  if (!normalizedQuestion) {
    throw new Error("Enter a question before asking the Knowledge Brain.");
  }

  const filters = {
    targetSeason: normalizeTargetSeason(request.targetSeason),
    includeHistorical: Boolean(request.includeHistorical),
  };
  const [players, resolvedPlayer] = await Promise.all([
    getPlayerIntelligenceDirectory(filters),
    resolvePlayerFromQuestion(normalizedQuestion),
  ]);
  const queryType = classifyQuestion(normalizedQuestion, resolvedPlayer);

  if (queryType === "BULLISH_PLAYERS") {
    return buildListAnswer({
      question: normalizedQuestion,
      queryType,
      filters,
      directAnswer: "These are the players with the strongest bullish signals in the stored Knowledge Brain data.",
      relevantPlayers: players.players
        .filter((player) => player.bullishCount > player.bearishCount)
        .sort(
          (playerA, playerB) =>
            playerB.intelligenceScore - playerA.intelligenceScore ||
            playerB.bullishCount - playerA.bullishCount,
        )
        .slice(0, 8),
      takeWhere: {
        sentiment: "BULLISH",
        playerId: { not: null },
      },
    });
  }

  if (queryType === "BEARISH_PLAYERS") {
    return buildListAnswer({
      question: normalizedQuestion,
      queryType,
      filters,
      directAnswer: "These are the players with the strongest bearish or fade signals in the stored Knowledge Brain data.",
      relevantPlayers: players.players
        .filter((player) => player.bearishCount > player.bullishCount)
        .sort(
          (playerA, playerB) =>
            playerA.intelligenceScore - playerB.intelligenceScore ||
            playerB.bearishCount - playerA.bearishCount,
        )
        .slice(0, 8),
      takeWhere: {
        sentiment: "BEARISH",
        playerId: { not: null },
      },
    });
  }

  if (queryType === "DIVISIVE_PLAYERS") {
    const consensus = await getExpertConsensusDashboard(filters);
    const rows = consensus.widgets.mostDivisivePlayers.slice(0, 8);

    return buildBaseAnswer({
      question: normalizedQuestion,
      queryType,
      filters,
      directAnswer:
        rows.length > 0
          ? "These players have the clearest split or divisive expert signals right now."
          : "No divisive players were found for the selected filters yet.",
      relevantPlayers: matchPlayersToConsensus(players.players, rows),
      consensusRows: rows.map(formatConsensusRow),
      weightedConsensusRows: [],
      topExpertTakes: await getRelevantTakes({ filters, limit: 8 }),
      limitedDataNote:
        rows.length === 0
          ? "Divisive-player results need multiple expert takes on the same players."
          : null,
    });
  }

  if (queryType === "WEIGHTED_CONSENSUS") {
    const weighted = await getWeightedConsensusDashboard(filters);
    const rows = weighted.widgets.strongestTrustedConsensus.length
      ? weighted.widgets.strongestTrustedConsensus
      : weighted.rows.slice(0, 8);

    return buildBaseAnswer({
      question: normalizedQuestion,
      queryType,
      filters,
      directAnswer:
        rows.length > 0
          ? "These players have the strongest trust-weighted consensus in the stored data."
          : "No weighted consensus rows were found for the selected filters yet.",
      relevantPlayers: matchPlayersToWeighted(players.players, rows),
      consensusRows: [],
      weightedConsensusRows: rows.map(formatWeightedConsensusRow),
      topExpertTakes: await getRelevantTakes({ filters, limit: 8 }),
      limitedDataNote: weighted.defaultWeightNotice,
    });
  }

  if (resolvedPlayer) {
    return buildPlayerAnswer({
      question: normalizedQuestion,
      queryType,
      filters,
      playerId: resolvedPlayer.id,
    });
  }

  if (queryType === "LATEST_TAKES") {
    const takes = await getRelevantTakes({ filters, limit: 10 });

    return buildBaseAnswer({
      question: normalizedQuestion,
      queryType,
      filters,
      directAnswer:
        takes.length > 0
          ? "Here are the latest stored expert takes for the selected filters."
          : "No expert takes were found for the selected filters yet.",
      relevantPlayers: players.players.slice(0, 5),
      consensusRows: [],
      weightedConsensusRows: [],
      topExpertTakes: takes,
      limitedDataNote:
        takes.length === 0
          ? "Import or paste transcripts before asking for latest takes."
          : null,
    });
  }

  return buildBaseAnswer({
    question: normalizedQuestion,
    queryType,
    filters,
    directAnswer:
      "I could not confidently map that question to a supported deterministic search yet. Try asking about a player, bullish players, bearish players, divisive players, strongest weighted consensus, or latest takes.",
    relevantPlayers: players.players.slice(0, 5),
    consensusRows: [],
    weightedConsensusRows: [],
    topExpertTakes: await getRelevantTakes({ filters, limit: 5 }),
    limitedDataNote:
      "This first Ask version uses transparent keyword retrieval, not an AI model.",
  });
}

async function buildPlayerAnswer({
  question,
  queryType,
  filters,
  playerId,
}: {
  question: string;
  queryType: BrainSearchQueryType;
  filters: { targetSeason: number; includeHistorical: boolean };
  playerId: string;
}) {
  const [players, consensus, weighted, takes, accuracy] = await Promise.all([
    getPlayerIntelligenceDirectory(filters),
    getExpertConsensusDashboard(filters),
    getWeightedConsensusDashboard(filters),
    getRelevantTakes({
      filters,
      limit: 8,
      where: {
        playerId,
      },
    }),
    getExpertAccuracyDirectory(filters),
  ]);
  const player = players.players.find((row) => row.playerId === playerId);
  const consensusRow = consensus.rows.find((row) => row.playerId === playerId);
  const weightedRow = weighted.rows.find((row) => row.playerId === playerId);
  const bullishExperts =
    queryType === "PLAYER_EXPERTS_BULLISH"
      ? getBullishExpertsForPlayer(takes, accuracy.experts)
      : [];
  const directAnswer = buildPlayerDirectAnswer({
    player,
    consensusRow,
    weightedRow,
    bullishExperts,
    queryType,
  });

  return buildBaseAnswer({
    question,
    queryType,
    filters,
    directAnswer,
    relevantPlayers: player ? [player] : [],
    consensusRows: consensusRow ? [formatConsensusRow(consensusRow)] : [],
    weightedConsensusRows: weightedRow ? [formatWeightedConsensusRow(weightedRow)] : [],
    topExpertTakes: takes,
    limitedDataNote:
      takes.length === 0
        ? "No current-scope expert takes were found for this player."
        : consensusRow?.consensusLabel === "Not Enough Data"
          ? "This player does not have enough current-scope expert coverage for true consensus yet."
          : weighted.defaultWeightNotice,
  });
}

async function buildListAnswer({
  question,
  queryType,
  filters,
  directAnswer,
  relevantPlayers,
  takeWhere,
}: {
  question: string;
  queryType: BrainSearchQueryType;
  filters: { targetSeason: number; includeHistorical: boolean };
  directAnswer: string;
  relevantPlayers: BrainSearchPlayer[];
  takeWhere: Prisma.ExpertTakeWhereInput;
}) {
  return buildBaseAnswer({
    question,
    queryType,
    filters,
    directAnswer:
      relevantPlayers.length > 0
        ? directAnswer
        : "No matching players were found for the selected filters yet.",
    relevantPlayers,
    consensusRows: [],
    weightedConsensusRows: [],
    topExpertTakes: await getRelevantTakes({
      filters,
      limit: 8,
      where: takeWhere,
    }),
    limitedDataNote:
      relevantPlayers.length === 0
        ? "Import more current transcripts or turn on historical content to broaden the search."
        : null,
  });
}

function buildBaseAnswer({
  question,
  queryType,
  filters,
  directAnswer,
  relevantPlayers,
  consensusRows,
  weightedConsensusRows,
  topExpertTakes,
  limitedDataNote,
}: Omit<BrainSearchAnswer, "citations" | "ai">) {
  return {
    question,
    queryType,
    directAnswer,
    relevantPlayers: relevantPlayers.map(formatPlayerRow),
    consensusRows,
    weightedConsensusRows,
    topExpertTakes,
    citations: buildCitations(topExpertTakes),
    limitedDataNote,
    filters,
    ai: {
      mode: "DETERMINISTIC" as const,
      providerConfigured: false as const,
      note: "No AI provider is required or configured. This answer is generated from deterministic Knowledge Brain retrieval.",
    },
  };
}

async function getRelevantTakes({
  filters,
  limit,
  where = {},
}: {
  filters: { targetSeason: number; includeHistorical: boolean };
  limit: number;
  where?: Prisma.ExpertTakeWhereInput;
}) {
  const takes = await db.expertTake.findMany({
    where: {
      ...where,
      transcript: {
        is: buildTranscriptWhere(filters),
      },
    },
    include: BRAIN_SEARCH_TAKE_INCLUDE,
    orderBy: [{ createdAt: "desc" }],
    take: limit,
  });

  return takes.map(formatTake);
}

async function resolvePlayerFromQuestion(question: string) {
  const normalizedQuestion = normalizeText(question);
  const players = await db.player.findMany({
    where: {
      OR: [{ expertTakes: { some: {} } }, { playerMentions: { some: {} } }],
    },
    select: {
      id: true,
      fullName: true,
      position: true,
      team: true,
    },
    orderBy: { fullName: "asc" },
  });

  return (
    players
      .filter((player) => normalizeText(player.fullName).length >= 4)
      .filter((player) => normalizedQuestion.includes(normalizeText(player.fullName)))
      .sort(
        (playerA, playerB) =>
          normalizeText(playerB.fullName).length -
            normalizeText(playerA.fullName).length ||
          playerA.fullName.localeCompare(playerB.fullName),
      )[0] ?? null
  );
}

function classifyQuestion(
  question: string,
  resolvedPlayer: { id: string } | null,
): BrainSearchQueryType {
  const normalizedQuestion = normalizeText(question);

  if (
    resolvedPlayer &&
    normalizedQuestion.includes("expert") &&
    normalizedQuestion.includes("bullish")
  ) {
    return "PLAYER_EXPERTS_BULLISH";
  }

  if (
    normalizedQuestion.includes("weighted") ||
    normalizedQuestion.includes("trusted consensus") ||
    normalizedQuestion.includes("strong consensus")
  ) {
    return "WEIGHTED_CONSENSUS";
  }

  if (
    normalizedQuestion.includes("divisive") ||
    normalizedQuestion.includes("split") ||
    normalizedQuestion.includes("disagree")
  ) {
    return "DIVISIVE_PLAYERS";
  }

  if (
    normalizedQuestion.includes("bearish") ||
    normalizedQuestion.includes("fading") ||
    normalizedQuestion.includes("fade")
  ) {
    return "BEARISH_PLAYERS";
  }

  if (
    normalizedQuestion.includes("bullish") ||
    normalizedQuestion.includes("breakout")
  ) {
    return "BULLISH_PLAYERS";
  }

  if (normalizedQuestion.includes("latest") || normalizedQuestion.includes("recent")) {
    return "LATEST_TAKES";
  }

  if (resolvedPlayer) return "PLAYER_OPINION";

  return "UNKNOWN";
}

function buildPlayerDirectAnswer({
  player,
  consensusRow,
  weightedRow,
  bullishExperts,
  queryType,
}: {
  player?: BrainSearchPlayer;
  consensusRow?: Awaited<ReturnType<typeof getExpertConsensusDashboard>>["rows"][number];
  weightedRow?: Awaited<ReturnType<typeof getWeightedConsensusDashboard>>["rows"][number];
  bullishExperts: string[];
  queryType: BrainSearchQueryType;
}) {
  if (!player) {
    return "I found the player name, but no current-scope intelligence summary is available for that player yet.";
  }

  if (queryType === "PLAYER_EXPERTS_BULLISH") {
    return bullishExperts.length > 0
      ? `${bullishExperts.join(", ")} currently have bullish takes on ${player.fullName}.`
      : `No current-scope bullish expert takes were found for ${player.fullName}.`;
  }

  const sentiment =
    player.bullishCount > player.bearishCount
      ? "bullish"
      : player.bearishCount > player.bullishCount
        ? "bearish"
        : "mixed or neutral";
  const consensusText = consensusRow
    ? ` Raw consensus is ${consensusRow.consensusLabel}.`
    : " Raw consensus is not available yet.";
  const weightedText = weightedRow
    ? ` Weighted consensus is ${weightedRow.weightedConsensusLabel}.`
    : " Weighted consensus is not available yet.";

  return `Experts are currently ${sentiment} on ${player.fullName}: ${player.bullishCount} bullish, ${player.bearishCount} bearish, and ${player.neutralCount} neutral mentions across ${player.expertCount} expert${player.expertCount === 1 ? "" : "s"}.${consensusText}${weightedText}`;
}

function getBullishExpertsForPlayer(
  takes: BrainSearchTake[],
  experts: Awaited<ReturnType<typeof getExpertAccuracyDirectory>>["experts"],
) {
  const bullishExpertNames = new Set(
    takes
      .filter((take) => take.sentiment === "BULLISH")
      .map((take) => take.expertName),
  );
  const knownExpertNames = new Set(experts.map((expert) => expert.expertName));

  return Array.from(bullishExpertNames)
    .filter((expertName) => knownExpertNames.has(expertName))
    .sort();
}

function buildTranscriptWhere({
  targetSeason,
  includeHistorical,
}: {
  targetSeason: number;
  includeHistorical: boolean;
}): Prisma.TranscriptWhereInput {
  if (includeHistorical) return {};

  return {
    includeInCurrentAnalysis: true,
    contentSeason: targetSeason,
  };
}

function formatPlayerRow(player: BrainSearchPlayer): BrainSearchPlayer {
  return {
    playerId: player.playerId,
    fullName: player.fullName,
    position: player.position,
    team: player.team,
    totalMentions: player.totalMentions,
    bullishCount: player.bullishCount,
    bearishCount: player.bearishCount,
    neutralCount: player.neutralCount,
    expertCount: player.expertCount,
    intelligenceScore: player.intelligenceScore,
    intelligenceLabel: player.intelligenceLabel,
  };
}

function formatConsensusRow(
  row: Awaited<ReturnType<typeof getExpertConsensusDashboard>>["rows"][number],
): BrainSearchConsensusRow {
  return {
    playerId: row.playerId,
    playerName: row.playerName,
    position: row.position,
    team: row.team,
    totalExperts: row.totalExperts,
    bullishExperts: row.bullishExperts,
    bearishExperts: row.bearishExperts,
    neutralExperts: row.neutralExperts,
    consensusLabel: row.consensusLabel,
    agreementScore: row.agreementScore,
  };
}

function formatWeightedConsensusRow(
  row: Awaited<ReturnType<typeof getWeightedConsensusDashboard>>["rows"][number],
): BrainSearchWeightedConsensusRow {
  return {
    playerId: row.playerId,
    playerName: row.playerName,
    position: row.position,
    team: row.team,
    rawConsensusLabel: row.rawConsensusLabel,
    weightedConsensusLabel: row.weightedConsensusLabel,
    totalExperts: row.totalExperts,
    weightedBullishScore: row.weightedBullishScore,
    weightedBearishScore: row.weightedBearishScore,
    weightedNeutralScore: row.weightedNeutralScore,
    weightedAgreementScore: row.weightedAgreementScore,
    trustWeightedConfidence: row.trustWeightedConfidence,
  };
}

function formatTake(take: ExpertTakeForBrainSearch): BrainSearchTake {
  const publishDate =
    take.transcript?.publishDate ?? take.sourceVideo.publishedAt ?? null;

  return {
    id: take.id,
    playerId: take.player?.id ?? null,
    playerName: take.player?.fullName ?? null,
    sentiment: take.sentiment,
    takeType: take.takeType,
    summary: take.summary,
    excerpt: take.excerpt,
    confidence: take.confidence,
    expertName: take.expert.name,
    sourceTitle: take.sourceVideo.title,
    sourceUrl: take.sourceVideo.url,
    publishDate: publishDate ? publishDate.toISOString() : null,
    freshnessLabel: take.transcript?.freshnessLabel ?? "STALE",
  };
}

function buildCitations(takes: BrainSearchTake[]) {
  const citations = new Map<string, BrainSearchCitation>();

  for (const take of takes) {
    const key = `${take.expertName}:${take.sourceTitle}:${take.publishDate ?? ""}`;

    if (!citations.has(key)) {
      citations.set(key, {
        takeId: take.id,
        expertName: take.expertName,
        sourceTitle: take.sourceTitle,
        sourceUrl: take.sourceUrl,
        publishDate: take.publishDate,
        freshnessLabel: take.freshnessLabel,
      });
    }
  }

  return Array.from(citations.values()).slice(0, 6);
}

function matchPlayersToConsensus(
  players: BrainSearchPlayer[],
  consensusRows: Array<{ playerId: string }>,
) {
  const playerIds = new Set(consensusRows.map((row) => row.playerId));

  return players.filter((player) => playerIds.has(player.playerId));
}

function matchPlayersToWeighted(
  players: BrainSearchPlayer[],
  weightedRows: Array<{ playerId: string }>,
) {
  const playerIds = new Set(weightedRows.map((row) => row.playerId));

  return players.filter((player) => playerIds.has(player.playerId));
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
