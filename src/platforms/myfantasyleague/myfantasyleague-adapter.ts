import type {
  DraftData,
  FantasyPlatformAdapter,
  League,
  LeagueSettings,
  Matchup,
  Player,
  Roster,
  Team,
  Transaction,
} from "@/domain/fantasy";
import { throwAdapterNotImplemented } from "@/platforms/not-implemented";

export class MyFantasyLeagueAdapter implements FantasyPlatformAdapter {
  readonly platform = "MYFANTASYLEAGUE" as const;

  async getLeague(): Promise<League> {
    return throwAdapterNotImplemented("MyFantasyLeague");
  }

  async getTeams(): Promise<Team[]> {
    return throwAdapterNotImplemented("MyFantasyLeague");
  }

  async getRosters(): Promise<Roster[]> {
    return throwAdapterNotImplemented("MyFantasyLeague");
  }

  async getMatchups(): Promise<Matchup[]> {
    return throwAdapterNotImplemented("MyFantasyLeague");
  }

  async getPlayers(): Promise<Player[]> {
    return throwAdapterNotImplemented("MyFantasyLeague");
  }

  async getTransactions(): Promise<Transaction[]> {
    return throwAdapterNotImplemented("MyFantasyLeague");
  }

  async getDraftData(): Promise<DraftData[]> {
    return throwAdapterNotImplemented("MyFantasyLeague");
  }

  async getSettings(): Promise<LeagueSettings> {
    return throwAdapterNotImplemented("MyFantasyLeague");
  }
}
