import { db } from "@/lib/db";
import type { PlayerProjection, ProviderName } from "@/domain/fantasy";
import { MockProjectionProvider } from "@/providers/projections/mock-projection-provider";

export interface ProjectionImportSummary {
  leagueId: string;
  leagueName: string;
  season: number;
  week: number;
  provider: ProviderName;
  playersConsidered: number;
  projectionsImported: number;
}

export class ProjectionImportLeagueNotFoundError extends Error {
  constructor(leagueId: string) {
    super(`League ${leagueId} was not found.`);
    this.name = "ProjectionImportLeagueNotFoundError";
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

async function savePlayerProjections(projections: PlayerProjection[]) {
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
        projectedFantasyPoints: projection.projectedFantasyPoints,
        floor: projection.floor,
        median: projection.median,
        ceiling: projection.ceiling,
        confidence: projection.confidence,
        projectionVariance: projection.projectionVariance,
        sourceTimestamp: parseSourceTimestamp(projection.source.sourceTimestamp),
      },
      update: {
        projectedStats: projection.projectedStats,
        projectedFantasyPoints: projection.projectedFantasyPoints,
        floor: projection.floor,
        median: projection.median,
        ceiling: projection.ceiling,
        confidence: projection.confidence,
        projectionVariance: projection.projectionVariance,
        sourceTimestamp: parseSourceTimestamp(projection.source.sourceTimestamp),
      },
    });

    importedCount += 1;
  }

  return importedCount;
}

function parseSourceTimestamp(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}
