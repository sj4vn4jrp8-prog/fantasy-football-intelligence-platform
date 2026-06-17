export type FantasyPlatform =
  | "SLEEPER"
  | "YAHOO"
  | "ESPN"
  | "RTSPORTS"
  | "MYFANTASYLEAGUE"
  | "MANUAL";

export type ProjectionProviderName =
  | "MOCK"
  | "FANTASYPROS"
  | "FANTASY_NERDS"
  | "SPORTSDATAIO"
  | "FANTASYDATA";

export type ProviderName = FantasyPlatform | ProjectionProviderName;

export type ProviderTier = "FREE" | "PRO" | "ELITE";

export type Position =
  | "QB"
  | "RB"
  | "WR"
  | "TE"
  | "K"
  | "DST"
  | "DEF"
  | "DL"
  | "LB"
  | "DB"
  | "IDP";

export type RosterPlayerStatus = "STARTER" | "BENCH" | "IR" | "TAXI";

export interface DataSourceMeta {
  provider: ProviderName;
  sourceTimestamp: string;
}

export interface PlatformExternalIds {
  sleeper?: string;
  yahoo?: string;
  espn?: string;
  rtSports?: string;
  myFantasyLeague?: string;
}

export interface ProviderExternalIds {
  sportsDataIO?: string;
  fantasyPros?: string;
  fantasyNerds?: string;
  fantasyData?: string;
}

export type ExternalIds = PlatformExternalIds & ProviderExternalIds;

export interface League {
  id: string;
  platform: FantasyPlatform;
  platformLeagueId: string;
  name: string;
  season: number;
  scoringPreset: "STANDARD" | "HALF_PPR" | "PPR" | "CUSTOM";
  isDynasty?: boolean;
  isKeeper?: boolean;
  settings?: LeagueSettings;
  externalIds: PlatformExternalIds;
  source: DataSourceMeta;
}

export interface Team {
  id: string;
  leagueId: string;
  platformTeamId: string;
  platformOwnerId?: string;
  name: string;
  externalIds: PlatformExternalIds;
  source: DataSourceMeta;
}

export interface RosterPlayer {
  playerId: string;
  status: RosterPlayerStatus;
  rosterSlot?: string;
}

export interface Roster {
  id: string;
  leagueId: string;
  teamName: string;
  platformRosterId?: string;
  platformOwnerId?: string;
  players: RosterPlayer[];
  externalIds: PlatformExternalIds;
  source: DataSourceMeta;
}

export interface Player {
  id: string;
  firstName?: string;
  lastName?: string;
  fullName: string;
  position: Position | string;
  team?: string;
  active: boolean;
  source: DataSourceMeta;
  externalIds: ExternalIds;
}

export interface MatchupTeam {
  rosterId: string;
  points?: number;
  starters: string[];
  players: string[];
}

export interface Matchup {
  id: string;
  leagueId: string;
  week: number;
  teams: MatchupTeam[];
  source: DataSourceMeta;
}

export interface ScoringRule {
  statKey: string;
  points: number;
  position?: Position | "ALL";
  description?: string;
}

export type LeagueScoringRule = ScoringRule;

export interface ScoringSettings {
  preset: "STANDARD" | "HALF_PPR" | "PPR" | "CUSTOM";
  rules: ScoringRule[];
}

export interface RosterSettings {
  qb: number;
  rb: number;
  wr: number;
  te: number;
  flex: number;
  superflex: number;
  k: number;
  dst: number;
  idp: number;
  bench: number;
  ir: number;
  taxi: number;
  keeperSlots: number;
  playoffStartWeek?: number;
  playoffEndWeek?: number;
  playoffWeightMultiplier: number;
}

export type LeagueRosterSettings = RosterSettings;

export interface LeagueSettings {
  id: string;
  leagueId?: string;
  platform: FantasyPlatform;
  platformLeagueId: string;
  name: string;
  season: number;
  scoringPreset: "STANDARD" | "HALF_PPR" | "PPR" | "CUSTOM";
  scoring: ScoringSettings;
  scoringRules: LeagueScoringRule[];
  rosterSettings: RosterSettings;
  source: DataSourceMeta;
}

export interface Transaction {
  id: string;
  leagueId: string;
  platformTransactionId: string;
  type: string;
  status?: string;
  week?: number;
  createdAt?: string;
  teamIds: string[];
  playerIds: string[];
  raw?: unknown;
  source: DataSourceMeta;
}

export interface DraftData {
  id: string;
  leagueId: string;
  platformDraftId: string;
  season: number;
  rounds?: number;
  picks?: DraftPick[];
  raw?: unknown;
  source: DataSourceMeta;
}

export interface DraftPick {
  round: number;
  pick: number;
  teamId?: string;
  playerId?: string;
}

export type ProjectionStats = Record<string, number>;

export interface PlayerProjection {
  playerId: string;
  season: number;
  week: number;
  projectedStats: ProjectionStats;
  projectedFantasyPoints?: number;
  floor?: number;
  median?: number;
  ceiling?: number;
  confidence?: number;
  providerPoints?: Partial<Record<ProviderName, number>>;
  projectionVariance?: number;
  source: DataSourceMeta;
}

export interface PlayerInjury {
  playerId: string;
  status: string;
  bodyPart?: string;
  notes?: string;
  source: DataSourceMeta;
}

export interface PlayerNews {
  playerId?: string;
  headline: string;
  summary?: string;
  url?: string;
  publishedAt: string;
  source: DataSourceMeta;
}

export interface DepthChart {
  team: string;
  position: string;
  players: Array<{
    playerId: string;
    rank: number;
  }>;
  source: DataSourceMeta;
}

export interface NflSchedule {
  season: number;
  week: number;
  homeTeam: string;
  awayTeam: string;
  gameTime?: string;
  weather?: Record<string, unknown>;
  odds?: Record<string, unknown>;
  source: DataSourceMeta;
}
