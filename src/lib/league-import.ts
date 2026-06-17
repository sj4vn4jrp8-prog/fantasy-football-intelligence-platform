import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import type {
  ExternalIds,
  FantasyPlatform,
  LeagueRosterSettings,
  LeagueScoringRule,
  LeagueSettings,
  Matchup,
  Player,
  ProviderName,
  Roster,
  RosterPlayerStatus,
} from "@/domain/fantasy";

export interface LeagueImportInput {
  settings: LeagueSettings;
  rosters: Roster[];
  players: Player[];
  matchups: Matchup[];
  requestedWeek: number;
  warnings?: string[];
}

export interface LeagueImportSummary {
  leagueId: string;
  platform: FantasyPlatform;
  platformLeagueId: string;
  leagueName: string;
  season: number;
  week: number;
  teamsImported: number;
  rosteredPlayersImported: number;
  matchupsImported: number;
  warnings: string[];
}

type TeamRecord = {
  id: string;
  platformRosterId: string;
};

type DbWriter = typeof db;

export async function saveLeagueImport({
  settings,
  rosters,
  players,
  matchups,
  requestedWeek,
  warnings: incomingWarnings = [],
}: LeagueImportInput): Promise<LeagueImportSummary> {
  const importedAt = new Date();
  const safeSettings = normalizeLeagueSettings(settings);
  const safeRosters = normalizeRosters(rosters, safeSettings.platform);
  const safeMatchups = normalizeMatchups(matchups);
  const warnings = buildImportWarnings({
    rosters: safeRosters,
    matchups: safeMatchups,
    incomingWarnings,
  });
  const playersByPlatformId = new Map(
    players.map((player) => [
      getExternalIdForProvider(player.externalIds, safeSettings.platform) ??
        player.id,
      player,
    ]),
  );
  const rosteredPlatformPlayerIds = new Set(
    safeRosters.flatMap((roster) =>
      roster.players.map((player) => player.playerId).filter(Boolean),
    ),
  );
  const importedPlatformPlayerIds = collectImportedPlatformPlayerIds(
    safeRosters,
    safeMatchups,
  );

  const league = await upsertLeague(db, safeSettings, importedAt);

  await upsertScoringRules(db, league.id, safeSettings.scoringRules);
  await upsertRosterSettings(db, league.id, safeSettings.rosterSettings);

  const teamRecords = await upsertTeams(
    db,
    league.id,
    safeSettings.platform,
    safeRosters,
  );
  const teamsByPlatformRosterId = new Map(
    teamRecords.map((team) => [team.platformRosterId, team]),
  );

  const playerIdsByPlatformId = await upsertImportedPlayers(
    db,
    safeSettings.platform,
    importedPlatformPlayerIds,
    playersByPlatformId,
  );

  await upsertRosterPlayers(
    db,
    league.id,
    safeSettings.platform,
    safeRosters,
    teamsByPlatformRosterId,
    playerIdsByPlatformId,
  );

  const matchupsImported = await upsertMatchups(
    db,
    league.id,
    safeMatchups,
    teamsByPlatformRosterId,
  );

  const summary: LeagueImportSummary = {
    leagueId: league.id,
    platform: safeSettings.platform,
    platformLeagueId: safeSettings.platformLeagueId,
    leagueName: safeSettings.name,
    season: safeSettings.season,
    week: requestedWeek,
    teamsImported: teamRecords.length,
    rosteredPlayersImported: rosteredPlatformPlayerIds.size,
    matchupsImported,
    warnings,
  };

  await db.dataSourceAuditLog.create({
    data: {
      provider: "SLEEPER",
      entityType: "league_import",
      entityId: league.id,
      sourceTimestamp: importedAt,
      rawPayloadHash: hashImportPayload({
        settings: safeSettings,
        rosterCount: safeRosters.length,
        rosteredPlayerCount: rosteredPlatformPlayerIds.size,
        importedPlayerCount: importedPlatformPlayerIds.size,
        matchupCount: safeMatchups.length,
        requestedWeek,
        warnings,
      }),
      metadata: {
        leagueId: summary.leagueId,
        platform: summary.platform,
        platformLeagueId: summary.platformLeagueId,
        leagueName: summary.leagueName,
        season: summary.season,
        week: summary.week,
        teamsImported: summary.teamsImported,
        rosteredPlayersImported: summary.rosteredPlayersImported,
        matchupsImported: summary.matchupsImported,
        warnings: summary.warnings,
      },
    },
  });

  return summary;
}

async function upsertLeague(
  client: DbWriter,
  settings: LeagueSettings,
  importedAt: Date,
) {
  const identity = await client.leagueExternalIdentity.findUnique({
    where: {
      provider_externalId: {
        provider: settings.platform,
        externalId: settings.platformLeagueId,
      },
    },
    select: { leagueId: true },
  });
  const leagueData = {
    name: settings.name,
    season: settings.season,
    platform: settings.platform,
    scoringPreset: settings.scoringPreset,
    providerTier: "FREE" as const,
    importedAt,
  };
  const league = identity
    ? await client.league.update({
        where: { id: identity.leagueId },
        data: leagueData,
      })
    : await upsertLeagueWithoutExistingIdentity(client, settings, leagueData);

  await client.leagueExternalIdentity.upsert({
    where: {
      provider_externalId: {
        provider: settings.platform,
        externalId: settings.platformLeagueId,
      },
    },
    create: {
      leagueId: league.id,
      provider: settings.platform,
      externalId: settings.platformLeagueId,
      metadata: {
        name: settings.name,
        season: settings.season,
      },
    },
    update: {
      leagueId: league.id,
      metadata: {
        name: settings.name,
        season: settings.season,
      },
    },
  });

  return league;
}

async function upsertLeagueWithoutExistingIdentity(
  client: DbWriter,
  settings: LeagueSettings,
  leagueData: {
    name: string;
    season: number;
    platform: FantasyPlatform;
    scoringPreset: LeagueSettings["scoringPreset"];
    providerTier: "FREE";
    importedAt: Date;
  },
) {
  const existingLeague = await client.league.findFirst({
    where: {
      platform: settings.platform,
      name: settings.name,
      season: settings.season,
    },
    select: { id: true },
  });

  if (existingLeague) {
    return client.league.update({
      where: { id: existingLeague.id },
      data: leagueData,
    });
  }

  return client.league.create({
    data: leagueData,
  });
}

async function upsertScoringRules(
  client: DbWriter,
  leagueId: string,
  rules: LeagueScoringRule[],
) {
  const normalizedRules = rules.map((rule) => ({
    ...rule,
    position: rule.position ?? "ALL",
  }));

  if (normalizedRules.length === 0) {
    await client.leagueScoringRule.deleteMany({ where: { leagueId } });
    return;
  }

  await client.leagueScoringRule.deleteMany({
    where: {
      leagueId,
      NOT: {
        OR: normalizedRules.map((rule) => ({
          statKey: rule.statKey,
          position: rule.position,
        })),
      },
    },
  });

  for (const rule of normalizedRules) {
    await client.leagueScoringRule.upsert({
      where: {
        leagueId_statKey_position: {
          leagueId,
          statKey: rule.statKey,
          position: rule.position,
        },
      },
      create: {
        leagueId,
        statKey: rule.statKey,
        points: rule.points,
        position: rule.position,
        description: rule.description,
      },
      update: {
        points: rule.points,
        description: rule.description,
      },
    });
  }
}

async function upsertRosterSettings(
  client: DbWriter,
  leagueId: string,
  settings: LeagueRosterSettings,
) {
  await client.leagueRosterSettings.upsert({
    where: { leagueId },
    create: {
      leagueId,
      qb: settings.qb,
      rb: settings.rb,
      wr: settings.wr,
      te: settings.te,
      flex: settings.flex,
      superflex: settings.superflex,
      k: settings.k,
      dst: settings.dst,
      idp: settings.idp,
      bench: settings.bench,
      ir: settings.ir,
      taxi: settings.taxi,
      keeperSlots: settings.keeperSlots,
      playoffStartWeek: settings.playoffStartWeek,
      playoffEndWeek: settings.playoffEndWeek,
      playoffWeightMultiplier: settings.playoffWeightMultiplier,
    },
    update: {
      qb: settings.qb,
      rb: settings.rb,
      wr: settings.wr,
      te: settings.te,
      flex: settings.flex,
      superflex: settings.superflex,
      k: settings.k,
      dst: settings.dst,
      idp: settings.idp,
      bench: settings.bench,
      ir: settings.ir,
      taxi: settings.taxi,
      keeperSlots: settings.keeperSlots,
      playoffStartWeek: settings.playoffStartWeek,
      playoffEndWeek: settings.playoffEndWeek,
      playoffWeightMultiplier: settings.playoffWeightMultiplier,
    },
  });
}

async function upsertTeams(
  client: DbWriter,
  leagueId: string,
  provider: ProviderName,
  rosters: Roster[],
): Promise<TeamRecord[]> {
  const teams: TeamRecord[] = [];

  for (const roster of rosters) {
    const platformRosterId = getPlatformRosterId(roster, provider);
    if (!platformRosterId) continue;

    const teamName = sanitizeRequiredString(
      roster.teamName,
      `Roster ${platformRosterId}`,
    );
    const identity = await client.teamExternalIdentity.findUnique({
      where: {
        provider_leagueId_externalId: {
          provider,
          leagueId,
          externalId: platformRosterId,
        },
      },
      select: { teamId: true },
    });
    const team = identity
      ? await client.fantasyTeam.update({
          where: { id: identity.teamId },
          data: { name: teamName },
          select: { id: true },
        })
      : await upsertTeamWithoutExistingIdentity(client, leagueId, teamName);

    await client.teamExternalIdentity.upsert({
      where: {
        provider_leagueId_externalId: {
          provider,
          leagueId,
          externalId: platformRosterId,
        },
      },
      create: {
        teamId: team.id,
        leagueId,
        provider,
        externalId: platformRosterId,
        metadata: {
          teamName,
          platformOwnerId: sanitizeOptionalString(roster.platformOwnerId),
        },
      },
      update: {
        teamId: team.id,
        metadata: {
          teamName,
          platformOwnerId: sanitizeOptionalString(roster.platformOwnerId),
        },
      },
    });

    teams.push({
      id: team.id,
      platformRosterId,
    });
  }

  return teams;
}

async function upsertTeamWithoutExistingIdentity(
  client: DbWriter,
  leagueId: string,
  teamName: string,
) {
  const existingTeam = await client.fantasyTeam.findFirst({
    where: {
      leagueId,
      name: teamName,
    },
    select: { id: true },
  });

  if (existingTeam) {
    return client.fantasyTeam.update({
      where: { id: existingTeam.id },
      data: { name: teamName },
      select: { id: true },
    });
  }

  return client.fantasyTeam.create({
    data: {
      leagueId,
      name: teamName,
    },
    select: { id: true },
  });
}

async function upsertImportedPlayers(
  client: DbWriter,
  provider: ProviderName,
  platformPlayerIds: Set<string>,
  playersByPlatformId: Map<string, Player>,
) {
  const playerIdsByPlatformId = new Map<string, string>();

  for (const platformPlayerId of platformPlayerIds) {
    const player = playersByPlatformId.get(platformPlayerId);
    const fullName = getBestImportedPlayerName(player, platformPlayerId);
    const position = sanitizeRequiredString(player?.position, "UNKNOWN");
    const identity = await client.playerExternalIdentity.findUnique({
      where: {
        provider_externalId: {
          provider,
          externalId: platformPlayerId,
        },
      },
      select: { playerId: true },
    });
    const playerData = {
      firstName: sanitizeOptionalString(player?.firstName),
      lastName: sanitizeOptionalString(player?.lastName),
      fullName,
      position,
      team: sanitizeOptionalString(player?.team),
      active: player?.active ?? true,
    };
    const savedPlayer = identity
      ? await client.player.update({
          where: { id: identity.playerId },
          data: playerData,
          select: { id: true },
        })
      : await upsertPlayerWithoutExistingIdentity(client, playerData);

    await client.playerExternalIdentity.upsert({
      where: {
        provider_externalId: {
          provider,
          externalId: platformPlayerId,
        },
      },
      create: {
        playerId: savedPlayer.id,
        provider,
        externalId: platformPlayerId,
        metadata: buildPlayerIdentityMetadata(player),
      },
      update: {
        playerId: savedPlayer.id,
        metadata: buildPlayerIdentityMetadata(player),
      },
    });

    playerIdsByPlatformId.set(platformPlayerId, savedPlayer.id);
  }

  return playerIdsByPlatformId;
}

async function upsertPlayerWithoutExistingIdentity(
  client: DbWriter,
  playerData: {
    firstName?: string;
    lastName?: string;
    fullName: string;
    position: string;
    team?: string;
    active: boolean;
  },
) {
  const existingPlayer = await client.player.findFirst({
    where: {
      fullName: playerData.fullName,
      position: playerData.position,
      team: playerData.team,
    },
    select: { id: true },
  });

  if (existingPlayer) {
    return client.player.update({
      where: { id: existingPlayer.id },
      data: playerData,
      select: { id: true },
    });
  }

  return client.player.create({
    data: playerData,
    select: { id: true },
  });
}

function buildPlayerIdentityMetadata(player: Player | undefined) {
  if (!player) {
    return undefined;
  }

  return {
    fullName: player.fullName,
    firstName: sanitizeOptionalString(player.firstName),
    lastName: sanitizeOptionalString(player.lastName),
    position: player.position,
    team: sanitizeOptionalString(player.team),
    active: player.active,
  };
}

async function upsertRosterPlayers(
  client: DbWriter,
  leagueId: string,
  provider: ProviderName,
  rosters: Roster[],
  teamsByPlatformRosterId: Map<string, TeamRecord>,
  playerIdsByPlatformId: Map<string, string>,
) {
  for (const roster of rosters) {
    const platformRosterId = getPlatformRosterId(roster, provider);
    if (!platformRosterId) continue;

    const team = teamsByPlatformRosterId.get(platformRosterId);
    if (!team) continue;

    const desiredPlayerIds = roster.players
      .map((player) => playerIdsByPlatformId.get(player.playerId))
      .filter((playerId): playerId is string => Boolean(playerId));

    if (desiredPlayerIds.length > 0) {
      await client.rosterPlayer.deleteMany({
        where: {
          leagueId,
          teamId: team.id,
          playerId: { notIn: desiredPlayerIds },
        },
      });
    } else {
      await client.rosterPlayer.deleteMany({
        where: {
          leagueId,
          teamId: team.id,
        },
      });
    }

    for (const rosterPlayer of roster.players) {
      const playerId = playerIdsByPlatformId.get(rosterPlayer.playerId);
      if (!playerId) continue;

      await client.rosterPlayer.upsert({
        where: {
          teamId_playerId: {
            teamId: team.id,
            playerId,
          },
        },
        create: {
          leagueId,
          teamId: team.id,
          playerId,
          status: rosterPlayer.status as RosterPlayerStatus,
          rosterSlot: rosterPlayer.rosterSlot,
        },
        update: {
          leagueId,
          status: rosterPlayer.status as RosterPlayerStatus,
          rosterSlot: rosterPlayer.rosterSlot,
        },
      });
    }
  }
}

async function upsertMatchups(
  client: DbWriter,
  leagueId: string,
  matchups: Matchup[],
  teamsByPlatformRosterId: Map<string, TeamRecord>,
) {
  let importedCount = 0;
  const importedByWeek = new Map<number, Set<string>>();

  for (const matchup of matchups) {
    const teams = matchup.teams
      .map((team) => ({
        platformRosterId: team.rosterId,
        dbTeam: teamsByPlatformRosterId.get(team.rosterId),
        points: team.points,
      }))
      .filter((team) => team.dbTeam)
      .sort(
        (a, b) =>
          Number(a.platformRosterId) - Number(b.platformRosterId) ||
          a.platformRosterId.localeCompare(b.platformRosterId),
      );

    const teamA = teams[0];
    if (!teamA?.dbTeam) continue;

    const teamB = teams[1];
    const teamBId = teamB?.dbTeam?.id ?? null;
    const sourceTimestamp = parseSourceTimestamp(matchup.source.sourceTimestamp);
    const matchupKey = buildMatchupKey(teamA.dbTeam.id, teamBId);
    const weekKeys = importedByWeek.get(matchup.week) ?? new Set<string>();
    weekKeys.add(matchupKey);
    importedByWeek.set(matchup.week, weekKeys);

    const existing = await client.fantasyMatchup.findFirst({
      where: {
        leagueId,
        week: matchup.week,
        teamAId: teamA.dbTeam.id,
        teamBId,
      },
      select: { id: true },
    });

    if (existing) {
      await client.fantasyMatchup.update({
        where: { id: existing.id },
        data: {
          teamAScore: teamA.points,
          teamBScore: teamB?.points,
          sourceTimestamp,
        },
      });
    } else {
      await client.fantasyMatchup.create({
        data: {
          leagueId,
          week: matchup.week,
          teamAId: teamA.dbTeam.id,
          teamBId,
          teamAScore: teamA.points,
          teamBScore: teamB?.points,
          sourceTimestamp,
        },
      });
    }

    importedCount += 1;
  }

  for (const [week, importedKeys] of importedByWeek.entries()) {
    const existing = await client.fantasyMatchup.findMany({
      where: { leagueId, week },
      select: { id: true, teamAId: true, teamBId: true },
    });
    const staleIds = existing
      .filter(
        (matchup) => !importedKeys.has(buildMatchupKey(matchup.teamAId, matchup.teamBId)),
      )
      .map((matchup) => matchup.id);

    if (staleIds.length > 0) {
      await client.fantasyMatchup.deleteMany({
        where: { id: { in: staleIds } },
      });
    }
  }

  return importedCount;
}

function buildMatchupKey(teamAId: string, teamBId: string | null) {
  return `${teamAId}:${teamBId ?? "bye"}`;
}

function getBestImportedPlayerName(
  player: Player | undefined,
  fallbackPlayerId: string,
) {
  return (
    sanitizePlayerDisplayName(player?.fullName) ??
    sanitizePlayerDisplayName(
      [player?.firstName, player?.lastName].filter(Boolean).join(" "),
    ) ??
    fallbackPlayerId
  );
}

function sanitizePlayerDisplayName(value: unknown) {
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();

  if (!trimmed || trimmed.toLowerCase() === "unknown") {
    return undefined;
  }

  return trimmed;
}

function hashImportPayload(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function collectImportedPlatformPlayerIds(rosters: Roster[], matchups: Matchup[]) {
  const playerIds = new Set<string>();

  for (const roster of rosters) {
    for (const rosterPlayer of roster.players) {
      if (rosterPlayer.playerId) {
        playerIds.add(rosterPlayer.playerId);
      }
    }
  }

  for (const matchup of matchups) {
    for (const team of matchup.teams) {
      for (const playerId of [...team.players, ...team.starters]) {
        if (playerId) {
          playerIds.add(playerId);
        }
      }
    }
  }

  return playerIds;
}

function normalizeLeagueSettings(settings: LeagueSettings): LeagueSettings {
  const platformLeagueId = sanitizeRequiredString(
    settings.platformLeagueId ?? settings.id,
    "unknown-platform-league",
  );
  const scoringRules = Array.isArray(settings.scoringRules)
    ? settings.scoringRules
        .filter((rule) => rule.statKey && Number.isFinite(rule.points))
        .map((rule) => ({
          ...rule,
          statKey: sanitizeRequiredString(rule.statKey, "unknown_stat"),
          position: rule.position ?? "ALL",
          description: sanitizeOptionalString(rule.description),
        }))
    : [];
  const scoringPreset = settings.scoringPreset ?? "CUSTOM";

  return {
    ...settings,
    id: platformLeagueId,
    leagueId: platformLeagueId,
    platformLeagueId,
    platform: settings.platform ?? "SLEEPER",
    name: sanitizeRequiredString(settings.name, "Untitled fantasy league"),
    season: Number.isInteger(settings.season)
      ? settings.season
      : new Date().getFullYear(),
    scoringPreset,
    scoring: {
      preset: scoringPreset,
      rules: scoringRules,
    },
    scoringRules,
    rosterSettings: {
      qb: settings.rosterSettings?.qb ?? 0,
      rb: settings.rosterSettings?.rb ?? 0,
      wr: settings.rosterSettings?.wr ?? 0,
      te: settings.rosterSettings?.te ?? 0,
      flex: settings.rosterSettings?.flex ?? 0,
      superflex: settings.rosterSettings?.superflex ?? 0,
      k: settings.rosterSettings?.k ?? 0,
      dst: settings.rosterSettings?.dst ?? 0,
      idp: settings.rosterSettings?.idp ?? 0,
      bench: settings.rosterSettings?.bench ?? 0,
      ir: settings.rosterSettings?.ir ?? 0,
      taxi: settings.rosterSettings?.taxi ?? 0,
      keeperSlots: settings.rosterSettings?.keeperSlots ?? 0,
      playoffStartWeek: settings.rosterSettings?.playoffStartWeek,
      playoffEndWeek: settings.rosterSettings?.playoffEndWeek,
      playoffWeightMultiplier:
        settings.rosterSettings?.playoffWeightMultiplier ?? 1,
    },
  };
}

function normalizeRosters(rosters: Roster[], provider: ProviderName) {
  if (!Array.isArray(rosters)) return [];

  return rosters
    .filter((roster) => getPlatformRosterId(roster, provider))
    .map((roster) => ({
      ...roster,
      platformRosterId: getPlatformRosterId(roster, provider),
      platformOwnerId: sanitizeOptionalString(roster.platformOwnerId),
      teamName: sanitizeRequiredString(
        roster.teamName,
        `Roster ${getPlatformRosterId(roster, provider)}`,
      ),
      players: Array.isArray(roster.players)
        ? roster.players
            .filter((player) => sanitizeOptionalString(player.playerId))
            .map((player) => ({
              ...player,
              playerId: sanitizeRequiredString(player.playerId, "unknown"),
              status: player.status ?? "BENCH",
            }))
        : [],
    }));
}

function normalizeMatchups(matchups: Matchup[]) {
  if (!Array.isArray(matchups)) return [];

  return matchups.map((matchup) => ({
    ...matchup,
    teams: Array.isArray(matchup.teams)
      ? matchup.teams.filter((team) => sanitizeOptionalString(team.rosterId))
      : [],
  }));
}

function buildImportWarnings({
  rosters,
  matchups,
  incomingWarnings,
}: {
  rosters: Roster[];
  matchups: Matchup[];
  incomingWarnings: string[];
}) {
  const warnings = [...incomingWarnings];
  const rosteredPlayerCount = rosters.reduce(
    (count, roster) => count + roster.players.length,
    0,
  );

  if (rosters.length === 0) {
    warnings.push("No fantasy teams were found yet.");
  }

  if (rosteredPlayerCount === 0) {
    warnings.push("No rostered players found yet.");
  }

  if (matchups.length === 0) {
    warnings.push("No matchups found for the selected week yet.");
  }

  return warnings;
}

function getPlatformRosterId(roster: Roster, provider: ProviderName) {
  return (
    sanitizeOptionalString(roster.platformRosterId) ??
    sanitizeOptionalString(getExternalIdForProvider(roster.externalIds, provider)) ??
    sanitizeOptionalString(roster.id)
  );
}

function getExternalIdForProvider(
  externalIds: ExternalIds,
  provider: ProviderName,
) {
  switch (provider) {
    case "SLEEPER":
      return externalIds.sleeper;
    case "YAHOO":
      return externalIds.yahoo;
    case "ESPN":
      return externalIds.espn;
    case "RTSPORTS":
      return externalIds.rtSports;
    case "MYFANTASYLEAGUE":
      return externalIds.myFantasyLeague;
    case "FANTASYPROS":
      return externalIds.fantasyPros;
    case "FANTASY_NERDS":
      return externalIds.fantasyNerds;
    case "FANTASYDATA":
      return externalIds.fantasyData;
    case "SPORTSDATAIO":
      return externalIds.sportsDataIO;
    case "MANUAL":
      return undefined;
  }
}

function sanitizeRequiredString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : fallback;
}

function sanitizeOptionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function parseSourceTimestamp(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}
