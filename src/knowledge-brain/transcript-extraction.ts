export type TranscriptPlayerCandidate = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  position: string;
  team: string | null;
};

export type PlayerMentionRole =
  | "PRIMARY_SUBJECT"
  | "COMPARISON"
  | "CONTEXT"
  | "OPPONENT"
  | "UNCLEAR";

export type TakeEligibilityReason =
  | "SUBJECT_OPINION_LINK"
  | "CONTEXT_ONLY_MENTION"
  | "COMPARISON_ONLY_MENTION"
  | "PRONOUN_HEAVY_UNCLEAR"
  | "NO_CLEAR_SUBJECT_OPINION_LINK";

export type ExtractionWarningCode =
  | "MULTIPLE_PLAYERS_DETECTED"
  | "COMPARISON_LANGUAGE_DETECTED"
  | "PRIMARY_PLAYER_UNCERTAIN"
  | "SENTIMENT_MAY_APPLY_TO_ANOTHER_PLAYER"
  | "TIMESTAMP_HEAVY_TRANSCRIPT_CLEANED"
  | "SPOKEN_TIMESTAMP_CLEANUP_APPLIED"
  | "CONTEXT_ONLY_MENTION"
  | "COMPARISON_ONLY_MENTION"
  | "PRONOUN_HEAVY_SEGMENT"
  | "NO_CLEAR_SUBJECT_OPINION_LINK"
  | "LOW_EXTRACTION_CONFIDENCE";

export type SegmentPlayerMention = {
  player: TranscriptPlayerCandidate;
  role: PlayerMentionRole;
  matchedName: string;
  index: number;
  eligibleForTake: boolean;
  eligibilityReasons: TakeEligibilityReason[];
  opinionEvidence: string | null;
};

export type SegmentExtractionContext = {
  cleanedText: string;
  timestampHeavy: boolean;
  spokenTimestampCleanupApplied: boolean;
  comparisonLanguageDetected: boolean;
  pronounHeavy: boolean;
  primaryPlayerUncertain: boolean;
  mentions: SegmentPlayerMention[];
  warnings: ExtractionWarningCode[];
};

const TIMESTAMP_PREFIX_PATTERN =
  /^\s*[\[(]?\d{1,2}:\d{2}(?::\d{2})?[\])]?\s*(?:-\s*)?/;
const SPOKEN_TIMESTAMP_PATTERN =
  /\b(?:\d{1,2}\s*(?:hours?|hrs?|hr)\s*,?\s*)?\d{1,3}\s*(?:minutes?|mins?|min)\s*,?\s*\d{1,2}\s*(?:seconds?|secs?|sec)\b/gi;
const SMASHED_TIMESTAMP_JOIN_PATTERN = /\b(seconds?|secs?|sec)(?=[A-Z])/g;
const MALFORMED_COMPACT_TIMESTAMP_PATTERN =
  /\b\d{1,2}:\d{2}(?=\d{1,3}\s*(?:minutes?|mins?|min)\b)/gi;

const COMPARISON_PHRASES = [
  "prefer",
  "over",
  "ahead of",
  "behind",
  "versus",
  "vs",
  "compared to",
  "rather than",
  "instead of",
  "not as much as",
  "same tier",
  "better than",
  "worse than",
  "safer than",
  "higher ceiling",
  "better value",
  "cheaper than",
  "reminds me of",
  "similar to",
];

const PRONOUN_PATTERNS = [
  "he",
  "him",
  "his",
  "this guy",
  "that guy",
  "this player",
  "that player",
  "this dude",
  "that dude",
];

// Manual validation anchors for the Phase 2D guardrails:
// A: "that benefits Zay... excited about Zay" => Zay can be a take subject.
// B: "since Derrick Henry showed up" => Derrick Henry is context only.
// C: "I prefer Player A over Player B" => Player A primary, Player B comparison.
// D: "He reminds me of Player B last year" => Player B comparison/context only.
// E: "44 minutes, 42 seconds And I like Zay" => timestamp removed cleanly.
export function cleanTranscriptDisplayText(rawText: string) {
  const repairedText = repairMalformedTimestampConcats(
    repairSmashedTimestampJoins(rawText),
  );
  const lines = repairedText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const timestampedLineCount = lines.filter((line) =>
    TIMESTAMP_PREFIX_PATTERN.test(line),
  ).length;
  const textWithoutLineTimestamps = lines
    .map((line) => line.replace(TIMESTAMP_PREFIX_PATTERN, "").trim())
    .filter(Boolean)
    .join(timestampedLineCount > 0 ? " " : "\n");
  const spokenTimestampResult = removeSpokenTimestampPhrases(
    textWithoutLineTimestamps || repairedText,
  );
  const timestampHeavy =
    timestampedLineCount >= 2 ||
    (lines.length > 0 && timestampedLineCount / lines.length >= 0.4) ||
    spokenTimestampResult.removedCount >= 2;

  return {
    text: normalizeDisplayWhitespace(
      spokenTimestampResult.text || textWithoutLineTimestamps || rawText,
    ),
    timestampHeavy,
    spokenTimestampCleanupApplied:
      spokenTimestampResult.removedCount > 0 || repairedText !== rawText,
  };
}

export function analyzeSegmentPlayerContext({
  text,
  players,
}: {
  text: string;
  players: TranscriptPlayerCandidate[];
}): SegmentExtractionContext {
  const cleaned = cleanTranscriptDisplayText(text);
  const comparisonLanguageDetected = detectComparisonLanguage(cleaned.text);
  const matchedMentions = findPlayerMentions(cleaned.text, players);
  const pronounHeavy = detectPronounHeavy(cleaned.text, matchedMentions.length);
  const mentions = assignMentionRolesAndEligibility({
    text: cleaned.text,
    matchedMentions,
    comparisonLanguageDetected,
    pronounHeavy,
  });
  const eligiblePrimaryCount = mentions.filter(
    (mention) => mention.role === "PRIMARY_SUBJECT" && mention.eligibleForTake,
  ).length;
  const primaryPlayerUncertain =
    (mentions.length > 1 && pronounHeavy) ||
    (mentions.length > 1 &&
      comparisonLanguageDetected &&
      eligiblePrimaryCount !== 1) ||
    mentions.some((mention) => mention.role === "UNCLEAR");
  const warnings = getBaseWarnings({
    timestampHeavy: cleaned.timestampHeavy,
    spokenTimestampCleanupApplied: cleaned.spokenTimestampCleanupApplied,
    comparisonLanguageDetected,
    multiplePlayersDetected: mentions.length > 1,
    primaryPlayerUncertain,
    pronounHeavy,
    mentions,
  });

  return {
    cleanedText: cleaned.text,
    timestampHeavy: cleaned.timestampHeavy,
    spokenTimestampCleanupApplied: cleaned.spokenTimestampCleanupApplied,
    comparisonLanguageDetected,
    pronounHeavy,
    primaryPlayerUncertain,
    mentions,
    warnings,
  };
}

export function getReviewExtractionWarnings({
  confidence,
  playerId,
  sourceText,
  players,
}: {
  confidence: number;
  playerId?: string | null;
  sourceText: string;
  players: TranscriptPlayerCandidate[];
}) {
  const context = analyzeSegmentPlayerContext({
    text: sourceText,
    players,
  });
  const warnings = [...context.warnings];
  const reviewedMention = playerId
    ? context.mentions.find((mention) => mention.player.id === playerId)
    : null;

  if (confidence < 0.55) {
    warnings.push("LOW_EXTRACTION_CONFIDENCE");
  }

  if (
    context.comparisonLanguageDetected &&
    context.mentions.some((mention) => mention.role !== "PRIMARY_SUBJECT")
  ) {
    warnings.push("SENTIMENT_MAY_APPLY_TO_ANOTHER_PLAYER");
  }

  if (reviewedMention && !reviewedMention.eligibleForTake) {
    warnings.push(...mapEligibilityReasonsToWarnings(reviewedMention));
  }

  return Array.from(new Set(warnings));
}

export function detectComparisonLanguage(text: string) {
  const normalizedText = normalizeForMatching(text);

  return COMPARISON_PHRASES.some((phrase) =>
    normalizedText.includes(normalizeForMatching(phrase)),
  );
}

export function normalizeForMatching(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function trimExcerpt(value: string, maxLength = 420) {
  const normalizedValue = normalizeDisplayWhitespace(value);

  return normalizedValue.length > maxLength
    ? `${normalizedValue.slice(0, maxLength - 3)}...`
    : normalizedValue;
}

function repairSmashedTimestampJoins(value: string) {
  return value.replace(SMASHED_TIMESTAMP_JOIN_PATTERN, "$1 ");
}

function repairMalformedTimestampConcats(value: string) {
  return value.replace(MALFORMED_COMPACT_TIMESTAMP_PATTERN, " ");
}

function removeSpokenTimestampPhrases(value: string) {
  let removedCount = 0;
  const text = value.replace(SPOKEN_TIMESTAMP_PATTERN, () => {
    removedCount += 1;
    return " ";
  });

  return {
    text,
    removedCount,
  };
}

function assignMentionRolesAndEligibility({
  text,
  matchedMentions,
  comparisonLanguageDetected,
  pronounHeavy,
}: {
  text: string;
  matchedMentions: SegmentPlayerMention[];
  comparisonLanguageDetected: boolean;
  pronounHeavy: boolean;
}) {
  if (matchedMentions.length === 0) return [];

  const primaryPlayerId = comparisonLanguageDetected
    ? findPrimaryPlayerIdFromComparison(text, matchedMentions)
    : null;
  const contextPlayerIds = findContextPlayerIds(text, matchedMentions);
  const roleAssignedMentions = matchedMentions.map((mention) => {
    const role = getMentionRole({
      mention,
      primaryPlayerId,
      contextPlayerIds,
      comparisonLanguageDetected,
      mentionCount: matchedMentions.length,
    });

    return {
      ...mention,
      role,
    };
  });

  return roleAssignedMentions.map((mention) => {
    const eligibility = analyzeMentionTakeEligibility({
      text,
      mention,
      mentions: roleAssignedMentions,
      pronounHeavy,
    });

    return {
      ...mention,
      eligibleForTake: eligibility.eligibleForTake,
      eligibilityReasons: eligibility.reasons,
      opinionEvidence: eligibility.opinionEvidence,
    };
  });
}

function getMentionRole({
  mention,
  primaryPlayerId,
  contextPlayerIds,
  comparisonLanguageDetected,
  mentionCount,
}: {
  mention: SegmentPlayerMention;
  primaryPlayerId: string | null;
  contextPlayerIds: Set<string>;
  comparisonLanguageDetected: boolean;
  mentionCount: number;
}): PlayerMentionRole {
  if (contextPlayerIds.has(mention.player.id)) {
    return "CONTEXT";
  }

  if (primaryPlayerId) {
    return mention.player.id === primaryPlayerId
      ? "PRIMARY_SUBJECT"
      : "COMPARISON";
  }

  if (comparisonLanguageDetected && mentionCount > 1) {
    return "UNCLEAR";
  }

  if (comparisonLanguageDetected && mentionCount === 1) {
    return "COMPARISON";
  }

  return "PRIMARY_SUBJECT";
}

function findPlayerMentions(text: string, players: TranscriptPlayerCandidate[]) {
  const normalizedText = ` ${normalizeForMatching(text)} `;
  const matchedPlayers = new Map<string, SegmentPlayerMention>();

  for (const player of players) {
    const names = getMatchablePlayerNames(player);

    for (const name of names) {
      const normalizedName = normalizeForMatching(name);
      const index = normalizedText.indexOf(` ${normalizedName} `);

      if (index >= 0) {
        const existingMention = matchedPlayers.get(player.id);

        if (!existingMention || index < existingMention.index) {
          matchedPlayers.set(player.id, {
            player,
            role: "UNCLEAR",
            matchedName: name,
            index,
            eligibleForTake: false,
            eligibilityReasons: [],
            opinionEvidence: null,
          });
        }
      }
    }
  }

  return Array.from(matchedPlayers.values()).sort(
    (mentionA, mentionB) => mentionA.index - mentionB.index,
  );
}

function analyzeMentionTakeEligibility({
  text,
  mention,
  mentions,
  pronounHeavy,
}: {
  text: string;
  mention: SegmentPlayerMention;
  mentions: SegmentPlayerMention[];
  pronounHeavy: boolean;
}) {
  const opinionEvidence = findSubjectOpinionEvidence(text, mention);
  const reasons: TakeEligibilityReason[] = [];

  if (mention.role === "CONTEXT") {
    reasons.push("CONTEXT_ONLY_MENTION");
  }

  if (mention.role === "COMPARISON") {
    reasons.push("COMPARISON_ONLY_MENTION");
  }

  if (pronounHeavy && mentions.length > 1 && !opinionEvidence) {
    reasons.push("PRONOUN_HEAVY_UNCLEAR");
  }

  if (!opinionEvidence) {
    reasons.push("NO_CLEAR_SUBJECT_OPINION_LINK");
  } else {
    reasons.push("SUBJECT_OPINION_LINK");
  }

  return {
    eligibleForTake:
      mention.role === "PRIMARY_SUBJECT" &&
      Boolean(opinionEvidence) &&
      !reasons.includes("PRONOUN_HEAVY_UNCLEAR"),
    reasons,
    opinionEvidence,
  };
}

function findSubjectOpinionEvidence(
  text: string,
  mention: SegmentPlayerMention,
) {
  const normalizedText = normalizeForMatching(text);
  const name = normalizeForMatching(mention.matchedName);
  const patterns = buildSubjectOpinionPatterns(name);
  const matchedPattern = patterns.find((pattern) =>
    containsOrderedPattern(normalizedText, pattern),
  );

  return matchedPattern ? matchedPattern.join(" ... ") : null;
}

function buildSubjectOpinionPatterns(name: string) {
  return [
    ["i like", name],
    ["i love", name],
    ["i m drafting", name],
    ["im drafting", name],
    ["i am drafting", name],
    ["drafting", name],
    ["start", name],
    ["sit", name],
    ["bench", name],
    ["fade", name],
    ["avoid", name],
    ["target", name],
    ["buy", name],
    ["sell", name],
    ["stash", name],
    ["excited about", name],
    ["bullish on", name],
    ["worried about", name],
    ["concerned about", name],
    ["prefer", name, "over"],
    ["prefer", name, "to"],
    ["benefits", name],
    ["helps", name],
    [name, "is a value"],
    [name, "is value"],
    [name, "is too expensive"],
    [name, "is expensive"],
    [name, "is cheap"],
    [name, "is a fade"],
    [name, "is a sleeper"],
    [name, "is a breakout"],
    [name, "is undervalued"],
    [name, "is overvalued"],
    [name, "is risky"],
    [name, "has upside"],
    [name, "has a ceiling"],
    [name, "has ceiling"],
    [name, "going to benefit"],
    [name, "will benefit"],
    [name, "should benefit"],
    [name, "should score"],
    [name, "will score"],
    [name, "should get"],
    [name, "will get"],
    [name, "is ahead of"],
    [name, "ahead of"],
    [name, "over"],
    [name, "better than"],
    [name, "safer than"],
    [name, "higher ceiling than"],
    [name, "better value than"],
    [name, "cheaper than"],
  ];
}

function findPrimaryPlayerIdFromComparison(
  text: string,
  mentions: SegmentPlayerMention[],
) {
  const normalizedText = normalizeForMatching(text);

  for (const leftMention of mentions) {
    for (const rightMention of mentions) {
      if (leftMention.player.id === rightMention.player.id) continue;

      const left = normalizeForMatching(leftMention.matchedName);
      const right = normalizeForMatching(rightMention.matchedName);

      if (
        containsOrderedPattern(normalizedText, ["prefer", left, "over", right]) ||
        containsOrderedPattern(normalizedText, ["prefer", left, "to", right]) ||
        containsOrderedPattern(normalizedText, [left, "over", right]) ||
        containsOrderedPattern(normalizedText, [left, "ahead of", right]) ||
        containsOrderedPattern(normalizedText, [left, "behind", right]) ||
        containsOrderedPattern(normalizedText, [left, "versus", right]) ||
        containsOrderedPattern(normalizedText, [left, "vs", right]) ||
        containsOrderedPattern(normalizedText, [left, "rather than", right]) ||
        containsOrderedPattern(normalizedText, [left, "instead of", right]) ||
        containsOrderedPattern(normalizedText, [left, "better than", right]) ||
        containsOrderedPattern(normalizedText, [left, "worse than", right]) ||
        containsOrderedPattern(normalizedText, [left, "safer than", right]) ||
        containsOrderedPattern(normalizedText, [
          left,
          "higher ceiling than",
          right,
        ]) ||
        containsOrderedPattern(normalizedText, [
          left,
          "better value than",
          right,
        ]) ||
        containsOrderedPattern(normalizedText, [left, "cheaper than", right]) ||
        containsOrderedPattern(normalizedText, [
          "not drafting",
          left,
          "when",
          right,
        ])
      ) {
        return leftMention.player.id;
      }

      if (
        containsOrderedPattern(normalizedText, ["compared to", right, left]) ||
        containsOrderedPattern(normalizedText, [
          "like",
          left,
          "but not as much as",
          right,
        ])
      ) {
        return leftMention.player.id;
      }
    }
  }

  const reminderPrimary = findReminderPrimary(mentions, normalizedText);

  return reminderPrimary?.player.id ?? null;
}

function findContextPlayerIds(text: string, mentions: SegmentPlayerMention[]) {
  const normalizedText = normalizeForMatching(text);
  const contextIds = new Set<string>();

  for (const mention of mentions) {
    const name = normalizeForMatching(mention.matchedName);

    if (isContextOnlyMention(normalizedText, name)) {
      contextIds.add(mention.player.id);
    }
  }

  for (const leftMention of mentions) {
    for (const rightMention of mentions) {
      if (leftMention.player.id === rightMention.player.id) continue;

      const left = normalizeForMatching(leftMention.matchedName);
      const right = normalizeForMatching(rightMention.matchedName);

      if (
        containsOrderedPattern(normalizedText, [left, "reminds me of", right]) ||
        containsOrderedPattern(normalizedText, [left, "similar to", right])
      ) {
        contextIds.add(rightMention.player.id);
      }
    }
  }

  return contextIds;
}

function isContextOnlyMention(normalizedText: string, name: string) {
  const patterns = [
    ["since", name, "showed up"],
    ["especially since", name],
    ["because", name, "is there"],
    ["because", name, "was there"],
    ["with", name, "in town"],
    ["with", name, "there"],
    ["behind", name],
    ["ahead of", name],
    ["next to", name],
    ["replacing", name],
    ["after", name, "left"],
    ["without", name],
    ["due to", name],
    ["as a result of", name],
    ["reminds me of", name],
    ["similar to", name],
    ["compared to", name],
    ["like", name, "last year"],
  ];

  return patterns.some((pattern) =>
    containsOrderedPattern(normalizedText, pattern),
  );
}

function findReminderPrimary(
  mentions: SegmentPlayerMention[],
  normalizedText: string,
) {
  return mentions.find((leftMention) =>
    mentions.some((rightMention) => {
      if (leftMention.player.id === rightMention.player.id) return false;

      return containsOrderedPattern(normalizedText, [
        normalizeForMatching(leftMention.matchedName),
        "reminds me of",
        normalizeForMatching(rightMention.matchedName),
      ]);
    }),
  );
}

function detectPronounHeavy(text: string, mentionCount: number) {
  const normalizedText = normalizeForMatching(text);
  const pronounCount = PRONOUN_PATTERNS.reduce((count, pattern) => {
    return count + countPhraseOccurrences(normalizedText, pattern);
  }, 0);

  return pronounCount >= 4 || (mentionCount > 1 && pronounCount >= 2);
}

function countPhraseOccurrences(text: string, phrase: string) {
  const normalizedPhrase = normalizeForMatching(phrase);
  let count = 0;
  let cursor = 0;

  while (cursor < text.length) {
    const index = text.indexOf(normalizedPhrase, cursor);

    if (index < 0) break;

    const before = index === 0 ? " " : text[index - 1];
    const afterIndex = index + normalizedPhrase.length;
    const after = afterIndex >= text.length ? " " : text[afterIndex];

    if (before === " " && after === " ") {
      count += 1;
    }

    cursor = index + normalizedPhrase.length;
  }

  return count;
}

function containsOrderedPattern(text: string, patternParts: string[]) {
  let cursor = 0;

  for (const part of patternParts) {
    const normalizedPart = normalizeForMatching(part);
    const index = text.indexOf(normalizedPart, cursor);

    if (index < 0) return false;

    cursor = index + normalizedPart.length;
  }

  return true;
}

function getMatchablePlayerNames(player: TranscriptPlayerCandidate) {
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

function sanitizePlayerName(value?: string | null) {
  const trimmedValue = value?.trim();

  if (!trimmedValue || trimmedValue.toLowerCase() === "unknown") {
    return undefined;
  }

  return trimmedValue;
}

function getBaseWarnings({
  timestampHeavy,
  spokenTimestampCleanupApplied,
  comparisonLanguageDetected,
  multiplePlayersDetected,
  primaryPlayerUncertain,
  pronounHeavy,
  mentions,
}: {
  timestampHeavy: boolean;
  spokenTimestampCleanupApplied: boolean;
  comparisonLanguageDetected: boolean;
  multiplePlayersDetected: boolean;
  primaryPlayerUncertain: boolean;
  pronounHeavy: boolean;
  mentions: SegmentPlayerMention[];
}) {
  const warnings: ExtractionWarningCode[] = [];

  if (multiplePlayersDetected) warnings.push("MULTIPLE_PLAYERS_DETECTED");
  if (comparisonLanguageDetected) warnings.push("COMPARISON_LANGUAGE_DETECTED");
  if (primaryPlayerUncertain) warnings.push("PRIMARY_PLAYER_UNCERTAIN");
  if (timestampHeavy) warnings.push("TIMESTAMP_HEAVY_TRANSCRIPT_CLEANED");
  if (spokenTimestampCleanupApplied) {
    warnings.push("SPOKEN_TIMESTAMP_CLEANUP_APPLIED");
  }
  if (pronounHeavy) warnings.push("PRONOUN_HEAVY_SEGMENT");
  if (
    mentions.some((mention) =>
      mention.eligibilityReasons.includes("CONTEXT_ONLY_MENTION"),
    )
  ) {
    warnings.push("CONTEXT_ONLY_MENTION");
  }
  if (
    mentions.some((mention) =>
      mention.eligibilityReasons.includes("COMPARISON_ONLY_MENTION"),
    )
  ) {
    warnings.push("COMPARISON_ONLY_MENTION");
  }
  if (
    mentions.length > 0 &&
    !mentions.some((mention) => mention.eligibleForTake)
  ) {
    warnings.push("NO_CLEAR_SUBJECT_OPINION_LINK");
  }

  return Array.from(new Set(warnings));
}

function mapEligibilityReasonsToWarnings(mention: SegmentPlayerMention) {
  return mention.eligibilityReasons
    .map((reason): ExtractionWarningCode | null => {
      if (reason === "CONTEXT_ONLY_MENTION") return "CONTEXT_ONLY_MENTION";
      if (reason === "COMPARISON_ONLY_MENTION") {
        return "COMPARISON_ONLY_MENTION";
      }
      if (reason === "PRONOUN_HEAVY_UNCLEAR") return "PRONOUN_HEAVY_SEGMENT";
      if (reason === "NO_CLEAR_SUBJECT_OPINION_LINK") {
        return "NO_CLEAR_SUBJECT_OPINION_LINK";
      }

      return null;
    })
    .filter((warning): warning is ExtractionWarningCode => Boolean(warning));
}

function normalizeDisplayWhitespace(value: string) {
  return value
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?])/g, "$1");
}
