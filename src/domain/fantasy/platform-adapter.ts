import type {
  DraftData,
  League,
  LeagueSettings,
  Matchup,
  Player,
  Roster,
  Team,
  Transaction,
} from "./models";

export interface FantasyPlatformAdapter {
  getLeague(platformLeagueId: string): Promise<League>;
  getTeams(platformLeagueId: string): Promise<Team[]>;
  getRosters(platformLeagueId: string): Promise<Roster[]>;
  getMatchups(platformLeagueId: string, week: number): Promise<Matchup[]>;
  getPlayers(platformLeagueId: string): Promise<Player[]>;
  getTransactions?(platformLeagueId: string): Promise<Transaction[]>;
  getDraftData?(platformLeagueId: string): Promise<DraftData[]>;
  getSettings(platformLeagueId: string): Promise<LeagueSettings>;
}
