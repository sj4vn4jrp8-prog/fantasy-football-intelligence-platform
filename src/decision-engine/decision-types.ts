export type DecisionRecommendationType =
  | "DRAFT"
  | "AVOID"
  | "REACH"
  | "WAIT"
  | "VALUE"
  | "BUY"
  | "SELL"
  | "HOLD"
  | "START"
  | "SIT"
  | "WAIVER_ADD"
  | "WAIVER_HOLD";

export type DecisionFactorDirection =
  | "POSITIVE"
  | "NEGATIVE"
  | "NEUTRAL"
  | "RISK";

export type RecommendationConfidence = "Low" | "Medium" | "High";

export type RecommendationStrength =
  | "Watch"
  | "Lean"
  | "Recommend"
  | "Strong Recommend"
  | "Avoid";

export type DecisionScore = {
  score: number;
  confidence: RecommendationConfidence;
  strength: RecommendationStrength;
  scoreLabel: string;
  components: DecisionScoreComponent[];
};

export type DecisionScoreComponent = {
  key: string;
  label: string;
  rawValue: number;
  weight: number;
  weightedValue: number;
  explanation: string;
};

export type DecisionFactor = {
  key: string;
  label: string;
  value: string | number;
  direction: DecisionFactorDirection;
  weight?: number;
  explanation: string;
};

export type SupportingFactor = DecisionFactor & {
  direction: "POSITIVE" | "NEUTRAL";
};

export type RiskFactor = DecisionFactor & {
  severity: "Low" | "Medium" | "High";
  direction: "RISK" | "NEGATIVE";
};

export type RecommendationWarning = {
  key: string;
  label: string;
  severity: "Low" | "Medium" | "High";
  message: string;
};

export type RecommendationEvidence = {
  source: string;
  label: string;
  summary: string;
  url?: string | null;
  publishedAt?: Date | null;
};

export type RecommendationAlternative = {
  playerId: string;
  playerName: string;
  position: string;
  team: string | null;
  recommendationType: DecisionRecommendationType;
  decisionScore: number;
  reason: string;
};

export type DecisionSubject = {
  playerId: string;
  playerName: string;
  position: string;
  team: string | null;
};

export type DecisionRecommendation = {
  id: string;
  type: DecisionRecommendationType;
  title: string;
  recommendation: string;
  subject: DecisionSubject;
  decisionScore: DecisionScore;
  supportingFactors: SupportingFactor[];
  riskFactors: RiskFactor[];
  warnings: RecommendationWarning[];
  evidence: RecommendationEvidence[];
  evidenceSummary: string;
  alternatives: RecommendationAlternative[];
  explanation: string;
  generatedAt: Date;
  context: {
    targetSeason: number;
    source: "DECISION_ENGINE";
    mode: "DEVELOPMENT_PREVIEW";
  };
};

export type DecisionEngineFilters = {
  targetSeason?: number | string | null;
  includeHistorical?: boolean;
  limit?: number | string | null;
  position?: string | null;
};

export type DecisionEngineDashboard = {
  filters: {
    targetSeason: number;
    includeHistorical: boolean;
    limit: number;
    position: string | null;
  };
  recommendations: DecisionRecommendation[];
  positionOptions: string[];
  sourceCounts: {
    playerTrustProfiles: number;
    playerIntelligenceRows: number;
    expertMemoryRows: number;
    consensusRows: number;
    weightedConsensusRows: number;
  };
  widgets: {
    strongestRecommendations: DecisionRecommendation[];
    highestRiskRecommendations: DecisionRecommendation[];
    draftTargets: DecisionRecommendation[];
    avoidList: DecisionRecommendation[];
    watchList: DecisionRecommendation[];
  };
  supportedRecommendationTypes: DecisionRecommendationType[];
};

export const DECISION_RECOMMENDATION_TYPES = [
  "DRAFT",
  "AVOID",
  "REACH",
  "WAIT",
  "VALUE",
  "BUY",
  "SELL",
  "HOLD",
  "START",
  "SIT",
  "WAIVER_ADD",
  "WAIVER_HOLD",
] as const satisfies readonly DecisionRecommendationType[];
