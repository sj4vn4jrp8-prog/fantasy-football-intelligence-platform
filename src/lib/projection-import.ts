import { db } from "@/lib/db";
import type { PlayerProjection, ProviderName } from "@/domain/fantasy";
import { env } from "@/lib/env";
import {
  FantasyProsApiUnavailableError,
  FantasyProsConfigurationError,
  FantasyProsNoProjectionsError,
  FantasyProsProvider,
  FantasyProsUnauthorizedError,
  type FantasyProsProjectionRow,
} from "@/providers/projections/fantasypros-provider";
import { MockProjectionProvider } from "@/providers/projections/mock-projection-provider";

export interface ProjectionImportSummary {
  leagueId: string;
  leagueName: string;
  season: number;
  week: number;
  provider: ProviderName;
  playersConsidered: number;
  projectionsImported: number;
  projectionsReturned?: number;
  playersMatched?: number;
  playersUnmatched?: number;
  warnings?: string[];
}

export class ProjectionImportLeagueNotFoundError extends Error {
  constructor(leagueId: string) {
    super(`League ${leagueId} was not found.`);
    this.name = "ProjectionImportLeagueNotFoundError";
  }
}

export class ProjectionImportNoMatchedPlayersError extends Error {
  constructor() {
    super("No FantasyPros projections matched players rostered in this league.");
    this.name = "ProjectionImportNoMatchedPlayersError";
  }
}

export async function importMockProjectionsForLeague(
  leagueId: string,
  week: number,
): Promise<ProjectionImportSummary> {
  const league = await db.league.findFirst({
    where: {
      OR: [
        { id: leagueId },
        {
          externalIdentities: {
            some: {
              externalId: leagueId,
            },
          },
        },
      ],
    },
    include: {
      rosterPlayers: {
        include: {
          player: true,
        },
      },
    },
  });

  if (!league) {
    throw new ProjectionImportLeagueNotFoundError(leagueId);
  }

  const playersById = new Map(
    league.rosterPlayers.map((rosterPlayer) => [
      rosterPlayer.player.id,
      rosterPlayer.player,
    ]),
  );
  const players = Array.from(playersById.values());
  const provider = new MockProjectionProvider();
  const projections = await provider.getPlayerProjections({
    season: league.season,
    week,
    players: players.map((player) => ({
      id: player.id,
      position: player.position,
      team: player.team,
      active: player.active,
    })),
  });
  const projectionsImported = await savePlayerProjections(projections);

  return {
    leagueId: league.id,
    leagueName: league.name,
    season: league.season,
    week,
    provider: "MOCK",
    playersConsidered: players.length,
    projectionsImported,
  };
}

export async function importFantasyProsProjectionsForLeague(
  leagueId: string,
  week: number,
): Promise<ProjectionImportSummary> {
  const league = await db.league.findFirst({
    where: {
      OR: [
        { id: leagueId },
        {
          externalIdentities: {
            some: {
              externalId: leagueId,
            },
          },
        },
      ],
    },
    include: {
      rosterPlayers: {
        include: {
          player: {
            include: {
              externalIdentities: true,
            },
          },
        },
      },
    },
  });

  if (!league) {
    throw new ProjectionImportLeagueNotFoundError(leagueId);
  }

  const rosteredPlayers = Array.from(
    new Map(
      league.rosterPlayers.map((rosterPlayer) => [
        rosterPlayer.player.id,
        rosterPlayer.player,
      ]),
    ).values(),
  );
  const provider = new FantasyProsProvider({
    apiKey: env.fantasyProsApiKey,
    baseUrl: env.fantasyProsBaseUrl,
  });
  const fantasyProsRows = await provider.getPlayerProjections({
    season: league.season,
    week,
  });
  const { projections, matchedCount, unmatchedCount, warnings } =
    await matchFantasyProsRowsToLeaguePlayers({
      season: league.season,
      week,
      rows: fantasyProsRows,
      rosteredPlayers,
    });

  if (projections.length === 0) {
    throw new ProjectionImportNoMatchedPlayersError();
  }

  const projectionsImported = await savePlayerProjections(projections);

  return {
    leagueId: league.id,
    leagueName: league.name,
    season: league.season,
    week,
    provider: "FANTASYPROS",
    playersConsidered: rosteredPlayers.length,
    projectionsReturned: fantasyProsRows.length,
    playersMatched: matchedCount,
    playersUnmatched: unmatchedCount,
    projectionsImported,
    warnings,
  };
}

type RosteredPlayerForMatching = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  position: string;
  team: string | null;
  externalIdentities: Array<{
    provider: ProviderName;
    externalId: string;
  }>;
};

async function matchFantasyProsRowsToLeaguePlayers({
  season,
  week,
  rows,
  rosteredPlayers,
}: {
  season: number;
  week: number;
  rows: FantasyProsProjectionRow[];
  rosteredPlayers: RosteredPlayerForMatching[];
}) {
  const rosteredPlayersByFantasyProsId = new Map<string, RosteredPlayerForMatching>();
  const rosteredPlayersByFallbackKey = new Map<string, RosteredPlayerForMatching>();
  const projections: PlayerProjection[] = [];
  const matchedPlayerIds = new Set<string>();
  const warnings: string[] = [];
  let unmatchedCount = 0;

  for (const player of rosteredPlayers) {
    const fantasyProsIdentity = player.externalIdentities.find(
      (identity) => identity.provider === "FANTASYPROS",
    );

    if (fantasyProsIdentity) {
      rosteredPlayersByFantasyProsId.set(fantasyProsIdentity.externalId, player);
    }

    rosteredPlayersByFallbackKey.set(buildPlayerMatchKey(player), player);
  }

  for (const row of rows) {
    const matchedPlayer = findFantasyProsMatch({
      row,
      rosteredPlayersByFantasyProsId,
      rosteredPlayersByFallbackKey,
    });

    if (!matchedPlayer) {
      unmatchedCount += 1;
      continue;
    }

    matchedPlayerIds.add(matchedPlayer.id);

    if (row.fantasyProsPlayerId) {
      await upsertFantasyProsPlayerIdentity(matchedPlayer.id, row);
    }

    projections.push({
      playerId: matchedPlayer.id,
      season,
      week,
      projectedStats: row.projectedStats,
      projectedFantasyPoints: row.projectedFantasyPoints,
      floor: row.floor,
      median: row.median,
      ceiling: row.ceiling,
      confidence: row.confidence,
      source: {
        provider: "FANTASYPROS",
        sourceTimestamp: row.sourceTimestamp,
      },
    });
  }

  const unmatchedRosteredPlayers = rosteredPlayers.length - matchedPlayerIds.size;

  if (unmatchedRosteredPlayers > 0) {
    warnings.push(
      `${unmatchedRosteredPlayers} rostered player${
        unmatchedRosteredPlayers === 1 ? "" : "s"
      } did not receive a FantasyPros projection for this week.`,
    );
  }

  return {
    projections,
    matchedCount: matchedPlayerIds.size,
    unmatchedCount,
    warnings,
  };
}

function findFantasyProsMatch({
  row,
  rosteredPlayersByFantasyProsId,
  rosteredPlayersByFallbackKey,
}: {
  row: FantasyProsProjectionRow;
  rosteredPlayersByFantasyProsId: Map<string, RosteredPlayerForMatching>;
  rosteredPlayersByFallbackKey: Map<string, RosteredPlayerForMatching>;
}) {
  if (row.fantasyProsPlayerId) {
    const identityMatch = rosteredPlayersByFantasyProsId.get(
      row.fantasyProsPlayerId,
    );

    if (identityMatch) return identityMatch;
  }

  return rosteredPlayersByFallbackKey.get(buildFantasyProsRowMatchKey(row));
}

async function upsertFantasyProsPlayerIdentity(
  playerId: string,
  row: FantasyProsProjectionRow,
) {
  if (!row.fantasyProsPlayerId) return;

  await db.playerExternalIdentity.upsert({
    where: {
      provider_externalId: {
        provider: "FANTASYPROS",
        externalId: row.fantasyProsPlayerId,
      },
    },
    create: {
      playerId,
      provider: "FANTASYPROS",
      externalId: row.fantasyProsPlayerId,
      metadata: {
        playerName: row.playerName,
        team: row.team,
        position: row.position,
        matchSource: "fantasypros_projection_import",
      },
    },
    update: {
      playerId,
      metadata: {
        playerName: row.playerName,
        team: row.team,
        position: row.position,
        matchSource: "fantasypros_projection_import",
      },
    },
  });
}

function buildPlayerMatchKey(player: RosteredPlayerForMatching) {
  return [
    normalizePlayerName(player.fullName),
    normalizeTeam(player.team),
    normalizePosition(player.position),
  ].join("|");
}

function buildFantasyProsRowMatchKey(row: FantasyProsProjectionRow) {
  return [
    normalizePlayerName(row.playerName),
    normalizeTeam(row.team),
    normalizePosition(row.position),
  ].join("|");
}

function normalizePlayerName(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeTeam(value: string | null | undefined) {
  if (!value) return "";

  const normalized = value.trim().toUpperCase();

  if (normalized === "JAC") return "JAX";
  if (normalized === "WAS") return "WSH";

  return normalized;
}

function normalizePosition(value: string | null | undefined) {
  const normalized = (value ?? "").trim().toUpperCase();

  if (normalized === "DEF" || normalized === "D/ST") return "DST";

  return normalized;
}

export async function savePlayerProjections(projections: PlayerProjection[]) {
  let importedCount = 0;

  for (const projection of projections) {
    await db.playerProjection.upsert({
      where: {
        playerId_season_week_provider: {
          playerId: projection.playerId,
          season: projection.season,
          week: projection.week,
          provider: projection.source.provider,
        },
      },
      create: {
        playerId: projection.playerId,
        season: projection.season,
        week: projection.week,
        provider: projection.source.provider,
        projectedStats: projection.projectedStats,
        projectedFantasyPoints: projection.projectedFantasyPoints ?? null,
        floor: projection.floor ?? null,
        median: projection.median ?? null,
        ceiling: projection.ceiling ?? null,
        confidence: projection.confidence ?? null,
        projectionVariance: projection.projectionVariance ?? null,
        sourceTimestamp: parseSourceTimestamp(projection.source.sourceTimestamp),
      },
      update: {
        projectedStats: projection.projectedStats,
        projectedFantasyPoints: projection.projectedFantasyPoints ?? null,
        floor: projection.floor ?? null,
        median: projection.median ?? null,
        ceiling: projection.ceiling ?? null,
        confidence: projection.confidence ?? null,
        projectionVariance: projection.projectionVariance ?? null,
        sourceTimestamp: parseSourceTimestamp(projection.source.sourceTimestamp),
      },
    });

    importedCount += 1;
  }

  return importedCount;
}

export {
  FantasyProsApiUnavailableError,
  FantasyProsConfigurationError,
  FantasyProsNoProjectionsError,
  FantasyProsUnauthorizedError,
};

function parseSourceTimestamp(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}
