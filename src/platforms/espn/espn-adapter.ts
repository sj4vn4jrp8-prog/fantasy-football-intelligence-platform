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

export class ESPNAdapter implements FantasyPlatformAdapter {
  readonly platform = "ESPN" as const;

  async getLeague(): Promise<League> {
    return throwAdapterNotImplemented("ESPN");
  }

  async getTeams(): Promise<Team[]> {
    return throwAdapterNotImplemented("ESPN");
  }

  async getRosters(): Promise<Roster[]> {
    return throwAdapterNotImplemented("ESPN");
  }

  async getMatchups(): Promise<Matchup[]> {
    return throwAdapterNotImplemented("ESPN");
  }

  async getPlayers(): Promise<Player[]> {
    return throwAdapterNotImplemented("ESPN");
  }

  async getTransactions(): Promise<Transaction[]> {
    return throwAdapterNotImplemented("ESPN");
  }

  async getDraftData(): Promise<DraftData[]> {
    return throwAdapterNotImplemented("ESPN");
  }

  async getSettings(): Promise<LeagueSettings> {
    return throwAdapterNotImplemented("ESPN");
  }
}
