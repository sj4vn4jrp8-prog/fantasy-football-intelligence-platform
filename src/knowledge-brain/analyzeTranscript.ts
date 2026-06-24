import { db } from "@/lib/db";

type AnalyzeSavedTranscriptInput = {
  expertId: string;
  sourceVideoId: string;
  transcriptId: string;
};

type PlayerCandidate = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  position: string;
  team: string | null;
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
    const matchedPlayers = findPlayerMentions(segment.text, players);

    for (const player of matchedPlayers) {
      const sentiment = classifySentiment(segment.text);
      const takeType = classifyTakeType(segment.text);
      const summary = buildTakeSummary({
        player,
        sentiment,
        takeType,
      });
      const confidence = calculateTakeConfidence({ sentiment, takeType });
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
          excerpt: trimExcerpt(segment.text),
          confidence,
        },
      });

      await db.playerMention.create({
        data: {
          expertTakeId: take.id,
          transcriptId,
          sourceVideoId,
          playerId: player.id,
          mentionText: player.fullName,
          normalizedName: normalizeForMatching(player.fullName),
          sentiment,
          takeType,
          context: trimExcerpt(segment.text),
        },
      });

      mentionedPlayerIds.add(player.id);
      takesCreated += 1;
    }
  }

  await db.transcript.update({
    where: { id: transcriptId },
    data: { analyzedAt: new Date() },
  });

  await refreshTrendSignals(Array.from(mentionedPlayerIds));

  return {
    takesCreated,
    playersMentioned: mentionedPlayerIds.size,
  };
}

function findPlayerMentions(text: string, players: PlayerCandidate[]) {
  const normalizedText = ` ${normalizeForMatching(text)} `;
  const matchedPlayers = new Map<string, PlayerCandidate>();

  for (const player of players) {
    const names = getMatchablePlayerNames(player);

    if (
      names.some((name) => normalizedText.includes(` ${normalizeForMatching(name)} `))
    ) {
      matchedPlayers.set(player.id, player);
    }
  }

  return Array.from(matchedPlayers.values());
}

function getMatchablePlayerNames(player: PlayerCandidate) {
  const names = new Set<string>();
  const fullName = sanitizePlayerName(player.fullName);
  const firstLast = [player.firstName, player.lastName]
    .map(sanitizePlayerName)
    .filter(Boolean)
    .join(" ");

  if (fullName) names.add(fullName);
  if (firstLast) names.add(firstLast);

  return Array.from(names).filter((name) => normalizeForMatching(name).length >= 5);
}

function classifySentiment(text: string) {
  const normalizedText = normalizeForMatching(text);
  const bullishScore = countKeywordHits(normalizedText, BULLISH_KEYWORDS);
  const bearishScore = countKeywordHits(normalizedText, BEARISH_KEYWORDS);

  if (bullishScore > bearishScore) return "BULLISH";
  if (bearishScore > bullishScore) return "BEARISH";

  return "NEUTRAL";
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
}: {
  player: PlayerCandidate;
  sentiment: string;
  takeType: string;
}) {
  return `${player.fullName} was classified as ${formatEnumLabel(
    sentiment,
  )} for ${formatEnumLabel(takeType)}.`;
}

function calculateTakeConfidence({
  sentiment,
  takeType,
}: {
  sentiment: string;
  takeType: string;
}) {
  let confidence = 0.45;

  if (sentiment !== "NEUTRAL") confidence += 0.2;
  if (takeType !== "UNCATEGORIZED") confidence += 0.15;

  return Math.min(0.85, confidence);
}

async function refreshTrendSignals(playerIds: string[]) {
  for (const playerId of playerIds) {
    const mentions = await db.playerMention.findMany({
      where: {
        playerId,
        transcript: {
          is: {
            includeInCurrentAnalysis: true,
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

function sanitizePlayerName(value?: string | null) {
  const trimmed = value?.trim();

  if (!trimmed || trimmed.toLowerCase() === "unknown") return undefined;

  return trimmed;
}

function normalizeForMatching(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function trimExcerpt(value: string) {
  return value.length > 420 ? `${value.slice(0, 417)}...` : value;
}

function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}
