import type { FantasyPlatformAdapter, Roster } from "@/domain/fantasy";
import { SleeperClient, SleeperLeagueNotFoundError } from "./sleeper-client";
import {
  mapSleeperLeague,
  mapSleeperLeagueSettings,
  mapSleeperMatchups,
  mapSleeperPlayersByIds,
  mapSleeperRosters,
  mapSleeperTeams,
} from "./sleeper-mappers";

export class SleeperAdapter implements FantasyPlatformAdapter {
  readonly platform = "SLEEPER" as const;

  constructor(private readonly client = new SleeperClient()) {}

  async getLeague(platformLeagueId: string) {
    const league = await this.getValidatedLeague(platformLeagueId);
    return mapSleeperLeague(league);
  }

  async getSettings(platformLeagueId: string) {
    const league = await this.getValidatedLeague(platformLeagueId);
    return mapSleeperLeagueSettings(league);
  }

  async getTeams(platformLeagueId: string) {
    const [rosters, users] = await Promise.all([
      this.client.getRosters(platformLeagueId),
      this.client.getUsers(platformLeagueId),
    ]);

    return mapSleeperTeams(platformLeagueId, rosters, users);
  }

  async getRosters(platformLeagueId: string) {
    const [rosters, users] = await Promise.all([
      this.client.getRosters(platformLeagueId),
      this.client.getUsers(platformLeagueId),
    ]);

    return mapSleeperRosters(platformLeagueId, rosters, users);
  }

  async getMatchups(platformLeagueId: string, week: number) {
    const matchups = await this.client.getMatchups(platformLeagueId, week);
    return mapSleeperMatchups(platformLeagueId, week, matchups);
  }

  async getPlayers(platformLeagueId: string) {
    const rosters = await this.getRosters(platformLeagueId);
    return this.getPlayersByIds(collectRosterPlayerIds(rosters));
  }

  async getPlayersByIds(playerIds: Set<string>) {
    const players = await this.client.getPlayers();
    return mapSleeperPlayersByIds(players, playerIds);
  }

  private async getValidatedLeague(platformLeagueId: string) {
    const league = await this.client.getLeague(platformLeagueId);

    if (!league?.league_id) {
      throw new SleeperLeagueNotFoundError(platformLeagueId);
    }

    return league;
  }
}

function collectRosterPlayerIds(rosters: Roster[]) {
  const playerIds = new Set<string>();

  for (const roster of rosters) {
    for (const player of roster.players) {
      playerIds.add(player.playerId);
    }
  }

  return playerIds;
}
