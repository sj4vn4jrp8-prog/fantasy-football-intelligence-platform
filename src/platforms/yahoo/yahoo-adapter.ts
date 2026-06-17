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

export class YahooAdapter implements FantasyPlatformAdapter {
  readonly platform = "YAHOO" as const;

  async getLeague(): Promise<League> {
    return throwAdapterNotImplemented("Yahoo");
  }

  async getTeams(): Promise<Team[]> {
    return throwAdapterNotImplemented("Yahoo");
  }

  async getRosters(): Promise<Roster[]> {
    return throwAdapterNotImplemented("Yahoo");
  }

  async getMatchups(): Promise<Matchup[]> {
    return throwAdapterNotImplemented("Yahoo");
  }

  async getPlayers(): Promise<Player[]> {
    return throwAdapterNotImplemented("Yahoo");
  }

  async getTransactions(): Promise<Transaction[]> {
    return throwAdapterNotImplemented("Yahoo");
  }

  async getDraftData(): Promise<DraftData[]> {
    return throwAdapterNotImplemented("Yahoo");
  }

  async getSettings(): Promise<LeagueSettings> {
    return throwAdapterNotImplemented("Yahoo");
  }
}
