const SLEEPER_BASE_URL = "https://api.sleeper.app/v1";

export class SleeperApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "SleeperApiError";
  }
}

export class SleeperLeagueNotFoundError extends Error {
  constructor(leagueId: string) {
    super(`Sleeper league ${leagueId} was not found.`);
    this.name = "SleeperLeagueNotFoundError";
  }
}

export class SleeperClient {
  async getLeague(leagueId: string) {
    return this.getJson(`/league/${leagueId}`);
  }

  async getUsers(leagueId: string) {
    return this.getJson(`/league/${leagueId}/users`);
  }

  async getRosters(leagueId: string) {
    return this.getJson(`/league/${leagueId}/rosters`);
  }

  async getMatchups(leagueId: string, week: number) {
    return this.getJson(`/league/${leagueId}/matchups/${week}`);
  }

  async getLeagueDrafts(leagueId: string) {
    return this.getJson(`/league/${leagueId}/drafts`);
  }

  async getDraft(draftId: string) {
    return this.getJson(`/draft/${draftId}`);
  }

  async getDraftPicks(draftId: string) {
    return this.getJson(`/draft/${draftId}/picks`);
  }

  async getPlayers() {
    return this.getJson("/players/nfl", { cache: "no-store" });
  }

  private async getJson(path: string, init?: Pick<RequestInit, "cache">) {
    let response: Response;

    try {
      response = await fetch(`${SLEEPER_BASE_URL}${path}`, {
        cache: init?.cache ?? "no-store",
      });
    } catch {
      throw new SleeperApiError("Sleeper API is unavailable right now.");
    }

    if (!response.ok) {
      if (response.status === 404) {
        throw new SleeperLeagueNotFoundError(path);
      }

      throw new SleeperApiError(
        `Sleeper request failed: ${response.status} ${path}`,
        response.status,
      );
    }

    return response.json();
  }
}
