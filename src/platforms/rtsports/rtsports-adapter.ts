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

export class RTSportsAdapter implements FantasyPlatformAdapter {
  readonly platform = "RTSPORTS" as const;

  async getLeague(): Promise<League> {
    return throwAdapterNotImplemented("RT Sports");
  }

  async getTeams(): Promise<Team[]> {
    return throwAdapterNotImplemented("RT Sports");
  }

  async getRosters(): Promise<Roster[]> {
    return throwAdapterNotImplemented("RT Sports");
  }

  async getMatchups(): Promise<Matchup[]> {
    return throwAdapterNotImplemented("RT Sports");
  }

  async getPlayers(): Promise<Player[]> {
    return throwAdapterNotImplemented("RT Sports");
  }

  async getTransactions(): Promise<Transaction[]> {
    return throwAdapterNotImplemented("RT Sports");
  }

  async getDraftData(): Promise<DraftData[]> {
    return throwAdapterNotImplemented("RT Sports");
  }

  async getSettings(): Promise<LeagueSettings> {
    return throwAdapterNotImplemented("RT Sports");
  }
}
