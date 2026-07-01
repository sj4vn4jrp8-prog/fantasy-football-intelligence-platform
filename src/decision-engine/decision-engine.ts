import {
  attachRecommendationAlternatives,
  buildDecisionRecommendation,
} from "@/decision-engine/recommendation-builder";
import {
  DECISION_RECOMMENDATION_TYPES,
  type DecisionEngineDashboard,
  type DecisionEngineFilters,
  type DecisionRecommendation,
} from "@/decision-engine/decision-types";
import { getExpertConsensusDashboard } from "@/knowledge-brain/expert-consensus";
import { getExpertPlayerMemories } from "@/knowledge-brain/expert-memory";
import { normalizeTargetSeason } from "@/knowledge-brain/freshness";
import { getPlayerIntelligenceDirectory } from "@/knowledge-brain/player-intelligence";
import { getPlayerTrustProfiles } from "@/knowledge-brain/trust-engine";
import { getWeightedConsensusDashboard } from "@/knowledge-brain/weighted-consensus";

export async function getDecisionEngineDashboard(
  filters: DecisionEngineFilters = {},
): Promise<DecisionEngineDashboard> {
  const normalizedFilters = normalizeDecisionEngineFilters(filters);
  const [
    playerTrustProfiles,
    playerIntelligence,
    expertMemories,
    consensus,
    weightedConsensus,
  ] = await Promise.all([
    getPlayerTrustProfiles({
      includeHistorical: normalizedFilters.includeHistorical,
      targetSeason: normalizedFilters.targetSeason,
    }),
    getPlayerIntelligenceDirectory({
      includeHistorical: normalizedFilters.includeHistorical,
      position: normalizedFilters.position ?? undefined,
      targetSeason: normalizedFilters.targetSeason,
    }),
    getExpertPlayerMemories({
      includeHistorical: normalizedFilters.includeHistorical,
      targetSeason: normalizedFilters.targetSeason,
    }),
    getExpertConsensusDashboard({
      includeHistorical: normalizedFilters.includeHistorical,
      position: normalizedFilters.position,
      targetSeason: normalizedFilters.targetSeason,
    }),
    getWeightedConsensusDashboard({
      includeHistorical: normalizedFilters.includeHistorical,
      position: normalizedFilters.position,
      targetSeason: normalizedFilters.targetSeason,
    }),
  ]);
  const playerIntelligenceById = new Map(
    playerIntelligence.players.map((row) => [row.playerId, row]),
  );
  const expertMemoriesByPlayerId = groupBy(
    expertMemories,
    (memory) => memory.playerId,
  );
  const consensusByPlayerId = new Map(
    consensus.rows.map((row) => [row.playerId, row]),
  );
  const weightedConsensusByPlayerId = new Map(
    weightedConsensus.rows.map((row) => [row.playerId, row]),
  );
  const positionOptions = Array.from(
    new Set(
      [
        ...playerTrustProfiles.map((profile) => profile.position),
        ...playerIntelligence.positionOptions,
        ...consensus.positionOptions,
        ...weightedConsensus.positionOptions,
      ].filter(isNonEmptyString),
    ),
  ).sort();
  const filteredTrustProfiles = playerTrustProfiles.filter((profile) =>
    normalizedFilters.position
      ? profile.position.toLowerCase() ===
        normalizedFilters.position.toLowerCase()
      : true,
  );
  const recommendations = attachRecommendationAlternatives(
    filteredTrustProfiles
      .map((trustProfile) =>
        buildDecisionRecommendation({
          consensus: consensusByPlayerId.get(trustProfile.playerId) ?? null,
          expertMemories:
            expertMemoriesByPlayerId.get(trustProfile.playerId) ?? [],
          playerIntelligence:
            playerIntelligenceById.get(trustProfile.playerId) ?? null,
          targetSeason: normalizedFilters.targetSeason,
          trustProfile,
          weightedConsensus:
            weightedConsensusByPlayerId.get(trustProfile.playerId) ?? null,
        }),
      )
      .sort(sortRecommendations),
  );
  const limitedRecommendations = recommendations.slice(
    0,
    normalizedFilters.limit,
  );

  return {
    filters: normalizedFilters,
    positionOptions,
    recommendations: limitedRecommendations,
    sourceCounts: {
      consensusRows: consensus.rows.length,
      expertMemoryRows: expertMemories.length,
      playerIntelligenceRows: playerIntelligence.players.length,
      playerTrustProfiles: playerTrustProfiles.length,
      weightedConsensusRows: weightedConsensus.rows.length,
    },
    supportedRecommendationTypes: [...DECISION_RECOMMENDATION_TYPES],
    widgets: buildDecisionWidgets(limitedRecommendations),
  };
}

function buildDecisionWidgets(recommendations: DecisionRecommendation[]) {
  return {
    strongestRecommendations: [...recommendations]
      .filter((recommendation) => recommendation.decisionScore.score >= 58)
      .sort(sortRecommendations)
      .slice(0, 5),
    highestRiskRecommendations: [...recommendations]
      .filter((recommendation) => recommendation.riskFactors.length > 0)
      .sort(sortByRisk)
      .slice(0, 5),
    draftTargets: [...recommendations]
      .filter((recommendation) =>
        ["DRAFT", "VALUE", "BUY", "REACH"].includes(recommendation.type),
      )
      .sort(sortRecommendations)
      .slice(0, 5),
    avoidList: [...recommendations]
      .filter((recommendation) =>
        ["AVOID", "SELL", "SIT"].includes(recommendation.type),
      )
      .sort(sortRecommendations)
      .slice(0, 5),
    watchList: [...recommendations]
      .filter((recommendation) =>
        ["WAIT", "HOLD", "WAIVER_HOLD"].includes(recommendation.type),
      )
      .sort(sortRecommendations)
      .slice(0, 5),
  };
}

function normalizeDecisionEngineFilters(filters: DecisionEngineFilters) {
  const parsedLimit =
    typeof filters.limit === "number"
      ? filters.limit
      : Number(String(filters.limit ?? "").trim());

  return {
    includeHistorical: Boolean(filters.includeHistorical),
    limit: Number.isInteger(parsedLimit) ? clamp(parsedLimit, 5, 100) : 30,
    position: filters.position?.trim() || null,
    targetSeason: normalizeTargetSeason(filters.targetSeason),
  };
}

function sortRecommendations(
  recommendationA: DecisionRecommendation,
  recommendationB: DecisionRecommendation,
) {
  return (
    recommendationB.decisionScore.score - recommendationA.decisionScore.score ||
    recommendationB.supportingFactors.length -
      recommendationA.supportingFactors.length ||
    recommendationA.subject.playerName.localeCompare(
      recommendationB.subject.playerName,
    )
  );
}

function sortByRisk(
  recommendationA: DecisionRecommendation,
  recommendationB: DecisionRecommendation,
) {
  return (
    getRiskWeight(recommendationB) - getRiskWeight(recommendationA) ||
    recommendationB.decisionScore.score - recommendationA.decisionScore.score ||
    recommendationA.subject.playerName.localeCompare(
      recommendationB.subject.playerName,
    )
  );
}

function getRiskWeight(recommendation: DecisionRecommendation) {
  return recommendation.riskFactors.reduce((total, risk) => {
    if (risk.severity === "High") return total + 3;
    if (risk.severity === "Medium") return total + 2;

    return total + 1;
  }, 0);
}

function groupBy<T>(items: T[], getKey: (item: T) => string) {
  const groups = new Map<string, T[]>();

  for (const item of items) {
    const key = getKey(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  return groups;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
