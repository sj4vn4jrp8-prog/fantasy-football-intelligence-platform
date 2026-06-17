import type {
  League,
  LeagueRosterSettings,
  LeagueScoringRule,
  LeagueSettings,
  Matchup,
  Player,
  Roster,
  Team,
} from "@/domain/fantasy";

type SleeperLeague = {
  league_id: string;
  name: string;
  season: string;
  scoring_settings?: Record<string, number>;
  roster_positions?: string[];
};

type SleeperRoster = {
  roster_id: number;
  owner_id?: string;
  players?: string[];
  starters?: string[];
};

type SleeperUser = {
  user_id: string;
  display_name?: string;
  metadata?: {
    team_name?: string;
  };
};

type SleeperMatchupRow = {
  matchup_id?: number;
  roster_id: number;
  points?: number;
  players?: string[];
  starters?: string[];
};

type SleeperPlayer = {
  player_id?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  search_full_name?: string;
  position?: string;
  team?: string;
  active?: boolean;
};

const nowIso = () => new Date().toISOString();

export function mapSleeperLeagueSettings(
  league: SleeperLeague,
): LeagueSettings {
  const scoringRules = Object.entries(league.scoring_settings ?? {}).map(
    ([statKey, points]): LeagueScoringRule => ({
      statKey,
      points,
      position: "ALL",
      description: statKey.replaceAll("_", " "),
    }),
  );

  const scoringPreset = inferScoringPreset(scoringRules);

  return {
    id: league.league_id,
    leagueId: league.league_id,
    platformLeagueId: league.league_id,
    name: league.name || `Sleeper league ${league.league_id}`,
    season: Number(league.season),
    platform: "SLEEPER",
    scoringPreset,
    scoring: {
      preset: scoringPreset,
      rules: scoringRules,
    },
    scoringRules,
    rosterSettings: mapSleeperRosterSettings(league.roster_positions ?? []),
    source: {
      provider: "SLEEPER",
      sourceTimestamp: nowIso(),
    },
  };
}

export function mapSleeperLeague(league: SleeperLeague): League {
  const settings = mapSleeperLeagueSettings(league);

  return {
    id: league.league_id,
    platform: "SLEEPER",
    platformLeagueId: league.league_id,
    name: settings.name,
    season: settings.season,
    scoringPreset: settings.scoringPreset,
    settings,
    externalIds: {
      sleeper: league.league_id,
    },
    source: {
      provider: "SLEEPER",
      sourceTimestamp: nowIso(),
    },
  };
}

export function mapSleeperTeams(
  leagueId: string,
  rosters: SleeperRoster[],
  users: SleeperUser[],
): Team[] {
  const safeUsers = Array.isArray(users) ? users : [];
  const safeRosters = Array.isArray(rosters) ? rosters : [];
  const usersById = new Map(safeUsers.map((user) => [user.user_id, user]));

  return safeRosters.map((roster) => {
    const owner = roster.owner_id ? usersById.get(roster.owner_id) : undefined;
    const teamName =
      owner?.metadata?.team_name ||
      owner?.display_name ||
      `Roster ${roster.roster_id}`;

    return {
      id: String(roster.roster_id),
      leagueId,
      platformTeamId: String(roster.roster_id),
      platformOwnerId: roster.owner_id,
      name: teamName,
      externalIds: {
        sleeper: String(roster.roster_id),
      },
      source: {
        provider: "SLEEPER",
        sourceTimestamp: nowIso(),
      },
    };
  });
}

export function mapSleeperRosters(
  leagueId: string,
  rosters: SleeperRoster[],
  users: SleeperUser[],
): Roster[] {
  const safeUsers = Array.isArray(users) ? users : [];
  const safeRosters = Array.isArray(rosters) ? rosters : [];
  const usersById = new Map(safeUsers.map((user) => [user.user_id, user]));

  return safeRosters.map((roster) => {
    const owner = roster.owner_id ? usersById.get(roster.owner_id) : undefined;
    const starters = new Set(roster.starters ?? []);
    const teamName =
      owner?.metadata?.team_name ||
      owner?.display_name ||
      `Roster ${roster.roster_id}`;

    return {
      id: String(roster.roster_id),
      leagueId,
      teamName,
      platformRosterId: String(roster.roster_id),
      platformOwnerId: roster.owner_id,
      externalIds: {
        sleeper: String(roster.roster_id),
      },
      players: Array.isArray(roster.players)
        ? roster.players
            .filter((playerId): playerId is string => Boolean(playerId))
            .map((playerId) => ({
              playerId,
              status: starters.has(playerId) ? "STARTER" : "BENCH",
            }))
        : [],
      source: {
        provider: "SLEEPER",
        sourceTimestamp: nowIso(),
      },
    };
  });
}

export function mapSleeperMatchups(
  leagueId: string,
  week: number,
  rows: SleeperMatchupRow[],
): Matchup[] {
  const grouped = new Map<number, SleeperMatchupRow[]>();

  for (const row of Array.isArray(rows) ? rows : []) {
    if (!Number.isFinite(row.roster_id)) continue;

    const matchupId = row.matchup_id ?? row.roster_id;
    grouped.set(matchupId, [...(grouped.get(matchupId) ?? []), row]);
  }

  return Array.from(grouped.entries()).map(([matchupId, teams]) => ({
    id: `${leagueId}-${week}-${matchupId}`,
    leagueId,
    week,
    teams: teams.map((team) => ({
      rosterId: String(team.roster_id),
      points: team.points,
      starters: team.starters ?? [],
      players: team.players ?? [],
    })),
    source: {
      provider: "SLEEPER",
      sourceTimestamp: nowIso(),
    },
  }));
}

export function mapSleeperPlayers(
  playerMap: Record<string, SleeperPlayer>,
): Player[] {
  if (!playerMap || typeof playerMap !== "object") return [];

  return Object.entries(playerMap).map(([id, player]) =>
    mapSleeperPlayer(id, player),
  );
}

export function mapSleeperPlayersByIds(
  playerMap: Record<string, SleeperPlayer>,
  playerIds: Set<string>,
): Player[] {
  if (!playerMap || typeof playerMap !== "object" || playerIds.size === 0) {
    return [];
  }

  return Array.from(playerIds)
    .map((playerId) => {
      const player = playerMap[playerId];
      return player ? mapSleeperPlayer(playerId, player) : undefined;
    })
    .filter((player): player is Player => Boolean(player));
}

function mapSleeperPlayer(id: string, player: SleeperPlayer): Player {
  return {
    id,
    firstName: sanitizeSleeperText(player.first_name),
    lastName: sanitizeSleeperText(player.last_name),
    fullName: getBestSleeperPlayerName(id, player),
    position: sanitizeSleeperText(player.position) ?? "UNKNOWN",
    team: sanitizeSleeperText(player.team),
    active: player.active ?? true,
    externalIds: {
      sleeper: sanitizeSleeperText(player.player_id) ?? id,
    },
    source: {
      provider: "SLEEPER",
      sourceTimestamp: nowIso(),
    },
  };
}

function getBestSleeperPlayerName(id: string, player: SleeperPlayer) {
  return (
    sanitizeSleeperName(player.full_name) ??
    sanitizeSleeperName(
      [player.first_name, player.last_name].filter(Boolean).join(" "),
    ) ??
    sanitizeSleeperName(player.search_full_name) ??
    id
  );
}

function sanitizeSleeperName(value?: string) {
  const cleaned = sanitizeSleeperText(value);

  if (!cleaned || cleaned.toLowerCase() === "unknown") {
    return undefined;
  }

  return cleaned;
}

function sanitizeSleeperText(value?: string) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function mapSleeperRosterSettings(
  rosterPositions: string[],
): LeagueRosterSettings {
  const count = (slot: string) =>
    rosterPositions.filter((position) => position === slot).length;

  return {
    qb: count("QB"),
    rb: count("RB"),
    wr: count("WR"),
    te: count("TE"),
    flex: count("FLEX"),
    superflex: count("SUPER_FLEX"),
    k: count("K"),
    dst: count("DEF") + count("DST"),
    idp: count("IDP") + count("DL") + count("LB") + count("DB"),
    bench: count("BN"),
    ir: count("IR"),
    taxi: count("TAXI"),
    keeperSlots: 0,
    playoffWeightMultiplier: 1,
  };
}

function inferScoringPreset(
  scoringRules: LeagueScoringRule[],
): "STANDARD" | "HALF_PPR" | "PPR" | "CUSTOM" {
  const receptionRule = scoringRules.find((rule) => rule.statKey === "rec");

  if (!receptionRule || receptionRule.points === 0) return "STANDARD";
  if (receptionRule.points === 0.5) return "HALF_PPR";
  if (receptionRule.points === 1) return "PPR";

  return "CUSTOM";
}
