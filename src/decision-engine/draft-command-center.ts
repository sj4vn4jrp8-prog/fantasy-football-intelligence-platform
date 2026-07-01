import { getDecisionEngineDashboard } from "@/decision-engine/decision-engine";
import type {
  DecisionEngineDashboard,
  DecisionEngineFilters,
  DecisionRecommendation,
  DecisionRecommendationType,
  RiskFactor,
  SupportingFactor,
} from "@/decision-engine/decision-types";
import { normalizeTargetSeason } from "@/knowledge-brain/freshness";
import { db } from "@/lib/db";

export type DraftRecommendationType =
  | "DRAFT"
  | "VALUE"
  | "WAIT"
  | "AVOID"
  | "REACH";

export type DraftStrategyProfile =
  | "BALANCED"
  | "UPSIDE"
  | "SAFE_FLOOR"
  | "HERO_RB"
  | "ZERO_RB";

export type DraftPosition = "QB" | "RB" | "WR" | "TE" | "K" | "DST" | "IDP";

export type DraftPositionCounts = Record<DraftPosition, number>;

export type DraftBoardPlayerStatus =
  | "AVAILABLE"
  | "DRAFTED_BY_ME"
  | "DRAFTED_BY_OTHER";

export type DraftBoardSource = "MANUAL" | "SLEEPER" | "YAHOO" | "ESPN";

export type DraftBoardPlayer = {
  playerId: string;
  playerName: string;
  position: string;
  team: string | null;
  status: DraftBoardPlayerStatus;
  round: number | null;
  pick: number | null;
  pickNumber: number | null;
  managerName: string | null;
  source: DraftBoardSource;
};

export type DraftBoardState = {
  source: DraftBoardSource;
  currentRound: number;
  currentPick: number;
  currentPickNumber: number;
  hideDraftedPlayers: boolean;
  availableCount: number;
  draftedCount: number;
  draftedByMeCount: number;
  draftedByOthersCount: number;
  draftedByMePositionCounts: DraftPositionCounts;
  draftedByOtherPositionCounts: DraftPositionCounts;
  draftedByMe: DraftBoardPlayer[];
  draftedByOthers: DraftBoardPlayer[];
};

export type DraftMarketValueStatus =
  | "STRONG_VALUE"
  | "VALUE"
  | "FAIR_PRICE"
  | "SLIGHT_REACH"
  | "REACH"
  | "AVOID_AT_COST"
  | "UNAVAILABLE_NEUTRAL";

export type DraftMarketFilter = "ALL" | "VALUES_ONLY" | "HIDE_REACHES";

export type DraftMarketInputRow = {
  lineNumber: number;
  raw: string;
  playerName: string;
  normalizedName: string;
  team: string | null;
  position: string | null;
  adp: number | null;
  marketRank: number | null;
};

export type DraftMarketUnmatchedRow = DraftMarketInputRow & {
  reason: string;
};

export type DraftMarketContext = {
  source: "MANUAL" | "UNAVAILABLE";
  currentPick: number;
  rawInput: string;
  matchedCount: number;
  matchedRows: Array<DraftMarketInputRow & { playerId: string }>;
  unmatchedRows: DraftMarketUnmatchedRow[];
};

export type DraftCommandCenterFilters = DecisionEngineFilters & {
  adpInput?: string | null;
  draftedByMe?: string | null;
  draftedByOthers?: string | null;
  draftedDST?: number | string | null;
  draftedIDP?: number | string | null;
  draftedK?: number | string | null;
  draftedQB?: number | string | null;
  draftedRB?: number | string | null;
  draftedTE?: number | string | null;
  draftedWR?: number | string | null;
  draftPick?: number | string | null;
  draftRound?: number | string | null;
  includeMarketUnavailable?: boolean | string | null;
  leagueId?: string | null;
  marketFilter?: DraftMarketFilter | string | null;
  minValueVsPick?: number | string | null;
  minDecisionScore?: number | string | null;
  needDST?: number | string | null;
  needIDP?: number | string | null;
  needK?: number | string | null;
  needQB?: number | string | null;
  needRB?: number | string | null;
  needTE?: number | string | null;
  needWR?: number | string | null;
  recommendationType?: DraftRecommendationType | "ALL" | string | null;
  showDrafted?: boolean | string | null;
  includeLowConfidence?: boolean;
  strategyProfile?: DraftStrategyProfile | string | null;
};

export type DraftContextFactor = {
  key: string;
  label: string;
  impact: number;
  direction: "BOOST" | "PENALTY" | "NEUTRAL";
  explanation: string;
};

export type DraftMarketValue = {
  marketRank: number | null;
  adp: number | null;
  currentPick: number;
  valueVsPick: number | null;
  valueVsAdp: number | null;
  marketValueStatus: DraftMarketValueStatus;
  matchedInput: DraftMarketInputRow | null;
  explanation: string;
};

export type DraftContext = {
  selectedLeague: DraftLeagueContext | null;
  leagueSize: number | null;
  scoringFormat: string;
  rosterSlots: DraftPositionCounts;
  draftRound: number;
  draftPick: number;
  manualDraftedPositions: DraftPositionCounts;
  currentRosterNeeds: DraftPositionCounts;
  draftedPositions: DraftPositionCounts;
  targetSeason: number;
  strategyProfile: DraftStrategyProfile;
  adp: DraftMarketValue;
};

export type DraftLeagueContext = {
  id: string;
  name: string;
  platform: string;
  season: number;
  teamCount: number;
  scoringPreset: string;
  scoringFormat: string;
  rosterSlots: DraftPositionCounts;
  rosterSummary: string;
  hasScoringRules: boolean;
  hasRosterSettings: boolean;
  tePremium: boolean;
  superflex: boolean;
};

export type DraftRecommendation = {
  recommendation: DecisionRecommendation;
  baseDecisionScore: number;
  draftRecommendationType: DraftRecommendationType;
  draftBoardStatus: DraftBoardPlayerStatus;
  trustScore: number | null;
  scoreAdjustment: number;
  contextFactors: DraftContextFactor[];
  marketValue: DraftMarketValue;
  leagueFitStatus: "ACTIVE" | "NEUTRAL_NOT_CONNECTED";
  rosterFitStatus: "ACTIVE" | "NEUTRAL_NOT_CONNECTED";
};

export type DraftCommandCenterDashboard = {
  filters: {
    targetSeason: number;
    includeHistorical: boolean;
    position: string | null;
    minDecisionScore: number;
    recommendationType: DraftRecommendationType | "ALL";
    includeLowConfidence: boolean;
    includeMarketUnavailable: boolean;
    marketFilter: DraftMarketFilter;
    minValueVsPick: number | null;
  };
  draftContext: DraftContext;
  draftBoard: DraftBoardState;
  marketContext: DraftMarketContext;
  leagueOptions: DraftLeagueContext[];
  sourceDashboard: DecisionEngineDashboard;
  recommendations: DraftRecommendation[];
  widgets: {
    topDraftTargets: DraftRecommendation[];
    valueTargets: DraftRecommendation[];
    waitOrAvoid: DraftRecommendation[];
    highestConfidence: DraftRecommendation[];
  };
  candidatePool: {
    decisionEngineCandidates: number;
    playerTrustProfiles: number;
    playerIntelligenceRows: number;
    approvedSummaryPlayers: number;
    availableRecommendations: number;
    draftedRecommendations: number;
    projectedPlayers: number;
    importedRosteredPlayers: number;
  };
  context: {
    leagueContext: "ACTIVE" | "NEUTRAL_NOT_CONNECTED";
    adp: "UNAVAILABLE_NEUTRAL";
    rosterConstruction: "ACTIVE";
    scoringFit: "ACTIVE" | "NEUTRAL_NOT_CONNECTED";
    positionScarcity: "FUTURE_INTEGRATION";
    byeWeeks: "FUTURE_INTEGRATION";
    userPreferences: "ACTIVE";
    injuryData: "FUTURE_INTEGRATION";
  };
};

export const DRAFT_RECOMMENDATION_TYPES = [
  "ALL",
  "DRAFT",
  "VALUE",
  "WAIT",
  "AVOID",
  "REACH",
] as const;

export const DRAFT_STRATEGY_PROFILES = [
  "BALANCED",
  "UPSIDE",
  "SAFE_FLOOR",
  "HERO_RB",
  "ZERO_RB",
] as const;

export const DRAFT_POSITIONS = [
  "QB",
  "RB",
  "WR",
  "TE",
  "K",
  "DST",
  "IDP",
] as const satisfies readonly DraftPosition[];

export async function getDraftCommandCenterDashboard(
  filters: DraftCommandCenterFilters = {},
): Promise<DraftCommandCenterDashboard> {
  const normalizedFilters = normalizeDraftFilters(filters);
  const [leagueOptions, sourceDashboard, candidatePoolContext] =
    await Promise.all([
      getLeagueOptions(normalizedFilters.targetSeason),
      getDecisionEngineDashboard({
        includeHistorical: normalizedFilters.includeHistorical,
        limit: 100,
        position: normalizedFilters.position,
        targetSeason: normalizedFilters.targetSeason,
      }),
      getCandidatePoolContext({
        includeHistorical: normalizedFilters.includeHistorical,
        targetSeason: normalizedFilters.targetSeason,
      }),
    ]);
  const selectedLeague =
    leagueOptions.find((league) => league.id === normalizedFilters.leagueId) ??
    leagueOptions[0] ??
    null;
  const marketContext = buildDraftMarketContext({
    currentPick: getOverallPickNumber({
      pick: normalizedFilters.draftPick,
      round: normalizedFilters.draftRound,
      teamCount: selectedLeague?.teamCount ?? null,
    }),
    recommendations: sourceDashboard.recommendations,
    rawInput: normalizedFilters.adpInput,
  });
  const draftedByMePositionCounts = getDraftedPositionCountsFromRecommendations(
    sourceDashboard.recommendations,
    normalizedFilters.draftedByMe,
  );
  const draftContext = buildDraftContext({
    draftedByMePositionCounts,
    filters: normalizedFilters,
    selectedLeague,
  });
  const allRecommendations = sourceDashboard.recommendations
    .map((recommendation) =>
      mapToDraftRecommendation(
        recommendation,
        draftContext,
        getDraftBoardStatus(recommendation.subject.playerId, normalizedFilters),
        getMarketValueForRecommendation(recommendation, marketContext),
      ),
    )
    .sort(sortDraftRecommendations);
  const draftBoard = buildDraftBoardState({
    filters: normalizedFilters,
    recommendations: allRecommendations,
    selectedLeague,
  });
  const recommendations = allRecommendations
    .filter((row) =>
      normalizedFilters.showDrafted
        ? true
        : row.draftBoardStatus === "AVAILABLE",
    )
    .filter(
      (row) =>
        row.recommendation.decisionScore.score >=
        normalizedFilters.minDecisionScore,
    )
    .filter((row) =>
      normalizedFilters.recommendationType === "ALL"
        ? true
        : row.draftRecommendationType === normalizedFilters.recommendationType,
    )
    .filter((row) =>
      normalizedFilters.includeLowConfidence
        ? true
        : row.recommendation.decisionScore.confidence !== "Low",
    )
    .filter((row) =>
      normalizedFilters.includeMarketUnavailable
        ? true
        : row.marketValue.marketValueStatus !== "UNAVAILABLE_NEUTRAL",
    )
    .filter((row) => matchesMarketFilter(row, normalizedFilters.marketFilter))
    .filter(
      (row) =>
        normalizedFilters.minValueVsPick === null ||
        (row.marketValue.valueVsPick !== null &&
          row.marketValue.valueVsPick >= normalizedFilters.minValueVsPick),
    );

  return {
    candidatePool: {
      ...candidatePoolContext,
      availableRecommendations: allRecommendations.filter(
        (row) => row.draftBoardStatus === "AVAILABLE",
      ).length,
      decisionEngineCandidates: sourceDashboard.recommendations.length,
      draftedRecommendations: allRecommendations.filter(
        (row) => row.draftBoardStatus !== "AVAILABLE",
      ).length,
      playerIntelligenceRows: sourceDashboard.sourceCounts.playerIntelligenceRows,
      playerTrustProfiles: sourceDashboard.sourceCounts.playerTrustProfiles,
    },
    context: {
      adp: "UNAVAILABLE_NEUTRAL",
      byeWeeks: "FUTURE_INTEGRATION",
      injuryData: "FUTURE_INTEGRATION",
      leagueContext: selectedLeague ? "ACTIVE" : "NEUTRAL_NOT_CONNECTED",
      positionScarcity: "FUTURE_INTEGRATION",
      rosterConstruction: "ACTIVE",
      scoringFit: selectedLeague ? "ACTIVE" : "NEUTRAL_NOT_CONNECTED",
      userPreferences: "ACTIVE",
    },
    draftContext,
    draftBoard,
    filters: {
      includeHistorical: normalizedFilters.includeHistorical,
      includeLowConfidence: normalizedFilters.includeLowConfidence,
      includeMarketUnavailable: normalizedFilters.includeMarketUnavailable,
      marketFilter: normalizedFilters.marketFilter,
      minDecisionScore: normalizedFilters.minDecisionScore,
      minValueVsPick: normalizedFilters.minValueVsPick,
      position: normalizedFilters.position,
      recommendationType: normalizedFilters.recommendationType,
      targetSeason: normalizedFilters.targetSeason,
    },
    leagueOptions,
    marketContext,
    recommendations,
    sourceDashboard,
    widgets: buildDraftWidgets(recommendations),
  };
}

function mapToDraftRecommendation(
  recommendation: DecisionRecommendation,
  draftContext: DraftContext,
  draftBoardStatus: DraftBoardPlayerStatus,
  marketValue: DraftMarketValue,
): DraftRecommendation {
  const draftRecommendationType = getDraftRecommendationType(
    recommendation.type,
  );
  const contextFactors = getDraftContextFactors({
    draftBoardStatus,
    draftRecommendationType,
    marketValue,
    recommendation,
    draftContext,
  });
  const scoreAdjustment = clamp(
    contextFactors.reduce((total, factor) => total + factor.impact, 0),
    -20,
    20,
  );
  const adjustedRecommendation = applyDraftContextToRecommendation({
    contextFactors,
    draftContext,
    recommendation,
    scoreAdjustment,
  });

  return {
    baseDecisionScore: recommendation.decisionScore.score,
    contextFactors,
    draftBoardStatus,
    draftRecommendationType,
    leagueFitStatus: draftContext.selectedLeague
      ? "ACTIVE"
      : "NEUTRAL_NOT_CONNECTED",
    marketValue,
    recommendation: adjustedRecommendation,
    rosterFitStatus: "ACTIVE",
    scoreAdjustment,
    trustScore: getTrustScore(recommendation),
  };
}

function applyDraftContextToRecommendation({
  contextFactors,
  draftContext,
  recommendation,
  scoreAdjustment,
}: {
  contextFactors: DraftContextFactor[];
  draftContext: DraftContext;
  recommendation: DecisionRecommendation;
  scoreAdjustment: number;
}) {
  const adjustedScore = clamp(
    recommendation.decisionScore.score + scoreAdjustment,
    0,
    100,
  );
  const contextSupportFactors = contextFactors
    .filter((factor) => factor.direction !== "PENALTY")
    .map((factor): SupportingFactor => ({
      direction: factor.direction === "BOOST" ? "POSITIVE" : "NEUTRAL",
      explanation: factor.explanation,
      key: `draft-context-${factor.key}`,
      label: factor.label,
      value: factor.impact === 0 ? "Neutral" : `+${factor.impact}`,
    }));
  const contextRiskFactors = contextFactors
    .filter((factor) => factor.direction === "PENALTY")
    .map((factor): RiskFactor => ({
      direction: "RISK",
      explanation: factor.explanation,
      key: `draft-context-${factor.key}`,
      label: factor.label,
      severity: Math.abs(factor.impact) >= 7 ? "Medium" : "Low",
      value: factor.impact,
    }));
  const contextSentence = getContextExplanation(contextFactors, scoreAdjustment);

  return {
    ...recommendation,
    decisionScore: {
      ...recommendation.decisionScore,
      components: [
        ...recommendation.decisionScore.components,
        {
          explanation:
            "Conservative adjustment from selected league, roster needs, drafted positions, strategy profile, availability, and manual market value.",
          key: "draftContext",
          label: "Draft Context",
          rawValue: 50 + scoreAdjustment,
          weight: 0.1,
          weightedValue: scoreAdjustment,
        },
      ],
      score: adjustedScore,
      scoreLabel: getDraftAdjustedScoreLabel(adjustedScore),
    },
    explanation: `${recommendation.explanation} ${contextSentence}`,
    riskFactors: [...recommendation.riskFactors, ...contextRiskFactors],
    supportingFactors: [
      ...recommendation.supportingFactors,
      ...contextSupportFactors,
    ],
    warnings:
      contextRiskFactors.length > 0
        ? [
            ...recommendation.warnings,
            ...contextRiskFactors.map((risk) => ({
              key: risk.key,
              label: risk.label,
              message: risk.explanation,
              severity: risk.severity,
            })),
          ]
        : recommendation.warnings,
    context: {
      ...recommendation.context,
      targetSeason: draftContext.targetSeason,
    },
  };
}

function buildDraftContext({
  draftedByMePositionCounts,
  filters,
  selectedLeague,
}: {
  draftedByMePositionCounts: DraftPositionCounts;
  filters: ReturnType<typeof normalizeDraftFilters>;
  selectedLeague: DraftLeagueContext | null;
}): DraftContext {
  const manualDraftedPositions = getPositionCountsFromFilters(filters, "drafted");
  const draftedPositions = mergePositionCounts(
    manualDraftedPositions,
    draftedByMePositionCounts,
  );
  const explicitNeeds = getPositionCountsFromFilters(filters, "need");
  const baseRosterSlots = selectedLeague?.rosterSlots ?? getEmptyPositionCounts();
  const currentRosterNeeds = mergeRosterNeeds({
    draftedPositions,
    explicitNeeds,
    rosterSlots: baseRosterSlots,
  });

  return {
    adp: {
      adp: null,
      currentPick: filters.draftPick,
      explanation:
        "Market data unavailable; value score neutral.",
      matchedInput: null,
      marketRank: null,
      marketValueStatus: "UNAVAILABLE_NEUTRAL",
      valueVsPick: null,
      valueVsAdp: null,
    },
    currentRosterNeeds,
    draftedPositions,
    draftPick: filters.draftPick,
    draftRound: filters.draftRound,
    leagueSize: selectedLeague?.teamCount ?? null,
    manualDraftedPositions,
    rosterSlots: baseRosterSlots,
    scoringFormat: selectedLeague?.scoringFormat ?? "Neutral scoring",
    selectedLeague,
    strategyProfile: filters.strategyProfile,
    targetSeason: filters.targetSeason,
  };
}

function getDraftContextFactors({
  draftBoardStatus,
  draftContext,
  draftRecommendationType,
  marketValue,
  recommendation,
}: {
  draftBoardStatus: DraftBoardPlayerStatus;
  draftContext: DraftContext;
  draftRecommendationType: DraftRecommendationType;
  marketValue: DraftMarketValue;
  recommendation: DecisionRecommendation;
}) {
  const position = normalizeDraftPosition(recommendation.subject.position);
  const factors: DraftContextFactor[] = [
    getAvailablePoolFactor(draftBoardStatus),
    getRosterNeedFactor(position, draftContext),
    getDraftedPositionFactor(position, draftContext),
    getStrategyProfileFactor({
      draftContext,
      draftRecommendationType,
      position,
      recommendation,
    }),
    getScoringFitFactor(position, draftContext),
    getMarketValueFactor(marketValue),
  ];

  return factors.filter((factor) => factor.direction !== "NEUTRAL" || factor.impact === 0);
}

function getAvailablePoolFactor(
  draftBoardStatus: DraftBoardPlayerStatus,
): DraftContextFactor {
  if (draftBoardStatus === "DRAFTED_BY_ME") {
    return {
      direction: "PENALTY",
      explanation:
        "Already drafted by you, so this player is unavailable for another pick.",
      impact: -14,
      key: "draft-board-drafted-by-me",
      label: "Unavailable",
    };
  }
  if (draftBoardStatus === "DRAFTED_BY_OTHER") {
    return {
      direction: "PENALTY",
      explanation:
        "Already drafted by another team, so this player is unavailable.",
      impact: -14,
      key: "draft-board-drafted-by-other",
      label: "Unavailable",
    };
  }

  return {
    direction: "NEUTRAL",
    explanation:
      "Recommended from available player pool. Unavailable players are hidden by default.",
    impact: 0,
    key: "draft-board-available",
    label: "Available player pool",
  };
}

function getMarketValueFactor(marketValue: DraftMarketValue): DraftContextFactor {
  const impacts: Record<DraftMarketValueStatus, number> = {
    AVOID_AT_COST: -9,
    FAIR_PRICE: 1,
    REACH: -6,
    SLIGHT_REACH: -3,
    STRONG_VALUE: 8,
    UNAVAILABLE_NEUTRAL: 0,
    VALUE: 5,
  };
  const direction =
    impacts[marketValue.marketValueStatus] > 0
      ? "BOOST"
      : impacts[marketValue.marketValueStatus] < 0
        ? "PENALTY"
        : "NEUTRAL";

  return {
    direction,
    explanation: marketValue.explanation,
    impact: impacts[marketValue.marketValueStatus],
    key: `market-value-${marketValue.marketValueStatus.toLowerCase()}`,
    label: "Market value",
  };
}

function getRosterNeedFactor(
  position: DraftPosition | null,
  draftContext: DraftContext,
): DraftContextFactor {
  if (!position) {
    return {
      direction: "NEUTRAL",
      explanation: "Roster need could not be evaluated for this position.",
      impact: 0,
      key: "roster-need-unknown",
      label: "Roster need",
    };
  }

  const need = draftContext.currentRosterNeeds[position] ?? 0;
  if (need >= 2) {
    return {
      direction: "BOOST",
      explanation: `Boosted because ${position} is a current roster need.`,
      impact: 8,
      key: `roster-need-${position}`,
      label: `${position} need`,
    };
  }
  if (need === 1) {
    return {
      direction: "BOOST",
      explanation: `Slightly boosted because ${position} is still needed on this roster build.`,
      impact: 5,
      key: `roster-need-${position}`,
      label: `${position} need`,
    };
  }

  return {
    direction: "NEUTRAL",
    explanation: `${position} is not currently marked as a roster need.`,
    impact: 0,
    key: `roster-need-${position}`,
    label: `${position} need`,
  };
}

function getDraftedPositionFactor(
  position: DraftPosition | null,
  draftContext: DraftContext,
): DraftContextFactor {
  if (!position) {
    return {
      direction: "NEUTRAL",
      explanation: "Drafted-position pressure could not be evaluated.",
      impact: 0,
      key: "drafted-position-unknown",
      label: "Drafted positions",
    };
  }

  const draftedCount = draftContext.draftedPositions[position] ?? 0;
  const targetCount = draftContext.rosterSlots[position] ?? 0;

  if (targetCount > 0 && draftedCount > targetCount) {
    return {
      direction: "PENALTY",
      explanation: `Slightly penalized because ${position} is already over the selected league's starter requirement.`,
      impact: -6,
      key: `drafted-overfill-${position}`,
      label: `${position} already filled`,
    };
  }
  if (targetCount === 0 && draftedCount >= 2) {
    return {
      direction: "PENALTY",
      explanation: `Slightly penalized because multiple ${position} players are already drafted in the manual context.`,
      impact: -4,
      key: `drafted-heavy-${position}`,
      label: `${position} already drafted`,
    };
  }

  return {
    direction: "NEUTRAL",
    explanation: `${position} is not overfilled in the current draft context.`,
    impact: 0,
    key: `drafted-position-${position}`,
    label: `${position} drafted`,
  };
}

function getStrategyProfileFactor({
  draftContext,
  draftRecommendationType,
  position,
  recommendation,
}: {
  draftContext: DraftContext;
  draftRecommendationType: DraftRecommendationType;
  position: DraftPosition | null;
  recommendation: DecisionRecommendation;
}): DraftContextFactor {
  const profile = draftContext.strategyProfile;

  if (profile === "HERO_RB" && position === "RB") {
    return {
      direction: "BOOST",
      explanation: "Boosted by Hero RB strategy.",
      impact: draftContext.draftRound <= 3 ? 6 : 3,
      key: "strategy-hero-rb",
      label: "Hero RB strategy",
    };
  }
  if (profile === "ZERO_RB" && position === "RB" && draftContext.draftRound <= 5) {
    return {
      direction: "PENALTY",
      explanation: "Slightly penalized by Zero RB strategy in the early rounds.",
      impact: -7,
      key: "strategy-zero-rb-rb",
      label: "Zero RB strategy",
    };
  }
  if (
    profile === "ZERO_RB" &&
    (position === "WR" || position === "TE") &&
    draftContext.draftRound <= 5
  ) {
    return {
      direction: "BOOST",
      explanation: `Boosted by Zero RB strategy because ${position} fits the early-round build.`,
      impact: 4,
      key: `strategy-zero-rb-${position}`,
      label: "Zero RB strategy",
    };
  }
  if (profile === "SAFE_FLOOR") {
    const hasHighRisk = recommendation.riskFactors.some(
      (risk) => risk.severity === "High",
    );

    return {
      direction: hasHighRisk ? "PENALTY" : "BOOST",
      explanation: hasHighRisk
        ? "Slightly penalized by Safe Floor strategy because this recommendation has high-risk flags."
        : "Boosted by Safe Floor strategy because the recommendation avoids high-risk flags.",
      impact: hasHighRisk ? -5 : recommendation.decisionScore.confidence === "High" ? 4 : 2,
      key: "strategy-safe-floor",
      label: "Safe Floor strategy",
    };
  }
  if (profile === "UPSIDE") {
    const hasRisk = recommendation.riskFactors.length > 0;

    return {
      direction:
        draftRecommendationType === "AVOID" || !hasRisk ? "NEUTRAL" : "BOOST",
      explanation:
        draftRecommendationType === "AVOID" || !hasRisk
          ? "Upside strategy is neutral for this recommendation."
          : "Slightly boosted by Upside strategy because the profile accepts some volatility.",
      impact: draftRecommendationType === "AVOID" || !hasRisk ? 0 : 3,
      key: "strategy-upside",
      label: "Upside strategy",
    };
  }

  return {
    direction: "NEUTRAL",
    explanation: "Balanced strategy keeps player recommendations neutral.",
    impact: 0,
    key: "strategy-balanced",
    label: "Balanced strategy",
  };
}

function getScoringFitFactor(
  position: DraftPosition | null,
  draftContext: DraftContext,
): DraftContextFactor {
  const league = draftContext.selectedLeague;

  if (!position || !league) {
    return {
      direction: "NEUTRAL",
      explanation: "League scoring context is neutral until a league is selected.",
      impact: 0,
      key: "scoring-neutral",
      label: "Scoring fit",
    };
  }
  if (league.superflex && position === "QB") {
    return {
      direction: "BOOST",
      explanation: "Boosted because the selected league has superflex or 2QB settings.",
      impact: 5,
      key: "scoring-superflex-qb",
      label: "Superflex scoring fit",
    };
  }
  if (league.tePremium && position === "TE") {
    return {
      direction: "BOOST",
      explanation: "Boosted because TE premium scoring is detected.",
      impact: 4,
      key: "scoring-te-premium",
      label: "TE premium fit",
    };
  }
  if (league.scoringPreset === "PPR" && (position === "WR" || position === "TE")) {
    return {
      direction: "BOOST",
      explanation: `Slightly boosted because ${position} benefits from PPR scoring.`,
      impact: 3,
      key: `scoring-ppr-${position}`,
      label: "PPR scoring fit",
    };
  }
  if (league.scoringPreset === "HALF_PPR" && ["RB", "WR", "TE"].includes(position)) {
    return {
      direction: "BOOST",
      explanation: `Slightly boosted because ${position} benefits from half-PPR scoring.`,
      impact: 2,
      key: `scoring-half-ppr-${position}`,
      label: "Half-PPR scoring fit",
    };
  }
  if (league.scoringPreset === "STANDARD" && position === "RB") {
    return {
      direction: "BOOST",
      explanation: "Slightly boosted because RBs retain more relative value in standard scoring.",
      impact: 3,
      key: "scoring-standard-rb",
      label: "Standard scoring fit",
    };
  }

  return {
    direction: "NEUTRAL",
    explanation: "League scoring context is available but does not materially change this position.",
    impact: 0,
    key: `scoring-neutral-${position}`,
    label: "Scoring fit",
  };
}

function buildDraftWidgets(recommendations: DraftRecommendation[]) {
  return {
    topDraftTargets: recommendations
      .filter((row) =>
        ["DRAFT", "VALUE", "REACH"].includes(row.draftRecommendationType),
      )
      .slice(0, 5),
    valueTargets: recommendations
      .filter((row) => row.draftRecommendationType === "VALUE")
      .slice(0, 5),
    waitOrAvoid: recommendations
      .filter((row) =>
        ["WAIT", "AVOID"].includes(row.draftRecommendationType),
      )
      .slice(0, 5),
    highestConfidence: [...recommendations]
      .sort(
        (rowA, rowB) =>
          getConfidenceRank(rowB.recommendation.decisionScore.confidence) -
            getConfidenceRank(rowA.recommendation.decisionScore.confidence) ||
          rowB.recommendation.decisionScore.score -
            rowA.recommendation.decisionScore.score,
      )
      .slice(0, 5),
  };
}

function getDraftRecommendationType(
  type: DecisionRecommendationType,
): DraftRecommendationType {
  if (type === "DRAFT" || type === "START") return "DRAFT";
  if (type === "VALUE" || type === "BUY" || type === "WAIVER_ADD") {
    return "VALUE";
  }
  if (type === "AVOID" || type === "SELL" || type === "SIT") return "AVOID";
  if (type === "REACH") return "REACH";

  return "WAIT";
}

function normalizeDraftFilters(filters: DraftCommandCenterFilters) {
  const parsedMinScore = Number(
    String(filters.minDecisionScore ?? "").trim(),
  );
  const parsedMinValueVsPick = Number(
    String(filters.minValueVsPick ?? "").trim(),
  );
  const parsedRound = Number(String(filters.draftRound ?? "").trim());
  const parsedPick = Number(String(filters.draftPick ?? "").trim());

  return {
    adpInput: String(filters.adpInput ?? ""),
    draftedByMe: parsePlayerIdList(filters.draftedByMe),
    draftedByOthers: parsePlayerIdList(filters.draftedByOthers),
    draftedDST: parseCount(filters.draftedDST),
    draftedIDP: parseCount(filters.draftedIDP),
    draftedK: parseCount(filters.draftedK),
    draftedQB: parseCount(filters.draftedQB),
    draftedRB: parseCount(filters.draftedRB),
    draftedTE: parseCount(filters.draftedTE),
    draftedWR: parseCount(filters.draftedWR),
    draftPick: Number.isInteger(parsedPick) ? clamp(parsedPick, 1, 300) : 1,
    draftRound: Number.isInteger(parsedRound) ? clamp(parsedRound, 1, 30) : 1,
    includeHistorical: Boolean(filters.includeHistorical),
    includeLowConfidence: filters.includeLowConfidence !== false,
    includeMarketUnavailable: filters.includeMarketUnavailable !== false &&
      String(filters.includeMarketUnavailable) !== "false",
    leagueId: filters.leagueId?.trim() || null,
    marketFilter: normalizeMarketFilter(filters.marketFilter),
    minDecisionScore: Number.isInteger(parsedMinScore)
      ? clamp(parsedMinScore, 0, 100)
      : 0,
    minValueVsPick: Number.isFinite(parsedMinValueVsPick)
      ? parsedMinValueVsPick
      : null,
    needDST: parseCount(filters.needDST),
    needIDP: parseCount(filters.needIDP),
    needK: parseCount(filters.needK),
    needQB: parseCount(filters.needQB),
    needRB: parseCount(filters.needRB),
    needTE: parseCount(filters.needTE),
    needWR: parseCount(filters.needWR),
    position: filters.position?.trim() || null,
    recommendationType: normalizeDraftRecommendationType(
      filters.recommendationType,
    ),
    showDrafted:
      filters.showDrafted === true || String(filters.showDrafted) === "true",
    strategyProfile: normalizeStrategyProfile(filters.strategyProfile),
    targetSeason: normalizeTargetSeason(filters.targetSeason),
  };
}

function getDraftBoardStatus(
  playerId: string,
  filters: ReturnType<typeof normalizeDraftFilters>,
): DraftBoardPlayerStatus {
  if (filters.draftedByMe.includes(playerId)) return "DRAFTED_BY_ME";
  if (filters.draftedByOthers.includes(playerId)) return "DRAFTED_BY_OTHER";

  return "AVAILABLE";
}

function buildDraftBoardState({
  filters,
  recommendations,
  selectedLeague,
}: {
  filters: ReturnType<typeof normalizeDraftFilters>;
  recommendations: DraftRecommendation[];
  selectedLeague: DraftLeagueContext | null;
}): DraftBoardState {
  const draftedByMe = recommendations
    .filter((row) => row.draftBoardStatus === "DRAFTED_BY_ME")
    .map((row, index) =>
      mapDraftBoardPlayer({
        index,
        row,
        status: "DRAFTED_BY_ME",
        teamCount: selectedLeague?.teamCount ?? null,
      }),
    );
  const draftedByOthers = recommendations
    .filter((row) => row.draftBoardStatus === "DRAFTED_BY_OTHER")
    .map((row, index) =>
      mapDraftBoardPlayer({
        index,
        row,
        status: "DRAFTED_BY_OTHER",
        teamCount: selectedLeague?.teamCount ?? null,
      }),
    );

  return {
    availableCount: recommendations.length - draftedByMe.length - draftedByOthers.length,
    currentPick: filters.draftPick,
    currentPickNumber: getOverallPickNumber({
      pick: filters.draftPick,
      round: filters.draftRound,
      teamCount: selectedLeague?.teamCount ?? null,
    }),
    currentRound: filters.draftRound,
    draftedByMe,
    draftedByMeCount: draftedByMe.length,
    draftedByMePositionCounts:
      getDraftedPositionCountsFromDraftBoardPlayers(draftedByMe),
    draftedByOtherPositionCounts:
      getDraftedPositionCountsFromDraftBoardPlayers(draftedByOthers),
    draftedByOthers,
    draftedByOthersCount: draftedByOthers.length,
    draftedCount: draftedByMe.length + draftedByOthers.length,
    hideDraftedPlayers: !filters.showDrafted,
    source: "MANUAL",
  };
}

function buildDraftMarketContext({
  currentPick,
  rawInput,
  recommendations,
}: {
  currentPick: number;
  rawInput: string;
  recommendations: DecisionRecommendation[];
}): DraftMarketContext {
  const rows = parseDraftMarketInput(rawInput);
  const matchedRows: Array<DraftMarketInputRow & { playerId: string }> = [];
  const unmatchedRows: DraftMarketUnmatchedRow[] = [];
  const matchedPlayerIds = new Set<string>();

  for (const row of rows) {
    const match = findMarketRowRecommendation(row, recommendations);

    if (!match.recommendation) {
      unmatchedRows.push({
        ...row,
        reason: match.reason,
      });
      continue;
    }
    if (matchedPlayerIds.has(match.recommendation.subject.playerId)) {
      unmatchedRows.push({
        ...row,
        reason: "Duplicate market row for an already matched player.",
      });
      continue;
    }

    matchedPlayerIds.add(match.recommendation.subject.playerId);
    matchedRows.push({
      ...row,
      playerId: match.recommendation.subject.playerId,
    });
  }

  return {
    currentPick,
    matchedCount: matchedPlayerIds.size,
    matchedRows,
    rawInput,
    source: rows.length > 0 ? "MANUAL" : "UNAVAILABLE",
    unmatchedRows,
  };
}

function getMarketValueForRecommendation(
  recommendation: DecisionRecommendation,
  marketContext: DraftMarketContext,
): DraftMarketValue {
  const row = marketContext.matchedRows.find(
    (candidate) => candidate.playerId === recommendation.subject.playerId,
  );

  if (!row) {
    return getUnavailableMarketValue(marketContext.currentPick);
  }

  return calculateMarketValue({
    currentPick: marketContext.currentPick,
    row,
  });
}

function parseDraftMarketInput(rawInput: string): DraftMarketInputRow[] {
  const lines = rawInput
    .split(/\r?\n/)
    .map((line, index) => ({
      lineNumber: index + 1,
      raw: line.trim(),
    }))
    .filter((line) => line.raw.length > 0);
  const firstLineColumns = splitMarketCsvLine(lines[0]?.raw ?? "");
  const hasHeader = firstLineColumns.some((column) =>
    ["player", "player name", "name"].includes(normalizeHeader(column)),
  );
  const headerColumns = hasHeader ? firstLineColumns.map(normalizeHeader) : [];

  return lines
    .slice(hasHeader ? 1 : 0)
    .map((line) =>
      hasHeader
        ? parseHeaderMarketInputRow({
            columns: splitMarketCsvLine(line.raw),
            headerColumns,
            lineNumber: line.lineNumber,
            raw: line.raw,
          })
        : parsePositionalMarketInputRow({
            columns: splitMarketCsvLine(line.raw),
            lineNumber: line.lineNumber,
            raw: line.raw,
          }),
    )
    .filter((row): row is DraftMarketInputRow => Boolean(row));
}

function parseHeaderMarketInputRow({
  columns,
  headerColumns,
  lineNumber,
  raw,
}: {
  columns: string[];
  headerColumns: string[];
  lineNumber: number;
  raw: string;
}): DraftMarketInputRow | null {
  const playerName =
    getHeaderValue(columns, headerColumns, ["player", "player name", "name"]) ??
    "";

  if (!playerName.trim()) return null;

  return {
    adp: parseNullableNumber(
      getHeaderValue(columns, headerColumns, ["adp", "average draft position"]),
    ),
    lineNumber,
    marketRank: parseNullableNumber(
      getHeaderValue(columns, headerColumns, ["rank", "market rank"]),
    ),
    normalizedName: normalizeMarketName(playerName),
    playerName: playerName.trim(),
    position:
      getHeaderValue(columns, headerColumns, ["position", "pos"])?.trim() ||
      null,
    raw,
    team:
      getHeaderValue(columns, headerColumns, ["team", "nfl team"])?.trim() ||
      null,
  };
}

function parsePositionalMarketInputRow({
  columns,
  lineNumber,
  raw,
}: {
  columns: string[];
  lineNumber: number;
  raw: string;
}): DraftMarketInputRow | null {
  const playerName = columns[0]?.trim() ?? "";
  if (!playerName) return null;

  if (columns.length >= 5) {
    return {
      adp: parseNullableNumber(columns[3]),
      lineNumber,
      marketRank: parseNullableNumber(columns[4]),
      normalizedName: normalizeMarketName(playerName),
      playerName,
      position: columns[2]?.trim() || null,
      raw,
      team: columns[1]?.trim() || null,
    };
  }
  if (columns.length === 4) {
    return {
      adp: parseNullableNumber(columns[2]),
      lineNumber,
      marketRank: parseNullableNumber(columns[3]),
      normalizedName: normalizeMarketName(playerName),
      playerName,
      position: null,
      raw,
      team: columns[1]?.trim() || null,
    };
  }

  const firstValue = parseNullableNumber(columns[1]);
  const secondValue = parseNullableNumber(columns[2]);

  return {
    adp: columns.length === 2 ? firstValue : firstValue,
    lineNumber,
    marketRank: columns.length === 2 ? firstValue : secondValue,
    normalizedName: normalizeMarketName(playerName),
    playerName,
    position: null,
    raw,
    team: null,
  };
}

function findMarketRowRecommendation(
  row: DraftMarketInputRow,
  recommendations: DecisionRecommendation[],
) {
  const nameMatches = recommendations.filter(
    (recommendation) =>
      normalizeMarketName(recommendation.subject.playerName) ===
      row.normalizedName,
  );
  const teamMatches = row.team
    ? nameMatches.filter(
        (recommendation) =>
          normalizeTeam(recommendation.subject.team) === normalizeTeam(row.team),
      )
    : nameMatches;
  const positionMatches = row.position
    ? teamMatches.filter(
        (recommendation) =>
          normalizePosition(recommendation.subject.position) ===
          normalizePosition(row.position),
      )
    : teamMatches;

  if (positionMatches.length === 1) {
    return {
      recommendation: positionMatches[0],
      reason: "Matched by exact normalized player name.",
    };
  }
  if (positionMatches.length > 1) {
    return {
      recommendation: null,
      reason: "Multiple exact player-name matches. Add team or position.",
    };
  }
  if (nameMatches.length > 0 && row.team) {
    return {
      recommendation: null,
      reason: "Player name matched, but team did not match.",
    };
  }
  if (teamMatches.length > 0 && row.position) {
    return {
      recommendation: null,
      reason: "Player name/team matched, but position did not match.",
    };
  }

  return {
    recommendation: null,
    reason: "No exact normalized player-name match in current draft candidates.",
  };
}

function calculateMarketValue({
  currentPick,
  row,
}: {
  currentPick: number;
  row: DraftMarketInputRow;
}): DraftMarketValue {
  const marketPick = row.adp ?? row.marketRank;

  if (marketPick === null) return getUnavailableMarketValue(currentPick);

  const valueVsPick = Math.round((currentPick - marketPick) * 10) / 10;
  const marketValueStatus = getMarketValueStatus(valueVsPick);

  return {
    adp: row.adp,
    currentPick,
    explanation: getMarketValueExplanation({
      currentPick,
      marketValueStatus,
      row,
      valueVsPick,
    }),
    marketRank: row.marketRank,
    marketValueStatus,
    matchedInput: row,
    valueVsAdp: row.adp === null ? null : valueVsPick,
    valueVsPick,
  };
}

function getUnavailableMarketValue(currentPick: number): DraftMarketValue {
  return {
    adp: null,
    currentPick,
    explanation: "Market data unavailable; value score neutral.",
    marketRank: null,
    marketValueStatus: "UNAVAILABLE_NEUTRAL",
    matchedInput: null,
    valueVsAdp: null,
    valueVsPick: null,
  };
}

function getMarketValueStatus(valueVsPick: number): DraftMarketValueStatus {
  if (valueVsPick >= 12) return "STRONG_VALUE";
  if (valueVsPick >= 5) return "VALUE";
  if (valueVsPick >= -4) return "FAIR_PRICE";
  if (valueVsPick >= -10) return "SLIGHT_REACH";
  if (valueVsPick >= -24) return "REACH";

  return "AVOID_AT_COST";
}

function getMarketValueExplanation({
  currentPick,
  marketValueStatus,
  row,
  valueVsPick,
}: {
  currentPick: number;
  marketValueStatus: DraftMarketValueStatus;
  row: DraftMarketInputRow;
  valueVsPick: number;
}) {
  const marketLabel =
    row.adp !== null
      ? `ADP ${row.adp}`
      : row.marketRank !== null
        ? `market rank ${row.marketRank}`
        : "market data unavailable";
  const statusLabel = formatMarketValueStatus(marketValueStatus);

  if (valueVsPick > 0) {
    return `${statusLabel}: ${marketLabel} vs current pick ${currentPick}. Value vs pick: +${valueVsPick}.`;
  }
  if (valueVsPick < 0) {
    return `${statusLabel}: ${marketLabel} vs current pick ${currentPick}. Value vs pick: ${valueVsPick}.`;
  }

  return `${statusLabel}: ${marketLabel} matches current pick ${currentPick}.`;
}

function mapDraftBoardPlayer({
  index,
  row,
  status,
  teamCount,
}: {
  index: number;
  row: DraftRecommendation;
  status: DraftBoardPlayerStatus;
  teamCount: number | null;
}): DraftBoardPlayer {
  const pickNumber = index + 1;
  const pickContext = getRoundPickFromOverallPick({
    pickNumber,
    teamCount,
  });

  return {
    managerName: status === "DRAFTED_BY_ME" ? "Me" : "Other team",
    pick: pickContext.pick,
    pickNumber,
    playerId: row.recommendation.subject.playerId,
    playerName: row.recommendation.subject.playerName,
    position: row.recommendation.subject.position,
    round: pickContext.round,
    source: "MANUAL",
    status,
    team: row.recommendation.subject.team,
  };
}

async function getLeagueOptions(targetSeason: number): Promise<DraftLeagueContext[]> {
  const leagues = await db.league.findMany({
    where: { season: targetSeason },
    include: {
      _count: {
        select: {
          teams: true,
        },
      },
      rosterSettings: true,
      scoringRules: true,
    },
    orderBy: [{ importedAt: "desc" }, { createdAt: "desc" }],
  });

  return leagues.map((league) => {
    const rosterSlots = getRosterSlots(league.rosterSettings);
    const superflex = Boolean(
      league.rosterSettings?.superflex || league.rosterSettings?.twoQb,
    );
    const tePremium = hasTePremium(league.scoringRules);

    return {
      hasRosterSettings: Boolean(league.rosterSettings),
      hasScoringRules: league.scoringRules.length > 0,
      id: league.id,
      name: league.name,
      platform: league.platform,
      rosterSlots,
      rosterSummary: formatRosterSummary(rosterSlots),
      scoringFormat: formatScoringPreset(String(league.scoringPreset), tePremium, superflex),
      scoringPreset: String(league.scoringPreset),
      season: league.season,
      superflex,
      teamCount: league._count.teams,
      tePremium,
    };
  });
}

async function getCandidatePoolContext({
  includeHistorical,
  targetSeason,
}: {
  includeHistorical: boolean;
  targetSeason: number;
}) {
  const transcriptWhere = includeHistorical
    ? { contentSeason: targetSeason }
    : {
        contentSeason: targetSeason,
        includeInCurrentAnalysis: true,
      };
  const [
    approvedSummaryPlayers,
    projectedPlayers,
    importedRosteredPlayers,
  ] = await Promise.all([
    db.player.count({
      where: {
        transcriptPlayerSummaries: {
          some: {
            reviewStatus: "APPROVED",
            transcript: {
              is: transcriptWhere,
            },
          },
        },
      },
    }),
    db.player.count({
      where: {
        projections: {
          some: {
            season: targetSeason,
          },
        },
      },
    }),
    db.player.count({
      where: {
        rosterPlayers: {
          some: {},
        },
      },
    }),
  ]);

  return {
    approvedSummaryPlayers,
    importedRosteredPlayers,
    projectedPlayers,
  };
}

function getPositionCountsFromFilters(
  filters: ReturnType<typeof normalizeDraftFilters>,
  kind: "drafted" | "need",
): DraftPositionCounts {
  return {
    DST: kind === "drafted" ? filters.draftedDST : filters.needDST,
    IDP: kind === "drafted" ? filters.draftedIDP : filters.needIDP,
    K: kind === "drafted" ? filters.draftedK : filters.needK,
    QB: kind === "drafted" ? filters.draftedQB : filters.needQB,
    RB: kind === "drafted" ? filters.draftedRB : filters.needRB,
    TE: kind === "drafted" ? filters.draftedTE : filters.needTE,
    WR: kind === "drafted" ? filters.draftedWR : filters.needWR,
  };
}

function mergeRosterNeeds({
  draftedPositions,
  explicitNeeds,
  rosterSlots,
}: {
  draftedPositions: DraftPositionCounts;
  explicitNeeds: DraftPositionCounts;
  rosterSlots: DraftPositionCounts;
}) {
  const needs = getEmptyPositionCounts();

  for (const position of DRAFT_POSITIONS) {
    needs[position] =
      explicitNeeds[position] > 0
        ? explicitNeeds[position]
        : Math.max(0, rosterSlots[position] - draftedPositions[position]);
  }

  return needs;
}

function mergePositionCounts(
  baseCounts: DraftPositionCounts,
  additionalCounts: DraftPositionCounts,
): DraftPositionCounts {
  const mergedCounts = getEmptyPositionCounts();

  for (const position of DRAFT_POSITIONS) {
    mergedCounts[position] = baseCounts[position] + additionalCounts[position];
  }

  return mergedCounts;
}

function getDraftedPositionCountsFromRecommendations(
  recommendations: DecisionRecommendation[],
  playerIds: string[],
): DraftPositionCounts {
  const draftedCounts = getEmptyPositionCounts();
  const playerIdSet = new Set(playerIds);

  for (const recommendation of recommendations) {
    if (!playerIdSet.has(recommendation.subject.playerId)) continue;

    const position = normalizeDraftPosition(recommendation.subject.position);
    if (position) draftedCounts[position] += 1;
  }

  return draftedCounts;
}

function getDraftedPositionCountsFromDraftBoardPlayers(
  players: DraftBoardPlayer[],
): DraftPositionCounts {
  const draftedCounts = getEmptyPositionCounts();

  for (const player of players) {
    const position = normalizeDraftPosition(player.position);
    if (position) draftedCounts[position] += 1;
  }

  return draftedCounts;
}

function getOverallPickNumber({
  pick,
  round,
  teamCount,
}: {
  pick: number;
  round: number;
  teamCount: number | null;
}) {
  if (!teamCount || teamCount < 1) return pick;

  return (round - 1) * teamCount + pick;
}

function getRoundPickFromOverallPick({
  pickNumber,
  teamCount,
}: {
  pickNumber: number;
  teamCount: number | null;
}) {
  if (!teamCount || teamCount < 1) {
    return {
      pick: pickNumber,
      round: null,
    };
  }

  return {
    pick: ((pickNumber - 1) % teamCount) + 1,
    round: Math.floor((pickNumber - 1) / teamCount) + 1,
  };
}

function getRosterSlots(
  rosterSettings: {
    qb: number;
    rb: number;
    wr: number;
    te: number;
    flex: number;
    superflex: number;
    k: number;
    dst: number;
    idp: number;
  } | null,
) {
  if (!rosterSettings) return getEmptyPositionCounts();

  return {
    DST: rosterSettings.dst,
    IDP: rosterSettings.idp,
    K: rosterSettings.k,
    QB: rosterSettings.qb + rosterSettings.superflex,
    RB: rosterSettings.rb + Math.ceil(rosterSettings.flex / 3),
    TE: rosterSettings.te,
    WR: rosterSettings.wr + Math.floor(rosterSettings.flex / 3),
  };
}

function hasTePremium(
  scoringRules: Array<{ statKey: string; points: number; position: string | null }>,
) {
  const globalReception = scoringRules.find(
    (rule) => rule.statKey === "rec" && !rule.position,
  );
  const teReception = scoringRules.find(
    (rule) => rule.statKey === "rec" && rule.position === "TE",
  );

  return Boolean(
    teReception &&
      teReception.points > (globalReception?.points ?? 0) &&
      teReception.points > 0,
  );
}

function getTrustScore(recommendation: DecisionRecommendation) {
  const trustFactor = recommendation.supportingFactors.find(
    (factor) => factor.key === "trust-score",
  );
  const score =
    typeof trustFactor?.value === "number"
      ? trustFactor.value
      : Number(String(trustFactor?.value ?? "").trim());

  return Number.isFinite(score) ? score : null;
}

function normalizeDraftRecommendationType(
  value?: DraftCommandCenterFilters["recommendationType"],
): DraftRecommendationType | "ALL" {
  const normalizedValue = String(value ?? "ALL").trim().toUpperCase();

  return DRAFT_RECOMMENDATION_TYPES.includes(
    normalizedValue as (typeof DRAFT_RECOMMENDATION_TYPES)[number],
  )
    ? (normalizedValue as DraftRecommendationType | "ALL")
    : "ALL";
}

function normalizeMarketFilter(
  value?: DraftCommandCenterFilters["marketFilter"],
): DraftMarketFilter {
  const normalizedValue = String(value ?? "ALL").trim().toUpperCase();

  return ["ALL", "VALUES_ONLY", "HIDE_REACHES"].includes(normalizedValue)
    ? (normalizedValue as DraftMarketFilter)
    : "ALL";
}

function normalizeStrategyProfile(
  value?: DraftCommandCenterFilters["strategyProfile"],
): DraftStrategyProfile {
  const normalizedValue = String(value ?? "BALANCED").trim().toUpperCase();

  return DRAFT_STRATEGY_PROFILES.includes(
    normalizedValue as DraftStrategyProfile,
  )
    ? (normalizedValue as DraftStrategyProfile)
    : "BALANCED";
}

function normalizeDraftPosition(position: string): DraftPosition | null {
  const normalizedPosition = position.toUpperCase() === "DEF" ? "DST" : position.toUpperCase();

  return DRAFT_POSITIONS.includes(normalizedPosition as DraftPosition)
    ? (normalizedPosition as DraftPosition)
    : null;
}

function sortDraftRecommendations(
  rowA: DraftRecommendation,
  rowB: DraftRecommendation,
) {
  return (
    getDraftActionRank(rowA.draftRecommendationType) -
      getDraftActionRank(rowB.draftRecommendationType) ||
    rowB.recommendation.decisionScore.score -
      rowA.recommendation.decisionScore.score ||
    rowA.recommendation.subject.playerName.localeCompare(
      rowB.recommendation.subject.playerName,
    )
  );
}

function getDraftActionRank(type: DraftRecommendationType) {
  const ranks: Record<DraftRecommendationType, number> = {
    DRAFT: 0,
    VALUE: 1,
    REACH: 2,
    WAIT: 3,
    AVOID: 4,
  };

  return ranks[type];
}

function getConfidenceRank(confidence: string) {
  if (confidence === "High") return 3;
  if (confidence === "Medium") return 2;

  return 1;
}

function matchesMarketFilter(
  row: DraftRecommendation,
  marketFilter: DraftMarketFilter,
) {
  if (marketFilter === "VALUES_ONLY") {
    return ["STRONG_VALUE", "VALUE"].includes(
      row.marketValue.marketValueStatus,
    );
  }
  if (marketFilter === "HIDE_REACHES") {
    return !["SLIGHT_REACH", "REACH", "AVOID_AT_COST"].includes(
      row.marketValue.marketValueStatus,
    );
  }

  return true;
}

function getContextExplanation(
  factors: DraftContextFactor[],
  scoreAdjustment: number,
) {
  const activeFactors = factors.filter((factor) => factor.impact !== 0);
  const direction =
    scoreAdjustment > 0
      ? `Draft context added ${scoreAdjustment} point${scoreAdjustment === 1 ? "" : "s"} to the Decision Score.`
      : scoreAdjustment < 0
        ? `Draft context subtracted ${Math.abs(scoreAdjustment)} point${Math.abs(scoreAdjustment) === 1 ? "" : "s"} from the Decision Score.`
        : "Draft context is neutral for this player.";

  if (activeFactors.length === 0) {
    return `${direction} Market value is neutral when no matched ADP/rank row is supplied.`;
  }

  return `${direction} ${activeFactors
    .slice(0, 3)
    .map((factor) => factor.explanation)
    .join(" ")}`;
}

function getDraftAdjustedScoreLabel(score: number) {
  if (score >= 85) return "Strong draft edge";
  if (score >= 72) return "Positive draft edge";
  if (score >= 58) return "Lean draft edge";
  if (score >= 42) return "Context dependent";

  return "Avoid unless context changes";
}

function formatRosterSummary(rosterSlots: DraftPositionCounts) {
  return DRAFT_POSITIONS.filter((position) => rosterSlots[position] > 0)
    .map((position) => `${position} ${rosterSlots[position]}`)
    .join(", ") || "No roster settings";
}

function formatScoringPreset(
  scoringPreset: string,
  tePremium: boolean,
  superflex: boolean,
) {
  const labels: Record<string, string> = {
    CUSTOM: "Custom",
    HALF_PPR: "Half-PPR",
    PPR: "PPR",
    STANDARD: "Standard",
  };
  const addOns = [
    tePremium ? "TE premium" : null,
    superflex ? "Superflex/2QB" : null,
  ].filter(Boolean);

  return `${labels[scoringPreset] ?? scoringPreset}${addOns.length > 0 ? `, ${addOns.join(", ")}` : ""}`;
}

function formatMarketValueStatus(status: DraftMarketValueStatus) {
  const labels: Record<DraftMarketValueStatus, string> = {
    AVOID_AT_COST: "Avoid At Cost",
    FAIR_PRICE: "Fair Price",
    REACH: "Reach",
    SLIGHT_REACH: "Slight Reach",
    STRONG_VALUE: "Strong Value",
    UNAVAILABLE_NEUTRAL: "Unavailable / Neutral",
    VALUE: "Value",
  };

  return labels[status];
}

function splitMarketCsvLine(line: string) {
  return line.split(",").map((column) => column.trim());
}

function getHeaderValue(
  columns: string[],
  headerColumns: string[],
  names: string[],
) {
  const normalizedNames = new Set(names.map(normalizeHeader));
  const index = headerColumns.findIndex((header) =>
    normalizedNames.has(header),
  );

  return index >= 0 ? columns[index] : undefined;
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase();
}

function normalizeMarketName(value: string) {
  return value
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeTeam(value: string | null) {
  return String(value ?? "").trim().toUpperCase();
}

function normalizePosition(value: string | null) {
  const normalizedValue = String(value ?? "").trim().toUpperCase();

  return normalizedValue === "DEF" ? "DST" : normalizedValue;
}

function parseNullableNumber(value: string | null | undefined) {
  const parsedValue = Number(String(value ?? "").trim());

  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function getEmptyPositionCounts(): DraftPositionCounts {
  return {
    DST: 0,
    IDP: 0,
    K: 0,
    QB: 0,
    RB: 0,
    TE: 0,
    WR: 0,
  };
}

function parseCount(value: number | string | null | undefined) {
  const parsedValue =
    typeof value === "number" ? value : Number(String(value ?? "").trim());

  return Number.isInteger(parsedValue) ? clamp(parsedValue, 0, 30) : 0;
}

function parsePlayerIdList(value: string | null | undefined) {
  return Array.from(
    new Set(
      String(value ?? "")
        .split(",")
        .map((playerId) => playerId.trim())
        .filter(Boolean),
    ),
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
